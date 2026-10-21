'use strict';
// Tests for scripts/eval81/run.cjs and lib/runner.cjs (TRD 81-08, test list 1-11 and 16-22). Every run uses the fake
// claude (__fixtures__/fake-claude.cjs) and the stub batch (__fixtures__/stub-batch.cjs, loaded through one-line
// shims in a temp batch dir), a fake token with a random value, test rates (--rates), a temp --repo git repo, a temp
// --results-dir and a stand-in real home (--real-home). Nothing here runs the real claude binary, reads the real
// ~/.claude or writes this checkout.
//
// Layout per test: <base>/dev/repo (so the deny root dirname(repo) is <base>/dev), <base>/home (stand-in real home),
// <base>/eval (R), <base>/results, <base>/tree (a stub plugin tree for "3.1.0"), <base>/batches (shims).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const RUN = path.join(__dirname, 'run.cjs');
const FAKE = path.join(__dirname, '__fixtures__', 'fake-claude.cjs');
const STUB = path.join(__dirname, '__fixtures__', 'stub-batch.cjs');
const { TEST_RATES } = require(FAKE);
const { stubSpendBlock } = require(STUB);
const ledgerLib = require('./lib/ledger.cjs');
const { projectKey } = require('./lib/tripwire.cjs');
const { validateSpendBlock, validateRecord } = require('./lib/contract.cjs');

const loadMain = () => require('./run.cjs').main;

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
  '-c', 'commit.gpgsign=false', '-C', cwd, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf-8'));
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
};
const markerLines = (s) => (fs.existsSync(s.marker) ? fs.readFileSync(s.marker, 'utf-8').trim().split('\n').filter(Boolean).length : 0);

function tempRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"stand-in"}\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

