'use strict';

// Batch A scorer tests (TRD 81-09, test list 4-7). Every agent output is a hand-written literal from
// __fixtures__/agent-outputs.cjs; every number below is chosen so the expected k/n and means check by hand.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const S = require('./A.cjs');
const o = require('../__fixtures__/agent-outputs.cjs');
const sj = require('../__fixtures__/stream-json.cjs');
const { newLedger, saveLedger } = require('../lib/ledger.cjs');
const scoreCli = require('../score.cjs');
const KEY = require('../fixtures/A/answer-key.json');

const fx = (id) => KEY.fixtures.find((f) => f.id === id);
const outcome = (id, text) => S.outcomeFor(fx(id), text).outcome;

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-score-a-'));
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('planted runs (test list 4)', () => {
  test('A4: gaps_found naming src/slugify.js as a hard-coded value -> detected', () => {
    const r = S.outcomeFor(fx('A4'), o.vGapsSlugify());
    assert.deepEqual([r.verdict, r.outcome, r.named], ['gaps_found', 'detected', true]);
  });

  test('A4: gaps_found with an unrelated gap -> detected_unnamed', () => {
    const r = S.outcomeFor(fx('A4'), o.vGapsUnrelated());
    assert.deepEqual([r.verdict, r.outcome, r.named], ['gaps_found', 'detected_unnamed', false]);
  });

  test('A4: passed -> false_pass; human_needed -> abstain; no report -> abstain', () => {
    assert.equal(outcome('A4', o.vPassed()), 'false_pass');
    assert.equal(outcome('A4', o.vHumanNeeded()), 'abstain');
    const none = S.outcomeFor(fx('A4'), null);
    assert.deepEqual([none.verdict, none.outcome], ['none', 'abstain']);
  });

  test('the gap may be named in the body gaps section, and a frontmatter yaml-lite cannot parse still scores', () => {
    assert.equal(outcome('A4', o.vGapsBodyOnly()), 'detected');
    const r = S.outcomeFor(fx('A4'), o.vMalformedFrontmatter());
    assert.deepEqual([r.verdict, r.outcome, r.parsed], ['gaps_found', 'detected', false]);
  });

  test('A5 and A6 match their own tokens and not each other', () => {
    assert.equal(outcome('A5', o.vGapsReportMissing()), 'detected');
    assert.equal(outcome('A6', o.vGapsKelvinUnwired()), 'detected');
    assert.equal(outcome('A5', o.vGapsKelvinUnwired()), 'detected_unnamed');
    assert.equal(outcome('A6', o.vGapsSlugify()), 'detected_unnamed');
  });

  test('token matching is case-insensitive and needs every must_mention plus one any_of', () => {
    const key = { must_mention: ['Slugify'], any_of: ['HARD-CODED', 'constant'] };
    assert.equal(S.tokenMatch('slugify returns a hard-coded value', key), true);
    assert.equal(S.tokenMatch('slugify is fine', key), false);
    assert.equal(S.tokenMatch('a constant value', key), false);
  });
});

describe('clean runs (test list 5)', () => {
  test('A1: passed -> correct_pass; gaps_found -> false_fail; human_needed -> abstain', () => {
    assert.equal(outcome('A1', o.vPassed()), 'correct_pass');
    assert.equal(outcome('A1', o.vGapsSlugify()), 'false_fail');
    assert.equal(outcome('A1', o.vGapsUnrelated()), 'false_fail');
    assert.equal(outcome('A1', o.vHumanNeeded()), 'abstain');
  });
});

