'use strict';
/**
 * Batch D of objective 82 (TRD 82-05; SC-3): the P1 escalation check. Proposal P1 moves the ui-evaluator to haiku and
 * escalates on split votes; this batch measures how often that escalation fires and what it costs, judging each state
 * the way the engine's `--judge live` does: one state per call.
 *
 * Start phase: for each of objective 81's 20 shown states (fixtures/D/states.json order), six single-state sessions in
 * the order h1 s1 h2 s2 h3 s3 (`D-<state>-h-<k>` haiku, `D-<state>-s-<k>` sonnet), 120 in all. Prompt: a one-state
 * opening, the engine's own per-state text (objective 81's engineText, the text buildVisionRequest sends) and a line
 * naming the screenshot. jsonSchema: objective 81's run schema held to one result. Read only; plugin none.
 *
 * Escalation phase (runs() is planned on every runner invocation, so the batch grows once the haiku samples exist):
 * for each state whose three `-h-` records ended `ok` with a parsable sample, the engine decides, with every state
 * treated as expect:pass: `scoreState({samples})` gives the reviews, `aggregateVotes(samples).split` the flake flag,
 * and `judgeEscalation({live: true, judgeTier: 'haiku', reviews, states})` the states to escalate. Each requested
 * state gets `D-<state>-esc-1..3` (sonnet, same prompt). Nothing else feeds the decision: no answer key, no sonnet
 * sample. A state with a haiku sample missing or failed adds nothing yet.
 *
 * Screenshot line: the Read tool takes absolute paths, and runs() receives the eval root R, not the sandbox root S the
 * work dir lives under, so the only absolute path a prompt may carry is one built from EVAL82_SANDBOX_ROOT (set by the
 * live command; resolved with fs.realpathSync, as the runner resolves --sandbox-root; it must hold trees.json):
 *   "The screenshot is the file `<S>/runs/D/<id>/work/<state>.png`. Open it with the Read tool."
 * Unset (unit tests, dry runs without it) the line names `<state>.png` in the working directory and every descriptor
 * carries `fixture.screenshot_path: 'relative'`, so a live run without the variable is visible in every record.
 *
 * Caps: haiku $0.05, sonnet $0.15 per session; timeout 5 minutes; env: objective 81's D flags; role ui-evaluator.
 * This module never opens the answer key; only score/D.cjs does.
 */

const fs = require('node:fs');
const path = require('node:path');

const ENGINE = require('../../../plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs');
const D81 = require('../../eval81/batches/D.cjs');
const { validateDescriptor } = require('../../eval81/lib/contract.cjs');
const { toolInputsMentioning } = require('../../eval81/lib/result.cjs');

const BATCH = 'D';
const ROLE = D81.ROLE;
const SAMPLES = [1, 2, 3];
const TIMEOUT_MS = 5 * 60 * 1000;
const CAPS = { haiku: 0.05, sonnet: 0.15 };
const CAP_BASIS = {
  haiku: 'objective 82: $0.05 per single-state haiku session (one screenshot, one result)',
  sonnet: 'objective 82: $0.15 per single-state sonnet session (one screenshot, one result)',
};
// objective 81's D flags: background work with no bearing on the measured tokens, identical for every arm.
const ENV = {
  AOFORGE_SKIP_AWARENESS_POPULATE: '1',
  AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
  AOFORGE_SKIP_PRUNE: '1',
};
const SANDBOX_ENV = 'EVAL82_SANDBOX_ROOT';
const OPENING = 'Judge the UI state below on its own. Open the screenshot with the Read tool and compare it with its '
  + 'expected appearance. Return one result.';