function makeStubTree(dir, version) {
  const p = path.join(dir, 'plugins', 'aoforge');
  writeJson(path.join(p, '.claude-plugin', 'plugin.json'), { name: 'aoforge', version });
  fs.mkdirSync(path.join(p, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(p, 'agents', 'verifier.md'),
    '---\nname: verifier\ndescription: stub\ntools: Read, Write, Bash, Grep, Glob, Agent, mcp__gopls__*\n---\n\nStub verifier.\n');
  fs.mkdirSync(path.join(p, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(p, 'hooks', 'sync-runtime.js'), [
    "const fs = require('fs'); const path = require('path'); const os = require('os');",
    'const root = process.env.CLAUDE_PLUGIN_ROOT;',
    "const v = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf-8')).version;",
    "const t = path.join(os.homedir(), '.claude', 'aoforge');",
    "fs.mkdirSync(t, { recursive: true }); fs.writeFileSync(path.join(t, '.plugin-version'), v);",
    '',
  ].join('\n'));
  return dir;
}

/** A fresh test world. `stub` is the stub-batch.json config; `rootUnder` puts R inside dirname(repo). */
function setup({ stub = {}, rootUnder = false } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-run-')));
  const repo = tempRepo(path.join(base, 'dev', 'repo'));
  const home = path.join(base, 'home');
  fs.mkdirSync(path.join(home, '.claude', 'aoforge'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{}\n');
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# stand-in\n');
  fs.writeFileSync(path.join(home, '.claude', 'aoforge', '.plugin-version'), '3.1.0');
  fs.writeFileSync(path.join(home, '.claude', 'aoforge', 'calibration.json'), '{"version":3}\n');
  const root = rootUnder ? path.join(base, 'dev', 'eval') : path.join(base, 'eval');
  fs.mkdirSync(root, { recursive: true });
  const results = path.join(base, 'results');
  fs.mkdirSync(results, { recursive: true });
  const tree = makeStubTree(path.join(base, 'tree'), '3.1.0');
  writeJson(path.join(root, 'trees.json'), { '3.1.0': { ref: 'stub', sha: '0'.repeat(40), path: tree } });
  const batches = path.join(base, 'batches');
  fs.mkdirSync(batches, { recursive: true });
  for (const b of ['A', 'B', 'C', 'D', 'E']) {
    fs.writeFileSync(path.join(batches, `${b}.cjs`), `module.exports = require(${JSON.stringify(STUB)}).makeStubBatch('${b}');\n`);
  }
  const token = `fake-token-${crypto.randomBytes(16).toString('hex')}`;
  const tokenFile = path.join(base, 'token');
  fs.writeFileSync(tokenFile, `${token}\n`);
  const rates = path.join(base, 'rates.json');
  writeJson(rates, TEST_RATES);
  const marker = path.join(base, 'marker');
  const s = { base, repo, home, root, results, tree, batches, token, tokenFile, rates, marker };
  s.stub = (cfg = {}, r = root) => writeJson(path.join(r, 'stub-batch.json'), { marker, realHome: home, ...cfg });
  s.stub(stub);
  s.args = (batch = 'A', extra = [], r = root) => ['--batch', batch, '--root', r, '--token-file', tokenFile, '--claude-bin', FAKE,
    '--results-dir', results, '--repo', repo, '--batch-dir', batches, '--real-home', home, '--rates', rates, '--raw', ...extra];
  s.ledger = (r = root) => readJson(path.join(r, 'ledger.json'));
  s.runDir = (id, batch = 'A', r = root) => path.join(r, 'runs', batch, id);
  s.record = (id, batch = 'A', r = root) => readJson(path.join(s.runDir(id, batch, r), 'record.json'));
  return s;
}

/** Run main() in-process with a recording sleep (never waits) and a short kill grace. */
async function run(argv, deps = {}) {
  const out = [];
  const err = [];
  const sleeps = [];
  const code = await loadMain()(argv, {
    stdout: (x) => out.push(x),
    stderr: (x) => err.push(x),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    killGraceMs: 200,
    ...deps,
  });
  const stdout = out.join('');
  let report = null;
  try {
    report = JSON.parse(stdout);
  } catch {}
  return { code, stdout, stderr: err.join(''), report, sleeps };
}

/** Run the CLI as a child process (real stdout/stderr, a real parent env). */
function cli(argv, env = {}) {
  const r = spawnSync(process.execPath, [RUN, ...argv], { encoding: 'utf-8', env: { ...process.env, ...env }, timeout: 120000 });
  let report = null;
  try {
    report = JSON.parse(r.stdout);
  } catch {}
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, report };
}

function presetLedger(s, total) {
  const l = ledgerLib.newLedger();
  l.entries.push({ id: 'C-preset', batch: 'C', role: null, status: 'ok', cap_usd: null, reserve_usd: null, reported_usd: total,
    transcript_usd: null, charged_usd: total, cost_source: 'reported', overshoot_usd: 0, at: '2026-10-17T00:00:00.000Z' });
  l.batches.C.spent_usd = total;
  ledgerLib.saveLedger(path.join(s.root, 'ledger.json'), l);
}

describe('dry run, ledger and order', () => {
  test('1. a dry run with --init-ledger plans every run without spawning, then a live run treats those ids as pending', async () => {
    const s = setup();
    const r = cli(s.args('A', ['--dry-run', '--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.report.mode, 'dry_run');
    assert.equal(r.report.token_file_present, true);
    assert.deepEqual(r.report.planned.map((p) => p.id), ['A-stub-1', 'A-stub-2', 'A-stub-3']);
    for (const p of r.report.planned) {
      assert.equal(p.cap_usd, 0.5);
      assert.equal(p.reserve_usd, 0.625);
      assert.match(p.reserve_basis, /0\.5 x 1\.25 = 0\.625/);
      assert.equal(p.cap_basis, 'stub batch: fixed cap');
      const dir = s.runDir(p.id);
      const argvJson = readJson(path.join(dir, 'argv.json'));
      assert.ok(argvJson.args.includes('--settings'));
      assert.equal(argvJson.args[argvJson.args.indexOf('--settings') + 1], path.join(dir, 'settings.json'));
      assert.equal(argvJson.env.CLAUDE_CODE_OAUTH_TOKEN, '<redacted>');
      assert.ok(readJson(path.join(dir, 'settings.json')).permissions.deny.length > 0);
      assert.equal(s.record(p.id).status, 'dry_run');
    }
    assert.equal(r.report.worst_case_usd, 1.875);
    assert.equal(r.report.sum_caps_usd, 1.5);
    assert.equal(r.report.estimate_usd, ledgerLib.BATCH_ESTIMATES.A); // 3 since 81-14 post-hoc 2 (was 5)
    assert.equal(r.report.ledger.total_usd, 0);
    // --materialize first (the default): only the first run has a fixture and a runtime mirror.
    assert.ok(fs.existsSync(path.join(s.runDir('A-stub-1'), 'work', '.fake-scenario')));
    assert.ok(fs.existsSync(path.join(s.runDir('A-stub-1'), 'home', '.claude', 'aoforge', '.plugin-version')));
    assert.deepEqual(fs.readdirSync(path.join(s.runDir('A-stub-2'), 'work')), []);
    assert.equal(fs.existsSync(s.marker), false, 'the fake was never spawned');
    for (const text of [r.stdout, r.stderr, ...fs.readdirSync(s.runDir('A-stub-1')).filter((f) => f.endsWith('.json')).map((f) => fs.readFileSync(path.join(s.runDir('A-stub-1'), f), 'utf-8'))]) {
      assert.equal(text.includes(s.token), false);
    }
    const l = s.ledger();
    assert.equal(ledgerLib.totalUsd(l), 0);
    assert.ok(Object.values(l.batches).every((b) => b.status === 'pending'));

    const live = await run(s.args('A'));
    assert.equal(live.code, 0, live.stderr);
    assert.equal(markerLines(s), 3, 'dry_run is never done: all three ran');
    assert.ok(fs.existsSync(`${s.runDir('A-stub-1')}.prev-1`), 'the dry-run dir was moved aside');
    assert.equal(s.record('A-stub-1').status, 'ok');
  });

  test('2. no ledger and no --init-ledger exits 2 naming both --init-ledger and --rebuild-ledger', async () => {
    const s = setup();
    const r = await run(s.args('A'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /--init-ledger/);
    assert.match(r.stderr, /--rebuild-ledger/);
    assert.equal(fs.existsSync(s.marker), false);
  });

  test('3. a live run of B while A is pending exits 2 naming A; a dry run of B reports the order and is not refused', async () => {
    const s = setup();
    const r = await run(s.args('B', ['--init-ledger']));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /\bA\b/);
    assert.equal(fs.existsSync(s.marker), false);
    const d = await run(s.args('B', ['--dry-run']));
    assert.equal(d.code, 0, d.stderr);
    assert.equal(d.report.order.ok, false);
    assert.match(d.report.order.message, /\bA\b/);
    assert.equal(s.ledger().batches.B.status, 'pending');
  });

  test('lock: a second runner on the same root is refused with exit 2', async () => {
    const s = setup();
    fs.writeFileSync(path.join(s.root, '.runner.lock'), JSON.stringify({ pid: process.pid, batch: 'A' }));
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /another runner/);
    fs.writeFileSync(path.join(s.root, '.runner.lock'), JSON.stringify({ pid: 999999999, batch: 'A' }));
    const ok = await run(s.args('A', ['--init-ledger']));
    assert.equal(ok.code, 0, 'a stale lock (dead pid) is taken over');
    assert.equal(fs.existsSync(path.join(s.root, '.runner.lock')), false, 'the lock is released');
  });
});

describe('live runs', () => {
  test('4. happy: three ok runs, the ledger charges the fake\'s costs, the batch completes; a second run spawns nothing', async () => {
    const s = setup();
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(markerLines(s), 3);
    const records = ['A-stub-1', 'A-stub-2', 'A-stub-3'].map((id) => s.record(id));
    for (const rec of records) {
      assert.equal(rec.status, 'ok');
      assert.equal(rec.cost_usd, 0.05);
      assert.equal(rec.transcript_cost_usd, 0.05);
      assert.equal(rec.cost_source, 'reported');
      assert.equal(validateRecord(rec).ok, true, validateRecord(rec).errors.join('; '));
      const dir = s.runDir(rec.id);
      assert.ok(fs.statSync(path.join(dir, 'stream.jsonl')).size > 0);
      assert.ok(fs.existsSync(path.join(dir, 'stderr.txt')));
      assert.ok(fs.readdirSync(path.join(dir, 'transcripts')).length > 0);
      assert.deepEqual(readJson(path.join(dir, 'outputs', 'outputs.json')), { echo: true });
      assert.deepEqual(rec.outputs, { echo: true });
    }
    assert.deepEqual(records.map((x) => x.model_ran), [true, true, true]);
    const l = s.ledger();
    assert.equal(ledgerLib.totalUsd(l), 0.15);
    assert.equal(l.batches.A.status, 'complete');
    assert.deepEqual(readJson(path.join(s.root, 'queue', 'A.json')).done, ['A-stub-1', 'A-stub-2', 'A-stub-3']);
    assert.ok(fs.readFileSync(path.join(s.root, 'queue', 'A.log'), 'utf-8').includes('A-stub-3'));

    const again = await run(s.args('A'));
    assert.equal(again.code, 0);
    assert.equal(markerLines(s), 3, 'nothing spawned');
    assert.deepEqual(again.report.ran, []);
  });

  test('4b. a complete batch whose runs() lists new runs reopens, runs only the new ids and completes again', async () => {
    const s = setup();
    assert.equal((await run(s.args('A', ['--init-ledger']))).code, 0);
    s.stub({ count: 5 });
    const r = await run(s.args('A'));
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.report.ran, ['A-stub-4', 'A-stub-5']);
    assert.equal(r.report.reopened, true);
    assert.equal(markerLines(s), 5);
    assert.equal(s.ledger().batches.A.status, 'complete');
  });

  test('5. budget stop: total 99.80 refuses the first run; 99.45 with cap 0.5 refuses on the reserve (0.625), not the cap', async () => {
    let s = setup();
    presetLedger(s, 99.8);
    let r = await run(s.args('A'));
    assert.equal(r.code, 3, r.stderr);
    assert.equal(r.report.runs[0].status, 'skipped_budget');
    assert.equal(s.record('A-stub-1').status, 'skipped_budget');
    assert.equal(fs.existsSync(s.marker), false);
    assert.equal(ledgerLib.totalUsd(s.ledger()), 99.8);

    s = setup();
    presetLedger(s, 99.45);
    r = await run(s.args('A'));
    assert.equal(r.code, 3);
    const rec = s.record('A-stub-1');
    assert.equal(rec.status, 'skipped_budget');
    assert.equal(rec.reason, 'global_cap');
    assert.match(rec.basis, /reserve 0\.625/);
    assert.equal(rec.reserve_usd, 0.625);
    assert.equal(fs.existsSync(s.marker), false);
  });

  test('6. usage limit resetting in 30 s: waits in-process (>= 30 s), logs <id>@attempt1 at $0, then the run ends ok', async () => {
    const s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'usage_limit:30' } } } });
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.sleeps.length, 1);
    assert.ok(r.sleeps[0] >= 30000, `slept ${r.sleeps[0]}`);
    const l = s.ledger();
    const attempt = l.entries.find((e) => e.id === 'A-stub-1@attempt1');
    assert.ok(attempt, 'the limited attempt is in the ledger');
    assert.equal(attempt.status, 'rate_limited');
    assert.equal(attempt.charged_usd, 0);
    assert.equal(s.record('A-stub-1').status, 'ok');
    assert.equal(s.record('A-stub-1').attempt, 2);
    assert.ok(fs.existsSync(`${s.runDir('A-stub-1')}.prev-1`), 'the limited attempt keeps its own run dir');
    assert.equal(l.batches.A.status, 'complete');
  });

  test('6. usage limit resetting in 2 h: exit 4 with resume_after, the run stays pending, and an early re-run spawns nothing', async () => {
    const s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'usage_limit:7200' } } } });
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 4, r.stderr);
    assert.deepEqual(r.sleeps, []);
    const q = readJson(path.join(s.root, 'queue', 'A.json'));
    assert.ok(q.resume_after && q.resume_after.epoch > Date.now() / 1000 + 7000, JSON.stringify(q.resume_after));
    assert.equal(q.done.includes('A-stub-1'), false);
    assert.equal(r.report.resume_after.epoch, q.resume_after.epoch);
    assert.equal(markerLines(s), 1);
    const again = await run(s.args('A'));
    assert.equal(again.code, 4);
    assert.equal(markerLines(s), 1, 'no tight retry: nothing spawned before resume_after');
  });

  test('7. timeout: charged the transcript cost of what was written, or the reserve when nothing was; never just the cap', async () => {
    const s = setup({ stub: { overrides: {
      'A-stub-1': { scenario: 'slow:20000', timeoutMs: 1500 },
      'A-stub-2': { scenario: 'slow:20000:silent', timeoutMs: 1500 },
    } } });
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    const a = s.record('A-stub-1');
    assert.equal(a.status, 'timeout');
    assert.equal(a.cost_usd, null);
    assert.equal(a.charged_usd, 0.02);
    assert.equal(a.cost_source, 'transcript_sum');
    const b = s.record('A-stub-2');
    assert.equal(b.status, 'timeout');
    assert.equal(b.cost_source, 'reserve_charged');
    assert.equal(b.charged_usd, 0.625);
    assert.equal(s.record('A-stub-3').status, 'ok');
  });

  test('8. wrong_model records model_ran false and the batch continues; wrong_tools on the first agent run exits 6 after one run', async () => {
    let s = setup({ stub: { overrides: { 'A-stub-2': { scenario: 'wrong_model' } } } });
    let r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(s.record('A-stub-2').model_ran, false);
    assert.equal(s.record('A-stub-2').status, 'ok');
    assert.equal(markerLines(s), 3);

    s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'wrong_tools' } } } });
    r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 6);
    assert.equal(markerLines(s), 1);
    const rec = s.record('A-stub-1');
    assert.equal(rec.status, 'harness_error');
    assert.equal(rec.tools_check.ok, false);
    assert.ok(rec.charged_usd > 0, 'the run is still charged');
    assert.equal(s.ledger().batches.A.status, 'stopped');
  });

  test('9. a leaked token exits 6 naming the run dir; neither stdout nor stderr carries the token', () => {
    const s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'leak_token' } } } });
    const r = cli(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 6, r.stderr);
    assert.ok(r.stderr.includes(s.runDir('A-stub-1')), r.stderr);
    assert.equal(r.stdout.includes(s.token), false);
    assert.equal(r.stderr.includes(s.token), false);
    assert.equal(fs.readFileSync(path.join(s.root, 'queue', 'A.log'), 'utf-8').includes(s.token), false);
    assert.equal(fs.readFileSync(path.join(s.runDir('A-stub-1'), 'record.json'), 'utf-8').includes(s.token), false);
    assert.equal(markerLines(s), 1);
    assert.equal(s.ledger().entries.length, 1, 'the leaking run is still charged');
  });

  test('10. tripwire: a watched repo touched by a run exits 5 and stops the batch', async () => {
    const watchedBase = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-watched-')));
    const watched = tempRepo(path.join(watchedBase, 'fleet'));
    const s = setup({ stub: { watched: [{ label: 'fleet', path: watched }], overrides: { 'A-stub-2': { scenario: `touch_watched:${watched}` } } } });
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 5, r.stderr);
    assert.equal(s.ledger().batches.A.status, 'stopped');
    assert.ok(r.report.tripwire.diffs.some((d) => d.label === 'fleet' && d.what === 'porcelain'));
    assert.match(r.stderr, /fleet/);
    assert.equal(markerLines(s), 2, 'stops right after the run that touched it');
    assert.ok(fs.existsSync(path.join(s.root, 'tripwire', 'A-before.json')));
    assert.ok(fs.existsSync(path.join(s.root, 'tripwire', 'A-after.json')));
  });

  test('11. child env: allowlist only, HOME inside the run dir, stdin at EOF from /dev/null', () => {
    const s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'env_dump' } } } });
    const r = cli(s.args('A', ['--init-ledger']), { ANTHROPIC_API_KEY: 'sk-parent', CLAUDECODE: '1', AOFORGE_MODEL_PROFILE: 'quality' });
    assert.equal(r.code, 0, r.stderr);
    const dump = readJson(path.join(s.runDir('A-stub-1'), 'work', '.fake-env.json'));
    for (const name of ['PATH', 'HOME', 'CLAUDE_CONFIG_DIR', 'TMPDIR', 'CLAUDE_CODE_OAUTH_TOKEN', 'AOFORGE_SKIP_EDIT_GATE',
      'AOFORGE_SKIP_AWARENESS_POPULATE', 'AOFORGE_SKIP_TRANSCRIPT_EXPORT', 'AOFORGE_SKIP_PRUNE']) {
      assert.ok(dump.names.includes(name), `${name} present`);
    }
    for (const name of ['ANTHROPIC_API_KEY', 'CLAUDECODE', 'AOFORGE_MODEL_PROFILE']) assert.equal(dump.names.includes(name), false, `${name} absent`);
    assert.ok(dump.home.startsWith(`${s.runDir('A-stub-1')}${path.sep}`), dump.home);
    assert.equal(dump.stdin_bytes, 0);
    assert.equal(dump.stdin_is_tty, false);
    assert.equal(dump.stdin.fifo, false, 'not a pipe left open');
  });
});

