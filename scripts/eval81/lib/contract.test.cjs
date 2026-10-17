'use strict';
// Tests for scripts/eval81/lib/contract.cjs (TRD 81-01, test list 1-4). Every descriptor, record and spend block is a
// hand-built literal; no network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const load = () => require('./contract.cjs');

function descriptor(over = {}) {
  return {
    id: 'A-A1-haiku-r1',
    batch: 'A',
    kind: 'agent',
    agent: 'aoforge:verifier',
    model: 'haiku',
    plugin: '3.1.0',
    prompt: 'Verify objective 1 against its must-haves.',
    capUsd: 0.5,
    timeoutMs: 900000,
    env: { AOFORGE_SKIP_PRUNE: '1' },
    fixture: { name: 'A1' },
    order: 0,
    ...over,
  };
}

function record(over = {}) {
  return { id: 'A-A1-haiku-r1', batch: 'A', role: 'verifier', status: 'ok', cost_usd: 0.1, ...over };
}

function entry(over = {}) {
  return {
    id: 'A-A1-haiku-r1',
    batch: 'A',
    role: 'verifier',
    status: 'ok',
    cap_usd: 0.5,
    reserve_usd: 0.625,
    reported_usd: 0.4,
    transcript_usd: 0.3,
    charged_usd: 0.4,
    cost_source: 'reported',
    overshoot_usd: 0,
    at: '2026-10-17T00:00:00.000Z',
    ...over,
  };
}

describe('validateDescriptor', () => {
  test('1. a complete descriptor validates ok', () => {
    const { validateDescriptor } = load();
    assert.deepEqual(validateDescriptor(descriptor()), { ok: true, errors: [] });
    const full = descriptor({ tools: ['Read'], jsonSchema: { type: 'object' }, capBasis: 'p90', role: 'verifier' });
    assert.deepEqual(validateDescriptor(full), { ok: true, errors: [] });
    // kind prompt carries no agent.
    assert.equal(validateDescriptor(descriptor({ kind: 'prompt', agent: null })).ok, true);
  });

  test('2. each bad field fails with an error naming it', () => {
    const { validateDescriptor } = load();
    const cases = [
      [{ batch: 'F' }, 'batch'],
      [{ model: 'fable' }, 'model'],
      [{ capUsd: 0 }, 'capUsd'],
      [{ capUsd: undefined }, 'capUsd'],
      [{ capUsd: -1 }, 'capUsd'],
      [{ id: 'a/b' }, 'id'],
      [{ env: { ANTHROPIC_API_KEY: 'x' } }, 'env.ANTHROPIC_API_KEY'],
      [{ env: { AOFORGE_SKIP_EDIT_GATE: '0' } }, 'env.AOFORGE_SKIP_EDIT_GATE'],
    ];
    for (const [over, field] of cases) {
      const res = validateDescriptor(descriptor(over));
      assert.equal(res.ok, false, `${field} should fail`);
      assert.ok(res.errors.some((e) => e.startsWith(`${field}:`)), `${field} named in ${JSON.stringify(res.errors)}`);
    }
    const missing = descriptor();
    delete missing.capUsd;
    assert.ok(validateDescriptor(missing).errors.some((e) => e.startsWith('capUsd:')));
    assert.equal(validateDescriptor(null).ok, false);
  });

  test('3. ORDER is A, B, D, E, C and kind is agent | prompt | workflow', () => {
    const { ORDER, KINDS, BATCHES, validateDescriptor } = load();
    assert.deepEqual(ORDER, ['A', 'B', 'D', 'E', 'C']);
    assert.deepEqual([...BATCHES].sort(), [...ORDER].sort());
    assert.deepEqual(KINDS, ['agent', 'prompt', 'workflow']);
    const bad = validateDescriptor(descriptor({ kind: 'script' }));
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.startsWith('kind:')));
  });
});

