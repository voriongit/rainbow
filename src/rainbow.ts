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
  WindowDuration,
  AnalyticsWindowResult,
} from './types.js';
import { resolveWindowDurationMs } from './types.js';
import { SignalCollector, type CollectorConfig, type IngestedSignal, type PipelineMetrics, type PipelineBlockedEvent } from './collector/index.js';
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

const DEFAULT_COMPUTE_INTERVAL_MS = 60_000;

export interface RainbowConfig {
  /** Collector configuration */
  collector?: CollectorConfig;
  /** Pluggable signal storage (default: in-memory) */
  store?: WindowStore;
  /** Function to resolve agent score at a point in time */
  resolveInitialScore?: (agentId: string, at: Date) => number;
  /** Auto-compute interval in ms used by start() (default: 60_000, 0 = disabled) */
  computeIntervalMs?: number;
  /** Called when a new insight is detected */
  onInsight?: (insight: RecordedInsight) => void;
  /** Called when an auto-compute pass fails for an agent */
  onError?: (error: unknown, agentId?: string) => void;
}

/** Accept either a duration preset or a full window configuration */
function toWindowConfig(config: WindowDuration | WindowConfig): WindowConfig {
  return typeof config === 'string' ? { duration: config } : config;
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
 * const window = rainbow.window('24h');
 * const insights = rainbow.insights({ duration: '6h', agentId: 'agent-1' });
 * const fleet = rainbow.fleet('24h');
 * const snapshot = rainbow.getStateSnapshot('agent-1', { compositeScore: 450, ... });
 * ```
 */
export class Rainbow {
  readonly collector: SignalCollector;
  private readonly store: WindowStore;
  private readonly resolveInitialScore?: (agentId: string, at: Date) => number;
  private readonly computeIntervalMs: number;
  private readonly _onInsight?: (insight: RecordedInsight) => void;
  private readonly _onError?: (error: unknown, agentId?: string) => void;
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
    this.computeIntervalMs = config.computeIntervalMs ?? DEFAULT_COMPUTE_INTERVAL_MS;
    this._onInsight = config.onInsight;
    this._onError = config.onError;
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

  /** Ingest a pre-formed signal directly (custom sources) */
  ingest(signal: IngestedSignal): void {
    this.collector.ingest(signal);
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

  /**
   * Compute a windowed analytics result.
   * Shorthand for {@link computeAnalyticsWindow} accepting a bare duration.
   */
  window(
    config: WindowDuration | WindowConfig = '24h',
    now: Date = new Date()
  ): AnalyticsWindowResult {
    return this.computeAnalyticsWindow(toWindowConfig(config), now);
  }

  /** Compute a windowed analytics result and detect insights from it */
  insights(
    config: WindowDuration | WindowConfig = '24h',
    now: Date = new Date()
  ): RecordedInsight[] {
    return this.getInsights(this.window(config, now), now);
  }

  /**
   * Compute a fleet-wide orchestration snapshot.
   * Shorthand for {@link getOrchestrationSnapshot} accepting a bare duration.
   */
  fleet(
    config: WindowDuration | WindowConfig = '24h',
    now: Date = new Date()
  ): OrchestrationSnapshot {
    return this.getOrchestrationSnapshot({}, toWindowConfig(config), now);
  }

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
    const from = new Date(now.getTime() - resolveWindowDurationMs(windowConfig));
    const signals = this.store.query(agentId, from, now);
    return computeStateSnapshot(agentId, signals, context, now);
  }

  /** Compute a fleet-wide orchestration snapshot */
  getOrchestrationSnapshot(
    input: Omit<OrchestrationInput, 'signals'>,
    windowConfig: WindowConfig = { duration: '24h' },
    now: Date = new Date()
  ): OrchestrationSnapshot {
    const from = new Date(now.getTime() - resolveWindowDurationMs(windowConfig));
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
    return [...this._latestInsights];
  }

  // ── Lifecycle ──

  /**
   * Start auto-computation on an interval.
   * Defaults to the configured computeIntervalMs; pass 0 to disable.
   * The timer never holds the process open.
   */
  start(intervalMs: number = this.computeIntervalMs): void {
    this.stop();
    if (intervalMs <= 0) return;
    this._computeTimer = setInterval(() => {
      this.runAutoCompute();
    }, intervalMs);
    // unref is a no-op outside Node-style timer environments
    (this._computeTimer as { unref?: () => void }).unref?.();
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

  /** Compute a 24h window and insights for every known agent */
  private runAutoCompute(): void {
    for (const agentId of this.store.agentIds()) {
      try {
        const result = this.computeAnalyticsWindow({ duration: '24h', agentId });
        this.getInsights(result);
      } catch (error) {
        this._onError?.(error, agentId);
      }
    }
  }
}
