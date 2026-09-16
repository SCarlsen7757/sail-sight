# Security and deployment guide

The behavior and setup sections describe the current implementation. The [historical verification](#historical-verification-2026-09-10) section preserves evidence from the September 10, 2026 security work on `feature/frontend/rework`, starting from reviewed commit `41d76bd`; it is not a current test or vulnerability report.

Fresh installations run the tracked migrations. For existing installations, review the migrations for the version being deployed and back up data before upgrading. The original security work used a fresh disposable development database; this is not a blanket instruction to reset existing installations. The later [recorded-analysis migration](../analysis/recorded-races.md#upgrade-and-recalculation) preserves recordings and rebuilds derived results.

## Behavior

- Activities remain private by default. Owners modify and publish; team membership grants read access. Site administration does not bypass activity privacy. Public projections hide original filenames, hashes and session/race notes, including for signed-in strangers. Public search cannot match private filenames. Unnamed public sessions use `Session yyyy-MM-dd`.
- Session/race boat and course assignments require ownership. Publication rejects foreign associations. Public boat and approved class browsing remain available.
- Named team roles are validated. Owners appoint owners/administrators; administrators manage ordinary members. Security mutations use a PostgreSQL transaction advisory lock shared across teams and site administration, preventing concurrent final-owner/final-administrator removal. This deliberately serializes infrequent security changes across the installation.
- Identity operation results are checked. Security stamps are validated on each authenticated request and rotated on administrative changes and recovery. Setup replacements invalidate earlier links; successful redemption prevents reuse. Invitation consumption, creation and role assignment commit together before sign-in.
- Each MultiUser sign-in creates a persisted login session. Logout revokes that session, so a late response cannot restore its validity. Cookies renew through sliding expiration rather than every security-stamp check.
- Deleting an account that owns sailing data or is a team's sole owner returns 409. Ownership foreign keys restrict deletion; the historical team creator is nullable. Initial administrator bootstrap runs only on an uninitialized installation. Notification streams revalidate account privileges and reconnect through authentication.
- PAT authentication/endpoints and AI reports/UI/configuration/packages are removed. Migrations remove their persistence tables. Old configuration cannot re-enable these features.
- Unsafe requests require `Origin` matching `Web:PublicBaseUrl`, including login/setup. Authenticated writes additionally require `X-CSRF-Token` matching the `sailsight.csrf` cookie, including in SingleUser mode where the principal is synthetic; the shared browser helpers supply it. CORS requires explicit configured origins. Login and invitation limits are separate and partitioned by trusted client IP.

## Uploads and pagination

The file limit is **200,000,000 bytes**; the entire multipart envelope is limited to **201,048,576 bytes**. The UI checks file size, the streaming proxy bounds request size, and the API enforces both. Only one file and no additional form fields are accepted. ASP.NET spools files above 64 KiB to temporary storage; the ingestion layer reuses that stream and does not create another whole-file byte buffer. Request disposal cleans the temporary file, including cancellation.

Admission occurs before multipart model binding: one active ingestion per user, two globally. `Ingestion` configuration exposes `GlobalConcurrency`, `Records` (5,000,000), `Races` (10,000), and `UploadsPerHour` (20). These admission/rate limits target **one API instance**; multiple replicas require shared admission state before deployment.

Validation runs before persistence and checks structure, required metadata, lengths, numbers, coordinates, timestamp ordering and duplicate sample keys. Only VKX 1.4 is accepted; other versions return 400 `unsupported_vkx_version`. `VkxIngestionService` calls the separately maintained `Vakaros.Vkx.Parser.NET` NuGet package for decoding and maps its SI properties into storage. Inserts use batches of 2,000 in one transaction; cancellation interrupts parser reads. Ordered position processing replaces full-record scans for every race. Invalid, duplicate, oversized and exhausted requests return controlled 400/409/413/429 responses.

Session pagination is preserved. Other collections return up to 100 records and expose `X-Next-Offset`; pass that value as `?offset=`. Telemetry returns up to 10,000 samples per channel with the same continuation convention. Offsets are bounded to 5,000,000. The shared browser helper follows continuations, preserving channel ordering. Telemetry windows must be finite, ordered and inside the session; negative race-relative time supports pre-start playback. Statistics aggregate in SQL.

## Local setup

Create an ignored `.env` containing independent strong `POSTGRES_PASSWORD` and `RUNTIME_DB_PASSWORD`, and `AUTH_ADMIN_EMAIL`. Optionally set `AUTH_ADMIN_PASSWORD` (minimum 12 characters); otherwise retrieve the initial one-time setup URL from `docker compose logs migrate`. No default administrator password is shipped.

Run `docker compose -f docker-compose.yml up -d --build`, then open `http://localhost:8081`. This explicitly selects the localhost development profile. The default override adds the development loop; use it only when wanted. API and debugger/database exposures stay on loopback; database is not exposed by the base file.

For host development, use `dotnet run --project SailSight.Api --launch-profile Localhost` with configured database credentials and bootstrap email. SingleUser additionally requires `Auth__Mode=SingleUser` and this explicit local profile. Startup rejects databases containing other users or their data even when automatic migration is disabled. Never switch a multi-user database into SingleUser.

Host migrations run when `LocalProfile=true` and `Database:AutoMigrate` is enabled (default true), using `ConnectionStrings__Default`, which must then have migration privileges. Explicit `--migrate-only` execution requires `ConnectionStrings__Migration` and uses that connection instead. To retain a least-privileged runtime account, run the migration job first and disable runtime auto-migration. `SKIP_DB_MIGRATION=true` is a build-time OpenAPI escape hatch, not the normal deployment migration setting. Compose sets `Database__AutoMigrate=false` and uses the one-shot migration service.

The database image derives from the digest-pinned PostgreSQL 18.6 / TimescaleDB 2.30.0 image. Its actual `PGDATA` is `/home/postgres/pgdata/data`; storage mounts cover `/home/postgres/pgdata`. The derived image excludes the unused `pgbackrest_exporter` and `pgbouncer_exporter` monitoring binaries. Standalone PostgreSQL/TimescaleDB does not invoke them. The deployment does not provide their monitoring endpoints.

On a fresh database, `deployment/init-runtime-role.sh` creates `sailsight_runtime` without superuser/create-role/create-database privileges. The one-shot migration service uses separate migration credentials; the API receives only runtime credentials and does not migrate. Existing databases need the equivalent grants applied deliberately; init scripts only run on an empty database.

## Shared/private-network setup

Use `docker-compose.ghcr.yml` with the checkout's `deployment/` files. Set digest-qualified `SAILSIGHT_API_IMAGE` and `SAILSIGHT_WEB_IMAGE`, the database credentials and initial email above, and an HTTPS `PUBLIC_BASE_URL`. Supply a PFX via `AUTH_KEY_CERTIFICATE_PATH` and its password via `AUTH_KEY_CERTIFICATE_PASSWORD`. Protect the PFX/private key and environment file with host permissions and back them up securely: database-persisted authentication keys are encrypted with that certificate.

Configure an HTTPS ingress, explicitly list its addresses in `TRUSTED_INGRESS_PROXIES`, and expose the web binding only as required (`WEB_BIND`, `WEB_PORT`). Keep the API internal/loopback. The Node entry server strips forwarding headers from untrusted clients, derives the real socket address, and signs sanitized forwarding information for the Next proxy. The API trusts the fixed web-container address only. Adjust both network and trust configuration together if changing the Compose subnet. Do not bypass `entry-server.mjs` in deployment.

HTTP shared origins fail startup; the entry rejects HTTP requests for an HTTPS application origin. HTML responses include CSP and security headers. Inline hydration/styles remain allowed for Next/visualization compatibility. Cloudflare Tunnel production deployment remains separate.

## Dependencies and checks

Current package versions are defined by the project files and `SailSight.Web/package.json`, with `package-lock.json` authoritative for npm resolution. Container base digests are in the Dockerfiles and third-party Action commits are in the workflow files. [resolved-dependencies.json](resolved-dependencies.json) and [action-pins.json](action-pins.json) are snapshots from the original security review, not automatically maintained inventories.

TypeScript 5.9.3, ESLint 9.39.5 and the parent-resolved Microsoft.OpenApi 2.x are compatibility exceptions. Tailwind tokens/dark mode use CSS configuration; ESLint uses its CLI and flat configuration. CI runs type checking separately, checks generated client drift and advisories, and scans the API, web, and database containers. Dependabot schedules updates. Only release jobs have publishing permissions; main-branch container builds do not push images.

Verification commands: `dotnet test SailSight.Api.Tests/SailSight.Api.Tests.csproj -p:SkipTypeScriptGeneration=true`, `npm run gen:api`, `npm run typecheck`, `npm run lint`, frontend/API container builds, `npm audit`, transitive NuGet audit and Trivy image scans. Runtime regression scripts are in `scripts/security-integration.py`, `scripts/upload-boundary.py`, and `scripts/ingestion-workload.py`; they create disposable data and require the documented local test environment variables/files in their source. Never target a production database.

## Historical verification (2026-09-10)

The following results describe the original security implementation only. Rerun the relevant checks against the checkout and deployment under review before treating them as current evidence. Targets at that time included Next 16.3.4, React 19.3.0, Node 26.8.2, ECharts 6.1.0, Tailwind 4.3.3, PostCSS 8.5.28, .NET runtime/framework 10.0.12 and SDK 10.0.401; host verification used SDK 10.0.400/Node 24.19.0.

The implementation report's final verification results are recorded in [verification.json](verification.json). All 30 unit tests, the runtime regression suite, type checking, generated clients and container builds passed. Lint reported zero errors and 112 legacy warnings. The exact 200 MB upload succeeded in 9.77 seconds; one extra byte and excessive race/record budgets returned 413. A failure after the first session insert was verified to roll back the transaction.

Those container scans found no high/critical advisories. The API image retained 6 medium and 5 low package findings; the database retained 156 medium and 80 low package findings. The web image had none. Findings at that time, including package/version, severity, fix availability and advisory URL, are recorded in [container-advisories.json](container-advisories.json). npm and transitive API/test NuGet audits reported no vulnerabilities. The web base's OpenSSL finding was fixed with `libcrypto3`/`libssl3` 3.5.8-r0 or later; excluding the unused database monitoring exporters removed 88 high/critical package findings.

At that review, browser-driven visual checks and hosted workflow runs had not been completed. The repository now contains a Playwright E2E suite and [screenshot workflow](../screenshots/README.md); use their actual results for the revision under review. HTTPS ingress and certificate deployment still require validation in the intended environment before sharing.

At the end of that verification, disposable test containers were stopped and database volumes preserved. Raw logs and scanner reports were kept locally in the ignored `.security-evidence/` directory; they are not distributed with the repository. Temporary image archives were removed.

## Dependabot automation

[Dependabot configuration](../../.github/dependabot.yml) checks npm, NuGet, GitHub Actions and Docker every Monday at 09:00 Europe/Copenhagen. NuGet covers the API and test projects; Docker covers the API, both web Dockerfiles (including `Dockerfile.dev`), and the database image in `deployment/`.

Each ecosystem groups minor and patch version updates into one PR and leaves majors and unmatched updates separate. Each has a limit of two open version-update PRs across its configured directories. PRs receive `chore`, `dependencies` and the corresponding `api`, `web` or `infra` scope label. Existing PRs may temporarily exceed the new limit; review them separately. Updates are not automatically merged.

The TypeScript and ESLint major-version exclusions remain in place, and Microsoft.OpenApi remains resolved through its parent packages. Reconsider these compatibility exceptions under [issue #7](https://github.com/SCarlsen7757/sail-sight/issues/7), rather than bypassing peer or code-generation constraints.

Dependabot alerts and automatic security updates are separate repository settings under **Settings > Advanced Security** and must be enabled on each repository or fork; the YAML alone does not enable them. Security updates are outside the configured version-update groups and routine PR limit. The existing scheduled advisory checks and container scans continue to provide coverage alongside Dependabot.

After merging configuration changes to `main`, inspect the next Dependabot update jobs and resulting PRs to confirm manifest coverage, grouping and labels. Local builds validate the application, but cannot execute GitHub's hosted update scheduler.

## Follow-up work

Recovery references in these issues point to reviewed commit `41d76bd`:

GitHub is authoritative for current scope and status. Files in `follow-ups/` are historical issue drafts retained for context.

1. [User-provided AI credentials and race reports #3](https://github.com/SCarlsen7757/sail-sight/issues/3)
2. [Personal access tokens #4](https://github.com/SCarlsen7757/sail-sight/issues/4)
3. [External identity integration #5](https://github.com/SCarlsen7757/sail-sight/issues/5)
4. [Cloudflare Tunnel deployment #6](https://github.com/SCarlsen7757/sail-sight/issues/6)
5. [Dependency compatibility exceptions #7](https://github.com/SCarlsen7757/sail-sight/issues/7)
