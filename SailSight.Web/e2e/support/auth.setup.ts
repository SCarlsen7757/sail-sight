import { existsSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { adminCredentials, baseUrl, seedIdsFile } from "../config";
import { SEED_PASSWORD, seedUsers } from "../seed/users";
import { authFile } from "./fixtures";

// Reuses the storage states written by the seeder while they are still signed in, and only signs in
// again when they have expired. This keeps logins well below the per-IP login rate limit.
const credentials = {
  admin: () => adminCredentials(),
  skipper: () => ({ email: seedUsers.skipper.email, password: SEED_PASSWORD }),
};

setup.beforeAll(() => {
  if (!existsSync(seedIdsFile)) throw new Error(`${seedIdsFile} is missing. Run "npm run seed" first.`);
});

for (const role of ["admin", "skipper"] as const) {
  setup(`authenticate as ${role}`, async ({ playwright }) => {
    const file = authFile(role);
    if (existsSync(file)) {
      const saved = await playwright.request.newContext({ baseURL: baseUrl, storageState: file });
      const me = await saved.get("/api/v1/me");
      await saved.dispose();
      if (me.ok()) return;
    }

    const context = await playwright.request.newContext({ baseURL: baseUrl, extraHTTPHeaders: { Origin: new URL(baseUrl).origin } });
    expect((await context.get("/api/v1/auth/providers")).ok()).toBe(true); // issues the CSRF cookie
    const login = await context.post("/api/v1/auth/login", { data: credentials[role]() });
    expect(login.status(), await login.text()).toBe(200);
    await context.storageState({ path: file });
    await context.dispose();
  });
}
