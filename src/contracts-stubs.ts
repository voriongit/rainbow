/**
 * @fileoverview Vendored copies of Trust Signal Bus enums.
 *
 * These mirror the enums declared in `@vorionsys/contracts/canonical/trust-bus`
 * (the rainbow-aware version), which were introduced for RAINBOW Phase 2 but
 * are not present in the currently-published `@vorionsys/contracts@1.0.0`.
 *
 * Vendored here so this package builds standalone against the live npm
 * registry. When `@vorionsys/contracts` is republished with the rainbow-era
 * trust-bus surface, these stubs can be replaced with re-exports without
 * breaking any consumer (the symbol shape is identical).
 *
 * @module @vorionsys/rainbow/contracts-stubs
 */

/**
 * Signal urgency classification per Trust Signal Bus whitepaper Section 2.1.
 * NOTE: Distinct from the 6 action risk levels (READ through LIFE_CRITICAL).
 */
export enum BusSeverity {
  /** Normal operational event */
  LOW = 'low',
  /** Moderate concern — enhanced monitoring */
  MEDIUM = 'medium',
  /** Significant event — immediate attention */
  HIGH = 'high',
  /** Severe event — enforcement action required */
  CRITICAL = 'critical',
  /** Immediate halt required — coordinated attack or life-safety threat */
  EMERGENCY = 'emergency',
}

/**
 * Cross-layer governance signal types per Trust Signal Bus whitepaper Section 2.2.
 * These are distinct from the intra-layer SignalType (ACTION_SUCCESS, etc.).
 */
export enum BusSignalType {
  /** Active threat identified (probe, tampering, injection) */
  THREAT_DETECTED = 'threat_detected',
  /** Behavioral or structural anomaly outside expected bounds */
  ANOMALY = 'anomaly',
  /** Gradual deviation from baseline (weight drift, behavioral drift) */
  DRIFT = 'drift',
  /** Agent actively probing execution environment (Heisenberg trigger) */
  PROBE_DETECTED = 'probe_detected',
  /** CSSR rotation executed; new execution surface active */
  ROTATION_TRIGGERED = 'rotation_triggered',
  /** Agent's policy envelope has been restricted */
  POLICY_TIGHTENED = 'policy_tightened',
  /** Agent's trust score or tier has changed */
  TRUST_UPDATED = 'trust_updated',
  /** Canary probe passed — positive trust signal */
  CANARY_PASSED = 'canary_passed',
  /** Canary probe failed — negative trust signal */
  CANARY_FAILED = 'canary_failed',
  /** Dormancy milestone reached — stepped trust deduction applied */
  DORMANCY_DEDUCTION = 'dormancy_deduction',
  /** Rolling 24h risk accumulator crossed warning threshold (>=60) */
  RISK_ACCUMULATOR_WARNING = 'risk_accumulator_warning',
  /** Rolling 24h risk accumulator crossed degraded threshold (>=120) */
  RISK_ACCUMULATOR_DEGRADED = 'risk_accumulator_degraded',
  /** Circuit breaker tripped — all operations halted */
  CIRCUIT_BREAKER_TRIPPED = 'circuit_breaker_tripped',
  /** RAINBOW detected a sustained trust trend (rising/falling) */
  TREND_DETECTED = 'trend_detected',
  /** RAINBOW detected a fleet-wide anomaly pattern */
  FLEET_ANOMALY = 'fleet_anomaly',
}
