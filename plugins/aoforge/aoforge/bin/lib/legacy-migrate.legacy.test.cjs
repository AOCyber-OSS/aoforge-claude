'use strict';

// Test list (objective 80, TRD 80-01): lib/legacy-migrate.cjs, the one module adopt uses to bring a pre-rename
// project onto the 3.1 layout (find every legacy planning tree, git-mv it, rename the stamp key, rename a CLAUDE.md
// block's markers, carry ignore lines across). It reuses the logic of the deleted migrations 0012/0013/0014 without
// their ids, never commits and never stages beyond `git mv`. Fixtures are hand-built fleet-shaped repositories
// (__fixtures__/legacy-adopt-fixtures.cjs); each test runs in a fresh temp repository with a fake HOME.
//
// Discovery and refusal (planMigration, refusalFor):
//  1. A 2.x repo with a root tree, `api/` (config, STATE) and `web/` (objectives only) trees and a vendored decoy:
//     moves are '', api, web (each tracked, with its file count); the vendor decoy is skipped (reason names vendor);
//     roots are ['', 'api', 'web']; the call writes nothing.
//  2. A legacy-named directory with no planning files, a symlink and a tree in a nested repository are not moved.
//  3. A root `.aoforge/` beside a nested legacy tree: one move (api), roots ['', 'api'].
//  4. Both directories at one root: a conflict with planning-layout's message and fix, no move there; refusalFor
//     returns both-planning-dirs naming the paths and the fix. Same at api/.
//  5. A malformed pre-rename block (no END; two blocks; beside an AOFORGE block): malformed names CLAUDE.md;
//     refusalFor returns legacy-block-malformed with the manual fix.
//  6. Stamps, blocks and ignores are planned with post-move paths; exclude.added lists the info/exclude twins.
//  7. A repository with no legacy anything: applies false, every list empty; refusalFor null.
// Move (moveTrees, movesDone):
//  8. A clean 2.x repo moves with git mv: only renames in `git status`, history followed, the ignored marker file
//     moved with the tree, no legacy directory left.
//  9. An untracked tree moves with an fs rename, byte for byte.
// 10. A second moveTrees is a no-op (via 'done').
// 11. An interrupted move: leftovers in the source move into the target without overwriting anything; the empty
//     source is removed.
// Residue (convertResidue), after the move:
// 12. A stamp under the pre-rename key is renamed in place: one line differs, key order unchanged.
// 13. Both keys merge into one object under the new key, the new values winning.
// 14. A pre-v1 CLAUDE.md block: markers and names converted, every byte outside the block identical.
// 15. A versioned block keeps its attributes as written.
// 16. Ignore files: lines rewritten, a line whose twin exists dropped, comments untouched, nested .gitignore
//     rewritten, info/exclude gains twins and keeps its legacy lines.
// 17. A second convertResidue changes nothing.
// 18. A 3.0-era tree (new stamp, new block): only the move applies.
// 19. An invalid config.json is recorded with its error and left alone; the rest is still converted.
// Pure helpers and rendering:
// 20. renameStampKeyText: only-old, both, neither, a nested same-named key, invalid JSON.
// 21. rewriteIgnoreText / addExcludeCounterparts keep CRLF and a negation.
// 22. ownsMigratePath.
// 23. renderMigrationSection: a table row per change, escaped cells, a Not moved list, the empty record.
// Guard:
// 24. The rename guard lists the module with a reason, and the module builds every legacy token from LEGACY.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { NAMES, LEGACY } = require('./legacy-names.cjs');
const { legacyPlanningIssue } = require('./planning-layout.cjs');
const managedBlock = require('./managed-block.cjs');
const fx = require('./__fixtures__/legacy-adopt-fixtures.cjs');

const { planningDir: NEW_DIR, configKey: NEW_KEY } = NAMES;
const { planningDir: OLD_DIR, configKey: OLD_KEY, product: OLD_PRODUCT } = LEGACY;

/** Required lazily so that, with no module, each test fails on its own. */
const mod = () => require('./legacy-migrate.cjs');

function fleet(t, opts) {
  const repo = fx.legacyFleetRepo(opts);
  t.after(() => repo.cleanup());
  return repo;
}

