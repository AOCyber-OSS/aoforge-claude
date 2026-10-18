'use strict';
// TRD 82-06 test list 7-11: objective 82's pre-registered rules as code (82-CHECK-RULES.md sections 1-4). Every
// result here is hand-built, except the recorded objective-81 extracts in __fixtures__/runs-81/ and the real
// 82-DIAGNOSIS.md Fix list. No network, no claude binary, no ~/.claude.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const R = require('./check-rules.cjs');
const { main } = require('./score.cjs');
const { wilson } = require('../eval81/lib/stats.cjs');
const { scanRun, recordedAccess } = require('./lib/guessed-paths.cjs');
const { writePlannerRun } = require('./__fixtures__/attribution-transcripts.cjs');

const dirs = [];
const tmp = (prefix = 'e82-rules-') => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
};
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

const REPO = path.resolve(__dirname, '..', '..');
const DIAGNOSIS = path.join(REPO, '.aoforge', 'objectives', '82-3-1-0-follow-ups', '82-DIAGNOSIS.md');
const RUNS_81 = path.join(__dirname, '__fixtures__', 'runs-81');

// ─── hand-built results ──────────────────────────────────────────────────────────────────────────────────────────

/** A batch D result in score/D.cjs's shape. Counts are [k, n]. */
function dResult({ hAcc = [19, 20], sAcc = [18, 20], missed = [0, 8], hCost = 0.9, sCost = 1.4, incomplete = {} } = {}) {
  const arm = (acc, miss, inc, extra = {}) => ({
    accuracy: wilson(acc[0], acc[1]), broken_missed: wilson(miss[0], miss[1]), false_fail: wilson(0, 12), incomplete: inc || [], ...extra,
  });
  return {
    batch: 'D',
    scored_at: '2026-10-19T09:00:00.000Z',
    states_total: 20,
    arms: {
      haiku_start: arm(hAcc, missed, incomplete.haiku_start),
      haiku: arm([17, 20], [1, 8], incomplete.haiku, { split_rate: wilson(6, 20), escalation_rate: wilson(4, 20), escalation_rate_ok: wilson(3, 12), escalated: ['d02', 'd05', 'd09', 'd14'] }),
      sonnet: arm(sAcc, [0, 8], incomplete.sonnet, { split_rate: wilson(2, 20), escalation_rate: wilson(1, 20), escalation_rate_ok: wilson(1, 12), escalated: ['d05'] }),
    },
    escalated_agreement: { ...wilson(3, 4), states: ['d02', 'd05', 'd09', 'd14'] },
    cost: {
      haiku_start: { samples_usd: round(hCost - 0.3), escalation_usd: 0.3, total_usd: hCost, records: 72 },
      sonnet_start: { samples_usd: round(sCost - 0.2), escalation_estimate_usd: 0.2, escalation_basis: 'estimate: the sonnet sessions of d05 (3) priced at claude-opus-5-5 rates', total_usd: sCost, records: 60 },
    },
  };
}
function round(x) {
  return Math.round(x * 1e6) / 1e6;
}

