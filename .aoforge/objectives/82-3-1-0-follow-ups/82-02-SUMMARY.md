---
objective: 82-3-1-0-follow-ups
job: "02"
subsystem: agents
tags: [runtime-path, init, guard, agents]
status: checkpoint
---

# Objective 82 TRD 02: absolute runtime path for agents, and the guard (in progress)

## Progress
- [x] Task 1: runtime_root in every compound init — 0e5e3da1
- [x] Task 2: The guard, RED on the real tree — (this commit)
- [ ] Task 3: Rewrite the core agents until the guard is green — next step: rewrite the 33 core-agent occurrences to `<runtime>/<rel>` and add the pinned `<runtime_paths>` block after `</role>`

## RED offender counts (core_agents, 33)
codebase-mapper 3, debugger 2, executor 9, integration-checker 1, job-checker 1, objective-researcher 1, planner 7, project-researcher 2, research-synthesizer 2, roadmapper 2, verifier 3.

## PENDING scopes at the end of Task 2 (for 82-11)
core_references 14, pack_agent_material 6, core_workflows 51, core_skills 26, core_templates 26, pack_skills_workflows 4.
