---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "15"
subsystem: testing
tags: [eval, live, batch-b, job-checker, haiku, sonnet, ledger]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRD 81-14)
    provides: "batch A complete, ledger $2.691417, resized caps (B $10), relaxed init-tools rule"
provides:
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.json: batch B scored (job-checker, haiku and sonnet, 18/18 each) with the spend block that rebuilds the ledger"
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.md and results/B-spotcheck.md (5/6 agree, with sensitivity lines)"
affects: [81-16, 81-19]

tech-stack:
  added: []
  patterns:
    - "Spot-check pick: one run per planted set, one clean, one from the scorer's misses (seed 81)"

key-files:
  created:
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.json
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B-spotcheck.md
  modified: []

key-decisions:
  - "Batch B ran all 36 runs on the user's 'go B'; no pilot was needed (no cap risk at A's per-run costs)"
  - "The scorer's lexical misses on B6 are recorded as sensitivity lines in B-spotcheck.md; the frozen scorer is unchanged"

patterns-established: []

requirements-completed: []

verification:
  gates_defined: 3
  gates_passed: 3
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: false

duration: 15min
completed: 2026-10-17
---

# Objective 81 TRD 15: Live batch B (job-checker) Summary

**Batch B ran live: 36 of 36 job-checker runs ok for $1.13, ledger $3.82. Sonnet detected 11/12 planted defects
and Haiku 9/12, with no false alarms for either model (0/6). Haiku published VERIFICATION PASSED twice on the
uncovered-success-criterion set. Haiku cost about 1/17 of Sonnet.**

## Progress
- [x] Task 1: Confirm spend for batch B — cc4a804e
- [x] Task 2: Run batch B live — 9c69facd
- [x] Task 3: Score, spot-check and commit batch B — 707c1307

## Performance

- **Duration:** about 15 min (18:59Z to 19:14Z).
- **Batch B wall time:** 19:00:40Z to 19:09:55Z. Summed run wall time: haiku 268 s, sonnet 274 s.
- **Tasks:** 3 of 3.
- **Spend:** batch B $1.132036 of its $10 cap; ledger $3.823453 of $100.

## User gate decision (2026-10-17)

"go B": run all 36 B runs within its $10 cap, score, commit results/B.json (token scan first). If any init-tools
mismatch appears beyond the relaxed rule (for example Edit on the job-checker), stop and report.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 84 files, e5cb3963... |
| token file | present (`test -s` only) |
| dry run B | exit 0: 36 runs, caps $40.50045, reserves $50.625558, estimate $4, batch cap $10, order ok, ledger $2.691417 |
| batch A headline | haiku and sonnet both 9/9 detection, 0/9 false passes, 0/9 false fails (results/A.md) |

## Task 2: batch B live

- `run.cjs --batch B --root <R> --token-file <T> --raw` exited 0: 36 of 36 runs ok, 0 pending, `tripwire.diffs` [].
- **Tools.** Every run's init tools were `Read, Bash`, with Glob and Grep satisfied by Bash under the relaxed rule.
  Edit never appeared, so there was no mismatch beyond the relaxed rule. The tools check passed on 36/36.
- **Isolation.** Clean on 36/36, with 0 permission denials and 0 escape attempts.
- **Cost.** The largest overshoot was $0. Transcript cost exceeded the reported cost only by rounding, by at most
  4.9e-7 (on 12 runs).
- **First-turn input.** 15.5K to 15.6K tokens. A's was about 25.0K.
- **Turns.** haiku 2 to 5, sonnet 2 to 6.

## Batch B result (results/B.json)

| Metric | haiku | sonnet |
|---|---|---|
| runs scored / planned | 18/18 | 18/18 |
| detection | 9/12 (75.0%, Wilson 46.8-91.1%) | 11/12 (91.7%, 64.6-98.5%) |
| false_alarm (clean sets) | 0/6 | 0/6 |
| missed_as_pass | 2/12 | 0/12 |
| unrelated_blockers | 0 in 12 planted runs | 4 in 12 (all B3; restatements, see the spot-check) |
| abstain | 0/18 | 0/18 |
| detection, pre-check-flagged (B4) | 3/3 | 3/3 |
| detection, judgment-only (B3, B5, B6) | 6/9 | 8/9 |
| cost | $0.0627 (mean $0.003481 per run) | $1.0694 (mean $0.059410 per run) |
| mean wall | 14.9 s | 15.2 s |

Per planted set (detected of 3):

| Set | Kind | haiku | sonnet |
|---|---|---|---|
| B3 | same-wave overlap | 3/3 | 3/3 |
| B4 | missing verify (pre-check flags it) | 3/3 | 3/3 |
| B5 | later-wave dependency | 3/3 | 3/3 |
| B6 | uncovered success criterion | 0/3: 2 missed_as_pass, 1 missed | 2/3: 1 missed |

- **Clean sets (B1, B2):** both models scored 6/6 `correct_pass`. haiku published ISSUES FOUND with warnings only on
  4 of the 6, which is not a false alarm under the rule. sonnet passed all 6.
- **Excluded:** none. **Abstained:** none.
- **Spend block:** `spend.spent_usd` is 1.132036, equal to the ledger's batch B. Status complete, 36 entries.

