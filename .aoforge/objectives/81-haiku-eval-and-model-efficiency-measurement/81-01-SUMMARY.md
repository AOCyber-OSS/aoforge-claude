---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "01"
subsystem: testing
tags: [eval, harness, ledger, stream-json]
---

# Objective 81 TRD 01: Harness core (run contract, stream parser, ledger, caps, secret handling) Summary

## Progress
- [x] Task 1: Fixture builders and the run contract — (this commit)
- [ ] Task 2: Stream parser and secret handling — next step: write scripts/eval81/lib/result.test.cjs cases 5-12b (RED), then result.cjs parseStream/modelRan/isRateLimit/toolInputsMentioning/transcriptCost; then secret.test.cjs 13-16 and secret.cjs; verify with `node --test scripts/eval81/lib/result.test.cjs scripts/eval81/lib/secret.test.cjs`
- [ ] Task 3: Ledger and cap sizing
