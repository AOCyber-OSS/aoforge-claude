'use strict';

// Batch B scorer tests (TRD 81-09, test list 10-13). Every checker return is a hand-written literal from
// __fixtures__/agent-outputs.cjs; every number below is chosen so the expected k/n check by hand.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const S = require('./B.cjs');
const o = require('../__fixtures__/agent-outputs.cjs');
const sj = require('../__fixtures__/stream-json.cjs');
const { newLedger, saveLedger } = require('../lib/ledger.cjs');
const scoreCli = require('../score.cjs');
const KEY = require('../fixtures/B/answer-key.json');

const set = (id) => KEY.sets.find((s) => s.id === id);
const outcome = (id, text) => S.outcomeFor(set(id), text).outcome;

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-score-b-'));
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('parsing the checker return', () => {
  test('verdict heading, blockers and warnings; the YAML list duplicates are merged by description', () => {
    const p = S.parseChecker(o.cOverlapBlocker());
    assert.equal(p.verdict, 'issues');
    assert.equal(p.yaml, 'ok');
    assert.equal(p.issues.length, 1);
    assert.deepEqual([p.issues[0].severity, p.issues[0].dimension, p.issues[0].from],
      ['blocker', 'dependency_correctness', 'both']);
    assert.equal(S.parseChecker(o.cPassed()).verdict, 'passed');
    assert.equal(S.parseChecker(o.cNoHeading()).verdict, 'none');
    assert.deepEqual(S.parseChecker(o.cOverlapWarningOnly()).issues.map((i) => i.severity), ['warning']);
  });

  test('issues found only in the YAML list count; a malformed YAML block falls back to the Markdown sections', () => {
    const yamlOnly = S.parseChecker(o.cOverlapYamlOnly());
    assert.deepEqual(yamlOnly.issues.map((i) => [i.severity, i.from]), [['blocker', 'yaml']]);
    const bad = S.parseChecker(o.cOverlapMalformedYaml());
    assert.equal(bad.yaml, 'error');
    assert.deepEqual(bad.issues.map((i) => [i.severity, i.from]), [['blocker', 'markdown']]);
    assert.equal(outcome('B3', o.cOverlapYamlOnly()), 'detected');
    assert.equal(outcome('B3', o.cOverlapMalformedYaml()), 'detected');
  });
});

describe('planted B3 (test list 10)', () => {
  test('a blocker naming src/cli.js and "same wave" -> detected', () => {
    const r = S.outcomeFor(set('B3'), o.cOverlapBlocker());
    assert.deepEqual([r.verdict, r.outcome, r.unrelated_blockers], ['issues', 'detected', 0]);
  });

  test('only a matching warning -> detected', () => {
    assert.equal(outcome('B3', o.cOverlapWarningOnly()), 'detected');
  });

  test('only an unrelated blocker -> missed, unrelated_blockers 1', () => {
    const r = S.outcomeFor(set('B3'), o.cUnrelatedBlocker());
    assert.deepEqual([r.outcome, r.unrelated_blockers], ['missed', 1]);
  });

  test('VERIFICATION PASSED -> missed_as_pass; no heading -> abstain', () => {
    assert.equal(outcome('B3', o.cPassed()), 'missed_as_pass');
    assert.equal(outcome('B3', o.cNoHeading()), 'abstain');
    assert.equal(outcome('B3', null), 'abstain');
  });
});

describe('clean sets (test list 11)', () => {
  test('one blocker -> false_alarm; warnings only -> correct_pass; passed -> correct_pass', () => {
    assert.equal(outcome('B1', o.cUnrelatedBlocker()), 'false_alarm');
    assert.equal(outcome('B2', o.cWarningsOnly()), 'correct_pass');
    assert.equal(outcome('B1', o.cPassed()), 'correct_pass');
    assert.equal(outcome('B1', o.cNoHeading()), 'abstain');
  });
});

describe('B6, an empty must_mention (test list 12)', () => {
  test('matches on any one any_of phrase', () => {
    assert.deepEqual(set('B6').planted.must_mention, []);
    assert.equal(outcome('B6', o.cScMissing()), 'detected');
    assert.equal(outcome('B6', o.cUnrelatedBlocker()), 'missed');
  });

  test('B4 and B5 match their own tokens and not each other', () => {
    assert.equal(outcome('B4', o.cMissingVerify()), 'detected');
    assert.equal(outcome('B5', o.cLaterWave()), 'detected');
    assert.equal(outcome('B5', o.cMissingVerify()), 'missed');
    assert.equal(outcome('B4', o.cLaterWave()), 'missed');
  });
});

