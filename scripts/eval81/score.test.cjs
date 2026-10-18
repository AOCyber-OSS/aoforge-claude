'use strict';

// Tests for scripts/eval81/score.cjs (TRD 81-02, test list 1-3, 2b, 3b): the scoring CLI that loads a batch
// scorer (scripts/eval81/score/<X>.cjs, TRDs 81-09..81-12), adds the spend block copied from <root>/ledger.json and
// writes results/<X>.json and results/<X>.md, and `--report`, which renders 81-HAIKU-EVAL.md from results/{A,B,C,D}.
//
// Every scorer here is a stub written into a temp --scorer-dir, and every ledger and result is a hand-built literal.
// Temp dirs come from os.tmpdir(), so run with TMPDIR under the session scratchpad. No test calls the API.

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fx = require('./__fixtures__/metrics.cjs');

const CLI = path.join(__dirname, 'score.cjs');
const SCORED_AT = '2026-10-17T18:30:00.000Z';

// Loaded per test, so a missing module fails each test with its own name.
const load = () => require('./score.cjs');

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-score-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function dir(name) {
  const d = path.join(tmp, name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** listTree(d) -> sorted relative file paths under d. */
function listTree(d) {
  if (!fs.existsSync(d)) return [];
  const out = [];
  const walk = (cur, rel) => {
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(cur, e.name), r);
      else out.push(r);
    }
  };
  walk(d, '');
  return out.sort();
}

/** capture() -> {deps, out, err}: deps for main() that record stdout/stderr and pin the clock. */
function capture() {
  const out = [];
  const err = [];
  return {
    deps: { stdout: (s) => out.push(s), stderr: (s) => err.push(s), now: () => new Date(SCORED_AT) },
    out,
    err,
  };
}

// A LedgerEntry per TRD 81-01's contract.
function entry(id, batch, charged) {
  return { id, batch, role: batch === 'A' ? 'verifier' : 'job-checker', status: 'ok', cap_usd: 0.5,
    reserve_usd: 0.625, reported_usd: charged, transcript_usd: charged, charged_usd: charged, cost_source: 'reported',
    overshoot_usd: Math.max(0, charged - 0.5), at: '2026-10-17T17:00:00.000Z' };
}

// A ledger with A complete (two runs, 0.50 + 0.80) and B running (one run, 0.40): total 1.70.
function ledger() {
  return {
    version: 1,
    cap_usd: 100,
    order: ['A', 'B', 'D', 'E', 'C'],
    batches: {
      A: { cap_usd: 7.5, estimate_usd: 5, status: 'complete', spent_usd: 1.3 },
      B: { cap_usd: 6, estimate_usd: 4, status: 'running', spent_usd: 0.4 },
      D: { cap_usd: 3, estimate_usd: 2, status: 'pending', spent_usd: 0 },
      E: { cap_usd: 55, estimate_usd: 40, status: 'pending', spent_usd: 0 },
      C: { cap_usd: null, estimate_usd: 10, status: 'pending', spent_usd: 0 },
    },
    entries: [entry('A-haiku-A1-r1', 'A', 0.5), entry('B-haiku-B1-r1', 'B', 0.4), entry('A-sonnet-A1-r1', 'A', 0.8)],
  };
}

