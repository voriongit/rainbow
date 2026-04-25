/**
 * @fileoverview RAINBOW insight types.
 * @module @vorionsys/rainbow/insight
 */

import type { WindowConfig } from '../types.js';

/** Insight severity levels */
export type InsightSeverity = 'info' | 'warning' | 'critical' | 'emergency';

/** Categories of insights RAINBOW can detect */
export type InsightCategory =
  | 'TREND_DETECTED'
  | 'FLEET_ANOMALY'
  | 'DELEGATION_RISK'
  | 'DORMANCY_WARNING'
  | 'PROMOTION_CANDIDATE'
  | 'FACTOR_DEGRADATION'
  | 'CB_PATTERN'
  | 'ACCUMULATOR_ESCALATION';

/** A reference to a proof event in the evidence chain */
export interface ProofEventReference {
  /** Proof event ID */
  eventId: string;
  /** When the proof event was recorded */
  timestamp: Date;
  /** Brief summary of what happened */
  summary: string;
}

/** A recorded analytics insight with evidence chain */
export interface RecordedInsight {
  /** Unique insight identifier */
  insightId: string;
  /** What kind of insight */
  category: InsightCategory;
  /** How severe */
  severity: InsightSeverity;
  /** Agents involved */
  agentIds: string[];
  /** Short title (e.g. "Agent X trust declining for 48h") */
  title: string;
  /** Detailed description */
  description: string;
  /** Links to proof events that support this finding */
  evidenceChain: ProofEventReference[];
  /** When RAINBOW detected this insight */
  detectedAt: Date;
  /** Window configuration used for detection */
  windowConfig: WindowConfig;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
