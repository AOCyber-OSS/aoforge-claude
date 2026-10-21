'use strict';

// Batch B of the objective-81 eval (TRD 81-09): the job-checker on six planned TRD sets (scripts/eval81/fixtures/B),
// Haiku 5.5 against Sonnet 5.5, three repeats each, 36 runs. Same interface, order, env and timeout as batch A
// (batches/A.cjs); the shared helpers are imported from there.
//
// Each run is `claude -p --agent aoforge:job-checker` on the 3.1.0 tree. The prompt is plan-objective.md's checker
// prompt (CHECKER_TEMPLATE, asserted equal to the workflow file by B.test.cjs), filled the way the orchestrator fills
// it for objective 2 of the set:
//   {objective_number}                      2
//   {goal from ROADMAP}                     the **Goal**: line of ROADMAP.md's objective 2 section
//   {plan_paths}                            `ls <objective_dir>/*-TRD.md <objective_dir>/*-JOB.md`, one per line
//   {precheck}                              `aof-tools verify trd-pre 2` stdout (the JSON form; `--raw` prints only the
//                                           summary line, TRD 81-04), trailing newlines removed as `$(...)` does
//   {objective_req_ids}                     the **Requirements**: line of objective 2, brackets removed
//   {requirements_content}                  REQUIREMENTS.md, trailing newlines removed
//   {context_content or user_preferences}   "No CONTEXT.md: no locked decisions." (no set has a CONTEXT.md)
//
// The pre-check must come from the plugin tree under test. runs() builds each set once into <root>/cache/B/<id>/repo/
// and runs `node <trees["3.1.0"].path>/plugins/aoforge/aoforge/bin/aof-tools.cjs verify trd-pre 2` there with
// HOME=<root>/cache/home and TMPDIR=<root>/cache/tmp. With `trees: null` (unit tests, a dry run before the trees
// exist) it uses this checkout's aof-tools instead and records `source: "checkout"`. The result, with every other
// prompt input, is cached in <root>/cache/B/<id>/precheck.json, so every repeat of a set gets a byte-identical prompt
// (the JSON carries an `elapsed_ms` that differs per call). A cache computed from another source is refused rather
// than mixed into one batch: remove <root>/cache/B to recompute.
//
// collect() returns {result_text}: the checker writes no file; its verdict is its final message (the record's
// result_text). The scorer falls back to the stream's result event.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { buildFixture, describeFixture } = require('../fixtures/B/build.cjs');
const KEY = require('../fixtures/B/answer-key.json');
const { capFor } = require('../lib/caps.cjs');
const shared = require('./A.cjs');

const BATCH = 'B';
const AGENT = 'aoforge:job-checker';
const ROLE = 'job-checker';
const FIXTURE_IDS = KEY.sets.map((s) => s.id);
const RUN_ID = /^B-(B\d+)-(haiku|sonnet|opus)-r(\d+)$/;
const NO_CONTEXT = 'No CONTEXT.md: no locked decisions.';
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TOOL_REL = path.join('plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs');
const CHECKOUT_TOOL = path.join(REPO_ROOT, TOOL_REL);

// plugins/aoforge/aoforge/workflows/plan-objective.md, the ```markdown block after "Checker prompt:", verbatim.
const CHECKER_TEMPLATE = [
  '<verification_context>',
  '**Objective:** {objective_number}',
  '**Objective Goal:** {goal from ROADMAP}',
  '',
  '**Plans to verify (read each):** {plan_paths}',
  '**Mechanical pre-check (verify trd-pre):** {precheck}',
  '**Objective requirement IDs (MUST ALL be covered):** {objective_req_ids}',
  '**Requirements:** {requirements_content}',
  '',
  '**Objective Context/Preferences:**',
  'Plans MUST honor user decisions. Flag as issue if plans contradict.',
  '- **Decisions** = LOCKED — plans must implement exactly',
  '- **Discretion areas** = Freedom — plans can choose approach',
  '- **Out of scope** = Plans must NOT include',
  '',
  '{context_content or user_preferences}',
  '</verification_context>',
  '',
  '<expected_output>',
  '- ## VERIFICATION PASSED — all checks pass',
  '- ## ISSUES FOUND — structured issue list',
  '</expected_output>',
].join('\n');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const chompNewlines = (s) => s.replace(/\n+$/, '');

/** aofTools(trees) -> {path, source}: the 3.1.0 tree's aof-tools, or this checkout's when trees is null. */
function aofTools(trees) {
  if (trees === null || trees === undefined) return { path: CHECKOUT_TOOL, source: 'checkout' };
  const entry = isObj(trees) ? trees['3.1.0'] : null;
  const dir = typeof entry === 'string' ? entry : (isObj(entry) ? entry.path : null);
  if (typeof dir !== 'string' || dir === '') {
    throw new Error('batch B runs(): trees has no 3.1.0 path (expected R/trees.json {"3.1.0": {ref, sha, path}})');
  }
  const tool = path.join(dir, TOOL_REL);
  if (!shared.isFile(tool)) throw new Error(`batch B runs(): no aof-tools in the 3.1.0 tree: ${tool}`);
  return { path: tool, source: 'tree 3.1.0' };
}

