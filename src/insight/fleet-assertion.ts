/**
 * @fileoverview Fleet-level insight detection.
 *
 * Scans an orchestration snapshot for fleet-wide actionable patterns —
 * anomaly clusters and delegation collusion risk — and generates
 * RecordedInsights mirroring the per-agent detectors in trend-assertion.
 *
 * @module @vorionsys/rainbow/insight
 */

import type { WindowConfig } from '../types.js';
import type { OrchestrationSnapshot } from '../orchestration/orchestration-analytics.js';
import type { RecordedInsight } from './insight-types.js';
import { makeInsight } from './make-insight.js';

/**
 * Detect fleet-level insights from an orchestration snapshot.
 * Returns zero or more insights based on the snapshot data.
 */
export function detectFleetInsights(
  snapshot: OrchestrationSnapshot,
  windowConfig: WindowConfig,
  now: Date = new Date()
): RecordedInsight[] {
  const insights: RecordedInsight[] = [];

  // 1. Anomaly clusters — agents degrading together
  for (const cluster of snapshot.anomalyClusters) {
    insights.push(makeInsight({
      category: 'FLEET_ANOMALY',
      severity: cluster.severity,
      agentIds: cluster.agentIds,
      title: `Fleet anomaly: ${String(cluster.agentIds.length)} agents degrading on ${cluster.commonFactors.join(', ')}`,
      description: `${cluster.description}. Detected within the ${windowConfig.duration} window.`,
      windowConfig,
      detectedAt: now,
      metadata: { clusterId: cluster.clusterId, commonFactors: cluster.commonFactors },
    }));
  }

  // 2. Delegation collusion risk — requestor over-relying on one handler
  for (const pair of snapshot.delegationHealth.collusionPairs) {
    insights.push(makeInsight({
      category: 'DELEGATION_RISK',
      severity: pair.share >= 0.95 && pair.count >= 5 ? 'critical' : 'warning',
      agentIds: [pair.requestor, pair.handler],
      title: `Delegation collusion risk: ${pair.requestor} → ${pair.handler}`,
      description: `${pair.requestor} routed ${String(pair.count)} escalation(s) (${(pair.share * 100).toFixed(0)}% of its total) to ${pair.handler}, exceeding the collusion share threshold. Fleet escalations in window: ${String(snapshot.delegationHealth.totalEscalations)}.`,
      windowConfig,
      detectedAt: now,
      metadata: { share: pair.share },
    }));
  }

  return insights;
}
