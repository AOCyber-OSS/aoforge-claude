'use strict';

// Tests for scripts/eval81/score/D.cjs (TRD 81-10, test list 5-9): the batch D scorer. Per model, each state's samples
// (one per repeat) go through the engine's aggregateVotes and scoreState, and the majority is compared with the answer
// key. Every judge output below is hand-written (`__fixtures__/judge-outputs.cjs`); the answer key and the shown states
// are the frozen 81-05 fixtures, read from disk. No test calls the API. Temp dirs come from os.tmpdir(), so run with
// TMPDIR under the session scratchpad.

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const jo = require('../__fixtures__/judge-outputs.cjs');
const fx = require('../__fixtures__/metrics.cjs');
const batchD = require('../batches/D.cjs');
const { decide } = require('../lib/decide.cjs');
const { newLedger, saveLedger } = require('../lib/ledger.cjs');
const { main } = require('../score.cjs');

const FIX = path.resolve(__dirname, '..', 'fixtures', 'D');
const LABELS = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(FIX, 'labels.json'), 'utf8')).states.map((s) => [s.id, s]));

// Loaded per test, so a missing module fails each test with its own name.
const load = () => require('./D.cjs');

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-sd-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// The states the tests lean on, as 81-05 froze them (guarded below so a change to the key fails loudly here).
//   d03 broken overflow medium    d04 broken misalignment high   d07 broken blank_empty high
//   d10 ok                        d20 ok (390 px)                d02 ok            d05 broken overlap_zindex high
test('the answer key still says what these tests assume', () => {
  const want = {
    d02: ['ok', null, null], d03: ['broken', 'overflow', 'medium'], d04: ['broken', 'misalignment', 'high'],
    d05: ['broken', 'overlap_zindex', 'high'], d07: ['broken', 'blank_empty', 'high'], d10: ['ok', null, null], d20: ['ok', null, null],
  };
  for (const [id, [label, type, severity]] of Object.entries(want)) {
    assert.deepEqual([LABELS[id].label, LABELS[id].defect_type, LABELS[id].severity], [label, type, severity], id);
  }
});

const BROKEN = (id, sev = 'high') => jo.brokenResult(id, [jo.defect('overflow', sev)]);
const OK = (id) => jo.okResult(id);

