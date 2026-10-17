'use strict';

// Hand-built batch result objects for the objective-81 decision tests (TRD 81-02).
//
// A batch result is the contract between the batch scorers (scripts/eval81/score/<X>.cjs, TRDs 81-09..81-12) and
// decide()/report.cjs:
//
//   { batch: 'A', scored_at, planned: {haiku: 18, sonnet: 18},
//     roles: { verifier: { primary: 'detection', models: {
//         haiku:  { n_scored, planned?, metrics: { detection: {k, n}, false_pass: {k, n}, ... },
//                   cost_usd, mean_wall_ms },
//         sonnet: { ... } } } },
//     runs: [ { id, model, fixture, verdict, outcome, contaminated, role? } ],
//     excluded: [ { id, reason, model?, role? } ], notes: [] }
//
// Every number below is a literal chosen so its rate can be checked by hand; nothing is generated. The comments give
// the rates the tests rely on.

/** km(k, n) -> {k, n}: one proportion. */
function km(k, n) {
  return { k, n };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** merge(base, over): a deep copy of base with over's keys laid on top (plain objects merge, the rest replace). */
function merge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? clone(base) : clone(over);
  const out = clone(base);
  for (const [key, value] of Object.entries(over)) {
    out[key] = key in out ? merge(out[key], value) : clone(value);
  }
  return out;
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** modelStats({...}) -> one model's entry under roles.<role>.models. */
function modelStats({ n_scored, planned, metrics, cost_usd = null, mean_wall_ms = null }) {
  const out = { n_scored, metrics: clone(metrics), cost_usd, mean_wall_ms };
  if (planned !== undefined) out.planned = planned;
  return out;
}

/** roleModels({haiku, sonnet, primary}) -> one entry under roles. */
function roleModels({ haiku, sonnet, primary }) {
  const out = { models: { haiku: clone(haiku), sonnet: clone(sonnet) } };
  if (primary !== undefined) out.primary = primary;
  return out;
}

/** batchResult({batch, roles, ...}) -> a whole batch result object. */
function batchResult({ batch, roles, planned = { haiku: 18, sonnet: 18 }, runs = [], excluded = [], notes = [],
  scored_at = '2026-10-17T12:00:00.000Z' }) {
  return { batch, scored_at, planned: clone(planned), roles: clone(roles), runs: clone(runs),
    excluded: clone(excluded), notes: clone(notes) };
}

// --- A: verifier, 9 clean + 9 planted runs per model -------------------------------------------------------------
// Defaults: detection 9/9 (100%) for both, false_pass 0/9, false_fail 0/9, abstain 0/18, detected_unnamed 0/9.

function aModel(over = {}) {
  return merge(modelStats({
    n_scored: 18,
    metrics: { detection: km(9, 9), false_pass: km(0, 9), false_fail: km(0, 9), abstain: km(0, 18),
      detected_unnamed: km(0, 9) },
    cost_usd: 4.5,
    mean_wall_ms: 120000,
  }), over);
}

/** aResult({haiku, sonnet, excluded, runs}) -> batch A with per-model overrides. */
function aResult({ haiku = {}, sonnet = {}, excluded = [], runs = [], planned } = {}) {
  return batchResult({
    batch: 'A',
    planned: planned || { haiku: 18, sonnet: 18 },
    roles: { verifier: roleModels({ primary: 'detection', haiku: aModel(haiku), sonnet: aModel(merge({ cost_usd: 9 }, sonnet)) }) },
    runs,
    excluded,
  });
}

/** aPass(): zero Haiku false passes, detection 9/9 vs 9/9 (0 points). */
function aPass() {
  return aResult();
}

/** aFalsePass(): Haiku passed 1 of 9 planted runs (false_pass 1/9 = 11.1%), so detection 8/9. */
function aFalsePass() {
  return aResult({ haiku: { metrics: { false_pass: km(1, 9), detection: km(8, 9) } } });
}

// --- B: job-checker, 6 clean + 12 planted runs per model ---------------------------------------------------------
// Defaults: detection haiku 11/12 (91.7%) vs sonnet 12/12 (100%) = -8.3 points (within 10).
// detection_split: precheck-flagged 3/3 for both; judgment-only haiku 8/9, sonnet 9/9.

function bModel(over = {}) {
  return merge(modelStats({
    n_scored: 18,
    metrics: { detection: km(12, 12), false_alarm: km(0, 6), missed_as_pass: km(0, 12),
      detection_split: { precheck_flagged: km(3, 3), judgment_only: km(9, 9) } },
    cost_usd: 3,
    mean_wall_ms: 90000,
  }), over);
}

function bResult({ haiku = {}, sonnet = {}, excluded = [], runs = [] } = {}) {
  const h = merge({ metrics: { detection: km(11, 12), missed_as_pass: km(1, 12),
    detection_split: { judgment_only: km(8, 9) } }, cost_usd: 1 }, haiku);
  const s = merge({ metrics: { false_alarm: km(1, 6) } }, sonnet);
  return batchResult({
    batch: 'B',
    roles: { 'job-checker': roleModels({ primary: 'detection', haiku: bModel(h), sonnet: bModel(s) }) },
    runs,
    excluded,
  });
}

// --- D: UI judge, 20 labelled states (10 broken, 10 ok) x 3 samples per model --------------------------------------
// Defaults: accuracy haiku 18/20 (90%) vs sonnet 19/20 (95%) = -5 points; split_rate haiku 3/20 (15.0%), sonnet 2/20.

function dModel(over = {}) {
  return merge(modelStats({
    n_scored: 60,
    metrics: { accuracy: km(19, 20), broken_missed: km(0, 10), split_rate: km(2, 20), engine_escalations: km(1, 10) },
    cost_usd: 1.2,
    mean_wall_ms: 15000,
  }), over);
}

function dResult({ haiku = {}, sonnet = {}, excluded = [], runs = [] } = {}) {
  const h = merge({ metrics: { accuracy: km(18, 20), broken_missed: km(1, 10), split_rate: km(3, 20),
    engine_escalations: km(2, 10) }, cost_usd: 0.3 }, haiku);
  return batchResult({
    batch: 'D',
    planned: { haiku: 60, sonnet: 60 },
    roles: { 'ui-evaluator': roleModels({ primary: 'accuracy', haiku: dModel(h), sonnet: dModel(sonnet) }) },
    runs,
    excluded,
  });
}

// --- C: codebase-mapper (4 foci x 2 codebases x 2 repeats) and project-researcher (4 dimensions x 2 repeats) -----
// Mapper roles: 4 planned runs per model, 10 items per run (n = 40). recall haiku 28/40 (0.70) vs sonnet 31/40
//   (0.775) = -7.5 points; fabrications haiku 4/4 runs (1.0 per run) vs sonnet 3/4 (0.75) = +0.25.
// Researcher roles: 2 planned runs per model, 8 items per run (n = 16). recall haiku 12/16 (0.75) vs sonnet 13/16
//   (0.8125) = -6.25 points; fabrications haiku 2/2 (1.0) vs sonnet 1/2 (0.5) = +0.5 (the bound, still within).

const MAPPER_FOCI = ['tech', 'arch', 'quality', 'concerns'];
const RESEARCH_DIMENSIONS = ['stack', 'features', 'architecture', 'pitfalls'];
const C_ROLES = [
  ...MAPPER_FOCI.map((f) => `codebase-mapper:${f}`),
  ...RESEARCH_DIMENSIONS.map((d) => `project-researcher:${d}`),
];

function mapperModels() {
  return {
    haiku: modelStats({ n_scored: 4, planned: 4, metrics: { recall: km(28, 40), error: km(4, 40),
      missing: km(8, 40), fabrications: { total: 4, runs: 4 } }, cost_usd: 0.8, mean_wall_ms: 200000 }),
    sonnet: modelStats({ n_scored: 4, planned: 4, metrics: { recall: km(31, 40), error: km(3, 40),
      missing: km(6, 40), fabrications: { total: 3, runs: 4 } }, cost_usd: 2.4, mean_wall_ms: 240000 }),
  };
}

function researcherModels() {
  return {
    haiku: modelStats({ n_scored: 2, planned: 2, metrics: { recall: km(12, 16), error: km(1, 16),
      missing: km(3, 16), fabrications: { total: 2, runs: 2 } }, cost_usd: 0.6, mean_wall_ms: 300000 }),
    sonnet: modelStats({ n_scored: 2, planned: 2, metrics: { recall: km(13, 16), error: km(1, 16),
      missing: km(2, 16), fabrications: { total: 1, runs: 2 } }, cost_usd: 1.8, mean_wall_ms: 330000 }),
  };
}

/** cResult({roles: {<role>: {haiku: {...}, sonnet: {...}}}, excluded, runs}) -> batch C with per-role overrides. */
function cResult({ roles = {}, excluded = [], runs = [] } = {}) {
  const built = {};
  for (const role of C_ROLES) {
    const base = role.startsWith('codebase-mapper:') ? mapperModels() : researcherModels();
    const over = roles[role] || {};
    built[role] = roleModels({ primary: 'recall', haiku: merge(base.haiku, over.haiku || {}),
      sonnet: merge(base.sonnet, over.sonnet || {}) });
  }
  return batchResult({ batch: 'C', planned: { haiku: 24, sonnet: 24 }, roles: built, runs, excluded });
}

// --- Current tiers (a hand-built copy of the shapes decide() reads) ----------------------------------------------
// The tests use these literals rather than the live files, so a later tier change does not move a test. The values
// are the tiers on 2026-10-17 (model-profiles.json and the flutter pack's models.ui-evaluator).

function profilesFixture() {
  return {
    agents: {
      'objective-researcher': { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
      'project-researcher': { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
      'codebase-mapper': { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' },
      verifier: { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet' },
      'job-checker': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet' },
    },
    focus: {
      'codebase-mapper': { concerns: { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' } },
      'project-researcher': {
        pitfalls: { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
        architecture: { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
      },
    },
    verdict_floor: { tier: 'sonnet', agents: ['verifier', 'job-checker'] },
  };
}

function packModelsFixture() {
  return { 'ui-evaluator': { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' } };
}

/** allResults(): A, B, C and D at their defaults, each of which passes the rule on its own. */
function allResults() {
  return { A: aPass(), B: bResult(), C: cResult(), D: dResult() };
}

module.exports = {
  km,
  merge,
  modelStats,
  roleModels,
  batchResult,
  aResult,
  aPass,
  aFalsePass,
  bResult,
  dResult,
  cResult,
  allResults,
  profilesFixture,
  packModelsFixture,
  C_ROLES,
  MAPPER_FOCI,
  RESEARCH_DIMENSIONS,
};
