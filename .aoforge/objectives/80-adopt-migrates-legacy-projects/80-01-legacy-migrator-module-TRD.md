---
objective: 80-adopt-migrates-legacy-projects
trd: "01"
type: standard
wave: 1
depends_on: []
files_modified:
  - plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs
  - plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs
  - plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs
  - plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs
  - plugins/aoforge/aoforge/bin/lib/legacy-names.cjs
  - plugins/aoforge/aoforge/bin/lib/legacy-rewrite.cjs
autonomous: true
requirements: [SC-1, SC-2, SC-5]
must_haves:
  truths:
    - "planMigration(root) finds every pre-rename planning directory in the repository (the root one and nested component ones such as `api/.planning`), never one under node_modules/vendor/build output, a nested git repository or a symlink, and reads nothing it would write"
    - "moveTrees moves each tree with `git mv` when git tracks files in it (history kept: `git log --follow` crosses the move) and with an fs rename when it tracks none; ignored and untracked files inside move with the tree; a second call is a no-op"
    - "convertResidue renames the `devflow{}` config stamp key to `aoforge{}` changing no other byte when only the old key exists, renames a pre-rename CLAUDE.md block's markers and the old names inside the block (bytes outside the block untouched), rewrites tracked .gitignore lines that name the old directory, and adds (never removes) .git/info/exclude counterparts; a second call changes nothing"
    - "Both planning directories at one planning root, or a malformed pre-rename block, is a refusal (refusalFor) that names the path and the fix; planMigration then plans no move"
    - "The rename guard passes with one new ALLOW entry (lib/legacy-migrate.cjs, with a reason); no other non-test, non-fixture file gains a legacy spelling"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs
      provides: "the one detector/migrator module adopt uses to bring a pre-rename project onto .aoforge/"
      exports: [planMigration, refusalFor, moveTrees, convertResidue, movesDone, ownsMigratePath, renameStampKeyText, rewriteBlockText, rewriteIgnoreText, addExcludeCounterparts, renderMigrationSection]
    - path: plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs
      provides: "hand-built fleet-shaped pre-rename repositories (2.x and 3.0-era) in every state adopt must handle"
      exports: [legacyFleetRepo, FLEET_STATES]
    - path: plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs
      provides: "the migrator's test list"
  key_links:
    - from: plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs
      to: plugins/aoforge/aoforge/bin/lib/legacy-names.cjs
      via: "every legacy token built from LEGACY (no second source)"
      pattern: "require\\('./legacy-names.cjs'\\)"
    - from: plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs
      to: plugins/aoforge/aoforge/bin/lib/legacy-rewrite.cjs
      via: "rewriteLegacyNames over the pre-rename block region only"
      pattern: "rewriteLegacyNames"
    - from: plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs
      to: plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs
      via: "ALLOW entry with a reason of >= 20 chars"
      pattern: "legacy-migrate"
---

# TRD 80-01: The adopt migrator module (detect, move, convert)

<objective>
Build `lib/legacy-migrate.cjs`, the one module that knows how to bring a pre-rename project onto the 3.1 layout:
find every legacy planning tree in a repository, move it with `git mv`, rename the `devflow{}` config stamp key,
rename a pre-rename CLAUDE.md managed block's markers, and carry ignore lines across. It reuses the tested logic of the
deleted migrations 0012 (move), 0013 (stamp key) and 0014 (block) without resurrecting their ids, and it never commits
(adopt records the change, TRDs 80-02/80-03).

Purpose: SC-1 (the move, stamp and markers, nothing else written into the planning content), SC-2 (both-dirs and
malformed input are refusals; every step idempotent) and SC-5 (legacy names live in one module on the rename guard's
ALLOW list). Output: the module, a hand-built fleet-shaped fixture builder, the test file, the ALLOW entry.
</objective>