const abs = (repo, rel) => path.join(repo.root, ...rel.split('/'));
const read = (repo, rel) => fs.readFileSync(abs(repo, rel), 'utf-8');
const exists = (repo, rel) => fs.existsSync(abs(repo, rel));

/** plan -> move -> convert, the order adopt runs them in. */
function migrate(repo) {
  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  const moved = m.moveTrees(repo.root, plan.moves, { env: repo.env });
  const result = m.convertResidue(repo.root, { env: repo.env, roots: plan.roots });
  return { m, plan, moved, result };
}

/** The 0013 rule, restated here so the module is checked against the original and not against itself. */
function expectedRename(config) {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hasNew = Object.prototype.hasOwnProperty.call(config, NEW_KEY);
  const value = !hasNew ? config[OLD_KEY]
    : isObj(config[NEW_KEY]) && isObj(config[OLD_KEY]) ? { ...config[OLD_KEY], ...config[NEW_KEY] } : config[NEW_KEY];
  const out = {};
  for (const key of Object.keys(config)) {
    if (key === OLD_KEY) {
      if (!hasNew) out[NEW_KEY] = value;
      continue;
    }
    out[key] = key === NEW_KEY ? value : config[key];
  }
  return out;
}

// ─── discovery and refusal ────────────────────────────────────────────────────

test('1. planMigration finds the root and nested trees, skips the vendored decoy and writes nothing', (t) => {
  const repo = fleet(t, { nested: true, decoys: true });
  const before = repo.snapshot();
  const plan = mod().planMigration(repo.root, { env: repo.env });
  assert.deepEqual(repo.snapshot(), before, 'planning wrote something');

  assert.deepEqual(plan.moves.map((mv) => mv.dir), ['', 'api', 'web']);
  for (const mv of plan.moves) {
    const prefix = mv.dir ? `${mv.dir}/` : '';
    assert.equal(mv.from, `${prefix}${OLD_DIR}`);
    assert.equal(mv.to, `${prefix}${NEW_DIR}`);
    assert.equal(mv.tracked, true);
    const tracked = repo.git(['ls-files', '-z', '--', mv.from]).split('\0').filter(Boolean).length;
    assert.ok(tracked > 0);
    assert.equal(mv.files, tracked, `${mv.from}: file count`);
  }
  const vendor = plan.skipped.find((s) => s.path === `vendor/example.com/lib/${OLD_DIR}`);
  assert.ok(vendor, JSON.stringify(plan.skipped));
  assert.match(vendor.reason, /vendor/);
  assert.deepEqual(plan.roots, ['', 'api', 'web']);
  assert.equal(plan.applies, true);
  assert.deepEqual(plan.conflicts, []);
  assert.equal(mod().refusalFor(plan), null);
});

test('2. a directory with no planning files, a symlink and a tree in a nested repository are not moved', (t) => {
  const repo = fleet(t, { decoys: true });
  fs.mkdirSync(abs(repo, 'tools'));
  fs.symlinkSync(path.join('..', 'docs'), abs(repo, `tools/${OLD_DIR}`), 'dir');
  fs.mkdirSync(abs(repo, 'third/inner/.git'), { recursive: true });
  fs.mkdirSync(abs(repo, `third/inner/${OLD_DIR}`));
  fs.writeFileSync(abs(repo, `third/inner/${OLD_DIR}/STATE.md`), '# State\n');

  const plan = mod().planMigration(repo.root, { env: repo.env });
  const docs = plan.skipped.find((s) => s.path === `docs/${OLD_DIR}`);
  assert.ok(docs, JSON.stringify(plan.skipped));
  assert.match(docs.reason, /no planning files/);
  const link = plan.skipped.find((s) => s.path === `tools/${OLD_DIR}`);
  assert.ok(link, JSON.stringify(plan.skipped));
  assert.match(link.reason, /symlink/);

  assert.deepEqual(plan.moves.map((mv) => mv.dir), ['']);
  assert.deepEqual(plan.roots, ['']);
  assert.ok(plan.skipped.every((s) => !s.path.startsWith('third')), 'a nested repository was reported');
  assert.ok(plan.moves.every((mv) => !mv.from.startsWith('third')), 'a nested repository was planned');
});