/** A batch C result in score/C.cjs's shape for one dimension. pooled: {haiku: [found, items, fab, runs], sonnet: [...]}. */
function cResult(dim, { pooled = { haiku: [40, 46, 1, 4], sonnet: [42, 46, 0, 4] }, graded = {}, matrix = {}, other } = {}) {
  const cell = (runs) => ({ planned: 2, graded_runs: runs, recall: wilson(0, 0), fabrications_total: 0, fabrications_per_run: null, runs: [] });
  const cells = {};
  for (const t of ['gateway', 'hub']) {
    cells[t] = {};
    for (const d of ['architecture', 'pitfalls']) {
      const g = (graded[t] && d === dim) ? graded[t] : { haiku: 2, sonnet: 2 };
      cells[t][d] = { haiku: cell(g.haiku), sonnet: cell(g.sonnet) };
    }
  }
  const pool = ([k, n, fab, runs]) => ({ planned: 4, graded_runs: runs, recall: wilson(k, n), fabrications_total: fab, fabrications_per_run: runs ? round(fab / runs) : null, runs: [] });
  const otherDim = dim === 'architecture' ? 'pitfalls' : 'architecture';
  const otherPooled = other || { haiku: [40, 44, 0, 4], sonnet: [40, 44, 0, 4] };
  const row = (id, s, h) => ({ id, sonnet_found: s, sonnet_graded: 2, haiku_found: h, haiku_graded: 2 });
  const item = {
    gateway: { [dim]: matrix.gateway || [row('GA-X01', 2, 2), row('GA-X02', 2, 1), row('GA-X03', 1, 0)], [otherDim]: [row('GA-Y01', 2, 0)] },
    hub: { [dim]: matrix.hub || [row('HU-X01', 2, 1), row('HU-X02', 0, 0)], [otherDim]: [] },
  };
  return {
    batch: 'C',
    scored_at: '2026-10-19T10:00:00.000Z',
    topics: ['gateway', 'hub'],
    dimensions: ['architecture', 'pitfalls'],
    models: ['haiku', 'sonnet'],
    cells,
    pooled: { [dim]: { haiku: pool(pooled.haiku), sonnet: pool(pooled.sonnet) }, [otherDim]: { haiku: pool(otherPooled.haiku), sonnet: pool(otherPooled.sonnet) } },
    item_matrix: item,
    guessed_paths: {
      runs: [
        { id: 'C82-res-gateway-architecture-s-1', files_scanned: 2, tool_uses_scanned: 9, scanned: true, tilde: 1, guessed_home: 0, recorded: { real: 0, guessed_nonexistent: 0, tilde_denied: 0 }, entries: [{ id: 't1', class: 'tilde', tool: 'Read', field: 'file_path', path: '~/.claude/aoforge/templates/research-project/ARCHITECTURE.md', denied: false, file: 'k/s.jsonl' }], recorded_entries: [] },
        { id: 'C82-res-gateway-architecture-h-1', files_scanned: 1, tool_uses_scanned: 7, scanned: true, tilde: 0, guessed_home: 0, recorded: { real: 0, guessed_nonexistent: 0, tilde_denied: 0 }, entries: [], recorded_entries: [] },
      ],
    },
    recorded_81: {
      source: '.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json',
      item_level: false,
      note: 'objective 81\'s topic: recorded context, not voting; its C.json holds no item-level verdicts, so it is aggregate only (recall, fabrications, cost)',
      roles: {
        architecture: { haiku: { n_scored: 2, recall: { k: 21, n: 22 }, fabrications: { total: 0, runs: 2 }, cost_usd: 0.080452, grader_cost_usd: 0.134143 }, sonnet: { n_scored: 2, recall: { k: 17, n: 22 }, fabrications: { total: 0, runs: 2 }, cost_usd: 0.265399, grader_cost_usd: 0.1172 } },
        pitfalls: { haiku: { n_scored: 2, recall: { k: 18, n: 24 }, fabrications: { total: 1, runs: 2 }, cost_usd: 0.09, grader_cost_usd: 0.13 }, sonnet: { n_scored: 2, recall: { k: 20, n: 24 }, fabrications: { total: 0, runs: 2 }, cost_usd: 0.38, grader_cost_usd: 0.13 } },
      },
      runs: [],
    },
  };
}

// ─── 7: P1 ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('7: p1Verdict KEEPs only when nothing broken is missed, accuracy holds and the Haiku start costs less', () => {
  const keep = R.p1Verdict(dResult());
  assert.equal(keep.proposal, 'P1');
  assert.equal(keep.verdict, 'KEEP');
  assert.equal(keep.inconclusive, false);
  assert.deepEqual(keep.failing, []);
  assert.deepEqual(keep.clauses.map((c) => [c.id, c.holds]), [['broken_missed', true], ['accuracy', true], ['cost', true]]);
  assert.match(keep.deciding, /all three conditions hold/);

  // Equal accuracy is enough (>=).
  assert.equal(R.p1Verdict(dResult({ hAcc: [18, 20] })).verdict, 'KEEP');

  // Each single violation reverts and is named.
  const missed = R.p1Verdict(dResult({ missed: [1, 8] }));
  assert.deepEqual([missed.verdict, missed.failing], ['REVERT', ['broken_missed']]);
  assert.match(missed.deciding, /broken_missed\(Haiku start, final\) = 1/);
  const acc = R.p1Verdict(dResult({ hAcc: [17, 20] }));
  assert.deepEqual([acc.verdict, acc.failing], ['REVERT', ['accuracy']]);
  assert.match(acc.deciding, /17\/20 < 18\/20/);
  const cost = R.p1Verdict(dResult({ hCost: 1.4, sCost: 1.4 }));
  assert.deepEqual([cost.verdict, cost.failing], ['REVERT', ['cost']]);
  assert.match(cost.deciding, /\$1\.4000 is not below \$1\.4000/);
  const two = R.p1Verdict(dResult({ missed: [2, 8], hCost: 2 }));
  assert.deepEqual(two.failing, ['broken_missed', 'cost']);

  // Any incomplete state, in either arm, is REVERT (inconclusive); so is a missing result.
  for (const incomplete of [{ haiku_start: ['d03'] }, { sonnet: ['d11'] }, { haiku: ['d07'] }]) {
    const inc = R.p1Verdict(dResult({ incomplete }));
    assert.deepEqual([inc.verdict, inc.inconclusive], ['REVERT', true]);
    assert.match(inc.deciding, /inconclusive/);
    assert.match(inc.deciding, /d03|d11|d07/);
  }
  const none = R.p1Verdict(null);
  assert.deepEqual([none.verdict, none.inconclusive], ['REVERT', true]);
  assert.match(none.deciding, /results\/D\.json/);
});

