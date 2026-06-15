/**
 * @fileoverview RAINBOW — Recorded Analytics Involving Non-Binary Orchestration Window.
 *
 * Operator-facing analytics abstraction over the Vorion Trust Signal Bus.
 * Provides windowed, multi-state analytics for agent trust governance.
 *
 * @module @vorionsys/rainbow
 */

// ── Types ──
export type {
  WindowDuration,
  WindowConfig,
  TrustTrend,
  ScoreTrajectory,
  SignalDistribution,
  StateTransitionSummary,
  RiskEscalation,
  RiskTrend,
  AnalyticsWindowResult,
} from './types.js';
export {
  WINDOW_DURATION_MS,
  DEFAULT_CUSTOM_WINDOW_MS,
  resolveWindowDurationMs,
} from './types.js';

// ── Contracts (vendored from @vorionsys/contracts trust-bus) ──
export { BusSignalType, BusSeverity } from './contracts-stubs.js';

// ── Collector ──
export type { IngestedSignal, CollectorConfig } from './collector/index.js';
export type { PipelineMetrics, PipelineBlockedEvent } from './collector/index.js';
export { RingBuffer, SignalCollector } from './collector/index.js';

// ── Window ──
export type { WindowStore, AnalyticsWindowConfig } from './window/index.js';
export {
  MemoryWindowStore,
  computeWindow,
  computeTrajectory,
  computeDistribution,
  computeTransitions,
  computeRiskTrend,
} from './window/index.js';

// ── State (Non-Binary) ──
export type {
  FactorHealth,
  ObservationImpactAnalysis,
  NonBinaryStateSnapshot,
  StateSnapshotContext,
} from './state/index.js';
export {
  computeFactorHealth,
  computeObservationImpact,
  computeStateSnapshot,
} from './state/index.js';

// ── Orchestration (Fleet-Wide) ──
export type {
  FleetDistribution,
  CorrelationSummary,
  CorrelationAlertInput,
  DelegationHealthSummary,
  EscalationEvent,
  AnomalyCluster,
  OrchestrationSnapshot,
  OrchestrationInput,
} from './orchestration/index.js';
export {
  computeFleetDistribution,
  estimateAgentScores,
  computeCorrelationSummary,
  computeDelegationHealth,
  detectAnomalyClusters,
  computeOrchestrationSnapshot,
} from './orchestration/index.js';

// ── Insight ──
export type {
  InsightSeverity,
  InsightCategory,
  ProofEventReference,
  RecordedInsight,
} from './insight/index.js';
export { detectInsights, detectFleetInsights } from './insight/index.js';

// ── Rainbow Facade ──
export type { RainbowConfig } from './rainbow.js';
export { Rainbow } from './rainbow.js';

export const VERSION = '0.3.0';
