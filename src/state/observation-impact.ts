/**
 * @fileoverview Observation tier impact analysis.
 *
 * Computes how the current observation tier's ceiling constrains an agent's
 * trust score, and what-if analysis for each potential tier upgrade.
 *
 * @module @vorionsys/rainbow/state
 */

import { OBSERVATION_TIERS } from '@vorionsys/basis';

// ============================================================================
// Types
// ============================================================================

export interface ObservationImpactAnalysis {
  /** Current observation tier name */
  observationTier: string;
  /** Ceiling imposed by current tier */
  ceiling: number;
  /** Agent's current trust score */
  currentScore: number;
  /** Whether the ceiling is actively limiting the agent */
  ceilingConstraintActive: boolean;
  /** Potential max score for each tier upgrade */
  potentialIfUpgraded: Record<string, number>;
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Analyze how the observation tier impacts an agent's trust potential.
 *
 * @param observationTier - Current observation tier key (e.g. 'BLACK_BOX')
 * @param currentScore - Agent's current trust score
 */
export function computeObservationImpact(
  observationTier: string,
  currentScore: number
): ObservationImpactAnalysis {
  const tiers: Record<string, { ceiling: number } | undefined> = OBSERVATION_TIERS;
  const tierEntry = tiers[observationTier];
  const ceiling = tierEntry?.ceiling ?? 600;

  const ceilingConstraintActive = currentScore >= ceiling * 0.95; // Within 5% of ceiling

  // What-if: for each tier, what's the potential max?
  const potentialIfUpgraded: Record<string, number> = {};
  for (const [tierKey, tierVal] of Object.entries(OBSERVATION_TIERS)) {
    potentialIfUpgraded[tierKey] = tierVal.ceiling;
  }

  return {
    observationTier,
    ceiling,
    currentScore,
    ceilingConstraintActive,
    potentialIfUpgraded,
  };
}
