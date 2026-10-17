---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "17"
subsystem: testing
tags: [eval, live, batch-e, measurement, 76-08]
status: checkpoint
---

# Objective 81 TRD 17: Live batch E (3.0.0 vs 3.1.0) Summary

## Progress
- [x] Task 1: Confirm spend for batch E — 6db987e4
- [x] Task 2: Quick pilot pair, then build pilot pair — quick pair 77da5312, build pair (this commit)
- [ ] Task 3: Review the pilots before the remaining 6 E runs — next step: AWAITING THE USER. Batch E is `running` with 6 pending (q30-r2, q31-r2, q31-r3, q30-r3, b30-r2, b31-r2). On "go E rest", run `node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --raw` in the background; on "stop E", run `node scripts/eval81/run.cjs --close-batch E --root <R> --reason "user stopped after the pilots" --raw`, then score
- [ ] Task 4: The remaining E runs, then score and publish the 76-08 measurement

## User gate decision (2026-10-17)

"go E": run E's pilot pairs (quick pair, then build pair, both versions) and STOP at Task 3's checkpoint, before
the other 6 runs. Report the pilot comparison and the projection for the remaining 6. Do not run the remaining E
runs and do not start C. Session model: opus (the default; no "go E sonnet").

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 84 files, e5cb3963... |
| token file | present (`test -s` only) |
| dry run E | exit 0: 10 runs, caps $96, reserves $120, estimate $44, batch cap $55, order ok (A, B, D complete), ledger $4.559846 |
| remaining budget | $95.440154 under the global $100 |
| per-run caps | quick $6 (reserve $7.50, timeout 30 min), build $15 (reserve $18.75, timeout 90 min), session model opus, profile balanced |

## Task 2a: quick pilot pair (`--stop-after 2`)

The runner exited 0. q31-r1 and q30-r1 both ran, 8 runs are pending, `tripwire.diffs` is [] and batch E is
`running`. Batch E has spent $3.84325, and the ledger stands at $8.403096.

| Run | Version | Status | Acceptance | Tests | TRDs / SUMMARYs | Roles (model) | Wall |
|---|---|---|---|---|---|---|---|
| q31-r1 | 3.1.0 | ok | pass (3/3 checks) | 9/9 | 1 / 1 | orchestrator (opus), planner (opus), executor (sonnet) | 345 s |
| q30-r1 | 3.0.0 | ok | pass (3/3 checks) | 9/9 | 1 / 1 | orchestrator (opus), planner (opus), executor (**opus**) | 370 s |

- **Transcripts.** Both runs have the main session plus two `subagents/agent-*.jsonl` files.
- **Isolation.** Clean on both runs, with 0 escape attempts.
- **One permission denial per run.** In each, the orchestrator's raw `git commit --amend` (adding an attribution
  trailer) was denied by the plugin's own commit gate inside the sandbox. It is part of the measured flow, not an
  escape attempt (`escape_attempt` false, nothing under a deny root).
- **The executor's model differs by version.** With `model_profile: balanced`, 3.1.0's executor ran on sonnet and
  3.0.0's ran on opus. 81-12 assumed sonnet for both versions.

## Task 2b: build pilot pair (`--stop-after 2`)

The runner exited 0. b31-r1 and b30-r1 both ran, 6 runs are pending, `tripwire.diffs` is [] and batch E is
`running`. Batch E has spent $13.827458, and the ledger stands at $18.387304.

| Run | Version | Status | Acceptance | Tests | TRDs / SUMMARYs | Verification | Spawns | Wall |
|---|---|---|---|---|---|---|---|---|
| b31-r1 | 3.1.0 | ok | pass | 27/27 | 2 / 2 | passed | planner, job-checker, general-purpose ("Execute Objective 1"), executor x2, verifier x1 | 1110 s |
| b30-r1 | 3.0.0 | ok | pass | 33/33 | 2 / 2 | passed | planner, job-checker, general-purpose, executor x2, **verifier x2** (one sonnet from the executing agent, one opus from the orchestrator) | 957 s |

