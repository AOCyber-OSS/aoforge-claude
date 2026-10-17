---
objective: 81-haiku-eval-and-model-efficiency-measurement
job: "05"
status: checkpoint
---

# Objective 81 TRD 05: Test D fixtures (labelled docs-site screenshots), answer key and defect proofs Summary

**In progress (progress checkpoint, not complete).**

## Progress
- [x] Task 1: Capture script, recipe and the ~20 screenshots — (this commit) (20 PNGs, 1,696,104 bytes; full rebuild reproduces them pixel-exact)
- [x] Task 2: PNG decoder and region diff — 52f5e9d4 (RED), 22fd72b9 (GREEN, 19 tests pass)
- [ ] Task 3: Proof test and commit — next step: write scripts/eval81/fixtures/D/proofs.test.cjs (test list 4-9: PNG size, region share >= min_share, no label words, ids and enums, recipe entries, total bytes < 3 MB), then run `node --test 'scripts/eval81/fixtures/D/*.test.cjs'`
