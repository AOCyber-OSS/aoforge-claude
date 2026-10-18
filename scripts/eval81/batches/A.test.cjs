'use strict';

// Batch A module tests (TRD 81-09, test list 1-3). Hand-built roots under TMPDIR, no network, no ~/.claude.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const A = require('./A.cjs');
const { validateDescriptor } = require('../lib/contract.cjs');
const { capFor } = require('../lib/caps.cjs');
const { makeCalibration } = require('../__fixtures__/calibration.cjs');
const { buildFixture, describeFixture, FIXTURES } = require('../fixtures/A/build.cjs');
const outputs = require('../__fixtures__/agent-outputs.cjs');
const sj = require('../__fixtures__/stream-json.cjs');

const REPO = path.resolve(__dirname, '..', '..', '..');
const WORKFLOW = path.join(REPO, 'plugins', 'aoforge', 'aoforge', 'workflows', 'execute-objective.md');

// Words that would tell the model what it is being tested on. Fixture ids are matched as whole words.
const KEY_WORDS = ['stub', 'planted', 'unwired', 'missing_file', 'answer', 'fixture', 'eval81'];
const FIXTURE_ID = /\b[A-E][1-9]\b/;

/** The verifier spawn prompt as execute-objective.md writes it: from "Verify objective" to the closing `",`. */
function extractTemplate() {
  const text = fs.readFileSync(WORKFLOW, 'utf8');
  const anchor = 'Task(\n  prompt="Verify objective';
  const at = text.indexOf(anchor);
  assert.notEqual(at, -1, 'the verifier Task( prompt= block is in execute-objective.md');
  const start = at + 'Task(\n  prompt="'.length;
  const end = text.indexOf('",', start);
  assert.notEqual(end, -1, 'the verifier prompt closes with ",');
  return text.slice(start, end);
}

// Objective 82 (TRD 82-11): live spawn prompts carry the line `AOForge runtime: {runtime_root}`, which hands the agent
// its absolute runtime path. 81's frozen template predates it, so the comparison drops exactly that line (after
// trimming indentation) and nothing else.
const RUNTIME_LINE = 'AOForge runtime: {runtime_root}';
const dropRuntimeLine = (text) => text.split('\n').filter((l) => l.trim() !== RUNTIME_LINE).join('\n');

/** Independent fill: replace each placeholder literally. */
function fill(template, values) {
  let out = template;
  for (const [name, value] of Object.entries(values)) out = out.split(`{${name}}`).join(value);
  return out;
}

/** Goal and requirement IDs read from a fresh build's ROADMAP.md, the way the orchestrator reads them. */
function roadmapFacts(id, dir) {
  buildFixture(id, dir);
  const roadmap = fs.readFileSync(path.join(dir, '.aoforge', 'ROADMAP.md'), 'utf8');
  const section = roadmap.slice(roadmap.indexOf('### Objective 1:'));
  return {
    goal: /^\*\*Goal\*\*: (.*)$/m.exec(section)[1],
    reqs: /^\*\*Requirements\*\*: (.*)$/m.exec(section)[1],
  };
}

