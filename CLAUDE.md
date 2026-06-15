# CLAUDE.md — project memory for `@vorionsys/rainbow`

Durable context for agents/humans. Keep this current when the facts below change.
Last meaningful update: 2026-06-15.

## What this is

RAINBOW — **R**ecorded **A**nalytics **I**nvolving **N**on-**B**inary **O**rchestration
**W**indow. Operator-facing analytics over Trust Signal Bus signals (windowed
trajectory, signal distribution, state transitions, risk-accumulator trends,
per-factor health, fleet orchestration, rule-based insights). Part of the Vorion
governance ecosystem. **ESM-only, Node 18+ runtime (CI uses Node 22).** Published to
npm as `@vorionsys/rainbow`.

## Commands

```bash
npm run build         # tsc
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src
npm test              # vitest run
npm run test:coverage
```

The full CI gate (`.github/workflows/ci.yml`, required check name: **`ci`**) runs:
`npm ci` → `typecheck` → `lint` → `build` → `test:coverage`.

## Ecosystem dependencies — lineage matters (easy to confuse)

- **`@vorionsys/basis-spec@^1.2.0`** — canonical trust constants (`TRUST_FACTORS`,
  `TRUST_TIERS`, `OBSERVATION_TIERS`, `RISK_ACCUMULATOR`, `RISK_LEVELS`,
  `PENALTY_RATIO_MIN/MAX`, `MIN/MAX_TRUST_SCORE`). This **replaced the withdrawn
  `@vorionsys/basis@2.0.0`**, and was **renamed from `@basis-spec/basis`** before its
  first publish. Any reference to `@vorionsys/basis` or `@basis-spec/basis` is stale.
  basis-spec exports *parameters*, not helper functions (tier resolution derives from
  `TRUST_TIERS` directly).
- **`@vorionsys/contracts@^1.1.2`** — bus signal types.
  `BusSeverity` / `BusSignalType` are re-exported from
  `@vorionsys/contracts/canonical/trust-bus` via `src/contracts-stubs.ts`;
  `tests/contracts-surface.test.ts` pins the exact enum member sets as a tripwire.
  (`1.1.2` widened its `typescript` peer to `^5.0.0 || ^6.0.0` — that's what
  unblocked the TS6 bump below.)
- **`uuid@^14`**.

## TypeScript 6 (resolved 2026-06-15)

rainbow is on **TypeScript 6** (`devDependencies.typescript: ^6.0.3`). The earlier
`ERESOLVE`-on-TS6 blocker is gone: `@vorionsys/contracts@1.1.2` widened its peer to
`"^5.0.0 || ^6.0.0"`, so `npm ci` resolves cleanly with TS6 and `contracts@^1.1.2`.
Verified green (typecheck + lint + build + 115 tests under `tsc 6.0.3`). The dependabot
`typescript`-major ignore was removed. Don't paper over peer conflicts with
`.npmrc legacy-peer-deps` — fix the upstream peer instead, as was done here.

- `.github/workflows/release.yml` triggers on pushing a `v*` tag or `workflow_dispatch`.
  Uses GitHub OIDC **trusted publishing** + `npm publish --provenance`. Requires the
  repo to be **public** and a **trusted-publisher binding** configured on npmjs.com for
  this repo+workflow.
- The workflow has an **idempotency guard**: it checks `npm view <pkg>@<version>` and
  skips the gates+publish if that version is already on the registry — so re-pushed tags
  and re-dispatches are safe no-ops (not red duplicate-publish failures).
- To cut a release: bump `version` in package.json (+ CHANGELOG) via PR → merge to main
  → `git tag -a vX.Y.Z <merge-sha> && git push origin vX.Y.Z`.
- **Tag pushes must come from a normal local clone.** This managed/web environment pushes
  through a scoped git proxy that only accepts the working branch; it silently drops tag
  pushes. (The human maintainer pushes tags.)

## Published state (as of 2026-06-15)

- **`@vorionsys/rainbow@0.2.1`** is the only published version and `latest`, built by CI
  from `main` with SLSA provenance. GitHub Release `v0.2.1` exists.
- `0.2.0` was published from a divergent checkout, deprecated, then unpublished. npm
  **burns unpublished version strings permanently** — never attempt to republish `0.2.0`.

## Repo conventions

- **`main` is protected** (ruleset: PR required + `ci` status check + branch up-to-date).
  All changes go through a PR; merging a second Dependabot PR usually requires updating
  its branch onto the new main first (it goes `behind`).
- When merging multiple dependency PRs, **verify the *combination* builds locally before
  merging** — two independently-green PRs once broke `main` when combined (a TS6-vs-peer
  ERESOLVE). The lockfile that lands on main is the git-merge of both branches; confirm
  the post-merge main `ci` run is green, not just each PR.
- Dependabot: weekly npm (dev-deps grouped) + github-actions.
- GitHub squash-merge commits show committer `noreply@github.com` and appear
  "Unverified". That's expected; do **not** rewrite merged commits on `main` to fix it.

## Domain note: risk accumulator formula

`src/window/risk-trend.ts` reconstructs the rolling 24h risk accumulator using the
canonical **`P(T) × R`** contribution: `P(T) = PENALTY_RATIO_MIN + (T/7)·(MAX−MIN)`
(= `3 + T` with canonical defaults, tiers T0–T7) × `RISK_LEVELS[riskLevel].multiplier`
— the same units the `RISK_ACCUMULATOR` thresholds (60/120/240) are calibrated against.
Failures missing `tierAfter` or with an unknown `riskLevel` are **EXCLUDED, never
estimated**, and counted in `RiskTrend.excludedFromAccumulator`. So accumulator values
and breach counts are **lower bounds** when signal sources omit tier data.

## Known follow-ups / queued

- Insights are **rule-based**; `RecordedInsight.evidenceChain` is reserved and always
  empty (no proof-plane integration yet).
- Optional hygiene: enable repo "Automatically delete head branches"; prune stale merged
  branches (`decontaminate`, `ci/*`, `fix/drizzle-*`).
- `CHANGELOG.md` `[Unreleased]` describes the decontamination (PR #4) — merged but not
  yet cut into a released version; fold it into the next version bump.
