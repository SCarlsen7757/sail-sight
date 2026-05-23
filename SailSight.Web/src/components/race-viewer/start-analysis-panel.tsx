"use client";

import { useEffect, useState } from "react";
import type { StartAnalysis } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import { Card } from "@/components/ui/controls";
import { useUnitPrefs } from "@/store/settings";
import { convertSpeed, speedUnitLabel } from "@/lib/units";

interface Props {
  data: StartAnalysis | null | undefined;
  raceId: string;
  compact?: boolean;
}

export function StartAnalysisPanel({ data, raceId, compact = false }: Props) {
  const { prefs } = useUnitPrefs();
  const [lineLength, setLineLength] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    fetch(`/api/v1/races/${raceId}/analysis/start-line-length`)
      .then((r) => r.ok ? r.json() : null)
      .then((v) => setLineLength(v != null && typeof v.lengthMeters !== "undefined" ? parseFloat(v.lengthMeters) : null))
      .catch(() => null);
  }, [raceId, data]);

  if (!data) return null;
  const bias = data.timeBiasSeconds != null ? n(data.timeBiasSeconds) : null;
  const ocsBias = data.ocsTimeBiasSeconds != null ? n(data.ocsTimeBiasSeconds) : null;
  const biasColor = bias == null ? "" : bias > 0 ? "text-warning" : "text-success";
  const fractionMeters = lineLength != null ? (n(data.lineFraction) * lineLength).toFixed(1) + " m" : null;

  if (compact) {
    // Vertical strip on desktop, horizontal banner on mobile
    return (
      <Card className="p-3 lg:p-2 flex-shrink-0">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary lg:mb-3">
          Start
        </h3>
        {data.isOcs && (
          <div className="mb-2 flex flex-wrap items-center gap-1 lg:flex-col lg:items-start">
            <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">OCS</span>
            {ocsBias != null && (
              <span className="font-mono text-xs text-red-500">{Math.abs(ocsBias).toFixed(1)}s early</span>
            )}
            {data.isOcsCleared && (
              <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-bold text-white">Cleared</span>
            )}
          </div>
        )}
        {/* Mobile: horizontal row  |  Desktop: vertical stack */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6 lg:grid-cols-1 lg:gap-y-3">
          <div>
            <div className="text-xs text-text-secondary">Bias</div>
            {bias != null
              ? <div className={`font-mono text-lg font-semibold lg:text-base ${biasColor}`}>{bias > 0 ? "+" : ""}{bias.toFixed(1)}s</div>
              : <div className="font-mono text-lg text-text-secondary lg:text-base">—</div>
            }
          </div>
          <div>
            <div className="text-xs text-text-secondary">Speed</div>
            <div className="font-mono text-sm">{convertSpeed(n(data.speedAtCrossingMs), prefs.boatSpeed).toFixed(1)} {speedUnitLabel(prefs.boatSpeed)}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Approach</div>
            <div className="font-mono text-sm">{n(data.approachCourseDegrees).toFixed(0)}°</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Position</div>
            <div className="font-mono text-sm">{fractionMeters ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Line</div>
            <div className="font-mono text-sm">{lineLength != null ? lineLength.toFixed(1) + " m" : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Crossed</div>
            <div className="font-mono text-xs">{new Date(data.crossedAt).toLocaleTimeString()}</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">Start analysis</h3>
      {data.isOcs && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">OCS</span>
          {ocsBias != null && (
            <span className="font-mono text-sm text-red-500">{Math.abs(ocsBias).toFixed(1)}s before start signal</span>
          )}
          {data.isOcsCleared && (
            <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-bold text-white">Cleared</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div>
          <div className="text-xs text-text-secondary">Time bias</div>
          {bias != null
            ? <div className={`font-mono text-2xl font-semibold ${biasColor}`}>{bias > 0 ? "+" : ""}{bias.toFixed(1)}s</div>
            : <div className="font-mono text-2xl font-semibold text-text-secondary">—</div>
          }
        </div>
        <div>
          <div className="text-xs text-text-secondary">Crossing speed</div>
          <div className="font-mono text-lg">{convertSpeed(n(data.speedAtCrossingMs), prefs.boatSpeed).toFixed(1)} {speedUnitLabel(prefs.boatSpeed)}</div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">Approach</div>
          <div className="font-mono text-lg">{n(data.approachCourseDegrees).toFixed(0)}°</div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">Position on line</div>
          <div className="font-mono text-lg">{fractionMeters ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">Line length</div>
          <div className="font-mono text-lg">{lineLength != null ? lineLength.toFixed(1) + " m" : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">Crossed at</div>
          <div className="font-mono text-sm">{new Date(data.crossedAt).toLocaleTimeString()}</div>
        </div>
      </div>
    </Card>
  );
}
