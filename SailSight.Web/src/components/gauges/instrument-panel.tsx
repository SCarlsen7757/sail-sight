"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { NormalizedPosition } from "@/lib/schemas";
import { formatDirection, normalizeDegrees, positionOrientation, shortestAngleDelta } from "@/lib/orientation";
import { convertSpeed, radiansToDegrees, speedUnitLabel } from "@/lib/units";
import { useUnitPrefs } from "@/store/settings";

function reading(value: number | null, signed = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(1));
  return `${signed && rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

export function DirectionIndicator({ directionDeg, label }: { directionDeg: number | null; label: "COG" | "Heading" }) {
  const heading = directionDeg == null || !Number.isFinite(directionDeg) ? null : normalizeDegrees(directionDeg);
  const [angle, setAngle] = useState({ heading, accumulated: heading ?? 0 });
  let accumulated = angle.accumulated;
  if (heading !== angle.heading) {
    accumulated = heading == null ? angle.accumulated : angle.heading == null ? heading : angle.accumulated + shortestAngleDelta(angle.heading, heading);
    setAngle({ heading, accumulated });
  }
  return (
    <svg viewBox="0 0 80 80" className="h-8 w-8 shrink-0" role="img" aria-label={`${label} direction: ${formatDirection(heading)}`}>
      {heading != null && <g transform={`rotate(${accumulated} 40 40)`}>
        {/* The triangle's centroid is the rotation centre (40, 40). */}
        <path d="M40 4 L54 58 L26 58 Z" className="fill-action-primary" />
      </g>}
    </svg>
  );
}

function Attitude({ label, value, range }: { label: string; value: number | null; range: number }) {
  const valid = value != null && Number.isFinite(value);
  const x = valid ? 50 + Math.max(-range, Math.min(range, value)) / range * 46 : null;
  return (
    <div className="min-w-0 p-4" role="group" aria-label={label}>
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight" aria-label={`${label} reading`}>
        {reading(value, true)}{valid && <span className="ml-0.5 text-lg font-normal text-text-secondary">°</span>}
      </div>
      <svg viewBox="0 0 100 20" className="mt-3 h-5 w-full" aria-hidden="true">
        <path d="M4 10 H96 M4 7 V13 M50 3 V17 M96 7 V13" className="stroke-border-default" fill="none" />
        {x != null && <circle cx={x} cy="10" r="3" className="fill-text-primary" />}
      </svg>
      <div className="flex justify-between text-xs tabular-nums text-text-secondary" aria-hidden="true"><span>−{range}°</span><span>0</span><span>+{range}°</span></div>
    </div>
  );
}

export function InstrumentPanel({ position, compact = false }: { position: NormalizedPosition | null; compact?: boolean }) {
  const { prefs } = useUnitPrefs();
  const orientation = positionOrientation(position);
  const speed = position ? convertSpeed(position.sog, prefs.boatSpeed) : null;
  const cog = position ? radiansToDegrees(position.cog) : null;
  return (
    <section aria-label="Sailing instruments" className={cn("grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-lg bg-border-default ring-1 ring-border-default [&>div]:bg-bg-surface", compact ? "sm:grid-cols-4 lg:grid-cols-1" : "@min-[580px]:grid-cols-4")}>
      <div className="min-w-0 p-4" role="group" aria-label="Speed and course over ground">
        <div className="text-sm text-text-secondary" title="Speed over ground">SOG</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-3xl font-semibold tabular-nums tracking-tight" aria-label="SOG reading">
          {reading(speed)}<span className="text-sm font-normal text-text-secondary">{speedUnitLabel(prefs.boatSpeed)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2" title="Direction of travel over ground">
          <span className="text-sm text-text-secondary">COG</span>
          <div className="flex items-center gap-1">
            <span className="text-lg font-medium tabular-nums" aria-label="COG reading">{formatDirection(cog)}</span>
            <DirectionIndicator directionDeg={cog} label="COG" />
          </div>
        </div>
        <p className="sr-only">SOG: speed over ground. COG: direction of travel over ground.</p>
      </div>
      <div className="min-w-0 p-4" role="group" aria-label="Boat heading">
        <div className="text-sm text-text-secondary" title="Where the bow points, relative to true north">Heading</div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-3xl font-semibold tabular-nums tracking-tight" aria-label="Heading reading">{formatDirection(orientation?.heading ?? null)}</span>
          <DirectionIndicator directionDeg={orientation?.heading ?? null} label="Heading" />
        </div>
        <p className="sr-only">Where the bow points, relative to true north.</p>
      </div>
      <Attitude label="Heel" value={orientation?.heel ?? null} range={45} />
      <Attitude label="Trim" value={orientation?.trim ?? null} range={10} />
    </section>
  );
}
