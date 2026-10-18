---
objective: 82-3-1-0-follow-ups
job: "02"
subsystem: agents
tags: [runtime-path, init, runtime_root, repo-guard, agents, context]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: the evidence that agents guessed an absolute home path (/Users/<guess>/.claude/...) instead of using ~ or a supplied path
provides:
  - "runtime_root: the absolute runtime directory in every compound `aof-tools init <cmd>` JSON"
  - "runtime-path-reads.repo.test.cjs: the guard (shell / skill_include / memory_import / allow / offender) with ENFORCED and PENDING scopes"
  - "11 core agents that name runtime files <runtime>/<rel> and carry the pinned <runtime_paths> block"
affects: [82-07, 82-11]

tech-stack:
  added: []
  patterns:
    - "one source for the runtime directory: compat.runtimeHome(os.homedir())"
    - "a repo guard with ENFORCED and PENDING scopes that a later TRD empties"

key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/runtime-root.test.cjs
    - plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
  modified:
    - plugins/aoforge/aoforge/bin/lib/init.cjs
    - plugins/aoforge/agents/codebase-mapper.md
    - plugins/aoforge/agents/debugger.md
    - plugins/aoforge/agents/executor.md
    - plugins/aoforge/agents/integration-checker.md
    - plugins/aoforge/agents/job-checker.md
    - plugins/aoforge/agents/objective-researcher.md
    - plugins/aoforge/agents/planner.md
    - plugins/aoforge/agents/project-researcher.md
    - plugins/aoforge/agents/research-synthesizer.md
    - plugins/aoforge/agents/roadmapper.md
    - plugins/aoforge/agents/verifier.md

key-decisions:
  - "The pinned block says the agent takes <runtime> from the spawn prompt's `AOForge runtime:` line, else init's runtime_root, else `echo ~/.claude/aoforge` in Bash, and never types or guesses a home directory. It does not claim the Read tool fails on `~` (it expands it; objective 81's evidence)."
  - "The pinned block names `~/.claude/aoforge` only inside shell spans (`echo ...`, `node ...`), so the guard needs no exemption for it."
  - "pack_skills_workflows also covers plugins/eden-ui-*: their skills @-include aoforge references and one reference names a runtime file in prose, so they must sit in a scope."

requirements-completed: [SC-2]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 15min
completed: 2026-10-18
tokens_input: 11080441
tokens_output: 78172
tokens_cache_read: 10904796
tokens_cache_write: 175487
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 82 TRD 02: absolute runtime path for agents, and the guard Summary

**Every compound `aof-tools init` prints an absolute `runtime_root`, the 11 core agents that read AOForge runtime files name them `<runtime>/<rel>` under one pinned `<runtime_paths>` block (so none has to guess a home directory), and a repo guard fails CI if a `~/.claude/aoforge` read instruction returns to a core agent.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-18T01:13:57Z
- **Completed:** 2026-10-18T01:29:00Z
- **Tasks:** 3 (5 commits with the RED test for Task 1 and the RED guard for Task 2)
- **Files modified:** 15

## Progress
- [x] Task 1: runtime_root in every compound init — 0e5e3da1 (RED 5496d55f)
- [x] Task 2: The guard, RED on the real tree — cad6bc8a
- [x] Task 3: Rewrite the core agents until the guard is green — b1e2850e

## Accomplishments

- `init.cjs` has one helper, `runtimeRootField()` (`compat.runtimeHome(os.homedir())`), spread into all 13 compound init results. The value is absolute, has no `~`, is the same from any cwd and is printed when the runtime directory does not exist; nothing is created.
- `runtime-path-reads.repo.test.cjs` classifies every `~/.claude/aoforge` occurrence as shell, skill include, memory import, allowlisted or offender. `core_agents` is ENFORCED (0 offenders); the other six scopes are PENDING and print their counts.
- 33 core-agent occurrences rewritten to `<runtime>/<rel>`; the pinned block sits right after `</role>` in the 11 agents that name `<runtime>/` (executor, planner and verifier always). Shell commands (`node ~/.claude/aoforge/bin/...`) are unchanged.

