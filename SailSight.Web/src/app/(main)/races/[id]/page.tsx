"use client";

import { use } from "react";
import { RaceReplay } from "@/components/race-viewer/race-replay";

export default function RaceViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RaceReplay key={id} raceId={id} />;
}
