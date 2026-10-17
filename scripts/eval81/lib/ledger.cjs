'use strict';
/**
 * The objective-81 $100 running-total ledger (TRD 81-01). Shapes (LedgerEntry, SpendBlock) are documented in
 * contract.cjs.
 *
 * Ledger JSON: { version: 1, cap_usd, order, batches: {X: {cap_usd, estimate_usd, status, spent_usd}},
 *   entries: LedgerEntry[], rebuilt_from: null | batch[], updated_at }
 *
 * Why a reserve, not the cap: `claude -p --max-budget-usd` is checked between turns, so a run's last turn can take
 * it past its cap, and if the CLI does not count subagent spend against the budget every subagent's cost can too.
 * The cap is therefore never treated as a spend bound. Before a run, canStart requires
 *   total + reserve <= GLOBAL_CAP_USD,  reserve = max(cap x OVERSHOOT_FACTOR, cap + largest overshoot observed)
 * and, per batch, spent + cap <= the batch cap (C has none: it gets the remainder of the $100).
 *
 * "cap + the largest overshoot observed" is read per batch AND role: only entries with the same batch and role feed
 * it. Batch E's subagent-heavy builds overshoot by more than a single-agent C run can, and letting E's overshoot set
 * C's reserve would starve C for no safety gain (the job-checker's 2026-10-17 note, interpreted here).
 *
 * After a run, recordRun charges max(reported cost, transcript-priced cost). A run with neither (killed before its
 * result event, no transcripts) is charged its reserve, never just its cap: it may have passed the cap before it
 * died. A reported cost may leave out subagent spend; charging the larger figure is correct either way, and both are
 * kept on the entry.
 *
 * The ledger lives in the scratch eval root and can be lost. rebuildLedger reconstructs it from the spend blocks
 * committed in results/<X>.json, and chargeLost charges a batch that was mid-flight when the root was lost.
 *
 * Money sums are rounded to 1e-6, never to cents.
 */

const fs = require('fs');
const path = require('path');
const {
  BATCHES, ORDER, STATUSES, BATCH_STATUSES, UNSPENT_STATUSES, round6, validateSpendBlock,
} = require('./contract.cjs');

const GLOBAL_CAP_USD = 100;
const OVERSHOOT_FACTOR = 1.25;
// 1.5x the estimate for A, B and D; E bounded so C keeps its ~$28; C takes the remainder.
const BATCH_CAPS = { A: 7.5, B: 6, D: 3, E: 55, C: null };
const BATCH_ESTIMATES = { A: 5, B: 4, D: 2, E: 44, C: 28 };
const LEDGER_VERSION = 1;
// Float slack on the "<=" comparisons, far below a cent.
const EPS = 1e-9;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isMoney = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const normRole = (role) => (role === undefined || role === null ? null : role);
const nowIso = () => new Date().toISOString();

function assertBatch(batch, fn) {
  if (!BATCHES.includes(batch)) throw new TypeError(`${fn}: unknown batch ${batch} (one of ${BATCHES.join(', ')})`);
}

/** An empty ledger: total 0, every batch pending. */
function newLedger() {
  const batches = {};
  for (const b of ORDER) {
    batches[b] = { cap_usd: BATCH_CAPS[b], estimate_usd: BATCH_ESTIMATES[b], status: 'pending', spent_usd: 0 };
  }
  return {
    version: LEDGER_VERSION,
    cap_usd: GLOBAL_CAP_USD,
    order: [...ORDER],
    batches,
    entries: [],
    rebuilt_from: null,
    updated_at: null,
  };
}

/**
 * Read the ledger. A missing file is a new ledger only with `create: true` (in memory; the caller saves). An
 * unreadable, unparseable or wrong-shaped file throws naming the path: spend tracking never silently resets.
 */
