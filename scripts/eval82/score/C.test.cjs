'use strict';
// TRD 82-06 test list 6: the objective-82 batch C scorer on hand-built researcher and grader records, one researcher
// run copied from objective 81's recorded C-res-architecture-h-2 (runs-81/, `access` empty, two `~` Reads), and a
// hand-built objective-81 C.json. The guessed-path counts come from the transcripts (lib/guessed-paths.cjs) beside
// the runner's recorded classes, never from record.access alone.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { score, renderResults, DEFAULT_C81 } = require('./C.cjs');
const { main } = require('../score.cjs');
const ledgerLib = require('../../eval81/lib/ledger.cjs');
const { wilson } = require('../../eval81/lib/stats.cjs');
const { initialLedger } = require('../ledger82.cjs');
const { runRecord, writeRunDir, toolUseRow } = require('../__fixtures__/records.cjs');

const dirs = [];
const tmp = (prefix = 'e82-scoreC-') => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
};
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

const HOME_PARENT = '/Users';
const REAL_HOME = '/Users/realuser';
const NOW = () => new Date('2026-10-18T12:00:00.000Z');
const RUNS_81 = path.join(__dirname, '..', '__fixtures__', 'runs-81');
const CHECKLISTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'C', 'checklists-82.json'), 'utf8'));
const GA_ARCH = CHECKLISTS.topics.gateway.architecture.map((i) => i.id);
const HU_PIT = CHECKLISTS.topics.hub.pitfalls.map((i) => i.id);

/** Grader items for every id of `ids`: `found` for the ids in `found`, `wrong` for those in `wrong`, else missing. */
function verdicts(ids, found, wrong = []) {
  return ids.map((id) => {
    if (found.includes(id)) return { id, verdict: 'found', evidence: `quote for ${id}` };
    if (wrong.includes(id)) return { id, verdict: 'wrong', evidence: `contrary quote for ${id}` };
    return { id, verdict: 'missing', evidence: '' };
  });
}

const DOC = (dim) => `===== ${dim === 'architecture' ? 'ARCHITECTURE' : 'PITFALLS'}.md =====\n\nhand-built document\n`;
const EMPTY_ACCESS = { real: [], non_escape: [], impaired: false, impaired_by: [] };

function researcher(root, id, { model, dim = 'architecture', status = 'ok', cost, charged, document = DOC(dim), access = EMPTY_ACCESS, lines } = {}) {
  const outputs = document === null ? undefined : { kind: 'researcher', role: `project-researcher:${dim}`, document };
  writeRunDir(root, 'C', id, {
    record: runRecord({ id, batch: 'C', model, status, role: 'project-researcher', cost, charged, access, outputs }),
    lines,
  });
}

function grader(root, of, { items, fabrications = [], status = 'ok', cost = 0.06, charged = 0.06 }) {
  const id = `C82-grade-${of}`;
  writeRunDir(root, 'C', id, {
    record: runRecord({ id, batch: 'C', model: 'sonnet', status, role: 'grader', cost, charged, outputs: { kind: 'grader', graded: { items, fabrications }, source: 'structured_output' } }),
  });
}

