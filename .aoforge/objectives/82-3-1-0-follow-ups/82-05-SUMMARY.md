---
objective: 82-3-1-0-follow-ups
trd: "05"
subsystem: testing
tags: [eval82, ledger, guessed-paths, batch-e, batch-d]
requirements-completed: []
---

# Objective 82 TRD 05: eval82 ledger and E/D batches Summary

**In progress.**

## Progress
- [x] Task 1: Fixture builders, ledger82 (--init, --fit, --raise) and the guessed-path scanner — (this commit)
- [ ] Task 2: Batch E and the E scorer — next step: write scripts/eval82/batches/E.test.cjs and score/E.test.cjs (test list 3-5, 12-14 E part), run them red, commit RED
- [ ] Task 3: Batch D with the absolute screenshot path, the D scorer, and a D dry run

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1 | `env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test scripts/eval82/ledger82.test.cjs scripts/eval82/lib/guessed-paths.test.cjs` (14/14) | 0 | PASS |
