import { expect, publicSession, teamSession, test } from "../support/fixtures";

// No storageState: these pages are checked as an anonymous visitor.
test.describe("public pages", () => {
  test("public session links to its race and boat", async ({ page, seed }) => {
    const session = publicSession(seed);

    await page.goto(`/s/${session.id}`);
    await expect(page.getByRole("heading", { name: session.displayName })).toBeVisible();
    await expect(page.getByRole("link", { name: "Seed Admin Boat" })).toHaveAttribute("href", `/b/${session.boatId}`);

    await page.getByRole("link", { name: "View race 1" }).click();
    await expect(page).toHaveURL(`/r/${session.raceIds[0]}`);
    await expect(page.getByRole("heading", { name: "Race 1" })).toBeVisible();
    await expect(page.getByText("Evening Windward/Leeward")).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("public boat page", async ({ page, seed }) => {
    await page.goto(`/b/${publicSession(seed).boatId}`);
    await expect(page.getByText("Seed Admin Boat").first()).toBeVisible();
  });

  test("private session is not shown", async ({ page, seed }) => {
    await page.goto(`/s/${teamSession(seed).id}`);
    await expect(page.getByText("This session is not available or is private.")).toBeVisible();
  });

  test("anonymous visitors only see the public sessions tab", async ({ page, seed }) => {
    await page.goto("/sessions");
    await expect(page.getByRole("button", { name: "Public" })).toBeVisible();
    await expect(page.getByRole("button", { name: "My Sessions" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: `View session ${publicSession(seed).displayName}` })).toBeVisible();
  });
});