Wording correction applied as instructed by the user: the pinned block, the guard's header, the test messages and this SUMMARY do not claim the Read tool fails on `~`. The rationale everywhere is "a supplied absolute path removes the chance to guess a home directory". The TRD's sentence "The Read tool does not expand `~`: never type a home directory yourself, and never Read a path that starts with `~`" became "Read runtime files at that absolute path (`<runtime>/<rel>`), exactly as supplied: never type or guess a home directory yourself." The TRD text quoted the block verbatim only in its own spec, no existing test did, so no test needed the old wording.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: runtime_root in every compound init | `node --test runtime-root.test.cjs init.test.cjs init-pr-lifecycle.test.cjs stack-init.test.cjs model-placeholders.repo.test.cjs model-profiles.test.cjs` (139 tests) | 0 | PASS |
| 2: the guard, RED on the real tree | `node --test runtime-path-reads.repo.test.cjs`: units 4-9, 11, 12, 14, 15, 15a, 16 pass; 10 and 13 fail naming the offenders | 1 (RED, correct) | PASS |
| 3: rewrite core agents | `node --test runtime-path-reads.repo.test.cjs` 14/14, and the 1455-test agent/reference-reading set (context-budget, stack-neutrality, rename-guard, doc-refs, model-placeholders among them) | 0 | PASS |

## Task Commits

1. **Task 1 RED** `5496d55f` (test); **GREEN** `0e5e3da1` (feat)
2. **Task 2** `cad6bc8a` (test, RED on core agents)
3. **Task 3** `b1e2850e` (fix)

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (Task 1) | `node --test runtime-root.test.cjs` | 1 (tests 1 and 2: `runtime_root` undefined) | FAIL (correct) |
| GREEN (Task 1) | `node --test runtime-root.test.cjs` | 0 (3/3) | PASS (correct) |
| RED (Task 2/3) | `node --test runtime-path-reads.repo.test.cjs` | 1 (test 10: 33 offenders; test 13: executor, planner, verifier lack the block) | FAIL (correct) |
| GREEN (Task 3) | `node --test runtime-path-reads.repo.test.cjs` | 0 (14/14) | PASS (correct) |

## RED offender counts (core_agents: 33)

codebase-mapper 3, debugger 2, executor 9, integration-checker 1, job-checker 1, objective-researcher 1, planner 7, project-researcher 2, research-synthesizer 2, roadmapper 2, verifier 3. Planning-time inventory said 32; the guard found one more (planner.md line 213, the defaults-table path in prose) and recognised that planner 1076 and roadmapper 570 are shell commands inside markdown template fences.

## PENDING scopes left for 82-11 (offenders / files scanned)

| Scope | Offenders | Files | Offenders by file |
|---|---|---|---|
| core_references | 14 | 36 | testing-strategy 4, defaults-table 2, trd-spec 2, unattended-operation 2, anti-patterns 1, built-ins 1, model-profile-resolution 1, verification-patterns 1 |
| pack_agent_material | 6 | 10 | flutter fragments/executor 2, fragments/planner 1, fragments/verifier 1, profiles/dart 1, profiles/flutter 1 |
| core_workflows | 51 | 39 | execute-objective 12, discovery-objective 5, execute-trd 5, new-project 5, settings 5, plan-objective 3, verify-objective 3, health 2, new-milestone 2, research-objective 2, verify-work 2, adopt 1, build 1, complete-milestone 1, map-codebase 1, resume-project 1 |
| core_skills | 26 | 32 | awareness 3, initiatives 4, milestone 4, status 4, workstreams 4, objective 2, todo 2, handoff 1, sync-roadmap 1, verify-work 1 |
| core_templates | 26 | 38 | job-prompt 10, trd-prompt 6, claude-md 4, objective 3, codebase/structure 1, project 1, stack 1 |
| pack_skills_workflows | 4 | 10 | eden-ui-flutter frontend-design 2, eden-ui-web frontend-design 1, eden-ui-web references/brand-presets 1 |

The scope list is the TRD's seven, with one extension: `pack_skills_workflows` also covers `plugins/eden-ui-*` (skills and references), which the TRD's pack glob did not reach. Their 4 offenders are 82-11's to rewrite with the rest of that scope.

## ALLOW and UNSCANNED entries

`ALLOW` is empty (max 12): no occurrence needed a human-facing "edit ~/..." allowance in the enforced scope. 82-11 adds its own from references and workflows, each with a reason; the stale-entry check (test 12) already runs.

`UNSCANNED` (markdown outside every scope that mentions the runtime path; test 16 fails on any other):

| File | Reason |
|---|---|
| plugins/aoforge/aoforge/stack-profiles/go.md | a statement of where an org or user profile override lives, in a profile the CLI prints |
| plugins/aoforge/aoforge/bin/lib/doctor-checks/README.md | the contributor guide to doctor checks; says where doctor looks and moves user files; no agent reads it |
| plugins/aoforge-stack-flutter/CHANGELOG.md | release history; a record of a past change |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | npm test's globs, `watcher-shell.test.cjs` excluded, HOME/TMPDIR under the scratchpad, `node_modules` symlinked from the main checkout: 13575 tests | 0 | PASS: 13546 pass, 0 fail, 0 cancelled, 29 skipped |
| prereg | `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-.../results/prereg-manifest.json` | 0 | PASS: 86 files match (see Issues Encountered) |

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 4/4 (runtime_root in all 13 inits; guard classifies and fails on offenders; no `~/` read instruction in core agents, each carrying the block; the six other scopes listed as PENDING with counts)
- **Gate failures:** None

