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
- [x] Task 2: attribution.cjs (test list 1-9) — RED bc27e3e0, GREEN e77c26ca (76 tests); finer categories for the real planner/executor `other` bucket added test-first (92 tests) — (this commit)
- [ ] Task 3: Run the attribution on the four build runs and publish 82-DIAGNOSIS.md — next step: totals already match 81 (planner 1,321,277 / 2,205,630, executor 2,769,891 / 3,326,048); now confirm or reject H-P1..H-E5 per call with show.cjs, find the 99950509 vs v3.0.0 triggers, write the draft and `doc put` it
