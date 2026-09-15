import { authFile, expect, publicSession, test } from "../support/fixtures";

test.use({ storageState: authFile("admin") });

test("compass stays centred at cardinal points during forward and backward scrubbing", async ({ page, seed }) => {
  const id = publicSession(seed).raceIds[0];
  const race = await (await page.request.get(`/api/v1/races/${id}`)).json();
  const start = new Date(race.startedAt).getTime() - Number(race.countdownDurationSeconds ?? 0) * 1000;
  await page.route(/\/telemetry\/positions(?:\?|$)/, async route => {
    const response = await route.fetch();
    const [sample] = await response.json();
    const positions = [0, 90, 180, 270, 0].map((heading, i) => ({
      ...sample, time: new Date(start + i * 1000).toISOString(), courseOverGround: heading * Math.PI / 180,
      quaternionW: Math.cos(heading * Math.PI / 360), quaternionX: 0, quaternionY: 0,
      quaternionZ: Math.sin(heading * Math.PI / 360),
    }));
    await route.fulfill({ response, json: positions });
  });
  await page.goto(`/races/${id}`);
  await page.getByRole("button", { name: "Show gauges" }).click();
  for (const index of [0, 1, 2, 3, 4, 3, 2, 1, 0]) {
    await page.getByLabel("Playback position").fill(String(index));
    const degrees = [0, 90, 180, 270, 0][index];
    for (const label of ["Heading", "COG"]) {
      const compass = page.getByRole("img", { name: `${label} direction: ${degrees}°` });
      await expect(compass).toBeVisible();
      const transform = await compass.locator("g[transform]").getAttribute("transform");
      expect(transform).toMatch(/^rotate\(-?\d+(?:\.\d+)? 40 40\)$/);
      const angle = Number(transform!.match(/rotate\(([-\d.]+)/)![1]);
      expect(((angle % 360) + 360) % 360).toBeCloseTo(degrees);
      await expect(compass.locator("path")).toHaveCount(1);
      await expect(compass.locator("circle, text")).toHaveCount(0);
    }
  }
});

for (const viewer of ["race", "public", "session"] as const) {
  test(`${viewer}: heading differs from COG, overlay persists, invalid orientation stays unavailable`, async ({ page, seed }) => {
    let missing = false;
    await page.route(/\/telemetry(?:\/positions)?(?:\?|$)/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const positions = Array.isArray(body) ? body : body.positions;
      if (positions) for (const p of positions) {
        p.courseOverGround = Math.PI;
        // 90° heading and 60° heel: deliberately beyond the heel indicator scale.
        p.quaternionW = missing ? 0 : Math.sqrt(3) * Math.SQRT1_2 / 2;
        p.quaternionX = missing ? 0 : Math.SQRT1_2 / 2;
        p.quaternionY = missing ? 0 : Math.SQRT1_2 / 2;
        p.quaternionZ = missing ? 0 : Math.sqrt(3) * Math.SQRT1_2 / 2;
        if (missing) p.speedOverGround = "NaN";
      }
      await route.fulfill({ response, json: body });
    });
    const session = publicSession(seed);
    const url = viewer === "session" ? `/sessions/${session.id}/viewer` : `/${viewer === "public" ? "r" : "races"}/${session.raceIds[0]}`;
    await page.goto(url);
    await page.getByRole("button", { name: "Show gauges" }).click();
    await expect(page.getByLabel("COG reading", { exact: true })).toHaveText("180°");
    await expect(page.getByLabel("Heading reading", { exact: true })).toHaveText("90°");
    await expect(page.getByLabel("Heel reading", { exact: true })).toHaveText("+60.0°");
    const compass = page.getByRole("img", { name: "Heading direction: 90°" });
    await expect(compass.locator("g[transform]")).toHaveAttribute("transform", "rotate(90 40 40)");
    await expect(page.getByRole("img", { name: "COG direction: 180°" }).locator("g[transform]")).toHaveAttribute("transform", "rotate(180 40 40)");
    const overlay = page.getByRole("checkbox", { name: "Show heading" });
    await expect(overlay).not.toBeChecked();
    await overlay.check();
    await expect(page.getByLabel("Direction chart legend")).toContainText("Heading");
    await page.getByRole("button", { name: "Hide charts" }).click();
    await expect(page.getByLabel("Heading reading", { exact: true })).toHaveText("90°");
    await page.getByRole("button", { name: "Show charts" }).click();
    await expect(overlay).toBeChecked();
    missing = true;
    await page.reload();
    await page.getByRole("button", { name: "Show gauges" }).click();
    await expect(page.getByLabel("Heading reading", { exact: true })).toHaveText("—");
    await expect(page.getByLabel("Heel reading", { exact: true })).toHaveText("—");
    await expect(page.getByLabel("Trim reading", { exact: true })).toHaveText("—");
    await expect(page.getByLabel("SOG reading", { exact: true })).toContainText("—");
    await expect(page.getByLabel("COG reading", { exact: true })).toHaveText("180°");
    await expect(page.getByRole("img", { name: "Heading direction: —" }).locator("g[transform]")).toHaveCount(0);
    await expect(overlay).not.toBeChecked();
  });
}
