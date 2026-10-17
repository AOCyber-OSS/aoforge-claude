'use strict';
// Tests for scripts/eval81/score/E.cjs (TRD 81-12, test list 9-10). The eval root is hand-built: run dirs with
// record.json and transcripts from __fixtures__/transcripts.cjs (SCORE_RUNS: two quick runs per version), a test
// static-prompt.json and the hand-built RATES. No network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tx = require('../__fixtures__/transcripts.cjs');
const { newLedger } = require('../lib/ledger.cjs');

const load = () => require('./E.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-scoreE-'));
const NOW = () => new Date('2026-10-18T09:00:00.000Z');

const BASE_SUBJECTS = [
  'chore: scaffold notekit with add and list',
  'test: cover the store and the add and list commands',
  'docs: plan the tags milestone',
];
const UPGRADE = 'chore(aoforge): upgrade project to v3.1.0';

function outputs({ pass = true, testsOk = true, trd = 1, summaries = 1, verification = null, upgrade = false } = {}) {
  return {
    acceptance: { pass, checks: [{ name: 'list --json prints the notes as a JSON array of {id, text}', pass, detail: null }] },
    tests: { ok: testsOk, exit: testsOk ? 0 : 1, tests: 8, pass: testsOk ? 8 : 7, fail: testsOk ? 0 : 1, timed_out: false },
    verification_status: verification,
    trd_count: trd,
    summaries,
    git_log_subjects: [...BASE_SUBJECTS, ...(upgrade ? [UPGRADE] : []), 'feat(quick-1): add --json to list'],
  };
}

function record(id, { plugin, cost, transcriptCost, wallMs, firstTurn, out, status = 'ok', usage }) {
  return {
    id,
    batch: 'E',
    role: 'workflow:quick',
    model: 'opus',
    requested_model_id: 'claude-opus-5-5',
    plugin,
    agent: null,
    status,
    cost_usd: cost,
    transcript_cost_usd: transcriptCost,
    charged_usd: Math.max(cost === null ? 0 : cost, transcriptCost === null ? 0 : transcriptCost),
    cost_source: 'reported',
    cap_usd: 6,
    usage: usage || { input: 0, cache_creation: 60000, cache_read: 0, output: 3000 },
    first_turn_input: firstTurn,
    wall_ms: wallMs,
    duration_ms: wallMs - 1000,
    outputs: out,
  };
}

// Priced at RATES (see __fixtures__/transcripts.cjs SCORE_RUNS):
//   q31-r1 orch 0.2125 + planner 0.1375 + executor 0.0575 = 0.4075
//   q31-r2 orch 0.225 + planner 0.15 + executor 0.06 + executor 0.0375 = 0.4725
//   q30-r1 orch 0.275 + planner 0.175 + executor 0.07 = 0.52
//   q30-r2 orch 0.2875 + planner 0.1875 + executor 0.0725 = 0.5475 (reported 0.40: 36.9% above, flagged)
const RUNS = {
  'q31-r1': { plugin: '3.1.0', cost: 0.41, transcriptCost: 0.4075, wallMs: 301000, firstTurn: 30000,
    out: outputs({ upgrade: true }) },
  'q31-r2': { plugin: '3.1.0', cost: 0.47, transcriptCost: 0.4725, wallMs: 361000, firstTurn: 32000,
    out: outputs({ upgrade: true }) },
  'q30-r1': { plugin: '3.0.0', cost: 0.52, transcriptCost: 0.52, wallMs: 401000, firstTurn: 40000,
    out: outputs() },
  'q30-r2': { plugin: '3.0.0', cost: 0.4, transcriptCost: 0.5475, wallMs: 421000, firstTurn: 42000,
    out: outputs({ pass: false, testsOk: false }) },
};

function writeLedger(root, ids) {
  const l = newLedger();
  l.batches.E.status = 'complete';
  l.entries = ids.map((id) => ({
    id, batch: 'E', role: 'workflow:quick', status: 'ok', cap_usd: 6, reserve_usd: 7.5, reported_usd: RUNS[id].cost,
    transcript_usd: RUNS[id].transcriptCost, charged_usd: Math.max(RUNS[id].cost, RUNS[id].transcriptCost),
    cost_source: 'reported', overshoot_usd: 0, at: '2026-10-18T08:00:00.000Z',
  }));
  l.batches.E.spent_usd = Math.round(l.entries.reduce((s, e) => s + e.charged_usd, 0) * 1e6) / 1e6;
  fs.writeFileSync(path.join(root, 'ledger.json'), JSON.stringify(l, null, 2));
}

