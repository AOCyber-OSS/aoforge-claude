'use strict';

// Test list (objective 80, TRD 80-03): the migrate route's deterministic second half. After `begin` moved the
// planning trees, `adopt scaffold` converts the residue (stamp key, CLAUDE.md block markers, ignore lines) after a
// backup outside the repo and writes nothing else; `adopt report` writes ADOPT-REPORT.md with a `## Migration`
// table, health findings per planning root and the pending upgrade migrations, and returns the compact file list
// and message for adopt's one commit. Fixtures are the hand-built fleet-shaped repositories of
// __fixtures__/legacy-adopt-fixtures.cjs (80-01); every test runs in a fresh temp repository with a fake HOME. The
// pipeline runs in-process (`adopt.begin/scaffold/report` with the fixture's hermetic env) and the one recorded
// change is made by spawning this checkout's `aof-tools commit` with the report's own message and file list.
//
//  1. A 2.x fleet repo (root, api, web trees; decoys): the full path, then `aof-tools commit "<message>" --files
//     <commit_files>` exits 0 with `committed: true`; exactly one new commit on aoforge/adopt above the base sha;
//     a clean tree; `git diff --find-renames=100%` lists every moved file as R100 except the two config.json files
//     (a D/A pair, one changed line) and the new ADOPT-REPORT.md (A); `.gitignore`, `api/.gitignore` and CLAUDE.md
//     are M and nothing else changed; `git log --follow -- .aoforge/ROADMAP.md` reaches the fixture's first commit.
//  2. commit_files is compact: exactly the six tree directories plus `.gitignore`, `api/.gitignore` and CLAUDE.md
//     (nine entries), nothing under a moved tree.
//  3. The config.json change is exactly one line (the key); every other moved file keeps its bytes.
//  4. ADOPT-REPORT.md: first heading `# Adopt report — <name>`, `**Mode:** migrate`, a `## Migration` section with a
//     row per moved tree, stamp key, block and ignore line and the vendored decoy under "Not moved", `## Needs
//     review` with the pending-upgrade row naming `aof-tools upgrade --check`, and next steps naming
//     `git switch <base> && git merge aoforge/adopt` and "Nothing was pushed".
//  5. After the commit `validate health` at the root and at `api/` reports none of W066/W067/W069, and `adopt
//     preflight` routes to `upgrade` (the report is in HEAD) and writes nothing.
//  6. Idempotent: scaffold twice converts nothing the second time, keeps the migration record and makes no second
//     backup; report twice writes identical ADOPT-REPORT.md bytes and returns an identical commit_files.
//  7. Resume after report, before commit: preflight `resume` with every step true; report again gives the same
//     result; the commit then succeeds as in 1.
//  8. Untracked tree: commit_files holds no planning directory entry and lists `.gitignore` (the whole-directory
//     line rewritten); the commit succeeds; the moved tree stays untracked and ignored.
//  9. `commit_docs: false` with a tracked tree: `commit_blocked.reason === 'commit-docs-false'`, the message names
//     the config file and the fix, and a priority row says the same.
// 10. Residue-only repo (`adopted-on-aoforge`): commit_files is the report, config.json, CLAUDE.md and the
//     rewritten .gitignore; the commit succeeds; W067 and W069 are gone.
// 11. A carried-over ADOPT-REPORT.md: the new report starts with the migrate report and ends with `## Previous
//     adopt report` followed by the old bytes verbatim; a re-run is identical.
// 12. An untracked `.aoforge/.aoforge-notices.json` at report time is added to `.git/info/exclude`, listed in the
//     migration record and left out of the commit.
// 13. scaffold before the move finished throws "run adopt begin first"; report before scaffold throws "run adopt
//     scaffold first" (CLI exit 1 for both).
// 14. CLI prose: `adopt scaffold --raw` prints `migrated: <n> converted`, `adopt report --raw` prints `report: <n>
//     to review` (plus `; commit blocked: <reason>`); the default JSON carries `mode: 'migrate'`.
//
// Behaviour the TRD's must-haves add:
// 15. scaffold converts the residue and writes nothing else: the changed files are the config.json files, CLAUDE.md
//     and the .gitignore files; no PROJECT/STATE/ROADMAP/STACK is created; the converted CLAUDE.md equals the
//     fixture's expected text; a backup of each planning root exists outside the repo.
// 16. A legacy code still present after scaffold (a pre-rename CLAUDE.md block put back) is reported in
//     `legacy_codes` and sets `commit_blocked` (`legacy-layout-remains`).
// 17. An invalid config.json is left alone: a priority row names the file and says to rename the key by hand, and
//     the commit is not blocked by it.
// 18. A nested-only repo: the report goes in the first root and no root `.aoforge/` appears.
//
// Row 15 of the TRD (the fresh-mode adopt tests unchanged) is a run of adopt-scaffold, adopt-report and adopt-e2e.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY } = require('./legacy-names.cjs');
const fx = require('./__fixtures__/legacy-adopt-fixtures.cjs');
const adopt = require('./adopt.cjs');

