---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "17"
subsystem: testing
tags: [eval, live, batch-e, measurement, 76-08]
status: checkpoint
---

# Objective 81 TRD 17: Live batch E (3.0.0 vs 3.1.0) Summary

## Progress
- [x] Task 1: Confirm spend for batch E — (this commit)
- [ ] Task 2: Quick pilot pair, then build pilot pair — next step: run `node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --stop-after 2 --raw` in the background for the quick pilot (q31-r1, q30-r1), check status, isolation, subagent transcripts, acceptance and roles, then the same command again for the build pilot (b31-r1, b30-r1)
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
