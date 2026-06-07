# Changelog

All notable changes to `@vorionsys/rainbow` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/) (0.x: minor may break).

## [0.2.0] - 2026-06-06

Decontamination release: replaces vendored contract stubs with re-exports,
corrects the risk accumulator to the canonical formula, and relabels
insights honestly.

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
  it re-exports them from `@vorionsys/contracts/canonical/trust-bus`
  (requires `@vorionsys/contracts@^1.1.0`). A frozen-surface test pins the
  exact member sets.
- Insights relabeled from "proof-backed" to **rule-based**:
  `RecordedInsight.evidenceChain` is reserved for a future proof-plane
  integration and is always empty; docs and README now say so.
- `repository`/`bugs`/`homepage` now point at the public
  `github.com/vorionsys/rainbow`.
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

## [0.1.0] - 2026-04-24

Initial extraction from the Vorion monorepo as a standalone package
(Phases 1–4: collector, windowed analytics, non-binary state views,
fleet orchestration analytics, rule-based insights, `Rainbow` facade).
