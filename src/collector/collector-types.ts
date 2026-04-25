/**
 * @fileoverview Types for the RAINBOW signal collector.
 * @module @vorionsys/rainbow/collector
 */

import type { BusSignalType, BusSeverity } from '../contracts-stubs.js';

/**
 * Normalized signal ingested from any source (bus, pipeline callback, correlator).
 * This is the atomic unit stored in the WindowStore.
 */
export interface IngestedSignal {
  /** Unique signal identifier */
  signalId: string;
  /** Agent this signal concerns */
  agentId: string;
  /** Tenant scope */
  tenantId: string;
  /** When the signal was emitted */
  timestamp: Date;
  /** Bus-level signal type classification */
  busSignalType?: BusSignalType;
  /** Signal severity */
  severity?: BusSeverity;
  /** Whether the underlying action succeeded */
  success: boolean;
  /** Trust factor code (e.g. 'CT-COMP') */
  factorCode?: string;
  /** Risk level of the originating action */
  riskLevel?: string;
  /** Trust score delta applied */
  delta: number;
  /** Whether the signal was blocked */
  blocked: boolean;
  /** Reason for blocking */
  blockReason?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Trust score after this signal (when available) */
  scoreAfter?: number;
  /** Trust tier after this signal (when available) */
  tierAfter?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the SignalCollector.
 */
export interface CollectorConfig {
  /** Ring buffer capacity per agent (default: 10_000) */
  bufferCapacity?: number;
  /** Default tenant ID when not provided by signals */
  defaultTenantId?: string;
  /** Called after each signal is ingested */
  onIngested?: (signal: IngestedSignal) => void;
}
