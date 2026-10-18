'use strict';
// TRD 82-05 test list 1-2, 15-16: objective 82's $20 ledger, written for and read by objective 81's frozen ledger
// library, its build-2 fit report and the recorded cap raise.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ledger = require('../eval81/lib/ledger.cjs');
const { ledgerEntry } = require('./__fixtures__/records.cjs');

const CLI = path.join(__dirname, 'ledger82.cjs');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'l82-'));
}

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function fitRaw(root) {
  const r = run(['--fit', '--root', root, '--raw']);
  assert.equal(r.code, 0, r.err);
  return JSON.parse(r.out);
}

const ledgerFile = (root) => path.join(root, 'ledger.json');

function pick(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}

test('1: --init writes a $20 ledger the frozen loader accepts, and refuses to overwrite it', () => {
  const root = tmpRoot();
  const r = run(['--init', '--root', root]);
  assert.equal(r.code, 0, r.err);
  const l = ledger.loadLedger(ledgerFile(root));
  assert.equal(l.version, ledger.LEDGER_VERSION);
  assert.equal(l.cap_usd, 20);
  assert.deepEqual(l.order, ['D', 'C', 'E', 'A', 'B']);
  assert.deepEqual(pick(l.batches.D, ['cap_usd', 'estimate_usd', 'status', 'spent_usd']), { cap_usd: 4.5, estimate_usd: 3.8, status: 'pending', spent_usd: 0 });
  assert.deepEqual(pick(l.batches.C, ['cap_usd', 'estimate_usd', 'status', 'spent_usd']), { cap_usd: 3.5, estimate_usd: 2.6, status: 'pending', spent_usd: 0 });
  assert.deepEqual(pick(l.batches.E, ['cap_usd', 'estimate_usd', 'status', 'spent_usd']), { cap_usd: 12, estimate_usd: 9.4, status: 'pending', spent_usd: 0 });
  for (const b of ['A', 'B']) {
    assert.equal(l.batches[b].status, 'stopped');
    assert.equal(l.batches[b].stop_reason, 'not an objective 82 batch');
  }
  assert.deepEqual(l.entries, []);

  const before = fs.readFileSync(ledgerFile(root), 'utf-8');
  const again = run(['--init', '--root', root]);
  assert.equal(again.code, 2);
  assert.match(again.err, /exists/);
  assert.equal(fs.readFileSync(ledgerFile(root), 'utf-8'), before);
});

test('2: the order is D, C, E and canStart enforces the $20 cap with the frozen reserve', () => {
  const root = tmpRoot();
  assert.equal(run(['--init', '--root', root]).code, 0);
  const l = ledger.loadLedger(ledgerFile(root));
  assert.doesNotThrow(() => ledger.assertOrder(l, 'D'));
  assert.throws(() => ledger.assertOrder(l, 'C'), /cannot start before D/);
  assert.throws(() => ledger.assertOrder(l, 'E'), /cannot start before D, C/);
  ledger.setBatchStatus(l, 'D', 'complete');
  assert.doesNotThrow(() => ledger.assertOrder(l, 'C'));
  assert.throws(() => ledger.assertOrder(l, 'E'), /cannot start before C/);
  ledger.setBatchStatus(l, 'C', 'stopped');
  assert.doesNotThrow(() => ledger.assertOrder(l, 'E'));

  // Total 12: 12 + 6.5 x 1.25 = 20.125 > 20.
  l.entries.push(ledgerEntry({ id: 'D-spend', batch: 'D', role: 'ui-evaluator', cap: 0.15, charged: 4 }));
  l.entries.push(ledgerEntry({ id: 'C-spend', batch: 'C', role: 'researcher', cap: 1, charged: 3 }));
  l.entries.push(ledgerEntry({ id: 'E-spend', batch: 'E', role: 'workflow:quick', cap: 6.5, charged: 5 }));
  assert.equal(ledger.totalUsd(l), 12);
  const start = ledger.canStart(l, { batch: 'E', role: 'workflow:build', capUsd: 6.5 });
  assert.equal(start.ok, false);
  assert.equal(start.reason, 'global_cap');
  assert.equal(start.reserve, 8.125);
  assert.equal(start.projected, 20.125);
});

