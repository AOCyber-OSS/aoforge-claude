'use strict';
// Tests for scripts/eval81/lib/roles.cjs (TRD 81-12, test list 6-8). Every transcript is hand-built JSONL from
// __fixtures__/transcripts.cjs written into an mkdtemp directory; prices come from the hand-built RATES object.
// No network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tx = require('../__fixtures__/transcripts.cjs');
const { transcriptCost } = require('./result.cjs');

const load = () => require('./roles.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-roles-'));

const FIELDS = ['role', 'agent_type', 'agent_id', 'model', 'first_turn_input', 'messages', 'input', 'cache_creation',
  'cache_read', 'output', 'total_tokens', 'cache_writes', 'cost_usd', 'wall_s'];
const pick = (row) => Object.fromEntries(FIELDS.map((k) => [k, row[k]]));

function standardRun(layoutKey) {
  const runDir = tmp();
  tx.writeSpawns(path.join(runDir, 'transcripts'), tx.STANDARD_RUN, layoutKey === undefined ? {} : { key: layoutKey });
  return runDir;
}

const mainFile = (runDir) => path.join(runDir, 'transcripts', tx.PROJECT_KEY, `${tx.SESSION}.jsonl`);
const subFile = (runDir, id) => path.join(runDir, 'transcripts', tx.PROJECT_KEY, tx.SESSION, 'subagents', `agent-${id}.jsonl`);

describe('firstTurnInput', () => {
  test('6. input + cache_creation + cache_read of the first deduped assistant message', () => {
    const { firstTurnInput } = load();
    const runDir = standardRun();
    assert.equal(firstTurnInput(mainFile(runDir)), 3 + 20000 + 16000);
    assert.equal(firstTurnInput(subFile(runDir, 'p1')), 5 + 30000 + 0);
    assert.equal(firstTurnInput(subFile(runDir, 'v1')), 7 + 18000);
  });

  test('6. a synthetic row first is skipped; no assistant usage or no file gives null', () => {
    const { firstTurnInput } = load();
    const dir = tmp();
    const file = path.join(dir, 's.jsonl');
    fs.writeFileSync(file, tx.toLines([
      tx.userRow({ at: '2026-10-17T09:00:00.000Z', text: 'hi', uuid: 'u1' }),
      ...tx.assistantRows({ id: 'syn', model: '<synthetic>', at: '2026-10-17T09:00:01.000Z', input: 99, cc: 0, cr: 0, out: 1 }),
      ...tx.assistantRows({ id: 'real', model: tx.SONNET, at: '2026-10-17T09:00:02.000Z', input: 1, cc: 2, cr: 3, out: 4, blocks: 2 }),
    ]));
    assert.equal(firstTurnInput(file), 6);
    const empty = path.join(dir, 'empty.jsonl');
    fs.writeFileSync(empty, tx.toLines([tx.userRow({ at: '2026-10-17T09:00:00.000Z', text: 'hi', uuid: 'u1' })]));
    assert.equal(firstTurnInput(empty), null);
    assert.equal(firstTurnInput(path.join(dir, 'missing.jsonl')), null);
  });
});

