---
objective: 80-adopt-migrates-legacy-projects
trd: "03"
subsystem: adopt
tags: [adopt, legacy-migration, scaffold, report, commit-files, git-mv]

requires:
  - objective: 80-adopt-migrates-legacy-projects
    provides: "TRD 80-01 lib/legacy-migrate.cjs (convertResidue, renderMigrationSection, ownsMigratePath) and the legacy fleet fixtures; TRD 80-02 migrate marker, preflight/begin"
provides:
  - "adopt scaffold on a migrate resume: backup per planning root, convertResidue (stamp key, CLAUDE.md block markers, ignore lines), cumulative marker.migration record, nothing else written"
  - "adopt report on a migrate resume: ADOPT-REPORT.md with Migration / Needs review / What adopt did / Next steps (and Previous adopt report), plus compact commit_files, commit_message and commit_blocked"
  - "a spawned `aof-tools commit` over commit_files records the whole migration as one clean change with 100% renames"
affects: [80-05, 80-06, 80-07]

tech-stack:
  added: []
  patterns:
    - "a directory entry per tracked moved tree (old and new name) in --files; git overlays HEAD on the pathspec, so the deletions and additions land in one pathspec commit"
    - "runtime files inside a moved tree go to the local .git/info/exclude before commit_files is computed, and are named in the report"
    - "the migration record is cumulative and merge-only: a later run adds only what it newly converted, current problems replace old ones"

key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs
  modified:
    - plugins/aoforge/aoforge/bin/lib/adopt.cjs
    - plugins/aoforge/aoforge/bin/lib/adopt-cli.cjs

key-decisions:
  - "commit_files is still returned when commit_blocked is set: an empty list would make `aof-tools commit` default to the planning directory (a partial commit), so the caller must stop on commit_blocked instead"
  - "legacy codes are read from validate health per root and also from the in-process detectors (a union), so a root where health could not run, and the CLAUDE.md of a nested-only repository, are still checked"
  - "the previous ADOPT-REPORT.md comes from HEAD (at the pre-move path), falling back to an on-disk file this adopt did not write, cached once in the record, so a re-run renders the same bytes"
  - "the commit-docs-false block is decided before the report is written (tracked move, or a report path that is a non-ignored root planning path), because the report text carries the block row"

patterns-established:
  - "scaffold/report return `mode: 'migrate'`; fresh adopt results carry no `mode`"

requirements-completed: [SC-1, SC-2, SC-4]

verification:
  gates_defined: 3
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 14min
completed: 2026-10-17
tokens_input: 13227470
tokens_output: 109192
tokens_cache_read: 12960169
tokens_cache_write: 267175
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 03: Migrate scaffold and report, and the one recorded change Summary

**`adopt scaffold` now converts a migrated project's stamp key, CLAUDE.md block markers and ignore lines (after a backup per planning root, writing nothing else), and `adopt report` writes an ADOPT-REPORT.md with the migration table, per-root health and pending upgrades and returns a compact `commit_files` (nine entries for the full fleet shape); a spawned `aof-tools commit` over them records exactly one clean change with 100% renames and a followable history.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-17T07:21:05Z
- **Completed:** 2026-10-17T07:35:00Z
- **Tasks:** 3 of 3
- **Files modified:** 3 (1 created, 2 modified, plus this SUMMARY)

## Progress
- [x] Task 1: RED tests for migrate scaffold/report/commit — be8baf70
- [x] Task 2: Migrate scaffold — 69b38ef1
- [x] Task 3: Migrate report and compact commit files — 06ed5fd6

## Accomplishments

- The migrate route's deterministic half is complete: preflight, begin (80-02), scaffold and report (this TRD) take a pre-rename repository (fleet-shaped fixtures: root, nested, residue-only, untracked-tree, carried report, `commit_docs: false`) to a state where one `aof-tools commit "<commit_message>" --files <commit_files>` produces the single migration commit.
- Spawned-commit proof (test 1): one new commit on `aoforge/adopt` above the base, clean tree, every moved file `R100` except the two `config.json` files (a D/A pair at 100%, `R0NN` at the default threshold, one changed line each) and the new report (`A`); `.gitignore`, `api/.gitignore` and `CLAUDE.md` are `M`; `git log --follow -- .aoforge/ROADMAP.md` reaches the fixture's first commit. Afterwards `validate health` at the root and at `api/` reports none of W066/W067/W069 and `adopt preflight` routes to `upgrade`.
- `commit_files` for the full fleet shape is nine entries (six tree directories, two `.gitignore`, `CLAUDE.md`), never a path under a moved tree.
- Scaffold and report are idempotent and resumable: a second scaffold converts nothing, keeps the record and takes no second backup; a second report writes identical bytes and an identical list.

