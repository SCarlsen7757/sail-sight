---
name: create-pr
description: Open a pull request for SailSight with correctly applied labels. Use whenever the user asks to create/open/raise a PR, or after finishing work on a feature branch. Covers the repo's flat label scheme (type + scope + meta), pre-PR build checks, and how PR labels feed the tag-driven release notes.
---

# Creating a pull request for SailSight

Base branch is always `main`. There is no `develop` branch — just `main` plus feature branches,
and small PRs merged often. CI runs on every PR to `main`: Build API, Build Web, E2E Tests (Playwright against the compose
stack, plus a `screenshots` artifact), non-pushing Docker builds for both images, and the security
workflow (API unit tests, audits, container scans, runtime regressions).

Releases are cut separately by pushing a version tag, never by merging (see *Releasing* below).

## 1. Check the branch

Never open a PR from `main`. If the current branch is `main`, create a feature branch first.

Branch naming is a convention only — nothing parses it since GitVersion was removed. Match the
existing style: `feature/<scope>/<short-description>`.

## 2. Verify the work builds and tests pass

```bash
dotnet build SailSight.slnx   # also regenerates OpenAPI spec + api-types.ts
dotnet test SailSight.Api.Tests
cd SailSight.Web && npm run lint && npm run typecheck && npm run build
```

For changes to `SailSight.Web` or `SailSight.Api` behaviour, also run the E2E suite (stop the dev
stack first):

```bash
cd SailSight.Web
npm run e2e:up && npm run seed && npm run test:e2e
npm run screenshots          # only if the UI changed; commit the updated docs/screenshots/*.png
npm run e2e:down
```

If `dotnet build SailSight.slnx` changed `SailSight.Api/OpenApi/SailSight.Api.json` or
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
| Scope | blue / teal / green | **One or more.** Every PR gets at least one. |
| Meta / workflow | neutrals, purple | Only when it applies. |

### Type — pick exactly one

| Label | Use for |
| --- | --- |
| `bug` | Something isn't working as intended |
| `security` | Auth, authorization, or data-exposure concern |
| `feature` | New capability, or an improvement to an existing one |
| `performance` | Speed, memory, query cost, or render cost |
| `refactor` | Internal restructuring with no behaviour change |
| `documentation` | README, guides, integration documentation, or code comments (the VKX format spec lives in the parser repository) |
| `chore` | Build, tooling, dependencies, or cleanup |

`feature` deliberately covers both brand-new capabilities and improvements to existing ones — the
old `feature` / `enhancement` split forced a judgement call that carried no useful signal. If a PR
changes behaviour for the better and isn't fixing a defect, it's `feature`.

### Scope — pick every one the diff touches

Scope is a **single flat namespace** answering "which part of the product is this?" — but its
members aren't all the same kind of thing, and the colour says which kind:

| Colour | Kind | Labels |
| --- | --- | --- |
| Blue `#1d76db` | **Project** — a build artifact, a place in the tree | `api` `web` `shared` `infra` |
| Teal `#0f8b8d` | **Hybrid** — both a place *and* a domain | `parser` `database` `auth` |
| Green | **Domain** — a product feature, no single home | *(reserved, none yet)* |

Map from the changed paths:

| Changed path | Label |
| --- | --- |
| `VkxIngestion*`, `RaceDetectionService`, the `Vakaros.Vkx.Parser.NET` package reference | `parser` |
| `SailSight.Api/**` | `api` |
| `SailSight.Web/**` | `web` |
| `SailSight.Shared/**` | `shared` |
| `SailSight.Api/Migrations/**`, `Data/Migrations/**`, hypertables, EF model | `database` |
| `SailSight.Api/Auth/**`, `(auth)` routes, Identity, invitations, teams | `auth` |
| `.github/**`, `Dockerfile*`, `docker-compose*.yml` | `infra` |

The teal labels are the ones that need judgement, because a path match alone doesn't settle them:

- **`auth`** is cross-cutting, not a project folder. It pairs with `api` or `web` rather than
  replacing them — an invitation-flow UI change is `web` + `auth`.
- **`database`** means schema changes, not any code that happens to query the DB. A new migration
  or hypertable is `database`; a controller running a new LINQ query is just `api`.
