import { n, NormalizedPosition, NormalizedWind, NormalizedStw, NormalizedDepth, NormalizedTemperature, NormalizedLoad, NormalizedShift, NormalizedTelemetry } from "./schemas";
import type { Position, Wind, SpeedThroughWater, Depth, Temperature, Load, ShiftAngle } from "./schemas";
import { sgSmooth, sgSmoothAngularRad, sgSmoothQuaternions } from "./downsampling";

export function normalizePositions(pos: Position[], hz: number): NormalizedPosition[] {
  if (pos.length === 0) return [];

  const raw = pos.map(p => ({
    t: new Date(p.time).getTime(),
    lat: n(p.latitude),
    lon: n(p.longitude),
    sog: n(p.speedOverGround),
    cog: n(p.courseOverGround),
    qW: n(p.quaternionW),
    qX: n(p.quaternionX),
    qY: n(p.quaternionY),
    qZ: n(p.quaternionZ),
  }));

  if (raw.length <= 5) return raw;

  const sogWindow = Math.max(5, Math.round(1.5 * hz) | 1);
  const orientationWindow = Math.max(5, Math.round(5.0 * hz) | 1);

  const smoothedSog = sgSmooth(raw.map(p => p.sog), sogWindow);
  const smoothedCog = sgSmoothAngularRad(raw.map(p => p.cog), sogWindow);
  const smoothedQuats = sgSmoothQuaternions(raw.map(p => ({
    w: p.qW, x: p.qX, y: p.qY, z: p.qZ
  })), orientationWindow);

  return raw.map((p, i) => ({
    ...p,
    sog: smoothedSog[i],
    cog: smoothedCog[i],
    qW: smoothedQuats[i].w,
    qX: smoothedQuats[i].x,
    qY: smoothedQuats[i].y,
    qZ: smoothedQuats[i].z,
  }));
}

export function normalizeWind(wind: Wind[], hz: number): NormalizedWind[] {
  if (wind.length === 0) return [];
  const raw = wind.map(w => ({
    t: new Date(w.time).getTime(),
    speed: n(w.windSpeed),
    dir: n(w.windDirection),
  }));

  if (raw.length <= 5) return raw;
  const windWindow = Math.max(5, Math.round(3.0 * hz) | 1);
  const smoothedSpeed = sgSmooth(raw.map(w => w.speed), windWindow);
  const smoothedDir = sgSmoothAngularRad(raw.map(w => w.dir), windWindow);

  return raw.map((w, i) => ({
    ...w,
    speed: smoothedSpeed[i],
    dir: smoothedDir[i],
  }));
}

export function normalizeTelemetry(data: any, hz: number): NormalizedTelemetry {
  return {
    positions: normalizePositions(data.positions || [], hz),
    wind: normalizeWind(data.wind || [], hz),
    stw: (data.speedThroughWater || []).map((s: SpeedThroughWater) => ({
      t: new Date(s.time).getTime(),
      speed: n(s.forwardSpeed),
    })),
    depth: (data.depth || []).map((d: Depth) => ({
      t: new Date(d.time).getTime(),
      depth: n(d.depth),
    })),
    temp: (data.temperature || []).map((t: Temperature) => ({
      t: new Date(t.time).getTime(),
      temp: n(t.temperature),
    })),
    load: (data.load || []).map((l: Load) => ({
      t: new Date(l.time).getTime(),
      load: n(l.load),
    })),
    shifts: (data.shiftAngles || []).map((s: ShiftAngle) => ({
      t: new Date(s.time).getTime(),
      heading: n(s.trueHeading),
    })),
  };
}
