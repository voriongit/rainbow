import { describe, it, expect } from 'vitest';
import { computeFleetDistribution, estimateAgentScores } from '../../src/orchestration/fleet-distribution.js';
import { computeCorrelationSummary } from '../../src/orchestration/correlation-summary.js';
import { computeDelegationHealth } from '../../src/orchestration/delegation-health.js';
import { detectAnomalyClusters } from '../../src/orchestration/anomaly-cluster.js';
import { computeOrchestrationSnapshot } from '../../src/orchestration/orchestration-analytics.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

function makeSignal(
  agentId: string,
  factorCode: string,
  success: boolean,
  timestamp: Date = new Date()
): IngestedSignal {
  return {
    signalId: `sig-${Math.random()}`,
    agentId,
    tenantId: 'test',
    timestamp,
    success,
    factorCode,
    delta: success ? 3 : -5,
    blocked: false,
  };
}

describe('computeFleetDistribution', () => {
  it('computes tier histogram and statistics', () => {
    const scores = new Map([
      ['a1', 100],  // T0
      ['a2', 250],  // T1
      ['a3', 500],  // T3
      ['a4', 700],  // T4
      ['a5', 900],  // T6
    ]);

    const result = computeFleetDistribution(scores);

    expect(result.totalAgents).toBe(5);
    expect(result.byTier['T0']).toBe(1);
    expect(result.byTier['T1']).toBe(1);
    expect(result.byTier['T3']).toBe(1);
    expect(result.byTier['T4']).toBe(1);
    expect(result.byTier['T6']).toBe(1);
    expect(result.averageScore).toBe(490);
    expect(result.medianScore).toBe(500);
    expect(result.standardDeviation).toBeGreaterThan(0);
  });

  it('handles empty fleet', () => {
    const result = computeFleetDistribution(new Map());
    expect(result.totalAgents).toBe(0);
    expect(result.averageScore).toBe(0);
  });
});

describe('estimateAgentScores', () => {
  it('accumulates deltas from signals', () => {
    const signals: IngestedSignal[] = [
      makeSignal('a1', 'CT-COMP', true),
      makeSignal('a1', 'CT-COMP', true),
      makeSignal('a2', 'CT-REL', false),
    ];

    const scores = estimateAgentScores(signals, new Map([['a1', 200], ['a2', 300]]));
    expect(scores.get('a1')).toBe(206); // 200 + 3 + 3
    expect(scores.get('a2')).toBe(295); // 300 + (-5)
  });
});

describe('computeCorrelationSummary', () => {
  it('summarizes alerts by pattern', () => {
    const alerts = [
      { alertId: '1', pattern: 'COLLUSION', agentIds: ['a1', 'a2'], severity: 'warning' as const, description: 'test', detectedAt: new Date() },
      { alertId: '2', pattern: 'SHARED_VULNERABILITY', agentIds: ['a1', 'a3'], severity: 'critical' as const, description: 'test', detectedAt: new Date() },
      { alertId: '3', pattern: 'COLLUSION', agentIds: ['a4', 'a5'], severity: 'warning' as const, description: 'test', detectedAt: new Date() },
    ];

    const result = computeCorrelationSummary(alerts);
    expect(result.totalAlerts).toBe(3);
    expect(result.alertCountByPattern['COLLUSION']).toBe(2);
    expect(result.alertCountByPattern['SHARED_VULNERABILITY']).toBe(1);
    expect(result.mostAffectedAgents[0]!.agentId).toBe('a1'); // appears in 2 alerts
  });

  it('handles empty alerts', () => {
    const result = computeCorrelationSummary([]);
    expect(result.totalAlerts).toBe(0);
    expect(result.mostAffectedAgents).toHaveLength(0);
  });
});

describe('computeDelegationHealth', () => {
  it('detects collusion risk', () => {
    const events = [
      { requestorId: 'a1', handlerId: 'a2', success: true, timestamp: new Date() },
      { requestorId: 'a1', handlerId: 'a2', success: true, timestamp: new Date() },
      { requestorId: 'a1', handlerId: 'a2', success: true, timestamp: new Date() },
      { requestorId: 'a1', handlerId: 'a2', success: true, timestamp: new Date() },
      // a1 sends 100% to a2 (4/4 = 1.0 > 0.8 threshold)
    ];

    const result = computeDelegationHealth(events);
    expect(result.totalEscalations).toBe(4);
    expect(result.successfulEscalations).toBe(4);
    expect(result.potentialCollusionRisk).toBe(true);
    expect(result.topEscalationPairs[0]!.requestor).toBe('a1');
    expect(result.topEscalationPairs[0]!.handler).toBe('a2');
  });

  it('no collusion when distributed', () => {
    const events = [
      { requestorId: 'a1', handlerId: 'a2', success: true, timestamp: new Date() },
      { requestorId: 'a1', handlerId: 'a3', success: true, timestamp: new Date() },
      { requestorId: 'a1', handlerId: 'a4', success: true, timestamp: new Date() },
      { requestorId: 'a1', handlerId: 'a5', success: true, timestamp: new Date() },
    ];

    const result = computeDelegationHealth(events);
    expect(result.potentialCollusionRisk).toBe(false);
  });

  it('handles empty events', () => {
    const result = computeDelegationHealth([]);
    expect(result.totalEscalations).toBe(0);
  });
});

describe('detectAnomalyClusters', () => {
  it('groups agents sharing failing factors', () => {
    const signals = [
      // a1 and a2 both failing CT-COMP
      makeSignal('a1', 'CT-COMP', false),
      makeSignal('a1', 'CT-COMP', false),
      makeSignal('a2', 'CT-COMP', false),
      makeSignal('a2', 'CT-COMP', false),
      // a3 succeeding — not in cluster
      makeSignal('a3', 'CT-COMP', true),
      makeSignal('a3', 'CT-COMP', true),
    ];

    const clusters = detectAnomalyClusters(signals);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.agentIds).toContain('a1');
    expect(clusters[0]!.agentIds).toContain('a2');
    expect(clusters[0]!.agentIds).not.toContain('a3');
    expect(clusters[0]!.commonFactors).toContain('CT-COMP');
  });

  it('returns empty when no clusters found', () => {
    const signals = [
      makeSignal('a1', 'CT-COMP', true),
      makeSignal('a2', 'CT-REL', true),
    ];

    const clusters = detectAnomalyClusters(signals);
    expect(clusters).toHaveLength(0);
  });
});

describe('computeOrchestrationSnapshot', () => {
  it('assembles a full orchestration snapshot', () => {
    const signals = [
      makeSignal('a1', 'CT-COMP', true),
      makeSignal('a2', 'CT-COMP', true),
      makeSignal('a3', 'CT-REL', false),
    ];

    const snapshot = computeOrchestrationSnapshot({
      signals,
      agentScores: new Map([['a1', 400], ['a2', 500], ['a3', 300]]),
      correlationAlerts: [
        { alertId: '1', pattern: 'COLLUSION', agentIds: ['a1', 'a2'], severity: 'warning', description: 'test', detectedAt: new Date() },
      ],
      escalationEvents: [
        { requestorId: 'a3', handlerId: 'a1', success: true, timestamp: new Date() },
      ],
    });

    expect(snapshot.fleet.totalAgents).toBe(3);
    expect(snapshot.correlations.totalAlerts).toBe(1);
    expect(snapshot.delegationHealth.totalEscalations).toBe(1);
    expect(snapshot.anomalyClusters).toBeDefined();
  });
});
