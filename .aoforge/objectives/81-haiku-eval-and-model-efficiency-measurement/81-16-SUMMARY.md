---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "16"
subsystem: testing
tags: [eval, live, batch-d, ui-judge, haiku, sonnet, ledger]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRD 81-15)
    provides: "batches A and B complete, ledger $3.823453, D cap $5"
provides:
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.json: batch D scored (ui-evaluator, haiku and sonnet, 60/60 samples each) with the spend block that rebuilds the ledger"
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.md and results/D-spotcheck.md (4/4 labels hold; session-design sensitivity recorded)"
affects: [81-17, 81-19]

tech-stack:
  added: []
  patterns:
    - "D pilot by --stop-after 2: the frozen order already starts with one haiku and one sonnet session"

key-files:
  created:
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.json
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D-spotcheck.md
  modified: []

key-decisions:
  - "D's cap was not resized: the 2-run pilot projected $0.86 for 24 sessions against the $5 cap"
  - "Both D disagreement states are entangled with the one-session-per-surface design; recorded as a sensitivity line, labels unchanged"

patterns-established: []

requirements-completed: []

verification:
  gates_defined: 3
  gates_passed: 3
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: false

duration: 10min
completed: 2026-10-17
---

# Objective 81 TRD 16: Live batch D (UI judge) Summary

**Batch D ran live after a 2-run pilot: 24 of 24 judge sessions ok, all through structured output, for $0.74
(ledger $4.56). Sonnet judged 20/20 states correctly, Haiku 18/20 (1 broken missed, 1 false fail). Haiku's votes
split 4x as often (8/20 vs 2/20), so the engine would escalate 4/7 ok states for Haiku against 1/7 for Sonnet.
Both disagreements depend on the one-session-per-surface design.**

## Progress
- [x] Task 1: Confirm spend for batch D — 756daad2
- [x] Task 2: Run batch D live — 2af4c440
- [x] Task 3: Score, spot-check and commit batch D — 8fd9d28b

## Performance

- **Duration:** about 10 min (19:14Z to 19:24Z).
- **Batch D wall time:** 19:15:01Z to 19:19:47Z. Summed session wall time: haiku 142 s, sonnet 118 s.
- **Tasks:** 3 of 3.
- **Spend:** batch D $0.736393 of its $5 cap; ledger $4.559846 of $100.

## User gate decision (2026-10-17)

"go D". The terms:
- First run a 2-run pilot (1 Haiku, 1 Sonnet) and check the measured cost against D's $5 cap.
- If the full 24 would project above $5, resize D's cap by the post-hoc amendment procedure, as long as the projected
  A+B+D+E stays <= $80.
- Then run the rest, score, and commit results/D.json.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 84 files, e5cb3963... |
| token file | present (`test -s` only) |
| dry run D | exit 0: 24 sessions, caps $10.27656, reserves $12.8457, estimate $2, batch cap $5, order ok, ledger $3.823453 |
| A headline | haiku and sonnet both 9/9 detection, 0/9 false passes |
| B headline | detection haiku 9/12, sonnet 11/12; false alarms 0/6 each; haiku missed_as_pass 2/12 |
| per-run caps | haiku $0.25558, sonnet $0.6008 (fallback p90 judge 0.5); a sonnet session can start while D's spend is <= $4.3992 |

## Pilot (2 runs, `--stop-after 2`)

The first two planned runs are one haiku and one sonnet session on the same surface, so no reorder shim was needed.

| Run | Model | Status | Reported | Transcript | Charged | First turn | Turns | Wall | Init tools | Isolation / denials | Results from |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D-home-haiku-r1 | haiku | ok | $0.0042882 | $0.004288 | $0.004288 | 6,882 | 7 | 14.7 s | Read, StructuredOutput | clean / 0 | structured output, 5 states |
| D-home-sonnet-r1 | sonnet | ok | $0.067499 | $0.067499 | $0.067499 | 6,112 | 7 | 10.0 s | Read, StructuredOutput | clean / 0 | structured output, 5 states |

