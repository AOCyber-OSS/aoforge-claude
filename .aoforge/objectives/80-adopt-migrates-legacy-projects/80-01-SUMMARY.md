---
objective: 80-adopt-migrates-legacy-projects
trd: "01"
subsystem: adopt
tags: [adopt, legacy-migration, rename, git-mv, claude-md, config-stamp]

requires: []
provides:
  - "lib/legacy-migrate.cjs: planMigration, refusalFor, moveTrees, movesDone, convertResidue, ownsMigratePath, renameStampKeyText, rewriteBlockText, rewriteIgnoreText, addExcludeCounterparts, renderMigrationSection"
  - "__fixtures__/legacy-adopt-fixtures.cjs: legacyFleetRepo + FLEET_STATES (hand-built fleet-shaped pre-rename repositories in every state adopt must handle)"
  - "a rename-guard ALLOW entry for lib/legacy-migrate.cjs"
affects: [80-02, 80-03, 80-06, 80-07]

tech-stack:
  added: []
  patterns:
    - "plan (read-only) -> moveTrees -> convertResidue, each idempotent; the plan carries post-move paths"
    - "stamp key renamed by token substitution, accepted only when the candidate parses to the 0013 result"
    - "CLAUDE.md block rewritten over the START..END region only, then proven with managed-block.read"

key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs
    - plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs
    - plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs
  modified:
    - plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs
    - plugins/aoforge/aoforge/bin/lib/legacy-names.cjs
    - plugins/aoforge/aoforge/bin/lib/legacy-rewrite.cjs

key-decisions:
  - "No migration id is registered: the module reuses the logic of the deleted 0012/0013/0014 without resurrecting them"
  - "Skipped parents are split: node_modules, build output, dot-directories and nested repositories are never entered; vendor/ and third_party/ are walked only to report a legacy-named directory as skipped"
  - "The info/exclude counterpart renames the directory segment only (0012's rule), so it does not map the notices file name"

requirements-completed: [SC-1, SC-2, SC-5]

verification:
  gates_defined: 3
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 15min
completed: 2026-10-17
tokens_input: 13332171
tokens_output: 141971
tokens_cache_read: 13028037
tokens_cache_write: 304014
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 01: Legacy migrator module Summary

**`lib/legacy-migrate.cjs` finds every pre-rename planning tree in a repository (root and nested), moves it with `git mv` (history kept), renames the `devflow{}` stamp key in place, renames a CLAUDE.md block's markers and names, and carries ignore lines across, all idempotent and never committing, with 24 passing tests over hand-built fleet-shaped fixtures.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-17T06:54:29Z
- **Completed:** 2026-10-17T07:09:24Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (3 created, 3 modified, 1 SUMMARY)

## Progress
- [x] Task 1: Fixture builder and the RED test list — aa4ee790
- [x] Task 2: Discovery, refusal and the move — 3cfafb9f
- [x] Task 3: Residue converters, rendering, ALLOW entry — 8ced683f

## Accomplishments

- One module detects, refuses, moves and converts a pre-rename project. `planMigration` is read-only (a snapshot test proves it writes nothing); `moveTrees` and `convertResidue` are idempotent and resumable.
- Every surveyed fleet shape has a passing test: nested trees, an objectives-only tree, a project with no root tree, a root `.aoforge/` beside nested legacy trees, vendored/unrelated/symlinked/nested-repository decoys, pre-v1 and versioned blocks, old/new/both stamps, ignore lines in root and nested `.gitignore` and in `.git/info/exclude`.
- Both planning directories at one root (or one nested dir) and a malformed pre-rename block (no END, two blocks, a pre-rename block beside an AOFORGE block) are refusals that name the path and the fix.
- A hand-migrated copy of the 2.x fixture reports no `validate health` error (checked once; TRD 80-06 compares an adopt-migrated copy with it).

## Interfaces (as built; TRDs 80-02 and 80-03 consume these)

All paths are posix and relative to `root`. `dir` is the component directory (`''` is the root). `env` defaults to `process.env` (git redirect variables are removed either way). Nothing here commits.

```
planMigration(root, { env }) -> {
  root, applies, roots: ['', 'api', ...],              // roots sorted, '' first; conflicted dirs excluded
  moves:     [{ dir, from, to, tracked, files }],      // files = tracked count when tracked, else files on disk
  conflicts: [{ dir, message, fix }],                  // both directories at dir; no move planned there
  skipped:   [{ path, dir, reason }],                  // 'symlink' | 'no planning files' | 'inside vendor/' (or third_party/)
  stamps:    [{ file, action: 'rename'|'merge'|null, error? }],   // file = post-move path; null+error = invalid JSON
  blocks:    [{ file, markers: 'pre-v1'|'versioned' }],
  malformed: [{ file, message, fix }],
  ignores:   [{ file, changes: [{ line, action: 'rewrite'|'drop', from, to }] }],   // line is 1-based; to is null for drop
  exclude:   { file, added: [lines] } }                // file null outside git; added = counterparts to append
refusalFor(plan) -> null | { reason: 'both-planning-dirs' | 'legacy-block-malformed', message, next }
moveTrees(root, moves, { env }) -> [{ dir, from, to, tracked, files, via, left? }]
        // via: 'git mv' | 'rename' | 'done' | 'leftovers'; left (leftovers only): same-named files that stayed in the source
movesDone(root, moves) -> boolean                      // every `to` is a directory and no `from` remains
convertResidue(root, { env, roots }) -> { stamps, blocks, malformed, ignores, exclude }   // same shapes as the plan; what it changed
ownsMigratePath(rel) -> boolean                        // a segment .aoforge/.planning, or basename .gitignore / CLAUDE.md
renameStampKeyText(text) -> { text, action: 'rename'|'merge'|null, error? }
rewriteBlockText(text) -> null | { text, markers, lines }   // throws Error{code:'ELEGACYMALFORMED', fix} when it cannot convert
rewriteIgnoreText(text) -> { text, changes }
addExcludeCounterparts(text) -> { text, added }
renderMigrationSection(record) -> '## Migration' markdown; record = { moves, stamps, blocks, ignores, exclude, skipped } (all optional)
```

