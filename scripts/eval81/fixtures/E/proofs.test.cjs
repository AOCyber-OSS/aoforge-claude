'use strict';

// Test list 1-3 (TRD 81-12, objective 81, SC-2 and SC-4). The test-E project and the proof that its hidden checks
// decide outcomes: they fail on the base project and pass on a hand-written solution. Outermost first.
//
// 1. buildFixture is deterministic (two builds give the same tree, history and HEAD) and the built repository holds no
//    acceptance or reference file, none of their seeded data, and no word that says what it is for; the config carries
//    the workload settings and the 3.0.0 stamp with v3.0.0's migration ids.
// 2. This checkout's (3.1.0) `validate health` reports no errors on it (W040 project-behind is the one warning: the
//    3.0.0 stamp is the upgrade path the 3.1.0 runs exercise) and `upgrade --check` has nothing pending but the stamp;
//    v3.0.0's own aof-tools (exported read-only with `git archive`) reports it healthy and up to date; both versions'
//    `init plan-objective 1` find objective 1 unplanned. The v3.0.0 half is skipped, with the reason, when the tag is
//    not in the clone (a shallow CI checkout).
// 3. checkQuick and checkBuild fail on the base project while its own tests pass; applying reference.cjs's quick (or
//    build) solution makes the matching check pass with `node --test` green, and not the other check; a VERIFICATION.md
//    with any status but passed fails checkBuild.
//
// Runtime model: every subprocess runs with cwd = a directory under an mkdtemp dir of os.tmpdir() and HOME = a separate
// mkdtemp home. Nothing is written under the repository or the real HOME; the repository is only read (git archive,
// git ls-tree, git rev-parse).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const build = require('./build.cjs');
const { checkQuick, checkBuild, QUICK_SEED, BUILD_SEED } = require('./acceptance.cjs');
const { applyQuick, applyBuild } = require('./reference.cjs');
const { LEGACY } = require('../../../../plugins/aoforge/aoforge/bin/lib/legacy-names.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const AOF_TOOLS = path.join(REPO_ROOT, 'plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs');
const MIGRATIONS_DIR = 'plugins/aoforge/aoforge/bin/lib/migrations/';

// Words that would say what the repository is for, and the product's pre-rename names (built from LEGACY).
const REVEALING = /acceptance|reference|fixture|eval|hidden|answer/i;
const LEGACY_NAMES = [LEGACY.slug, LEGACY.cli, LEGACY.planningDir];

let ROOT;
let HOME;
let BASE;
let V300 = null; // { aofTools } once the v3.0.0 runtime is exported, else { skip: reason }

before(() => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-E-'));
  HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-E-home-'));
  BASE = path.join(ROOT, 'base');
  build.buildFixture(BASE);
});

after(() => {
  if (ROOT) fs.rmSync(ROOT, { recursive: true, force: true });
  if (HOME) fs.rmSync(HOME, { recursive: true, force: true });
});

// ─── helpers ────────────────────────────────────────────────────────────────────────────────────────────────

const ENV = () => ({ PATH: process.env.PATH, HOME, TMPDIR: ROOT, LC_ALL: 'C' });

function sh(cwd, cmd, args) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', env: ENV() });
}
const gitOut = (cwd, ...args) => {
  const r = sh(cwd, 'git', ['--no-optional-locks', ...args]);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const aof = (tools, cwd, ...args) => sh(cwd, process.execPath, [tools, ...args]);
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

/** Every file below dir except .git, as { relPath: content }. */
function tree(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === '.git') continue;
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out[path.relative(dir, abs)] = fs.readFileSync(abs, 'utf8');
    }
  };
  walk(dir);
  return out;
}

/** A fresh build in its own dir under ROOT. */
function fresh(name) {
  const dir = path.join(ROOT, name);
  build.buildFixture(dir);
  return dir;
}