## Scaffold / report JSON for the migrate route (TRDs 80-05 and 80-06 rely on these)

Both are returned by `adopt scaffold` / `adopt report` (default output is JSON; `--raw` prints the one line below). Exit 0; exit 1 with `Error: run adopt begin first: the move is not finished` (scaffold, move not done) or `Error: run adopt scaffold first` (report, scaffold not done); exit 3 with a route/reason when the preflight route is not `resume`.

`adopt scaffold` (`--raw`: `migrated: <converted> converted`):

```
{ route: 'scaffold', mode: 'migrate', target,
  converted: <n>,          // this run only: stamps renamed or merged + blocks + ignore changes (exclude lines not counted)
  changes: { stamps, blocks, malformed, ignores, exclude },   // this run's convertResidue result (80-01 shapes)
  migration: {             // cumulative, kept in marker.migration
    moves:   [{ dir, from, to, tracked, files, via: 'git mv'|'rename' }],
    stamps:  [{ file, action: 'rename'|'merge' }, { file, action: null, error }],
    blocks:  [{ file, markers: 'pre-v1'|'versioned' }],
    malformed: [], ignores: [{ file, changes: [{ line, action, from, to }] }],
    exclude: { file: '.git/info/exclude', added: [lines] },
    skipped: [{ path, dir, reason }],
    backups: ['<home>/.claude/aoforge/backups/<repo-key>/<ts>', ...],   // one per planning root, taken only when something converts
    registry_key },
  marker }                 // marker.steps = { scaffolded: true }, marker.migration as above
```

`adopt report` (`--raw`: `report: <n> to review` plus `; commit blocked: <reason>` when blocked):

```
{ route: 'report', mode: 'migrate', target,
  report_path: '.aoforge/ADOPT-REPORT.md',          // the marker's report_path (first planning root; api/.aoforge/... for a nested-only repo)
  needs_review: [{ confidence: 'priority'|'low', item, inferred, evidence }],
  migration,                                          // the record above, plus any transient lines added to exclude.added
  legacy_codes: [{ root: '' | 'api', code: 'W066'|'W067'|'W069' }],     // empty when clean
  pending_upgrades: [{ root, pending: ['0001', ...], pending_confirm: [] }],
  commit_files: ['.aoforge', '.gitignore', '.planning', 'CLAUDE.md', 'api/.aoforge', 'api/.gitignore', 'api/.planning', 'web/.aoforge', 'web/.planning'],
  commit_message: 'chore(aoforge): adopt — move the pre-rename planning layout (AOForge v<version>)',
  commit_blocked: null | { reason: 'legacy-layout-remains'|'commit-docs-false', message, fix },
  marker }                                            // marker.steps = { scaffolded: true, reported: true }
```

The caller commits with `node aof-tools.cjs commit "<commit_message>" --files <commit_files...>` and must not commit while `commit_blocked` is set (it still returns `commit_files` for display; an empty list would make `aof-tools commit` fall back to the whole planning directory). `commit_files` is empty-of-directories for an untracked tree (only `.gitignore`/`CLAUDE.md`), and lists changed planning files by name when nothing moved (residue-only: `.aoforge/ADOPT-REPORT.md`, `.aoforge/config.json`, `CLAUDE.md`, `.gitignore`).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: RED tests | `node --test adopt-migrate-report.legacy.test.cjs` (TMPDIR/HOME in the scratchpad) | 1 | PASS (RED: 18 of 18 failed on the fresh-path validation the migrate marker hits: `.aoforge/PROJECT.md is missing` / the pre-rename CLAUDE.md block refusal; no fixture errors) |
| 2: Migrate scaffold | `node --test --test-name-pattern="^(6\. scaffold\|13\|15)" adopt-migrate-report.legacy.test.cjs` + `adopt-scaffold`, `adopt-migrate.legacy`, `rename-guard.repo`, `adopt-preflight` | 0 | PASS (3 new; 126/126 regression) |
| 3: Migrate report | `node --test adopt-migrate-report.legacy adopt-migrate.legacy adopt-scaffold adopt-report adopt-e2e rename-guard.repo` | 0 | PASS (133/133; the new file 19/19) |

