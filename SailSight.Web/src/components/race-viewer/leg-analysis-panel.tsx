"use client";

import { useMemo } from 'react';
import { TelemetryChart } from '@/components/charts/telemetry-chart';
import { activeLeg, approachLeg, replayVmg, timeMs, vmgPoints, type LegPerformance } from '@/lib/leg-analysis';
import type { NormalizedPosition, RaceDetail } from '@/lib/schemas';
import { convertDistance, convertSpeed, distanceUnitLabel, formatDuration, speedUnitLabel } from '@/lib/units';
import { useRaceViewerStore } from '@/store/race-viewer';
import { useUnitPrefs } from '@/store/settings';

interface Props {
  race: RaceDetail; legs: LegPerformance[]; positions: NormalizedPosition[];
  loading: boolean; error: string | null; targetMs: number;
}

export function LegAnalysisPanel({ race, legs, positions, loading, error, targetMs }: Props) {
  const { prefs } = useUnitPrefs();
  const showCharts = useRaceViewerStore(s => s.showCharts);
  const start = useRaceViewerStore(s => s.windowStart);
  const end = useRaceViewerStore(s => s.windowEnd);
  const offset = useRaceViewerStore(s => s.raceStartOffset);
  const raceStart = timeMs(race.startedAt);
  const active = activeLeg(legs, targetMs), target = approachLeg(legs, targetMs);
  const vmg = replayVmg(positions, legs, targetMs, Number(race.telemetryRateHz));
  const speed = (value: number | string | null | undefined) => value == null ? '\u2014' : `${convertSpeed(Number(value), prefs.boatSpeed).toFixed(2)} ${speedUnitLabel(prefs.boatSpeed)}`;
  const chart = useMemo(() => [{ name: `VMG (${speedUnitLabel(prefs.boatSpeed)})`, color: '#0d9488',
    data: vmgPoints(positions, legs, Number(race.telemetryRateHz)).map(p => ({ t: p.t, v: p.v === null ? null : convertSpeed(p.v, prefs.boatSpeed) })) }], [positions, legs, race.telemetryRateHz, prefs.boatSpeed]);
  const seek = (leg: LegPerformance) => {
    const state = useRaceViewerStore.getState();
    if (state.isPlaying) state.togglePlay();
    state.setPosition(Math.max(0, (timeMs(leg.exitedPreviousMarkAt) - raceStart) / 1000 + offset));
  };
  const stateMessage = !race.courseId ? 'No course is assigned to this race.'
    : loading ? 'Loading leg analysis...'
    : error ?? (race.analysisStatus === 'Pending' ? 'Leg analysis is pending. Reload this race when it has finished.'
    : race.analysisReason ?? (legs.length ? null : 'No leg analysis is available for this recording.'));
  return (
    <section aria-labelledby="leg-analysis-heading" className="@container rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
      <h2 id="leg-analysis-heading" className="text-sm font-semibold">Leg analysis</h2>
      {stateMessage && <p role={error ? 'alert' : undefined} className="mt-2 text-sm text-text-secondary">{stateMessage}</p>}
      {legs.length > 0 && <>
        <div className="my-3 border-l-2 border-teal-600 pl-3">
          <p className="text-xs text-text-secondary">{target ? (target.targetType === 'Gate' ? 'VMG to gate midpoint' : 'VMG to mark') : 'VMG to target'}</p>
          <output aria-label="VMG to target reading" className="text-lg font-semibold tabular-nums">{speed(vmg)}</output>
          <p aria-label="Playback target" className="text-xs text-text-secondary">{target?.legName ?? (active?.status === 'Completed' ? 'Rounding mark' : 'No verified target at this playback time')}</p>
        </div>
        <div role="table" aria-label="Race leg performance" className="text-xs">
          <div role="row" className="hidden grid-cols-[minmax(7rem,1.5fr)_repeat(5,minmax(0,1fr))] gap-2 border-b border-border-default pb-2 text-text-secondary @lg:grid">
            {['Leg / outcome', 'Duration', 'Distance', 'Avg speed', 'Avg VMG', 'Max speed'].map(label => <span role="columnheader" key={label}>{label}</span>)}
          </div>
          {legs.map(leg => {
            const selected = active?.id === leg.id;
            const duration = leg.status === 'Completed' ? (timeMs(leg.enteredCurrentMarkAt) - timeMs(leg.exitedPreviousMarkAt)) / 1000 : NaN;
            const metrics = [formatDuration(Math.round(duration)), leg.sailedDistanceMeters == null ? '\u2014' : `${convertDistance(Number(leg.sailedDistanceMeters), prefs.course).toFixed(prefs.course === 'm' ? 1 : 3)} ${distanceUnitLabel(prefs.course)}`, speed(leg.averageSpeedOverGround), speed(leg.averageVelocityMadeGood), speed(leg.maxSpeedOverGround)];
            return <div role="row" key={leg.id} aria-label={`${leg.legName}: ${leg.status}`} className={`grid grid-cols-2 gap-2 border-b border-border-default py-3 last:border-0 @lg:grid-cols-[minmax(7rem,1.5fr)_repeat(5,minmax(0,1fr))] ${selected ? 'bg-teal-500/10' : ''}`}>
              <div role="cell" className="col-span-2 min-w-0 @lg:col-span-1">
                <button disabled={!leg.exitedPreviousMarkAt} onClick={() => seek(leg)} aria-label={`Replay ${leg.legName}`} aria-current={selected ? 'step' : undefined} className="text-left font-semibold text-text-primary underline decoration-text-muted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:no-underline disabled:opacity-60">{leg.legIndex}. {leg.legName}</button>
                <p className="mt-1 text-text-secondary">{leg.status === 'WrongSide' ? 'Wrong side' : leg.status}{selected ? ' · Playback' : ''}</p>
                {leg.reason && <p className="mt-1 text-text-secondary">{leg.reason}</p>}
              </div>
              {metrics.map((value, i) => <div role="cell" key={i} className="min-w-0 tabular-nums"><span className="block text-text-muted @lg:hidden">{['Duration', 'Distance', 'Avg speed', 'Avg VMG', 'Max speed'][i]}</span>{value}</div>)}
            </div>;
          })}
        </div>
        <p className="mt-2 text-xs text-text-muted">GPS-derived passing sides. Uncertain visits stop analysis of later legs.</p>
        {showCharts && chart[0].data.some(p => p.v !== null) && <div className="mt-4" role="img" aria-label="Recorded VMG to target chart">
          <TelemetryChart title="VMG to target" series={chart} positionMs={targetMs} windowStartMs={raceStart + (start - offset) * 1000} windowEndMs={raceStart + (end - offset) * 1000} />
        </div>}
      </>}
    </section>
  );
}
