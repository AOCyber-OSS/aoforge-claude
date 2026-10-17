---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "10"
subsystem: testing
tags: [eval, ui-judge, batch-spec, scorer, haiku, flutter-ui-eval]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: "81-01 contract/caps (capFor, validateDescriptor, toolInputsMentioning), 81-02 batch result shape + score.cjs + decide(), 81-05 D fixtures (states.json, labels.json, 20 PNGs)"
provides:
  - "scripts/eval81/batches/D.cjs: batch D module (runs, materialize, collect, workDirFor, parseResults, runSchema, loadStates, engineText, shuffled)"
  - "scripts/eval81/score/D.cjs: score({root, outDir}), judgeState, loadLabels for the ui-evaluator role"
  - "scripts/eval81/__fixtures__/judge-outputs.cjs: hand-written judge outputs and the dRoot run-dir builder"
affects: [81-13, 81-16, 81-19]

tech-stack:
  added: []
  patterns:
    - "Batch D prompt text comes from the engine's own buildVisionRequest at spec time (profile pinned and restored), never re-worded"
    - "A session judges one surface; per-repeat mulberry32 shuffle seeded repeat x 1000 + surface index"
    - "Scorer reads collected outputs from record.outputs, else outputs/outputs.json, else re-collects from the record"

key-files:
  created:
    - scripts/eval81/__fixtures__/judge-outputs.cjs
    - scripts/eval81/batches/D.cjs
    - scripts/eval81/batches/D.test.cjs
    - scripts/eval81/score/D.cjs
    - scripts/eval81/score/D.test.cjs
  modified: []

key-decisions:
  - "n_scored and planned for D count samples (states x repeats = 60 per model), because decide.cjs compares them as a share and the rule doc says samples for D; sessions are reported beside them as sessions_scored / sessions_planned"
  - "engine_escalations follows the pre-registered doc (ok-labelled states with split votes); engine_reviews is added for the strict engine condition (ok-labelled, scoreState verdict review). They differ only for an ok-labelled state with a broken majority and a dissent"
  - "A run is excluded (not in n) for status other than ok, model_ran false, contamination, or no parsable results ('unparsed'); an unreadable record is excluded as record:unreadable; a missing record is a planned run not run"
  - "materialize is idempotent and never deletes: it overwrites the surface's PNGs and refuses a work dir other than <root>/runs/D/<id>/work"

requirements-completed: [SC-1, SC-3]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 10min
completed: 2026-10-17
tokens_input: 9366148
tokens_output: 92179
tokens_cache_read: 9114890
tokens_cache_write: 251148
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 81 TRD 10: Batch spec and scorer for D (UI judge) Summary

**Test D is runnable and scorable without the API: 24 Read-only judge sessions (4 surfaces x haiku/sonnet x 3 repeats) built from the engine's own per-state judge text with a seeded per-repeat shuffle, and a scorer that aggregates each state's three samples with the engine's `aggregateVotes` and `scoreState` into accuracy, broken_missed, split rate, engine escalations and defect-type and severity breakdowns.**

