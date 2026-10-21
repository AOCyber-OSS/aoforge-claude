---
objective: 82-3-1-0-follow-ups
trd: "08"
subsystem: testing
tags: [eval82, live, batch-d, batch-c, ui-evaluator, project-researcher, escalation, ledger, revert]

requires:
  - objective: 82-3-1-0-follow-ups (TRDs 82-03, 82-05, 82-06, 82-11)
    provides: "P1, P4, P5 applied; the $20 ledger, batch D and C, check-rules.cjs and the frozen manifest; the runtime line in spawn prompts"
provides:
  - ".aoforge/objectives/82-3-1-0-follow-ups/results/D.json and D.md: per-state UI judge, haiku start with engine escalation against a sonnet start (123 sessions)"
  - ".aoforge/objectives/82-3-1-0-follow-ups/results/C.json and C.md: project-researcher architecture and pitfalls at haiku and sonnet on two new topics, blind-graded (16 + 16 runs)"
  - ".aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md: P1 REVERT, P4 REVERT, P5 KEEP, SC-2 (researcher runs) PASS"
  - "P1 reverted: models.ui-evaluator opus/sonnet/sonnet; P4 reverted: focus.project-researcher.architecture opus/sonnet/sonnet"
affects: [82-09, 82-10]

tech-stack:
  added: []
  patterns:
    - "Score into a scratch --out while a later batch runs, so the checkout stays untouched under the tripwire"

key-files:
  created:
    - .aoforge/objectives/82-3-1-0-follow-ups/results/D.json
    - .aoforge/objectives/82-3-1-0-follow-ups/results/D.md
    - .aoforge/objectives/82-3-1-0-follow-ups/results/C.json
    - .aoforge/objectives/82-3-1-0-follow-ups/results/C.md
    - .aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md
  modified:
    - plugins/aoforge-stack-flutter/aoforge-stack.json
    - plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs
    - plugins/aoforge-stack-flutter/CHANGELOG.md
    - plugins/aoforge/aoforge/references/model-profiles.json
    - plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs
    - plugins/aoforge/aoforge/references/model-profiles.md

key-decisions:
  - "User gate (2026-10-18): 'Go D, C, E at cap $25'; the ledger cap was raised to $25 and E's batch cap to $15 before any spend, and build 2 is guaranteed in the worst case"
  - "P1 REVERT under 82-CHECK-RULES.md section 1: broken_missed(Haiku start, final) = 1 of 13 (state d17), the rule needs 0; accuracy 19/20 vs 18/20 and cost $0.1334 vs $1.1462 held. models.ui-evaluator back to opus/sonnet/sonnet"
  - "P4 REVERT under section 2: item lost, hub HU-A01 (Sonnet 2 of 2, Haiku 0 of 2); focus.project-researcher.architecture back to opus/sonnet/sonnet"
  - "P5 KEEP: no item lost, pooled recall 39/44 vs 42/44 (6.8 points), fabrications 0 vs 0"
  - "S1 is kept until batch E is scored (the dispatch's rule), not deleted at the end of 82-08 as the TRD's Task 3 says"

patterns-established: []

requirements-completed: [SC-3]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 43min
completed: 2026-10-18
---

# Objective 82 TRD 08: Live tier checks D and C Summary

**Batches D (123 UI-judge sessions) and C (16 researcher runs, 16 blind grader runs) ran live for $4.04 of the
raised $25 cap, every run in the opaque sandbox with no escape. By the pre-registered rules P1 (UI judge starts at
haiku) is reverted because one broken state ended ok, P4 (researcher architecture at haiku on budget) is reverted
because Haiku lost one item Sonnet found twice, and P5 (pitfalls) is kept.**

## Progress
- [x] Task 1: Confirm spend for batches D and C — c2c99c2c
- [x] Task 2: Run batch D (start, then escalations) and batch C (researchers, then graders) — 74e2954d
- [x] Task 3: Score, apply the pre-registered verdicts, revert what fails, publish 82-TIER-CHECKS.md — f98d7230, 3732d4c5, 22324411, 73b392bd, dd42d22a

## Performance

- **Duration:** about 43 min (11:05Z to 11:48Z)
- **Live runs:** 11:07:26Z to 11:43:00Z, 155 sessions, sequential
- **Tasks:** 3 of 3
- **Spend:** $4.037729 of $25 (D $1.279572 of $4.5, C $2.758157 of $3.5)

## User gate decision (2026-10-18)

