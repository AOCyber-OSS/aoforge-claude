---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "15"
subsystem: testing
tags: [eval, live, batch-b, job-checker, haiku, sonnet, ledger]
status: checkpoint
---

# Objective 81 TRD 15: Live batch B (job-checker) Summary

## Progress
- [x] Task 1: Confirm spend for batch B — (this commit)
- [ ] Task 2: Run batch B live — next step: run `node scripts/eval81/run.cjs --batch B --root <R> --token-file <T> --raw` in the background and handle its exit code as in 81-14
- [ ] Task 3: Score, spot-check and commit batch B

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