let tmp;
let root;
let descs;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-batch-a-'));
  root = path.join(tmp, 'root');
  descs = A.runs({ root, trees: null, calibration: makeCalibration() });
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('batch A runs() (test list 1)', () => {
  test('36 valid agent descriptors with unique A-<fx>-<model>-r<n> ids', () => {
    assert.equal(A.batch, 'A');
    assert.equal(descs.length, 36);
    for (const d of descs) {
      assert.deepEqual(validateDescriptor(d), { ok: true, errors: [] }, d.id);
      assert.match(d.id, /^A-A[1-6]-(haiku|sonnet)-r[1-3]$/);
      assert.equal(d.batch, 'A');
      assert.equal(d.kind, 'agent');
      assert.equal(d.agent, 'aoforge:verifier');
      assert.equal(d.plugin, '3.1.0');
      assert.equal(d.role, 'verifier');
      assert.equal(d.timeoutMs, 15 * 60 * 1000);
      assert.deepEqual(d.env, {
        AOFORGE_SKIP_EDIT_GATE: '1',
        AOFORGE_SKIP_AWARENESS_POPULATE: '1',
        AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
        AOFORGE_SKIP_PRUNE: '1',
      });
    }
    assert.equal(new Set(descs.map((d) => d.id)).size, 36);
    for (const model of ['haiku', 'sonnet']) assert.equal(descs.filter((d) => d.model === model).length, 18);
    for (const fx of FIXTURES) assert.equal(descs.filter((d) => d.fixture.id === fx).length, 6);
  });

  test('interleaved: repeat-major, key order, haiku first on odd fixtures and sonnet first on even ones', () => {
    assert.deepEqual(descs.map((d) => d.order), Array.from({ length: 36 }, (_, i) => i));
    assert.deepEqual(descs.slice(0, 12).map((d) => d.id), [
      'A-A1-haiku-r1', 'A-A1-sonnet-r1',
      'A-A2-sonnet-r1', 'A-A2-haiku-r1',
      'A-A3-haiku-r1', 'A-A3-sonnet-r1',
      'A-A4-sonnet-r1', 'A-A4-haiku-r1',
      'A-A5-haiku-r1', 'A-A5-sonnet-r1',
      'A-A6-sonnet-r1', 'A-A6-haiku-r1',
    ]);
    assert.equal(descs[12].id, 'A-A1-haiku-r2');
    assert.equal(descs[35].id, 'A-A6-haiku-r3');
  });

  test('caps come from capFor with the calibration passed in, and the fallback without one', () => {
    const cal = makeCalibration();
    for (const d of descs) {
      const want = capFor({ role: 'verifier', model: d.model, batch: 'A', calibration: cal });
      assert.equal(d.capUsd, want.cap, d.id);
      assert.equal(d.capBasis, want.basis, d.id);
      assert.match(d.capBasis, /^p90\(verifier\)=1\.7634 x /);
    }
    const bare = A.runs({ root, trees: null, calibration: null });
    for (const d of bare) assert.match(d.capBasis, /^fallback p90\(verifier\)=1\.7634/);
  });

  test('runs() needs an eval root', () => {
    assert.throws(() => A.runs({ root: null, trees: null, calibration: null }), /root/);
  });
});

describe('batch A prompts (test list 2)', () => {
  test('the module template is the execute-objective.md verifier spawn prompt, verbatim', () => {
    assert.equal(A.VERIFIER_TEMPLATE, extractTemplate());
  });

  test('objective 82: the comparison ignores exactly the runtime line; any other added line still fails it', () => {
    const [first, ...rest] = A.VERIFIER_TEMPLATE.split('\n');
    const withLine = [first, RUNTIME_LINE, ...rest].join('\n');
    assert.equal(dropRuntimeLine(withLine), A.VERIFIER_TEMPLATE);
    assert.notEqual(dropRuntimeLine([first, 'AOForge runtime: /abs/runtime', ...rest].join('\n')), A.VERIFIER_TEMPLATE, 'a filled runtime line is not ignored');
    assert.notEqual(dropRuntimeLine([first, RUNTIME_LINE, 'Read the TRD first.', ...rest].join('\n')), A.VERIFIER_TEMPLATE, 'another added line fails');
  });

  test('each prompt is that template filled with the fixture objective dir, ROADMAP goal and requirement IDs', () => {
    const template = extractTemplate();
    for (const fx of FIXTURES) {
      const facts = roadmapFacts(fx, path.join(tmp, 'roadmap', fx));
      const want = fill(template, {
        objective_number: '1',
        objective_dir: describeFixture(fx).objectiveDir,
        'goal from ROADMAP.md': facts.goal,
        objective_req_ids: facts.reqs,
      });
      assert.equal(facts.reqs, describeFixture(fx).requirements.join(', '));
      for (const d of descs.filter((x) => x.fixture.id === fx)) assert.equal(d.prompt, want, d.id);
    }
  });

  test('no prompt carries a key word, a fixture id or a placeholder', () => {
    for (const d of descs) {
      const lower = d.prompt.toLowerCase();
      for (const w of KEY_WORDS) assert.equal(lower.includes(w), false, `${d.id} contains ${w}`);
      assert.doesNotMatch(d.prompt, FIXTURE_ID, d.id);
      assert.doesNotMatch(d.prompt, /\{[a-z_ .]+\}/i, d.id);
      assert.equal(d.prompt.includes(d.id), false);
    }
  });

  test('prompts are stable across runs() calls on the same root (cached facts)', () => {
    const again = A.runs({ root, trees: null, calibration: makeCalibration() });
    assert.deepEqual(again.map((d) => d.prompt), descs.map((d) => d.prompt));
    assert.ok(fs.existsSync(path.join(root, 'cache', 'A', 'A1', 'facts.json')));
  });
});