- **Transcripts.** Both runs hold the main session plus every subagent file (7 and 8), and all of them are readable.
- **Denials.**
  - Each build had one in-sandbox commit-gate denial of a raw `git commit`.
  - **b31-r1 also had an escape attempt.** Its TRD 01-01 executor (sonnet, spawn depth 2) first tried to `Read`
    `/Users/justin/.claude/aoforge/references/tdd.md`, the REAL home's runtime mirror. The `--settings` deny list
    refused it, so `escape_attempt` is true. It then read the sandbox copy at `<run>/home/.claude/aoforge/references/tdd.md`.
  - The agent resolved `~` from the run's cwd path, which contains `-Users-justin-`.
  - No other real-home path appears in any tool input of the four pilot transcripts: no Bash, no Grep, no Glob.
    Isolation proof and tripwire are clean.

## Cost check (R/pilot/E-cost.md)

| Run | Version | Reported | Transcript | main | subagents | Charged | Source | Cap | Overshoot | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| q31-r1 | 3.1.0 | $1.7786 | $1.7786 | $0.4701 | $1.3085 | $1.7786 | transcript_sum | $6 | $0 | reported includes subagents |
| q30-r1 | 3.0.0 | $2.0647 | $2.0647 | $0.4538 | $1.6108 | $2.0647 | transcript_sum | $6 | $0 | reported includes subagents |
| b31-r1 | 3.1.0 | $5.0873 | $5.0828 | $0.6314 | $4.4514 | $5.0873 | reported | $15 | $0 | reported includes subagents |
| b30-r1 | 3.0.0 | $4.8969 | $4.8489 | $0.6091 | $4.2398 | $4.8969 | reported | $15 | $0 | reported includes subagents |

- **Verdict: the CLI's reported cost includes subagent spend.** Subagents are 74-88% of each run's cost.
- **The ledger charged `max(reported, transcript)` on all four.**
- **Build pricing gap.** On the builds, reported exceeds transcript by 0.09% and 1.0%. That is under the 10% flag.
- **Untested: whether `--max-budget-usd` bounds subagent spend.** No run came near its cap: quick runs reached 30-34%
  of theirs, builds 33-34%, and the overshoot was $0.

## Pilot comparison, 3.1.0 vs 3.0.0 (n = 1 per cell)

| Pair | Role | 3.1.0 model | 3.1.0 first turn | 3.0.0 model | 3.0.0 first turn | Delta | 3.1.0 tokens | 3.0.0 tokens | 3.1.0 cost | 3.0.0 cost |
|---|---|---|---|---|---|---|---|---|---|---|
| quick | orchestrator (1/1) | opus | 33,637 | opus | 34,564 | -927 (-2.7%) | 478,398 | 444,269 | $0.4701 | $0.4538 |
| quick | planner (1/1) | opus | 26,905 | opus | 29,524 | -2,619 (-8.9%) | 910,219 | 935,678 | $0.9570 | $0.8626 |
| quick | executor (1/1) | sonnet | 24,075 | opus | 29,736 | -5,661 (-19.0%) | 999,967 | 1,044,936 | $0.3515 | $0.7482 |
| build | orchestrator (1/1) | opus | 37,967 | opus | 39,418 | -1,451 (-3.7%) | 603,174 | 680,984 | $0.6314 | $0.6091 |
| build | planner (1/1) | opus | 27,400 | opus | 29,791 | -2,391 (-8.0%) | 2,366,860 | 1,558,034 | $1.8288 | $1.4971 |
| build | job-checker (1/1) | sonnet | 14,577 | sonnet | 14,597 | -20 (-0.1%) | 97,912 | 69,187 | $0.1110 | $0.0685 |
| build | general-purpose (1/1) | opus | 15,122 | opus | 15,480 | -358 (-2.3%) | 1,119,711 | 1,342,661 | $0.8551 | $0.8751 |
| build | executor (2/2) | sonnet / sonnet | 25,100 / 25,227 | sonnet / sonnet | 30,845 / 31,107 | -5,812 (-18.8%) | 6,480,557 | 5,278,665 | $1.5257 | $1.2688 |
| build | verifier (1/2) | sonnet | 23,376 | sonnet / opus | 29,058 / 28,788 | -5,547 (-19.2%) | 188,506 | 553,826 | $0.1308 | $0.5303 |

