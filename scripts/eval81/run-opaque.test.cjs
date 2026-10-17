'use strict';
// Post-hoc 3 (TRD 81-17, user 2026-10-17): with --sandbox-root, every path handed to a run (cwd, HOME,
// CLAUDE_CONFIG_DIR, TMPDIR, --plugin-dir, --settings, the materialised fixture dir) has no `justin`,
// `aoforge-claude` or `Users-` component after fs.realpathSync, and the runner refuses (exit 2, nothing spawned)
// when one would. The world mirrors run.test.cjs: the fake claude, the stub batch, a stand-in real home named
// <base>/Users/justin and a checkout named <base>/dev/aoforge-claude, so the tokens the runner derives are exactly
// the three the user named. The sandbox root lives under an opaque base (EVAL81_OPAQUE_TMP, default the real /tmp),
// because os.tmpdir() may itself be a session scratchpad whose path names the user.
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const FAKE = path.join(__dirname, '__fixtures__', 'fake-claude.cjs');
const STUB = path.join(__dirname, '__fixtures__', 'stub-batch.cjs');
const { TEST_RATES } = require(FAKE);
const { opaqueViolations } = require('./lib/opaque.cjs');

const TOKENS = ['justin', 'aoforge-claude', 'Users-'];
const OPAQUE_BASE = fs.realpathSync(process.env.EVAL81_OPAQUE_TMP || '/tmp');
const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
  '-c', 'commit.gpgsign=false', '-C', cwd, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf-8'));
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
};

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

