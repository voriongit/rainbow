import { describe, it, expect } from 'vitest';
import { computeDistribution } from '../../src/window/signal-distribution.js';
import { BusSignalType, BusSeverity } from '../../src/contracts-stubs.js';
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

describe('computeDistribution', () => {
  it('counts by outcome', () => {
    const signals = [
      makeSignal({ success: true }),
      makeSignal({ success: false }),
      makeSignal({ success: false, blocked: true }),
    ];

    const result = computeDistribution(signals);
    expect(result.total).toBe(3);
    expect(result.byOutcome).toEqual({ success: 1, failure: 1, blocked: 1 });
  });

  it('counts by bus signal type and severity', () => {
    const signals = [
      makeSignal({ busSignalType: BusSignalType.THREAT_DETECTED, severity: BusSeverity.CRITICAL }),
      makeSignal({ busSignalType: BusSignalType.THREAT_DETECTED, severity: BusSeverity.LOW }),
      makeSignal({ busSignalType: BusSignalType.ANOMALY, severity: BusSeverity.LOW }),
      makeSignal(), // untyped signals are not counted in byType/bySeverity
    ];

    const result = computeDistribution(signals);
    expect(result.byType[BusSignalType.THREAT_DETECTED]).toBe(2);
    expect(result.byType[BusSignalType.ANOMALY]).toBe(1);
    expect(result.bySeverity[BusSeverity.CRITICAL]).toBe(1);
    expect(result.bySeverity[BusSeverity.LOW]).toBe(2);
  });

  it('counts by risk level and factor', () => {
    const signals = [
      makeSignal({ riskLevel: 'HIGH', factorCode: 'CT-COMP', success: true }),
      makeSignal({ riskLevel: 'HIGH', factorCode: 'CT-COMP', success: false }),
      makeSignal({ riskLevel: 'LOW', factorCode: 'CT-REL', success: true }),
    ];

    const result = computeDistribution(signals);
    expect(result.byRiskLevel).toEqual({ HIGH: 2, LOW: 1 });
    expect(result.byFactor['CT-COMP']).toEqual({ success: 1, failure: 1 });
    expect(result.byFactor['CT-REL']).toEqual({ success: 1, failure: 0 });
  });
});