test('3. a root .aoforge/ beside a nested legacy tree is one move and two roots', (t) => {
  const repo = fleet(t, { rootTree: false, nested: true });
  fs.rmSync(abs(repo, `web/${OLD_DIR}`), { recursive: true });
  fs.mkdirSync(abs(repo, NEW_DIR));
  fs.writeFileSync(abs(repo, `${NEW_DIR}/config.json`), `${JSON.stringify({ mode: 'yolo' }, null, 2)}\n`);

  const plan = mod().planMigration(repo.root, { env: repo.env });
  assert.deepEqual(plan.moves.map((mv) => mv.dir), ['api']);
  assert.deepEqual(plan.roots, ['', 'api']);
  assert.deepEqual(plan.conflicts, []);
});

test('4. both planning directories at one root is a refusal naming the path and the fix, and plans no move there', (t) => {
  const repo = fleet(t, { state: 'both' });
  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.conflicts.map((c) => c.dir), ['']);
  const issue = legacyPlanningIssue(repo.root);
  assert.equal(issue.layout, 'both');
  assert.equal(plan.conflicts[0].message, issue.message);
  assert.equal(plan.conflicts[0].fix, issue.fix);
  const refusal = m.refusalFor(plan);
  assert.equal(refusal.reason, 'both-planning-dirs');
  assert.ok(refusal.message.includes(`${NEW_DIR}/`) && refusal.message.includes(`${OLD_DIR}/`), refusal.message);
  assert.equal(refusal.next, issue.fix);

  const nested = fleet(t, { state: 'nested-both', nested: true });
  const nestedPlan = m.planMigration(nested.root, { env: nested.env });
  assert.deepEqual(nestedPlan.conflicts.map((c) => c.dir), ['api']);
  assert.deepEqual(nestedPlan.moves.map((mv) => mv.dir), ['', 'web']);
  const nestedRefusal = m.refusalFor(nestedPlan);
  assert.equal(nestedRefusal.reason, 'both-planning-dirs');
  assert.ok(nestedRefusal.message.includes(`api/${NEW_DIR}/`) && nestedRefusal.message.includes(`api/${OLD_DIR}/`), nestedRefusal.message);
  assert.equal(nestedRefusal.next, nestedPlan.conflicts[0].fix);
});

test('5. a malformed pre-rename block is a refusal naming CLAUDE.md and the manual fix', (t) => {
  for (const kind of ['malformed', 'duplicate', 'mixed']) {
    const repo = fleet(t, { claudeMd: kind });
    const m = mod();
    const plan = m.planMigration(repo.root, { env: repo.env });
    assert.deepEqual(plan.malformed.map((x) => x.file), ['CLAUDE.md'], kind);
    assert.deepEqual(plan.blocks, [], kind);
    const refusal = m.refusalFor(plan);
    assert.equal(refusal.reason, 'legacy-block-malformed', kind);
    assert.ok(refusal.message.includes('CLAUDE.md'), `${kind}: ${refusal.message}`);
    assert.match(refusal.next, /by hand|duplicate/, kind);
  }
});

test('6. stamps, blocks and ignores are planned with post-move paths; exclude.added lists the twins', (t) => {
  const repo = fleet(t, { nested: true });
  const plan = mod().planMigration(repo.root, { env: repo.env });
  assert.deepEqual(plan.stamps, [
    { file: `${NEW_DIR}/config.json`, action: 'rename' },
    { file: `api/${NEW_DIR}/config.json`, action: 'rename' },
  ]);
  assert.deepEqual(plan.blocks, [{ file: 'CLAUDE.md', markers: 'pre-v1' }]);
  assert.deepEqual(plan.ignores, [
    {
      file: '.gitignore',
      changes: [
        { line: 4, action: 'rewrite', from: `${OLD_DIR}/.progress-guard.json`, to: `${NEW_DIR}/.progress-guard.json` },
        { line: 5, action: 'rewrite', from: `**/${OLD_DIR}/.skill-active`, to: `**/${NEW_DIR}/.skill-active` },
        { line: 6, action: 'drop', from: `${OLD_DIR}/.awareness-cache.json`, to: null },
      ],
    },
    {
      file: 'api/.gitignore',
      changes: [{ line: 2, action: 'rewrite', from: `${OLD_DIR}/.progress-guard.json`, to: `${NEW_DIR}/.progress-guard.json` }],
    },
  ]);
  assert.equal(plan.exclude.file, '.git/info/exclude');
  assert.deepEqual(plan.exclude.added, [`${NEW_DIR}/${LEGACY.notices}`]);
  assert.deepEqual(plan.malformed, []);
});

