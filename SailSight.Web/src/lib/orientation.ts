import type { NormalizedPosition } from "./schemas";

export interface Quaternion { w: number; x: number; y: number; z: number }

export function normalizeQuaternion(q: Quaternion): Quaternion | null {
  const length = Math.hypot(q.w, q.x, q.y, q.z);
  if (!Number.isFinite(length) || length < 1e-12) return null;
  return { w: q.w / length, x: q.x / length, y: q.y / length, z: q.z / length };
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function formatDirection(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : `${Math.round(normalizeDegrees(value)) % 360}°`;
}

export function shortestAngleDelta(from: number, to: number): number {
  return normalizeDegrees(to - from + 180) - 180;
}

/** VKX orientation is in the true North/East/Down frame, with clockwise yaw from north. */
export function quaternionToOrientation(input: Quaternion) {
  const q = normalizeQuaternion(input);
  if (!q) return null;
  const { w, x, y, z } = q;
  const degrees = 180 / Math.PI;
  const north = 1 - 2 * (y * y + z * z);
  const east = 2 * (w * z + x * y);
  return {
    // A vertical bow has no defined horizontal heading.
    heading: Math.hypot(north, east) < 1e-10 ? null : normalizeDegrees(Math.atan2(east, north) * degrees),
    heel: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * degrees,
    trim: Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))) * degrees,
  };
}

export function positionOrientation(position: NormalizedPosition | null) {
  return position ? quaternionToOrientation({ w: position.qW, x: position.qX, y: position.qY, z: position.qZ }) : null;
}

/** Keep real endpoints, inserting a gap instead of drawing across north. */
export function directionPoints(points: { t: number; v: number | null }[]) {
  const result: { t: number; v: number | null }[] = [];
  let previous: { t: number; v: number } | null = null;
  for (const point of points) {
    const v = point.v == null || !Number.isFinite(point.v) ? null : normalizeDegrees(point.v);
    if (previous && v != null && Math.abs(v - previous.v) > 180) {
      result.push({ t: (previous.t + point.t) / 2, v: null });
    }
    result.push({ t: point.t, v });
    previous = v == null ? null : { t: point.t, v };
  }
  return result;
}
