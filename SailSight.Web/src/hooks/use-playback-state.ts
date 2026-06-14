import { useMemo } from "react";
import { NormalizedPosition } from "@/lib/schemas";
import { findNearestIndex, interpolatePosition, InterpolatedPosition } from "@/lib/track-utils";
import { useRaceViewerStore } from "@/store/race-viewer";

export interface PlaybackState {
  currentPos: NormalizedPosition | null;
  playbackArrow: (InterpolatedPosition & { cogDeg: number }) | null;
  targetMs: number;
}

export function usePlaybackState(positions: NormalizedPosition[] | null, startMs: number): PlaybackState {
  const position = useRaceViewerStore((s) => s.position);
  const raceStartOffset = useRaceViewerStore((s) => s.raceStartOffset);

  const targetMs = useMemo(() => {
    return startMs + (position - raceStartOffset) * 1000;
  }, [startMs, position, raceStartOffset]);

  const state = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { currentPos: null, playbackArrow: null, targetMs };
    }

    const idx = findNearestIndex(positions, targetMs);
    const currentPos = idx !== -1 ? positions[idx] : null;

    const interp = interpolatePosition(positions, targetMs);
    const playbackArrow = interp
      ? { ...interp, cogDeg: (interp.cog * 180) / Math.PI }
      : null;

    return { currentPos, playbackArrow, targetMs };
  }, [positions, targetMs]);

  return state;
}
