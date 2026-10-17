'use strict';

// Tests for scripts/eval81/lib/report.cjs (TRD 81-02, test list 12): the 76-06 report (81-HAIKU-EVAL.md) and the
// per-batch table written beside results/<X>.json. Decisions come from decide() over hand-built batch results
// (__fixtures__/metrics.cjs) and the hand-built tier copies, so no test reads a live file.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const fx = require('../__fixtures__/metrics.cjs');
const { decide } = require('./decide.cjs');

const { km } = fx;

// Loaded per test, so a missing module fails each test with its own name.
const load = () => require('./report.cjs');

const GENERATED_AT = '2026-10-18T09:00:00.000Z';

function reportFor(results) {
  const decisions = decide({ results, profiles: fx.profilesFixture(), packModels: fx.packModelsFixture() });
  return load().renderEvalReport({ decisions, results, generatedAt: GENERATED_AT });
}

describe('renderEvalReport (test list 12)', () => {
  // Verifier refused on the margin (8/9 vs 9/9), codebase-mapper:tech refused on recall (20/40 vs 31/40), C's
  // project-researcher:features missing from the batch, everything else at the fixture defaults.
  function mixed() {
    const results = fx.allResults();
    results.A = fx.aResult({ haiku: { metrics: { detection: km(8, 9) } } });
    results.C = fx.cResult({ roles: { 'codebase-mapper:tech': { haiku: { metrics: { recall: km(20, 40) } } } } });
    delete results.C.roles['project-researcher:features'];
    return results;
  }

  test('each metric as k/n (rate%, 95% CI lo-hi%) per model, with n scored / planned', () => {
    const md = reportFor(mixed());
    assert.match(md, /\| detection \(primary\) \| 8\/9 \(88\.9%, 95% CI 56\.5-98\.0%\) \| 9\/9 \(100\.0%, 95% CI 70\.1-100\.0%\) \|/);
    assert.match(md, /\| false_pass \| 0\/9 \(0\.0%, 95% CI 0\.0-29\.9%\) \| 0\/9 \(0\.0%, 95% CI 0\.0-29\.9%\) \|/);
    assert.match(md, /\| runs scored \/ planned \| 18\/18 \| 18\/18 \|/);
    // A nested split is flattened with its parent's name.
    assert.match(md, /\| detection_split\.judgment_only \| 8\/9 \(88\.9%/);
    // C fabrications are a count per run, not a proportion.
    assert.match(md, /\| fabrications \| 4 in 4 runs \(1\.00 per run\) \| 3 in 4 runs \(0\.75 per run\) \|/);
    assert.match(md, /\| Metric \| Haiku \| Sonnet \|/);
  });

  test('the outcome with its reasons, per role', () => {
    const md = reportFor(mixed());
    assert.match(md, /### verifier \(batch A\): REFUSE/);
    assert.match(md, /- margin: Haiku detection 8\/9 \(88\.9%\) is 11\.1 points below Sonnet 9\/9 \(100\.0%\)/);
    assert.match(md, /### job-checker \(batch B\): WEAK_ENDORSE/);
    assert.match(md, /### project-researcher:features \(batch C\): INSUFFICIENT/);
    assert.match(md, /- role project-researcher:features not in batch C results/);
  });

  test('a summary row per role with the primary metric of both models and the difference', () => {
    const md = reportFor(mixed());
    assert.match(md, /\| verifier \| A \| detection \| 8\/9 \(88\.9%, 95% CI 56\.5-98\.0%\) \| 9\/9 \(100\.0%, 95% CI 70\.1-100\.0%\) \| -11\.1 \| REFUSE \|/);
    assert.match(md, /\| ui-evaluator \| D \| accuracy \| 18\/20 .* \| -5\.0 \| WEAK_ENDORSE \|/);
    assert.match(md, /\| project-researcher:features \| C \| recall \| n\/a \| n\/a \| n\/a \| INSUFFICIENT \|/);
    for (const role of Object.keys(require('./decide.cjs').ROLE_PRIMARY)) {
      assert.match(md, new RegExp(`\\| ${role.replace(/[:-]/g, (c) => `\\${c}`)} \\| [ABCD] \\|`), role);
    }
  });

  test('the A gate, the proposals section, and the statement that no tier was changed', () => {
    const md = reportFor(mixed());
    assert.match(md, /## A gate/);
    assert.match(md, /Haiku false passes in A: 0\/9 \(0\.0%, 95% CI 0\.0-29\.9%\): passed/);
    assert.match(md, /## Proposals/);
    assert.match(md, /- codebase-mapper:tech \(REFUSE\): raise codebase-mapper balanced, budget to sonnet \(model-profiles\.json agents\.codebase-mapper\)/);
    assert.match(md, /- ui-evaluator \(WEAK_ENDORSE\): start ui-evaluator at haiku on budget\/balanced, escalate on split votes \(split rate 15\.0%\)/);
    assert.match(md, /- verifier \(REFUSE\): no proposal\. no profile runs haiku for verifier; the refusal confirms the current tiers/);
    assert.match(md, /- project-researcher:features \(INSUFFICIENT\): no proposal\./);
    assert.match(md, /No tier assignment was changed by objective 81; proposals await the user's decision\.\n$/);
  });

  test('never claims a strong endorsement', () => {
    const md = reportFor(fx.allResults());
    assert.doesNotMatch(md, /strong/i);
    assert.match(md, /small n can refuse but only weakly endorse/);
    const outcomes = [...md.matchAll(/^### .+: ([A-Z_]+)$/gm)].map((m) => m[1]);
    assert.equal(outcomes.length, 11);
    for (const o of outcomes) assert.ok(['REFUSE', 'WEAK_ENDORSE', 'INSUFFICIENT'].includes(o), o);
  });

  test('a failed gate and the spend of each batch are shown', () => {
    const results = { ...fx.allResults(), A: fx.aFalsePass() };
    results.A.spend = { ledger_version: 1, batch: 'A', status: 'complete', spent_usd: 5.25, ledger_total_usd: 5.25,
      entries: [{ id: 'A-1' }, { id: 'A-2' }] };
    const md = reportFor(results);
    assert.match(md, /Haiku false passes in A: 1\/9 \(11\.1%, 95% CI .*\): failed/);
    assert.match(md, /\| A \| complete \| 5\.25 \| 2 \|/);
    assert.match(md, /\| B \| not recorded \| n\/a \| n\/a \|/);
  });

  test('the generation time and the rule file are named', () => {
    const md = reportFor(fx.allResults());
    assert.match(md, /^# Objective 81: Haiku 5\.5 vs Sonnet 5\.5 eval \(76-06\)/);
    assert.match(md, new RegExp(GENERATED_AT.replace(/\./g, '\\.')));
    assert.match(md, /81-DECISION-RULE\.md/);
  });
});

describe('renderBatchTable', () => {
  test('one table per role with every metric per model, exclusions, notes and the spend line', () => {
    const result = fx.aResult({ haiku: { n_scored: 17, metrics: { detection: km(8, 8), false_pass: km(0, 8) } },
      excluded: [{ id: 'A-haiku-A4-r2', reason: 'contaminated' }] });
    result.notes = ['2 runs published no VERIFICATION.md'];
    result.spend = { ledger_version: 1, batch: 'A', status: 'complete', spent_usd: 1.3, ledger_total_usd: 1.7, entries: [] };
    const md = load().renderBatchTable(result);
    assert.match(md, /^# Batch A results/);
    assert.match(md, /## verifier/);
    assert.match(md, /\| Metric \| haiku \| sonnet \|/);
    assert.match(md, /\| runs scored \/ planned \| 17\/18 \| 18\/18 \|/);
    assert.match(md, /\| detection \| 8\/8 \(100\.0%, 95% CI 67\.6-100\.0%\) \| 9\/9 \(100\.0%, 95% CI 70\.1-100\.0%\) \|/);
    assert.match(md, /- A-haiku-A4-r2: contaminated/);
    assert.match(md, /- 2 runs published no VERIFICATION\.md/);
    assert.match(md, /spent \$1\.30 of the batch; ledger total \$1\.70/);
  });

  test('a result without A-D roles (batch E) renders a pointer instead of failing', () => {
    const md = load().renderBatchTable({ batch: 'E', scored_at: 'x', runs: [], excluded: [], notes: [] });
    assert.match(md, /^# Batch E results/);
    assert.match(md, /No per-role model metrics in this result/);
  });

  test('unknown metric shapes are rendered, not dropped', () => {
    const result = fx.batchResult({ batch: 'D', roles: { 'ui-evaluator': fx.roleModels({
      haiku: fx.modelStats({ n_scored: 3, planned: 3, metrics: { accuracy: km(1, 1), note: 'flagged', samples: 3 } }),
      sonnet: fx.modelStats({ n_scored: 3, planned: 3, metrics: { accuracy: km(1, 1) } }),
    }) } });
    const md = load().renderBatchTable(result);
    assert.match(md, /\| note \| flagged \| n\/a \|/);
    assert.match(md, /\| samples \| 3 \| n\/a \|/);
  });
});

describe('formatProportion', () => {
  test('k/n (rate%, 95% CI lo-hi%), and 0/0 (n/a)', () => {
    const { formatProportion } = load();
    assert.equal(formatProportion({ k: 8, n: 9 }), '8/9 (88.9%, 95% CI 56.5-98.0%)');
    assert.equal(formatProportion({ k: 0, n: 0 }), '0/0 (n/a)');
  });
});
