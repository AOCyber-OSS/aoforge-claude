---
objective: 80-adopt-migrates-legacy-projects
trd: "02"
subsystem: adopt
tags: [adopt, legacy-migration, preflight, begin, resume, legacy-layout-guard, git-mv]

requires:
  - objective: 80-adopt-migrates-legacy-projects
    provides: "TRD 80-01 lib/legacy-migrate.cjs (planMigration, refusalFor, moveTrees, movesDone, ownsMigratePath) and the legacy-adopt fixtures"
provides:
  - "adopt preflight routes a pre-rename repository to the new `migrate` route (or refuses both-planning-dirs / legacy-block-malformed) and writes nothing"
  - "adopt begin on `migrate`: creates aoforge/adopt, writes the marker (mode migrate, plan.moves, report_path), then git mv's every tree; resume finishes an interrupted move"
  - "the CLI legacy-layout guard exempts `adopt`, with a reason; `aof-tools adopt --help` names the migrate route"
affects: [80-03, 80-05, 80-06, 80-07]

tech-stack:
  added: []
  patterns:
    - "legacy facts are just more facts: facts.legacy { applies, refusal } and facts.finished feed the pure decideRoute"
    - "marker `mode` selects the owned-path filter and the resume step list; no `mode` is a fresh adopt"
    - "an adopt is finished when its own commit is in HEAD (fresh: ROADMAP, migrate: report), never when merely staged"

key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs
  modified:
    - plugins/aoforge/aoforge/bin/lib/adopt.cjs
    - plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.cjs
    - plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs
    - plugins/aoforge/aoforge/bin/lib/help.cjs

key-decisions:
  - "The legacy rules sit after the dirty-tree rule and before aoforge/greenfield, so a nested-only repo (reads as brownfield or greenfield) and a residue-only repo (reads as aoforge) both reach migrate"
  - "Finished-adopt detection moved from the index (`ls-files`) to HEAD (`rev-parse HEAD:<rel>`): `git mv` stages the moved ROADMAP long before the adopt commit"
  - "begin writes the marker (with the plan) BEFORE moving, so any interruption resumes from the marker's recorded moves, never from a fresh plan (a re-plan after a partial move reports both-planning-dirs)"
  - "begin on migrate never creates the planning directory first (git mv would nest the tree inside it)"

patterns-established:
  - "Marker mode: `mode: 'migrate'` markers use legacyMigrate.ownsMigratePath for the dirty filter and the steps moved/scaffolded/reported"

requirements-completed: [SC-1, SC-2]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 9min
completed: 2026-10-17
tokens_input: 8595696
tokens_output: 71653
tokens_cache_read: 8409724
tokens_cache_write: 185870
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 02: Adopt preflight and begin route a pre-rename project to migrate Summary

**`adopt preflight` now routes a pre-rename repository (root, nested-only or residue-only) to a `migrate` route or refuses with one message naming the fix, `adopt begin` creates `aoforge/adopt`, records the plan in the marker and moves every planning tree with `git mv`, and a half-finished move resumes; the CLI guard lets `adopt` through, with 45 new tests and all 163 existing adopt tests unchanged.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-17T07:11:09Z
- **Completed:** 2026-10-17T07:20:00Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (1 created, 4 modified, plus this SUMMARY)

## Progress
- [x] Task 1: RED tests for the migrate route — bb97f56d
- [x] Task 2: preflight, decideRoute, begin and resume for migrate — 211fafc9
- [x] Task 3: Guard exemption and help — f9c02bcb

## Accomplishments

- `decideRoute` gained the three legacy rules (refusal, no-commits / adopt-branch-exists, migrate) between the dirty-tree rule and the aoforge/greenfield rules; it stays pure and total, and callers that pass only `roadmapTracked` get the old result (`facts.finished ?? roadmapTracked`).
- A migrate marker resumes on its own wider owned-path set (`ownsMigratePath`: both planning directory names at any depth, `.gitignore`, `CLAUDE.md`); a fresh-adopt marker keeps `isOwnedPath` (tested: `.gitignore` is still a dirty tree there).
- begin on `migrate`: branch, marker, then `moveTrees`; resume of a migrate marker with `moved: false` runs `moveTrees` on the marker's recorded moves. A move that throws returns the `move-failed` refusal (exit 3) and leaves the branch and marker for the re-run.
- The CLI guard exempts `adopt` with a reason; help names the migrate route; the usage line is unchanged.

