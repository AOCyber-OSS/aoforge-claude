'use strict';
// Tests for scripts/eval81/lib/ledger.cjs (TRD 81-01, test list 17-22b). Every ledger is built from a hand-built
// literal or a fresh ledger written into an mkdtemp directory; no network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const load = () => require('./ledger.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-ledger-'));
const AT = '2026-10-17T00:00:00.000Z';

/** A run record as the runner hands it to recordRun. */
function run(over = {}) {
  return {
    id: 'A-A1-sonnet-r1',
    batch: 'A',
    role: 'verifier',
    status: 'ok',
    cost_usd: 0.4,
    transcript_cost_usd: null,
    cap_usd: 0.5,
    finished_at: AT,
    ...over,
  };
}

/** A fresh ledger with `usd` already charged to a seed run in `batch` (role 'seed', so no reserve is affected). */
function seeded(usd, batch = 'E') {
  const { newLedger, recordRun } = load();
  const l = newLedger();
  recordRun(l, run({ id: `${batch}-seed`, batch, role: 'seed', cost_usd: usd, cap_usd: usd }));
  return l;
}

describe('loadLedger', () => {
  test('17. a missing ledger is created only with create: true', () => {
    const { loadLedger, totalUsd, BATCH_CAPS, GLOBAL_CAP_USD } = load();
    const file = path.join(tmp(), 'ledger.json');
    const l = loadLedger(file, { create: true });
    assert.equal(totalUsd(l), 0);
    assert.equal(l.cap_usd, 100);
    assert.equal(GLOBAL_CAP_USD, 100);
    assert.deepEqual(l.order, ['A', 'B', 'D', 'E', 'C']);
    for (const b of ['A', 'B', 'C', 'D', 'E']) {
      assert.equal(l.batches[b].status, 'pending', b);
      assert.equal(l.batches[b].spent_usd, 0, b);
      assert.equal(l.batches[b].cap_usd, BATCH_CAPS[b], b);
    }
    assert.deepEqual(l.entries, []);
    assert.equal(fs.existsSync(file), false, 'create builds in memory; the caller saves');
    assert.throws(() => loadLedger(file, { create: false }), (err) => err.message.includes(file));
    assert.throws(() => loadLedger(file), (err) => err.message.includes(file));
  });
});

describe('batch caps (81-14 post-hoc 2)', () => {
  // 81-DECISION-RULE.md / 81-PREREG.md post-hoc 2 (2026-10-17): "resize the per-batch caps so A and B can complete
  // all 36 runs each and D its 24, keeping the global $100 limit, the reserve rule and the order A,B,D,E,C (C absorbs
  // any shortfall)", sized from batch A's 4-run pilot.
  test('17b. A 10, B 10, D 5, E 55, C none; A estimate 3; the A-E caps sum to at most 80', () => {
    const { BATCH_CAPS, BATCH_ESTIMATES, GLOBAL_CAP_USD } = load();
    assert.deepEqual(BATCH_CAPS, { A: 10, B: 10, D: 5, E: 55, C: null });
    assert.deepEqual(BATCH_ESTIMATES, { A: 3, B: 4, D: 2, E: 44, C: 28 });
    assert.equal(GLOBAL_CAP_USD, 100);
    assert.ok(BATCH_CAPS.A + BATCH_CAPS.B + BATCH_CAPS.D + BATCH_CAPS.E <= 80);
  });
});