describe('batch A materialize and collect (test list 3)', () => {
  test('materialize builds the fixture repository into the work dir', () => {
    const desc = descs.find((d) => d.id === 'A-A4-haiku-r1');
    const work = path.join(tmp, 'runs', 'm1', 'work');
    fs.mkdirSync(work, { recursive: true });
    A.materialize(desc, work, { root, trees: null, home: path.join(tmp, 'home') });
    const ref = buildFixture('A4', path.join(tmp, 'ref-a4'));
    const head = spawnSync('git', ['-C', work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    assert.equal(head, ref.head);
    assert.ok(fs.existsSync(path.join(work, '.aoforge', 'objectives', '01-slug-command', '01-01-SUMMARY.md')));
    // Nothing harness-side lands in the work dir.
    const listing = spawnSync('git', ['-C', work, 'status', '--porcelain=v1', '-uall'], { encoding: 'utf8' }).stdout;
    assert.equal(listing, '');
  });

  test('collect returns the published VERIFICATION.md', () => {
    const desc = descs.find((d) => d.id === 'A-A4-sonnet-r1');
    const runDir = outputs.runDir(path.join(tmp, 'c1'), 'A', desc.id, {
      workFiles: { '.aoforge/objectives/01-slug-command/01-VERIFICATION.md': outputs.vGapsSlugify() },
    });
    const got = A.collect(desc, path.join(runDir, 'work'), { root, home: null, record: { result_text: 'Verified.' } });
    assert.deepEqual(got, {
      verification_md: outputs.vGapsSlugify(),
      published: true,
      source: '.aoforge/objectives/01-slug-command/01-VERIFICATION.md',
      result_text: 'Verified.',
      contaminated: false,
    });
  });

  test('collect falls back to the newest draft under the run TMPDIR, marked unpublished', () => {
    const desc = descs.find((d) => d.id === 'A-A4-haiku-r2');
    const older = 'aoforge-drafts/work-aaaa1111/objectives/01-slug-command/01-VERIFICATION.md';
    const newer = 'aoforge-drafts/work-bbbb2222/objectives/01-slug-command/01-VERIFICATION.md';
    const runDir = outputs.runDir(path.join(tmp, 'c2'), 'A', desc.id, {
      tmpFiles: { [older]: outputs.vPassed(), [newer]: outputs.vGapsUnrelated() },
    });
    fs.utimesSync(path.join(runDir, 'tmp', older), new Date('2026-10-17T10:00:00Z'), new Date('2026-10-17T10:00:00Z'));
    fs.utimesSync(path.join(runDir, 'tmp', newer), new Date('2026-10-17T11:00:00Z'), new Date('2026-10-17T11:00:00Z'));
    const got = A.collect(desc, path.join(runDir, 'work'), { root, home: null, record: null });
    assert.equal(got.verification_md, outputs.vGapsUnrelated());
    assert.equal(got.published, false);
    assert.equal(got.source, `tmp/${newer}`);
    assert.equal(got.result_text, null);
  });

  test('collect with no report at all returns verification_md null', () => {
    const desc = descs.find((d) => d.id === 'A-A1-haiku-r3');
    const runDir = outputs.runDir(path.join(tmp, 'c3'), 'A', desc.id, {});
    const got = A.collect(desc, path.join(runDir, 'work'), { root, home: null, record: { result_text: 'x' } });
    assert.equal(got.verification_md, null);
    assert.equal(got.published, false);
    assert.equal(got.source, null);
  });

  test('collect flags a run whose tool inputs read an answer key or scripts/eval81', () => {
    const desc = descs.find((d) => d.id === 'A-A5-haiku-r1');
    const stream = sj.toLines([
      sj.initEvent(),
      sj.assistantMsg({ id: 'm1', content: [sj.toolUse('toolu-1', 'Read', { file_path: '/x/scripts/eval81/fixtures/A/answer-key.json' })] }),
      sj.resultEvent(),
    ]);
    const runDir = outputs.runDir(path.join(tmp, 'c4'), 'A', desc.id, { stream });
    const got = A.collect(desc, path.join(runDir, 'work'), { root, home: null, record: null });
    assert.equal(got.contaminated, true);
    const clean = outputs.runDir(path.join(tmp, 'c5'), 'A', desc.id, { stream: sj.toLines([sj.initEvent(), sj.resultEvent()]) });
    assert.equal(A.collect(desc, path.join(clean, 'work'), { root, home: null, record: null }).contaminated, false);
  });
});
