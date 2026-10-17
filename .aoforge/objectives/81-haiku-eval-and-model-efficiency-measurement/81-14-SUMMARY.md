---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "14"
subsystem: testing
tags: [eval, live, batch-a, verifier, haiku, sonnet, ledger]
status: checkpoint
---

# Objective 81 TRD 14: Live batch A (verifier) Summary

**Checkpoint, not complete.** Batch A ran live: 36 of 36 runs ok, $2.691417 spent, tripwire clean. Scoring next.

## Progress
- [x] Task 1: Confirm spend for batch A — fed02550
- [x] Task 2: Run batch A live — (this commit)
- [ ] Task 3: Score, spot-check and commit batch A — next step: `node scripts/eval81/score.cjs --batch A --root <R> --out <O>`, then a seeded 6-run spot-check (3 planted, 3 clean, both models) into `<O>/results/A-spotcheck.md`, and the commit scan

## Batch A live (Task 2)

- Pilot (4 runs + 1 re-run, shim order), relaxed tools check (post-hoc 1, 14963158), caps resized (post-hoc 2, 7c10fdab),
  then the remaining 32 with the frozen batch module.
- 36/36 `ok`; 0 excluded; 0 permission denials; 0 escape attempts; isolation clean on every run; tripwire diff empty.
- Ledger total $2.691417 = batch A spent (haiku 18 runs $0.178550, sonnet 18 runs $2.501752, re-keyed attempt 1
  $0.011115). Batch A `complete`, cap $10.
- Per run: haiku mean $0.009919 (min $0.005823, max $0.011393), sonnet mean $0.138986 (min $0.128920, max $0.152767).
  No overshoot. The transcript cost exceeded the reported one only by rounding (max 4.8e-7).
- first_turn_input: haiku 25,028-25,031, sonnet 25,034-25,037 tokens (the caps assume 36K).
- Wall: 18:17:18Z to 18:44:21Z, including the pause for the relaxation and the resize.
