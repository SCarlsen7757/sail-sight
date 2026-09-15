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
import { InstrumentPanel } from "@/components/gauges/instrument-panel";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { RaceDetail, Course, Boat, NormalizedPosition } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { normalizePositions } from "@/lib/normalization";
import { useRaceViewerStore } from "@/store/race-viewer";
import { usePlaybackState } from "@/hooks/use-playback-state";

interface PageProps { params: Promise<{ id: string }>; }

export default function PublicRaceViewerPage({ params }: PageProps) {
  const { id: raceId } = use(params);
  const [showHeading, setShowHeading] = useState(false);
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
            <Link href={`/s/${sessionId}`} className="text-text-secondary hover:text-text-primary transition-colors">
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
        <div className={`@container flex flex-col gap-4 min-h-0 ${compactMode ? "lg:w-48 lg:shrink-0 lg:overflow-y-auto" : "flex-1 lg:overflow-y-auto"}`}>
          {showGauges && <InstrumentPanel position={currentPos} compact={compactMode} />}

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
