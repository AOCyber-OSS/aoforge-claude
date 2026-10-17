'use strict';

// Tests for scripts/eval81/lib/decide.cjs (TRD 81-02, test list 4-9): the pre-registered decision rule of
// 81-DECISION-RULE.md applied per role, and the proposals it turns into. Where a test quotes the rule doc, the doc
// wins: a disagreement is fixed in decide.cjs, never in the doc.
//
// Inputs are hand-built literals from __fixtures__/metrics.cjs; the tiers are a hand-built copy of today's
// model-profiles.json and flutter pack shapes (profilesFixture, packModelsFixture), so no test reads a live file.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fx = require('../__fixtures__/metrics.cjs');

const { km } = fx;

// Loaded per test, so a missing module fails each test with its own name.
const load = () => require('./decide.cjs');

function run(results, { profiles = fx.profilesFixture(), packModels = fx.packModelsFixture() } = {}) {
  return load().decide({ results, profiles, packModels });
}

const reasonsOf = (d, role) => d.roles[role].reasons.join(' | ');

describe('constants', () => {
  test('three outcomes and no strong endorsement', () => {
    const { OUTCOMES } = load();
    assert.deepEqual(OUTCOMES, ['REFUSE', 'WEAK_ENDORSE', 'INSUFFICIENT']);
  });

  test('the pre-registered thresholds and primary metrics', () => {
    const { MARGIN, MIN_SCORED_SHARE, SONNET_FLOOR, FAB_MARGIN, ROLE_PRIMARY } = load();
    assert.equal(MARGIN, 0.10);
    assert.equal(MIN_SCORED_SHARE, 2 / 3);
    assert.equal(SONNET_FLOOR, 0.5);
    assert.equal(FAB_MARGIN, 0.5);
    assert.equal(ROLE_PRIMARY.verifier, 'detection');
    assert.equal(ROLE_PRIMARY['job-checker'], 'detection');
    assert.equal(ROLE_PRIMARY['ui-evaluator'], 'accuracy');
    for (const role of fx.C_ROLES) assert.equal(ROLE_PRIMARY[role], 'recall', role);
    assert.equal(Object.keys(ROLE_PRIMARY).length, 11);
  });
});

describe('margin (test list 4)', () => {
  test('Haiku 0/9 false passes, detection 8/9 vs 9/9 (-11.1 points) -> verifier REFUSE naming the margin', () => {
    const results = { ...fx.allResults(), A: fx.aResult({ haiku: { metrics: { detection: km(8, 9) } } }) };
    const d = run(results);
    assert.equal(d.roles.verifier.outcome, 'REFUSE');
    assert.match(d.roles.verifier.reasons[0], /^margin: /);
    assert.match(d.roles.verifier.reasons[0], /11\.1 points below/);
    assert.equal(d.roles.verifier.diff_points, -0.111111111);
    // The gate held (zero false passes), so the other roles still pass.
    assert.equal(d.gate.status, 'passed');
    assert.equal(d.roles['job-checker'].outcome, 'WEAK_ENDORSE');
  });

  test('9/9 vs 9/9 -> WEAK_ENDORSE, with "weak" in the reason', () => {
    const d = run(fx.allResults());
    assert.equal(d.roles.verifier.outcome, 'WEAK_ENDORSE');
    assert.equal(d.roles.verifier.diff_points, 0);
    assert.match(reasonsOf(d, 'verifier'), /weak endorsement only/);
  });

  test('exactly 10 points below is within the margin (rule doc section 6, choice 3: "exactly 10 points below counting as within")', () => {
    // haiku 7/10 = 0.70 vs sonnet 8/10 = 0.80: 0.7 - 0.8 is -0.10000000000000009 in floats, -0.1 once rounded.
    const results = { ...fx.allResults(),
      B: fx.bResult({ haiku: { metrics: { detection: km(7, 10) } }, sonnet: { metrics: { detection: km(8, 10) } } }) };
    const d = run(results);
    assert.equal(d.roles['job-checker'].diff_points, -0.1);
    assert.equal(d.roles['job-checker'].outcome, 'WEAK_ENDORSE');
  });

  test('Haiku above Sonnet is within the margin', () => {
    const results = { ...fx.allResults(),
      D: fx.dResult({ haiku: { metrics: { accuracy: km(20, 20) } } }) };
    const d = run(results);
    assert.equal(d.roles['ui-evaluator'].outcome, 'WEAK_ENDORSE');
    assert.equal(d.roles['ui-evaluator'].diff_points, 0.05);
  });
});

