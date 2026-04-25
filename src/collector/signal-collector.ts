/**
 * @fileoverview Signal collector for RAINBOW analytics.
 *
 * Ingests signals from the TrustSignalPipeline callbacks (onSignalProcessed,
 * onBlocked) and normalizes them into IngestedSignals stored in per-agent
 * ring buffers.
 *
 * @module @vorionsys/rainbow/collector
 */

import { v4 as uuidv4 } from 'uuid';
import type { IngestedSignal, CollectorConfig } from './collector-types.js';
import { RingBuffer } from './buffer.js';

/** Shape of the onSignalProcessed callback from TrustSignalPipeline */
export interface PipelineMetrics {
  agentId: string;
  factorCode: string;
  success: boolean;
  blocked: boolean;
  blockReason?: string;
  delta: number;
  durationMs: number;
  timestamp: Date;
}

/** Shape of the onBlocked callback from TrustSignalPipeline */
export interface PipelineBlockedEvent {
  agentId: string;
  factorCode: string;
  blockReason: string;
  timestamp: Date;
}

const DEFAULT_BUFFER_CAPACITY = 10_000;

/**
 * Collects and normalizes trust signals from pipeline callbacks
 * into per-agent ring buffers for windowed analytics.
 */
export class SignalCollector {
  private readonly buffers: Map<string, RingBuffer> = new Map();
  private readonly capacity: number;
  private readonly defaultTenantId: string;
  private readonly onIngested?: (signal: IngestedSignal) => void;

  constructor(config: CollectorConfig = {}) {
    this.capacity = config.bufferCapacity ?? DEFAULT_BUFFER_CAPACITY;
    this.defaultTenantId = config.defaultTenantId ?? 'default';
    this.onIngested = config.onIngested;
  }

  /**
   * Ingest a pipeline metrics event (from onSignalProcessed callback).
   * This is the primary ingestion path.
   */
  ingestMetrics(metrics: PipelineMetrics): IngestedSignal {
    const signal: IngestedSignal = {
      signalId: uuidv4(),
      agentId: metrics.agentId,
      tenantId: this.defaultTenantId,
      timestamp: metrics.timestamp,
      success: metrics.success,
      factorCode: metrics.factorCode,
      delta: metrics.delta,
      blocked: metrics.blocked,
      blockReason: metrics.blockReason,
    };

    this.store(signal);
    return signal;
  }

  /**
   * Ingest a blocked signal event (from onBlocked callback).
   * Provides richer context for blocked signals.
   */
  ingestBlocked(event: PipelineBlockedEvent): IngestedSignal {
    const signal: IngestedSignal = {
      signalId: uuidv4(),
      agentId: event.agentId,
      tenantId: this.defaultTenantId,
      timestamp: event.timestamp,
      success: false,
      factorCode: event.factorCode,
      delta: 0,
      blocked: true,
      blockReason: event.blockReason,
    };

    this.store(signal);
    return signal;
  }

  /**
   * Ingest a correlation alert from the CrossAgentCorrelator.
   * Creates a signal per affected agent for analytics tracking.
   */
  ingestCorrelationAlert(alert: {
    agentIds: string[];
    pattern: string;
    severity: string;
    detectedAt: Date;
  }): IngestedSignal[] {
    const signals: IngestedSignal[] = [];
    for (const agentId of alert.agentIds) {
      const signal: IngestedSignal = {
        signalId: uuidv4(),
        agentId,
        tenantId: this.defaultTenantId,
        timestamp: alert.detectedAt,
        success: false,
        delta: 0,
        blocked: false,
        metadata: {
          correlationPattern: alert.pattern,
          correlationSeverity: alert.severity,
        },
      };
      this.store(signal);
      signals.push(signal);
    }
    return signals;
  }

  /**
   * Directly ingest a pre-formed signal (for testing or custom sources).
   */
  ingest(signal: IngestedSignal): void {
    this.store(signal);
  }

  /**
   * Query signals for a specific agent within a time range.
   */
  query(agentId: string, from: Date, to: Date): IngestedSignal[] {
    const buffer = this.buffers.get(agentId);
    if (!buffer) return [];
    return buffer.query(from, to);
  }

  /**
   * Query signals for ALL agents within a time range.
   */
  queryAll(from: Date, to: Date): IngestedSignal[] {
    const results: IngestedSignal[] = [];
    for (const buffer of this.buffers.values()) {
      results.push(...buffer.query(from, to));
    }
    results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return results;
  }

  /** Get the most recent signal for an agent */
  latest(agentId: string): IngestedSignal | undefined {
    return this.buffers.get(agentId)?.latest();
  }

  /** Get all known agent IDs */
  agentIds(): string[] {
    return [...this.buffers.keys()];
  }

  /** Get signal count for an agent */
  count(agentId: string): number {
    return this.buffers.get(agentId)?.size ?? 0;
  }

  /** Clear all stored signals */
  clear(): void {
    this.buffers.clear();
  }

  /** Clear signals for a specific agent */
  clearAgent(agentId: string): void {
    this.buffers.get(agentId)?.clear();
  }

  private store(signal: IngestedSignal): void {
    let buffer = this.buffers.get(signal.agentId);
    if (!buffer) {
      buffer = new RingBuffer(this.capacity);
      this.buffers.set(signal.agentId, buffer);
    }
    buffer.push(signal);
    this.onIngested?.(signal);
  }
}
