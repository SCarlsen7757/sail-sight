"use client";

import { useEffect, useState } from "react";
import { TelemetryChart, ChartSeries } from "./telemetry-chart";
import type { Position, Wind, Depth, Temperature, Load, SpeedThroughWater, ShiftAngle } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, convertWind, radiansToDegrees, speedUnitLabel, windUnitLabel } from "@/lib/units";
import { sgSmooth, sgSmoothAngularRad, sgSmoothQuaternions } from "@/lib/downsampling";
import { useRaceViewerStore } from "@/store/race-viewer";

const COLORS = { primary: "#00FFFF", secondary: "#FF00FF", green: "#39FF14", yellow: "#FFFF00" };

// Quaternion → roll (heel) and pitch (trim) in degrees.
function quatToHeelTrim(w: number, x: number, y: number, z: number) {
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
  return { heelDeg: radiansToDegrees(roll), trimDeg: radiansToDegrees(pitch) };
}

interface Props {
  raceId: string;
  /** Absolute ms timestamp of the race start signal — used to convert window offsets to ms. */
  raceStartMs: number;
  /** Countdown duration in seconds (0 for session viewer). Used to fetch pre-race telemetry. */
  raceStartOffset: number;
}

interface RaceTelemetry {
  positions: Position[];
  wind: Wind[];
  speedThroughWater: SpeedThroughWater[];
  depth: Depth[];
  temperature: Temperature[];
  load: Load[];
  shiftAngles: ShiftAngle[];
}

export function TelemetryPanels({ raceId, raceStartMs, raceStartOffset }: Props) {
  const { prefs } = useUnitPrefs();
  const { windowStart, windowEnd, position } = useRaceViewerStore();

  // Convert window offsets (seconds from data-start) to absolute ms timestamps.
  const windowStartMs = raceStartMs + (windowStart - raceStartOffset) * 1000;
  const windowEndMs = raceStartMs + (windowEnd - raceStartOffset) * 1000;
  // Current playback position as absolute ms timestamp (for the chart position marker).
  const positionMs = raceStartMs + (position - raceStartOffset) * 1000;

  const [telemetry, setTelemetry] = useState<RaceTelemetry | null>(null);

  useEffect(() => {
    const from = raceStartOffset > 0 ? `?from=${-raceStartOffset}` : "";
    fetch(`/api/v1/races/${raceId}/telemetry${from}`)
      .then((r) => r.ok ? r.json() as Promise<RaceTelemetry> : null)
      .then((d) => setTelemetry(d ?? { positions: [], wind: [], speedThroughWater: [], depth: [], temperature: [], load: [], shiftAngles: [] }));
  }, [raceId, raceStartOffset]);

  const posData = telemetry?.positions ?? [];
  const windData = telemetry?.wind ?? [];
  const stwData = telemetry?.speedThroughWater ?? [];
  const depthData = telemetry?.depth ?? [];
  const tempData = telemetry?.temperature ?? [];
  const loadData = telemetry?.load ?? [];
  const shiftsData = telemetry?.shiftAngles ?? [];

  const sogRaw = posData.map((p) => convertSpeed(n(p.speedOverGround), prefs.boatSpeed));
  const sogSmoothed = sgSmooth(sogRaw).map((v) => Math.max(0, v));
  const sogSeries: ChartSeries = {
    name: `SOG (${speedUnitLabel(prefs.boatSpeed)})`,
    color: COLORS.primary,
    data: posData.map((p, i) => ({ t: new Date(p.time).getTime(), v: sogSmoothed[i] })),
  };

  const cogRaw = posData.map((p) => n(p.courseOverGround));
  const cogSmoothed = sgSmoothAngularRad(cogRaw);
  const cogSeries: ChartSeries = {
    name: "COG (°)",
    color: COLORS.secondary,
    data: posData.map((p, i) => ({ t: new Date(p.time).getTime(), v: ((radiansToDegrees(cogSmoothed[i]) % 360) + 360) % 360 })),
  };
  const windSpeedSeries: ChartSeries = {
    name: `Wind speed (${windUnitLabel(prefs.wind)})`,
    color: COLORS.green,
    data: windData.map((p) => ({ t: new Date(p.time).getTime(), v: convertWind(n(p.windSpeed), prefs.wind) })),
  };
  const windDirSeries: ChartSeries = {
    name: "Wind dir (°)",
    color: COLORS.yellow,
    yAxisIndex: 1,
    data: windData.map((p) => ({ t: new Date(p.time).getTime(), v: radiansToDegrees(n(p.windDirection)) })),
  };

  const rawQuats = posData.map((p) => ({
    w: n(p.quaternionW), x: n(p.quaternionX), y: n(p.quaternionY), z: n(p.quaternionZ),
  }));
  const smoothedQuats = sgSmoothQuaternions(rawQuats);
  const heelTrim = smoothedQuats.map((q, i) => {
    const { heelDeg, trimDeg } = quatToHeelTrim(q.w, q.x, q.y, q.z);
    return { t: new Date(posData[i].time).getTime(), heelDeg, trimDeg };
  });
  const heelSeries: ChartSeries = { name: "Heel (°)", color: COLORS.primary, data: heelTrim.map((p) => ({ t: p.t, v: p.heelDeg })) };
  const trimSeries: ChartSeries = { name: "Trim (°)", color: COLORS.secondary, yAxisIndex: 1, data: heelTrim.map((p) => ({ t: p.t, v: p.trimDeg })) };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <TelemetryChart title="Speed (SOG)" series={[sogSeries]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
      </div>
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <TelemetryChart title="Heading (COG)" series={[cogSeries]} yAxes={[{ min: 0, max: 360 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
      </div>
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <TelemetryChart title="Heel & Trim" series={[heelSeries, trimSeries]} yAxes={[{ name: "Heel", min: -45, max: 45 }, { name: "Trim", min: -10, max: 10 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
      </div>

      {windData.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Wind" series={[windSpeedSeries, windDirSeries]} yAxes={[{ name: "Speed" }, { name: "Dir", min: 0, max: 360 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}

      {stwData.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart
            title="Speed through water"
            series={[{
              name: `STW (${speedUnitLabel(prefs.boatSpeed)})`,
              color: COLORS.green,
              data: stwData.map((p) => ({ t: new Date(p.time).getTime(), v: convertSpeed(n(p.forwardSpeed), prefs.boatSpeed) })),
            }]}
            windowStartMs={windowStartMs}
            windowEndMs={windowEndMs}
            positionMs={positionMs}
          />
        </div>
      )}
      {depthData.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Depth (m)" series={[{ name: "Depth", color: COLORS.yellow, data: depthData.map((p) => ({ t: new Date(p.time).getTime(), v: n(p.depth) })) }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
      {tempData.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Temperature (°C)" series={[{ name: "Temp", color: COLORS.primary, data: tempData.map((p) => ({ t: new Date(p.time).getTime(), v: n(p.temperature) })) }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
      {loadData.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Load" series={[{ name: "Load", color: COLORS.secondary, data: loadData.map((p) => ({ t: new Date(p.time).getTime(), v: n(p.load) })) }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
      {shiftsData.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Shift angles (heading °)" series={[{ name: "True heading", color: COLORS.green, data: shiftsData.map((p) => ({ t: new Date(p.time).getTime(), v: radiansToDegrees(n(p.trueHeading)) })) }]} yAxes={[{ min: 0, max: 360 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
    </div>
  );
}
