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
// Checker negatives (on a migrated fixture):
//  N1. an empty legacy planning tree with a STATE.md recreated -> `no_legacy_layout` false, exit 1.
//  N2. a second commit on aoforge/adopt -> `one_commit` false.
//  N3. the old stamp key put back -> `stamp_current` false.
//  N4. `check --mode <unknown>` -> usage on stderr, exit 1.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY } = require('./legacy-names.cjs');
const fx = require('./__fixtures__/legacy-adopt-fixtures.cjs');
const legacyMigrate = require('./legacy-migrate.cjs');

const { planningDir: NEW_DIR, configKey: NEW_KEY } = NAMES;
const { planningDir: OLD_DIR, configKey: OLD_KEY } = LEGACY;

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
