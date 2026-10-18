---
objective: 82-3-1-0-follow-ups
job: "11"
subsystem: agents
tags: [runtime-path, runtime_root, repo-guard, workflows, skills, templates, references, spawn-prompts]

requires:
  - objective: 82-3-1-0-follow-ups
    provides: "82-02: runtime_root in every compound init JSON, the pinned <runtime_paths> block, and runtime-path-reads.repo.test.cjs with six PENDING scopes"
provides:
  - "runtime-path-reads.repo.test.cjs enforces all seven scopes (PENDING empty) and adds spawn-line (18), runtime_root-source (19), trd-spec skeleton (17) and extractor unit (18a) tests"
  - "every AOForge or pack agent spawn in workflows, skills and pack skills carries `AOForge runtime: {runtime_root}` right after its prompt's opening line (43 spawns)"
  - "references, pack agent material and templates name runtime files `<runtime>/<rel>`; workflows and skills name them `{runtime_root}/<rel>` from an init JSON or the RUNTIME_ROOT fallback"
affects: [82-06, 82-07, 82-08, 82-10]

tech-stack:
  added: []
  patterns:
    - "readers decide the form: agent-read text uses `<runtime>/`, orchestrator text uses `{runtime_root}/` (init JSON, else `RUNTIME_ROOT=$(echo ~/.claude/aoforge)`)"
    - "spawn prompts hand the agent its absolute runtime path on one line, `AOForge runtime: {runtime_root}`"

key-files:
  created: []
  modified:
    - plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
    - plugins/aoforge/aoforge/workflows/execute-objective.md
    - plugins/aoforge/aoforge/workflows/plan-objective.md
    - plugins/aoforge/aoforge/workflows/new-project.md
    - plugins/aoforge/aoforge/workflows/map-codebase.md
    - plugins/aoforge/aoforge/workflows/quick.md
    - plugins/aoforge/aoforge/workflows/build.md
    - plugins/aoforge/aoforge/references/trd-spec.md
    - plugins/aoforge/aoforge/templates/claude-md.md
    - plugins/aoforge/aoforge/templates/debug-subagent-prompt.md
    - scripts/eval81/batches/A.test.cjs
    - scripts/eval81/batches/B.test.cjs
    - scripts/eval81/batches/C.test.cjs
    - plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.test.cjs

key-decisions:
  - "Readers decide the form: execute-trd.md and verify-objective.md are read by the executor and verifier agents, so they name `<runtime>/` (the agents' pinned block defines it); orchestrator-read workflows and skills name `{runtime_root}/`."
  - "Skills and workflows with no init use `{runtime_root}` plus the fallback line (`RUNTIME_ROOT=$(echo ~/.claude/aoforge) && echo \"$RUNTIME_ROOT\"`), so orchestrator text never carries a second placeholder name."
  - "The runtime line goes right after the prompt's opening line (one line; plus a blank line only where the prompt opens with `prompt=\"` alone). For fenced prompt blocks it follows the block's first line, which keeps 81's frozen C extractor anchor (`Focus: <focus>` right after the fence)."
  - "A `Bash(<command>)` permission rule is classified as shell (it is matched against the command as typed), instead of an ALLOW entry."
  - "Routed skills (milestone, objective, status, todo, workstreams) Read `{runtime_root}/workflows/<name>`, `<name>` being the route's workflow file name; the old '(expand `~`)' instruction is gone."
  - "Wording follows the user's correction: nothing written here claims the Read tool fails on `~`; the rationale is that a supplied absolute path leaves no home directory to guess."

requirements-completed: [SC-2]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 60min
completed: 2026-10-18
---

# Objective 82 TRD 11: runtime paths in references, workflows, skills and templates Summary

**The runtime-path guard now enforces all seven scopes with zero offenders, and every one of the 43 AOForge/pack agent spawns in workflows and skills hands its agent `AOForge runtime: {runtime_root}`, filled from an init JSON's `runtime_root` or the `RUNTIME_ROOT=$(echo ~/.claude/aoforge)` fallback, so no instruction leaves an agent or the orchestrator to type or guess a home directory.**

## Performance

- **Duration:** about 60 min
- **Started:** 2026-10-18T02:51:15Z
- **Completed:** COMPLETED_AT
- **Tasks:** 3 (6 commits: RED and GREEN per task)
- **Files modified:** 61

