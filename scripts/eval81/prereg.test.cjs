'use strict';
// TRD 81-13: the objective-81 pre-registration manifest (`prereg.cjs --write` / `--check`). Every test builds a
// small stand-in repository and a stand-in home under the temp dir; nothing reads this checkout's files or the
// real home.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const prereg = require('./prereg.cjs');

const SCRIPT = path.join(__dirname, 'prereg.cjs');
const O = '.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement';
const PRIVATE = `${O}/private/fleet-checklists.json`;
// A minimal PNG signature plus bytes that are not valid UTF-8, so a text read would mangle them.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x80, 0x81, 0xc3, 0x28, 0x00]);

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
};

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function git(cwd, ...args) {
  return cp.execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function write(root, rel, data) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  return abs;
}

/** A stand-in checkout, a stand-in home with a calibration file, and an eval root with trees.json. */
function world() {
  // git rev-parse --show-toplevel returns the physical path, while os.tmpdir() may be a symlink (macOS /tmp ->
  // /private/tmp, /var -> /private/var). prereg.cjs is frozen by the objective-81 manifest, so the stand-in world is
  // built on the physical path instead of changing extraLabel (quick 44).
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'prereg-')));
  const repo = path.join(base, 'repo');
  const home = path.join(base, 'home');
  const evalRoot = path.join(base, 'eval');
  fs.mkdirSync(repo, { recursive: true });
  const files = {
    'scripts/eval81/run.cjs': 'run\n',
    'scripts/eval81/README.md': '# harness\n',
    'scripts/eval81/lib/ledger.cjs': 'ledger\n',
    'scripts/eval81/lib/ledger.test.cjs': 'a unit test, not frozen\n',
    'scripts/eval81/batches/A.cjs': 'batch A\n',
    'scripts/eval81/score/A.cjs': 'scorer A\n',
    'scripts/eval81/__fixtures__/fake-claude.cjs': 'the fake binary, not frozen\n',
    'scripts/eval81/__fixtures__/stub-batch.cjs': 'stub\n',
    'scripts/eval81/fixtures/A/answer-key.json': '{"A1": "planted"}\n',
    'scripts/eval81/fixtures/A/proofs.test.cjs': 'proof that the key is right\n',
    'scripts/eval81/fixtures/C/proofs.test.cjs': 'proof C\n',
    'scripts/eval81/fixtures/D/png.test.cjs': 'a unit test, not frozen\n',
    'scripts/other/tool.cjs': 'not under eval81\n',
    'plugins/aoforge/x.cjs': 'not frozen\n',
    [`${O}/81-DECISION-RULE.md`]: '# rule\n',
    [`${O}/results/static-prompt.json`]: '{}\n',
    [`${O}/81-PREREG.md`]: '# not frozen by the manifest it describes\n',
    [`${O}/private/.gitignore`]: '*\n',
  };
  for (const [rel, text] of Object.entries(files)) write(repo, rel, text);
  write(repo, 'scripts/eval81/fixtures/D/png/d01.png', PNG);
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  // The private checklist is ignored, so it is never committed; it is passed as an extra.
  write(repo, PRIVATE, '{"secret": "checklist"}\n');
  const calibration = write(home, '.claude/aoforge/calibration.json', '{"version": 3}\n');
  write(evalRoot, 'trees.json', `${JSON.stringify({
    '3.0.0': { ref: 'v3.0.0', sha: 'a'.repeat(40), path: path.join(evalRoot, 'trees', 'v3.0.0') },
    '3.1.0': { ref: 'b'.repeat(40), sha: 'b'.repeat(40), path: path.join(evalRoot, 'trees', 'v3.1.0') },
  }, null, 2)}\n`);
  write(evalRoot, 'projection.json', `${JSON.stringify({ overall_estimate_usd: 83, batches: { A: { runs: 36 } } })}\n`);
  return { base, repo, home, evalRoot, calibration };
}

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(String(s)) }, stderr: { write: (s) => err.push(String(s)) } };
}

function writeArgs(w) {
  return [
    '--write',
    '--out', `${O}/results`,
    '--extra', PRIVATE,
    '--calibration', w.calibration,
    '--trees', path.join(w.evalRoot, 'trees.json'),
    '--claude-version', '2.1.302 (Claude Code)',
    '--projection', path.join(w.evalRoot, 'projection.json'),
  ];
}

