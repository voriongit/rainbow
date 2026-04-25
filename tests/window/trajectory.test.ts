import { describe, it, expect } from 'vitest';
import { computeTrajectory } from '../../src/window/trajectory.js';
import type { IngestedSignal } from '../../src/collector/collector-types.js';

function makeSignal(timestamp: Date, delta: number): IngestedSignal {
  return {
    signalId: `sig-${Math.random()}`,
    agentId: 'test',
    tenantId: 'test',
    timestamp,
    success: delta > 0,
    delta,
    blocked: false,
  };
}

describe('computeTrajectory', () => {
  it('returns stable for empty signals', () => {
    const result = computeTrajectory([], 500);
    expect(result.current).toBe(500);
    expect(result.trend).toBe('stable');
    expect(result.velocity).toBe(0);
    expect(result.min).toBe(500);
    expect(result.max).toBe(500);
    expect(result.samples).toHaveLength(0);
  });

  it('detects rising trend', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const signals = [
      makeSignal(new Date(base.getTime() + 1 * 3_600_000), 10),
      makeSignal(new Date(base.getTime() + 2 * 3_600_000), 15),
      makeSignal(new Date(base.getTime() + 3 * 3_600_000), 20),
      makeSignal(new Date(base.getTime() + 4 * 3_600_000), 12),
    ];

    const result = computeTrajectory(signals, 200);
    expect(result.trend).toBe('rising');
    expect(result.velocity).toBeGreaterThan(0);
    expect(result.current).toBe(200 + 10 + 15 + 20 + 12);
    expect(result.min).toBe(200); // Initial is min since all positive
    expect(result.samples).toHaveLength(4);
  });

  it('detects falling trend', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const signals = [
      makeSignal(new Date(base.getTime() + 1 * 3_600_000), -10),
      makeSignal(new Date(base.getTime() + 2 * 3_600_000), -15),
      makeSignal(new Date(base.getTime() + 3 * 3_600_000), -20),
      makeSignal(new Date(base.getTime() + 4 * 3_600_000), -12),
    ];

    const result = computeTrajectory(signals, 500);
    expect(result.trend).toBe('falling');
    expect(result.velocity).toBeLessThan(0);
    expect(result.current).toBe(500 - 10 - 15 - 20 - 12);
  });

  it('clamps score to 0-1000 range', () => {
    const t = new Date('2026-01-01T00:00:00Z');
    const signals = [makeSignal(t, -600)];

    const result = computeTrajectory(signals, 100);
    expect(result.current).toBe(0); // Clamped to 0
    expect(result.min).toBe(0);
  });

  it('tracks min and max correctly', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const signals = [
      makeSignal(new Date(base.getTime() + 1 * 3_600_000), 50),
      makeSignal(new Date(base.getTime() + 2 * 3_600_000), -80),
      makeSignal(new Date(base.getTime() + 3 * 3_600_000), 30),
    ];

    const result = computeTrajectory(signals, 400);
    // 400 -> 450 -> 370 -> 400
    expect(result.min).toBe(370);
    expect(result.max).toBe(450);
  });

  it('detects stable when velocity is near zero', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const signals = [
      makeSignal(new Date(base.getTime() + 1 * 3_600_000), 1),
      makeSignal(new Date(base.getTime() + 2 * 3_600_000), -1),
      makeSignal(new Date(base.getTime() + 3 * 3_600_000), 1),
      makeSignal(new Date(base.getTime() + 4 * 3_600_000), -1),
    ];

    const result = computeTrajectory(signals, 500);
    expect(result.trend).toBe('stable');
  });
});
