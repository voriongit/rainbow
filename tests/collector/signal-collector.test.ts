import { describe, it, expect } from 'vitest';
import { SignalCollector } from '../../src/collector/signal-collector.js';
import type { PipelineMetrics, PipelineBlockedEvent } from '../../src/collector/signal-collector.js';

describe('SignalCollector', () => {
  it('ingests pipeline metrics and stores them', () => {
    const collector = new SignalCollector({ bufferCapacity: 100 });
    const metrics: PipelineMetrics = {
      agentId: 'agent-1',
      factorCode: 'CT-COMP',
      success: true,
      blocked: false,
      delta: 2.5,
      durationMs: 10,
      timestamp: new Date('2026-01-01T12:00:00Z'),
    };

    const ingested = collector.ingestMetrics(metrics);
    expect(ingested.agentId).toBe('agent-1');
    expect(ingested.factorCode).toBe('CT-COMP');
    expect(ingested.success).toBe(true);
    expect(ingested.delta).toBe(2.5);
    expect(collector.count('agent-1')).toBe(1);
  });

  it('ingests blocked events', () => {
    const collector = new SignalCollector();
    const event: PipelineBlockedEvent = {
      agentId: 'agent-2',
      factorCode: 'CT-SAFE',
      blockReason: 'circuit_breaker',
      timestamp: new Date('2026-01-01T12:00:00Z'),
    };

    const ingested = collector.ingestBlocked(event);
    expect(ingested.blocked).toBe(true);
    expect(ingested.blockReason).toBe('circuit_breaker');
    expect(ingested.delta).toBe(0);
  });

  it('queries signals by agent and time range', () => {
    const collector = new SignalCollector();
    const t1 = new Date('2026-01-01T10:00:00Z');
    const t2 = new Date('2026-01-01T12:00:00Z');
    const t3 = new Date('2026-01-01T14:00:00Z');

    collector.ingestMetrics({ agentId: 'a1', factorCode: 'CT-COMP', success: true, blocked: false, delta: 1, durationMs: 5, timestamp: t1 });
    collector.ingestMetrics({ agentId: 'a1', factorCode: 'CT-COMP', success: true, blocked: false, delta: 2, durationMs: 5, timestamp: t2 });
    collector.ingestMetrics({ agentId: 'a1', factorCode: 'CT-COMP', success: true, blocked: false, delta: 3, durationMs: 5, timestamp: t3 });

    const result = collector.query('a1', t1, t2);
    expect(result).toHaveLength(2);
  });

  it('queries all agents', () => {
    const collector = new SignalCollector();
    const t = new Date('2026-01-01T12:00:00Z');

    collector.ingestMetrics({ agentId: 'a1', factorCode: 'CT-COMP', success: true, blocked: false, delta: 1, durationMs: 5, timestamp: t });
    collector.ingestMetrics({ agentId: 'a2', factorCode: 'CT-REL', success: false, blocked: false, delta: -3, durationMs: 5, timestamp: t });

    const all = collector.queryAll(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z'));
    expect(all).toHaveLength(2);
  });

  it('tracks agent IDs', () => {
    const collector = new SignalCollector();
    const t = new Date();
    collector.ingestMetrics({ agentId: 'a1', factorCode: 'CT-COMP', success: true, blocked: false, delta: 1, durationMs: 5, timestamp: t });
    collector.ingestMetrics({ agentId: 'a2', factorCode: 'CT-REL', success: true, blocked: false, delta: 1, durationMs: 5, timestamp: t });

    expect(collector.agentIds()).toContain('a1');
    expect(collector.agentIds()).toContain('a2');
  });

  it('calls onIngested callback', () => {
    const ingested: string[] = [];
    const collector = new SignalCollector({
      onIngested: (s) => ingested.push(s.agentId),
    });

    collector.ingestMetrics({ agentId: 'a1', factorCode: 'CT-COMP', success: true, blocked: false, delta: 1, durationMs: 5, timestamp: new Date() });
    expect(ingested).toEqual(['a1']);
  });

  it('clears agent data', () => {
    const collector = new SignalCollector();
    const t = new Date();
    collector.ingestMetrics({ agentId: 'a1', factorCode: 'CT-COMP', success: true, blocked: false, delta: 1, durationMs: 5, timestamp: t });
    collector.clearAgent('a1');
    expect(collector.count('a1')).toBe(0);
    expect(collector.agentIds()).not.toContain('a1');
  });

  it('ingests pre-formed signals directly and returns the latest', () => {
    const collector = new SignalCollector();
    const t1 = new Date('2026-01-01T12:00:00Z');
    const t2 = new Date('2026-01-01T12:05:00Z');

    collector.ingest({ signalId: 's1', agentId: 'a1', tenantId: 't', timestamp: t1, success: true, delta: 1, blocked: false });
    collector.ingest({ signalId: 's2', agentId: 'a1', tenantId: 't', timestamp: t2, success: false, delta: -1, blocked: false });

    expect(collector.count('a1')).toBe(2);
    expect(collector.latest('a1')?.signalId).toBe('s2');
    expect(collector.latest('unknown')).toBeUndefined();
  });

  it('tags correlation alert signals as fleet anomalies', () => {
    const collector = new SignalCollector();

    const critical = collector.ingestCorrelationAlert({
      agentIds: ['a1', 'a2'],
      pattern: 'COLLUSION',
      severity: 'critical',
      detectedAt: new Date('2026-01-01T12:00:00Z'),
    });
    expect(critical).toHaveLength(2);
    expect(critical[0]!.busSignalType).toBe('fleet_anomaly');
    expect(critical[0]!.severity).toBe('critical');
    expect(critical[0]!.metadata).toMatchObject({ correlationPattern: 'COLLUSION' });

    // 'warning' is not a BusSeverity; it stays in metadata only
    const warning = collector.ingestCorrelationAlert({
      agentIds: ['a3'],
      pattern: 'SHARED_VULNERABILITY',
      severity: 'warning',
      detectedAt: new Date('2026-01-01T12:00:00Z'),
    });
    expect(warning[0]!.severity).toBeUndefined();
    expect(warning[0]!.metadata).toMatchObject({ correlationSeverity: 'warning' });
  });
});
