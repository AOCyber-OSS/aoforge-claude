'use strict';

// Test list (objective 80, TRD 80-06): the three-fixture end-to-end proof for SC-4, with idempotency and resume.
// Every row drives the command sequence the adopt workflow prescribes through the CLI (the repo's aof-tools, never
// in-process) on a hand-built repository, then asks the structural checker (__fixtures__/adopt-e2e-assert.cjs) or the
// repository itself whether the run ended where the workflow promises. The migrate sequence is
//   preflight (route migrate) -> begin -> scaffold -> report (commit_blocked null)
//     -> aof-tools commit "<commit_message>" --files <commit_files> -> check --mode migrate
// with no skill marker, no map/infer step, no health step and no repair. The brownfield sequence is the one
// adopt-e2e.test.cjs scripts. Every fixture is built fresh per row; the fake HOME comes with the fixture.
//
// Three fixtures through the workflow sequence:
//  1. Fresh: adopt-fixtures `empty` -> preflight and begin both return `new-project` (exit 0), no branch, no marker,
//     snapshot unchanged; a `git init`-only directory -> `new-project` too.
//  2. Brownfield: adopt-fixtures `node-cli` through the scripted brownfield pipeline -> checker (default mode) exit 0;
//     preflight afterwards -> `upgrade`; `adopt.mode` was `adopt` throughout.
//  3. Pre-rename (2.x fleet shape, nested + decoys): the migrate sequence -> checker `--mode migrate` exit 0 with
//     every check ok: `on_adopt_branch`, `one_commit`, `tree_clean`, `not_pushed`, `no_legacy_layout`
//     (planMigration applies false; refusalFor null; no W066/W067/W069 at any `.aoforge/` root), `history_kept`
//     (`git log --follow` of a moved file spans more than the adopt commit), `report_lists_migration`
//     (ADOPT-REPORT.md has `## Migration` and a row per moved planning tree), `stamp_current` (no root config keeps
//     the old key; a config the migration converted has the new one).
//  4. Pre-rename 3.0-era (aoforge stamp in the old directory, AOFORGE block): migrate sequence -> checker green; the
//     Migration table holds no stamp-key and no block row, only the moves (and the ignore lines).
//  5. Nested-only (no root tree): migrate sequence -> checker green; the report is `api/.aoforge/ADOPT-REPORT.md`; no
//     root `.aoforge/` on disk or in HEAD.
//
// Equivalence with a hand migration:
//  6. A second copy of fixture 3, migrated by hand per the guide (git mv each tree, rename the stamp key in each
//     config, rename the block markers, rewrite the ignore lines) and committed: `validate health --raw` finding
//     codes at the root and at `api/` equal the adopt-migrated copy's; the adopt copy's root health has no error.
//  7. Planning content untouched: every file under the moved trees hashes the same before (legacy path) and after
//     (new path), except each config.json (one line) and the new ADOPT-REPORT.md.
//
// Re-runs and resume:
//  8. After success (fixture 3): preflight -> `upgrade`, begin -> `upgrade`; snapshot/compare unchanged.
//  9. After success (fixture 5): preflight -> `adopt-branch-exists` refusal, nothing written.
// 10. Interrupted after begin / after scaffold / after report (three fresh copies): running the sequence again from
//     preflight resumes (`route: resume`, `adopt.mode: migrate`) and ends in the same `git diff --name-status <base>
//     HEAD` set, the same health codes and the same planning-file hashes as the uninterrupted run.
// 11. Refusal through the sequence: a `both` fixture -> preflight `refuse` `both-planning-dirs`, the sequence stops,
//     snapshot unchanged.
//
// Every 3.1 tool works (fixture 3 after success, in this order):
// 12. `state load`, `roadmap analyze`, `validate health` exit 0 with no legacy-layout message; `doctor` has no
//     check-27 (legacy-planning-layout) finding; `upgrade --check` exit 0 listing pending migrations; `upgrade
//     --apply` exit 0 and committing its `changed_files` through `aof-tools commit` leaves a clean tree; `init
//     plan-objective 1` exit 0 (last).
//
// Defects the matrix found, pinned as `todo` rows (they run and show in the output, and do not fail the suite):
// 13. After success on an untracked planning tree (`untrackedTree`): preflight should route to `upgrade`. It routes to
//     `resume`, because the report is written into an ignored tree and is never in HEAD (adopt.cjs, 80-03's known
//     limitation).
// 14. One `upgrade --apply` (committed) should leave `upgrade --check` up to date. Migration 0005 needs a second pass
//     for a pre-v1-form block under the AOFORGE markers (not adopt's; it reproduces without a migration).
//
// Checker negatives (on a migrated fixture):
//  N1. an empty legacy planning tree with a STATE.md recreated -> `no_legacy_layout` false, exit 1.
//  N2. a second commit on aoforge/adopt -> `one_commit` false.
//  N3. the old stamp key put back -> `stamp_current` false.
//  N4. `check --mode <unknown>` -> usage on stderr, exit 1.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY } = require('./legacy-names.cjs');
const fx = require('./__fixtures__/legacy-adopt-fixtures.cjs');
const plainFx = require('./__fixtures__/adopt-fixtures.cjs');
const adopt = require('./adopt.cjs');
const legacyMigrate = require('./legacy-migrate.cjs');