describe('canStart and reserveFor', () => {
  test('18. the global check uses the reserve, the batch check the cap', () => {
    const { canStart } = load();
    const fits = canStart(seeded(99.4), { batch: 'A', role: 'verifier', capUsd: 0.4 });
    assert.equal(fits.ok, true);
    assert.equal(fits.reason, null);
    assert.equal(fits.total, 99.4);
    assert.equal(fits.cap, 0.4);
    assert.equal(fits.reserve, 0.5);
    assert.equal(fits.projected, 99.9);
    assert.equal(typeof fits.reserve_basis, 'string');

    // total + cap = 100.00 would fit, but the reserve does not.
    const over = canStart(seeded(99.6), { batch: 'A', role: 'verifier', capUsd: 0.4 });
    assert.equal(over.ok, false);
    assert.equal(over.reason, 'global_cap');
    assert.equal(over.projected, 100.1);

    const batch = canStart(seeded(load().BATCH_CAPS.A - 0.5, 'A'), { batch: 'A', role: 'verifier', capUsd: 0.6 });
    assert.equal(batch.ok, false);
    assert.equal(batch.reason, 'batch_cap');

    const roomy = canStart(seeded(10), { batch: 'A', role: 'verifier', capUsd: 2 });
    assert.equal(roomy.ok, true);
    assert.equal(roomy.reserve, 2.5);
    assert.deepEqual(Object.keys(roomy).sort(), ['cap', 'ok', 'projected', 'reason', 'reserve', 'reserve_basis', 'total']);
  });

  test('18b. an observed overshoot raises the reserve for the same batch and role only', () => {
    const { newLedger, recordRun, reserveFor } = load();
    const l = newLedger();
    recordRun(l, run({ id: 'A-v-1', batch: 'A', role: 'verifier', cost_usd: 1.1, cap_usd: 0.5 }));
    assert.equal(l.entries[0].overshoot_usd, 0.6);

    const same = reserveFor(l, { batch: 'A', role: 'verifier', capUsd: 0.5 });
    assert.equal(same.reserve, 1.1);
    assert.match(same.basis, /A-v-1/);

    assert.equal(reserveFor(l, { batch: 'A', role: 'job-checker', capUsd: 0.5 }).reserve, 0.625);
    assert.equal(reserveFor(l, { batch: 'E', role: 'verifier', capUsd: 0.5 }).reserve, 0.625);
    // A small overshoot never lowers the reserve below cap x 1.25.
    recordRun(l, run({ id: 'B-j-1', batch: 'B', role: 'job-checker', cost_usd: 0.55, cap_usd: 0.5 }));
    assert.equal(reserveFor(l, { batch: 'B', role: 'job-checker', capUsd: 0.5 }).reserve, 0.625);
  });
});

describe('recordRun', () => {
  test('19. charges the larger of reported and transcript cost, else the reserve; ids record once', () => {
    const { newLedger, recordRun, totalUsd } = load();
    const l = newLedger();

    const t = recordRun(l, run({ id: 'r1', cost_usd: 0.4, transcript_cost_usd: 0.55 }));
    assert.equal(t.recorded, true);
    assert.equal(t.entry.charged_usd, 0.55);
    assert.equal(t.entry.cost_source, 'transcript_sum');
    assert.equal(t.entry.overshoot_usd, 0.05);

    const r = recordRun(l, run({ id: 'r2', cost_usd: 0.55, transcript_cost_usd: 0.4 }));
    assert.equal(r.entry.charged_usd, 0.55);
    assert.equal(r.entry.cost_source, 'reported');

    const n = recordRun(l, run({ id: 'r3', status: 'no_result', cost_usd: null, transcript_cost_usd: null, cap_usd: 0.4 }));
    assert.equal(n.entry.charged_usd, 0.5);
    assert.equal(n.entry.cost_source, 'reserve_charged');
    assert.equal(n.entry.reserve_usd, 0.5);

    assert.deepEqual(Object.keys(r.entry).sort(), [
      'at', 'batch', 'cap_usd', 'charged_usd', 'cost_source', 'id', 'overshoot_usd', 'reported_usd', 'reserve_usd',
      'role', 'status', 'transcript_usd',
    ]);
    assert.equal(r.entry.reported_usd, 0.55);
    assert.equal(r.entry.transcript_usd, 0.4);
    assert.equal(r.entry.cap_usd, 0.5);
    assert.equal(r.entry.overshoot_usd, 0.05);
    assert.equal(r.entry.at, AT);

    const before = JSON.stringify(l);
    const dup = recordRun(l, run({ id: 'r1', cost_usd: 9 }));
    assert.equal(dup.recorded, false);
    assert.equal(dup.reason, 'duplicate');
    assert.equal(JSON.stringify(l), before);

    assert.equal(totalUsd(l), 1.6);
    assert.equal(l.batches.A.spent_usd, 1.6);
  });

  test('a reserve passed by the runner is used, and an unpriced transcript with no reported cost charges at least the reserve', () => {
    const { newLedger, recordRun } = load();
    const l = newLedger();
    const given = recordRun(l, run({ id: 'g', cost_usd: null, transcript_cost_usd: null, reserve_usd: 0.9 }));
    assert.equal(given.entry.charged_usd, 0.9);
    // Another role, so g's reserve-sized overshoot does not raise this reserve above 0.5 x 1.25.
    const partial = recordRun(l, run({ id: 'p', role: 'job-checker', cost_usd: null, transcript_cost_usd: 0.1, transcript_unpriced: 3 }));
    assert.equal(partial.entry.charged_usd, 0.625);
    assert.equal(partial.entry.cost_source, 'reserve_charged');
    assert.equal(partial.entry.transcript_usd, 0.1);
  });

  test('a dry run or a budget skip is never charged', () => {
    const { newLedger, recordRun, totalUsd } = load();
    const l = newLedger();
    assert.deepEqual(recordRun(l, run({ id: 'd', status: 'dry_run', cost_usd: null })), { recorded: false, reason: 'not_charged', entry: null });
    assert.equal(recordRun(l, run({ id: 's', status: 'skipped_budget', cost_usd: null })).recorded, false);
    assert.equal(totalUsd(l), 0);
    assert.deepEqual(l.entries, []);
  });

  test('chargeFor computes the money fields without touching the ledger', () => {
    const { newLedger, chargeFor } = load();
    const l = newLedger();
    const before = JSON.stringify(l);
    const money = chargeFor(l, run({ cost_usd: 0.7 }));
    assert.deepEqual(money, { cap_usd: 0.5, reserve_usd: 0.625, reported_usd: 0.7, transcript_usd: null, charged_usd: 0.7, cost_source: 'reported', overshoot_usd: 0.2 });
    assert.equal(JSON.stringify(l), before);
  });
});

