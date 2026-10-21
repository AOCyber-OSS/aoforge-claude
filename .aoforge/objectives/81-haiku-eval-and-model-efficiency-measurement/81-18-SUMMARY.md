---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "18"
subsystem: testing
tags: [eval, live, batch-c, codebase-mapper, project-researcher, grader, post-hoc]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRD 81-17)
    provides: "batch E complete, ledger $32.628238, post-hoc 3 opaque sandbox root"
provides:
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json and C.md: batch C scored (8 roles x 2 models, 45 runs scored, 1 impaired, 2 model_ran false) with the spend block that rebuilds the ledger"
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C-spotcheck.md: 6/6 grader verdicts agree"
  - "Post-hoc 4: lib/access.cjs (access classes), impaired runs re-run once, scorer excludes final impaired runs; manifest 70f92eca"
affects: [81-19]

tech-stack:
  added: []
  patterns:
    - "Chunked live runs (--stop-after 4) driven by a scratch driver that reads each record's access classes between chunks"

key-files:
  created:
    - scripts/eval81/lib/access.cjs
    - scripts/eval81/lib/access.test.cjs
    - scripts/eval81/run-access.test.cjs
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C-spotcheck.md
  modified:
    - scripts/eval81/lib/runner.cjs
    - scripts/eval81/score/C.cjs
    - scripts/eval81/score/C.test.cjs
    - scripts/eval81/run.test.cjs
    - scripts/eval81/README.md
    - scripts/eval81/__fixtures__/fake-claude.cjs
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json

key-decisions:
  - "Post-hoc 4 (user: 'Reclassify + re-run impaired'): ~-expansion denials and guessed non-existent paths are non-escapes; an existing real path outside the sandbox stops the batch; a run whose own ~/.claude files were denied is re-run once, then excluded as impaired"
  - "C was run in chunks of 4 so any stop would land between runs"
  - "The opaque sandbox root /private/tmp/claude-501/e81-5752f4931a905580 was deleted after C, as the user directed (the Go module cache needed chmod u+w first)"

patterns-established:
  - "Access classification (lib/access.cjs) is part of every run record from post-hoc 4 on"

requirements-completed: []

verification:
  gates_defined: 4
  gates_passed: 4
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 85min
completed: 2026-10-17
---

# Objective 81 TRD 18: Live batch C (mapper and researcher) Summary

**Batch C completed: 48 agent runs, 2 impaired re-runs and 46 graders, for $7.42 (ledger $40.05 of $100). No real
escape occurred. One run is final-impaired and two sonnet stack researchers fail the model_ran rule. On mapper
recall haiku and sonnet split by focus: tech and concerns favour sonnet, arch and quality favour haiku. The
researchers are close, except sonnet's architecture dimension.**

## Progress
- [x] Task 1: Confirm spend for batch C — 759016dd
- [x] Task 2: Run batch C live (agents, then graders) — 611b2c17 (the stop), 2258d733 (post-hoc 4), 10177455
- [x] Task 3: Score, spot-check and commit batch C — 0a5632ab

## Performance

- **Duration:** about 85 min (21:18Z to 22:43Z), including the stop and post-hoc 4.
- **Batch C wall time:**
  - the first 12 runs 21:19Z to 21:31Z;
  - the rest 21:46Z to 22:33Z.
- **Spend:** batch C $7.424253 (no batch cap); ledger $40.052491 of $100.

## User gate decisions (2026-10-17)

1. **"Go E rest and C":** C's human-action gate is satisfied. Run mapper, project-researcher and graders on the
   remaining budget, score, commit, and stop before 81-19.
2. **After the stop at 12 of 48, "Reclassify + re-run impaired":**
   - (a) a `~`-expansion denial and a guessed non-existent path are non-escapes, redacted;
   - (b) a real escape still stops C;
   - (c) runs whose own templates or references were denied are re-run once, and if still impaired they are excluded
     from the model rates and reported apart;
   - then finish C, score, commit, delete `e81-*`, and stop before 81-19.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 85 files (8080f63b) at the gate; 86 files (70f92eca) after post-hoc 4 |
| token file | present (`test -s` only) |
| private data out of R | `R/fleet` and `R/d-capture` absent |
| dry run C | exit 0: 48 agent runs (fleet included, private hash verified), caps $74.1976, reserves $92.747, estimate $28, ledger $32.628238 |

## The stop and post-hoc 4 (81-PREREG section 9.4, commit 2258d733)

