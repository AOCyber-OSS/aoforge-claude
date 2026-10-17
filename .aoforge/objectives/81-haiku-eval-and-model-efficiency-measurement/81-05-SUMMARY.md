---
objective: 81-haiku-eval-and-model-efficiency-measurement
job: "05"
status: checkpoint
---

# Objective 81 TRD 05: Test D fixtures (labelled docs-site screenshots), answer key and defect proofs Summary

**In progress (progress checkpoint, not complete).**

## Progress
- [ ] Task 1: Capture script, recipe and the ~20 screenshots — next step: finish scripts/eval81/fixtures/D/recipe.json (CSS per state), run capture.cjs, look at every PNG, write states.json and labels.json (capture.cjs is written and proven on the ok pages; 390 px states go through an iframe wrapper because headless Chrome clamps its window to 500 px)
- [x] Task 2: PNG decoder and region diff — 52f5e9d4 (RED), (this commit) (GREEN, 19 tests pass)
- [ ] Task 3: Proof test and commit — next step: write scripts/eval81/fixtures/D/proofs.test.cjs (test list 4-9) once Task 1 files exist
