import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fixturesDir, type AdminCredentials } from "../config";
import { type ApiClient, createApiClient, errorCode, ok, type StorageState } from "./client";
import { BOAT_CLASS_NAME, INVITATION_NOTE, SEED_PASSWORD, TEAM_NAME, boats, seedUsers, type SeedRole } from "./users";

interface ManifestMark { key: string; name: string; latitude: number; longitude: number; roundingRadiusMeters: number }
interface ManifestUpload { owner: "admin" | "skipper"; displayName: string; public: boolean; shareWithTeam: boolean }
interface ManifestFixture {
  file: string;
  course: { name: string; year: number; marks: ManifestMark[]; legs: string[] };
  uploads: ManifestUpload[];
}

export interface SeedSession {
  file: string;
  owner: "admin" | "skipper";
  id: string;
  displayName: string;
  isPublic: boolean;
  sharedWithTeam: boolean;
  boatId: string;
  courseId: string;
  raceIds: string[];
}

export interface SeedIds {
  baseUrl: string;
  users: Record<SeedRole, { id: string; email: string }>;
  teamId: string;
  invitationUrl: string;
  boatClassId: string;
  boatIds: Record<"admin" | "skipper", string>;
  sessions: SeedSession[];
}

export interface SeedResult {
  ids: SeedIds;
  storageStates: Record<SeedRole, StorageState>;
}

const log = (message: string) => console.log(`  ${message}`);

export function loadManifest(): ManifestFixture[] {
  const manifestFile = path.join(fixturesDir, "manifest.json");
  const { fixtures } = JSON.parse(readFileSync(manifestFile, "utf8")) as { fixtures: ManifestFixture[] };
  const missing = fixtures.map(f => f.file).filter(file => !existsSync(path.join(fixturesDir, file)));
  if (missing.length) {
    throw new Error(
      `Missing VKX fixture file(s) in ${path.relative(process.cwd(), fixturesDir)}:\n` +
      missing.map(file => `  - ${file}`).join("\n") +
      `\nAdd the files or remove them from manifest.json (see e2e/fixtures/README.md).`);
  }
  return fixtures;
}

async function withCsrfCookie(client: ApiClient): Promise<ApiClient> {
  const providers = ok(await client.GET("/api/v1/auth/providers"), "GET auth/providers");
  if (!providers.local) throw new Error(`The API is in ${providers.mode} mode; the seeder needs MultiUser mode with local sign-in.`);
  return client;
}

async function signIn(baseUrl: string, email: string, password: string): Promise<ApiClient> {
  const client = await withCsrfCookie(createApiClient(baseUrl));
  ok(await client.POST("/api/v1/auth/login", { body: { email, password } }), `Sign in as ${email}`);
  return client;
}

async function ensureUser(baseUrl: string, admin: ApiClient, user: { email: string; displayName: string }) {
  const users = ok(await admin.GET("/api/v1/admin/users"), "GET admin/users");
  const existing = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (existing?.hasPassword) {
    log(`user ${user.email} exists`);
    return { id: existing.id, client: await signIn(baseUrl, user.email, SEED_PASSWORD) };
  }

  let setupUrl: string;
  if (existing) {
    setupUrl = ok(await admin.POST("/api/v1/admin/users/{id}/setup-link", { params: { path: { id: existing.id } } }), "POST setup-link").setupUrl;
  } else {
    setupUrl = ok(await admin.POST("/api/v1/admin/users", { body: { email: user.email, displayName: user.displayName, role: null } }), "POST admin/users").setupUrl;
  }
  const params = new URL(setupUrl).searchParams;
  const userId = params.get("userId")!;
  const client = await withCsrfCookie(createApiClient(baseUrl));
  // Completing setup also signs the new user in.
  ok(await client.POST("/api/v1/auth/setup/complete", {
    body: { userId, token: params.get("token")!, password: SEED_PASSWORD },
  }), `Complete setup for ${user.email}`);
  log(`user ${user.email} created`);
  return { id: userId, client };
}

async function ensureTeam(admin: ApiClient): Promise<string> {
  const teams = ok(await admin.GET("/api/v1/teams"), "GET teams");
  const existing = teams.find(t => t.name === TEAM_NAME);
  if (existing) return existing.id;
  log(`team "${TEAM_NAME}" created`);
  return ok(await admin.POST("/api/v1/teams", { body: { name: TEAM_NAME } }), "POST teams").id;
}

async function invite(owner: ApiClient, teamId: string, email: string) {
  const result = await owner.POST("/api/v1/teams/{teamId}/invites", { params: { path: { teamId } }, body: { email, role: "Member" } });
  if (result.response.status === 409 && ["invite_already_pending", "already_member"].includes(errorCode(result.error) ?? "")) return;
  ok(result, `Invite ${email}`);
}