- **The stop.** After 12 runs, two fleet sonnet mappers had a Bash `cd ~/.claude/aoforge/templates/codebase` denied.
  The CLI applies the real-home deny rule to `~` in Bash. Three runs also tried guessed homes that do not exist. I
  stopped and reported.
- **`lib/access.cjs`, written test-first.** RED 6 failures, then GREEN; the suite passed 510/510.
  - It classifies every tool input path, reading Bash through shell-words with data arguments ignored.
  - The runner records `access` and `impaired` on every run.
  - It stops (exit 5) on a real escape.
  - It re-runs an impaired run once, charging the first attempt as `<id>@impaired<n>`.
  - `score/C.cjs` excludes a final impaired run and lists it under `impaired`.
  - `run.test.cjs` 20 now expects a denied read of an existing deny-root file to stop the batch.
- **Reclassification of the first 12 runs.** No real escape. The two runs were impaired, re-keyed and re-run once:
  - C-map-arch-b-s-1 came back clean;
  - C-map-quality-b-s-1 was denied again, so it is final and impaired.

## Task 2: the rest of C

- **Runs.** 23 driver chunks ran 34 agent runs, 2 re-runs and 46 graders. Every runner exit was 0, and batch C is
  `complete`.
- **Accesses, over every final record:**
  - real escapes: 0;
  - tilde denials: 1;
  - accesses to guessed, non-existent homes: 13, all invented names and never the real one.
- **Checks.** Tools check ok on every agent run, isolation and tripwire clean.
- **Graders.** 46 of 48. The two sonnet stack researchers got none: they are `model_ran false`, because the CLI ran
  about 18% of their output on haiku as a side model, alongside their WebFetch and WebSearch calls.

## Batch C result (results/C.json)

| Role | haiku recall | sonnet recall | haiku error | sonnet error | haiku fabrications/run | sonnet fabrications/run |
|---|---|---|---|---|---|---|
| mapper tech | 45/46 | 46/46 | 1/46 | 0/46 | 4.25 | 10.25 |
| mapper arch | 41/46 | 39/46 | 1/46 | 1/46 | 3.00 | 0.75 |
| mapper quality | 38/44 | 29/33 (3 of 4 runs; 1 impaired) | 3/44 | 1/33 | 2.00 | 1.33 |
| mapper concerns | 21/38 | 26/38 | 2/38 | 0/38 | 1.25 | 1.50 |
| researcher stack | 18/20 | 0/0 (2 model_ran false) | 0/20 | - | 0.50 | - |
| researcher features | 21/22 | 22/22 | 1/22 | 0/22 | 0.50 | 0.00 |
| researcher architecture | 21/22 | 17/22 | 0/22 | 0/22 | 0.00 | 0.00 |
| researcher pitfalls | 22/22 | 21/22 | 0/22 | 0/22 | 0.00 | 0.00 |

Mapper recall by codebase (haiku / sonnet):

| Focus | synthetic | fleet |
|---|---|---|
| tech | 22/22 / 22/22 | 23/24 / 24/24 |
| arch | 21/22 / 20/22 | 20/24 / 19/24 |
| quality | 21/22 / 20/22 | 17/22 / 9/11 |
| concerns | 14/16 / 16/16 | 7/22 / 10/22 |

- **Cost:** agents haiku $0.83, sonnet $2.81; graders $2.88.
- **Fabrications** count the grader's and the mechanical path check's together. Fleet tech is inflated by Go module
  import paths that the path check reads as missing files (see C-spotcheck.md).
- **Excluded:**
  - C-map-quality-b-s-1 (impaired);
  - C-res-stack-s-1 and C-res-stack-s-2 (model_ran false).
- **Spend block:** `spend.spent_usd` is 7.424253, equal to the ledger's batch C. Status complete, 96 entries.
- **Leak checks:** `rg -i -e aoedge -e aocybersystems <O>/results` and a scan for the username both found nothing.

## Spot-check (results/C-spotcheck.md)