describe('judgeState: one state, its samples against its label (test list 5-8)', () => {
  const K = { broken: { label: 'broken', defect_type: 'overflow', severity: 'high' }, ok: { label: 'ok', defect_type: null, severity: null } };

  test('5. broken/broken/ok on a broken-labelled state: majority broken, correct, split', () => {
    const d = load().judgeState({ id: 'd04', key: K.broken, samples: [BROKEN('d04'), BROKEN('d04'), OK('d04')] });
    assert.equal(d.majority, 'broken');
    assert.equal(d.correct, true);
    assert.equal(d.split, true);
    assert.equal(d.tie, false);
    assert.deepEqual(d.votes, { broken: 2, ok: 1 });
    assert.equal(d.verdict, 'fail');
    assert.equal(d.escalation, false, 'a broken-labelled state is never an engine escalation');
    assert.equal(d.broken_missed, false);
    assert.equal(d.n_samples, 3);
    assert.equal(d.flagged, null);
  });

  test('6. ok/ok/ok on an ok state: correct, no split; ok/broken/ok: correct, split, an engine-rule escalation', () => {
    const calm = load().judgeState({ id: 'd10', key: K.ok, samples: [OK('d10'), OK('d10'), OK('d10')] });
    assert.equal(calm.majority, 'ok');
    assert.equal(calm.correct, true);
    assert.equal(calm.split, false);
    assert.equal(calm.escalation, false);
    assert.equal(calm.verdict, 'pass');

    const wobble = load().judgeState({ id: 'd10', key: K.ok, samples: [OK('d10'), BROKEN('d10'), OK('d10')] });
    assert.equal(wobble.majority, 'ok');
    assert.equal(wobble.correct, true);
    assert.equal(wobble.split, true);
    assert.equal(wobble.escalation, true);
    assert.equal(wobble.verdict, 'review');
  });

  test('7. a broken majority on an ok state is wrong (a false fail); an ok majority on a broken state is broken_missed', () => {
    const wrongOk = load().judgeState({ id: 'd10', key: K.ok, samples: [BROKEN('d10'), BROKEN('d10'), OK('d10')] });
    assert.equal(wrongOk.majority, 'broken');
    assert.equal(wrongOk.correct, false);
    assert.equal(wrongOk.false_fail, true);
    assert.equal(wrongOk.broken_missed, false);
    assert.equal(wrongOk.split, true);
    assert.equal(wrongOk.escalation, true, 'split votes on an ok-labelled state count (the pre-registered rule)');
    assert.notEqual(wrongOk.verdict, 'review', 'but the engine would fail it, not review it');

    const missed = load().judgeState({ id: 'd04', key: K.broken, samples: [OK('d04'), OK('d04'), BROKEN('d04')] });
    assert.equal(missed.majority, 'ok');
    assert.equal(missed.correct, false);
    assert.equal(missed.broken_missed, true);
    assert.equal(missed.false_fail, false);
  });

  test('7b. a medium-only broken majority is still broken (the engine passes it with an advisory, the score is the vote)', () => {
    const d = load().judgeState({ id: 'd03', key: K.broken, samples: [BROKEN('d03', 'medium'), BROKEN('d03', 'medium'), BROKEN('d03', 'medium')] });
    assert.equal(d.majority, 'broken');
    assert.equal(d.correct, true);
    assert.equal(d.verdict, 'pass');
    assert.equal(d.known_broken, true);
  });

  test('8. one missing sample: aggregated on two and flagged; none: unjudged', () => {
    const two = load().judgeState({ id: 'd04', key: K.broken, samples: [BROKEN('d04'), BROKEN('d04')] });
    assert.equal(two.n_samples, 2);
    assert.equal(two.flagged, 'samples < 3');
    assert.equal(two.majority, 'broken');
    assert.equal(two.correct, true);
    assert.equal(two.unjudged, false);

    const tie = load().judgeState({ id: 'd04', key: K.broken, samples: [BROKEN('d04'), OK('d04')] });
    assert.equal(tie.tie, true);
    assert.equal(tie.majority, 'ok', 'a tie has no confident majority: the engine leaves is_broken false');
    assert.equal(tie.correct, false);
    assert.equal(tie.flagged, 'samples < 3');

    const none = load().judgeState({ id: 'd04', key: K.broken, samples: [] });
    assert.equal(none.unjudged, true);
    assert.equal(none.n_samples, 0);
    assert.equal(none.correct, null);
    assert.equal(none.majority, null);
  });
});

/** The six runs of test 9: the troubleshooting surface (d03 d04 d07 d10 d20), both models, three repeats. */
const TS = ['d03', 'd04', 'd07', 'd10', 'd20'];
const answers = (mapping) => TS.map((id) => (mapping[id] === 'B' ? BROKEN(id, LABELS[id].severity || 'high') : OK(id)));

// Haiku: d03 B,B,ok (majority broken, split)  d04 B,B,B  d07 ok,ok,B (missed, split)  d10 ok x3  d20 ok,B,ok (split)
const HAIKU = [{ d03: 'B', d04: 'B', d07: 'o', d10: 'o', d20: 'o' }, { d03: 'B', d04: 'B', d07: 'o', d10: 'o', d20: 'B' }, { d03: 'o', d04: 'B', d07: 'B', d10: 'o', d20: 'o' }];
// Sonnet: every state right in every repeat.
const SONNET = Array(3).fill({ d03: 'B', d04: 'B', d07: 'B', d10: 'o', d20: 'o' });

function plan(overrides = {}) {
  const out = [];
  [1, 2, 3].forEach((n, i) => {
    out.push({ id: `D-troubleshooting-haiku-r${n}`, model: 'haiku', results: answers(HAIKU[i]), cost_usd: 0.1, ...(overrides[`haiku${n}`] || {}) });
    out.push({ id: `D-troubleshooting-sonnet-r${n}`, model: 'sonnet', results: answers(SONNET[i]), cost_usd: 0.3, ...(overrides[`sonnet${n}`] || {}) });
  });
  return out;
}