async function ensureMember(owner: ApiClient, teamId: string, member: { email: string; client: ApiClient }) {
  const members = ok(await owner.GET("/api/v1/teams/{teamId}/members", { params: { path: { teamId } } }), "GET team members");
  if (members.some(m => m.email.toLowerCase() === member.email.toLowerCase())) return;
  await invite(owner, teamId, member.email);
  const invites = ok(await member.client.GET("/api/v1/me/invites"), "GET me/invites");
  const pending = invites.find(i => i.teamId === teamId);
  if (!pending) throw new Error(`No pending invite for ${member.email} to team ${teamId}.`);
  ok(await member.client.POST("/api/v1/me/invites/{inviteId}/accept", { params: { path: { inviteId: pending.id } } }), "Accept invite");
  log(`${member.email} joined "${TEAM_NAME}"`);
}

async function ensurePendingInvite(owner: ApiClient, teamId: string, email: string) {
  const members = ok(await owner.GET("/api/v1/teams/{teamId}/members", { params: { path: { teamId } } }), "GET team members");
  if (members.some(m => m.email.toLowerCase() === email.toLowerCase())) {
    console.warn(`  warning: ${email} is already a member of "${TEAM_NAME}", so the pending invite cannot be recreated.`);
    return;
  }
  await invite(owner, teamId, email);
}

/** Revokes earlier seed invitations and creates a fresh one, so the URL is always known. */
async function recreateInvitation(admin: ApiClient): Promise<string> {
  const invitations = ok(await admin.GET("/api/v1/admin/invitations"), "GET admin/invitations");
  for (const old of invitations.filter(i => i.note === INVITATION_NOTE && i.isActive)) {
    ok(await admin.DELETE("/api/v1/admin/invitations/{id}", { params: { path: { id: old.id } } }), "Revoke invitation");
  }
  const created = ok(await admin.POST("/api/v1/admin/invitations", {
    body: { role: "User", maxUses: 5, expiresInDays: 30, note: INVITATION_NOTE },
  }), "POST admin/invitations");
  return created.url;
}

async function ensureBoatClass(admin: ApiClient): Promise<string> {
  const classes = ok(await admin.GET("/api/v1/boat-classes"), "GET boat-classes");
  const existing = classes.find(c => c.name === BOAT_CLASS_NAME);
  if (existing) return existing.id;
  log(`boat class "${BOAT_CLASS_NAME}" created`);
  return ok(await admin.POST("/api/v1/boat-classes", { body: { name: BOAT_CLASS_NAME, length: 6.9, width: 2.5, weight: 1100 } }), "POST boat-classes").id;
}

async function ensureBoat(client: ApiClient, boat: (typeof boats)[keyof typeof boats], boatClassId: string): Promise<string> {
  const owned = ok(await client.GET("/api/v1/Boats"), "GET boats");
  const existing = owned.find(b => b.name === boat.name);
  if (existing) return existing.id;
  log(`boat "${boat.name}" created`);
  return ok(await client.POST("/api/v1/Boats", {
    body: { name: boat.name, sailNumber: boat.sailNumber, boatClassId, description: "Created by the E2E seeder.", isPublic: boat.isPublic },
  }), "POST boats").id;
}

async function ensureCourse(client: ApiClient, course: ManifestFixture["course"]): Promise<string> {
  const marks = ok(await client.GET("/api/v1/Marks"), "GET marks");
  const markIds = new Map<string, string>();
  for (const mark of course.marks) {
    let id = marks.find(m => m.name === mark.name)?.id;
    id ??= ok(await client.POST("/api/v1/Marks", {
      body: {
        name: mark.name, activeFrom: `${course.year}-01-01`, activeUntil: null,
        latitude: mark.latitude, longitude: mark.longitude, defaultRoundingRadiusMeters: mark.roundingRadiusMeters, description: null,
      },
    }), "POST marks").id;
    markIds.set(mark.key, id);
  }

  const courses = ok(await client.GET("/api/v1/Courses", { params: { query: { year: course.year } } }), "GET courses");
  const existing = courses.find(c => c.name === course.name);
  if (existing) return existing.id;
  log(`course "${course.name}" created`);
  return ok(await client.POST("/api/v1/Courses", {
    body: {
      name: course.name, year: course.year, description: "Created by the E2E seeder.",
      startLineSource: "Device", startMark1Id: null, startMark2Id: null,
      finishLineSource: "Device", finishMark1Id: null, finishMark2Id: null,
      legs: course.legs.map(key => {
        const markId = markIds.get(key);
        if (!markId) throw new Error(`Course "${course.name}" references unknown mark key "${key}".`);
        return { markId, gateMarkId: null, legName: null, overrideRoundingRadiusMeters: null, legType: "Mark", passingSide: "Port" };
      }),
    },
  }), "POST courses").id;
}

