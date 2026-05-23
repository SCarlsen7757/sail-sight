"use client";

import * as Slider from "@radix-ui/react-slider";
import { useRaceViewerStore } from "@/store/race-viewer";
import { formatSignedClock } from "@/lib/units";

interface Props {
  /** Seconds offset from data-start to race-start signal (i.e. countdown duration). */
  raceStartOffset: number;
}

export function TimeWindowSlicer({ raceStartOffset }: Props) {
  const { windowStart, windowEnd, duration, setWindow } = useRaceViewerStore();

  const startLabel = formatSignedClock(windowStart - raceStartOffset);
  const endLabel = formatSignedClock(windowEnd - raceStartOffset);

  return (
    <div className="rounded-lg bg-bg-surface p-3 ring-1 ring-border-default">
      <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
        <span className="font-medium text-text-primary">Chart time window</span>
        <span className="font-mono">
          {startLabel} – {endLabel}
        </span>
      </div>
      <Slider.Root
        className="relative flex w-full touch-none select-none items-center"
        min={0}
        max={duration}
        step={1}
        value={[windowStart, windowEnd]}
        onValueChange={([start, end]) => setWindow(start, end)}
        minStepsBetweenThumbs={1}
      >
        <Slider.Track className="relative h-2 w-full grow rounded-full bg-bg-elevated">
          <Slider.Range className="absolute h-full rounded-full bg-warning opacity-80" />
        </Slider.Track>
        <Slider.Thumb
          className="block h-4 w-4 rounded-full border border-border-default bg-bg-surface shadow ring-warning focus:outline-none focus:ring-2"
          aria-label="Window start"
        />
        <Slider.Thumb
          className="block h-4 w-4 rounded-full border border-border-default bg-bg-surface shadow ring-warning focus:outline-none focus:ring-2"
          aria-label="Window end"
        />
      </Slider.Root>
      <div className="mt-1 flex justify-between text-[10px] text-text-secondary">
        <span>Start of data</span>
        <span>End of data</span>
      </div>
    </div>
  );
}
