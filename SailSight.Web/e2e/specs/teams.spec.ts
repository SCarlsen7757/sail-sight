import { TEAM_NAME, seedUsers } from "../seed/users";
import { authFile, expect, test } from "../support/fixtures";

test.use({ storageState: authFile("admin") });

test("seeded team shows members and the pending invite", async ({ page }) => {
  await page.goto("/teams");
  await page.getByRole("link", { name: TEAM_NAME, exact: true }).click();

  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await expect(page.getByText(seedUsers.skipper.displayName)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending invitations" })).toBeVisible();
  await expect(page.getByText(seedUsers.crew.displayName)).toBeVisible();
});

test("creates a team", async ({ page, apiAs }) => {
  const name = `E2E temp team ${Date.now()}`;
  await page.goto("/teams");
  await page.getByPlaceholder("New team name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();

  const api = await apiAs("admin");
  const teams: { id: string; name: string }[] = await (await api.get("/api/v1/teams")).json();
  for (const team of teams.filter(t => t.name === name)) await api.delete(`/api/v1/teams/${team.id}`);
});