describe('score() over a hand-built root (test list 13)', () => {
  let root;
  let res;
  before(() => {
    root = path.join(tmp, 'root');
    const rec = (id, model, cost, extra = {}) => o.okRecord({ id, batch: 'B', model, cost_usd: cost, charged_usd: cost,
      wall_ms: 30000, first_turn_input: 30000, ...extra });
    // haiku: B4 detected (precheck-flagged), B3 missed (unrelated blocker), B5 detected, B1 false alarm.
    o.runDir(root, 'B', 'B-B4-haiku-r1', { record: rec('B-B4-haiku-r1', 'haiku', 0.1), outputs: { result_text: o.cMissingVerify() } });
    o.runDir(root, 'B', 'B-B3-haiku-r1', { record: rec('B-B3-haiku-r1', 'haiku', 0.2), outputs: { result_text: o.cUnrelatedBlocker() } });
    o.runDir(root, 'B', 'B-B5-haiku-r1', { record: rec('B-B5-haiku-r1', 'haiku', 0.3), outputs: { result_text: o.cLaterWave() } });
    o.runDir(root, 'B', 'B-B1-haiku-r1', { record: rec('B-B1-haiku-r1', 'haiku', 0.2), outputs: { result_text: o.cUnrelatedBlocker() } });
    // sonnet: B4 missed as pass, B3 detected (text only in record.result_text), B6 detected (text only in the stream),
    // B2 correct pass, plus one cap_hit run excluded.
    o.runDir(root, 'B', 'B-B4-sonnet-r1', { record: rec('B-B4-sonnet-r1', 'sonnet', 0.5), outputs: { result_text: o.cPassed() } });
    o.runDir(root, 'B', 'B-B3-sonnet-r1', { record: rec('B-B3-sonnet-r1', 'sonnet', 0.7, { result_text: o.cOverlapBlocker() }) });
    o.runDir(root, 'B', 'B-B6-sonnet-r1', {
      record: rec('B-B6-sonnet-r1', 'sonnet', 0.6, { result_text: null }),
      stream: sj.toLines([sj.initEvent(), sj.resultEvent({ result: o.cScMissing() })]),
    });
    o.runDir(root, 'B', 'B-B2-sonnet-r1', { record: rec('B-B2-sonnet-r1', 'sonnet', 0.6), outputs: { result_text: o.cWarningsOnly() } });
    o.runDir(root, 'B', 'B-B5-sonnet-r1', { record: rec('B-B5-sonnet-r1', 'sonnet', 2, { status: 'cap_hit' }) });
    res = S.score({ root, outDir: path.join(tmp, 'out') });
  });

  test('exact k/n per model, detection split by precheck_flags', () => {
    assert.equal(res.batch, 'B');
    assert.deepEqual(res.planned, { haiku: 18, sonnet: 18 });
    const { haiku, sonnet } = res.roles['job-checker'].models;
    assert.equal(res.roles['job-checker'].primary, 'detection');
    assert.deepEqual(haiku.metrics, {
      detection: { k: 2, n: 3 },
      false_alarm: { k: 1, n: 1 },
      missed_as_pass: { k: 0, n: 3 },
      unrelated_blockers: { total: 1, runs: 3 },
      abstain: { k: 0, n: 4 },
      detection_split: { precheck_flagged: { k: 1, n: 1 }, judgment_only: { k: 1, n: 2 } },
    });
    assert.deepEqual(sonnet.metrics, {
      detection: { k: 2, n: 3 },
      false_alarm: { k: 0, n: 1 },
      missed_as_pass: { k: 1, n: 3 },
      unrelated_blockers: { total: 0, runs: 3 },
      abstain: { k: 0, n: 4 },
      detection_split: { precheck_flagged: { k: 0, n: 1 }, judgment_only: { k: 2, n: 2 } },
    });
    assert.deepEqual([haiku.n_scored, sonnet.n_scored], [4, 4]);
    assert.deepEqual([haiku.cost_usd, haiku.mean_cost_usd, sonnet.cost_usd, sonnet.mean_cost_usd], [0.8, 0.2, 2.4, 0.6]);
    assert.deepEqual(res.excluded, [{ id: 'B-B5-sonnet-r1', reason: 'status:cap_hit', model: 'sonnet', role: 'job-checker', fixture: 'B5' }]);
  });

  test('runs carry verdict, outcome and counts; notes carry the precheck split', () => {
    assert.deepEqual(res.runs.map((r) => [r.id, r.verdict, r.outcome, r.blockers, r.warnings, r.unrelated_blockers]), [
      ['B-B1-haiku-r1', 'issues', 'false_alarm', 1, 0, 1],
      ['B-B2-sonnet-r1', 'issues', 'correct_pass', 0, 1, 0],
      ['B-B3-haiku-r1', 'issues', 'missed', 1, 0, 1],
      ['B-B3-sonnet-r1', 'issues', 'detected', 1, 0, 0],
      ['B-B4-haiku-r1', 'issues', 'detected', 1, 0, 0],
      ['B-B4-sonnet-r1', 'passed', 'missed_as_pass', 0, 0, 0],
      ['B-B5-haiku-r1', 'issues', 'detected', 1, 0, 0],
      ['B-B6-sonnet-r1', 'issues', 'detected', 1, 0, 0],
    ]);
    const notes = res.notes.join('\n');
    assert.match(notes, /precheck_flags split of detection \(verify trd-pre flags B4; judgment only on B3, B5, B6\)/);
    assert.match(notes, /haiku 1\/1 precheck-flagged, 1\/2 judgment-only; sonnet 0\/1 precheck-flagged, 2\/2 judgment-only/);
  });

  test('score.cjs --batch B --root <root> --out <tmp> writes results/B.json', async () => {
    const ledger = newLedger();
    ledger.batches.A.status = 'complete';
    ledger.batches.B.status = 'complete';
    saveLedger(path.join(root, 'ledger.json'), ledger);
    const out = path.join(tmp, 'cli-out');
    const lines = [];
    const code = await scoreCli.main(['--batch', 'B', '--root', root, '--out', out],
      { stdout: (s) => lines.push(s), stderr: (s) => lines.push(s), now: () => new Date('2026-10-17T12:00:00Z') });
    assert.equal(code, 0, lines.join(''));
    const saved = JSON.parse(fs.readFileSync(path.join(out, 'results', 'B.json'), 'utf8'));
    assert.deepEqual(saved.roles['job-checker'].models.sonnet.metrics.detection_split.judgment_only, { k: 2, n: 2 });
    assert.equal(saved.spend.batch, 'B');
    assert.match(fs.readFileSync(path.join(out, 'results', 'B.md'), 'utf8'), /## job-checker/);
  });
});
