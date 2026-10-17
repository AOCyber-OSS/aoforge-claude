---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "08"
subsystem: testing
tags: [eval, harness, runner, sandbox, claude-p, tripwire, dry-run]
---

# Objective 81 TRD 08: Harness runner (sandbox, command, queue, pause/resume, budget stop, tripwire, dry run) Summary

## Progress
- [x] Task 1: Fake claude and stub batch (fixture builders) — (this commit)
- [ ] Task 2: Sandbox, command builder and tripwire — next step: write RED tests scripts/eval81/lib/{sandbox,command,tripwire}.test.cjs for test list 12-15 and 15b, run `node --test 'scripts/eval81/lib/{sandbox,command,tripwire}.test.cjs'` (must fail), then implement the three modules
- [ ] Task 3: Runner, CLI, dry run and README
