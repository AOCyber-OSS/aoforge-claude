---
objective: 82-3-1-0-follow-ups
job: "02"
subsystem: agents
tags: [runtime-path, init, guard, agents]
status: checkpoint
---

# Objective 82 TRD 02: absolute runtime path for agents, and the guard (in progress)

## Progress
- [x] Task 1: runtime_root in every compound init — (this commit)
- [ ] Task 2: The guard, RED on the real tree — next step: write plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs and run it to record the RED offender counts per core agent
- [ ] Task 3: Rewrite the core agents until the guard is green — next step: rewrite the 32 core-agent occurrences to `<runtime>/<rel>` and add the pinned `<runtime_paths>` block after `</role>`
