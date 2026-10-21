'use strict';

// Batch B module tests (TRD 81-09, test list 8-9). Hand-built roots under TMPDIR, no network, no ~/.claude.
//
// With `trees: null` (no eval worktrees in a unit test) runs() computes the pre-check with THIS checkout's
// aof-tools; the cache records `source: "checkout"`. The live batch passes the 3.1.0 tree (test "trees").

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const B = require('./B.cjs');
const { validateDescriptor } = require('../lib/contract.cjs');
const { capFor } = require('../lib/caps.cjs');
const { makeCalibration } = require('../__fixtures__/calibration.cjs');
const { buildFixture, describeFixture, FIXTURES } = require('../fixtures/B/build.cjs');
const outputs = require('../__fixtures__/agent-outputs.cjs');

const REPO = path.resolve(__dirname, '..', '..', '..');
const WORKFLOW = path.join(REPO, 'plugins', 'aoforge', 'aoforge', 'workflows', 'plan-objective.md');
const CHECKOUT_TOOL = path.join(REPO, 'plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs');

const KEY_WORDS = ['stub', 'planted', 'unwired', 'missing_file', 'answer', 'fixture', 'eval81', 'same_wave_overlap',
  'missing_verify', 'later_wave_dependency', 'uncovered_success_criterion'];
const FIXTURE_ID = /\b[A-E][1-9]\b/;

/** The checker prompt as plan-objective.md writes it: the ```markdown block after "Checker prompt:". */
function extractTemplate() {
  const text = fs.readFileSync(WORKFLOW, 'utf8');
  const at = text.indexOf('Checker prompt:');
  assert.notEqual(at, -1, 'plan-objective.md has a "Checker prompt:" block');
  const open = '```markdown\n';
  const start = text.indexOf(open, at) + open.length;
  const end = text.indexOf('\n```', start);
  return dropRuntimeLine(text.slice(start, end)); // objective 82: ignore exactly the runtime line
}

// Objective 82 (TRD 82-11): live spawn prompts carry the line `AOForge runtime: {runtime_root}`, which hands the agent
// its absolute runtime path. 81's frozen template predates it, so the comparison drops exactly that line (after
// trimming indentation) and nothing else.
const RUNTIME_LINE = 'AOForge runtime: {runtime_root}';
const dropRuntimeLine = (text) => text.split('\n').filter((l) => l.trim() !== RUNTIME_LINE).join('\n');

function fill(template, values) {
  let out = template;
  for (const [name, value] of Object.entries(values)) out = out.split(`{${name}}`).join(value);
  return out;
}

