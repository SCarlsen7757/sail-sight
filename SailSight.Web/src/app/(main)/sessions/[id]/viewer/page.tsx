"use client";

import dynamic from "next/dynamic";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gauge as GaugeIcon, LineChart as LineChartIcon, ChevronRight } from "lucide-react";
const RaceMap = dynamic(() => import("@/components/map/race-map").then((m) => m.RaceMap), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse rounded-lg bg-bg-elevated" />,
});
const TelemetryPanels = dynamic(() => import("@/components/charts/telemetry-panels").then((m) => m.TelemetryPanels), {
  ssr: false,
  loading: () => <div className="h-48 w-full animate-pulse rounded-lg bg-bg-elevated" />,
});
import { TimeWindowSlicer } from "@/components/charts/time-window-slicer";
import { PlaybackControls } from "@/components/race-viewer/playback-controls";
import { CompassRose, Inclinometer, NumericGauge, HeelTrimCard } from "@/components/gauges/gauges";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { SessionDetail, NormalizedPosition, Boat } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, radiansToDegrees, speedUnitLabel } from "@/lib/units";
import { useRaceViewerStore } from "@/store/race-viewer";
import { normalizePositions } from "@/lib/normalization";
import { usePlaybackState } from "@/hooks/use-playback-state";

interface PageProps { params: Promise<{ id: string }>; }

function quatToHeelTrim(w: number, x: number, y: number, z: number) {
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
  return { heel: radiansToDegrees(roll), trim: radiansToDegrees(pitch) };
}

export default function SessionViewerPage({ params }: PageProps) {
  const { id } = use(params);
  const { prefs } = useUnitPrefs();
  const showGauges = useRaceViewerStore((s) => s.showGauges);
  const showCharts = useRaceViewerStore((s) => s.showCharts);
  const windowStart = useRaceViewerStore((s) => s.windowStart);
  const windowEnd = useRaceViewerStore((s) => s.windowEnd);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [positions, setPositions] = useState<NormalizedPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/sessions/${id}`)
      .then((r) => r.ok ? r.json() as Promise<SessionDetail> : Promise.reject(r.status))
      .then(async (s) => {
        if (!alive) return;
        setSession(s);
        const firstRaceId = s.races.length > 0 ? s.races[0].id : null;
        if (firstRaceId) {
          const p: any[] = await fetch(`/api/v1/races/${firstRaceId}/telemetry/positions`).then((r) => r.ok ? r.json() : []);
          if (alive) {
            const hz = n(s.telemetryRateHz) > 0 ? n(s.telemetryRateHz) : 1;
            setPositions(normalizePositions(p, hz));
          }
        } else {
          setPositions([]);
        }
      })
      .catch((e) => alive && setError(`Failed to load session (${e})`));
    return () => { alive = false; };
  }, [id]);

  const startMs = session ? new Date(session.startedAt).getTime() : 0;
  const endMs = session ? new Date(session.endedAt).getTime() : 0;
  const duration = (endMs - startMs) / 1000;

  const { currentPos, playbackArrow } = usePlaybackState(positions, startMs);
  const heelTrim = currentPos ? quatToHeelTrim(currentPos.qW, currentPos.qX, currentPos.qY, currentPos.qZ) : null;

  const windowStartMs = startMs + windowStart * 1000;
  const windowEndMs = startMs + windowEnd * 1000;
  const isWindowNarrowed = windowStart > 0 || windowEnd < duration;
  const windowPositions = useMemo(
    () => (showCharts && isWindowNarrowed)
      ? positions?.filter((p) => p.t >= windowStartMs && p.t <= windowEndMs) ?? null
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, windowStartMs, windowEndMs, showCharts, isWindowNarrowed]
  );

  if (error) return <ErrorBanner message={error} />;
  if (!session || !positions) return <SkeletonLoader className="h-96" />;

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-3rem)]">
      {/* Compact breadcrumb header bar */}
      <div className="flex items-center gap-2 py-1 text-sm">
        <Link href="/sessions" className="text-text-secondary hover:text-text-primary transition-colors">
          Sessions
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
        <Link href={`/sessions/${id}`} className="text-text-secondary hover:text-text-primary transition-colors">
          Session
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
        <h1 className="text-base font-semibold text-text-primary">Viewer</h1>
        <span className="text-sm text-text-secondary hidden sm:inline">· {session.fileName}</span>
        
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => useRaceViewerStore.getState().setShowGauges(!showGauges)}
            title={showGauges ? "Hide gauges" : "Show gauges"}
            className={`rounded-md p-1.5 ring-1 ring-border-default transition-colors ${
              showGauges ? "bg-action-primary text-white ring-action-primary" : "bg-bg-base text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            <GaugeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => useRaceViewerStore.getState().setShowCharts(!showCharts)}
            title={showCharts ? "Hide charts" : "Show charts"}
            className={`rounded-md p-1.5 ring-1 ring-border-default transition-colors ${
              showCharts ? "bg-action-primary text-white ring-action-primary" : "bg-bg-base text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            <LineChartIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 lg:flex-row">
        {/* Left column: playback controls + map */}
        <div className="flex flex-col gap-3 lg:w-[42%] lg:shrink-0 min-h-0">
          <PlaybackControls raceStartOffset={0} duration={Math.max(duration, 0)} />
          <RaceMap race={null} positions={positions} playbackPosition={playbackArrow} windowPositions={windowPositions} fill />
        </div>

        {/* Right column: scrollable detail panel */}
        <div className="flex flex-col gap-4 flex-1 min-h-0 lg:overflow-y-auto">
          {showGauges && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumericGauge label="SOG" value={currentPos ? convertSpeed(currentPos.sog, prefs.boatSpeed) : null} unit={speedUnitLabel(prefs.boatSpeed)} big />
              <CompassRose headingDeg={currentPos ? radiansToDegrees(currentPos.cog) : null} />
              <Inclinometer label="Heel (°)" value={heelTrim?.heel ?? null} range={45} />
              <Inclinometer label="Trim (°)" value={heelTrim?.trim ?? null} range={10} />
            </div>
          )}

          {showCharts && session.races.length > 0 && (
            <>
              <TimeWindowSlicer raceStartOffset={0} />
              <div className="flex flex-col gap-4">
                <TelemetryPanels raceId={String(session.races[0].id)} raceStartMs={startMs} raceStartOffset={0} telemetryRateHz={n(session.telemetryRateHz)} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