describe('the A gate (test list 5)', () => {
  test('Haiku 1/9 false pass in A -> every role REFUSE with "A false pass", even where its own metric passes', () => {
    const results = { ...fx.allResults(), A: fx.aFalsePass() };
    const d = run(results);
    assert.equal(d.gate.status, 'failed');
    assert.deepEqual(d.gate.a_false_pass, { k: 1, n: 9 });
    const roles = Object.keys(d.roles);
    assert.equal(roles.length, 11);
    for (const role of roles) {
      assert.equal(d.roles[role].outcome, 'REFUSE', role);
      assert.match(d.roles[role].reasons[0], /^A false pass: /, role);
    }
    // B, D and the C roles pass their own margins; the gate alone refuses them.
    assert.equal(d.roles['job-checker'].diff_points > -0.1, true);
  });

  test('a role whose own batch is missing stays INSUFFICIENT (the missing-batch check runs first)', () => {
    const { C, ...rest } = fx.allResults();
    const d = run({ ...rest, A: fx.aFalsePass() });
    assert.equal(d.roles['codebase-mapper:tech'].outcome, 'INSUFFICIENT');
    assert.equal(d.roles['job-checker'].outcome, 'REFUSE');
  });

  test('no batch A: the gate is not established, so a passing role is INSUFFICIENT (choice 6)', () => {
    const { A, ...rest } = fx.allResults();
    const d = run(rest);
    assert.equal(d.gate.status, 'unestablished');
    assert.equal(d.gate.a_false_pass, null);
    assert.equal(d.roles.verifier.outcome, 'INSUFFICIENT');
    assert.equal(d.roles['job-checker'].outcome, 'INSUFFICIENT');
    assert.match(reasonsOf(d, 'job-checker'), /A gate not established: batch A not run/);
  });

  test('no batch A: a role failing its own margin is still REFUSE (refusals stand)', () => {
    const { A, ...rest } = fx.allResults();
    rest.B = fx.bResult({ haiku: { metrics: { detection: km(6, 12) } } });
    const d = run(rest);
    assert.equal(d.roles['job-checker'].outcome, 'REFUSE');
    assert.match(d.roles['job-checker'].reasons[0], /^margin: /);
  });

  test('Haiku scored under 2/3 of its A runs with zero false passes: gate not established', () => {
    const results = { ...fx.allResults(), A: fx.aResult({ haiku: { n_scored: 11 } }) };
    const d = run(results);
    assert.equal(d.gate.status, 'unestablished');
    assert.match(d.gate.reason, /11 of 18/);
    assert.equal(d.roles['ui-evaluator'].outcome, 'INSUFFICIENT');
  });

  test('a false pass refuses even when Haiku scored under 2/3 of A (a false pass is a false pass)', () => {
    const results = { ...fx.allResults(),
      A: fx.aResult({ haiku: { n_scored: 11, metrics: { false_pass: km(1, 5), detection: km(4, 5) } } }) };
    const d = run(results);
    assert.equal(d.gate.status, 'failed');
    assert.equal(d.roles.verifier.outcome, 'INSUFFICIENT', 'the verifier role fails its own scored-share check first');
    assert.equal(d.roles['job-checker'].outcome, 'REFUSE');
  });
});

