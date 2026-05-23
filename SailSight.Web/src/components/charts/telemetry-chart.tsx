"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface SeriesPoint { t: number; v: number | null; }
export interface ChartSeries { name: string; data: SeriesPoint[]; color?: string; yAxisIndex?: number; }

export function TelemetryChart({
  title,
  series,
  height = 160,
  yAxes,
  positionMs,
  windowStartMs,
  windowEndMs,
}: {
  title: string;
  series: ChartSeries[];
  height?: number;
  yAxes?: { name?: string; min?: number; max?: number }[];
  positionMs?: number | null;
  windowStartMs?: number | null;
  windowEndMs?: number | null;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const option: EChartsOption = useMemo(() => {
    const grid = { left: 50, right: 16, top: 28, bottom: 24 };
    const yAxis = (yAxes ?? [{}]).map((y) => ({
      type: "value" as const,
      name: y.name,
      min: y.min,
      max: y.max,
      axisLine: { show: false },
      axisLabel: { color: dark ? "#9CA3AF" : "#6B7280", fontSize: 10 },
      splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } },
    }));

    const positionMarkLine = positionMs != null
      ? {
          silent: true,
          symbol: "none",
          data: [{ xAxis: positionMs }],
          lineStyle: { color: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)", width: 1.5, type: "dashed" as const },
          label: { show: false },
        }
      : undefined;

    return {
      animation: false,
      title: { text: title, left: 0, top: 0, textStyle: { fontSize: 12, color: dark ? "#F9FAFB" : "#111827", fontWeight: 600 } },
      grid,
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      xAxis: {
        type: "time",
        min: windowStartMs ?? undefined,
        max: windowEndMs ?? undefined,
        axisLine: { lineStyle: { color: dark ? "#374151" : "#E5E7EB" } },
        axisLabel: { color: dark ? "#9CA3AF" : "#6B7280", fontSize: 10 },
      },
      yAxis,
      series: series.map((s) => ({
        name: s.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        sampling: "lttb",
        connectNulls: true,
        yAxisIndex: s.yAxisIndex ?? 0,
        lineStyle: { width: 1.5, color: s.color },
        itemStyle: { color: s.color },
        data: s.data.map((p) => [p.t, p.v]),
        ...(positionMarkLine ? { markLine: positionMarkLine } : {}),
      })),
    } as EChartsOption;
  }, [series, title, yAxes, dark, windowStartMs, windowEndMs, positionMs]);

  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />;
}
