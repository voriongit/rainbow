/**
 * @fileoverview Trend assertion detection.
 *
 * Scans analytics window results for actionable patterns and generates
 * rule-based RecordedInsights. The `evidenceChain` field is reserved for a
 * future proof-plane integration and is always empty today — insights are
 * derived from window analytics rules, not from proof events.
 *
 * @module @vorionsys/rainbow/insight
 */

import { v4 as uuidv4 } from 'uuid';
import { RISK_ACCUMULATOR } from '@vorionsys/basis-spec';
import type { AnalyticsWindowResult, WindowConfig } from '../types.js';
import type { RecordedInsight, InsightSeverity, InsightCategory } from './insight-types.js';

/**
 * Detect insights from an analytics window result.
 * Returns zero or more insights based on the window data.
 */
export function detectInsights(
  result: AnalyticsWindowResult,
  now: Date = new Date()
): RecordedInsight[] {
  const insights: RecordedInsight[] = [];
  const agentId = result.agentId;
  const config = result.windowConfig;

  // 1. Sustained trust decline
  if (result.trajectory.trend === 'falling' && result.trajectory.velocity < -2) {
    const severity: InsightSeverity =
      result.trajectory.velocity < -10 ? 'critical' :
      result.trajectory.velocity < -5 ? 'warning' : 'info';

    insights.push(makeInsight({
      category: 'TREND_DETECTED',
      severity,
      agentIds: agentId ? [agentId] : [],
      title: agentId
        ? `Agent ${agentId} trust declining at ${Math.abs(result.trajectory.velocity).toFixed(1)} pts/hr`
        : `Fleet trust declining at ${Math.abs(result.trajectory.velocity).toFixed(1)} pts/hr`,
      description: `Trust score has fallen from ${String(result.trajectory.max)} to ${String(result.trajectory.current)} within the ${config.duration} window. Velocity: ${result.trajectory.velocity.toFixed(2)} pts/hr.`,
      windowConfig: config,
      detectedAt: now,
    }));
  }

  // 2. Circuit breaker patterns
  if (result.transitions.cbTrips > 0) {
    const severity: InsightSeverity = result.transitions.cbTrips >= 3 ? 'emergency' :
      result.transitions.cbTrips >= 2 ? 'critical' : 'warning';

    insights.push(makeInsight({
      category: 'CB_PATTERN',
      severity,
      agentIds: agentId ? [agentId] : [],
      title: `${String(result.transitions.cbTrips)} circuit breaker trip(s) in ${config.duration}`,
      description: `Circuit breaker tripped ${String(result.transitions.cbTrips)} time(s) with ${String(result.transitions.cbResets)} reset(s). Degraded entries: ${String(result.transitions.cbDegradedEntries)}.`,
      windowConfig: config,
      detectedAt: now,
    }));
  }

  // 3. Risk accumulator escalation
  if (result.riskTrend.trend === 'escalating' &&
      result.riskTrend.peakInWindow >= RISK_ACCUMULATOR.warningThreshold) {
    const severity: InsightSeverity =
      result.riskTrend.peakInWindow >= RISK_ACCUMULATOR.cbThreshold ? 'emergency' :
      result.riskTrend.peakInWindow >= RISK_ACCUMULATOR.degradedThreshold ? 'critical' : 'warning';

    insights.push(makeInsight({
      category: 'ACCUMULATOR_ESCALATION',
      severity,
      agentIds: agentId ? [agentId] : [],
      title: `Risk accumulator escalating — peak ${result.riskTrend.peakInWindow.toFixed(0)}`,
      description: `24h risk accumulator peaked at ${result.riskTrend.peakInWindow.toFixed(0)} (warning: ${String(RISK_ACCUMULATOR.warningThreshold)}, degraded: ${String(RISK_ACCUMULATOR.degradedThreshold)}, CB: ${String(RISK_ACCUMULATOR.cbThreshold)}). Warning breaches: ${String(result.riskTrend.warningBreaches)}, degraded breaches: ${String(result.riskTrend.degradedBreaches)}.`,
      windowConfig: config,
      detectedAt: now,
    }));
  }

  // 4. Factor degradation (high failure rate)
  const failingFactors = Object.entries(result.distribution.byFactor)
    .filter(([, stats]) => {
      const total = stats.success + stats.failure;
      return total >= 3 && stats.failure / total >= 0.5;
    })
    .map(([factor]) => factor);

  if (failingFactors.length > 0) {
    insights.push(makeInsight({
      category: 'FACTOR_DEGRADATION',
      severity: failingFactors.length >= 3 ? 'critical' : 'warning',
      agentIds: agentId ? [agentId] : [],
      title: `${String(failingFactors.length)} factor(s) degrading: ${failingFactors.join(', ')}`,
      description: `Factors with >50% failure rate in the ${config.duration} window: ${failingFactors.join(', ')}. Total signals: ${String(result.distribution.total)}.`,
      windowConfig: config,
      detectedAt: now,
    }));
  }

  // 5. Promotion candidate (sustained rising with no failures)
  if (result.trajectory.trend === 'rising' &&
      result.distribution.byOutcome.failure === 0 &&
      result.distribution.total >= 10 &&
      result.transitions.tierPromotions === 0) {
    insights.push(makeInsight({
      category: 'PROMOTION_CANDIDATE',
      severity: 'info',
      agentIds: agentId ? [agentId] : [],
      title: agentId
        ? `Agent ${agentId} is a promotion candidate`
        : 'Fleet shows promotion-ready agents',
      description: `${String(result.distribution.total)} signals with 100% success rate and rising trajectory. Current score: ${String(result.trajectory.current)}.`,
      windowConfig: config,
      detectedAt: now,
    }));
  }

  return insights;
}

function makeInsight(params: {
  category: InsightCategory;
  severity: InsightSeverity;
  agentIds: string[];
  title: string;
  description: string;
  windowConfig: WindowConfig;
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}): RecordedInsight {
  return {
    insightId: uuidv4(),
    // Reserved for future proof-plane integration; always empty today.
    // Insights are rule-based — see module fileoverview.
    evidenceChain: [],
    ...params,
  };
}