const { planningDir: NEW_DIR, blockTag: NEW_TAG } = NAMES;
const { planningDir: OLD_DIR, blockTag: OLD_TAG, configKey: OLD_KEY } = LEGACY;
const { ADOPT_BRANCH } = adopt;

const AOF_TOOLS = path.join(__dirname, '..', 'aof-tools.cjs');
const VERSION = '3.1.0';
const NOW = new Date('2026-10-17T12:00:00.000Z');

// ─── helpers ──────────────────────────────────────────────────────────────────

function fleet(t, options) {
  const repo = fx.legacyFleetRepo(options);
  t.after(() => repo.cleanup());
  return repo;
}

const opts = (repo) => ({ env: repo.env, userHome: repo.home, pluginVersion: VERSION, now: NOW });
const abs = (repo, rel) => path.join(repo.root, ...rel.split('/'));
const exists = (repo, rel) => fs.existsSync(abs(repo, rel));
const readFile = (repo, rel) => fs.readFileSync(abs(repo, rel), 'utf-8');
const headSha = (repo) => repo.git(['rev-parse', 'HEAD']).trim();
const currentBranch = (repo) => repo.git(['branch', '--show-current']).trim();
const statusLines = (repo) => repo.git(['status', '--porcelain']).split('\n').filter(Boolean);
const sorted = (list) => [...list].sort();

/** begin -> scaffold (-> report) in-process; asserts begin ran. */
function pipeline(repo, upTo = 'report') {
  const o = opts(repo);
  const begin = adopt.begin(repo.root, o);
  assert.equal(begin.created_branch, true, JSON.stringify(begin));
  const scaffold = adopt.scaffold(repo.root, o);
  if (upTo === 'scaffold') return { begin, scaffold };
  const report = adopt.report(repo.root, o);
  return { begin, scaffold, report };
}

/** `aof-tools commit "<message>" --files <files>` with the report's own message and list. */
function commitChange(repo, report) {
  const r = repo.run(['commit', report.commit_message, '--files', ...report.commit_files]);
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* left null: the assertion on r.out shows why */ }
  return { ...r, json };
}

function committed(repo, report) {
  const c = commitChange(repo, report);
  assert.equal(c.status, 0, c.out);
  assert.ok(c.json && c.json.committed === true, c.out);
  return c;
}

/** `git diff --name-status` between two commits as [{ status, paths }]. */
function nameStatus(repo, base) {
  const out = repo.git(['diff', '--find-renames=100%', '--name-status', base, 'HEAD']);
  return out.split('\n').filter(Boolean).map((line) => {
    const [status, ...paths] = line.split('\t');
    return { status, paths };
  });
}

const toNew = (rel) => rel.split('/').map((seg) => (seg === OLD_DIR ? NEW_DIR : seg)).join('/');

/** Files git tracked in the legacy trees at `base` (the fixture's decoys sit in vendor/ and docs/ and stay put). */
function legacyTracked(repo, base) {
  return repo.git(['ls-tree', '-r', '--name-only', base]).split('\n').filter(Boolean)
    .filter((f) => f.split('/').includes(OLD_DIR) && !f.startsWith('vendor/') && !f.startsWith('docs/'));
}

