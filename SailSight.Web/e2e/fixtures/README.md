# E2E fixtures

`vkx/` holds real Vakaros `.vkx` recordings used by `npm run seed`. `vkx/manifest.json` says how each file is used: which seed user uploads it, its display name, whether it is public or shared with the team, and the course (marks and legs) assigned to its races.

| File | Source | Size | Races |
|---|---|---|---|
| `Atlas 2 17.9.2025.vkx` | [Vakaros.Vkx.Parser.NET test data](https://github.com/SCarlsen7757/Vakaros.Vkx.Parser.NET/tree/main/Vakaros.Vkx.Parser.NET.Tests/TestData) (already public) | ~800 KB | 1 |

## Adding a recording

Committed fixtures are public forever (they stay in git history even if deleted). Before adding a file:

1. **Privacy.** Check the track on a map. Leave out, or trim away, the home harbour, moorings, and any personal trips. Race areas are fine; transit to and from a private berth is not.
2. **Size.** Keep each file to a few MB. Trim long pre-start or post-race segments. Only use Git LFS if a file genuinely cannot be trimmed.
3. **Format.** Only VKX 1.4 files are accepted by the API. The file should contain `RACE_START`/`RACE_END` timer events so races are detected.
4. **Duplicates.** Each user can upload a given file once (SHA-256 per user). To use the same file for two users, list it once with two `uploads` entries.
5. **Manifest.** Add an entry to `manifest.json`. Place course marks near the track (inspect the race's position telemetry) with `activeFrom` covering the recording date (the seeder uses 1 January of `course.year`).

If a file listed in the manifest is missing, `npm run seed` stops and names it.

## Synthetic analysis scenarios

`e2e/support/analysis-scenario.ts` constructs small VKX recordings for deterministic course-analysis tests and the `leg-analysis` screenshots. These generated scenarios are separate from the real-recording manifest and contain no personal track data.

The standard seeder targets the disposable E2E stack by default. To seed a development instance deliberately, set `SAILSIGHT_URL`, `SAILSIGHT_ADMIN_EMAIL`, and `SAILSIGHT_ADMIN_PASSWORD` for that instance. Seeding creates users, teams, courses, boats, and sessions; do not target production. See [AGENTS.md](../../../AGENTS.md#tests) for the stack lifecycle and rate-limit settings.
