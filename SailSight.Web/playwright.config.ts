import { defineConfig, devices } from "@playwright/test";
import { baseUrl } from "./e2e/config";

// The stack must already be running and seeded: npm run e2e:up && npm run seed.
// baseURL must equal the web container's APP_ORIGIN, or the /api proxy rejects mutating requests.
export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  // A freshly started stack is slow on the first race-page loads and the first ingestion.
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: baseUrl,
    // Many pages format dates with toLocaleString(); pin both for stable output.
    locale: "en-GB",
    timezoneId: "Europe/Copenhagen",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /support[\\/]auth\.setup\.ts/ },
    {
      name: "e2e",
      testMatch: /specs[\\/].*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // npm run screenshots → docs/screenshots/<theme>/<viewport>/<page>.png
      name: "screenshots",
      testMatch: /screenshots[\\/].*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