/** The section of `text` starting at the `heading` line, up to the next `## ` heading. */
function section(text, heading) {
  const start = text.indexOf(`\n${heading}\n`);
  assert.notEqual(start, -1, `${heading} is in the report`);
  const rest = text.slice(start + 1);
  const next = rest.indexOf('\n## ', heading.length);
  return next === -1 ? rest : rest.slice(0, next);
}

function healthAt(repo, dir) {
  const cwd = dir ? path.join(repo.root, dir) : repo.root;
  const r = spawnSync(process.execPath, [AOF_TOOLS, '--cwd', cwd, 'validate', 'health', '--raw'], {
    cwd: repo.root, env: repo.env, encoding: 'utf-8', timeout: 60000,
  });
  const report = JSON.parse(r.stdout);
  return [...(report.errors || []), ...(report.warnings || [])].map((x) => x.code);
}

function backupDirs(repo) {
  const root = path.join(repo.home, '.claude', 'aoforge', 'backups');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
    .flatMap((e) => fs.readdirSync(path.join(root, e.name)).map((ts) => `${e.name}/${ts}`)).sort();
}

const changedKeys = (before, after) => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => !k.startsWith(':git-') && before[k] !== after[k]).sort();
};

// ─── 1-5: the full path and the one recorded change ───────────────────────────

test('1. the full path then aof-tools commit records exactly one clean change that keeps history', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const base = headSha(repo);
  const tracked = legacyTracked(repo, base);
  const { report } = pipeline(repo);

  const c = committed(repo, report);
  assert.match(c.json.hash, /^[0-9a-f]{7,}$/);
  assert.equal(currentBranch(repo), ADOPT_BRANCH);
  assert.equal(repo.git(['rev-list', '--count', `${base}..HEAD`]).trim(), '1', 'exactly one new commit');
  assert.equal(repo.git(['rev-parse', 'HEAD^']).trim(), base);
  assert.deepEqual(statusLines(repo), [], 'the tree is clean');
  assert.equal(repo.git(['log', '-1', '--format=%s']).trim(), report.commit_message);

  const diff = nameStatus(repo, base);
  const by = (s) => diff.filter((d) => d.status === s);
  const configs = tracked.filter((f) => f.endsWith('/config.json'));
  const renames = by('R100').map((d) => `${d.paths[0]} -> ${d.paths[1]}`).sort();
  assert.deepEqual(renames, tracked.filter((f) => !configs.includes(f)).map((f) => `${f} -> ${toNew(f)}`).sort(),
    'every moved file but the configs is a 100% rename');
  assert.deepEqual(by('D').map((d) => d.paths[0]).sort(), sorted(configs), 'the configs are delete/add pairs at 100%');
  assert.deepEqual(by('A').map((d) => d.paths[0]).sort(), sorted([...configs.map(toNew), `${NEW_DIR}/ADOPT-REPORT.md`]));
  assert.deepEqual(by('M').map((d) => d.paths[0]).sort(), ['.gitignore', 'CLAUDE.md', 'api/.gitignore']);
  assert.equal(diff.length, renames.length + by('D').length + by('A').length + by('M').length, 'nothing else changed');

  // The configs still pair up as renames of one changed line each at git's default threshold.
  const loose = repo.git(['diff', '-M', '--name-status', base, 'HEAD']).split('\n').filter((l) => /^R0\d\d\t/.test(l));
  assert.equal(loose.length, 2, `both configs are renames at the default threshold: ${loose.join(' | ')}`);

  const follow = repo.git(['log', '--follow', '--format=%s', '--', `${NEW_DIR}/ROADMAP.md`]).split('\n').filter(Boolean);
  assert.ok(follow.includes('init'), `history crosses the move: ${follow.join(', ')}`);
  assert.equal(follow[0], report.commit_message);
});

