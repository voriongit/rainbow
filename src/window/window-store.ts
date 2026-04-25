/**
 * @fileoverview WindowStore interface — pluggable signal storage backend.
 *
 * The default implementation (MemoryWindowStore) uses per-agent RingBuffers.
 * Persistent backends (e.g. Drizzle/Postgres) can implement this interface
 * for longer retention windows (7d, 30d).
 *
 * @module @vorionsys/rainbow/window
 */

import type { IngestedSignal } from '../collector/collector-types.js';

/**
 * Pluggable storage interface for windowed signal queries.
 */
export interface WindowStore {
  /** Store a signal */
  put(signal: IngestedSignal): void;

  /** Query signals for a single agent within a time range */
  query(agentId: string, from: Date, to: Date): IngestedSignal[];

  /** Query signals for ALL agents within a time range */
  queryAll(from: Date, to: Date): IngestedSignal[];

  /** Get all known agent IDs */
  agentIds(): string[];

  /** Clear all stored signals */
  clear(): void;
}
