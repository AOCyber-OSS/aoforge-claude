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
- [ ] Task 2: Quick pilot pair, then build pilot pair — quick pair done (this commit); next step: run `node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --stop-after 2 --raw` again in the background for the build pilot (b31-r1, b30-r1), then run `scratchpad/81-17-scripts/pilot-table.cjs` over all four and write `R/pilot/E-cost.md`
- [ ] Task 3: Review the pilots before the remaining 6 E runs
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
