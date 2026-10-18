'use strict';
// TRD 82-05 test list 6-8: objective 82's batch D, every UI state judged in its own session (3 haiku and 3 sonnet
// samples), then sonnet escalation sessions for exactly the states the engine's own rules escalate. No network, no
// claude binary, no ~/.claude.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const D82 = require('./D.cjs');
const D81 = require('../../eval81/batches/D.cjs');
const { validateDescriptor } = require('../../eval81/lib/contract.cjs');
const { writeDVotes } = require('../__fixtures__/records.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'e82-batchD-'));
const SHOWN = D81.loadStates();
const STATE_IDS = SHOWN.states.map((s) => s.id);
const OPENING = 'Judge the UI state below on its own. Open the screenshot with the Read tool and compare it with its expected appearance. Return one result.';

function sandboxWithTrees() {
  const s = tmp();
  fs.writeFileSync(path.join(s, 'trees.json'), '{}\n');
  return s;
}

test('6: the start phase is 120 single-state sessions, h1 s1 h2 s2 h3 s3 per state, with the engine text', () => {
  const root = tmp();
  const list = D82.runs({ root, env: {} });
  assert.equal(D82.batch, 'D');
  assert.equal(list.length, 120);
  const expectIds = STATE_IDS.flatMap((st) => [1, 2, 3].flatMap((k) => [`D-${st}-h-${k}`, `D-${st}-s-${k}`]));
  assert.deepEqual(list.map((d) => d.id), expectIds);
  assert.deepEqual(list.map((d) => d.order), list.map((_, i) => i));
  const d01h1 = list[0];
  const text = D81.engineText(SHOWN.states[0], SHOWN.surfaces);
  assert.equal(d01h1.prompt, [OPENING, text, D82.screenshotLine({ state: 'd01', id: 'D-d01-h-1', sandboxRoot: null })].join('\n\n'));
  for (const d of list) {
    assert.ok(validateDescriptor(d).ok, d.id);
    const [, state, arm] = /^D-(d\d\d)-([hs])-\d$/.exec(d.id);
    assert.equal(d.kind, 'prompt');
    assert.equal(d.agent, null);
    assert.equal(d.plugin, null);
    assert.deepEqual(d.tools, ['Read']);
    assert.equal(d.model, arm === 'h' ? 'haiku' : 'sonnet');
    assert.equal(d.capUsd, arm === 'h' ? 0.05 : 0.15);
    assert.match(d.capBasis, /objective 82/);
    assert.equal(d.timeoutMs, 5 * 60 * 1000);
    assert.equal(d.role, 'ui-evaluator');
    assert.deepEqual(d.env, { AOFORGE_SKIP_AWARENESS_POPULATE: '1', AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1', AOFORGE_SKIP_PRUNE: '1' });
    assert.equal(d.fixture.state, state);
    assert.equal(d.fixture.arm, arm === 'h' ? 'haiku' : 'sonnet');
    assert.equal(d.prompt.includes(`"${state}"`), true);
    // The schema is 81's run schema held to one result.
    assert.deepEqual(d.jsonSchema.properties.results.items, D81.runSchema().properties.results.items);
    assert.equal(d.jsonSchema.properties.results.minItems, 1);
    assert.equal(d.jsonSchema.properties.results.maxItems, 1);
  }
  // 81's env flags, unchanged.
  assert.deepEqual(list[0].env, D81.runs({ root }).find(() => true).env);
});

test('6a: with EVAL82_SANDBOX_ROOT the prompt names the screenshot by its absolute sandbox path', () => {
  const s = sandboxWithTrees();
  const real = fs.realpathSync(s);
  const list = D82.runs({ root: tmp(), env: { EVAL82_SANDBOX_ROOT: s } });
  for (const d of [list[0], list[7], list[119]]) {
    const want = path.join(real, 'runs', 'D', d.id, 'work', `${d.fixture.state}.png`);
    assert.ok(path.isAbsolute(want));
    assert.ok(!want.includes('~'));
    assert.ok(d.prompt.endsWith(`The screenshot is the file \`${want}\`. Open it with the Read tool.`), d.prompt.slice(-200));
    assert.equal(d.fixture.screenshot_path, 'absolute');
  }
});

test('6a: a relative EVAL82_SANDBOX_ROOT, or one without trees.json, throws naming the variable', () => {
  assert.throws(() => D82.runs({ root: tmp(), env: { EVAL82_SANDBOX_ROOT: 'relative/dir' } }), /EVAL82_SANDBOX_ROOT/);
  assert.throws(() => D82.runs({ root: tmp(), env: { EVAL82_SANDBOX_ROOT: tmp() } }), /EVAL82_SANDBOX_ROOT.*trees\.json/);
  assert.throws(() => D82.runs({ root: tmp(), env: { EVAL82_SANDBOX_ROOT: path.join(tmp(), 'missing') } }), /EVAL82_SANDBOX_ROOT/);
});

test('6a: unset, the line names the file in the working directory and every record shows it', () => {
  const list = D82.runs({ root: tmp(), env: {} });
  assert.ok(list[0].prompt.endsWith('The screenshot is the file `d01.png` in the working directory. Open it with the Read tool.'));
  assert.ok(list.every((d) => d.fixture.screenshot_path === 'relative'));
});

test('7: escalation sessions for exactly the states the engine escalates from the three haiku samples', () => {
  const root = tmp();
  writeDVotes(root, {
    d01: { h: 'oob' }, // split with an ok majority: review, escalated
    d02: { h: 'ooo' }, // unanimous: no
    d03: { h: 'bbo' }, // broken majority: no
    d04: { h: 'oo-' }, // a sample missing: not yet
    d05: { h: 'obe' }, // a sample ended in error: not yet
  });
  const list = D82.runs({ root, env: {} });
  const esc = list.filter((d) => d.fixture.arm === 'escalation');
  assert.deepEqual(esc.map((d) => d.id), ['D-d01-esc-1', 'D-d01-esc-2', 'D-d01-esc-3']);
  assert.deepEqual(esc.map((d) => d.order), [120, 121, 122]);
  for (const d of esc) {
    assert.equal(d.model, 'sonnet');
    assert.equal(d.capUsd, 0.15);
    assert.equal(d.fixture.state, 'd01');
    assert.ok(d.prompt.includes('"d01"'));
    assert.ok(validateDescriptor(d).ok);
  }
  assert.equal(list.length, 123);
  // The escalation decision is the engine's: scoreState review + split -> judgeEscalation.
  assert.deepEqual(D82.escalatedStates(new Map([
    ['x', [{ is_broken: false, defects: [] }, { is_broken: false, defects: [] }, { is_broken: true, defects: [] }]],
    ['y', [{ is_broken: true, defects: [] }, { is_broken: true, defects: [] }, { is_broken: false, defects: [] }]],
    ['z', [{ is_broken: false, defects: [] }, { is_broken: false, defects: [] }, { is_broken: false, defects: [] }]],
  ])), ['x']);
});

test('8: materialize copies exactly that state\'s PNG into the work dir', () => {
  const [d] = D82.runs({ root: tmp(), env: {} });
  const work = path.join(tmp(), 'work');
  D82.materialize(d, work, {});
  assert.deepEqual(fs.readdirSync(work), ['d01.png']);
  assert.ok(fs.readFileSync(path.join(work, 'd01.png')).equals(fs.readFileSync(path.join(D81.FIXTURE_DIR, 'png', 'd01.png'))));

  // With an absolute prompt path, any other work dir is refused (the judge would be sent to a file that is not there).
  const s = sandboxWithTrees();
  const [abs] = D82.runs({ root: tmp(), env: { EVAL82_SANDBOX_ROOT: s } });
  assert.throws(() => D82.materialize(abs, path.join(tmp(), 'work'), {}), /not the work dir the prompt names/);
  const right = path.join(fs.realpathSync(s), 'runs', 'D', abs.id, 'work');
  D82.materialize(abs, right, {});
  assert.deepEqual(fs.readdirSync(right), ['d01.png']);
});

test('8: the batch module never opens the answer key', () => {
  const src = fs.readFileSync(path.join(__dirname, 'D.cjs'), 'utf-8');
  assert.equal(/labels/.test(src), false);
});

test('collect returns the parsed sample and the contamination check', () => {
  const [d] = D82.runs({ root: tmp(), env: {} });
  const out = D82.collect(d, tmp(), { root: tmp(), record: { status: 'ok', structured_output: { results: [{ state_id: 'd01', is_broken: true, matches_expected: false, confidence: 0.8, defects: [] }] } } });
  assert.equal(out.source, 'structured_output');
  assert.equal(out.sample.is_broken, true);
  assert.equal(out.contaminated, false);
});
