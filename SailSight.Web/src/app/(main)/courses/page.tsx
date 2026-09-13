"use client";

import { browserRequest } from "@/lib/browser-request";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Course, CourseSummary, Mark } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { Button, Card, Input, Select, Textarea } from "@/components/ui/controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { FilterToolbar, SearchInput } from "@/components/ui/filter-toolbar";
import { ThreeDotMenu } from "@/components/ui/three-dot-menu";
import { useToast } from "@/hooks/useToast";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";

interface Leg {
  markId: string;
  gateMarkId: string;
  legName: string;
  overrideRoundingRadiusMeters: string;
  legType: string;
  passingSide: string;
}
interface Draft { name: string; year: string; description: string; legs: Leg[]; }

const emptyDraft = (): Draft => ({ name: "", year: String(new Date().getFullYear()), description: "", legs: [] });

export default function CoursesPage() {
  const toast = useToast();
  const [list, setList] = useState<CourseSummary[] | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [yearFilter, setYearFilter] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CourseSummary | null>(null);

  const load = () => api.GET("/api/v1/courses" as any, {} as any).then(({ data, error }: any) => {
    if (error) setError("Failed to load"); else setList(data as CourseSummary[]);
  });
  useEffect(() => {
    load();
    api.GET("/api/v1/marks" as any, {} as any).then(({ data }: any) => setMarks((data as Mark[]) ?? []));
  }, []);

  const years = useMemo(() => {
    const ys = new Set<string>();
    list?.forEach((c) => ys.add(String(n(c.year))));
    return Array.from(ys).sort().reverse();
  }, [list]);

  const filtered = useMemo(() => {
    if (!list) return [];
    return list.filter((c) => {
      if (yearFilter && String(n(c.year)) !== yearFilter) return false;
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, yearFilter, search]);

  const startEdit = async (c: CourseSummary | null) => {
    if (c) {
      setEditingId(String(c.id));
      setDraft({ name: c.name, year: String(n(c.year)), description: c.description ?? "", legs: [] });
      const { data } = await api.GET(`/api/v1/courses/${c.id}` as any, {} as any) as any;
      if (data) {
        const full = data as Course;
        setDraft({
          name: full.name,
          year: String(n(full.year)),
          description: full.description ?? "",
          legs: full.legs.map((l) => ({
            markId: String(l.markId),
            gateMarkId: l.gateMarkId ? String(l.gateMarkId) : "",
            legName: l.legName ?? "",
            overrideRoundingRadiusMeters: l.overrideRoundingRadiusMeters != null ? String(l.overrideRoundingRadiusMeters) : "",
            legType: l.legType ?? "Mark",
            passingSide: l.passingSide ?? "Port",
          })),
        });
      }
    } else {
      setEditingId("new");
      setDraft(emptyDraft());
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.legs.length) return;
    const legs = [...draft.legs];
    [legs[i], legs[j]] = [legs[j], legs[i]];
    setDraft({ ...draft, legs });
  };

  const save = async () => {
    if (!draft.name) { toast.push({ kind: "warning", message: "Name required." }); return; }
    const invalidGate = draft.legs.find((l) => l.legType === "Gate" && (!l.markId || !l.gateMarkId));
    if (invalidGate) {
      toast.push({ kind: "warning", message: "Gate legs require selecting both marks." });
      return;
    }
    const body = {
      name: draft.name,
      year: Number(draft.year),
      description: draft.description || null,
      legs: draft.legs
        .filter((l) => l.markId)
        .map((l) => ({
          markId: l.markId,
          gateMarkId: l.legType === "Gate" && l.gateMarkId ? l.gateMarkId : null,
          legName: l.legName || null,
          overrideRoundingRadiusMeters: l.overrideRoundingRadiusMeters ? Number(l.overrideRoundingRadiusMeters) : null,
          legType: l.legType,
          passingSide: l.legType === "Gate" ? "Port" : l.passingSide,
        })),
    };
    const isNew = editingId === "new";
    const url = isNew ? "/api/v1/courses" : `/api/v1/courses/${editingId}`;
    const res = await browserRequest(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { toast.push({ kind: "success", message: isNew ? "Created." : "Saved." }); setEditingId(null); load(); }
    else toast.push({ kind: "error", message: "Save failed." });
  };

  const doDelete = async (c: CourseSummary) => {
    const res = await browserRequest(`/api/v1/courses/${c.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    if (res.ok || res.status === 204) { toast.push({ kind: "success", message: "Deleted." }); load(); }
    else if (res.status === 409) toast.push({ kind: "error", message: "Course assigned to a race." });
    else toast.push({ kind: "error", message: "Delete failed." });
  };

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!list) return <SkeletonLoader className="h-40" />;

  return (
    <div className={editingId ? "grid gap-6 lg:grid-cols-[1fr_28rem]" : undefined}>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Courses</h1>
          <div className="flex items-center gap-2">
            <Link href="/marks" className="text-sm text-action-primary hover:underline">Manage marks →</Link>
            <Button onClick={() => startEdit(null)}><Plus className="h-4 w-4" /> New course</Button>
          </div>
        </div>
        <FilterToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Course name…" />
          <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-32">
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </FilterToolbar>
        <Card className="mt-4 overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Year</th>
                <th className="px-3 py-2 text-left">Legs</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={String(c.id)} className="cursor-pointer border-t border-border-default text-sm hover:bg-bg-elevated/40" onClick={() => startEdit(c)}>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{n(c.year)}</td>
                  <td className="px-3 py-2 text-text-secondary">{n(c.legCount)}</td>
                  <td className="px-3 py-2"><ThreeDotMenu items={[
                    { label: "Edit", onClick: () => startEdit(c) },
                    { label: "Delete", destructive: true, onClick: () => setConfirmDelete(c) },
                  ]} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-text-secondary">No courses.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {editingId && (
        <Card className="p-5 self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId === "new" ? "New course" : "Edit course"}</h2>
            <button onClick={() => setEditingId(null)} className="text-text-secondary hover:text-text-primary"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">
            <label className="block"><span className="text-sm text-text-secondary">Name</span><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="text-sm text-text-secondary">Year</span><Input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} /></label>
            </div>
            <label className="block"><span className="text-sm text-text-secondary">Description</span><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-text-secondary">Legs</span>
                <Button variant="ghost" onClick={() => setDraft({ ...draft, legs: [...draft.legs, { markId: "", gateMarkId: "", legName: "", overrideRoundingRadiusMeters: "", legType: "Mark", passingSide: "Port" }] })}><Plus className="h-4 w-4" /> Add leg</Button>
              </div>
              <div className="space-y-3">
                {draft.legs.map((l, i) => (
                  <div key={i} className="rounded-md border border-border-default p-3 space-y-2 relative bg-bg-base text-sm">
                    <div className="flex items-center justify-between border-b border-border-default pb-1.5 mb-1.5">
                      <span className="font-semibold text-text-secondary">Leg {i + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => move(i, -1)} disabled={i === 0}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => move(i, 1)} disabled={i === draft.legs.length - 1}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-500/10" onClick={() => setDraft({ ...draft, legs: draft.legs.filter((_, j) => j !== i) })}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-text-secondary block mb-1">Type</span>
                        <Select
                          value={l.legType}
                          onChange={(e) => {
                            const legs = [...draft.legs];
                            legs[i] = { ...legs[i], legType: e.target.value };
                            setDraft({ ...draft, legs });
                          }}
                        >
                          <option value="Mark">Single Buoy</option>
                          <option value="Gate">Gate</option>
                        </Select>
                      </label>

                      <label className="block">
                        <span className="text-xs text-text-secondary block mb-1">Name (optional)</span>
                        <Input
                          placeholder="e.g. Windward"
                          value={l.legName}
                          onChange={(e) => {
                            const legs = [...draft.legs];
                            legs[i] = { ...legs[i], legName: e.target.value };
                            setDraft({ ...draft, legs });
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-text-secondary block mb-1">
                          {l.legType === "Gate" ? "Port Buoy (Mark 1)" : "Mark"}
                        </span>
                        <Select
                          value={l.markId}
                          onChange={(e) => {
                            const legs = [...draft.legs];
                            legs[i] = { ...legs[i], markId: e.target.value };
                            setDraft({ ...draft, legs });
                          }}
                        >
                          <option value="">— Select mark —</option>
                          {marks.map((m) => (
                            <option key={String(m.id)} value={String(m.id)}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      </label>

                      {l.legType === "Gate" ? (
                        <label className="block">
                          <span className="text-xs text-text-secondary block mb-1">Starboard Buoy (Mark 2)</span>
                          <Select
                            value={l.gateMarkId}
                            onChange={(e) => {
                              const legs = [...draft.legs];
                              legs[i] = { ...legs[i], gateMarkId: e.target.value };
                              setDraft({ ...draft, legs });
                            }}
                          >
                            <option value="">— Select mark —</option>
                            {marks.map((m) => (
                              <option key={String(m.id)} value={String(m.id)}>
                                {m.name}
                              </option>
                            ))}
                          </Select>
                        </label>
                      ) : (
                        <label className="block">
                          <span className="text-xs text-text-secondary block mb-1">Rounding Direction</span>
                          <Select
                            value={l.passingSide}
                            onChange={(e) => {
                              const legs = [...draft.legs];
                              legs[i] = { ...legs[i], passingSide: e.target.value };
                              setDraft({ ...draft, legs });
                            }}
                          >
                            <option value="Port">Port</option>
                            <option value="Starboard">Starboard</option>
                          </Select>
                        </label>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-text-secondary block mb-1">Radius Override (m)</span>
                        <Input
                          type="number"
                          placeholder="Use Mark Default"
                          value={l.overrideRoundingRadiusMeters}
                          onChange={(e) => {
                            const legs = [...draft.legs];
                            legs[i] = { ...legs[i], overrideRoundingRadiusMeters: e.target.value };
                            setDraft({ ...draft, legs });
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete course"
        message={`Delete "${confirmDelete?.name}"?`}
        destructive
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
