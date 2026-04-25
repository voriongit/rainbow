/**
 * @fileoverview Correlation summary — wraps CrossAgentCorrelator output
 * into a RAINBOW-consumable format.
 *
 * @module @vorionsys/rainbow/orchestration
 */

// ============================================================================
// Types (mirrors a3i CorrelationAlert without importing directly)
// ============================================================================

/** Alert from the cross-agent correlator */
export interface CorrelationAlertInput {
  alertId: string;
  pattern: string;
  agentIds: string[];
  severity: 'warning' | 'critical' | 'emergency';
  description: string;
  detectedAt: Date;
}

export interface CorrelationSummary {
  /** Currently active alerts */
  activeAlerts: CorrelationAlertInput[];
  /** Alert count grouped by pattern type */
  alertCountByPattern: Record<string, number>;
  /** Agents most frequently appearing in alerts */
  mostAffectedAgents: Array<{ agentId: string; alertCount: number }>;
  /** Total alert count */
  totalAlerts: number;
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Summarize correlation alerts into an operator-friendly view.
 */
export function computeCorrelationSummary(
  alerts: CorrelationAlertInput[]
): CorrelationSummary {
  const alertCountByPattern: Record<string, number> = {};
  const agentAlertCounts = new Map<string, number>();

  for (const alert of alerts) {
    alertCountByPattern[alert.pattern] = (alertCountByPattern[alert.pattern] ?? 0) + 1;

    for (const agentId of alert.agentIds) {
      agentAlertCounts.set(agentId, (agentAlertCounts.get(agentId) ?? 0) + 1);
    }
  }

  // Sort agents by alert count descending
  const mostAffectedAgents = [...agentAlertCounts.entries()]
    .map(([agentId, alertCount]) => ({ agentId, alertCount }))
    .sort((a, b) => b.alertCount - a.alertCount)
    .slice(0, 10); // Top 10

  return {
    activeAlerts: alerts,
    alertCountByPattern,
    mostAffectedAgents,
    totalAlerts: alerts.length,
  };
}