/** A hand-built objective-81 results/C.json with the two researcher roles 82 carries forward. */
function c81Json() {
  const model = (k, n, fab, cost, gcost) => ({
    n_scored: 2, n_impaired: 0, planned: 2,
    metrics: { recall: { k, n }, error: { k: 0, n }, missing: { k: n - k, n }, fabrications: { total: fab, runs: 2 } },
    cost_usd: cost, grader_cost_usd: gcost, mean_wall_ms: 60000,
  });
  return {
    batch: 'C',
    roles: {
      'project-researcher:stack': { primary: 'recall', planned: { haiku: 2, sonnet: 2 }, models: { haiku: model(1, 2, 0, 0.1, 0.1), sonnet: model(2, 2, 0, 0.2, 0.1) } },
      'project-researcher:architecture': { primary: 'recall', planned: { haiku: 2, sonnet: 2 }, models: { haiku: model(21, 22, 0, 0.08, 0.13), sonnet: model(17, 22, 0, 0.27, 0.12) } },
      'project-researcher:pitfalls': { primary: 'recall', planned: { haiku: 2, sonnet: 2 }, models: { haiku: model(18, 24, 1, 0.09, 0.13), sonnet: model(20, 24, 0, 0.38, 0.13) } },
    },
    runs: [
      { id: 'C-res-architecture-s-1', model: 'sonnet', role: 'project-researcher:architecture', fixture: 'topic', verdict: 'graded', found: 8, wrong: 0, missing: 3, items: 11, grader_fabrications: 0, path_fabrications: 0 },
      { id: 'C-res-pitfalls-h-1', model: 'haiku', role: 'project-researcher:pitfalls', fixture: 'topic', verdict: 'graded', found: 9, wrong: 0, missing: 3, items: 12, grader_fabrications: 1, path_fabrications: 0 },
      { id: 'C-res-stack-h-1', model: 'haiku', role: 'project-researcher:stack', fixture: 'topic', verdict: 'graded', found: 1, wrong: 0, missing: 0, items: 1, grader_fabrications: 0, path_fabrications: 0 },
      { id: 'C-map-tech-a-h-1', model: 'haiku', role: 'codebase-mapper:tech', fixture: 'synthetic', verdict: 'graded', found: 5, wrong: 0, missing: 0, items: 5, grader_fabrications: 0, path_fabrications: 0 },
    ],
  };
}

function setup() {
  const root = tmp();
  // gateway / architecture: all four runs graded.
  const g = 'C82-res-gateway-architecture';
  const A = (...n) => n.map((x) => `GA-A${String(x).padStart(2, '0')}`);
  researcher(root, `${g}-s-1`, { model: 'sonnet', cost: 0.14, charged: 0.15 });
  grader(root, `${g}-s-1`, { items: verdicts(GA_ARCH, A(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)) });
  researcher(root, `${g}-h-1`, { model: 'haiku', cost: 0.04, charged: 0.04 });
  grader(root, `${g}-h-1`, { items: verdicts(GA_ARCH, A(1, 2, 3, 4, 5, 6, 7, 8), A(12)), fabrications: [{ claim: 'modelgate ships a gRPC admin port', why: 'not in the summary' }] });
  researcher(root, `${g}-h-2`, {
    model: 'haiku', cost: 0.05, charged: 0.05,
    access: { real: [], non_escape: [{ class: 'guessed_nonexistent', tool: 'Read', denied: false, path: '/Users/nobody/.claude/aoforge/templates/research-project/ARCHITECTURE.md' }], impaired: false, impaired_by: [] },
    lines: {
      'k/session-h2.jsonl': [toolUseRow([{ id: 'tu_guess', name: 'Read', input: { file_path: '/Users/nobody/.claude/aoforge/templates/research-project/ARCHITECTURE.md' } }])],
    },
  });
  grader(root, `${g}-h-2`, { items: verdicts(GA_ARCH, A(2, 3, 4, 5, 6, 7, 8, 9)) });
  researcher(root, `${g}-s-2`, { model: 'sonnet', cost: 0.13, charged: 0.13 });
  grader(root, `${g}-s-2`, { items: verdicts(GA_ARCH, A(1, 2, 3, 4, 5, 6, 7, 8, 9, 11)) });

  // gateway / pitfalls: a failed grader and a capped researcher.
  researcher(root, 'C82-res-gateway-pitfalls-h-1', { model: 'haiku', dim: 'pitfalls', cost: 0.05, charged: 0.05 });
  grader(root, 'C82-res-gateway-pitfalls-h-1', { items: [], status: 'error' });
  researcher(root, 'C82-res-gateway-pitfalls-s-1', { model: 'sonnet', dim: 'pitfalls', status: 'cap_hit', cost: 0.6, charged: 0.6 });

  // hub / architecture h-1: objective 81's recorded C-res-architecture-h-2, copied (record + transcripts), no document.
  const hubDir = path.join(root, 'runs', 'C', 'C82-res-hub-architecture-h-1');
  fs.cpSync(path.join(RUNS_81, 'C-res-architecture-h-2'), hubDir, { recursive: true });
  const rec = JSON.parse(fs.readFileSync(path.join(hubDir, 'record.json'), 'utf8'));
  fs.writeFileSync(path.join(hubDir, 'record.json'), JSON.stringify({ ...rec, id: 'C82-res-hub-architecture-h-1', model: 'haiku', cost_usd: 0.04, charged_usd: 0.04 }, null, 2));

  // hub / pitfalls s-1: no `access` field, and a grader that left items without a verdict.
  researcher(root, 'C82-res-hub-pitfalls-s-1', { model: 'sonnet', dim: 'pitfalls', cost: 0.19, charged: 0.19, access: null });
  grader(root, 'C82-res-hub-pitfalls-s-1', { items: verdicts(HU_PIT.slice(0, 9), HU_PIT.slice(0, 5)) });

  const c81Path = path.join(tmp(), 'C.json');
  fs.writeFileSync(c81Path, JSON.stringify(c81Json(), null, 2));
  return { root, c81Path };
}

