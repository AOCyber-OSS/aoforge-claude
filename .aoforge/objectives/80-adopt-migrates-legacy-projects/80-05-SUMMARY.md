---
objective: 80-adopt-migrates-legacy-projects
trd: "05"
subsystem: adopt
tags: [adopt, legacy-migration, workflow, skill, contract-test]

requires:
  - objective: 80-adopt-migrates-legacy-projects
    provides: "TRD 80-02 preflight/begin JSON for the migrate route and TRD 80-03 scaffold/report JSON (commit_files, commit_message, commit_blocked)"
provides:
  - "workflows/adopt.md drives the migrate route: preflight (migrate, migrate resume, the three migrate refusals) -> begin -> scaffold -> report (stop on commit_blocked) -> commit -> summary, with per-step skips"
  - "the adopt skill description and objective say it also moves a pre-rename project onto .aoforge/ as the same one recorded change, and add the trigger phrase 'move this project to aoforge'"
  - "adopt-skill-contract rows 14-19 pin the migrate path and the unchanged fresh path"
affects: [80-07, 80-08, 80-09]

tech-stack:
  added: []
  patterns:
    - "one step sequence with per-path skips (a migrate sentence at the top of each step), never a second copy of the workflow"
    - "migrate sentences name later steps by their step name (`report`, `commit`), never by the command string, so the contract's first-index ordering row stays valid"

key-files:
  created: []
  modified:
    - plugins/aoforge/aoforge/workflows/adopt.md
    - plugins/aoforge/skills/adopt/SKILL.md
    - plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs
    - site/data/aoforge.json

key-decisions:
  - "The begin step's migrate sentence sits at the top of the step but says `skill-active --start` (not `skill-active --start adopt`), because contract row 4 needs the first `skill-active --start adopt` after the first `adopt begin`"
  - "The commit step tells the agent to skip the commit, not to run it, when commit_files is empty or the commit says nothing_to_commit: an empty --files list would make `aof-tools commit` fall back to the whole planning directory (80-03)"

patterns-established:
  - "A migrate-path note at the top of a step; the rest of the step stays as the fresh path reads"

requirements-completed: [SC-4, SC-5]

verification:
  gates_defined: 3
  gates_passed: 2
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 6min
completed: 2026-10-17
tokens_input: 6044169
tokens_output: 43778
tokens_cache_read: 5913107
tokens_cache_write: 130966
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 05: The adopt workflow and skill learn the migrate path Summary

**`workflows/adopt.md` now sends a pre-rename project through begin, scaffold, report, commit and summary (skipping the skill marker, map, infer_project, confirm_stack_profile and the health repair, and stopping before the commit when report returns `commit_blocked`), the adopt skill says it also migrates, and contract rows 14-19 pin it with the fresh path unchanged; 144 tests across the contract and nine repo guards pass.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-17T07:36:31Z
- **Completed:** 2026-10-17T07:42:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (plus this SUMMARY)

## Progress
- [x] Task 1: RED contract rows — 8b188531
- [x] Task 2: GREEN — workflow, skill, site data — 8c1dab37

## Accomplishments

- **Workflow.** `preflight` lists `migrate` and the migrate `resume` (steps `moved`, `scaffolded`, `reported`, from `adopt.mode`) and names the refusals `both-planning-dirs`, `legacy-block-malformed` and `move-failed`; `begin` does not start the skill marker on the migrate path and stops on a `refuse`; `map`, `infer_project`, `confirm_stack_profile` and `health` each say "Skip on the migrate path" (health adds that `--repair` is never run there); `scaffold` describes the stamp-key, block-marker and ignore-line conversion and its `migrated: <n> converted` line; `report` reads `commit_blocked` first and prints `reason`, `message` and `fix`, skips `commit` and stops when it is set; `commit` skips `skill-active --end`; `summary` reports `report_path`, the `needs_review` count, the merge instruction, "Nothing was pushed" and the `upgrade --check` next step. `<purpose>` and `<success_criteria>` carry the matching sentences.
- **Skill.** Description gains the migration sentence and the trigger phrase "move this project to aoforge"; `<objective>` gains the matching sentence. Neither spells a legacy name.
- **Fresh path unchanged.** Every pre-existing line of the workflow is still there verbatim; only added sentences differ. Row 19 pins the 15 `aof-tools.cjs` commands of the fresh path in order, and it passed before and after the edit.
- **Site data.** `npm run docs:data` changed only the adopt entry (notes, one trigger) and `generatedAt`.
- **Both 80-03 open items addressed in the workflow where it can:** (1) the `commit` step now treats an empty `commit_files` or a `nothing_to_commit` result as "nothing left to record, go on to `summary`", which is what a re-run after the change was recorded produces when the planning tree is untracked (preflight keeps routing such a project to `resume`); it also avoids the empty `--files` fallback to the whole planning directory. (2) is not fixable in prose, see Open items.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: RED contract rows | `TMPDIR=<S>/80-05/tmp HOME=<S>/80-05/home node --test adopt-skill-contract.test.cjs` | 1 | PASS (RED: rows 14-18 fail on the missing migrate text, rows 1-13 and 19 pass) |
| 2: GREEN workflow, skill, site data | same file plus `context-budget.repo`, `rename-guard.repo`, `stack-neutrality.repo`, `builtin-sweep.repo`, `doc-refs.repo`, `planning-writes.repo`, `aoforge-workflows.repo`, `prompt-raw-commit.repo`, `rg-flag-guard` | 0 | PASS (144/144; contract 19/19) |
| 2 (wording fix, 214f33d2) | same ten files | 0 | PASS (144/144) |