describe('INSUFFICIENT (test list 6)', () => {
  test('Haiku scored 10 of 18 planned (< 2/3) -> INSUFFICIENT', () => {
    const results = { ...fx.allResults(), B: fx.bResult({ haiku: { n_scored: 10 } }) };
    const d = run(results);
    assert.equal(d.roles['job-checker'].outcome, 'INSUFFICIENT');
    assert.match(d.roles['job-checker'].reasons[0], /haiku scored 10 of 18 planned runs \(below 2\/3\)/);
  });

  test('exactly 2/3 scored (12 of 18) is enough', () => {
    const results = { ...fx.allResults(), B: fx.bResult({ sonnet: { n_scored: 12 } }) };
    assert.equal(run(results).roles['job-checker'].outcome, 'WEAK_ENDORSE');
  });

  test('Sonnet detection 4/9 (< 0.5) -> INSUFFICIENT "comparison not informative"', () => {
    const results = { ...fx.allResults(), A: fx.aResult({ sonnet: { metrics: { detection: km(4, 9) } } }) };
    const d = run(results);
    assert.equal(d.roles.verifier.outcome, 'INSUFFICIENT');
    assert.match(d.roles.verifier.reasons[0], /^comparison not informative: Sonnet detection 4\/9 \(44\.4%\) is below 50%/);
  });

  test('the Sonnet floor runs before the A gate', () => {
    const results = { ...fx.allResults(), A: fx.aFalsePass(),
      D: fx.dResult({ sonnet: { metrics: { accuracy: km(9, 20) } } }) };
    const d = run(results);
    assert.equal(d.roles['ui-evaluator'].outcome, 'INSUFFICIENT');
    assert.match(d.roles['ui-evaluator'].reasons[0], /comparison not informative/);
  });

  test('a missing batch -> INSUFFICIENT "batch X not run" for each of its roles', () => {
    const { C, ...rest } = fx.allResults();
    const d = run(rest);
    for (const role of fx.C_ROLES) {
      assert.equal(d.roles[role].outcome, 'INSUFFICIENT', role);
      assert.deepEqual(d.roles[role].reasons, ['batch C not run'], role);
    }
  });

  test('a role absent from its batch results -> INSUFFICIENT naming the role', () => {
    const results = fx.allResults();
    delete results.C.roles['project-researcher:features'];
    const d = run(results);
    assert.equal(d.roles['project-researcher:features'].outcome, 'INSUFFICIENT');
    assert.match(reasonsOf(d, 'project-researcher:features'), /role project-researcher:features not in batch C results/);
  });

  test('a primary metric with n = 0 -> INSUFFICIENT', () => {
    const results = { ...fx.allResults(), D: fx.dResult({ haiku: { metrics: { accuracy: km(0, 0) } } }) };
    const d = run(results);
    assert.equal(d.roles['ui-evaluator'].outcome, 'INSUFFICIENT');
    assert.match(reasonsOf(d, 'ui-evaluator'), /haiku accuracy has no scored items/);
  });

  test('planned is read per model, then per role, then per batch', () => {
    const results = fx.allResults();
    // Role-level planned (per model) without a model-level one.
    const role = results.C.roles['codebase-mapper:arch'];
    delete role.models.haiku.planned;
    delete role.models.sonnet.planned;
    role.planned = { haiku: 6, sonnet: 6 };
    // 4 of 6 = 2/3 -> enough.
    assert.equal(run(results).roles['codebase-mapper:arch'].outcome, 'WEAK_ENDORSE');
    role.planned = { haiku: 7, sonnet: 6 };
    const d = run(results);
    assert.equal(d.roles['codebase-mapper:arch'].outcome, 'INSUFFICIENT');
    assert.match(reasonsOf(d, 'codebase-mapper:arch'), /haiku scored 4 of 7/);
  });
});

