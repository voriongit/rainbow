/**
 * @fileoverview Shared trust tier and score helpers.
 *
 * Tier resolution delegates to `scoreToTier` from `@vorionsys/basis` after
 * clamping and flooring the score. Basis's inclusive [min, max] integer
 * ranges leave gaps between tiers (e.g. 875 < score < 876) and fall through
 * to T0 for out-of-range values, so fractional scores are floored into the
 * tier whose minimum they have actually reached and clamped to the
 * canonical range first.
 *
 * @module @vorionsys/rainbow/tiers
 */

import { MAX_TRUST_SCORE, MIN_TRUST_SCORE, scoreToTier } from '@vorionsys/basis';

/** Index (0-7) of the highest tier whose minimum the score meets */
export function getTierIndex(score: number): number {
  return scoreToTier(Math.floor(clampScore(score)));
}

/** Tier key (e.g. 'T3') of the highest tier whose minimum the score meets */
export function getTierKey(score: number): string {
  return `T${String(getTierIndex(score))}`;
}

/** Clamp a trust score to the canonical [MIN_TRUST_SCORE, MAX_TRUST_SCORE] range */
export function clampScore(score: number): number {
  return Math.max(MIN_TRUST_SCORE, Math.min(MAX_TRUST_SCORE, score));
}
