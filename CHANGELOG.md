# Changelog

All notable changes to `@vorionsys/rainbow` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

Decontamination (PR #4): replaces vendored contract stubs with re-exports,
sources trust constants from the published spec package, corrects the risk
accumulator to the canonical formula, and relabels insights honestly.

### Changed

- **Risk accumulator now uses the canonical `P(T) × R` contribution**
  (BASIS loss formula: `P(T) = 3 + T`, `R = RISK_LEVELS multiplier`).
  Previously each failure contributed `R` alone, which compared
  proxy-unit sums against thresholds (60/120) calibrated for `P(T) × R`
  units. Failure signals without a usable `tierAfter` or with an
  unrecognized `riskLevel` are excluded — never estimated — and counted in
  the new `RiskTrend.excludedFromAccumulator` field. Accumulator values,
  peaks, and breach counts all change for any window containing failures.
- `src/contracts-stubs.ts` no longer vendors `BusSignalType`/`BusSeverity`;
  it re-exports them from `@vorionsys/contracts/canonical/trust-bus`.
  `@vorionsys/contracts@^1.1.0` returns as a real dependency (its
  `drizzle-orm@^0.45.2` resolves clean of CVE-2026-39356; the override
  guard from 0.2.0 is retained). A frozen-surface test pins the exact
  member sets.
- **Trust constants now come from `@vorionsys/basis-spec@^1.2.0`**
  (`TRUST_FACTORS`, `TRUST_TIERS`, `OBSERVATION_TIERS`, `RISK_ACCUMULATOR`,
  `RISK_LEVELS`, `PENALTY_RATIO_MIN/MAX`, `MIN`/`MAX_TRUST_SCORE`),
  replacing the withdrawn `@vorionsys/basis@^2.0.0`. The package was
  renamed from `@basis-spec/basis` before its first publish; tier
  resolution in `src/tiers.ts` derives from `TRUST_TIERS` directly since
  basis-spec deliberately exports parameters, not helper functions.
- Insights relabeled from "proof-backed" to **rule-based**:
  `RecordedInsight.evidenceChain` is reserved for a future proof-plane
  integration and is always empty; docs and README now say so.
- README: removed the internal provenance section; added a scope-and-
  limitations section (rule-based insights, accumulator under-count,
  white-box/synthetic-signal caveats); dropped the unnecessary
  `--legacy-peer-deps` install flag.

### Added

- `RiskTrend.excludedFromAccumulator` — count of failure signals excluded
  from the accumulator reconstruction (documents the under-count).
- Unit tests for `computeRiskTrend` (canonical contributions, exclusion
  semantics, rolling-window breach counting, trend determination).
- Frozen-surface guard test for the re-exported trust-bus enums.
- This changelog.

### Removed

- `zod` dependency (was unused — no `zod` import exists in `src/`) and the
  README claims referencing RAINBOW Zod contracts.

## [0.2.1] — 2026-06-10

Identical source to 0.2.0. Version bump only: the `0.2.0` version number was
consumed by a manual publish from a stale pre-extraction checkout whose
artifact does not correspond to this repository's source (missing the tier
helpers and fleet insight modules, and declaring the retired
`@basis-spec/basis` dependency). That artifact is deprecated; 0.2.1 is the
first registry version built from this repository via CI. Do not use 0.2.0.

## [0.2.0] — 2026-06-10

### Added
- `Rainbow` convenience API matching the documented quick-start: `ingest()`,
  `window()`, `insights()`, `fleet()`, and `fleetInsights()` — each accepts a
  bare duration (`'24h'`) or a full `WindowConfig`. (#6, #7)
- Fleet-level insight detection `detectFleetInsights()`: `FLEET_ANOMALY`
  insights from anomaly clusters and `DELEGATION_RISK` insights from
  delegation collusion pairs. (#7)
- `DORMANCY_WARNING` insights from `DORMANCY_DEDUCTION` bus signals. (#7)
- `DelegationHealthSummary.collusionPairs` — which requestor→handler pairs
  breached the collusion share threshold, with count and share. (#7)
- `RainbowConfig.onError` callback for auto-compute failures. (#6)
- Exported `BusSignalType` / `BusSeverity` (vendored trust-bus enums already
  referenced by public types), `resolveWindowDurationMs()`, and
  `DEFAULT_CUSTOM_WINDOW_MS`. (#6)

### Fixed
- `RainbowConfig.computeIntervalMs` was documented but ignored; `start()` now
  defaults to it. (#6)
- Exceptions during the auto-compute interval no longer crash the host
  process; failures are reported per agent via `onError`. (#6)
- The auto-compute timer is `unref()`ed so a started `Rainbow` never holds
  the process open. (#6)
- `latestInsights` returns a defensive copy instead of the internal array,
  and now reflects the full detection pass (all agents + fleet) instead of
  only the last agent computed. (#6, #7)
- `SignalCollector.clearAgent()` forgets the agent entirely instead of
  leaving a ghost entry in `agentIds()`. (#6)
- `duration: 'custom'` without `customMs` resolved to 1h in `computeWindow`
  but 24h in the facade; it is now 24h everywhere. (#6)
- Anomaly clustering no longer discards a valid cluster when a later agent
  shares a different factor; the common-factor set narrows as agents join.
  (#6)
- Score→tier resolution no longer collapses fractional scores in integer
  tier boundary gaps (e.g. 875.5) to T0; scores are clamped to the canonical
  `MIN_TRUST_SCORE`/`MAX_TRUST_SCORE` range and floored into the tier whose
  minimum they have reached. (#6)

### Changed
- Correlation alerts are ingested with `busSignalType: FLEET_ANOMALY` and a
  mapped `BusSeverity`, so they appear in distribution breakdowns. (#6)
- Auto-compute iterates the window store's agents (the queried source of
  truth) rather than the collector's. (#6)

### Removed
- Unused dependencies `zod` and `@vorionsys/contracts` — the latter was the
  sole path pulling `drizzle-orm` (CVE-2026-39356) into the tree. The
  `drizzle-orm` override is retained as a guard for when `contracts` is
  re-added. (#6)

## [0.1.0] — 2026-04-24

Initial extraction from the Vorion monorepo (`packages/rainbow`) as a
standalone polyrepo: collector (ring buffers), windowed aggregation engine,
non-binary state views, fleet orchestration analytics, proof-backed insight
detection, and the `Rainbow` facade. See README *Provenance*.