describe('batch order and status', () => {
  test('20. a batch starts only after every batch before it in A, B, D, E, C is complete or stopped', () => {
    const { newLedger, assertOrder, setBatchStatus } = load();
    const l = newLedger();
    assertOrder(l, 'A');
    assert.throws(() => assertOrder(l, 'B'), /A/);
    setBatchStatus(l, 'A', 'complete');
    assertOrder(l, 'B');
    const s = newLedger();
    setBatchStatus(s, 'A', 'stopped');
    assertOrder(s, 'B');

    assert.throws(() => assertOrder(l, 'C'), /B/);
    setBatchStatus(l, 'B', 'complete');
    setBatchStatus(l, 'D', 'complete');
    assert.throws(() => assertOrder(l, 'C'), /E/);
    setBatchStatus(l, 'E', 'running');
    assert.throws(() => assertOrder(l, 'C'), /E/);
    setBatchStatus(l, 'E', 'stopped');
    assertOrder(l, 'C');

    assert.throws(() => setBatchStatus(l, 'A', 'done'), /status/);
    assert.throws(() => assertOrder(l, 'F'), /F/);
  });

  test('22. batch C has no fixed batch cap but stays under the reserve rule', () => {
    const { newLedger, canStart, recordRun } = load();
    const l = newLedger();
    assert.equal(l.batches.C.cap_usd, null);
    recordRun(l, run({ id: 'c-big', batch: 'C', role: 'seed', cost_usd: 60, cap_usd: 60 }));
    assert.equal(canStart(l, { batch: 'C', role: 'codebase-mapper', capUsd: 3 }).ok, true);
    // 60 + 32 x 1.25 = 100 would still fit; 60 + 33 x 1.25 = 101.25 does not.
    assert.equal(canStart(l, { batch: 'C', role: 'codebase-mapper', capUsd: 32 }).ok, true);
    const tight = canStart(l, { batch: 'C', role: 'codebase-mapper', capUsd: 33 });
    assert.equal(tight.ok, false);
    assert.equal(tight.reason, 'global_cap');
  });
});

describe('persistence', () => {
  test('21. saveLedger writes through a tmp file and rename; a corrupt ledger makes loadLedger throw', () => {
    const { newLedger, saveLedger, loadLedger, recordRun } = load();
    const dir = tmp();
    const file = path.join(dir, 'ledger.json');
    const l = newLedger();
    recordRun(l, run());
    saveLedger(file, l);
    assert.deepEqual(fs.readdirSync(dir), ['ledger.json']);
    assert.deepEqual(loadLedger(file), l);
    assert.equal(typeof l.updated_at, 'string');

    // A rename onto a directory fails: the tmp file stays and the error is thrown.
    const blocked = path.join(dir, 'blocked.json');
    fs.mkdirSync(blocked);
    fs.writeFileSync(path.join(blocked, 'keep'), 'x');
    assert.throws(() => saveLedger(blocked, l));
    assert.ok(fs.existsSync(`${blocked}.tmp-${process.pid}`));

    fs.writeFileSync(file, '{"version": 1, "entries": [');
    assert.throws(() => loadLedger(file), (err) => err.message.includes(file));
    fs.writeFileSync(file, '{"version": 2}');
    assert.throws(() => loadLedger(file, { create: true }), (err) => err.message.includes(file));
  });
});

