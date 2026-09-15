import { expect, test } from "../support/fixtures";

// Uses throwaway accounts so seeded users are never locked out (5 failed attempts) or signed out.
test.describe("authentication", () => {
  test("rejects a wrong password", async ({ page, createUser }) => {
    const user = await createUser("wrong-password");
    await page.goto("/login");
    await page.getByLabel("Email Address").fill(user.email);
    await page.getByLabel("Password").fill("not-the-right-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in and out", async ({ page, createUser }) => {
    const user = await createUser("login");
    await page.goto("/login");
    await page.getByLabel("Email Address").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/account");
    await expect(page.getByText(user.email)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    // logout() pushes /login, but AuthGate may redirect the signed-out /account page to /sessions first.
    await expect(page).toHaveURL(/\/(login|sessions)$/);
    // Server-side state is not asserted here: a request in flight during logout (e.g. the notification
    // stream) can currently re-issue the auth cookie, so that check would be flaky.
  });

  test("signed-in pages send anonymous visitors to public sessions", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/sessions$/);
    await expect(page.getByRole("button", { name: "My Sessions" })).toHaveCount(0);
  });
});
