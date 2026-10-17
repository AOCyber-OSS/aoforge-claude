---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "02"
subsystem: testing
tags: [eval, statistics, wilson, decision-rule, haiku]
---

# Objective 81 TRD 02: Pre-registered decision rule, statistics, scoring CLI and report renderer Summary

## Progress
- [x] Task 1: Write and commit the pre-registered decision rule, plus metrics fixture builders — e404e0f2
- [x] Task 2: Statistics and the decision function — (this commit)
- [ ] Task 3: Scoring CLI and the 76-06 report renderer — next step: write scripts/eval81/lib/report.test.cjs (test list 12) and scripts/eval81/score.test.cjs (test list 1-3, 2b, 3b), run `node --test scripts/eval81/score.test.cjs scripts/eval81/lib/report.test.cjs` to watch them fail, then report.cjs and score.cjs