test('2. commit_files is compact: the tree directories and the three converted files, nothing under a moved tree', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const { report } = pipeline(repo);
  const expected = [
    NEW_DIR, OLD_DIR, `api/${NEW_DIR}`, `api/${OLD_DIR}`, `web/${NEW_DIR}`, `web/${OLD_DIR}`,
    '.gitignore', 'api/.gitignore', 'CLAUDE.md',
  ];
  assert.deepEqual(report.commit_files, sorted(expected));
  assert.ok(report.commit_files.length < 20);
  const trees = expected.filter((e) => e.endsWith(NEW_DIR) || e.endsWith(OLD_DIR));
  for (const f of report.commit_files) {
    assert.ok(!trees.some((tree) => f.startsWith(`${tree}/`)), `${f} is under a moved tree`);
  }
  assert.equal(report.commit_message, `chore(aoforge): adopt — move the pre-rename planning layout (AOForge v${VERSION})`);
  assert.equal(report.commit_blocked, null);
  assert.equal(report.mode, 'migrate');
});

test('3. the config.json change is one line; every other moved file keeps its bytes', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const before = repo.snapshot();
  const base = headSha(repo);
  const tracked = legacyTracked(repo, base);
  const { report } = pipeline(repo);
  committed(repo, report);

  assert.ok(tracked.length > 10);
  for (const old of tracked) {
    const now = readFile(repo, toNew(old));
    if (old.endsWith('/config.json')) {
      const was = before[old].split('\n');
      const is = now.split('\n');
      assert.equal(is.length, was.length, `${old}: same number of lines`);
      const differing = was.map((line, i) => [line, is[i]]).filter(([a, b]) => a !== b);
      assert.equal(differing.length, 1, `${old}: exactly one changed line`);
      assert.ok(differing[0][0].includes(`"${OLD_KEY}"`) && differing[0][1].includes(`"${NAMES.configKey}"`), JSON.stringify(differing));
    } else {
      assert.equal(now, before[old], `${old}: bytes are unchanged by the move`);
    }
  }
  assert.equal(readFile(repo, 'CLAUDE.md'), fx.convertedClaudeMdText('pre-v1'));
});

test('4. ADOPT-REPORT.md lists the migration, what needs review and the next steps', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const { report, begin } = pipeline(repo);
  assert.equal(report.report_path, `${NEW_DIR}/ADOPT-REPORT.md`);
  const text = readFile(repo, report.report_path);
  assert.match(text, /^# Adopt report — Fleet Demo\n/);
  assert.match(text, /\*\*Mode:\*\* migrate/);
  assert.ok(text.includes(`\`${ADOPT_BRANCH}\` (from \`main\` @ \`${begin.git.head_sha.slice(0, 7)}\`)`), 'the branch and base are named');
  assert.ok(text.includes('**Pushed:** no'));

  const migration = section(text, '## Migration');
  for (const dir of ['', 'api/', 'web/']) {
    assert.ok(migration.includes(`| Planning tree | ${dir}${OLD_DIR} | ${dir}${NEW_DIR} | git mv`), `a row for the ${dir || 'root'} tree`);
  }
  assert.match(migration, /\| Stamp key \(\.aoforge\/config\.json\) \|/);
  assert.match(migration, /\| Stamp key \(api\/\.aoforge\/config\.json\) \|/);
  assert.match(migration, /\| CLAUDE\.md block \|/);
  assert.match(migration, /\| Ignore line \| \.gitignore:\d+ /);
  assert.match(migration, /\| Ignore line \| api\/\.gitignore:\d+ /);
  assert.match(migration, /\*\*Not moved:\*\*/);
  assert.ok(migration.includes(`vendor/example.com/lib/${OLD_DIR}`), 'the vendored decoy is named as not moved');
  assert.ok(migration.includes(`docs/${OLD_DIR}`), 'the unrelated directory is named as not moved');

  const review = section(text, '## Needs review');
  assert.ok(review.includes('aof-tools upgrade --check'), 'the pending upgrade migrations point at upgrade --check');
  assert.match(review, /automatic upgrade migration/);

  assert.ok(text.includes('## What adopt did'));
  const next = section(text, '## Next steps');
  assert.ok(next.includes(`git switch main && git merge ${ADOPT_BRANCH}`), next);
  assert.ok(next.includes('Nothing was pushed.'));
  assert.ok(!/## Previous adopt report/.test(text), 'no earlier report, no previous-report section');
});

test('5. after the commit health has no legacy code at any root, and preflight no longer resumes', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const { report } = pipeline(repo);
  committed(repo, report);

  const legacyCodes = ['W066', 'W067', 'W069'];
  for (const dir of ['', 'api']) {
    const codes = healthAt(repo, dir);
    for (const code of legacyCodes) assert.ok(!codes.includes(code), `${dir || 'root'}: ${code} is gone (${codes.join(',')})`);
  }
  const before = repo.snapshot();
  const pf = repo.run(['adopt', 'preflight']);
  assert.equal(pf.status, 0, pf.out);
  assert.equal(JSON.parse(pf.stdout).route, 'upgrade', pf.out);
  assert.deepEqual(repo.snapshot(), before, 'preflight writes nothing');
});

