import { devices } from "@playwright/test";
import { authFile, expect, test } from "../support/fixtures";

const { viewport, userAgent } = devices["Pixel 7"];
test.use({ storageState: authFile("admin"), viewport, userAgent, isMobile: true, hasTouch: true });

test("mobile tab bar fits one row and moves extra items into a More menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My stats" })).toBeVisible();

  const tabBar = page.getByRole("navigation").filter({ has: page.getByRole("button", { name: "More" }) });
  const box = await tabBar.boundingBox();
  expect(box?.height).toBeLessThan(80);
  await expect(tabBar.getByRole("link", { name: "Settings" })).toHaveCount(0);

  await tabBar.getByRole("button", { name: "More" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Settings" }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
