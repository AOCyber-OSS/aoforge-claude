---
objective: 81-haiku-eval-and-model-efficiency-measurement
job: "07"
subsystem: testing
tags: [static-prompt, resident-prompt, 76-08, model-efficiency]
---

# Objective 81 TRD 07: Static resident-prompt comparison, 3.0.0 vs 3.1.0 (in progress)

## Progress
- [x] Task 1: Static prompt measurement script — b9a2ad90 (RED), (this commit) (GREEN)
- [ ] Task 2: Run 3.0.0 vs 3.1.0 and publish the comparison — next step: run `node scripts/eval81/static-prompt.cjs --from v3.0.0 --to HEAD --json .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json --md <scratch>/static.md`, spot-check three numbers by hand, write `81-STATIC-PROMPT.md`
