# Agent Instructions — SailSight

## Pre-v1 Development Policy

Until the first stable v1 release (`v1.0.0`), breaking changes are allowed across APIs, database schemas, configuration, and user flows. Prefer a clean implementation over preserving backward compatibility with unreleased versions.

Development and test databases are disposable during this period. Agents may wipe and recreate them, and replace or consolidate migrations when needed for the task, without separate approval. Verify the target is the intended SailSight development/test database before resetting it, and document any required reset in the change description. This permission does not extend to production databases or unrelated data.

The schema therefore ships as a **single baseline migration**, `SailSight.Api/Migrations/<timestamp>_InitialCreate.cs`. Do not stack a second migration on top of it. A schema change means deleting the existing migration and snapshot, regenerating one `InitialCreate` from the model, and recreating the disposable databases (see [Build & Run](#build--run)).

Keep fresh-database setup working. Once `v1.0.0` is released, this blanket permission expires: preserve released compatibility and data through migrations, and obtain explicit approval for destructive resets. The first released migration becomes a real baseline that must be added to, not regenerated.

## Build & Run

```bash
# Build entire .NET solution (also regenerates OpenAPI spec + TypeScript types)
dotnet build SailSight.slnx

# Docker — dev override exposes DB :5432, API :8080, Web :8081 on loopback
# Requires .env credentials; see README. Includes the one-shot migrate service.
docker compose up --build

# Base stack without the hot-reload override (DB stays internal)
docker compose -f docker-compose.yml up -d --build

# Rebuild a single Docker image (e.g. after adding npm packages)
docker compose build web

# Regenerate the single pre-v1 baseline migration after a model change.
# Delete SailSight.Api/Migrations/*.cs first, then recreate the databases
# (docker compose down -v, and npm run e2e:down in SailSight.Web).
# The two variables mirror what the OpenAPI MSBuild target sets; without them
# the design-time host fails its origin check and cannot resolve AppDbContext.
SKIP_DB_MIGRATION=true Web__PublicBaseUrl=https://localhost dotnet ef migrations add InitialCreate --project SailSight.Api --startup-project SailSight.Api
```

### Frontend (SailSight.Web)

```bash
cd SailSight.Web
npm ci             # exact install from the lockfile; a full `dotnet build SailSight.slnx` runs `npm install` for you
npm run dev        # dev server with hot reload
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # application and E2E TypeScript checks
npm run gen:api    # regenerate src/lib/api-types.ts from the OpenAPI spec
```

### Tests

```bash
# API unit tests
dotnet test SailSight.Api.Tests

# Frontend E2E (Playwright) — run from SailSight.Web; stop the dev stack first
# The Playwright browser is installed automatically by test:e2e, test:e2e:ui and screenshots.
npm run e2e:up        # start docker-compose.yml as project "sailsight-e2e" with a generated .e2e-compose.env
npm run seed          # fill it with the fixture scenario (safe to re-run); also useful for manual testing
npm run test:e2e      # run the specs in e2e/specs
npm run screenshots   # regenerate docs/screenshots/<theme>/<viewport>/<page>.png
npm run e2e:down      # stop the stack and delete its database
```

- The E2E stack uses the same API port (8080) and fixed subnet as the dev stack, so they cannot run at the same time. Use `docker compose down` to remove the dev network before starting E2E. `SAILSIGHT_URL` (default `http://localhost:8081`) changes the web origin; it must match `APP_ORIGIN`. Set it before the first `e2e:up`: the generated env file is reused, not regenerated when the URL changes. `e2e:down` deletes the E2E database volume but keeps that env file.
- The generated env file raises `LOGIN_RATE_LIMIT_PER_MINUTE` (`RateLimits__LoginPerMinute`, default 5) and `INGESTION_UPLOADS_PER_HOUR` (`Ingestion__UploadsPerHour`, default 20) so seeding and tests are not throttled.
- Seed data comes from real `.vkx` recordings in `SailSight.Web/e2e/fixtures/vkx/` described by `manifest.json`. Review new recordings for privacy and size first (see the fixtures README).
- Specs use role and label locators; add accessible labels before reaching for `data-testid`. Tests that create data use throwaway users or unique names and never modify seeded entities.
- Commit regenerated screenshots together with UI changes that affect them.

---

## Architecture

```
Next.js 16 (Web)  ──HTTP/JSON──►  ASP.NET Core 10 (Api)  ──EF Core──►  TimescaleDB
                                          ▲
                                  VkxIngestionService
                                          │ parses
                                  Vakaros.Vkx.Parser.NET (NuGet)
```

- **`Vakaros.Vkx.Parser.NET`** — NuGet package ([repo](https://github.com/SCarlsen7757/Vakaros.Vkx.Parser.NET), beta 0.x) that decodes the VKX 1.4 format (little-endian, fixed-size rows keyed by a `U1` type byte; spec in the package repo's `vkx_format.md`). Parser fixes go in that repo, not here. Records expose each measured value in SI and imperial units (`WindDirectionRadians`, `SpeedOverGroundKnots`, …); **ingestion must always read the SI properties**. Only VKX 1.4 files are accepted: `VkxIngestionValidator` throws `VkxUnsupportedVersionException` for other versions (400 `unsupported_vkx_version`).
- **`SailSight.Api`** — ASP.NET Core 10 REST API. Handles ingestion, race detection, auth, and all CRUD. Compose runs migrations/bootstrap in a one-shot `--migrate-only` service and disables runtime API migrations. Host startup migrates only with `LocalProfile=true` and `Database:AutoMigrate` enabled (defaults to true locally). `SKIP_DB_MIGRATION=true` skips database initialization for OpenAPI generation.
- **`SailSight.Shared`** — DTOs shared between the API and web (record types in `Dtos/`). Never add domain logic here.
- **`SailSight.Web`** — Next.js 16 App Router frontend. Server-side API calls use `API_BASE_URL`; client-side calls use the same-origin `/api/*` proxy. Start through `entry-server.mjs` (`npm run dev` / `npm start`) to retain forwarding-header validation. Public runtime configuration (currently `CARTO_API_KEY`) is read per request by `src/app/api/config/route.ts` and consumed through `useRuntimeConfig()` — never add a `NEXT_PUBLIC_*` variable, which would bake the value into the client bundle and make the published image un-reconfigurable.

### OpenAPI → TypeScript codegen pipeline

`dotnet build SailSight.slnx` triggers two MSBuild targets in `SailSight.Api.csproj`:

1. `GenerateOpenApiDocuments` → `SailSight.Api/OpenApi/SailSight.Api.json`
2. `GenerateTypeScriptTypesV1` → runs `npx openapi-typescript` → `SailSight.Web/src/lib/api-types.ts`

The API project invokes the generator through `npx` rather than `npm run gen:api`, so it never needs
`SailSight.Web/node_modules`: building or testing the API on a fresh clone does not install the
frontend. The version is pinned in both `SailSight.Api.csproj` and `SailSight.Web/package.json`, and
CI regenerates with the latter and diffs the result, so a mismatch that changes output fails.

`SailSight.slnx` gives `SailSight.Web.esproj` a `BuildDependency` on the API so the web build always
compiles against freshly generated types instead of racing the generator. The esproj sets
`AddSyntheticProjectReferencesForSolutionDependencies=false`: on the command line MSBuild otherwise
promotes that solution dependency to a real `ProjectReference`, and the JavaScript SDK then copies the
API's build output into `SailSight.Web/`. The web project installs its own dependencies through the
SDK (`npm install`, skipped when they are up to date); `npm ci` stays the exact-lockfile install used
by CI, Docker, and manual runs.

**`api-types.ts` is generated — never edit it manually.** The API client in `src/lib/api.ts` wraps `openapi-fetch` using these types for fully-typed HTTP calls.

### Time-series storage

Telemetry and recorded events are stored in TimescaleDB hypertables (defined in `Data/Migrations/hypertables.sql`). Ingestion uses EF Core `AddRange` and `SaveChangesAsync` in batches of 2,000, detaches inserted rows, and commits the session, races, and telemetry in one transaction. Preserve bounded batching and cancellation; do not insert rows one at a time or buffer an entire upload again.

### Race detection

Races are detected from `RaceTimerEvent` records embedded in the VKX file (event types: `RESET`, `START`, `SYNC`, `RACE_START`, `RACE_END`). See `RaceDetectionService.cs`. Race boundaries are timer-event-driven, not GPS-based.

---

## Key Conventions

### API

- **URL-segment versioning**: all routes are prefixed `/api/v{version}/...` (currently `v1`). Controllers use `[ApiVersion("1.0")]` and `[Route("api/v{version:apiVersion}/...")]`.
- **Authentication modes**: configured via `Auth__Mode`. `MultiUser` (default) uses ASP.NET Identity + cookie auth. PAT/bearer authentication is removed (future work: GitHub issue #4). `SingleUser` skips Identity registration and uses a synthetic system user (`AuthConstants.SystemUserId`); it requires the explicit localhost profile and rejects databases containing other users or their data.
- **Login sessions**: in `MultiUser` mode each sign-in creates a `login_sessions` row (`LoginSessionStore`) whose id travels in the auth cookie. A cookie is only accepted while its row exists, so logout revokes that device alone; changing the security stamp still revokes every device. The cookie is renewed only by sliding expiration, never on every response.
- **Origin and CSRF**: unsafe requests must supply `Origin` matching `Web:PublicBaseUrl`. `CsrfMiddleware` also requires `X-CSRF-Token` matching the `sailsight.csrf` cookie for authenticated mutations, including the synthetic SingleUser principal. Anonymous login/setup requests still require the origin check. Use the shared browser request helpers.
- **Session visibility**: controlled by `SessionAuthorizer` / `SessionAccessHandler`. A session is visible if the user is the owner, the session is public (`IsPublic = true`), or it is shared to a team the user belongs to.
- **`ICurrentUser`**: always inject this service in controllers to get the current `UserId`; never read `HttpContext.User` directly.
- **Duplicate detection**: SHA-256 hash of raw file bytes, scoped per-user. Check via `VkxIngestionService.IsDuplicateAsync` before ingestion.
- **DTOs**: defined as `record` types in `SailSight.Shared/Dtos/`. Map from entities inside the controller using inline projections or private static builder methods (see `SessionsController.BuildDetail`).
- **`SKIP_DB_MIGRATION=true`** is set automatically during the OpenAPI generation MSBuild target to prevent EF from connecting to a database at build time.

### Frontend

- **Route groups**: `(auth)` contains login, setup, and invitation pages; `(main)` has the authenticated shell; `(public)` contains browsing and public session/race/boat pages. Server-side authorization remains authoritative.
- **API client**: use the `api` singleton from `src/lib/api.ts`. It is pre-configured with the correct base URL and error middleware.
- **State**: `src/store/race-viewer.ts` uses Zustand for shared in-memory playback/scrubber state. `settings.ts` uses a React hook and `localStorage` (`sailsight.units`) for unit preferences, synchronized through storage events.
- **Units**: telemetry speeds/distances use m/s and metres, COG/wind/shift directions use radians, coordinates use degrees, and temperature uses °C. Derived DTO fields can specify other units (for example `ApproachCourseDegrees`). Use `src/lib/units.ts` for display conversion.
- **Track downsampling**: use `src/lib/track-utils.ts` (Ramer-Douglas-Peucker via `simplify-js`, with zoom-dependent tolerance) before passing GPS arrays to Leaflet.
- **Chart smoothing**: `src/lib/downsampling.ts` provides Savitzky-Golay helpers used by `normalization.ts`; windows depend on recording rate. `leg-analysis.ts` smooths VMG within valid approaches only. Preserve missing-data and target-change gaps; do not smooth backend summary metrics.
- **Theming**: `next-themes` with Tailwind dark mode (`class` strategy). Use Tailwind utility classes; avoid inline styles.
- **Components**: prefer Radix UI primitives (already a dependency) for accessible interactive elements; use Lucide React for icons.

### Documentation

- Describe implemented behavior in current guides; track planned capabilities in GitHub issues. Keep dated verification reports explicitly historical.
- When changing behavior, check the README, relevant detailed guides, and these instructions. Generated OpenAPI and TypeScript files remain generated sources, not hand-edited documentation.
