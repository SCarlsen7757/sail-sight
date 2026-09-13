"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Boat, BoatStats } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { Card } from "@/components/ui/controls";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, convertDistance, formatDuration, speedUnitLabel, distanceUnitLabel } from "@/lib/units";
import { Globe } from "lucide-react";

export default function PublicBoatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { prefs } = useUnitPrefs();
  const [boat, setBoat] = useState<Boat | null>(null);
  const [stats, setStats] = useState<BoatStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.GET(`/api/v1/boats/{id}` as any, { params: { path: { id } } } as any).then(({ data, error }: any) => {
      if (error) setError("This boat is not available or is private.");
      else {
        const b = data as Boat;
        if (!b.isPublic) { setError("This boat is not public."); return; }
        setBoat(b);
      }
    });
    api.GET(`/api/v1/boats/{id}/stats` as any, { params: { path: { id } } } as any).then(({ data }: any) => {
      if (data) setStats(data as BoatStats);
    });
  }, [id]);

  if (error) return <ErrorBanner message={error} />;
  if (!boat) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonLoader key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/sessions" className="text-sm text-text-secondary hover:text-text-primary">← Sessions</Link>
        <h1 className="text-2xl font-bold">{boat.name}</h1>
        <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
          <Globe className="h-3 w-3" /> Public
        </span>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">About this boat</h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs uppercase text-text-secondary">Sail number</dt><dd className="font-medium">{boat.sailNumber ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-text-secondary">Class</dt><dd className="font-medium">{boat.boatClass.name}</dd></div>
          {boat.boatClass.length != null && (
            <div><dt className="text-xs uppercase text-text-secondary">Length</dt><dd className="font-medium">{n(boat.boatClass.length)} m</dd></div>
          )}
          {boat.description && (
            <div className="col-span-2 sm:col-span-3"><dt className="text-xs uppercase text-text-secondary">Description</dt><dd className="font-medium">{boat.description}</dd></div>
          )}
        </dl>
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
    </div>
  );
}