describe('spend accounting', () => {
  test('16. overshoot: charged the reported 0.90, not the cap; the next same-role run reserves 0.90 and is refused', async () => {
    const s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'overshoot:0.40' } } } });
    presetLedger(s, 98.3);
    const r = await run(s.args('A'));
    assert.equal(r.code, 3, r.stderr);
    const a = s.record('A-stub-1');
    assert.equal(a.cost_usd, 0.9);
    assert.equal(a.cap_usd, 0.5);
    assert.equal(a.overshoot_usd, 0.4);
    assert.equal(a.cost_source, 'reported');
    assert.equal(ledgerLib.totalUsd(s.ledger()), 99.2);
    const b = s.record('A-stub-2');
    assert.equal(b.status, 'skipped_budget');
    assert.equal(b.reserve_usd, 0.9);
    assert.equal(b.reason, 'global_cap');
    assert.equal(markerLines(s), 1);
  });

  test('17. subagent spend: reported 0.10, transcript 0.60; the ledger charges 0.60 from the transcript sum', async () => {
    const s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'subagent_cost:0.50' } } } });
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    const a = s.record('A-stub-1');
    assert.equal(a.cost_usd, 0.1);
    assert.equal(a.transcript_cost_usd, 0.6);
    assert.equal(a.charged_usd, 0.6);
    assert.equal(a.cost_source, 'transcript_sum');
    const entry = s.ledger().entries.find((e) => e.id === 'A-stub-1');
    assert.equal(entry.charged_usd, 0.6);
    assert.equal(entry.cost_source, 'transcript_sum');
  });

  test('18. durability: --init-ledger refused once a result exists; --rebuild-ledger restores spend; --charge-lost stops a batch', async () => {
    const s = setup();
    const a = stubSpendBlock('A', [{ id: 'A-stub-1', charged_usd: 1.25 }, { id: 'A-stub-2', charged_usd: 0.75 }]);
    const b = stubSpendBlock('B', [{ id: 'B-stub-1', charged_usd: 0.5, role: 'job-checker' }]);
    assert.equal(validateSpendBlock(a.spend).ok, true);
    writeJson(path.join(s.results, 'A.json'), a);
    writeJson(path.join(s.results, 'B.json'), b);

    let r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 2);
    assert.ok(r.stderr.includes(path.join(s.results, 'A.json')), r.stderr);
    assert.match(r.stderr, /--rebuild-ledger/);
    assert.equal(fs.existsSync(path.join(s.root, 'ledger.json')), false);

    r = await run(['--rebuild-ledger', '--root', s.root, '--results-dir', s.results, '--raw']);
    assert.equal(r.code, 0, r.stderr);
    const l = s.ledger();
    assert.equal(ledgerLib.totalUsd(l), 2.5);
    assert.equal(l.batches.A.status, 'complete');
    assert.equal(l.batches.B.status, 'complete');
    assert.equal(r.report.total_usd, 2.5);
    assert.equal(fs.existsSync(s.marker), false, 'nothing spawned');

    r = await run(['--rebuild-ledger', '--root', s.root, '--results-dir', s.results, '--raw']);
    assert.equal(r.code, 2, 'a live ledger is never overwritten');

    const r2 = path.join(s.base, 'eval2');
    fs.mkdirSync(r2);
    fs.copyFileSync(path.join(s.root, 'trees.json'), path.join(r2, 'trees.json'));
    s.stub({}, r2);
    r = await run(['--rebuild-ledger', '--root', r2, '--results-dir', s.results, '--charge-lost', 'D=3', '--raw']);
    assert.equal(r.code, 0, r.stderr);
    const l2 = s.ledger(r2);
    const lost = l2.entries.find((e) => e.id === 'D-lost-root');
    assert.equal(lost.charged_usd, 3);
    assert.equal(l2.batches.D.status, 'stopped');
    assert.equal(ledgerLib.totalUsd(l2), 5.5);

    r = await run(s.args('D', [], r2));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /batch D is stopped/);
    r = await run(s.args('E', [], r2));
    assert.equal(r.code, 0, `E's order check passes: ${r.stderr}`);
    assert.equal(s.ledger(r2).batches.E.status, 'complete');
  });
});