// ─── 6-7: idempotence and resume ─────────────────────────────────────────────

test('6. scaffold is idempotent: the second run converts nothing and keeps the record', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const o = opts(repo);
  adopt.begin(repo.root, o);
  const first = adopt.scaffold(repo.root, o);
  assert.ok(first.converted > 0, 'the first scaffold converts something');
  const record = JSON.stringify(first.marker.migration);
  const backups = backupDirs(repo);
  assert.ok(backups.length >= 1, 'a backup was taken outside the repo');
  const markerBefore = JSON.stringify(adopt.readMarker(repo.root, repo.env).marker);

  const second = adopt.scaffold(repo.root, o);
  assert.equal(second.converted, 0, 'the second scaffold converts nothing');
  assert.equal(JSON.stringify(second.marker.migration), record, 'the migration record is unchanged');
  assert.deepEqual(backupDirs(repo), backups, 'no second backup');
  assert.equal(JSON.stringify(adopt.readMarker(repo.root, repo.env).marker), markerBefore, 'the marker is unchanged');
});

test('6. report is idempotent: the same bytes and the same file list', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const o = opts(repo);
  adopt.begin(repo.root, o);
  adopt.scaffold(repo.root, o);
  const r1 = adopt.report(repo.root, o);
  const bytes1 = readFile(repo, r1.report_path);
  const r2 = adopt.report(repo.root, o);
  assert.equal(readFile(repo, r2.report_path), bytes1, 'identical ADOPT-REPORT.md bytes');
  assert.deepEqual(r2.commit_files, r1.commit_files);
  assert.deepEqual(r2.needs_review, r1.needs_review);
});

test('7. after report and before commit the adopt resumes, reports the same and commits as in 1', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const { report } = pipeline(repo);
  const pf = repo.run(['adopt', 'preflight']);
  assert.equal(pf.status, 0, pf.out);
  const parsed = JSON.parse(pf.stdout);
  assert.equal(parsed.route, 'resume', pf.out);
  assert.deepEqual(parsed.adopt.steps, { moved: true, scaffolded: true, reported: true });
  assert.match(parsed.next, /ready to commit/);

  const again = adopt.report(repo.root, opts(repo));
  assert.deepEqual(again.commit_files, report.commit_files);
  assert.equal(again.commit_message, report.commit_message);
  committed(repo, again);
  assert.deepEqual(statusLines(repo), []);
});

// ─── 8-12: states ────────────────────────────────────────────────────────────

test('8. an untracked tree lists no directory entry; the whole-directory ignore line is what gets committed', (t) => {
  const repo = fleet(t, { untrackedTree: true });
  const { report } = pipeline(repo);
  assert.deepEqual(report.commit_files, ['.gitignore', 'CLAUDE.md']);
  assert.equal(report.commit_blocked, null);

  committed(repo, report);
  assert.match(readFile(repo, '.gitignore'), new RegExp(`^${NEW_DIR}/$`, 'm'), 'the whole-directory line now names the new directory');
  assert.doesNotMatch(readFile(repo, '.gitignore'), new RegExp(`^${OLD_DIR}/$`, 'm'));
  assert.equal(repo.git(['ls-files', NEW_DIR]).trim(), '', 'the moved tree stays untracked');
  assert.equal(repo.gitTry(['check-ignore', '-q', `${NEW_DIR}/STATE.md`]).status, 0, 'and ignored');
  assert.deepEqual(statusLines(repo), []);
  assert.ok(exists(repo, `${NEW_DIR}/ADOPT-REPORT.md`), 'the report is on disk');
});

