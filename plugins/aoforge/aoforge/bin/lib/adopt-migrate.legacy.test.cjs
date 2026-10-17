'use strict';

// Test list (objective 80, TRD 80-02): adopt's deterministic front door learns the pre-rename layout. `preflight`
// routes a legacy repository to `migrate` (or refuses with one message naming the fix), `begin` creates
// `aoforge/adopt`, writes the marker and moves the planning trees with `git mv`, and a half-finished migration
// resumes. The CLI legacy-layout guard lets `adopt` through. Fixtures are the hand-built fleet-shaped repositories of
// __fixtures__/legacy-adopt-fixtures.cjs (80-01) and __fixtures__/adopt-fixtures.cjs; each test runs in a fresh temp
// repository with a fake HOME and spawns this checkout's aof-tools (`--cwd <repo> adopt <sub>`) unless it says
// "in-process".
//
// Spawned CLI:
//  1. A clean 2.x fleet repo preflights to exit 0, route `migrate`, `adopt.mode` `migrate`, `migration.moves` for
//     root, api and web; `next` names `adopt begin`; no snapshot difference and no `.aoforge/`.
//  2. Refusals, each exit 3 with nothing moved (snapshot identical, legacy trees in place), for preflight and begin:
//     dirty (names the file), untracked (names notes.txt), merge, rebase, detached, both directories, a nested pair
//     (names api/), a malformed pre-rename CLAUDE.md block (names CLAUDE.md).
//  3. `begin` on the clean repo: exit 0, `created_branch`, branch aoforge/adopt, HEAD unchanged, `moved` lists three
//     `git mv` moves, status holds only renames, the marker records mode, plan.moves and report_path.
//  4. preflight after begin: route `resume`, mode `migrate`, steps { moved: true, scaffolded: false, reported: false }.
//  5. An interrupted begin (root tree moved back, marker kept): resume with moved false; begin again moves the root
//     tree; preflight then shows moved true.
//  6. After begin, an edit to src/index.js: preflight refuses dirty-tree naming only that file.
//  7. After begin, switching away: adopt-in-progress-elsewhere.
//  8. A stale aoforge/adopt branch with no marker on a legacy repo: adopt-branch-exists.
//  9. A nested-only repo (no root tree): migrate; the report goes in the first root; no root `.aoforge/` appears.
// 10. A residue-only repo (root `.aoforge/` with the old stamp key and a pre-rename block): migrate, no moves; begin
//     creates the branch and marker and moves nothing.
// 11. Fresh, empty and AOForge repositories route exactly as before (adopt, new-project, upgrade).
//
// Pure `decideRoute(facts)` (in-process):
// 12. Precedence: busy beats legacy; dirty beats a legacy refusal; legacy beats `aoforge` state and greenfield;
//     unborn legacy is no-commits; an existing branch is adopt-branch-exists; a migrate marker with only owned dirty
//     paths resumes, beating the dirty and legacy rules; a fresh-adopt marker keeps its own owned paths;
//     refusalFor puts both-planning-dirs before legacy-block-malformed.
// 13. `facts.finished` decides whether the marker counts and wins over the `roadmapTracked` alias; callers that pass
//     only `roadmapTracked` get the same result. In a repo, an adopt is finished only when its ROADMAP (fresh) or
//     report (migrate) is in HEAD, not merely staged.
//
// Guard and help:
// 14. `legacyLayoutGuard` returns null for `adopt` (every subcommand) in a legacy-only root, with a reason on its
//     EXEMPT_COMMANDS entry; every other guarded command still refuses there.
// 15. `aof-tools adopt --help` names the migrate route.
//
// Failure:
// 16. A failing move during begin (resume with a move that cannot happen): refuse `move-failed`, exit 3, the marker
//     stays so the re-run resumes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY } = require('./legacy-names.cjs');
const fx = require('./__fixtures__/legacy-adopt-fixtures.cjs');
const { makeFixture, makeFakeHome, gitEnv, writeMappedDocs, writeProjectMd } = require('./__fixtures__/adopt-fixtures.cjs');

