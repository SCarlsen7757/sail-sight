"use client";

import { api } from "@/lib/api";
import { LegAnalysisPanel } from "./leg-analysis-panel";
import { useLegAnalysis } from "@/hooks/use-leg-analysis";
import { approachLeg } from "@/lib/leg-analysis";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gauge as GaugeIcon, LineChart as LineChartIcon, ChevronRight } from "lucide-react";
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
import { InstrumentPanel } from "@/components/gauges/instrument-panel";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { RaceDetail, Course, NormalizedPosition } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { normalizePositions } from "@/lib/normalization";
import { useRaceViewerStore } from "@/store/race-viewer";
import { usePlaybackState } from "@/hooks/use-playback-state";

export function RaceReplay({ raceId, publicView = false }: { raceId: string; publicView?: boolean }) {
  const [showHeading, setShowHeading] = useState(false);
  const showGauges = useRaceViewerStore((s) => s.showGauges);
  const showCharts = useRaceViewerStore((s) => s.showCharts);
  const windowStart = useRaceViewerStore((s) => s.windowStart);
  const windowEnd = useRaceViewerStore((s) => s.windowEnd);

  const [race, setRace] = useState<RaceDetail | null>(null);
  const [positions, setPositions] = useState<NormalizedPosition[] | null>(null);
  const [rawPositions, setRawPositions] = useState<NormalizedPosition[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    async function load() {
      const result = await api.GET('/api/v1/races/{raceId}', { params: { path: { raceId } }, signal });
      if (!result.response.ok || !result.data) throw new Error(`Failed to load race (${result.response.status})`);
      const raceData = result.data;
      if (signal.aborted) return;
      setRace(raceData);
      const countdown = raceData.countdownDurationSeconds == null ? 0 : n(raceData.countdownDurationSeconds);
      const [posResult, courseResult] = await Promise.all([
        api.GET('/api/v1/races/{raceId}/telemetry/positions', { params: { path: { raceId }, query: countdown > 0 ? { from: -countdown } : {} }, signal }),
        raceData.courseId ? api.GET('/api/v1/Courses/{id}', { params: { path: { id: raceData.courseId } }, signal }) : Promise.resolve(null),
      ]);
      if (!posResult.response.ok || !posResult.data) throw new Error(`Failed to load track (${posResult.response.status})`);
      if (signal.aborted) return;
      const hz = Math.max(1, n(raceData.telemetryRateHz));
      setRawPositions(normalizePositions(posResult.data, hz, false));
      setPositions(normalizePositions(posResult.data, hz));
      setCourse(courseResult?.data ?? null);
    }
    load().catch((error: unknown) => { if (!signal.aborted) setError(error instanceof Error ? error.message : 'Failed to load race'); });
    return () => controller.abort();
  }, [raceId]);

  const analysis = useLegAnalysis(raceId, race?.courseId);

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
    [positions, windowStartMs, windowEndMs, showCharts, isWindowNarrowed]
  );

  const { currentPos, playbackArrow, targetMs } = usePlaybackState(positions, startMs);

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
            <Link href={`${publicView ? "/s" : "/sessions"}/${sessionId}`} className="text-text-secondary hover:text-text-primary transition-colors">
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
            activeCourseLegId={approachLeg(analysis.legs, targetMs)?.courseLegId}
            startLine={startLine}
            playbackPosition={playbackArrow}
            windowPositions={windowPositions}
            fill
          />
        </div>

        {/* Right column: scrollable detail panel */}
        <div className={`@container flex flex-col gap-4 min-h-0 ${compactMode ? "lg:w-48 lg:shrink-0 lg:overflow-y-auto" : "flex-1 lg:overflow-y-auto"}`}>
          {showGauges && <InstrumentPanel position={currentPos} compact={compactMode} />}

          <LegAnalysisPanel race={race} {...analysis} positions={rawPositions} targetMs={targetMs} />

          <StartAnalysisPanel data={race.startAnalysis} raceId={raceId} compact={compactMode} />

          {showCharts && (
            <>
              <TimeWindowSlicer raceStartOffset={raceStartOffset} />
              <TelemetryPanels showHeading={showHeading} onShowHeadingChange={setShowHeading} raceId={raceId} raceStartMs={startMs} raceStartOffset={raceStartOffset} telemetryRateHz={n(race.telemetryRateHz)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
