/**
 * @fileoverview State transition detection within a window.
 *
 * Detects tier promotions/demotions, circuit breaker trips/resets,
 * and lifecycle state changes from sequential signals.
 *
 * @module @vorionsys/rainbow/window
 */

import { TRUST_TIERS } from '@basis-spec/basis';
import type { IngestedSignal } from '../collector/collector-types.js';
import type { StateTransitionSummary } from '../types.js';

/** Trust tier boundaries as sorted array for tier lookup */
const TIER_BOUNDARIES = Object.entries(TRUST_TIERS)
  .map(([key, val]) => ({ tier: key, min: val.min, max: val.max }))
  .sort((a, b) => a.min - b.min);

/** Get tier index (0-7) from a trust score */
function getTierIndex(score: number): number {
  for (let i = TIER_BOUNDARIES.length - 1; i >= 0; i--) {
    if (score >= TIER_BOUNDARIES[i].min) return i;
  }
  return 0;
}

/**
 * Compute state transitions from sequential signals.
 *
 * Tracks tier by reconstructing score from an initial value + deltas,
 * detecting when the tier index changes.
 */
export function computeTransitions(
  signals: IngestedSignal[],
  initialScore: number
): StateTransitionSummary {
  let tierPromotions = 0;
  let tierDemotions = 0;
  let cbTrips = 0;
  let cbDegradedEntries = 0;
  let cbResets = 0;

  let score = initialScore;
  let currentTier = getTierIndex(score);
  let inCb = false;
  let inDegraded = false;

  for (const signal of signals) {
    score += signal.delta;
    score = Math.max(0, Math.min(1000, score));
    const newTier = getTierIndex(score);

    // Tier transitions
    if (newTier > currentTier) tierPromotions++;
    else if (newTier < currentTier) tierDemotions++;
    currentTier = newTier;

    // Circuit breaker detection from block reasons
    if (signal.blockReason === 'circuit_breaker' && !inCb) {
      cbTrips++;
      inCb = true;
    } else if (signal.blockReason === 'degraded' && !inDegraded) {
      cbDegradedEntries++;
      inDegraded = true;
    }

    // Reset detection: a successful non-blocked signal after CB
    if (!signal.blocked && signal.success) {
      if (inCb) {
        cbResets++;
        inCb = false;
      }
      if (inDegraded) {
        inDegraded = false;
      }
    }
  }

  return {
    tierPromotions,
    tierDemotions,
    cbTrips,
    cbDegradedEntries,
    cbResets,
    lifecycleChanges: [], // Populated when lifecycle events are available
  };
}
