import { describe, it, expect } from 'vitest';
import { computeRiskTrend } from '../../src/window/risk-trend.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

/**
 * Canonical P(T) × R contributions (BASIS loss formula):
 *   P(T) = 3 + T (3× at T0 … 10× at T7)
 *   R    = RISK_LEVELS multiplier (READ=1, LOW=3, MEDIUM=5, HIGH=10,
 *          CRITICAL=15, LIFE_CRITICAL=30)
 * Thresholds (RISK_ACCUMULATOR): warning 60, degraded 120, over a rolling
 * 24h window.
 */

const T0 = new Date('2026-01-01T00:00:00Z').getTime();
const HOUR = 60 * 60 * 1_000;

function failure(
  atMs: number,
  opts: Partial<IngestedSignal> = {}
): IngestedSignal {
  return {
    signalId: `sig-${String(atMs)}-${String(Math.random())}`,
    agentId: 'agent-1',
    tenantId: 'test',
    timestamp: new Date(atMs),
    success: false,
    delta: -10,
    blocked: false,
    ...opts,
  };
}

describe('computeRiskTrend', () => {
  it('returns zeros for no signals', () => {
    expect(computeRiskTrend([])).toEqual({
      currentAccumulatorValue: 0,
      peakInWindow: 0,
      warningBreaches: 0,
      degradedBreaches: 0,
      trend: 'stable',
      samples: [],
      excludedFromAccumulator: 0,
    });
  });

  it('contributes P(tierAfter) × R per failure', () => {
    // T0 HIGH → 3 × 10 = 30; T7 CRITICAL → 10 × 15 = 150; T3 MEDIUM → 6 × 5 = 30
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'HIGH', tierAfter: 0 }),
      failure(T0 + HOUR, { riskLevel: 'CRITICAL', tierAfter: 7 }),
      failure(T0 + 2 * HOUR, { riskLevel: 'MEDIUM', tierAfter: 3 }),
    ]);

    expect(result.samples.map((s) => s.value)).toEqual([30, 180, 210]);
    expect(result.currentAccumulatorValue).toBe(210);
    expect(result.peakInWindow).toBe(210);
    expect(result.excludedFromAccumulator).toBe(0);
  });

  it('scales the same risk level by tier (T7 loses more than T0)', () => {
    const t0 = computeRiskTrend([failure(T0, { riskLevel: 'HIGH', tierAfter: 0 })]);
    const t7 = computeRiskTrend([failure(T0, { riskLevel: 'HIGH', tierAfter: 7 })]);

    expect(t0.currentAccumulatorValue).toBe(30); // 3 × 10
    expect(t7.currentAccumulatorValue).toBe(100); // 10 × 10
  });

  it('excludes failures without tierAfter and reports the under-count', () => {
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'HIGH' }), // no tierAfter → excluded
      failure(T0 + HOUR, { riskLevel: 'HIGH', tierAfter: 2 }), // 5 × 10 = 50
    ]);

    expect(result.excludedFromAccumulator).toBe(1);
    expect(result.currentAccumulatorValue).toBe(50);
    expect(result.peakInWindow).toBe(50);
  });

  it('excludes non-finite tiers and reports them in the under-count', () => {
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'HIGH', tierAfter: Number.POSITIVE_INFINITY }),
      failure(T0 + HOUR, { riskLevel: 'HIGH', tierAfter: Number.NEGATIVE_INFINITY }),
      failure(T0 + 2 * HOUR, { riskLevel: 'HIGH', tierAfter: Number.NaN }),
      failure(T0 + 3 * HOUR, { riskLevel: 'HIGH', tierAfter: 0 }), // 30
    ]);

    expect(result.excludedFromAccumulator).toBe(3);
    expect(result.currentAccumulatorValue).toBe(30);
  });

  it('sums duplicate-timestamp failures into a single sample', () => {
    // Two T0 HIGH failures at the same instant: 30 + 30 = 60, one sample
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'HIGH', tierAfter: 0 }),
      failure(T0, { riskLevel: 'HIGH', tierAfter: 0 }),
    ]);

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].value).toBe(60);
  });

  it('expires a contribution at exactly the 24h boundary (exclusive lower bound)', () => {
    // Window at ts is (ts - 24h, ts]: a failure exactly 24h old is out.
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'MEDIUM', tierAfter: 3 }), // 30
      failure(T0 + 24 * HOUR, { riskLevel: 'MEDIUM', tierAfter: 3 }), // 30, alone
    ]);

    expect(result.samples.map((s) => s.value)).toEqual([30, 30]);
    expect(result.peakInWindow).toBe(30);
  });

  it('excludes unknown risk levels and out-of-range tiers', () => {
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'WILD', tierAfter: 3 }), // unknown level
      failure(T0 + HOUR, { riskLevel: 'LOW', tierAfter: 9 }), // tier out of range
      failure(T0 + 2 * HOUR, { riskLevel: 'LOW', tierAfter: -1 }), // tier out of range
      failure(T0 + 3 * HOUR, { riskLevel: 'LOW', tierAfter: 1 }), // 4 × 3 = 12
    ]);

    expect(result.excludedFromAccumulator).toBe(3);
    expect(result.currentAccumulatorValue).toBe(12);
  });

  it('truncates fractional in-range tiers', () => {
    // trunc(3.7) = 3 → P = 6; 6 × 5 = 30
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'MEDIUM', tierAfter: 3.7 }),
    ]);

    expect(result.currentAccumulatorValue).toBe(30);
    expect(result.excludedFromAccumulator).toBe(0);
  });

  it('ignores successes and blocked signals entirely', () => {
    const result = computeRiskTrend([
      failure(T0, { success: true, riskLevel: 'HIGH', tierAfter: 5 }),
      failure(T0 + HOUR, { blocked: true, riskLevel: 'HIGH', tierAfter: 5 }),
      failure(T0 + 2 * HOUR, { riskLevel: 'HIGH', tierAfter: 0 }), // 30
    ]);

    expect(result.currentAccumulatorValue).toBe(30);
    // Non-contributing successes/blocked signals are not "excluded failures"
    expect(result.excludedFromAccumulator).toBe(0);
  });

  it('counts rising-edge threshold breaches across the rolling 24h window', () => {
    // T3 MEDIUM = 30 each.
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'MEDIUM', tierAfter: 3 }), // 30
      failure(T0 + 1 * HOUR, { riskLevel: 'MEDIUM', tierAfter: 3 }), // 60 → warning rises
      failure(T0 + 30 * HOUR, { riskLevel: 'MEDIUM', tierAfter: 3 }), // first two expired → 30
      failure(T0 + 31 * HOUR, { riskLevel: 'MEDIUM', tierAfter: 3 }), // 60 → warning rises again
    ]);

    expect(result.samples.map((s) => s.value)).toEqual([30, 60, 30, 60]);
    expect(result.warningBreaches).toBe(2);
    expect(result.degradedBreaches).toBe(0);
    expect(result.peakInWindow).toBe(60);
  });

  it('counts warning and degraded breaches when a single failure clears both', () => {
    // T7 CRITICAL = 150 ≥ 120 ≥ 60
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'READ', tierAfter: 0 }), // 3 — below thresholds
      failure(T0 + HOUR, { riskLevel: 'CRITICAL', tierAfter: 7 }), // 153
    ]);

    expect(result.warningBreaches).toBe(1);
    expect(result.degradedBreaches).toBe(1);
    expect(result.peakInWindow).toBe(153);
  });

  it('reports an escalating trend for rising pressure', () => {
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'LOW', tierAfter: 0 }), // 9
      failure(T0 + HOUR, { riskLevel: 'MEDIUM', tierAfter: 3 }), // 39
      failure(T0 + 2 * HOUR, { riskLevel: 'HIGH', tierAfter: 5 }), // 119
      failure(T0 + 3 * HOUR, { riskLevel: 'CRITICAL', tierAfter: 7 }), // 269
    ]);

    expect(result.trend).toBe('escalating');
  });

  it('reports a de-escalating trend once pressure expires', () => {
    const result = computeRiskTrend([
      failure(T0, { riskLevel: 'CRITICAL', tierAfter: 7 }), // 150
      failure(T0 + 25 * HOUR, { riskLevel: 'LOW', tierAfter: 0 }), // expired → 9
    ]);

    expect(result.trend).toBe('de-escalating');
  });
});