const opts = (s) => ({ root: s.root, outDir: tmp(), c81Path: s.c81Path, homeParent: HOME_PARENT, realHome: REAL_HOME, now: NOW });

test('6a: recall per topic x dimension x model with Wilson intervals, and pooled over the new topics', () => {
  const s = setup();
  const r = score(opts(s));
  assert.equal(r.batch, 'C');
  assert.equal(r.objective, 82);
  assert.deepEqual(r.topics, ['gateway', 'hub']);
  assert.deepEqual(r.dimensions, ['architecture', 'pitfalls']);
  assert.deepEqual(r.planned, { researcher: 16, per_cell: 2 });

  const gh = r.cells.gateway.architecture.haiku;
  assert.equal(gh.graded_runs, 2);
  assert.deepEqual(gh.recall, wilson(16, 24));
  assert.equal(gh.fabrications_total, 1);
  assert.equal(gh.fabrications_per_run, 0.5);
  assert.deepEqual(gh.runs, ['C82-res-gateway-architecture-h-1', 'C82-res-gateway-architecture-h-2']);
  const gs = r.cells.gateway.architecture.sonnet;
  assert.equal(gs.graded_runs, 2);
  assert.deepEqual(gs.recall, wilson(20, 24));
  assert.equal(gs.fabrications_per_run, 0);
  const hp = r.cells.hub.pitfalls.sonnet;
  assert.equal(hp.graded_runs, 0);
  assert.deepEqual(hp.recall, wilson(0, 0));
  assert.equal(hp.fabrications_per_run, null);

  assert.deepEqual(r.pooled.architecture.haiku.recall, wilson(16, 24));
  assert.equal(r.pooled.architecture.haiku.graded_runs, 2);
  assert.equal(r.pooled.architecture.haiku.fabrications_per_run, 0.5);
  assert.deepEqual(r.pooled.architecture.sonnet.recall, wilson(20, 24));
  assert.equal(r.pooled.pitfalls.haiku.graded_runs, 0);
  assert.equal(r.pooled.pitfalls.haiku.recall.rate, null);
});

test('6b: per-run verdicts, grader fabrications, cost, and the reason a run is not graded', () => {
  const s = setup();
  const r = score(opts(s));
  const byId = new Map(r.runs.map((x) => [x.id, x]));
  assert.equal(r.runs.length, 16);
  const h1 = byId.get('C82-res-gateway-architecture-h-1');
  assert.deepEqual([h1.verdict, h1.found, h1.wrong, h1.missing, h1.items, h1.fabrications], ['graded', 8, 1, 3, 12, 1]);
  assert.deepEqual([h1.cost_usd, h1.charged_usd, h1.grader_cost_usd, h1.grader_charged_usd], [0.04, 0.04, 0.06, 0.06]);
  assert.deepEqual([byId.get('C82-res-gateway-pitfalls-h-1').verdict, byId.get('C82-res-gateway-pitfalls-h-1').reason], ['excluded', 'ungraded: grader status error']);
  assert.deepEqual([byId.get('C82-res-gateway-pitfalls-s-1').verdict, byId.get('C82-res-gateway-pitfalls-s-1').reason], ['excluded', 'status cap_hit']);
  assert.deepEqual([byId.get('C82-res-hub-architecture-h-1').verdict, byId.get('C82-res-hub-architecture-h-1').reason], ['excluded', 'no document (recorded absence)']);
  assert.deepEqual([byId.get('C82-res-hub-pitfalls-s-1').verdict, byId.get('C82-res-hub-pitfalls-s-1').reason], ['excluded', 'ungraded: the grader left 2 of 11 items without a verdict']);
  const notRun = byId.get('C82-res-hub-pitfalls-h-2');
  assert.deepEqual([notRun.verdict, notRun.status, notRun.found], ['not_run', 'not_run', null]);

  // Cost: the researcher and grader sums the ledger charged.
  assert.deepEqual(r.cost, { researcher_charged_usd: { haiku: 0.18, sonnet: 1.07 }, grader_charged_usd: 0.36, total_charged_usd: 1.61 });
});

