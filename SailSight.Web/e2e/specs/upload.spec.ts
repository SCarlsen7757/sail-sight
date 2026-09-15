import { expect, fixtureFile, test } from "../support/fixtures";

const FIXTURE = "Atlas 2 17.9.2025.vkx";

test("uploads a session and rejects a duplicate", async ({ createUser, signedInContext }) => {
  const user = await createUser("upload");
  const page = await (await signedInContext(user)).newPage();

  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "Upload session" })).toBeVisible();
  await page.getByLabel("VKX file").setInputFiles(fixtureFile(FIXTURE));
  // Ingestion parses and stores every telemetry row before the API responds.
  await expect(page.getByText("Session uploaded.")).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Races" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View race 1" })).toBeVisible();

  await page.goto("/upload");
  await page.getByLabel("VKX file").setInputFiles(fixtureFile(FIXTURE));
  await expect(page.getByText("Session already uploaded (duplicate).")).toBeVisible();
  await expect(page).toHaveURL(/\/upload$/);
});
