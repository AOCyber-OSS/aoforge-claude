---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "01"
subsystem: testing
tags: [eval, harness, ledger, stream-json]
---

# Objective 81 TRD 01: Harness core (run contract, stream parser, ledger, caps, secret handling) Summary

## Progress
- [x] Task 1: Fixture builders and the run contract — 7e9151b7
- [x] Task 2: Stream parser and secret handling — (this commit)
- [ ] Task 3: Ledger and cap sizing — next step: write scripts/eval81/lib/ledger.test.cjs cases 17-22b (RED), then ledger.cjs (loadLedger/saveLedger/reserveFor/canStart/recordRun/assertOrder/rebuildLedger/chargeLost); then caps.test.cjs 23-26 and caps.cjs; verify with `node --test scripts/eval81/lib/ledger.test.cjs scripts/eval81/lib/caps.test.cjs`
