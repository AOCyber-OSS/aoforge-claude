#!/usr/bin/env node
'use strict';
/**
 * Objective 82's hard-capped ledger (TRD 82-05), written for and read by objective 81's frozen ledger library
 * (scripts/eval81/lib/ledger.cjs) and runner, never by a copy of them.
 *
 *   --init  --root <R>          write <R>/ledger.json: ledger.newLedger() with cap_usd 20, order D, C, E, A, B, the
 *                               D/C/E rows below, A and B stopped ("not an objective 82 batch", cap 0). Refuses (exit
 *                               2) when the file exists. Never use the runner's --init-ledger here: it writes 81's $100.
 *   --fit   --root <R> [--raw]  can E's second build start? Shown at every spend gate (82-08, 82-09) before any spend.
 *   --raise --root <R> --cap <usd> [--e-cap <usd>] --reason <text> [--raw]
 *                               on the user's word: change cap_usd (and batches.E.cap_usd) through the frozen loader
 *                               and saver, reload, print before/after and the reason (for the SUMMARY; the ledger
 *                               stores nothing new, so the frozen loader keeps accepting it).
 *
 * The fit arithmetic mirrors ledger.canStart for build 2 (role workflow:build, cap E_RUN_CAP_USD):
 *   global   D + C + E spent + build 1 + reserveFor(E, workflow:build, 6.5) <= cap_usd
 *   E batch  E spent + build 1 + 6.5 <= batches.E.cap_usd
 * D and C count as their spend once complete or stopped; otherwise the larger of spend and cap (worst) or of spend and
 * estimate (expected). Build 1 counts at its 6.5 cap (worst) or the expected 4.72 (the mean of objective 81's two
 * 3.1.0 builds, $5.09 and $4.35), or 0 once `b82-r1` is charged (its cost is then in E's spend). Build 2's reserve is
 * the frozen reserveFor: 6.5 x 1.25 = 8.125, or 6.5 + the largest overshoot of an E build. The break-even build-1
 * cost is min(cap_usd - D - C - E spent - reserve, E cap - E spent - 6.5).
 * Worked numbers on a fresh ledger: worst 4.5 + 3.5 + 0 + 6.5 + 8.125 = 22.625 > 20 (not guaranteed; the E batch
 * check 6.5 + 6.5 = 13 > 12 fails too); expected 3.8 + 2.6 + 4.72 + 8.125 = 19.245 (fits, 0.755 spare); break-even
 * 3.875 at the caps, 5.475 at the estimates. At cap 25 and E cap 15 the worst case fits.
 */

const fs = require('fs');
const path = require('path');
const ledgerLib = require('../eval81/lib/ledger.cjs');
const { round6 } = require('../eval81/lib/contract.cjs');
const { E_RUN_CAP_USD } = require('./batches/E.cjs');

const GLOBAL_CAP_USD = 20;
const ORDER = ['D', 'C', 'E', 'A', 'B'];
const BATCH_ROWS = {
  D: { cap_usd: 4.5, estimate_usd: 3.8 },
  C: { cap_usd: 3.5, estimate_usd: 2.6 },
  E: { cap_usd: 12, estimate_usd: 9.4 },
};
const NOT_82 = ['A', 'B'];
const NOT_82_REASON = 'not an objective 82 batch';
const E_EXPECTED_BUILD_USD = 4.72;
const BUILD_ROLE = 'workflow:build';
const BUILD1_ID = 'b82-r1';
const EPS = 1e-9;
const CLOSED = ['complete', 'stopped'];

const USAGE = [
  'usage: node scripts/eval82/ledger82.cjs --init --root <R>',
  '       node scripts/eval82/ledger82.cjs --fit --root <R> [--raw]',
  '       node scripts/eval82/ledger82.cjs --raise --root <R> --cap <usd> [--e-cap <usd>] --reason <text> [--raw]',
].join('\n');

class UsageError extends Error {}

/** The objective-82 ledger, built from the frozen newLedger(): only cap_usd, order and the batch rows change. */
function initialLedger() {
  const l = ledgerLib.newLedger();
  l.cap_usd = GLOBAL_CAP_USD;
  l.order = [...ORDER];
  for (const [b, row] of Object.entries(BATCH_ROWS)) Object.assign(l.batches[b], row, { status: 'pending', spent_usd: 0 });
  for (const b of NOT_82) Object.assign(l.batches[b], { cap_usd: 0, estimate_usd: 0, status: 'stopped', stop_reason: NOT_82_REASON });
  return l;
}

