/**
 * @fileoverview Per-factor health analysis across the 16 core trust factors.
 *
 * Computes a health snapshot for each factor from recent signals,
 * including trend direction, evidence counts, and whether each factor
 * meets the minimum required for the agent's current tier.
 *
 * @module @vorionsys/rainbow/state
 */

import { TRUST_FACTORS, TRUST_TIERS } from '@vorionsys/basis';
import type { IngestedSignal } from '../collector/collector-types.js';
import type { TrustTrend } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface FactorHealth {
  /** Factor code (e.g. 'CT-COMP') */
  factorCode: string;
  /** Human-readable name */
  factorName: string;
  /** Factor group (Foundation, Security, Agency, Maturity, Evolution) */
  group: string;
  /** Success rate for this factor within the window (0.0-1.0) */
  currentScore: number;
  /** Trend direction for this factor */
  trend: TrustTrend;
  /** Number of evidence signals in window */
  recentEvidenceCount: number;
  /** Most recent evidence timestamp */
  lastEvidenceAt?: Date;
  /** Tier from which this factor is required */
  requiredFrom: string;
  /** Whether current performance meets minimum for agent's tier */
  meetsMinimum: boolean;
}

// ============================================================================
// Tier Minimums
// ============================================================================

/** Tier index from tier name */
const TIER_INDEX: Record<string, number> = {};
for (const [key, val] of Object.entries(TRUST_TIERS)) {
  TIER_INDEX[key] = Object.keys(TRUST_TIERS).indexOf(key);
  TIER_INDEX[val.name] = Object.keys(TRUST_TIERS).indexOf(key);
}

/** Minimum success rate expected per tier — higher tiers require higher rates */
const TIER_MIN_RATES = [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];

// ============================================================================
// Computation
// ============================================================================

/**
 * Compute health for all 16 trust factors from signals within a window.
 *
 * @param signals - Signals within the window (should be filtered to one agent)
 * @param currentTierIndex - Agent's current tier index (0-7)
 */
export function computeFactorHealth(
  signals: IngestedSignal[],
  currentTierIndex: number
): FactorHealth[] {
  // Group signals by factor
  const byFactor = new Map<string, IngestedSignal[]>();
  for (const sig of signals) {
    if (!sig.factorCode) continue;
    const arr = byFactor.get(sig.factorCode) ?? [];
    arr.push(sig);
    byFactor.set(sig.factorCode, arr);
  }

  const results: FactorHealth[] = [];

  for (const [code, factor] of Object.entries(TRUST_FACTORS)) {
    const factorSignals = byFactor.get(code) ?? [];
    const successCount = factorSignals.filter((s) => s.success).length;
    const total = factorSignals.length;
    const currentScore = total > 0 ? successCount / total : 1.0; // No evidence = healthy assumption

    // Trend: compare first half vs second half success rates
    const trend = computeFactorTrend(factorSignals);

    // Last evidence
    const lastEvidenceAt = factorSignals.length > 0
      ? factorSignals[factorSignals.length - 1]!.timestamp
      : undefined;

    // Required from tier
    const requiredFrom = factor.requiredFrom;
    const requiredTierIdx = TIER_INDEX[requiredFrom] ?? 0;

    // Meets minimum: only enforced if agent is at or above the required tier
    const minRate = currentTierIndex >= requiredTierIdx
      ? (TIER_MIN_RATES[currentTierIndex] ?? 0.5)
      : 0; // Not yet required
    const meetsMinimum = currentScore >= minRate;

    results.push({
      factorCode: code,
      factorName: factor.name,
      group: factor.group,
      currentScore,
      trend,
      recentEvidenceCount: total,
      lastEvidenceAt,
      requiredFrom,
      meetsMinimum,
    });
  }

  return results;
}

function computeFactorTrend(signals: IngestedSignal[]): TrustTrend {
  if (signals.length < 4) return 'stable';

  const mid = Math.floor(signals.length / 2);
  const firstHalf = signals.slice(0, mid);
  const secondHalf = signals.slice(mid);

  const firstRate = firstHalf.filter((s) => s.success).length / firstHalf.length;
  const secondRate = secondHalf.filter((s) => s.success).length / secondHalf.length;

  const diff = secondRate - firstRate;
  if (diff > 0.1) return 'rising';
  if (diff < -0.1) return 'falling';
  return 'stable';
}
