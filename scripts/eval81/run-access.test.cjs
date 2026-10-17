'use strict';
// Post-hoc 4 (TRD 81-18, user 2026-10-17, "Reclassify + re-run impaired"), through run.cjs with the fake claude's
// tool_paths scenario: a denied `~/.claude/...` access impairs a run, which is re-run once (the first attempt charged
// as <id>@impaired<n>); a run still impaired after that is final with impaired: true; an access to an existing real
// path outside the sandbox stops the batch (exit 5) with a redacted record; a guessed non-existent path is a recorded
// non-escape. The world mirrors run-opaque.test.cjs (stand-in home <base>/Users/justin, checkout
// <base>/dev/aoforge-claude, sandbox root under an opaque base).
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

/** `calls` is the tool_paths spec: one array of tool uses per call of the fake. */
function setup(calls) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-racc-')));
  made.push(base);
  const repo = path.join(base, 'dev', 'aoforge-claude');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"stand-in"}\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  const home = path.join(base, 'Users', 'justin');
  fs.mkdirSync(path.join(home, '.claude', 'aoforge', 'references'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{}\n');
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# stand-in\n');
  fs.writeFileSync(path.join(home, '.claude', 'aoforge', '.plugin-version'), '3.1.0');
  fs.writeFileSync(path.join(home, '.claude', 'aoforge', 'calibration.json'), '{"version":3}\n');
  fs.writeFileSync(path.join(home, '.claude', 'aoforge', 'references', 'tdd.md'), 'the real one\n');
  const root = path.join(base, 'eval');
  const results = path.join(base, 'results');
  fs.mkdirSync(results, { recursive: true });
  const sroot = fs.realpathSync(fs.mkdtempSync(path.join(OPAQUE_BASE, 'e81r-')));
  made.push(sroot);
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
  const spec = path.join(base, 'tool-uses.json');
  writeJson(spec, { calls });
  writeJson(path.join(root, 'stub-batch.json'), { marker, realHome: home, count: 1, scenario: `tool_paths:${spec}` });
  const args = ['--batch', 'A', '--root', root, '--sandbox-root', sroot, '--token-file', tokenFile, '--claude-bin', FAKE,
    '--results-dir', results, '--repo', repo, '--batch-dir', batches, '--real-home', home, '--rates', rates, '--raw', '--init-ledger'];
  const spawned = () => (fs.existsSync(marker) ? fs.readFileSync(marker, 'utf-8').trim().split('\n').filter(Boolean).length : 0);
  return { base, home, root, sroot, args, spawned, ledger: () => readJson(path.join(root, 'ledger.json')) };
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

const TILDE = { id: 't-tilde', name: 'Bash', input: { command: 'cd ~/.claude/aoforge/templates/codebase && cat conventions.md' }, denied: true };

describe('access classification in the runner (post-hoc 4)', () => {
  test('1. an impaired first attempt is charged as <id>@impaired1 and re-run once; a clean second attempt is final', async () => {
    const s = setup([[TILDE], []]);
    const res = await run(s.args);
    assert.equal(res.code, 0, res.stderr);
    assert.equal(s.spawned(), 2);
    const ids = s.ledger().entries.map((e) => e.id);
    assert.deepEqual(ids, ['A-stub-1@impaired1', 'A-stub-1']);
    const final = readJson(path.join(s.root, 'runs', 'A', 'A-stub-1', 'record.json'));
    assert.equal(final.attempt, 2);
    assert.equal(final.impaired, false);
    assert.equal(final.ledger_id, 'A-stub-1');
    const first = readJson(path.join(s.root, 'runs', 'A', 'A-stub-1.prev-1', 'record.json'));
    assert.equal(first.impaired, true);
    assert.equal(first.ledger_id, 'A-stub-1@impaired1');
    assert.deepEqual(first.access.impaired_by, ['~/.claude/aoforge/templates/codebase']);
    assert.deepEqual(first.access.non_escape.map((e) => e.class), ['tilde_denied']);
    assert.deepEqual(first.access.real, []);
    assert.deepEqual(readJson(path.join(s.root, 'queue', 'A.json')).done, ['A-stub-1']);
  });

  test('2. still impaired after the re-run: final, impaired: true, never a third attempt', async () => {
    const s = setup([[TILDE]]);
    const res = await run(s.args);
    assert.equal(res.code, 0, res.stderr);
    assert.equal(s.spawned(), 2);
    assert.deepEqual(s.ledger().entries.map((e) => e.id), ['A-stub-1@impaired1', 'A-stub-1']);
    const final = readJson(path.join(s.root, 'runs', 'A', 'A-stub-1', 'record.json'));
    assert.equal(final.impaired, true);
    assert.equal(final.ledger_id, 'A-stub-1');
    assert.equal(final.status, 'ok');
    assert.equal(s.ledger().batches.A.status, 'complete');
  });

  test('3. an allowed read of an existing file in the real home is a real escape: exit 5, batch stopped, record redacted', async () => {
    const s = setup([[{ id: 't-real', name: 'Read', input: { file_path: '__HOME__/.claude/aoforge/references/tdd.md' }, denied: false }]]);
    const spec = path.join(s.base, 'tool-uses.json');
    fs.writeFileSync(spec, fs.readFileSync(spec, 'utf-8').replace('__HOME__', s.home));
    const res = await run(s.args);
    assert.equal(res.code, 5, res.stderr);
    assert.match(res.report.message, /real escape/);
    assert.equal(s.ledger().batches.A.status, 'stopped');
    const rec = readJson(path.join(s.root, 'runs', 'A', 'A-stub-1', 'record.json'));
    assert.equal(rec.access.real.length, 1);
    assert.equal(rec.access.real[0].path, '<home>/.claude/aoforge/references/tdd.md');
    assert.ok(!/justin/i.test(JSON.stringify(rec.access)));
    assert.equal(s.spawned(), 1);
  });

  test('4. a guessed, non-existent home path is a recorded non-escape; the run is not impaired and not re-run', async () => {
    const s = setup([[{ id: 't-guess', name: 'Read', input: { file_path: '__BASE__/Users/unknown/.claude/aoforge/templates/x.md' }, denied: false }]]);
    const spec = path.join(s.base, 'tool-uses.json');
    fs.writeFileSync(spec, fs.readFileSync(spec, 'utf-8').replace('__BASE__', s.base));
    const res = await run(s.args);
    assert.equal(res.code, 0, res.stderr);
    assert.equal(s.spawned(), 1);
    const rec = readJson(path.join(s.root, 'runs', 'A', 'A-stub-1', 'record.json'));
    assert.equal(rec.impaired, false);
    assert.deepEqual(rec.access.non_escape.map((e) => e.class), ['guessed_nonexistent']);
    assert.deepEqual(rec.access.real, []);
  });
});
