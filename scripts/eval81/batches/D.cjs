'use strict';
/**
 * Batch D of the objective-81 Haiku eval (TRD 81-10): the UI judge, Haiku 5.5 vs Sonnet 5.5.
 *
 * 24 headless sessions = 4 surfaces x {haiku, sonnet} x 3 repeats. A session judges every state of one surface
 * (about five screenshots) with the engine's own per-state text, the text `--judge live` would send for that state
 * (`buildVisionRequest` in the flutter pack, built here at spec time, never re-worded), and returns one engine-shaped
 * perceptual result per state (`visionPerceptualSchema` plus `state_id`). The engine's live path needs an API key; this
 * is the same judgment made through a subscription-auth Claude Code session that may only use the Read tool.
 *
 * Known difference from the engine: it judges each state in its own call, a session sees every state of its surface and
 * can compare them. The mitigations are (1) a per-repeat shuffle of the state order (mulberry32, seed = repeat x 1000 +
 * surface index, so the three repeats see three orders and both models see the same one), (2) every state judged against
 * its own expected text and (3) an instruction to judge each screenshot on its own. The report states the limitation.
 *
 * Batch module interface (81-08): { batch, runs({root, trees, calibration}), materialize(desc, workDir, ctx),
 * collect(desc, workDir, ctx) }. The runner's work dir is always `<root>/runs/D/<id>/work` (81-08 makeSandbox, recreated
 * at the same path on a retry); runs() writes that absolute path into each prompt, materialize refuses any other, and
 * `workDirFor` is exported so the 81-13 dry-run rehearsal can compare it with the runner's real work dir.
 *
 * Nothing shown to the judge carries a label: the prompt, the file names and the state ids come from the shown-states
 * file only. This module never opens the answer key; only score/D.cjs does.
 */

const fs = require('node:fs');
const path = require('node:path');

const ENGINE = require('../../../plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs');
const { capFor } = require('../lib/caps.cjs');
const { toolInputsMentioning } = require('../lib/result.cjs');

const BATCH = 'D';
const ROLE = 'ui-evaluator';
const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'D');
const STATES_FILE = 'states.json';
const MODELS = ['haiku', 'sonnet'];
const REPEATS = [1, 2, 3];
const TIMEOUT_MS = 10 * 60 * 1000;
// Background work with no bearing on the measured tokens, identical for every arm (81-08 gotchas).
const ENV = {
  AOFORGE_SKIP_AWARENESS_POPULATE: '1',
  AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
  AOFORGE_SKIP_PRUNE: '1',
};
const OPENING = 'Judge each UI state below on its own. For each, open the screenshot with the Read tool and compare it '
  + 'with its expected appearance. Return one result per state.';
const GUIDANCE = 'Compare every screenshot only with the expected appearance written in its own section, never with '
  + 'the other screenshots. Use the state id quoted in a section as the state_id of its result.';
// Tool inputs that mean the session went looking for the answer key or the harness (decision rule: contamination).
const CONTAMINATION = [/\blabels\b/i, /answer[-_ ]?key/i, /scripts\/eval81/, /fixtures\/D\//];

/** loadStates(dir?) -> the parsed shown-states file (surfaces with expected text, states with id and png). */
function loadStates(dir = FIXTURE_DIR) {
  return JSON.parse(fs.readFileSync(path.join(dir, STATES_FILE), 'utf8'));
}

/** mulberry32(seed) -> () => float in [0, 1): the small local PRNG behind the per-repeat shuffle. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** shuffled(items, seed) -> a Fisher-Yates copy, the same for the same seed. */
function shuffled(items, seed) {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** workDirFor(root, id) -> the absolute work dir the runner makes for run `id` (81-08 makeSandbox). */
function workDirFor(root, id) {
  return path.join(path.resolve(root), 'runs', BATCH, id, 'work');
}

/** The run's `--json-schema`: an array of one engine-shaped perceptual result per state, each naming its state. */
function runSchema() {
  return {
    type: 'object',
    required: ['results'],
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['state_id', 'is_broken', 'matches_expected', 'confidence', 'defects'],
          properties: { state_id: { type: 'string' }, ...ENGINE.visionPerceptualSchema().properties },
        },
      },
    },
  };
}

/**
 * The engine's per-state judge text for a state: the text block `buildVisionRequest` puts beside the image. The
 * engine reads the screenshot file and resolves its model from the profile, so the profile is pinned for the call
 * (AOFORGE_MODEL_PROFILE=balanced keeps it off any project config) and restored after.
 */
function engineText(state, surfaces, fixtureDir = FIXTURE_DIR) {
  const surface = surfaces[state.surface];
  const key = `${state.viewport.width}x${state.viewport.height}`;
  const expected = surface && surface.expected ? surface.expected[key] : undefined;
  if (typeof expected !== 'string' || expected === '') {
    throw new Error(`state ${state.id}: no expected text for surface ${state.surface} at ${key}`);
  }
  const saved = process.env.AOFORGE_MODEL_PROFILE;
  process.env.AOFORGE_MODEL_PROFILE = 'balanced';
  try {
    const { body } = ENGINE.buildVisionRequest({
      state_id: state.id,
      expected,
      screenshot_path: path.join(fixtureDir, state.png),
      judge_tier: 'sonnet',
    });
    const block = body.messages[0].content.find((c) => c && c.type === 'text');
    if (!block) throw new Error(`state ${state.id}: the engine request has no text block`);
    return block.text;
  } finally {
    if (saved === undefined) delete process.env.AOFORGE_MODEL_PROFILE;
    else process.env.AOFORGE_MODEL_PROFILE = saved;
  }
}

