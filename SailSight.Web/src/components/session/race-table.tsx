"use client";

import { Card } from "@/components/ui/controls";
import type { Race } from "@/lib/schemas";
import { n } from "@/lib/schemas";
import {
  convertDistance,
  convertSpeed,
  distanceUnitLabel,
  formatDuration,
  speedUnitLabel,
} from "@/lib/units";
import { useUnitPrefs } from "@/store/settings";

interface RaceTableProps {
  races: Race[];
  onRowClick: (race: Race) => void;
  showCourse?: boolean;
}

export function RaceTable({ races, onRowClick, showCourse = false }: RaceTableProps) {
  const { prefs } = useUnitPrefs();

  return (
    <Card className="overflow-hidden">
      <h2 className="px-5 pt-4 text-lg font-semibold">Races</h2>
      {races.length === 0 ? (
        <p className="px-5 py-8 text-sm text-text-secondary">No races detected in this session.</p>
      ) : (
        <table className="w-full">
          <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Race #</th>
              <th className="px-3 py-2 text-left">Started</th>
              <th className="px-3 py-2 text-left">Duration</th>
              <th className="px-3 py-2 text-left">Distance</th>
              <th className="px-3 py-2 text-left">Max speed</th>
              {showCourse && <th className="px-3 py-2 text-left">Course</th>}
            </tr>
          </thead>
          <tbody>
            {races.map((r) => (
              <tr
                key={String(r.id)}
                className="cursor-pointer border-t border-border-default text-sm hover:bg-bg-elevated/40"
                onClick={() => onRowClick(r)}
              >
                <td className="px-3 py-2 font-medium text-action-primary">Race {n(r.raceNumber)}</td>
                <td className="px-3 py-2 text-text-secondary">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono">
                  {r.durationSeconds != null ? formatDuration(n(r.durationSeconds)) : "—"}
                </td>
                <td className="px-3 py-2 font-mono">
                  {r.sailedDistanceMeters != null
                    ? `${convertDistance(n(r.sailedDistanceMeters), prefs.course).toFixed(2)} ${distanceUnitLabel(prefs.course)}`
                    : "—"}
                </td>
                <td className="px-3 py-2 font-mono">
                  {r.maxSpeedOverGround != null
                    ? `${convertSpeed(n(r.maxSpeedOverGround), prefs.boatSpeed).toFixed(1)} ${speedUnitLabel(prefs.boatSpeed)}`
                    : "—"}
                </td>
                {showCourse && <td className="px-3 py-2 text-text-secondary">{r.courseName ?? "None"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
