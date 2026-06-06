/**
 * @fileoverview Signal distribution computation.
 *
 * Counts signals by outcome, type, risk level, severity, and factor
 * within a window.
 *
 * @module @vorionsys/rainbow/window
 */

import type { BusSignalType, BusSeverity } from '../contracts-stubs.js';
import type { IngestedSignal } from '../collector/collector-types.js';
import type { SignalDistribution } from '../types.js';

/**
 * Compute signal distribution from a set of signals.
 */
export function computeDistribution(signals: IngestedSignal[]): SignalDistribution {
  const byOutcome = { success: 0, failure: 0, blocked: 0 };
  const byType: Partial<Record<BusSignalType, number>> = {};
  const byRiskLevel: Record<string, number> = {};
  const bySeverity: Partial<Record<BusSeverity, number>> = {};
  const byFactor: Record<string, { success: number; failure: number }> = {};

  for (const signal of signals) {
    // Outcome
    if (signal.blocked) {
      byOutcome.blocked++;
    } else if (signal.success) {
      byOutcome.success++;
    } else {
      byOutcome.failure++;
    }

    // Bus signal type
    if (signal.busSignalType) {
      byType[signal.busSignalType] = (byType[signal.busSignalType] ?? 0) + 1;
    }

    // Risk level
    if (signal.riskLevel) {
      byRiskLevel[signal.riskLevel] = (byRiskLevel[signal.riskLevel] ?? 0) + 1;
    }

    // Severity
    if (signal.severity) {
      bySeverity[signal.severity] = (bySeverity[signal.severity] ?? 0) + 1;
    }

    // Factor
    if (signal.factorCode) {
      if (!Object.hasOwn(byFactor, signal.factorCode)) {
        byFactor[signal.factorCode] = { success: 0, failure: 0 };
      }
      const factorStats = byFactor[signal.factorCode];
      if (signal.success) {
        factorStats.success++;
      } else {
        factorStats.failure++;
      }
    }
  }

  return {
    total: signals.length,
    byOutcome,
    byType,
    byRiskLevel,
    bySeverity,
    byFactor,
  };
}
