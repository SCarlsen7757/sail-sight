import SavitzkyGolay from "ml-savitzky-golay";

// Time-based decimation: keep at most `maxPoints` evenly spaced samples.
export function downsample<T extends { t: number }>(data: T[], maxPoints = 2000): T[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(data[Math.floor(i * step)]);
  }
  if (out[out.length - 1] !== data[data.length - 1]) out.push(data[data.length - 1]);
  return out;
}

export function forwardFill<T>(values: (T | null | undefined)[]): (T | null)[] {
  let last: T | null = null;
  return values.map((v) => {
    if (v != null) { last = v; return v; }
    return last;
  });
}

/**
 * Savitzky-Golay filter for linear signals (e.g. SOG, wind speed).
 *
 * - Uses derivative=0 (smooth, not differentiate).
 * - Edge-replicates both ends so the output length equals the input length.
 * - Forward/backward fills NaN values before filtering so they don't corrupt
 *   the polynomial fit.
 * - Falls back to the raw values if the array is too short for the window.
 */
export function sgSmooth(values: number[], windowSize = 11, order = 2): number[] {
  if (values.length < windowSize) return [...values];
  const step = Math.floor(windowSize / 2);

  // Forward/backward fill NaN so they don't poison the fit
  const clean = [...values];
  let prev = NaN;
  for (let i = 0; i < clean.length; i++) {
    if (isFinite(clean[i])) { prev = clean[i]; }
    else if (isFinite(prev)) { clean[i] = prev; }
  }
  let next = NaN;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (isFinite(clean[i])) { next = clean[i]; }
    else if (isFinite(next)) { clean[i] = next; }
    else { clean[i] = 0; }
  }

  // Edge-replicate both ends so output length === input length
  const padded = [
    ...Array<number>(step).fill(clean[0]),
    ...clean,
    ...Array<number>(step).fill(clean[clean.length - 1]),
  ];

  const smoothed = SavitzkyGolay(padded, 1, {
    windowSize,
    polynomial: order,
    derivative: 0,
    pad: "none",
  });
  return Array.from(smoothed);
}

/**
 * Savitzky-Golay filter for angular signals given in **radians**.
 * Converts to sin/cos, filters each component independently, then recovers
 * the angle via atan2 — correctly handles the 0/2π wrap-around.
 */
export function sgSmoothAngularRad(radians: number[], windowSize = 11, order = 2): number[] {
  if (radians.length === 0) return radians;
  const sins = radians.map(Math.sin);
  const coss = radians.map(Math.cos);
  const smoothSin = sgSmooth(sins, windowSize, order);
  const smoothCos = sgSmooth(coss, windowSize, order);
  return smoothSin.map((s, i) => Math.atan2(s, smoothCos[i]));
}

export interface Quaternion { w: number; x: number; y: number; z: number; }

/**
 * Savitzky-Golay filter for a sequence of unit quaternions.
 *
 * 1. Fix sign consistency: flip q[i] if dot(q[i], q[i-1]) < 0 so that all
 *    quaternions lie on the same hemisphere (eliminates double-cover spikes).
 * 2. SG-smooth each of the four components independently.
 * 3. Re-normalize each result to unit length.
 */
export function sgSmoothQuaternions(qs: Quaternion[], windowSize = 11, order = 2): Quaternion[] {
  if (qs.length === 0) return qs;

  // Step 1 — fix sign consistency
  const fixed: Quaternion[] = [qs[0]];
  for (let i = 1; i < qs.length; i++) {
    const prev = fixed[i - 1];
    const cur = qs[i];
    const dot = prev.w * cur.w + prev.x * cur.x + prev.y * cur.y + prev.z * cur.z;
    if (dot < 0) {
      fixed.push({ w: -cur.w, x: -cur.x, y: -cur.y, z: -cur.z });
    } else {
      fixed.push(cur);
    }
  }

  // Step 2 — smooth each component
  const ws = fixed.map((q) => q.w);
  const xs = fixed.map((q) => q.x);
  const ys = fixed.map((q) => q.y);
  const zs = fixed.map((q) => q.z);
  const sw = sgSmooth(ws, windowSize, order);
  const sx = sgSmooth(xs, windowSize, order);
  const sy = sgSmooth(ys, windowSize, order);
  const sz = sgSmooth(zs, windowSize, order);

  // Step 3 — normalize
  return sw.map((w, i) => {
    const len = Math.sqrt(w * w + sx[i] * sx[i] + sy[i] * sy[i] + sz[i] * sz[i]);
    if (len === 0) return fixed[i];
    return { w: w / len, x: sx[i] / len, y: sy[i] / len, z: sz[i] / len };
  });
}