describe('rebuildLedger and chargeLost', () => {
  function entry(over) {
    return {
      id: 'x', batch: 'A', role: 'verifier', status: 'ok', cap_usd: 0.5, reserve_usd: 0.625, reported_usd: 0.4,
      transcript_usd: 0.3, charged_usd: 0.4, cost_source: 'reported', overshoot_usd: 0, at: AT, ...over,
    };
  }
  const spendA = {
    ledger_version: 1, batch: 'A', status: 'complete', spent_usd: 0.9, ledger_total_usd: 0.9,
    entries: [entry({ id: 'A-1' }), entry({ id: 'A-2', charged_usd: 0.5, reported_usd: 0.5 })],
  };
  const spendB = {
    ledger_version: 1, batch: 'B', status: 'stopped', spent_usd: 1.2, ledger_total_usd: 2.1,
    entries: [entry({ id: 'B-1', batch: 'B', role: 'job-checker', charged_usd: 1.2, reported_usd: 1.2, overshoot_usd: 0.7 })],
  };

  test('22b. rebuildLedger reconstructs entries, statuses and total from committed spend blocks', () => {
    const { rebuildLedger, totalUsd, reserveFor } = load();
    const l = rebuildLedger([spendB, spendA]);
    assert.deepEqual(l.entries, [...spendA.entries, ...spendB.entries]);
    assert.equal(l.batches.A.status, 'complete');
    assert.equal(l.batches.B.status, 'stopped');
    for (const b of ['C', 'D', 'E']) assert.equal(l.batches[b].status, 'pending', b);
    assert.equal(totalUsd(l), 2.1);
    assert.equal(l.batches.A.spent_usd, 0.9);
    assert.deepEqual(l.rebuilt_from, ['A', 'B']);
    // The overshoot history survives the rebuild.
    assert.equal(reserveFor(l, { batch: 'B', role: 'job-checker', capUsd: 0.5 }).reserve, 1.2);

    assert.throws(() => rebuildLedger([{ ...spendA, spent_usd: 0.8 }]), /\bA\b/);
    assert.throws(() => rebuildLedger([spendA, spendA]), /\bA\b/);
  });

  test('chargeLost adds one lost-root entry and stops the batch', () => {
    const { rebuildLedger, chargeLost, totalUsd } = load();
    const l = rebuildLedger([spendA, spendB]);
    const e = chargeLost(l, 'D', 3);
    assert.equal(e.id, 'D-lost-root');
    assert.equal(e.cost_source, 'lost_root_charged');
    assert.equal(e.charged_usd, 3);
    assert.equal(l.batches.D.status, 'stopped');
    assert.equal(l.batches.D.spent_usd, 3);
    assert.equal(l.entries.filter((x) => x.batch === 'D').length, 1);
    assert.equal(totalUsd(l), 5.1);
    assert.throws(() => chargeLost(l, 'D', 3), /D-lost-root/);
    assert.throws(() => chargeLost(l, 'E', 0), /usd/);
  });

  test('a ledger round-trips through save/load and through its own spend blocks', () => {
    const { newLedger, recordRun, setBatchStatus, saveLedger, loadLedger, spendBlockFor, rebuildLedger, totalUsd, chargeLost } = load();
    const l = newLedger();
    recordRun(l, run({ id: 'A-1', cost_usd: 0.3 }));
    recordRun(l, run({ id: 'A-2', cost_usd: 0.9, transcript_cost_usd: 1.1 }));
    setBatchStatus(l, 'A', 'complete');
    recordRun(l, run({ id: 'B-1', batch: 'B', role: 'job-checker', cost_usd: null, status: 'no_result' }));
    setBatchStatus(l, 'B', 'complete');
    chargeLost(l, 'D', 0.75);

    const file = path.join(tmp(), 'ledger.json');
    saveLedger(file, l);
    assert.deepEqual(loadLedger(file), l);

    const blocks = ['A', 'B', 'D'].map((b) => spendBlockFor(l, b));
    assert.equal(blocks[0].ledger_total_usd, totalUsd(l));
    const r = rebuildLedger(blocks);
    assert.deepEqual(r.entries, l.entries);
    assert.equal(totalUsd(r), totalUsd(l));
    for (const b of ['A', 'B', 'C', 'D', 'E']) assert.deepEqual(r.batches[b], l.batches[b], b);
  });
});
