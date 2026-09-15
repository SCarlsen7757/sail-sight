// Seeded test accounts. These only exist on disposable dev/test databases.
export const SEED_PASSWORD = "e2e-Seed-Password-1";

export type SeedRole = "admin" | "skipper" | "crew";

export const seedUsers = {
  /** Team member who owns a team-shared session. */
  skipper: { email: "skipper@e2e.local", displayName: "Sam Skipper" },
  /** Has a pending, unaccepted team invite. */
  crew: { email: "crew@e2e.local", displayName: "Casey Crew" },
} as const;

export const TEAM_NAME = "E2E Crew";
export const BOAT_CLASS_NAME = "Atlas Test Class";
export const INVITATION_NOTE = "e2e-seed";
export const boats = {
  admin: { name: "Seed Admin Boat", sailNumber: "DEN 101", isPublic: true },
  skipper: { name: "Seed Skipper Boat", sailNumber: "DEN 202", isPublic: false },
} as const;
