import type { components } from './api-types';
import type { NormalizedPosition } from './schemas';
import { findNearestIndex } from './track-utils';
import { sgSmooth } from './downsampling';

export type LegPerformance = components['schemas']['RaceLegPerformanceDto'];
export const timeMs = (value: string | null | undefined) => value ? Date.parse(value) : NaN;

export function activeLeg(legs: LegPerformance[], t: number): LegPerformance | null {
  return legs.find(l => t >= timeMs(l.exitedPreviousMarkAt) && t < timeMs(l.exitedCurrentMarkAt ?? l.enteredCurrentMarkAt)) ?? null;
}

export function approachLeg(legs: LegPerformance[], t: number): LegPerformance | null {
  return legs.find(l => l.status === 'Completed' && t >= timeMs(l.exitedPreviousMarkAt) && t < timeMs(l.enteredCurrentMarkAt)) ?? null;
}

export function vmgToTarget(p: Pick<NormalizedPosition, 'lat' | 'lon' | 'sog' | 'cog'>, leg: LegPerformance): number | null {
  const lat = Number(leg.targetLatitude), lon = Number(leg.targetLongitude);
  if (![p.lat, p.lon, p.sog, p.cog, lat, lon].every(Number.isFinite)) return null;
  const rad = Math.PI / 180, a = p.lat * rad, b = lat * rad, delta = (lon - p.lon) * rad;
  const y = Math.sin(delta) * Math.cos(b);
  const x = Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(delta);
  if (Math.hypot(x, y) < 1e-12) return null;
  return p.sog * Math.cos(Math.atan2(y, x) - p.cog);
}

export function replayVmg(positions: NormalizedPosition[], legs: LegPerformance[], t: number, hz = 1): number | null {
  const leg = approachLeg(legs, t);
  if (!leg || !positions.length || t < positions[0].t || t > positions.at(-1)!.t) return null;
  const i = findNearestIndex(positions, t), a = positions[i], b = positions[Math.min(i + 1, positions.length - 1)];
  if (t !== a.t && b.t - a.t > 2000 / Math.max(hz, 1)) return null;
  const f = a.t === b.t ? 0 : (t - a.t) / (b.t - a.t);
  const angle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
  return vmgToTarget({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + angle((b.lon - a.lon) * Math.PI / 180) * 180 / Math.PI * f,
    sog: a.sog + (b.sog - a.sog) * f, cog: a.cog + angle(b.cog - a.cog) * f }, leg);
}

/** Smooth only contiguous valid samples within one verified approach. Never bridge a rounding or target change. */
export function vmgPoints(positions: NormalizedPosition[], legs: LegPerformance[], hz: number): { t: number; v: number | null }[] {
  const result: { t: number; v: number | null }[] = [];
  for (const leg of legs.filter(l => l.status === 'Completed')) {
    const start = timeMs(leg.exitedPreviousMarkAt), end = timeMs(leg.enteredCurrentMarkAt);
    const data = positions.filter(p => p.t >= start && p.t < end).map(p => ({ t: p.t, v: vmgToTarget(p, leg) }));
    let offset = 0;
    while (offset < data.length) {
      if (data[offset].v === null) { offset++; continue; }
      let stop = offset + 1;
      while (stop < data.length && data[stop].v !== null && data[stop].t - data[stop - 1].t <= 2000 / Math.max(hz, 1)) stop++;
      const smoothed = sgSmooth(data.slice(offset, stop).map(p => p.v!), Math.max(5, Math.round(1.5 * hz) | 1));
      for (let i = offset; i < stop; i++) data[i].v = smoothed[i - offset];
      offset = stop;
    }
    result.push({ t: start, v: null });
    for (let i = 0; i < data.length; i++) {
      if (i > 0 && data[i].t - data[i - 1].t > 2000 / Math.max(hz, 1))
        result.push({ t: (data[i].t + data[i - 1].t) / 2, v: null });
      result.push(data[i]);
    }
    result.push({ t: end, v: null });
  }
  return result;
}
