/**
 * @fileoverview Shared trust tier and score helpers.
 *
 * Tier resolution derives from `TRUST_TIERS` in `@vorionsys/basis-spec`
 * (the spec package exports canonical parameters, not helper functions).
 * The spec's inclusive [min, max] integer ranges leave gaps between tiers
 * (e.g. 875 < score < 876), so scores are clamped to the canonical range,
 * floored, and resolved to the highest tier whose minimum they have
 * actually reached.
 *
 * @module @vorionsys/rainbow/tiers
 */

import { MAX_TRUST_SCORE, MIN_TRUST_SCORE, TRUST_TIERS } from '@vorionsys/basis-spec';

/** Tier entries sorted by ascending minimum score */
const TIER_ENTRIES = Object.entries(TRUST_TIERS)
  .map(([key, val]) => ({ key, min: val.min }))
  .sort((a, b) => a.min - b.min);

/** Index (0-7) of the highest tier whose minimum the score meets */
export function getTierIndex(score: number): number {
  const floored = Math.floor(clampScore(score));
  for (let i = TIER_ENTRIES.length - 1; i >= 0; i--) {
    if (floored >= TIER_ENTRIES[i].min) return i;
  }
  return 0;
}

/** Tier key (e.g. 'T3') of the highest tier whose minimum the score meets */
export function getTierKey(score: number): string {
  return TIER_ENTRIES[getTierIndex(score)].key;
}

/** Clamp a trust score to the canonical [MIN_TRUST_SCORE, MAX_TRUST_SCORE] range */
export function clampScore(score: number): number {
  return Math.max(MIN_TRUST_SCORE, Math.min(MAX_TRUST_SCORE, score));
}
