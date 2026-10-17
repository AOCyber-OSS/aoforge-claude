'use strict';
/**
 * Batch E (TRD 81-12; 76-08): the same fixed workload under the 3.0.0 and 3.1.0 plugin trees, on one project.
 *
 * Batch module interface (TRD 81-08): `runs({root, trees, calibration})`, `materialize(desc, workDir, {root, trees,
 * home})`, `collect(desc, workDir, {root, home, record})`.
 *
 * Workload (per version): `/aoforge:quick <QUICK_TEXT>` x3 and `/aoforge:build 1 --skip-research --auto` x2, on the
 * `notekit` project of fixtures/E/build.cjs. Ten runs in this order:
 *
 *   q31-r1 q30-r1 b31-r1 b30-r1 | q30-r2 q31-r2 q31-r3 q30-r3 b30-r2 b31-r2
 *
 * The first two pairs are the pilots (one quick pair, one build pair; TRD 81-17 runs them with `--stop-after 2` twice
 * and stops for the user before the other six). Within each workflow the version order is ABBA-balanced (quick 31, 30,
 * 30, 31, 31, 30; build 31, 30, 30, 31), so cache warmth and time of day do not favour one version.
 *
 * Fairness: the two versions differ in the plugin tree only. Every run of a workflow has the same project bytes, the
 * same prompt, the same session model, the same env flags, cap and timeout (a test strips id, order, plugin and the
 * version fields and finds the rest identical).
 *
 * Session model: SESSION_MODEL = 'opus' (claude-opus-5-5), the model the user's own sessions run, so the measurement
 * is of AOForge as it is used. The project's `model_profile: balanced` puts the planner on opus (inherit) and the
 * executor, verifier and job-checker on sonnet in both versions. The batch-E checkpoint (81-17) shows this choice so
 * the user can switch to sonnet before spending: `EVAL81_E_SESSION_MODEL=sonnet` (or `opus`) in the runner's
 * environment selects it without editing this frozen module; any other value throws. The chosen model is in every
 * descriptor (`model` and `fixture.session_model`) and in the report header. capForWorkflow costs the orchestrator at
 * opus either way, so a sonnet session's cap is conservative.
 *
 * Env: AOFORGE_SKIP_AWARENESS_POPULATE, AOFORGE_SKIP_TRANSCRIPT_EXPORT and AOFORGE_SKIP_PRUNE for both versions
 * (background work with no bearing on the measured tokens). Never AOFORGE_SKIP_EDIT_GATE: workflow skills set their
 * own marker and the gates are part of the measured flow.
 *
 * Caps: capForWorkflow('quick' | 'build') (81-01), with the calibration the runner passes (null -> FALLBACK_P90).
 * Timeouts: quick 30 minutes, build 90 minutes. Role (the ledger's reserve key with the batch): `workflow:quick` /
 * `workflow:build`, so a build's subagent overshoot never inflates a quick run's reserve.
 *
 * Version stamp: the project is stamped 3.0.0 with v3.0.0's migrations, so 3.0.0 sees a current project and 3.1.0's
 * SessionStart upgrade hook stamps it to 3.1.0 and commits `chore(aoforge): upgrade project to v3.1.0` (code only, zero
 * tokens). The 3.1.0 runs' git history includes that commit; the report says so.
 *
 * A 2-TRD build is the target, not a guarantee; the planner decides. collect records the actual TRD count per run.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { validateDescriptor } = require('../lib/contract.cjs');
const { capForWorkflow } = require('../lib/caps.cjs');
const { buildFixture, describeFixture, QUICK_PROMPT, BUILD_PROMPT } = require('../fixtures/E/build.cjs');
const { checkQuick, checkBuild, objectiveOneDirs, frontmatterStatus } = require('../fixtures/E/acceptance.cjs');

const BATCH = 'E';
const SESSION_MODEL = 'opus';
const SESSION_MODELS = ['sonnet', 'opus'];
const SESSION_MODEL_ENV = 'EVAL81_E_SESSION_MODEL';
const PROFILE = 'balanced';
const RUN_ORDER = ['q31-r1', 'q30-r1', 'b31-r1', 'b30-r1', 'q30-r2', 'q31-r2', 'q31-r3', 'q30-r3', 'b30-r2', 'b31-r2'];
const PILOT_IDS = RUN_ORDER.slice(0, 4);
const WORKFLOWS = {
  quick: { prompt: QUICK_PROMPT, timeoutMs: 30 * 60 * 1000 },
  build: { prompt: BUILD_PROMPT, timeoutMs: 90 * 60 * 1000 },
};
const VERSIONS = { 30: '3.0.0', 31: '3.1.0' };
const RUN_ENV = Object.freeze({
  AOFORGE_SKIP_AWARENESS_POPULATE: '1',
  AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
  AOFORGE_SKIP_PRUNE: '1',
});
const UPGRADE_SUBJECT = /^chore\(aoforge\): upgrade project to v/;

/** sessionModel(env) -> 'sonnet' | 'opus' from EVAL81_E_SESSION_MODEL (unset or empty: SESSION_MODEL); else throws. */
function sessionModel(env = process.env) {
  const v = env ? env[SESSION_MODEL_ENV] : undefined;
  if (v === undefined || v === '') return SESSION_MODEL;
  if (!SESSION_MODELS.includes(v)) throw new Error(`${SESSION_MODEL_ENV} must be sonnet or opus, got ${JSON.stringify(v)}`);
  return v;
}