test('9. commit_docs false with a tracked tree blocks the commit and says how to fix it', (t) => {
  const repo = fleet(t, { commitDocs: false });
  const { report } = pipeline(repo);
  assert.ok(report.commit_blocked, 'blocked');
  assert.equal(report.commit_blocked.reason, 'commit-docs-false');
  assert.ok(report.commit_blocked.message.includes(`${NEW_DIR}/config.json`), report.commit_blocked.message);
  assert.ok(report.commit_blocked.message.includes('planning.commit_docs'), report.commit_blocked.message);
  assert.ok(Array.isArray(report.commit_files));
  const row = report.needs_review.find((r) => r.confidence === 'priority' && /commit_docs/.test(`${r.item} ${r.inferred} ${r.evidence}`));
  assert.ok(row, `a priority row says it: ${JSON.stringify(report.needs_review)}`);
  assert.equal(repo.git(['rev-list', '--count', `main..HEAD`]).trim(), '0', 'the test commits nothing');
});

test('10. a residue-only repo commits the report, the config, CLAUDE.md and the ignore file', (t) => {
  const repo = fleet(t, { state: 'adopted-on-aoforge' });
  const { begin, report } = pipeline(repo);
  assert.deepEqual(begin.moved, []);
  assert.deepEqual(report.commit_files, sorted([`${NEW_DIR}/ADOPT-REPORT.md`, `${NEW_DIR}/config.json`, 'CLAUDE.md', '.gitignore']));
  assert.equal(report.commit_blocked, null);

  committed(repo, report);
  assert.deepEqual(statusLines(repo), []);
  const codes = healthAt(repo, '');
  for (const code of ['W066', 'W067', 'W069']) assert.ok(!codes.includes(code), `${code} is gone (${codes.join(',')})`);
  const text = readFile(repo, report.report_path);
  assert.ok(section(text, '## Migration').includes('| Stamp key'), 'the stamp key row');
});