const ARMS = { h: 'haiku', s: 'sonnet', esc: 'escalation' };
// Tool inputs that mean the session went looking for the answer key or the harness.
const CONTAMINATION = [/answer[-_ ]?key/i, /scripts\/eval8[12]/, /fixtures\/D\//];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** sandboxRootFrom(env) -> the realpath of EVAL82_SANDBOX_ROOT, or null when unset; throws when it is unusable. */
function sandboxRootFrom(env = process.env) {
  const v = env ? env[SANDBOX_ENV] : undefined;
  if (v === undefined || v === '') return null;
  if (!path.isAbsolute(v)) throw new Error(`${SANDBOX_ENV} must be an absolute path (the runner's --sandbox-root), got ${JSON.stringify(v)}`);
  let real;
  try {
    real = fs.realpathSync(v);
  } catch (err) {
    throw new Error(`${SANDBOX_ENV} ${v} cannot be resolved (${err.code || err.message})`);
  }
  if (!fs.existsSync(path.join(real, 'trees.json'))) {
    throw new Error(`${SANDBOX_ENV} ${v} holds no trees.json: export the plugin trees there first (sandbox.exportTrees) and pass the same dir as --sandbox-root`);
  }
  return real;
}

/** screenshotLine({state, id, sandboxRoot}) -> the prompt's last line (see the module comment). */
function screenshotLine({ state, id, sandboxRoot }) {
  if (sandboxRoot) {
    return `The screenshot is the file \`${path.join(sandboxRoot, 'runs', BATCH, id, 'work', `${state}.png`)}\`. Open it with the Read tool.`;
  }
  return `The screenshot is the file \`${state}.png\` in the working directory. Open it with the Read tool.`;
}

/** The run's `--json-schema`: objective 81's run schema with exactly one result. */
function stateSchema() {
  const s = D81.runSchema();
  s.properties.results.minItems = 1;
  s.properties.results.maxItems = 1;
  return s;
}

/**
 * sampleOf(record, state) -> {is_broken, defects} of the record's result for `state`, or null (not ok, no parsable
 * result, or no boolean is_broken). The result naming the state wins; a single result with another id is taken too
 * (a single-state session, one screenshot).
 */
function sampleOf(record, state) {
  if (!isObj(record) || record.status !== 'ok') return null;
  const { results } = D81.parseResults(record);
  const valid = results.filter((r) => isObj(r) && typeof r.is_broken === 'boolean');
  const hit = valid.find((r) => r.state_id === state) || (valid.length === 1 ? valid[0] : null);
  return hit ? { is_broken: hit.is_broken, defects: Array.isArray(hit.defects) ? hit.defects : [] } : null;
}

/**
 * escalatedStates(Map<state, samples[]>, tier) -> the states the engine escalates, in map order: every state is
 * expect:pass, reviews are the states scoreState puts in review, flake is aggregateVotes().split.
 */
function escalatedStates(samplesByState, tier = 'haiku') {
  const reviews = [];
  const states = [];
  for (const [state, samples] of samplesByState) {
    if (ENGINE.scoreState({ samples }).verdict === 'review') reviews.push(state);
    states.push({ state_id: state, flake: ENGINE.aggregateVotes(samples).split });
  }
  return ENGINE.judgeEscalation({ live: true, judgeTier: tier, reviews, states }).states;
}

function readRecord(root, id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'runs', BATCH, id, 'record.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** The three haiku samples of each state that has all three, from `<root>/runs/D/D-<state>-h-<k>/record.json`. */
function haikuSamples(root, stateIds) {
  const out = new Map();
  if (typeof root !== 'string' || root === '') return out;
  for (const state of stateIds) {
    const samples = SAMPLES.map((k) => sampleOf(readRecord(root, `${BATCH}-${state}-h-${k}`), state));
    if (samples.every(Boolean)) out.set(state, samples);
  }
  return out;
}

function descriptor({ state, arm, k, model, order, prompt, sandboxRoot }) {
  const id = `${BATCH}-${state}-${arm}-${k}`;
  return {
    id,
    batch: BATCH,
    kind: 'prompt',
    agent: null,
    model,
    plugin: null,
    prompt: `${prompt}\n\n${screenshotLine({ state, id, sandboxRoot })}`,
    tools: ['Read'],
    jsonSchema: stateSchema(),
    capUsd: CAPS[model],
    capBasis: CAP_BASIS[model],
    timeoutMs: TIMEOUT_MS,
    env: { ...ENV },
    fixture: { state, arm: ARMS[arm], sample: k, screenshot_path: sandboxRoot ? 'absolute' : 'relative' },
    order,
    role: ROLE,
  };
}

/** runs({root, env}) -> the 120 start sessions, plus the escalation sessions the haiku samples call for. */
function runs({ root, env = process.env } = {}) {
  const sandboxRoot = sandboxRootFrom(env);
  const shown = D81.loadStates();
  const stateIds = shown.states.map((s) => s.id);
  const prompts = new Map(shown.states.map((st) => [st.id, `${OPENING}\n\n${D81.engineText(st, shown.surfaces)}`]));
  const out = [];
  let order = 0;
  for (const state of stateIds) {
    for (const k of SAMPLES) {
      for (const [arm, model] of [['h', 'haiku'], ['s', 'sonnet']]) {
        out.push(descriptor({ state, arm, k, model, order, prompt: prompts.get(state), sandboxRoot }));
        order += 1;
      }
    }
  }
  for (const state of escalatedStates(haikuSamples(root, stateIds), 'haiku')) {
    for (const k of SAMPLES) {
      out.push(descriptor({ state, arm: 'esc', k, model: 'sonnet', order, prompt: prompts.get(state), sandboxRoot }));
      order += 1;
    }
  }
  for (const d of out) {
    const v = validateDescriptor(d);
    if (!v.ok) throw new Error(`batch D: invalid descriptor ${d.id}: ${v.errors.join('; ')}`);
  }
  return out;
}

/**
 * materialize(desc, workDir) -> copies the state's PNG to `<workDir>/<state>.png` and nothing else. With an absolute
 * screenshot line, a work dir other than the one the prompt names is refused (the judge would be sent to a file that
 * is not there).
 */
function materialize(desc, workDir) {
  const { state } = desc.fixture;
  const target = path.join(workDir, `${state}.png`);
  if (desc.fixture.screenshot_path === 'absolute' && !desc.prompt.includes(`\`${target}\``)) {
    throw new Error(`batch D materialize: ${workDir} is not the work dir the prompt names for ${desc.id}`);
  }
  const st = D81.loadStates().states.find((s) => s.id === state);
  if (!st) throw new Error(`batch D materialize: unknown state ${state}`);
  fs.mkdirSync(workDir, { recursive: true });
  fs.copyFileSync(path.join(D81.FIXTURE_DIR, st.png), target);
}

/** collect(desc, workDir, {root, record}) -> {results, source, parse_error?, sample, contaminated, contamination_ids}. */
function collect(desc, workDir, { root, record } = {}) {
  let ids = [];
  const file = typeof root === 'string' ? path.join(root, 'runs', BATCH, desc.id, 'stream.jsonl') : null;
  if (file && fs.existsSync(file)) ids = toolInputsMentioning(fs.readFileSync(file, 'utf8'), CONTAMINATION);
  return {
    ...D81.parseResults(record),
    sample: sampleOf(isObj(record) ? { status: 'ok', ...record } : null, desc.fixture.state),
    contaminated: ids.length > 0,
    contamination_ids: ids,
  };
}

module.exports = {
  batch: BATCH,
  runs,
  materialize,
  collect,
  sampleOf,
  escalatedStates,
  screenshotLine,
  sandboxRootFrom,
  stateSchema,
  ROLE,
  CAPS,
  SAMPLES,
  SANDBOX_ENV,
  ENV,
};
