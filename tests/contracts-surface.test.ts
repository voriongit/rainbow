import { describe, it, expect } from 'vitest';
import { BusSignalType, BusSeverity } from '../src/contracts-stubs.js';

/**
 * Frozen-surface guard for the trust-bus enums re-exported from
 * `@vorionsys/contracts/canonical/trust-bus`.
 *
 * RAINBOW's analytics, the rainbow-interop harness schema, and the wire
 * spec all rely on these exact member sets (the contracts-trustbus frozen
 * surface). If a contracts release ships different shapes, this suite must
 * fail before any analytics test does — do not loosen these assertions to
 * absorb a surface change; reconcile the surface instead.
 */
describe('contracts trust-bus frozen surface', () => {
  it('BusSeverity has exactly the five wire severities', () => {
    expect({ ...BusSeverity }).toEqual({
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical',
      EMERGENCY: 'emergency',
    });
  });

  it('BusSignalType has exactly the fifteen wire signal types', () => {
    expect({ ...BusSignalType }).toEqual({
      THREAT_DETECTED: 'threat_detected',
      ANOMALY: 'anomaly',
      DRIFT: 'drift',
      PROBE_DETECTED: 'probe_detected',
      ROTATION_TRIGGERED: 'rotation_triggered',
      POLICY_TIGHTENED: 'policy_tightened',
      TRUST_UPDATED: 'trust_updated',
      CANARY_PASSED: 'canary_passed',
      CANARY_FAILED: 'canary_failed',
      DORMANCY_DEDUCTION: 'dormancy_deduction',
      RISK_ACCUMULATOR_WARNING: 'risk_accumulator_warning',
      RISK_ACCUMULATOR_DEGRADED: 'risk_accumulator_degraded',
      CIRCUIT_BREAKER_TRIPPED: 'circuit_breaker_tripped',
      TREND_DETECTED: 'trend_detected',
      FLEET_ANOMALY: 'fleet_anomaly',
    });
  });
});