test('6c: the item matrix counts, per item, the runs of each model that found it', () => {
  const s = setup();
  const r = score(opts(s));
  const m = new Map(r.item_matrix.gateway.architecture.map((row) => [row.id, row]));
  assert.equal(m.size, 12);
  assert.deepEqual(m.get('GA-A01'), { id: 'GA-A01', sonnet_found: 2, sonnet_graded: 2, haiku_found: 1, haiku_graded: 2 });
  assert.deepEqual(m.get('GA-A09'), { id: 'GA-A09', sonnet_found: 2, sonnet_graded: 2, haiku_found: 1, haiku_graded: 2 });
  assert.deepEqual(m.get('GA-A10'), { id: 'GA-A10', sonnet_found: 1, sonnet_graded: 2, haiku_found: 0, haiku_graded: 2 });
  assert.deepEqual(m.get('GA-A12'), { id: 'GA-A12', sonnet_found: 0, sonnet_graded: 2, haiku_found: 0, haiku_graded: 2 });
  assert.deepEqual(r.item_matrix.hub.pitfalls[0], { id: 'HU-P01', sonnet_found: 0, sonnet_graded: 0, haiku_found: 0, haiku_graded: 0 });
});

test('6d: guessed paths per researcher run come from the transcripts, beside the recorded classes', () => {
  const s = setup();
  const r = score(opts(s));
  const rows = new Map(r.guessed_paths.runs.map((x) => [x.id, x]));
  // Every researcher run with a record (the not-run ones are not runs); graders have no tools and are not scanned.
  assert.deepEqual([...rows.keys()].sort(), [
    'C82-res-gateway-architecture-h-1', 'C82-res-gateway-architecture-h-2', 'C82-res-gateway-architecture-s-1',
    'C82-res-gateway-architecture-s-2', 'C82-res-gateway-pitfalls-h-1', 'C82-res-gateway-pitfalls-s-1',
    'C82-res-hub-architecture-h-1', 'C82-res-hub-pitfalls-s-1',
  ]);
  // 81's C-res-architecture-h-2, whose access is empty: the scan sees its two `~` Reads (counted, not a failure).
  const hub = rows.get('C82-res-hub-architecture-h-1');
  assert.deepEqual([hub.files_scanned, hub.tool_uses_scanned, hub.tilde, hub.guessed_home], [1, 2, 2, 0]);
  assert.deepEqual(hub.recorded, { real: 0, guessed_nonexistent: 0, tilde_denied: 0 });
  const h2 = rows.get('C82-res-gateway-architecture-h-2');
  assert.deepEqual([h2.files_scanned, h2.tool_uses_scanned, h2.tilde, h2.guessed_home], [1, 1, 0, 1]);
  assert.deepEqual(h2.recorded, { real: 0, guessed_nonexistent: 1, tilde_denied: 0 });
  assert.deepEqual(h2.entries.map((e) => [e.class, e.tool, e.field]), [['guessed_home', 'Read', 'file_path']]);
  assert.deepEqual(h2.recorded_entries, [{ class: 'guessed_nonexistent', tool: 'Read', path: '/Users/nobody/.claude/aoforge/templates/research-project/ARCHITECTURE.md' }]);
  assert.deepEqual(hub.recorded_entries, []);
  assert.equal(rows.get('C82-res-hub-pitfalls-s-1').recorded, 'not_recorded');
  const s1 = rows.get('C82-res-gateway-architecture-s-1');
  assert.deepEqual([s1.files_scanned, s1.scanned], [0, false]);
  assert.deepEqual(r.guessed_paths.totals, { runs: 8, scanned: 2, unscanned: 6, tilde: 2, guessed_home: 1, real: 0, guessed_nonexistent: 1, tilde_denied: 0, not_recorded: 1 });
});