## Preflight / begin JSON for the migrate route (TRDs 80-03 and 80-05 rely on these)

Exit 0 for `migrate` and `resume`; exit 3 for `refuse`. All paths posix, relative to `target`.

`adopt preflight` on a clean 2.x repository (keys in order):

```
route: 'migrate', reason: null, message: 'ready to migrate a pre-rename project',
target, repo_state: { state, signals }, git: { is_repo, toplevel, branch, head_sha, detached, unborn, busy, dirty },
adopt: { branch: 'aoforge/adopt', branch_exists: false, marker: null, steps: null, mode: 'migrate' },
next: 'aof-tools --cwd <target> adopt begin',
migration: {
  roots:   ['', 'api', 'web'],                         // planning roots, '' first; conflicted dirs excluded
  moves:   [{ dir, from, to, tracked, files }],        // e.g. { dir: 'api', from: 'api/.planning', to: 'api/.aoforge', tracked: true, files: 3 }
  stamps:  [{ file, action: 'rename'|'merge'|null, error? }],   // file = POST-move path (e.g. 'api/.aoforge/config.json')
  blocks:  [{ file, markers: 'pre-v1'|'versioned' }],
  ignores: [{ file, changes: [{ line, action, from, to }] }],
  exclude: { file, added: [lines] },
  skipped: [{ path, dir, reason }] }
```