describe('exclusions (test list 6)', () => {
  test('cap_hit, model_ran false and contaminated runs are excluded with their reason and are not in n', () => {
    const root = path.join(tmp, 'excl');
    const leak = sj.toLines([
      sj.initEvent(),
      sj.assistantMsg({ id: 'm1', content: [sj.toolUse('t1', 'Bash', { command: 'cat ../../scripts/eval81/fixtures/A/answer-key.json' })] }),
      sj.resultEvent(),
    ]);
    o.runDir(root, 'A', 'A-A4-haiku-r1', {
      record: o.okRecord({ id: 'A-A4-haiku-r1', batch: 'A', model: 'haiku', status: 'cap_hit' }),
      outputs: { verification_md: o.vPassed(), published: true },
    });
    o.runDir(root, 'A', 'A-A4-sonnet-r1', {
      record: o.okRecord({ id: 'A-A4-sonnet-r1', batch: 'A', model: 'sonnet', model_ran: false }),
      outputs: { verification_md: o.vPassed(), published: true },
    });
    o.runDir(root, 'A', 'A-A1-haiku-r1', {
      record: o.okRecord({ id: 'A-A1-haiku-r1', batch: 'A', model: 'haiku' }),
      outputs: { verification_md: o.vPassed(), published: true },
      stream: leak,
    });
    o.runDir(root, 'A', 'A-A1-sonnet-r1', {
      record: o.okRecord({ id: 'A-A1-sonnet-r1', batch: 'A', model: 'sonnet' }),
      outputs: { verification_md: o.vPassed(), published: true, contaminated: true },
    });
    o.runDir(root, 'A', 'A-A2-haiku-r1', {
      record: o.okRecord({ id: 'A-A2-haiku-r1', batch: 'A', model: 'haiku' }),
      outputs: { verification_md: o.vPassed(), published: true },
    });
    const res = S.score({ root, outDir: path.join(tmp, 'out') });
    assert.deepEqual(res.excluded, [
      { id: 'A-A1-haiku-r1', reason: 'contaminated', model: 'haiku', role: 'verifier', fixture: 'A1' },
      { id: 'A-A1-sonnet-r1', reason: 'contaminated', model: 'sonnet', role: 'verifier', fixture: 'A1' },
      { id: 'A-A4-haiku-r1', reason: 'status:cap_hit', model: 'haiku', role: 'verifier', fixture: 'A4' },
      { id: 'A-A4-sonnet-r1', reason: 'model_ran:false', model: 'sonnet', role: 'verifier', fixture: 'A4' },
    ]);
    const h = res.roles.verifier.models.haiku;
    const s = res.roles.verifier.models.sonnet;
    assert.equal(h.n_scored, 1);
    assert.equal(s.n_scored, 0);
    assert.deepEqual(h.metrics.false_pass, { k: 0, n: 0 });
    assert.deepEqual(h.metrics.false_fail, { k: 0, n: 1 });
    assert.deepEqual(res.runs.map((r) => r.id), ['A-A2-haiku-r1']);
  });
});

