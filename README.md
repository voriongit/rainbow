# @vorionsys/rainbow

[![npm version](https://img.shields.io/npm/v/%40vorionsys%2Frainbow)](https://www.npmjs.com/package/@vorionsys/rainbow)
[![CI](https://github.com/voriongit/rainbow/actions/workflows/ci.yml/badge.svg)](https://github.com/voriongit/rainbow/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/%40vorionsys%2Frainbow)](LICENSE)

**RAINBOW** — **R**ecorded **A**nalytics **I**nvolving **N**on-**B**inary **O**rchestration **W**indow.

Operator-facing analytics abstraction sitting between the Trust Signal Bus
(raw signals) and dashboards (UI). Provides configurable time-windowed
aggregations (1h / 6h / 24h / 7d / 30d) over trust signals and produces:

- **Trajectory** — trend, velocity, acceleration
- **Signal distribution** — by type and severity
- **State transitions** — between observation/trust tiers
- **Risk accumulator trends** — windowed reconstruction of the canonical
  P(T) × R risk pressure, in the same units as the BASIS accumulator
  thresholds
- **Per-factor health** — across the 16 canonical trust factors
- **Fleet-wide orchestration** — distribution, delegation health, anomaly clustering
- **Rule-based insights** — trend detection, CB patterns, accumulator
  escalation, factor degradation, promotion candidates, dormancy warnings,
  fleet anomalies, delegation risk (`evidenceChain` reserved for the future
  proof-plane integration)

Part of the **Vorion** AI governance ecosystem. RAINBOW consumes
[`@vorionsys/contracts`](https://www.npmjs.com/package/@vorionsys/contracts) bus signal types and
the canonical trust constants from `@vorionsys/basis`.

## Status

Phases 1–4 shipped:

- **Phase 1** — collector (ring buffers), windowed aggregation engine
- **Phase 2** — non-binary state views (16-factor health, observation impact, state snapshots), `BusSignalType.TREND_DETECTED` + `FLEET_ANOMALY`
- **Phase 3** — fleet-wide orchestration analytics (fleet distribution, delegation health, correlation summary, anomaly clustering)
- **Phase 4** — rule-based insights and the `Rainbow` facade class

Phase 5 (dashboard page + API routes) lives in the consuming app, not in this package.

## Install

```bash
npm install @vorionsys/rainbow
```

## Use

```ts
import { Rainbow } from '@vorionsys/rainbow';

const rainbow = new Rainbow({
  // Optional: resolve an agent's score at window start (improves trajectories)
  resolveInitialScore: (agentId, at) => trustEngine.scoreAt(agentId, at),
  // Optional: push detected insights to the bus / proof plane
  onInsight: (insight) => bus.publish(insight),
});

// Ingest from the TrustSignalPipeline callbacks (primary path)
pipeline.onSignalProcessed = (m) => rainbow.ingestMetrics(m);
pipeline.onBlocked = (e) => rainbow.ingestBlocked(e);

// Or ingest a pre-formed trust signal directly
rainbow.ingest(signal);

// Query windowed views
const window = rainbow.window('24h');                              // fleet-wide
const agent = rainbow.window({ duration: '6h', agentId: 'a-1' });  // per-agent
const insights = rainbow.insights('24h');
const fleet = rainbow.fleet('24h');

// Optional: recompute insights on an interval (never holds the process open)
rainbow.start();   // uses computeIntervalMs (default 60s)
// ...
rainbow.dispose();
```

Submodule entry points are also available:

```ts
import { SignalCollector } from '@vorionsys/rainbow/collector';
import { AnalyticsWindow } from '@vorionsys/rainbow/window';
import { FactorHealth } from '@vorionsys/rainbow/state';
import { FleetDistribution } from '@vorionsys/rainbow/orchestration';
import { TrendAssertion } from '@vorionsys/rainbow/insight';
```

## Scope and limitations

Honest boundaries of what this package does — read before relying on the
numbers:

- **Insights are rule-based, not proof-backed.** `detectInsights` applies
  fixed thresholds to window analytics. The `RecordedInsight.evidenceChain`
  field is reserved for a future proof-plane integration and is **always
  empty** in this version; no insight is backed by proof events.
- **The risk accumulator is a reconstruction, and it under-counts.** Each
  replayed failure contributes the canonical `P(tierAfter) × R(riskLevel)`
  increment, but failure signals missing `tierAfter` (or carrying an
  unrecognized `riskLevel`) are **excluded rather than estimated** — the
  `RiskTrend.excludedFromAccumulator` count reports how many. When signal
  sources omit tier data, accumulator values and breach counts are lower
  bounds, not authoritative replays of the enforcement-side accumulator.
- **Analytics are only as good as the ingested signals.** RAINBOW is a
  white-box view over whatever `IngestedSignal`s you feed it. It does not
  verify signal authenticity, ordering, or completeness; results computed
  from synthetic or partial signal streams describe those streams, not
  production behavior.
- **Trust scores are estimates inside the window.** Trajectories replay
  per-signal deltas from a resolved initial score; they can drift from the
  enforcement-side score when signals are missing from the window store.

## Develop

```bash
npm install
npm run build       # tsc
npm test            # vitest run
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src
npm run test:coverage
```

## Stack

- TypeScript 5.7+ (ES2022, ESM only, `moduleResolution: bundler`)
- Vitest 4 for tests
- Node 18+ runtime, Node 22 for CI

## License

[Apache-2.0](./LICENSE) — Copyright (c) 2026 Vorion LLC.
