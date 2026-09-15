import { authFile, expect, publicSession, test } from "../support/fixtures";

test.use({ storageState: authFile("admin") });

test("sessions list leads to session detail and a race", async ({ page, seed }) => {
  const session = publicSession(seed);

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
  await page.getByRole("button", { name: "My Sessions" }).click();
  await page.getByRole("link", { name: `View session ${session.displayName}` }).click();

  await expect(page).toHaveURL(`/sessions/${session.id}`);
  await expect(page.getByRole("heading", { name: "Session metadata" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sharing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Races" })).toBeVisible();

  await page.getByRole("link", { name: "View race 1" }).click();
  await expect(page).toHaveURL(`/races/${session.raceIds[0]}`);
  await expect(page.getByRole("heading", { name: "Race 1" })).toBeVisible();
});
