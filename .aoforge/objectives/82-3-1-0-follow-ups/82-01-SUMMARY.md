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
- [x] Task 2: attribution.cjs (test list 1-9) — RED bc27e3e0, GREEN (this commit): 76 tests pass
- [ ] Task 3: Run the attribution on the four build runs and publish 82-DIAGNOSIS.md — next step: run summarizeSpawn on the four runs and compare with 81-MEASUREMENT.md role totals (planner 1,321,277 vs 2,205,630; executor 2,769,891 vs 3,326,048)