async function findOwnSession(client: ApiClient, fileName: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const result = ok(await client.GET("/api/v1/sessions", { params: { query: { visibility: "mine", page, pageSize: 100 } } }), "GET sessions");
    const match = result.items.find(s => s.fileName === fileName);
    if (match) return match.id;
    if (page * 100 >= Number(result.total)) return undefined;
  }
}

async function upload(client: ApiClient, fileName: string): Promise<string> {
  const bytes = readFileSync(path.join(fixturesDir, fileName));
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.append("file", new Blob([bytes]), fileName);
    const result = await client.POST("/api/v1/sessions", { body: {}, bodySerializer: () => form });
    if (result.response.status === 409) {
      const id = await findOwnSession(client, fileName);
      if (id) return id;
    }
    // Another upload by this user may still be ingesting.
    if (result.response.status === 429 && errorCode(result.error) === "ingestion_busy" && attempt < 30) {
      await delay(2000);
      continue;
    }
    return ok(result, `Upload ${fileName}`).id;
  }
}

async function ensureSession(
  client: ApiClient, fixture: ManifestFixture, spec: ManifestUpload, boatId: string, courseId: string, teamId: string,
): Promise<SeedSession> {
  let id = await findOwnSession(client, fixture.file);
  if (!id) {
    id = await upload(client, fixture.file);
    log(`uploaded "${fixture.file}" as ${spec.owner}`);
  }

  const session = ok(await client.PATCH("/api/v1/sessions/{id}", {
    params: { path: { id } },
    body: { boatId, courseId, notes: null, isPublic: spec.public, displayName: spec.displayName },
  }), "PATCH session");
  for (const race of session.races) {
    if (race.courseId === courseId) continue;
    ok(await client.PATCH("/api/v1/races/{raceId}", { params: { path: { raceId: race.id } }, body: { courseId, notes: null } }), "PATCH race");
  }
  if (spec.shareWithTeam) {
    ok(await client.PUT("/api/v1/sessions/{sessionId}/shares", { params: { path: { sessionId: id } }, body: { teamId } }), "Share session");
  }
  if (session.races.length === 0) console.warn(`  warning: "${fixture.file}" produced no races.`);

  return {
    file: fixture.file, owner: spec.owner, id, displayName: spec.displayName, isPublic: spec.public,
    sharedWithTeam: spec.shareWithTeam, boatId, courseId, raceIds: session.races.map(r => r.id),
  };
}

export async function runScenario(baseUrl: string, adminCredentials: AdminCredentials): Promise<SeedResult> {
  const fixtures = loadManifest();

  console.log(`Seeding ${baseUrl}`);
  const admin = await signIn(baseUrl, adminCredentials.email, adminCredentials.password);
  const me = ok(await admin.GET("/api/v1/me"), "GET me");
  if (!me.roles.includes("Admin")) throw new Error(`${adminCredentials.email} is not an administrator.`);

  const skipper = await ensureUser(baseUrl, admin, seedUsers.skipper);
  const crew = await ensureUser(baseUrl, admin, seedUsers.crew);

  const teamId = await ensureTeam(admin);
  await ensureMember(admin, teamId, { email: seedUsers.skipper.email, client: skipper.client });
  await ensurePendingInvite(admin, teamId, seedUsers.crew.email);
  const invitationUrl = await recreateInvitation(admin);

  const boatClassId = await ensureBoatClass(admin);
  const clients = { admin, skipper: skipper.client };
  const boatIds = {
    admin: await ensureBoat(admin, boats.admin, boatClassId),
    skipper: await ensureBoat(skipper.client, boats.skipper, boatClassId),
  };

  const sessions: SeedSession[] = [];
  for (const fixture of fixtures) {
    for (const spec of fixture.uploads) {
      const client = clients[spec.owner];
      const courseId = await ensureCourse(client, fixture.course);
      sessions.push(await ensureSession(client, fixture, spec, boatIds[spec.owner], courseId, teamId));
    }
  }

  return {
    ids: {
      baseUrl,
      users: {
        admin: { id: me.id, email: me.email },
        skipper: { id: skipper.id, email: seedUsers.skipper.email },
        crew: { id: crew.id, email: seedUsers.crew.email },
      },
      teamId, invitationUrl, boatClassId, boatIds, sessions,
    },
    storageStates: { admin: admin.storageState(), skipper: skipper.client.storageState(), crew: crew.client.storageState() },
  };
}
