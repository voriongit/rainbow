import { describe, it, expect } from 'vitest';
import { computeWindow } from '../../src/window/analytics-window.js';
import { MemoryWindowStore } from '../../src/window/memory-window-store.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

function makeSignal(
  agentId: string,
  timestamp: Date,
  opts: Partial<IngestedSignal> = {}
): IngestedSignal {
  return {
    signalId: `sig-${Math.random()}`,
    agentId,
    tenantId: 'test',
    timestamp,
    success: true,
    delta: 5,
    blocked: false,
    ...opts,
  };
}

describe('computeWindow', () => {
  it('computes an analytics window for a single agent', () => {
    const store = new MemoryWindowStore();
    const now = new Date('2026-01-01T12:00:00Z');

    // Add signals in the last hour
    for (let i = 0; i < 10; i++) {
      store.put(
        makeSignal('agent-1', new Date(now.getTime() - (60 - i) * 60_000), {
          factorCode: 'CT-COMP',
          riskLevel: 'LOW',
          delta: 3,
        })
      );
    }

    const result = computeWindow(
      { store, resolveInitialScore: () => 300 },
      { duration: '1h', agentId: 'agent-1' },
      now
    );

    expect(result.windowConfig.duration).toBe('1h');
    expect(result.agentId).toBe('agent-1');
    expect(result.distribution.total).toBe(10);
    expect(result.distribution.byOutcome.success).toBe(10);
    expect(result.trajectory.trend).toBe('rising');
    expect(result.trajectory.current).toBe(330); // 300 + 10 * 3
  });

  it('returns empty results for agent with no signals', () => {
    const store = new MemoryWindowStore();
    const now = new Date('2026-01-01T12:00:00Z');

    const result = computeWindow(
      { store, resolveInitialScore: () => 400 },
      { duration: '24h', agentId: 'agent-1' },
      now
    );

    expect(result.distribution.total).toBe(0);
    expect(result.trajectory.trend).toBe('stable');
    expect(result.trajectory.current).toBe(400);
  });

  it('detects circuit breaker trips in transitions', () => {
    const store = new MemoryWindowStore();
    const now = new Date('2026-01-01T12:00:00Z');

    // Normal signals then CB trip
    store.put(makeSignal('a1', new Date(now.getTime() - 30 * 60_000), { delta: 5 }));
    store.put(makeSignal('a1', new Date(now.getTime() - 20 * 60_000), {
      delta: -200,
      success: false,
      blocked: true,
      blockReason: 'circuit_breaker',
    }));
    store.put(makeSignal('a1', new Date(now.getTime() - 10 * 60_000), {
      delta: 0,
      blocked: true,
      blockReason: 'circuit_breaker',
    }));

    const result = computeWindow(
      { store, resolveInitialScore: () => 300 },
      { duration: '1h', agentId: 'a1' },
      now
    );

    expect(result.transitions.cbTrips).toBe(1);
    expect(result.distribution.byOutcome.blocked).toBe(2);
  });

  it('supports fleet-wide queries (no agentId)', () => {
    const store = new MemoryWindowStore();
    const now = new Date('2026-01-01T12:00:00Z');

    store.put(makeSignal('a1', new Date(now.getTime() - 30 * 60_000)));
    store.put(makeSignal('a2', new Date(now.getTime() - 20 * 60_000)));
    store.put(makeSignal('a3', new Date(now.getTime() - 10 * 60_000)));

    const result = computeWindow(
      { store },
      { duration: '1h' },
      now
    );

    expect(result.distribution.total).toBe(3);
    expect(result.agentId).toBeUndefined();
  });

  it('respects custom window duration', () => {
    const store = new MemoryWindowStore();
    const now = new Date('2026-01-01T12:00:00Z');

    // Signal 2 hours ago (outside 30 min window)
    store.put(makeSignal('a1', new Date(now.getTime() - 2 * 3_600_000)));
    // Signal 15 min ago (inside 30 min window)
    store.put(makeSignal('a1', new Date(now.getTime() - 15 * 60_000)));

    const result = computeWindow(
      { store, resolveInitialScore: () => 500 },
      { duration: 'custom', customMs: 30 * 60_000, agentId: 'a1' },
      now
    );

    expect(result.distribution.total).toBe(1);
  });

  it('counts factor distribution correctly', () => {
    const store = new MemoryWindowStore();
    const now = new Date('2026-01-01T12:00:00Z');

    store.put(makeSignal('a1', new Date(now.getTime() - 30 * 60_000), { factorCode: 'CT-COMP', success: true }));
    store.put(makeSignal('a1', new Date(now.getTime() - 20 * 60_000), { factorCode: 'CT-COMP', success: false, delta: -5 }));
    store.put(makeSignal('a1', new Date(now.getTime() - 10 * 60_000), { factorCode: 'CT-REL', success: true }));

    const result = computeWindow(
      { store, resolveInitialScore: () => 500 },
      { duration: '1h', agentId: 'a1' },
      now
    );

    expect(result.distribution.byFactor['CT-COMP']).toEqual({ success: 1, failure: 1 });
    expect(result.distribution.byFactor['CT-REL']).toEqual({ success: 1, failure: 0 });
  });
});
