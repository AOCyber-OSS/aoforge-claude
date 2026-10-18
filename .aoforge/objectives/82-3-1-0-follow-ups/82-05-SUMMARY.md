---
objective: 82-3-1-0-follow-ups
trd: "05"
subsystem: testing
tags: [eval82, ledger, guessed-paths, batch-e, batch-d, ui-evaluator, escalation]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: the frozen eval81 harness (runner, sandbox, ledger library, access classification, roles, stats, batches D and E, the recorded E.json and eval root)
provides:
  - scripts/eval82/ledger82.cjs ($20 hard-capped ledger, --init, --fit build-2 report, --raise)
  - scripts/eval82/lib/guessed-paths.cjs (transcript scan for `~` and guessed-home inputs, library + CLI)
  - scripts/eval82/batches/E.cjs and score/E.cjs (build-cell re-run, 82-MEASUREMENT.md)
  - scripts/eval82/batches/D.cjs and score/D.cjs (per-state UI judge with engine-rule escalation)
  - scripts/eval82/score.cjs (score CLI for objective 82 batches)
affects: [82-06, 82-08, 82-09]

tech-stack:
  added: []
  patterns:
    - "Objective 82 extends the frozen eval81 harness only through --batch-dir, --results-dir, --sandbox-root and imports; nothing under scripts/eval81 changes"
    - "A batch re-uses 81's descriptors and proves fairness by deep-equal after stripping id, order, capUsd and capBasis"
    - "Absolute sandbox paths in prompts come only from EVAL82_SANDBOX_ROOT, realpath'd like the runner's --sandbox-root"

key-files:
  created:
    - scripts/eval82/README.md
    - scripts/eval82/ledger82.cjs
    - scripts/eval82/ledger82.test.cjs
    - scripts/eval82/lib/guessed-paths.cjs
    - scripts/eval82/lib/guessed-paths.test.cjs
    - scripts/eval82/batches/E.cjs
    - scripts/eval82/batches/E.test.cjs
    - scripts/eval82/batches/D.cjs
    - scripts/eval82/batches/D.test.cjs
    - scripts/eval82/score/E.cjs
    - scripts/eval82/score/E.test.cjs
    - scripts/eval82/score/D.cjs
    - scripts/eval82/score/D.test.cjs
    - scripts/eval82/score.cjs
    - scripts/eval82/__fixtures__/records.cjs
    - scripts/eval82/__fixtures__/runs-81/ (3 run dirs, 6 files, 27,164 bytes)
  modified: []

key-decisions:
  - "The guessed-path scanner treats guessed_home (an absolute path under the home's parent) as the defect signal and counts `~` inputs for the record only: the Read tool expands `~` (user correction)"
  - "ledger82 --fit counts build 1 at 0 once b82-r1 is charged (its cost is then in E's spend), so the report never double counts it"
  - "Batch D's escalation set is decided only by the engine's scoreState + aggregateVotes().split + judgeEscalation on the three haiku samples; the batch module never opens the answer key"
  - "score.cjs is objective 82's own CLI (reusing 81's spendBlock and loadLedger) so each scorer renders its own results/<X>.md"

patterns-established:
  - "runs-81/ fixtures: trimmed verbatim transcript lines from a recorded eval root, username replaced, under 40 KB"

requirements-completed: [SC-1, SC-2, SC-3]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 92min
completed: 2026-10-18
---

# Objective 82 TRD 05: eval82 ledger and E/D batches Summary