function batchSpent(l, batch) {
  return round6(l.entries.reduce((s, e) => (e.batch === batch && typeof e.charged_usd === 'number' ? s + e.charged_usd : s), 0));
}

function partFor(l, batch, mode) {
  const row = l.batches[batch];
  const spent = batchSpent(l, batch);
  if (CLOSED.includes(row.status)) return spent;
  return Math.max(spent, mode === 'worst' ? row.cap_usd : row.estimate_usd);
}

function scenario(l, mode, reserve, build1Done) {
  const d = partFor(l, 'D', mode);
  const c = partFor(l, 'C', mode);
  const eSpent = batchSpent(l, 'E');
  const build1 = build1Done ? 0 : mode === 'worst' ? E_RUN_CAP_USD : E_EXPECTED_BUILD_USD;
  const total = round6(d + c + eSpent + build1 + reserve);
  const cap = l.cap_usd;
  const eCap = l.batches.E.cap_usd;
  const need = round6(eSpent + build1 + E_RUN_CAP_USD);
  const out = {
    d,
    c,
    e_spent: eSpent,
    build1,
    build1_done: build1Done,
    build2_reserve: reserve,
    total,
    cap,
    fits: total <= cap + EPS,
    spare: round6(cap - total),
    e_batch: { need, cap: eCap, fits: need <= eCap + EPS },
  };
  return out;
}

/** fitReport(ledger) -> the --fit object (test 15). */
function fitReport(l) {
  const { reserve, basis } = ledgerLib.reserveFor(l, { batch: 'E', role: BUILD_ROLE, capUsd: E_RUN_CAP_USD });
  const build1Done = l.entries.some((e) => e.batch === 'E' && e.id === BUILD1_ID);
  const worst = scenario(l, 'worst', reserve, build1Done);
  const expected = scenario(l, 'expected', reserve, build1Done);
  const eSpent = batchSpent(l, 'E');
  const eRoom = l.batches.E.cap_usd - eSpent - E_RUN_CAP_USD;
  const breakEven = (s) => round6(Math.min(l.cap_usd - s.d - s.c - eSpent - reserve, eRoom));
  return {
    ledger_total_usd: ledgerLib.totalUsd(l),
    cap_usd: l.cap_usd,
    e_cap_usd: l.batches.E.cap_usd,
    statuses: Object.fromEntries(ORDER.map((b) => [b, l.batches[b].status])),
    build_cap_usd: E_RUN_CAP_USD,
    build2_reserve_basis: basis,
    worst,
    expected,
    break_even_build1: build1Done ? null : { at_caps: breakEven(worst), at_estimates: breakEven(expected) },
    cap_needed_worst: worst.total,
    e_cap_needed_worst: worst.e_batch.need,
    build2_guaranteed: worst.fits && worst.e_batch.fits,
  };
}

function fitTable(f) {
  const yes = (b) => (b ? 'yes' : 'no');
  const row = (name, s) => `${name.padEnd(9)} D ${s.d}  C ${s.c}  E spent ${s.e_spent}  build 1 ${s.build1_done ? 'done' : s.build1}  build-2 reserve ${s.build2_reserve}  = ${s.total} of ${s.cap} (${s.fits ? `fits, ${s.spare} spare` : `over by ${round6(-s.spare)}`}); E batch ${s.e_batch.need} of ${s.e_batch.cap} (${s.e_batch.fits ? 'fits' : 'over'})`;
  const lines = [
    `ledger total ${f.ledger_total_usd} of ${f.cap_usd}; batches ${ORDER.map((b) => `${b} ${f.statuses[b]}`).join(', ')}`,
    `build-2 reserve: ${f.build2_reserve_basis}`,
    row('worst', f.worst),
    row('expected', f.expected),
  ];
  if (f.break_even_build1) lines.push(`break-even build-1 cost: ${f.break_even_build1.at_caps} with D and C at their caps, ${f.break_even_build1.at_estimates} at their estimates`);
  lines.push(`build 2 guaranteed: ${yes(f.build2_guaranteed)} (worst case needs cap ${f.cap_needed_worst} and E cap ${f.e_cap_needed_worst})`);
  return lines.join('\n');
}

