import { describe, it, expect } from 'vitest';
import { detectFleetInsights } from '../../src/insight/fleet-assertion.js';
import type { OrchestrationSnapshot } from '../../src/orchestration/orchestration-analytics.js';

function makeSnapshot(overrides: Partial<OrchestrationSnapshot> = {}): OrchestrationSnapshot {
  return {
    computedAt: new Date('2026-01-01T12:00:00Z'),
    fleet: {
      totalAgents: 0,
      byTier: {},
      scoreHistogram: [],
      averageScore: 0,
      medianScore: 0,
      standardDeviation: 0,
    },
    delegationHealth: {
      totalEscalations: 0,
      successfulEscalations: 0,
      rejectedEscalations: 0,
      averageResolutionTimeMs: 0,
      topEscalationPairs: [],
      collusionPairs: [],
      potentialCollusionRisk: false,
    },
    correlations: {
      activeAlerts: [],
      alertCountByPattern: {},
      mostAffectedAgents: [],
      totalAlerts: 0,
    },
    anomalyClusters: [],
    ...overrides,
  };
}

describe('detectFleetInsights', () => {
  it('returns empty for a clean snapshot', () => {
    expect(detectFleetInsights(makeSnapshot(), { duration: '24h' })).toHaveLength(0);
  });

  it('maps anomaly clusters to FLEET_ANOMALY insights with severity passthrough', () => {
    const snapshot = makeSnapshot({
      anomalyClusters: [
        {
          clusterId: 'cluster-1',
          agentIds: ['a1', 'a2'],
          commonFactors: ['CT-COMP'],
          detectedAt: new Date('2026-01-01T12:00:00Z'),
          severity: 'warning',
          description: '2 agents sharing failures in CT-COMP',
        },
        {
          clusterId: 'cluster-2',
          agentIds: ['b1', 'b2', 'b3', 'b4', 'b5'],
          commonFactors: ['CT-SAFE'],
          detectedAt: new Date('2026-01-01T12:00:00Z'),
          severity: 'emergency',
          description: '5 agents sharing failures in CT-SAFE',
        },
      ],
    });

    const insights = detectFleetInsights(snapshot, { duration: '24h' });
    expect(insights).toHaveLength(2);
    expect(insights[0]!.category).toBe('FLEET_ANOMALY');
    expect(insights[0]!.severity).toBe('warning');
    expect(insights[0]!.agentIds).toEqual(['a1', 'a2']);
    expect(insights[0]!.title).toContain('CT-COMP');
    expect(insights[0]!.metadata).toMatchObject({ clusterId: 'cluster-1' });
    expect(insights[1]!.severity).toBe('emergency');
  });

  it('maps collusion pairs to DELEGATION_RISK insights', () => {
    const snapshot = makeSnapshot({
      delegationHealth: {
        totalEscalations: 4,
        successfulEscalations: 4,
        rejectedEscalations: 0,
        averageResolutionTimeMs: 100,
        topEscalationPairs: [{ requestor: 'a1', handler: 'a2', count: 4 }],
        collusionPairs: [{ requestor: 'a1', handler: 'a2', count: 4, share: 1 }],
        potentialCollusionRisk: true,
      },
    });

    const insights = detectFleetInsights(snapshot, { duration: '24h' });
    expect(insights).toHaveLength(1);
    expect(insights[0]!.category).toBe('DELEGATION_RISK');
    expect(insights[0]!.severity).toBe('warning'); // count < 5 stays warning even at 100% share
    expect(insights[0]!.agentIds).toEqual(['a1', 'a2']);
  });

  it('escalates DELEGATION_RISK to critical for sustained exclusive routing', () => {
    const snapshot = makeSnapshot({
      delegationHealth: {
        totalEscalations: 6,
        successfulEscalations: 6,
        rejectedEscalations: 0,
        averageResolutionTimeMs: 100,
        topEscalationPairs: [{ requestor: 'a1', handler: 'a2', count: 6 }],
        collusionPairs: [{ requestor: 'a1', handler: 'a2', count: 6, share: 1 }],
        potentialCollusionRisk: true,
      },
    });

    const insights = detectFleetInsights(snapshot, { duration: '24h' });
    expect(insights[0]!.severity).toBe('critical');
  });
});
