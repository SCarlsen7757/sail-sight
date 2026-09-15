import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { adminCredentials, authDir, baseUrl, composeEnvFile, seedIdsFile } from "../config";
import { runScenario } from "./scenario";

// npm run seed [-- --env-file <compose env file>]
// Fills a SailSight backend with the E2E scenario. Safe to run again on the same database.
async function main() {
  const { values } = parseArgs({ options: { "env-file": { type: "string" } } });
  const envFile = values["env-file"] ? path.resolve(values["env-file"]) : composeEnvFile;

  const { ids, storageStates } = await runScenario(baseUrl, adminCredentials(envFile));

  mkdirSync(authDir, { recursive: true });
  for (const [role, state] of Object.entries(storageStates)) {
    writeFileSync(path.join(authDir, `${role}.json`), JSON.stringify(state, null, 2));
  }
  mkdirSync(path.dirname(seedIdsFile), { recursive: true });
  writeFileSync(seedIdsFile, JSON.stringify(ids, null, 2));

  const publicSession = ids.sessions.find(s => s.isPublic);
  console.log("\nSeed complete.");
  console.log(`  Users:           ${Object.values(ids.users).map(u => u.email).join(", ")}`);
  if (publicSession) {
    console.log(`  Public session:  ${baseUrl}/s/${publicSession.id}`);
    if (publicSession.raceIds[0]) console.log(`  Public race:     ${baseUrl}/r/${publicSession.raceIds[0]}`);
    console.log(`  Public boat:     ${baseUrl}/b/${publicSession.boatId}`);
  }
  console.log(`  Invitation link: ${ids.invitationUrl}`);
  console.log(`  Wrote ${path.relative(process.cwd(), seedIdsFile)} and ${path.relative(process.cwd(), authDir)}/`);
}

main().catch((error: unknown) => {
  console.error(`\nSeeding failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
