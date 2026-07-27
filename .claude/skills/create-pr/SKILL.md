---
name: create-pr
description: Open a pull request for SailSight with correctly applied labels. Use whenever the user asks to create/open/raise a PR, or after finishing work on a feature branch. Covers the repo's flat label scheme (type + area + meta), pre-PR build checks, and the GitVersion branch conventions.
---

# Creating a pull request for SailSight

Base branch is always `main`. CI runs on every PR to `main`: version (GitVersion), Build API,
Build Web, and non-pushing Docker builds for both images.

## 1. Check the branch

Never open a PR from `main`. If the current branch is `main`, create a feature branch first.

GitVersion (`GitVersion.yml`) only recognises feature branches matching `^features?[\/-]` — so
`feature/foo` or `feature-foo`. A branch named anything else still builds, but gets no
`{BranchName}` version label. Match the existing style: `feature/<area>/<short-description>`.

## 2. Verify the work builds

There is no automated test suite. The only real signal before CI is a local build:

```bash
dotnet build                 # also regenerates OpenAPI spec + api-types.ts
cd SailSight.Web && npm run lint && npm run build
```

If `dotnet build` changed `SailSight.Api/OpenApi/SailSight.Api.json` or
`SailSight.Web/src/lib/api-types.ts`, **commit those files** — they are generated but tracked, and
CI builds from the committed spec.

## 3. Write the PR

Summary of what changed and why, then the test plan. Keep it short — this is a small repo.

```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
## Summary
- <what changed and why>

## Test plan
- [ ] <how you verified it>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## 4. Apply labels

Labels are **flat names grouped by colour** — there is no `type:` / `area:` prefix. Colour is the
only dimension cue, so applying the right combination matters:

| Family | Colour | Rule |
| --- | --- | --- |
| Type | warm (red → tan) | **Exactly one.** Every PR gets one. |
| Area | uniform blue `#1d76db` | **One or more.** Every PR gets at least one. |
| Meta / workflow | neutrals, purple, teal | Only when it applies. |

### Type — pick exactly one

| Label | Use for |
| --- | --- |
| `bug` | Something isn't working as intended |
| `security` | Auth, authorization, or data-exposure concern |
| `feature` | New capability that doesn't exist yet |
| `enhancement` | Improvement to something that already exists |
| `performance` | Speed, memory, query cost, or render cost |
| `refactor` | Internal restructuring with no behaviour change |
| `documentation` | README, VKX format spec, or code comments |
| `chore` | Build, tooling, dependencies, or cleanup |

`feature` vs `enhancement` is the common ambiguity: did the capability exist before the PR? If yes
it's `enhancement`.

### Area — pick every one the diff touches

Map from the changed paths:

| Changed path | Label |
| --- | --- |
| `Vakaros.Vkx.Parser/**` | `parser` |
| `SailSight.Api/**` | `api` |
| `SailSight.Web/**` | `web` |
| `SailSight.Shared/**` | `shared` |
| `SailSight.Api/Migrations/**`, `Data/Migrations/**`, hypertables, EF model | `database` |
| `SailSight.Api/Auth/**`, `(auth)` routes, Identity, PAT, invitations, teams | `auth` |
| `.github/**`, `Dockerfile*`, `docker-compose*.yml`, `GitVersion.yml` | `infra` |

Two that need judgement:

- **`auth` is cross-cutting**, not a project folder. It pairs with `api` or `web` rather than
  replacing them — an invitation-flow UI change is `web` + `auth`.
- **`database` applies to schema changes**, not to any code that happens to query the DB. A new
  migration or hypertable is `database`; a controller running a new LINQ query is just `api`.

Generated files don't count toward areas on their own — a PR that only changes `api-types.ts`
because the API changed is `api` + `shared`, not `web`.

### Meta — add when it applies

| Label | When |
| --- | --- |
| `breaking change` | Major version bump, a new API version, or a migration that isn't backward-compatible. GitVersion drives releases off `main`, so flag this explicitly. |
| `dependencies` | Dependency bumps (this is Dependabot's default label name) |
| `blocked` | Waiting on external work — don't merge |
| `needs info` | Waiting on more detail before it can proceed |

Do **not** apply `good first issue` or `help wanted` to a PR; they are issue-only, and GitHub
special-cases them for the contribute page.

### Apply them

```bash
gh pr edit <number> --add-label "enhancement" --add-label "web" --add-label "auth"
```

Labels can also go on `gh pr create` directly with repeated `--label` flags. If a label doesn't
exist, `gh` fails the whole command — check `gh label list` rather than inventing a new one.

## 5. Worked examples

| PR | Labels |
| --- | --- |
| Rework the current-data dashboard readouts | `enhancement` `web` |
| Fix heel gauge drifting during scrub | `bug` `web` |
| Add a weather-overlay endpoint + DTO + UI | `feature` `api` `shared` `web` |
| Add mark rounding radius (new column + migration) | `feature` `api` `database` `shared` `web` |
| Speed up track rendering with better downsampling | `performance` `web` |
| Bump Next.js | `chore` `dependencies` `web` |
| Move `/api/v1` to `/api/v2` | `feature` `api` `shared` `breaking change` |
| Correct the VKX format spec | `documentation` `parser` |

## Note on `parser`

`Vakaros.Vkx.Parser` is being extracted into its own NuGet package. It is intentionally kept as-is
— avoid opening PRs against it unless the change is genuinely required here, and prefer landing
parser work in the package once it exists. `label:parser` is the tracking list for that split.
