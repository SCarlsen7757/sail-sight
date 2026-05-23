"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Mark } from "@/lib/schemas";
import { Button, Card, Input, Textarea } from "@/components/ui/controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { FilterToolbar, SearchInput } from "@/components/ui/filter-toolbar";
import { ThreeDotMenu } from "@/components/ui/three-dot-menu";
import { useToast } from "@/hooks/useToast";
import { Plus, X } from "lucide-react";

interface Draft { name: string; activeFrom: string; activeUntil: string; latitude: string; longitude: string; description: string; }
const emptyDraft = (): Draft => ({ name: "", activeFrom: new Date().toISOString().slice(0, 10), activeUntil: "", latitude: "", longitude: "", description: "" });

export default function MarksPage() {
  const toast = useToast();
  const [list, setList] = useState<Mark[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeOnDate, setActiveOnDate] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [confirmDelete, setConfirmDelete] = useState<Mark | null>(null);

  const load = () => api.GET("/api/v1/marks" as any, {} as any).then(({ data, error }: any) => {
    if (error) setError("Failed to load"); else setList(data as Mark[]);
  });
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!list) return [];
    const today = new Date().toISOString().slice(0, 10);
    return list.filter((m) => {
      const q = search.toLowerCase();
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (activeOnly) {
        if (m.activeUntil && m.activeUntil < today) return false;
      }
      if (activeOnDate) {
        if (m.activeFrom > activeOnDate) return false;
        if (m.activeUntil && m.activeUntil < activeOnDate) return false;
      }
      return true;
    });
  }, [list, search, activeOnDate, activeOnly]);

  const openNew = () => { setPanelId("new"); setDraft(emptyDraft()); };
  const openEdit = (m: Mark) => {
    setPanelId(String(m.id));
    setDraft({
      name: m.name,
      activeFrom: m.activeFrom,
      activeUntil: m.activeUntil ?? "",
      latitude: String(m.latitude),
      longitude: String(m.longitude),
      description: m.description ?? "",
    });
  };

  const submit = async () => {
    if (!draft.name || !draft.latitude || !draft.longitude) { toast.push({ kind: "warning", message: "Name, lat, lon required." }); return; }
    const body = {
      name: draft.name,
      activeFrom: draft.activeFrom,
      activeUntil: draft.activeUntil || null,
      latitude: Number(draft.latitude),
      longitude: Number(draft.longitude),
      description: draft.description || null,
    };
    const isNew = panelId === "new";
    const url = isNew ? "/api/v1/marks" : `/api/v1/marks/${panelId}`;
    const res = await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { toast.push({ kind: "success", message: isNew ? "Mark created." : "Mark saved." }); setPanelId(null); load(); }
    else toast.push({ kind: "error", message: "Save failed." });
  };

  const doDelete = async (m: Mark) => {
    const res = await fetch(`/api/v1/marks/${m.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    if (res.ok || res.status === 204) { toast.push({ kind: "success", message: "Mark deleted." }); load(); }
    else if (res.status === 409) toast.push({ kind: "error", message: "Mark is used in a course." });
    else toast.push({ kind: "error", message: "Delete failed." });
  };

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!list) return <SkeletonLoader className="h-40" />;

  return (
    <div className={panelId ? "grid gap-6 lg:grid-cols-[1fr_28rem]" : undefined}>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/courses" className="text-sm text-action-primary hover:underline">← Courses</Link>
            <h1 className="text-2xl font-bold">Marks</h1>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> New mark</Button>
        </div>
        <FilterToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Name…" />
          <Input type="date" value={activeOnDate} onChange={(e) => setActiveOnDate(e.target.value)} className="w-44" />
          <label className="flex items-center gap-1 text-sm text-text-secondary">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Active only
          </label>
        </FilterToolbar>

        <Card className="mt-4 overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Active from</th>
                <th className="px-3 py-2 text-left">Active until</th>
                <th className="px-3 py-2 text-left">Lat</th>
                <th className="px-3 py-2 text-left">Lon</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={String(m.id)} className="cursor-pointer border-t border-border-default text-sm hover:bg-bg-elevated/40" onClick={() => openEdit(m)}>
                  <td className="px-3 py-2">{m.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{m.activeFrom}</td>
                  <td className="px-3 py-2 text-text-secondary">{m.activeUntil ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{Number(m.latitude).toFixed(6)}</td>
                  <td className="px-3 py-2 font-mono">{Number(m.longitude).toFixed(6)}</td>
                  <td className="px-3 py-2 text-text-secondary"><span className="block max-w-[16rem] truncate">{m.description ?? "—"}</span></td>
                  <td className="px-3 py-2">
                    <ThreeDotMenu items={[
                      { label: "Edit", onClick: () => openEdit(m) },
                      { label: "Delete", destructive: true, onClick: () => setConfirmDelete(m) },
                    ]} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-text-secondary">No marks.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {panelId && (
        <Card className="p-5 self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{panelId === "new" ? "New mark" : "Edit mark"}</h2>
            <button onClick={() => setPanelId(null)} className="text-text-secondary hover:text-text-primary"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">
            <label className="block"><span className="text-sm text-text-secondary">Name</span><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0"><span className="text-sm text-text-secondary">Active from</span><Input type="date" value={draft.activeFrom} onChange={(e) => setDraft({ ...draft, activeFrom: e.target.value })} /></label>
              <label className="block min-w-0"><span className="text-sm text-text-secondary">Active until</span><Input type="date" value={draft.activeUntil} onChange={(e) => setDraft({ ...draft, activeUntil: e.target.value })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0"><span className="text-sm text-text-secondary">Latitude</span><Input type="number" step="0.000001" value={draft.latitude} onChange={(e) => setDraft({ ...draft, latitude: e.target.value })} /></label>
              <label className="block min-w-0"><span className="text-sm text-text-secondary">Longitude</span><Input type="number" step="0.000001" value={draft.longitude} onChange={(e) => setDraft({ ...draft, longitude: e.target.value })} /></label>
            </div>
            <label className="block"><span className="text-sm text-text-secondary">Description</span><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPanelId(null)}>Cancel</Button>
              <Button onClick={submit}>Save</Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete mark"
        message={`Delete "${confirmDelete?.name}"?`}
        destructive
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