## Spot-check (results/B-spotcheck.md)

- **Agreement:** 5 of 6. The picks (seed 81): B3-haiku-r3, B4-sonnet-r3, B5-sonnet-r2, B6-sonnet-r3, B1-sonnet-r1 and
  B6-haiku-r2.
- **The disagreement.** B-B6-haiku-r2 names the unknown-format gap as a warning, as B6-sonnet-r3 does. It has no exact
  `any_of` substring ("Unknown `--format` value", "unknown-format error"), so the scorer called it missed.
- **Sensitivity.** Counting B6-haiku-r2 and B6-sonnet-r2 (the same lexical miss) as detections:
  - haiku 10/12 detection and 7/9 judgment-only;
  - sonnet 12/12 and 9/9.

  haiku's two `missed_as_pass` stay misses.
- **No B6 return cites the success criterion.** None of the six mentions criterion 3 or exit 2, and every one that
  found the gap proposed exit 1.
- **Unrelated blockers.** sonnet's 4 are YAML restatements of the planted overlap, and its consequence, that did not
  merge with the Markdown items. Read by hand they are 0 (or 1).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Gate | `prereg.cjs --check` (OK), `test -s <T>` (present), `run.cjs --batch B ... --dry-run --materialize none --raw` | 0 | PASS |
| 2: Batch B live | `run.cjs --batch B --root <R> --token-file <T> --raw`: 36 run, 0 pending, ledger batch B `complete`, `tripwire.diffs` [] | 0 | PASS |
| 3: Score and commit | `score.cjs --batch B --root <R> --out <O>`; B.json spend 1.132036 = ledger; commit scan printed nothing; `prereg --check` OK; `git show --stat HEAD` = the three result files (707c1307) | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| prereg | `prereg.cjs --check`: OK, e5cb3963... (84 files), before the run and before the commit | 0 | PASS |
| commit scan | the 81-14 token scan over the three result files: no output | 0 | PASS |
| spend equality | `results/B.json` `spend.spent_usd` 1.132036 = `R/ledger.json` batch B `spent_usd` | 0 | PASS |

No code changed in this TRD, so the unit suites were not re-run.

## Task Commits

1. **Task 1:** `cc4a804e` (chore), the gate record as a SUMMARY checkpoint.
2. **Task 2:** `9c69facd` (chore), batch B live, as a SUMMARY checkpoint.
3. **Task 3:** `707c1307` (docs), `docs(81-15): batch B job-checker results`, exactly the three result files.

## Decisions Made

- No pilot for B: the user's go was for the full 36, and at A's per-run costs B could not approach its $10 cap.
- The spot-check's sixth pick came from the scorer's misses, because a scorer error matters most there.

## Deviations from Plan

None. The TRD executed as written. The scorer disagreement is recorded in B-spotcheck.md, per Task 3's recovery
rule, and the scorer was not changed.

## Findings for the user

1. **B separates the tiers a little, on one set.** Both models found every pre-check-flagged defect and both
   ordering defects. Only the uncovered success criterion (B6) split them:
   - haiku 0/3, and it passed the plans twice;
   - sonnet 2/3.

   With the lexical sensitivity the split is haiku 1/3, sonnet 3/3.
2. **Haiku's missed_as_pass is 2/12** (Wilson 4.7-44.8%). For the job-checker that is the costly error, because
   uncovered requirements go to execution.
3. **No false alarms for either model.** Haiku's warnings-only ISSUES FOUND on 4 of 6 clean sets could still cost a
   revision round in production.
4. **Cost.** haiku $0.0035 and sonnet $0.059 per run, both under 1% and 3.3% of their per-run caps. B's spend is 11%
   of its cap.

## Post-TRD Verification

- **Auto-fix cycles used:** 0.
- **Must-haves verified:** 5 of 5 truths.
  1. The gate checks were shown and the user's go is recorded. The plan presented was 36 runs within the $10 resized
     cap, rather than the TRD's original $6.
  2. 36 runs ran under the ledger, tripwire clean, after A was complete.
  3. B.json and B.md carry per-model detection, false alarm, missed-as-pass and unrelated blockers with n, split
     pre-check-flagged vs judgment-only. A 6-run spot-check is recorded.
  4. B.json's spend block equals the ledger's batch B.
  5. The commit scan printed nothing, and `prereg --check` passes.
- **Gate failures:** none.
- **Real home, fleet and checkout:**
  - nothing was written to `~/.claude` or any fleet repo;
  - the checkout was not edited while the runner ran;
  - `amp` was left untracked;
  - nothing was pushed.
- **Batch D:** not started from this TRD.

## Next Objective Readiness (81-16)

- Ledger $3.823453. A and B are complete; D, E and C are pending.
- D's cap is $5. The user's "go D" asks for a 2-run pilot first.

## Self-Check: PASSED

- FOUND: `results/B.json`, `results/B.md`, `results/B-spotcheck.md` (committed in 707c1307).
- FOUND commits: cc4a804e, 9c69facd, 707c1307.
- FOUND: `R/ledger.json` batch B `complete`, spent $1.132036; the runner exited 0 with `tripwire.diffs` [].
- `prereg.cjs --check` exits 0 at HEAD (e5cb3963...).
