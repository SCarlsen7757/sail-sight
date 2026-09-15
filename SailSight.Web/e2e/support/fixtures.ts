import { readFileSync } from "node:fs";
import path from "node:path";
import { type APIRequestContext, type BrowserContext, test as base } from "@playwright/test";
import { authDir, baseUrl, fixturesDir, seedIdsFile } from "../config";
import type { SeedIds } from "../seed/scenario";

export { expect } from "@playwright/test";

export type SignedInRole = "admin" | "skipper";

export const authFile = (role: SignedInRole) => path.join(authDir, `${role}.json`);
export const fixtureFile = (name: string) => path.join(fixturesDir, name);

const origin = new URL(baseUrl).origin;
// A 1×1 grey PNG. Leaflet stretches it over each tile, so maps render without network access.
const STUB_TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC", "base64");
const TILE_HOSTS = /basemaps\.cartocdn\.com|tile\.openstreetmap\.org|tiles\.openseamap\.org/;

/** Adds the Origin and X-CSRF-Token headers the API requires for mutating requests. */
async function withApiHeaders(context: APIRequestContext): Promise<APIRequestContext> {
  const { cookies } = await context.storageState();
  let csrf = cookies.find(c => c.name === "sailsight.csrf")?.value;
  if (!csrf) {
    await context.get("/api/v1/auth/providers");
    csrf = (await context.storageState()).cookies.find(c => c.name === "sailsight.csrf")?.value;
  }
  const headers = { Origin: origin, "X-CSRF-Token": decodeURIComponent(csrf ?? "") };
  const wrap = (method: "post" | "put" | "patch" | "delete") =>
    (url: string, options: Parameters<APIRequestContext["post"]>[1] = {}) =>
      context[method](url, { ...options, headers: { ...headers, ...options.headers } });
  return Object.assign(Object.create(context), { post: wrap("post"), put: wrap("put"), patch: wrap("patch"), delete: wrap("delete") });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
}

interface Fixtures {
  seed: SeedIds;
  stubTiles: void;
  /** An API request context signed in as a seeded user, with Origin and CSRF headers. */
  apiAs: (role: SignedInRole) => Promise<APIRequestContext>;
  /** Creates a throwaway account through the admin API (deleted after the test, best effort). */
  createUser: (label: string) => Promise<TestUser>;
  /** A browser context signed in as a throwaway user. */
  signedInContext: (user: TestUser) => Promise<BrowserContext>;
}

export const test = base.extend<Fixtures>({
  seed: async ({}, use) => {
    await use(JSON.parse(readFileSync(seedIdsFile, "utf8")) as SeedIds);
  },

  stubTiles: [async ({ context }, use) => {
    await context.route(TILE_HOSTS, route => route.fulfill({ contentType: "image/png", body: STUB_TILE }));
    await use();
  }, { auto: true }],

  apiAs: async ({ playwright }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async role => {
      const context = await playwright.request.newContext({ baseURL: baseUrl, storageState: authFile(role) });
      contexts.push(context);
      return withApiHeaders(context);
    });
    await Promise.all(contexts.map(c => c.dispose()));
  },

  createUser: async ({ playwright, apiAs }, use) => {
    const created: TestUser[] = [];
    const admin = await apiAs("admin");
    await use(async label => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const user = { email: `${label}-${unique}@e2e.local`, displayName: `E2E ${label}`, password: "e2e-Throwaway-Password-1", id: "" };
      const response = await admin.post("/api/v1/admin/users", { data: { email: user.email, displayName: user.displayName, role: null } });
      if (!response.ok()) throw new Error(`Creating ${user.email} failed: ${response.status()} ${await response.text()}`);
      const setup = new URL((await response.json()).setupUrl).searchParams;
      user.id = setup.get("userId")!;

      const anonymous = await playwright.request.newContext({ baseURL: baseUrl, extraHTTPHeaders: { Origin: origin } });
      const complete = await anonymous.post("/api/v1/auth/setup/complete", {
        data: { userId: user.id, token: setup.get("token"), password: user.password },
      });
      await anonymous.dispose();
      if (!complete.ok()) throw new Error(`Completing setup for ${user.email} failed: ${complete.status()}`);
      created.push(user);
      return user;
    });
    // Accounts that still own data return 409 and are left behind; E2E databases are disposable.
    for (const user of created) await admin.delete(`/api/v1/admin/users/${user.id}`);
  },

  signedInContext: async ({ browser, playwright }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async user => {
      const api = await playwright.request.newContext({ baseURL: baseUrl, extraHTTPHeaders: { Origin: origin } });
      await api.get("/api/v1/auth/providers");
      const login = await api.post("/api/v1/auth/login", { data: { email: user.email, password: user.password } });
      if (!login.ok()) throw new Error(`Signing in as ${user.email} failed: ${login.status()}`);
      const context = await browser.newContext({ storageState: await api.storageState() });
      await api.dispose();
      await context.route(TILE_HOSTS, route => route.fulfill({ contentType: "image/png", body: STUB_TILE }));
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map(c => c.close()));
  },
});

/** Seeded session helpers. */
export const publicSession = (seed: SeedIds) => {
  const session = seed.sessions.find(s => s.isPublic);
  if (!session?.raceIds.length) throw new Error("The seed has no public session with races.");
  return session;
};
export const teamSession = (seed: SeedIds) => {
  const session = seed.sessions.find(s => s.sharedWithTeam);
  if (!session) throw new Error("The seed has no team-shared session.");
  return session;
};
