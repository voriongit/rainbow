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
- **`@vorionsys/contracts@^1.1.0`** (lockfile resolves 1.1.1) — bus signal types.
  `BusSeverity` / `BusSignalType` are re-exported from
  `@vorionsys/contracts/canonical/trust-bus` via `src/contracts-stubs.ts`;
  `tests/contracts-surface.test.ts` pins the exact enum member sets as a tripwire.
- **`uuid@^14`**.

## ⚠️ TypeScript is pinned to 5.x ON PURPOSE — do NOT bump to 6 yet

`@vorionsys/contracts@1.1.x` declares `peerDependencies.typescript: "^5.0.0"`.
rainbow's own code **is verified TS6-ready** (typecheck + full test suite pass under
`tsc 6.0.3`), but `npm ci` fails `ERESOLVE` under TS6 because of that peer. Therefore:

- `devDependencies.typescript` is held at `^5.9.3`.
- `.github/dependabot.yml` ignores `typescript` **major** bumps (with an inline reason).

**The real fix is upstream, not here:** in `vorionsys/contracts`, widen the peer to
`"^5.0.0 || ^6.0.0"`, publish `contracts@1.1.2`. Then in rainbow: bump contracts to
`^1.1.2`, `typescript` to `^6`, delete the dependabot `ignore`, regenerate the
lockfile, PR. That flip is ~5 min and was pre-verified green. Don't paper over the peer
with `.npmrc legacy-peer-deps` — that's a worse, repo-wide workaround.

## Release process (tokenless — no tokens to rotate)

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

- **Upstream contracts peer-widening** → unblocks TS6 here (see TypeScript section).
- Insights are **rule-based**; `RecordedInsight.evidenceChain` is reserved and always
  empty (no proof-plane integration yet).
- Optional hygiene: enable repo "Automatically delete head branches"; prune stale merged
  branches (`decontaminate`, `ci/*`, `fix/drizzle-*`).
- `CHANGELOG.md` `[Unreleased]` describes the decontamination (PR #4) — merged but not
  yet cut into a released version; fold it into the next version bump.