const adopt = require('./adopt.cjs');
const legacyMigrate = require('./legacy-migrate.cjs');
const { legacyLayoutGuard, EXEMPT_COMMANDS } = require('./legacy-layout-guard.cjs');
const { COMMANDS } = require('./help.cjs');

const { planningDir: NEW_DIR } = NAMES;
const { planningDir: OLD_DIR } = LEGACY;
const { ADOPT_BRANCH, MARKER_NAME } = adopt;

const AOF_TOOLS = path.join(__dirname, '..', 'aof-tools.cjs');

// ─── helpers ──────────────────────────────────────────────────────────────────

function fleet(t, opts) {
  const repo = fx.legacyFleetRepo(opts);
  t.after(() => repo.cleanup());
  return repo;
}

const abs = (repo, rel) => path.join(repo.root, ...rel.split('/'));
const exists = (repo, rel) => fs.existsSync(abs(repo, rel));

/** `aof-tools --cwd <repo> adopt <sub>` with the report parsed from stdout. */
function adoptCli(repo, sub) {
  const r = repo.run(['adopt', sub]);
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* left null: the assertion on r.out shows why */ }
  return { ...r, report };
}

function markerFile(repo) {
  return path.resolve(repo.root, repo.git(['rev-parse', '--git-path', MARKER_NAME]).trim());
}

const readMarker = (repo) => JSON.parse(fs.readFileSync(markerFile(repo), 'utf-8'));
const headSha = (repo) => repo.git(['rev-parse', 'HEAD']).trim();
const currentBranch = (repo) => repo.git(['branch', '--show-current']).trim();
const statusLines = (repo) => repo.git(['status', '--porcelain']).split('\n').filter(Boolean);
const moveDirs = (moves) => moves.map((m) => m.dir).sort();

/** begin on a clean repo; asserts it succeeded. */
function begun(repo) {
  const r = adoptCli(repo, 'begin');
  assert.equal(r.status, 0, r.out);
  assert.ok(r.report, r.out);
  return r;
}

// ─── 1-11: the CLI ────────────────────────────────────────────────────────────

test('1. a clean 2.x fleet repo preflights to migrate and nothing is written', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const before = repo.snapshot();
  const r = adoptCli(repo, 'preflight');
  assert.equal(r.status, 0, r.out);
  assert.ok(r.report, r.out);
  const { report } = r;
  assert.equal(report.route, 'migrate');
  assert.equal(report.reason, null);
  assert.equal(report.adopt.mode, 'migrate');
  assert.deepEqual(moveDirs(report.migration.moves), ['', 'api', 'web']);
  assert.ok(report.migration.stamps.length > 0, 'stamps are listed');
  assert.ok(report.migration.blocks.length > 0, 'CLAUDE.md blocks are listed');
  assert.ok(report.migration.ignores.length > 0, 'ignore changes are listed');
  assert.ok(report.migration.skipped.some((s) => /vendor/.test(s.path)), 'the vendored decoy is reported as skipped');
  assert.match(report.next, /adopt begin/);
  assert.deepEqual(repo.snapshot(), before, 'preflight writes nothing');
  assert.equal(exists(repo, NEW_DIR), false, 'no .aoforge/ appears');
  assert.equal(report.adopt.branch_exists, false);
});

const REFUSALS = [
  { name: 'dirty', opts: { state: 'dirty' }, reason: 'dirty-tree', mentions: [`${OLD_DIR}/STATE.md`] },
  { name: 'untracked', opts: { state: 'untracked' }, reason: 'dirty-tree', mentions: ['notes.txt'] },
  { name: 'merge', opts: { state: 'merge' }, reason: 'operation-in-progress', mentions: ['merge'] },
  { name: 'rebase', opts: { state: 'rebase' }, reason: 'operation-in-progress', mentions: ['rebase'] },
  { name: 'detached', opts: { state: 'detached' }, reason: 'detached-head', mentions: ['detached'] },
  { name: 'both', opts: { state: 'both' }, reason: 'both-planning-dirs', mentions: [OLD_DIR, NEW_DIR], fixMentions: [OLD_DIR] },
  { name: 'nested-both', opts: { state: 'nested-both' }, reason: 'both-planning-dirs', mentions: ['api/'], fixMentions: ['api/'] },
  { name: 'malformed block', opts: { claudeMd: 'malformed' }, reason: 'legacy-block-malformed', mentions: ['CLAUDE.md'], fixMentions: ['CLAUDE.md'] },
];

