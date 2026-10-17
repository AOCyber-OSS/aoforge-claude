'use strict';

// Tests for scripts/eval81/batches/D.cjs (TRD 81-10, test list 1-4): the batch D spec, 24 headless judge sessions
// (4 surfaces x haiku, sonnet x 3 repeats). Each session judges every state of one surface with the engine's own
// per-state text (buildVisionRequest in the flutter pack) and returns one engine-shaped result per state.
//
// Fixtures are the frozen 81-05 files (states.json, labels.json, png/). The labels are read here, by the test, to
// prove the batch module never shows them; the batch module itself never reads that file. No test calls the API.
// Temp dirs come from os.tmpdir(), so run with TMPDIR under the session scratchpad.

const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { validateDescriptor } = require('../lib/contract.cjs');
const { capFor } = require('../lib/caps.cjs');
const { toLines, assistantMsg, toolUse } = require('../__fixtures__/stream-json.cjs');
const jo = require('../__fixtures__/judge-outputs.cjs');

const FIX = path.resolve(__dirname, '..', 'fixtures', 'D');
const BATCH_PATH = path.join(__dirname, 'D.cjs');
const ENGINE = require('../../../plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs');

const states = JSON.parse(fs.readFileSync(path.join(FIX, 'states.json'), 'utf8'));
const labels = JSON.parse(fs.readFileSync(path.join(FIX, 'labels.json'), 'utf8'));
const SURFACES = Object.keys(states.surfaces);
const MODELS = ['haiku', 'sonnet'];

// Loaded per test, so a missing module fails each test with its own name.
const load = () => require('./D.cjs');

let tmp;
let savedProfile;
before(() => {
  savedProfile = process.env.AOFORGE_MODEL_PROFILE;
  process.env.AOFORGE_MODEL_PROFILE = 'balanced';
});
after(() => {
  if (savedProfile === undefined) delete process.env.AOFORGE_MODEL_PROFILE;
  else process.env.AOFORGE_MODEL_PROFILE = savedProfile;
});
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-bd-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** The engine's own per-state judge text, computed here from the engine (the test's oracle). */
function engineText(state) {
  const expected = states.surfaces[state.surface].expected[`${state.viewport.width}x${state.viewport.height}`];
  const { body } = ENGINE.buildVisionRequest({
    state_id: state.id,
    expected,
    screenshot_path: path.join(FIX, state.png),
    judge_tier: 'sonnet',
  });
  return body.messages[0].content[1].text;
}

const statesOf = (surface) => states.states.filter((s) => s.surface === surface);
const workDirOf = (root, desc) => path.join(root, 'runs', 'D', desc.id, 'work');

/** The state ids a prompt lists, in order, from its "Screenshot file:" lines. */
function promptOrder(prompt) {
  return [...prompt.matchAll(/Screenshot file: .*\/(d\d{2})\.png/g)].map((m) => m[1]);
}

const ARGS = (root) => ({ root, trees: null, calibration: null });

