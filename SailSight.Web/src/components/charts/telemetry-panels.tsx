"use client";

import { browserRequest } from "@/lib/browser-request";

import { useEffect, useMemo, useState } from "react";
import { TelemetryChart, ChartSeries } from "./telemetry-chart";
import type { NormalizedTelemetry } from "@/lib/schemas";
import { positionOrientation } from "@/lib/orientation";
import { useTheme } from "next-themes";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, convertWind, radiansToDegrees, speedUnitLabel, windUnitLabel } from "@/lib/units";
import { normalizeTelemetry } from "@/lib/normalization";
import { useRaceViewerStore } from "@/store/race-viewer";

const COLORS = { primary: "#00FFFF", secondary: "#FF00FF", green: "#39FF14", yellow: "#FFFF00" };

interface Props {
  raceId: string;
  raceStartMs: number;
  raceStartOffset: number;
  telemetryRateHz: number;
  showHeading: boolean;
  onShowHeadingChange: (value: boolean) => void;
}

export function TelemetryPanels({ raceId, raceStartMs, raceStartOffset, telemetryRateHz, showHeading, onShowHeadingChange }: Props) {
  const { prefs } = useUnitPrefs();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
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
    browserRequest(`/api/v1/races/${raceId}/telemetry${from}`)
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
      color: dark ? "#38BDF8" : "#0369A1",
      data: positions.map((p) => ({ t: p.t, v: convertSpeed(p.sog, prefs.boatSpeed) })),
    };
    const cog: ChartSeries = {
      name: "COG (°)",
      color: dark ? "#38BDF8" : "#0369A1",
      angular: true,
      data: positions.map((p) => ({ t: p.t, v: ((radiansToDegrees(p.cog) % 360) + 360) % 360 })),
    };
    const orientations = positions.map((p) => ({ t: p.t, orientation: positionOrientation(p) }));
    const heading: ChartSeries = {
      name: "Heading (°)", color: dark ? "#FBBF24" : "#92400E", angular: true, dashed: true,
      data: orientations.map((p) => ({ t: p.t, v: p.orientation?.heading ?? null })),
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

    const htRaw = orientations;
    const heel: ChartSeries = { name: "Heel (°)", color: dark ? "#2DD4BF" : "#0F766E", data: htRaw.map(p => ({ t: p.t, v: p.orientation?.heel ?? null })) };
    const trim: ChartSeries = { name: "Trim (°)", color: dark ? "#C084FC" : "#7E22CE", yAxisIndex: 1, data: htRaw.map(p => ({ t: p.t, v: p.orientation?.trim ?? null })) };

    const stwSeries: ChartSeries[] = stw.length > 0 ? [{
      name: `STW (${speedUnitLabel(prefs.boatSpeed)})`,
      color: COLORS.green,
      data: stw.map((p) => ({ t: p.t, v: convertSpeed(p.speed, prefs.boatSpeed) })),
    }] : [];

    const depthSeries: ChartSeries[] = depth.length > 0 ? [{ name: "Depth", color: COLORS.yellow, data: depth.map((p) => ({ t: p.t, v: p.depth })) }] : [];
    const tempSeries: ChartSeries[] = temp.length > 0 ? [{ name: "Temp", color: COLORS.primary, data: temp.map((p) => ({ t: p.t, v: p.temp })) }] : [];
    const loadSeries: ChartSeries[] = load.length > 0 ? [{ name: "Load", color: COLORS.secondary, data: load.map((p) => ({ t: p.t, v: p.load })) }] : [];
    const shiftSeries: ChartSeries[] = shifts.length > 0 ? [{ name: "True heading", color: COLORS.green, data: shifts.map((p) => ({ t: p.t, v: radiansToDegrees(p.heading) })) }] : [];

    return { sog, cog, heading, windSpeed, windDir, heel, trim, stwSeries, depthSeries, tempSeries, loadSeries, shiftSeries };
  }, [telemetry, prefs.boatSpeed, prefs.wind, dark]);

  if (!series) return null;

  const gridClass = "grid grid-cols-1 gap-4 lg:grid-cols-2";

  return (
    <div className={gridClass}>
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <TelemetryChart title="Speed (SOG)" series={[series.sog]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
      </div>
      <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Course over ground</h3>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={showHeading} onChange={(event) => onShowHeadingChange(event.target.checked)} className="h-4 w-4 accent-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary" />
            Show heading
          </label>
        </div>
        <div className="mb-1 flex gap-4 text-xs" aria-label="Direction chart legend">
          <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400"><span className="w-5 border-t-2" />COG</span>
          {showHeading && <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400"><span className="w-5 border-t-2 border-dashed" />Heading</span>}
        </div>
        <TelemetryChart title="" series={showHeading ? [series.cog, series.heading] : [series.cog]} yAxes={[{ min: 0, max: 360 }]} windowStartMs={windowStartMs} windowEndMs={windowEndMs} positionMs={positionMs} />
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