test('7. a repository with no legacy anything has nothing to do', (t) => {
  const repo = fleet(t, { blank: true });
  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  assert.equal(plan.applies, false);
  for (const key of ['moves', 'conflicts', 'skipped', 'stamps', 'blocks', 'malformed', 'ignores', 'roots']) {
    assert.deepEqual(plan[key], [], key);
  }
  assert.deepEqual(plan.exclude.added, []);
  assert.equal(m.refusalFor(plan), null);
});

// ─── the move ─────────────────────────────────────────────────────────────────

test('8. git mv moves every tree with its history and its ignored files', (t) => {
  const repo = fleet(t, { nested: true });
  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  const done = m.moveTrees(repo.root, plan.moves, { env: repo.env });
  assert.deepEqual(done.map((d) => d.dir), ['', 'api', 'web']);
  assert.deepEqual(done.map((d) => d.via), ['git mv', 'git mv', 'git mv']);

  // Renames only. The one other entry is the ignored runtime marker: the legacy ignore line no longer covers its
  // new path until convertResidue rewrites that line (test 16).
  const status = repo.git(['status', '--porcelain=v1']).split('\n').filter(Boolean);
  assert.deepEqual(status.filter((l) => !l.startsWith('R ')), [`?? ${NEW_DIR}/.skill-active`]);
  assert.ok(status.filter((l) => l.startsWith('R ')).length >= plan.moves.length);

  repo.git(['commit', '-q', '-m', 'move planning']);
  const log = repo.git(['log', '--follow', '--oneline', '--', `${NEW_DIR}/ROADMAP.md`]).trim().split('\n');
  assert.equal(log.length, 2, log.join('\n'));
  assert.match(log[1], /init$/);

  assert.ok(exists(repo, `${NEW_DIR}/.skill-active`), 'the ignored file did not move with the tree');
  for (const dir of ['', 'api', 'web']) {
    assert.equal(exists(repo, dir ? `${dir}/${OLD_DIR}` : OLD_DIR), false, `${dir}: legacy directory left`);
  }
  assert.equal(m.movesDone(repo.root, plan.moves), true);
});

test('9. an untracked tree moves with an fs rename, byte for byte', (t) => {
  const repo = fleet(t, { untrackedTree: true });
  const under = (snap, dir) => Object.fromEntries(
    Object.entries(snap).filter(([k]) => k.startsWith(`${dir}/`)).map(([k, v]) => [k.slice(dir.length + 1), v]),
  );
  const before = under(repo.snapshot(), OLD_DIR);
  assert.ok(Object.keys(before).length > 10);

  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  assert.equal(plan.moves.length, 1);
  assert.equal(plan.moves[0].tracked, false);
  const done = m.moveTrees(repo.root, plan.moves, { env: repo.env });
  assert.deepEqual(done.map((d) => d.via), ['rename']);

  assert.deepEqual(under(repo.snapshot(), NEW_DIR), before);
  assert.equal(exists(repo, OLD_DIR), false);
  assert.equal(repo.git(['ls-files', '--', NEW_DIR]), '');
});

test('10. a second moveTrees is a no-op', (t) => {
  const repo = fleet(t, { nested: true });
  const { m, plan } = migrate(repo);
  const snap = repo.snapshot();
  const again = m.moveTrees(repo.root, plan.moves, { env: repo.env });
  assert.deepEqual(again.map((d) => d.via), ['done', 'done', 'done']);
  assert.deepEqual(repo.snapshot(), snap);
  assert.equal(m.movesDone(repo.root, plan.moves), true);
});

