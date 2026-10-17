---
objective: 80-adopt-migrates-legacy-projects
trd: "02"
subsystem: adopt
tags: [adopt, legacy-migration, preflight, begin, resume, legacy-layout-guard]
status: checkpoint
---

# Objective 80 TRD 02: Adopt preflight and begin route a pre-rename project to migrate Summary

**In progress (checkpoint).**

## Progress
- [x] Task 1: RED tests for the migrate route — (this commit)
- [ ] Task 2: preflight, decideRoute, begin and resume for migrate — next step: in adopt.cjs add the HEAD-based `inHead` helper, `facts.legacy`/`facts.finished` in preflight, the three legacy rules after rule 7 in decideRoute, and the migrate branch of begin
- [ ] Task 3: Guard exemption and help — next step: add the `adopt` reason string to EXEMPT_COMMANDS in legacy-layout-guard.cjs and the migrate sentence to the `adopt` entry in help.cjs