/** parseId('q31-r2') -> {workflow: 'quick', version: '3.1.0', rep: 2}. */
function parseId(id) {
  const m = /^([qb])(30|31)-r(\d+)$/.exec(id);
  if (!m) throw new Error(`batch E: not a run id: ${id}`);
  return { workflow: m[1] === 'q' ? 'quick' : 'build', version: VERSIONS[m[2]], rep: Number(m[3]) };
}

/**
 * runs({root, trees, calibration, rates, env}) -> the ten RunDescriptors in RUN_ORDER.
 * `env` (default process.env) is read only for EVAL81_E_SESSION_MODEL.
 */
function runs({ calibration = null, rates, env = process.env } = {}) {
  const model = sessionModel(env);
  const caps = {
    quick: capForWorkflow({ workflow: 'quick', calibration, rates }),
    build: capForWorkflow({ workflow: 'build', calibration, rates }),
  };
  const project = describeFixture();
  return RUN_ORDER.map((id, order) => {
    const { workflow, version, rep } = parseId(id);
    const desc = {
      id,
      batch: BATCH,
      kind: 'workflow',
      agent: null,
      model,
      plugin: version,
      prompt: WORKFLOWS[workflow].prompt,
      tools: null,
      jsonSchema: null,
      capUsd: caps[workflow].cap,
      capBasis: caps[workflow].basis,
      timeoutMs: WORKFLOWS[workflow].timeoutMs,
      env: { ...RUN_ENV },
      fixture: {
        project: project.name,
        workflow,
        version,
        rep,
        pilot: PILOT_IDS.includes(id),
        session_model: model,
        profile: PROFILE,
      },
      order,
      role: `workflow:${workflow}`,
    };
    const v = validateDescriptor(desc);
    if (!v.ok) throw new Error(`batch E: invalid descriptor ${id}: ${v.errors.join('; ')}`);
    return desc;
  });
}

/** materialize(desc, workDir) -> builds the notekit project (identical bytes for every run) into the empty workDir. */
function materialize(desc, workDir) {
  buildFixture(workDir);
}

function filesMatching(dirs, re) {
  let n = 0;
  for (const d of dirs) {
    let names = [];
    try {
      names = fs.readdirSync(d);
    } catch {
      names = [];
    }
    n += names.filter((name) => re.test(name)).length;
  }
  return n;
}

