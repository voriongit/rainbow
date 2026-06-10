import { describe, it, expect, afterEach, vi } from 'vitest';
import { Rainbow } from '../src/rainbow.js';
import type { RecordedInsight } from '../src/insight/insight-types.js';

describe('Rainbow facade', () => {
  it('creates a Rainbow instance with defaults', () => {
    const rainbow = new Rainbow();
    expect(rainbow).toBeDefined();
    expect(rainbow.collector).toBeDefined();
    rainbow.dispose();
  });

  it('ingests metrics and computes window', () => {
    const rainbow = new Rainbow();
    const now = new Date('2026-01-01T12:00:00Z');

    // Feed signals
    for (let i = 0; i < 10; i++) {
      rainbow.ingestMetrics({
        agentId: 'agent-1',
        factorCode: 'CT-COMP',
        success: true,
        blocked: false,
        delta: 3,
        durationMs: 5,
        timestamp: new Date(now.getTime() - (60 - i) * 60_000),
      });
    }

    const result = rainbow.computeAnalyticsWindow(
      { duration: '1h', agentId: 'agent-1' },
      now
    );

    expect(result.distribution.total).toBe(10);
    expect(result.distribution.byOutcome.success).toBe(10);
    expect(result.trajectory.trend).toBe('rising');

    rainbow.dispose();
  });

  it('detects insights from window results', () => {
    const rainbow = new Rainbow();
    const now = new Date('2026-01-01T12:00:00Z');

    // Feed failing signals to trigger insights
    for (let i = 0; i < 10; i++) {
      rainbow.ingestMetrics({
        agentId: 'agent-1',
        factorCode: 'CT-COMP',
        success: false,
        blocked: false,
        delta: -10,
        durationMs: 5,
        timestamp: new Date(now.getTime() - (60 - i) * 60_000),
      });
    }

    const result = rainbow.computeAnalyticsWindow(
      { duration: '1h', agentId: 'agent-1' },
      now
    );

    const insights = rainbow.getInsights(result, now);
    expect(insights.length).toBeGreaterThan(0);
    expect(rainbow.latestInsights.length).toBeGreaterThan(0);

    rainbow.dispose();
  });

  it('fires onInsight callback', () => {
    const received: RecordedInsight[] = [];
    const rainbow = new Rainbow({
      onInsight: (i) => received.push(i),
    });
    const now = new Date('2026-01-01T12:00:00Z');

    for (let i = 0; i < 10; i++) {
      rainbow.ingestMetrics({
        agentId: 'a1',
        factorCode: 'CT-COMP',
        success: false,
        blocked: false,
        delta: -15,
        durationMs: 5,
        timestamp: new Date(now.getTime() - (60 - i) * 60_000),
      });
    }

    const result = rainbow.computeAnalyticsWindow({ duration: '1h', agentId: 'a1' }, now);
    rainbow.getInsights(result, now);

    expect(received.length).toBeGreaterThan(0);
    rainbow.dispose();
  });

  it('ingests correlation alerts', () => {
    const rainbow = new Rainbow();
    rainbow.ingestCorrelationAlert({
      agentIds: ['a1', 'a2'],
      pattern: 'COLLUSION',
      severity: 'warning',
      detectedAt: new Date(),
    });

    expect(rainbow.collector.count('a1')).toBe(1);
    expect(rainbow.collector.count('a2')).toBe(1);
    rainbow.dispose();
  });

  it('computes state snapshot', () => {
    const rainbow = new Rainbow();
    const now = new Date('2026-01-01T12:00:00Z');

    rainbow.ingestMetrics({
      agentId: 'a1',
      factorCode: 'CT-COMP',
      success: true,
      blocked: false,
      delta: 5,
      durationMs: 3,
      timestamp: new Date(now.getTime() - 30 * 60_000),
    });

    const snapshot = rainbow.getStateSnapshot('a1', {
      compositeScore: 450,
      observationTier: 'BLACK_BOX',
      lifecycleState: 'ACTIVE',
    }, { duration: '1h', agentId: 'a1' }, now);

    expect(snapshot.agentId).toBe('a1');
    expect(snapshot.compositeScore).toBe(450);
    expect(snapshot.factors).toHaveLength(16);
    expect(snapshot.observationImpact.ceiling).toBe(600);

    rainbow.dispose();
  });

  it('computes orchestration snapshot', () => {
    const rainbow = new Rainbow();
    const now = new Date('2026-01-01T12:00:00Z');

    rainbow.ingestMetrics({
      agentId: 'a1',
      factorCode: 'CT-COMP',
      success: true,
      blocked: false,
      delta: 5,
      durationMs: 3,
      timestamp: new Date(now.getTime() - 30 * 60_000),
    });
    rainbow.ingestMetrics({
      agentId: 'a2',
      factorCode: 'CT-REL',
      success: false,
      blocked: false,
      delta: -3,
      durationMs: 3,
      timestamp: new Date(now.getTime() - 20 * 60_000),
    });

    const snapshot = rainbow.getOrchestrationSnapshot(
      { agentScores: new Map([['a1', 400], ['a2', 300]]) },
      { duration: '1h' },
      now
    );

    expect(snapshot.fleet.totalAgents).toBe(2);
    rainbow.dispose();
  });

  it('dispose clears all state', () => {
    const rainbow = new Rainbow();
    rainbow.ingestMetrics({
      agentId: 'a1',
      factorCode: 'CT-COMP',
      success: true,
      blocked: false,
      delta: 5,
      durationMs: 3,
      timestamp: new Date(),
    });

    rainbow.dispose();
    expect(rainbow.collector.agentIds()).toHaveLength(0);
    expect(rainbow.latestInsights).toHaveLength(0);
  });

  it('latestInsights returns a defensive copy', () => {
    const rainbow = new Rainbow();
    const now = new Date('2026-01-01T12:00:00Z');

    for (let i = 0; i < 10; i++) {
      rainbow.ingestMetrics({
        agentId: 'a1',
        factorCode: 'CT-COMP',
        success: false,
        blocked: false,
        delta: -15,
        durationMs: 5,
        timestamp: new Date(now.getTime() - (60 - i) * 60_000),
      });
    }
    rainbow.insights('1h', now);

    const leaked = rainbow.latestInsights;
    expect(leaked.length).toBeGreaterThan(0);
    leaked.length = 0;
    expect(rainbow.latestInsights.length).toBeGreaterThan(0);

    rainbow.dispose();
  });
});