describe('C roles: recall margin and fabrication bound (test list 7)', () => {
  const role = 'project-researcher:stack';
  const cWith = (haikuFab) => fx.cResult({ roles: { [role]: {
    haiku: { n_scored: 10, planned: 10, metrics: { recall: km(35, 50), fabrications: haikuFab } },
    sonnet: { n_scored: 10, planned: 10, metrics: { recall: km(39, 50), fabrications: { total: 8, runs: 10 } } },
  } } });

  test('recall 0.70 vs 0.78 and fabrications/run 1.0 vs 0.8 -> WEAK_ENDORSE', () => {
    const d = run({ ...fx.allResults(), C: cWith({ total: 10, runs: 10 }) });
    assert.equal(d.roles[role].outcome, 'WEAK_ENDORSE');
    assert.equal(d.roles[role].diff_points, -0.08);
    assert.equal(d.roles[role].fab_diff, 0.2);
  });

  test('fabrications 1.5 vs 0.8 (> +0.5) -> REFUSE naming the fabrications', () => {
    const d = run({ ...fx.allResults(), C: cWith({ total: 15, runs: 10 }) });
    assert.equal(d.roles[role].outcome, 'REFUSE');
    assert.match(d.roles[role].reasons[0], /^fabrications: Haiku 1\.50 per run vs Sonnet 0\.80 \(\+0\.70, above \+0\.50\)/);
  });

  test('exactly +0.5 fabrications per run is within the bound (researcher default 1.0 vs 0.5)', () => {
    const d = run(fx.allResults());
    assert.equal(d.roles['project-researcher:features'].fab_diff, 0.5);
    assert.equal(d.roles['project-researcher:features'].outcome, 'WEAK_ENDORSE');
  });

  test('recall more than 10 points below -> REFUSE on the margin', () => {
    const results = { ...fx.allResults(),
      C: fx.cResult({ roles: { 'codebase-mapper:quality': { haiku: { metrics: { recall: km(26, 40) } } } } }) };
    const d = run(results);
    // 26/40 = 0.65 vs 31/40 = 0.775: -12.5 points.
    assert.equal(d.roles['codebase-mapper:quality'].outcome, 'REFUSE');
    assert.match(d.roles['codebase-mapper:quality'].reasons[0], /12\.5 points below/);
  });

  test('a missing fabrication count -> INSUFFICIENT', () => {
    const results = fx.allResults();
    delete results.C.roles['codebase-mapper:tech'].models.sonnet.metrics.fabrications;
    const d = run(results);
    assert.equal(d.roles['codebase-mapper:tech'].outcome, 'INSUFFICIENT');
    assert.match(reasonsOf(d, 'codebase-mapper:tech'), /sonnet fabrications not reported/);
  });

  test('the fabrication bound does not apply outside C', () => {
    const results = fx.allResults();
    results.B.roles['job-checker'].models.haiku.metrics.fabrications = { total: 9, runs: 1 };
    assert.equal(run(results).roles['job-checker'].outcome, 'WEAK_ENDORSE');
  });
});

describe('contamination (test list 8)', () => {
  test('excluded runs are not in n and are named in the reasons', () => {
    // One contaminated planted Haiku run: the scorer reports 17 scored and planted n 8.
    const A = fx.aResult({
      haiku: { n_scored: 17, metrics: { detection: km(8, 8), false_pass: km(0, 8) } },
      excluded: [{ id: 'A-haiku-A4-r2', reason: 'contaminated', model: 'haiku' }],
      runs: [{ id: 'A-haiku-A4-r2', model: 'haiku', fixture: 'A4', verdict: 'gaps_found', outcome: 'detected',
        contaminated: true }],
    });
    const d = run({ ...fx.allResults(), A });
    const v = d.roles.verifier;
    assert.equal(v.outcome, 'WEAK_ENDORSE');
    assert.equal(v.haiku.metrics.detection.n, 8);
    assert.equal(v.haiku.n_scored, 17);
    assert.match(reasonsOf(d, 'verifier'), /excluded \(not in n\): A-haiku-A4-r2 \(contaminated\)/);
  });

  test('exclusions push a model under 2/3 -> INSUFFICIENT, and the exclusions are still named', () => {
    const A = fx.aResult({
      sonnet: { n_scored: 11 },
      excluded: ['A-s-1', 'A-s-2', 'A-s-3', 'A-s-4', 'A-s-5', 'A-s-6', 'A-s-7'].map((id) => ({ id, reason: 'contaminated' })),
    });
    const d = run({ ...fx.allResults(), A });
    assert.equal(d.roles.verifier.outcome, 'INSUFFICIENT');
    assert.match(reasonsOf(d, 'verifier'), /sonnet scored 11 of 18/);
    assert.match(reasonsOf(d, 'verifier'), /A-s-7 \(contaminated\)/);
  });

  test('a contaminated run left in runs without an exclusion -> INSUFFICIENT (choice 8)', () => {
    const B = fx.bResult({ runs: [{ id: 'B-haiku-B2-r1', model: 'haiku', fixture: 'B2', verdict: 'ISSUES FOUND',
      outcome: 'detected', contaminated: true }] });
    const d = run({ ...fx.allResults(), B });
    assert.equal(d.roles['job-checker'].outcome, 'INSUFFICIENT');
    assert.match(d.roles['job-checker'].reasons[0], /contaminated run counted in n: B-haiku-B2-r1/);
  });

  test('an exclusion with a role is named only in that role; one without a role in every role of the batch', () => {
    const C = fx.cResult({ excluded: [
      { id: 'C-haiku-arch-fleet-r1', reason: 'contaminated', role: 'codebase-mapper:arch' },
      { id: 'C-sonnet-grader-7', reason: 'status:cap_hit' },
    ] });
    const d = run({ ...fx.allResults(), C });
    assert.match(reasonsOf(d, 'codebase-mapper:arch'), /C-haiku-arch-fleet-r1 \(contaminated\)/);
    assert.doesNotMatch(reasonsOf(d, 'codebase-mapper:tech'), /C-haiku-arch-fleet-r1/);
    for (const role of fx.C_ROLES) assert.match(reasonsOf(d, role), /C-sonnet-grader-7 \(status:cap_hit\)/, role);
  });
});

