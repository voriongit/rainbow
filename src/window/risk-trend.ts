/**
 * @fileoverview Risk accumulator trend analysis within a window.
 *
 * Reconstructs the 24h rolling risk accumulator from failure signals and
 * tracks threshold breaches against canonical parameters.
 *
 * @module @vorionsys/rainbow/window
 */

import { RISK_ACCUMULATOR, RISK_LEVELS } from '@vorionsys/basis';
import type { IngestedSignal } from '../collector/collector-types.js';
import type { RiskTrend, RiskEscalation } from '../types.js';

/** 24h window in ms */
const ACCUMULATOR_WINDOW_MS = RISK_ACCUMULATOR.windowHours * 60 * 60 * 1_000;

/**
 * Compute the risk accumulator trend from signals.
 *
 * Simulates the rolling 24h risk accumulator by replaying failure signals
 * and tracking the value at each point.
 */
export function computeRiskTrend(signals: IngestedSignal[]): RiskTrend {
  if (signals.length === 0) {
    return {
      currentAccumulatorValue: 0,
      peakInWindow: 0,
      warningBreaches: 0,
      degradedBreaches: 0,
      trend: 'stable',
      samples: [],
    };
  }

  // Collect failure events with their risk contribution
  const failureEvents: Array<{ timestamp: Date; riskContribution: number }> = [];

  for (const signal of signals) {
    if (!signal.success && !signal.blocked && signal.riskLevel) {
      const riskLevels: Record<string, { multiplier: number } | undefined> = RISK_LEVELS;
      const riskEntry = riskLevels[signal.riskLevel];
      if (riskEntry) {
        // Simplified: use risk multiplier as contribution
        // Full formula would be P(T) × R, but we don't have tier in signal
        failureEvents.push({
          timestamp: signal.timestamp,
          riskContribution: riskEntry.multiplier,
        });
      }
    }
  }

  // Replay accumulator at each signal timestamp
  const samples: Array<{ timestamp: Date; value: number }> = [];
  let peakInWindow = 0;
  let warningBreaches = 0;
  let degradedBreaches = 0;
  let prevAboveWarning = false;
  let prevAboveDegraded = false;

  // Sample at each signal's timestamp
  const allTimestamps = signals.map((s) => s.timestamp);
  const uniqueTimestamps = [...new Set(allTimestamps.map((t) => t.getTime()))]
    .sort((a, b) => a - b)
    .map((t) => new Date(t));

  for (const ts of uniqueTimestamps) {
    const cutoff = ts.getTime() - ACCUMULATOR_WINDOW_MS;
    // Sum contributions within the rolling 24h window
    const value = failureEvents
      .filter(
        (e) =>
          e.timestamp.getTime() > cutoff && e.timestamp.getTime() <= ts.getTime()
      )
      .reduce((sum, e) => sum + e.riskContribution, 0);

    samples.push({ timestamp: ts, value });
    peakInWindow = Math.max(peakInWindow, value);

    // Track threshold crossings (rising edge only)
    const aboveWarning = value >= RISK_ACCUMULATOR.warningThreshold;
    const aboveDegraded = value >= RISK_ACCUMULATOR.degradedThreshold;

    if (aboveWarning && !prevAboveWarning) warningBreaches++;
    if (aboveDegraded && !prevAboveDegraded) degradedBreaches++;

    prevAboveWarning = aboveWarning;
    prevAboveDegraded = aboveDegraded;
  }

  const currentAccumulatorValue =
    samples.length > 0 ? samples[samples.length - 1].value : 0;

  // Determine trend from first/last quarter values
  const trend = determineTrend(samples);

  return {
    currentAccumulatorValue,
    peakInWindow,
    warningBreaches,
    degradedBreaches,
    trend,
    samples,
  };
}

function determineTrend(
  samples: Array<{ timestamp: Date; value: number }>
): RiskEscalation {
  if (samples.length < 2) return 'stable';

  const quarter = Math.max(1, Math.floor(samples.length / 4));
  const firstAvg =
    samples.slice(0, quarter).reduce((s, v) => s + v.value, 0) / quarter;
  const lastAvg =
    samples.slice(-quarter).reduce((s, v) => s + v.value, 0) / quarter;

  const diff = lastAvg - firstAvg;
  if (diff > 5) return 'escalating';
  if (diff < -5) return 'de-escalating';
  return 'stable';
}
