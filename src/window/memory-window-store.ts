/**
 * @fileoverview In-memory WindowStore backed by per-agent RingBuffers.
 * @module @vorionsys/rainbow/window
 */

import type { IngestedSignal } from '../collector/collector-types.js';
import { RingBuffer } from '../collector/buffer.js';
import type { WindowStore } from './window-store.js';

const DEFAULT_CAPACITY = 10_000;

/**
 * In-memory WindowStore using RingBuffers per agent.
 * Suitable for short-medium windows (1h-24h). For 7d+ windows
 * with high signal volume, use a persistent WindowStore.
 */
export class MemoryWindowStore implements WindowStore {
  private readonly buffers: Map<string, RingBuffer> = new Map();
  private readonly capacity: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  put(signal: IngestedSignal): void {
    let buffer = this.buffers.get(signal.agentId);
    if (!buffer) {
      buffer = new RingBuffer(this.capacity);
      this.buffers.set(signal.agentId, buffer);
    }
    buffer.push(signal);
  }

  query(agentId: string, from: Date, to: Date): IngestedSignal[] {
    const buffer = this.buffers.get(agentId);
    if (!buffer) return [];
    return buffer.query(from, to);
  }

  queryAll(from: Date, to: Date): IngestedSignal[] {
    const results: IngestedSignal[] = [];
    for (const buffer of this.buffers.values()) {
      results.push(...buffer.query(from, to));
    }
    results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return results;
  }

  agentIds(): string[] {
    return [...this.buffers.keys()];
  }

  clear(): void {
    this.buffers.clear();
  }
}
