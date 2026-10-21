'use strict';

// Statistics for the objective-81 Haiku eval (TRD 81-02). Pre-registered in 81-DECISION-RULE.md section 4:
// every proportion is reported with its Wilson score 95% interval (z = 1.96), and differences are Haiku minus
// Sonnet rounded to 1e-9 before any comparison, so floating-point noise never moves a boundary.
//
// Pure functions: no I/O.

const Z95 = 1.96;
const ROUND = 1e9;

function assertCounts(k, n, label) {
  const ok = typeof k === 'number' && typeof n === 'number' && Number.isFinite(k) && Number.isFinite(n) &&
    k >= 0 && n >= 0 && k <= n;
  if (!ok) throw new RangeError(`${label}(${k}, ${n}): expected 0 <= k <= n with finite numbers`);
}

/** rate(k, n) -> k/n, or null when n is 0 (no data, never 0%). */
function rate(k, n) {
  assertCounts(k, n, 'rate');
  return n === 0 ? null : k / n;
}

/**
 * wilson(k, n, z = 1.96) -> {k, n, rate, low, high}: the Wilson score interval for k successes in n trials.
 * Clamped to [0, 1]; low is exactly 0 when k = 0 and high exactly 1 when k = n. With n = 0 the rate is null and
 * the interval is the whole of [0, 1].
 */
function wilson(k, n, z = Z95) {
  assertCounts(k, n, 'wilson');
  if (n === 0) return { k, n, rate: null, low: 0, high: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  const low = k === 0 ? 0 : Math.max(0, centre - half);
  const high = k === n ? 1 : Math.min(1, centre + half);
  return { k, n, rate: p, low, high };
}

/** round9(x) -> x rounded to 1e-9 (null stays null). */
function round9(x) {
  if (x === null || x === undefined) return null;
  const r = Math.round(x * ROUND) / ROUND;
  return Object.is(r, -0) ? 0 : r;
}

/** pointsDiff(h, s) -> haiku rate minus sonnet rate, rounded to 1e-9; null when either rate is null. */
function pointsDiff(h, s) {
  if (h === null || h === undefined || s === null || s === undefined) return null;
  return round9(h - s);
}

/** formatPct(rate) -> '88.9%' (one decimal); null -> 'n/a'. Used by decide's reasons and the report. */
function formatPct(r) {
  if (r === null || r === undefined) return 'n/a';
  return `${(r * 100).toFixed(1)}%`;
}

module.exports = { wilson, rate, pointsDiff, round9, formatPct, Z95 };
