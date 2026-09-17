"use client";

import { useEffect, useState } from "react";

/** Public configuration resolved by the server at request time — see app/api/config/route.ts. */
export interface RuntimeConfig {
  cartoApiKey: string | null;
}

export interface RuntimeConfigState extends RuntimeConfig {
  /** False until the fetch settles. Callers gate on this rather than on a null key. */
  loaded: boolean;
}

const EMPTY: RuntimeConfig = { cartoApiKey: null };

// Cached so the endpoint is hit at most once per page load no matter how many
// components ask. Created lazily inside the effect — never at module scope —
// because consumers are server-rendered, and a relative fetch throws on the server.
let cached: Promise<RuntimeConfig> | null = null;

function loadConfig(): Promise<RuntimeConfig> {
  cached ??= fetch("/api/config", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<RuntimeConfig>) : EMPTY))
    // Config is cosmetic; a failure degrades to unkeyed tiles rather than breaking the map.
    .catch(() => EMPTY);
  return cached;
}

/**
 * Reads public runtime configuration. Initial state is identical on server and
 * client so hydration matches; the value arrives on the first client effect.
 */
export function useRuntimeConfig(): RuntimeConfigState {
  const [state, setState] = useState<RuntimeConfigState>({ ...EMPTY, loaded: false });

  useEffect(() => {
    let active = true;
    loadConfig().then((config) => {
      if (active) setState({ ...config, loaded: true });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