## Progress
- [x] Task 1: Canned judge outputs (fixture builder) — bb5be35a
- [x] Task 2: Batch D module and scorer — ebffeeed

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-17T17:06:05Z
- **Completed:** 2026-10-17T17:16:00Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- `batches/D.cjs` yields 24 valid descriptors (kind prompt, agent null, plugin null, tools `['Read']`, the TRD's `results[]` schema built from `visionPerceptualSchema().properties`, ids `D-<surface>-<model>-r<n>`, role `ui-evaluator`, 10 minute timeout, caps from `capFor({role: 'judge', ...})` with the basis string kept). Models alternate per surface so neither always runs on the warmer cache.
- Each prompt lists, per state of the surface in a seeded order, the text `buildVisionRequest` returns for that state plus `Screenshot file: <root>/runs/D/<id>/work/<state>.png`. The runner's work dir layout is written into the prompt, `materialize` refuses any other dir, and `workDirFor(root, id)` is exported so the 81-13 dry-run rehearsal can compare it with the runner's real work dir.
- Nothing shown carries a label: a test strips the engine text from every prompt and scans the rest and the materialised file names for label words and answer-key field names; `batches/D.cjs` does not contain the answer-key file name at all (`rg` finds nothing).
- `collect` returns the results from `structured_output`, else the last fenced json block (object or bare array), else `{results: [], source: 'none', parse_error}`, and flags contamination from the run's stream (a tool input naming the answer key, `scripts/eval81`, or the fixture dir).
- `score/D.cjs` returns the 81-02 result for role `ui-evaluator`; it passes through `score.cjs` (spend block, D.md) and `decide()` unchanged (a full hand-written 24-run root reads as WEAK_ENDORSE for 19/20 vs 20/20).

## Batch D plan (for the 81-13 projection and the 81-16 checkpoint)

24 sessions, `calibration: null` (FALLBACK_P90 judge 0.5, base allowance 36K x 3 turns):

| Model | Runs | Per-run cap | Of which base prompt | Sum |
|---|---|---|---|---|
| haiku | 12 | $0.25558 | $0.00558 (cap is the $0.25 floor) | $3.06696 |
| sonnet | 12 | $0.60080 | $0.10080 | $7.20960 |
| total | 24 | | | $10.27656 |

The D batch cap in the ledger is $3 (estimate about $2), and the ledger refuses a run when batch spent + that run's cap exceeds the batch cap. The sum of caps is 3.4x the batch cap by design (caps bound a run, the ledger charges actual spend). The practical consequence: a sonnet run can start only while batch spend is at or below $2.399, a haiku run while at or below $2.744. Reading about five 1280x800 PNGs on Sonnet 5.5 should cost on the order of $0.10 to $0.20 per session and about $0.02 to $0.04 on Haiku 5.5, so about $2.2 in total; if real sessions run at twice that, the last interleaved sessions are skipped with `skipped_budget` rather than overspending. The session needs at least one turn per screenshot plus the answer, so the 3-turn base allowance in the cap is a floor, not the expected turn count: 81-14's first live run should be watched for `cap_hit` on the first sonnet D session.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Canned judge outputs | `node -e "const j=require('./scripts/eval81/__fixtures__/judge-outputs.cjs');console.log(JSON.stringify(j.judgeResult({state_id:'d01',is_broken:false,defects:[]})))"` printed `{"state_id":"d01","is_broken":false,"matches_expected":true,"confidence":0.9,"defects":[]}` | 0 | PASS |
| 2: Batch D module and scorer | `node --test 'scripts/eval81/batches/D.test.cjs' 'scripts/eval81/score/D.test.cjs'` (19 + 16 tests) | 0 | PASS |

## Task Commits

1. **Task 1: Canned judge outputs (fixture builder)** - `bb5be35a` (feat)
2. **Task 2: Batch D module and scorer** - `ebffeeed` (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81) | `node --test 'scripts/eval81/**/*.test.cjs'` (278 tests: 277 pass, 1 skipped by an 81-06 fixture proof, 0 fail; the TRD's `node --test scripts/eval81/` does not run on Node 24) | 0 | PASS |
| test (repo guards) | `node --test 'plugins/aoforge/aoforge/bin/lib/*.repo.test.cjs'` after the commit (all 25 repo guards, including rename guard, planning-writes and doc-refs: 307 tests) | 0 | PASS |
| verification 1 | `runs({root, trees: null, calibration: null}).length` | 0 | PASS (24) |
| verification 2 | `rg -n "labels.json" scripts/eval81/batches/D.cjs` | 1 | PASS (no match) |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (batch D) | `node --test 'scripts/eval81/batches/D.test.cjs'` before D.cjs existed: 19 failures (module not found) | 1 | FAIL (correct) |
| GREEN (batch D) | same: 19/19 | 0 | PASS (correct) |
| RED (score D) | `node --test 'scripts/eval81/score/D.test.cjs'` before score/D.cjs existed: 15 failures, 1 pass (the answer-key guard) | 1 | FAIL (correct) |
| GREEN (score D) | same: 16/16 | 0 | PASS (correct) |

No REFACTOR phase was needed. The tests were written as one file per module and run RED as a whole, not one test at a time.

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 4/4 truths (24 runs; engine text per state with a seeded shuffle; engine `aggregateVotes`/`scoreState` with the listed metrics; no label in anything shown), 2/2 artifacts, 2/2 key links (`buildVisionRequest`/`visionPerceptualSchema` in batches/D.cjs, `aggregateVotes`/`scoreState` in score/D.cjs)
- **Gate failures:** None
- No live API call was made and the token file was never read. Tests ran with HOME and TMPDIR under the session scratchpad; no `node_modules` symlink was needed.

## Files Created/Modified
- `scripts/eval81/__fixtures__/judge-outputs.cjs` - defect, judgeResult, okResult, brokenResult, runOutput (structured | fenced | garbage), dRoot (writes D run dirs like the runner)
- `scripts/eval81/batches/D.cjs` - the batch module
- `scripts/eval81/batches/D.test.cjs` - 19 tests (test list 1-4 plus 1b-1d, 2b-2e, 3b, 4b-4h)
- `scripts/eval81/score/D.cjs` - the scorer
- `scripts/eval81/score/D.test.cjs` - 16 tests (test list 5-9 plus 7b, 9b-9h, the key guard, the CLI run and a full 24-run decide() run)

## Decisions Made
- **Samples, not sessions, are D's n.** `planned` is 60 per model (20 states x 3 repeats), computed from the planned descriptors; `sessions_scored` and `sessions_planned` ride along.
- **Escalation definition.** The pre-registered doc says engine escalations are ok-labelled states with split votes; the engine itself escalates only when `scoreState` returns review. Both are reported (`engine_escalations`, `engine_reviews`); the doc's is the one named in the rule.
- **Contamination patterns.** `\blabels\b`, `answer-key`, `scripts/eval81` and `fixtures/D/` in any tool input; a Read of the work-dir PNGs matches none of them.
- **Prompt wording beyond the TRD's opening line.** One extra sentence tells the judge to compare each screenshot only with its own expected text and to use the quoted state id as `state_id`; it names no label word (the label-word test covers it).
- **Env per run.** `AOFORGE_SKIP_AWARENESS_POPULATE`, `AOFORGE_SKIP_TRANSCRIPT_EXPORT`, `AOFORGE_SKIP_PRUNE` (81-08 gotchas, all runs); no edit-gate variable, since D has no agent and no plugin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gate command form on Node 24**
- **Found during:** validation gates
- **Issue:** `node --test scripts/eval81/` loads the directory as a module on Node 24.
- **Fix:** ran the glob form `node --test 'scripts/eval81/**/*.test.cjs'` (as 81-01 and 81-02 did).
- **Files modified:** none

**2. [Rule 2 - Missing critical] Contamination is checked in collect, and the scorer re-collects when outputs are missing**
- **Found during:** Task 2
- **Issue:** the TRD's collect contract returns only `{results}`, but decision rule section 3 excludes a run whose tool inputs mention an answer key; A/B (81-09) carry `contaminated` in their collected outputs.
- **Fix:** collect also returns `contaminated` and `contamination_ids` from the run's stream; score/D.cjs excludes such a run and, when `record.outputs` and `outputs/outputs.json` are both absent, calls collect itself.
- **Files modified:** scripts/eval81/batches/D.cjs, scripts/eval81/score/D.cjs
- **Verification:** tests 4h, 9d, 9e

**3. [Rule 1 - Bug] Test 4c written for replace-on-retry, rewritten as idempotent overwrite**
- **Found during:** Task 2, before implementation
- **Issue:** deleting the work dir in materialize would remove anything the runner placed there; the runner already recreates the dir on a retry.
- **Fix:** materialize overwrites the surface's PNGs and leaves other files alone; test 4c asserts that.
- **Files modified:** scripts/eval81/batches/D.cjs, scripts/eval81/batches/D.test.cjs

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug in my own test design)
**Impact on plan:** additive; every TRD-specified name, shape and metric is as written.

## Known limitations (for the report and the 81-16 checkpoint)
- One session sees every state of its surface, so the judge can compare states, and each broken state is the ok state of the same surface and viewport plus one CSS injection (labels `baseline`): a surface's session therefore contains each broken state beside its ok baseline. The per-repeat shuffle, the per-state expected text and the instruction to judge each screenshot alone mitigate this; they do not remove it. The scorer's notes say so, so the report carries it.
- A tie (only possible with two samples) is counted ok, as the engine does.
- The label for d15 carries `also_defect_types: [blank_empty]`; the breakdown groups it under its primary type (overflow).
- Work-dir layout is an assumption of 81-08's `makeSandbox` (`<root>/runs/<batch>/<id>/work`); 81-13's dry-run rehearsal must compare `workDirFor` with the runner's real work dir.

## Issues Encountered
- None. The first GREEN run of both test files passed; the tests were checked non-vacuous by the RED runs and by the hand-computed counts in tests 9 and 11.

## User Setup Required

None - no external service configuration required.

## Next Objective Readiness
- 81-13: batch D's dry run lists 24 runs; add the cap sum ($10.28 vs the $3 batch cap) to the projection and check `workDirFor`.
- 81-16: `node scripts/eval81/score.cjs --batch D --root <R> --out <O>` works on the runner's output; `results/D.json` carries a `states` key with per-state majority, votes and split for the spot-check.

## Self-Check: PASSED

- FOUND (tracked): scripts/eval81/__fixtures__/judge-outputs.cjs, scripts/eval81/batches/D.cjs, scripts/eval81/batches/D.test.cjs, scripts/eval81/score/D.cjs, scripts/eval81/score/D.test.cjs
- FOUND: bb5be35a, ebffeeed on df/exec-81-10-batch-spec-and-scorer-d
- No node_modules symlink was created; nothing written outside the worktree except scratchpad files and the planning draft.

---
*Objective: 81-haiku-eval-and-model-efficiency-measurement*
*Completed: 2026-10-17*