## Task Commits

1. **Task 1: RED contract rows** - `8b188531` (test)
2. **Task 2: workflow, skill and site data** - `8c1dab37` (docs)
3. **Wording fix (begin names `branch-failed`)** - `214f33d2` (docs)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `node --test adopt-skill-contract.test.cjs context-budget.repo.test.cjs rename-guard.repo.test.cjs` (and the other seven guards) | 0 | PASS |
| lint | not_available | - | not_available |
| build | `npm run docs:data` | 0 | PASS |

The full suite was not run (the TRD does not ask for it), so `watcher-shell.test.cjs` was never in play.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test adopt-skill-contract.test.cjs` | 1 | FAIL (correct): rows 14-18 fail, 1-13 and 19 pass |
| GREEN | same file, then the guard set | 0 | PASS (correct): 19/19, then 144/144 |

## Deviations from Plan

1. **Row 14 and 16 assert a little more than the TRD lists.** Row 14 also checks the `migration` list, `adopt.mode` and the `moved`/`scaffolded`/`reported` steps; row 16 also checks that `commit` covers a `nothing_to_commit` re-run and that the report prints the blocked commit's `fix`. These pin the 80-03 open item (1) handling.
2. **`commit` step text goes beyond the TRD sentence** ("no skill marker to end; run the same commit command"): it adds the empty-`commit_files` / `nothing_to_commit` rule described above. No code was touched (`adopt.cjs` and `adopt-cli.cjs` are unchanged).
3. **Begin step wording.** The TRD's example sentence names `skill-active --start adopt`; written at the top of the step it would put that string before the first `adopt begin` and fail contract row 4, so it says `skill-active --start`.
4. **The pointer-plugin generator the project CLAUDE.md mentions (`scripts/gen-pointer-skills.cjs`) no longer exists** (removed with the shims in 3.1.0), so the changed skill description needed no pointer regeneration.
5. **Edits through Bash heredoc/python.** Row 14-19 were appended with a heredoc and SKILL.md edited with a short python script rather than Edit/Write; no content difference.

## Open items

- **Crash window (80-03 open item 2) is not addressable in the workflow.** A stop after `convertResidue` wrote its files and before the marker write loses the stamp/block/ignore rows from the migration record. The files are converted and the git diff shows them; a re-run converts nothing and does not rebuild the rows. Fixing it needs a code change in `adopt.cjs` (record before or atomically with the write, or rebuild the rows on resume) and was out of this TRD's scope (`adopt.cjs` is not to be modified here).
- **Untracked planning tree and `resume` (80-03 open item 1) is handled by prose, not by a finished signal.** After the commit, `adopt preflight` still routes such a project to `resume`; the workflow now ends that re-run at `summary` through the `nothing_to_commit` / empty `commit_files` rule. A code-level finished signal for this shape is still absent.
- The simulated runs of this text are TRDs 80-07 and 80-08; TRD 80-06 (parallel) owns the e2e test and its assertion fixture.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 4/4 (migrate path through the workflow and `commit_blocked` stop: rows 14-17; fresh path unchanged: row 19 plus the guard set; skill text names the migration with no legacy spelling: row 18 and `rename-guard.repo`; contract and repo guards pass: 144/144)
- Gate failures: None

## Self-Check: PASSED

- FOUND: plugins/aoforge/aoforge/workflows/adopt.md, plugins/aoforge/skills/adopt/SKILL.md, plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs, site/data/aoforge.json
- FOUND: commits 8b188531, 8c1dab37, 214f33d2 in `git log`
- `git diff 6e21dd17..HEAD --stat` touches only this TRD's four files plus the SUMMARY
