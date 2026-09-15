# Agent Instructions — SailSight

## Pre-v1 Development Policy

Until the first stable v1 release (`v1.0.0`), breaking changes are allowed across APIs, database schemas, configuration, and user flows. Prefer a clean implementation over preserving backward compatibility with unreleased versions.

Development and test databases are disposable during this period. Agents may wipe and recreate them, and replace or consolidate migrations when needed for the task, without separate approval. Verify the target is the intended SailSight development/test database before resetting it, and document any required reset in the change description. This permission does not extend to production databases or unrelated data.

Keep fresh-database setup working. Once `v1.0.0` is released, this blanket permission expires: preserve released compatibility and data through migrations, and obtain explicit approval for destructive resets.

## Build & Run

```bash
# Build entire .NET solution (also regenerates OpenAPI spec + TypeScript types)
dotnet build

# Docker — full stack (TimescaleDB on :5432, API on :8080, Web on :8081)
docker compose up --build

# Rebuild a single Docker image (e.g. after adding npm packages)
docker compose build web

# Add an EF Core migration
dotnet ef migrations add <MigrationName> --project SailSight.Api --startup-project SailSight.Api
```

### Frontend (SailSight.Web)

```bash
cd SailSight.Web
npm run dev        # dev server with hot reload
npm run build      # production build
npm run lint       # ESLint
npm run gen:api    # regenerate src/lib/api-types.ts from the OpenAPI spec
```

### Tests

```bash
# API unit tests
dotnet test SailSight.Api.Tests

# Frontend E2E (Playwright) — run from SailSight.Web; stop the dev stack first
npm run e2e:up        # start docker-compose.yml as project "sailsight-e2e" with a generated .e2e-compose.env
npm run seed          # fill it with the fixture scenario (safe to re-run); also useful for manual testing
npm run test:e2e      # run the specs in e2e/specs
npm run screenshots   # regenerate docs/screenshots/<theme>/<viewport>/<page>.png
npm run e2e:down      # stop the stack and delete its database
```

- The E2E stack uses the same API port (8080) and fixed subnet as the dev stack, so they cannot run at the same time. `SAILSIGHT_URL` (default `http://localhost:8081`) changes the web origin; it must match `APP_ORIGIN`.
- The generated env file raises `LOGIN_RATE_LIMIT_PER_MINUTE` (`RateLimits__LoginPerMinute`, default 5) and `INGESTION_UPLOADS_PER_HOUR` (`Ingestion__UploadsPerHour`, default 20) so seeding and tests are not throttled.
- Seed data comes from real `.vkx` recordings in `SailSight.Web/e2e/fixtures/vkx/` described by `manifest.json`. Review new recordings for privacy and size first (see the fixtures README).
- Specs use role and label locators; add accessible labels before reaching for `data-testid`. Tests that create data use throwaway users or unique names and never modify seeded entities.
- Commit regenerated screenshots together with UI changes that affect them.

---

## Architecture

```
Next.js 15 (Web)  ──HTTP/JSON──►  ASP.NET Core 10 (Api)  ──EF Core──►  TimescaleDB
                                          ▲
                                  VkxIngestionService
                                          │ parses
                                  Vakaros.Vkx.Parser.NET (NuGet)
```