describe('Rainbow convenience API', () => {
  it('supports the documented ingest/window/insights/fleet flow', () => {
    const rainbow = new Rainbow();
    const now = new Date('2026-01-01T12:00:00Z');

    rainbow.ingest({
      signalId: 'sig-1',
      agentId: 'a1',
      tenantId: 'tenant-1',
      timestamp: new Date(now.getTime() - 60_000),
      success: true,
      factorCode: 'CT-COMP',
      delta: 5,
      blocked: false,
    });

    const fleetWindow = rainbow.window('24h', now);
    expect(fleetWindow.agentId).toBeUndefined();
    expect(fleetWindow.distribution.total).toBe(1);

    const agentWindow = rainbow.window({ duration: '1h', agentId: 'a1' }, now);
    expect(agentWindow.agentId).toBe('a1');
    expect(agentWindow.distribution.total).toBe(1);

    const insights = rainbow.insights('24h', now);
    expect(Array.isArray(insights)).toBe(true);

    const fleet = rainbow.fleet('24h', now);
    expect(fleet.fleet.totalAgents).toBe(1);

    rainbow.dispose();
  });
});

describe('Rainbow auto-compute lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function feedDecliningAgent(rainbow: Rainbow, now: Date): void {
    for (let i = 0; i < 10; i++) {
      rainbow.ingestMetrics({
        agentId: 'agent-1',
        factorCode: 'CT-COMP',
        success: false,
        blocked: false,
        delta: -15,
        durationMs: 5,
        timestamp: new Date(now.getTime() - (60 - i) * 60_000),
      });
    }
  }

  it('honors the configured computeIntervalMs', () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const received: RecordedInsight[] = [];
    const rainbow = new Rainbow({
      computeIntervalMs: 5_000,
      onInsight: (i) => received.push(i),
    });
    feedDecliningAgent(rainbow, now);

    rainbow.start();
    vi.advanceTimersByTime(4_999);
    expect(received).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(received.length).toBeGreaterThan(0);
    expect(rainbow.latestInsights.length).toBeGreaterThan(0);

    rainbow.dispose();
  });

  it('disables auto-compute when the interval is 0', () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const received: RecordedInsight[] = [];
    const rainbow = new Rainbow({
      computeIntervalMs: 0,
      onInsight: (i) => received.push(i),
    });
    feedDecliningAgent(rainbow, now);

    rainbow.start();
    vi.advanceTimersByTime(600_000);
    expect(received).toHaveLength(0);

    rainbow.dispose();
  });

  it('reports auto-compute failures via onError instead of throwing', () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const errors: Array<{ error: unknown; agentId?: string }> = [];
    const rainbow = new Rainbow({
      computeIntervalMs: 1_000,
      resolveInitialScore: () => {
        throw new Error('resolver down');
      },
      onError: (error, agentId) => errors.push({ error, agentId }),
    });
    feedDecliningAgent(rainbow, now);

    rainbow.start();
    expect(() => vi.advanceTimersByTime(1_000)).not.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0]!.agentId).toBe('agent-1');
    expect((errors[0]!.error as Error).message).toBe('resolver down');

    rainbow.dispose();
  });

  it('stop is idempotent and start restarts the timer', () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const received: RecordedInsight[] = [];
    const rainbow = new Rainbow({ onInsight: (i) => received.push(i) });
    feedDecliningAgent(rainbow, now);

    rainbow.start(10_000);
    rainbow.stop();
    rainbow.stop();
    vi.advanceTimersByTime(60_000);
    expect(received).toHaveLength(0);

    rainbow.start(10_000);
    vi.advanceTimersByTime(10_000);
    expect(received.length).toBeGreaterThan(0);

    rainbow.dispose();
  });
});
