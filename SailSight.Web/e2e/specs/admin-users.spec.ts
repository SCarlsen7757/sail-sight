import { seedUsers } from "../seed/users";
import { authFile, expect, test } from "../support/fixtures";

test.describe("as admin", () => {
  test.use({ storageState: authFile("admin") });

  test("lists users and creates one with a setup link", async ({ page, apiAs }) => {
    const email = `admin-created-${Date.now()}@e2e.local`;

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User management" })).toBeVisible();
    await expect(page.getByText(seedUsers.skipper.email)).toBeVisible();

    await page.getByPlaceholder("Email", { exact: true }).fill(email);
    await page.getByPlaceholder("Display name").fill("Created In Test");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText("Share this one-time setup URL with the new user:")).toBeVisible();
    await expect(page.locator("code", { hasText: "/setup?userId=" })).toBeVisible();
    await expect(page.getByText(`${email} · User · pending setup`)).toBeVisible();

    const api = await apiAs("admin");
    const users: { id: string; email: string }[] = await (await api.get("/api/v1/admin/users")).json();
    const created = users.find(u => u.email === email);
    if (created) await api.delete(`/api/v1/admin/users/${created.id}`);
  });
});

test.describe("as a regular user", () => {
  test.use({ storageState: authFile("skipper") });

  test("is sent away from admin pages", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "User management" })).toHaveCount(0);
  });
});