## Task Commits

1. **Task 1: RED tests** - `be8baf70` (test)
2. **Task 2: migrate scaffold** - `69b38ef1` (feat)
3. **Task 3: migrate report and compact commit files** - `06ed5fd6` (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `TMPDIR=<S>/80-03/tmp HOME=<S>/80-03/home node --test adopt-migrate-report.legacy.test.cjs adopt-report.test.cjs adopt-scaffold.test.cjs` | 0 | PASS |
| test (wider) | `node --test adopt-*.test.cjs *.legacy.test.cjs *.repo.test.cjs` (in lib/) | 0 | PASS (835/835) |
| lint | not_available | - | not_available |
| build | not_available | - | not_available |

The full suite was not run (the TRD does not ask for it), so `watcher-shell.test.cjs` was never in play.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test adopt-migrate-report.legacy.test.cjs` | 1 | FAIL (correct): 18/18 fail on the missing migrate scaffold/report |
| GREEN (task 2) | same, tests 6 (scaffold), 13, 15 | 0 | PASS (correct) |
| GREEN (task 3) | same, all 19 | 0 | PASS (correct) |

## Deviations from Plan

1. **[Rule 1 - TRD list inaccurate] Row 10 also lists `.gitignore`.** The residue-only fixture's root `.gitignore` carries pre-rename ignore lines, which `convertResidue` rewrites, so `commit_files` is `.aoforge/ADOPT-REPORT.md`, `.aoforge/config.json`, `.gitignore`, `CLAUDE.md`; the commit and the health check pass with it. The test asserts the four.
2. **Row 6 became two tests** ("6. scaffold is idempotent" / "6. report is idempotent") so each task verifies its own half.
3. **Three tests beyond the 15 rows:** 16 (a legacy code left after scaffold sets `commit_blocked: legacy-layout-remains`), 17 (an invalid config.json is left alone, named in a priority row, not blocking), 18 (nested-only repo: report in the first root, no root `.aoforge/`). Row 15 is a run of the three existing adopt test files, not a test.
4. **Scaffold result fields beyond the TRD text:** `converted` (this run's count, what the CLI prints), `changes` (this run's convertResidue result) and `migration` (cumulative). The CLI count is per run, so the second scaffold prints `migrated: 0 converted`.
5. **`commit_files` is returned even when `commit_blocked` is set** (see key-decisions); the TRD says only that a block is set instead of a partial commit.

## Known limitations

- **Untracked planning tree:** the report is written into an ignored directory and is never in HEAD, so after the commit `adopt preflight` still reads the marker as unfinished and routes to `resume` ("ready to commit"). The migrate marker's `finished` signal (80-02) is the report in HEAD; TRD 80-05's workflow must treat a successful commit as the end for this shape, or a finished signal must be added for it.
- **Crash window:** a stop after `convertResidue` wrote its files and before the marker write loses the stamp/block/ignore rows from the migration record (the files are converted, the diff shows them); a re-run converts nothing and does not rebuild them.
- `upgrade.backup` copies the planning directory and CLAUDE.md only; `.gitignore` files are not in it (git holds their originals).
- The report names the backup directories by absolute path (the fresh adopt report does the same for its pre-apply backup).
- `validate health` is spawned once per planning root on every report run.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 (scaffold converts and writes nothing else: tests 6, 15; report content and compact files: 2, 4, 8, 10; one commit, R100 renames, clean tree, history: 1, 3; health clean and preflight leaves: 5; commit_blocked: 9, 16)
- Gate failures: None

## Self-Check: PASSED

- FOUND: plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs, adopt.cjs, adopt-cli.cjs
- FOUND: commits be8baf70, 69b38ef1, 06ed5fd6 in `git log`
- `git diff 6c03a2bc..HEAD --stat` touches only this TRD's three files plus the SUMMARY
