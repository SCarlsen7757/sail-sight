import { analysisScenario } from '../support/analysis-scenario';
import { authFile, test, expect } from '../support/fixtures';

test.use({ storageState: authFile('admin') });

test('recorded gate replay synchronizes selection, readout, chart, and completion', async ({ page, apiAs }) => {
  const scenario = await analysisScenario(await apiAs('admin'));
  try {
    await page.goto(`/races/${scenario.raceId}`);
    await expect(page.getByRole('heading', { name: 'Leg analysis', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Replay Gate 2' })).toBeVisible();
    const scrubber = page.getByLabel('Playback position');
    await scrubber.fill('5'); // Five seconds before the recorded start gun.
    await expect(page.getByLabel('VMG to target reading')).toHaveText('\u2014');
    await scrubber.fill('15');
    await expect(page.getByLabel('VMG to target reading')).toHaveText('1.94 kn');
    await expect(page.getByLabel('Playback target')).toHaveText('Gate 1');
    await expect(page.getByText('VMG to gate midpoint', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Recorded VMG to target chart' })).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Replay Gate 2' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.getByLabel('Playback target')).toHaveText('Gate 2');
    await expect(page.getByRole('button', { name: 'Replay Gate 2' })).toHaveAttribute('aria-current', 'step');
    await scrubber.fill('60');
    await expect(page.getByLabel('VMG to target reading')).toHaveText('\u2014');
    await page.getByRole('button', { name: 'Hide charts' }).click();
    await expect(page.getByRole('img', { name: 'Recorded VMG to target chart' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Leg analysis', exact: true })).toBeVisible();
  } finally { await scenario.cleanup(); }
});

test('public replay supports mobile and analysis failure leaves the track available', async ({ page, apiAs }) => {
  const api = await apiAs('admin'), scenario = await analysisScenario(api);
  try {
    await api.patch(`/api/v1/sessions/${scenario.sessionId}`, { data: { isPublic: true } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/r/${scenario.raceId}`);
    await expect(page.getByRole('button', { name: 'Replay Gate 1' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.route('**/api/v1/performance/legs?*', route => route.fulfill({ status: 503 }));
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load leg analysis' })).toContainText('Could not load leg analysis');
    await expect(page.locator('.leaflet-container')).toBeVisible();
  } finally { await scenario.cleanup(); }
});
