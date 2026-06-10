/**
 * @fileoverview Delegation chain health analysis.
 *
 * Analyzes escalation patterns between agents to detect healthy delegation
 * flows vs. potential collusion or over-reliance on specific handlers.
 *
 * @module @vorionsys/rainbow/orchestration
 */

// ============================================================================
// Types
// ============================================================================

/** An escalation event between two agents */
export interface EscalationEvent {
  /** Agent that requested escalation */
  requestorId: string;
  /** Agent that handled the escalation */
  handlerId: string;
  /** Whether the escalation was successful */
  success: boolean;
  /** Time to resolution in ms */
  resolutionTimeMs?: number;
  /** When the escalation occurred */
  timestamp: Date;
}

export interface DelegationHealthSummary {
  /** Total escalations in window */
  totalEscalations: number;
  /** Successfully resolved escalations */
  successfulEscalations: number;
  /** Rejected or failed escalations */
  rejectedEscalations: number;
  /** Average time to resolution (ms) */
  averageResolutionTimeMs: number;
  /** Most frequent requestor→handler pairs */
  topEscalationPairs: Array<{ requestor: string; handler: string; count: number }>;
  /** Whether any pair exceeds the collusion risk threshold */
  potentialCollusionRisk: boolean;
}

/** Threshold: if a pair handles >80% of an agent's escalations, flag it */
const COLLUSION_PAIR_THRESHOLD = 0.8;

// ============================================================================
// Computation
// ============================================================================

/**
 * Compute delegation health from escalation events.
 */
export function computeDelegationHealth(
  events: EscalationEvent[]
): DelegationHealthSummary {
  if (events.length === 0) {
    return {
      totalEscalations: 0,
      successfulEscalations: 0,
      rejectedEscalations: 0,
      averageResolutionTimeMs: 0,
      topEscalationPairs: [],
      potentialCollusionRisk: false,
    };
  }

  const successfulEscalations = events.filter((e) => e.success).length;
  const rejectedEscalations = events.length - successfulEscalations;

  // Average resolution time
  const withTime = events.filter(
    (e): e is typeof e & { resolutionTimeMs: number } => e.resolutionTimeMs !== undefined
  );
  const averageResolutionTimeMs = withTime.length > 0
    ? withTime.reduce((s, e) => s + e.resolutionTimeMs, 0) / withTime.length
    : 0;

  // Pair counts
  const pairStats = new Map<string, { requestor: string; handler: string; count: number }>();
  const requestorTotals = new Map<string, number>();

  for (const event of events) {
    const key = JSON.stringify([event.requestorId, event.handlerId]);
    const entry = pairStats.get(key);
    if (entry) {
      entry.count++;
    } else {
      pairStats.set(key, { requestor: event.requestorId, handler: event.handlerId, count: 1 });
    }
    requestorTotals.set(event.requestorId, (requestorTotals.get(event.requestorId) ?? 0) + 1);
  }

  const topEscalationPairs = [...pairStats.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Collusion detection: any requestor sending >80% to one handler?
  let potentialCollusionRisk = false;
  for (const { requestor, count } of topEscalationPairs) {
    const total = requestorTotals.get(requestor) ?? 0;
    if (total >= 3 && count / total >= COLLUSION_PAIR_THRESHOLD) {
      potentialCollusionRisk = true;
      break;
    }
  }

  return {
    totalEscalations: events.length,
    successfulEscalations,
    rejectedEscalations,
    averageResolutionTimeMs,
    topEscalationPairs,
    potentialCollusionRisk,
  };
}
