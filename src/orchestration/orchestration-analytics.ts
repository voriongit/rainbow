/**
 * @fileoverview Orchestration analytics coordinator.
 *
 * Assembles fleet distribution, correlation summary, delegation health,
 * and anomaly clusters into a single OrchestrationSnapshot.
 *
 * @module @vorionsys/rainbow/orchestration
 */

import type { IngestedSignal } from '../collector/collector-types.js';
import type { FleetDistribution } from './fleet-distribution.js';
import { computeFleetDistribution, estimateAgentScores } from './fleet-distribution.js';
import type { CorrelationSummary, CorrelationAlertInput } from './correlation-summary.js';
import { computeCorrelationSummary } from './correlation-summary.js';
import type { DelegationHealthSummary, EscalationEvent } from './delegation-health.js';
import { computeDelegationHealth } from './delegation-health.js';
import type { AnomalyCluster } from './anomaly-cluster.js';
import { detectAnomalyClusters } from './anomaly-cluster.js';

// ============================================================================
// Types
// ============================================================================

export interface OrchestrationSnapshot {
  /** When this snapshot was computed */
  computedAt: Date;
  /** Fleet-wide trust distribution */
  fleet: FleetDistribution;
  /** Delegation chain health */
  delegationHealth: DelegationHealthSummary;
  /** Cross-agent correlation summary */
  correlations: CorrelationSummary;
  /** Agents degrading together */
  anomalyClusters: AnomalyCluster[];
}

export interface OrchestrationInput {
  /** All signals within the window */
  signals: IngestedSignal[];
  /** Known agent scores (if available) */
  agentScores?: Map<string, number>;
  /** Correlation alerts from CrossAgentCorrelator */
  correlationAlerts?: CorrelationAlertInput[];
  /** Escalation events from DelegationService */
  escalationEvents?: EscalationEvent[];
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Compute a full orchestration snapshot.
 */
export function computeOrchestrationSnapshot(
  input: OrchestrationInput,
  now: Date = new Date()
): OrchestrationSnapshot {
  // Fleet distribution — use provided scores or estimate from signals
  const agentScores = input.agentScores ?? estimateAgentScores(input.signals);
  const fleet = computeFleetDistribution(agentScores);

  // Delegation health
  const delegationHealth = computeDelegationHealth(input.escalationEvents ?? []);

  // Correlation summary
  const correlations = computeCorrelationSummary(input.correlationAlerts ?? []);

  // Anomaly clusters from signals
  const anomalyClusters = detectAnomalyClusters(input.signals, now);

  return {
    computedAt: now,
    fleet,
    delegationHealth,
    correlations,
    anomalyClusters,
  };
}