## Progress
- [x] Task 1: References and pack agent material — ccb30f7a (RED 35400216)
- [x] Task 2: Workflows, their spawn lines and 81's template comparisons — 7a78a9b0 (RED 21adb02a)
- [x] Task 3: Skills, templates and pack skills/workflows; PENDING emptied — (this commit) (RED 2b094ba1)

## Accomplishments

- Guard (`runtime-path-reads.repo.test.cjs`): ENFORCED holds all seven scopes and PENDING is empty (test 11 asserts it). New tests: 17 (trd-spec skeleton names `<runtime>/workflows/execute-trd.md` and `<runtime>/templates/summary.md`, no `@~/` line), 18a (spawn extractor units: literal, variable, template, YAML form, position), 18 (every AOForge/pack spawn in SPAWN_SCOPES carries the runtime line as the prompt's first or second line), 19 (every spawning or `{runtime_root}`-naming file runs one of the 13 inits whose JSON has `runtime_root`, checked against runtime-root.test.cjs's list, or defines the fallback; a SKILL.md counts the workflows it includes at a line start). The classifier also treats a `Bash(<command>)` permission rule as shell.
- References and pack agent material: 19 offenders rewritten to `<runtime>/<rel>`; trd-spec.md's TRD skeleton now names `<runtime>/` files, so every TRD the planner writes does too.
- Workflows: 51 offenders rewritten; 38 spawns carry the runtime line (plus 1 exempt sketch); `runtime_root` added to each spawning workflow's init field list.
- Skills, templates, pack skills/workflows: 56 offenders rewritten; 5 more spawns carry the line.
- 81's A/B/C unit tests ignore exactly the runtime line, each with a negative case; 81's frozen modules are untouched and prereg is OK.

## Offender counts per scope (before, from 82-02 → after)

| Scope | Files | Before | After |
|---|---|---|---|
| core_agents | 12 | 0 (82-02) | 0 |
| core_references | 36 | 14 | 0 |
| pack_agent_material | 10 | 6 | 0 |
| core_workflows | 39 | 51 | 0 |
| core_skills | 32 | 26 | 0 |
| core_templates | 38 | 26 | 0 |
| pack_skills_workflows | 10 | 4 | 0 |

core_references went 14 → 13 at RED because the new `Bash(...)` permission-rule class covers unattended-operation.md:81 (a settings.json allow rule); the other 13 were rewritten.

## Spawn sites (43 checked, 1 exempt)

| File | Spawns |
|---|---|
| workflows/execute-objective.md | executor ×2, verifier ×2 (checkpoint and objective), gap-closure planner (+1 exempt sketch) |
| workflows/plan-objective.md | objective-researcher, planner, job-checker, revision planner (markdown prompt blocks) |
| workflows/new-project.md | project-researcher ×4, research-synthesizer, roadmapper ×2 |
| workflows/new-milestone.md | project-researcher, research-synthesizer, roadmapper |
| workflows/quick.md | planner, job-checker, revision planner, executor, verifier |
| workflows/map-codebase.md | codebase-mapper ×4 (YAML form) |
| workflows/security-audit.md | security-auditor ×3 (YAML form) |
| workflows/verify-work.md | planner ×2, job-checker |
| workflows/build.md, audit-milestone.md, research-objective.md | verifier, integration-checker, objective-researcher |
| workflows/diagnose-issues.md | debugger (prompt from templates/debug-subagent-prompt.md) |
| skills/debug, skills/research-objective | debugger ×2, objective-researcher ×2 |
| aoforge-stack-flutter/skills/ui-eval | aoforge-stack-flutter:ui-evaluator |

`rg -n 'AOForge runtime: \{runtime_root\}' plugins/aoforge/aoforge/workflows | rg -c .` prints 37: the 38th workflow spawn (diagnose-issues) takes its line from templates/debug-subagent-prompt.md.

**Exempt Task block:** execute-objective.md's background-execution sketch (`result = Task(... prompt="...", run_in_background=true)`): it restates the executor spawn above it, whose prompt carries the line. Named in SPAWN_EXEMPT with that reason; the test fails if the entry stops matching.

General-purpose spawns (build.md, plan-objective.md and discuss-objective.md chaining a slash command) are not AOForge agents and are not checked.

## ALLOW entries added (3 of 12)