6 of 6 grader verdicts agree. The picks are S1-S6, seed 81: features-10, features-08, concerns-04, tech-11, arch-06 and
concerns-10. Fleet items are listed by id and verdict only.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Gate | `prereg --check`, `test -s <T>`, `run.cjs --batch C ... --sandbox-root S --dry-run --materialize none --raw` | 0 | PASS |
| 2: Batch C live | `c-driver.cjs` (`run.cjs --batch C ... --sandbox-root S --stop-after 4 --raw` x 23), ledger batch C `complete`, tripwire clean | 0 | PASS |
| 3: Score and commit | `score.cjs --batch C`; C.json spend 7.424253 = ledger; leak checks empty; commit scan empty; `prereg --check` OK; `git show --stat` = the three files (0a5632ab) | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81) | `TMPDIR=<scratch> node --test 'scripts/eval81/**/*.test.cjs'`: 510/510 | 0 | PASS |
| prereg | `prereg.cjs --check`: OK, 70f92eca... (86 files) | 0 | PASS |
| leak check | `rg -n -i -e aoedge -e aocybersystems <O>/results`: no match | 1 (no match) | PASS |
| commit scan | the token scan over every committed file: no output | 0 | PASS |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (post-hoc 4) | `node --test lib/access.test.cjs run-access.test.cjs score/C.test.cjs`: 6 fail | 1 | FAIL (correct) |
| GREEN (post-hoc 4) | same: 25/25; full suite 510/510 after `run.test.cjs` 20 was updated to the new rule | 0 | PASS (correct) |

## Task Commits

1. `759016dd`: the gate.
2. `611b2c17`: 12 runs and the stop.
3. `2258d733`: post-hoc 4 (fix), the code, tests, README, PREREG 9.4 and manifest.
4. `10177455`: the rest of C.
5. `0a5632ab`: `docs(81-18): batch C mapper and researcher results`, exactly the three files.

## Deviations from Plan

### User-approved post-hoc deviation
**Post-hoc 4: access classes and impaired re-runs** (2258d733, 81-PREREG section 9.4). One frozen file was added and
three changed. The scoring change only excludes final-impaired runs.

### Auto-fixed Issues
**1. [Rule 3 - Blocking] The between-chunk scan first matched paths QUOTED in documents written into the sandbox**
- **Fix:** It was narrowed to access fields and Bash commands, with heredocs removed. After post-hoc 4 the runner's
  own classification replaced it.

**2. [Rule 3 - Blocking] `rm -rf` of the sandbox root failed on the read-only Go module cache**
- **Cause:** One researcher run downloaded Go modules into its sandbox HOME.
- **Fix:** `chmod -R u+w` first, then delete.

**Total deviations:** 1 user-approved post-hoc, 2 auto-fixed.

## Findings for the user

1. **No real escape in C.**
   - The `~` denial is a CLI behaviour: it checks `~` in Bash against the real home, while the shell uses the sandbox
     HOME. It cost one run (quality-b-s-1), which was impaired twice.
   - Guessed homes do not exist and reach nothing.
2. **The mapper comparison depends on the focus.**
   - sonnet leads on concerns (26/38 vs 21/38) and tech (46/46 vs 45/46).
   - haiku leads on arch (41/46 vs 39/46) and quality (38/44 vs 29/33).
   - Fleet concerns is weak for both: 7/22 and 10/22.
3. **Researchers:**
   - haiku 18/20 on stack, where sonnet has no score (model_ran false);
   - features 21/22 vs 22/22;
   - architecture 21/22 vs 17/22;
   - pitfalls 22/22 vs 21/22.
4. **Two scoring caveats for 81-19.**
   - The mechanical path check counts Go module paths as fabrications, which inflates sonnet's fleet tech count.
   - The model_ran 0.9 rule excludes runs whose CLI side model (haiku) took a share of the output, which leaves
     sonnet's stack cell INSUFFICIENT.
5. **Cost.** haiku agents cost about 30% of sonnet's ($0.83 vs $2.81).

## Post-TRD Verification

- **Auto-fix cycles used:** 0.
- **Must-haves verified:** 4 of 4.
  1. The go is recorded.
  2. C ran last, within $100, with the fleet source tripwired and unchanged.
  3. Per role and model: recall, error, missing and fabrications with n, and the per-codebase split. No private
     content was committed.
  4. The 6-verdict spot-check is committed as agreement counts.
- **Gate failures:** none.
- **Real home, fleet and checkout:**
  - nothing was written;
  - `amp` was untouched;
  - nothing was pushed;
  - `e81-*` is deleted.
- **81-19:** not started.

## Self-Check: PASSED

- **Files.** results/C.json, C.md and C-spotcheck.md are committed in 0a5632ab. lib/access.cjs and its tests are
  committed in 2258d733.
- **Commits found:** 759016dd, 611b2c17, 2258d733, 10177455, 0a5632ab.
- **Ledger.** `R/ledger.json`: A, B, D, E and C all `complete`, total $40.052491.
- **Manifest.** `prereg.cjs --check` exits 0 at HEAD (70f92eca...).
- **Sandbox root.** `/private/tmp/claude-501/e81-*` no longer exists.
