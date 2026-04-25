import { describe, it, expect } from 'vitest';
import { computeStateSnapshot } from '../../src/state/non-binary-state-view.js';
import { computeObservationImpact } from '../../src/state/observation-impact.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

function makeSignal(
  factorCode: string,
  success: boolean
): IngestedSignal {
  return {
    signalId: `sig-${Math.random()}`,
    agentId: 'agent-1',
    tenantId: 'test',
    timestamp: new Date(),
    success,
    factorCode,
    delta: success ? 3 : -5,
    blocked: false,
  };
}

describe('computeStateSnapshot', () => {
  it('builds a complete non-binary snapshot', () => {
    const signals = [
      makeSignal('CT-COMP', true),
      makeSignal('CT-REL', true),
      makeSignal('CT-SAFE', false),
    ];

    const snapshot = computeStateSnapshot('agent-1', signals, {
      compositeScore: 450,
      observationTier: 'BLACK_BOX',
      lifecycleState: 'ACTIVE',
    });

    expect(snapshot.agentId).toBe('agent-1');
    expect(snapshot.compositeScore).toBe(450);
    expect(snapshot.tier).toBe('T2'); // 450 → T2 (350-499)
    expect(snapshot.lifecycleState).toBe('ACTIVE');
    expect(snapshot.factors).toHaveLength(16);
    expect(snapshot.observationImpact.ceiling).toBe(600);
  });

  it('maps score to correct tier', () => {
    const snapshot = computeStateSnapshot('a1', [], {
      compositeScore: 800,
      observationTier: 'WHITE_BOX',
      lifecycleState: 'ACTIVE',
    });

    expect(snapshot.tier).toBe('T5'); // 800 → T5 (800-875)
  });

  it('maps T0 correctly', () => {
    const snapshot = computeStateSnapshot('a1', [], {
      compositeScore: 50,
      observationTier: 'BLACK_BOX',
      lifecycleState: 'PROVISIONING',
    });

    expect(snapshot.tier).toBe('T0');
  });
});

describe('computeObservationImpact', () => {
  it('detects ceiling constraint when near ceiling', () => {
    const result = computeObservationImpact('BLACK_BOX', 590);
    expect(result.ceiling).toBe(600);
    expect(result.ceilingConstraintActive).toBe(true); // 590 >= 600 * 0.95 = 570
  });

  it('no constraint when well below ceiling', () => {
    const result = computeObservationImpact('BLACK_BOX', 300);
    expect(result.ceilingConstraintActive).toBe(false);
  });

  it('shows potential for each tier upgrade', () => {
    const result = computeObservationImpact('BLACK_BOX', 500);
    expect(result.potentialIfUpgraded['BLACK_BOX']).toBe(600);
    expect(result.potentialIfUpgraded['GRAY_BOX']).toBe(750);
    expect(result.potentialIfUpgraded['WHITE_BOX']).toBe(900);
    expect(result.potentialIfUpgraded['ATTESTED_BOX']).toBe(950);
    expect(result.potentialIfUpgraded['VERIFIED_BOX']).toBe(1000);
  });
});
