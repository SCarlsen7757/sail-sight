"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Boat, BoatClass, BoatStats } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { Button, Card, Input, Select } from "@/components/ui/controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, convertDistance, formatDuration, speedUnitLabel, distanceUnitLabel } from "@/lib/units";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { ChevronRight, Globe, Lock } from "lucide-react";

export default function BoatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { prefs } = useUnitPrefs();
  const [boat, setBoat] = useState<Boat | null>(null);
  const [stats, setStats] = useState<BoatStats | null>(null);
  const [classes, setClasses] = useState<BoatClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", sailNumber: "", boatClassId: "", description: "", isPublic: false });
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    api.GET(`/api/v1/boats/{id}` as any, { params: { path: { id } } } as any).then(({ data, error }: any) => {
      if (error) setError("Failed to load boat");
      else {
        const b = data as Boat;
        setBoat(b);
        setDraft({ name: b.name, sailNumber: b.sailNumber ?? "", boatClassId: String(b.boatClass.id), description: b.description ?? "", isPublic: b.isPublic });
      }
    });
    api.GET(`/api/v1/boats/{id}/stats` as any, { params: { path: { id } } } as any).then(({ data }: any) => setStats(data as BoatStats));
    api.GET("/api/v1/boat-classes" as any, {} as any).then(({ data }: any) => setClasses((data as BoatClass[]) ?? []));
  }, [id]);

  const save = async () => {
    const res = await fetch(`/api/v1/boats/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        sailNumber: draft.sailNumber || null,
        boatClassId: draft.boatClassId,
        description: draft.description || null,
        isPublic: draft.isPublic,
      }),
    });
    if (res.ok) toast.push({ kind: "success", message: "Boat saved." });
    else toast.push({ kind: "error", message: "Save failed." });
  };

  const doDelete = async () => {
    const res = await fetch(`/api/v1/boats/${id}`, { method: "DELETE" });
    setConfirm(false);
    if (res.ok || res.status === 204) { toast.push({ kind: "success", message: "Deleted." }); router.push("/boats"); }
    else if (res.status === 409) toast.push({ kind: "error", message: "Boat is referenced by sessions." });
    else toast.push({ kind: "error", message: "Delete failed." });
  };

  if (error) return <ErrorBanner message={error} />;
  if (!boat) return <SkeletonLoader className="h-40" />;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-text-secondary">
        <Link href="/boats" className="hover:text-text-primary">Fleet</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-text-primary">{boat.name}</span>
      </nav>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Boat metadata</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label><span className="text-sm text-text-secondary">Name</span><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label><span className="text-sm text-text-secondary">Sail #</span><Input value={draft.sailNumber} onChange={(e) => setDraft({ ...draft, sailNumber: e.target.value })} /></label>
          <label><span className="text-sm text-text-secondary">Class</span>
            <Select value={draft.boatClassId} onChange={(e) => setDraft({ ...draft, boatClassId: e.target.value })}>
              {classes.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
            </Select>
          </label>
          <label className="sm:col-span-2"><span className="text-sm text-text-secondary">Description</span><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <div className="sm:col-span-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Visibility</span>
              <Button variant="secondary" onClick={() => setDraft({ ...draft, isPublic: !draft.isPublic })}>
                {draft.isPublic ? <><Globe className="mr-1 h-4 w-4" /> Public</> : <><Lock className="mr-1 h-4 w-4" /> Private</>}
              </Button>
            </div>
            {draft.isPublic && (
              <Link href={`/b/${id}`} className="inline-flex items-center gap-1 text-sm text-action-primary hover:underline" target="_blank">
                <Globe className="h-3.5 w-3.5" /> View public page
              </Link>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={save}>Save</Button></div>
      </Card>

      {stats && (
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Stats</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-text-secondary">Sessions</dt><dd className="font-mono">{n(stats.sessionCount)}</dd></div>
            <div><dt className="text-text-secondary">Races</dt><dd className="font-mono">{n(stats.raceCount)}</dd></div>
            <div><dt className="text-text-secondary">Total time</dt><dd className="font-mono">{formatDuration(n(stats.totalSessionDurationSeconds))}</dd></div>
            <div><dt className="text-text-secondary">Distance</dt><dd className="font-mono">{convertDistance(n(stats.totalSailedDistanceMeters), prefs.course).toFixed(1)} {distanceUnitLabel(prefs.course)}</dd></div>
            <div><dt className="text-text-secondary">Top SOG</dt><dd className="font-mono">{convertSpeed(n(stats.topSpeedOverGround), prefs.boatSpeed).toFixed(1)} {speedUnitLabel(prefs.boatSpeed)}</dd></div>
          </dl>
        </Card>
      )}

      <div className="flex justify-end"><Button variant="danger" onClick={() => setConfirm(true)}>Delete boat</Button></div>
      <ConfirmDialog
        open={confirm}
        title="Delete boat"
        message={`Permanently delete "${boat.name}"?`}
        destructive
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