`migration` is present only for route `migrate` and for a `resume` of a migrate marker (there `migration.moves` is the marker's recorded plan; the rest is re-planned from disk). Every other route (adopt, upgrade, new-project, refuse) has no `migration` key. `adopt.mode` is on every report: `'migrate'` for route migrate or an unfinished migrate marker, else `'adopt'`.

`adopt begin` on route `migrate` (exit 0): the preflight report plus

```
git: { ..., branch: 'aoforge/adopt' },
adopt: { branch: 'aoforge/adopt', branch_exists: true, marker, steps: null, mode: 'migrate' },
moved: [{ dir, from, to, tracked, files, via: 'git mv'|'rename'|'done'|'leftovers', left? }],   // moveTrees results, root first
created_branch: true
```

(`next` still reads `adopt begin`, as for a fresh adopt: the caller advances itself.) The marker (at `git rev-parse --git-path aoforge-adopt.json`):

```
{ version: 1, status: 'in_progress', mode: 'migrate', branch: 'aoforge/adopt', base_branch, base_sha,
  started_at, plugin_version, steps: {}, plan: { moves: [...] }, report_path: '<first root>/.aoforge/ADOPT-REPORT.md' }
```

`report_path` is `.aoforge/ADOPT-REPORT.md` when the repository root is a planning root (including the residue-only repo), `api/.aoforge/ADOPT-REPORT.md` for a nested-only repo whose first root is `api`. A residue-only repository (planning tree already at `.aoforge/`, old stamp key / block / ignore lines) routes to `migrate` with `moves: []`; begin creates the branch and marker and `moved` is `[]`.

`adopt preflight` after begin (exit 0): `route: 'resume'`, `message: "resuming adopt on branch 'aoforge/adopt'"`, `adopt.steps = { moved, scaffolded, reported }` (`moved` = every recorded move's target is a directory and no source remains; `scaffolded` = `marker.steps.scaffolded`; `reported` = `marker.report_path` exists on disk), `next: "resume: '<first step not done>' step not done yet"` (for `moved`, with a hint to re-run begin). `adopt begin` on that `resume` with `moved: false` returns the same shape plus `moved: [...]`, `created_branch: false`, and refreshed `adopt.steps` / `next`.

Refusals (exit 3, nothing written): the existing reasons plus `both-planning-dirs` and `legacy-block-malformed` (message names the paths, `next` is the fix), `move-failed` (begin only: git's error in `message`, `next: 're-run /aoforge:adopt to resume (the marker records the plan)'`, branch and marker stay) and `branch-failed` (begin only: `git switch -c` and `checkout -b` both failed; nothing written).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: RED tests | `node --test adopt-migrate.legacy.test.cjs legacy-layout-guard.legacy.test.cjs` (TMPDIR/HOME in the scratchpad) | 1 | PASS (RED: 32 of 45 new tests fail, the CLI ones on the legacy-layout refusal and the pure ones on the missing migrate route; the 13 that pass are decideRoute rows the old rules already satisfy; 2 guard-test failures on the pinned exemption list) |
| 2: preflight, decideRoute, begin, resume | `node --test adopt-preflight adopt-scaffold adopt-report adopt-e2e adopt-skill-contract file-identities.legacy planning-layout.legacy` + adopt-migrate | 0 | PASS (163/163 existing; adopt-migrate 44/45, the one failure is row 15, help text, Task 3) |
| 3: guard exemption and help | `node --test adopt-migrate.legacy legacy-layout-guard.legacy help dispatch-completeness flag-spec.repo rename-guard.repo` | 0 | PASS (130/130) |

## Task Commits

1. **Task 1: RED tests** - `bb97f56d` (test)
2. **Task 2: routing, begin, resume** - `211fafc9` (feat)
3. **Task 3: guard exemption and help** - `f9c02bcb` (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `TMPDIR=<S>/80-02/tmp HOME=<S>/80-02/home node --test adopt-migrate.legacy.test.cjs adopt-preflight.test.cjs legacy-layout-guard.legacy.test.cjs` | 0 | PASS |
| test (wider) | `node --test *.legacy.test.cjs *.repo.test.cjs` (in lib/) | 0 | PASS (721/721) |
| lint | not_available | - | not_available |
| build | not_available | - | not_available |

The full suite was not run (the TRD does not ask for it), so `watcher-shell.test.cjs` was never in play.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test adopt-migrate.legacy.test.cjs legacy-layout-guard.legacy.test.cjs` | 1 | FAIL (correct): CLI rows fail with the legacy-layout refusal (`still uses the pre-rename planning directory`), pure rows fail on the missing `migrate` route, guard test 8 on the pinned list |
| GREEN | same files (after Tasks 2 and 3) | 0 | PASS (correct): 45/45 + guard test |

## Deviations from Plan

None to the plan's behaviour. Details of how it was executed:

1. **Guard exemption applied early, committed in Task 3.** Task 2's spawned CLI rows cannot run while the guard refuses `adopt`, so the one-line `EXEMPT_COMMANDS` entry sat uncommitted in the working tree while Task 2 was verified (all 45 rows run, 44 passed with help still to come), and was committed with Task 3 as the TRD orders. Task 2's commit holds only adopt.cjs.
2. **More tests than the 15 listed rows.** Row 2 became eight tests (each state), each asserting preflight and begin; row 13 gained two repository-level tests (ROADMAP staged vs in HEAD; report staged vs in HEAD); row 16 (`move-failed`) was added from the TRD's error_recovery section. 45 tests in the new file.
3. **Two additions beyond the TRD text.** `migration.roots` (begin needs the first root for `report_path`) and a `branch-failed` refusal when both `git switch -c` and `git checkout -b` fail (continuing would move the trees on the base branch). A resume hint on the `moved` step of `next`.
4. **Module header** of legacy-layout-guard.cjs now says an exemption may also be granted to the command that moves the layout.

## Known limitations

- `adopt scaffold` and `adopt report` still run the fresh-adopt path when called on a migrate marker's `resume` (they only test `route === 'resume'`); converting the residue and writing the `## Migration` report is TRD 80-03. Nothing in the workflow calls them for a migrate adopt before that lands.
- `preflight` now walks the repository once (`planMigration`, read-only) on every top-level git repository; it skips `node_modules`, build output, dot-directories and nested repositories.
- A real AOForge 3.x project whose `.gitignore` still holds a pre-rename ignore line, or whose `CLAUDE.md` holds a pre-rename block, routes to `migrate` instead of `upgrade` (the residue-only case, by design).

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 (migrate route and nothing written: tests 1, 4; refusals change nothing: 2; begin migrate with marker and `git mv`, never creating `.aoforge/` first: 3, 9, 10; resume after interruption and owned staged paths: 4, 5, 6; fresh/brownfield routing unchanged and finished-by-HEAD: 11, 13 plus 163 existing adopt tests)
- Gate failures: None

## Self-Check: PASSED

- FOUND: plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs
- FOUND: plugins/aoforge/aoforge/bin/lib/adopt.cjs, legacy-layout-guard.cjs, help.cjs
- FOUND: commits bb97f56d, 211fafc9, f9c02bcb in `git log`
