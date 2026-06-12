/**
 * @fileoverview Shared types for the RAINBOW analytics package.
 *
 * RAINBOW — Recorded Analytics Involving Non-Binary Orchestration Window.
 * Operator-facing analytics abstraction over the Trust Signal Bus.
 *
 * @module @vorionsys/rainbow/types
 */

import type { BusSignalType, BusSeverity } from './contracts-stubs.js';

// ============================================================================
// Window Configuration
// ============================================================================

/** Preset window durations */
export type WindowDuration = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

/** Duration presets in milliseconds */
export const WINDOW_DURATION_MS: Record<Exclude<WindowDuration, 'custom'>, number> = {
  '1h': 60 * 60 * 1_000,
  '6h': 6 * 60 * 60 * 1_000,
  '24h': 24 * 60 * 60 * 1_000,
  '7d': 7 * 24 * 60 * 60 * 1_000,
  '30d': 30 * 24 * 60 * 60 * 1_000,
};

/** Fallback duration applied when `duration === 'custom'` but `customMs` is omitted */
export const DEFAULT_CUSTOM_WINDOW_MS = WINDOW_DURATION_MS['24h'];

/** Configuration for an analytics window query */
export interface WindowConfig {
  /** Window duration preset */
  duration: WindowDuration;
  /** Custom duration in ms (used when duration === 'custom'; falls back to 24h when omitted) */
  customMs?: number;
  /** Single agent or omit for fleet-wide */
  agentId?: string;
  /** Tenant scope */
  tenantId?: string;
}

/** Resolve a window configuration to its duration in milliseconds */
export function resolveWindowDurationMs(config: WindowConfig): number {
  return config.duration === 'custom'
    ? (config.customMs ?? DEFAULT_CUSTOM_WINDOW_MS)
    : WINDOW_DURATION_MS[config.duration];
}

// ============================================================================
// Score Trajectory
// ============================================================================

export type TrustTrend = 'rising' | 'falling' | 'stable';

export interface ScoreTrajectory {
  /** Current trust score */
  current: number;
  /** Overall direction within the window */
  trend: TrustTrend;
  /** Points per hour (positive = rising) */
  velocity: number;
  /** Change in velocity per hour */
  acceleration: number;
  /** Minimum score observed in window */
  min: number;
  /** Maximum score observed in window */
  max: number;
  /** Sampled data points within the window */
  samples: Array<{ timestamp: Date; score: number }>;
}

// ============================================================================
// Signal Distribution
// ============================================================================

export interface SignalDistribution {
  /** Total signals in window */
  total: number;
  /** Counts by outcome */
  byOutcome: { success: number; failure: number; blocked: number };
  /** Counts by bus signal type */
  byType: Partial<Record<BusSignalType, number>>;
  /** Counts by risk level */
  byRiskLevel: Record<string, number>;
  /** Counts by severity */
  bySeverity: Partial<Record<BusSeverity, number>>;
  /** Per-factor success/failure breakdown */
  byFactor: Record<string, { success: number; failure: number }>;
}

// ============================================================================
// State Transitions
// ============================================================================

export interface StateTransitionSummary {
  /** Trust tier promotions in window */
  tierPromotions: number;
  /** Trust tier demotions in window */
  tierDemotions: number;
  /** Circuit breaker hard trips */
  cbTrips: number;
  /** Entries into degraded state */
  cbDegradedEntries: number;
  /** Circuit breaker resets */
  cbResets: number;
  /** Lifecycle state changes with counts */
  lifecycleChanges: Array<{ from: string; to: string; count: number }>;
}

// ============================================================================
// Risk Trend
// ============================================================================

export type RiskEscalation = 'escalating' | 'de-escalating' | 'stable';

export interface RiskTrend {
  /** Current accumulator value */
  currentAccumulatorValue: number;
  /** Peak accumulator value in window */
  peakInWindow: number;
  /** Times the warning threshold was crossed */
  warningBreaches: number;
  /** Times the degraded threshold was crossed */
  degradedBreaches: number;
  /** Overall risk direction */
  trend: RiskEscalation;
  /** Sampled accumulator values */
  samples: Array<{ timestamp: Date; value: number }>;
  /** Failures excluded (missing/invalid tier or unknown risk level) — non-zero means the reconstruction under-counts */
  excludedFromAccumulator: number;
}

// ============================================================================
// Analytics Window Result
// ============================================================================

export interface AnalyticsWindowResult {
  /** Configuration used for this computation */
  windowConfig: WindowConfig;
  /** When this result was computed */
  computedAt: Date;
  /** Agent this result is for (undefined = fleet-wide) */
  agentId?: string;
  /** Score trajectory analysis */
  trajectory: ScoreTrajectory;
  /** Signal distribution breakdown */
  distribution: SignalDistribution;
  /** State transition summary */
  transitions: StateTransitionSummary;
  /** Risk accumulator trend */
  riskTrend: RiskTrend;
}