- **Projection at pilot cost.** The full 24 come to 12 x $0.004288 + 12 x $0.067499 = $0.86.
  - That is well under D's $5 cap.
  - Even at 3x the pilot ($2.58), every sonnet session starts below its $4.3992 threshold.
  - **No resize was needed, and no frozen file changed.**
- **Projected A+B+D+E:** $2.69 + $1.13 + $0.86 + $44 (E's estimate) = $48.69, against the <= $80 rule.
- `StructuredOutput` is the CLI's `--json-schema` tool. D runs are kind `prompt`, so the tools check does not apply.

## Task 2: batch D live

- **Exits.** The pilot (`--stop-after 2`) exited 0. The rest exited 0, with 22 runs, 0 pending and `tripwire.diffs`
  [].
- **Where the results came from.** Structured output 24, fenced block 0, none 0. Every session returned 5 states.
- **Tools.** The init tools on every session were `Read, StructuredOutput`. No plugin was loaded.
- **Isolation.** Clean on 24/24, with 0 permission denials, 0 escape attempts and 0 contaminated sessions.
- **Cost.** The largest overshoot was $0. Transcript cost exceeded the reported cost only by rounding (at most
  5.0e-7).
- **First-turn input.** haiku 6.9K to 7.1K tokens, sonnet 6.1K to 6.3K. Each session made 7 turns.

## Batch D result (results/D.json)

| Metric | haiku | sonnet |
|---|---|---|
| samples scored / planned | 60/60 | 60/60 |
| accuracy (states) | 18/20 (90.0%, Wilson 69.9-97.2%) | 20/20 (100%, 83.9-100%) |
| broken_missed | 1/13 (d17) | 0/13 |
| false_fail (false-broken) | 1/7 (d02) | 0/7 |
| false-ok | 1 state (d17, the broken_missed) | 0 |
| split_rate (escalation frequency) | 8/20 (40%) | 2/20 (10%) |
| engine_escalations (ok states with split votes) | 4/7 | 1/7 |
| engine_reviews | 3/7 | 1/7 |
| sample_accuracy | 48/60 (80.0%) | 58/60 (96.7%) |
| accuracy, high severity | 9/9 | 9/9 |
| accuracy, medium severity | 3/4 | 4/4 |
| accuracy, ok states | 6/7 | 7/7 |
| by defect type | misalignment 1/2; every other type full | all full |
| cost | $0.0429 (mean $0.003575 per session) | $0.6935 (mean $0.057791 per session) |
| mean wall | 11.9 s | 9.8 s |

- **Excluded:** none.
- **Spend block:** `spend.spent_usd` is 0.736393, equal to the ledger's batch D. Status complete, 24 entries.

## Spot-check (results/D-spotcheck.md)

- **Picks** (seed 81): d20 and d09, which both models got right, and d17 and d02, the only two states either model
  got wrong. I viewed each PNG, plus d19, d17's baseline.
- **Labels:** all four still look right. d17's 40 px sidebar offset is subtle on its own.
- **d02.** haiku's two broken votes describe defects from sibling states in the same session: d11's mid-page header
  and d14's table overflow. That is a state-attribution error, which one state per call cannot produce.
- **d17.** sonnet's two broken votes say the sidebar sits "about 40px further right than usual", which compares it
  with d19. haiku said ok 3 times.
- **Sensitivity.** Without d02 and d17, both models are 18/18. haiku's engine escalations without d02 are 3/6.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Gate | `prereg.cjs --check` (OK), `test -s <T>` (present), `run.cjs --batch D ... --dry-run --materialize none --raw` | 0 | PASS |
| 2: Batch D live | pilot `run.cjs --batch D ... --stop-after 2 --raw` (2 run), then `run.cjs --batch D ... --raw` (22 run, 0 pending, ledger batch D `complete`, `tripwire.diffs` []) | 0 | PASS |
| 3: Score and commit | `score.cjs --batch D --root <R> --out <O>`; D.json spend 0.736393 = ledger; commit scan printed nothing; `prereg --check` OK; `git show --stat HEAD` = the three result files (8fd9d28b) | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| prereg | `prereg.cjs --check`: OK, e5cb3963... (84 files), before the pilot and before the commit | 0 | PASS |
| commit scan | the 81-14 token scan over the three result files: no output | 0 | PASS |
| spend equality | `results/D.json` `spend.spent_usd` 0.736393 = `R/ledger.json` batch D `spent_usd` | 0 | PASS |

No code changed in this TRD, so the unit suites were not re-run.

## Task Commits

1. **Task 1:** `756daad2` (chore), the gate record as a SUMMARY checkpoint.
2. **Task 2:** `2af4c440` (chore), the pilot and the rest of batch D, as a SUMMARY checkpoint.
3. **Task 3:** `8fd9d28b` (docs), `docs(81-16): batch D UI judge results`, exactly the three result files.

## Decisions Made

- **The pilot used `--stop-after 2` on the frozen order.** D's order starts with D-home-haiku-r1 and then
  D-home-sonnet-r1, so no shim was needed.
- **No cap resize.** The pilot projection ($0.86) is under a fifth of D's $5 cap.

## Deviations from Plan

None. The TRD executed as written, with the user's pilot step added in front of Task 2. The label question is
recorded in D-spotcheck.md, per Task 3's recovery rule, and `labels.json` was not edited.

## Findings for the user

1. **Sonnet is perfect on D, and Haiku is close but noisier.** On states the two are 20/20 and 18/20. On single
   samples they are 58/60 and 48/60.
2. **Escalation frequency is the real cost difference.** haiku's votes split on 8/20 states and sonnet's on 2/20.
   Under the engine's rule, a haiku judge would send 4 of 7 ok states to escalation, and sonnet 1 of 7.
3. **Both errors are tangled with the batch design.** Each session sees every state of a surface:
   - haiku's false fail came from giving a neighbour's defect to the wrong state;
   - sonnet's one subtle-defect hit (d17) came from comparing it with the ok baseline.

   81-19 should report the metric with and without d02 and d17. Without them, both models are 18/18.
4. **Cost.** haiku $0.0036 and sonnet $0.058 per 5-state session, about 1/16 of the cost.

## Post-TRD Verification

- **Auto-fix cycles used:** 0.
- **Must-haves verified:** 3 of 3 truths.
  1. The gate checks were shown and the user's go D, with its pilot condition, is recorded. The plan was 24 sessions
     under the $5 resized cap, rather than the TRD's original $3.
  2. 24 sessions ran with only Read (plus the schema tool) and no plugin, under the ledger, tripwire clean.
  3. D.json and D.md report per-model per-state accuracy, broken-missed, split rate, engine escalations and accuracy
     by defect type and severity, with n. A 4-state visual spot-check is recorded.
- **Gate failures:** none.
- **Real home, fleet and checkout:**
  - nothing was written to `~/.claude` or any fleet repo;
  - the checkout was not edited while the runner ran;
  - `amp` was left untracked;
  - nothing was pushed.
- **Batch E:** not started from this TRD.

## Next Objective Readiness (81-17)

- Ledger $4.559846. A, B and D are complete; E and C are pending.
- E's cap is $55, and $95.44 remains under the global cap.

## Self-Check: PASSED

- FOUND: `results/D.json`, `results/D.md`, `results/D-spotcheck.md` (committed in 8fd9d28b).
- FOUND commits: 756daad2, 2af4c440, 8fd9d28b.
- FOUND: `R/ledger.json` batch D `complete`, spent $0.736393; both runner invocations exited 0 with
  `tripwire.diffs` [].
- `prereg.cjs --check` exits 0 at HEAD (e5cb3963...).
