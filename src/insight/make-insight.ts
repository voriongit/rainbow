/**
 * @fileoverview Internal factory for RecordedInsights.
 * @module @vorionsys/rainbow/insight
 */

import { v4 as uuidv4 } from 'uuid';
import type { WindowConfig } from '../types.js';
import type { RecordedInsight, InsightSeverity, InsightCategory } from './insight-types.js';

export function makeInsight(params: {
  category: InsightCategory;
  severity: InsightSeverity;
  agentIds: string[];
  title: string;
  description: string;
  windowConfig: WindowConfig;
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}): RecordedInsight {
  return {
    insightId: uuidv4(),
    evidenceChain: [], // Populated by proof plane integration
    ...params,
  };
}
