'use strict';
// TRD 82-05 test list 9-11 and 14 (D part): the objective-82 D scorer on hand-built records and a hand-built key
// (__fixtures__/records.cjs D_KEY and D_VOTES, with the hand-computed figures beside them).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { score } = require('./D.cjs');
const { main } = require('../score.cjs');
const ledgerLib = require('../../eval81/lib/ledger.cjs');
const { wilson } = require('../../eval81/lib/stats.cjs');
const { initialLedger } = require('../ledger82.cjs');
const { RATES } = require('../../eval81/__fixtures__/transcripts.cjs');
const { writeDVotes, D_KEY, D_VOTES } = require('../__fixtures__/records.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'e82-scoreD-'));
const NOW = () => new Date('2026-10-18T12:00:00.000Z');
const OPTS = { labels: D_KEY, rates: RATES, opusModel: 'claude-opus-5-5' };

function setup() {
  const root = tmp();
  writeDVotes(root, D_VOTES);
  // A moved-aside attempt is never read.
  fs.mkdirSync(path.join(root, 'runs', 'D', 'D-s2-h-1.prev-1'));
  fs.writeFileSync(path.join(root, 'runs', 'D', 'D-s2-h-1.prev-1', 'record.json'), JSON.stringify({ id: 'D-s2-h-1', batch: 'D', status: 'ok', structured_output: { results: [{ state_id: 's2', is_broken: true }] } }));
  return root;
}

test('9: per arm, each state\'s majority, scoreState outcome and split', () => {
  const r = score({ root: setup(), ...OPTS });
  assert.equal(r.batch, 'D');
  const st = Object.fromEntries(r.states.map((s) => [s.id, s]));
  assert.deepEqual(
    ['s1', 's2', 's3', 's4', 's5', 's6'].map((id) => [id, st[id].haiku.majority, st[id].haiku.outcome, st[id].haiku.split]),
    [['s1', 'broken', 'fail', false], ['s2', 'ok', 'pass', false], ['s3', 'ok', 'review', true],
      ['s4', 'ok', 'review', true], ['s5', 'ok', 'pass', false], ['s6', 'broken', 'fail', true]],
  );
  assert.deepEqual([st.s3.haiku.escalated, st.s4.haiku.escalated, st.s6.haiku.escalated], [true, true, false]);
  assert.deepEqual([st.s3.haiku_start.final, st.s4.haiku_start.final, st.s5.haiku_start.final], ['ok', 'broken', 'ok']);
  assert.equal(st.s4.haiku_start.source, 'escalation');
  assert.equal(st.s5.haiku_start.source, 'haiku');
  assert.deepEqual([st.s5.sonnet.majority, st.s5.sonnet.outcome, st.s6.sonnet.outcome, st.s6.sonnet.escalated], ['broken', 'fail', 'review', true]);
});

test('9: accuracy, broken_missed, false_fail, split, escalation and agreement, each with n and a Wilson interval', () => {
  const r = score({ root: setup(), ...OPTS });
  const w = (k, n) => wilson(k, n);
  const hs = r.arms.haiku_start;
  assert.deepEqual(hs.accuracy, w(4, 6));
  assert.deepEqual(hs.broken_missed, w(1, 3));
  assert.deepEqual(hs.false_fail, w(1, 3));
  const h = r.arms.haiku;
  assert.deepEqual(h.accuracy, w(3, 6));
  assert.deepEqual(h.broken_missed, w(2, 3));
  assert.deepEqual(h.false_fail, w(1, 3));
  assert.deepEqual(h.split_rate, w(3, 6));
  assert.deepEqual(h.escalation_rate, w(2, 6));
  assert.deepEqual(h.escalation_rate_ok, w(1, 3));
  const s = r.arms.sonnet;
  assert.deepEqual(s.accuracy, w(7, 7));
  assert.deepEqual(s.broken_missed, w(0, 3));
  assert.deepEqual(s.false_fail, w(0, 4));
  assert.deepEqual(s.split_rate, w(2, 7));
  assert.deepEqual(s.escalation_rate, w(1, 7));
  assert.deepEqual(s.escalation_rate_ok, w(1, 4));
  assert.deepEqual(r.escalated_agreement, { ...w(2, 2), states: ['s3', 's4'] });
  assert.deepEqual(r.arms.haiku.escalated, ['s3', 's4']);
  assert.deepEqual(r.arms.sonnet.escalated, ['s6']);
});

test('10: the cost of a Haiku start against a Sonnet start with its estimated opus escalations', () => {
  const r = score({ root: setup(), ...OPTS });
  assert.deepEqual(r.cost.haiku_start, { samples_usd: 0.2, escalation_usd: 0.18, total_usd: 0.38, records: 26 });
  assert.deepEqual(r.cost.sonnet_start, {
    samples_usd: 0.84,
    escalation_estimate_usd: 0.05415,
    escalation_basis: 'estimate: the sonnet sessions of s6 (3) priced at claude-opus-5-5 rates',
    total_usd: 0.89415,
    records: 21,
  });
});

test('11: a state with fewer than 3 samples in an arm is incomplete, left out of that arm\'s rates, and counted', () => {
  const r = score({ root: setup(), ...OPTS });
  assert.deepEqual(r.arms.haiku.incomplete, ['s7']);
  assert.deepEqual(r.arms.haiku_start.incomplete, ['s7']);
  assert.deepEqual(r.arms.sonnet.incomplete, []);
  assert.equal(r.arms.haiku.accuracy.n, 6);
  const s7 = r.states.find((x) => x.id === 's7');
  assert.equal(s7.haiku.n_samples, 1);
  assert.equal(s7.haiku.complete, false);
  const md = r.md || require('./D.cjs').renderResults({ ...r, scored_at: 'x' });
  assert.match(md, /Incomplete: haiku 1 state \(s7\), sonnet 0/);
});

test('11: an escalated state whose escalation triple is incomplete is incomplete for the Haiku start', () => {
  const root = tmp();
  writeDVotes(root, { ...D_VOTES, s4: { h: 'oob', s: 'bbb', esc: 'bb-' } });
  const r = score({ root, ...OPTS });
  assert.deepEqual(r.arms.haiku_start.incomplete, ['s4', 's7']);
  assert.equal(r.arms.haiku_start.accuracy.n, 5);
  assert.equal(r.states.find((x) => x.id === 's4').haiku_start.final, null);
});

test('14: score.cjs --batch D writes results/D.json and results/D.md, deterministically', async () => {
  const root = setup();
  ledgerLib.saveLedger(path.join(root, 'ledger.json'), initialLedger());
  const outs = [tmp(), tmp()];
  for (const out of outs) {
    const lines = [];
    const code = await main(['--batch', 'D', '--root', root, '--out', out], { now: NOW, stdout: (x) => lines.push(x), stderr: (x) => lines.push(x), scorerOpts: OPTS });
    assert.equal(code, 0, lines.join(''));
  }
  for (const rel of ['results/D.json', 'results/D.md']) {
    assert.equal(fs.readFileSync(path.join(outs[0], rel), 'utf-8'), fs.readFileSync(path.join(outs[1], rel), 'utf-8'), rel);
  }
  const saved = JSON.parse(fs.readFileSync(path.join(outs[0], 'results', 'D.json'), 'utf-8'));
  assert.equal(saved.spend.batch, 'D');
  assert.equal(saved.scored_at, '2026-10-18T12:00:00.000Z');
  const md = fs.readFileSync(path.join(outs[0], 'results', 'D.md'), 'utf-8');
  assert.match(md, /# Batch D \(objective 82\) results/);
  assert.match(md, /\| accuracy \| 4\/6 /);
  assert.match(md, /estimate/);
});
