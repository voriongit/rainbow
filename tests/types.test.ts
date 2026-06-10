import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_CUSTOM_WINDOW_MS,
  WINDOW_DURATION_MS,
  resolveWindowDurationMs,
} from '../src/types.js';
import { VERSION } from '../src/index.js';

describe('resolveWindowDurationMs', () => {
  it('resolves preset durations', () => {
    expect(resolveWindowDurationMs({ duration: '1h' })).toBe(3_600_000);
    expect(resolveWindowDurationMs({ duration: '6h' })).toBe(6 * 3_600_000);
    expect(resolveWindowDurationMs({ duration: '24h' })).toBe(24 * 3_600_000);
    expect(resolveWindowDurationMs({ duration: '7d' })).toBe(7 * 24 * 3_600_000);
    expect(resolveWindowDurationMs({ duration: '30d' })).toBe(30 * 24 * 3_600_000);
  });

  it('uses customMs for custom windows', () => {
    expect(resolveWindowDurationMs({ duration: 'custom', customMs: 90_000 })).toBe(90_000);
  });

  it('falls back to 24h when custom is selected without customMs', () => {
    expect(resolveWindowDurationMs({ duration: 'custom' })).toBe(WINDOW_DURATION_MS['24h']);
    expect(DEFAULT_CUSTOM_WINDOW_MS).toBe(WINDOW_DURATION_MS['24h']);
  });
});

describe('VERSION', () => {
  it('matches the package.json version', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});