async function runMain(w, argv) {
  const s = io();
  const code = await prereg.main(argv, { cwd: w.repo, home: w.home, stdout: s.stdout, stderr: s.stderr, now: () => new Date('2026-10-17T18:00:00Z') });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

const manifestPath = (w) => path.join(w.repo, O, 'results', 'prereg-manifest.json');
const readManifest = (w) => JSON.parse(fs.readFileSync(manifestPath(w), 'utf8'));
const checkArgs = (w) => ['--check', '--manifest', path.join(O, 'results', 'prereg-manifest.json')];

// ---------------------------------------------------------------------------------------------------------------
// 1. --write
// ---------------------------------------------------------------------------------------------------------------

test('1: --write hashes the default includes (sorted, repo-relative) plus the extras and records the run context', async () => {
  const w = world();
  const r = await runMain(w, writeArgs(w));
  assert.equal(r.code, 0, r.err);
  const m = readManifest(w);

  for (const key of ['created_at', 'head', 'trees', 'claude_version', 'calibration_sha256', 'command', 'files']) {
    assert.ok(Object.prototype.hasOwnProperty.call(m, key), `manifest has ${key}`);
  }
  assert.equal(m.created_at, '2026-10-17T18:00:00.000Z');
  assert.equal(m.head, git(w.repo, 'rev-parse', 'HEAD'));
  assert.equal(m.claude_version, '2.1.302 (Claude Code)');
  assert.deepEqual(m.trees, { '3.0.0': { ref: 'v3.0.0', sha: 'a'.repeat(40) }, '3.1.0': { ref: 'b'.repeat(40), sha: 'b'.repeat(40) } });
  assert.equal(m.calibration_sha256, sha(fs.readFileSync(w.calibration)));
  assert.deepEqual(m.projection, { overall_estimate_usd: 83, batches: { A: { runs: 36 } } });

  const expected = [
    `${O}/81-DECISION-RULE.md`,
    `${O}/results/static-prompt.json`,
    'scripts/eval81/README.md',
    'scripts/eval81/__fixtures__/stub-batch.cjs',
    'scripts/eval81/batches/A.cjs',
    'scripts/eval81/fixtures/A/answer-key.json',
    'scripts/eval81/fixtures/A/proofs.test.cjs',
    'scripts/eval81/fixtures/C/proofs.test.cjs',
    'scripts/eval81/fixtures/D/png/d01.png',
    'scripts/eval81/lib/ledger.cjs',
    'scripts/eval81/run.cjs',
    'scripts/eval81/score/A.cjs',
  ].sort();
  const inRepo = Object.keys(m.files).filter((p) => !m.extras.includes(p));
  assert.deepEqual(inRepo, expected, 'the walked files, sorted');
  assert.deepEqual(Object.keys(m.files), [...Object.keys(m.files)].sort(), 'files keys are sorted');
  assert.equal(m.files['scripts/eval81/run.cjs'], sha('run\n'));

  // The proofs are frozen even though other *.test.cjs files and the fake binary are not.
  assert.ok(!('scripts/eval81/lib/ledger.test.cjs' in m.files));
  assert.ok(!('scripts/eval81/fixtures/D/png.test.cjs' in m.files));
  assert.ok(!('scripts/eval81/__fixtures__/fake-claude.cjs' in m.files));
  assert.ok(!(`${O}/81-PREREG.md` in m.files));

  // Extras: the private file by its repo-relative path, the calibration under the home as ~/...; hashes only.
  assert.deepEqual(m.extras, [PRIVATE, '~/.claude/aoforge/calibration.json']);
  assert.equal(m.files[PRIVATE], sha('{"secret": "checklist"}\n'));
  assert.equal(m.files['~/.claude/aoforge/calibration.json'], m.calibration_sha256);
  assert.ok(!fs.readFileSync(manifestPath(w), 'utf8').includes('checklist"'), 'the private contents are never copied');

  // command = the exact argv, so an amendment re-runs it.
  assert.deepEqual(m.argv, writeArgs(w));
  assert.ok(m.command.startsWith('node scripts/eval81/prereg.cjs --write --out '), m.command);
  assert.ok(m.command.includes("--claude-version '2.1.302 (Claude Code)'"), m.command);
  assert.deepEqual(m.includes, prereg.DEFAULT_INCLUDES);
});

test('1b: --write needs --out and refuses an unknown flag, writing nothing', async () => {
  const w = world();
  const a = await runMain(w, ['--write']);
  assert.equal(a.code, 2);
  assert.match(a.err, /--out/);
  const b = await runMain(w, [...writeArgs(w), '--bogus']);
  assert.equal(b.code, 2);
  assert.match(b.err, /--bogus/);
  assert.ok(!fs.existsSync(manifestPath(w)));
});

test('1c: a missing extra or calibration file is refused, not hashed as absent', async () => {
  const w = world();
  fs.rmSync(path.join(w.repo, PRIVATE));
  const r = await runMain(w, writeArgs(w));
  assert.equal(r.code, 2);
  assert.match(r.err, /fleet-checklists\.json/);
  assert.ok(!fs.existsSync(manifestPath(w)));
});

// ---------------------------------------------------------------------------------------------------------------
// 2. --check
// ---------------------------------------------------------------------------------------------------------------

test('2: --check exits 0 on an unchanged tree', async () => {
  const w = world();
  assert.equal((await runMain(w, writeArgs(w))).code, 0);
  const r = await runMain(w, checkArgs(w));
  assert.equal(r.code, 0, r.err + r.out);
  assert.match(r.out, /prereg check: OK/);
});

test('2b: --check exits 1 naming each changed, added and missing file (an added unit test is not frozen)', async () => {
  const w = world();
  assert.equal((await runMain(w, writeArgs(w))).code, 0);
  write(w.repo, 'scripts/eval81/batches/A.cjs', 'batch A, edited\n');
  write(w.repo, 'scripts/eval81/batches/F.cjs', 'a new batch module\n');
  write(w.repo, 'scripts/eval81/batches/F.test.cjs', 'its test, not frozen\n');
  fs.rmSync(path.join(w.repo, 'scripts/eval81/fixtures/A/answer-key.json'));
  write(w.repo, `${O}/81-DECISION-RULE.md`, '# rule, amended\n');
  write(w.home, '.claude/aoforge/calibration.json', '{"version": 4}\n');
  const r = await runMain(w, checkArgs(w));
  assert.equal(r.code, 1);
  const text = r.out + r.err;
  assert.match(text, /changed: scripts\/eval81\/batches\/A\.cjs/);
  assert.match(text, /added: scripts\/eval81\/batches\/F\.cjs/);
  assert.match(text, /missing: scripts\/eval81\/fixtures\/A\/answer-key\.json/);
  assert.match(text, /changed: \.aoforge\/objectives\/81-haiku-eval-and-model-efficiency-measurement\/81-DECISION-RULE\.md/);
  assert.match(text, /changed: ~\/\.claude\/aoforge\/calibration\.json/);
  assert.doesNotMatch(text, /F\.test\.cjs/);
});

test('2c: --check exits 1 when the private extra is missing on this machine', async () => {
  const w = world();
  assert.equal((await runMain(w, writeArgs(w))).code, 0);
  fs.rmSync(path.join(w.repo, PRIVATE));
  const r = await runMain(w, checkArgs(w));
  assert.equal(r.code, 1);
  assert.match(r.out + r.err, /missing: \.aoforge\/.*private\/fleet-checklists\.json/);
});

test('2d: --check on a missing or unparseable manifest exits 2', async () => {
  const w = world();
  const a = await runMain(w, checkArgs(w));
  assert.equal(a.code, 2);
  write(w.repo, `${O}/results/prereg-manifest.json`, 'not json');
  const b = await runMain(w, checkArgs(w));
  assert.equal(b.code, 2);
  const c = await runMain(w, ['--check']);
  assert.equal(c.code, 2);
  assert.match(c.err, /--manifest/);
});

test('2e: the CLI exits with main()\'s code (child process, unchanged tree then one edit)', async () => {
  const w = world();
  const env = { ...process.env, HOME: w.home };
  const run = (argv) => cp.spawnSync(process.execPath, [SCRIPT, ...argv], { cwd: w.repo, env, encoding: 'utf8' });
  assert.equal(run(writeArgs(w)).status, 0);
  assert.equal(run(checkArgs(w)).status, 0);
  write(w.repo, 'scripts/eval81/run.cjs', 'run, edited\n');
  const r = run(checkArgs(w));
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /changed: scripts\/eval81\/run\.cjs/);
});

