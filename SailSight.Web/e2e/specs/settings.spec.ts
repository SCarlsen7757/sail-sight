import { authFile, expect, publicSession, test } from "../support/fixtures";

test.use({ storageState: authFile("admin") });

test("boat speed unit applies to the race viewer", async ({ page, seed }) => {
  const racePath = `/races/${publicSession(seed).raceIds[0]}`;
  // The gauge card is the parent of its "SOG" label.
  const sogGauge = page.getByText("SOG", { exact: true }).locator("..");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Unit preferences" })).toBeVisible();
  await page.getByLabel("Boat speed").selectOption("kmh");

  await page.goto(racePath);
  await page.getByRole("button", { name: "Show gauges" }).click();
  await expect(sogGauge).toContainText("km/h");

  await page.goto("/settings");
  await expect(page.getByLabel("Boat speed")).toHaveValue("kmh");
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.getByLabel("Boat speed")).toHaveValue("kts");

  await page.goto(racePath);
  await page.getByRole("button", { name: "Show gauges" }).click();
  await expect(sogGauge).toContainText("kn");
});
