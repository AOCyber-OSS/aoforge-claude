---
objective: 80-adopt-migrates-legacy-projects
trd: "06"
subsystem: adopt
tags: [adopt, legacy-migration, e2e, checker, resume, idempotency]

requires:
  - objective: 80-adopt-migrates-legacy-projects
    provides: "TRD 80-01 legacy-migrate and legacy fleet fixtures; 80-02 preflight/begin migrate route; 80-03 scaffold/report migrate and the one recorded commit"
provides:
  - "adopt-e2e-assert.cjs `check --mode migrate` (library: runChecks({mode})): eight structural checks for a migrated project"
  - "adopt-migrate-e2e.legacy.test.cjs: the three-fixture end-to-end proof (fresh, brownfield, pre-rename), the hand-migration equivalence, the re-run and resume matrix, and the every-3.1-tool probe"
affects: [80-07, 80-08, 80-09]

tech-stack:
  added: []
  patterns:
    - "the workflow sequence is driven through the CLI (one spawn per step) and the end state is judged by the checker, not by the module under test"
    - "the checker finds leftovers through legacy-migrate's plan and planning-layout's finding codes and reads the stamp keys from legacy-names: no pre-rename spelling in the file"
    - "a defect found by the matrix is pinned as a node:test `todo` row (it runs, shows in the output, does not fail the suite)"

key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs
  modified:
    - plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs

key-decisions:
  - "Migrate mode keeps the eight checks the TRD names and nothing else: health, stack, secrets and commit-contents are asserted by the e2e rows (health in row 6 and 12, owned paths in row 3), not by the checker"
  - "stamp_current in migrate mode fails on any root config that still has the old key, and on a converted config (the migration record names it) that lacks the new key; a config with neither key is unstamped, not a leftover (the next upgrade stamps it)"
  - "history_kept reads the marker's recorded moves: for every tracked tree it follows one renamed file through `git log --follow` and wants more than the adopt commit; an untracked tree has no history and passes"
  - "A product defect found in adopt.cjs (80-03's known limitation) is pinned as a todo row, not fixed: the TRD owns no adopt.cjs"

requirements-completed: [SC-1, SC-2, SC-4]

verification:
  gates_defined: 3
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 13min
completed: 2026-10-17
tokens_input: 11209521
tokens_output: 85414
tokens_cache_read: 10997242
tokens_cache_write: 212153
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 06: Adopt end to end on a fresh, a brownfield and a pre-rename fixture Summary

**The adopt workflow's exact command sequence is proved in the suite on a fresh repo (routes to new-project, changes nothing), a brownfield repo (the full pipeline, one commit, checker green) and a fleet-shaped pre-rename repo (migrate path, one commit, eight migrate checks green); the migrated repo's health matches a hand migration, re-runs write nothing, an adopt interrupted after begin, scaffold or report resumes to the same tree, and every 3.1 tool works on the result. 14 e2e tests and 4 checker negatives pass; two defects found are pinned as todo rows.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-17T07:36:44Z
- **Completed:** 2026-10-17T07:50:00Z
- **Tasks:** 2 of 2
- **Files modified:** 2 (1 created, 1 modified, plus this SUMMARY)

## Progress
- [x] Task 1: Checker migrate mode (RED then GREEN) — 44a74cec (RED), bacaf4a1 (GREEN)
- [x] Task 2: The rest of the matrix GREEN — 6ff34ebe

## Accomplishments

- `adopt-e2e-assert.cjs` has a migrate mode. `check <root> --home <home> --mode migrate` runs the shared four checks (`on_adopt_branch`, `one_commit`, `tree_clean`, `not_pushed`) and four of its own. The default `adopt` mode and its thirteen check ids are unchanged (adopt-e2e.test.cjs passes untouched). An unknown `--mode` prints usage and exits 1.
- The e2e file drives the CLI, never the module in-process: `runSeq(repo, { stopAfter })` is the workflow's migrate sequence (`adopt preflight` -> `begin` -> `scaffold` -> `report` -> `aof-tools commit "<commit_message>" --files <commit_files>`), `runBrownfield` is the scripted brownfield pipeline, and `handMigrate` performs the guide's Option B with git and fs.
- Every row builds its own fixture (the fake HOME comes with it); the whole file runs in about 45 s with the two guards.

## Migrate check ids (`check --mode migrate`, in order)

