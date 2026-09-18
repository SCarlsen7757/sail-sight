import { authFile, expect, publicSession, test } from "../support/fixtures";

test.use({ storageState: authFile("admin") });

declare global {
  interface Window { __cspViolations?: string[] }
}

// The OpenSeaMap tile host was missing from the CSP `img-src` directive, so the overlay
// checkbox was a dead control in production while the stubbed E2E tiles hid it (issue #26).
//
// Note that watching for the tile *request* does not detect this: Playwright's route
// interception sits below the renderer's CSP check, so the request is observed and stubbed
// even while the browser refuses the image. The page-side `securitypolicyviolation` event
// is what actually distinguishes the two, which is why the test listens for that.
test.describe("map overlays", () => {
  test("loads OpenSeaMap tiles without a CSP violation", async ({ page, seed }) => {
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", event => {
        window.__cspViolations!.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    const tileRequests: string[] = [];
    page.on("request", request => {
      if (request.url().includes("tiles.openseamap.org")) tileRequests.push(request.url());
    });

    await page.goto(`/races/${publicSession(seed).raceIds[0]}`);
    await expect(page.locator(".leaflet-container")).toBeVisible();
    expect(tileRequests).toHaveLength(0);

    await page.getByRole("checkbox", { name: "OpenSeaMap" }).check();
    await expect.poll(() => tileRequests.length).toBeGreaterThan(0);

    await expect.poll(() => page.evaluate(() => window.__cspViolations ?? [])).toEqual([]);
  });

  test("allows every tile host the app requests in the CSP", async ({ page }) => {
    const response = await page.goto("/");
    const imgSrc = /img-src ([^;]+)/.exec(response!.headers()["content-security-policy"] ?? "")?.[1];

    expect(imgSrc).toBeDefined();
    for (const host of ["https://*.basemaps.cartocdn.com", "https://tiles.openseamap.org"]) {
      expect(imgSrc).toContain(host);
    }
  });
});