## Decisions Made

See `key-decisions`. The classifier also looks for inline code spans inside non-shell fences, because the planner and roadmapper keep shell commands in `` `...` `` spans inside ```` ```markdown ```` template fences.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - wording] The `~` rationale, as the user corrected it**
- **Found during:** Task 2 (pinned block)
- **Issue:** the TRD's pinned block and objective text say the Read tool does not expand `~`; objective 81's evidence shows it does. The real defect is agents guessing an absolute home.
- **Fix:** wording changed everywhere I wrote it (see Accomplishments). The design is unchanged.
- **Files modified:** runtime-path-reads.repo.test.cjs (RUNTIME_BLOCK and header), the 11 agents
- **Committed in:** cad6bc8a, b1e2850e

**2. [Rule 2 - guard scope] Guessed-home detection and a scope-coverage check**
- **Found during:** Task 2
- **Issue:** the objective asks for a guard against guessed-home instructions as well as `~` reads, and the TRD's seven scopes left plugin markdown (eden-ui, doctor README, pack CHANGELOG, go.md profile) that mentions the runtime path outside every scope.
- **Fix:** test 15 fails on a hard-coded `/Users/<name>/.claude/aoforge` or `/home/<name>/.claude/aoforge` in any scanned file (none exist today); test 16 fails on plugin markdown outside every scope that mentions the runtime path, with the three named UNSCANNED entries; `pack_skills_workflows` includes `plugins/eden-ui-*`.
- **Files modified:** runtime-path-reads.repo.test.cjs
- **Committed in:** cad6bc8a

**3. [Rule 1 - test shape] Test 3 cannot use an init that prints one field**
- **Found during:** Task 1
- **Issue:** none of the 13 compound inits has a `--raw` single-field output (they pass no raw value to `output`); the only init-family command that does is `resolve-model`.
- **Fix:** test 3 asserts `init progress --raw` prints the same JSON as without `--raw`, and `resolve-model executor --raw` still prints only the model name with no `runtime_root`.
- **Files modified:** runtime-root.test.cjs
- **Committed in:** 5496d55f

**4. [Rule 3 - classifier] Inline spans inside non-shell fences; continuation lines**
- **Found during:** Task 2 (the first real-tree run flagged planner 1076 and roadmapper 570, which are shell commands)
- **Fix:** the inline-span rule also applies inside a non-shell fence; a fenced shell line continues the command above it when that line ends with `\`. Unit cases added to tests 4.
- **Committed in:** cad6bc8a

**Total deviations:** 4 (wording per the user's correction, 2 guard extensions, 1 test shape). **Impact on plan:** none on the design; no scope creep beyond the guard file.

## Issues Encountered

- The first full-suite run in the worktree showed 14 failures, all in daemon-dependent tests (aoforge-watch start/stop, handoff pipeline end to end, the hook audit's route-results spawn). They pass at the base in the main checkout, and in the worktree once `node_modules` is symlinked in: the worktree has no `node_modules` and the daemon needs it. With the symlink the full run was 13575 tests, 0 failed. The symlink was removed before the final commit and was never tracked.
- `prereg.cjs --check` reports one missing file in the worktree (`.aoforge/objectives/81-.../private/fleet-checklists.json`) because that file is gitignored and so not checked out. With a copy from the main checkout placed there for the check it exits 0 (86 files match); the copy was removed afterwards. `scripts/eval81/**` is untouched.
- zsh does not word-split `$FILES`; the multi-file `node --test` runs go through `xargs`.

## User Setup Required

None - no external service configuration required.

## Next Objective Readiness

82-11 can enforce the six PENDING scopes using `RUNTIME_BLOCK`, `SCOPES`, `ENFORCED` and `PENDING` from `runtime-path-reads.repo.test.cjs`, and spawn prompts (82-07, 82-11) can pass the `AOForge runtime: {runtime_root}` line the pinned block names. 82-04's docs may mention `runtime_root` in the init output.

## Self-Check: PASSED

- Created and modified files exist (init.cjs, runtime-root.test.cjs, runtime-path-reads.repo.test.cjs, the 11 agents).
- Commits 5496d55f, 0e5e3da1, cad6bc8a and b1e2850e are in the log.
- `<runtime_paths>` appears exactly once in each of the 11 agents; the guard (14 tests) is green.

---
*Objective: 82-3-1-0-follow-ups*
*Completed: 2026-10-18*