// ---------------------------------------------------------------------------------------------------------------
// 3. binary files
// ---------------------------------------------------------------------------------------------------------------

test('3: a PNG hashes by its bytes and a one-byte change is reported', async () => {
  const w = world();
  assert.equal((await runMain(w, writeArgs(w))).code, 0);
  const m = readManifest(w);
  assert.equal(m.files['scripts/eval81/fixtures/D/png/d01.png'], sha(PNG));
  const flipped = Buffer.from(PNG);
  flipped[PNG.length - 3] ^= 0x01;
  write(w.repo, 'scripts/eval81/fixtures/D/png/d01.png', flipped);
  const r = await runMain(w, checkArgs(w));
  assert.equal(r.code, 1);
  assert.match(r.out + r.err, /changed: scripts\/eval81\/fixtures\/D\/png\/d01\.png/);
});

// ---------------------------------------------------------------------------------------------------------------
// 4. paths outside the repo
// ---------------------------------------------------------------------------------------------------------------

test('4: an include outside the repo is refused; an extra outside the repo is hashed read-only', async () => {
  const w = world();
  write(w.base, 'outside/x.cjs', 'outside\n');
  for (const glob of [path.join(w.base, 'outside', '**'), '../outside/**']) {
    const r = await runMain(w, [...writeArgs(w), '--include', glob]);
    assert.equal(r.code, 2, glob);
    assert.match(r.err, /outside the repo/);
    assert.ok(!fs.existsSync(manifestPath(w)));
  }
  const extra = path.join(w.base, 'outside', 'x.cjs');
  const before = fs.statSync(extra).mtimeMs;
  const ok = await runMain(w, [...writeArgs(w), '--extra', extra]);
  assert.equal(ok.code, 0, ok.err);
  const m = readManifest(w);
  assert.ok(m.extras.includes(extra), 'an extra outside the repo and the home keeps its absolute path');
  assert.equal(m.files[extra], sha('outside\n'));
  assert.equal(fs.statSync(extra).mtimeMs, before);
});

