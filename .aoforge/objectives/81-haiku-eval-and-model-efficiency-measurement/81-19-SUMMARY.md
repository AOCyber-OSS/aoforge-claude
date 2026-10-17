---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "19"
subsystem: testing
tags: [eval, report, 76-06, 76-08, haiku, sonnet, proposals, post-hoc]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRDs 81-14 to 81-18)
    provides: "results/A-E.json scored, spot-checks, 81-MEASUREMENT.md, ledger $40.052491, post-hoc amendments 1-4"
provides:
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md: the 76-06 report (generated part plus hand sections: spend, spot-checks, post-hoc readings, deviations, limitations, 76-08, recommendation per role, proposals, decision)"
  - "76-VERIFICATION.md / 76-RETROACTIVE-SUMMARY.md / ROADMAP.md / REQUIREMENTS.md: 76-06 closed, 76-08 measurement closed with its start-tier half not met; MEF-05 SATISFIED, MEF-06 PARTIALLY SATISFIED"
  - "Five follow-up todos, one per approved proposal (P1, P2 arch-only, P3, P4, P5)"
affects: [objective 76, objective 81 verification, the tier follow-up work]

tech-stack:
  added: []
  patterns:
    - "Post-hoc readings sit beside the registered outcome in their own labelled section; the generated report is never edited"

key-files:
  created:
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md
    - .aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-ui-evaluator.md
    - .aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-codebase-mapper-arch.md
    - .aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-codebase-mapper-concerns.md
    - .aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-project-researcher-architecture.md
    - .aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-project-researcher-pitfalls.md
  modified:
    - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
    - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md
    - .aoforge/ROADMAP.md
    - .aoforge/REQUIREMENTS.md

key-decisions:
  - "Objective 81 tier proposals: user approve-selected P1 (ui-evaluator Haiku start, escalation rate to be measured on real projects), P2 arch-only (new focus.codebase-mapper.arch at Sonnet), P3 (concerns budget to Sonnet), P4 and P5 (researcher architecture/pitfalls budget to Haiku, with a follow-up measurement); P2's quality half not approved; nothing applied in objective 81"
  - "MEF-06 recorded PARTIALLY SATISFIED: escalation done, start-tier half not met (tiers unchanged; the UI judge's Haiku start is an approved follow-up todo, the debugger's start tier was not measured)"
  - "C's mechanical fabrication check counts Go module paths and other non-file tokens; read by hand, 3 of its 86 flags are real path errors, so the mapper quality refusal rests on artefacts and the arch refusal is borderline (post-hoc reading, registered outcomes unchanged)"

patterns-established: []

requirements-completed: []

verification:
  gates_defined: 3
  gates_passed: 3
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: false

duration: 18min
completed: 2026-10-17
tokens_input: 31190307
tokens_output: 120424
tokens_cache_read: 30845408
tokens_cache_write: 344657
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 19: The 76-06 report, the 76 records, and the tier-change proposals Summary

**The Haiku 5.5 vs Sonnet 5.5 eval is reported per role under the pre-registered rule, with n, Wilson intervals,
spend ($40.05 of $100), spot-checks, every post-hoc amendment and labelled sensitivity lines. 76-06 is closed, 76-08's
measurement is closed with its start-tier half not met, and the user approved five tier proposals as follow-up todos.
No tier was changed.**

## Progress
- [x] Task 1: Render and complete the 76-06 report — 2df8194c
- [x] Task 2: Record 76-06 and 76-08 in objective 76's records — 51952035
- [x] Task 3: Decide on the tier-change proposals (checkpoint:decision) — the user chose approve-selected "P3, P2-arch-only, P1, P4, P5" (no commit of its own)
- [x] Task 4: Record the decision, create approved todos, tidy the eval trees — 7e4fb636

## Performance

- **Duration:** about 18 min (22:45Z to 23:03Z), including the decision checkpoint.
- **Tasks:** 4 of 4 (one of them a checkpoint:decision).
- **Spend:** $0. This TRD made no live run.

## Results per role (registered outcomes)

