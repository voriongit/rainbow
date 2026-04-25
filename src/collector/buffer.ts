/**
 * @fileoverview Ring buffer for high-throughput signal storage.
 *
 * Fixed-capacity, per-agent signal buffer. When full, the oldest signal
 * is evicted (FIFO). Supports time-range queries for windowed analytics.
 *
 * @module @vorionsys/rainbow/collector
 */

import type { IngestedSignal } from './collector-types.js';

const DEFAULT_CAPACITY = 10_000;

/**
 * Per-agent ring buffer that stores IngestedSignals in insertion order.
 * Supports efficient time-range queries.
 */
export class RingBuffer {
  private readonly capacity: number;
  private readonly buffer: IngestedSignal[];
  private head = 0;
  private _size = 0;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = Math.max(1, capacity);
    this.buffer = new Array<IngestedSignal>(this.capacity);
  }

  /** Number of signals currently stored */
  get size(): number {
    return this._size;
  }

  /** Push a signal into the buffer, evicting the oldest if full */
  push(signal: IngestedSignal): void {
    const index = (this.head + this._size) % this.capacity;
    this.buffer[index] = signal;

    if (this._size < this.capacity) {
      this._size++;
    } else {
      // Buffer full — advance head (evict oldest)
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all signals within a time range, ordered oldest-first.
   * @param from - Start of range (inclusive)
   * @param to - End of range (inclusive)
   */
  query(from: Date, to: Date): IngestedSignal[] {
    const results: IngestedSignal[] = [];
    const fromMs = from.getTime();
    const toMs = to.getTime();

    for (let i = 0; i < this._size; i++) {
      const idx = (this.head + i) % this.capacity;
      const signal = this.buffer[idx]!;
      const ts = signal.timestamp.getTime();
      if (ts >= fromMs && ts <= toMs) {
        results.push(signal);
      }
    }

    return results;
  }

  /** Get all signals in the buffer, ordered oldest-first */
  getAll(): IngestedSignal[] {
    const results: IngestedSignal[] = [];
    for (let i = 0; i < this._size; i++) {
      const idx = (this.head + i) % this.capacity;
      results.push(this.buffer[idx]!);
    }
    return results;
  }

  /** Get the most recent signal, or undefined if empty */
  latest(): IngestedSignal | undefined {
    if (this._size === 0) return undefined;
    const idx = (this.head + this._size - 1) % this.capacity;
    return this.buffer[idx];
  }

  /** Clear all signals */
  clear(): void {
    this.head = 0;
    this._size = 0;
  }
}