test('15: --fit reports whether build 2 can start, worst case, expected case and break-even', () => {
  const root = tmpRoot();
  assert.equal(run(['--init', '--root', root]).code, 0);
  const fit = fitRaw(root);
  assert.deepEqual(pick(fit.worst, ['d', 'c', 'e_spent', 'build1', 'build2_reserve', 'total', 'cap', 'fits', 'e_batch']), {
    d: 4.5, c: 3.5, e_spent: 0, build1: 6.5, build2_reserve: 8.125, total: 22.625, cap: 20, fits: false,
    e_batch: { need: 13, cap: 12, fits: false },
  });
  assert.deepEqual(pick(fit.expected, ['d', 'c', 'build1', 'build2_reserve', 'total', 'fits', 'spare']), {
    d: 3.8, c: 2.6, build1: 4.72, build2_reserve: 8.125, total: 19.245, fits: true, spare: 0.755,
  });
  assert.deepEqual(fit.break_even_build1, { at_caps: 3.875, at_estimates: 5.475 });
  assert.equal(fit.cap_needed_worst, 22.625);
  assert.equal(fit.build2_guaranteed, false);

  // D and C closed at 3.0 and 2.0: the global check fits, E's batch cap still does not (6.5 + 6.5 = 13 > 12).
  const l = ledger.loadLedger(ledgerFile(root));
  l.entries.push(ledgerEntry({ id: 'D-all', batch: 'D', role: 'ui-evaluator', cap: 0.15, charged: 3 }));
  l.entries.push(ledgerEntry({ id: 'C-all', batch: 'C', role: 'researcher', cap: 1, charged: 2 }));
  l.batches.D.spent_usd = 3;
  l.batches.C.spent_usd = 2;
  ledger.setBatchStatus(l, 'D', 'complete');
  ledger.setBatchStatus(l, 'C', 'stopped');
  ledger.saveLedger(ledgerFile(root), l);
  const closed = fitRaw(root);
  assert.equal(closed.worst.d, 3);
  assert.equal(closed.worst.c, 2);
  assert.equal(closed.worst.total, 19.625);
  assert.equal(closed.worst.fits, true);
  assert.deepEqual(closed.worst.e_batch, { need: 13, cap: 12, fits: false });
  assert.equal(closed.build2_guaranteed, false);

  // Build 1 charged 8.5 on its 6.5 cap: build 2's reserve is the cap plus that overshoot.
  const l2 = ledger.loadLedger(ledgerFile(root));
  l2.entries.push(ledgerEntry({ id: 'b82-r1', batch: 'E', role: 'workflow:build', cap: 6.5, charged: 8.5, overshoot: 2 }));
  l2.batches.E.spent_usd = 8.5;
  ledger.saveLedger(ledgerFile(root), l2);
  const over = fitRaw(root);
  assert.equal(over.worst.build2_reserve, 8.5);
  assert.equal(over.worst.build1_done, true);
  assert.equal(over.worst.build1, 0);
  assert.equal(over.worst.e_spent, 8.5);
  assert.deepEqual(over.worst.e_batch, { need: 15, cap: 12, fits: false });
});

test('15: --fit without --raw prints a short table naming the verdict', () => {
  const root = tmpRoot();
  assert.equal(run(['--init', '--root', root]).code, 0);
  const r = run(['--fit', '--root', root]);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /build 2 guaranteed: no/);
  assert.match(r.out, /22\.625/);
  assert.match(r.out, /19\.245/);
});

test('16: --raise changes only the two caps through the frozen loader and saver', () => {
  const root = tmpRoot();
  assert.equal(run(['--init', '--root', root]).code, 0);
  const before = JSON.parse(fs.readFileSync(ledgerFile(root), 'utf-8'));
  const r = run(['--raise', '--root', root, '--cap', '25', '--e-cap', '15', '--reason', 'user: go D C cap 25', '--raw']);
  assert.equal(r.code, 0, r.err);
  const out = JSON.parse(r.out);
  assert.deepEqual(out.before, { cap_usd: 20, e_cap_usd: 12 });
  assert.deepEqual(out.after, { cap_usd: 25, e_cap_usd: 15 });
  assert.equal(out.reason, 'user: go D C cap 25');

  const after = JSON.parse(fs.readFileSync(ledgerFile(root), 'utf-8'));
  // Only the two caps differ (updated_at is the frozen saver's own stamp on every save).
  const strip = (l) => {
    const c = JSON.parse(JSON.stringify(l));
    delete c.cap_usd;
    delete c.batches.E.cap_usd;
    delete c.updated_at;
    return c;
  };
  assert.deepEqual(strip(after), strip(before));
  assert.equal(after.cap_usd, 25);
  assert.equal(after.batches.E.cap_usd, 15);
  assert.doesNotThrow(() => ledger.loadLedger(ledgerFile(root)));
  assert.equal(fitRaw(root).build2_guaranteed, true);
});

test('16: --raise refuses without a reason or below the current total, and leaves the file', () => {
  const root = tmpRoot();
  assert.equal(run(['--init', '--root', root]).code, 0);
  const l = ledger.loadLedger(ledgerFile(root));
  l.entries.push(ledgerEntry({ id: 'D-all', batch: 'D', role: 'ui-evaluator', cap: 0.15, charged: 4 }));
  l.batches.D.spent_usd = 4;
  ledger.saveLedger(ledgerFile(root), l);
  const before = fs.readFileSync(ledgerFile(root), 'utf-8');

  const noReason = run(['--raise', '--root', root, '--cap', '25']);
  assert.equal(noReason.code, 2);
  assert.match(noReason.err, /--reason/);
  const below = run(['--raise', '--root', root, '--cap', '3', '--reason', 'user: lower']);
  assert.equal(below.code, 2);
  assert.match(below.err, /below the current total/);
  assert.equal(fs.readFileSync(ledgerFile(root), 'utf-8'), before);
});

test('usage: a missing --root or mode exits 2 with a usage line', () => {
  const r = run(['--fit']);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage:/);
  const none = run(['--root', tmpRoot()]);
  assert.equal(none.code, 2);
  assert.match(none.err, /usage:/);
});
