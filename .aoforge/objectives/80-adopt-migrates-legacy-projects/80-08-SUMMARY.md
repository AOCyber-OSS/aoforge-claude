---
objective: 80-adopt-migrates-legacy-projects
trd: "08"
subsystem: adopt
tags: [adopt, simulated-run, fresh, brownfield, regression]
status: checkpoint
requirements-completed: []
---

# Objective 80 TRD 08: Simulated /aoforge:adopt on a fresh and a brownfield repository under 3.1.0 (checkpoint)

## Progress
- [x] Task 1: Fresh and bare repositories through /aoforge:adopt — (this commit)
- [ ] Task 2: Brownfield through /aoforge:adopt, re-run, SUMMARY — next step: set the fixture TMPDIR, run `adopt preflight` on `<S>/80-08/brownfield`, then follow adopt.md step by step (begin, skill marker, map by hand, infer_project, scaffold, confirm_stack_profile, health, report, commit, summary)

## Task 1 notes

- `<S>` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`; fixture home `<S>/80-08/home`.
- `fresh` (empty fixture, one commit): `adopt preflight` -> route `new-project`, message "no source code yet", repo_state `greenfield`. Workflow stops there.
- `bare` (git init only, unborn): `adopt preflight` -> route `new-project` (greenfield beats no-commits), `git.unborn: true`.
- `adopt-e2e-assert compare` on both: `{"ok":true,"changed":[]}`. `git branch --list aoforge/adopt` on fresh prints nothing.
