import { describe, it, expect } from 'vitest';
import { detectInsights } from '../../src/insight/trend-assertion.js';
import type { AnalyticsWindowResult } from '../../src/types.js';

function makeResult(overrides: Partial<AnalyticsWindowResult> = {}): AnalyticsWindowResult {
  return {
    windowConfig: { duration: '24h', agentId: 'agent-1' },
    computedAt: new Date(),
    agentId: 'agent-1',
    trajectory: {
      current: 500,
      trend: 'stable',
      velocity: 0,
      acceleration: 0,
      min: 490,
      max: 510,
      samples: [],
    },
    distribution: {
      total: 10,
      byOutcome: { success: 8, failure: 2, blocked: 0 },
      byType: {},
      byRiskLevel: {},
      bySeverity: {},
      byFactor: {},
    },
    transitions: {
      tierPromotions: 0,
      tierDemotions: 0,
      cbTrips: 0,
      cbDegradedEntries: 0,
      cbResets: 0,
      lifecycleChanges: [],
    },
    riskTrend: {
      currentAccumulatorValue: 0,
      peakInWindow: 0,
      warningBreaches: 0,
      degradedBreaches: 0,
      trend: 'stable',
      samples: [],
      excludedFromAccumulator: 0,
    },
    ...overrides,
  };
}

describe('detectInsights', () => {
  it('returns empty for stable agent', () => {
    const result = makeResult();
    const insights = detectInsights(result);
    expect(insights).toHaveLength(0);
  });

  it('detects sustained trust decline', () => {
    const result = makeResult({
      trajectory: {
        current: 300,
        trend: 'falling',
        velocity: -8,
        acceleration: -1,
        min: 280,
        max: 500,
        samples: [],
      },
    });

    const insights = detectInsights(result);
    const trend = insights.find((i) => i.category === 'TREND_DETECTED');
    expect(trend).toBeDefined();
    expect(trend!.severity).toBe('warning');
    expect(trend!.agentIds).toContain('agent-1');
    // Insights are rule-based: evidenceChain is reserved for proof-plane
    // integration and stays empty in this version.
    expect(trend!.evidenceChain).toEqual([]);
  });

  it('escalates to critical for fast decline', () => {
    const result = makeResult({
      trajectory: {
        current: 100,
        trend: 'falling',
        velocity: -15,
        acceleration: -2,
        min: 80,
        max: 500,
        samples: [],
      },
    });

    const insights = detectInsights(result);
    const trend = insights.find((i) => i.category === 'TREND_DETECTED');
    expect(trend!.severity).toBe('critical');
  });

  it('detects circuit breaker patterns', () => {
    const result = makeResult({
      transitions: {
        tierPromotions: 0,
        tierDemotions: 2,
        cbTrips: 2,
        cbDegradedEntries: 1,
        cbResets: 1,
        lifecycleChanges: [],
      },
    });

    const insights = detectInsights(result);
    const cb = insights.find((i) => i.category === 'CB_PATTERN');
    expect(cb).toBeDefined();
    expect(cb!.severity).toBe('critical');
  });

  it('detects risk accumulator escalation', () => {
    const result = makeResult({
      riskTrend: {
        currentAccumulatorValue: 80,
        peakInWindow: 130,
        warningBreaches: 2,
        degradedBreaches: 1,
        trend: 'escalating',
        samples: [],
        excludedFromAccumulator: 0,
      },
    });

    const insights = detectInsights(result);
    const acc = insights.find((i) => i.category === 'ACCUMULATOR_ESCALATION');
    expect(acc).toBeDefined();
    expect(acc!.severity).toBe('critical'); // peak 130 >= degraded threshold 120
  });

  it('detects factor degradation', () => {
    const result = makeResult({
      distribution: {
        total: 20,
        byOutcome: { success: 10, failure: 10, blocked: 0 },
        byType: {},
        byRiskLevel: {},
        bySeverity: {},
        byFactor: {
          'CT-COMP': { success: 1, failure: 5 },
          'CT-SAFE': { success: 0, failure: 4 },
        },
      },
    });

    const insights = detectInsights(result);
    const factor = insights.find((i) => i.category === 'FACTOR_DEGRADATION');
    expect(factor).toBeDefined();
    expect(factor!.title).toContain('CT-COMP');
    expect(factor!.title).toContain('CT-SAFE');
  });

  it('detects promotion candidates', () => {
    const result = makeResult({
      trajectory: {
        current: 700,
        trend: 'rising',
        velocity: 3,
        acceleration: 0,
        min: 650,
        max: 700,
        samples: [],
      },
      distribution: {
        total: 15,
        byOutcome: { success: 15, failure: 0, blocked: 0 },
        byType: {},
        byRiskLevel: {},
        bySeverity: {},
        byFactor: {},
      },
    });

    const insights = detectInsights(result);
    const promo = insights.find((i) => i.category === 'PROMOTION_CANDIDATE');
    expect(promo).toBeDefined();
    expect(promo!.severity).toBe('info');
  });

  it('generates multiple insights when conditions overlap', () => {
    const result = makeResult({
      trajectory: {
        current: 150,
        trend: 'falling',
        velocity: -20,
        acceleration: -3,
        min: 100,
        max: 500,
        samples: [],
      },
      transitions: {
        tierPromotions: 0,
        tierDemotions: 3,
        cbTrips: 3,
        cbDegradedEntries: 2,
        cbResets: 0,
        lifecycleChanges: [],
      },
      riskTrend: {
        currentAccumulatorValue: 250,
        peakInWindow: 260,
        warningBreaches: 3,
        degradedBreaches: 2,
        trend: 'escalating',
        samples: [],
        excludedFromAccumulator: 0,
      },
    });

    const insights = detectInsights(result);
    expect(insights.length).toBeGreaterThanOrEqual(3);

    const categories = insights.map((i) => i.category);
    expect(categories).toContain('TREND_DETECTED');
    expect(categories).toContain('CB_PATTERN');
    expect(categories).toContain('ACCUMULATOR_ESCALATION');
  });
});