/** `ls <dir>/*-TRD.md <dir>/*-JOB.md` as repo-relative paths: TRDs sorted, then JOBs sorted. */
function planPaths(repo, objectiveRel) {
  const names = fs.readdirSync(path.join(repo, objectiveRel));
  const pick = (suffix) => names.filter((n) => n.endsWith(suffix)).sort();
  return [...pick('-TRD.md'), ...pick('-JOB.md')].map((n) => `${objectiveRel}/${n}`);
}

/** The cached prompt inputs of one set (module header). */
function setInputs(root, tool, id) {
  const dir = path.join(root, 'cache', BATCH, id);
  const file = path.join(dir, 'precheck.json');
  if (shared.isFile(file)) {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cached.source !== tool.source || cached.tool !== tool.path) {
      throw new Error(`batch B: the pre-check cached at ${file} came from ${cached.source} (${cached.tool}); this call `
        + `uses ${tool.source} (${tool.path}). Remove ${path.join(root, 'cache', BATCH)} to recompute, so one batch never `
        + 'mixes two pre-checks');
    }
    return cached;
  }
  const repo = path.join(dir, 'repo');
  fs.rmSync(repo, { recursive: true, force: true }); // a half-built cache from an interrupted call
  buildFixture(id, repo);
  const d = describeFixture(id);
  const home = path.join(root, 'cache', 'home');
  const tmp = path.join(root, 'cache', 'tmp');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });
  const r = spawnSync(process.execPath, [tool.path, 'verify', 'trd-pre', d.objective], {
    cwd: repo,
    env: { PATH: process.env.PATH, HOME: home, TMPDIR: tmp, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const precheck = chompNewlines(r.stdout || '');
  try {
    JSON.parse(precheck);
  } catch {
    throw new Error(`batch B: verify trd-pre printed no JSON for set ${id} (exit ${r.status}): ${String(r.stderr || '').slice(0, 400)}`);
  }
  const objectiveRel = `.aoforge/objectives/${d.objectiveDir}`;
  const roadmap = shared.roadmapObjective(fs.readFileSync(path.join(repo, '.aoforge', 'ROADMAP.md'), 'utf8'), d.objective);
  const inputs = {
    id,
    source: tool.source,
    tool: tool.path,
    objective: d.objective,
    objectiveDir: objectiveRel,
    goal: roadmap.goal,
    reqIds: roadmap.reqIds,
    planPaths: planPaths(repo, objectiveRel),
    requirements: chompNewlines(fs.readFileSync(path.join(repo, '.aoforge', 'REQUIREMENTS.md'), 'utf8')),
    precheck,
    precheck_exit: r.status,
  };
  shared.writeAtomic(file, `${JSON.stringify(inputs, null, 2)}\n`);
  return inputs;
}

/** The checker prompt for one set's cached inputs. */
function checkerPrompt(inputs) {
  return shared.fillTemplate(CHECKER_TEMPLATE, {
    objective_number: inputs.objective,
    'goal from ROADMAP': inputs.goal,
    plan_paths: inputs.planPaths.join('\n'),
    precheck: inputs.precheck,
    objective_req_ids: inputs.reqIds,
    requirements_content: inputs.requirements,
    'context_content or user_preferences': NO_CONTEXT,
  });
}

/**
 * runs({root, trees, calibration}) -> the 36 RunDescriptors of batch B. `root` is required (the pre-check cache);
 * `trees` is R/trees.json's object (or null: this checkout's aof-tools); `calibration` sizes the caps.
 */
function runs({ root, trees = null, calibration = null } = {}) {
  if (typeof root !== 'string' || root === '') {
    throw new TypeError('batch B runs(): an eval root is required (pre-checks are cached under <root>/cache/B)');
  }
  const tool = aofTools(trees);
  const inputs = Object.fromEntries(FIXTURE_IDS.map((id) => [id, setInputs(root, tool, id)]));
  const caps = Object.fromEntries(shared.MODELS.map((model) => [model, capFor({ role: ROLE, model, batch: BATCH, calibration })]));
  return shared.interleave(FIXTURE_IDS, shared.REPEATS).map(({ fixture, model, repeat }, order) => {
    const s = inputs[fixture];
    return {
      id: `${BATCH}-${fixture}-${model}-r${repeat}`,
      batch: BATCH,
      kind: 'agent',
      agent: AGENT,
      model,
      plugin: shared.PLUGIN,
      prompt: checkerPrompt(s),
      tools: null,
      jsonSchema: null,
      capUsd: caps[model].cap,
      capBasis: caps[model].basis,
      timeoutMs: shared.TIMEOUT_MS,
      env: { ...shared.RUN_ENV },
      fixture: { id: fixture, objective: s.objective, objectiveDir: s.objectiveDir, repeat },
      order,
      role: ROLE,
    };
  });
}

/** materialize(desc, workDir) -> builds a fresh copy of the set's repository in workDir (which must be empty). */
function materialize(desc, workDir) {
  buildFixture(desc.fixture.id, workDir);
}

/** collect(desc, workDir, {record}) -> {result_text}: the checker's final message. */
function collect(desc, workDir, { record = null } = {}) {
  return { result_text: isObj(record) && typeof record.result_text === 'string' ? record.result_text : null };
}

module.exports = {
  batch: BATCH,
  runs,
  materialize,
  collect,
  AGENT,
  ROLE,
  RUN_ID,
  FIXTURE_IDS,
  CHECKER_TEMPLATE,
  NO_CONTEXT,
  checkerPrompt,
  aofTools,
};