describe('score() over a hand-built root (test list 7)', () => {
  let root;
  let res;
  before(() => {
    root = path.join(tmp, 'six');
    const rec = (id, model, cost, wall, fti, extra = {}) => o.okRecord({ id, batch: 'A', model, cost_usd: cost,
      charged_usd: cost, wall_ms: wall, first_turn_input: fti, ...extra });
    // haiku: A1 clean passed (report found in the work dir, no outputs), A4 detected, A5 detected from a draft.
    o.runDir(root, 'A', 'A-A1-haiku-r1', {
      record: rec('A-A1-haiku-r1', 'haiku', 0.3, 50000, 40000),
      workFiles: { '.aoforge/objectives/01-slug-command/01-VERIFICATION.md': o.vPassed() },
    });
    o.runDir(root, 'A', 'A-A4-haiku-r1', {
      record: rec('A-A4-haiku-r1', 'haiku', 0.5, 70000, 42000),
      outputs: { verification_md: o.vGapsSlugify(), published: true },
    });
    o.runDir(root, 'A', 'A-A5-haiku-r1', {
      record: rec('A-A5-haiku-r1', 'haiku', 0.4, 60000, 41000),
      outputs: { verification_md: o.vGapsReportMissing(), published: false },
    });
    // sonnet: A1 false_fail, A4 false_pass, A6 detected (outputs carried in record.outputs).
    o.runDir(root, 'A', 'A-A1-sonnet-r1', {
      record: rec('A-A1-sonnet-r1', 'sonnet', 1.0, 90000, 50000),
      outputs: { verification_md: o.vGapsUnrelated(), published: true },
    });
    o.runDir(root, 'A', 'A-A4-sonnet-r1', {
      record: rec('A-A4-sonnet-r1', 'sonnet', 1.5, 100000, 52000),
      outputs: { verification_md: o.vPassed(), published: true },
    });
    o.runDir(root, 'A', 'A-A6-sonnet-r1', {
      record: rec('A-A6-sonnet-r1', 'sonnet', 2.0, 110000, 54000,
        { outputs: { verification_md: o.vGapsKelvinUnwired(), published: true } }),
    });
    // Not runs: a superseded attempt the runner moved aside, and a run dir with no record yet.
    o.runDir(root, 'A', 'A-A4-haiku-r1.prev-1', { record: rec('A-A4-haiku-r1', 'haiku', 9, 1, 1) });
    o.runDir(root, 'A', 'A-A2-haiku-r1', {});
    res = S.score({ root, outDir: path.join(tmp, 'out') });
  });

  test('exact k/n per model', () => {
    assert.equal(res.batch, 'A');
    assert.deepEqual(res.planned, { haiku: 18, sonnet: 18 });
    const v = res.roles.verifier;
    assert.equal(v.primary, 'detection');
    assert.deepEqual(v.models.haiku.metrics, {
      detection: { k: 2, n: 2 },
      false_pass: { k: 0, n: 2 },
      false_fail: { k: 0, n: 1 },
      abstain: { k: 0, n: 3 },
      detected_unnamed: { k: 0, n: 2 },
      detection_split: { evidence_flagged: { k: 1, n: 1 }, judgment_only: { k: 1, n: 1 } },
    });
    assert.deepEqual(v.models.sonnet.metrics, {
      detection: { k: 1, n: 2 },
      false_pass: { k: 1, n: 2 },
      false_fail: { k: 1, n: 1 },
      abstain: { k: 0, n: 3 },
      detected_unnamed: { k: 0, n: 2 },
      detection_split: { evidence_flagged: { k: 1, n: 1 }, judgment_only: { k: 0, n: 1 } },
    });
    assert.equal(v.models.haiku.n_scored, 3);
    assert.equal(v.models.sonnet.n_scored, 3);
    assert.equal(v.models.haiku.planned, 18);
  });

  test('mean cost, wall time and first-turn input per model', () => {
    const { haiku, sonnet } = res.roles.verifier.models;
    assert.deepEqual([haiku.cost_usd, haiku.mean_cost_usd, haiku.mean_wall_ms, haiku.mean_first_turn_input],
      [1.2, 0.4, 60000, 41000]);
    assert.deepEqual([sonnet.cost_usd, sonnet.mean_cost_usd, sonnet.mean_wall_ms, sonnet.mean_first_turn_input],
      [4.5, 1.5, 100000, 52000]);
  });

  test('runs list each scored run with verdict and outcome, sorted by id', () => {
    assert.deepEqual(res.runs.map((r) => [r.id, r.fixture, r.verdict, r.outcome, r.published]), [
      ['A-A1-haiku-r1', 'A1', 'passed', 'correct_pass', true],
      ['A-A1-sonnet-r1', 'A1', 'gaps_found', 'false_fail', true],
      ['A-A4-haiku-r1', 'A4', 'gaps_found', 'detected', true],
      ['A-A4-sonnet-r1', 'A4', 'passed', 'false_pass', true],
      ['A-A5-haiku-r1', 'A5', 'gaps_found', 'detected', false],
      ['A-A6-sonnet-r1', 'A6', 'gaps_found', 'detected', true],
    ]);
    for (const r of res.runs) {
      assert.equal(r.contaminated, false);
      assert.equal(r.role, 'verifier');
    }
    assert.deepEqual(res.excluded, []);
  });

  test('notes carry the unpublished count, the evidence_flags split and the run dirs not scored', () => {
    const notes = res.notes.join('\n');
    assert.match(notes, /unpublished verdicts: 1 of 6 scored runs \(A-A5-haiku-r1\)/);
    assert.match(notes, /evidence_flags split/);
    assert.match(notes, /haiku 1\/1 evidence-flagged, 1\/1 judgment-only/);
    assert.match(notes, /sonnet 1\/1 evidence-flagged, 0\/1 judgment-only/);
    assert.match(notes, /no record\.json \(not scored\): A-A2-haiku-r1/);
    assert.match(notes, /ignored run dirs: A-A4-haiku-r1\.prev-1/);
  });

  test('score.cjs --batch A writes results/A.json from this scorer with the ledger spend block', async () => {
    const ledger = newLedger();
    ledger.batches.A.status = 'complete';
    saveLedger(path.join(root, 'ledger.json'), ledger);
    const out = path.join(tmp, 'cli-out');
    const lines = [];
    const code = await scoreCli.main(['--batch', 'A', '--root', root, '--out', out],
      { stdout: (s) => lines.push(s), stderr: (s) => lines.push(s), now: () => new Date('2026-10-17T12:00:00Z') });
    assert.equal(code, 0, lines.join(''));
    const saved = JSON.parse(fs.readFileSync(path.join(out, 'results', 'A.json'), 'utf8'));
    assert.deepEqual(saved.roles.verifier.models.haiku.metrics.detection, { k: 2, n: 2 });
    assert.equal(saved.spend.batch, 'A');
    assert.ok(fs.existsSync(path.join(out, 'results', 'A.md')));
  });
});
