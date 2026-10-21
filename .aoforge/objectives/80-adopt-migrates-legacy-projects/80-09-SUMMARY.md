---
objective: 80-adopt-migrates-legacy-projects
trd: "09"
subsystem: docs
tags: [adopt, legacy-migration, docs, changelog, migration-guide, full-suite, guards]

requires:
  - objective: 80-adopt-migrates-legacy-projects
    provides: "TRD 80-04 final legacy-layout message text; 80-03 migrate scaffold/report behaviour; 80-05 workflow and skill; 80-06 e2e matrix; 80-07 fleet-copy runs; 80-08 fresh/brownfield regression"
provides:
  - "The migration guide (repo and site copies) leads with /aoforge:adopt (Option A), keeps AOForge 3.0.x (now Option B) and the manual steps (now Option C), and quotes the current legacy-layout message, verified equal to legacyLayoutMessage('<root>')"
  - "USER-GUIDE routes a pre-rename project to the migrate path, lists the new refusals and the known limits, and names adopt wherever it tells a user how to move a project"
  - "CHANGELOG 3.1.0 describes objective 80 in one subsection; CLAUDE.md's adopt line says adopt also moves a pre-rename project"
  - "Two adopt-workflow wording fixes (migrate-only sentences scoped; the --raw-only output line named)"
  - "Full-suite evidence for the merged objective 80 tree: 12,748 tests, 0 failures"
affects: [release 3.1.0]

tech-stack:
  added: []
  patterns:
    - "Guide edits applied by one script to both guide copies, each replacement asserted to match exactly once per file"

key-files:
  created: []
  modified:
    - docs/MIGRATING-TO-AOFORGE.md
    - site/content/docs/getting-started/migrating-to-aoforge.md
    - docs/USER-GUIDE.md
    - CHANGELOG.md
    - CLAUDE.md
    - plugins/aoforge/aoforge/workflows/adopt.md
    - plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs
    - plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs

key-decisions:
  - "The legacy-adopt fixture's constant was renamed rather than the delegation guard loosened: repo-state-delegation test 9 forbids a declaration starting with the EXCLUDE token outside repo-state.cjs, and LEGACY_EXCLUDE_LINE says what the constant is"
  - "The workflow wording fix repeats 'On the migrate path' per sentence instead of capitalising 'Migrate path:', because adopt-skill-contract rows 15 and 16 match the lowercase phrase and 'Continue to `report`' literally"
  - "docs/AOF-TOOLS-REFERENCE.md still says 'convert with AOForge 3.0.x' for W066/W067/W069 and 0012-0014; it is outside this TRD's file list and is left as an open item"

requirements-completed: [SC-3, SC-5]

verification:
  gates_defined: 3
  gates_passed: 2
  auto_fix_cycles: 1
  tdd_evidence: false
  test_pairing: false

duration: 20min
completed: 2026-10-17
tokens_input: 15436130
tokens_output: 73486
tokens_cache_read: 15221375
tokens_cache_write: 214587
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 09: Docs describe adopt's migration; the whole tree passes Summary

**The migration guide, USER-GUIDE, CHANGELOG 3.1.0 and CLAUDE.md now describe `/aoforge:adopt` as the 3.1 way to move a pre-rename project (with its refusals and known limits), the guide quotes the current message verbatim, and the full suite (watcher-shell excluded) ends at 12,748 tests, 12,719 pass, 0 fail, 0 cancelled, 27 skipped, 2 todo after one objective-80 failure was fixed.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-17T08:01:32Z
- **Completed:** 2026-10-17T08:21Z
- **Tasks:** 3 of 3 (plus one optional workflow-wording commit and one test-fix commit)

## Progress
- [x] Task 1: Migration guide (repo and site) — e979ba99
- [x] Task 2: USER-GUIDE, CHANGELOG, CLAUDE.md — 1fbba797
- [x] Task 3: Full validation and SUMMARY — 6ec4d2f9 (the fix the first full run needed), this SUMMARY
- [x] Optional: adopt workflow wording fixes A and F1 — 74816738

## Accomplishments

- **Migration guide, both copies** (the site copy differs only by its front matter, so the same script edited both):
  - intro and the 2.x bullet name `/aoforge:adopt`; the statement "it no longer converts anything for you" became "it moves a project when you run `/aoforge:adopt` there; everything else it reports";
  - the quoted legacy-layout message is 80-04's text; a node check confirmed the whitespace-normalised quote equals `legacyLayoutMessage('<root>')` in both files; the sentence before it says the message names adopt first, and the paragraph after it says `aof-tools adopt` still runs in such a project (the guard exempts it);
  - "Upgrading from 2.x" is now Option A (adopt: what it moves and renames, the one commit, never pushed, planning content otherwise untouched, merge it yourself, `upgrade --check` next, `gh rebrand` not covered, the refusals, resume), Option B (AOForge 3.0.x once, the old A) and Option C (by hand, the old B); the install-level items (old runtime home, global CLAUDE.md block, old environment variables, old plugin) are said to be outside adopt and the once-per-machine list is labelled "after Option A or C";
  - the two internal "Option A" references (the 3.0.0 checklist intro, step 1) now say Option B;
  - the troubleshooting table: W066 (broken) names adopt first, W066 (both) says adopt refuses until you delete the old directory, W067 and W069 mention adopt.