**A $20 hard-capped ledger with a build-2 fit report, a transcript scan that finds the `~` and guessed-home inputs `record.access` misses (2 versus 0 on 81's own C-res-architecture-h-2), the build-cell re-run batch E and the per-state UI-judge escalation batch D, each with a scorer, all on objective 81's frozen harness.**

## Performance

- **Duration:** about 92 min
- **Started:** 2026-10-18T01:16:36Z
- **Completed:** 2026-10-18T02:48Z
- **Tasks:** 3 of 3
- **Files created:** 21 (15 modules and tests, 6 fixture files)

## Progress
- [x] Task 1: Fixture builders, ledger82 (--init, --fit, --raise) and the guessed-path scanner — 23e4e62f (RED 36bdb432)
- [x] Task 2: Batch E and the E scorer — 91fc259e (RED aec5465d)
- [x] Task 3: Batch D with the absolute screenshot path, the D scorer, and a D dry run — (this commit) (RED 3ebbf5a5)

## Accomplishments

- `ledger82.cjs --init` writes a ledger built from the frozen `newLedger()` (cap $20, order D, C, E, A, B; D $4.5/3.8, C $3.5/2.6, E $12/9.4; A and B stopped, cap 0) that the frozen loader and runner accept; `--fit` reproduces the TRD's arithmetic from the frozen `reserveFor`; `--raise` changes only the two caps through the frozen loader and saver.
- `lib/guessed-paths.cjs` scans tool_use inputs deduplicated by id (plus denials absent from the transcripts); on the recorded 81 extracts it finds what `record.access` never recorded.
- Batch E re-uses 81's b31-r1/b31-r2 descriptors (deep-equal but for id, order and the $6.5 cap), with an opt-in 3.0.0 control; its scorer renders `82-MEASUREMENT.md` with per-role columns 3.0.0 (81), 3.1.0 (81), 3.1.0-82 and a guessed-path table that cannot say "none" for an unscanned run.
- Batch D plans 120 single-state sessions plus exactly the escalations the engine's rules ask for, naming the screenshot by its absolute sandbox path; its scorer reports per-arm accuracy, broken_missed, false_fail, split and escalation rates, agreement and cost with Wilson intervals.

## Ledger: `--fit` on the fresh ledger

```
$ node scripts/eval82/ledger82.cjs --init --root <R82>
wrote <R82>/ledger.json: cap 20, order D, C, E, A, B; D 4.5, C 3.5, E 12; A and B stopped
$ node scripts/eval82/ledger82.cjs --fit --root <R82>
ledger total 0 of 20; batches D pending, C pending, E pending, A stopped, B stopped
build-2 reserve: cap 6.5 x 1.25 = 8.125
worst     D 4.5  C 3.5  E spent 0  build 1 6.5  build-2 reserve 8.125  = 22.625 of 20 (over by 2.625); E batch 13 of 12 (over)
expected  D 3.8  C 2.6  E spent 0  build 1 4.72  build-2 reserve 8.125  = 19.245 of 20 (fits, 0.755 spare); E batch 11.22 of 12 (fits)
break-even build-1 cost: 3.875 with D and C at their caps, 5.475 at their estimates
build 2 guaranteed: no (worst case needs cap 22.625 and E cap 13)
```

`--raw` gives the test-15 object (`worst`, `expected`, `break_even_build1` {3.875, 5.475}, `cap_needed_worst` 22.625, `build2_guaranteed: false`). After `--raise --cap 25 --e-cap 15 --reason "user: go D C cap 25"` the report says `build2_guaranteed: true`.

## Guessed-path scan on the `runs-81/` extracts (homeParent `/Users`, realHome `/Users/realuser`)

| Run | files | tool_uses | tilde | guessed_home | record.access |
|---|---:|---:|---:|---:|---|
| C-res-architecture-h-2 | 1 | 2 | 2 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| b31-r1 | 1 | 7 | 0 | 1 (denied, `<home>/.claude/aoforge/references/tdd.md`) | not recorded |
| b31-r2 | 1 | 4 | 0 | 1 (`/Users/aocyber/.claude/aoforge/references/tdd.md`, a subagent) | not recorded |

## D dry run (zero API calls)

```
$ node scripts/eval82/ledger82.cjs --init --root $SP/82-05/dry
$ node -e "...sandbox.exportTrees({repo: <checkout>, root: /private/tmp/claude-501/e82-dry-001c0d0547536252, refs: {'3.1.0': 'HEAD'}})"
$ EVAL82_SANDBOX_ROOT=<S> node scripts/eval81/run.cjs --batch D --root $SP/82-05/dry --token-file $SP/82-05/token \
    --batch-dir scripts/eval82/batches --results-dir $SP/82-05/results --sandbox-root <S> --repo <checkout> \
    --calibration $SP/82-05/no-calibration.json --dry-run --materialize first --raw
run: exit 0: dry run of batch D: 120 planned run(s), caps $12, worst case (sum of reserves) $15, estimate $3.8, ledger total $0; nothing spawned
```

- Planned 120 (60 haiku at cap $0.05, reserve $0.0625; 60 sonnet at cap $0.15, reserve $0.1875); every run `would_fit: true`; order check OK (D is first); ledger total stays $0.
- The first planned prompt (D-d01-h-1, argv.json) names `/private/tmp/claude-501/e82-dry-001c0d0547536252/runs/D/D-d01-h-1/work/d01.png`; the session cwd is that work dir; the materialized `d01.png` exists there and is byte-identical to 81's fixture; the opaque check found no violations.
- `--fit` on the dry ledger afterwards prints the same report as the fresh ledger above (nothing charged).
- **For the 82-08 spend gate:** the runner reports `caps_exceed_batch_cap: true` (the per-session caps sum to $12 against D's $4.5 batch cap). The batch cap, not the per-session caps, is what binds: at the $3.8 estimate the batch finishes, but if sessions run costlier the batch cap refuses the last runs, which are the escalation sessions (order 120+).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1 | `env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test scripts/eval82/ledger82.test.cjs scripts/eval82/lib/guessed-paths.test.cjs` (14/14; test 17 asserts 2 versus 0 on the real lines) | 0 | PASS |
| 2 | `env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test scripts/eval82/batches/E.test.cjs scripts/eval82/score/E.test.cjs` (+ Task 1 files: 26/26) | 0 | PASS |
| 3 | `env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test scripts/eval82/batches/D.test.cjs scripts/eval82/score/D.test.cjs` (14/14); D dry run above; `rg -n 'labels' scripts/eval82/batches/D.cjs` prints nothing | 0 | PASS |
| all | `git status --porcelain scripts/eval81` (empty) and `node scripts/eval81/prereg.cjs --check --manifest .../prereg-manifest.json` ("OK, 86 files match", with the gitignored private file linked in temporarily) | 0 | PASS |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (Task 1) | `node --test scripts/eval82/ledger82.test.cjs scripts/eval82/lib/guessed-paths.test.cjs` (8 failing, modules missing) | 1 | FAIL (correct) |
| GREEN (Task 1) | same | 0 | PASS (correct) |
| RED (Task 2) | `node --test scripts/eval82/batches/E.test.cjs scripts/eval82/score/E.test.cjs` (Cannot find module './E.cjs') | 1 | FAIL (correct) |
| GREEN (Task 2) | same (+ Task 1 files, 26/26) | 0 | PASS (correct) |
| RED (Task 3) | `node --test scripts/eval82/batches/D.test.cjs scripts/eval82/score/D.test.cjs` (Cannot find module './D.cjs') | 1 | FAIL (correct) |
| GREEN (Task 3) | same (14/14) | 0 | PASS (correct) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (scoped, per TRD) | `node --test` on the six scripts/eval82 test files under the scratch HOME (40/40) | 0 | PASS |
| test (scripts glob) | `node --test 'scripts/**/*.test.cjs'` (837 pass, 2 skipped, 0 fail) | 0 | PASS |
| repo guards | `node --test` on all 20 `*.repo.test.cjs` (307/307, node_modules linked temporarily, removed after) | 0 | PASS |

The full suite runs in 82-10, as the TRD says.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `--fit` would double count build 1 once it has run**
- **Found during:** Task 1
- **Issue:** the TRD formula adds E's spend and build 1 at its cap; once `b82-r1` is charged its cost is already in E's spend.
- **Fix:** build 1 counts 0 (`build1_done: true`) when an E entry `b82-r1` exists; `break_even_build1` is null then. Test 15's overshoot case asserts it.
- **Files modified:** scripts/eval82/ledger82.cjs
- **Commit:** 23e4e62f

### Other deviations

- **User correction applied (the `~` premise).** The Read tool expands `~`; the defect is an agent guessing an absolute home path. The scanner keeps counting `tilde` as the TRD asks but documents it as information, and `guessed_home` as the defect signal (module comment, README, the 82-MEASUREMENT.md section text). No acceptance item depended on `~` Reads failing: test 17 still asserts the 2-versus-0 count.
- **runs-81 fixture trimmed further than the TRD lists, for its 40 KB budget.** C-res-architecture-h-2 keeps its two tool_use lines, the api-request-blob line repeating them and one of the two tool_result lines (line 29, 11.6 KB; line 27, 16 KB, would push the directory over 40 KB). b31-r1 and b31-r2 keep the tool_use line, its tool_result line and the blob repeat; their second blob line (the tool_result repeat) is not copied. Copied lines are verbatim except the username (`realuser`); total 27,164 bytes; `rg -n -i justin scripts/eval82/__fixtures__` prints nothing.
- **`E_RUN_CAP_USD`** was defined in ledger82.cjs in Task 1 (batch E did not exist yet) and moved to batches/E.cjs in Task 2, which ledger82 now imports, as the TRD specifies.
- **`e81Json` and the E/D fixture builders** were added to `__fixtures__/records.cjs` in Tasks 2 and 3 rather than Task 1. The default 81 E.json fixture carries all four recorded build runs, so the Limits line reads n=2 vs n=2.
- **`--raise` comparison** excludes `updated_at`: the frozen saver stamps it on every save. Every other field is unchanged (test 16).
- **A and B rows** are `stopped` with cap 0 and estimate 0, so the $20 ledger shows no budget for them.
- **D's schema** is 81's run schema with `results` held to `minItems`/`maxItems` 1 (the "one-state jsonSchema"); the item schema is 81's unchanged.
- **D's contamination patterns** omit the key file's name so that the module source never names it (`rg labels` prints nothing); the `fixtures/D/` path pattern still catches any access to the key.
- **score.cjs** is objective 82's own CLI rather than 81's `main --scorer-dir`, so that each scorer writes its own `results/<X>.md` (81's generic table has no per-role metrics for these shapes). It reuses 81's `spendBlock` and the frozen `loadLedger`, and a missing ledger names `ledger82.cjs --init`.
- **D escalation rates** are over the arm's complete states (20 when all are complete) and over its ok-labelled complete states, so an incomplete state is never counted as a non-escalation.
- **Prereg check in the worktree** needs the gitignored `private/fleet-checklists.json`, which worktrees do not have. It was linked in from the main checkout for the check and removed afterwards; the check reports OK, 86 files.

## Discovered commands

None. The commands come from the TRD.

## Issues Encountered

- The D dry run's `caps_exceed_batch_cap: true` (see D dry run above) is for the 82-08 gate to show, not a defect: the caps are the TRD's.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 7/7 (ledger init/order/caps and refusal; --fit/--raise; scanner 2 versus 0; batch E fairness and control; batch D 120 + engine escalations + absolute path + no key; D scorer metrics; test-first with zero API calls and scripts/eval81 unchanged)
- Gate failures: None

## Next Objective Readiness

- 82-06 builds batch C and the pre-registered rules on `EVAL82_SANDBOX_ROOT`, the ledger and `score.cjs --batch C` (it loads `score/C.cjs`).
- 82-08/82-09 show `ledger82.cjs --fit` at each spend gate and run D, C and E live under the $20 cap.