test('11. an interrupted move: leftovers move into the target, nothing is overwritten', (t) => {
  const repo = fleet(t, {});
  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  repo.git(['mv', OLD_DIR, NEW_DIR]);
  fs.mkdirSync(abs(repo, OLD_DIR));
  fs.writeFileSync(abs(repo, `${OLD_DIR}/notes.txt`), 'scratch note\n');
  fs.mkdirSync(abs(repo, `${OLD_DIR}/scratch`));
  fs.writeFileSync(abs(repo, `${OLD_DIR}/scratch/draft.md`), '# draft\n');
  assert.equal(m.movesDone(repo.root, plan.moves), false);

  const done = m.moveTrees(repo.root, plan.moves, { env: repo.env });
  assert.deepEqual(done.map((d) => d.via), ['leftovers']);
  assert.equal(read(repo, `${NEW_DIR}/notes.txt`), 'scratch note\n');
  assert.equal(read(repo, `${NEW_DIR}/scratch/draft.md`), '# draft\n');
  assert.equal(exists(repo, OLD_DIR), false, 'the emptied source was not removed');
  assert.equal(m.movesDone(repo.root, plan.moves), true);

  // A same-named file is never overwritten and never lost: it stays in the source.
  const stateBefore = read(repo, `${NEW_DIR}/STATE.md`);
  fs.mkdirSync(abs(repo, OLD_DIR));
  fs.writeFileSync(abs(repo, `${OLD_DIR}/STATE.md`), 'a stale copy\n');
  const again = m.moveTrees(repo.root, plan.moves, { env: repo.env });
  assert.equal(again[0].via, 'leftovers');
  assert.deepEqual(again[0].left, [`${OLD_DIR}/STATE.md`]);
  assert.equal(read(repo, `${NEW_DIR}/STATE.md`), stateBefore);
  assert.equal(read(repo, `${OLD_DIR}/STATE.md`), 'a stale copy\n');
  assert.equal(m.movesDone(repo.root, plan.moves), false);
});

// ─── residue ──────────────────────────────────────────────────────────────────

test('12. a stamp under the pre-rename key is renamed in place: one line differs, key order unchanged', (t) => {
  const repo = fleet(t, { nested: true });
  const before = {
    root: read(repo, `${OLD_DIR}/config.json`),
    api: read(repo, `api/${OLD_DIR}/config.json`),
  };
  const { result } = migrate(repo);
  assert.deepEqual(result.stamps, [
    { file: `${NEW_DIR}/config.json`, action: 'rename' },
    { file: `api/${NEW_DIR}/config.json`, action: 'rename' },
  ]);
  for (const [rel, text] of [[`${NEW_DIR}/config.json`, before.root], [`api/${NEW_DIR}/config.json`, before.api]]) {
    const after = read(repo, rel);
    const a = text.split('\n');
    const b = after.split('\n');
    assert.equal(a.length, b.length, rel);
    const differing = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
    assert.deepEqual(differing, [[`  "${OLD_KEY}": {`, `  "${NEW_KEY}": {`]], rel);
    assert.deepEqual(JSON.parse(after), expectedRename(JSON.parse(text)), rel);
    assert.deepEqual(Object.keys(JSON.parse(after)), Object.keys(JSON.parse(text)).map((k) => (k === OLD_KEY ? NEW_KEY : k)), rel);
  }
});

test('13. both stamp keys merge into one object under the new key, the new values winning', (t) => {
  const repo = fleet(t, { stamp: 'both' });
  const { result } = migrate(repo);
  assert.deepEqual(result.stamps, [{ file: `${NEW_DIR}/config.json`, action: 'merge' }]);
  const after = read(repo, `${NEW_DIR}/config.json`);
  const parsed = JSON.parse(after);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, OLD_KEY), false);
  assert.deepEqual(parsed[NEW_KEY], { ...fx.LEGACY_STAMP_EXTRA, ...fx.AOFORGE_STAMP });
  assert.equal(parsed[NEW_KEY].version, fx.AOFORGE_STAMP.version);
  assert.deepEqual(parsed[NEW_KEY].declined, ['0006'], 'a key only the old stamp held was lost');
  assert.equal(after, `${JSON.stringify(parsed, null, 2)}\n`, 'indent or trailing newline changed');
});