function quickDirs(workDir) {
  const root = path.join(workDir, '.aoforge', 'quick');
  try {
    return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(root, e.name)).sort();
  } catch {
    return [];
  }
}

function frontmatterStatusOf(file) {
  try {
    return frontmatterStatus(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function gitSubjects(workDir, env) {
  if (!fs.existsSync(workDir)) return null;
  const r = spawnSync('git', ['--no-optional-locks', '-C', workDir, 'log', '--reverse', '--format=%s'], {
    encoding: 'utf8',
    env: { PATH: env.PATH, HOME: env.HOME, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  if (r.status !== 0) return null;
  return r.stdout.split('\n').filter((s) => s !== '');
}

/**
 * collect(desc, workDir, {root, home, record}) -> {acceptance, tests, verification_status, trd_count, summaries,
 * git_log_subjects}. Runs the hidden check for the run's workflow in workDir with HOME = the run's sandbox home (and
 * TMPDIR = the run's tmp dir beside workDir when it exists). Never throws on what a session left behind.
 *   acceptance          {pass, checks[]} from fixtures/E/acceptance.cjs
 *   tests               `node --test` in workDir: {ok, exit, tests, pass, fail, timed_out}
 *   verification_status build: objective 1's VERIFICATION.md status; quick: a quick task's, if any; else null
 *   trd_count           build: `*-TRD.md` in objective 1's dir; quick: `*-JOB.md` (the quick plan) under .aoforge/quick/
 *   summaries           `*-SUMMARY.md` in the same place
 *   git_log_subjects    every commit subject, oldest first (null when the dir is not a repository)
 */
function collect(desc, workDir, { home } = {}) {
  const { workflow } = parseId(desc.id);
  const runTmp = path.join(path.dirname(workDir), 'tmp');
  const env = {
    PATH: process.env.PATH,
    HOME: home || os.tmpdir(),
    TMPDIR: fs.existsSync(runTmp) ? runTmp : os.tmpdir(),
    LC_ALL: 'C',
  };
  let result;
  if (!fs.existsSync(workDir)) {
    result = { pass: false, checks: [{ name: 'work dir exists', pass: false, detail: `missing: ${workDir}` }], tests: null };
  } else {
    try {
      result = workflow === 'quick' ? checkQuick(workDir, env) : checkBuild(workDir, env);
    } catch (err) {
      result = { pass: false, checks: [{ name: 'checks ran', pass: false, detail: err.message }], tests: null };
    }
  }
  const dirs = workflow === 'build' ? objectiveOneDirs(workDir) : quickDirs(workDir);
  let verification = null;
  if (workflow === 'build') {
    verification = result.verification_status === undefined ? null : result.verification_status;
  } else {
    const files = [];
    for (const d of dirs) for (const name of fs.readdirSync(d).sort()) if (/VERIFICATION\.md$/.test(name)) files.push(path.join(d, name));
    verification = files.length ? frontmatterStatusOf(files[files.length - 1]) : null;
  }
  return {
    acceptance: { pass: result.pass, checks: result.checks },
    tests: result.tests || { ok: false, exit: null, tests: null, pass: null, fail: null, timed_out: false },
    verification_status: verification,
    trd_count: filesMatching(dirs, workflow === 'build' ? /-TRD\.md$/ : /-JOB\.md$/),
    summaries: filesMatching(dirs, /-SUMMARY\.md$/),
    git_log_subjects: gitSubjects(workDir, env),
  };
}

module.exports = {
  batch: BATCH,
  runs,
  materialize,
  collect,
  sessionModel,
  parseId,
  SESSION_MODEL,
  SESSION_MODELS,
  SESSION_MODEL_ENV,
  PROFILE,
  RUN_ORDER,
  PILOT_IDS,
  RUN_ENV,
  UPGRADE_SUBJECT,
};
