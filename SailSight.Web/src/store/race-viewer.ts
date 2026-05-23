"use client";

import { create } from "zustand";

interface RaceViewerState {
  showGauges: boolean;
  showCharts: boolean;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;
  // playback position in seconds, relative to data start (negative elapsed = pre-race)
  position: number;
  // window slicer (seconds, relative to data start)
  windowStart: number;
  windowEnd: number;
  // total race duration (s)
  duration: number;
  raceStartOffset: number; // seconds from race "first sample" to start signal

  setShowGauges: (v: boolean) => void;
  setShowCharts: (v: boolean) => void;
  togglePlay: () => void;
  setSpeed: (s: 0.5 | 1 | 2 | 4) => void;
  setPosition: (p: number) => void;
  setWindow: (start: number, end: number) => void;
  setDuration: (d: number) => void;
  setRaceStartOffset: (s: number) => void;
}

export const useRaceViewerStore = create<RaceViewerState>((set) => ({
  showGauges: false,
  showCharts: true,
  isPlaying: false,
  speed: 1,
  position: 0,
  windowStart: 0,
  windowEnd: 0,
  duration: 0,
  raceStartOffset: 0,

  setShowGauges: (v) => set({ showGauges: v }),
  setShowCharts: (v) => set({ showCharts: v }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (s) => set({ speed: s }),
  setPosition: (p) => set({ position: p }),
  setWindow: (start, end) => set({ windowStart: start, windowEnd: end }),
  setDuration: (d) => set({ duration: d, windowEnd: d }),
  setRaceStartOffset: (s) => set({ raceStartOffset: s }),
}));