| Id | Passes when |
|---|---|
| `on_adopt_branch` | HEAD is `aoforge/adopt` |
| `one_commit` | exactly one commit between the marker's `base_sha` and the branch |
| `tree_clean` | `git status --porcelain` is empty |
| `not_pushed` | the branch has no upstream and no remote branch contains HEAD |
| `no_legacy_layout` | `planMigration(root).applies` is false and `refusalFor` is null, and `validate health` at every planning root (`plan.roots`) reports none of `planning-layout` `CODE` / `CONFIG_CODE` / `CLAUDE_MD_CODE` (W066/W067/W069) |
| `history_kept` | for every tree the marker recorded as moved and tracked, a renamed file under its new path has more than one commit in `git log --follow` |
| `report_lists_migration` | the report at `marker.report_path` has a `## Migration` section naming every moved tree's new path |
| `stamp_current` | no planning root's `config.json` keeps the old stamp key, and a config the migration converted has the new key |

## Row results

| Row | What it proves | Result |
|---|---|---|
| 1 | `empty` fixture and a `git init`-only directory: preflight and begin return `new-project` (exit 0), no branch, no marker, snapshot and HEAD unchanged; `runSeq` stops at the preflight | pass |
| 2 | `node-cli` through the scripted brownfield pipeline: default-mode checker exit 0 with every check ok; `adopt.mode` is `adopt` at preflight and begin, scaffold/report carry no `mode`; a later preflight is `upgrade` and writes nothing | pass |
| 3 | 2.x fleet shape (nested + decoys): sequence, then the eight migrate checks all ok; every changed path is a migration path (`ownsMigratePath`); history, key rename and report rows spot-checked outside the checker | pass |
| 4 | 3.0-era fixture: checker green; Migration table holds 3 `Planning tree` rows and only ignore/exclude rows besides (no stamp, no block row); `CLAUDE.md` not in the change | pass |
| 5 | nested-only: report at `api/.aoforge/ADOPT-REPORT.md`, no root `.aoforge/` on disk or in HEAD, checker green | pass |
| 6 | adopt copy vs hand-migrated copy: `validate health` finding codes equal at the root and at `api/`; no error at either root | pass |
| 7 | every moved file hashes the same before and after except each `config.json` (one line changed) and the new report; nothing lost | pass |
| 8 | after success: preflight and begin return `upgrade`; checker `snapshot`/`compare`, fixture snapshot, HEAD and marker unchanged | pass |
| 9 | nested-only after success: preflight and begin refuse `adopt-branch-exists` (exit 3), nothing written | pass |
| 10 (x3) | interrupted after begin / scaffold / report: the next run's preflight is `resume` with `adopt.mode: migrate` and the matching `steps`; it ends with the same `git diff --name-status`, health codes and planning-file hashes as the uninterrupted run, and the checker is green | pass |
| 11 | `both` fixture: preflight refuses `both-planning-dirs` (exit 3), the sequence stops before begin, snapshot unchanged, no branch | pass |
| 12 | `state load`, `roadmap analyze`, `validate health` (exit 0, no layout code or "legacy" message, no error), `doctor --json` check `legacy-planning-layout` ok, `upgrade --check` (pending), `upgrade --apply` committed through `aof-tools commit` leaves a clean tree, `init plan-objective 1` last | pass |
| 13 | untracked planning tree after success: preflight should route to `upgrade` | **todo (defect, below)** |
| 14 | one `upgrade --apply` should leave `upgrade --check` up to date | **todo (defect, below)** |
| N1-N4 | checker negatives: recreated legacy tree -> `no_legacy_layout`; second commit -> `one_commit`; old key back -> `stamp_current`; unknown `--mode` -> usage, exit 1 | pass |

## Defects found (reported, not fixed)

