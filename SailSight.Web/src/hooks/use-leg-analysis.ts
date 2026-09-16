"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { LegPerformance } from '@/lib/leg-analysis';

export function useLegAnalysis(raceId: string, courseId: string | null | undefined) {
  const [state, setState] = useState<{ raceId: string; courseId: string; legs: LegPerformance[]; loading: boolean; error: string | null }>({ raceId: '', courseId: '', legs: [], loading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    if (!courseId) return () => controller.abort();
    api.GET('/api/v1/performance/legs', { params: { query: { raceId } }, signal: controller.signal })
      .then(({ data, response }) => {
        if (!response.ok || !data) throw new Error('Could not load leg analysis. Reload this race to retry.');
        if (!controller.signal.aborted) setState({ raceId, courseId, legs: data, loading: false, error: null });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ raceId, courseId, legs: [], loading: false, error: error instanceof Error ? error.message : 'Could not load leg analysis.' });
      });
    return () => controller.abort();
  }, [raceId, courseId]);
  if (!courseId) return { legs: [], loading: false, error: null };
  return state.raceId === raceId && state.courseId === courseId ? state : { legs: [], loading: true, error: null };
}
