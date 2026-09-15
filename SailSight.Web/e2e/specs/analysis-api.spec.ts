import { analysisScenario } from '../support/analysis-scenario';
import { test, expect } from '../support/fixtures';

test('analysis persists, recalculates, authorizes, and clears against PostgreSQL', async ({ apiAs, playwright, seed }) => {
  const api = await apiAs('admin');
  const scenario = await analysisScenario(api);
  const anonymous = await playwright.request.newContext();
  try {
    const detail = await (await api.get(scenario.raceUrl)).json();
    expect(detail.analysisStatus).toBe('Completed');
    const legs = await scenario.legs();
    expect(legs.map((l: { status: string }) => l.status)).toEqual(['Completed', 'Completed']);
    expect(Number(legs[0].averageSpeedOverGround)).toBeCloseTo(1);
    expect(Number(legs[0].sailedDistanceMeters)).toBeCloseTo(20, 1);
    expect(Number(legs[1].sailedDistanceMeters)).toBeCloseTo(20, 1);
    const url = (await api.get(`/api/v1/performance/legs?raceId=${scenario.raceId}`)).url();
    expect((await anonymous.get(url)).status()).toBe(404);
    const teammate = await apiAs('skipper');
    expect((await teammate.get(url)).status()).toBe(404);
    expect((await api.put(`/api/v1/sessions/${scenario.sessionId}/shares`, { data: { teamId: seed.teamId } })).ok()).toBeTruthy();
    expect((await teammate.get(url)).status()).toBe(200);
    expect((await api.patch(`/api/v1/sessions/${scenario.sessionId}`, { data: { isPublic: true } })).ok()).toBeTruthy();
    expect((await anonymous.get(url)).status()).toBe(200);
    expect((await api.put(`/api/v1/courses/${scenario.courseId}`, { data: scenario.body })).ok()).toBeTruthy();
    expect((await scenario.legs()).length).toBe(2);
    expect((await api.patch(scenario.raceUrl, { data: { courseId: '00000000-0000-0000-0000-000000000000' } })).ok()).toBeTruthy();
    expect(await scenario.legs()).toEqual([]);
    expect((await api.patch(scenario.raceUrl, { data: { courseId: scenario.courseId } })).ok()).toBeTruthy();
    expect((await scenario.legs()).length).toBe(2);
    expect((await api.delete(`/api/v1/courses/${scenario.courseId}`)).ok()).toBeTruthy();
    expect(await scenario.legs()).toEqual([]);
    expect((await (await api.get(scenario.raceUrl)).json()).analysisStatus).toBe('Incomplete');
  } finally { await anonymous.dispose(); await scenario.cleanup(); }
});
