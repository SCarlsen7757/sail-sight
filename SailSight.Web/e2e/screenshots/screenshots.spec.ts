import path from "node:path";
import { devices, type Page } from "@playwright/test";
import { repoRoot } from "../config";
import type { SeedIds } from "../seed/scenario";
import { authFile, expect, publicSession, stubMapTiles, test, type SignedInRole } from "../support/fixtures";

// Documentation screenshots: docs/screenshots/<theme>/<viewport>/<page>.png
// Set SCREENSHOT_DIR to write elsewhere (CI uploads them as an artifact instead of committing).
const outputDir = process.env.SCREENSHOT_DIR ? path.resolve(process.env.SCREENSHOT_DIR) : path.join(repoRoot, "docs", "screenshots");

const { viewport: pixel7Viewport, userAgent: pixel7UserAgent } = devices["Pixel 7"];
const viewports = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { viewport: pixel7Viewport, userAgent: pixel7UserAgent, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
} as const;
const themes = ["light", "dark"] as const;

interface Shot {
  name: string;
  role: SignedInRole | "anonymous";
  path: (seed: SeedIds) => string;
  ready: (page: Page) => Promise<void>;
  fullPage?: boolean;
}

const heading = (name: string) => async (page: Page) => {
  await expect(page.getByRole("heading", { name, exact: true }).first()).toBeVisible();
};

/** Waits until every Leaflet tile has loaded. */
async function tilesLoaded(page: Page) {
  await expect(page.locator(".leaflet-container").first()).toBeVisible();
  await page.waitForFunction(() => {
    const tiles = document.querySelectorAll(".leaflet-tile");
    return tiles.length > 0 && document.querySelectorAll(".leaflet-tile:not(.leaflet-tile-loaded)").length === 0;
  }, undefined, { timeout: 30_000 });
}

/**
 * Grows the viewport to the whole document. Playwright's fullPage capture keeps fixed elements (the mobile
 * tab bar) at their position in the original viewport, which leaves them floating mid-image.
 */
async function expandViewportToContent(page: Page) {
  const { width } = page.viewportSize()!;
  for (let attempt = 0; attempt < 3; attempt++) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    if (height === page.viewportSize()!.height) break;
    await page.setViewportSize({ width, height });
    await page.waitForLoadState("networkidle");
  }
  if (await page.locator(".leaflet-container").count()) await tilesLoaded(page);
}

/** Moves playback part-way through the race and shows the gauges. */
async function midRace(page: Page) {
  await expect(page.getByRole("heading", { name: "Race 1" })).toBeVisible();
  const scrubber = page.getByLabel("Playback position");
  const max = Number(await scrubber.getAttribute("max"));
  await scrubber.fill(String(Math.round(max * 0.45)));
  const showGauges = page.getByRole("button", { name: "Show gauges" });
  if (await showGauges.isVisible()) await showGauges.click();
  await tilesLoaded(page);
  await page.waitForTimeout(1500); // let ECharts finish its entry animation
}

const shots: Shot[] = [
  { name: "login", role: "anonymous", path: () => "/login", ready: heading("Sign in") },
  { name: "home", role: "admin", path: () => "/", ready: heading("My stats") },
  { name: "sessions", role: "admin", path: () => "/sessions", ready: async page => {
    await expect(page.getByRole("link", { name: /^View session / }).first()).toBeVisible();
  } },
  { name: "session-detail", role: "admin", path: seed => `/sessions/${publicSession(seed).id}`, ready: heading("Races"), fullPage: true },
  { name: "race-viewer", role: "admin", path: seed => `/races/${publicSession(seed).raceIds[0]}`, ready: midRace },
  { name: "public-race", role: "anonymous", path: seed => `/r/${publicSession(seed).raceIds[0]}`, ready: midRace },
  { name: "race-viewer-heading", role: "admin", path: seed => `/races/${publicSession(seed).raceIds[0]}`, ready: async page => {
    await midRace(page);
    await page.getByRole("checkbox", { name: "Show heading" }).check();
  } },
  { name: "race-viewer-compact", role: "admin", path: seed => `/races/${publicSession(seed).raceIds[0]}`, ready: async page => {
    await midRace(page);
    await page.getByRole("button", { name: "Hide charts" }).click();
  } },
  { name: "session-viewer", role: "admin", path: seed => `/sessions/${publicSession(seed).id}/viewer`, ready: async page => {
    await heading("Viewer")(page);
    await page.getByRole("button", { name: "Show gauges" }).click();
    await tilesLoaded(page);
    await expect(page.getByRole("checkbox", { name: "Show heading" })).toBeVisible();
  } },
  { name: "boats", role: "admin", path: () => "/boats", ready: heading("Fleet") },
  { name: "courses", role: "admin", path: () => "/courses", ready: heading("Courses") },
  { name: "marks", role: "admin", path: () => "/marks", ready: heading("Marks") },
  { name: "teams", role: "admin", path: seed => `/teams/${seed.teamId}`, ready: async page => {
    await heading("Members")(page);
    await expect(page.getByRole("heading", { name: "Pending invitations" })).toBeVisible();
  }, fullPage: true },
  { name: "admin-users", role: "admin", path: () => "/admin/users", ready: heading("User management"), fullPage: true },
  { name: "upload", role: "admin", path: () => "/upload", ready: heading("Upload session") },
];

for (const theme of themes) {
  for (const [viewportName, device] of Object.entries(viewports)) {
    test.describe(`${theme} ${viewportName}`, () => {
      for (const shot of shots) {
        test(shot.name, async ({ browser, seed }) => {
          const context = await browser.newContext({
            ...device,
            colorScheme: theme,
            locale: "en-GB",
            timezoneId: "Europe/Copenhagen",
            baseURL: seed.baseUrl,
            storageState: shot.role === "anonymous" ? undefined : authFile(shot.role),
          });
          await stubMapTiles(context);
          await context.addInitScript(value => window.localStorage.setItem("theme", value), theme);
          const page = await context.newPage();

          await page.goto(shot.path(seed));
          await shot.ready(page);
          // The login background is an animated, randomised canvas.
          if (shot.name === "login") await page.addStyleTag({ content: "canvas.pointer-events-none { visibility: hidden !important; }" });
          await page.waitForLoadState("networkidle");
          if (shot.fullPage || (viewportName === "mobile" && /race|viewer/.test(shot.name))) await expandViewportToContent(page);

          await page.screenshot({
            path: path.join(outputDir, theme, viewportName, `${shot.name}.png`),
            animations: "disabled",
            caret: "hide",
          });
          await context.close();
        });
      }
    });
  }
}