| File | Needle | Reason |
|---|---|---|
| references/defaults-table.md | then edit `~/.claude/aoforge/defaults-table.md` | tells a human where to edit the org-wide defaults table |
| references/testing-strategy.md | override goes in `~/.claude/aoforge/stacks/<id>.md` | tells a human where a user or org stack-profile override file goes |
| skills/handoff/SKILL.md | You add it to ~/.claude/aoforge/aoforge-watch-allow.json | an AskUserQuestion option naming the allowlist file the user edits |

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: References and pack agent material | `node --test runtime-path-reads.repo.test.cjs` (15/15) and 40 reference/pack-reading test files incl. context-budget, stack-neutrality, rename-guard, doc-refs (1268 tests) | 0 | PASS |
| 2: Workflows and spawn lines | `node --test runtime-path-reads.repo.test.cjs` (18/18), 67 workflow-reading files incl. model-placeholders, context-budget, builtin-sweep, planning-writes, doc-refs, rename, stack-neutrality and `scripts/eval81/batches/*.test.cjs` (2036 tests, 3 skipped); `prereg.cjs --check` | 0 | PASS |
| 3: Skills, templates, pack skills; PENDING emptied | `node --test runtime-path-reads.repo.test.cjs` (18/18, 0 offenders in every scope); full suite 13713/13741 pass, the 1 failure pre-existing at the base | 0 | PASS |

## Task Commits

1. **Task 1** RED `35400216` (test), GREEN `ccb30f7a` (fix)
2. **Task 2** RED `21adb02a` (test), GREEN `7a78a9b0` (fix)
3. **Task 3** RED `2b094ba1` (test), GREEN TASK3_HASH (fix)

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (Task 1) | `node --test runtime-path-reads.repo.test.cjs` | 1 (test 10: 13 + 6 offenders; test 17: skeleton has `@~/` lines) | FAIL (correct) |
| GREEN (Task 1) | same | 0 (15/15) | PASS (correct) |
| RED (Task 2) | same | 1 (test 10: 51 workflow offenders; 18: 38 spawns lack the line; 19: research-objective.md and diagnose-issues.md supply no runtime_root) | FAIL (correct) |
| GREEN (Task 2) | same, plus eval81 A/B/C | 0 (18/18; eval81 47 tests) | PASS (correct) |
| RED (Task 3) | same | 1 (test 10: 26 + 26 + 4 offenders; 18: 5 skill spawns; 19: debug and ui-eval skills) | FAIL (correct) |
| GREEN (Task 3) | same | 0 (18/18) | PASS (correct) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | npm test's globs (464 files), `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` excluded (fish hang), HOME/TMPDIR under the session scratchpad, node_modules symlinked from the main checkout: 13741 tests, 13713 pass, 1 fail, 0 cancelled, 27 skipped | 1 | PASS for this TRD: the one failure is pre-existing at the wave base (see Issues Encountered) |
| prereg | `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-.../results/prereg-manifest.json` (private fleet checklist linked in temporarily) | 0 | PASS: 86 files match |

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 5/5 (references and pack material name `<runtime>/` and trd-spec's skeleton does; no `~/` read in workflows, skills or templates with PENDING empty; every spawn carries the runtime line and its file supplies `{runtime_root}`; 81's frozen modules untouched, A/B/C ignore exactly the runtime line, prereg OK; full suite passes with watcher-shell named as the one exclusion)
- **Gate failures:** None caused by this TRD; one pre-existing suite failure at the base (scripts/eval81/score.test.cjs:274, see Issues Encountered)

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - missing link] `runtime_root` added to each spawning workflow's init field list**
- **Found during:** Task 2
- **Issue:** the TRD adds `{runtime_root}` to spawn prompts but the workflows' "Parse JSON for:" / "Extract from init JSON:" lines did not name the field, so the orchestrator had no stated source for the placeholder.
- **Fix:** `` `runtime_root` (fills `{runtime_root}`) `` leads each list in execute-objective, plan-objective, new-project, new-milestone, quick, build, verify-work, map-codebase, security-audit, audit-milestone, resume-project and the research-objective skill.
- **Committed in:** 7a78a9b0, TASK3_HASH

