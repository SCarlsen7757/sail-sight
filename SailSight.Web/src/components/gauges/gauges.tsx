"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

export function NumericGauge({ label, value, unit, big = false }: { label: string; value: number | null; unit?: string; big?: boolean }) {
  return (
    <div className="rounded-lg bg-bg-surface p-3 text-center ring-1 ring-border-default">
      <div className="text-xs uppercase tracking-wider text-text-secondary">{label}</div>
      <div className={cn("font-mono font-semibold text-text-primary", big ? "text-3xl" : "text-2xl")}>
        {value == null || !isFinite(value) ? "—" : value.toFixed(1)}
        {unit && <span className="ml-1 text-sm text-text-secondary">{unit}</span>}
      </div>
    </div>
  );
}

export function CompassRose({ headingDeg }: { headingDeg: number | null }) {
  const h = headingDeg == null || !isFinite(headingDeg) ? 0 : headingDeg;
  const accumulatedAngle = useRef(h);

  // Compute the shortest angular delta and accumulate, so the CSS transition
  // always takes the short path across the 0/360 boundary.
  const delta = ((h - accumulatedAngle.current) % 360 + 540) % 360 - 180;
  accumulatedAngle.current += delta;

  return (
    <div className="rounded-lg bg-bg-surface p-3 text-center ring-1 ring-border-default">
      <div className="text-xs uppercase tracking-wider text-text-secondary">Heading</div>
      <div className="relative mx-auto my-2 h-24 w-24 rounded-full ring-1 ring-border-default">
        <div className="absolute inset-0 flex items-center justify-center text-xs text-text-secondary">
          <span className="absolute top-1">N</span>
          <span className="absolute bottom-1">S</span>
          <span className="absolute left-1">W</span>
          <span className="absolute right-1">E</span>
        </div>
        <div
          className="absolute left-1/2 top-1/2 h-10 w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-sm bg-action-primary"
          style={{ transform: `translate(-50%, -100%) rotate(${accumulatedAngle.current}deg)`, transition: "transform 0.3s ease" }}
        />
      </div>
      <div className="font-mono text-lg text-text-primary">{headingDeg == null ? "—" : `${Math.round(h)}°`}</div>
    </div>
  );
}

export function Inclinometer({ label, value, range }: { label: string; value: number | null; range: number }) {
  const v = value == null || !isFinite(value) ? 0 : Math.max(-range, Math.min(range, value));
  const pct = ((v + range) / (2 * range)) * 100;
  const color = Math.abs(v) > range * 0.7 ? "#FF3333" : Math.abs(v) > range * 0.4 ? "#FFCC00" : "#00FF66";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-text-secondary">
        <span>{label}</span>
        <span className="font-mono inline-block min-w-[6ch] text-right">{value == null ? "—" : `${v.toFixed(1)}°`}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-bg-elevated">
        <div className="absolute left-1/2 top-0 h-full w-px bg-border-default" />
        <div
          className="absolute top-0 h-full w-2 rounded-full"
          style={{ left: `calc(${pct}% - 4px)`, background: color, transition: "left 0.3s ease, background 0.3s ease" }}
        />
      </div>
    </div>
  );
}

export function HeelTrimCard({ heel, trim }: { heel: number | null; trim: number | null }) {
  return (
    <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default flex flex-col gap-3 justify-center">
      <Inclinometer label="Heel (°)" value={heel} range={45} />
      <Inclinometer label="Trim (°)" value={trim} range={10} />
    </div>
  );
}
