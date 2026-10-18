---
objective: 82-3-1-0-follow-ups
job: "01"
status: checkpoint
subsystem: eval
tags: [token-diagnosis, transcripts, attribution]
requirements-completed: []
---

# Objective 82 TRD 01: Build-cell token diagnosis Summary

**In progress: per-call transcript attribution module and the 3.0.0 vs 3.1.0 build-cell diagnosis.**

## Progress
- [x] Task 1: Hand-built transcript builder for attribution tests — 1a46961f
- [ ] Task 2: attribution.cjs (test list 1-9) — RED committed (this commit: 74 tests, all failing on the missing module); next step: implement scripts/eval82/lib/attribution.cjs until attribution.test.cjs is green, then commit GREEN
- [ ] Task 3: Run the attribution on the four build runs and publish 82-DIAGNOSIS.md — next step: run summarizeSpawn on the four runs and compare with 81-MEASUREMENT.md role totals