test('14. a pre-v1 CLAUDE.md block is converted and every byte outside it is identical', (t) => {
  const repo = fleet(t, { claudeMd: 'pre-v1' });
  const { result } = migrate(repo);
  assert.deepEqual(result.blocks, [{ file: 'CLAUDE.md', markers: 'pre-v1' }]);
  const after = read(repo, 'CLAUDE.md');
  assert.equal(after, fx.convertedClaudeMdText('pre-v1'));
  assert.ok(after.startsWith(fx.CLAUDE_INTRO), 'the text above the block changed');
  assert.ok(after.endsWith(fx.CLAUDE_OUTRO), 'the text below the block changed');
  assert.ok(after.includes(`set up with ${OLD_PRODUCT} in 2025`), 'a name outside the block was rewritten');
  const block = managedBlock.read(after);
  assert.equal(block.meta.legacy, true, 'the pre-v1 format is kept so the next upgrade refreshes the block');
  assert.equal(block.content, fx.CURRENT_BODY);
});

test('15. a versioned block keeps its attributes as written', (t) => {
  const repo = fleet(t, { claudeMd: 'versioned' });
  const { result } = migrate(repo);
  assert.deepEqual(result.blocks, [{ file: 'CLAUDE.md', markers: 'versioned' }]);
  const after = read(repo, 'CLAUDE.md');
  assert.equal(after, fx.convertedClaudeMdText('versioned'));
  const block = managedBlock.read(after);
  assert.deepEqual(block.meta, { v: '2', src: 'claude-md', legacy: false });
});

test('16. ignore files: lines rewritten or dropped, comments kept, nested file rewritten, info/exclude gains twins', (t) => {
  const repo = fleet(t, { nested: true });
  const { result } = migrate(repo);

  assert.equal(read(repo, '.gitignore'), [
    'node_modules/',
    '',
    `# ${OLD_PRODUCT} runtime state (migration 0008)`,
    `${NEW_DIR}/.progress-guard.json`,
    `**/${NEW_DIR}/.skill-active`,
    `${NEW_DIR}/.awareness-cache.json`,
    '',
  ].join('\n'));
  assert.equal(read(repo, 'api/.gitignore'), `*.log\n${NEW_DIR}/.progress-guard.json\n`);
  assert.deepEqual(result.ignores.map((e) => e.file), ['.gitignore', 'api/.gitignore']);

  const exclude = read(repo, '.git/info/exclude').split('\n');
  assert.ok(exclude.includes(fx.EXCLUDE_LINE), 'a legacy exclude line was removed');
  assert.ok(exclude.includes(`${NEW_DIR}/${LEGACY.notices}`), 'the twin was not added');
  assert.deepEqual(result.exclude.added, [`${NEW_DIR}/${LEGACY.notices}`]);

  assert.equal(repo.gitTry(['check-ignore', '-q', `${NEW_DIR}/.skill-active`]).status, 0, 'the moved marker is not ignored');
});

test('17. a second convertResidue changes nothing', (t) => {
  const repo = fleet(t, { nested: true });
  const { m, plan } = migrate(repo);
  const snap = repo.snapshot();
  const again = m.convertResidue(repo.root, { env: repo.env, roots: plan.roots });
  assert.deepEqual(again.stamps, []);
  assert.deepEqual(again.blocks, []);
  assert.deepEqual(again.ignores, []);
  assert.deepEqual(again.exclude.added, []);
  assert.deepEqual(repo.snapshot(), snap);
});

test('18. a 3.0-era tree (new stamp, new block): only the move applies', (t) => {
  const repo = fleet(t, { era: '3.0' });
  const config = read(repo, `${OLD_DIR}/config.json`);
  const claude = read(repo, 'CLAUDE.md');
  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  assert.deepEqual(plan.moves.map((mv) => mv.dir), ['']);
  assert.deepEqual(plan.stamps, []);
  assert.deepEqual(plan.blocks, []);
  const { result } = migrate(repo);
  assert.deepEqual(result.stamps, []);
  assert.deepEqual(result.blocks, []);
  assert.equal(read(repo, `${NEW_DIR}/config.json`), config);
  assert.equal(read(repo, 'CLAUDE.md'), claude);
});

