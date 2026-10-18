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
- [x] Task 2: The guard, RED on the real tree — cad6bc8a
- [x] Task 3: Rewrite the core agents until the guard is green — (this commit)
- [ ] Wrap-up: full suite, prereg check, SUMMARY post, state — next step: run npm test's globs (watcher-shell.test.cjs excluded) with HOME/TMPDIR under the scratchpad and record tests/pass/fail

## RED offender counts (core_agents, 33)
codebase-mapper 3, debugger 2, executor 9, integration-checker 1, job-checker 1, objective-researcher 1, planner 7, project-researcher 2, research-synthesizer 2, roadmapper 2, verifier 3.

## PENDING scopes (for 82-11)
core_references 14, pack_agent_material 6, core_workflows 51, core_skills 26, core_templates 26, pack_skills_workflows 4.
