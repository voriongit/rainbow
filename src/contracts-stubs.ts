/**
 * @fileoverview Re-exports of Trust Signal Bus enums from `@vorionsys/contracts`.
 *
 * Until contracts@1.1.0, this file vendored local copies of `BusSignalType`
 * and `BusSeverity` so the package could build standalone against the live
 * npm registry. `@vorionsys/contracts@1.1.0` ships the rainbow-era trust-bus
 * surface (the same symbol shapes), so the stubs are now thin re-exports.
 *
 * The filename is retained so internal import sites are unchanged; a
 * follow-up may inline these imports and delete this module.
 *
 * Frozen-surface guard: `tests/contracts-surface.test.ts` pins the exact
 * member sets this package relies on. If a future contracts release changes
 * either enum's shape, that suite fails before anything else does.
 *
 * @module @vorionsys/rainbow/contracts-stubs
 */

export { BusSignalType, BusSeverity } from '@vorionsys/contracts/canonical/trust-bus';