// ─── 8: P4 / P5 ──────────────────────────────────────────────────────────────────────────────────────────────────

test('8: researcherVerdict REVERTs on a lost item, a recall gap over 10 points or extra fabrications; KEEP otherwise', () => {
  const keep = R.researcherVerdict(cResult('architecture'), 'architecture');
  assert.deepEqual([keep.proposal, keep.dimension, keep.verdict, keep.inconclusive, keep.failing], ['P4', 'architecture', 'KEEP', false, []]);
  assert.deepEqual(keep.clauses.map((c) => c.id), ['item_lost', 'recall', 'fabrications']);
  assert.equal(R.researcherVerdict(cResult('pitfalls'), 'pitfalls').proposal, 'P5');

  // An item Sonnet found in both runs and Haiku in neither, on one topic.
  const row = (id, s, h, sg = 2, hg = 2) => ({ id, sonnet_found: s, sonnet_graded: sg, haiku_found: h, haiku_graded: hg });
  const lost = R.researcherVerdict(cResult('pitfalls', { matrix: { hub: [row('HU-P04', 2, 0), row('HU-P05', 2, 1)] } }), 'pitfalls');
  assert.deepEqual([lost.verdict, lost.failing], ['REVERT', ['item_lost']]);
  assert.deepEqual(lost.lost_items, [{ topic: 'hub', id: 'HU-P04' }]);
  assert.match(lost.deciding, /hub HU-P04/);

  // Recall: more than 10 points below reverts; exactly 10 points does not.
  const gap = R.researcherVerdict(cResult('architecture', { pooled: { haiku: [30, 46, 0, 4], sonnet: [40, 46, 0, 4] } }), 'architecture');
  assert.deepEqual([gap.verdict, gap.failing], ['REVERT', ['recall']]);
  assert.match(gap.deciding, /30\/46/);
  const edge = R.researcherVerdict(cResult('architecture', { pooled: { haiku: [36, 50, 0, 4], sonnet: [41, 50, 0, 4] } }), 'architecture');
  assert.equal(edge.verdict, 'KEEP');

  // Fabrications: more than 0.5 per run above Sonnet's reverts; exactly 0.5 does not.
  const fab = R.researcherVerdict(cResult('architecture', { pooled: { haiku: [40, 46, 3, 4], sonnet: [40, 46, 0, 4] } }), 'architecture');
  assert.deepEqual([fab.verdict, fab.failing], ['REVERT', ['fabrications']]);
  const fabEdge = R.researcherVerdict(cResult('architecture', { pooled: { haiku: [40, 46, 2, 4], sonnet: [40, 46, 0, 4] } }), 'architecture');
  assert.equal(fabEdge.verdict, 'KEEP');

  // Fewer than 2 graded runs in any topic x model: REVERT (inconclusive), naming the cell.
  const short = R.researcherVerdict(cResult('pitfalls', { graded: { hub: { haiku: 1, sonnet: 2 } } }), 'pitfalls');
  assert.deepEqual([short.verdict, short.inconclusive], ['REVERT', true]);
  assert.match(short.deciding, /hub haiku: 1 graded run/);
  assert.deepEqual(R.researcherVerdict(null, 'pitfalls').inconclusive, true);
  // The other dimension's numbers never leak into this one's verdict.
  assert.equal(R.researcherVerdict(cResult('architecture', { other: { haiku: [0, 44, 9, 4], sonnet: [44, 44, 0, 4] } }), 'architecture').verdict, 'KEEP');
});

// ─── 9: mechanism checks ─────────────────────────────────────────────────────────────────────────────────────────

