# Changelog

All notable changes to `@vorionsys/rainbow` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

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
