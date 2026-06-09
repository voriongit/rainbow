/**
 * @fileoverview Non-binary state snapshot builder.
 *
 * Assembles a full multi-state view of an agent's trust posture:
 * composite score, tier, lifecycle state, all 16 factor health scores,
 * and observation tier impact analysis.
 *
 * @module @vorionsys/rainbow/state
 */

import type { IngestedSignal } from '../collector/collector-types.js';
import { getTierIndex, getTierKey } from '../tiers.js';
import type { FactorHealth } from './factor-health.js';
import { computeFactorHealth } from './factor-health.js';
import type { ObservationImpactAnalysis } from './observation-impact.js';
import { computeObservationImpact } from './observation-impact.js';

// ============================================================================
// Types
// ============================================================================

export interface NonBinaryStateSnapshot {
  /** Agent ID */
  agentId: string;
  /** When this snapshot was computed */
  snapshotAt: Date;
  /** Current composite trust score */
  compositeScore: number;
  /** Current trust tier (e.g. 'T3') */
  tier: string;
  /** Current lifecycle state */
  lifecycleState: string;
  /** Per-factor health across all 16 trust factors */
  factors: FactorHealth[];
  /** Observation tier impact analysis */
  observationImpact: ObservationImpactAnalysis;
}

/** Context needed to build a snapshot */
export interface StateSnapshotContext {
  /** Agent's current trust score */
  compositeScore: number;
  /** Agent's observation tier key (e.g. 'BLACK_BOX') */
  observationTier: string;
  /** Agent's lifecycle state (e.g. 'ACTIVE') */
  lifecycleState: string;
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Build a non-binary state snapshot for an agent.
 *
 * @param agentId - Agent identifier
 * @param signals - Recent signals for this agent (within analytics window)
 * @param context - Current agent state context
 * @param now - Current time (default: new Date())
 */
export function computeStateSnapshot(
  agentId: string,
  signals: IngestedSignal[],
  context: StateSnapshotContext,
  now: Date = new Date()
): NonBinaryStateSnapshot {
  const tierIndex = getTierIndex(context.compositeScore);
  const tier = getTierKey(context.compositeScore);

  const factors = computeFactorHealth(signals, tierIndex);
  const observationImpact = computeObservationImpact(
    context.observationTier,
    context.compositeScore
  );

  return {
    agentId,
    snapshotAt: now,
    compositeScore: context.compositeScore,
    tier,
    lifecycleState: context.lifecycleState,
    factors,
    observationImpact,
  };
}