- **`parser`** is the VKX-format domain inside SailSight: how parsed records are validated, mapped
  and turned into races. It pairs with `api`. The parser itself is the `Vakaros.Vkx.Parser.NET`
  package in its own repository.

Generated files don't count toward scope on their own — a PR that only changes `api-types.ts`
because the API changed is `api` + `shared`, not `web`.

**Adding new scope labels:** green is reserved for pure product domains (`map`, `playback`,
`charts`, `ingestion`, `race-analysis`, …) for when `web` and `api` stop narrowing usefully. Put a
new label in green only if it has no single home in the tree; if it maps to one directory it's
blue, and if it's both it's teal.

### Meta — add when it applies

| Label | When |
| --- | --- |
| `breaking change` | A new API version or an incompatible API/schema/flow change. After stable v1 this signals a major bump; before v1 follow `AGENTS.md`. Nothing computes the version automatically. |
| `dependencies` | Dependency bumps (this is Dependabot's default label name) |
| `blocked` | Waiting on external work — don't merge |
| `needs info` | Waiting on more detail before it can proceed |

Do **not** apply `good first issue` or `help wanted` to a PR; they are issue-only, and GitHub
special-cases them for the contribute page.

### Apply them

```bash
gh pr edit <number> --add-label "feature" --add-label "web" --add-label "auth"
```

Labels can also go on `gh pr create` directly with repeated `--label` flags. If a label doesn't
exist, `gh` fails the whole command — check `gh label list` rather than inventing a new one.

### Why the type label matters at release time

`.github/release.yml` groups generated release notes by **type** label, so the one type label you
pick decides which section the PR lands in. A PR merged without one falls into *Uncategorised*.

Categories match in order and a PR lands in the **first** one it matches, so `breaking change` and
`security` outrank the plain type label a PR also carries — a breaking `feature` is filed under
Breaking Changes, not Features. Scope labels don't affect release notes at all.

If you add or rename a type label, update `.github/release.yml` in the same PR.

## 5. Worked examples

| PR | Labels |
| --- | --- |
| Rework the current-data dashboard readouts | `feature` `web` |
| Fix heel gauge drifting during scrub | `bug` `web` |
| Add a weather-overlay endpoint + DTO + UI | `feature` `api` `shared` `web` |
| Add mark rounding radius (new column + migration) | `feature` `api` `database` `shared` `web` |
| Speed up track rendering with better downsampling | `performance` `web` |
| Bump Next.js | `chore` `dependencies` `web` |
| Move `/api/v1` to `/api/v2` | `feature` `api` `shared` `breaking change` |
| Bump Vakaros.Vkx.Parser.NET and adapt ingestion | `chore` `dependencies` `api` `parser` |
| Redeem-invitation page won't submit | `bug` `web` `auth` |
| Change persisted login-session revocation | `security` `api` `auth` `database` |

## Releasing

Merging never releases anything. A merge to `main` builds both container images with `push: false`;
it does not publish rolling images or change `latest`. Cutting a release is one action:

```bash
git tag v1.2.3 && git push origin v1.2.3
```

That triggers `.github/workflows/publish.yml`, which pushes `1.2.3`, `1.2`, `1` and `latest` for
both images, then publishes a GitHub Release with notes grouped by label. The release is created
only after both images push, so a failed build can't leave a release pointing at missing images.

Nothing computes the version for you — picking the number is a judgement call. Check what's landed
since the last tag and let the labels decide:

```bash
git log $(git describe --tags --abbrev=0)..main --oneline
```

After stable v1, a `breaking change` means a major bump; a `feature` means minor; otherwise
patch. Before v1, follow the pre-v1 policy in `AGENTS.md`; breaking changes do not by themselves
require declaring a stable v1 release. A prerelease tag (`v1.2.3-rc.1`) publishes its exact version but deliberately does **not**
move `latest`.

## Note on `parser`

VKX decoding lives in the [Vakaros.Vkx.Parser.NET](https://github.com/SCarlsen7757/Vakaros.Vkx.Parser.NET)
package. Fix parsing bugs there (it has its own label scheme and release flow), publish a new
version, then bump the package here. `label:parser` in SailSight covers only the integration side.