for (const row of REFUSALS) {
  test(`2. ${row.name}: preflight and begin refuse with exit 3 and change nothing`, (t) => {
    const repo = fleet(t, row.opts);
    const before = repo.snapshot();
    const branchesBefore = repo.git(['branch', '--list']);

    for (const sub of ['preflight', 'begin']) {
      const r = adoptCli(repo, sub);
      assert.equal(r.status, 3, `${sub}: ${r.out}`);
      assert.ok(r.report, r.out);
      assert.equal(r.report.route, 'refuse', sub);
      assert.equal(r.report.reason, row.reason, sub);
      for (const text of row.mentions) assert.ok(r.report.message.includes(text), `${sub}: message names ${text}: ${r.report.message}`);
      for (const text of row.fixMentions || []) assert.ok(r.report.next.includes(text), `${sub}: next names ${text}: ${r.report.next}`);
      assert.equal(typeof r.report.next, 'string', sub);
      assert.ok(r.report.next.length > 0, sub);
      assert.notEqual(r.report.created_branch, true, sub);
    }

    assert.deepEqual(repo.snapshot(), before, 'the tree is byte-identical');
    assert.equal(repo.git(['branch', '--list']), branchesBefore, 'no branch was created');
    assert.equal(fs.existsSync(markerFile(repo)), false, 'no marker was written');
    assert.ok(exists(repo, `${OLD_DIR}/STATE.md`), 'the legacy tree is still in place');
  });
}

test('3. begin on a clean repo creates the branch and marker, then moves every tree with git mv', (t) => {
  const repo = fleet(t, { nested: true });
  const head = headSha(repo);
  const out = begun(repo);
  const { report } = out;

  assert.equal(report.route, 'migrate');
  assert.equal(report.created_branch, true);
  assert.equal(currentBranch(repo), ADOPT_BRANCH);
  assert.equal(headSha(repo), head, 'HEAD is unchanged: begin commits nothing');
  assert.equal(report.git.branch, ADOPT_BRANCH);
  assert.deepEqual(moveDirs(report.moved), ['', 'api', 'web']);
  assert.ok(report.moved.every((m) => m.via === 'git mv'), JSON.stringify(report.moved));

  // Only renames are staged; the one other line is the runtime marker, ignored until the residue is converted.
  const lines = statusLines(repo);
  assert.deepEqual(lines.filter((l) => !l.startsWith('R')), [`?? ${NEW_DIR}/.skill-active`]);
  assert.ok(lines.filter((l) => l.startsWith('R')).length > 5, 'the trees are staged as renames');
  for (const dir of ['', 'api', 'web']) assert.equal(exists(repo, dir ? `${dir}/${OLD_DIR}` : OLD_DIR), false, `${dir || 'root'} legacy tree gone`);
  assert.equal(exists(repo, `${NEW_DIR}/${NEW_DIR}`) || exists(repo, `${NEW_DIR}/${OLD_DIR}`), false, 'git mv did not nest a tree inside a pre-made directory');
  assert.ok(exists(repo, `${NEW_DIR}/STATE.md`));
  assert.ok(exists(repo, `api/${NEW_DIR}/config.json`));
  assert.ok(exists(repo, `web/${NEW_DIR}/objectives/01-web/01-01-TRD.md`));

  const marker = readMarker(repo);
  assert.equal(marker.mode, 'migrate');
  assert.equal(marker.status, 'in_progress');
  assert.equal(marker.version, 1);
  assert.equal(marker.branch, ADOPT_BRANCH);
  assert.equal(marker.base_branch, 'main');
  assert.equal(marker.base_sha, head);
  assert.deepEqual(marker.steps, {});
  assert.deepEqual(moveDirs(marker.plan.moves), ['', 'api', 'web']);
  assert.equal(marker.report_path, `${NEW_DIR}/ADOPT-REPORT.md`);
  assert.equal(typeof marker.started_at, 'string');
  assert.equal(report.adopt.mode, 'migrate');
  assert.deepEqual(report.adopt.marker, marker);
});

