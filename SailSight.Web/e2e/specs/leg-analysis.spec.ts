import { test, expect } from '@playwright/test';
import { activeLeg, approachLeg, replayVmg, vmgPoints, vmgToTarget, type LegPerformance } from '../../src/lib/leg-analysis';
import type { NormalizedPosition } from '../../src/lib/schemas';

const iso = (t: number) => new Date(t).toISOString();
const leg = (from = 0, entry = 10000, exit = 15000): LegPerformance => ({ id: 'leg', raceId: 'race', courseLegId: 'course-leg', legName: 'Mark', legIndex: 1,
  status: 'Completed', reason: null, exitedPreviousMarkAt: iso(from), enteredCurrentMarkAt: iso(entry), exitedCurrentMarkAt: iso(exit),
  sailedDistanceMeters: 10, averageSpeedOverGround: 2, averageVelocityMadeGood: 2, maxSpeedOverGround: 2, targetType: 'Mark', targetLatitude: 1, targetLongitude: 0 });
const position = (t: number, cog = 0): NormalizedPosition => ({ t, lat: 0, lon: 0, sog: 2, cog, qW: 1, qX: 0, qY: 0, qZ: 0 });

test('recorded VMG uses COG, preserves signs, and excludes invalid values', () => {
  expect(vmgToTarget(position(0), leg())).toBeCloseTo(2);
  expect(vmgToTarget(position(0, Math.PI / 2), leg())).toBeCloseTo(0);
  expect(vmgToTarget(position(0, Math.PI), leg())).toBeCloseTo(-2);
  expect(vmgToTarget(position(0, NaN), leg())).toBeNull();
  expect(vmgToTarget(position(0), { ...leg(), targetLatitude: 0 })).toBeNull();
});

test('countdown, rounding, completion, and unresolved approaches have no VMG', () => {
  const legs = [leg(), { ...leg(15000, 25000, 30000), id: 'second', status: 'Uncertain' }];
  expect(approachLeg(legs, -1)).toBeNull();
  expect(approachLeg(legs, 0)?.id).toBe('leg');
  expect(approachLeg(legs, 10000)).toBeNull();
  expect(activeLeg(legs, 10000)?.id).toBe('leg');
  expect(approachLeg(legs, 15000)).toBeNull();
  expect(activeLeg(legs, 30000)).toBeNull();
});

test('VMG interpolation crosses north correctly without extrapolation', () => {
  const points = [position(0, 359 * Math.PI / 180), position(1000, Math.PI / 180)];
  expect(replayVmg(points, [leg()], 500)).toBeCloseTo(2);
  expect(replayVmg(points, [leg()], -1)).toBeNull();
  expect(replayVmg(points, [leg()], 1001)).toBeNull();
});

test('chart smoothing cannot bridge invalid samples or target changes', () => {
  const points = Array.from({ length: 30 }, (_, i) => position(i * 1000, i >= 15 ? Math.PI : 0));
  points[5].cog = NaN;
  const result = vmgPoints(points, [leg(), { ...leg(15000, 25000, 25000), id: 'second' }], 1);
  expect(result.find(p => p.t === 5000)?.v).toBeNull();
  expect(result.find(p => p.t === 10000)?.v).toBeNull();
  expect(result.filter(p => p.v !== null && p.t < 10000).every(p => Math.abs(p.v! - 2) < .001)).toBeTruthy();
  expect(result.filter(p => p.v !== null && p.t >= 15000).every(p => Math.abs(p.v! + 2) < .001)).toBeTruthy();
  expect(result.some(p => p.t > 10000 && p.t < 15000)).toBeFalsy();
});