const { planningDir: NEW_DIR, configKey: NEW_KEY, blockTag: NEW_TAG } = NAMES;
const { planningDir: OLD_DIR, configKey: OLD_KEY, blockTag: OLD_TAG } = LEGACY;

const AOF_TOOLS = path.join(__dirname, '..', 'aof-tools.cjs');
const CHECKER = path.join(__dirname, '__fixtures__', 'adopt-e2e-assert.cjs');

const MIGRATE_CHECK_IDS = [
  'on_adopt_branch', 'one_commit', 'tree_clean', 'not_pushed',
  'no_legacy_layout', 'history_kept', 'report_lists_migration', 'stamp_current',
];

// ─── helpers ──────────────────────────────────────────────────────────────────

/** A hand-built pre-rename repository with its own fake HOME; removed when the test ends. */
function fleet(t, options) {
  const repo = fx.legacyFleetRepo(options);
  t.after(() => repo.cleanup());
  return repo;
}

function jsonOf(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/** One aof-tools call against `repo`, with the parsed JSON (null when stdout is not JSON). */
function cli(repo, args) {
  const r = repo.run(args);
  return { ...r, json: jsonOf(r.stdout) };
}

/** The checker's CLI, spawned from a neutral directory. */
function runChecker(args) {
  const r = spawnSync(process.execPath, [CHECKER, ...args], { cwd: os.tmpdir(), encoding: 'utf-8', timeout: 120000 });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  return { status: r.status, stdout, stderr, out: stdout + stderr, json: jsonOf(stdout) };
}

const checkMigrate = (repo) => runChecker(['check', repo.root, '--home', repo.home, '--mode', 'migrate']);

/**
 * The migrate sequence the workflow prescribes, one CLI call per step. Stops after `stopAfter` ('preflight', 'begin',
 * 'scaffold', 'report' or 'commit'), or at a preflight that routes anywhere but migrate/resume (`stopped` names it).
 * -> { preflight, begin, scaffold, report, commit, stopped? }, each a { status, json, out }.
 */
function runSeq(repo, { stopAfter = 'commit' } = {}) {
  const res = {};
  const pre = cli(repo, ['adopt', 'preflight']);
  res.preflight = pre;
  const route = pre.json && pre.json.route;
  if (route !== 'migrate' && route !== 'resume') {
    res.stopped = route || 'no-json';
    return res;
  }
  if (stopAfter === 'preflight') return res;

  res.begin = cli(repo, ['adopt', 'begin']);
  assert.equal(res.begin.status, 0, res.begin.out);
  if (stopAfter === 'begin') return res;

  res.scaffold = cli(repo, ['adopt', 'scaffold']);
  assert.equal(res.scaffold.status, 0, res.scaffold.out);
  if (stopAfter === 'scaffold') return res;

  res.report = cli(repo, ['adopt', 'report']);
  assert.equal(res.report.status, 0, res.report.out);
  assert.equal(res.report.json.commit_blocked, null, res.report.out);
  if (stopAfter === 'report') return res;

  const { commit_message: message, commit_files: files } = res.report.json;
  assert.ok(Array.isArray(files) && files.length > 0, res.report.out);
  res.commit = cli(repo, ['commit', message, '--files', ...files]);
  assert.equal(res.commit.status, 0, res.commit.out);
  assert.equal(res.commit.json && res.commit.json.committed, true, res.commit.out);
  return res;
}

const headSha = (repo) => repo.git(['rev-parse', 'HEAD']).trim();
const abs = (repo, rel) => path.join(repo.root, ...rel.split('/'));

/** `git diff --name-status <base> HEAD` as sorted lines. */
function nameStatus(repo, base) {
  return repo.git(['diff', '--name-status', base, 'HEAD']).split('\n').filter(Boolean).sort();
}

/** The checker's result for `repo` must be green with exactly the migrate check ids, in order. */
function assertMigrateGreen(repo) {
  const res = checkMigrate(repo);
  assert.equal(res.status, 0, res.out);
  assert.ok(res.json, res.out);
  assert.deepEqual(res.json.checks.map((c) => c.id), MIGRATE_CHECK_IDS);
  for (const c of res.json.checks) assert.equal(c.ok, true, `${c.id}: ${c.detail}`);
  assert.equal(res.json.ok, true);
  return res;
}

/** The section of `text` from the `heading` line up to the next `## ` heading. */
function section(text, heading) {
  const start = text.indexOf(`\n${heading}\n`);
  assert.notEqual(start, -1, `${heading} is in the report`);
  const rest = text.slice(start + 1);
  const next = rest.indexOf('\n## ', heading.length);
  return next === -1 ? rest : rest.slice(0, next);
}

/** A scratch directory outside every fixture; removed when the test ends. */
function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-e2e-scratch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * The same handle `legacyFleetRepo` returns, for a repository of the ordinary adopt fixtures (no pre-rename layout):
 * { root, home, env, run, git, gitTry, snapshot }. `root` is made by `make(home, parent)`.
 */
function plainRepo(t, make) {
  const home = plainFx.makeFakeHome();
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aof-e2e-plain-')));
  t.after(() => {
    fs.rmSync(parent, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  });
  const root = make(home, parent);
  const env = plainFx.gitEnv(home);
  const gitTry = (args) => {
    const r = spawnSync('git', ['-C', root, ...args], { env, encoding: 'utf-8' });
    return { status: r.status, out: r.stdout || '', err: (r.stderr || '').trim() };
  };
  const git = (args) => {
    const r = gitTry(args);
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed (${r.status}): ${r.err}`);
    return r.out;
  };
  const run = (args) => {
    const r = spawnSync(process.execPath, [AOF_TOOLS, '--cwd', root, ...args], {
      cwd: parent, env, encoding: 'utf-8', timeout: 60000,
    });
    const stdout = r.stdout || '';
    const stderr = r.stderr || '';
    return { status: r.status, stdout, stderr, out: stdout + stderr };
  };
  const snapshot = () => ({
    ...plainFx.snapshot(root),
    ':git-status': gitTry(['status', '--porcelain=v1', '-z', '--untracked-files=all']).out,
    ':git-branches': gitTry(['branch', '--list']).out,
  });
  return { root, home, env, run, git, gitTry, snapshot };
}

const hasAdoptBranch = (repo) => repo.gitTry(['rev-parse', '--verify', '-q', `refs/heads/${adopt.ADOPT_BRANCH}`]).status === 0;
const markerOf = (repo) => adopt.readMarker(repo.root, repo.env).marker;

/**
 * The brownfield sequence adopt-e2e.test.cjs scripts: preflight -> begin -> skill marker on -> stand-in maps ->
 * PROJECT.md -> inferences -> scaffold -> validate health -> report -> skill marker off -> commit.
 */
function runBrownfield(repo, { name, kind }) {
  const res = {};
  res.preflight = cli(repo, ['adopt', 'preflight']);
  assert.equal(res.preflight.status, 0, res.preflight.out);
  assert.equal(res.preflight.json.route, 'adopt', res.preflight.out);
  res.begin = cli(repo, ['adopt', 'begin']);
  assert.equal(res.begin.status, 0, res.begin.out);
  assert.equal(cli(repo, ['skill-active', '--start', 'adopt']).status, 0);

  plainFx.writeMappedDocs(repo.root);
  plainFx.writeProjectMd(repo.root, { name, kind, defaultWork: 'feature' });
  plainFx.writeInferences(repo.root, [
    { field: 'kind', value: kind, confidence: 'high', evidence: 'fixture manifest' },
    { field: 'default_work', value: 'feature', confidence: 'low', evidence: 'no roadmap history' },
  ]);

  res.scaffold = cli(repo, ['adopt', 'scaffold']);
  assert.equal(res.scaffold.status, 0, res.scaffold.out);
  res.health = cli(repo, ['validate', 'health', '--raw']);
  assert.equal(res.health.status, 0, res.health.out);
  res.report = cli(repo, ['adopt', 'report']);
  assert.equal(res.report.status, 0, res.report.out);
  assert.equal(cli(repo, ['skill-active', '--end']).status, 0);

  res.commit = cli(repo, ['commit', res.report.json.commit_message, '--files', ...res.report.json.commit_files]);
  assert.equal(res.commit.status, 0, res.commit.out);
  return res;
}

/** `validate health --raw` finding codes (errors, warnings, info) at `dir` of the repository, sorted. */
function healthCodesAt(repo, dir) {
  const cwd = dir ? path.join(repo.root, dir) : repo.root;
  const r = spawnSync(process.execPath, [AOF_TOOLS, '--cwd', cwd, 'validate', 'health', '--raw'], {
    cwd: repo.root, env: repo.env, encoding: 'utf-8', timeout: 60000,
  });
  const report = JSON.parse(r.stdout);
  const codes = (k) => (report[k] || []).map((f) => f.code);
  return { errors: codes('errors').sort(), all: [...codes('errors'), ...codes('warnings'), ...codes('info')].sort() };
}

/** sha1 of every file below `rel`, keyed by its path inside `rel` (the runtime marker included). */
function treeHashes(repo, rel) {
  const out = {};
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const key = prefix ? `${prefix}/${e.name}` : e.name;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, key);
      else out[key] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(abs(repo, rel), '');
  return out;
}

const PLANNING_ROOTS = ['', 'api', 'web'];
const inDir = (dir, name) => (dir ? `${dir}/${name}` : name);

/**
 * What two runs that should agree must share: the changed paths, the health codes at the root and at api/, and the
 * hashes of the moved planning content (without ADOPT-REPORT.md, which carries a date) and of the files the
 * migration rewrites. Commit ids are left out on purpose: they differ between two fixtures built apart.
 */
function outcome(repo, base) {
  const hashes = {};
  for (const dir of PLANNING_ROOTS) {
    const tree = treeHashes(repo, inDir(dir, NEW_DIR));
    delete tree['ADOPT-REPORT.md'];
    hashes[inDir(dir, NEW_DIR)] = tree;
  }
  for (const rel of ['CLAUDE.md', '.gitignore', 'api/.gitignore']) {
    hashes[rel] = crypto.createHash('sha1').update(fs.readFileSync(abs(repo, rel))).digest('hex');
  }
  return { nameStatus: nameStatus(repo, base), health: { root: healthCodesAt(repo, ''), api: healthCodesAt(repo, 'api') }, hashes };
}

/** The guide's "Option B: by hand", for the fleet shape: move each tree, rename the key and markers, rewrite the ignore lines. */
function handMigrate(repo) {
  const rewrite = (rel, fn) => fs.writeFileSync(abs(repo, rel), fn(fs.readFileSync(abs(repo, rel), 'utf-8')));
  for (const dir of PLANNING_ROOTS) repo.git(['mv', inDir(dir, OLD_DIR), inDir(dir, NEW_DIR)]);
  for (const dir of ['', 'api']) {
    rewrite(inDir(dir, `${NEW_DIR}/config.json`), (text) => text.replace(`"${OLD_KEY}":`, `"${NEW_KEY}":`));
  }
  rewrite('CLAUDE.md', (text) => text.split(`<!-- ${OLD_TAG}:`).join(`<!-- ${NEW_TAG}:`));
  for (const rel of ['.gitignore', 'api/.gitignore']) {
    rewrite(rel, (text) => text.split(`${OLD_DIR}/`).join(`${NEW_DIR}/`));
  }
  repo.git(['add', '-A']);
  repo.git(['commit', '-q', '-m', 'move the planning layout by hand']);
}

// ─── 1-2: a fresh repository and a brownfield one ─────────────────────────────

test('1. fresh: an empty repository and a git-init-only directory route to new-project and nothing changes', (t) => {
  const empty = plainRepo(t, (home, parent) => plainFx.makeFixture('empty', { parent, home }));
  const before = empty.snapshot();
  const head = headSha(empty);

  const seq = runSeq(empty);
  assert.equal(seq.stopped, 'new-project', 'the sequence stops at the preflight');
  assert.equal(seq.begin, undefined, 'begin never ran');
  assert.equal(seq.preflight.status, 0, seq.preflight.out);
  const begin = cli(empty, ['adopt', 'begin']);
  assert.equal(begin.status, 0, begin.out);
  assert.equal(begin.json.route, 'new-project');
  assert.deepEqual(empty.snapshot(), before, 'working tree, git status and branches are unchanged');
  assert.equal(headSha(empty), head);
  assert.equal(hasAdoptBranch(empty), false, 'no aoforge/adopt branch');
  assert.equal(markerOf(empty), null, 'no marker');

  const bare = plainRepo(t, (home, parent) => {
    const dir = path.join(parent, 'bare');
    fs.mkdirSync(dir);
    const r = spawnSync('git', ['-C', dir, 'init', '-q', '-b', 'main'], { env: plainFx.gitEnv(home), encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    return dir;
  });
  const bareBefore = bare.snapshot();
  for (const sub of ['preflight', 'begin']) {
    const r = cli(bare, ['adopt', sub]);
    assert.equal(r.status, 0, r.out);
    assert.equal(r.json.route, 'new-project', r.out);
  }
  assert.deepEqual(bare.snapshot(), bareBefore);
  assert.equal(hasAdoptBranch(bare), false);
  assert.equal(markerOf(bare), null);
});

test('2. brownfield: the scripted pipeline passes the default checker; preflight afterwards routes to upgrade', (t) => {
  const repo = plainRepo(t, (home, parent) => plainFx.makeFixture('node-cli', { parent, home }));
  const seq = runBrownfield(repo, { name: 'Todo CLI', kind: 'cli' });
  assert.equal(seq.preflight.json.adopt.mode, 'adopt', 'adopt.mode was adopt at the preflight');
  assert.equal(seq.begin.json.adopt.mode, 'adopt', 'and at begin');
  assert.equal(seq.scaffold.json.mode, undefined, 'a fresh adopt result carries no mode');
  assert.equal(seq.report.json.mode, undefined);

  const res = runChecker(['check', repo.root, '--home', repo.home]);
  assert.equal(res.status, 0, res.out);
  assert.equal(res.json.ok, true, JSON.stringify(res.json, null, 2));
  assert.ok(res.json.checks.some((c) => c.id === 'branch_is_adopt'), 'the default mode runs the brownfield checks');
  for (const c of res.json.checks) assert.equal(c.ok, true, `${c.id}: ${c.detail}`);

  const before = repo.snapshot();
  const pf = cli(repo, ['adopt', 'preflight']);
  assert.equal(pf.status, 0, pf.out);
  assert.equal(pf.json.route, 'upgrade');
  assert.equal(pf.json.adopt.mode, 'adopt');
  assert.deepEqual(repo.snapshot(), before, 'the second preflight writes nothing');
});

// ─── 3: the pre-rename fleet shape, and the checker's migrate mode ────────────

test('3. pre-rename fleet shape (2.x, nested, decoys): the migrate sequence ends in one clean change and the migrate checks are green', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const base = headSha(repo);

  const seq = runSeq(repo);
  assert.equal(seq.preflight.status, 0, seq.preflight.out);
  assert.equal(seq.preflight.json.route, 'migrate');
  assert.equal(seq.preflight.json.adopt.mode, 'migrate');
  assert.equal(seq.begin.json.created_branch, true);
  assert.equal(seq.scaffold.json.mode, 'migrate');
  assert.equal(seq.report.json.mode, 'migrate');

  assertMigrateGreen(repo);

  // The change touches only what a migration may write.
  const paths = nameStatus(repo, base).flatMap((line) => line.split('\t').slice(1));
  assert.ok(paths.length > 0);
  for (const p of paths) assert.equal(legacyMigrate.ownsMigratePath(p), true, `${p} is not a migration path`);

  // Spot checks outside the checker, so a vacuous green would show: history crosses the move, the key is renamed.
  const follow = repo.git(['log', '--follow', '--format=%s', '--', `${NEW_DIR}/ROADMAP.md`]).split('\n').filter(Boolean);
  assert.ok(follow.length > 1 && follow.includes('init'), `history crosses the move: ${follow.join(', ')}`);
  for (const rel of [`${NEW_DIR}/config.json`, `api/${NEW_DIR}/config.json`]) {
    const cfg = JSON.parse(fs.readFileSync(abs(repo, rel), 'utf-8'));
    assert.ok(NEW_KEY in cfg && !(OLD_KEY in cfg), `${rel} carries the new key only`);
  }
  const report = fs.readFileSync(abs(repo, `${NEW_DIR}/ADOPT-REPORT.md`), 'utf-8');
  const migration = section(report, '## Migration');
  for (const dir of ['', 'api/', 'web/']) {
    assert.ok(migration.includes(`${dir}${NEW_DIR}`), `the Migration section has a row for ${dir}${NEW_DIR}`);
  }
});

// ─── 4-5: the other pre-rename shapes ─────────────────────────────────────────

test('4. pre-rename 3.0-era (new stamp key, AOFORGE block, old directory): only the moves are migrated', (t) => {
  const repo = fleet(t, { era: '3.0', nested: true, decoys: true });
  const base = headSha(repo);
  const seq = runSeq(repo);
  assert.equal(seq.preflight.json.route, 'migrate');
  assertMigrateGreen(repo);

  const migration = section(fs.readFileSync(abs(repo, `${NEW_DIR}/ADOPT-REPORT.md`), 'utf-8'), '## Migration');
  const kinds = migration.split('\n').filter((l) => l.startsWith('| ') && !/^\| (Change|---)/.test(l))
    .map((l) => l.split('|')[1].trim());
  assert.equal(kinds.filter((k) => k === 'Planning tree').length, 3, migration);
  assert.deepEqual(kinds.filter((k) => k !== 'Planning tree' && k !== 'Ignore line' && k !== 'Exclude line'), [],
    `no stamp-key and no block row: ${kinds.join(', ')}`);

  const changed = nameStatus(repo, base).flatMap((line) => line.split('\t').slice(1));
  assert.ok(!changed.includes('CLAUDE.md'), 'the AOFORGE block needed no conversion');
  assert.deepEqual(seq.scaffold.json.migration.stamps.filter((s) => s.action), []);
  assert.deepEqual(seq.scaffold.json.migration.blocks, []);
});

test('5. nested-only (no root tree): the report goes in api/.aoforge and no root .aoforge exists', (t) => {
  const repo = fleet(t, { rootTree: false, decoys: true });
  const seq = runSeq(repo);
  assert.equal(seq.preflight.json.route, 'migrate');
  assert.equal(seq.report.json.report_path, `api/${NEW_DIR}/ADOPT-REPORT.md`);
  assertMigrateGreen(repo);

  assert.ok(fs.existsSync(abs(repo, `api/${NEW_DIR}/ADOPT-REPORT.md`)));
  assert.equal(fs.existsSync(abs(repo, NEW_DIR)), false, 'no root .aoforge on disk');
  assert.notEqual(repo.gitTry(['cat-file', '-e', `HEAD:${NEW_DIR}`]).status, 0, 'no root .aoforge in HEAD');
  assert.equal(repo.git(['ls-tree', 'HEAD', '--', NEW_DIR]).trim(), '');
});

// ─── 6-7: equivalent to a hand migration, content untouched ───────────────────

test('6. adopt-migrated and hand-migrated copies report the same health codes at the root and at api/', (t) => {
  const viaAdopt = fleet(t, { nested: true, decoys: true });
  runSeq(viaAdopt);
  const byHand = fleet(t, { nested: true, decoys: true });
  handMigrate(byHand);

  for (const dir of ['', 'api']) {
    const a = healthCodesAt(viaAdopt, dir);
    const h = healthCodesAt(byHand, dir);
    assert.ok(a.all.length > 0, `validate health ran at ${dir || 'the root'}`);
    assert.deepEqual(a.all, h.all, `finding codes at ${dir || 'the root'}`);
  }
  assert.deepEqual(healthCodesAt(viaAdopt, '').errors, [], 'the adopt copy has no health error at the root');
  assert.deepEqual(healthCodesAt(byHand, '').errors, [], 'nor the hand copy');
});

test('7. planning content is untouched: every moved file keeps its hash but each config.json (one line) and the new report', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const before = {};
  const configs = {};
  for (const dir of PLANNING_ROOTS) {
    before[dir] = treeHashes(repo, inDir(dir, OLD_DIR));
    if (before[dir]['config.json']) configs[dir] = fs.readFileSync(abs(repo, inDir(dir, `${OLD_DIR}/config.json`)), 'utf-8');
  }
  assert.ok(before[''] && Object.keys(before['']).length > 10, 'the fixture has a real tree');
  runSeq(repo);

  for (const dir of PLANNING_ROOTS) {
    const after = treeHashes(repo, inDir(dir, NEW_DIR));
    const added = Object.keys(after).filter((k) => !(k in before[dir]));
    assert.deepEqual(added, dir === '' ? ['ADOPT-REPORT.md'] : [], `files added under ${inDir(dir, NEW_DIR)}`);
    for (const [key, hash] of Object.entries(before[dir])) {
      if (key === 'config.json') continue;
      assert.equal(after[key], hash, `${inDir(dir, NEW_DIR)}/${key} keeps its bytes`);
    }
    assert.deepEqual(Object.keys(before[dir]).filter((k) => !(k in after)), [], `files lost from ${inDir(dir, OLD_DIR)}`);
    if (configs[dir] !== undefined) {
      const was = configs[dir].split('\n');
      const now = fs.readFileSync(abs(repo, inDir(dir, `${NEW_DIR}/config.json`)), 'utf-8').split('\n');
      assert.equal(now.length, was.length, `${inDir(dir, 'config.json')} keeps its line count`);
      assert.equal(was.filter((line, i) => line !== now[i]).length, 1, `${inDir(dir, 'config.json')} changes one line`);
    }
  }
});

// ─── 8-9: a re-run after success writes nothing ───────────────────────────────

test('8. after success the workflow routes to upgrade and a re-run writes nothing', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  runSeq(repo);
  const dir = scratch(t);
  const snapFile = path.join(dir, 'before.json');
  assert.equal(runChecker(['snapshot', repo.root, '--out', snapFile]).status, 0);
  const before = repo.snapshot();
  const head = headSha(repo);
  const marker = JSON.stringify(markerOf(repo));

  const pf = cli(repo, ['adopt', 'preflight']);
  assert.equal(pf.status, 0, pf.out);
  assert.equal(pf.json.route, 'upgrade');
  const bg = cli(repo, ['adopt', 'begin']);
  assert.equal(bg.status, 0, bg.out);
  assert.equal(bg.json.route, 'upgrade');

  const cmp = runChecker(['compare', repo.root, '--before', snapFile]);
  assert.equal(cmp.status, 0, cmp.out);
  assert.deepEqual(cmp.json.changed, []);
  assert.deepEqual(repo.snapshot(), before);
  assert.equal(headSha(repo), head);
  assert.equal(JSON.stringify(markerOf(repo)), marker, 'the marker is untouched');
});

test('9. after success on a nested-only repo the workflow refuses adopt-branch-exists and writes nothing', (t) => {
  const repo = fleet(t, { rootTree: false, decoys: true });
  runSeq(repo);
  const before = repo.snapshot();
  const head = headSha(repo);

  for (const sub of ['preflight', 'begin']) {
    const r = cli(repo, ['adopt', sub]);
    assert.equal(r.status, 3, r.out);
    assert.equal(r.json.route, 'refuse');
    assert.equal(r.json.reason, 'adopt-branch-exists');
  }
  assert.deepEqual(repo.snapshot(), before);
  assert.equal(headSha(repo), head);
});

// ─── 10: an interrupted run resumes to the same tree ──────────────────────────

let uninterrupted = null;

/** The outcome of the uninterrupted run (a fixture built for it and removed; computed once, it is plain data). */
function uninterruptedOutcome(t) {
  if (uninterrupted === null) {
    const repo = fleet(t, { nested: true, decoys: true });
    const base = headSha(repo);
    runSeq(repo);
    uninterrupted = outcome(repo, base);
  }
  return uninterrupted;
}

for (const stopAfter of ['begin', 'scaffold', 'report']) {
  test(`10. interrupted after ${stopAfter}: running the sequence again resumes to the same tree`, (t) => {
    const expected = uninterruptedOutcome(t);
    const repo = fleet(t, { nested: true, decoys: true });
    const base = headSha(repo);

    const first = runSeq(repo, { stopAfter });
    assert.equal(first.preflight.json.route, 'migrate');
    assert.equal(first.commit, undefined, 'the first run stopped before the commit');
    assert.equal(headSha(repo), base, 'nothing is committed yet');

    const second = runSeq(repo);
    assert.equal(second.preflight.json.route, 'resume', second.preflight.out);
    assert.equal(second.preflight.json.adopt.mode, 'migrate');
    const steps = { begin: [true, false, false], scaffold: [true, true, false], report: [true, true, true] }[stopAfter];
    assert.deepEqual(second.preflight.json.adopt.steps, { moved: steps[0], scaffolded: steps[1], reported: steps[2] },
      'the resume starts from the step the first run stopped after');
    assert.equal(second.begin.json.created_branch, false);
    assertMigrateGreen(repo);
    assert.deepEqual(outcome(repo, base), expected);
  });
}

// ─── 11: a refusal stops the sequence ─────────────────────────────────────────

test('11. both planning directories: preflight refuses, the sequence stops and nothing changes', (t) => {
  const repo = fleet(t, { state: 'both' });
  const before = repo.snapshot();
  const head = headSha(repo);

  const seq = runSeq(repo);
  assert.equal(seq.stopped, 'refuse');
  assert.equal(seq.preflight.status, 3, seq.preflight.out);
  assert.equal(seq.preflight.json.reason, 'both-planning-dirs');
  assert.match(seq.preflight.json.message, /both exist/);
  assert.equal(seq.begin, undefined, 'begin never ran');
  assert.deepEqual(repo.snapshot(), before);
  assert.equal(headSha(repo), head);
  assert.equal(hasAdoptBranch(repo), false);
});

// ─── 12: every 3.1 tool works on the migrated repository ──────────────────────

test('12. every 3.1 tool works on the migrated repository', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  runSeq(repo);
  assertMigrateGreen(repo);
  const layoutCodes = ['W066', 'W067', 'W069'];

  const load = cli(repo, ['state', 'load']);
  assert.equal(load.status, 0, load.out);
  const analyze = cli(repo, ['roadmap', 'analyze']);
  assert.equal(analyze.status, 0, analyze.out);
  assert.ok(analyze.json.objectives.length >= 2, 'the roadmap parses');

  const health = cli(repo, ['validate', 'health', '--raw']);
  assert.equal(health.status, 0, health.out);
  const findings = ['errors', 'warnings', 'info'].flatMap((k) => health.json[k] || []);
  assert.deepEqual(findings.filter((f) => layoutCodes.includes(f.code) || /legacy/i.test(f.message)), []);
  assert.deepEqual(health.json.errors, []);

  // doctor's overall exit code reflects the fake HOME (no installed plugin), so assert on check 27 alone.
  const doctor = cli(repo, ['doctor', '--json']);
  const layout = doctor.json && doctor.json.checks.find((c) => c.id === 'legacy-planning-layout');
  assert.ok(layout, doctor.out.slice(0, 400));
  assert.equal(layout.severity, 'ok', layout.finding);

  const check = cli(repo, ['upgrade', '--check']);
  assert.equal(check.status, 0, check.out);
  assert.equal(check.json.up_to_date, false);
  assert.ok(check.json.pending.length > 0, 'the project has upgrade migrations pending');

  const apply = cli(repo, ['upgrade', '--apply']);
  assert.equal(apply.status, 0, apply.out);
  assert.deepEqual(apply.json.failed, []);
  assert.ok(apply.json.changed_files.length > 0);
  const commit = cli(repo, ['commit', 'chore(aoforge): apply the pending upgrade migrations', '--files', ...apply.json.changed_files]);
  assert.equal(commit.status, 0, commit.out);
  assert.equal(commit.json.committed, true);
  assert.equal(repo.git(['status', '--porcelain']).trim(), '', 'the upgrade change committed cleanly');

  // Last: it bootstraps OBJECTIVE.md files and would dirty the tree the checks above read.
  const plan = cli(repo, ['init', 'plan-objective', '1']);
  assert.equal(plan.status, 0, plan.out);
  assert.equal(plan.json.objective_found, true);
});

// ─── 13: a defect the matrix found (adopt.cjs, reported not fixed) ────────────

test('13. after success on an untracked planning tree the workflow does not ask to resume', {
  todo: 'DEFECT (80-03 known limitation, reproduced by 80-06): with an untracked planning tree the report is never in '
    + 'HEAD, so adopt preflight still reads the marker as unfinished and routes to resume after the commit',
}, (t) => {
  const repo = fleet(t, { untrackedTree: true });
  runSeq(repo);
  const pf = cli(repo, ['adopt', 'preflight']);
  assert.equal(pf.status, 0, pf.out);
  assert.equal(pf.json.route, 'upgrade', `preflight after a finished adopt: ${pf.json.route} (${pf.json.next})`);
});

test('14. one upgrade --apply brings the migrated repository up to date', {
  todo: 'DEFECT (migration 0005, not adopt; reproduced on any project whose CLAUDE.md holds a pre-v1-form block under the '
    + 'AOFORGE markers): the first upgrade --apply reports 0005 applied (legacy -> v=2) but upgrade --check still lists 0005 '
    + '("# Development Rules section differs from the template (drift)"); a second --apply converges',
}, (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  runSeq(repo);
  const apply = cli(repo, ['upgrade', '--apply']);
  assert.equal(apply.status, 0, apply.out);
  const commit = cli(repo, ['commit', 'chore(aoforge): apply the pending upgrade migrations', '--files', ...apply.json.changed_files]);
  assert.equal(commit.status, 0, commit.out);
  const check = cli(repo, ['upgrade', '--check']);
  assert.equal(check.json.up_to_date, true, `still pending: ${JSON.stringify(check.json.pending.map((p) => `${p.id}: ${p.reason}`))}`);
});

// ─── checker negatives ────────────────────────────────────────────────────────

function migrated(t, options = { nested: true, decoys: true }) {
  const repo = fleet(t, options);
  runSeq(repo);
  assertMigrateGreen(repo);
  return repo;
}

const failingIds = (res) => res.json.checks.filter((c) => !c.ok).map((c) => c.id);

test('negative N1: an empty legacy planning tree with a STATE.md recreated fails no_legacy_layout', (t) => {
  const repo = migrated(t);
  fs.mkdirSync(abs(repo, OLD_DIR), { recursive: true });
  fs.writeFileSync(abs(repo, `${OLD_DIR}/STATE.md`), '# Project State\n');
  const res = checkMigrate(repo);
  assert.equal(res.status, 1, res.out);
  assert.ok(failingIds(res).includes('no_legacy_layout'), JSON.stringify(res.json.checks));
});

test('negative N2: a second commit on aoforge/adopt fails one_commit', (t) => {
  const repo = migrated(t);
  fs.writeFileSync(abs(repo, 'EXTRA.md'), 'extra work\n');
  repo.git(['add', '-A']);
  repo.git(['commit', '-q', '-m', 'extra commit']);
  const res = checkMigrate(repo);
  assert.equal(res.status, 1, res.out);
  assert.ok(failingIds(res).includes('one_commit'), JSON.stringify(res.json.checks));
});

test('negative N3: the old stamp key put back fails stamp_current', (t) => {
  const repo = migrated(t);
  const file = abs(repo, `${NEW_DIR}/config.json`);
  const cfg = JSON.parse(fs.readFileSync(file, 'utf-8'));
  cfg[OLD_KEY] = cfg[NEW_KEY];
  delete cfg[NEW_KEY];
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
  const res = checkMigrate(repo);
  assert.equal(res.status, 1, res.out);
  assert.ok(failingIds(res).includes('stamp_current'), JSON.stringify(res.json.checks));
});

test('negative N4: an unknown --mode prints usage and exits 1', () => {
  const res = runChecker(['check', os.tmpdir(), '--home', os.tmpdir(), '--mode', 'bogus']);
  assert.equal(res.status, 1, res.out);
  assert.match(res.stderr, /Usage: adopt-e2e-assert\.cjs check/);
  assert.match(res.stderr, /--mode/);
  assert.equal(res.stdout, '');
});
