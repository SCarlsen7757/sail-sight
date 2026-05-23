"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { RaceSummary } from "@/lib/schemas";
import { Button, Card } from "@/components/ui/controls";
import { useToast } from "@/hooks/useToast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sparkles, Square, RefreshCw, Trash2, Copy } from "lucide-react";

export function AiSummary({ raceId }: { raceId: string }) {
  const toast = useToast();
  const [summary, setSummary] = useState<RaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const url = `/api/v1/races/${raceId}/summary`;

  const load = async () => {
    setLoading(true);
    const r = await fetch(url);
    if (r.ok) setSummary(await r.json());
    else if (r.status === 404) setSummary(null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [raceId]);

  const generate = async () => {
    setStreaming(true);
    setStreamText("");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(url, { method: "POST", signal: ac.signal });
      if (!res.body) { toast.push({ kind: "error", message: "No response body" }); setStreaming(false); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // Parse SSE-style "data: ..." or treat as raw
        const lines = buf.split(/\n\n/);
        buf = lines.pop() ?? "";
        for (const block of lines) {
          const m = block.match(/^data:\s*(.*)$/m);
          setStreamText((s) => s + (m ? m[1] : block));
        }
      }
      if (buf) setStreamText((s) => s + buf);
      await load();
    } catch (err: any) {
      if (err.name !== "AbortError") toast.push({ kind: "error", message: "Generation failed" });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const del = async () => {
    setConfirmDel(false);
    const r = await fetch(url, { method: "DELETE" });
    if (r.ok || r.status === 204) { toast.push({ kind: "success", message: "Deleted." }); setSummary(null); }
    else toast.push({ kind: "error", message: "Delete failed." });
  };

  const copy = () => {
    if (summary?.content) {
      navigator.clipboard.writeText(summary.content);
      toast.push({ kind: "info", message: "Copied to clipboard." });
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-action-primary" /> AI race summary
        </h3>
        <div className="flex items-center gap-2">
          {streaming ? (
            <Button variant="secondary" onClick={stop}><Square className="h-4 w-4" /> Stop</Button>
          ) : summary ? (
            <>
              <Button variant="secondary" onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
              <Button variant="secondary" onClick={generate}><RefreshCw className="h-4 w-4" /> Regenerate</Button>
              <Button variant="danger" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            </>
          ) : (
            !loading && <Button onClick={generate}><Sparkles className="h-4 w-4" /> Generate</Button>
          )}
        </div>
      </div>
      {summary?.isStale && (
        <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning">
          This summary is out of date for the current race data. Regenerate to refresh.
        </div>
      )}
      <div className="prose prose-sm max-w-none text-text-primary dark:prose-invert">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : streaming ? (
          <ReactMarkdown>{streamText || "_Generating…_"}</ReactMarkdown>
        ) : summary ? (
          <ReactMarkdown>{summary.content}</ReactMarkdown>
        ) : (
          <p className="text-text-secondary">No summary yet. Click <em>Generate</em> to create one.</p>
        )}
      </div>
      {summary && !streaming && (
        <p className="mt-3 text-xs text-text-secondary">Model: {summary.model} · Generated {new Date(summary.generatedAt).toLocaleString()}</p>
      )}
      <ConfirmDialog
        open={confirmDel}
        title="Delete summary"
        message="Delete the existing AI race summary?"
        destructive
        confirmLabel="Delete"
        onConfirm={del}
        onCancel={() => setConfirmDel(false)}
      />
    </Card>
  );
}