**2. [Rule 1 - guessed home] Routed skills told the model to "expand `~`" itself**
- **Found during:** Task 3
- **Issue:** milestone, objective, status, todo and workstreams said "Read the `workflow` path the route returns (expand `~`)", which asks the model to type a home directory.
- **Fix:** Read `{runtime_root}/workflows/<name>` (route's file name), with the fallback line and "never type a home directory yourself"; the routes list names files only.
- **Committed in:** TASK3_HASH

**3. [Rule 3 - classifier] `Bash(<command>)` permission rules are shell**
- **Found during:** Task 1 (unattended-operation.md:81 is a settings.json allow rule in a json fence)
- **Fix:** a classifier rule plus two unit cases in test 4, instead of an ALLOW entry.
- **Committed in:** 35400216

**4. [Scope] Templates beyond "flagged lines only"**
- templates/debug-subagent-prompt.md gained the runtime line and a `{runtime_root}` placeholder row: it is the prompt body of diagnose-issues.md's debugger spawn (PROMPT_TEMPLATES names it in the guard).
- templates/claude-md.md: the Development Rules lines now read `` `<runtime>/references/tdd.md`; `<runtime>` is the directory `echo ~/.claude/aoforge` prints `` and `` `<runtime>/references/anti-patterns.md` ``. migrations/0005-claude-md-block.test.cjs test 2 pinned the old `~/` wording and now asserts the new form (per the TRD's error recovery). Effect to know: migration 0005 is auto and drift-detected, so the next `upgrade` in each existing project rewrites that project's CLAUDE.md `# Development Rules` section to the new wording.

**5. [Test shape] eval81 C comparison drops the line on both sides**
- C.cjs (frozen) extracts the mapper and researcher prompts from the live workflow, so its descriptors carry the runtime line too; test 3 compares `dropRuntimeLine(d.prompt)` with `dropRuntimeLine(expected)`. A and B compare a frozen template with the live text, so only the live side drops it. Each file has a negative case (a filled runtime line or any other added line still fails).

**6. [Test numbering]** The TRD's test list 1-6 maps to the guard's tests 10/11 (1), 18 (2), 19 (3), 13 (4, unchanged and green), 17 (5) and the A/B/C negative cases (6); 18a holds the extractor units.

**Total deviations:** 6 (1 missing link, 1 guessed-home instruction, 1 classifier rule, 1 template scope note, 2 test-shape notes). **Impact on plan:** none on the design; the CLAUDE.md drift rewrite at the next upgrade is the designed propagation of 0005.

## Issues Encountered

- **Pre-existing full-suite failure, not caused here:** `scripts/eval81/score.test.cjs:274` ("--report reads the tiers from this checkout and never changes them") expects the report to propose `start ui-evaluator at haiku on budget/balanced`, but the live tiers already start ui-evaluator at haiku (82-03 applied that proposal), so the report says "ui-evaluator already starts at haiku on budget/balanced". It fails the same way in a scratch worktree at the wave base dcbfad2a (13 pass, 1 fail), and this TRD touches neither model-profiles.json, the pack manifest nor score.cjs. Left for 82-03's follow-up or 82-10's revalidation (a one-line assertion update); not edited here to avoid a conflicting fix from a parallel TRD.

- `prereg.cjs --check` reads `~/.claude/aoforge/calibration.json` (a manifest extra), so it must run with the real HOME (read-only); with HOME under the scratchpad it reports that one file missing. The private fleet checklist is gitignored in a worktree and was symlinked in for the check, then removed.
- Interface note for 82-06 (batch C) and 82-08: new-project.md's researcher prompts now hold `{runtime_root}` twice, in the runtime line and in `Use template: {runtime_root}/templates/research-project/<DIM>.md`. Batch C must fill every `{runtime_root}` occurrence; removing only the runtime line in tests or dry runs leaves the placeholder in the template line. The researcher Task tails (`", subagent_type="project-researcher", model="{researcher_models.<dim>}"`) are byte-identical.
- For 82-07: the executor spawn's "Read these files yourself" entries in execute-objective.md now read `{runtime_root}/<rel>` with entries and conditions unchanged; any line 82-07 adds must keep `{runtime_root}/` (workflows) or `<runtime>/` (agents), or the guard fails.

## User Setup Required

None - no external service configuration required.

## Next Objective Readiness

82-07 can edit the executor spawn list and planner text on top of the enforced guard; 82-06/82-08's batch C can fill `AOForge runtime: {runtime_root}` with the sandbox runtime root (see the interface note).

---
*Objective: 82-3-1-0-follow-ups*
*Completed: 2026-10-18*