Given in the dispatch, before any spend: **"Go D, C, E at cap $25"**. The approval covers 82-08's gate (D and C)
and 82-09's gate (E's two 3.1.0 builds). Executed as "go D C cap 25": `ledger82 --raise --cap 25 --e-cap 15
--reason 'user (2026-10-18): Go D, C, E at cap $25'`.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` (objective 82 manifest) | exit 0: OK, 25 files, 817bc181... |
| `prereg.cjs --check` (objective 81 manifest) | exit 0: OK, 86 files, 70f92eca... |
| token file | present (`test -s` only) |
| tree under test | HEAD 5cea8f008344978c1569551944e1a2c549a889c7 (`integrate/3.1.0`); S1 `trees.json` 3.1.0 = the same sha |
| Claude Code | 2.1.302, the same as both manifests' `claude_version` |
| sandbox root S1 | `/private/tmp/claude-501/e82-700b16eaf4b9d141` (opaque, created and exported before this run) |
| D dry run (on record) | D-d01-h-1 argv names `<S1>/runs/D/D-d01-h-1/work/d01.png` |
| C dry run (on record) | C82-res-gateway-architecture-h-1 argv carries `AOForge runtime: <S1>/runs/C/<id>/home/.claude/aoforge` |
| ledger before | $0 of $20; D $4.5, C $3.5, E $12 |

### Build-2 fit at the gate (before the raise)

| Case | D | C | build 1 | build-2 reserve | total vs cap | E batch |
|---|---:|---:|---:|---:|---|---|
| worst | 4.5 | 3.5 | 6.5 | 8.125 | 22.625 of 20 (over by 2.625) | 13 of 12 (over) |
| expected | 3.8 | 2.6 | 4.72 | 8.125 | 19.245 of 20 (fits, 0.755 spare) | 11.22 of 12 (fits) |

Break-even build-1 cost: 3.875 (D and C at caps), 5.475 (at estimates). Build 2 guaranteed: no.

### After the raise (cap $25, E $15)

| Case | total vs cap | E batch |
|---|---|---|
| worst | 22.625 of 25 (fits, 2.375 spare) | 13 of 15 (fits) |
| expected | 19.245 of 25 (fits, 5.755 spare) | 11.22 of 15 (fits) |

Break-even build-1 cost: 8.5. **Build 2 guaranteed: yes.**

## Task 2: batches D and C live

Runner: `EVAL82_SANDBOX_ROOT=<S1> node scripts/eval81/run.cjs --batch <D|C> --root <R> --token-file <T>
--batch-dir scripts/eval82/batches --results-dir <O>/results --sandbox-root <S1> --repo <checkout> --raw`, from the
repo root, one invocation at a time. The checkout was not touched while a runner ran (D was scored into a scratch
`--out` while C ran).

| Invocation | Exit | Runs | Status | Spent | Ledger total | Tripwire | real / non-escape | Isolation |
|---|---|---|---|---:|---:|---|---|---|
| D start | 0 | 120 | 120 ok | $1.223450 | $1.223450 | no diffs | 0 / 0 | 120 sandbox project, 0 real |
| D escalations | 0 | 3 (D-d02-esc-1..3) | 3 ok | +$0.056122 | $1.279572 | no diffs | 0 / 0 | clean |
| D again | 0 | 0 | nothing pending; D complete | - | $1.279572 | - | - | - |
| C researchers | 0 | 16 | 16 ok, tools check ok, 0 impaired, 16 documents | $1.603117 | $2.882689 | no diffs | 0 / 0 | clean |
| C graders | 0 | 16 | 16 ok | +$1.155040 | $4.037729 | no diffs | 0 / 0 | clean |
| C again | 0 | 0 | nothing pending; C complete | - | $4.037729 | - | - | - |

- **Escalations:** the engine's rules escalated one state (d02: haiku 2 ok / 1 broken, review). The TRD expected
  about 6-8 states from 81's 40% split rate; batch D's per-state haiku sessions split on 2 of 20 states (d02, d08)
  and the engine escalated only d02 (d08's haiku outcome was pass).
- **Screenshot path:** all 120 live D prompts (`argv.json`) name `<S1>/runs/D/<id>/work/<state>.png`; D-d01-h-1's
  transcript Reads exactly that path. No `screenshot_path: relative`.
- **C runtime line:** all 16 researcher prompts carry `AOForge runtime: <S1>/runs/C/<id>/home/.claude/aoforge`; the
  hand-checked researcher (C82-res-hub-architecture-h-1) read `references/research-tooling.md` and
  `templates/research-project/ARCHITECTURE.md` under that root.
- **Ledger after D and C:** $4.037729 of $25 (D $1.279572 of $4.5, C $2.758157 of $3.5). E has its $15 batch cap and
  $20.962271 of global room.

### Guessed-path scan (`guessed-paths.cjs --root <R> --batch <X> --raw`), after each invocation

| Scan | Runs | Scanned (files > 0 and tool uses > 0) | tilde | guessed_home | real | guessed_nonexistent | tilde_denied |
|---|---:|---:|---:|---:|---:|---:|---:|
| D after start | 120 | 120 | 0 | 0 | 0 | 0 | 0 |
| D after escalations | 123 | 123 | 0 | 0 | 0 | 0 | 0 |
| C after researchers (researcher rows) | 16 | 16 | 0 | 0 | 0 | 0 | 0 |
| C after graders (all rows) | 32 | 32 | 0 | 0 | 0 | 0 | 0 |

## Task 3: verdicts (82-TIER-CHECKS.md)

| Proposal | Verdict | Deciding clause | Applied |
|---|---|---|---|
| P1 (UI judge starts at haiku) | **REVERT** | broken_missed(Haiku start, final) = 1 of 13 broken states (d17), needs 0 | `models.ui-evaluator` opus/sonnet/sonnet (3732d4c5 RED, 22324411 GREEN) |
| P4 (researcher architecture at haiku on budget) | **REVERT** | item lost: hub HU-A01 (Sonnet 2 of 2 runs, Haiku 0 of 2) | `focus.project-researcher.architecture` opus/sonnet/sonnet (73b392bd RED, dd42d22a GREEN) |
| P5 (researcher pitfalls at haiku on budget) | **KEEP** | no item lost, pooled recall 39/44 vs 42/44 (6.8 points), fabrications 0 vs 0 | nothing; model-profiles.md records the result |
| SC-2 (researcher runs) | **PASS** | 16 runs scanned; tilde 0, guessed_home 0, real 0, guessed_nonexistent 0, tilde_denied 0 | - |

### P1 (batch D)

| Metric | Haiku start (P1) | Sonnet start |
|---|---|---|
| accuracy | 19/20 (95.0%, 76.4%-99.1%) | 18/20 (90.0%, 69.9%-97.2%) |
| broken_missed (false ok) | 1/13 (d17) | 1/13 (d17) |
| false_fail (false broken) | 0/7 | 1/7 (d20, labelled ok: 1 ok / 2 broken) |
| split rate | 2/20 (d02, d08) | 1/20 |
| escalation rate | 1/20 (5.0%, 0.9%-23.6%); ok-labelled 1/7 | 0/20 |
| escalated-run outcome | d02: 3 sonnet sessions, 3 ok / 0 broken, final ok (label ok, correct); agrees with the Sonnet start 1/1 | - |
| cost | $0.1334 ($0.0773 samples + $0.0561 escalations) | $1.1462 (no opus escalation to estimate) |

d17 (labelled broken) was judged ok by all three haiku and all three sonnet sessions: the rule's absolute clause
(needs 0) fails for both starts, but only the Haiku start is under test, so P1 reverts and the judge returns to a
sonnet start that missed the same state.

### P4 and P5 (batch C, two new topics)

| Dimension | Topic | Haiku recall | Sonnet recall | Fabrications h / s |
|---|---|---|---|---|
| architecture | gateway | 24/24 | 23/24 | 0 / 0 |
| architecture | hub | 19/22 | 22/22 | 0 / 0 |
| architecture | pooled | 43/46 (93.5%) | 45/46 (97.8%) | 0 / 0 per run |
| pitfalls | gateway | 21/22 | 22/22 | 0 / 0 |
| pitfalls | hub | 18/22 | 20/22 | 0 / 0 |
| pitfalls | pooled | 39/44 (88.6%) | 42/44 (95.5%) | 0 / 0 per run |

Objective 81's topic (notesearch, context, not voting): architecture haiku 21/22 vs sonnet 17/22; pitfalls 22/22 vs
21/22. Cost per researcher run: haiku $0.015-$0.073, sonnet $0.128-$0.193.

### Hand checks

- **D state d02 by hand** (records): D-d02-h-1 broken, h-2 ok, h-3 ok; D-d02-esc-1..3 ok, ok, ok; escalation charges
  0.019674 + 0.018224 + 0.018224 = $0.056122. Agrees with D.json (2 ok / 1 broken, review, escalated, 3 ok / 0
  broken, final ok, escalations $0.0561).
- **C graders by hand** (records): HU-A01 missing in both hub-architecture haiku grades, found in both sonnet grades;
  HU-A08 found h-1, missing h-2, found s-1 and s-2; each grade lists 11 items. Agrees with C.json / C.md (HU-A01 2/2
  vs 0/2; HU-A08 2/2 vs 1/2).
- **Spend:** results/D.json `spend.spent_usd` 1.279572 and results/C.json 2.758157 equal the ledger's D and C
  `spent_usd`.
- **Guessed paths:** 82-TIER-CHECKS.md's section lists the 16 researcher runs with the scan's counts (all 0), as
  recorded after each invocation; `grep -c '"file_path":"~'` and `grep -c '"file_path":"/Users/'` over
  C82-res-hub-architecture-h-1's transcripts both print 0.
- **Determinism:** `score.cjs --rules` re-run leaves `git status` unchanged (identical bytes).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Gate | both `prereg.cjs --check` (OK 25, OK 86); `test -s <T>`; `ledger82 --fit` before and after `--raise` (build 2 guaranteed: yes) | 0 | PASS |
| 2: D and C live | `run.cjs --batch D` x3 and `--batch C` x3: exit 0 each, ledger D and C `complete`, total $4.037729 <= $25, `tripwire.diffs` [] on every invocation, 0 `real` access; `guessed-paths.cjs` after each invocation, every run scanned | 0 | PASS |
| 3: Score and verdicts | `score.cjs --batch D`, `--batch C`, `--rules` (P1 REVERT, P4 REVERT, P5 KEEP, SC-2 PASS); hand checks above; reverts RED then GREEN; `--rules` re-run identical | 0 | PASS |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (P1) | `node --test --test-name-pattern 'P1-' plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs` (0/2) | 1 | FAIL (correct) |
| GREEN (P1) | `node --test plugins/aoforge-stack-flutter/lib/*.test.cjs` (284/284) | 0 | PASS (correct) |
| RED (P4) | `node --test plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs` (37/39) | 1 | FAIL (correct) |
| GREEN (P4) | same (39/39) | 0 | PASS (correct) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (scoped, scratch HOME and TMPDIR) | `node --test plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs` (39/39) and `node --test plugins/aoforge-stack-flutter/lib/*.test.cjs` (284/284) | 0 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The P1 RED test asserted `model: 'opus'` for an opus escalation**
- **Found during:** Task 3 (P1 GREEN)
- **Issue:** `resolve-model --escalate-from sonnet` returns tier `opus` with model `inherit` (`init.cjs` `tierAlias`),
  so P1-2 stayed red after the manifest change.
- **Fix:** the assertion is `up.model === 'inherit'`, with the tier still `opus`, in the GREEN commit.
- **Files modified:** plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs
- **Commit:** 22324411

### Other deviations

- **S1 kept:** the TRD deletes S1 at the end of Task 3; the dispatch says to delete `/private/tmp/claude-501/e82-*`
  only after E is scored, so S1 stays until 82-09 is scored.
- **Task 1's dry runs** were already on record in R (dated 03:44Z, the same S1 and tree); they were checked, not
  re-run. Their dirs were renamed `.prev-1` by the live runner.
- **`--repo <checkout>`** was passed explicitly on every runner call (the TRD's command relies on the cwd).

## Issues Encountered

- **MEF-06 stays open.** Its UI-judge start-tier half was measured here and failed (P1 reverted: the judge starts at
  sonnet), and its debugger start tier is out of scope (a recorded todo). `requirements mark-complete` was not run
  for it; SC-3 is an objective success criterion, not a REQUIREMENTS.md row. (The first post of this SUMMARY listed
  MEF-06 as completed; it was re-posted in local mode with that corrected.)

- `scripts/eval81/score.test.cjs` "--report reads the tiers from this checkout and never changes them" still fails
  after the reverts (it predates this TRD, see 82-06's SUMMARY). `scripts/eval81/**` is frozen; left for 82-10.

## Discovered commands

None. The commands come from the TRD.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 6/6 (gate shown with the fit table and the user's word; D 120 + 3 escalations and C 16 + 16
  in the sandbox with no escape; 82-TIER-CHECKS.md with each verdict and its clause; each REVERT test-first; SC-2's
  researcher-run verdict PASS from the transcript scan; every D prompt absolute)
- Gate failures: None
- Not done here: nothing pushed, tagged or released; nothing written to the real `~/.claude` or a fleet repo;
  `amp` untouched; no port opened.

## Self-Check: PASSED

- FOUND: results/D.json, D.md, C.json, C.md and 82-TIER-CHECKS.md (`git ls-files`).
- FOUND commits: c2c99c2c, 74e2954d, f98d7230, 3732d4c5, 22324411, 73b392bd, dd42d22a.
- FOUND: ledger D and C `complete`, total $4.037729; both prereg checks OK after the reverts.
