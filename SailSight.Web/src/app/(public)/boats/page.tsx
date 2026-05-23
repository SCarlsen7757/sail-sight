"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Boat, BoatClass } from "@/lib/schemas";
import { Button, Card, Input, Select, Textarea } from "@/components/ui/controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { FilterToolbar, SearchInput } from "@/components/ui/filter-toolbar";
import { ThreeDotMenu } from "@/components/ui/three-dot-menu";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/lib/auth-context";
import { Plus, X, Globe, Lock } from "lucide-react";

interface Draft { name: string; sailNumber: string; boatClassId: string; description: string; isPublic: boolean; }
const emptyDraft = (classes: BoatClass[]): Draft => ({ name: "", sailNumber: "", boatClassId: classes[0] ? String(classes[0].id) : "", description: "", isPublic: false });

export default function BoatsPage() {
  const { me, providers, loading } = useAuth();
  const isLoggedIn = !!me || providers?.mode === "SingleUser";
  const toast = useToast();
  const [boats, setBoats] = useState<Boat[] | null>(null);
  const [classes, setClasses] = useState<BoatClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [panelId, setPanelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", sailNumber: "", boatClassId: "", description: "", isPublic: false });
  const [confirmDelete, setConfirmDelete] = useState<Boat | null>(null);

  const load = () => {
    api.GET("/api/v1/boats" as any, {} as any).then(({ data, error }: any) => {
      if (error) setError("Failed to load boats");
      else setBoats(data as Boat[]);
    });
  };

  useEffect(() => {
    if (loading) return;
    load();
    if (isLoggedIn) {
      api.GET("/api/v1/boat-classes" as any, {} as any).then(({ data }: any) => setClasses((data as BoatClass[]) ?? []));
    }
  }, [loading, isLoggedIn]);

  const filtered = useMemo(() => {
    if (!boats) return [];
    return boats.filter((b) => {
      if (classFilter && String(b.boatClass.id) !== classFilter) return false;
      const q = search.toLowerCase();
      if (q && !b.name.toLowerCase().includes(q) && !(b.sailNumber ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [boats, search, classFilter]);

  const openNew = () => { setPanelId("new"); setDraft(emptyDraft(classes)); };
  const openEdit = (b: Boat) => {
    setPanelId(String(b.id));
    setDraft({ name: b.name, sailNumber: b.sailNumber ?? "", boatClassId: String(b.boatClass.id), description: b.description ?? "", isPublic: b.isPublic });
  };

  const submit = async () => {
    if (!draft.name || !draft.boatClassId) { toast.push({ kind: "warning", message: "Name and class are required." }); return; }
    const body = { name: draft.name, sailNumber: draft.sailNumber || null, boatClassId: draft.boatClassId, description: draft.description || null, isPublic: draft.isPublic };
    const isNew = panelId === "new";
    const url = isNew ? "/api/v1/boats" : `/api/v1/boats/${panelId}`;
    const res = await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { toast.push({ kind: "success", message: isNew ? "Boat created." : "Boat updated." }); setPanelId(null); load(); }
    else toast.push({ kind: "error", message: "Save failed." });
  };

  const doDelete = async (b: Boat) => {
    const res = await fetch(`/api/v1/boats/${b.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    if (res.ok || res.status === 204) { toast.push({ kind: "success", message: "Boat deleted." }); load(); }
    else if (res.status === 409) toast.push({ kind: "error", message: "Cannot delete: boat is referenced by sessions." });
    else toast.push({ kind: "error", message: "Delete failed." });
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonLoader key={i} className="h-12" />)}</div>;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!boats) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonLoader key={i} className="h-12" />)}</div>;

  // Anonymous read-only view — shows only public boats
  if (!isLoggedIn) {
    return (
      <div>
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Fleet</h1>
        </div>
        <FilterToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Name or sail #…" />
          <Link href="/boat-classes" className="ml-auto text-sm text-action-primary hover:underline">Boat classes →</Link>
        </FilterToolbar>
        <Card className="mt-4 overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Sail #</th>
                <th className="px-3 py-2 text-left">Class</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={String(b.id)} className="border-t border-border-default text-sm hover:bg-bg-elevated/40">
                  <td className="px-3 py-2">
                    <Link href={`/b/${b.id}`} className="text-action-primary hover:underline">{b.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{b.sailNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{b.boatClass.name}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-text-secondary">No public boats yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // Authenticated management view
  return (
    <div className={panelId ? "grid gap-6 lg:grid-cols-[1fr_28rem]" : undefined}>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Fleet</h1>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> New boat</Button>
        </div>
        <FilterToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Name or sail #…" />
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="w-48">
            <option value="">All classes</option>
            {classes.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
          </Select>
          <Link href="/boat-classes" className="ml-auto text-sm text-action-primary hover:underline">Boat classes →</Link>
        </FilterToolbar>

        <Card className="mt-4 overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Sail #</th>
                <th className="px-3 py-2 text-left">Class</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={String(b.id)} className="cursor-pointer border-t border-border-default text-sm hover:bg-bg-elevated/40" onClick={() => openEdit(b)}>
                  <td className="px-3 py-2"><Link className="text-action-primary hover:underline" href={`/boats/${b.id}`} onClick={(e) => e.stopPropagation()}>{b.name}</Link>{b.isPublic && <span className="ml-2 inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-xs text-green-400"><Globe className="h-3 w-3" />Public</span>}</td>
                  <td className="px-3 py-2 text-text-secondary">{b.sailNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{b.boatClass.name}</td>
                  <td className="px-3 py-2 text-text-secondary"><span className="block max-w-[16rem] truncate">{b.description ?? "—"}</span></td>
                  <td className="px-3 py-2">
                    <ThreeDotMenu items={[
                      { label: "Edit", onClick: () => openEdit(b) },
                      { label: "Delete", destructive: true, onClick: () => setConfirmDelete(b) },
                    ]} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-text-secondary">No boats yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {panelId && (
        <Card className="p-5 self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{panelId === "new" ? "New boat" : "Edit boat"}</h2>
            <button onClick={() => setPanelId(null)} className="text-text-secondary hover:text-text-primary"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">
            <label className="block"><span className="text-sm text-text-secondary">Name</span><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="block"><span className="text-sm text-text-secondary">Sail number</span><Input value={draft.sailNumber} onChange={(e) => setDraft({ ...draft, sailNumber: e.target.value })} /></label>
            <label className="block">
              <span className="text-sm text-text-secondary">Boat class</span>
              <Select value={draft.boatClassId} onChange={(e) => setDraft({ ...draft, boatClassId: e.target.value })}>
                <option value="">— Select class —</option>
                {classes.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
              </Select>
            </label>
            <label className="block"><span className="text-sm text-text-secondary">Description</span><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Visibility</span>
              <Button variant="secondary" onClick={() => setDraft({ ...draft, isPublic: !draft.isPublic })}>
                {draft.isPublic ? <><Globe className="mr-1 h-4 w-4" /> Public</> : <><Lock className="mr-1 h-4 w-4" /> Private</>}
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPanelId(null)}>Cancel</Button>
              <Button onClick={submit}>Save</Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete boat"
        message={`Delete "${confirmDelete?.name}"?`}
        destructive
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