function buildPrompt(ids, texts, workDir) {
  const sections = ids.map((id, k) => `State ${k + 1} of ${ids.length}\n${texts.get(id)}\nScreenshot file: ${path.join(workDir, `${id}.png`)}`);
  return [OPENING, GUIDANCE, ...sections].join('\n\n');
}

/**
 * runs({root, trees, calibration}) -> RunDescriptor[] sorted by order. Order: repeat by repeat, surface by surface; the
 * two models alternate, haiku first on the first, third... surface and sonnet first on the others, so neither model
 * systematically runs on a warmer prompt cache.
 */
function runs({ root, calibration = null } = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new TypeError('batch D runs(): root must be an absolute path');
  const shown = loadStates();
  const surfaceNames = Object.keys(shown.surfaces);
  const texts = new Map();
  for (const st of shown.states) texts.set(st.id, engineText(st, shown.surfaces));

  const caps = {};
  for (const model of MODELS) caps[model] = capFor({ role: 'judge', model, batch: BATCH, calibration });

  const out = [];
  let order = 0;
  for (const repeat of REPEATS) {
    surfaceNames.forEach((surface, index) => {
      const seed = repeat * 1000 + index;
      const ids = shuffled(shown.states.filter((s) => s.surface === surface).map((s) => s.id), seed);
      const models = index % 2 === 0 ? MODELS : [...MODELS].reverse();
      for (const model of models) {
        const id = `${BATCH}-${surface}-${model}-r${repeat}`;
        const workDir = workDirFor(root, id);
        out.push({
          id,
          batch: BATCH,
          kind: 'prompt',
          agent: null,
          model,
          plugin: null,
          prompt: buildPrompt(ids, texts, workDir),
          tools: ['Read'],
          jsonSchema: runSchema(),
          capUsd: caps[model].cap,
          capBasis: caps[model].basis,
          timeoutMs: TIMEOUT_MS,
          env: { ...ENV },
          fixture: { surface, repeat, seed, state_ids: ids, work_dir: workDir },
          order,
          role: ROLE,
        });
        order += 1;
      }
    });
  }
  return out;
}

/**
 * materialize(desc, workDir, ctx) -> void. Copies this surface's PNGs into workDir as <state id>.png. Idempotent: a
 * second call overwrites those files and touches nothing else. Throws when workDir is not the path runs() wrote into
 * the prompt, so a layout drift in the runner fails loudly instead of sending the judge to files that are not there.
 */
function materialize(desc, workDir) {
  const want = desc.fixture.work_dir;
  if (path.resolve(workDir) !== path.resolve(want)) {
    throw new Error(`batch D materialize: work dir ${workDir} is not the one runs() wrote into the prompt (${want})`);
  }
  const shown = loadStates();
  fs.mkdirSync(workDir, { recursive: true });
  for (const st of shown.states.filter((s) => s.surface === desc.fixture.surface)) {
    fs.copyFileSync(path.join(FIXTURE_DIR, st.png), path.join(workDir, `${st.id}.png`));
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The results array out of a parsed value: {results: [...]} or a bare array; null when it has neither. */
function resultsOf(value) {
  if (Array.isArray(value)) return value;
  if (isObj(value) && Array.isArray(value.results)) return value.results;
  return null;
}

/**
 * parseResults({structured_output, result_text}) -> {results, source, parse_error?}. The structured output wins; else
 * the last fenced ```json block of the result text; if neither parses, `{results: [], source: 'none', parse_error}` and
 * the scorer gives every state of the run a missing sample.
 */
function parseResults(record) {
  const rec = isObj(record) ? record : {};
  const fromStructured = resultsOf(rec.structured_output);
  if (fromStructured) return { results: fromStructured, source: 'structured_output' };
  let reason = 'no structured output and no fenced json block in the result text';
  if (typeof rec.result_text === 'string') {
    const blocks = [...rec.result_text.matchAll(/```json[ \t]*\r?\n([\s\S]*?)```/gi)];
    if (blocks.length > 0) {
      const last = blocks[blocks.length - 1][1];
      try {
        const results = resultsOf(JSON.parse(last));
        if (results) return { results, source: 'fenced' };
        reason = 'the last fenced json block has no results array';
      } catch (err) {
        reason = `the last fenced json block does not parse: ${err.message}`;
      }
    }
  }
  return { results: [], source: 'none', parse_error: reason };
}

/** The tool_use ids in the run's stream that look at the answer key or the harness (empty without a stream file). */
function contaminationIds(root, desc) {
  if (typeof root !== 'string') return [];
  const file = path.join(path.resolve(root), 'runs', BATCH, desc.id, 'stream.jsonl');
  if (!fs.existsSync(file)) return [];
  return toolInputsMentioning(fs.readFileSync(file, 'utf8'), CONTAMINATION);
}

/** collect(desc, workDir, {root, record}) -> {results, source, parse_error?, contaminated, contamination_ids}. */
function collect(desc, workDir, { root, record } = {}) {
  const ids = contaminationIds(root, desc);
  return { ...parseResults(record), contaminated: ids.length > 0, contamination_ids: ids };
}

module.exports = {
  batch: BATCH,
  runs,
  materialize,
  collect,
  workDirFor,
  parseResults,
  runSchema,
  loadStates,
  engineText,
  shuffled,
  ROLE,
  MODELS,
  REPEATS,
  FIXTURE_DIR,
};
