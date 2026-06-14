"use client";

import { useEffect, useMemo, useState } from "react";
import { TelemetryChart, ChartSeries } from "./telemetry-chart";
import type { NormalizedTelemetry } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, convertWind, radiansToDegrees, speedUnitLabel, windUnitLabel } from "@/lib/units";
import { normalizeTelemetry } from "@/lib/normalization";
import { useRaceViewerStore } from "@/store/race-viewer";

const COLORS = { primary: "#00FFFF", secondary: "#FF00FF", green: "#39FF14", yellow: "#FFFF00" };

// Heel/Trim from normalized positions (pre-smoothed)
function getHeelTrimSeries(pos: NormalizedTelemetry["positions"]) {
  return pos.map((p) => {
    const w = p.qW, x = p.qX, y = p.qY, z = p.qZ;
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);
    const sinp = 2 * (w * y - z * x);
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
    return { t: p.t, heelDeg: radiansToDegrees(roll), trimDeg: radiansToDegrees(pitch) };
  });
}

interface Props {
  raceId: string;
  raceStartMs: number;
  raceStartOffset: number;
  telemetryRateHz: number;
}

export function TelemetryPanels({ raceId, raceStartMs, raceStartOffset, telemetryRateHz }: Props) {
  const { prefs } = useUnitPrefs();
  const windowStart = useRaceViewerStore((s) => s.windowStart);
  const windowEnd = useRaceViewerStore((s) => s.windowEnd);
  const position = useRaceViewerStore((s) => s.position);

  // Convert window offsets (seconds from data-start) to absolute ms timestamps.
  const windowStartMs = raceStartMs + (windowStart - raceStartOffset) * 1000;
  const windowEndMs = raceStartMs + (windowEnd - raceStartOffset) * 1000;
  const positionMs = raceStartMs + (position - raceStartOffset) * 1000;

  const [telemetry, setTelemetry] = useState<NormalizedTelemetry | null>(null);

  useEffect(() => {
    const from = raceStartOffset > 0 ? `?from=${-raceStartOffset}` : "";
    fetch(`/api/v1/races/${raceId}/telemetry${from}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        const hz = telemetryRateHz > 0 ? telemetryRateHz : 1;
        setTelemetry(normalizeTelemetry(d, hz));
      });
  }, [raceId, raceStartOffset, telemetryRateHz]);

  // Memoize all chart series based on telemetry data and unit preferences.
  // This ensures we only re-map the arrays when data actually changes, not on every playback tick.
  const series = useMemo(() => {
    if (!telemetry) return null;
    const { positions, wind, stw, depth, temp, load, shifts } = telemetry;

    const sog: ChartSeries = {
      name: `SOG (${speedUnitLabel(prefs.boatSpeed)})`,
      color: COLORS.primary,
      data: positions.map((p) => ({ t: p.t, v: convertSpeed(p.sog, prefs.boatSpeed) })),
    };
    const cog: ChartSeries = {
      name: "COG (°)",
      color: COLORS.secondary,
      data: positions.map((p) => ({ t: p.t, v: ((radiansToDegrees(p.cog) % 360) + 360) % 360 })),
    };
    const windSpeed: ChartSeries = {
      name: `Wind speed (${windUnitLabel(prefs.wind)})`,
      color: COLORS.green,
      data: wind.map((p) => ({ t: p.t, v: convertWind(p.speed, prefs.wind) })),
    };
    const windDir: ChartSeries = {
      name: "Wind dir (°)",
      color: COLORS.yellow,
      yAxisIndex: 1,
      data: wind.map((p) => ({ t: p.t, v: ((radiansToDegrees(p.dir) % 360) + 360) % 360 })),
    };

    const htRaw = getHeelTrimSeries(positions);
    const heel: ChartSeries = { name: "Heel (°)", color: COLORS.primary, data: htRaw.map(p => ({ t: p.t, v: p.heelDeg })) };
    const trim: ChartSeries = { name: "Trim (°)", color: COLORS.secondary, yAxisIndex: 1, data: htRaw.map(p => ({ t: p.t, v: p.trimDeg })) };

    const stwSeries: ChartSeries[] = stw.length > 0 ? [{
      name: `STW (${speedUnitLabel(prefs.boatSpeed)})`,
      color: COLORS.green,
      data: stw.map((p) => ({ t: p.t, v: convertSpeed(p.speed, prefs.boatSpeed) })),
    }] : [];

    const depthSeries: ChartSeries[] = depth.length > 0 ? [{ name: "Depth", color: COLORS.yellow, data: depth.map((p) => ({ t: p.t, v: p.depth })) }] : [];
    const tempSeries: ChartSeries[] = temp.length > 0 ? [{ name: "Temp", color: COLORS.primary, data: temp.map((p) => ({ t: p.t, v: p.temp })) }] : [];
    const loadSeries: ChartSeries[] = load.length > 0 ? [{ name: "Load", color: COLORS.secondary, data: load.map((p) => ({ t: p.t, v: p.load })) }] : [];
    const shiftSeries: ChartSeries[] = shifts.length > 0 ? [{ name: "True heading", color: COLORS.green, data: shifts.map((p) => ({ t: p.t, v: radiansToDegrees(p.heading) })) }] : [];

    return { sog, cog, windSpeed, windDir, heel, trim, stwSeries, depthSeries, tempSeries, loadSeries, shiftSeries };
  }, [telemetry, prefs.boatSpeed, prefs.wind]);

  if (!series) return null;

  const gridClass = "grid grid-cols-1 gap-4 lg:grid-cols-2";

  return (
    <div className={gridClass}>
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <TelemetryChart title="Speed (SOG)" series={[series.sog]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
      </div>
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <TelemetryChart title="Heading (COG)" series={[series.cog]} yAxes={[{ min: 0, max: 360 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
      </div>
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <TelemetryChart title="Heel & Trim" series={[series.heel, series.trim]} yAxes={[{ name: "Heel", min: -45, max: 45 }, { name: "Trim", min: -10, max: 10 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
      </div>

      {series.windSpeed.data.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Wind" series={[series.windSpeed, series.windDir]} yAxes={[{ name: "Speed" }, { name: "Dir", min: 0, max: 360 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}

      {series.stwSeries.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Speed through water" series={series.stwSeries} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
      {series.depthSeries.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Depth (m)" series={series.depthSeries} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
      {series.tempSeries.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Temperature (°C)" series={series.tempSeries} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
      {series.loadSeries.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Load" series={series.loadSeries} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
      {series.shiftSeries.length > 0 && (
        <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
          <TelemetryChart title="Shift angles" series={series.shiftSeries} yAxes={[{ min: 0, max: 360 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
        </div>
      )}
    </div>
  );
}