- **`Vakaros.Vkx.Parser.NET`** — NuGet package ([repo](https://github.com/SCarlsen7757/Vakaros.Vkx.Parser.NET), beta 0.x) that decodes the VKX 1.4 format (little-endian, fixed-size rows keyed by a `U1` type byte; spec in the package repo's `vkx_format.md`). Parser fixes go in that repo, not here. Records expose each measured value in SI and imperial units (`WindDirectionRadians`, `SpeedOverGroundKnots`, …); **ingestion must always read the SI properties**. Only VKX 1.4 files are accepted: `VkxIngestionValidator` throws `VkxUnsupportedVersionException` for other versions (400 `unsupported_vkx_version`).
- **`SailSight.Api`** — ASP.NET Core 10 REST API. Handles ingestion, race detection, auth, and all CRUD. Migrations run automatically on startup unless `SKIP_DB_MIGRATION=true`.
- **`SailSight.Shared`** — DTOs shared between the API and web (record types in `Dtos/`). Never add domain logic here.
- **`SailSight.Web`** — Next.js 15 App Router frontend. SSR fetches use the `API_BASE_URL` env var; client-side fetches use the same-origin `/api/*` proxy.

### OpenAPI → TypeScript codegen pipeline

`dotnet build` triggers two MSBuild targets in `SailSight.Api.csproj`:

1. `GenerateOpenApiDocuments` → `SailSight.Api/OpenApi/SailSight.Api.json`
2. `GenerateTypeScriptTypesV1` → runs `npm run gen:api` → `SailSight.Web/src/lib/api-types.ts`

**`api-types.ts` is generated — never edit it manually.** The API client in `src/lib/api.ts` wraps `openapi-fetch` using these types for fully-typed HTTP calls.

### Time-series storage

Position, wind, depth, temperature, speed-through-water, and load readings are stored in TimescaleDB hypertables (defined in `Data/Migrations/hypertables.sql`). Bulk-insert them via EF Core `AddRange` + single `SaveChangesAsync` — do not insert rows one at a time.

### Race detection

Races are detected from `RaceTimerEvent` records embedded in the VKX file (event types: `RESET`, `START`, `SYNC`, `RACE_START`, `RACE_END`). See `RaceDetectionService.cs`. Race boundaries are timer-event-driven, not GPS-based.

---

## Key Conventions

### API

- **URL-segment versioning**: all routes are prefixed `/api/v{version}/...` (currently `v1`). Controllers use `[ApiVersion("1.0")]` and `[Route("api/v{version:apiVersion}/...")]`.
- **Authentication modes**: configured via `Auth__Mode` in env/config. `MultiUser` (default) uses ASP.NET Identity + cookie auth + optional PAT tokens (prefix `vkx_`). `SingleUser` skips Identity entirely and uses a synthetic system user (`AuthConstants.SystemUserId`).
- **CSRF**: `CsrfMiddleware` requires the `X-CSRF-Token` header (value from the `sailsight.csrf` cookie) on all mutating requests in `MultiUser` mode.
- **Session visibility**: controlled by `SessionAuthorizer` / `SessionAccessHandler`. A session is visible if the user is the owner, the session is public (`IsPublic = true`), or it is shared to a team the user belongs to.
- **`ICurrentUser`**: always inject this service in controllers to get the current `UserId`; never read `HttpContext.User` directly.
- **Duplicate detection**: SHA-256 hash of raw file bytes, scoped per-user. Check via `VkxIngestionService.IsDuplicateAsync` before ingestion.
- **DTOs**: defined as `record` types in `SailSight.Shared/Dtos/`. Map from entities inside the controller using inline projections or private static builder methods (see `SessionsController.BuildDetail`).
- **`SKIP_DB_MIGRATION=true`** is set automatically during the OpenAPI generation MSBuild target to prevent EF from connecting to a database at build time.

### Frontend

- **Route groups**: `(auth)` contains unauthenticated pages (login, setup); `(main)` contains the authenticated app shell with a shared layout.
- **API client**: use the `api` singleton from `src/lib/api.ts`. It is pre-configured with the correct base URL and error middleware.
- **Global state**: Zustand stores in `src/store/`. `race-viewer.ts` holds all playback/scrubber state for the race viewer; `settings.ts` holds user preferences.
- **Units**: raw telemetry from the API is in SI units (m/s, radians, metres). Use `src/lib/units.ts` for conversion to display units (knots, degrees, etc.).
- **Track downsampling**: use `src/lib/downsampling.ts` (Ramer-Douglas-Peucker via `simplify-js`) before passing GPS arrays to Leaflet to keep render performance acceptable.
- **Chart smoothing**: apply Savitzky-Golay (`ml-savitzky-golay`) for speed/VMG chart series. See existing chart components for the smoothing window settings.
- **Theming**: `next-themes` with Tailwind dark mode (`class` strategy). Use Tailwind utility classes; avoid inline styles.
- **Components**: prefer Radix UI primitives (already a dependency) for accessible interactive elements; use Lucide React for icons.
