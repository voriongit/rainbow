/**
 * @fileoverview Fleet-wide trust distribution analysis.
 *
 * Computes histograms, statistics, and breakdowns across all agents
 * in the fleet for a given time window.
 *
 * @module @vorionsys/rainbow/orchestration
 */

import { TRUST_TIERS } from '@vorionsys/basis';
import type { IngestedSignal } from '../collector/collector-types.js';

// ============================================================================
// Types
// ============================================================================

export interface FleetDistribution {
  /** Total agents observed in window */
  totalAgents: number;
  /** Agent count per tier (T0-T7) */
  byTier: Record<string, number>;
  /** Score histogram (50-point buckets) */
  scoreHistogram: Array<{ bucketMin: number; bucketMax: number; count: number }>;
  /** Mean trust score across fleet */
  averageScore: number;
  /** Median trust score */
  medianScore: number;
  /** Standard deviation */
  standardDeviation: number;
}

// ============================================================================
// Tier lookup
// ============================================================================

const TIER_ENTRIES = Object.entries(TRUST_TIERS)
  .map(([key, val]) => ({ key, min: val.min, max: val.max }))
  .sort((a, b) => a.min - b.min);

function getTierKey(score: number): string {
  for (let i = TIER_ENTRIES.length - 1; i >= 0; i--) {
    if (score >= TIER_ENTRIES[i].min) return TIER_ENTRIES[i].key;
  }
  return 'T0';
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Compute fleet-wide trust distribution from per-agent latest scores.
 *
 * @param agentScores - Map of agentId → current trust score
 */
export function computeFleetDistribution(
  agentScores: Map<string, number>
): FleetDistribution {
  const scores = [...agentScores.values()];
  const totalAgents = scores.length;

  if (totalAgents === 0) {
    return {
      totalAgents: 0,
      byTier: {},
      scoreHistogram: buildEmptyHistogram(),
      averageScore: 0,
      medianScore: 0,
      standardDeviation: 0,
    };
  }

  // By tier
  const byTier: Record<string, number> = {};
  for (const score of scores) {
    const tier = getTierKey(score);
    byTier[tier] = (byTier[tier] ?? 0) + 1;
  }

  // Histogram (50-point buckets: 0-49, 50-99, ..., 950-1000)
  const histogram = buildEmptyHistogram();
  for (const score of scores) {
    const bucketIdx = Math.min(Math.floor(score / 50), histogram.length - 1);
    histogram[bucketIdx].count++;
  }

  // Statistics
  const sum = scores.reduce((a, b) => a + b, 0);
  const averageScore = sum / totalAgents;

  const sorted = [...scores].sort((a, b) => a - b);
  const medianScore = totalAgents % 2 === 0
    ? (sorted[totalAgents / 2 - 1] + sorted[totalAgents / 2]) / 2
    : sorted[Math.floor(totalAgents / 2)];

  const variance = scores.reduce((s, v) => s + (v - averageScore) ** 2, 0) / totalAgents;
  const standardDeviation = Math.sqrt(variance);

  return {
    totalAgents,
    byTier,
    scoreHistogram: histogram,
    averageScore,
    medianScore,
    standardDeviation,
  };
}

/**
 * Estimate per-agent scores from signals by accumulating deltas.
 * Used when external score resolver is not available.
 */
export function estimateAgentScores(
  signals: IngestedSignal[],
  initialScores?: Map<string, number>
): Map<string, number> {
  const scores = new Map<string, number>(initialScores ?? []);

  for (const signal of signals) {
    const current = scores.get(signal.agentId) ?? signal.scoreAfter ?? 0;
    const updated = Math.max(0, Math.min(1000, current + signal.delta));
    scores.set(signal.agentId, updated);
  }

  return scores;
}

function buildEmptyHistogram(): Array<{ bucketMin: number; bucketMax: number; count: number }> {
  const buckets: Array<{ bucketMin: number; bucketMax: number; count: number }> = [];
  for (let i = 0; i < 20; i++) {
    buckets.push({
      bucketMin: i * 50,
      bucketMax: i === 19 ? 1000 : (i + 1) * 50 - 1,
      count: 0,
    });
  }
  return buckets;
}
