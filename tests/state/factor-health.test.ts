import { describe, it, expect } from 'vitest';
import { computeFactorHealth } from '../../src/state/factor-health.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

function makeSignal(
  factorCode: string,
  success: boolean,
  timestamp: Date = new Date()
): IngestedSignal {
  return {
    signalId: `sig-${Math.random()}`,
    agentId: 'agent-1',
    tenantId: 'test',
    timestamp,
    success,
    factorCode,
    delta: success ? 3 : -5,
    blocked: false,
  };
}

describe('computeFactorHealth', () => {
  it('returns all 16 factors', () => {
    const result = computeFactorHealth([], 0);
    expect(result).toHaveLength(16);
  });

  it('computes success rate per factor', () => {
    const signals: IngestedSignal[] = [
      makeSignal('CT-COMP', true),
      makeSignal('CT-COMP', true),
      makeSignal('CT-COMP', false),
      makeSignal('CT-REL', false),
      makeSignal('CT-REL', false),
    ];

    const result = computeFactorHealth(signals, 3); // T3
    const comp = result.find((f) => f.factorCode === 'CT-COMP')!;
    const rel = result.find((f) => f.factorCode === 'CT-REL')!;

    expect(comp.currentScore).toBeCloseTo(2 / 3);
    expect(comp.recentEvidenceCount).toBe(3);
    expect(rel.currentScore).toBe(0);
    expect(rel.recentEvidenceCount).toBe(2);
  });

  it('defaults to healthy (1.0) when no evidence exists', () => {
    const result = computeFactorHealth([], 0);
    for (const factor of result) {
      expect(factor.currentScore).toBe(1.0);
      expect(factor.recentEvidenceCount).toBe(0);
    }
  });

  it('checks meetsMinimum against tier requirements', () => {
    // CT-COMP is requiredFrom T1. At T3, min rate is 0.7
    const signals = [
      makeSignal('CT-COMP', true),
      makeSignal('CT-COMP', false),
      // 50% success rate — below 0.7
    ];

    const result = computeFactorHealth(signals, 3);
    const comp = result.find((f) => f.factorCode === 'CT-COMP')!;
    expect(comp.meetsMinimum).toBe(false);
  });

  it('marks meetsMinimum true when above threshold', () => {
    const signals = [
      makeSignal('CT-COMP', true),
      makeSignal('CT-COMP', true),
      makeSignal('CT-COMP', true),
      makeSignal('CT-COMP', true),
      makeSignal('CT-COMP', false),
      // 80% success rate — above 0.7 (T3 minimum)
    ];

    const result = computeFactorHealth(signals, 3);
    const comp = result.find((f) => f.factorCode === 'CT-COMP')!;
    expect(comp.meetsMinimum).toBe(true);
  });

  it('does not enforce minimum for factors not yet required', () => {
    // SF-ADAPT is requiredFrom T6. At T0, it shouldn't be enforced.
    const signals = [
      makeSignal('SF-ADAPT', false),
      makeSignal('SF-ADAPT', false),
    ];

    const result = computeFactorHealth(signals, 0); // T0
    const adapt = result.find((f) => f.factorCode === 'SF-ADAPT')!;
    expect(adapt.meetsMinimum).toBe(true); // Not enforced at T0
  });

  it('detects factor trend', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const signals: IngestedSignal[] = [
      // First half: all failures
      makeSignal('CT-COMP', false, new Date(base.getTime() + 1000)),
      makeSignal('CT-COMP', false, new Date(base.getTime() + 2000)),
      // Second half: all successes
      makeSignal('CT-COMP', true, new Date(base.getTime() + 3000)),
      makeSignal('CT-COMP', true, new Date(base.getTime() + 4000)),
    ];

    const result = computeFactorHealth(signals, 0);
    const comp = result.find((f) => f.factorCode === 'CT-COMP')!;
    expect(comp.trend).toBe('rising');
  });

  it('includes correct factor metadata', () => {
    const result = computeFactorHealth([], 0);
    const comp = result.find((f) => f.factorCode === 'CT-COMP')!;
    expect(comp.factorName).toBe('Competence');
    expect(comp.group).toBe('Foundation');
    expect(comp.requiredFrom).toBe('T1');
  });
});