test('4b: --include replaces the default includes and is recorded, so --check re-walks the same set', async () => {
  const w = world();
  const r = await runMain(w, [...writeArgs(w), '--include', 'scripts/other/**']);
  assert.equal(r.code, 0, r.err);
  const m = readManifest(w);
  assert.deepEqual(m.includes, ['scripts/other/**']);
  assert.deepEqual(Object.keys(m.files).filter((p) => !m.extras.includes(p)), ['scripts/other/tool.cjs']);
  write(w.repo, 'scripts/other/new.cjs', 'new\n');
  write(w.repo, 'scripts/eval81/run.cjs', 'not watched by this manifest\n');
  const c = await runMain(w, checkArgs(w));
  assert.equal(c.code, 1);
  assert.match(c.out + c.err, /added: scripts\/other\/new\.cjs/);
  assert.doesNotMatch(c.out + c.err, /run\.cjs/);
});

test('glob: ** spans directories, * stays inside one segment', () => {
  const re = prereg.globToRegExp('scripts/eval81/**');
  assert.ok(re.test('scripts/eval81/run.cjs'));
  assert.ok(re.test('scripts/eval81/lib/a/b.cjs'));
  assert.ok(!re.test('scripts/eval810/run.cjs'));
  const one = prereg.globToRegExp('scripts/eval81/fixtures/*/proofs.test.cjs');
  assert.ok(one.test('scripts/eval81/fixtures/A/proofs.test.cjs'));
  assert.ok(!one.test('scripts/eval81/fixtures/A/B/proofs.test.cjs'));
  const any = prereg.globToRegExp('**/*.test.cjs');
  assert.ok(any.test('scripts/eval81/lib/x.test.cjs'));
  assert.ok(any.test('x.test.cjs'));
  assert.ok(!any.test('scripts/eval81/lib/x.cjs'));
});