function parseArgs(argv) {
  const opts = { raw: false };
  const modes = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--init' || a === '--fit' || a === '--raise') modes.push(a.slice(2));
    else if (a === '--raw') opts.raw = true;
    else if (['--root', '--cap', '--e-cap', '--reason'].includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value`);
      opts[a.slice(2).replace('-', '_')] = v;
      i += 1;
    } else throw new UsageError(`unknown argument ${a}`);
  }
  if (modes.length !== 1) throw new UsageError('give exactly one of --init, --fit, --raise');
  if (!opts.root) throw new UsageError('missing --root');
  return { mode: modes[0], opts };
}

function money(v, flag) {
  const n = Number(v);
  if (typeof v !== 'string' || v.trim() === '' || !Number.isFinite(n) || n <= 0) throw new UsageError(`${flag} must be a positive number of dollars`);
  return n;
}

function doInit(file) {
  if (fs.existsSync(file)) throw new UsageError(`${file} exists; --init never overwrites a ledger`);
  const l = initialLedger();
  ledgerLib.saveLedger(file, l);
  ledgerLib.loadLedger(file);
  return { written: file, cap_usd: l.cap_usd, order: l.order, batches: l.batches };
}

function doRaise(file, opts) {
  if (typeof opts.reason !== 'string' || opts.reason.trim() === '') throw new UsageError('--raise needs --reason <text> (the user\'s word)');
  if (opts.cap === undefined) throw new UsageError('--raise needs --cap <usd>');
  const cap = money(opts.cap, '--cap');
  const eCap = opts.e_cap === undefined ? null : money(opts.e_cap, '--e-cap');
  const l = ledgerLib.loadLedger(file);
  const total = ledgerLib.totalUsd(l);
  if (cap + EPS < total) throw new UsageError(`--cap ${cap} is below the current total ${total}`);
  const eSpent = batchSpent(l, 'E');
  if (eCap !== null && eCap + EPS < eSpent) throw new UsageError(`--e-cap ${eCap} is below E's spend ${eSpent}`);
  const before = { cap_usd: l.cap_usd, e_cap_usd: l.batches.E.cap_usd };
  l.cap_usd = cap;
  if (eCap !== null) l.batches.E.cap_usd = eCap;
  ledgerLib.saveLedger(file, l);
  const reloaded = ledgerLib.loadLedger(file);
  return {
    before,
    after: { cap_usd: reloaded.cap_usd, e_cap_usd: reloaded.batches.E.cap_usd },
    reason: opts.reason,
    fit: fitReport(reloaded),
  };
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    return 2;
  }
  const { mode, opts } = parsed;
  const file = path.join(path.resolve(opts.root), 'ledger.json');
  try {
    if (mode === 'init') {
      const r = doInit(file);
      process.stdout.write(opts.raw ? `${JSON.stringify(r, null, 2)}\n` : `wrote ${r.written}: cap ${r.cap_usd}, order ${r.order.join(', ')}; D ${BATCH_ROWS.D.cap_usd}, C ${BATCH_ROWS.C.cap_usd}, E ${BATCH_ROWS.E.cap_usd}; A and B stopped\n`);
    } else if (mode === 'fit') {
      const f = fitReport(ledgerLib.loadLedger(file));
      process.stdout.write(opts.raw ? `${JSON.stringify(f, null, 2)}\n` : `${fitTable(f)}\n`);
    } else {
      const r = doRaise(file, opts);
      process.stdout.write(opts.raw ? `${JSON.stringify(r, null, 2)}\n`
        : `cap ${r.before.cap_usd} -> ${r.after.cap_usd}; E cap ${r.before.e_cap_usd} -> ${r.after.e_cap_usd}\nreason: ${r.reason}\n${fitTable(r.fit)}\n`);
    }
    return 0;
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return err instanceof UsageError ? 2 : 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {
  GLOBAL_CAP_USD, ORDER, BATCH_ROWS, NOT_82_REASON, E_RUN_CAP_USD, E_EXPECTED_BUILD_USD, BUILD_ROLE, BUILD1_ID,
  initialLedger, fitReport, fitTable, main,
};