test('11. an ADOPT-REPORT.md the move carried over is kept below the new one', (t) => {
  const repo = fleet(t, { adoptReport: true });
  const oldBytes = readFile(repo, `${OLD_DIR}/ADOPT-REPORT.md`);
  const { report } = pipeline(repo);
  const text = readFile(repo, report.report_path);
  assert.match(text, /^# Adopt report — Fleet Demo\n/);
  assert.ok(text.endsWith(`\n## Previous adopt report\n\n${oldBytes}`), 'ends with the old bytes verbatim');
  assert.equal(text.indexOf('## Previous adopt report'), text.lastIndexOf('## Previous adopt report'));

  const again = adopt.report(repo.root, opts(repo));
  assert.equal(readFile(repo, again.report_path), text, 'a re-run is identical');
  committed(repo, again);
});

test('12. an untracked transient file under a moved tree is excluded locally and left out of the commit', (t) => {
  const repo = fleet(t, {});
  const o = opts(repo);
  adopt.begin(repo.root, o);
  adopt.scaffold(repo.root, o);
  const notices = `${NEW_DIR}/${NAMES.notices}`;
  fs.writeFileSync(abs(repo, notices), '{"notices":[]}\n');
  const report = adopt.report(repo.root, o);

  const exclude = path.resolve(repo.root, repo.git(['rev-parse', '--git-path', 'info/exclude']).trim());
  assert.ok(fs.readFileSync(exclude, 'utf-8').split('\n').includes(`/${notices}`), 'the file is excluded locally');
  assert.ok(!report.commit_files.some((f) => f.endsWith(NAMES.notices)));
  assert.ok(section(readFile(repo, report.report_path), '## Migration').includes(`/${notices}`), 'and the report records it');

  const second = adopt.report(repo.root, o);
  assert.deepEqual(second.migration, report.migration, 'a re-run keeps the record');
  assert.deepEqual(second.commit_files, report.commit_files);

  committed(repo, second);
  assert.equal(repo.git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').includes(notices), false, 'not in the commit');
  assert.ok(exists(repo, notices), 'the file is still on disk');
  assert.deepEqual(statusLines(repo), []);
});

// ─── 13-14: the CLI ──────────────────────────────────────────────────────────

test('13. scaffold before the move finished and report before scaffold throw, with CLI exit 1', (t) => {
  const repo = fleet(t, { nested: true });
  const o = opts(repo);
  const b = repo.run(['adopt', 'begin']);
  assert.equal(b.status, 0, b.out);

  const noScaffold = repo.run(['adopt', 'report']);
  assert.equal(noScaffold.status, 1, noScaffold.out);
  assert.match(noScaffold.stderr, /run adopt scaffold first/);
  assert.throws(() => adopt.report(repo.root, o), /run adopt scaffold first/);

  repo.git(['mv', NEW_DIR, OLD_DIR]); // the root move is undone: the marker still lists it
  const early = repo.run(['adopt', 'scaffold']);
  assert.equal(early.status, 1, early.out);
  assert.match(early.stderr, /run adopt begin first/);
  assert.throws(() => adopt.scaffold(repo.root, o), /run adopt begin first/);
});

test('14. the CLI prints migrated and report lines, and the JSON carries mode migrate', (t) => {
  const repo = fleet(t, { nested: true });
  assert.equal(repo.run(['adopt', 'begin']).status, 0);

  const scaffold = repo.run(['adopt', 'scaffold', '--raw']);
  assert.equal(scaffold.status, 0, scaffold.out);
  assert.match(scaffold.stdout, /^migrated: [1-9]\d* converted$/);
  const again = repo.run(['adopt', 'scaffold']);
  assert.equal(again.status, 0, again.out);
  const json = JSON.parse(again.stdout);
  assert.equal(json.route, 'scaffold');
  assert.equal(json.mode, 'migrate');
  assert.equal(json.converted, 0);
  assert.equal(repo.run(['adopt', 'scaffold', '--raw']).stdout, 'migrated: 0 converted');

  const rep = repo.run(['adopt', 'report', '--raw']);
  assert.equal(rep.status, 0, rep.out);
  assert.match(rep.stdout, /^report: \d+ to review$/);
  const repJson = JSON.parse(repo.run(['adopt', 'report']).stdout);
  assert.equal(repJson.route, 'report');
  assert.equal(repJson.mode, 'migrate');
  assert.equal(repJson.commit_blocked, null);
  assert.ok(Array.isArray(repJson.commit_files) && repJson.commit_files.length > 0);

  const blocked = fleet(t, { commitDocs: false });
  assert.equal(blocked.run(['adopt', 'begin']).status, 0);
  assert.equal(blocked.run(['adopt', 'scaffold']).status, 0);
  const b = blocked.run(['adopt', 'report', '--raw']);
  assert.equal(b.status, 0, b.out);
  assert.match(b.stdout, /^report: \d+ to review; commit blocked: commit-docs-false$/);
});

// ─── 15-18: must-haves ───────────────────────────────────────────────────────

test('15. scaffold converts the residue and writes nothing else', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const o = opts(repo);
  adopt.begin(repo.root, o);
  const before = repo.snapshot();
  const result = adopt.scaffold(repo.root, o);
  const after = repo.snapshot();

  assert.equal(result.route, 'scaffold');
  assert.equal(result.mode, 'migrate');
  assert.deepEqual(changedKeys(before, after), sorted([
    `${NEW_DIR}/config.json`, `api/${NEW_DIR}/config.json`, 'CLAUDE.md', '.gitignore', 'api/.gitignore',
  ]), 'only the stamp files, CLAUDE.md and the ignore files changed');
  for (const created of ['PROJECT.md', 'STACK.md', 'state.json']) {
    assert.equal(before[`${NEW_DIR}/${created}`] === undefined, after[`${NEW_DIR}/${created}`] === undefined, `${created} was not created`);
  }
  assert.equal(exists(repo, `${NEW_DIR}/STACK.md`), false, 'no STACK.md');
  assert.equal(after['CLAUDE.md'], fx.convertedClaudeMdText('pre-v1'), 'the block is converted in place');
  assert.ok(after['CLAUDE.md'].includes(`<!-- ${NEW_TAG}:START`));
  assert.ok(!after['CLAUDE.md'].includes(OLD_TAG));
  assert.equal(result.marker.steps.scaffolded, true);

  const record = result.marker.migration;
  assert.deepEqual(record.moves.map((m) => m.dir), ['', 'api', 'web']);
  assert.ok(record.moves.every((m) => m.via === 'git mv'));
  assert.equal(record.stamps.length, 2);
  assert.equal(record.blocks.length, 1);
  assert.ok(record.ignores.length >= 2);
  assert.ok(record.skipped.some((s) => s.path.startsWith('vendor/')));
  assert.ok(record.backups.length >= 2, 'a backup per planning root');
  for (const dir of record.backups) {
    assert.ok(dir.startsWith(path.join(repo.home, '.claude', 'aoforge', 'backups')), `${dir} is outside the repo`);
    assert.ok(fs.existsSync(dir));
  }
  assert.ok(record.backups.some((dir) => fs.existsSync(path.join(dir, NEW_DIR, 'STATE.md'))), 'the root tree is in a backup');
  assert.ok(record.backups.some((dir) => fs.existsSync(path.join(dir, 'CLAUDE.md'))), 'CLAUDE.md is in a backup');
});

test('16. a legacy code still present after scaffold is reported and blocks the commit', (t) => {
  const repo = fleet(t, {});
  const o = opts(repo);
  adopt.begin(repo.root, o);
  adopt.scaffold(repo.root, o);
  fs.writeFileSync(abs(repo, 'CLAUDE.md'), readFile(repo, 'CLAUDE.md').replace(new RegExp(`<!-- ${NEW_TAG}:`, 'g'), `<!-- ${OLD_TAG}:`));

  const report = adopt.report(repo.root, o);
  assert.ok(report.legacy_codes.some((c) => c.code === 'W069'), JSON.stringify(report.legacy_codes));
  assert.equal(report.commit_blocked.reason, 'legacy-layout-remains');
  assert.ok(report.commit_blocked.message.includes('W069'), report.commit_blocked.message);
  assert.ok(report.needs_review.some((r) => r.confidence === 'priority' && /W069|legacy/.test(`${r.item} ${r.inferred}`)));
});

test('17. an invalid config.json is left alone, named in a priority row, and does not block the commit', (t) => {
  const repo = fleet(t, { nested: true });
  const o = opts(repo);
  adopt.begin(repo.root, o);
  fs.writeFileSync(abs(repo, `api/${NEW_DIR}/config.json`), '{ "mode": "yolo",\n');
  const scaffold = adopt.scaffold(repo.root, o);
  assert.equal(readFile(repo, `api/${NEW_DIR}/config.json`), '{ "mode": "yolo",\n', 'the file is untouched');
  assert.ok(scaffold.marker.migration.stamps.some((s) => s.file === `api/${NEW_DIR}/config.json` && s.error));

  const report = adopt.report(repo.root, o);
  const row = report.needs_review.find((r) => r.confidence === 'priority' && r.item.includes(`api/${NEW_DIR}/config.json`));
  assert.ok(row, JSON.stringify(report.needs_review));
  assert.match(`${row.item} ${row.inferred} ${row.evidence}`, /rename the key by hand/);
  assert.equal(report.commit_blocked, null);
});

test('18. a nested-only repo reports in the first root and never creates a root planning directory', (t) => {
  const repo = fleet(t, { rootTree: false });
  const { report } = pipeline(repo);
  assert.equal(report.report_path, `api/${NEW_DIR}/ADOPT-REPORT.md`);
  assert.equal(exists(repo, NEW_DIR), false, 'no root .aoforge/');
  assert.ok(exists(repo, report.report_path));
  assert.deepEqual(report.commit_files, sorted([
    `api/${NEW_DIR}`, `api/${OLD_DIR}`, `web/${NEW_DIR}`, `web/${OLD_DIR}`, '.gitignore', 'CLAUDE.md', 'api/.gitignore',
  ]));
  committed(repo, report);
  assert.deepEqual(statusLines(repo), []);
});