const sc = (root) => load().score({ root, outDir: path.join(root, 'out') });
const ts = (r, model) => r.roles['ui-evaluator'].models[model];

describe('score(): the 81-02 batch result for ui-evaluator (test list 9)', () => {
  test('9. six runs: accuracy, broken_missed, split_rate, engine escalations, per-sample accuracy and the breakdowns', () => {
    jo.dRoot(tmp, plan());
    const r = sc(tmp);
    assert.equal(r.batch, 'D');
    assert.deepEqual(Object.keys(r.roles), ['ui-evaluator']);
    assert.equal(r.roles['ui-evaluator'].primary, 'accuracy');
    assert.deepEqual(r.planned, { haiku: 60, sonnet: 60 });

    const h = ts(r, 'haiku');
    assert.equal(h.n_scored, 15);
    assert.equal(h.planned, 60);
    assert.deepEqual(h.metrics.accuracy, { k: 4, n: 5 });
    assert.deepEqual(h.metrics.broken_missed, { k: 1, n: 3 });
    assert.deepEqual(h.metrics.false_fail, { k: 0, n: 2 });
    assert.deepEqual(h.metrics.split_rate, { k: 3, n: 5 });
    assert.deepEqual(h.metrics.engine_escalations, { k: 1, n: 2 });
    assert.deepEqual(h.metrics.engine_reviews, { k: 1, n: 2 });
    assert.deepEqual(h.metrics.sample_accuracy, { k: 11, n: 15 });
    assert.deepEqual(h.metrics.accuracy_by_defect_type, {
      blank_empty: { k: 0, n: 1 }, broken_layout: { k: 0, n: 0 }, contrast_legibility: { k: 0, n: 0 },
      misalignment: { k: 1, n: 1 }, overflow: { k: 1, n: 1 }, overlap_zindex: { k: 0, n: 0 }, none: { k: 2, n: 2 },
    });
    assert.deepEqual(h.metrics.accuracy_by_severity, {
      high: { k: 1, n: 2 }, medium: { k: 1, n: 1 }, none: { k: 2, n: 2 },
    });
    assert.ok(Math.abs(h.cost_usd - 0.3) < 1e-9);
    assert.equal(h.mean_wall_ms, 30000);

    const s = ts(r, 'sonnet');
    assert.equal(s.n_scored, 15);
    assert.deepEqual(s.metrics.accuracy, { k: 5, n: 5 });
    assert.deepEqual(s.metrics.broken_missed, { k: 0, n: 3 });
    assert.deepEqual(s.metrics.split_rate, { k: 0, n: 5 });
    assert.deepEqual(s.metrics.sample_accuracy, { k: 15, n: 15 });
    assert.ok(Math.abs(s.cost_usd - 0.9) < 1e-9);
  });

  test('9b. the runs and the per-state detail ride along; the other 15 states are unjudged, not in n', () => {
    jo.dRoot(tmp, plan());
    const r = sc(tmp);
    assert.equal(r.runs.length, 6);
    for (const run of r.runs) {
      assert.equal(run.role, 'ui-evaluator');
      assert.equal(run.fixture, 'troubleshooting');
      assert.equal(run.outcome, 'scored');
      assert.equal(run.contaminated, false);
      assert.equal(run.samples, 5);
    }
    assert.deepEqual(r.excluded, []);
    const detail = r.states.haiku;
    assert.equal(detail.length, 20);
    assert.equal(detail.filter((d) => d.unjudged).length, 15);
    const d07 = detail.find((d) => d.id === 'd07');
    assert.deepEqual([d07.label, d07.majority, d07.correct, d07.broken_missed, d07.split, d07.n_samples], ['broken', 'ok', false, true, true, 3]);
    assert.ok(r.notes.some((n) => /15 of 20 states have no sample/.test(n)), r.notes.join('\n'));
  });

  test('9c. a garbage run is excluded as unparsed and its states carry two samples, flagged', () => {
    jo.dRoot(tmp, plan({ sonnet3: { as: 'garbage', results: [] } }));
    const r = sc(tmp);
    assert.deepEqual(r.excluded, [{ id: 'D-troubleshooting-sonnet-r3', reason: 'unparsed', model: 'sonnet', role: 'ui-evaluator' }]);
    const s = ts(r, 'sonnet');
    assert.equal(s.n_scored, 10);
    assert.deepEqual(s.metrics.accuracy, { k: 5, n: 5 });
    assert.ok(r.states.sonnet.filter((d) => !d.unjudged).every((d) => d.n_samples === 2 && d.flagged === 'samples < 3'));
    assert.ok(Math.abs(s.cost_usd - 0.9) < 1e-9, 'the unparsed run still cost money');
    assert.ok(r.notes.some((n) => /D-troubleshooting-sonnet-r3.*unparsed/.test(n)));
  });

  test('9d. cap_hit, model_ran false and contaminated runs are excluded with their reason and are not in n', () => {
    jo.dRoot(tmp, plan({ haiku1: { status: 'cap_hit' }, haiku2: { model_ran: false }, sonnet1: { contaminated: true } }));
    const r = sc(tmp);
    const byId = Object.fromEntries(r.excluded.map((e) => [e.id, e]));
    assert.equal(byId['D-troubleshooting-haiku-r1'].reason, 'status:cap_hit');
    assert.equal(byId['D-troubleshooting-haiku-r2'].reason, 'model_ran:false');
    assert.equal(byId['D-troubleshooting-sonnet-r1'].reason, 'contaminated');
    assert.equal(r.excluded.length, 3);
    assert.equal(ts(r, 'haiku').n_scored, 5);
    assert.equal(ts(r, 'sonnet').n_scored, 10);
    const dirty = r.runs.find((x) => x.id === 'D-troubleshooting-sonnet-r1');
    assert.equal(dirty.contaminated, true);
    assert.equal(dirty.outcome, 'excluded');
  });

  test('9e. results come from outputs/outputs.json or from the record itself when record.outputs is absent', () => {
    jo.dRoot(tmp, plan({
      haiku1: { outputs: 'file' },
      haiku2: { outputs: 'none', as: 'fenced' },
      sonnet1: { outputs: 'none' },
    }));
    const r = sc(tmp);
    assert.equal(ts(r, 'haiku').n_scored, 15);
    assert.equal(ts(r, 'sonnet').n_scored, 15);
    assert.deepEqual(ts(r, 'haiku').metrics.accuracy, { k: 4, n: 5 });
  });

  test('9f. a run that lists only some states, repeats one, or names a stranger gets missing samples, not invented ones', () => {
    const partial = [OK('d10'), OK('d10'), BROKEN('d03'), jo.okResult('d99')];
    jo.dRoot(tmp, plan({ haiku1: { results: partial } }));
    const r = sc(tmp);
    const h = ts(r, 'haiku');
    assert.equal(h.n_scored, 12, 'haiku r1 contributes d10 and d03 only (10 from r2 and r3)');
    const detail = Object.fromEntries(r.states.haiku.map((d) => [d.id, d]));
    assert.equal(detail.d10.n_samples, 3);
    assert.equal(detail.d04.n_samples, 2);
    assert.equal(detail.d04.flagged, 'samples < 3');
    assert.ok(r.notes.some((n) => /D-troubleshooting-haiku-r1: 2 stray/.test(n)), r.notes.join('\n'));
    assert.ok(r.notes.some((n) => /D-troubleshooting-haiku-r1: no result for d04, d07, d20/.test(n)), r.notes.join('\n'));
  });

  test('9g. a planned run with no record is simply not run: it adds to planned, not to n', () => {
    jo.dRoot(tmp, plan().slice(0, 4));
    const r = sc(tmp);
    assert.equal(ts(r, 'haiku').n_scored, 10);
    assert.equal(ts(r, 'haiku').planned, 60);
    assert.ok(r.notes.some((n) => /20 of 24 planned runs have no record/.test(n)), r.notes.join('\n'));
  });

  test('9h. an unreadable record is excluded, never thrown on', () => {
    jo.dRoot(tmp, plan());
    fs.writeFileSync(path.join(tmp, 'runs', 'D', 'D-troubleshooting-haiku-r3', 'record.json'), '{not json');
    const r = sc(tmp);
    assert.equal(r.excluded.find((e) => e.id === 'D-troubleshooting-haiku-r3').reason, 'record:unreadable');
  });
});