- **USER-GUIDE**: the rename section (message names adopt first, the CLI guard exempts `adopt`, retired migration ids name adopt, doctor check 27 row, a pointer to the adopt section); the command table row and the usage block; the adopt section (new paragraph for a pre-rename project, the routing bullets, the new refusals `both-planning-dirs` and `legacy-block-malformed`, `move-failed` resume, and a "Known limits of the migrate path" list); the W066/W067/W069 section; the retired-migrations sentence; the "Coming from DevFlow 2.x" troubleshooting paragraph.
- **CHANGELOG** `## [3.1.0]` stays the single section: the intro now says a 2.x project moves with `/aoforge:adopt` (or through 3.0.x, or by hand), and `### Added: adopt migrates pre-rename projects (objective 80)` has six bullets (the migrate route, one commit and the report's Migration table, refusals and resume, the CLI guard, every message naming adopt, the proof) plus the known limits. `changelog check 3.1.0` exits 0.
- **CLAUDE.md**: the adopt line says adopt also moves a pre-rename project onto `.aoforge/` (objective 80) and the upgrade line says `--only 0012` names `/aoforge:adopt` too: 19,808 characters (was 19,722), 147 lines, within 20,000 and 200.
- **Workflow wording (optional, separate commit 74816738)**: (A) in `begin`, `scaffold` and `commit` the migrate-only sentences each say "On the migrate path" and the shared-command text is marked as "for the other routes"; (F1) `scaffold` says the JSON carries a `converted` count and only `--raw` prints `migrated: <n> converted`. `adopt-skill-contract` stays 19/19. `npm run docs:data` was not needed (no skill frontmatter changed) and no test requires it.

## Full suite

Method (79-08's): `git ls-files -co --exclude-standard -- 'plugins/aoforge/**/*.test.cjs' 'plugins/aoforge-stack-*/**/*.test.cjs' 'plugins/aoforge/**/*.test.js' 'scripts/**/*.test.cjs'` gives 409 files; `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` is excluded (its fish W-3 test hangs on this machine), leaving **408 files**; `env HOME=<S>/80-09/home TMPDIR=<S>/80-09/tmp xargs node --test < <S>/80-09/files.txt` from the repo root, `<S>` = the session scratchpad. Nothing was written under the real `~/.claude`.

| Run | Tests | Pass | Fail | Cancelled | Skipped | Todo | Duration |
|---|---|---|---|---|---|---|---|
| 1 (before the fix) | 12,748 | 12,718 | **1** | 0 | 27 | 2 | 97.9 s |
| 2 (after 6ec4d2f9) | 12,748 | 12,719 | **0** | 0 | 27 | 2 | 97.6 s |

The two todo rows are `adopt-migrate-e2e.legacy.test.cjs` 13 and 14 (80-06's known limitations D1 and D2). They are not failures.

### The one failure was objective 80's, and is fixed

`repo-state-delegation.test.cjs` test 9 ("EXCLUDE / EXTS set declarations live only in repo-state.cjs") failed with `actual: ['legacy-adopt-fixtures.cjs', 'repo-state.cjs']`. The 80-01 fixture declared `const EXCLUDE_LINE`, which contains the guard's needle. Fix: `EXCLUDE_LINE` became `LEGACY_EXCLUDE_LINE` in `__fixtures__/legacy-adopt-fixtures.cjs` and its one user in `legacy-migrate.legacy.test.cjs`. The failing test was the RED; after the rename it and the five objective-80 files (133 tests, 131 pass, 0 fail, 2 todo) passed, then the whole suite did (run 2).

## Named guards (each run alone, scratch HOME/TMPDIR)

| File | Tests | Pass | Fail | Todo |
|---|---|---|---|---|
| rename-guard.repo | 25 | 25 | 0 | 0 |
| stack-neutrality.repo | 7 | 7 | 0 | 0 |
| context-budget.repo | 6 | 6 | 0 | 0 |
| reconcile-guard.repo | 30 | 30 | 0 | 0 |
| doc-refs.repo | 17 | 17 | 0 | 0 |
| planning-writes.repo | 11 | 11 | 0 | 0 |
| hooks/planning-writes.audit.test.js | 65 | 65 | 0 | 0 |
| builtin-sweep.repo | 17 | 17 | 0 | 0 |
| prompt-raw-commit.repo | 7 | 7 | 0 | 0 |
| aoforge-workflows.repo | 19 | 19 | 0 | 0 |
| flag-spec.repo | 14 | 14 | 0 | 0 |
| adopt-skill-contract | 19 | 19 | 0 | 0 |
| legacy-migrate.legacy | 24 | 24 | 0 | 0 |
| adopt-migrate.legacy | 45 | 45 | 0 | 0 |
| adopt-migrate-report.legacy | 19 | 19 | 0 | 0 |
| adopt-migrate-e2e.legacy | 20 | 18 | 0 | 2 (D1, D2) |
| legacy-layout-adopt-path.legacy | 16 | 16 | 0 | 0 |
| adopt-e2e | 6 | 6 | 0 | 0 |
| repo-state-delegation | 9 | 9 | 0 | 0 |

Also: `aof-tools changelog check 3.1.0` exit 0; `aof-tools validate docs --raw` "no documentation advisories".

## Health and doctor on this repository

| Command | Result |
|---|---|
| `validate health --raw` | `status: healthy`, `errors: []`, `warnings: []`; info I001 x2 (79-09 and 79-10 have no SUMMARY: they are the release steps, not run) |
| `doctor --json --path <repo>` (scratch HOME, read-only) | `status: degraded`, 16 ok / 4 warn / **0 error** / 1 fixable. The warns are the same four as 79-08: `runtime-mirror`, `hooks-registry`, `model-profiles` (the scratch HOME has no installed plugin) and `legacy-runtime-state` (this machine's untracked runtime files; `doctor --fix` is the user's call) |

## Success criteria for objective 80

| SC | Claim | Evidence | Status |
|---|---|---|---|
| SC-1 | A `.planning/`-only repo is moved with `git mv`, stamp key and block markers renamed, nothing else written into planning content, one change on `aoforge/adopt`; `validate health` clean; every 3.1 tool works | 80-03 spawned-commit proof (one commit, R100 renames, `git log --follow` reaches first commit, no W066/W067/W069); 80-06 rows 3-7 and 12 (hand-migration equal health, every 3.1 tool); 80-07 aodex (3 roots, 1,169 files) and smartWellness (pre-v1 block, 106 files) real-layout copies, checker green; this run's suite: `adopt-migrate-report.legacy` 19/19, `adopt-migrate-e2e.legacy` 18 pass + 2 todo | met |
| SC-2 | Dirty tree, operation in progress, both directories stop with one message and nothing moves; re-run after success or a half-finished run is safe | 80-02 `adopt-migrate.legacy` 45/45 (refusals, resume of a recorded move); 80-06 rows 8-11 (re-run writes nothing, interrupted after begin/scaffold/report resumes to the same tree, `both` refuses); 80-07 re-run routes to `upgrade` with an empty snapshot compare. Open: D1 (untracked, ignored planning tree keeps routing to `resume` after the commit), the residue-before-marker-write gap, both described in USER-GUIDE and pinned/recorded | met, with two documented limits |
| SC-3 | The legacy-layout message (W066, CLI guard, SessionStart notice, doctor 27) names `/aoforge:adopt` | 80-04 `legacy-layout-adopt-path.legacy` 16/16 across all five surfaces plus W067, project W069 and `--only 0012-0014`; this TRD: the guide's quote equals `legacyLayoutMessage('<root>')` in both copies and its W066 row names adopt | met |
| SC-4 | Adopt runs end to end on a fresh, a brownfield and a legacy repo built from a real fleet layout, through the workflow, with a report listing the migration | 80-06 three-fixture e2e (`adopt-migrate-e2e.legacy`, `adopt-e2e`); 80-07 two real fleet-layout read-only copies followed through the skill text; 80-08 fresh and bare route to `new-project` unchanged, brownfield ends in one commit with the 13-check checker green; ADOPT-REPORT `## Migration` verified by checker `report_lists_migration` | met |
| SC-5 | Rename and stack-neutrality guards pass; legacy names confined to one detector/migrator on the ALLOW list; docs describe it; full suite passes | rename-guard 25/25, stack-neutrality 7/7 (table above); docs: this TRD's five files; full suite run 2: 12,748 tests, 0 fail, 0 cancelled (watcher-shell excluded, named) | met |

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Migration guide | `node --test rename-guard.repo.test.cjs doc-refs.repo.test.cjs` (scratch HOME/TMPDIR); `rg -n "aoforge:adopt"` on both guides; node check that the quote equals `legacyLayoutMessage('<root>')` | 0 | PASS (42/42; intro, message, Option A and the table rows present in both copies; quote equal in both) |
| 2: USER-GUIDE, CHANGELOG, CLAUDE.md | `aof-tools changelog check 3.1.0`; `node --test rename-guard doc-refs context-budget reconcile-guard` | 0 | PASS (exit 0; 78/78); `validate docs`: no advisories |
| 3: Full validation | `xargs node --test < files.txt` x2, 19 named guard files alone, `validate health --raw`, `doctor --json` | 0 | PASS (run 2: 0 fail, 0 cancelled; health healthy; doctor 0 errors) |
| Optional workflow wording | `node --test adopt-skill-contract context-budget rename-guard builtin-sweep planning-writes prompt-raw-commit aoforge-workflows` | 0 | PASS (104/104) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `env HOME=<S>/80-09/home TMPDIR=<S>/80-09/tmp xargs node --test < <S>/80-09/files.txt` (408 files, watcher-shell.test.cjs excluded) | 0 | PASS (12,748 tests, 12,719 pass, 0 fail, 0 cancelled, 27 skipped, 2 todo) |
| lint | not defined | - | not_available |
| build | `npm run docs:data` is not needed (no skill frontmatter changed) | - | not_available |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] repo-state-delegation test 9 failed on an objective-80 fixture**
- **Found during:** Task 3 (first full-suite run)
- **Issue:** `__fixtures__/legacy-adopt-fixtures.cjs` (80-01) declared `const EXCLUDE_LINE`, which the delegation guard's needle (`const EXCLUDE`) forbids outside `repo-state.cjs`. Neither 80-01 nor the later waves ran the full suite, so the guard first saw the fixture here.
- **Fix:** renamed the constant to `LEGACY_EXCLUDE_LINE` (fixture, export and its one user).
- **Files modified:** plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs, plugins/aoforge/aoforge/bin/lib/legacy-migrate.legacy.test.cjs
- **Commit:** 6ec4d2f9

### Other

- **Edits made with Python scripts** (one per file group, each replacement asserted to match exactly once) rather than the Edit tool, so both guide copies receive byte-identical edits. Scripts are in the scratchpad, not the repository.
- **Workflow wording uses "On the migrate path" in each sentence, not the TRD's suggested "Migrate path:" prefix**, because `adopt-skill-contract` rows 15 and 16 match the lowercase phrase and a literal `Continue to \`report\``. First attempt wrapped that phrase over two lines and failed row 15; rewrapped.
- **`doctor` ran with `--json --path <repo>` and a scratch HOME** (79-08's method) instead of `doctor --raw`: `--raw` is the text report, and the scratch HOME keeps the real `~/.claude` out of it.
- **The CHANGELOG intro's last sentence** ("objectives 73 to 78 and quick 34 to 39") was left alone; only the 2.x phrase changed.

## Open items

- `docs/AOF-TOOLS-REFERENCE.md` (lines 16, 23, 30) still says W066/W067/W069 and migrations 0012-0014 convert "with AOForge 3.0.x" and never mentions adopt. It is not in this TRD's file list; a one-line addition per place would align it.
- D1 (untracked, ignored planning tree routes to `resume` after the commit), D2 (migration 0005 may need a second `upgrade --apply`) and the residue-before-marker-write gap are described in USER-GUIDE and the CHANGELOG, and D1/D2 stay pinned as todo rows 13 and 14. A fleet repo whose `.gitignore` ignores `.planning/` would hit D1 (80-07).
- Advisory B (80-08): the adopt marker stays `in_progress` after the commit; harmless because the project state `aoforge` wins and the route is `upgrade`.
- 80-07 findings F2 (the checker's `stamp_current` detail is a fixed template) and F3 (`adopt begin` still returns a stale `next`) are unchanged wording nits.
- `watcher-shell.test.cjs` was excluded from every run (fish W-3 hang); it was not run at all in this TRD.

## Post-TRD Verification

- Auto-fix cycles used: 1 (the fixture constant)
- Must-haves verified: 5/5 (guide leads with adopt, says what it changes and refuses, quotes the current message; USER-GUIDE routes to migrate and names adopt wherever it tells a user to move a project; CHANGELOG has one `[3.1.0]` and `changelog check` passes; CLAUDE.md 19,808 chars / 147 lines; full suite and the named guards pass, health healthy, doctor 0 errors)
- Gate failures: the first full run's one failure, fixed in 6ec4d2f9 and re-run green

## Self-Check: PASSED

- FOUND: docs/MIGRATING-TO-AOFORGE.md, site/content/docs/getting-started/migrating-to-aoforge.md, docs/USER-GUIDE.md, CHANGELOG.md, CLAUDE.md, plugins/aoforge/aoforge/workflows/adopt.md
- FOUND: commits e979ba99, 1fbba797, 74816738, 6ec4d2f9 in `git log`
- `git status --short` shows only the untracked `amp`, which was never touched