1. **`adopt preflight` routes to `resume` after a finished adopt on an untracked planning tree** (adopt.cjs, 80-03's known limitation, reproduced). With `.planning/` ignored the report is written into an ignored tree and is never in HEAD, so the migrate marker's `finished` signal ("report in HEAD") never fires; after the commit, `preflight` and `begin` both return `resume` ("all steps done, ready to commit"). The workflow (80-05) must treat a successful commit as the end for this shape, or `finished` needs a second signal (for example the commit being the marker branch's tip above `base_sha`). Pinned: row 13. TRD 80-06 owns no adopt.cjs, so the test is `todo`.
2. **Migration 0005 needs two `upgrade --apply` passes for a pre-v1-form block under the AOFORGE markers** (not adopt's; reproduced on a project with no migration at all). The first apply reports `0005 {from: legacy, to: v=2}` and `upgrade --check` still lists 0005 ("# Development Rules section differs from the template (drift)"); the second apply (`v=2 -> v=2`) converges. Every adopt-migrated 2.x project has such a block, so the user's first `upgrade --apply` after adopt leaves W040 once more. Row 12 asserts only what the TRD asks (the first apply commits cleanly); the convergence is pinned as row 14 (`todo`).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: RED | `TMPDIR=<S>/80-06/tmp HOME=<S>/80-06/home node --test .../adopt-migrate-e2e.legacy.test.cjs` | 1 | PASS (RED correct: 5 of 5 fail; the checker ignored `--mode`, so row 3 and the negatives ran the brownfield checks on a migrated repo) |
| 1: GREEN | same file + `adopt-e2e.test.cjs`, `rename-guard.repo.test.cjs`, `stack-neutrality.repo.test.cjs` | 0 | PASS (43/43) |
| 2: matrix | the four files above | 0 | PASS (58 tests: 56 pass, 0 fail, 2 todo) |

## Task Commits

1. **Task 1 RED** - `44a74cec` (test): the test file with the full list header, row 3 and the checker negatives
2. **Task 1 GREEN** - `bacaf4a1` (test): `adopt-e2e-assert.cjs` migrate mode
3. **Task 2** - `6ff34ebe` (test): rows 1, 2 and 4-14 and their helpers

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `TMPDIR=<S>/80-06/tmp HOME=<S>/80-06/home node --test adopt-migrate-e2e.legacy.test.cjs adopt-e2e.test.cjs rename-guard.repo.test.cjs stack-neutrality.repo.test.cjs` | 0 | PASS (58 tests: 56 pass, 0 fail, 2 todo) |
| lint | not_available | - | not_available |
| build | not_available | - | not_available |

The full suite was not run (the TRD does not ask for it), so `watcher-shell.test.cjs` was never in play. `<S>` is the session scratchpad; no test wrote the real `~/.claude`.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test adopt-migrate-e2e.legacy.test.cjs` | 1 | FAIL (correct): 5/5 |
| GREEN (task 1) | same + adopt-e2e + guards | 0 | PASS (correct): 43/43 |
| GREEN (task 2) | same four files | 0 | PASS (correct): 56 pass, 2 todo |

Rows 1, 2 and 4-12 characterise behaviour 80-02 and 80-03 built, so they were green on their first run; the only RED evidence is Task 1's, which is where the code (the checker mode) was written.

## Deviations from Plan

1. **[Rule 1 - TRD inaccurate] Row 12 does not assert `upgrade --check` is up to date after `upgrade --apply`.** The TRD says `upgrade --apply` "exit 0 and committing its changed_files leaves a clean tree"; that holds. The first draft of the row also asserted the next `--check` was clean, which failed on defect 2 above (not adopt's). The row asserts the TRD's claim; the convergence is pinned as todo row 14.
2. **[Rule 2 - added coverage] Two todo rows (13, 14)** for the defects above, one extra checker negative (N4, unknown mode), and a `steps` assertion in row 10 so each interruption provably resumes from its own step.
3. **`doctor --json` instead of `doctor --raw`.** `--raw` prints the text report; the JSON form carries each check by id, and row 12 asserts on `legacy-planning-layout` (check 27) alone, as the TRD's gotcha says.
4. **`stamp_current` is lenient about a config with neither key** (see key-decisions); the TRD's wording ("every root config has the new key") would fail an unstamped config that the migration never touched. Every config in the fixtures has a stamp, so the two readings agree on all rows.
5. **Task 2 changed only the test file**, as the TRD lists; no adopt.cjs or legacy-migrate.cjs fix was needed (error_recovery unused).

## Known limitations

- The fleet fixtures are synthetic (80-01); the live, agent-followed runs on real fleet copies are TRDs 80-07 and 80-08.
- `outcome()` compares planning-file hashes without `ADOPT-REPORT.md` (it carries a date and backup paths); its content is covered by 80-03's report tests and row 3's Migration-section checks.
- Row 10 interrupts at the three CLI step boundaries only; a crash inside a step (a half-finished move, the window between `convertResidue` and the marker write) is 80-02's and 80-03's unit-level resume tests.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 4/4 (three fixtures through the sequence: rows 1-5; hand-migration equivalence and no health error: 6; re-run and resume: 8-10 (and 11 for a refusal); every 3.1 tool: 12)
- Gate failures: None

## Self-Check: PASSED

- FOUND: plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs, plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
- FOUND: commits 44a74cec, bacaf4a1, 6ff34ebe in `git log`
- `git diff 6e21dd17..HEAD --stat` touches only this TRD's two files plus the SUMMARY
