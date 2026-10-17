---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "09"
subsystem: testing
tags: [eval81, haiku-eval, verifier, job-checker, batch-spec, scorer]
---

# Objective 81 TRD 09: Batch specs and scorers for A (verifier) and B (job-checker) Summary

## Progress
- [x] Task 1: Canned agent outputs (fixture builder) — 09104850
- [x] Task 2: Batch A module and scorer — (this commit)
- [ ] Task 3: Batch B module and scorer — next step: write scripts/eval81/batches/B.test.cjs and scripts/eval81/score/B.test.cjs (test list 8-13), watch them fail, then implement batches/B.cjs (precheck cache under <root>/cache/B/<id>/) and score/B.cjs reusing the score/A.cjs run-dir helpers