test('19. an invalid config.json is recorded with its error and left alone; the rest is converted', (t) => {
  const repo = fleet(t, {});
  const broken = '{ "mode": "yolo", \n';
  fs.writeFileSync(abs(repo, `${OLD_DIR}/config.json`), broken);
  const m = mod();
  const plan = m.planMigration(repo.root, { env: repo.env });
  assert.equal(plan.stamps.length, 1);
  assert.equal(plan.stamps[0].file, `${NEW_DIR}/config.json`);
  assert.equal(plan.stamps[0].action, null);
  assert.equal(typeof plan.stamps[0].error, 'string');
  assert.equal(plan.applies, true);

  const { result } = migrate(repo);
  assert.equal(result.stamps.length, 1);
  assert.equal(result.stamps[0].action, null);
  assert.equal(typeof result.stamps[0].error, 'string');
  assert.equal(read(repo, `${NEW_DIR}/config.json`), broken);
  assert.equal(read(repo, 'CLAUDE.md'), fx.convertedClaudeMdText('pre-v1'));
  assert.ok(read(repo, '.gitignore').includes(`${NEW_DIR}/.progress-guard.json`));
});

// ─── pure helpers and rendering ───────────────────────────────────────────────

test('20. renameStampKeyText: only-old, both, neither, a nested same-named key, invalid JSON', () => {
  const { renameStampKeyText } = mod();

  const only = `{\n  "mode": "yolo",\n  "${OLD_KEY}": {\n    "version": "2.13.1"\n  },\n  "x": 1\n}\n`;
  assert.deepEqual(renameStampKeyText(only), { text: only.replace(`"${OLD_KEY}"`, `"${NEW_KEY}"`), action: 'rename' });

  const both = `{\n    "${OLD_KEY}": {"a": 1, "b": 2},\n    "${NEW_KEY}": {"b": 3}\n}`;
  assert.deepEqual(renameStampKeyText(both), {
    text: JSON.stringify({ [NEW_KEY]: { a: 1, b: 3 } }, null, 4),
    action: 'merge',
  });

  const neither = '{"mode":"yolo"}\n';
  assert.deepEqual(renameStampKeyText(neither), { text: neither, action: null });

  const nested = `{\n  "tools": {\n    "${OLD_KEY}": {"a": 1}\n  },\n  "${OLD_KEY}": {"version": "2"}\n}\n`;
  const nestedWant = `{\n  "tools": {\n    "${OLD_KEY}": {"a": 1}\n  },\n  "${NEW_KEY}": {"version": "2"}\n}\n`;
  assert.deepEqual(renameStampKeyText(nested), { text: nestedWant, action: 'rename' });

  const invalid = renameStampKeyText('{ nope');
  assert.equal(invalid.text, '{ nope');
  assert.equal(invalid.action, null);
  assert.equal(typeof invalid.error, 'string');
});

test('21. rewriteIgnoreText and addExcludeCounterparts keep CRLF and a negation', () => {
  const { rewriteIgnoreText, addExcludeCounterparts } = mod();

  const ignore = `${OLD_DIR}/a\r\n!${OLD_DIR}/keep\r\n# ${OLD_DIR}/comment\r\nother\r\n`;
  const rewritten = rewriteIgnoreText(ignore);
  assert.equal(rewritten.text, `${NEW_DIR}/a\r\n!${NEW_DIR}/keep\r\n# ${OLD_DIR}/comment\r\nother\r\n`);
  assert.deepEqual(rewritten.changes, [
    { line: 1, action: 'rewrite', from: `${OLD_DIR}/a`, to: `${NEW_DIR}/a` },
    { line: 2, action: 'rewrite', from: `!${OLD_DIR}/keep`, to: `!${NEW_DIR}/keep` },
  ]);
  assert.deepEqual(rewriteIgnoreText(rewritten.text).changes, [], 'not idempotent');

  const exclude = `${OLD_DIR}/x\r\n!${OLD_DIR}/y\r\n`;
  const added = addExcludeCounterparts(exclude);
  assert.equal(added.text, `${OLD_DIR}/x\r\n${NEW_DIR}/x\r\n!${OLD_DIR}/y\r\n!${NEW_DIR}/y\r\n`);
  assert.deepEqual(added.added, [`${NEW_DIR}/x`, `!${NEW_DIR}/y`]);
  assert.deepEqual(addExcludeCounterparts(added.text).added, [], 'not idempotent');
});

