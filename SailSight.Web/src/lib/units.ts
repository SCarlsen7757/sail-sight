// Unit conversion helpers.
// All API values are SI base units. Display conversions are handled here.

export type SpeedUnit = "kts" | "kmh" | "mph";
export type WindUnit = "kts" | "ms" | "kmh";
export type DistanceUnit = "nm" | "km" | "mi" | "m";

export const MS_TO_KTS = 1.943844;
export const MS_TO_KMH = 3.6;
export const MS_TO_MPH = 2.236936;

export function convertSpeed(metersPerSecond: number, to: SpeedUnit): number {
  switch (to) {
    case "kts": return metersPerSecond * MS_TO_KTS;
    case "kmh": return metersPerSecond * MS_TO_KMH;
    case "mph": return metersPerSecond * MS_TO_MPH;
  }
}

export function convertWind(metersPerSecond: number, to: WindUnit): number {
  switch (to) {
    case "kts": return metersPerSecond * MS_TO_KTS;
    case "kmh": return metersPerSecond * MS_TO_KMH;
    case "ms": return metersPerSecond;
  }
}

export function convertDistance(meters: number, to: DistanceUnit): number {
  switch (to) {
    case "nm": return meters / 1852;
    case "km": return meters / 1000;
    case "mi": return meters / 1609.344;
    case "m": return meters;
  }
}

export function speedUnitLabel(u: SpeedUnit) {
  return u === "kts" ? "kn" : u === "kmh" ? "km/h" : "mph";
}
export function windUnitLabel(u: WindUnit) {
  return u === "kts" ? "kn" : u === "kmh" ? "km/h" : "m/s";
}
export function distanceUnitLabel(u: DistanceUnit) {
  return u === "nm" ? "nm" : u === "km" ? "km" : u === "mi" ? "mi" : "m";
}

export function radiansToDegrees(rad: number) { return (rad * 180) / Math.PI; }

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSignedClock(seconds: number): string {
  // -MM:SS for negative (countdown), +MM:SS for positive (elapsed)
  const sign = seconds < 0 ? "−" : "+";
  const abs = Math.abs(Math.floor(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
