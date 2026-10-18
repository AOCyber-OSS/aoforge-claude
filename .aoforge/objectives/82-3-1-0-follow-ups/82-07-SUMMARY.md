---
objective: 82-3-1-0-follow-ups
job: "07"
subsystem: agents
tags: [build-cell, tokens, planner, executor, trd-spec, summary-skeleton, tdd-card]
duration: in progress
completed: in progress
---

# Objective 82 TRD 07: build-cell fixes Summary

## Progress
- [x] Task 1: Planner-side FIX rows (P-1, P-2, P-3, P-4, X-1) — (this commit)
- [ ] Task 2: Executor-side FIX rows (E-1, E-2, E-5), the offline effect and `## Fix applied` — next step: add tests 5-7 (E-1 skeleton keys and spawn lists, E-2 TDD card and tdd.md lines, E-5 read-before-write) to plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs and commit RED

## Deviations from Plan (running)

- Orchestrator extra fix: scripts/eval81/score.test.cjs test "--report reads the tiers" now expects the "already starts at haiku on budget/balanced" note and no proposal (82-03 applied P1) — d27390c5; prereg 81 check OK (86 files).
- P-2's sentence lands in executor.md's task_commit_protocol in Task 1 (the row names both files).
- trd-spec.md gained the stack-pack frontmatter fields (stack, platform, api_contract) and `ui` in the type row, so it carries every section and field templates/trd-prompt.md had (the TRD's P-1 catalogue; the row's change did not forbid it).