test('22. ownsMigratePath: the planning directories, ignore files and CLAUDE.md', () => {
  const { ownsMigratePath } = mod();
  for (const rel of [`${OLD_DIR}/x`, `${NEW_DIR}/x`, `api/${OLD_DIR}/x`, '.gitignore', 'api/.gitignore', 'CLAUDE.md', 'api/CLAUDE.md']) {
    assert.equal(ownsMigratePath(rel), true, rel);
  }
  for (const rel of ['src/index.js', 'README.md', 'docs/guide.md']) {
    assert.equal(ownsMigratePath(rel), false, rel);
  }
});

test('23. renderMigrationSection: a row per change, escaped cells, a Not moved list, the empty record', () => {
  const { renderMigrationSection } = mod();
  const md = renderMigrationSection({
    moves: [
      { dir: '', from: OLD_DIR, to: NEW_DIR, via: 'git mv', files: 12 },
      { dir: 'we|ird', from: `we|ird/${OLD_DIR}`, to: `we|ird/${NEW_DIR}`, via: 'rename', files: 3 },
    ],
    stamps: [{ file: `${NEW_DIR}/config.json`, action: 'rename' }],
    blocks: [{ file: 'CLAUDE.md', markers: 'pre-v1' }],
    ignores: [{
      file: '.gitignore',
      changes: [
        { line: 4, action: 'rewrite', from: `${OLD_DIR}/.a`, to: `${NEW_DIR}/.a` },
        { line: 6, action: 'drop', from: `${OLD_DIR}/.b`, to: null },
      ],
    }],
    exclude: { file: '.git/info/exclude', added: [`${NEW_DIR}/.n`] },
    skipped: [{ path: `vendor/lib/${OLD_DIR}`, reason: 'inside vendor/' }],
  });
  assert.ok(md.startsWith('## Migration\n\n'), md);
  assert.match(md, /^\| Change \| From \| To \| How \|$/m);
  const rows = md.split('\n').filter((l) => l.startsWith('| '));
  assert.equal(rows.length, 2 + 7, `a header, a separator and 7 rows:\n${md}`);
  assert.ok(md.includes(`we\\|ird/${OLD_DIR}`), 'a pipe in a cell was not escaped');
  assert.ok(md.includes('12 files') && md.includes('3 files'), 'the file counts are missing');
  assert.match(md, /\*\*Not moved:\*\*\n- .*vendor\/lib\/.*inside vendor\//);

  const empty = '## Migration\n\nNothing to migrate.\n';
  assert.equal(renderMigrationSection({ moves: [], stamps: [], blocks: [], ignores: [], exclude: { file: null, added: [] }, skipped: [] }), empty);
  assert.equal(renderMigrationSection({}), empty);
});

// ─── the guard ────────────────────────────────────────────────────────────────

test('24. the rename guard lists the module with a reason, and the module builds every legacy token from LEGACY', () => {
  const guard = fs.readFileSync(path.join(__dirname, 'rename-guard.repo.test.cjs'), 'utf-8');
  const entry = /pattern:\s*'\*\*\/legacy-migrate\.cjs',\s*reason:\s*'([^']+)'/.exec(guard);
  assert.ok(entry, 'rename-guard.repo.test.cjs has no ALLOW entry for legacy-migrate.cjs');
  assert.ok(entry[1].length >= 20, 'the ALLOW reason is too short');

  const src = fs.readFileSync(path.join(__dirname, 'legacy-migrate.cjs'), 'utf-8');
  assert.match(src, /require\('\.\/legacy-names\.cjs'\)/);
  assert.match(src, /require\('\.\/legacy-rewrite\.cjs'\)/);
  assert.equal(src.toLowerCase().includes(LEGACY.slug), false, 'the module spells the legacy product instead of building it from LEGACY');
});
