/**
 * @fileoverview Anomaly clustering — groups agents that are degrading together.
 *
 * Identifies clusters of agents experiencing correlated failures,
 * potentially indicating shared vulnerabilities or coordinated issues.
 *
 * @module @vorionsys/rainbow/orchestration
 */

import type { IngestedSignal } from '../collector/collector-types.js';

// ============================================================================
// Types
// ============================================================================

export interface AnomalyCluster {
  /** Unique cluster identifier */
  clusterId: string;
  /** Agents in this cluster */
  agentIds: string[];
  /** Factors that are failing across all agents in the cluster */
  commonFactors: string[];
  /** When the cluster was detected */
  detectedAt: Date;
  /** Cluster severity based on agent count and failure rate */
  severity: 'warning' | 'critical' | 'emergency';
  /** Human-readable description */
  description: string;
}

// ============================================================================
// Computation
// ============================================================================

/** Minimum number of agents sharing failures to form a cluster */
const MIN_CLUSTER_SIZE = 2;
/** Minimum failure rate for a factor to count as "failing" for an agent */
const FAILURE_RATE_THRESHOLD = 0.5;

/**
 * Detect anomaly clusters from signals across multiple agents.
 *
 * Groups agents that share failing factors above the threshold.
 */
export function detectAnomalyClusters(
  signals: IngestedSignal[],
  now: Date = new Date()
): AnomalyCluster[] {
  // Build per-agent, per-factor failure rates
  const agentFactorStats = new Map<string, Map<string, { success: number; failure: number }>>();

  for (const signal of signals) {
    if (!signal.factorCode) continue;

    let factorMap = agentFactorStats.get(signal.agentId);
    if (!factorMap) {
      factorMap = new Map();
      agentFactorStats.set(signal.agentId, factorMap);
    }

    let stats = factorMap.get(signal.factorCode);
    if (!stats) {
      stats = { success: 0, failure: 0 };
      factorMap.set(signal.factorCode, stats);
    }

    if (signal.success) stats.success++;
    else stats.failure++;
  }

  // Find agents with failing factors (failure rate >= threshold)
  const agentFailingFactors = new Map<string, Set<string>>();

  for (const [agentId, factorMap] of agentFactorStats) {
    const failingFactors = new Set<string>();
    for (const [factor, stats] of factorMap) {
      const total = stats.success + stats.failure;
      if (total >= 2 && stats.failure / total >= FAILURE_RATE_THRESHOLD) {
        failingFactors.add(factor);
      }
    }
    if (failingFactors.size > 0) {
      agentFailingFactors.set(agentId, failingFactors);
    }
  }

  // Cluster: group agents by shared failing factors
  const clusters: AnomalyCluster[] = [];
  const visited = new Set<string>();
  let clusterIdx = 0;

  const agentIds = [...agentFailingFactors.keys()];

  for (let i = 0; i < agentIds.length; i++) {
    const agentA = agentIds[i]!;
    if (visited.has(agentA)) continue;

    const clusterAgents = [agentA];
    const factorsA = agentFailingFactors.get(agentA)!;

    for (let j = i + 1; j < agentIds.length; j++) {
      const agentB = agentIds[j]!;
      if (visited.has(agentB)) continue;

      const factorsB = agentFailingFactors.get(agentB)!;
      // Find intersection
      const shared = [...factorsA].filter((f) => factorsB.has(f));
      if (shared.length > 0) {
        clusterAgents.push(agentB);
      }
    }

    if (clusterAgents.length >= MIN_CLUSTER_SIZE) {
      // Find common factors across ALL agents in cluster
      const allFactorSets = clusterAgents.map((id) => agentFailingFactors.get(id)!);
      const commonFactors = [...allFactorSets[0]!].filter((f) =>
        allFactorSets.every((s) => s.has(f))
      );

      if (commonFactors.length > 0) {
        for (const id of clusterAgents) visited.add(id);

        const severity: AnomalyCluster['severity'] =
          clusterAgents.length >= 5 ? 'emergency' :
          clusterAgents.length >= 3 ? 'critical' : 'warning';

        clusters.push({
          clusterId: `cluster-${++clusterIdx}`,
          agentIds: clusterAgents,
          commonFactors,
          detectedAt: now,
          severity,
          description: `${clusterAgents.length} agents sharing failures in ${commonFactors.join(', ')}`,
        });
      }
    }
  }

  return clusters;
}