function loadLedger(file, { create = false } = {}) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (create) return newLedger();
      throw new Error(`ledger not found: ${file} (create it with the runner's --init-ledger)`);
    }
    throw new Error(`cannot read ledger ${file}: ${err.code || err.message}`);
  }
  let l;
  try {
    l = JSON.parse(text);
  } catch (err) {
    throw new Error(`ledger ${file} is not valid JSON (${err.message}); refusing to start rather than reset spend`);
  }
  const problems = [];
  if (!isPlainObject(l)) problems.push('not an object');
  else {
    if (l.version !== LEDGER_VERSION) problems.push(`version ${l.version} is not ${LEDGER_VERSION}`);
    if (!isPlainObject(l.batches) || !BATCHES.every((b) => isPlainObject(l.batches[b]))) problems.push('batches must hold A-E');
    if (!Array.isArray(l.entries)) problems.push('entries must be an array');
  }
  if (problems.length) throw new Error(`ledger ${file} is malformed: ${problems.join('; ')}`);
  return l;
}

/**
 * Write the ledger atomically: `<file>.tmp-<pid>` then rename. Sets `updated_at` on the ledger first. A failed
 * rename leaves the tmp file, throws, and keeps the previous ledger intact.
 */
function saveLedger(file, ledger) {
  ledger.updated_at = nowIso();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`);
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    throw new Error(`ledger save failed: cannot rename ${tmp} to ${file} (${err.code || err.message}); previous ledger kept`);
  }
}

/** Sum of every entry's charged_usd. */
function totalUsd(l) {
  return round6(l.entries.reduce((sum, e) => sum + (isMoney(e.charged_usd) ? e.charged_usd : 0), 0));
}

function batchSpent(l, batch) {
  return round6(l.entries.reduce((sum, e) => (e.batch === batch && isMoney(e.charged_usd) ? sum + e.charged_usd : sum), 0));
}

function syncSpent(l, batch) {
  l.batches[batch].spent_usd = batchSpent(l, batch);
}

/**
 * The reserve a run must fit before it starts: max(cap x 1.25, cap + the largest overshoot among entries with the
 * same batch and role), with the derivation.
 * @returns {{reserve: number, basis: string}}
 */
function reserveFor(l, { batch, role, capUsd }) {
  assertBatch(batch, 'reserveFor');
  if (!isMoney(capUsd) || capUsd <= 0) throw new TypeError('reserveFor: capUsd must be a positive number');
  const r = normRole(role);
  const base = round6(capUsd * OVERSHOOT_FACTOR);
  let worst = null;
  for (const e of l.entries) {
    if (e.batch !== batch || normRole(e.role) !== r || !isMoney(e.overshoot_usd) || e.overshoot_usd <= 0) continue;
    if (!worst || e.overshoot_usd > worst.overshoot_usd) worst = e;
  }
  if (worst) {
    const observed = round6(capUsd + worst.overshoot_usd);
    if (observed > base) {
      return {
        reserve: observed,
        basis: `cap ${capUsd} + overshoot ${worst.overshoot_usd} observed on ${worst.id} (${batch}/${r}) = ${observed}`,
      };
    }
  }
  return { reserve: base, basis: `cap ${capUsd} x ${OVERSHOOT_FACTOR} = ${base}` };
}

/**
 * May a run start? Global: total + reserve <= $100. Batch: spent + cap <= the batch cap (none for C).
 * @returns {{ok: boolean, reason: null|'global_cap'|'batch_cap', total: number, cap: number, reserve: number,
 *   reserve_basis: string, projected: number}}
 */
function canStart(l, { batch, role, capUsd }) {
  const { reserve, basis } = reserveFor(l, { batch, role, capUsd });
  const total = totalUsd(l);
  const projected = round6(total + reserve);
  const capLimit = isMoney(l.cap_usd) ? l.cap_usd : GLOBAL_CAP_USD;
  const batchCap = l.batches[batch] ? l.batches[batch].cap_usd : BATCH_CAPS[batch];
  let reason = null;
  if (projected > capLimit + EPS) reason = 'global_cap';
  else if (isMoney(batchCap) && round6(batchSpent(l, batch) + capUsd) > batchCap + EPS) reason = 'batch_cap';
  return { ok: reason === null, reason, total, cap: capUsd, reserve, reserve_basis: basis, projected };
}

const finiteOrNull = (v) => (isMoney(v) ? v : null);

/**
 * The LedgerEntry money fields for a run record, without touching the ledger. The runner can call this to fill the
 * RunRecord before it writes record.json, then recordRun.
 * Charged = the larger of the non-null reported (`cost_usd`) and transcript (`transcript_cost_usd`) costs; with
 * neither, the reserve. With no reported cost and a transcript sum that left messages unpriced
 * (`transcript_unpriced` > 0), at least the reserve.
 */
function chargeFor(l, record) {
  const cap = finiteOrNull(record.cap_usd !== undefined ? record.cap_usd : record.capUsd);
  const reported = finiteOrNull(record.cost_usd);
  const transcript = finiteOrNull(record.transcript_cost_usd);
  let reserve = finiteOrNull(record.reserve_usd);
  if (reserve === null && cap !== null && cap > 0) reserve = reserveFor(l, { batch: record.batch, role: record.role, capUsd: cap }).reserve;

  let charged;
  let source;
  if (reported === null && transcript === null) {
    if (reserve === null) throw new Error(`recordRun: run ${record.id} has no cost and no cap_usd to size its reserve`);
    charged = reserve;
    source = 'reserve_charged';
  } else if (transcript !== null && (reported === null || transcript > reported)) {
    charged = transcript;
    source = 'transcript_sum';
  } else {
    charged = reported;
    source = 'reported';
  }
  if (reported === null && record.transcript_unpriced > 0 && reserve !== null && reserve > charged) {
    charged = reserve;
    source = 'reserve_charged';
  }
  charged = round6(charged);
  return {
    cap_usd: cap,
    reserve_usd: reserve,
    reported_usd: reported,
    transcript_usd: transcript,
    charged_usd: charged,
    cost_source: source,
    overshoot_usd: cap === null ? 0 : Math.max(0, round6(charged - cap)),
  };
}

/**
 * Charge a finished run. Idempotent by id (a second record of the same id changes nothing). A dry_run or
 * skipped_budget record is never charged: nothing was spawned.
 * @returns {{recorded: boolean, reason: null|'duplicate'|'not_charged', entry: object|null}}
 */
function recordRun(l, record) {
  if (!isPlainObject(record) || typeof record.id !== 'string' || record.id === '') {
    throw new TypeError('recordRun: record.id must be a non-empty string');
  }
  assertBatch(record.batch, 'recordRun');
  if (!STATUSES.includes(record.status)) throw new TypeError(`recordRun: run ${record.id} has unknown status ${record.status}`);
  if (UNSPENT_STATUSES.includes(record.status)) return { recorded: false, reason: 'not_charged', entry: null };
  const existing = l.entries.find((e) => e.id === record.id);
  if (existing) return { recorded: false, reason: 'duplicate', entry: existing };
  const money = chargeFor(l, record);
  const entry = {
    id: record.id,
    batch: record.batch,
    role: normRole(record.role),
    status: record.status,
    ...money,
    at: typeof record.finished_at === 'string' ? record.finished_at : nowIso(),
  };
  l.entries.push(entry);
  syncSpent(l, record.batch);
  return { recorded: true, reason: null, entry };
}

/** Set a batch's status (pending | running | complete | stopped). */
function setBatchStatus(l, batch, status) {
  assertBatch(batch, 'setBatchStatus');
  if (!BATCH_STATUSES.includes(status)) throw new TypeError(`setBatchStatus: status must be one of ${BATCH_STATUSES.join(', ')}`);
  l.batches[batch].status = status;
}

/** Throw unless every batch before `batch` in A, B, D, E, C is complete or stopped. */
function assertOrder(l, batch) {
  assertBatch(batch, 'assertOrder');
  const order = Array.isArray(l.order) ? l.order : ORDER;
  const before = order.slice(0, order.indexOf(batch));
  const undone = before.filter((b) => !['complete', 'stopped'].includes(l.batches[b].status));
  if (undone.length) {
    const detail = undone.map((b) => `${b} is ${l.batches[b].status}`).join(', ');
    throw new Error(`batch ${batch} cannot start before ${undone.join(', ')} complete or stop (${detail})`);
  }
}

/** The SpendBlock for one batch (what score.cjs commits as results/<X>.json `spend`). Entries are copies. */
function spendBlockFor(l, batch) {
  assertBatch(batch, 'spendBlockFor');
  return {
    ledger_version: LEDGER_VERSION,
    batch,
    status: l.batches[batch].status,
    spent_usd: batchSpent(l, batch),
    ledger_total_usd: totalUsd(l),
    entries: l.entries.filter((e) => e.batch === batch).map((e) => ({ ...e })),
  };
}

/**
 * Reconstruct a ledger from committed spend blocks (pure). Each block is validated (its entries must sum to its
 * spent_usd); two blocks for one batch throw. Batches without a block are pending.
 */
function rebuildLedger(spendBlocks) {
  if (!Array.isArray(spendBlocks)) throw new TypeError('rebuildLedger: expected an array of spend blocks');
  const byBatch = new Map();
  for (const block of spendBlocks) {
    const batch = isPlainObject(block) ? block.batch : undefined;
    const res = validateSpendBlock(block);
    if (!res.ok) throw new Error(`rebuildLedger: spend block for batch ${batch} is invalid: ${res.errors.join('; ')}`);
    if (byBatch.has(batch)) throw new Error(`rebuildLedger: two spend blocks for batch ${batch}`);
    byBatch.set(batch, block);
  }
  const l = newLedger();
  const from = [];
  for (const b of ORDER) {
    const block = byBatch.get(b);
    if (!block) continue;
    from.push(b);
    l.entries.push(...block.entries.map((e) => ({ ...e })));
    l.batches[b].status = block.status;
    l.batches[b].spent_usd = block.spent_usd;
  }
  l.rebuilt_from = from;
  return l;
}

/**
 * Charge `usd` to a batch whose scratch root was lost mid-flight (one `<X>-lost-root` entry, cost_source
 * lost_root_charged) and stop the batch. Throws when the batch was already charged this way.
 */
function chargeLost(l, batch, usd) {
  assertBatch(batch, 'chargeLost');
  if (!isMoney(usd) || usd <= 0) throw new TypeError('chargeLost: usd must be a positive number');
  const id = `${batch}-lost-root`;
  if (l.entries.some((e) => e.id === id)) throw new Error(`chargeLost: ${id} is already charged`);
  const entry = {
    id,
    batch,
    role: null,
    status: 'lost_root',
    cap_usd: null,
    reserve_usd: null,
    reported_usd: null,
    transcript_usd: null,
    charged_usd: round6(usd),
    cost_source: 'lost_root_charged',
    overshoot_usd: 0,
    at: nowIso(),
  };
  l.entries.push(entry);
  syncSpent(l, batch);
  l.batches[batch].status = 'stopped';
  return entry;
}

module.exports = {
  GLOBAL_CAP_USD,
  OVERSHOOT_FACTOR,
  BATCH_CAPS,
  BATCH_ESTIMATES,
  LEDGER_VERSION,
  newLedger,
  loadLedger,
  saveLedger,
  totalUsd,
  reserveFor,
  canStart,
  chargeFor,
  recordRun,
  setBatchStatus,
  assertOrder,
  spendBlockFor,
  rebuildLedger,
  chargeLost,
};
