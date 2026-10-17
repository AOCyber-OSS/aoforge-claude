---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "08"
subsystem: testing
tags: [eval, harness, runner, sandbox, claude-p, tripwire, dry-run]
---

# Objective 81 TRD 08: Harness runner (sandbox, command, queue, pause/resume, budget stop, tripwire, dry run) Summary

## Progress
- [x] Task 1: Fake claude and stub batch (fixture builders) — 78f0dd40
- [x] Task 2: Sandbox, command builder and tripwire — (this commit)
- [ ] Task 3: Runner, CLI, dry run and README — next step: write scripts/eval81/run.test.cjs (test list 1-11, 16-22, stub tree + batch shims + --rates TEST_RATES), run `node --test scripts/eval81/run.test.cjs` (must fail), then implement scripts/eval81/lib/runner.cjs runBatch and scripts/eval81/run.cjs main
