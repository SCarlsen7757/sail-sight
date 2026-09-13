"use client";

import { useEffect, useState } from "react";
import type {
  SpeedUnit,
  WindUnit,
  DistanceUnit,
} from "@/lib/units";

const KEY = "sailsight.units";

export interface UnitPrefs {
  boatSpeed: SpeedUnit;
  wind: WindUnit;
  course: DistanceUnit;
}

export const DEFAULT_PREFS: UnitPrefs = {
  boatSpeed: "kts",
  wind: "kts",
  course: "nm",
};

function read(): UnitPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) } as UnitPrefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useUnitPrefs() {
  const [prefs, setPrefs] = useState<UnitPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPrefs(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = (next: Partial<UnitPrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    window.localStorage.setItem(KEY, JSON.stringify(merged));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(merged) }));
  };

  const reset = () => {
    setPrefs(DEFAULT_PREFS);
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: null }));
  };

  return { prefs, update, reset };
}