test('4. preflight after begin resumes with the move recorded as done', (t) => {
  const repo = fleet(t, { nested: true });
  begun(repo);
  const r = adoptCli(repo, 'preflight');
  assert.equal(r.status, 0, r.out);
  assert.equal(r.report.route, 'resume', r.out);
  assert.equal(r.report.adopt.mode, 'migrate');
  assert.equal(r.report.adopt.branch, ADOPT_BRANCH);
  assert.deepEqual(r.report.adopt.steps, { moved: true, scaffolded: false, reported: false });
  assert.match(r.report.next, /scaffolded/, 'the next step names the first step not done');
  assert.deepEqual(moveDirs(r.report.migration.moves), ['', 'api', 'web']);
});

test('5. an interrupted begin resumes: begin again finishes the move', (t) => {
  const repo = fleet(t, { nested: true });
  begun(repo);
  // The first half of begin is the marker; simulate a stop before the root tree moved.
  repo.git(['mv', NEW_DIR, OLD_DIR]);
  assert.ok(fs.existsSync(markerFile(repo)));

  const pre = adoptCli(repo, 'preflight');
  assert.equal(pre.status, 0, pre.out);
  assert.equal(pre.report.route, 'resume', pre.out);
  assert.equal(pre.report.adopt.steps.moved, false);
  assert.match(pre.report.next, /moved/);

  const again = adoptCli(repo, 'begin');
  assert.equal(again.status, 0, again.out);
  assert.equal(again.report.route, 'resume');
  assert.equal(again.report.created_branch, false);
  const rootMove = again.report.moved.find((m) => m.dir === '');
  assert.ok(rootMove, JSON.stringify(again.report.moved));
  assert.equal(rootMove.via, 'git mv');
  assert.equal(exists(repo, OLD_DIR), false);
  assert.ok(exists(repo, `${NEW_DIR}/STATE.md`));

  const post = adoptCli(repo, 'preflight');
  assert.equal(post.report.route, 'resume');
  assert.equal(post.report.adopt.steps.moved, true);
});

test('6. after begin, a user edit outside the planning trees is a dirty tree naming only that file', (t) => {
  const repo = fleet(t, { nested: true });
  begun(repo);
  fs.appendFileSync(abs(repo, 'src/index.js'), "console.log('edited');\n");
  const r = adoptCli(repo, 'preflight');
  assert.equal(r.status, 3, r.out);
  assert.equal(r.report.reason, 'dirty-tree');
  assert.ok(r.report.message.includes('src/index.js'), r.report.message);
  assert.ok(!r.report.message.includes(NEW_DIR), `the staged renames are not offending: ${r.report.message}`);
  assert.ok(!r.report.message.includes(OLD_DIR), `the staged renames are not offending: ${r.report.message}`);
});

test('7. after begin, being on another branch is adopt-in-progress-elsewhere', (t) => {
  const repo = fleet(t, { nested: true });
  begun(repo);
  repo.git(['switch', 'main']);
  const r = adoptCli(repo, 'preflight');
  assert.equal(r.status, 3, r.out);
  assert.equal(r.report.reason, 'adopt-in-progress-elsewhere');
});

test('8. a stale aoforge/adopt branch with no marker is adopt-branch-exists', (t) => {
  const repo = fleet(t, { nested: true });
  repo.git(['branch', ADOPT_BRANCH]);
  const before = repo.snapshot();
  for (const sub of ['preflight', 'begin']) {
    const r = adoptCli(repo, sub);
    assert.equal(r.status, 3, `${sub}: ${r.out}`);
    assert.equal(r.report.reason, 'adopt-branch-exists', sub);
  }
  assert.deepEqual(repo.snapshot(), before);
});