| Run | Version | Total tokens | Cache writes | Cost (charged) | Wall | Acceptance | Tests | TRDs / SUMMARYs | Verification |
|---|---|---|---|---|---|---|---|---|---|
| q31-r1 | 3.1.0 | 2,388,584 | 160,803 | $1.7786 | 345 s | pass | 9/9 | 1 / 1 | - |
| q30-r1 | 3.0.0 | 2,424,883 | 158,004 | $2.0647 | 370 s | pass | 9/9 | 1 / 1 | - |
| b31-r1 | 3.1.0 | 10,856,720 | 476,952 | $5.0873 | 1110 s | pass | 27/27 | 2 / 2 | passed |
| b30-r1 | 3.0.0 | 9,483,357 | 464,565 | $4.8969 | 957 s | pass | 33/33 | 2 / 2 | passed |

- **First-turn input is lower in 3.1.0 for every role.**
  - executor and verifier: about 5.6K to 5.8K tokens less (-19%);
  - planner: 2.4K to 2.6K less (-8% to -9%);
  - orchestrator: 0.9K to 1.5K less;
  - job-checker: flat.

  The live cuts exceed what the static resident-bytes estimate in 81-STATIC-PROMPT predicts for all three roles:
  - executor: static -2,974 tokens, live about -5,700;
  - verifier: static -4,230, live -5,547;
  - planner: static -1,598, live about -2,500.
- **Quick: 3.1.0 is 14% cheaper** ($1.78 vs $2.06). Nearly all of the saving is the executor: 3.1.0 spawns it on
  sonnet ($0.35), while 3.0.0 spawns it with no model, so it inherits opus ($0.75).
- **Build: 3.1.0 is 4% dearer** ($5.09 vs $4.90), with n = 1.
  - Against it: its planner used 52% more tokens (2.37M vs 1.56M, $1.83 vs $1.50), and its executors used 23% more.
  - For it: 3.0.0 ran a second, opus verifier from the orchestrator ($0.38), which 3.1.0 did not.
  - Wall time: 3.1.0 was 16% slower (1110 s vs 957 s).
- **Outcomes are equal.** All four pass the hidden acceptance, both builds produced 2 TRDs and a passed
  verification, and the tests are green.

## Projection for the remaining 6 (dry run: quick reserve $7.50, build $18.75; all fit now)

| Scenario | Remaining 6 | E total | Ledger after E | Left for C |
|---|---|---|---|---|
| at pilot cost (same version) | $17.6707 | $31.4982 | $36.0580 | $63.9420 |
| pilot x 1.5 | $26.5061 | $40.3335 | $44.8934 | $55.1066 |
| pilot x 2 | $35.3414 | $49.1689 | $53.7287 | $46.2713 |
| worst case (every run to its cap, held by E's $55 batch cap) | $41.1725 | $55.0000 | $59.5598 | $40.4402 |

- C's estimate is about $28, so it stays covered in every row.
- A+B+D+E at pilot cost is $36.06, against the <= $80 rule.
- At pilot pace the remaining runs take about 58 minutes.

## Stop condition reached: escape attempt (user rule)

The user's rule: "Any other harness stop, isolation breach, permission-denial escape attempt, or projection breach:
stop and report."

- **What fired.** b31-r1 recorded `escape_attempt: true`: a denied Read of the real `~/.claude/aoforge/references/tdd.md`.
- **What I did.** I started nothing after it. b30-r1, the last approved pilot run, was already running when I
  inspected b31-r1's record. I let it finish rather than kill it mid-build: killing the runner could have orphaned a
  `claude` child spending outside the ledger. The runner then stopped by itself at `--stop-after 2`.
- **What b30-r1 showed.** No escape attempt, and no real-home path in any tool input.
- **What it means.** The deny layer did its job. But the remaining six E runs (and C) can produce the same
  attempt, because the cwd path names the real user. Whether to continue is the user's call.