/** v3.0.0's plugin runtime, exported once with git archive (read-only); { skip } when the tag is absent. */
function v300() {
  if (V300) return V300;
  const tag = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--verify', '--quiet', 'v3.0.0^{commit}'], { encoding: 'utf8' });
  if (tag.status !== 0) {
    V300 = { skip: 'the v3.0.0 tag is not in this clone (shallow checkout); the 3.0.0 half needs it' };
    return V300;
  }
  const dir = path.join(ROOT, 'v3.0.0');
  fs.mkdirSync(dir);
  const tar = path.join(ROOT, 'v3.0.0.tar');
  const a = spawnSync('git', ['-C', REPO_ROOT, 'archive', '--format=tar', '-o', tar, 'v3.0.0',
    'plugins/aoforge/aoforge', 'plugins/aoforge/.claude-plugin'], { encoding: 'utf8' });
  assert.equal(a.status, 0, `git archive v3.0.0: ${a.stderr}`);
  const x = spawnSync('tar', ['-xf', tar, '-C', dir], { encoding: 'utf8' });
  assert.equal(x.status, 0, `tar: ${x.stderr}`);
  V300 = { aofTools: path.join(dir, 'plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs') };
  return V300;
}

// ─── 1. determinism and nothing hidden in the project ───────────────────────────────────────────────────────

test('1. buildFixture builds twice to the same tree, history and HEAD, all committed on main', () => {
  const again = path.join(ROOT, 'again');
  const info = build.buildFixture(again);
  assert.deepEqual(Object.keys(tree(again)), Object.keys(tree(BASE)));
  assert.deepEqual(tree(again), tree(BASE));
  const fmt = ['log', '--format=%H%n%s%n%an%n%ae%n%ad', '--date=iso-strict'];
  assert.equal(gitOut(again, ...fmt), gitOut(BASE, ...fmt));
  assert.equal(info.head, gitOut(BASE, 'rev-parse', 'HEAD').trim());
  assert.equal(gitOut(BASE, 'status', '--porcelain', '--ignored'), '', 'everything is committed and nothing is ignored');
  assert.equal(gitOut(BASE, 'branch', '--show-current').trim(), 'main');
  const subjects = gitOut(BASE, 'log', '--reverse', '--format=%s').trim().split('\n');
  assert.deepEqual(subjects, build.describeFixture().commits);
  assert.equal(subjects.length, 3);
  const authors = new Set(gitOut(BASE, 'log', '--format=%an <%ae> %cn <%ce>').trim().split('\n'));
  assert.deepEqual([...authors], [`${build.AUTHOR.name} <${build.AUTHOR.email}> ${build.AUTHOR.name} <${build.AUTHOR.email}>`]);
  const dates = gitOut(BASE, 'log', '--reverse', '--format=%aI').trim().split('\n');
  assert.deepEqual(dates.map((d) => new Date(d).toISOString()), build.COMMIT_DATES.map((d) => new Date(d).toISOString()));
});

test('1. buildFixture refuses a directory that already holds files', () => {
  const dir = fs.mkdtempSync(path.join(ROOT, 'full-'));
  fs.writeFileSync(path.join(dir, 'x'), 'x');
  assert.throws(() => build.buildFixture(dir), /empty directory/);
});