describe('validateRecord and validateSpendBlock', () => {
  test('4. validateRecord accepts every status and rejects a record with neither cost_usd nor cost_source', () => {
    const { validateRecord, STATUSES, COST_SOURCES } = load();
    for (const status of STATUSES) {
      assert.deepEqual(validateRecord(record({ status })), { ok: true, errors: [] }, status);
    }
    // A no_result run has no reported cost but the ledger names how it was charged.
    assert.equal(validateRecord(record({ status: 'no_result', cost_usd: null, cost_source: 'reserve_charged' })).ok, true);
    for (const source of COST_SOURCES) assert.equal(validateRecord(record({ cost_source: source })).ok, true);

    const neither = record();
    delete neither.cost_usd;
    const res = validateRecord(neither);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.startsWith('cost_usd:')));
    assert.equal(validateRecord(record({ cost_usd: null })).ok, false);
    assert.equal(validateRecord(record({ status: 'done' })).ok, false);
    assert.equal(validateRecord(record({ cost_source: 'guess' })).ok, false);
  });

  test('validateSpendBlock checks the batch, the entries and their sum', () => {
    const { validateSpendBlock } = load();
    const block = {
      ledger_version: 1,
      batch: 'A',
      status: 'complete',
      spent_usd: 0.9,
      ledger_total_usd: 0.9,
      entries: [entry(), entry({ id: 'A-A2-haiku-r1', charged_usd: 0.5, reported_usd: 0.5 })],
    };
    assert.deepEqual(validateSpendBlock(block), { ok: true, errors: [] });
    assert.equal(validateSpendBlock({ ...block, spent_usd: 0.8 }).ok, false);
    assert.equal(validateSpendBlock({ ...block, batch: 'F' }).ok, false);
    assert.equal(validateSpendBlock({ ...block, entries: [entry({ batch: 'B' }), entry({ id: 'x', charged_usd: 0.5 })] }).ok, false);
    assert.equal(validateSpendBlock({ ...block, entries: [entry({ cost_source: 'guess' }), entry({ id: 'x', charged_usd: 0.5 })] }).ok, false);
    const lost = { ...block, batch: 'D', status: 'stopped', spent_usd: 3, entries: [entry({ id: 'D-lost-root', batch: 'D', role: null, status: 'lost_root', cap_usd: null, reserve_usd: null, reported_usd: null, transcript_usd: null, charged_usd: 3, cost_source: 'lost_root_charged' })] };
    assert.deepEqual(validateSpendBlock(lost), { ok: true, errors: [] });
  });
});

describe('fixture builders', () => {
  test('every canned stream is exported and serialises to one JSON event per line', () => {
    const sj = require('../__fixtures__/stream-json.cjs');
    const canned = ['happyStream', 'capHitStream', 'usageLimitStream', 'http429Stream', 'noResultStream', 'sideModelStream'];
    for (const name of canned) {
      assert.equal(typeof sj[name], 'function', name);
      const lines = sj.toLines(sj[name]()).trim().split('\n');
      assert.ok(lines.length >= 2, name);
      for (const line of lines) assert.equal(typeof JSON.parse(line).type, 'string', `${name}: ${line}`);
    }
    // A repeated message is one event per content block, all with the same id and usage.
    const rows = sj.assistantMsg({ id: 'm', repeat: true, content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].message.id, rows[1].message.id);
    assert.deepEqual(rows[0].message.usage, rows[1].message.usage);
    // An optional result field can be left out.
    assert.equal('num_turns' in sj.resultEvent({ omit: ['num_turns'] }), false);
  });

  test('the calibration builder writes the agent_overhead p90 shape', () => {
    const { makeCalibration } = require('../__fixtures__/calibration.cjs');
    const cal = makeCalibration({ agentOverhead: { verifier: 1.7634 }, trdLevelP90: 4 });
    assert.equal(cal.agent_overhead.verifier.cost_usd.p90, 1.7634);
    assert.equal(cal.trd_level.cost_usd.p90, 4);
    assert.equal(makeCalibration({ agentOverhead: {} }).trd_level, undefined);
  });
});