describe('score.cjs and decide() accept the result', () => {
  test('10. the CLI writes results/D.json with a spend block and results/D.md renders every metric', async () => {
    jo.dRoot(tmp, plan());
    const ledger = newLedger();
    ledger.batches.D.status = 'complete';
    ledger.batches.D.spent_usd = 1.2;
    ledger.entries.push({ id: 'D-troubleshooting-haiku-r1', batch: 'D', role: 'ui-evaluator', status: 'ok', cap_usd: 0.25, reserve_usd: 0.31,
      reported_usd: 0.1, transcript_usd: 0.1, charged_usd: 0.1, cost_source: 'reported', overshoot_usd: 0, at: '2026-10-17T00:00:00.000Z' });
    saveLedger(path.join(tmp, 'ledger.json'), ledger);
    const out = path.join(tmp, 'objective');
    const err = [];
    const code = await main(['--batch', 'D', '--root', tmp, '--out', out], { stdout: () => {}, stderr: (s) => err.push(s), now: () => new Date('2026-10-17T18:00:00Z') });
    assert.equal(code, 0, err.join(''));
    const saved = JSON.parse(fs.readFileSync(path.join(out, 'results', 'D.json'), 'utf8'));
    assert.equal(saved.batch, 'D');
    assert.equal(saved.spend.batch, 'D');
    assert.equal(saved.roles['ui-evaluator'].models.haiku.metrics.accuracy.n, 5);
    const md = fs.readFileSync(path.join(out, 'results', 'D.md'), 'utf8');
    for (const name of ['accuracy', 'broken_missed', 'split_rate', 'engine_escalations', 'sample_accuracy', 'accuracy_by_defect_type.overflow', 'accuracy_by_severity.high']) {
      assert.ok(md.includes(name), `D.md lacks ${name}`);
    }
  });

  // A full root: every planned session answers from a hand-written table (id -> broken?) per model; the engine's
  // verdicts per state are unanimous but for two hand-placed wobbles. Haiku misses d03; Sonnet is right everywhere.
  const HAIKU_BROKEN = new Set(['d01', 'd04', 'd05', 'd06', 'd07', 'd08', 'd11', 'd12', 'd13', 'd14', 'd15', 'd17']); // d03 missed
  const SONNET_BROKEN = new Set([...HAIKU_BROKEN, 'd03']);
  const BROKEN_SET = { haiku: HAIKU_BROKEN, sonnet: SONNET_BROKEN };

  function fullPlan() {
    const out = [];
    for (const desc of batchD.runs({ root: tmp, trees: null, calibration: null })) {
      const results = desc.fixture.state_ids.map((id) => {
        const wobble = desc.model === 'haiku' && desc.fixture.repeat === 2 && id === 'd02';
        return BROKEN_SET[desc.model].has(id) !== wobble ? BROKEN(id) : OK(id);
      });
      out.push({ id: desc.id, model: desc.model, results });
    }
    return out;
  }

  test('11. a full 24-run root scores 60 samples per model and decide() reads the result as a weak endorsement', () => {
    jo.dRoot(tmp, fullPlan());
    const r = sc(tmp);
    for (const m of ['haiku', 'sonnet']) {
      assert.equal(ts(r, m).n_scored, 60);
      assert.equal(ts(r, m).planned, 60);
    }
    assert.deepEqual(ts(r, 'sonnet').metrics.accuracy, { k: 20, n: 20 });
    assert.deepEqual(ts(r, 'haiku').metrics.accuracy, { k: 19, n: 20 });
    assert.deepEqual(ts(r, 'haiku').metrics.broken_missed, { k: 1, n: 13 });
    assert.deepEqual(ts(r, 'haiku').metrics.split_rate, { k: 1, n: 20 });
    assert.deepEqual(ts(r, 'haiku').metrics.engine_escalations, { k: 1, n: 7 });
    assert.equal(r.excluded.length, 0);
    const d = decide({ results: { A: fx.aPass(), D: r }, profiles: fx.profilesFixture(), packModels: fx.packModelsFixture() });
    assert.equal(d.roles['ui-evaluator'].outcome, 'WEAK_ENDORSE', JSON.stringify(d.roles['ui-evaluator'].reasons));
  });
});
