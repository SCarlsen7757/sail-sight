import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { baseUrl, composeEnvFile, repoRoot } from "../config";

// npm run e2e:up | e2e:down
// Runs the production compose stack (docker-compose.yml only, no dev override) as project "sailsight-e2e",
// with a generated env file, the same way the runtime-regressions job in security.yml does.
const PROJECT = "sailsight-e2e";
const compose = ["compose", "--env-file", composeEnvFile, "-p", PROJECT, "-f", "docker-compose.yml"];

function run(command: string, args: string[], capture = false) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: capture ? "pipe" : "inherit", encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
}

function ensureEnvFile() {
  if (existsSync(composeEnvFile)) return;
  const secret = () => randomBytes(24).toString("hex");
  const url = new URL(baseUrl);
  const lines = [
    `POSTGRES_PASSWORD=${secret()}`,
    `RUNTIME_DB_PASSWORD=${secret()}`,
    "AUTH_ADMIN_EMAIL=admin@e2e.local",
    `AUTH_ADMIN_PASSWORD=${secret()}`,
    `PUBLIC_BASE_URL=${url.origin}`,
    `WEB_PORT=${url.port || "80"}`,
    "INGESTION_UPLOADS_PER_HOUR=1000",
    "LOGIN_RATE_LIMIT_PER_MINUTE=100",
  ];
  writeFileSync(composeEnvFile, lines.join("\n") + "\n", { mode: 0o600 });
  console.log(`Created ${path.relative(process.cwd(), composeEnvFile)}`);
}

/** Fails early when another compose project (usually the dev stack) holds the ports or the fixed subnet. */
function assertNoConflictingStack() {
  const webPort = new URL(baseUrl).port || "80";
  const hostPorts = new RegExp(`:(8080|${webPort})->`);
  const { stdout } = run("docker", ["ps", "--format", "{{.Label \"com.docker.compose.project\"}}\t{{.Names}}\t{{.Ports}}"], true);
  const conflicts = stdout.split("\n").filter(Boolean)
    .map(line => line.split("\t"))
    .filter(([project, , ports]) => project !== PROJECT && hostPorts.test(ports ?? ""));
  if (conflicts.length) {
    throw new Error(
      `Other containers are using port 8080 or ${webPort}:\n${conflicts.map(([project, name]) => `  - ${name} (project "${project || "none"}")`).join("\n")}\n` +
      `Stop the SailSight dev stack first (docker compose down); the E2E stack uses the same API port and fixed subnet. ` +
      `For a different web port, set SAILSIGHT_URL (e.g. http://localhost:18081) before the first "npm run e2e:up".`);
  }
}

async function waitForApi() {
  const url = `${baseUrl}/api/v1/auth/providers`;
  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await delay(2000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function up() {
  assertNoConflictingStack();
  ensureEnvFile();
  const { status } = run("docker", [...compose, "up", "-d", "--build", "--wait"]);
  if (status !== 0) {
    throw new Error(`docker compose up failed. If the error mentions an overlapping pool or subnet, remove the dev stack's network (docker compose down).`);
  }
  await waitForApi();
  console.log(`\nE2E stack is ready at ${baseUrl}. Next: npm run seed`);
}

function down() {
  // -v removes the database volume; E2E data is disposable. The env file is kept for the next run.
  const { status } = run("docker", [...compose, "down", "-v"]);
  if (status !== 0) throw new Error("docker compose down failed.");
}

const command = process.argv[2];
const actions: Record<string, () => unknown> = { up, down };
if (!actions[command]) {
  console.error("Usage: tsx e2e/stack/stack.ts <up|down>");
  process.exit(2);
}
Promise.resolve(actions[command]()).catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
