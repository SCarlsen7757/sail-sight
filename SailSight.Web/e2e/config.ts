import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Shared paths and settings for the E2E stack, seeder, and Playwright suite.
export const webRoot = path.resolve(__dirname, "..");
export const repoRoot = path.resolve(webRoot, "..");
export const e2eRoot = __dirname;
export const composeEnvFile = path.join(repoRoot, ".e2e-compose.env");
export const authDir = path.join(e2eRoot, ".auth");
export const seedIdsFile = path.join(e2eRoot, ".seed", "ids.json");
export const fixturesDir = path.join(e2eRoot, "fixtures", "vkx");

export const baseUrl = (process.env.SAILSIGHT_URL ?? "http://localhost:8081").replace(/\/+$/, "");

export function readEnvFile(file: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

export interface AdminCredentials { email: string; password: string }

/** Admin credentials from SAILSIGHT_ADMIN_EMAIL/PASSWORD, falling back to AUTH_ADMIN_* in the given compose env file. */
export function adminCredentials(envFile = composeEnvFile): AdminCredentials {
  const fileValues = existsSync(envFile) ? readEnvFile(envFile) : {};
  const email = process.env.SAILSIGHT_ADMIN_EMAIL ?? fileValues.AUTH_ADMIN_EMAIL;
  const password = process.env.SAILSIGHT_ADMIN_PASSWORD ?? fileValues.AUTH_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      `Admin credentials not found. Set SAILSIGHT_ADMIN_EMAIL and SAILSIGHT_ADMIN_PASSWORD, ` +
      `or run "npm run e2e:up" to create ${path.relative(process.cwd(), envFile)}.`);
  }
  return { email, password };
}