describe('rolesForRun', () => {
  test('7. one row per spawn with role, model, first-turn input, totals, cache writes, priced cost and wall seconds', () => {
    const { rolesForRun } = load();
    const runDir = standardRun();
    const res = rolesForRun(runDir, { rates: tx.RATES });
    assert.equal(res.readable, true);
    assert.equal(res.reason, null);
    assert.equal(res.rows.length, 5);
    assert.deepEqual(res.rows.map(pick), tx.EXPECTED_STANDARD);
    for (const row of res.rows) {
      assert.equal(row.readable, true);
      assert.equal(row.unpriced_messages, 0);
      assert.equal(row.partial, false);
    }
    assert.equal(res.cost_usd, tx.EXPECTED_STANDARD_COST);
    assert.equal(res.partial, false);
    assert.deepEqual(res.spawns, { orchestrator: 1, planner: 1, executor: 2, verifier: 1 });
  });

  test('7. the rows price to the same total as transcriptCost (the figure the ledger charges)', () => {
    const { rolesForRun } = load();
    const runDir = standardRun();
    const res = rolesForRun(runDir, { rates: tx.RATES });
    const tc = transcriptCost(path.join(runDir, 'transcripts'), { rates: tx.RATES });
    assert.equal(res.cost_usd, tc.cost_usd);
    const subagents = res.rows.filter((r) => r.role !== 'orchestrator').reduce((s, r) => s + r.cost_usd, 0);
    assert.ok(Math.abs(subagents - tc.subagent_usd) < 1e-9);
  });

  test('7. a 1h cache write is priced at the 1h rate (the orchestrator m3 message)', () => {
    const { rolesForRun } = load();
    const res = rolesForRun(standardRun(), { rates: tx.RATES });
    const orch = res.rows[0];
    // At the 5m rate m3 would cost 5 + 3125 + 18500 + 5000 = 26630, not 28505.
    assert.equal(orch.cost_usd, 0.20328);
    assert.notEqual(orch.cost_usd, (143015 + 31760 + 26630) / 1e6);
  });

  test('7. a flat transcripts layout gives the same rows', () => {
    const { rolesForRun } = load();
    const res = rolesForRun(standardRun(''), { rates: tx.RATES });
    assert.deepEqual(res.rows.map(pick), tx.EXPECTED_STANDARD);
  });

  test('7. rows of subagents follow their start time, the main session first', () => {
    const { rolesForRun } = load();
    const runDir = tmp();
    // Written in reverse order; the verifier started last.
    tx.writeSpawns(path.join(runDir, 'transcripts'), tx.STANDARD_RUN.slice().reverse());
    const res = rolesForRun(runDir, { rates: tx.RATES });
    assert.deepEqual(res.rows.map((r) => r.agent_id), [null, 'p1', 'e1', 'e2', 'v1']);
  });

  test('7. without rates the module prices from model-rates.json (loadRates)', () => {
    const { rolesForRun } = load();
    const res = rolesForRun(standardRun());
    assert.equal(typeof res.cost_usd, 'number');
    assert.ok(res.cost_usd > 0);
    assert.equal(res.partial, false);
  });

  test('8. job-checker maps to its role, an unknown type keeps its name, a missing or broken meta is unknown', () => {
    const { rolesForRun, roleOf } = load();
    assert.equal(roleOf({ agentType: 'aoforge:job-checker' }), 'job-checker');
    assert.equal(roleOf({ agentType: 'general-purpose' }), 'general-purpose');
    assert.equal(roleOf({ agentType: 'other-plugin:helper' }), 'other-plugin:helper');
    assert.equal(roleOf(null), 'unknown');
    assert.equal(roleOf({ description: 'no type' }), 'unknown');
    const spawn = (agent, meta, start) => ({
      agent, meta, model: tx.SONNET, start, end: start.replace(':00.000Z', ':30.000Z'),
      messages: [{ id: `${agent}-m`, at: start, input: 1, cc: 0, cr: 0, out: 1 }],
    });
    const runDir = tmp();
    tx.writeSpawns(path.join(runDir, 'transcripts'), [
      spawn('k1', { agentType: 'aoforge:job-checker' }, '2026-10-17T09:01:00.000Z'),
      spawn('g1', { agentType: 'general-purpose' }, '2026-10-17T09:02:00.000Z'),
      spawn('x1', { agentType: 'other-plugin:helper' }, '2026-10-17T09:03:00.000Z'),
      spawn('n1', null, '2026-10-17T09:04:00.000Z'),
      spawn('c1', 'corrupt', '2026-10-17T09:05:00.000Z'),
    ]);
    const res = rolesForRun(runDir, { rates: tx.RATES });
    assert.deepEqual(res.rows.map((r) => [r.agent_id, r.role, r.agent_type]), [
      ['k1', 'job-checker', 'aoforge:job-checker'],
      ['g1', 'general-purpose', 'general-purpose'],
      ['x1', 'other-plugin:helper', 'other-plugin:helper'],
      ['n1', 'unknown', null],
      ['c1', 'unknown', null],
    ]);
    assert.deepEqual(res.spawns, { 'job-checker': 1, 'general-purpose': 1, 'other-plugin:helper': 1, unknown: 2 });
  });

  test('missing transcripts: not readable, no rows, with the reason', () => {
    const { rolesForRun } = load();
    const runDir = tmp();
    const res = rolesForRun(runDir, { rates: tx.RATES });
    assert.equal(res.readable, false);
    assert.deepEqual(res.rows, []);
    assert.match(res.reason, /no transcripts/);
    assert.equal(res.cost_usd, null);
    fs.mkdirSync(path.join(runDir, 'transcripts'));
    const empty = rolesForRun(runDir, { rates: tx.RATES });
    assert.equal(empty.readable, false);
    assert.match(empty.reason, /no transcript files/);
  });

  test('an unparseable transcript gives an unreadable row and marks the run partly unreadable', () => {
    const { rolesForRun } = load();
    const runDir = tmp();
    const spawns = tx.STANDARD_RUN.slice(0, 2).concat([{ ...tx.STANDARD_RUN[2], body: 'corrupt' }]);
    tx.writeSpawns(path.join(runDir, 'transcripts'), spawns);
    const res = rolesForRun(runDir, { rates: tx.RATES });
    assert.equal(res.readable, true);
    const bad = res.rows.find((r) => r.agent_id === 'e1');
    assert.equal(bad.readable, false);
    assert.equal(bad.role, 'executor');
    assert.equal(bad.first_turn_input, null);
    assert.equal(bad.cost_usd, null);
    assert.deepEqual(res.unreadable, [bad.file]);
    assert.equal(res.cost_usd, 0.505825, 'the readable rows still count (orchestrator + planner)');
  });

  test('an unpriced model is counted, never priced at $0 silently', () => {
    const { rolesForRun } = load();
    const runDir = tmp();
    tx.writeSpawns(path.join(runDir, 'transcripts'), [{
      agent: null, model: tx.SONNET, start: '2026-10-17T09:00:00.000Z', end: '2026-10-17T09:01:00.000Z',
      messages: [
        { id: 'a', at: '2026-10-17T09:00:10.000Z', input: 1000, cc: 0, cr: 0, out: 100 },
        { id: 'b', model: 'claude-mystery-1', at: '2026-10-17T09:00:20.000Z', input: 1000, cc: 0, cr: 0, out: 1000 },
      ],
    }]);
    const res = rolesForRun(runDir, { rates: tx.RATES });
    const row = res.rows[0];
    assert.equal(row.unpriced_messages, 1);
    assert.equal(row.partial, true);
    assert.equal(row.cost_usd, 0.003, 'the priced message only: 1000 x 2 + 100 x 10');
    assert.equal(res.partial, true);
    assert.deepEqual(row.models, ['claude-mystery-1', tx.SONNET]);
    assert.equal(row.model, 'claude-mystery-1', 'the model with the most output');
  });
});