test('6e: objective 81\'s topic is carried as recorded context (aggregate only), from the given or the committed C.json', () => {
  const s = setup();
  const r = score(opts(s));
  const rec = r.recorded_81;
  assert.equal(rec.item_level, false);
  assert.match(rec.note, /aggregate only/);
  assert.deepEqual(Object.keys(rec.roles), ['architecture', 'pitfalls']);
  assert.deepEqual(rec.roles.architecture.haiku, { n_scored: 2, recall: { k: 21, n: 22 }, fabrications: { total: 0, runs: 2 }, cost_usd: 0.08, grader_cost_usd: 0.13 });
  assert.deepEqual(rec.roles.pitfalls.haiku.fabrications, { total: 1, runs: 2 });
  assert.deepEqual(rec.runs.map((x) => x.id), ['C-res-architecture-s-1', 'C-res-pitfalls-h-1']);
  assert.deepEqual(rec.runs[1], { id: 'C-res-pitfalls-h-1', model: 'haiku', dimension: 'pitfalls', verdict: 'graded', found: 9, wrong: 0, missing: 3, items: 12, grader_fabrications: 1 });

  // The committed 81 file is the default.
  const real = score({ root: s.root, outDir: tmp(), homeParent: HOME_PARENT, realHome: REAL_HOME, now: NOW });
  assert.ok(DEFAULT_C81.endsWith(path.join('81-haiku-eval-and-model-efficiency-measurement', 'results', 'C.json')));
  assert.deepEqual(real.recorded_81.roles.architecture.haiku.recall, { k: 21, n: 22 });
  assert.deepEqual(real.recorded_81.roles.architecture.sonnet.recall, { k: 17, n: 22 });

  // A missing file is said, not invented.
  const none = score({ ...opts(s), c81Path: path.join(tmp(), 'absent.json') });
  assert.equal(none.recorded_81.roles, null);
  assert.match(none.recorded_81.note, /not found/);
});

test('6f: score.cjs --batch C writes results/C.json and results/C.md, deterministically', async () => {
  const s = setup();
  ledgerLib.saveLedger(path.join(s.root, 'ledger.json'), initialLedger());
  const outs = [tmp(), tmp()];
  for (const out of outs) {
    const lines = [];
    const code = await main(['--batch', 'C', '--root', s.root, '--out', out, '--c81', s.c81Path, '--home-parent', HOME_PARENT, '--real-home', REAL_HOME], {
      now: NOW, stdout: (x) => lines.push(x), stderr: (x) => lines.push(x),
    });
    assert.equal(code, 0, lines.join(''));
  }
  for (const rel of ['results/C.json', 'results/C.md']) {
    assert.equal(fs.readFileSync(path.join(outs[0], rel), 'utf8'), fs.readFileSync(path.join(outs[1], rel), 'utf8'), `${rel} differs`);
  }
  const saved = JSON.parse(fs.readFileSync(path.join(outs[0], 'results', 'C.json'), 'utf8'));
  assert.equal(saved.batch, 'C');
  assert.equal(saved.scored_at, '2026-10-18T12:00:00.000Z');
  assert.equal(saved.spend.batch, 'C');
  const md = fs.readFileSync(path.join(outs[0], 'results', 'C.md'), 'utf8');
  assert.equal(md, renderResults(saved));
  for (const heading of ['# Batch C (objective 82) results', '## Recall per topic', '## Pooled over the new topics', '## Item matrix', '## Cost', '## Guessed runtime paths', '## Objective 81 topic (recorded context)']) {
    assert.ok(md.includes(heading), heading);
  }
  assert.match(md, /\| gateway \| architecture \| haiku \| 2 \| 16\/24 \(66\.7%/);
  assert.match(md, /C82-res-gateway-architecture-s-1 \| not scanned/);
  assert.ok(!/Read does not expand/i.test(md));
});
