import { describe, it, expect } from 'vitest';
import { computeTransitions } from '../../src/window/state-transitions.js';
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

describe('computeTransitions', () => {
  it('counts tier promotions and demotions', () => {
    const signals = [
      makeSignal({ delta: 20 }),  // 190 -> 210 (T0 -> T1)
      makeSignal({ delta: -20 }), // 210 -> 190 (T1 -> T0)
      makeSignal({ delta: 15 }),  // 190 -> 205 (T0 -> T1)
    ];

    const result = computeTransitions(signals, 190);
    expect(result.tierPromotions).toBe(2);
    expect(result.tierDemotions).toBe(1);
  });

  it('does not count fractional boundary-gap scores as transitions', () => {
    // T5 max is 875 and T6 min is 876; 875.5 sits in the integer gap and
    // must remain T5 rather than collapsing to T0 (which would register
    // a demotion followed by a promotion).
    const signals = [
      makeSignal({ delta: 0.5 }), // 875 -> 875.5 (still T5)
      makeSignal({ delta: 0.5 }), // 875.5 -> 876 (T5 -> T6)
    ];

    const result = computeTransitions(signals, 875);
    expect(result.tierDemotions).toBe(0);
    expect(result.tierPromotions).toBe(1);
  });

  it('tracks circuit breaker trips and resets', () => {
    const signals = [
      makeSignal({ success: false, blocked: true, blockReason: 'circuit_breaker' }),
      makeSignal({ success: false, blocked: true, blockReason: 'circuit_breaker' }), // still tripped
      makeSignal({ success: true, blocked: false }), // reset
      makeSignal({ success: false, blocked: true, blockReason: 'circuit_breaker' }), // second trip
    ];

    const result = computeTransitions(signals, 500);
    expect(result.cbTrips).toBe(2);
    expect(result.cbResets).toBe(1);
  });

  it('tracks degraded entries', () => {
    const signals = [
      makeSignal({ success: false, blocked: true, blockReason: 'degraded' }),
      makeSignal({ success: false, blocked: true, blockReason: 'degraded' }), // still degraded
      makeSignal({ success: true, blocked: false }), // exits degraded
      makeSignal({ success: false, blocked: true, blockReason: 'degraded' }), // re-enters
    ];

    const result = computeTransitions(signals, 500);
    expect(result.cbDegradedEntries).toBe(2);
    expect(result.cbTrips).toBe(0);
  });

  it('returns zeros for no signals', () => {
    const result = computeTransitions([], 500);
    expect(result.tierPromotions).toBe(0);
    expect(result.tierDemotions).toBe(0);
    expect(result.cbTrips).toBe(0);
    expect(result.cbResets).toBe(0);
  });
});
