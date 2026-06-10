# @vorionsys/rainbow

**RAINBOW** — **R**ecorded **A**nalytics **I**nvolving **N**on-**B**inary **O**rchestration **W**indow.

Operator-facing analytics abstraction sitting between the Trust Signal Bus
(raw signals) and dashboards (UI). Provides configurable time-windowed
aggregations (1h / 6h / 24h / 7d / 30d) over trust signals and produces:

- **Trajectory** — trend, velocity, acceleration
- **Signal distribution** — by type and severity
- **State transitions** — between observation/trust tiers
- **Risk accumulator trends** — windowed P/T pressure
- **Per-factor health** — across the 16 canonical trust factors
- **Fleet-wide orchestration** — distribution, delegation health, anomaly clustering
- **Proof-backed insights** — trend detection, CB patterns, accumulator escalation, factor degradation, promotion candidates, dormancy warnings, fleet anomalies, delegation risk

Part of the **Vorion** AI governance ecosystem. RAINBOW consumes
[`@vorionsys/contracts`](https://www.npmjs.com/package/@vorionsys/contracts) bus signal types and
the canonical trust constants from [`@vorionsys/basis`](https://www.npmjs.com/package/@vorionsys/basis).

## Status

Phases 1–4 shipped:

- **Phase 1** — collector (ring buffers), windowed aggregation engine
- **Phase 2** — non-binary state views (16-factor health, observation impact, state snapshots), RAINBOW Zod contracts, `BusSignalType.TREND_DETECTED` + `FLEET_ANOMALY`
- **Phase 3** — fleet-wide orchestration analytics (fleet distribution, delegation health, correlation summary, anomaly clustering)
- **Phase 4** — proof-backed insights, `Rainbow` facade class, `RAINBOW_INSIGHT` proof event type

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
- Zod 3 for runtime contract types
- Node 18+ runtime, Node 22 for CI

## Provenance

This package was extracted as its own polyrepo on **2026-04-24** by
direction of the founder, after its source was found only on a divergent
local clone of the Vorion monorepo and was missing from both remote
mainlines. Per founder note: *"1 rainbow may have gotten stuck in
branches that locked up main, it sb its own repo."*

- **Source path:** `voriongit/vorion/packages/rainbow/`
- **Source clone HEAD:** `3d7ed92d6dba5705bcdd3f951dbd8929eb2f9a3a` (branch `main` of local clone, divergent from voriongit/vorion remote main)
- **Provenance commit (last touched the package on this branch):** `c5f28520ac42e2a45ce01778a4cdea8b1d7138c7` — *chore(npm): normalize author to Vorion LLC across 33 packages, prep vorion-llc transfer* (2026-04-17)
- **Preservation:** Full local clone preserved at `c:/voriongit/_archive/vorion-local-preservation-2026-04-23.tar.gz` and remote safety branch `voriongit/vorion/tree/archive/local-clone-preservation-2026-04-23`.
- **License normalization:** Original `UNLICENSED` flipped to `Apache-2.0` to match the rest of the publicly extracted Vorion ecosystem packages.
- **Scope:** `@vorionsys/rainbow` retained from monorepo `package.json` to match existing npm publishing convention used by `@vorionsys/basis` and `@vorionsys/contracts`.

See [MEMORY.md](https://github.com/voriongit/voriongit-ops) entry `rainbow-package.md` for product context.

## License

[Apache-2.0](./LICENSE) — Copyright (c) 2026 Vorion LLC.