| Role | Haiku | Sonnet | Outcome |
|---|---|---|---|
| verifier | 9/9 detection, 0/9 false passes | 9/9 | WEAK_ENDORSE (ceiling) |
| job-checker | 9/12 | 11/12 | REFUSE (-16.7) |
| ui-evaluator | 18/20 | 20/20 | WEAK_ENDORSE (exactly -10.0) |
| codebase-mapper tech | 45/46 | 46/46 | WEAK_ENDORSE |
| codebase-mapper arch | 41/46 | 39/46 | REFUSE (fabrications 3.00 vs 0.75 per run) |
| codebase-mapper quality | 38/44 | 29/33 | REFUSE (fabrications 2.00 vs 1.33 per run) |
| codebase-mapper concerns | 21/38 | 26/38 | REFUSE (-13.2) |
| project-researcher stack | 18/20 | not scored (side-model exclusion) | INSUFFICIENT |
| project-researcher features | 21/22 | 22/22 | WEAK_ENDORSE |
| project-researcher architecture | 21/22 | 17/22 | WEAK_ENDORSE (+18.2) |
| project-researcher pitfalls | 22/22 | 21/22 | WEAK_ENDORSE (+4.5) |

## Decision (Task 3)

**Option chosen: approve-selected**, in the user's words "P3, P2-arch-only, P1, P4, P5".

| Proposal | Decision | Todo |
|---|---|---|
| P1 ui-evaluator: Haiku start on balanced and budget | approved; the escalation rate must be measured on real projects before or while it is applied | `2026-10-17-apply-objective-81-tier-proposal-ui-evaluator.md` |
| P2 codebase-mapper | approved as arch-only: a new `focus.codebase-mapper.arch` at Sonnet. The quality half was not approved. | `2026-10-17-apply-objective-81-tier-proposal-codebase-mapper-arch.md` |
| P3 codebase-mapper:concerns: budget to Sonnet | approved | `2026-10-17-apply-objective-81-tier-proposal-codebase-mapper-concerns.md` |
| P4 project-researcher:architecture: budget to Haiku | approved, with a follow-up measurement (n is 2 runs per model, and it reverses a 76 raise) | `2026-10-17-apply-objective-81-tier-proposal-project-researcher-architecture.md` |
| P5 project-researcher:pitfalls: budget to Haiku | approved, with the same follow-up measurement | `2026-10-17-apply-objective-81-tier-proposal-project-researcher-pitfalls.md` |

The advisory reading at the checkpoint differed on P1, P4 and P5 (hold). It is recorded beside the decision in
81-HAIKU-EVAL.md.

## The 76 records

- **76-VERIFICATION.md.**
  - Deferred 76-06: `state: closed`, `criterion_state: met`, with evidence.
  - Deferred 76-08: `state: closed`, `criterion_state: not_met`, with evidence.
  - MEF-05 is SATISFIED. MEF-06 is PARTIALLY SATISFIED; its row records P1's approval and that it is not applied.
  - A dated "Closed by objective 81" paragraph sits under the Gaps Summary.
- **76-RETROACTIVE-SUMMARY.md.** `requirements-completed` is now MEF-01..05, equal to the SATISFIED rows. The "Still
  open" section is rewritten.
- **ROADMAP.md.** The 76-06 and 76-08 rows are ticked, and objective 76's Progress row is 8/8, still In Progress.
- **REQUIREMENTS.md.** MEF-05 is Complete and MEF-06 is Partial.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Report | `prereg.cjs --check` OK (86 files, 70f92eca); `score.cjs --report --out <O>`; `rg "No tier assignment was changed"` matches; the summary table has all 11 roles with both models, n, CIs and an outcome; leak check (username, fleet names) empty | 0 | PASS |
| 2: 76 records | `validate requirements --objective 76`: agrees (5 checked); `validate health`: healthy, 0 warnings; the `git diff .aoforge/ROADMAP.md` touched only the two 76 rows and the 76 Progress row; the YAML of 76-VERIFICATION's deferred block parses | 0 | PASS |
| 3: Decision | the user's choice recorded in 81-HAIKU-EVAL.md `## Decision (2026-10-17)` and here | - | PASS |
| 4: Decision, todos, trees | `git status --porcelain .aoforge/todos` shows exactly the five new todos; `git worktree list` no longer lists `<R>/trees/v3.0.0` or `<R>/trees/v3.1.0`; `git diff HEAD~1 --stat` (7e4fb636) touches no tier file | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| requirements and roadmap tests | `node --test requirements-agreement.test.cjs requirements-agreement.repo.test.cjs validate-requirements.test.cjs misc-requirements.test.cjs roadmap-reconcile.test.cjs`: 122/122 | 0 | PASS |
| repo guards and model profiles | `node --test 'plugins/aoforge/**/*.repo.test.cjs' 'scripts/**/*.repo.test.cjs' plugins/aoforge/hooks/planning-writes.audit.test.js requirements-agreement.test.cjs validate-requirements.test.cjs model-profiles.test.cjs`: 438/438 (372/372 for the guards alone after Task 2) | 0 | PASS |
| eval81 report path | `node --test scripts/eval81/score.test.cjs lib/decide.test.cjs lib/report.test.cjs lib/stats.test.cjs`: 81/81 | 0 | PASS |
| validate | `validate health`: healthy, 0 warnings, 0 errors; `validate requirements`: agrees (70 objectives, 51 requirements); `validate requirements --objective 76`: agrees | 0 | PASS |
| commit scan | the 81-14 token scan over every path of every commit's `--files` list: no output | 0 | PASS |
| prereg | `prereg.cjs --check`: OK, 70f92eca (86 files) | 0 | PASS |

