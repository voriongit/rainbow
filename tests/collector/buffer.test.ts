import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../../src/collector/buffer.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

function makeSignal(agentId: string, timestamp: Date, delta = 1): IngestedSignal {
  return {
    signalId: `sig-${Date.now()}-${Math.random()}`,
    agentId,
    tenantId: 'test',
    timestamp,
    success: true,
    delta,
    blocked: false,
  };
}

describe('RingBuffer', () => {
  it('stores and retrieves signals', () => {
    const buf = new RingBuffer(100);
    const now = new Date();
    const sig = makeSignal('agent-1', now);
    buf.push(sig);

    expect(buf.size).toBe(1);
    expect(buf.getAll()).toHaveLength(1);
    expect(buf.getAll()[0]!.signalId).toBe(sig.signalId);
  });

  it('evicts oldest when full', () => {
    const buf = new RingBuffer(3);
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-01-01T01:00:00Z');
    const t3 = new Date('2026-01-01T02:00:00Z');
    const t4 = new Date('2026-01-01T03:00:00Z');

    buf.push(makeSignal('a', t1, 1));
    buf.push(makeSignal('a', t2, 2));
    buf.push(makeSignal('a', t3, 3));
    expect(buf.size).toBe(3);

    buf.push(makeSignal('a', t4, 4));
    expect(buf.size).toBe(3);

    const all = buf.getAll();
    expect(all[0]!.delta).toBe(2); // t1 was evicted
    expect(all[2]!.delta).toBe(4);
  });

  it('queries by time range', () => {
    const buf = new RingBuffer(100);
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-01-01T01:00:00Z');
    const t3 = new Date('2026-01-01T02:00:00Z');
    const t4 = new Date('2026-01-01T03:00:00Z');

    buf.push(makeSignal('a', t1));
    buf.push(makeSignal('a', t2));
    buf.push(makeSignal('a', t3));
    buf.push(makeSignal('a', t4));

    const result = buf.query(t2, t3);
    expect(result).toHaveLength(2);
    expect(result[0]!.timestamp).toEqual(t2);
    expect(result[1]!.timestamp).toEqual(t3);
  });

  it('returns latest signal', () => {
    const buf = new RingBuffer(100);
    expect(buf.latest()).toBeUndefined();

    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-01-01T01:00:00Z');
    buf.push(makeSignal('a', t1, 1));
    buf.push(makeSignal('a', t2, 2));

    expect(buf.latest()!.delta).toBe(2);
  });

  it('clears all signals', () => {
    const buf = new RingBuffer(100);
    buf.push(makeSignal('a', new Date()));
    buf.push(makeSignal('a', new Date()));
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.getAll()).toHaveLength(0);
  });

  it('handles capacity of 1', () => {
    const buf = new RingBuffer(1);
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-01-01T01:00:00Z');

    buf.push(makeSignal('a', t1, 1));
    buf.push(makeSignal('a', t2, 2));
    expect(buf.size).toBe(1);
    expect(buf.latest()!.delta).toBe(2);
  });
});
