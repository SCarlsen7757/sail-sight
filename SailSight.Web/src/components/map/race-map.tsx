"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Position, RaceDetail } from "@/lib/schemas";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { Crosshair, Maximize2 } from "lucide-react";

// Leaflet must only run on the client
const MapView = dynamic(() => import("./map-view"), { ssr: false });

export type TrackMode = "flat" | "heatmap";

export interface RaceMapProps {
  positions: Position[] | null;
  race: RaceDetail | null;
  legs?: { latitude: number; longitude: number; markName: string }[];
  startLine?: { pin?: { lat: number; lon: number }; boat?: { lat: number; lon: number } };
  playbackPosition?: { lat: number; lon: number; cog: number } | null;
  preRacePositions?: Position[] | null;
  trackMode?: TrackMode;
  /** Positions within the selected time window — rendered as a highlighted overlay on the track. */
  windowPositions?: Position[] | null;
  /** Boat length in metres from the assigned boat class — used to scale the playback icon. Defaults to 11 m when not provided. */
  boatLengthMeters?: number | null;
  /** When true, the map container fills the full height of its flex parent. */
  fill?: boolean;
}

export function RaceMap(props: RaceMapProps) {
  const { fill = false } = props;
  const [trackMode, setTrackMode] = useState<TrackMode>(props.trackMode ?? "flat");
  const [openSeaMap, setOpenSeaMap] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [fitTick, setFitTick] = useState(0);

  if (!props.positions) return <SkeletonLoader className="h-96" />;

  const sizeClass = fill ? "h-[28rem] lg:h-full w-full" : "h-[28rem]";

  return (
    <div className={`relative overflow-hidden rounded-lg ring-1 ring-border-default ${sizeClass}`}>
      <MapView
        {...props}
        trackMode={trackMode}
        openSeaMap={openSeaMap}
        followMode={followMode}
        onExitFollow={() => setFollowMode(false)}
        fitTick={fitTick}
      />
      <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex overflow-hidden rounded-md ring-1 ring-border-default">
          {(["flat", "heatmap"] as TrackMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setTrackMode(mode)}
              className={`px-2 py-1 text-xs transition-colors ${
                trackMode === mode
                  ? "bg-action-primary text-white"
                  : "bg-bg-elevated/95 text-text-primary hover:bg-bg-elevated"
              }`}
            >
              {mode === "flat" ? "Flat" : "Heatmap"}
            </button>
          ))}
        </div>
        <label className="pointer-events-auto flex items-center gap-1 rounded-md bg-bg-elevated/95 px-2 py-1 text-xs ring-1 ring-border-default">
          <input type="checkbox" checked={openSeaMap} onChange={(e) => setOpenSeaMap(e.target.checked)} />
          OpenSeaMap
        </label>
        <button
          onClick={() => setFollowMode((v) => !v)}
          className={`pointer-events-auto rounded-md p-2 ring-1 ring-border-default hover:bg-bg-base ${
            followMode
              ? "bg-accent text-white ring-accent"
              : "bg-bg-elevated/95 text-text-primary"
          }`}
          title={followMode ? "Following boat (click to stop)" : "Follow boat"}
        >
          <Crosshair className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setFollowMode(false); setFitTick((v) => v + 1); }}
          className="pointer-events-auto rounded-md bg-bg-elevated/95 p-2 text-text-primary ring-1 ring-border-default hover:bg-bg-base"
          title="Fit track to map"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-bg-elevated/95 px-2 py-1 text-xs ring-1 ring-border-default">
        N <span className="text-red-500">↑</span>
      </div>
    </div>
  );
}