describe('batch D: runs() (test list 1)', () => {
  test('1. returns 24 valid descriptors: 4 surfaces x haiku, sonnet x 3 repeats', () => {
    const d = load();
    assert.equal(d.batch, 'D');
    const runs = d.runs(ARGS(tmp));
    assert.equal(runs.length, 24);
    const ids = new Set();
    for (const r of runs) {
      const v = validateDescriptor(r);
      assert.deepEqual(v.errors, [], `${r.id}: ${v.errors.join('; ')}`);
      ids.add(r.id);
    }
    const expected = new Set();
    for (const s of SURFACES) for (const m of MODELS) for (const n of [1, 2, 3]) expected.add(`D-${s}-${m}-r${n}`);
    assert.deepEqual(ids, expected);
  });

  test('1b. every run is a prompt session with only the Read tool, no plugin, the schema and a basis-carrying cap', () => {
    const runs = load().runs(ARGS(tmp));
    const props = ENGINE.visionPerceptualSchema().properties;
    const schema = {
      type: 'object',
      required: ['results'],
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['state_id', 'is_broken', 'matches_expected', 'confidence', 'defects'],
            properties: { state_id: { type: 'string' }, ...props },
          },
        },
      },
    };
    for (const r of runs) {
      assert.equal(r.batch, 'D');
      assert.equal(r.kind, 'prompt');
      assert.equal(r.agent, null);
      assert.equal(r.plugin, null);
      assert.deepEqual(r.tools, ['Read']);
      assert.deepEqual(r.jsonSchema, schema);
      assert.equal(r.role, 'ui-evaluator');
      assert.equal(r.timeoutMs, 10 * 60 * 1000);
      const cap = capFor({ role: 'judge', model: r.model, batch: 'D' });
      assert.equal(r.capUsd, cap.cap);
      assert.equal(r.capBasis, cap.basis);
      assert.match(r.capBasis, /base 36K x 3 turns=/);
      assert.deepEqual(r.env, { AOFORGE_SKIP_AWARENESS_POPULATE: '1', AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1', AOFORGE_SKIP_PRUNE: '1' });
    }
  });

  test('1c. order is 0..23, interleaved: repeat by repeat, haiku first on even surfaces and sonnet first on odd', () => {
    const runs = load().runs(ARGS(tmp));
    assert.deepEqual(runs.map((r) => r.order), [...Array(24).keys()]);
    const first = runs.slice(0, 8).map((r) => r.id);
    assert.deepEqual(first, [
      'D-home-haiku-r1', 'D-home-sonnet-r1',
      'D-ui-eval-guide-sonnet-r1', 'D-ui-eval-guide-haiku-r1',
      'D-commands-haiku-r1', 'D-commands-sonnet-r1',
      'D-troubleshooting-sonnet-r1', 'D-troubleshooting-haiku-r1',
    ]);
    assert.deepEqual(runs.slice(8, 10).map((r) => r.id), ['D-home-haiku-r2', 'D-home-sonnet-r2']);
  });

  test('1d. the fixture names the surface, repeat, state order, seed and the work dir', () => {
    const d = load();
    const runs = d.runs(ARGS(tmp));
    for (const r of runs) {
      assert.deepEqual(Object.keys(r.fixture).sort(), ['repeat', 'seed', 'state_ids', 'surface', 'work_dir']);
      assert.equal(r.fixture.work_dir, workDirOf(tmp, r));
      assert.equal(r.fixture.work_dir, d.workDirFor(tmp, r.id));
      assert.equal(r.fixture.seed, r.fixture.repeat * 1000 + SURFACES.indexOf(r.fixture.surface));
    }
  });
});