/** An independent `verify trd-pre 2` run on a fresh build: the parsed JSON without its timing field. */
function independentPrecheck(dir, home, tmpDir) {
  const r = spawnSync(process.execPath, [CHECKOUT_TOOL, 'verify', 'trd-pre', '2'], {
    cwd: dir,
    env: { PATH: process.env.PATH, HOME: home, TMPDIR: tmpDir, LC_ALL: 'C' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const json = JSON.parse(r.stdout);
  delete json.elapsed_ms;
  return json;
}

const withoutTiming = (text) => {
  const json = JSON.parse(text);
  delete json.elapsed_ms;
  return json;
};

let tmp;
let root;
let descs;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-batch-b-'));
  root = path.join(tmp, 'root');
  fs.mkdirSync(path.join(tmp, 'home'));
  fs.mkdirSync(path.join(tmp, 'tmpdir'));
  descs = B.runs({ root, trees: null, calibration: makeCalibration() });
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('batch B runs() (test list 8)', () => {
  test('36 valid job-checker descriptors, interleaved like A', () => {
    assert.equal(B.batch, 'B');
    assert.equal(descs.length, 36);
    for (const d of descs) {
      assert.deepEqual(validateDescriptor(d), { ok: true, errors: [] }, d.id);
      assert.match(d.id, /^B-B[1-6]-(haiku|sonnet)-r[1-3]$/);
      assert.equal(d.kind, 'agent');
      assert.equal(d.agent, 'aoforge:job-checker');
      assert.equal(d.role, 'job-checker');
      assert.equal(d.plugin, '3.1.0');
      assert.equal(d.timeoutMs, 15 * 60 * 1000);
      assert.deepEqual(Object.keys(d.env).sort(), ['AOFORGE_SKIP_AWARENESS_POPULATE', 'AOFORGE_SKIP_EDIT_GATE',
        'AOFORGE_SKIP_PRUNE', 'AOFORGE_SKIP_TRANSCRIPT_EXPORT']);
      const cap = capFor({ role: 'job-checker', model: d.model, batch: 'B', calibration: makeCalibration() });
      assert.equal(d.capUsd, cap.cap);
      assert.match(d.capBasis, /^p90\(job-checker\)=1\.5977 x /);
    }
    assert.equal(new Set(descs.map((d) => d.id)).size, 36);
    assert.deepEqual(descs.map((d) => d.order), Array.from({ length: 36 }, (_, i) => i));
    assert.deepEqual(descs.slice(0, 4).map((d) => d.id), ['B-B1-haiku-r1', 'B-B1-sonnet-r1', 'B-B2-sonnet-r1', 'B-B2-haiku-r1']);
    assert.equal(descs[35].id, 'B-B6-haiku-r3');
  });

  test('the pre-check in each prompt is the cached `verify trd-pre 2` JSON of that set, from this checkout (no trees)', () => {
    for (const fx of FIXTURES) {
      const cache = JSON.parse(fs.readFileSync(path.join(root, 'cache', 'B', fx, 'precheck.json'), 'utf8'));
      assert.equal(cache.source, 'checkout');
      assert.equal(cache.tool, CHECKOUT_TOOL);
      const line = '**Mechanical pre-check (verify trd-pre):** ';
      for (const d of descs.filter((x) => x.fixture.id === fx)) {
        const at = d.prompt.indexOf(line) + line.length;
        assert.equal(d.prompt.slice(at, at + cache.precheck.length), cache.precheck, d.id);
      }
      const fresh = path.join(tmp, 'pre', fx);
      buildFixture(fx, fresh);
      assert.deepEqual(withoutTiming(cache.precheck), independentPrecheck(fresh, path.join(tmp, 'home'), path.join(tmp, 'tmpdir')));
    }
    const b4 = JSON.parse(JSON.parse(fs.readFileSync(path.join(root, 'cache', 'B', 'B4', 'precheck.json'), 'utf8')).precheck);
    assert.equal(b4.passed, false);
    assert.equal(b4.checks.task_completeness.passed, false);
  });

  test('repeats of a set have identical prompts, and runs() on the same root reuses the cache', () => {
    for (const fx of FIXTURES) {
      const prompts = new Set(descs.filter((d) => d.fixture.id === fx).map((d) => d.prompt));
      assert.equal(prompts.size, 1, fx);
    }
    const again = B.runs({ root, trees: null, calibration: null });
    assert.deepEqual(again.map((d) => d.prompt), descs.map((d) => d.prompt));
  });

  test('with trees, the pre-check comes from the 3.1.0 tree; a cache from another source is refused', () => {
    const tree = path.join(tmp, 'tree');
    const tool = path.join(tree, 'plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs');
    fs.mkdirSync(path.dirname(tool), { recursive: true });
    fs.writeFileSync(tool, "process.stdout.write(JSON.stringify({ objective: process.argv[4], tree: true }, null, 2) + '\\n');\n");
    const root2 = path.join(tmp, 'root2');
    const viaTree = B.runs({ root: root2, trees: { '3.1.0': { ref: 'v3.1.0', sha: 'x', path: tree } }, calibration: null });
    assert.match(viaTree[0].prompt, /\*\*Mechanical pre-check \(verify trd-pre\):\*\* \{\n {2}"objective": "2",\n {2}"tree": true\n\}/);
    const cache = JSON.parse(fs.readFileSync(path.join(root2, 'cache', 'B', 'B1', 'precheck.json'), 'utf8'));
    assert.equal(cache.source, 'tree 3.1.0');
    assert.equal(cache.tool, tool);
    assert.throws(() => B.runs({ root: root2, trees: null, calibration: null }), /came from tree 3\.1\.0/);
    assert.throws(() => B.runs({ root: path.join(tmp, 'root3'), trees: { '3.0.0': { path: tree } }, calibration: null }), /3\.1\.0/);
  });
});

describe('batch B prompts (test list 9)', () => {
  test('the module template is plan-objective.md\'s checker prompt, verbatim', () => {
    assert.equal(B.CHECKER_TEMPLATE, extractTemplate());
  });

  test('objective 82: the comparison ignores exactly the runtime line; any other added line still fails it', () => {
    const [first, ...rest] = B.CHECKER_TEMPLATE.split('\n');
    assert.equal(dropRuntimeLine([first, RUNTIME_LINE, ...rest].join('\n')), B.CHECKER_TEMPLATE);
    assert.notEqual(dropRuntimeLine([first, 'AOForge runtime: /abs/runtime', ...rest].join('\n')), B.CHECKER_TEMPLATE, 'a filled runtime line is not ignored');
    assert.notEqual(dropRuntimeLine([first, RUNTIME_LINE, '**Extra:** x', ...rest].join('\n')), B.CHECKER_TEMPLATE, 'another added line fails');
  });

  test('each prompt is that template filled with goal, TRD paths, pre-check, requirement IDs and REQUIREMENTS.md', () => {
    const template = extractTemplate();
    for (const fx of FIXTURES) {
      const d = describeFixture(fx);
      const fresh = path.join(tmp, 'fill', fx);
      buildFixture(fx, fresh);
      const objDir = `.aoforge/objectives/${d.objectiveDir}`;
      const names = fs.readdirSync(path.join(fresh, objDir));
      const planPaths = [...names.filter((n) => n.endsWith('-TRD.md')).sort(), ...names.filter((n) => n.endsWith('-JOB.md')).sort()]
        .map((n) => `${objDir}/${n}`);
      const cache = JSON.parse(fs.readFileSync(path.join(root, 'cache', 'B', fx, 'precheck.json'), 'utf8'));
      const want = fill(template, {
        objective_number: '2',
        'goal from ROADMAP': d.goal,
        plan_paths: planPaths.join('\n'),
        precheck: cache.precheck,
        objective_req_ids: d.requirementIds.join(', '),
        requirements_content: fs.readFileSync(path.join(fresh, '.aoforge', 'REQUIREMENTS.md'), 'utf8').replace(/\n+$/, ''),
        'context_content or user_preferences': 'No CONTEXT.md: no locked decisions.',
      });
      assert.equal(planPaths.length, d.trdFiles.length);
      for (const desc of descs.filter((x) => x.fixture.id === fx)) assert.equal(desc.prompt, want, desc.id);
    }
  });

  test('no prompt carries a key word, a set id or a placeholder', () => {
    for (const d of descs) {
      const lower = d.prompt.toLowerCase();
      for (const w of KEY_WORDS) assert.equal(lower.includes(w), false, `${d.id} contains ${w}`);
      assert.doesNotMatch(d.prompt, FIXTURE_ID, d.id);
      assert.doesNotMatch(d.prompt, /\{(objective_number|goal from ROADMAP|plan_paths|precheck|objective_req_ids|requirements_content|context_content or user_preferences)\}/, d.id);
    }
  });
});

describe('batch B materialize and collect', () => {
  test('materialize builds the set into the work dir; collect returns the checker return text', () => {
    const desc = descs.find((d) => d.id === 'B-B3-haiku-r1');
    const runDir = outputs.runDir(path.join(tmp, 'm'), 'B', desc.id, {});
    const work = path.join(runDir, 'work');
    B.materialize(desc, work, { root, trees: null, home: path.join(tmp, 'home') });
    assert.ok(fs.existsSync(path.join(work, '.aoforge', 'objectives', '02-export-formats', '02-01-csv-renderer-TRD.md')));
    const ref = buildFixture('B3', path.join(tmp, 'ref-b3'));
    assert.equal(spawnSync('git', ['-C', work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), ref.head);
    assert.deepEqual(B.collect(desc, work, { root, home: null, record: { result_text: outputs.cOverlapBlocker() } }),
      { result_text: outputs.cOverlapBlocker() });
    assert.deepEqual(B.collect(desc, work, { root, home: null, record: null }), { result_text: null });
  });
});