/** A spawn summary in attribution.summarizeSpawn's shape ({calls: true}); mentions computed from each tool's `also`. */
function spawn(role, agentId, tools) {
  const mentions = {};
  for (const t of tools) for (const c of t.also || [t.category]) mentions[c] = (mentions[c] || 0) + 1;
  return { role, agent_id: agentId, mentions, written: {}, call_list: tools.map((t, i) => ({ index: i + 1, tools: [{ input_chars: 100, is_error: false, also: [t.category], detail: '', ...t }] })) };
}
const T = (category, detail = '', extra = {}) => ({ name: 'Bash', category, also: [category], detail, ...extra });
const W = (detail, inputChars, extra = {}) => ({ name: 'Write', category: 'draft_write', also: ['draft_write'], detail, input_chars: inputChars, ...extra });
const OK_OUTCOME = { acceptance: true, tests_ok: true, verification_status: 'passed' };

function cleanRun(id, over = {}) {
  return {
    id,
    outcome: { ...OK_OUTCOME, ...(over.outcome || {}) },
    roles: {
      planner: over.planner || [spawn('planner', 'p1', [T('context_load'), W('/t/aoforge-drafts/o/01-01-TRD.md', 15000), T('validate_publish'), T('commit')])],
      executor: over.executor || [
        spawn('executor', 'x1', [T('context_load'), T('commit_inspect', 'git log -1 --format=%B'), W('/t/aoforge-drafts/o/01-01-SUMMARY.md', 3000), W('/t/aoforge-drafts/o/01-01-SUMMARY.md', 3200)]),
        spawn('executor', 'x2', [T('test_run'), T('tool_investigation', 'aof-tools commit --help')]),
      ],
    },
  };
}