test('9. a nested-only repo migrates; the report goes in the first root and no root .aoforge/ is created', (t) => {
  const repo = fleet(t, { rootTree: false });
  const pre = adoptCli(repo, 'preflight');
  assert.equal(pre.status, 0, pre.out);
  assert.equal(pre.report.route, 'migrate', pre.out);
  assert.deepEqual(moveDirs(pre.report.migration.moves), ['api', 'web']);

  const out = begun(repo);
  assert.deepEqual(moveDirs(out.report.moved), ['api', 'web']);
  assert.equal(readMarker(repo).report_path, `api/${NEW_DIR}/ADOPT-REPORT.md`);
  assert.equal(exists(repo, NEW_DIR), false, 'no root .aoforge/');
  assert.ok(exists(repo, `api/${NEW_DIR}/STATE.md`));
  const again = adoptCli(repo, 'preflight');
  assert.equal(again.report.route, 'resume');
  assert.deepEqual(again.report.adopt.steps, { moved: true, scaffolded: false, reported: false });
});

test('10. a residue-only repo routes to migrate with no moves; begin moves nothing', (t) => {
  const repo = fleet(t, { state: 'adopted-on-aoforge' });
  const pre = adoptCli(repo, 'preflight');
  assert.equal(pre.status, 0, pre.out);
  assert.equal(pre.report.route, 'migrate', `not upgrade: ${pre.out}`);
  assert.deepEqual(pre.report.migration.moves, []);
  assert.ok(pre.report.migration.stamps.some((s) => s.action), 'the old stamp key is listed');
  assert.ok(pre.report.migration.blocks.length > 0, 'the pre-rename block is listed');

  const head = headSha(repo);
  const out = begun(repo);
  assert.equal(out.report.created_branch, true);
  assert.deepEqual(out.report.moved, []);
  assert.equal(currentBranch(repo), ADOPT_BRANCH);
  assert.equal(headSha(repo), head);
  assert.deepEqual(statusLines(repo), [], 'nothing moved, nothing staged');
  const marker = readMarker(repo);
  assert.equal(marker.mode, 'migrate');
  assert.deepEqual(marker.plan.moves, []);
  assert.equal(marker.report_path, `${NEW_DIR}/ADOPT-REPORT.md`);
  const again = adoptCli(repo, 'preflight');
  assert.equal(again.report.route, 'resume');
  assert.equal(again.report.adopt.steps.moved, true, 'no moves are trivially done');
});

