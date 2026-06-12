import { describe, it, expect } from 'vitest';
import { MAX_TRUST_SCORE, MIN_TRUST_SCORE } from '@vorionsys/basis-spec';
import { clampScore, getTierIndex, getTierKey } from '../src/tiers.js';

describe('getTierIndex / getTierKey', () => {
  it('resolves canonical tier boundaries', () => {
    expect(getTierKey(0)).toBe('T0');
    expect(getTierKey(199)).toBe('T0');
    expect(getTierKey(200)).toBe('T1');
    expect(getTierKey(350)).toBe('T2');
    expect(getTierKey(500)).toBe('T3');
    expect(getTierKey(650)).toBe('T4');
    expect(getTierKey(800)).toBe('T5');
    expect(getTierKey(876)).toBe('T6');
    expect(getTierKey(951)).toBe('T7');
    expect(getTierKey(1000)).toBe('T7');
  });

  it('does not collapse fractional scores in tier boundary gaps', () => {
    // TRUST_TIERS ranges are integer-bounded (T5 max 875, T6 min 876);
    // fractional scores in the gap must stay in the lower tier, not fall to T0.
    expect(getTierKey(199.9)).toBe('T0');
    expect(getTierKey(875.5)).toBe('T5');
    expect(getTierIndex(875.5)).toBe(5);
  });

  it('clamps below-range scores to the lowest tier', () => {
    expect(getTierIndex(-50)).toBe(0);
    expect(getTierKey(-50)).toBe('T0');
  });
});

describe('clampScore', () => {
  it('clamps to the canonical score range', () => {
    expect(clampScore(-50)).toBe(MIN_TRUST_SCORE);
    expect(clampScore(1500)).toBe(MAX_TRUST_SCORE);
    expect(clampScore(432.5)).toBe(432.5);
  });
});