test('9a: the Fix list parses from 82-DIAGNOSIS.md, and `## Fix applied` moves a row to JUSTIFY', () => {
  const text = fs.readFileSync(DIAGNOSIS, 'utf8');
  const rows = R.fixListAsApplied(text);
  assert.deepEqual(rows.map((r) => r.id), ['P-1', 'P-2', 'P-3', 'P-4', 'P-5', 'E-1', 'E-2', 'E-4', 'E-5', 'X-1', 'X-2']);
  assert.deepEqual(rows.filter((r) => r.disposition === 'FIX').map((r) => r.id), ['P-1', 'P-2', 'P-3', 'P-4', 'E-1', 'E-2', 'E-4', 'E-5', 'X-1']);
  assert.deepEqual(Object.keys(R.MECHANISM_SPECS), ['P-1', 'P-2', 'P-3', 'P-4', 'E-1', 'E-2', 'E-4', 'E-5', 'X-1']);
  for (const r of rows.filter((x) => x.disposition === 'FIX')) {
    assert.equal(R.MECHANISM_SPECS[r.id].category_cell, r.category, `${r.id}: the pre-registered category is the table's`);
    assert.equal(R.MECHANISM_SPECS[r.id].target_cell, r.target, `${r.id}: the pre-registered target is the table's`);
  }
  // 82-07 published the real `## Fix applied` (every row keeps its listed disposition); the synthetic sections below
  // replace it, since fixListAsApplied reads the first `## Fix applied` (objective 82, TRD 82-07).
  assert.ok(rows.every((r) => r.applied === null || r.applied === r.listed), 'the real ## Fix applied keeps the listed dispositions');
  const base = text.replace(/\n## Fix applied\n[\s\S]*?(?=\n## |$)/, '\n');
  assert.doesNotMatch(base, /^## Fix applied$/m);
  const applied = `${base}\n## Fix applied\n\n| Row | Outcome | Commit |\n|---|---|---|\n| P-1 | FIX | abc123 |\n| E-5 | JUSTIFY: the draft write was not refused again | n/a |\n`;
  const after = R.fixListAsApplied(applied);
  assert.equal(after.find((r) => r.id === 'E-5').disposition, 'JUSTIFY');
  assert.equal(after.find((r) => r.id === 'E-5').applied, 'JUSTIFY');
  assert.equal(after.find((r) => r.id === 'P-1').applied, 'FIX');
  assert.equal(after.find((r) => r.id === 'P-2').applied, null);
  const listForm = R.fixListAsApplied(`${base}\n## Fix applied\n\n- E-2: JUSTIFY, kept the read for precedence questions\n`);
  assert.equal(listForm.find((r) => r.id === 'E-2').disposition, 'JUSTIFY');
});

test('9b: mechanismChecks passes when every FIX row hits its target in every run and every outcome holds', () => {
  const fix = R.fixListAsApplied(fs.readFileSync(DIAGNOSIS, 'utf8'));
  const res = R.mechanismChecks([cleanRun('b82-r1'), cleanRun('b82-r2')], fix);
  assert.equal(res.verdict, 'effect shown', JSON.stringify(res.failures));
  assert.equal(res.effect_shown, true);
  assert.deepEqual(res.rows_checked, ['P-1', 'P-2', 'P-3', 'P-4', 'E-1', 'E-2', 'E-4', 'E-5', 'X-1']);
  assert.deepEqual(res.rows_skipped.map((r) => r.id), ['P-5', 'X-2']);
  assert.equal(res.checks.length, 18);
  assert.ok(res.checks.every((c) => c.pass));
  assert.deepEqual(res.outcomes.map((o) => [o.run, o.pass]), [['b82-r1', true], ['b82-r2', true]]);
});

test('9c: a missed target fails naming the row and run; a missing outcome or an unmeasurable check never passes', () => {
  const fix = R.fixListAsApplied(fs.readFileSync(DIAGNOSIS, 'utf8'));
  const failing = (runs, list = fix) => R.mechanismChecks(runs, list).checks.filter((c) => !c.pass).map((c) => `${c.row}@${c.run}`);

  const p1 = cleanRun('b82-r2', { planner: [spawn('planner', 'p1', [T('runtime_lookup', 'ls ~/.claude/aoforge/templates/'), W('/t/aoforge-drafts/o/01-01-TRD.md', 15000)])] });
  assert.deepEqual(failing([cleanRun('b82-r1'), p1]), ['P-1@b82-r2']);
  const res = R.mechanismChecks([cleanRun('b82-r1'), p1], fix);
  assert.equal(res.verdict, 'effect not shown');
  assert.ok(res.failures.some((f) => /P-1/.test(f) && /b82-r2/.test(f)));

  // P-2: the planner may not inspect at all; executors may not exceed 3.0.0's 3 commit_inspect and 1 commit investigation.
  assert.deepEqual(failing([cleanRun('b82-r1', { planner: [spawn('planner', 'p', [T('commit_inspect', 'git log -1 --format=%B'), W('/a/aoforge-drafts/01-01-TRD.md', 9000)])] })]), ['P-2@b82-r1']);
  const ex = [spawn('executor', 'x', [T('commit_inspect'), T('commit_inspect'), T('commit_inspect'), T('commit_inspect'), W('/a/aoforge-drafts/S.md', 10)])];
  assert.deepEqual(failing([cleanRun('b82-r1', { executor: ex })]), ['P-2@b82-r1']);
  // P-3: a TRD write over 22,000 chars; P-4: a non-commit tool investigation; X-1: a validate_publish error.
  assert.deepEqual(failing([cleanRun('b82-r1', { planner: [spawn('planner', 'p', [W('/a/aoforge-drafts/01-02-TRD.md', 22001)])] })]), ['P-3@b82-r1']);
  assert.deepEqual(failing([cleanRun('b82-r1', { planner: [spawn('planner', 'p', [W('/a/aoforge-drafts/01-01-TRD.md', 9000), T('tool_investigation', 'cat ~/.claude/aoforge/bin/lib/verify.cjs')])] })]), ['P-4@b82-r1']);
  assert.deepEqual(failing([cleanRun('b82-r1', { planner: [spawn('planner', 'p', [W('/a/aoforge-drafts/01-01-TRD.md', 9000), T('validate_publish', 'aof-tools verify trd-structure', { is_error: true })])] })]), ['X-1@b82-r1']);
  // E-1, E-2, E-4 and E-5 on executor spawns.
  const exec = (tools) => [cleanRun('b82-r1', { executor: [spawn('executor', 'x', tools)] })];
  assert.deepEqual(failing(exec([T('runtime_read:templates/summary.md', 'templates/summary.md')])), ['E-1@b82-r1']);
  assert.deepEqual(failing(exec([T('runtime_read:references/tdd.md', 'references/tdd.md')])), ['E-2@b82-r1']);
  assert.deepEqual(failing(exec([{ name: 'Read', category: 'guessed_runtime_path', detail: '/Users/x/.claude/aoforge/references/tdd.md' }])), ['E-4@b82-r1']);
  assert.deepEqual(failing(exec([W('/a/aoforge-drafts/S.md', 10), W('/a/aoforge-drafts/S.md', 10), W('/a/aoforge-drafts/S.md', 10)])), ['E-5@b82-r1']);
  assert.deepEqual(failing(exec([W('/a/aoforge-drafts/S.md', 10, { is_error: true })])), ['E-5@b82-r1']);

  // Unmeasurable: no executor spawn, or no per-call listing where one is needed.
  const noExec = R.mechanismChecks([cleanRun('b82-r1', { executor: [] })], fix);
  assert.deepEqual(noExec.checks.filter((c) => !c.pass).map((c) => c.row), ['P-2', 'E-1', 'E-2', 'E-4', 'E-5']);
  assert.ok(noExec.checks.filter((c) => !c.pass).every((c) => /not measurable/.test(c.reason)));
  const noCalls = cleanRun('b82-r1');
  delete noCalls.roles.planner[0].call_list;
  assert.ok(R.mechanismChecks([noCalls], fix).checks.find((c) => c.row === 'P-1').reason.includes('not measurable'));

  // Outcomes: each must hold; a missing one fails.
  const bad = R.mechanismChecks([cleanRun('b82-r1', { outcome: { acceptance: false } }), cleanRun('b82-r2', { outcome: { verification_status: null } })], fix);
  assert.deepEqual(bad.outcomes.map((o) => o.pass), [false, false]);
  assert.equal(bad.verdict, 'effect not shown');
  assert.ok(bad.checks.every((c) => c.pass));

  // A JUSTIFY row in `## Fix applied` is not checked.
  const justified = fix.map((r) => (r.id === 'E-5' ? { ...r, disposition: 'JUSTIFY', applied: 'JUSTIFY' } : r));
  const j = R.mechanismChecks(exec([W('/a/aoforge-drafts/S.md', 10), W('/a/aoforge-drafts/S.md', 10), W('/a/aoforge-drafts/S.md', 10)]), justified);
  assert.ok(!j.rows_checked.includes('E-5'));
  assert.deepEqual(j.rows_skipped.find((r) => r.id === 'E-5'), { id: 'E-5', reason: 'JUSTIFY in ## Fix applied' });

  // A row changed after pre-registration, a FIX row with no machine check, or a checked row gone: fails.
  const changed = fix.map((r) => (r.id === 'P-4' ? { ...r, target: 'at most 1' } : r));
  assert.match(R.mechanismChecks([cleanRun('b82-r1')], changed).checks.find((c) => c.row === 'P-4').reason, /changed after pre-registration/);
  const promoted = fix.map((r) => (r.id === 'P-5' ? { ...r, disposition: 'FIX', applied: 'FIX' } : r));
  assert.match(R.mechanismChecks([cleanRun('b82-r1')], promoted).checks.find((c) => c.row === 'P-5').reason, /no pre-registered machine check/);
  const dropped = fix.filter((r) => r.id !== 'X-1');
  assert.match(R.mechanismChecks([cleanRun('b82-r1')], dropped).checks.find((c) => c.row === 'X-1').reason, /absent from the Fix list/);

  // No FIX row at all: outcomes only, and it says so.
  const allJustified = fix.map((r) => ({ ...r, disposition: 'JUSTIFY' }));
  const none = R.mechanismChecks([cleanRun('b82-r1')], allJustified);
  assert.equal(none.effect_shown, null);
  assert.match(none.verdict, /no FIX row/);
  assert.equal(none.outcomes_hold, true);
});

test('9d: the attribution of a recorded-shape planner transcript feeds the checks (P-1 and P-2 found in 3.1.0, not 3.0.0)', () => {
  const fix = R.fixListAsApplied(fs.readFileSync(DIAGNOSIS, 'utf8'));
  const oldDir = tmp();
  const newDir = tmp();
  writePlannerRun(oldDir, 'old');
  writePlannerRun(newDir, 'new');
  const exec = [spawn('executor', 'x', [T('commit')])];
  const oldRun = { ...R.attributionForRun(oldDir, { id: 'old', outcome: OK_OUTCOME }) };
  const newRun = { ...R.attributionForRun(newDir, { id: 'new', outcome: OK_OUTCOME }) };
  assert.equal(oldRun.roles.planner.length, 1);
  assert.ok(Array.isArray(oldRun.roles.planner[0].call_list));
  oldRun.roles.executor = exec;
  newRun.roles.executor = exec;
  const res = R.mechanismChecks([oldRun, newRun], fix);
  const failed = res.checks.filter((c) => !c.pass).map((c) => `${c.row}@${c.run}`);
  assert.deepEqual(failed, ['P-1@new', 'P-2@new']);
  assert.deepEqual(res.checks.find((c) => c.row === 'P-1' && c.run === 'new').count, 2);
});

// ─── 10: renderTierChecks ────────────────────────────────────────────────────────────────────────────────────────

test('10: renderTierChecks gives P1, P4 and P5 with verdict, deciding clause and numbers, 81 as context, and SC-2', () => {
  const d = dResult({ missed: [1, 8] });
  const c = cResult('architecture');
  const md = R.renderTierChecks({ d, c });
  assert.equal(md, R.renderTierChecks({ d, c }));
  const headings = md.split('\n').filter((l) => /^#{1,3} /.test(l));
  assert.deepEqual(headings, [
    '# Objective 82: tier checks (P1, P4, P5)',
    '## P1: the UI judge starts at haiku and escalates (batch D)',
    '## P4: researcher architecture at haiku on budget (batch C)',
    '### Recorded context: objective 81\'s topic (architecture, not voting)',
    '## P5: researcher pitfalls at haiku on budget (batch C)',
    '### Recorded context: objective 81\'s topic (pitfalls, not voting)',
    '## Guessed runtime paths (SC-2, researcher runs)',
  ]);
  assert.match(md, /\*\*Verdict: REVERT\.\*\* broken_missed\(Haiku start, final\) = 1/);
  assert.match(md, /\| P1 \| REVERT \|/);
  assert.match(md, /\| P4 \| KEEP \|/);
  assert.match(md, /\| accuracy\(Haiku start\) >= accuracy\(Sonnet start\) \| 19\/20 \(95\.0%[^|]*\) vs 18\/20 \(90\.0%[^|]*\) \| yes \|/);
  assert.match(md, /\| cost\(Haiku start\) < cost\(Sonnet start\) \| \$0\.9000 vs \$1\.4000 \| yes \|/);
  assert.match(md, /pooled Haiku recall 40\/46 \(87\.0%[^)]*\) vs Sonnet 42\/46 \(91\.3%[^)]*\)/);
  assert.match(md, /\| architecture \| haiku \| 2 \| 21\/22 \(95\.5%/);
  assert.match(md, /\*\*Verdict: PASS\.\*\*/);
  assert.match(md, /tilde 1/);
  assert.ok(!/does not expand/i.test(md));
});

test('10: score.cjs --rules renders 82-TIER-CHECKS.md from results/D.json and results/C.json, byte-identical on a re-run', async () => {
  const out = tmp();
  fs.mkdirSync(path.join(out, 'results'), { recursive: true });
  const d = dResult();
  const c = cResult('pitfalls');
  fs.writeFileSync(path.join(out, 'results', 'D.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(out, 'results', 'C.json'), JSON.stringify(c));
  const lines = [];
  assert.equal(await main(['--rules', '--root', tmp(), '--out', out], { stdout: (x) => lines.push(x), stderr: (x) => lines.push(x) }), 0, lines.join(''));
  const first = fs.readFileSync(path.join(out, '82-TIER-CHECKS.md'), 'utf8');
  assert.equal(first, R.renderTierChecks({ d, c }));
  assert.equal(await main(['--rules', '--out', out], { stdout: () => {}, stderr: () => {} }), 0);
  assert.equal(fs.readFileSync(path.join(out, '82-TIER-CHECKS.md'), 'utf8'), first);

  // Missing results are rendered as the rules' inconclusive case, never invented.
  const empty = tmp();
  assert.equal(await main(['--rules', '--out', empty], { stdout: () => {}, stderr: () => {} }), 0);
  const md = fs.readFileSync(path.join(empty, '82-TIER-CHECKS.md'), 'utf8');
  assert.match(md, /\| P1 \| REVERT \(inconclusive\) \|/);
  assert.match(md, /\| P5 \| REVERT \(inconclusive\) \|/);
  assert.match(md, /\*\*Verdict: INCONCLUSIVE\.\*\*/);
  const errs = [];
  assert.equal(await main(['--rules', '--batch', 'C', '--out', out], { stdout: () => {}, stderr: (x) => errs.push(x) }), 1);
  assert.match(errs.join(''), /--rules/);
});

// ─── 11: guessed paths ───────────────────────────────────────────────────────────────────────────────────────────

const row = (id, over = {}) => ({
  id, files_scanned: 1, tool_uses_scanned: 4, tilde: 0, guessed_home: 0, recorded: { real: 0, guessed_nonexistent: 0, tilde_denied: 0 }, entries: [], ...over,
});

test('11a: guessedPathVerdict decides on guessed absolute home paths; `~` inputs are counted, not failures', () => {
  assert.equal(R.guessedPathVerdict([row('r1'), row('r2')]).verdict, 'PASS');
  // `~` Reads (the Read tool expands `~`) and denied `~` paths are reported beside the verdict.
  const tilde = R.guessedPathVerdict([row('r1', { tilde: 3 }), row('r2', { recorded: { real: 0, guessed_nonexistent: 0, tilde_denied: 1 } })]);
  assert.equal(tilde.verdict, 'PASS');
  assert.deepEqual(tilde.counts, { tilde: 3, guessed_home: 0, real: 0, guessed_nonexistent: 0, tilde_denied: 1 });
  assert.deepEqual(tilde.informational.map((x) => [x.run, x.class, x.count]), [['r1', 'tilde', 3], ['r2', 'tilde_denied', 1]]);

  // A guessed home path, a recorded real escape or a recorded guessed_nonexistent fails, naming run, class and path.
  const guess = R.guessedPathVerdict([row('r1', { guessed_home: 1, entries: [{ id: 't', class: 'guessed_home', tool: 'Read', field: 'file_path', path: '/Users/aocyber/.claude/aoforge/references/tdd.md', denied: false }] })]);
  assert.equal(guess.verdict, 'FAIL');
  assert.deepEqual(guess.failures, [{ run: 'r1', class: 'guessed_home', tool: 'Read', path: '/Users/aocyber/.claude/aoforge/references/tdd.md', source: 'transcript' }]);
  assert.match(guess.sentence, /r1/);
  const real = R.guessedPathVerdict([row('r1', { recorded: { real: 1, guessed_nonexistent: 0, tilde_denied: 0 }, recorded_entries: [{ class: 'real', path: '<home>/.ssh/config' }] })]);
  assert.deepEqual(real.failures, [{ run: 'r1', class: 'real', tool: null, path: '<home>/.ssh/config', source: 'record.access' }]);
  const gne = R.guessedPathVerdict([row('r1', { recorded: { real: 0, guessed_nonexistent: 2, tilde_denied: 0 } })]);
  assert.equal(gne.verdict, 'FAIL');
  assert.deepEqual(gne.failures.map((f) => [f.class, f.path]), [['guessed_nonexistent', 'not in the row (record.access count 2)']]);

  // Unscanned: no transcripts, or transcripts with no tool use. Never a pass; a failure elsewhere still fails.
  assert.equal(R.guessedPathVerdict([row('r1'), row('r2', { files_scanned: 0, tool_uses_scanned: 0 })]).verdict, 'INCONCLUSIVE');
  const noUse = R.guessedPathVerdict([row('r1', { tool_uses_scanned: 0 })]);
  assert.deepEqual([noUse.verdict, noUse.unscanned], ['INCONCLUSIVE', ['r1']]);
  assert.equal(R.guessedPathVerdict([row('r1', { files_scanned: 0, tool_uses_scanned: 0 }), row('r2', { guessed_home: 1 })]).verdict, 'FAIL');
  assert.equal(R.guessedPathVerdict([]).verdict, 'INCONCLUSIVE');
  // A missing recorded access counts 0 and is listed.
  const nr = R.guessedPathVerdict([row('r1', { recorded: 'not_recorded' })]);
  assert.deepEqual([nr.verdict, nr.not_recorded], ['PASS', ['r1']]);
});

test('11b: on objective 81\'s recorded runs the verdict FAILs the guessed home paths that record.access alone never saw', () => {
  const opts = { homeParent: '/Users', realHome: '/Users/realuser' };
  const ids = ['C-res-architecture-h-2', 'b31-r1', 'b31-r2'];
  const rows = ids.map((id) => scanRun(path.join(RUNS_81, id), opts));
  const v = R.guessedPathVerdict(rows);
  assert.equal(v.verdict, 'FAIL');
  assert.deepEqual(v.failures.map((f) => [f.run, f.class, f.path]), [
    ['b31-r1', 'guessed_home', '<home>/.claude/aoforge/references/tdd.md'],
    ['b31-r2', 'guessed_home', '/Users/aocyber/.claude/aoforge/references/tdd.md'],
  ]);
  // C-res-architecture-h-2's two `~` Reads are counted for the record and do not fail it.
  assert.deepEqual(v.informational, [{ run: 'C-res-architecture-h-2', class: 'tilde', count: 2 }]);
  assert.deepEqual(v.not_recorded, ['b31-r1', 'b31-r2']);
  assert.deepEqual(v.counts, { tilde: 2, guessed_home: 2, real: 0, guessed_nonexistent: 0, tilde_denied: 0 });

  // The old-style verdict over record.access alone passes all three runs: it sees neither the `~` Reads nor the
  // guessed home paths. The transcript scan is what fails b31-r1 and b31-r2.
  const accessOnly = ids.map((id) => {
    const rec = recordedAccess(JSON.parse(fs.readFileSync(path.join(RUNS_81, id, 'record.json'), 'utf8')));
    const counts = rec || { real: 0, guessed_nonexistent: 0, tilde_denied: 0 };
    return counts.real + counts.guessed_nonexistent + counts.tilde_denied === 0;
  });
  assert.deepEqual(accessOnly, [true, true, true]);
});