test('1. the project holds no acceptance or reference file, no seeded check data and no revealing word', () => {
  const files = tree(BASE);
  const seeds = [...QUICK_SEED, ...BUILD_SEED].map((n) => n.text);
  for (const [rel, content] of Object.entries(files)) {
    assert.ok(!REVEALING.test(rel), `path ${rel} contains ${REVEALING.exec(rel)}`);
    assert.ok(!/^(acceptance|reference)\.c?js$/.test(path.basename(rel)), `${rel} is a judging file`);
    // STATE.md's standard template heading "Project Reference" is the one masked phrase.
    const text = rel === '.aoforge/STATE.md' ? content.replace('## Project Reference\n', '') : content;
    assert.ok(!REVEALING.test(text), `file ${rel} contains ${REVEALING.exec(text)}`);
    for (const text of seeds) assert.ok(!content.includes(text), `file ${rel} contains the seeded note "${text}"`);
    for (const name of LEGACY_NAMES) assert.ok(!content.toLowerCase().includes(name.toLowerCase()), `file ${rel} has a pre-rename name`);
  }
  const meta = gitOut(BASE, 'log', '--format=%an%n%ae%n%cn%n%ce%n%B');
  assert.ok(!REVEALING.test(meta), `commit metadata contains ${REVEALING.exec(meta)}`);
  // The builder never reads the judging modules, so it cannot copy them. Its one match is STATE.md's standard heading
  // "## Project Reference", which validate health and the state digest read.
  const src = fs.readFileSync(path.join(__dirname, 'build.cjs'), 'utf8').replace('## Project Reference\n', '');
  assert.ok(!/acceptance|reference/i.test(src), 'build.cjs names neither judging module');
  assert.ok(!/require\(['"]\.\/(acceptance|reference)/.test(fs.readFileSync(path.join(__dirname, 'build.cjs'), 'utf8')));
});

test('1. the project is notekit with an unplanned objective 1 and the workload config', () => {
  const files = tree(BASE);
  assert.deepEqual(Object.keys(files).sort(), [
    '.aoforge/PROJECT.md',
    '.aoforge/REQUIREMENTS.md',
    '.aoforge/ROADMAP.md',
    '.aoforge/STATE.md',
    '.aoforge/config.json',
    '.aoforge/objectives/01-tags/OBJECTIVE.md',
    '.aoforge/state.json',
    '.gitignore',
    'README.md',
    'notes.json',
    'package.json',
    'src/cli.js',
    'src/store.js',
    'test/cli.test.js',
    'test/store.test.js',
  ]);
  const config = JSON.parse(files['.aoforge/config.json']);
  assert.equal(config.model_profile, 'balanced');
  assert.equal(config.mode, 'yolo');
  assert.equal(config.workflow.auto_advance, true);
  assert.equal(config.workflow.research, false);
  assert.deepEqual(config.aoforge, { version: '3.0.0', migrations_applied: build.V300_MIGRATIONS, upgraded_at: '2026-10-01T10:20:00.000Z' });
  assert.match(files['.aoforge/PROJECT.md'], /^---\nkind: cli\ndefault_work: feature\n---/);
  assert.match(files['.aoforge/objectives/01-tags/OBJECTIVE.md'], /^---\nwork: feature\n---/);
  const roadmap = files['.aoforge/ROADMAP.md'];
  assert.match(roadmap, /^### Objective 1: Tags$/m);
  assert.match(roadmap, /^\*\*Goal\*\*: Notes can be tagged and listed by tag$/m);
  assert.match(roadmap, /`notekit tag <id> <tag>` persists a tag/);
  assert.match(roadmap, /`notekit list --tag <tag>` lists only the matching notes/);
  assert.match(roadmap, /Tests cover both/);
  assert.match(files['.aoforge/REQUIREMENTS.md'], /\*\*TAG-01\*\*/);
  assert.match(files['.aoforge/REQUIREMENTS.md'], /\*\*TAG-02\*\*/);
  assert.ok(!Object.keys(files).some((f) => /-(TRD|JOB|SUMMARY|VERIFICATION)\.md$/.test(f)), 'objective 1 is unplanned');
  assert.deepEqual(JSON.parse(files['package.json']).scripts, { test: 'node --test' });
  assert.deepEqual(JSON.parse(files['notes.json']).map((n) => Object.keys(n).sort().join(',')), ['id,text', 'id,text', 'id,text']);
  assert.equal(build.QUICK_PROMPT, '/aoforge:quick Add a --json flag to `notekit list` that prints the notes as a JSON array of {id, text} objects, with a test.');
  assert.equal(build.BUILD_PROMPT, '/aoforge:build 1 --skip-research --auto');
});

test('1. V300_MIGRATIONS are the migration ids v3.0.0 ships', (t) => {
  const tag = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--verify', '--quiet', 'v3.0.0^{commit}'], { encoding: 'utf8' });
  if (tag.status !== 0) return t.skip('the v3.0.0 tag is not in this clone');
  const r = spawnSync('git', ['-C', REPO_ROOT, 'ls-tree', '--name-only', 'v3.0.0', MIGRATIONS_DIR], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const ids = [...new Set(r.stdout.trim().split('\n')
    .map((p) => path.basename(p))
    .filter((n) => /^\d{4}-.+\.cjs$/.test(n) && !/\.test\.cjs$/.test(n))
    .map((n) => n.slice(0, 4)))].sort();
  assert.deepEqual(build.V300_MIGRATIONS, ids);
});

// ─── 2. valid for 3.1.0 (this checkout) and for 3.0.0 ───────────────────────────────────────────────────────

test('2. this checkout (3.1.0): validate health has no errors and only W040, upgrade --check has only the stamp', () => {
  const dir = fresh('health-31');
  const health = aof(AOF_TOOLS, dir, 'validate', 'health', '--raw');
  const report = JSON.parse(health.stdout);
  assert.deepEqual(report.errors, []);
  // Finding: the 3.0.0 stamp is the upgrade path itself (W040 project-behind, 0 pending), not a defect.
  assert.deepEqual(report.warnings.map((w) => w.code), ['W040']);
  assert.match(report.warnings[0].message, /stamped v3\.0\.0, AOForge v3\.1\.0; 0 pending, 0 need confirmation/);
  const up = aof(AOF_TOOLS, dir, 'upgrade', '--check');
  assert.equal(up.status, 0, up.stderr);
  const check = JSON.parse(up.stdout);
  assert.equal(check.up_to_date, false);
  assert.match(aof(AOF_TOOLS, dir, 'upgrade', '--check', '--raw').stdout.trim(), /^nothing pending; stamped v3\.0\.0, AOForge v3\.1\.0/);
  assert.equal(check.from, '3.0.0');
  assert.equal(check.to, '3.1.0');
  assert.deepEqual(check.pending, []);
  assert.deepEqual(check.pending_confirm, []);
  assert.deepEqual(check.failed, []);
  const init = JSON.parse(aof(AOF_TOOLS, dir, 'init', 'plan-objective', '1').stdout);
  assert.equal(init.objective_found, true);
  assert.equal(init.objective_dir, '.aoforge/objectives/01-tags');
  assert.equal(init.has_jobs, false);
  assert.equal(init.research_enabled, false);
  assert.equal(gitOut(dir, 'status', '--porcelain'), '', 'the checks wrote nothing into the project');
});

test('2. v3.0.0 aof-tools: healthy, up to date at v3.0.0 and objective 1 found unplanned', (t) => {
  const v = v300();
  if (v.skip) return t.skip(v.skip);
  const dir = fresh('health-30');
  const health = JSON.parse(aof(v.aofTools, dir, 'validate', 'health', '--raw').stdout);
  assert.equal(health.engine_version, '3.0.0');
  assert.deepEqual(health.errors, []);
  assert.deepEqual(health.warnings, []);
  const up = aof(v.aofTools, dir, 'upgrade', '--check', '--raw');
  assert.equal(up.status, 0, up.stderr);
  assert.equal(up.stdout.trim(), 'up to date (v3.0.0)');
  const init = JSON.parse(aof(v.aofTools, dir, 'init', 'plan-objective', '1').stdout);
  assert.equal(init.objective_found, true);
  assert.equal(init.objective_dir, '.aoforge/objectives/01-tags');
  assert.equal(init.has_jobs, false);
  assert.equal(init.research_enabled, false);
  assert.equal(gitOut(dir, 'status', '--porcelain'), '', 'the checks wrote nothing into the project');
});

// ─── 3. the hidden checks decide the outcome ────────────────────────────────────────────────────────────────

test('3. both checks fail on the base project although its own tests pass', () => {
  const dir = fresh('base-checks');
  const q = checkQuick(dir, ENV());
  assert.equal(q.pass, false);
  assert.equal(q.tests.ok, true, 'the project own tests pass');
  assert.equal(q.tests.pass, 6);
  assert.deepEqual(q.checks.filter((c) => !c.pass).map((c) => c.name),
    ['list --json prints the notes as a JSON array of {id, text}']);
  const b = checkBuild(dir, ENV());
  assert.equal(b.pass, false);
  assert.equal(b.tests.ok, true);
  // The base `list` ignores extra arguments, so `list --tag work` exits 0 and prints every note.
  assert.deepEqual(b.checks.filter((c) => !c.pass).map((c) => c.name),
    ['tag 1 work exits 0', 'list --tag work prints note 1 and no other note']);
  assert.equal(b.verification_status, null);
  assert.equal(b.verification_file, null);
  assert.equal(gitOut(dir, 'status', '--porcelain'), '', 'the checks never touch the project notes.json');
});

test('3. the quick solution passes checkQuick with node --test green, and not checkBuild', () => {
  const dir = fresh('quick-ref');
  assert.deepEqual(applyQuick(dir), ['src/cli.js', 'test/list-json.test.js']);
  const q = checkQuick(dir, ENV());
  assert.equal(q.pass, true, JSON.stringify(q.checks));
  assert.equal(q.tests.ok, true);
  assert.equal(q.tests.fail, 0);
  assert.equal(q.tests.pass, 8);
  assert.equal(checkBuild(dir, ENV()).pass, false);
});

test('3. the build solution passes checkBuild with node --test green, and not checkQuick', () => {
  const dir = fresh('build-ref');
  assert.deepEqual(applyBuild(dir), ['src/store.js', 'src/cli.js', 'test/tags.test.js']);
  const b = checkBuild(dir, ENV());
  assert.equal(b.pass, true, JSON.stringify(b.checks));
  assert.equal(b.tests.ok, true);
  assert.equal(b.tests.pass, 10);
  assert.equal(checkQuick(dir, ENV()).pass, false);
});

test('3. a VERIFICATION.md decides checkBuild only when its status is passed', () => {
  const dir = fresh('build-verification');
  applyBuild(dir);
  const file = path.join(dir, '.aoforge', 'objectives', '01-tags', '01-VERIFICATION.md');
  fs.writeFileSync(file, '---\nobjective: 01-tags\nstatus: gaps_found\nscore: 2/3\n---\n\n# Verification\n');
  const gaps = checkBuild(dir, ENV());
  assert.equal(gaps.pass, false);
  assert.equal(gaps.verification_status, 'gaps_found');
  assert.equal(gaps.verification_file, '.aoforge/objectives/01-tags/01-VERIFICATION.md');
  assert.deepEqual(gaps.checks.filter((c) => !c.pass).map((c) => c.name), ['VERIFICATION.md, when present, has status: passed']);
  fs.writeFileSync(file, '---\nobjective: 01-tags\nstatus: "passed"\nscore: 3/3\n---\n\n# Verification\n');
  const passed = checkBuild(dir, ENV());
  assert.equal(passed.pass, true);
  assert.equal(passed.verification_status, 'passed');
  fs.writeFileSync(file, '# Verification\n\nNo frontmatter.\n');
  assert.equal(checkBuild(dir, ENV()).pass, false, 'a VERIFICATION.md with no status is not passed');
});

test('3. a solution that prints the project notes instead of the seeded ones fails checkQuick', () => {
  const dir = fresh('quick-copied');
  applyQuick(dir);
  // Read notes.json from the project directory rather than the store: the seeded file is ignored.
  const cli = read(dir, 'src/cli.js').replace("const notes = loadNotes();", "const notes = require('../notes.json');");
  fs.writeFileSync(path.join(dir, 'src', 'cli.js'), cli);
  const q = checkQuick(dir, ENV());
  assert.equal(q.pass, false);
  const failed = q.checks.filter((c) => !c.pass).map((c) => c.name);
  assert.ok(failed.includes('list --json prints the notes as a JSON array of {id, text}'), JSON.stringify(failed));
  assert.ok(q.checks.find((c) => c.name === 'list --json exits 0').pass, 'it printed, but the wrong notes');
});

test('the proof run writes nothing under the repository', () => {
  assert.ok(!ROOT.startsWith(REPO_ROOT + path.sep), `${ROOT} is inside the repository`);
  assert.ok(!HOME.startsWith(REPO_ROOT + path.sep));
});