describe('isolation', () => {
  test('19. each happy run proves isolation; a session that writes the real projects dir exits 5 after that run', async () => {
    let s = setup();
    let r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    for (const id of ['A-stub-1', 'A-stub-2', 'A-stub-3']) {
      assert.deepEqual(s.record(id).isolation, { sandbox_project: true, real_project: false, real_entries_under_root: [] });
    }

    s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'touch_real_projects' } } } });
    r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 5, r.stderr);
    assert.equal(markerLines(s), 1);
    assert.equal(s.ledger().batches.A.status, 'stopped');
    const entry = projectKey(path.join(s.runDir('A-stub-1'), 'work'));
    assert.ok(r.stderr.includes(entry), r.stderr);
    assert.equal(s.record('A-stub-1').isolation.real_project, true);
  });

  test('20. --settings deny list: exactly Read/Edit/Write on dirname(repo), <realHome>/.claude and each watched repo', async () => {
    const watchedBase = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-watched-')));
    const watched = tempRepo(path.join(watchedBase, 'fleet'));
    const s = setup({ stub: { watched: [{ label: 'fleet', path: watched }] } });
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    const dir = s.runDir('A-stub-1');
    const argvJson = readJson(path.join(dir, 'argv.json'));
    assert.equal(argvJson.args[argvJson.args.indexOf('--settings') + 1], path.join(dir, 'settings.json'));
    const rules = (p) => [`Read(/${p}/**)`, `Edit(/${p}/**)`, `Write(/${p}/**)`];
    assert.deepEqual(readJson(path.join(dir, 'settings.json')), {
      permissions: { deny: [...rules(path.join(s.base, 'dev')), ...rules(path.join(s.home, '.claude')), ...rules(watched)] },
    });
  });

  test('20. R inside dirname(repo) is refused before any spawn, naming the deny root', async () => {
    const s = setup({ rootUnder: true });
    const r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 2);
    assert.ok(r.stderr.includes(path.join(s.base, 'dev')), r.stderr);
    assert.equal(fs.existsSync(s.marker), false);
  });

  test('20. a denial inside the run dir is a harness error (exit 6 after one run); one under a deny root is an escape attempt', async () => {
    let s = setup({ stub: { overrides: { 'A-stub-1': { scenario: 'deny_inside' } } } });
    let r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 6, r.stderr);
    assert.equal(s.record('A-stub-1').status, 'harness_error');
    assert.equal(markerLines(s), 1);

    // Post-hoc 4 (TRD 81-18, user 2026-10-17): a denied attempt on an EXISTING real path outside the sandbox is a real
    // escape and stops the batch after that run (before post-hoc 4 the batch went on and only counted it).
    s = setup();
    s.stub({ denyTarget: path.join(s.repo, 'package.json'), overrides: { 'A-stub-1': { scenario: 'deny_outside' } } });
    r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 5, r.stderr);
    assert.match(r.report.message, /real escape on A-stub-1/);
    const rec = s.record('A-stub-1');
    assert.equal(rec.status, 'ok');
    assert.equal(rec.escape_attempt, true);
    assert.equal(rec.access.real.length, 1);
    assert.equal(rec.access.real[0].denied, true);
    assert.equal(markerLines(s), 1);

    // A denied path under a deny root that does not exist is not a real escape: the batch goes on.
    s = setup();
    s.stub({ denyTarget: path.join(s.repo, 'no-such-file.txt'), overrides: { 'A-stub-1': { scenario: 'deny_outside' } } });
    r = await run(s.args('A', ['--init-ledger']));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(s.record('A-stub-1').escape_attempt, true);
    assert.deepEqual(s.record('A-stub-1').access.real, []);
    assert.equal(markerLines(s), 3);
  });

  test('21. a change to the real calibration.json or .plugin-version during the batch exits 5 naming the file', async () => {
    for (const rel of [['aoforge', 'calibration.json'], ['aoforge', '.plugin-version']]) {
      const s = setup();
      const file = path.join(s.home, '.claude', ...rel);
      s.stub({ overrides: { 'A-stub-1': { scenario: `touch_watched:${file}` } } });
      const r = await run(s.args('A', ['--init-ledger']));
      assert.equal(r.code, 5, r.stderr);
      assert.ok(r.stderr.includes(file), r.stderr);
      assert.ok(r.report.tripwire.diffs.some((d) => d.what === 'file' && d.label === file));
    }
  });
});

