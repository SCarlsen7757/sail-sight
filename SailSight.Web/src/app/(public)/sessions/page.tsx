"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Schemas } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { formatDuration } from "@/lib/units";
import { Card } from "@/components/ui/controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThreeDotMenu } from "@/components/ui/three-dot-menu";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { FilterToolbar, SearchInput } from "@/components/ui/filter-toolbar";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

type SessionSummary = Schemas["SessionSummaryDto"];
type VisibilityFilter = "mine" | "team" | "public";

function SessionBadges({ session }: { session: SessionSummary }) {
  return (
    <span className="ml-1 inline-flex gap-1">
      {session.sharedViaTeams?.map((t) => (
        <span key={t} className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">{t}</span>
      ))}
      {session.isPublic && (
        <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400">Public</span>
      )}
    </span>
  );
}

export default function PublicSessionsPage() {
  const toast = useToast();
  const { me, providers } = useAuth();
  const authenticated = !!me || providers?.mode === "SingleUser";

  const [items, setItems] = useState<SessionSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [visibility, setVisibility] = useState<VisibilityFilter>(authenticated ? "mine" : "public");
  const [confirmDelete, setConfirmDelete] = useState<SessionSummary | null>(null);

  const refresh = useCallback(() => {
    setItems(null);
    api.GET("/api/v1/sessions" as any, {
      params: { query: { page, pageSize, search: search || undefined, visibility } },
    } as any).then(({ data, error }: any) => {
      if (error) { setError("Failed to load sessions"); return; }
      setItems((data?.items as SessionSummary[]) ?? []);
      setTotal((data?.total as number) ?? 0);
    });
  }, [page, pageSize, search, visibility]);

  useEffect(() => { refresh(); }, [refresh]);

  // For anonymous users, force "public" visibility (server returns empty for mine/team anyway).
  useEffect(() => {
    if (!authenticated && visibility !== "public") setVisibility("public");
  }, [authenticated, visibility]);

  const doDelete = async (s: SessionSummary) => {
    const res = await fetch(`/api/v1/sessions/${s.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    if (res.ok || res.status === 204) {
      toast.push({ kind: "success", message: `Deleted ${s.displayName ?? s.fileName}` });
      refresh();
    } else {
      toast.push({ kind: "error", message: "Failed to delete session" });
    }
  };

  if (error) return <ErrorBanner message={error} onRetry={refresh} />;

  const tabs: { id: VisibilityFilter; label: string; show: boolean }[] = [
    { id: "mine", label: "My Sessions", show: authenticated },
    { id: "team", label: "Team Sessions", show: authenticated },
    { id: "public", label: "Public", show: true },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Sessions</h1>

      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.filter((t) => t.show).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setVisibility(tab.id); setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition",
              visibility === tab.id
                ? "border-action-primary bg-action-primary/10 text-action-primary"
                : "border-border-default text-text-secondary hover:border-action-primary/50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FilterToolbar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name…" />
      </FilterToolbar>

      {items === null ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonLoader key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          title={visibility === "public" ? "No public sessions" : "No sessions yet"}
          description={visibility === "public" ? "There are no public sessions to view yet." : "Upload a .vkx file to get started."}
          actionLabel={authenticated ? "Upload" : undefined}
          actionHref={authenticated ? "/upload" : undefined}
        />
      ) : (
        <Card className="mt-4 overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-elevated">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase text-text-secondary">Session</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-text-secondary">Boat</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-text-secondary">Started</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-text-secondary">Duration</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-text-secondary">Races</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const dur = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000;
                const href = s.isOwned ? `/sessions/${s.id}` : `/s/${s.id}`;
                const title = s.displayName ?? s.fileName;
                return (
                  <tr key={String(s.id)} className="cursor-pointer border-t border-border-default text-sm hover:bg-bg-elevated/40">
                    <td className="px-3 py-2">
                      <Link href={href}>{title}</Link>
                      {s.displayName && <div className="text-[11px] text-text-secondary">{s.fileName}</div>}
                      <SessionBadges session={s} />
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{s.boatName ?? "—"}</td>
                    <td className="px-3 py-2 text-text-secondary">{new Date(s.startedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono">{formatDuration(dur)}</td>
                    <td className="px-3 py-2">{n(s.raceCount)}</td>
                    <td className="px-3 py-2">
                      <ThreeDotMenu items={[
                        { label: "Open", onClick: () => location.assign(href) },
                        ...(s.isOwned ? [{ label: "Delete", destructive: true, onClick: () => setConfirmDelete(s) }] : []),
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete session"
        message={`Delete "${confirmDelete?.displayName ?? confirmDelete?.fileName}"? This cannot be undone.`}
        destructive
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
