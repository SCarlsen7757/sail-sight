import type { components } from "./api-types";

// The generated types use `number | string` for numeric fields (OpenAPI quirk
// from BigInteger formats). Coerce helpers normalize at the edge.
export type Schemas = components["schemas"];
export type StatsSummary = Schemas["GlobalStatsDto"];
export type SessionSummary = Schemas["SessionSummaryDto"];
export type SessionDetail = Schemas["SessionDetailDto"];
export type Race = Schemas["RaceDto"];
export type RaceDetail = Schemas["RaceDetailDto"];
export type Boat = Schemas["BoatDto"];
export type BoatStats = Schemas["BoatStatsDto"];
export type BoatClass = Schemas["BoatClassDto"];
export type BoatClassRequest = Schemas["BoatClassRequestDto"];
export type NotificationCounts = Schemas["NotificationCountsDto"];
export type SessionShare = Schemas["SessionShareDto"];
export type Mark = Schemas["MarkDto"];
export type Course = Schemas["CourseDto"];
export type CourseSummary = Schemas["CourseSummaryDto"];
export type CourseLeg = Schemas["CourseLegDto"];
export type Position = Schemas["PositionDto"];
export type Wind = Schemas["WindDto"];
export type Depth = Schemas["DepthDto"];
export type Temperature = Schemas["TemperatureDto"];
export type Load = Schemas["LoadDto"];
export type SpeedThroughWater = Schemas["SpeedThroughWaterDto"];
export type ShiftAngle = Schemas["ShiftAngleDto"];
export type StartAnalysis = Schemas["StartAnalysisDto"];
export type RaceSummary = Schemas["RaceSummaryDto"];
export type StartLineLength = Schemas["StartLineLengthDto"];
export type PlatformStats = Schemas["PlatformStatsDto"];
export type AdminStats = Schemas["AdminStatsDto"];

export function n(v: number | string | null | undefined): number {
  if (v == null) return NaN;
  return typeof v === "number" ? v : parseFloat(v);
}

export function nOrNull(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const x = typeof v === "number" ? v : parseFloat(v);
  return isFinite(x) ? x : null;
}