/** sandboxName: the sandbox root's leaf under the opaque base (a named one makes the refusal case). */
function setup({ sandboxName = null } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-opq-')));
  made.push(base);
  const repo = path.join(base, 'dev', 'aoforge-claude');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"stand-in"}\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  const home = path.join(base, 'Users', 'justin');
  fs.mkdirSync(path.join(home, '.claude', 'aoforge'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{}\n');
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# stand-in\n');
  fs.writeFileSync(path.join(home, '.claude', 'aoforge', '.plugin-version'), '3.1.0');
  fs.writeFileSync(path.join(home, '.claude', 'aoforge', 'calibration.json'), '{"version":3}\n');
  const root = path.join(base, 'eval');
  fs.mkdirSync(root, { recursive: true });
  const results = path.join(base, 'results');
  fs.mkdirSync(results, { recursive: true });
  const sroot = sandboxName
    ? path.join(fs.realpathSync(fs.mkdtempSync(path.join(OPAQUE_BASE, 'e81t-'))), sandboxName)
    : fs.realpathSync(fs.mkdtempSync(path.join(OPAQUE_BASE, 'e81t-')));
  made.push(sandboxName ? path.dirname(sroot) : sroot);
  fs.mkdirSync(sroot, { recursive: true });
  const tree = makeStubTree(path.join(sroot, 'trees', 'v3.1.0'), '3.1.0');
  writeJson(path.join(sroot, 'trees.json'), { '3.1.0': { ref: 'stub', sha: '0'.repeat(40), path: tree } });
  const batches = path.join(base, 'batches');
  fs.mkdirSync(batches, { recursive: true });
  for (const b of ['A', 'B', 'C', 'D', 'E']) {
    fs.writeFileSync(path.join(batches, `${b}.cjs`), `module.exports = require(${JSON.stringify(STUB)}).makeStubBatch('${b}');\n`);
  }
  const tokenFile = path.join(base, 'token');
  fs.writeFileSync(tokenFile, `fake-token-${crypto.randomBytes(16).toString('hex')}\n`);
  const rates = path.join(base, 'rates.json');
  writeJson(rates, TEST_RATES);
  const marker = path.join(base, 'marker');
  writeJson(path.join(root, 'stub-batch.json'), { marker, realHome: home, count: 1 });
  const args = (extra = []) => ['--batch', 'A', '--root', root, '--sandbox-root', sroot, '--token-file', tokenFile, '--claude-bin', FAKE,
    '--results-dir', results, '--repo', repo, '--batch-dir', batches, '--real-home', home, '--rates', rates, '--raw', '--init-ledger', ...extra];
  return { base, repo, home, root, sroot, tree, marker, args };
}

async function run(argv) {
  const out = [];
  const err = [];
  const code = await require('./run.cjs').main(argv, {
    stdout: (x) => out.push(x),
    stderr: (x) => err.push(x),
    sleep: async () => {},
    killGraceMs: 200,
  });
  let report = null;
  try {
    report = JSON.parse(out.join(''));
  } catch {}
  return { code, report, stderr: err.join('') };
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

describe('opaque run paths (post-hoc 3)', () => {
  test('0. the opaque base itself names none of the tokens (else this machine cannot run these tests)', () => {
    assert.deepEqual(opaqueViolations([{ what: 'base', path: OPAQUE_BASE }], TOKENS).violations, []);
  });

  test('1. a live run with --sandbox-root: every path handed to the run is opaque after realpath; the record stays under the eval root', async () => {
    const s = setup();
    const res = await run(s.args());
    assert.equal(res.code, 0, res.stderr);
    const id = res.report.ran[0];
    const runDir = path.join(s.root, 'runs', 'A', id);
    const argv = readJson(path.join(runDir, 'argv.json'));
    const handed = [
      { what: 'cwd', path: argv.cwd },
      { what: 'HOME', path: argv.env.HOME },
      { what: 'CLAUDE_CONFIG_DIR', path: argv.env.CLAUDE_CONFIG_DIR },
      { what: 'TMPDIR', path: argv.env.TMPDIR },
      { what: '--plugin-dir', path: flag(argv.args, '--plugin-dir') },
      { what: '--settings', path: flag(argv.args, '--settings') },
    ];
    for (const h of handed) assert.ok(typeof h.path === 'string' && path.isAbsolute(h.path), `${h.what} handed: ${h.path}`);
    const check = opaqueViolations(handed, TOKENS);
    assert.equal(check.checked.length, 6);
    assert.deepEqual(check.violations, []);
    for (const c of check.checked) assert.ok(c.real.startsWith(`${s.sroot}${path.sep}`), `${c.what} ${c.real} is under the sandbox root`);
    // The fixture copy (the work dir) and what the fake saw as its own cwd.
    assert.ok(fs.existsSync(path.join(argv.cwd, '.fake-marker')));
    const seen = fs.readFileSync(s.marker, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(seen.length, 1);
    assert.deepEqual(opaqueViolations([{ what: 'child cwd', path: seen[0].cwd }], TOKENS).violations, []);
    // The record, stream and transcripts stay under the eval root.
    const rec = readJson(path.join(runDir, 'record.json'));
    assert.equal(rec.status, 'ok');
    assert.equal(rec.run_dir, runDir);
    assert.ok(fs.existsSync(path.join(runDir, 'stream.jsonl')));
    assert.ok(rec.transcript_files.length >= 1);
    assert.ok(fs.existsSync(path.join(runDir, 'transcripts', rec.transcript_files[0])));
    assert.equal(rec.isolation.sandbox_project, true);
    assert.deepEqual(argv.opaque.violations, []);
    assert.deepEqual(argv.opaque.tokens, TOKENS);
  });

  test('2. a sandbox root whose real path names the user is refused before any spawn (exit 2)', async () => {
    const s = setup({ sandboxName: 'justin-runs' });
    const res = await run(s.args());
    assert.equal(res.code, 2, res.stderr);
    assert.match(res.stderr, /names justin/);
    assert.ok(!fs.existsSync(s.marker), 'the fake was never spawned');
  });

  test('3. the dry run applies the same check and reports it', async () => {
    const s = setup();
    const res = await run(s.args(['--dry-run', '--materialize', 'all']));
    assert.equal(res.code, 0, res.stderr);
    const id = res.report.planned[0].id;
    const argv = readJson(path.join(s.root, 'runs', 'A', id, 'argv.json'));
    assert.deepEqual(argv.opaque.violations, []);
    assert.ok(fs.realpathSync(argv.cwd).startsWith(`${s.sroot}${path.sep}`));
  });
});