<file_tree>
plugins/aoforge/aoforge/bin/lib/
├── legacy-migrate.cjs                      ← CREATE
├── legacy-migrate.legacy.test.cjs          ← CREATE
├── __fixtures__/legacy-adopt-fixtures.cjs  ← CREATE
├── rename-guard.repo.test.cjs              ← MODIFY (one ALLOW entry)
├── legacy-names.cjs                        ← MODIFY (header comment: the migrator is a LEGACY reader)
└── legacy-rewrite.cjs                      ← MODIFY (header comment: adopt's migrator is a user)
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@plugins/aoforge/aoforge/bin/lib/planning-layout.cjs (detectors, PLANNING_MARKERS, legacyPlanningIssue 'both' text)
@plugins/aoforge/aoforge/bin/lib/legacy-names.cjs
@plugins/aoforge/aoforge/bin/lib/legacy-rewrite.cjs (lines 1-120: rewriteLegacyNames)
@plugins/aoforge/aoforge/bin/lib/managed-block.cjs (lines 1-140: LEGACY_START_RE, read)
@plugins/aoforge/aoforge/bin/lib/repo-state.cjs (EXCLUDE, countSourceFiles walk)
@plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-layout-fixtures.cjs (hermeticEnv, git, planningProject)
@plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs (lines 60-110: ALLOW)

The deleted migrations are the reference implementation. Read them, do not restore them:
`git show cb3e6582~1:plugins/aoforge/aoforge/bin/lib/migrations/0012-planning-dir-move.cjs`,
`git show cb3e6582~1:plugins/aoforge/aoforge/bin/lib/migrations/0013-config-key-rename.cjs`,
`git show 71f6d744~1:plugins/aoforge/aoforge/bin/lib/migrations/0014-claude-md-rebrand.cjs`, and their tests
(`...0012-planning-dir-move.legacy.test.cjs`, `...0013-config-key-rename.legacy.test.cjs`,
`git show 71f6d744~1:...0014-claude-md-rebrand.legacy.test.cjs`). The ids 0012-0014 stay retired
(upgrade.RETIRED_MIGRATIONS); nothing here registers a migration.

Objective-wide rules (every task):
- Use the repo CLI: `node plugins/aoforge/aoforge/bin/aof-tools.cjs ...`, never the installed runtime.
- Commit only through `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-01): <desc>" --files <paths>`;
  the RED commit lands before GREEN. One plain command per Bash call.
- Tests build mkdtemp repos and a fake HOME and never read the real `~/.claude`. Run tests with
  `TMPDIR=<S>/80-01/tmp HOME=<S>/80-01/home node --test <files>` where
  `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`
  (mkdir both first). Not `/var/folders`: repo-state treats it as a scratch location.
- Never write a real fleet repository (`~/dev/<other repo>`). Never port 8080. Never push, tag or release.
- Rename guard: a legacy spelling only in legacy-names.cjs, lib/legacy-migrate.cjs (ALLOW, this TRD),
  `__fixtures__/legacy-*` and `*.legacy.test.*`.
- Concurrency: quick 42 may still be committing on this checkout (workflows, CHANGELOG, a stack pack). Touch only
  this TRD's files; stage only them.
- User CLAUDE.md playbook (applies at execution): one failing test at a time; hand-built fixtures, no generated data.
</context>

<embedded_context>

<codebase_examples>
**0012's move core (reuse the shape; drop `stageOwnRemovals`, adopt has no earlier migration in the same run):**

```js
// git mv when git tracks files in the tree, fs rename otherwise; then move anything git left behind.
const tracked = git(ctx, ['ls-files', '-z', '--', OLD_DIR]);
if (tracked.out.length > 0) {
  const r = git(ctx, ['mv', '--', OLD_DIR, NEW_DIR]);
  if (r.status !== 0) throw new Error(`git mv ${OLD_DIR} ${NEW_DIR} failed: ${r.err || r.status}`);
  moveLeftovers(from, to);           // per entry, never overwrites, rmdir when empty
  return { via: 'git mv' };
}
fs.renameSync(from, to);
```

**0012's ignore-line counterpart (segment regex, comments and blanks untouched, negation kept):**

```js
const LEGACY_SEGMENT = `(^|/)${escapeRegExp(OLD_DIR)}(?=/|$)`;
function counterpart(line) {
  if (!line.trim() || line.trimStart().startsWith('#')) return null;
  const neg = line.startsWith('!') ? '!' : '';
  const body = neg ? line.slice(1) : line;
  if (!new RegExp(LEGACY_SEGMENT).test(body)) return null;
  return neg + body.replace(new RegExp(LEGACY_SEGMENT, 'g'), `$1${NEW_DIR}`);
}
```

**0013's stamp-key rename (same position, every other key in order; both keys: shallow merge, new wins):**

```js
function renameStampKey(config) {
  const hasNew = has(config, NEW_KEY);
  const value = !hasNew ? config[OLD_KEY]
    : isPlainObject(config[NEW_KEY]) && isPlainObject(config[OLD_KEY]) ? { ...config[OLD_KEY], ...config[NEW_KEY] }
    : config[NEW_KEY];
  const out = {};
  for (const key of Object.keys(config)) {
    if (key === OLD_KEY) { if (!hasNew) out[NEW_KEY] = value; continue; }
    out[key] = key === NEW_KEY ? value : config[key];
  }
  return out;
}
```

**0014's block rewrite (whole block region through rewriteLegacyNames, then prove one AOFORGE block at the same start):**

```js
const region = text.slice(block.start, block.end);
const nextRegion = rewriteLegacyNames(region);
const next = text.slice(0, block.start) + nextRegion + text.slice(block.end);
const check = managedBlock.read(next);   // must not throw, one block, same start
```
In 3.1 `managedBlock.read` refuses a pre-rename block (ELEGACYBLOCK), so locate the legacy block yourself with START/END
regexes built from `LEGACY.blockTag` (same START syntax as `managedBlock.LEGACY_START_RE`).

**Destructure so a dotted access never spells the legacy directory (0012's trick, still useful for readability):**
`const { planningDir: NEW_DIR, configKey: NEW_KEY, blockTag: NEW_TAG } = NAMES;`
`const { planningDir: OLD_DIR, configKey: OLD_KEY, blockTag: OLD_TAG } = LEGACY;`
</codebase_examples>

<anti_patterns>
- Restoring migrations 0012/0013/0014 or registering a new migration id: adopt is the path (user decision 2026-10-17).
- Re-serialising config.json when only the old key is present: rename the key token in place so no other byte changes.
- Rewriting text outside the CLAUDE.md block, comments in .gitignore, or any planning file content.
- Deleting info/exclude lines: other branches of the same clone may still use the old directory; only add counterparts.
- `mkdir .aoforge` before `git mv`: git then moves the tree INSIDE it (`.aoforge/.planning/...`). Verified on git 2.x.
- A filesystem walk that descends into node_modules, build output, a nested repository or a symlink.
- Generated or LLM-written fixture data; property-based tests; .feature files (resolver constraints).
</anti_patterns>

<error_recovery>
- `git mv` fails ("bad source" / "destination exists"): stop that move, throw with git's stderr; nothing after it runs.
  The caller (adopt begin) reports it and the marker lets a re-run resume.
- A tree half-moved by an interrupted run (target exists, source still holds untracked leftovers): `moveTrees` treats
  the source as leftovers and moves them entry by entry (never overwriting), then removes the empty source.
- config.json that is not valid JSON: leave it, record `{ file, action: null, error }`; never throw from convertResidue
  for one bad file (the report lists it).
</error_recovery>

</embedded_context>

<gotchas>
- `git mv src dst` with an existing (even empty) `dst` directory nests src inside dst. Check `to` is absent first.
- `git mv` moves ignored and untracked files inside the directory too (git renames the directory); `moveLeftovers`
  is the belt for anything left.
- Real fleet layouts (surveyed read-only 2026-10-17): aodex has `.planning/` plus `flutter/.planning/` (with config
  and STATE) plus `go/.planning/` holding only `objectives/`; aohealth and aoCyberSecurity have nested trees and no
  root one; aofamily has a root `.aoforge/` and nested legacy trees; aocore ignores `**/.planning/.skill-active`;
  smartWellness's CLAUDE.md block uses the pre-v1 marker
  `<!-- DEVFLOW:START - Auto-generated by /devflow:map-codebase. Edit between these markers will be overwritten. -->`;
  aodex/aocore/eden-biz config.json carry `"devflow": {"version": "2.13.1"|"2.15.0", ...}`; trades carries an
  `aoforge` stamp inside `.planning/` (3.0-era, move only).
- `PLANNING_MARKERS` in planning-layout is the root detector's set (config.json, STATE.md, ROADMAP.md, PROJECT.md).
  A nested tree such as `go/.planning/objectives/` has none of them, so the migrator's own qualifying rule also
  accepts a planning subdirectory (objectives, quick, codebase, debug, todos, decisions, research, milestones).
- The rename guard's `planningDir` token counts only directory-like occurrences; it still flags comments such as
  "the .planning/ tree". legacy-migrate.cjs is ALLOW-listed so its comments and messages may say so plainly; keep
  building the tokens themselves from LEGACY so the module follows the name map.
- Stack neutrality: no stack names (flutter, dart, ...) in legacy-migrate.cjs; fixtures use neutral component names
  (`api/`, `web/`).
</gotchas>

## Test list

Outermost first (git-level behaviour on a fleet-shaped repo, then the pure converters). Each row is one named test
in `legacy-migrate.legacy.test.cjs`; fixtures come from `legacyFleetRepo` (Task 1).

Discovery and refusal (`planMigration`, `refusalFor`):
1. 2.x fleet repo (root tree + `api/` tree with config/STATE + `web/` tree with only `objectives/` + a vendored
   `vendor/example.com/lib/.planning/notes.txt` decoy): moves are root, `api`, `web` (sorted, root first, each with
   `tracked: true` and its tracked file count); `skipped` holds the vendor decoy (reason names "vendor"); roots are
   `['', 'api', 'web']`; the call writes nothing (tree snapshot identical).
2. A legacy-named directory with no planning file and no planning subdirectory (`docs/.planning/readme.txt`) is
   skipped with reason "no planning files"; a `.planning` symlink is skipped with reason "symlink"; a tree inside a
   nested git repository is never reported.
3. Root `.aoforge/` plus nested legacy `api/.planning/` (aofamily shape): one move (`api`), roots `['', 'api']`.
4. Both directories at the root: `conflicts` names `''` with planning-layout's both-dirs message and fix; no move is
   planned for that root; `refusalFor` returns reason `both-planning-dirs`, a message naming `.aoforge/` and the
   legacy directory, and `next` = the fix. Same at `api/` (message names `api/`).
5. A malformed pre-rename block (START with no END; two START markers; a pre-rename block beside an AOFORGE block):
   `malformed` names `CLAUDE.md`; `refusalFor` returns reason `legacy-block-malformed` naming the file and the manual
   fix (rename both markers by hand / remove the duplicate).
6. Stamps/blocks/ignores planned with post-move paths: `stamps: [{file: '.aoforge/config.json', action: 'rename'},
   {file: 'api/.aoforge/config.json', action: 'rename'}]`, `blocks: [{file: 'CLAUDE.md', markers: 'pre-v1'}]`,
   `ignores` lists `.gitignore` changes with line numbers, `exclude.added` lists the info/exclude counterparts.
7. A repo with no legacy anything: `applies: false`, every list empty; `refusalFor` null.

Move (`moveTrees`, `movesDone`):
8. Clean 2.x repo: every move `via: 'git mv'`; `git status --porcelain` shows only `R` entries for the moved trees;
   `git log --follow --oneline -- .aoforge/ROADMAP.md` (after a test commit) reaches the fixture's first commit;
   the ignored `.planning/.skill-active` now sits at `.aoforge/.skill-active`; no legacy directory remains;
   `movesDone` true.
9. Untracked tree (`.planning/` ignored by a `.planning/` line, nothing tracked): `via: 'rename'`, contents
   byte-identical under `.aoforge/`.
10. Idempotent: a second `moveTrees` returns `via: 'done'` for each and changes nothing (snapshot identical).
11. Interrupted move: target exists with the tracked files, source still holds two untracked leftovers →
    `moveTrees` moves the leftovers (never overwriting a same-named file in the target), removes the empty source.

Residue (`convertResidue`) after the move:
12. Stamp, only the old key: config.json bytes equal the input with exactly the key token renamed (diff is one
    line); `JSON.parse` deep-equals 0013's renameStampKey result; key order unchanged.
13. Stamp, both keys: one object under the new key, new values win, old key gone; written with the file's own indent
    and trailing newline; action `merge`.
14. Block, pre-v1 marker: START/END renamed to AOFORGE, `/devflow:` and `.planning/` inside the block become the
    AOForge forms, every byte before and after the block identical; `managedBlock.read(next)` returns one block
    (`meta.legacy: true`, the pre-v1 format, so the next upgrade refreshes it).
15. Block, versioned marker (`v=2 src=claude-md`): attributes kept as written.
16. Ignore files: `.planning/.progress-guard.json` → `.aoforge/.progress-guard.json`; `**/.planning/.skill-active`
    → `**/.aoforge/.skill-active`; a legacy line whose counterpart is already present is dropped; comment lines
    and unrelated lines untouched; a nested `api/.gitignore` is rewritten too; info/exclude gains counterparts and
    keeps its legacy lines.
17. Idempotent: a second `convertResidue` returns empty lists and changes no byte.
18. 3.0-era tree (`aoforge` stamp, AOFORGE block, inside the legacy directory): only the move applies; stamps and
    blocks are empty.
19. Invalid config.json: recorded with `error`, file untouched, the rest of the residue still converted.

Pure helpers and rendering:
20. `renameStampKeyText` on: only-old (rename), both (merge), neither (null, text unchanged), a nested
    `"devflow"` key inside another object (only the top-level key renamed).
21. `rewriteIgnoreText` / `addExcludeCounterparts`: CRLF lines keep `\r`; a negated line keeps `!`.
22. `ownsMigratePath`: true for `.planning/x`, `.aoforge/x`, `api/.planning/x`, `.gitignore`, `api/.gitignore`,
    `CLAUDE.md`, `api/CLAUDE.md`; false for `src/index.js`, `README.md`.
23. `renderMigrationSection(record)`: a `## Migration` table with one row per move (from, to, how, file count), stamp,
    block, ignore line and exclude line, and a "Not moved" list for skipped dirs; every cell escaped with
    text-escape `mdCell`; empty record renders "Nothing to migrate."

Guard:
24. rename-guard.repo.test.cjs passes with the new ALLOW entry; its test 4 (reason >= 20 chars, matches a tracked
    path) covers the entry.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fixture builder and the RED test list</name>
  <files>plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs, plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs</files>
  <action>
Write `legacyFleetRepo(opts)` in `__fixtures__/legacy-adopt-fixtures.cjs`: a hand-built pre-rename repository shaped
after the surveyed fleet (gotchas), every file a hand-typed literal. Reuse `hermeticEnv` / `git` patterns from
legacy-layout-fixtures.cjs (copy the small helpers or export them from there only if legacy-layout-fixtures is not
otherwise changed; prefer a local copy to keep this TRD's file set). Returns
`{ root, home, env, git(args), run(args), snapshot(), cleanup() }`; `run` spawns the repo's aof-tools with
`--cwd root` and the hermetic env.

Options (defaults give the full 2.x shape):
- `era`: `'2.x'` (stamp under the old key: `{version:'2.13.1', migrations_applied:['0001','0004','0008'],
  upgraded_at:'2026-10-06T13:40:23.250Z'}`) | `'3.0'` (stamp under `aoforge`, AOFORGE block) | `'none'` (no stamp).
- `stamp`: override `'legacy'|'aoforge'|'both'|null`.
- `claudeMd`: `'pre-v1'` (default for 2.x; hand-written intro and outro naming the old product outside the block;
  body naming `/devflow:map-codebase`, `.planning/codebase/` and `df-tools`) | `'versioned'` (`v=2 src=claude-md`)
  | `'aoforge'` | `'malformed'` (START, no END) | `'duplicate'` | `null`.
- `nested`: true → `api/.planning/` (config.json with the old stamp, STATE.md, ROADMAP.md) and `web/.planning/`
  (only `objectives/01-web/01-01-TRD.md`); `api/.gitignore` with one legacy line.
- `decoys`: true → `vendor/example.com/lib/.planning/notes.txt` and `docs/.planning/readme.txt`.
- `untrackedTree`: true → `.gitignore` ignores the whole legacy directory; nothing under it tracked.
- `rootTree`: false → no root planning tree at all, only the nested ones (aohealth shape; implies `nested: true`).
- `commitDocs`: false → root config.json sets `planning.commit_docs: false` while the tree stays tracked.
- `adoptReport`: true → the root tree carries an earlier `ADOPT-REPORT.md` (hand-written literal).
- `state`: `FLEET_STATES` = `clean` | `dirty` (tracked STATE.md modified) | `untracked` (`notes.txt` untracked,
  not ignored) | `merge` (MERGE_HEAD) | `rebase` (rebase-merge dir) | `detached` | `both` (`.aoforge/config.json`
  also present, committed) | `nested-both` (`api/.aoforge/STATE.md` too) | `adopted-on-aoforge` (root already
  `.aoforge/` with the old stamp key and a pre-rename block: residue only).
Root planning content (2.x): PROJECT.md (with `kind: app` and `default_work: feature` frontmatter), ROADMAP.md (two
objectives), STATE.md, REQUIREMENTS.md, state.json, STATE_ARCHIVE.md, config.json (full nested shape, commit_docs
true), objectives/01-foundation/{OBJECTIVE.md, 01-01-TRD.md, 01-01-SUMMARY.md}, objectives/02-next/02-01-TRD.md,
quick/1-fix-typo/{1-PLAN.md, 1-SUMMARY.md}, debug/resolved/login-loop.md, decisions/accepted/DECISION-001.md,
todos/pending/2026-10-01-tidy.md, and an ignored `.skill-active`. Code: `package.json` and `src/index.js`.
`.gitignore`: `node_modules/`, the 0008 comment header, `.planning/.progress-guard.json`,
`**/.planning/.skill-active`, `.planning/.awareness-cache.json`, `.aoforge/.awareness-cache.json` (an existing
counterpart). `.git/info/exclude`: `.planning/.devflow-notices.json`. One initial commit of everything tracked,
signing off, a local identity. The planning content must be valid enough that `validate health` on a hand-migrated
copy reports no error (TRD 80-06 row 6 compares an adopt-migrated copy with a hand-migrated one); keep TRD/SUMMARY
frontmatter well-formed, and name no stack-pack profile in any STACK.md (a fake HOME has no pack installed: E030).

Every legacy token comes from LEGACY (the file is ALLOW'd by `__fixtures__/legacy-*`, but following the map keeps it
honest); a header comment says the shapes come from the read-only fleet survey of 2026-10-17 and that no real
repository was copied.

Then write `legacy-migrate.legacy.test.cjs` with the full Test list above as named tests (header comment = the
list). Each test requires `./legacy-migrate.cjs`; with no module they all fail. Commit RED:
`test(80-01): legacy migrator test list and fleet-shaped fixtures (RED)`.
  </action>
  <verify>TMPDIR=<S>/80-01/tmp HOME=<S>/80-01/home node --test plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs fails on the missing module only (no fixture errors: run a throwaway `node -e "require('./plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs').legacyFleetRepo({nested:true,decoys:true}).cleanup()"` first and expect exit 0)</verify>
  <done>Fixture builds every FLEET_STATES variant without error; the 24 tests exist and fail for the missing module; RED commit recorded.</done>
  <recovery>A fixture variant that cannot be built (git refuses a MERGE_HEAD shape, say): write the marker file into `git rev-parse --git-path MERGE_HEAD` as adopt-preflight's tests do, never a real merge.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Discovery, refusal and the move (GREEN for tests 1-11, 22)</name>
  <files>plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs</files>
  <action>
Create the module. Header comment: what it is (the adopt migrator, objective 80), that it replaces 3.0.x's migrations
0012/0013/0014 for 3.1 without their ids, that it never commits and never stages beyond `git mv`, and that every token
comes from LEGACY. Requires: fs, path, child_process.spawnSync, ./legacy-names.cjs, ./planning-layout.cjs
(PLANNING_MARKERS, legacyPlanningIssue for the both-dirs text), ./text-escape.cjs, ./legacy-rewrite.cjs and
./managed-block.cjs (lazily, inside the residue code, so loading the module for discovery stays cheap).

Approach:
1. `git(root, env, args)` via spawnSync with GIT_* redirect vars removed (0012's gitEnv), never a shell string.
2. Discovery walk from `root`: depth <= 8, `withFileTypes`, never follow symlinks. Skip `.git`, `node_modules`,
   repo-state's EXCLUDE names, `vendor`, `third_party`, `Pods`, every dot-directory except the two planning names,
   and any subdirectory that holds a `.git` entry (nested repository or submodule). A directory named LEGACY
   planningDir: symlink → skipped 'symlink'; under a skipped parent → not reported; qualifies when it holds a
   PLANNING_MARKERS file or one of the planning subdirectories (gotchas) → candidate; else skipped
   'no planning files'. A skipped directory under `vendor/` etc. is reported only when the walk saw it (decoys
   test: report the vendor one with reason naming the skipped parent, e.g. "inside vendor/").
   Do not descend into planning directories.
3. For each candidate at component dir `d` (`''` = root): sibling NEW dir exists → conflict
   `{ dir: d, message: <d>/ prefix + legacyPlanningIssue-both message, fix }` (build the both text yourself from the
   same NAMES/LEGACY words if calling legacyPlanningIssue on a nested dir is awkward) and no move; else move
   `{ dir: d, from: join(d, OLD), to: join(d, NEW), tracked: <git ls-files -z -- from non-empty>, files: <count> }`.
   Also treat an existing root `.aoforge/` as a planning root for residue (aofamily / adopted-on-aoforge).
4. Residue plan (read-only, post-move paths): for each planning root, its config.json (read from `from` or `to`,
   whichever exists) through `renameStampKeyText` → stamps; CLAUDE.md at `''` and each root dir → blocks (legacy
   START present: well-formed → planned; malformed → `malformed`); tracked `.gitignore` files outside planning dirs
   (`git ls-files -z -- .gitignore ':(glob)**/.gitignore'`) through `rewriteIgnoreText` → ignores; info/exclude
   (`git rev-parse --git-path info/exclude`) through `addExcludeCounterparts` → exclude.
5. `applies` = moves, stamps, blocks or ignores non-empty (exclude alone does not apply). `roots` sorted, `''` first.
6. `refusalFor(plan)`: conflicts first (reason `both-planning-dirs`), then malformed (`legacy-block-malformed`);
   message names every path; `next` is the fix sentence. Else null.
7. `moveTrees(root, moves, {env})`: per move, sorted. `to` absent → git mv (tracked) or fs.renameSync; `to` present
   and `from` holds entries → moveLeftovers (0012's); `to` present and `from` gone → `via: 'done'`. Never mkdir `to`.
   Create the parent of `to` only if missing (it always exists for a sibling move).
8. `movesDone(root, moves)`: every `to` is a directory and no `from` exists.
9. `ownsMigratePath(rel)`: a path segment equal to NEW or OLD planning dir, or basename `.gitignore` or `CLAUDE.md`.

# CRITICAL: discovery and planning never write (a snapshot test proves it).
# GOTCHA: `git mv` into an existing directory nests the tree; check `to` first, never mkdir it.
# PATTERN: 0012's git/moveLeftovers shapes (codebase_examples); repo-state's walk for the skip rules.

Run the tests; GREEN for 1-11 and 22. Commit `feat(80-01): legacy migrator discovery, refusal and move`.
  </action>
  <verify>TMPDIR=<S>/80-01/tmp HOME=<S>/80-01/home node --test --test-name-pattern="^(1|2|3|4|5|6|7|8|9|10|11|22)\." plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs (adapt the pattern to how the tests are named; all listed rows pass)</verify>
  <done>Discovery finds root and nested trees and skips decoys, symlinks and nested repos; refusals carry message and fix; moves keep history, carry ignored files, and are idempotent and resumable.</done>
  <recovery>If git mv of a nested tree fails because the parent component directory is itself untracked: fall back to fs rename for that move only and record `via: 'rename'`; add a test row for it.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Residue converters, rendering, ALLOW entry (GREEN for 12-21, 23-24)</name>
  <files>plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs, plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs, plugins/aoforge/aoforge/bin/lib/legacy-names.cjs, plugins/aoforge/aoforge/bin/lib/legacy-rewrite.cjs</files>
  <action>
1. `renameStampKeyText(text)` → `{ text, action }`: parse; no old key → `{ text, action: null }`. Only the old key:
   find each `"<OLD_KEY>"\s*:` occurrence, try renaming that one token, re-parse, and accept the first candidate
   whose parse deep-equals 0013's renameStampKey(parsed) (so a nested same-named key is never the one renamed);
   action `rename`. Both keys: `JSON.stringify(renameStampKey(parsed), null, indent) + (trailing newline if the
   input had one)`, `indent` detected from the first indented line (default 2); action `merge`. No candidate
   matched → the same re-serialisation with action `rename`.
2. `rewriteBlockText(text)` → null when no legacy START; locate START (regex from LEGACY.blockTag, the START syntax
   of managed-block) and the END after it; two STARTs, no END, or a legacy block beside an AOFORGE block → throw an
   Error with `code: 'ELEGACYMALFORMED'`, message and fix (planMigration catches it into `malformed`). Rewrite the
   region `[start, end)` through `rewriteLegacyNames`; verify `managedBlock.read(next)` returns one block at the
   same start; return `{ text: next, lines: <changed line count>, markers: 'pre-v1'|'versioned' }`.
3. `rewriteIgnoreText(text)` → `{ text, changes }`: per line (keep `\r`), legacy-segment line → counterpart;
   counterpart already present in the file → drop the legacy line (`action: 'drop'`), else replace
   (`action: 'rewrite'`); comments and blanks untouched.
4. `addExcludeCounterparts(text)` → `{ text, added }`: 0012's withCounterparts (insert the counterpart after each
   legacy line unless present; keep the legacy line).
5. `convertResidue(root, {env, roots})`: recompute the residue plan from disk, write each changed file
   (config.json per root, CLAUDE.md per root, tracked .gitignore files, info/exclude), return
   `{ stamps, blocks, ignores, exclude }` describing what changed (empty when nothing). Invalid JSON → record
   `{ file, action: null, error }` and continue.
6. `renderMigrationSection(record)` where `record = { moves: [...with via], stamps, blocks, ignores, exclude,
   skipped }` → markdown `## Migration` with a `| Change | From | To | How |` table (one row per moved tree,
   stamp key, CLAUDE.md block, ignore line, exclude line) then `**Not moved:**` bullets for skipped dirs with their
   reasons; `mdCell` every cell; an empty record → `## Migration\n\nNothing to migrate.\n`.
7. rename-guard.repo.test.cjs ALLOW: add
   `{ pattern: '**/legacy-migrate.cjs', reason: 'the adopt migrator (objective 80): detects and converts a pre-rename project, so its comments and messages name the old layout it moves' }`
   after the legacy-names entry. Update the header comment's test-8 sentence if it enumerates ALLOW entries.
8. legacy-names.cjs header: add the migrator to the list of LEGACY readers ("the converter: gh-rebrand,
   legacy-rewrite and legacy-migrate (adopt's move of a pre-rename project, objective 80)"). legacy-rewrite.cjs
   header: its users are gh rebrand and adopt's migrator (it stays while adopt migrates).

Run the whole test file, then `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs
plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-names.legacy.test.cjs
plugins/aoforge/aoforge/bin/lib/legacy-rewrite.legacy.test.cjs`. Commit
`feat(80-01): legacy migrator residue converters, migration table, rename-guard ALLOW entry`.
  </action>
  <verify>TMPDIR=<S>/80-01/tmp HOME=<S>/80-01/home node --test plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-names.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-rewrite.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/managed-block.legacy.test.cjs → 0 failures</verify>
  <done>All 24 rows pass; the guard and stack-neutrality pass; the stamp rename changes exactly one line; the block rewrite leaves bytes outside the block identical; second runs change nothing.</done>
  <recovery>If legacy-names.legacy.test (6) objects to a LEGACY key nothing reads, you used a key it does not know: use only existing LEGACY keys (planningDir, configKey, blockTag, slug, commandNs, cli).</recovery>
</task>

</tasks>

<validation_gates>
<test>TMPDIR=<S>/80-01/tmp HOME=<S>/80-01/home node --test plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs</test>
<lint>not_available</lint>
<build>not_available</build>
</validation_gates>

<verification>
- The test file passes in full; the rename guard and stack-neutrality guard pass.
- `rg -n "planningDir|configKey|blockTag" plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs` shows the tokens come
  from NAMES/LEGACY destructuring.
- `git diff --stat` for the GREEN commits touches only this TRD's files.
</verification>

<success_criteria>
- One module detects, refuses, moves and converts a pre-rename project; nothing it plans writes; every apply step is
  idempotent and resumable.
- The fleet shapes surveyed (nested trees, objectives-only trees, decoys, pre-v1 and versioned blocks, old/new/both
  stamps, ignore lines, info/exclude) each have a passing test.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-01-SUMMARY.md` (draft it with
`planning draft`, publish with `summary post`). Record the exported function signatures and the plan/record shapes
exactly as built: TRDs 80-02 and 80-03 consume them.
</output>