describe('proposals (test list 9)', () => {
  test('codebase-mapper:tech REFUSE while balanced and budget are haiku -> "raise codebase-mapper balanced, budget to sonnet"', () => {
    const results = { ...fx.allResults(),
      C: fx.cResult({ roles: { 'codebase-mapper:tech': { haiku: { metrics: { recall: km(20, 40) } } } } }) };
    const r = run(results).roles['codebase-mapper:tech'];
    assert.equal(r.outcome, 'REFUSE');
    assert.equal(r.proposal.text, 'raise codebase-mapper balanced, budget to sonnet');
    assert.equal(r.proposal.target, 'model-profiles.json agents.codebase-mapper');
    assert.deepEqual(r.proposal.profiles, ['balanced', 'budget']);
    assert.equal(r.proposal.to, 'sonnet');
    assert.match(r.note, /shared by every codebase-mapper focus without an override/);
  });

  test('a focus override is read first: codebase-mapper:concerns REFUSE -> raise only its budget', () => {
    const results = { ...fx.allResults(),
      C: fx.cResult({ roles: { 'codebase-mapper:concerns': { haiku: { metrics: { recall: km(20, 40) } } } } }) };
    const r = run(results).roles['codebase-mapper:concerns'];
    assert.equal(r.proposal.text, 'raise codebase-mapper focus concerns budget to sonnet');
    assert.equal(r.proposal.target, 'model-profiles.json focus.codebase-mapper.concerns');
  });

  test('ui-evaluator WEAK_ENDORSE -> start at haiku on budget/balanced, escalate on split votes (split rate X)', () => {
    const r = run(fx.allResults()).roles['ui-evaluator'];
    assert.equal(r.outcome, 'WEAK_ENDORSE');
    assert.equal(r.proposal.text,
      'start ui-evaluator at haiku on budget/balanced, escalate on split votes (split rate 15.0%)');
    assert.equal(r.proposal.target, 'aoforge-stack.json models.ui-evaluator');
  });

  test('the same ui-evaluator proposal when every profile starts sonnet', () => {
    const packModels = { 'ui-evaluator': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet' } };
    const r = run(fx.allResults(), { packModels }).roles['ui-evaluator'];
    assert.equal(r.proposal.text,
      'start ui-evaluator at haiku on budget/balanced, escalate on split votes (split rate 15.0%)');
  });

  test('verifier WEAK_ENDORSE -> no lowering proposal, note "verdict_floor keeps sonnet; evidence weakly supports haiku"', () => {
    const r = run(fx.allResults()).roles.verifier;
    assert.equal(r.outcome, 'WEAK_ENDORSE');
    assert.equal(r.proposal, null);
    assert.equal(r.note, 'verdict_floor keeps sonnet; evidence weakly supports haiku');
    assert.equal(run(fx.allResults()).roles['job-checker'].proposal, null);
  });

  test('INSUFFICIENT -> no proposal', () => {
    const { C, ...rest } = fx.allResults();
    const r = run(rest).roles['codebase-mapper:tech'];
    assert.equal(r.outcome, 'INSUFFICIENT');
    assert.equal(r.proposal, null);
  });

  test('REFUSE where no profile runs haiku -> no proposal, the refusal confirms the current tiers', () => {
    const results = { ...fx.allResults(), A: fx.aFalsePass() };
    const r = run(results).roles.verifier;
    assert.equal(r.proposal, null);
    assert.match(r.note, /no profile runs haiku for verifier; the refusal confirms the current tiers/);
  });

  test('other roles: WEAK_ENDORSE proposes the budget profile only, or notes an existing haiku tier', () => {
    const d = run(fx.allResults());
    assert.equal(d.roles['project-researcher:pitfalls'].proposal.text,
      'lower project-researcher focus pitfalls budget to haiku (weak endorsement; quality and balanced unchanged)');
    assert.equal(d.roles['project-researcher:stack'].proposal, null);
    assert.match(d.roles['project-researcher:stack'].note, /project-researcher already runs haiku on budget/);
  });

  test('proposalsFor is exported and reads only what it is given', () => {
    const { proposalsFor } = load();
    const out = proposalsFor('REFUSE', 'codebase-mapper:tech', fx.profilesFixture(), fx.packModelsFixture());
    assert.equal(out.proposal.text, 'raise codebase-mapper balanced, budget to sonnet');
    assert.deepEqual(proposalsFor('INSUFFICIENT', 'verifier', fx.profilesFixture(), fx.packModelsFixture()),
      { proposal: null, note: null });
    const none = proposalsFor('REFUSE', 'codebase-mapper:tech', null, null);
    assert.equal(none.proposal, null);
    assert.match(none.note, /current tiers not available/);
  });
});

describe('decide() shape and purity', () => {
  test('every role in the fixed order, every outcome in OUTCOMES; E is ignored', () => {
    const { decide, OUTCOMES, ROLE_PRIMARY } = load();
    const results = { ...fx.allResults(), E: { batch: 'E', roles: { orchestrator: {} } } };
    const d = decide({ results, profiles: fx.profilesFixture(), packModels: fx.packModelsFixture() });
    assert.deepEqual(Object.keys(d.roles), Object.keys(ROLE_PRIMARY));
    for (const r of Object.values(d.roles)) {
      assert.ok(OUTCOMES.includes(r.outcome), r.role);
      assert.notEqual(r.batch, 'E');
    }
  });

  test('a role not pre-registered is reported INSUFFICIENT, never decided', () => {
    const results = fx.allResults();
    results.B.roles['plan-checker'] = results.B.roles['job-checker'];
    const d = run(results);
    assert.equal(d.roles['plan-checker'].outcome, 'INSUFFICIENT');
    assert.match(reasonsOf(d, 'plan-checker'), /not pre-registered/);
  });

  test('model views carry Wilson intervals per metric', () => {
    const v = run(fx.allResults()).roles.verifier.haiku;
    assert.equal(v.primary.k, 9);
    assert.equal(v.primary.high, 1);
    assert.equal(v.planned, 18);
    assert.ok(v.metrics.false_pass.low === 0 && v.metrics.false_pass.high > 0.29);
    const b = run(fx.allResults()).roles['job-checker'].haiku;
    assert.equal(b.metrics.detection_split.judgment_only.k, 8);
    const c = run(fx.allResults()).roles['codebase-mapper:tech'].haiku;
    assert.deepEqual(c.metrics.fabrications, { total: 4, runs: 4, per_run: 1 });
  });

  test('decide() does not mutate its inputs', () => {
    const results = fx.allResults();
    const profiles = fx.profilesFixture();
    const packModels = fx.packModelsFixture();
    const before = JSON.stringify({ results, profiles, packModels });
    load().decide({ results, profiles, packModels });
    assert.equal(JSON.stringify({ results, profiles, packModels }), before);
  });

  test('decide.cjs never touches the file system (proposals are text)', () => {
    const src = fs.readFileSync(path.join(__dirname, 'decide.cjs'), 'utf8');
    assert.doesNotMatch(src, /require\(['"](node:)?fs['"]\)/);
  });
});
