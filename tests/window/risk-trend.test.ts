import { describe, it, expect } from 'vitest';
import { RISK_ACCUMULATOR } from '@vorionsys/basis';
import { computeRiskTrend } from '../../src/window/risk-trend.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

function makeSignal(opts: Partial<IngestedSignal> = {}): IngestedSignal {
  return {
    signalId: `sig-${Math.random()}`,
    agentId: 'a1',
    tenantId: 'test',
    timestamp: new Date('2026-01-01T12:00:00Z'),
    success: true,
    delta: 0,
    blocked: false,
    ...opts,
  };
}

describe('computeRiskTrend', () => {
  it('returns zeros for no signals', () => {
    const result = computeRiskTrend([]);
    expect(result.currentAccumulatorValue).toBe(0);
    expect(result.peakInWindow).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.samples).toHaveLength(0);
  });

  it('accumulates risk from failures and detects warning breaches', () => {
    const base = new Date('2026-01-01T12:00:00Z').getTime();
    // 6 HIGH failures (multiplier 10) within minutes -> accumulator reaches 60
    const signals = Array.from({ length: 6 }, (_, i) =>
      makeSignal({
        success: false,
        riskLevel: 'HIGH',
        timestamp: new Date(base + i * 60_000),
      })
    );

    const result = computeRiskTrend(signals);
    expect(result.currentAccumulatorValue).toBe(RISK_ACCUMULATOR.warningThreshold);
    expect(result.peakInWindow).toBe(RISK_ACCUMULATOR.warningThreshold);
    expect(result.warningBreaches).toBe(1);
    expect(result.degradedBreaches).toBe(0);
    expect(result.trend).toBe('escalating');
    expect(result.samples).toHaveLength(6);
  });

  it('ignores blocked signals and successes when accumulating', () => {
    const base = new Date('2026-01-01T12:00:00Z').getTime();
    const signals = [
      makeSignal({ success: true, riskLevel: 'HIGH', timestamp: new Date(base) }),
      makeSignal({ success: false, blocked: true, riskLevel: 'HIGH', timestamp: new Date(base + 1_000) }),
      makeSignal({ success: false, riskLevel: 'LOW', timestamp: new Date(base + 2_000) }),
    ];

    const result = computeRiskTrend(signals);
    // Only the unblocked LOW failure contributes (multiplier 3)
    expect(result.currentAccumulatorValue).toBe(3);
    expect(result.warningBreaches).toBe(0);
  });
});