describe('batch D: prompts (test list 2 and 3)', () => {
  test('2. a prompt holds the engine text of every state of its surface and the work-dir path of each screenshot', () => {
    const runs = load().runs(ARGS(tmp));
    for (const r of runs) {
      const surfaceStates = statesOf(r.fixture.surface);
      assert.ok(surfaceStates.length >= 4, `${r.id} judges ${surfaceStates.length} states`);
      assert.match(r.prompt, /^Judge each UI state below on its own\. For each, open the screenshot with the Read tool and compare it with its expected appearance\. Return one result per state\./);
      for (const st of surfaceStates) {
        const text = engineText(st);
        assert.equal(r.prompt.split(text).length - 1, 1, `${r.id}: engine text of ${st.id} appears exactly once`);
        const line = `Screenshot file: ${path.join(workDirOf(tmp, r), `${st.id}.png`)}`;
        assert.equal(r.prompt.split(line).length - 1, 1, `${r.id}: ${line}`);
        // The text sits directly above its screenshot line, so a state's text and path cannot be separated.
        assert.ok(r.prompt.includes(`${text}\n${line}`), `${r.id}: ${st.id} text then path`);
      }
      assert.deepEqual([...promptOrder(r.prompt)].sort(), surfaceStates.map((s) => s.id).sort());
    }
  });

  test('2b. the engine text is the engine text: its opening, its taxonomy and the surface expected text', () => {
    const runs = load().runs(ARGS(tmp));
    const r = runs.find((x) => x.id === 'D-ui-eval-guide-haiku-r1');
    assert.match(r.prompt, /You are a strict UI-defect detector\. Evaluate this screenshot for state "d06"\./);
    assert.match(r.prompt, /Score DEVIATION from expected, not open-ended aesthetics\. Taxonomy/);
    assert.ok(r.prompt.includes(states.surfaces['ui-eval-guide'].expected['390x844']), 'the phone-width expected text for d06');
    assert.ok(r.prompt.includes(states.surfaces['ui-eval-guide'].expected['1280x800']), 'the desktop expected text for d01');
  });

  test('2c. state order differs between repeats, is shared by the two models and is identical across two calls', () => {
    const d = load();
    const a = d.runs(ARGS(tmp));
    const b = d.runs(ARGS(tmp));
    assert.deepEqual(a, b);
    for (const s of SURFACES) {
      const orderOf = (model, n) => promptOrder(a.find((r) => r.id === `D-${s}-${model}-r${n}`).prompt);
      for (const m of MODELS) {
        const [o1, o2, o3] = [1, 2, 3].map((n) => orderOf(m, n));
        assert.notDeepEqual(o1, o2, `${s} ${m}: r1 and r2 differ`);
        assert.notDeepEqual(o1, o3, `${s} ${m}: r1 and r3 differ`);
        assert.notDeepEqual(o2, o3, `${s} ${m}: r2 and r3 differ`);
      }
      for (const n of [1, 2, 3]) assert.deepEqual(orderOf('haiku', n), orderOf('sonnet', n), `${s} r${n}: same stimulus for both models`);
    }
  });

  test('2d. the order is the seeded shuffle: the fixture records it and the prompt follows it', () => {
    const runs = load().runs(ARGS(tmp));
    for (const r of runs) {
      assert.deepEqual(promptOrder(r.prompt), r.fixture.state_ids);
      assert.deepEqual([...r.fixture.state_ids].sort(), statesOf(r.fixture.surface).map((s) => s.id).sort());
    }
  });

  test('2e. runs() leaves AOFORGE_MODEL_PROFILE as it found it', () => {
    const d = load();
    delete process.env.AOFORGE_MODEL_PROFILE;
    try {
      d.runs(ARGS(tmp));
      assert.equal(process.env.AOFORGE_MODEL_PROFILE, undefined);
      process.env.AOFORGE_MODEL_PROFILE = 'quality';
      d.runs(ARGS(tmp));
      assert.equal(process.env.AOFORGE_MODEL_PROFILE, 'quality');
    } finally {
      process.env.AOFORGE_MODEL_PROFILE = 'balanced';
    }
  });

  // Words that would tell the judge a state's answer, the scan of 81-05's proofs applies to what the judge is shown.
  const LABEL_WORDS = /\b(ok|broken|fail\w*|pass\w*|overflow\w*|blank\w*|defect\w*|contrast\w*|misalign\w*|overlap\w*|label\w*|baseline|severity|region|min_share|answer\w*)\b/i;

  test('3. nothing the judge is shown carries a label: no label word outside the engine text, no labels field value', () => {
    const d = load();
    const runs = d.runs(ARGS(tmp));
    for (const r of runs) {
      let rest = r.prompt;
      for (const st of statesOf(r.fixture.surface)) rest = rest.split(engineText(st)).join('');
      // What remains is the opening line and the "Screenshot file:" lines.
      const hit = rest.replace(tmp, '').match(LABEL_WORDS);
      assert.equal(hit, null, `${r.id}: label word outside the engine text: ${hit && hit[0]}`);
      assert.ok(!/labels\.json/.test(r.prompt));
      // Nor does any field name of the answer key.
      for (const field of ['label', 'defect_type', 'also_defect_types', 'severity', 'region', 'baseline', 'min_share']) {
        assert.ok(!rest.includes(field), `${r.id}: the answer key field ${field} appears outside the engine text`);
      }
    }
  });

  test('3b. the materialised file names are neutral and the module never names the answer key file', () => {
    const d = load();
    const src = fs.readFileSync(BATCH_PATH, 'utf8');
    assert.ok(!/labels\.json/.test(src), 'batches/D.cjs must not reference the answer key file');
    const runs = d.runs(ARGS(tmp));
    for (const r of runs.filter((x) => x.model === 'haiku' && x.fixture.repeat === 1)) {
      const work = workDirOf(tmp, r);
      d.materialize(r, work, { root: tmp, trees: null, home: tmp });
      const files = fs.readdirSync(work);
      for (const f of files) {
        assert.match(f, /^d\d\d\.png$/);
        assert.equal(f.match(LABEL_WORDS), null);
      }
    }
  });
});