function writeLedger(root, value = ledger()) {
  fs.writeFileSync(path.join(root, 'ledger.json'), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

/** stubScorer(scorerDir, batch, result): writes <scorerDir>/<batch>.cjs returning `result` plus the args it got. */
function stubScorer(scorerDir, batch, result, { async = false } = {}) {
  const body = `const RESULT = ${JSON.stringify(result)};
module.exports = { score: ({ root, outDir }) => {
  const out = { ...RESULT, notes: [...(RESULT.notes || []), 'root=' + root, 'outDir=' + outDir] };
  return ${async ? 'Promise.resolve(out)' : 'out'};
} };
`;
  fs.writeFileSync(path.join(scorerDir, `${batch}.cjs`), body);
}

describe('score CLI: batch selection (test list 1)', () => {
  test('--batch Z exits 1 naming the valid batches (real process)', () => {
    const r = spawnSync(process.execPath, [CLI, '--batch', 'Z'], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unknown batch Z/);
    assert.match(r.stderr, /A, B, C, D, E/);
  });

  test('--batch A with no scorer installed exits 1 with the 81-09 hint (real process)', () => {
    const empty = dir('scorers');
    const r = spawnSync(process.execPath, [CLI, '--batch', 'A', '--scorer-dir', empty], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /scorer for batch A not installed \(TRD 81-09\.\.81-12\)/);
    assert.match(r.stderr, new RegExp(path.join(empty, 'A.cjs').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('the default scorer dir is scripts/eval81/score/', () => {
    assert.equal(load().scorerPath('C'), path.join(__dirname, 'score', 'C.cjs'));
    assert.equal(load().scorerPath('C', '/x/y'), path.join('/x/y', 'C.cjs'));
  });

  test('a lower-case batch, a missing --root/--out, and an unknown flag are usage errors', async () => {
    const scorers = dir('scorers');
    stubScorer(scorers, 'A', fx.aPass());
    for (const argv of [['--batch', 'a', '--scorer-dir', scorers], ['--batch', 'A', '--scorer-dir', scorers],
      ['--batch', 'A', '--scorer-dir', scorers, '--root', tmp], ['--frobnicate'], [], ['--batch', 'A', '--report']]) {
      const c = capture();
      assert.equal(await load().main(argv, c.deps), 1, argv.join(' '));
      assert.ok(c.err.join('').length > 0, argv.join(' '));
    }
  });
});

describe('score CLI: --batch writes results with the spend block (test list 2)', () => {
  test('results/A.json deep-equals the scorer output plus scored_at and spend; results/A.md carries the spend line', async () => {
    const root = dir('root');
    const out = dir('out');
    const scorers = dir('scorers');
    writeLedger(root);
    const stub = fx.aPass();
    delete stub.scored_at;
    stubScorer(scorers, 'A', stub);

    const c = capture();
    const code = await load().main(['--batch', 'A', '--root', root, '--out', out, '--scorer-dir', scorers], c.deps);
    assert.equal(code, 0, c.err.join(''));

    const saved = JSON.parse(fs.readFileSync(path.join(out, 'results', 'A.json'), 'utf8'));
    const l = ledger();
    assert.deepEqual(saved, {
      ...stub,
      notes: [`root=${root}`, `outDir=${out}`],
      scored_at: SCORED_AT,
      spend: {
        ledger_version: 1,
        batch: 'A',
        status: 'complete',
        spent_usd: 1.3,
        ledger_total_usd: 1.7,
        entries: [l.entries[0], l.entries[2]],
      },
    });
    // 2-space JSON with a trailing newline.
    assert.match(fs.readFileSync(path.join(out, 'results', 'A.json'), 'utf8'), /^\{\n {2}"batch": "A",[\s\S]*\}\n$/);

    const md = fs.readFileSync(path.join(out, 'results', 'A.md'), 'utf8');
    assert.match(md, /^# Batch A results/);
    assert.match(md, /spent \$1\.30 of the batch; ledger total \$1\.70/);

    // Written only under --out; the eval root is untouched.
    assert.deepEqual(listTree(out), ['results/A.json', 'results/A.md']);
    assert.deepEqual(listTree(root), ['ledger.json']);
    assert.match(c.out.join(''), /"batch":"A"/);
  });

  test('a scorer returning a Promise is awaited', async () => {
    const root = dir('root');
    const out = dir('out');
    const scorers = dir('scorers');
    writeLedger(root);
    stubScorer(scorers, 'B', fx.bResult(), { async: true });
    const c = capture();
    assert.equal(await load().main(['--batch', 'B', '--root', root, '--out', out, '--scorer-dir', scorers], c.deps), 0);
    const saved = JSON.parse(fs.readFileSync(path.join(out, 'results', 'B.json'), 'utf8'));
    assert.equal(saved.spend.status, 'running');
    assert.deepEqual(saved.spend.entries.map((e) => e.id), ['B-haiku-B1-r1']);
  });

  test('a scorer that returns another batch, or throws, exits 1 and writes nothing', async () => {
    const root = dir('root');
    const out = dir('out');
    const scorers = dir('scorers');
    writeLedger(root);
    stubScorer(scorers, 'A', fx.bResult());
    fs.writeFileSync(path.join(scorers, 'B.cjs'), "module.exports = { score: () => { throw new Error('boom'); } };\n");
    const c1 = capture();
    assert.equal(await load().main(['--batch', 'A', '--root', root, '--out', out, '--scorer-dir', scorers], c1.deps), 1);
    assert.match(c1.err.join(''), /returned batch B/);
    const c2 = capture();
    assert.equal(await load().main(['--batch', 'B', '--root', root, '--out', out, '--scorer-dir', scorers], c2.deps), 1);
    assert.match(c2.err.join(''), /boom/);
    assert.deepEqual(listTree(out), []);
  });
});

describe('score CLI: no ledger, no results (test list 2b)', () => {
  test('a missing <root>/ledger.json exits 1 naming the path and writes nothing', async () => {
    const root = dir('root');
    const out = dir('out');
    const scorers = dir('scorers');
    stubScorer(scorers, 'A', fx.aPass());
    const c = capture();
    assert.equal(await load().main(['--batch', 'A', '--root', root, '--out', out, '--scorer-dir', scorers], c.deps), 1);
    assert.match(c.err.join(''), new RegExp(path.join(root, 'ledger.json').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.deepEqual(listTree(out), []);
  });

  test('an unparseable ledger, or one with no row for the batch, exits 1 and writes nothing', async () => {
    const root = dir('root');
    const out = dir('out');
    const scorers = dir('scorers');
    stubScorer(scorers, 'A', fx.aPass());
    writeLedger(root, '{"version": 1, "batches": ');
    const c1 = capture();
    assert.equal(await load().main(['--batch', 'A', '--root', root, '--out', out, '--scorer-dir', scorers], c1.deps), 1);
    assert.match(c1.err.join(''), /ledger\.json/);
    const l = ledger();
    delete l.batches.A;
    writeLedger(root, l);
    const c2 = capture();
    assert.equal(await load().main(['--batch', 'A', '--root', root, '--out', out, '--scorer-dir', scorers], c2.deps), 1);
    assert.match(c2.err.join(''), /no batch A row/);
    assert.deepEqual(listTree(out), []);
  });
});

describe('score CLI: --report (test list 3)', () => {
  test('A, B and D results with no C: 81-HAIKU-EVAL.md reads the C roles INSUFFICIENT "batch C not run"', async () => {
    const out = dir('out');
    fs.mkdirSync(path.join(out, 'results'));
    for (const [batch, result] of [['A', fx.aPass()], ['B', fx.bResult()], ['D', fx.dResult()]]) {
      fs.writeFileSync(path.join(out, 'results', `${batch}.json`), JSON.stringify(result, null, 2));
    }
    const c = capture();
    assert.equal(await load().main(['--report', '--out', out], c.deps), 0, c.err.join(''));
    const md = fs.readFileSync(path.join(out, '81-HAIKU-EVAL.md'), 'utf8');
    for (const role of fx.C_ROLES) {
      assert.ok(md.includes(`### ${role} (batch C): INSUFFICIENT\n`), role);
    }
    assert.match(md, /- batch C not run/);
    assert.match(md, /### verifier \(batch A\): WEAK_ENDORSE/);
    assert.match(md, /No tier assignment was changed by objective 81; proposals await the user's decision\./);
    // Only the report is added under --out.
    assert.deepEqual(listTree(out), ['81-HAIKU-EVAL.md', 'results/A.json', 'results/B.json', 'results/D.json']);
  });

  test('no results at all: every role INSUFFICIENT, and a corrupt result file exits 1 naming it', async () => {
    const out = dir('out');
    const c = capture();
    assert.equal(await load().main(['--report', '--out', out], c.deps), 0, c.err.join(''));
    const md = fs.readFileSync(path.join(out, '81-HAIKU-EVAL.md'), 'utf8');
    assert.equal([...md.matchAll(/^### .+: INSUFFICIENT$/gm)].length, 11);

    fs.mkdirSync(path.join(out, 'results'), { recursive: true });
    fs.writeFileSync(path.join(out, 'results', 'B.json'), '{not json');
    const c2 = capture();
    assert.equal(await load().main(['--report', '--out', out], c2.deps), 1);
    assert.match(c2.err.join(''), /results[\\/]B\.json/);
  });

  test('--report reads the tiers from this checkout and never changes them', async () => {
    const repo = path.join(__dirname, '..', '..');
    const profilesPath = path.join(repo, 'plugins', 'aoforge', 'aoforge', 'references', 'model-profiles.json');
    const packPath = path.join(repo, 'plugins', 'aoforge-stack-flutter', 'aoforge-stack.json');
    const before = [fs.readFileSync(profilesPath, 'utf8'), fs.readFileSync(packPath, 'utf8')];
    const out = dir('out');
    fs.mkdirSync(path.join(out, 'results'));
    fs.writeFileSync(path.join(out, 'results', 'D.json'), JSON.stringify(fx.dResult()));
    fs.writeFileSync(path.join(out, 'results', 'A.json'), JSON.stringify(fx.aPass()));
    const c = capture();
    assert.equal(await load().main(['--report', '--out', out], c.deps), 0, c.err.join(''));
    assert.deepEqual([fs.readFileSync(profilesPath, 'utf8'), fs.readFileSync(packPath, 'utf8')], before);
    const md = fs.readFileSync(path.join(out, '81-HAIKU-EVAL.md'), 'utf8');
    // The report follows the live pack's start tier. TRD 82-03 applied 81's P1 (haiku on budget and balanced) and TRD
    // 82-08 reverted it after its measurement (82-TIER-CHECKS.md: one broken state ended ok), so the live pack starts
    // ui-evaluator at sonnet on both again and the report proposes haiku for both.
    const tiers = JSON.parse(before[1]).models['ui-evaluator'];
    const lower = ['budget', 'balanced'].filter((p) => tiers[p] !== 'haiku');
    assert.deepEqual(lower, ['budget', 'balanced'], 'the live pack starts ui-evaluator above haiku (P1 reverted by 82-08)');
    assert.match(md, /start ui-evaluator at haiku on budget\/balanced, escalate on split votes/);
    assert.doesNotMatch(md, /ui-evaluator already starts at haiku/);
  });
});

describe('score CLI: extra_files (test list 3b)', () => {
  const eResult = (extra) => ({ batch: 'E', roles: {}, runs: [], excluded: [], notes: [], per_role: { planner: 1 },
    extra_files: extra });

  test('each extra file is written under --out and extra_files is stripped from the saved JSON', async () => {
    const root = dir('root');
    const out = dir('out');
    const scorers = dir('scorers');
    writeLedger(root);
    stubScorer(scorers, 'E', eResult({ '81-MEASUREMENT.md': '# 76-08 measurement\n', 'measure/runs.md': 'rows\n' }));
    const c = capture();
    assert.equal(await load().main(['--batch', 'E', '--root', root, '--out', out, '--scorer-dir', scorers], c.deps), 0,
      c.err.join(''));
    assert.equal(fs.readFileSync(path.join(out, '81-MEASUREMENT.md'), 'utf8'), '# 76-08 measurement\n');
    assert.equal(fs.readFileSync(path.join(out, 'measure', 'runs.md'), 'utf8'), 'rows\n');
    const saved = JSON.parse(fs.readFileSync(path.join(out, 'results', 'E.json'), 'utf8'));
    assert.equal('extra_files' in saved, false);
    assert.deepEqual(saved.per_role, { planner: 1 });
    assert.equal(saved.spend.batch, 'E');
    assert.deepEqual(saved.spend.entries, []);
    assert.deepEqual(listTree(out), ['81-MEASUREMENT.md', 'measure/runs.md', 'results/E.json', 'results/E.md']);
  });

  test('an absolute path or one containing .. is refused before anything is written', async () => {
    for (const bad of [path.join(tmp, 'abs.md'), '../escape.md', 'a/../../escape.md', 'a/..', '']) {
      const root = dir(`root-${Math.random().toString(36).slice(2)}`);
      const out = dir(`out-${Math.random().toString(36).slice(2)}`);
      const scorers = dir(`scorers-${Math.random().toString(36).slice(2)}`);
      writeLedger(root);
      stubScorer(scorers, 'E', eResult({ 'ok.md': 'fine\n', [bad]: 'nope\n' }));
      const c = capture();
      assert.equal(await load().main(['--batch', 'E', '--root', root, '--out', out, '--scorer-dir', scorers], c.deps), 1,
        `path ${JSON.stringify(bad)}`);
      assert.match(c.err.join(''), /extra_files/);
      assert.deepEqual(listTree(out), [], `path ${JSON.stringify(bad)}`);
    }
    assert.equal(fs.existsSync(path.join(tmp, 'abs.md')), false);
    assert.equal(fs.existsSync(path.join(tmp, 'escape.md')), false);
  });
});