/** A root with the four SCORE_RUNS and an out dir holding the test static-prompt.json. */
function fixtureRoot({ withStatic = true } = {}) {
  const root = tmp();
  for (const [id, spec] of Object.entries(RUNS)) tx.writeRunDir(root, id, { spawns: tx.SCORE_RUNS[id], record: record(id, spec) });
  writeLedger(root, Object.keys(RUNS));
  const outDir = tmp();
  if (withStatic) {
    fs.mkdirSync(path.join(outDir, 'results'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'results', 'static-prompt.json'), JSON.stringify(tx.STATIC_PROMPT));
  }
  return { root, outDir };
}

const scoreOf = (opts) => load().score({ rates: tx.RATES, now: NOW, staticFallback: null, ...opts });

describe('score E', () => {
  test('9. per version x workflow x role: spawns, median/mean first-turn input, total tokens, cache writes, cost, wall', () => {
    const { root, outDir } = fixtureRoot();
    const r = scoreOf({ root, outDir });
    assert.equal(r.batch, 'E');
    const q31 = r.per_role['3.1.0'].quick;
    const q30 = r.per_role['3.0.0'].quick;
    assert.deepEqual(Object.keys(q31).sort(), ['executor', 'orchestrator', 'planner']);
    assert.deepEqual(Object.keys(q30).sort(), ['executor', 'orchestrator', 'planner']);
    assert.deepEqual(r.per_role['3.1.0'].build, {});

    assert.equal(q31.orchestrator.spawns, 2);
    assert.equal(q31.orchestrator.runs, 2);
    assert.deepEqual(q31.orchestrator.first_turn_input, { n: 2, median: 31000, mean: 31000, min: 30000, max: 32000 });
    assert.deepEqual(q31.orchestrator.total_tokens, { n: 2, median: 32000, mean: 32000, min: 31000, max: 33000 });
    assert.deepEqual(q31.orchestrator.cache_writes, { n: 2, median: 31000, mean: 31000, min: 30000, max: 32000 });
    assert.deepEqual(q31.orchestrator.cost_usd, { n: 2, median: 0.21875, mean: 0.21875, min: 0.2125, max: 0.225 });
    assert.deepEqual(q31.orchestrator.wall_s, { n: 2, median: 330, mean: 330, min: 300, max: 360 });
    assert.deepEqual(q31.orchestrator.models, ['claude-opus-5-5']);

    // Three executor spawns in two runs: 15000, 16000, 11000.
    assert.equal(q31.executor.spawns, 3);
    assert.equal(q31.executor.runs, 2);
    assert.deepEqual(q31.executor.first_turn_input, { n: 3, median: 15000, mean: 14000, min: 11000, max: 16000 });
    assert.deepEqual(q31.executor.cost_usd, { n: 3, median: 0.0575, mean: 0.051667, min: 0.0375, max: 0.06 });
    assert.deepEqual(q31.executor.models, ['claude-sonnet-5-5']);
    assert.deepEqual(q31.planner.cost_usd, { n: 2, median: 0.14375, mean: 0.14375, min: 0.1375, max: 0.15 });

    assert.deepEqual(q30.executor.first_turn_input, { n: 2, median: 20500, mean: 20500, min: 20000, max: 21000 });
    assert.deepEqual(q30.planner.first_turn_input, { n: 2, median: 27000, mean: 27000, min: 26000, max: 28000 });
    assert.deepEqual(q30.orchestrator.wall_s, { n: 2, median: 410, mean: 410, min: 400, max: 420 });
  });

  test('9. 3.1.0 minus 3.0.0 deltas per workflow and role, with the static bytes per role', () => {
    const { root, outDir } = fixtureRoot();
    const r = scoreOf({ root, outDir });
    const d = r.deltas.quick;
    assert.deepEqual(d.orchestrator.first_turn_input, { median: -10000, mean: -10000, median_pct: -24.39 });
    assert.deepEqual(d.planner.first_turn_input, { median: -6000, mean: -6000, median_pct: -22.22 });
    assert.deepEqual(d.executor.first_turn_input, { median: -5500, mean: -6500, median_pct: -26.83 });
    assert.deepEqual(d.orchestrator.cost_usd, { median: -0.0625, mean: -0.0625, median_pct: -22.22 });
    assert.deepEqual(d.orchestrator.wall_s, { median: -80, mean: -80, median_pct: -19.51 });
    assert.equal(r.deltas.build && Object.keys(r.deltas.build).length, 0);

    assert.equal(r.static.source, 'out');
    assert.equal(r.static.path, path.join(outDir, 'results', 'static-prompt.json'));
    assert.deepEqual(r.static.roles.planner, { from_bytes: 60000, to_bytes: 54000, delta_bytes: -6000, delta_pct: -10,
      from_tokens: 15000, to_tokens: 13500, delta_tokens: -1500 });
    assert.deepEqual(r.static.roles.executor.delta_bytes, -12000);
    assert.deepEqual(r.static.roles.orchestrator, { na: 'n/a (not a spawn)' });
    assert.equal(r.static.from.ref, 'v3.0.0');
    assert.equal(r.static.to.ref, 'HEAD');
  });

  test('9. per-run rows carry costs, tokens, wall time and outcomes; missing runs are listed', () => {
    const { root, outDir } = fixtureRoot();
    const r = scoreOf({ root, outDir });
    assert.deepEqual(r.runs.map((x) => x.id), ['q31-r1', 'q30-r1', 'q30-r2', 'q31-r2']);
    const q31r1 = r.runs[0];
    assert.equal(q31r1.version, '3.1.0');
    assert.equal(q31r1.workflow, 'quick');
    assert.equal(q31r1.status, 'ok');
    assert.equal(q31r1.cost_usd, 0.41);
    assert.equal(q31r1.transcript_cost_usd, 0.4075);
    assert.equal(q31r1.priced_cost_usd, 0.4075);
    assert.equal(q31r1.charged_usd, 0.41);
    assert.equal(q31r1.first_turn_input, 30000);
    assert.equal(q31r1.first_turn_source, 'transcript');
    assert.equal(q31r1.total_tokens, 31000 + 20500 + 17000);
    assert.equal(q31r1.cache_writes, 30000 + 20000 + 15000);
    assert.equal(q31r1.tokens_source, 'transcripts');
    assert.equal(q31r1.wall_s, 301);
    assert.deepEqual(q31r1.spawns, { orchestrator: 1, planner: 1, executor: 1 });
    assert.equal(q31r1.acceptance, true);
    assert.equal(q31r1.tests_ok, true);
    assert.equal(q31r1.trd_count, 1);
    assert.equal(q31r1.summaries, 1);
    assert.equal(q31r1.upgrade_commit, true);
    assert.equal(q31r1.new_commits, 2);
    assert.deepEqual(q31r1.flags, []);

    const q30r2 = r.runs.find((x) => x.id === 'q30-r2');
    assert.equal(q30r2.acceptance, false);
    assert.equal(q30r2.tests_ok, false);
    assert.equal(q30r2.upgrade_commit, false);
    assert.equal(q30r2.cost_usd, 0.4, 'the reported figure is never overwritten');
    assert.equal(q30r2.priced_cost_usd, 0.5475);
    assert.equal(q30r2.flags.length, 1);
    assert.match(q30r2.flags[0], /priced transcript cost \$0\.5475 is 36\.9% above the reported \$0\.4000/);
    assert.deepEqual(r.flagged, [{ id: 'q30-r2', flags: q30r2.flags }]);

    assert.deepEqual(r.excluded.map((e) => e.id), ['b31-r1', 'b30-r1', 'q31-r3', 'q30-r3', 'b30-r2', 'b31-r2']);
    for (const e of r.excluded) assert.match(e.reason, /not run/);
    assert.deepEqual(r.planned, { '3.0.0': 5, '3.1.0': 5 });

    const o31 = r.outcomes['3.1.0'].quick;
    assert.equal(o31.planned, 3);
    assert.equal(o31.recorded, 2);
    assert.equal(o31.ok, 2);
    assert.equal(o31.acceptance_pass, 2);
    assert.equal(o31.tests_ok, 2);
    assert.equal(o31.upgrade_commits, 2);
    assert.deepEqual(o31.trd_counts, [1, 1]);
    assert.deepEqual(o31.cost_usd, { n: 2, median: 0.44, mean: 0.44, min: 0.41, max: 0.47 });
    const o30 = r.outcomes['3.0.0'].quick;
    assert.equal(o30.acceptance_pass, 1);
    assert.equal(o30.tests_ok, 1);
    assert.equal(o30.upgrade_commits, 0);
    assert.equal(r.outcomes['3.0.0'].build.recorded, 0);
    assert.equal(r.session_model, 'opus');
    assert.equal(r.profile, 'balanced');
  });

  test('9. unreadable transcripts: role rows unreadable, the CLI-reported totals still count, and the run is flagged', () => {
    const { root, outDir } = fixtureRoot();
    tx.writeRunDir(root, 'b31-r1', {
      record: { ...record('b31-r1', { plugin: '3.1.0', cost: 2.5, transcriptCost: null, wallMs: 1800000, firstTurn: 36000,
        out: outputs({ trd: 2, summaries: 2, verification: 'passed', upgrade: true }),
        usage: { input: 10, cache_creation: 50000, cache_read: 400000, output: 9000 } }), role: 'workflow:build' },
    });
    const r = scoreOf({ root, outDir });
    const b = r.runs.find((x) => x.id === 'b31-r1');
    assert.equal(b.transcripts, 'unreadable');
    assert.equal(b.priced_cost_usd, null);
    assert.equal(b.cost_usd, 2.5);
    assert.equal(b.first_turn_input, 36000);
    assert.equal(b.first_turn_source, 'reported');
    assert.equal(b.total_tokens, 10 + 50000 + 400000 + 9000);
    assert.equal(b.cache_writes, 50000);
    assert.equal(b.tokens_source, 'reported');
    assert.ok(b.flags.some((f) => /transcripts unreadable/.test(f)));
    assert.deepEqual(r.per_role['3.1.0'].build, {}, 'no transcript rows, no role cells');
    assert.equal(r.outcomes['3.1.0'].build.verification_passed, 1);
    assert.deepEqual(r.outcomes['3.1.0'].build.trd_counts, [2]);
  });

  test('9. a run that did not end ok is reported per run and left out of the role cells', () => {
    const { root, outDir } = fixtureRoot();
    tx.writeRunDir(root, 'q31-r3', {
      spawns: tx.SCORE_RUNS['q31-r1'],
      record: record('q31-r3', { plugin: '3.1.0', cost: 6.2, transcriptCost: 0.4075, wallMs: 1800000, firstTurn: 30000,
        out: outputs({ pass: false }), status: 'cap_hit' }),
    });
    const r = scoreOf({ root, outDir });
    assert.equal(r.runs.find((x) => x.id === 'q31-r3').status, 'cap_hit');
    assert.equal(r.per_role['3.1.0'].quick.orchestrator.spawns, 2, 'q31-r3 is not in the cell');
    assert.ok(r.excluded.some((e) => e.id === 'q31-r3' && /cap_hit/.test(e.reason)));
    assert.equal(r.outcomes['3.1.0'].quick.recorded, 3);
    assert.equal(r.outcomes['3.1.0'].quick.ok, 2);
  });

  test('9. a dry-run record counts as not run; outputs can come from outputs/outputs.json', () => {
    const { root, outDir } = fixtureRoot();
    tx.writeRunDir(root, 'q30-r3', { record: { id: 'q30-r3', batch: 'E', status: 'dry_run' } });
    const dir = path.join(root, 'runs', 'E', 'q31-r1');
    const rec = JSON.parse(fs.readFileSync(path.join(dir, 'record.json'), 'utf8'));
    const out = rec.outputs;
    delete rec.outputs;
    fs.writeFileSync(path.join(dir, 'record.json'), JSON.stringify(rec));
    fs.mkdirSync(path.join(dir, 'outputs'));
    fs.writeFileSync(path.join(dir, 'outputs', 'outputs.json'), JSON.stringify(out));
    const r = scoreOf({ root, outDir });
    assert.ok(r.excluded.some((e) => e.id === 'q30-r3' && /not run \(dry_run\)/.test(e.reason)));
    assert.equal(r.runs.find((x) => x.id === 'q31-r1').acceptance, true);
  });

  test('9. static numbers come from the out dir, else the fallback file, else every cell is n/a', () => {
    const { root, outDir } = fixtureRoot({ withStatic: false });
    const fallback = path.join(tmp(), 'static-prompt.json');
    fs.writeFileSync(fallback, JSON.stringify(tx.STATIC_PROMPT));
    const viaFallback = scoreOf({ root, outDir, staticFallback: fallback });
    assert.equal(viaFallback.static.source, 'fallback');
    assert.equal(viaFallback.static.path, fallback);
    assert.equal(viaFallback.static.roles.planner.delta_bytes, -6000);
    const none = scoreOf({ root, outDir, staticFallback: null });
    assert.equal(none.static.source, null);
    assert.deepEqual(none.static.roles.planner, { na: 'n/a (static-prompt.json not found)' });
    assert.deepEqual(none.static.roles.orchestrator, { na: 'n/a (not a spawn)' });
  });

  test('9. the default fallback is the committed 81-07 results/static-prompt.json', () => {
    const { root, outDir } = fixtureRoot({ withStatic: false });
    const r = load().score({ root, outDir, rates: tx.RATES, now: NOW });
    assert.equal(r.static.source, 'fallback');
    assert.match(r.static.path, /81-haiku-eval-and-model-efficiency-measurement\/results\/static-prompt\.json$/);
    assert.equal(typeof r.static.roles.planner.from_bytes, 'number');
    // A path inside the repository is shown relative to its root in the committed report.
    assert.ok(r.extra_files['81-MEASUREMENT.md'].includes(
      '`.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json` (the fallback copy)'));
  });
});