Behaviour worth knowing when wiring adopt:

- `moveTrees` takes the moves from a plan (or the plan stored in the begin marker). A re-plan after a partial move reports `both-planning-dirs` (the target exists), so resume with the stored moves, not a fresh plan.
- Right after `moveTrees` the ignored runtime marker (`.aoforge/.skill-active`) shows as `??` in `git status` until `convertResidue` rewrites `**/.planning/.skill-active`. Run both before judging the tree clean.
- A same-named file in a half-moved source is never overwritten or deleted: `via: 'leftovers'` with `left` listing it, and `movesDone` stays false.
- `convertResidue` leaves an invalid `config.json` and a malformed block untouched and reports them (`error`, `malformed`), so a re-run reports them again.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Fixture builder and the RED test list | `node -e "require('./plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs').legacyFleetRepo({nested:true,decoys:true}).cleanup()"`; `node --test .../legacy-migrate.legacy.test.cjs` (24 fail on the missing module: 23 `Cannot find module`, 1 missing ALLOW entry) | 0 / 1 | PASS (RED correct) |
| 2: Discovery, refusal and the move | `node --test --test-name-pattern='^(1\|2\|...\|11\|22)\.' .../legacy-migrate.legacy.test.cjs` | 0 | PASS (12/12) |
| 3: Residue converters, rendering, ALLOW | `node --test` over legacy-migrate, rename-guard, stack-neutrality, legacy-names, legacy-rewrite, managed-block tests | 0 | PASS (82/82) |

## Task Commits

1. **Task 1: fixtures and RED test list** - `aa4ee790` (test)
2. **Task 2: discovery, refusal and move** - `3cfafb9f` (feat)
3. **Task 3: residue converters, migration table, ALLOW entry** - `8ced683f` (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `TMPDIR=<S>/80-01/tmp HOME=<S>/80-01/home node --test legacy-migrate.legacy.test.cjs rename-guard.repo.test.cjs stack-neutrality.repo.test.cjs` | 0 | PASS (24 + guards) |
| test (wider) | `node --test plugins/aoforge/aoforge/bin/lib/*.repo.test.cjs` | 0 | PASS (307/307) |
| lint | not_available | - | not_available |
| build | not_available | - | not_available |

The full suite was not run (the TRD does not ask for it); `watcher-shell.test.cjs` was therefore never in play.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test .../legacy-migrate.legacy.test.cjs` | 1 | FAIL (correct): 24 of 24 failed, 23 on the missing module |
| GREEN (task 2) | same, rows 1-11 and 22 | 0 | PASS (correct) |
| GREEN (task 3) | same, all 24 | 0 | PASS (correct) |

## Deviations from Plan

1. **[Rule 1 - Bug in my own test] Test 10 depended on `convertResidue`.** Written in the RED commit, it called the plan-move-convert helper, so it could not pass in Task 2. Rewritten in the Task 2 commit to plan and move only (a second `moveTrees` is what row 10 is about).
2. **Test 8 asserts one `??` entry.** The TRD says `git status --porcelain` "shows only `R` entries"; git also reports the moved `.aoforge/.skill-active` as untracked, because the legacy ignore line `**/.planning/.skill-active` no longer covers its new path until `convertResidue` rewrites it (test 16 proves it is ignored afterwards). The test asserts exactly that one extra entry.
3. **Additions beyond the TRD's option list (fixture only).** `blank: true` (a repository with no legacy anything, for row 7) and `claudeMd: 'mixed'` (a pre-rename block beside an AOFORGE block, row 5). The result objects also carry `malformed` (convertResidue) and `left` (moveTrees); the TRD named neither.
4. **`legacy-names.cjs` header already listed the converter** ("gh-rebrand and legacy-rewrite"); the edit extends that line with `legacy-migrate` rather than adding a bullet.

## Known limitations

- The `.git/info/exclude` counterpart renames the directory segment only (0012's rule), so `.planning/.<old>-notices.json` gains `.aoforge/.<old>-notices.json`, not the new notices file name. The 3.1 upgrade hook manages its own exclusion for `.aoforge/.aoforge-notices.json`, so nothing is left uncovered; the extra line is inert.
- `planMigration` does not check for a dirty tree or a git operation in progress; that is adopt's preflight (TRD 80-02).
- `files` for a tracked tree counts tracked files only (an ignored `.skill-active` is not counted).

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 (discovery and decoys: tests 1-3; `git mv` with history, untracked rename, idempotence: 8-10; stamp, block, ignore conversion and idempotence: 12-17; refusals: 4-5; rename guard ALLOW: 24 plus the guard itself)
- Gate failures: None

## Self-Check: PASSED

- Created files exist: `legacy-migrate.cjs`, `legacy-migrate.legacy.test.cjs`, `__fixtures__/legacy-adopt-fixtures.cjs` (found).
- Commits exist: `aa4ee790`, `3cfafb9f`, `8ced683f` (found in `git log`).
- `git diff --stat ff0820e5..HEAD` touches only this TRD's files plus the SUMMARY.