describe('batch D: materialize and collect (test list 4)', () => {
  test('4. materialize copies only that surface\'s PNGs, as <id>.png, byte for byte', () => {
    const d = load();
    const r = d.runs(ARGS(tmp)).find((x) => x.id === 'D-commands-sonnet-r2');
    const work = workDirOf(tmp, r);
    d.materialize(r, work, { root: tmp, trees: null, home: tmp });
    const want = statesOf('commands').map((s) => `${s.id}.png`).sort();
    assert.deepEqual(fs.readdirSync(work).sort(), want);
    for (const f of want) {
      assert.ok(fs.readFileSync(path.join(work, f)).equals(fs.readFileSync(path.join(FIX, 'png', f))), `${f} is the fixture`);
    }
  });

  test('4b. materialize refuses a work dir other than the one runs() wrote into the prompt', () => {
    const d = load();
    const r = d.runs(ARGS(tmp))[0];
    const wrong = path.join(tmp, 'elsewhere', 'work');
    assert.throws(() => d.materialize(r, wrong, { root: tmp, trees: null, home: tmp }), /work dir/i);
    assert.equal(fs.existsSync(wrong), false);
    // The right one is accepted, also when it is spelled with a trailing separator or a ./ segment.
    assert.doesNotThrow(() => d.materialize(r, `${path.join(tmp, 'runs', 'D', r.id)}${path.sep}.${path.sep}work`, { root: tmp }));
  });

  test('4c. materialize is idempotent: a second call restores the PNGs and touches nothing else', () => {
    const d = load();
    const r = d.runs(ARGS(tmp))[0];
    const work = workDirOf(tmp, r);
    d.materialize(r, work, { root: tmp });
    const first = statesOf(r.fixture.surface)[0].id;
    fs.writeFileSync(path.join(work, `${first}.png`), 'damaged by a previous attempt');
    fs.writeFileSync(path.join(work, 'note.txt'), 'not ours');
    d.materialize(r, work, { root: tmp });
    assert.ok(fs.readFileSync(path.join(work, `${first}.png`)).equals(fs.readFileSync(path.join(FIX, 'png', `${first}.png`))));
    assert.equal(fs.readFileSync(path.join(work, 'note.txt'), 'utf8'), 'not ours');
  });

  const desc = (root) => load().runs(ARGS(root))[0];
  const results = [jo.okResult('d05'), jo.brokenResult('d08', [jo.defect('contrast_legibility', 'medium')])];

  test('4d. collect returns {results} from structured_output', () => {
    const d = load();
    const r = desc(tmp);
    const out = d.collect(r, workDirOf(tmp, r), { root: tmp, record: jo.runOutput(results) });
    assert.deepEqual(out.results, results);
    assert.equal(out.source, 'structured_output');
    assert.equal(out.parse_error, undefined);
    assert.equal(out.contaminated, false);
  });

  test('4e. collect falls back to the last fenced json block of the result text', () => {
    const d = load();
    const r = desc(tmp);
    const rec = jo.runOutput(results, { as: 'fenced' });
    rec.result_text = `Draft:\n\`\`\`json\n{"results": []}\n\`\`\`\nFinal:\n${rec.result_text}`;
    const out = d.collect(r, workDirOf(tmp, r), { root: tmp, record: rec });
    assert.deepEqual(out.results, results);
    assert.equal(out.source, 'fenced');
  });

  test('4f. collect accepts a bare array in the fenced block', () => {
    const d = load();
    const r = desc(tmp);
    const rec = { structured_output: null, result_text: `\`\`\`json\n${JSON.stringify(results)}\n\`\`\`` };
    assert.deepEqual(d.collect(r, workDirOf(tmp, r), { root: tmp, record: rec }).results, results);
  });

  test('4g. neither parses: {results: [], parse_error}', () => {
    const d = load();
    const r = desc(tmp);
    for (const rec of [
      jo.runOutput(results, { as: 'garbage' }),
      { structured_output: null, result_text: '```json\n{not json\n```' },
      { structured_output: { not_results: 1 }, result_text: null },
      { structured_output: null, result_text: undefined },
    ]) {
      const out = d.collect(r, workDirOf(tmp, r), { root: tmp, record: rec });
      assert.deepEqual(out.results, []);
      assert.equal(typeof out.parse_error, 'string');
      assert.ok(out.parse_error.length > 0);
      assert.equal(out.source, 'none');
    }
  });

  test('4h. collect marks a run contaminated when a tool input names the answer key or the harness scripts', () => {
    const d = load();
    const r = desc(tmp);
    const runDir = path.join(tmp, 'runs', 'D', r.id);
    fs.mkdirSync(runDir, { recursive: true });
    const clean = toLines([assistantMsg({ id: 'm1', content: [toolUse('t1', 'Read', { file_path: path.join(workDirOf(tmp, r), 'd05.png') })] })]);
    fs.writeFileSync(path.join(runDir, 'stream.jsonl'), clean);
    assert.equal(d.collect(r, workDirOf(tmp, r), { root: tmp, record: jo.runOutput(results) }).contaminated, false);
    const dirty = toLines([
      assistantMsg({ id: 'm1', content: [toolUse('t1', 'Read', { file_path: '/repo/scripts/eval81/fixtures/D/labels.json' })] }),
      assistantMsg({ id: 'm2', content: [toolUse('t2', 'Read', { file_path: path.join(workDirOf(tmp, r), 'd05.png') })] }),
    ]);
    fs.writeFileSync(path.join(runDir, 'stream.jsonl'), dirty);
    const out = d.collect(r, workDirOf(tmp, r), { root: tmp, record: jo.runOutput(results) });
    assert.equal(out.contaminated, true);
    assert.deepEqual(out.contamination_ids, ['t1']);
  });
});
