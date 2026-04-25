/**
 * @fileoverview Score trajectory computation.
 *
 * Computes trend, velocity, and acceleration from a series of trust score
 * observations within a window. Uses linear regression for trend direction
 * and finite differences for velocity/acceleration.
 *
 * @module @vorionsys/rainbow/window
 */

import type { IngestedSignal } from '../collector/collector-types.js';
import type { ScoreTrajectory, TrustTrend } from '../types.js';

/** Minimum velocity magnitude to count as rising/falling (points/hour) */
const STABLE_THRESHOLD = 0.5;

/**
 * Compute the score trajectory from a set of signals within a window.
 *
 * Reconstructs a score timeline by accumulating deltas from an initial score,
 * then computes trend via linear regression slope.
 *
 * @param signals - Signals within the window, ordered by timestamp
 * @param initialScore - Score at the start of the window (before first signal)
 */
export function computeTrajectory(
  signals: IngestedSignal[],
  initialScore: number
): ScoreTrajectory {
  if (signals.length === 0) {
    return {
      current: initialScore,
      trend: 'stable',
      velocity: 0,
      acceleration: 0,
      min: initialScore,
      max: initialScore,
      samples: [],
    };
  }

  // Build score timeline by accumulating deltas
  const samples: Array<{ timestamp: Date; score: number }> = [];
  let score = initialScore;
  let min = initialScore;
  let max = initialScore;

  for (const signal of signals) {
    score += signal.delta;
    score = Math.max(0, Math.min(1000, score));
    min = Math.min(min, score);
    max = Math.max(max, score);
    samples.push({ timestamp: signal.timestamp, score });
  }

  const current = score;

  // Compute velocity via linear regression slope
  const velocity = computeVelocity(samples);

  // Compute acceleration from first and second half velocities
  const acceleration = computeAcceleration(samples);

  // Determine trend from velocity
  let trend: TrustTrend = 'stable';
  if (velocity > STABLE_THRESHOLD) trend = 'rising';
  else if (velocity < -STABLE_THRESHOLD) trend = 'falling';

  return { current, trend, velocity, acceleration, min, max, samples };
}

/**
 * Linear regression slope over score samples, expressed as points per hour.
 */
function computeVelocity(
  samples: Array<{ timestamp: Date; score: number }>
): number {
  if (samples.length < 2) return 0;

  const t0 = samples[0]!.timestamp.getTime();
  const n = samples.length;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const sample of samples) {
    const x = (sample.timestamp.getTime() - t0) / 3_600_000; // hours
    const y = sample.score;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;

  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Compute acceleration as the difference in velocity between the
 * second half and first half of samples (points/hour^2).
 */
function computeAcceleration(
  samples: Array<{ timestamp: Date; score: number }>
): number {
  if (samples.length < 4) return 0;

  const mid = Math.floor(samples.length / 2);
  const firstHalf = samples.slice(0, mid);
  const secondHalf = samples.slice(mid);

  const v1 = computeVelocity(firstHalf);
  const v2 = computeVelocity(secondHalf);

  // Time span of each half in hours
  const t1Span =
    (firstHalf[firstHalf.length - 1]!.timestamp.getTime() -
      firstHalf[0]!.timestamp.getTime()) /
    3_600_000;
  const t2Span =
    (secondHalf[secondHalf.length - 1]!.timestamp.getTime() -
      secondHalf[0]!.timestamp.getTime()) /
    3_600_000;

  const avgSpan = (t1Span + t2Span) / 2;
  if (avgSpan === 0) return 0;

  return (v2 - v1) / avgSpan;
}
