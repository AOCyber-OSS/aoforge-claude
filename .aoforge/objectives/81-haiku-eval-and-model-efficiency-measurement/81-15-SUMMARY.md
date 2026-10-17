---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "15"
subsystem: testing
tags: [eval, live, batch-b, job-checker, haiku, sonnet, ledger]
status: checkpoint
---

# Objective 81 TRD 15: Live batch B (job-checker) Summary

## Progress
- [x] Task 1: Confirm spend for batch B — cc4a804e
- [x] Task 2: Run batch B live — (this commit)
- [ ] Task 3: Score, spot-check and commit batch B — next step: commit results/B.json, B.md and B-spotcheck.md (already scored, scanned and prereg-checked) with `aof-tools commit "docs(81-15): batch B job-checker results"`

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

- `run.cjs --batch B --root <R> --token-file <T> --raw`: exit 0, 36 of 36 ok, 0 pending, `tripwire.diffs` [].
- Batch B spent $1.132036 (cap $10); ledger total $3.823453.
- Wall: 19:00:40Z to 19:09:55Z. Summed run wall: haiku 268 s, sonnet 274 s.
- Init tools on every run: `Read, Bash` (Glob and Grep satisfied by Bash under the relaxed rule). No Edit, so no
  mismatch beyond the relaxed rule; tools check ok on 36/36.
- Isolation clean on 36/36; 0 permission denials; 0 escape attempts; largest overshoot $0.
- Transcript cost above reported only by rounding (at most 4.9e-7, 12 runs).
- First-turn input 15.5K to 15.6K tokens (A was about 25.0K).
