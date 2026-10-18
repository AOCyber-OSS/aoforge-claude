'use strict';
// TRD 82-05 test list 12-14 (E part): the objective-82 E scorer on hand-built records, transcripts and a hand-built
// objective-81 E.json, priced at objective 81's hand-built RATES. The guessed-path section is read from the
// transcripts (lib/guessed-paths.cjs), never from record.access alone.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { score } = require('./E.cjs');
const { main } = require('../score.cjs');
const ledgerLib = require('../../eval81/lib/ledger.cjs');
const { initialLedger } = require('../ledger82.cjs');
const { RATES } = require('../../eval81/__fixtures__/transcripts.cjs');
const {
  runRecord, writeRunDir, toolUseRow, apiBlobRow, E82_SPAWNS, buildOutputs, e81Json, T,
} = require('../__fixtures__/records.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'e82-scoreE-'));
const HOME_PARENT = '/Users';
const REAL_HOME = '/Users/realuser';
const NOW = () => new Date('2026-10-18T12:00:00.000Z');
const EMPTY_ACCESS = { real: [], non_escape: [], impaired: false, impaired_by: [] };

function withExtra(spawns, agent, extra) {
  return spawns.map((s) => (s.agent === agent ? { ...s, extra } : s));
}

/**
 * The standard fixture: b82-r1 (a guessed-home Grep in executor x1, record.access holding one guessed_nonexistent)
 * and b82-r2 (a `~` Read in executor y1 repeated in an api-request-blob line, no access field).
 */
function setup({ r1Access, r2Access, r1Extra, r2Extra, r2Transcripts = true } = {}) {
  const root = tmp();
  const r1 = runRecord({
    id: 'b82-r1', batch: 'E', model: 'opus', role: 'workflow:build', cost: 0.95, charged: 0.95, cap: 6.5,
    access: r1Access === undefined
      ? { real: [], non_escape: [{ class: 'guessed_nonexistent', tool: 'Read', denied: false, path: '/Users/nobody/x.md' }], impaired: false, impaired_by: [] }
      : r1Access,
    outputs: buildOutputs(), claude_version: '2.1.400',
  });
  const grep = toolUseRow([{ id: 'tu_grep', name: 'Grep', input: { pattern: 'tdd', path: '/Users/realuser/.claude/aoforge' } }], { agentId: 'x1', msgId: 'msg_x1_tool', at: T('10:06:00') });
  writeRunDir(root, 'E', 'b82-r1', {
    record: r1,
    spawns: withExtra(E82_SPAWNS['b82-r1'], 'x1', r1Extra === undefined ? [grep] : r1Extra),
  });

  const r2 = runRecord({
    id: 'b82-r2', batch: 'E', model: 'opus', role: 'workflow:build', cost: 0.9, charged: 0.9, cap: 6.5,
    access: r2Access, outputs: buildOutputs({ pass: false, testsPass: 20, trds: 1, summaries: 1 }), claude_version: '2.1.400',
  });
  const read = [{ id: 'tu_tilde', name: 'Read', input: { file_path: '~/.claude/aoforge/references/tdd.md' } }];
  writeRunDir(root, 'E', 'b82-r2', {
    record: r2,
    spawns: r2Transcripts
      ? withExtra(E82_SPAWNS['b82-r2'], 'y1', r2Extra === undefined ? [toolUseRow(read, { agentId: 'y1', msgId: 'msg_y1_tool', at: T('11:05:00') }), apiBlobRow(read)] : r2Extra)
      : undefined,
  });
  const e81Path = path.join(tmp(), 'E.json');
  fs.writeFileSync(e81Path, JSON.stringify(e81Json({ claudeVersion: '2.1.302 (Claude Code)' }), null, 2));
  return { root, e81Path };
}

const opts = (s) => ({ root: s.root, outDir: tmp(), rates: RATES, e81Path: s.e81Path, homeParent: HOME_PARENT, realHome: REAL_HOME, now: NOW });

test('12: per role, the new runs beside 81\'s recorded 3.0.0 and 3.1.0 build cells, with deltas new minus each', () => {
  const s = setup();
  const r = score(opts(s));
  assert.equal(r.batch, 'E');
  assert.deepEqual(r.columns, ['3.0.0', '3.1.0', '3.1.0-82']);
  const neu = r.per_role['3.1.0-82'];
  assert.deepEqual(Object.keys(neu), ['orchestrator', 'planner', 'job-checker', 'executor', 'verifier']);
  assert.deepEqual(neu.planner.first_turn_input, { n: 2, median: 52000, mean: 52000, min: 50000, max: 54000 });
  assert.deepEqual(neu.planner.total_tokens, { n: 2, median: 54000, mean: 54000, min: 52000, max: 56000 });
  assert.deepEqual(neu.executor.total_tokens, { n: 3, median: 33000, mean: 32666.666667, min: 28000, max: 37000 });
  assert.deepEqual(neu.executor.cost_usd, { n: 3, median: 0.105, mean: 0.101667, min: 0.085, max: 0.115 });
  assert.equal(neu.executor.spawns, 3);
  assert.equal(neu.executor.runs, 2);
  assert.deepEqual(neu.orchestrator.wall_s, { n: 2, median: 1050, mean: 1050, min: 900, max: 1200 });
  assert.deepEqual(neu['job-checker'].cache_writes, { n: 2, median: 21000, mean: 21000, min: 20000, max: 22000 });
  assert.deepEqual(neu.verifier.cost_usd, { n: 2, median: 0.0535, mean: 0.0535, min: 0.051, max: 0.056 });

  assert.equal(r.per_role['3.0.0'].planner.first_turn_input.median, 40000);
  assert.equal(r.per_role['3.1.0'].planner.first_turn_input.median, 50000);
  assert.deepEqual(r.deltas.planner.first_turn_input, {
    'vs_3.0.0': { median: 12000, mean: 12000, median_pct: 30 },
    'vs_3.1.0': { median: 2000, mean: 2000, median_pct: 4 },
  });
  assert.deepEqual(r.deltas.planner.total_tokens['vs_3.1.0'], { median: -1946000, mean: -1946000, median_pct: -97.3 });
  assert.deepEqual(r.deltas.executor.cost_usd['vs_3.0.0'], { median: 0.005, mean: 0.001667, median_pct: 5 });

  // Outcomes per run: the new runs and 81's recorded build runs (never its quick runs).
  assert.deepEqual(r.runs.map((x) => [x.id, x.column, x.status, x.acceptance, x.verification_status, x.trd_count]), [
    ['b82-r1', '3.1.0-82', 'ok', true, 'passed', 2],
    ['b82-r2', '3.1.0-82', 'ok', false, 'passed', 1],
  ]);
  const b1 = r.runs[0];
  assert.equal(b1.first_turn_input, 40000);
  assert.equal(b1.total_tokens, 193100);
  assert.equal(b1.priced_cost_usd, 0.9335);
  assert.equal(r.runs[1].total_tokens, 181100);
  assert.deepEqual(r.recorded_runs.map((x) => [x.id, x.version, x.acceptance]), [
    ['b31-r1', '3.1.0', true], ['b30-r1', '3.0.0', true], ['b30-r2', '3.0.0', true], ['b31-r2', '3.1.0', true],
  ]);
  assert.deepEqual(r.claude_versions, { '81': '2.1.302 (Claude Code)', '82': ['2.1.400'] });
});

test('13: guessed runtime paths come from the transcripts, beside the runner\'s recorded classes', () => {
  const s = setup();
  const r = score(opts(s));
  const [g1, g2] = r.guessed_paths.runs;
  assert.deepEqual([g1.id, g1.scanned, g1.tilde, g1.guessed_home], ['b82-r1', true, 0, 1]);
  assert.deepEqual(g1.recorded, { real: 0, guessed_nonexistent: 1, tilde_denied: 0 });
  assert.deepEqual(g1.entries.map((e) => [e.class, e.tool, e.path]), [['guessed_home', 'Grep', '<home>/.claude/aoforge']]);
  // Built like test 17: a `~` Read on an assistant line and again in a blob line, and no access field at all.
  assert.deepEqual([g2.id, g2.scanned, g2.tilde, g2.guessed_home, g2.recorded], ['b82-r2', true, 1, 0, 'not_recorded']);
  assert.equal(r.guessed_paths.verdict, 'found');
  assert.equal(r.guessed_paths.guessed_home_total, 1);
  assert.equal(r.guessed_paths.tilde_total, 1);

  const md = r.extra_files['82-MEASUREMENT.md'];
  assert.match(md, /\| b82-r2 \| scanned \| 1 \| 0 \| not recorded \| not recorded \| not recorded \|/);
  assert.match(md, /\| b82-r1 \| scanned \| 0 \| 1 \| 0 \| 1 \| 0 \|/);
  assert.match(md, /Grep `<home>\/\.claude\/aoforge`/);
  assert.doesNotMatch(md, /realuser/);
  assert.doesNotMatch(md, /Guessed runtime paths: none/);
});

test('13: a run with no transcripts is "not scanned", never "none"', () => {
  const s = setup({ r1Access: EMPTY_ACCESS, r1Extra: [], r2Access: EMPTY_ACCESS, r2Transcripts: false });
  const r = score(opts(s));
  const [g1, g2] = r.guessed_paths.runs;
  assert.deepEqual([g1.scanned, g1.tilde, g1.guessed_home], [true, 0, 0]);
  assert.deepEqual([g2.scanned, g2.files_scanned], [false, 0]);
  assert.equal(r.guessed_paths.verdict, 'incomplete');
  const md = r.extra_files['82-MEASUREMENT.md'];
  assert.match(md, /\| b82-r2 \| not scanned \|/);
  assert.doesNotMatch(md, /Guessed runtime paths: none/);
});

test('13: "none" only when every run was scanned and all five counts are 0', () => {
  const s = setup({ r1Access: EMPTY_ACCESS, r1Extra: [], r2Access: EMPTY_ACCESS, r2Extra: [] });
  const r = score(opts(s));
  assert.equal(r.guessed_paths.verdict, 'none');
  assert.match(r.extra_files['82-MEASUREMENT.md'], /Guessed runtime paths: none/);
  // The same runs with no access field: the recorded classes are unknown, so not "none".
  const t = setup({ r1Access: null, r1Extra: [], r2Extra: [] });
  const rt = score(opts(t));
  assert.equal(rt.guessed_paths.runs[0].recorded, 'not_recorded');
  assert.notEqual(rt.guessed_paths.verdict, 'none');
});

test('12: the measurement report has the sections 82-09 builds on', () => {
  const s = setup();
  const md = score(opts(s)).extra_files['82-MEASUREMENT.md'];
  for (const h of ['## Method', '## Outcomes', '## Per role', '## Per run', '## Guessed runtime paths', '## Mechanism checks', '## Limits']) {
    assert.ok(md.includes(`\n${h}\n`), `missing ${h}`);
  }
  assert.match(md, /n=2 vs n=2/);
  assert.match(md, /2\.1\.302 \(Claude Code\)/);
  assert.match(md, /2\.1\.400/);
  assert.match(md, /\| planner \| first-turn input \| 40,000 \| 50,000 \| 52,000 \| \+12,000 \(\+30\.00%\) \| \+2,000 \(\+4\.00%\) \|/);
});

test('14: score.cjs --batch E writes results/E.json, results/E.md and 82-MEASUREMENT.md, deterministically', async () => {
  const s = setup();
  ledgerLib.saveLedger(path.join(s.root, 'ledger.json'), initialLedger());
  const outs = [tmp(), tmp()];
  for (const out of outs) {
    const lines = [];
    const code = await main(['--batch', 'E', '--root', s.root, '--out', out], {
      now: NOW, stdout: (x) => lines.push(x), stderr: (x) => lines.push(x),
      scorerOpts: { rates: RATES, e81Path: s.e81Path, homeParent: HOME_PARENT, realHome: REAL_HOME },
    });
    assert.equal(code, 0, lines.join(''));
  }
  for (const rel of ['results/E.json', 'results/E.md', '82-MEASUREMENT.md']) {
    const a = fs.readFileSync(path.join(outs[0], rel), 'utf-8');
    const b = fs.readFileSync(path.join(outs[1], rel), 'utf-8');
    assert.equal(a, b, `${rel} differs between two runs`);
  }
  const saved = JSON.parse(fs.readFileSync(path.join(outs[0], 'results', 'E.json'), 'utf-8'));
  assert.equal(saved.batch, 'E');
  assert.equal(saved.scored_at, '2026-10-18T12:00:00.000Z');
  assert.equal(saved.spend.batch, 'E');
  assert.equal(saved.spend.spent_usd, 0);
  assert.equal(saved.extra_files, undefined);
  assert.match(fs.readFileSync(path.join(outs[0], 'results', 'E.md'), 'utf-8'), /# Batch E \(objective 82\) results/);
});

test('14: score.cjs refuses without a ledger and with an unknown batch', async () => {
  const s = setup();
  const errs = [];
  assert.equal(await main(['--batch', 'E', '--root', s.root, '--out', tmp()], { now: NOW, stdout: () => {}, stderr: (x) => errs.push(x) }), 1);
  assert.match(errs.join(''), /ledger/);
  assert.equal(await main(['--batch', 'Z', '--root', s.root, '--out', tmp()], { now: NOW, stdout: () => {}, stderr: (x) => errs.push(x) }), 1);
  assert.match(errs.join(''), /usage:/);
});
