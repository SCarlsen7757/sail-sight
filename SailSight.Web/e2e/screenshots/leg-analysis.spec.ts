import path from 'node:path';
import { repoRoot } from '../config';
import { analysisScenario } from '../support/analysis-scenario';
import { authFile, stubMapTiles, test, expect } from '../support/fixtures';

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of ['desktop', 'mobile'] as const) {
    test(`leg-analysis ${theme} ${viewport}`, async ({ browser, apiAs }) => {
      const scenario = await analysisScenario(await apiAs('admin'), { name: 'Recorded gate analysis', start: Date.parse('2026-09-01T10:00:00Z') });
      const context = await browser.newContext({ storageState: authFile('admin'), colorScheme: theme,
        viewport: { width: viewport === 'desktop' ? 1440 : 412, height: 900 } });
      try {
        await stubMapTiles(context);
        await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
        const page = await context.newPage();
        await page.goto(`/races/${scenario.raceId}`);
        await expect(page.getByRole('button', { name: 'Replay Gate 2' })).toBeVisible();
        await page.getByLabel('Playback position').fill('15');
        await expect(page.getByLabel('Playback target')).toHaveText('Gate 1');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500); // Leaflet follow animation and ECharts initial render.
        if (viewport === 'mobile') {
          for (let i = 0; i < 3; i++) {
            const height = await page.evaluate(() => document.documentElement.scrollHeight);
            if (height === page.viewportSize()!.height) break;
            await page.setViewportSize({ width: 412, height });
            await page.waitForLoadState('networkidle');
          }
        }
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR ?? path.join(repoRoot, 'docs/screenshots'), theme, viewport, 'leg-analysis.png'), animations: 'disabled' });
      } finally { await context.close(); await scenario.cleanup(); }
    });
  }
}
