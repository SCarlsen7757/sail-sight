import { authFile, expect, publicSession, test } from "../support/fixtures";

test.use({ storageState: authFile("admin") });

test.describe("race viewer", () => {
  test.beforeEach(async ({ page, seed }) => {
    await page.goto(`/races/${publicSession(seed).raceIds[0]}`);
    await expect(page.getByRole("heading", { name: "Race 1" })).toBeVisible();
  });

  test("draws the track on the map", async ({ page }) => {
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-overlay-pane path").first()).toBeAttached();
  });

  test("plays back and pauses", async ({ page }) => {
    const scrubber = page.getByLabel("Playback position");
    const start = Number(await scrubber.inputValue());

    await page.getByLabel("Playback speed").selectOption("32");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThan(start + 5);

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("scrubbing updates the gauges", async ({ page }) => {
    const scrubber = page.getByLabel("Playback position");
    const max = Number(await scrubber.getAttribute("max"));
    await scrubber.fill(String(Math.round(max * 0.4)));
    await page.getByRole("button", { name: "Show gauges" }).click();

    await expect(page.getByText("SOG", { exact: true })).toBeVisible();
    await expect(page.getByText("Heading", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Heading reading", { exact: true })).toBeVisible();
    await expect(page.getByLabel("COG reading", { exact: true })).toBeVisible();
  });

  test("shows charts and can hide them", async ({ page }) => {
    await expect(page.getByText("Chart time window")).toBeVisible();
    await expect(page.getByLabel("Window start")).toBeVisible();

    await page.getByRole("button", { name: "Hide charts" }).click();
    await expect(page.getByText("Chart time window")).toBeHidden();
    await page.getByRole("button", { name: "Show charts" }).click();
    await expect(page.getByText("Chart time window")).toBeVisible();
  });

  test("toggles the gauges", async ({ page }) => {
    await expect(page.getByText("SOG", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Show gauges" }).click();
    await expect(page.getByText("SOG", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hide gauges" }).click();
    await expect(page.getByText("SOG", { exact: true })).toBeHidden();
  });
});
