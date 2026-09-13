"use client";

import { browserRequest } from "@/lib/browser-request";

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
import { StartAnalysisPanel } from "@/components/race-viewer/start-analysis-panel";
import { CompassRose, HeelTrimCard, NumericGauge, Inclinometer } from "@/components/gauges/gauges";
import { Card } from "@/components/ui/controls";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { RaceDetail, Course, Boat, NormalizedPosition } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, radiansToDegrees, speedUnitLabel } from "@/lib/units";
import { normalizePositions } from "@/lib/normalization";
import { useRaceViewerStore } from "@/store/race-viewer";
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

export default function RaceViewerPage({ params }: PageProps) {
  const { id: raceId } = use(params);
  const { prefs } = useUnitPrefs();
  const showGauges = useRaceViewerStore((s) => s.showGauges);
  const showCharts = useRaceViewerStore((s) => s.showCharts);
  const windowStart = useRaceViewerStore((s) => s.windowStart);
  const windowEnd = useRaceViewerStore((s) => s.windowEnd);

  const [race, setRace] = useState<RaceDetail | null>(null);
  const [positions, setPositions] = useState<NormalizedPosition[] | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const raceBase = `/api/v1/races/${raceId}`;

    browserRequest(raceBase)
      .then((r) => r.ok ? r.json() as Promise<RaceDetail> : Promise.reject(r.status))
      .then(async (raceData) => {
        if (!alive) return;
        setRace(raceData);

        const countdown = raceData.countdownDurationSeconds != null ? n(raceData.countdownDurationSeconds) : 0;
        const fromParam = countdown > 0 ? `?from=${-countdown}` : "";

        const fetches: Promise<unknown>[] = [
          browserRequest(`${raceBase}/telemetry/positions${fromParam}`).then((r) => r.ok ? r.json() as Promise<any[]> : Promise.reject(r.status)),
          raceData.courseId != null
            ? browserRequest(`/api/v1/courses/${raceData.courseId}`).then((r) => r.ok ? r.json() : null)
            : Promise.resolve(null),
        ];

        const [posData, courseData] = await Promise.all(fetches) as [any[], Course | null];
        if (!alive) return;

        const hz = n(raceData.telemetryRateHz) > 0 ? n(raceData.telemetryRateHz) : 1;
        setPositions(normalizePositions(posData, hz));
        setCourse(courseData);
      })
      .catch((e) => alive && setError(`Failed to load race (${e})`));
    return () => { alive = false; };
  }, [raceId]);

  const startMs = race ? new Date(race.startedAt).getTime() : 0;
  const duration = race ? n(race.durationSeconds) : 0;
  const raceStartOffset = race?.countdownDurationSeconds != null ? n(race.countdownDurationSeconds) : 0;
  const totalDuration = raceStartOffset + duration;

  const racePositions = useMemo(() => positions?.filter((p) => p.t >= startMs) ?? null, [positions, startMs]);
  const preRacePositions = useMemo(() => positions?.filter((p) => p.t < startMs) ?? null, [positions, startMs]);

  const windowStartMs = startMs + (windowStart - raceStartOffset) * 1000;
  const windowEndMs = startMs + (windowEnd - raceStartOffset) * 1000;
  const isWindowNarrowed = windowStart > 0 || windowEnd < totalDuration;
  const windowPositions = useMemo(
    () => (showCharts && isWindowNarrowed)
      ? positions?.filter((p) => p.t >= windowStartMs && p.t <= windowEndMs) ?? null
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, windowStartMs, windowEndMs, showCharts, isWindowNarrowed]
  );

  const { currentPos, playbackArrow } = usePlaybackState(positions, startMs);

  const heelTrim = currentPos ? quatToHeelTrim(currentPos.qW, currentPos.qX, currentPos.qY, currentPos.qZ) : null;
  const compactMode = !showCharts;

  const startLine = race && race.pinEnd && race.boatEnd ? {
    pin: { lat: n(race.pinEnd.latitude), lon: n(race.pinEnd.longitude) },
    boat: { lat: n(race.boatEnd.latitude), lon: n(race.boatEnd.longitude) },
  } : undefined;

  const legs = course?.legs ?? [];

  const sessionId = race?.sessionId;

  if (error) return <ErrorBanner message={error} />;
  if (!race || !positions) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-3rem)]">
      {/* Compact breadcrumb header bar */}
      <div className="flex items-center gap-2 py-1 text-sm">
        <Link href="/sessions" className="text-text-secondary hover:text-text-primary transition-colors">
          Sessions
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
        {sessionId && (
          <>
            <Link href={`/sessions/${sessionId}`} className="text-text-secondary hover:text-text-primary transition-colors">
              Session
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
          </>
        )}
        <h1 className="text-base font-semibold text-text-primary">Race {race.raceNumber}</h1>
        {course && <span className="text-sm text-text-secondary hidden sm:inline">· {course.name}</span>}
        
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

      {/* Two-column body — fills remaining height on desktop */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 lg:flex-row">
        {/* Left column: playback controls + map */}
        <div className={`flex flex-col gap-3 min-h-0 lg:shrink-0 ${compactMode ? "lg:flex-1" : "lg:w-[42%]"}`}>
          <PlaybackControls raceStartOffset={raceStartOffset} duration={totalDuration} />
          <RaceMap
            race={race}
            positions={racePositions}
            preRacePositions={preRacePositions}
            legs={legs}
            startLine={startLine}
            playbackPosition={playbackArrow}
            windowPositions={windowPositions}
            fill
          />
        </div>

        {/* Right column: scrollable detail panel */}
        <div className={`flex flex-col gap-4 min-h-0 ${compactMode ? "lg:w-auto lg:shrink-0" : "flex-1 lg:overflow-y-auto"}`}>
          {showGauges && !compactMode && (
            <div className="grid grid-cols-3 gap-3">
              <NumericGauge label="SOG" value={currentPos ? convertSpeed(currentPos.sog, prefs.boatSpeed) : null} unit={speedUnitLabel(prefs.boatSpeed)} big />
              <CompassRose headingDeg={currentPos ? radiansToDegrees(currentPos.cog) : null} />
              <HeelTrimCard heel={heelTrim?.heel ?? null} trim={heelTrim?.trim ?? null} />
            </div>
          )}

          {showGauges && compactMode && (
            <Card className="p-3 lg:p-2 flex-shrink-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary lg:mb-3">Gauges</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-1 lg:gap-y-3">
                <div>
                  <div className="text-xs text-text-secondary">SOG</div>
                  <div className="font-mono text-lg font-semibold">
                    {currentPos ? convertSpeed(currentPos.sog, prefs.boatSpeed).toFixed(1) : "—"}
                    <span className="ml-1 text-sm text-text-secondary">{speedUnitLabel(prefs.boatSpeed)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">Heading</div>
                  <div className="font-mono text-lg">
                    {currentPos ? `${Math.round(radiansToDegrees(currentPos.cog))}°` : "—"}
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <Inclinometer label="Heel (°)" value={heelTrim?.heel ?? null} range={45} />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <Inclinometer label="Trim (°)" value={heelTrim?.trim ?? null} range={10} />
                </div>
              </div>
            </Card>
          )}

          <StartAnalysisPanel data={race.startAnalysis} raceId={raceId} compact={compactMode} />

          {showCharts && (
            <>
              <TimeWindowSlicer raceStartOffset={raceStartOffset} />
              <TelemetryPanels raceId={raceId} raceStartMs={startMs} raceStartOffset={raceStartOffset} telemetryRateHz={n(race.telemetryRateHz)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
