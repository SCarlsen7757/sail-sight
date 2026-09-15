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
    const signedInCookies = await page.context().cookies();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect((await page.request.get("/api/v1/me")).status()).toBe(401);

    // A response that was in flight during logout can still hand the old cookie back (#25); it must stay revoked.
    await page.context().addCookies(signedInCookies);
    expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  });

  test("signed-in pages send anonymous visitors to public sessions", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/sessions$/);
    await expect(page.getByRole("button", { name: "My Sessions" })).toHaveCount(0);
  });
});
