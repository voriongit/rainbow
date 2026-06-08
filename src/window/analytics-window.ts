/**
 * @fileoverview Analytics window computation engine.
 *
 * Assembles trajectory, distribution, transitions, and risk trend
 * into a single AnalyticsWindowResult for a given agent and time window.
 *
 * @module @vorionsys/rainbow/window
 */

import type { WindowConfig, AnalyticsWindowResult } from '../types.js';
import { WINDOW_DURATION_MS } from '../types.js';
import type { WindowStore } from './window-store.js';
import { computeTrajectory } from './trajectory.js';
import { computeDistribution } from './signal-distribution.js';
import { computeTransitions } from './state-transitions.js';
import { computeRiskTrend } from './risk-trend.js';

export interface AnalyticsWindowConfig {
  /** Signal storage backend */
  store: WindowStore;
  /**
   * Function to resolve an agent's score at a point in time.
   * Returns the trust score just before the window start.
   * If not provided, estimates from first signal in window.
   */
  resolveInitialScore?: (agentId: string, at: Date) => number;
}

/**
 * Compute a full analytics window result for a single agent.
 */
export function computeWindow(
  config: AnalyticsWindowConfig,
  windowConfig: WindowConfig,
  now: Date = new Date()
): AnalyticsWindowResult {
  const durationMs =
    windowConfig.duration === 'custom'
      ? (windowConfig.customMs ?? 3_600_000)
      : WINDOW_DURATION_MS[windowConfig.duration];

  const from = new Date(now.getTime() - durationMs);
  const agentId = windowConfig.agentId;

  const signals = agentId
    ? config.store.query(agentId, from, now)
    : config.store.queryAll(from, now);

  // Resolve initial score (score at window start, before first signal)
  const initialScore = agentId && config.resolveInitialScore
    ? config.resolveInitialScore(agentId, from)
    : estimateInitialScore(signals);

  return {
    windowConfig,
    computedAt: now,
    agentId,
    trajectory: computeTrajectory(signals, initialScore),
    distribution: computeDistribution(signals),
    transitions: computeTransitions(signals, initialScore),
    riskTrend: computeRiskTrend(signals),
  };
}

/**
 * Estimate the initial score by reverse-engineering from the first signal.
 * If no scoreAfter is available, defaults to 500 (mid-range).
 */
function estimateInitialScore(signals: Array<{ delta: number; scoreAfter?: number }>): number {
  if (signals.length === 0) return 0;
  const first = signals[0];
  if (first.scoreAfter !== undefined) {
    return Math.max(0, Math.min(1000, first.scoreAfter - first.delta));
  }
  return 500; // Best guess when no score data available
}