describe('closing and reopening a batch', () => {
  test('22. --close-batch stops a running batch with its reason; a live run of it exits 2; the next batch\'s order check passes', async () => {
    const s = setup();
    let r = await run(s.args('A', ['--init-ledger', '--stop-after', '2']));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(s.ledger().batches.A.status, 'running');
    assert.deepEqual(r.report.pending, ['A-stub-3']);

    r = await run(['--close-batch', 'A', '--reason', 'user stop', '--root', s.root, '--raw']);
    assert.equal(r.code, 0, r.stderr);
    const l = s.ledger();
    assert.equal(l.batches.A.status, 'stopped');
    assert.equal(l.batches.A.stop_reason, 'user stop');
    assert.equal(markerLines(s), 2);

    r = await run(s.args('A'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /batch A is stopped/);
    r = await run(s.args('B'));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(s.ledger().batches.B.status, 'complete');
  });

  test('--reopen --reason resumes a stopped batch on the user\'s word; --close-batch needs --reason', async () => {
    const s = setup();
    assert.equal((await run(s.args('A', ['--init-ledger', '--stop-after', '1']))).code, 0);
    assert.equal((await run(['--close-batch', 'A', '--root', s.root])).code, 2, '--reason is required');
    assert.equal((await run(['--close-batch', 'A', '--reason', 'tripwire was mine', '--root', s.root])).code, 0);
    assert.equal((await run(s.args('A', ['--reopen']))).code, 2, '--reopen needs --reason');
    const r = await run(s.args('A', ['--reopen', '--reason', 'the user said the diff was theirs']));
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.report.ran, ['A-stub-2', 'A-stub-3']);
    const l = s.ledger();
    assert.equal(l.batches.A.status, 'complete');
    assert.equal(l.batches.A.reopen_reason, 'the user said the diff was theirs');
  });

  test('usage errors exit 2: unknown flag, missing --root, bad --materialize, --charge-lost without --rebuild-ledger', async () => {
    const s = setup();
    assert.equal((await run([...s.args('A'), '--frobnicate'])).code, 2);
    assert.equal((await run(['--batch', 'A', '--token-file', s.tokenFile])).code, 2);
    assert.equal((await run(s.args('A', ['--dry-run', '--materialize', 'some']))).code, 2);
    assert.equal((await run(s.args('A', ['--charge-lost', 'D=3']))).code, 2);
    assert.equal((await run(s.args('Q', ['--init-ledger']))).code, 2);
  });
});
