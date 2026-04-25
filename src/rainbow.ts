/**
 * @fileoverview Rainbow — top-level facade for RAINBOW analytics.
 *
 * Ties together signal collection, windowed analytics, non-binary state views,
 * orchestration analytics, and insight detection into a single API.
 *
 * @module @vorionsys/rainbow
 */

import type {
  WindowConfig,
  AnalyticsWindowResult,
} from './types.js';
import { WINDOW_DURATION_MS } from './types.js';
import { SignalCollector, type CollectorConfig, type PipelineMetrics, type PipelineBlockedEvent } from './collector/index.js';
import { MemoryWindowStore } from './window/memory-window-store.js';
import type { WindowStore } from './window/window-store.js';
import { computeWindow, type AnalyticsWindowConfig } from './window/analytics-window.js';
import { computeStateSnapshot, type NonBinaryStateSnapshot, type StateSnapshotContext } from './state/non-binary-state-view.js';
import {
  computeOrchestrationSnapshot,
  type OrchestrationSnapshot,
  type OrchestrationInput,
} from './orchestration/orchestration-analytics.js';
import { detectInsights } from './insight/trend-assertion.js';
import type { RecordedInsight } from './insight/insight-types.js';

// ============================================================================
// Configuration
// ============================================================================

export interface RainbowConfig {
  /** Collector configuration */
  collector?: CollectorConfig;
  /** Pluggable signal storage (default: in-memory) */
  store?: WindowStore;
  /** Function to resolve agent score at a point in time */
  resolveInitialScore?: (agentId: string, at: Date) => number;
  /** Auto-compute interval in ms (default: 60_000, 0 = disabled) */
  computeIntervalMs?: number;
  /** Called when a new insight is detected */
  onInsight?: (insight: RecordedInsight) => void;
}

// ============================================================================
// Rainbow Class
// ============================================================================

/**
 * RAINBOW — Recorded Analytics Involving Non-Binary Orchestration Window.
 *
 * Top-level facade for operator-facing analytics over the Trust Signal Bus.
 *
 * @example
 * ```ts
 * const rainbow = new Rainbow();
 *
 * // Wire up to the signal pipeline
 * const pipeline = createSignalPipeline(dynamics, profiles, {
 *   onSignalProcessed: (m) => rainbow.ingestMetrics(m),
 *   onBlocked: (e) => rainbow.ingestBlocked(e),
 * });
 *
 * // Query analytics
 * const window = rainbow.computeWindow({ duration: '24h', agentId: 'agent-1' });
 * const snapshot = rainbow.getStateSnapshot('agent-1', { compositeScore: 450, ... });
 * const insights = rainbow.getInsights(window);
 * ```
 */
export class Rainbow {
  readonly collector: SignalCollector;
  private readonly store: WindowStore;
  private readonly resolveInitialScore?: (agentId: string, at: Date) => number;
  private readonly _onInsight?: (insight: RecordedInsight) => void;
  private _computeTimer: ReturnType<typeof setInterval> | null = null;
  private _latestInsights: RecordedInsight[] = [];

  constructor(config: RainbowConfig = {}) {
    this.collector = new SignalCollector({
      ...config.collector,
      onIngested: (signal) => {
        this.store.put(signal);
        config.collector?.onIngested?.(signal);
      },
    });
    this.store = config.store ?? new MemoryWindowStore();
    this.resolveInitialScore = config.resolveInitialScore;
    this._onInsight = config.onInsight;
  }

  // ── Signal Ingestion ──

  /** Ingest a pipeline metrics event */
  ingestMetrics(metrics: PipelineMetrics): void {
    this.collector.ingestMetrics(metrics);
  }

  /** Ingest a blocked signal event */
  ingestBlocked(event: PipelineBlockedEvent): void {
    this.collector.ingestBlocked(event);
  }

  /** Ingest a correlation alert */
  ingestCorrelationAlert(alert: {
    agentIds: string[];
    pattern: string;
    severity: string;
    detectedAt: Date;
  }): void {
    this.collector.ingestCorrelationAlert(alert);
  }

  // ── Analytics ──

  /** Compute a windowed analytics result */
  computeAnalyticsWindow(
    windowConfig: WindowConfig,
    now: Date = new Date()
  ): AnalyticsWindowResult {
    const config: AnalyticsWindowConfig = {
      store: this.store,
      resolveInitialScore: this.resolveInitialScore,
    };
    return computeWindow(config, windowConfig, now);
  }

  /** Get a non-binary state snapshot for an agent */
  getStateSnapshot(
    agentId: string,
    context: StateSnapshotContext,
    windowConfig: WindowConfig = { duration: '24h', agentId },
    now: Date = new Date()
  ): NonBinaryStateSnapshot {
    const durationMs = windowConfig.duration === 'custom'
      ? (windowConfig.customMs ?? 86_400_000)
      : WINDOW_DURATION_MS[windowConfig.duration];
    const from = new Date(now.getTime() - durationMs);
    const signals = this.store.query(agentId, from, now);
    return computeStateSnapshot(agentId, signals, context, now);
  }

  /** Compute a fleet-wide orchestration snapshot */
  getOrchestrationSnapshot(
    input: Omit<OrchestrationInput, 'signals'>,
    windowConfig: WindowConfig = { duration: '24h' },
    now: Date = new Date()
  ): OrchestrationSnapshot {
    const durationMs = windowConfig.duration === 'custom'
      ? (windowConfig.customMs ?? 86_400_000)
      : WINDOW_DURATION_MS[windowConfig.duration];
    const from = new Date(now.getTime() - durationMs);
    const signals = this.store.queryAll(from, now);
    return computeOrchestrationSnapshot({ ...input, signals }, now);
  }

  /** Detect insights from a window result */
  getInsights(
    result: AnalyticsWindowResult,
    now: Date = new Date()
  ): RecordedInsight[] {
    const insights = detectInsights(result, now);
    this._latestInsights = insights;
    for (const insight of insights) {
      this._onInsight?.(insight);
    }
    return insights;
  }

  /** Get the most recently computed insights */
  get latestInsights(): RecordedInsight[] {
    return this._latestInsights;
  }

  // ── Lifecycle ──

  /** Start auto-computation on an interval */
  start(intervalMs = 60_000): void {
    this.stop();
    if (intervalMs <= 0) return;
    this._computeTimer = setInterval(() => {
      // Auto-compute for all known agents
      for (const agentId of this.collector.agentIds()) {
        const result = this.computeAnalyticsWindow({ duration: '24h', agentId });
        this.getInsights(result);
      }
    }, intervalMs);
  }

  /** Stop auto-computation */
  stop(): void {
    if (this._computeTimer) {
      clearInterval(this._computeTimer);
      this._computeTimer = null;
    }
  }

  /** Clean up resources */
  dispose(): void {
    this.stop();
    this.collector.clear();
    this.store.clear();
    this._latestInsights = [];
  }
}