test('11. fresh, empty and AOForge repositories route exactly as before', (t) => {
  const home = makeFakeHome();
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-adopt-routes-'));
  t.after(() => {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(parent, { recursive: true, force: true });
  });
  const expected = { 'go-service': 'adopt', empty: 'new-project', aoforge: 'upgrade' };
  for (const [kind, route] of Object.entries(expected)) {
    const dir = makeFixture(kind, { parent, home });
    const r = spawnSync(process.execPath, [AOF_TOOLS, '--cwd', dir, 'adopt', 'preflight'], {
      cwd: parent, encoding: 'utf-8', timeout: 30000, env: gitEnv(home),
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const report = JSON.parse(r.stdout);
    assert.equal(report.route, route, kind);
    assert.equal(report.migration, undefined, `${kind}: no migration block on a non-migrate route`);
    if (kind === 'go-service') assert.equal(report.adopt.mode, 'adopt');
  }
});

// ─── 12-13: decideRoute (in-process) ──────────────────────────────────────────

function makeFacts(over = {}) {
  const git = {
    is_repo: true, toplevel: '/repo', isTopLevel: true, branch: 'main', head_sha: 'sha1',
    detached: false, unborn: false, busy: null, dirty: [],
    ...(over.git || {}),
  };
  return {
    target: '/repo', isDirectory: true, state: 'brownfield', marker: null, branchExists: false, roadmapTracked: false,
    ...over,
    git,
  };
}

const APPLIES = { applies: true, refusal: null };
const BOTH = { reason: 'both-planning-dirs', message: 'both directories at api/', next: 'remove the legacy directory api/' };
const MALFORMED = { reason: 'legacy-block-malformed', message: 'CLAUDE.md has no END marker', next: 'CLAUDE.md: add the END marker' };
const MIGRATE_MARKER = { status: 'in_progress', mode: 'migrate', branch: ADOPT_BRANCH };
const ADOPT_MARKER = { status: 'in_progress', branch: ADOPT_BRANCH };

const DECIDE_ROWS = [
  { name: 'a legacy plan routes to migrate', facts: makeFacts({ legacy: APPLIES }), route: 'migrate', reason: null },
  { name: 'busy beats legacy', facts: makeFacts({ legacy: APPLIES, git: { busy: 'merge' } }), route: 'refuse', reason: 'operation-in-progress' },
  { name: 'detached beats legacy', facts: makeFacts({ legacy: APPLIES, git: { detached: true } }), route: 'refuse', reason: 'detached-head' },
  { name: 'dirty beats a legacy refusal', facts: makeFacts({ legacy: { applies: true, refusal: BOTH }, git: { dirty: ['x.txt'] } }), route: 'refuse', reason: 'dirty-tree' },
  { name: 'dirty beats legacy migrate', facts: makeFacts({ legacy: APPLIES, git: { dirty: ['x.txt'] } }), route: 'refuse', reason: 'dirty-tree' },
  { name: 'both directories refuse with the refusal text', facts: makeFacts({ legacy: { applies: true, refusal: BOTH } }), route: 'refuse', reason: 'both-planning-dirs', message: BOTH.message, next: BOTH.next },
  { name: 'a malformed block refuses with the refusal text', facts: makeFacts({ legacy: { applies: false, refusal: MALFORMED } }), route: 'refuse', reason: 'legacy-block-malformed', message: MALFORMED.message, next: MALFORMED.next },
  { name: 'a refusal beats aoforge state', facts: makeFacts({ state: 'aoforge', legacy: { applies: false, refusal: BOTH } }), route: 'refuse', reason: 'both-planning-dirs' },
  { name: 'legacy beats aoforge state', facts: makeFacts({ state: 'aoforge', legacy: APPLIES }), route: 'migrate', reason: null },
  { name: 'legacy beats greenfield', facts: makeFacts({ state: 'greenfield', legacy: APPLIES }), route: 'migrate', reason: null },
  { name: 'unborn legacy is no-commits', facts: makeFacts({ legacy: APPLIES, git: { unborn: true } }), route: 'refuse', reason: 'no-commits' },
  { name: 'an existing adopt branch with a legacy plan is adopt-branch-exists', facts: makeFacts({ legacy: APPLIES, branchExists: true }), route: 'refuse', reason: 'adopt-branch-exists' },
  { name: 'a legacy that does not apply changes nothing (aoforge -> upgrade)', facts: makeFacts({ state: 'aoforge', legacy: { applies: false, refusal: null } }), route: 'upgrade', reason: null },
  { name: 'a legacy that does not apply changes nothing (brownfield -> adopt)', facts: makeFacts({ legacy: { applies: false, refusal: null } }), route: 'adopt', reason: null },
  { name: 'no legacy facts at all changes nothing', facts: makeFacts({ state: 'aoforge' }), route: 'upgrade', reason: null },
  {
    name: 'a migrate marker with only owned dirty paths resumes, beating the dirty and legacy rules',
    facts: makeFacts({
      marker: MIGRATE_MARKER, legacy: { applies: true, refusal: BOTH }, git: {
        branch: ADOPT_BRANCH, dirty: [`${OLD_DIR}/STATE.md`, `${NEW_DIR}/STATE.md`, `api/${NEW_DIR}/config.json`, `web/${OLD_DIR}/x.md`, 'CLAUDE.md', '.gitignore', 'api/.gitignore'],
      },
    }),
    route: 'resume', reason: null,
  },
  { name: 'a migrate marker with a source edit is a dirty tree', facts: makeFacts({ marker: MIGRATE_MARKER, git: { branch: ADOPT_BRANCH, dirty: [`${NEW_DIR}/STATE.md`, 'src/index.js'] } }), route: 'refuse', reason: 'dirty-tree' },
  { name: 'a migrate marker on another branch is adopt-in-progress-elsewhere', facts: makeFacts({ marker: MIGRATE_MARKER, git: { branch: 'main' } }), route: 'refuse', reason: 'adopt-in-progress-elsewhere' },
  { name: 'a fresh-adopt marker keeps its own owned paths (.gitignore is not one)', facts: makeFacts({ marker: ADOPT_MARKER, git: { branch: ADOPT_BRANCH, dirty: ['.gitignore'] } }), route: 'refuse', reason: 'dirty-tree' },
  { name: 'a fresh-adopt marker still resumes on owned paths', facts: makeFacts({ marker: ADOPT_MARKER, git: { branch: ADOPT_BRANCH, dirty: [`${NEW_DIR}/codebase/STACK.md`, 'CLAUDE.md'] } }), route: 'resume', reason: null },
];

for (const row of DECIDE_ROWS) {
  test(`12. decideRoute: ${row.name}`, () => {
    const result = adopt.decideRoute(row.facts);
    assert.equal(result.route, row.route, JSON.stringify(result));
    assert.equal(result.reason, row.reason, JSON.stringify(result));
    if (row.message !== undefined) assert.equal(result.message, row.message);
    if (row.next !== undefined) assert.equal(result.next, row.next);
    if (row.route === 'migrate') assert.match(result.next, /adopt begin/);
  });
}

test('12. refusalFor puts both-planning-dirs before legacy-block-malformed', (t) => {
  const repo = fleet(t, { state: 'both', claudeMd: 'malformed' });
  const plan = legacyMigrate.planMigration(repo.root, { env: repo.env });
  assert.ok(plan.conflicts.length > 0 && plan.malformed.length > 0, 'the fixture holds both problems');
  assert.equal(legacyMigrate.refusalFor(plan).reason, 'both-planning-dirs');
  const pf = adopt.preflight(repo.root, { env: repo.env, userHome: repo.home });
  assert.equal(pf.route, 'refuse');
  assert.equal(pf.reason, 'both-planning-dirs');
});

test('13. facts.finished decides whether the marker counts; the roadmapTracked alias gives the old result', () => {
  const active = { marker: ADOPT_MARKER, git: { branch: ADOPT_BRANCH } };
  assert.equal(adopt.decideRoute(makeFacts({ ...active, state: 'aoforge', finished: false })).route, 'resume');
  assert.equal(adopt.decideRoute(makeFacts({ ...active, state: 'aoforge', finished: true })).route, 'upgrade', 'finished: the marker is ignored');
  // Back-compat: callers that pass only roadmapTracked.
  assert.equal(adopt.decideRoute(makeFacts({ ...active, state: 'aoforge', roadmapTracked: true })).route, 'upgrade');
  assert.equal(adopt.decideRoute(makeFacts({ ...active, state: 'aoforge', roadmapTracked: false })).route, 'resume');
  // finished wins over the alias.
  assert.equal(adopt.decideRoute(makeFacts({ ...active, state: 'aoforge', finished: false, roadmapTracked: true })).route, 'resume');
  assert.equal(adopt.decideRoute(makeFacts({ ...active, state: 'aoforge', finished: true, roadmapTracked: false })).route, 'upgrade');
});

test('13. a fresh adopt is finished when its ROADMAP is in HEAD, not when it is merely staged', (t) => {
  const home = makeFakeHome();
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-adopt-fresh-'));
  t.after(() => {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(parent, { recursive: true, force: true });
  });
  const dir = makeFixture('go-service', { parent, home });
  const env = gitEnv(home);
  const cli = (sub) => {
    const r = spawnSync(process.execPath, [AOF_TOOLS, '--cwd', dir, 'adopt', sub], { cwd: parent, encoding: 'utf-8', timeout: 30000, env });
    return { status: r.status, out: r.stdout + r.stderr, report: JSON.parse(r.stdout) };
  };
  const git = (...args) => spawnSync('git', ['-C', dir, ...args], { env, encoding: 'utf-8' });

  assert.equal(cli('begin').report.created_branch, true);
  writeMappedDocs(dir);
  writeProjectMd(dir, { name: 'Orders service', kind: 'api' });
  fs.writeFileSync(path.join(dir, NEW_DIR, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
  git('add', '-A');
  assert.equal(cli('preflight').report.route, 'resume', 'ROADMAP staged only: the adopt is still in progress');
  git('commit', '-q', '-m', 'adopt');
  assert.equal(cli('preflight').report.route, 'upgrade', 'ROADMAP in HEAD: the adopt is finished');
});

test('13. a migrate adopt is finished when its report is in HEAD, not when it is merely staged', (t) => {
  const repo = fleet(t, { nested: true });
  begun(repo);
  legacyMigrate.convertResidue(repo.root, { env: repo.env });
  fs.writeFileSync(abs(repo, `${NEW_DIR}/ADOPT-REPORT.md`), '# Adopt Report\n');
  repo.git(['add', '-A']);

  const staged = adoptCli(repo, 'preflight');
  assert.equal(staged.status, 0, staged.out);
  assert.equal(staged.report.route, 'resume', 'report staged only: still in progress');
  assert.equal(staged.report.adopt.steps.reported, true);
  assert.equal(staged.report.adopt.steps.moved, true);

  repo.git(['commit', '-q', '-m', 'adopt: migrate']);
  const done = adoptCli(repo, 'preflight');
  assert.equal(done.status, 0, done.out);
  assert.equal(done.report.route, 'upgrade', `report in HEAD: finished: ${done.out}`);
});

// ─── 14-15: guard and help ────────────────────────────────────────────────────

test('14. the CLI guard lets every adopt subcommand through a legacy-only root, with a reason', (t) => {
  const repo = fleet(t, {});
  const guard = (args) => legacyLayoutGuard({ command: args[0], args, cwd: repo.root, commands: COMMANDS, home: repo.home });

  for (const sub of ['preflight', 'begin', 'scaffold', 'report', undefined]) {
    assert.equal(guard(sub === undefined ? ['adopt'] : ['adopt', sub]), null, `adopt ${sub || ''}`);
  }
  assert.equal(typeof EXEMPT_COMMANDS.adopt, 'string');
  assert.ok(EXEMPT_COMMANDS.adopt.trim().length > 0, 'the exemption carries its reason');
  assert.ok(Object.isFrozen(EXEMPT_COMMANDS));

  for (const args of [['state', 'load'], ['init', 'plan-objective', '1'], ['roadmap', 'analyze'], ['upgrade', '--apply'], ['commit', 'x', '--files', 'a']]) {
    assert.notEqual(guard(args), null, `${args.join(' ')} is still refused`);
  }
});

test('15. adopt --help names the migrate route', (t) => {
  const repo = fleet(t, {});
  const r = repo.run(['adopt', '--help']);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /^Usage: aof-tools adopt /m);
  assert.match(r.stdout, /migrate/);
  assert.equal(COMMANDS.adopt.usage.includes('migrate'), false, 'the usage line is unchanged: no new subcommand or flag');
});

// ─── 16: a failing move ───────────────────────────────────────────────────────

test('16. a move that fails during begin refuses move-failed and leaves the marker to resume', (t) => {
  const repo = fleet(t, { nested: true });
  begun(repo);
  const marker = readMarker(repo);
  // A recorded move whose source and target both do not exist cannot be carried out.
  marker.plan.moves.push({ dir: 'zzz', from: `zzz/${OLD_DIR}`, to: `zzz/${NEW_DIR}`, tracked: true, files: 1 });
  fs.writeFileSync(markerFile(repo), `${JSON.stringify(marker, null, 2)}\n`);
  const before = repo.snapshot();

  const r = adoptCli(repo, 'begin');
  assert.equal(r.status, 3, r.out);
  assert.equal(r.report.route, 'refuse');
  assert.equal(r.report.reason, 'move-failed');
  assert.match(r.report.message, /zzz/);
  assert.match(r.report.next, /adopt/);
  assert.equal(r.report.created_branch, false);
  assert.deepEqual(r.report.adopt.marker.plan.moves.map((m) => m.dir).sort(), ['', 'api', 'web', 'zzz']);
  assert.equal(fs.existsSync(markerFile(repo)), true, 'the marker stays');
  assert.equal(currentBranch(repo), ADOPT_BRANCH, 'the branch stays');
  assert.deepEqual(repo.snapshot(), before, 'nothing was undone or deleted');
});