## Task Commits

1. **Task 1:** `2df8194c`, `docs(81-19): 76-06 Haiku eval report`.
2. **Task 2:** `51952035`, `docs(81-19): record 76-06 and 76-08 from objective 81`.
3. **Task 4:** `7e4fb636`, `docs(81-19): record the tier-proposal decision`.

## Decisions Made

- **Hand-written sections only below the generated report.** They are marked by an HTML comment. Every view that
  differs from the registered outcome is labelled post-hoc.
- **Sonnet's stack-researcher cell is "not scored".** Its sensitivity line comes from my hand grading of the two
  excluded documents against the frozen checklist, because this TRD runs no live grader. With them included: 19/20,
  which would be a WEAK_ENDORSE.
- **A Go module path is a path that equals, or is a `/`-bounded suffix of, a module in the codebase's `go.mod` or
  `go.sum`.** 39 of the 86 mechanical flags are module paths (Sonnet 34, Haiku 5).
- **The 76-08 deferred item is closed with `criterion_state: not_met`.** The measurement itself is done; lowering
  the starting tiers is not. MEF-06 is PARTIALLY SATISFIED, so it left `requirements-completed`, which lists only
  the SATISFIED rows.
- **Objective 76's Progress row is 8/8 but stays In Progress.** The objective-level line (ROADMAP line 130) was
  outside this TRD's edit scope, so completing objective 76 is left to the orchestrator or the user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Todo `created` timestamps were later than the time they were written**
- **Found during:** the final SUMMARY. The todos said 23:30Z; the time was 23:03Z.
- **Fix:** Each draft was corrected to 23:00Z and republished through `todo add` with the same `--stem`. The change
  went into the final metadata commit.
- **Files modified:** the five `.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-*.md`.

### Additions beyond the TRD text

**2. [Rule 2 - Missing critical functionality] Two more post-hoc readings of C's fabrication check**
- **Found during:** Task 1, while counting module paths.
- **Issue:** The arch and quality refusals rest entirely on the mechanical path check, and the synthetic flags I
  could read were mostly not fabrications.
- **Fix:** A grader-only column and a hand reading of all 86 flags were added beside the module-paths column the user
  asked for. Fleet items are counted, never quoted. The registered outcomes are unchanged.

---

**Total deviations:** 1 auto-fixed, 1 addition. No scorer, rule, result file or tier file was changed.

## Post-TRD Verification

- **Auto-fix cycles used:** 0.
- **Must-haves verified:** 5 of 5 truths.
  1. 81-HAIKU-EVAL.md has every role with both models, n, Wilson intervals, outcomes with reasons, proposals,
     spot-check agreement, deviations, ledger spend and a link to 81-MEASUREMENT.md.
  2. 76-06 and 76-08 are recorded with evidence. MEF-05 and MEF-06 are updated in all four records, and
     `validate requirements --objective 76` reports no finding.
  3. The proposals went to the user as a decision, and the choice is recorded. No `model-profiles.json` or stack-pack
     tier changed: `git log` on both files shows no 81 commit.
  4. Each approved proposal is a todo naming the file, key, current and proposed tier, and the evidence.
  5. The commit scan ran over every committed path and found nothing.
- **Artifacts:** 1 of 1.
- **Key links:** 2 of 2. 76-VERIFICATION.md names `81-HAIKU-EVAL` and `81-MEASUREMENT`.
- **Gate failures:** none.
- **Not touched:** `~/.claude`, the fleet, `amp`. No port was opened. Nothing was pushed, tagged or released.

## Self-Check: PASSED

- FOUND: 81-HAIKU-EVAL.md and the five todos, all tracked (`git ls-files`).
- FOUND commits: 2df8194c, 51952035, 7e4fb636.
- FOUND: `git worktree list` no longer lists the two eval trees. The rest of the eval root is left in place as
  evidence.
- No objective 81 commit touches `model-profiles.json` or `aoforge-stack.json`.
