import simplify from "simplify-js";
import type { Position, NormalizedPosition } from "@/lib/schemas";
import { n } from "@/lib/schemas";

/**
 * Maps a Leaflet zoom level to an RDP tolerance in degrees.
 * Lower zoom (zoomed out) → higher tolerance (fewer points, straighter lines).
 * Higher zoom (zoomed in) → lower tolerance (more points, more detail).
 */
export function zoomToTolerance(zoom: number): number {
  if (zoom <= 10) return 0.001;
  if (zoom === 11) return 0.0005;
  if (zoom === 12) return 0.0003;
  if (zoom === 13) return 0.0001;
  if (zoom === 14) return 0.00005;
  if (zoom === 15) return 0.00002;
  return 0.00001;
}

/**
 * Applies a sliding-window average to the latitude and longitude of GPS positions.
 * This rounds off artificially sharp tacks/gybes caused by point reduction while
 * preserving all other fields (time, speed, COG, etc.) from the central sample.
 *
 * @param positions  Raw GPS position array
 * @param windowSize Number of samples to average. Must be odd; defaults to 5.
 */
export function smoothTrackPositions(positions: NormalizedPosition[], windowSize = 5): NormalizedPosition[] {
  if (positions.length < 2) return positions;
  const half = Math.floor(windowSize / 2);
  return positions.map((p, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(positions.length - 1, i + half);
    let sumLat = 0, sumLon = 0, count = 0;
    for (let j = start; j <= end; j++) {
      sumLat += positions[j].lat;
      sumLon += positions[j].lon;
      count++;
    }
    return { ...p, lat: sumLat / count, lon: sumLon / count };
  });
}

/**
 * Simplifies a GPS track using the Ramer-Douglas-Peucker algorithm (via simplify-js).
 * Returns [lat, lon] pairs suitable for Leaflet Polyline rendering.
 */
export function simplifyTrack(
  positions: NormalizedPosition[],
  tolerance = 0.00005
): [number, number][] {
  if (positions.length < 2) {
    return positions.map((p) => [p.lat, p.lon]);
  }
  const pts = positions.map((p) => ({ x: p.lon, y: p.lat }));
  const simplified = simplify(pts, tolerance, true);
  return simplified.map((p) => [p.y, p.x]);
}

/**
 * Simplifies a GPS track (RDP) and returns both the retained Position objects
 * and the **maximum** speedOverGround observed across all original points that
 * were merged into each segment between consecutive simplified points.
 */
export function simplifyPositionsWithMaxSpeeds(
  positions: NormalizedPosition[],
  tolerance = 0.00005
): { positions: NormalizedPosition[]; maxSpeeds: number[] } {
  if (positions.length < 2) return { positions, maxSpeeds: [] };

  const pts = positions.map((p) => ({ x: p.lon, y: p.lat }));
  const simplified = simplify(pts, tolerance, true);

  // Build a lookup of kept coordinate keys to find their indices in the original array
  const kept = new Set(simplified.map((p) => `${p.x}_${p.y}`));
  const keptIndices: number[] = [];
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (kept.has(`${p.lon}_${p.lat}`)) {
      keptIndices.push(i);
    }
  }

  const simplifiedPositions = keptIndices.map((i) => positions[i]);

  // For each segment [keptIndices[seg] .. keptIndices[seg+1]], find max speed
  const maxSpeeds: number[] = [];
  for (let seg = 0; seg < keptIndices.length - 1; seg++) {
    const start = keptIndices[seg];
    const end = keptIndices[seg + 1];
    let maxSpeed = -Infinity;
    for (let j = start; j <= end; j++) {
      const v = positions[j].sog;
      if (v > maxSpeed) maxSpeed = v;
    }
    maxSpeeds.push(maxSpeed === -Infinity ? 0 : maxSpeed);
  }

  return { positions: simplifiedPositions, maxSpeeds };
}

export interface InterpolatedPosition {
  lat: number;
  lon: number;
  /** Course over ground in radians */
  cog: number;
}

/**
 * Find the index of the last point whose timestamp is <= targetMs
 */
export function findNearestIndex(positions: NormalizedPosition[], targetMs: number): number {
  if (!positions.length) return -1;
  let lo = 0;
  let hi = positions.length - 1;

  if (targetMs <= positions[0].t) return 0;
  if (targetMs >= positions[hi].t) return hi;

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (positions[mid].t <= targetMs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Interpolates the boat position and heading between the two GPS samples that
 * bracket `targetMs`.
 */
export function interpolatePosition(
  positions: NormalizedPosition[],
  targetMs: number
): InterpolatedPosition | null {
  if (!positions.length) return null;

  const lo = findNearestIndex(positions, targetMs);
  if (lo === -1) return null;
  if (lo === positions.length - 1 || positions[lo].t === targetMs) {
    const p = positions[lo];
    return { lat: p.lat, lon: p.lon, cog: p.cog };
  }

  const p0 = positions[lo];
  const p1 = positions[lo + 1];
  const t0 = p0.t;
  const t1 = p1.t;
  const frac = (targetMs - t0) / (t1 - t0);

  const lat = p0.lat + (p1.lat - p0.lat) * frac;
  const lon = p0.lon + (p1.lon - p0.lon) * frac;

  // Angular shortest-path interpolation for COG (radians)
  const cog0 = p0.cog;
  const cog1 = p1.cog;
  let delta = cog1 - cog0;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const cog = cog0 + delta * frac;

  return { lat, lon, cog };
}