describe('81-MEASUREMENT.md', () => {
  test('10. method, per-role table, per-run table, outcomes, static column, flagged runs, session model and profile', () => {
    const { root, outDir } = fixtureRoot();
    const r = scoreOf({ root, outDir });
    const md = r.extra_files['81-MEASUREMENT.md'];
    assert.equal(typeof md, 'string');
    assert.match(md, /^# 76-08 measurement: AOForge 3\.0\.0 vs 3\.1\.0/m);
    assert.match(md, /Session model: opus/);
    assert.match(md, /Profile: balanced/);
    assert.match(md, /^## Method$/m);
    assert.match(md, /\/aoforge:quick Add a --json flag to `notekit list`/);
    assert.ok(md.includes('`` /aoforge:quick Add a --json flag to `notekit list` that prints the notes as a JSON array of {id, text} objects, with a test. ``'),
      'a prompt holding backticks sits in a double-backtick code span');
    assert.match(md, /Profile: balanced \(the planner inherits the session model; executor, verifier and job-checker run sonnet/);
    assert.match(md, /\/aoforge:build 1 --skip-research --auto/);
    assert.match(md, /q31-r1, q30-r1, b31-r1, b30-r1, q30-r2, q31-r2, q31-r3, q30-r3, b30-r2, b31-r2/);
    assert.match(md, /first-turn input/i);
    assert.match(md, /model-rates\.json/);
    assert.match(md, /reported cost/i);
    assert.match(md, /chore\(aoforge\): upgrade project to v3\.1\.0/);
    assert.match(md, /^## Outcomes$/m);
    assert.match(md, /^## Per role$/m);
    assert.match(md, /^### quick$/m);
    assert.match(md, /\| Role \| Version \| n spawns \(runs\) \| First-turn input/);
    assert.match(md, /\| orchestrator \| 3\.1\.0 \| 2 \(2\) \| 31,000 \/ 31,000 \|/);
    assert.match(md, /\| executor \| 3\.1\.0 \| 3 \(2\) \| 15,000 \/ 14,000 \|/);
    assert.match(md, /\| planner \| 3\.1\.0 - 3\.0\.0 \| \| -6,000 \(-22\.22%\) \/ -6,000 \|/);
    assert.match(md, /60,000 -> 54,000 \(-6,000\)/, 'static resident bytes beside the live numbers');
    assert.match(md, /n\/a \(not a spawn\)/);
    assert.match(md, /^## Per run$/m);
    for (const id of Object.keys(RUNS)) assert.match(md, new RegExp(`^\\| ${id} \\|`, 'm'));
    assert.match(md, /^## Flagged runs$/m);
    assert.match(md, /- q30-r2: priced transcript cost \$0\.5475 is 36\.9% above the reported \$0\.4000/);
    assert.match(md, /^## Not run$/m);
    assert.match(md, /- b31-r1: not run \(no record\)/);
    assert.match(md, /static-prompt\.json/);
    assert.ok(!/recommend/i.test(md), 'no tier recommendation');
  });

  test('10. an empty root still renders, with every run listed as not run', () => {
    const root = tmp();
    const r = scoreOf({ root, outDir: tmp() });
    const md = r.extra_files['81-MEASUREMENT.md'];
    assert.equal(r.runs.length, 0);
    assert.equal(r.excluded.length, 10);
    assert.match(md, /No run has a record yet/);
    assert.match(md, /Session model: n\/a/);
  });

  test('the score CLI writes results/E.json, results/E.md and 81-MEASUREMENT.md', async () => {
    const { main } = require('../score.cjs');
    const { root, outDir } = fixtureRoot();
    const lines = [];
    const code = await main(['--batch', 'E', '--root', root, '--out', outDir], {
      stdout: (s) => lines.push(s), stderr: (s) => lines.push(s), now: NOW,
    });
    assert.equal(code, 0, lines.join(''));
    const saved = JSON.parse(fs.readFileSync(path.join(outDir, 'results', 'E.json'), 'utf8'));
    assert.equal(saved.batch, 'E');
    assert.equal(saved.extra_files, undefined);
    assert.equal(saved.spend.batch, 'E');
    assert.equal(saved.spend.entries.length, 4);
    assert.ok(fs.existsSync(path.join(outDir, 'results', 'E.md')));
    const md = fs.readFileSync(path.join(outDir, '81-MEASUREMENT.md'), 'utf8');
    assert.match(md, /^# 76-08 measurement/m);
  });
});
