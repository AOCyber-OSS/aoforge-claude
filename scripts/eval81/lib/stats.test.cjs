'use strict';

// Tests for scripts/eval81/lib/stats.cjs (TRD 81-02, test list 10-11): the Wilson score interval, rate and the
// Haiku-minus-Sonnet difference that the pre-registered decision rule (81-DECISION-RULE.md section 4) uses.
// Every expected value is computed by hand in the comment beside it.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Loaded per test, so a missing module fails each test with its own name.
const load = () => require('./stats.cjs');

const close = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected} +/- ${tol}, got ${actual}`);

describe('wilson (test list 10)', () => {
  test('wilson(9, 9): upper exactly 1.0, lower ~0.701', () => {
    // n = 9, z^2 = 3.8416: centre = (1 + 0.213422) / 1.426844 = 0.850423, half = 0.149577, low = 0.700846.
    const w = load().wilson(9, 9);
    assert.equal(w.k, 9);
    assert.equal(w.n, 9);
    assert.equal(w.rate, 1);
    assert.equal(w.high, 1);
    close(w.low, 0.700846, 1e-5, 'low');
  });

  test('wilson(0, 9): lower exactly 0, upper ~0.299 (the mirror of 9/9)', () => {
    const w = load().wilson(0, 9);
    assert.equal(w.rate, 0);
    assert.equal(w.low, 0);
    close(w.high, 1 - 0.700846, 1e-5, 'high');
  });

  test('wilson(0, 0): no data gives {low: 0, high: 1, n: 0} and a null rate', () => {
    const w = load().wilson(0, 0);
    assert.deepEqual(w, { k: 0, n: 0, rate: null, low: 0, high: 1 });
  });

  test('wilson(5, 10) is symmetric around 0.5', () => {
    const w = load().wilson(5, 10);
    assert.equal(w.rate, 0.5);
    close(w.low + w.high, 1, 1e-12, 'low + high');
    // centre 0.5, half = 1.96 * sqrt(0.025 + 0.009604) / 1.38416 = 0.263409: [0.236591, 0.763409].
    close(w.low, 0.236591, 1e-4, 'low');
  });

  test('wilson(8, 9): the interval the report prints for 8/9 (56.5%-98.0%)', () => {
    const w = load().wilson(8, 9);
    close(w.low, 0.564993, 1e-4, 'low');
    close(w.high, 0.980106, 1e-4, 'high');
  });

  test('a custom z is honoured (z = 0 collapses the interval to the point estimate)', () => {
    const w = load().wilson(3, 4, 0);
    assert.equal(w.low, 0.75);
    assert.equal(w.high, 0.75);
  });

  test('k > n, a negative count or a non-number throws naming the inputs', () => {
    const { wilson } = load();
    assert.throws(() => wilson(10, 9), /wilson\(10, 9\)/);
    assert.throws(() => wilson(-1, 9), /wilson\(-1, 9\)/);
    assert.throws(() => wilson('3', 9), /wilson\(3, 9\)/);
  });
});

describe('rate', () => {
  test('rate(k, n) is k/n, and null for n = 0', () => {
    const { rate } = load();
    assert.equal(rate(3, 4), 0.75);
    assert.equal(rate(0, 0), null);
  });
});

describe('formatPct', () => {
  test('one decimal percent; null is n/a', () => {
    const { formatPct } = load();
    assert.equal(formatPct(8 / 9), '88.9%');
    assert.equal(formatPct(1), '100.0%');
    assert.equal(formatPct(0.15), '15.0%');
    assert.equal(formatPct(null), 'n/a');
  });
});

describe('pointsDiff (test list 11)', () => {
  // TRD 81-02 test 11 reads "pointsDiff(0.78, 0.70) = -0.08 (haiku minus sonnet)" while its action defines
  // pointsDiff(h, s). The value and the parenthesis match test 7's case (haiku 0.70, sonnet 0.78), so the signature
  // wins: pointsDiff(h = 0.70, s = 0.78) = -0.08. Recorded as a deviation in the 81-02 SUMMARY.
  test('pointsDiff(h, s) is haiku minus sonnet: pointsDiff(0.70, 0.78) = -0.08 exactly', () => {
    const { pointsDiff } = load();
    assert.equal(0.70 - 0.78 === -0.08, false, 'raw float subtraction is not exact; the rounding is the point');
    assert.equal(pointsDiff(0.70, 0.78), -0.08);
    assert.equal(pointsDiff(0.78, 0.70), 0.08);
  });

  test('pointsDiff rounds to 1e-9 so a boundary is not moved by float noise', () => {
    const { pointsDiff } = load();
    // 0.7 - 0.8 is -0.10000000000000009 in IEEE 754; rounded it is exactly -0.1, which is within a 10-point margin.
    assert.equal(pointsDiff(0.7, 0.8), -0.1);
    assert.equal(pointsDiff(8 / 9, 1), -0.111111111);
  });

  test('pointsDiff with a null rate is null', () => {
    const { pointsDiff } = load();
    assert.equal(pointsDiff(null, 0.5), null);
    assert.equal(pointsDiff(0.5, null), null);
  });
});
