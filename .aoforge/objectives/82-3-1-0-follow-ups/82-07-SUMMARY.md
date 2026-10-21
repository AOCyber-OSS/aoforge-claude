---
objective: 82-3-1-0-follow-ups
job: "07"
subsystem: agents
tags: [build-cell, tokens, planner, executor, trd-spec, summary-skeleton, tdd, eval81]

requires:
  - objective: 82-3-1-0-follow-ups
    provides: "82-01: 82-DIAGNOSIS.md Fix list; 82-02 and 82-11: runtime_root, the <runtime_paths> block and the enforced runtime-path guard"
provides:
  - "planner.md: TRDs follow trd-spec.md with no template look-up (P-1), a final-commit sentence (P-2), the 40,000-char ceiling with a 15,000-20,000 size for a small TRD (P-3), the exact four checkers in validate_plan (P-4), verify job-structure (X-1)"
  - "executor.md: an inline SUMMARY skeleton (E-1), <tdd_execution> as the whole TDD procedure (E-2), read-the-draft-before-the-final-Write (E-5), the final-commit sentence (P-2)"
  - "execute-objective.md executor spawns and execute-trd.md no longer send the executor to templates/summary.md or references/tdd.md"
  - "build-cell-reads.repo.test.cjs: one pin per FIX row (tests 1-8)"
  - "82-DIAGNOSIS.md ## Fix applied with commits, pins and the offline effect"
affects: [82-09, 82-10]

tech-stack:
  added: []
  patterns:
    - "a prompt fix that removes a read pins the absence in every place that could send the agent there (both spawn sites, the agent, the workflow it falls back to)"

key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs
  modified:
    - plugins/aoforge/agents/planner.md
    - plugins/aoforge/agents/executor.md
    - plugins/aoforge/aoforge/references/trd-spec.md
    - plugins/aoforge/aoforge/workflows/execute-objective.md
    - plugins/aoforge/aoforge/workflows/execute-trd.md
    - scripts/eval81/score.test.cjs
    - scripts/eval82/check-rules.test.cjs
    - .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md

key-decisions:
  - "The diagnosis row's change wins over the TRD catalogue: E-2 keeps <tdd_execution> as the procedure (adding three missing lines from tdd.md) rather than a separate card; E-3 was rejected in the diagnosis, so it has no test"
  - "P-1 also completes trd-spec.md (stack-pack frontmatter fields, `ui` type) so the instruction that it is the complete skeleton is true; the test checks every section tag and field of templates/trd-prompt.md"
  - "P-2's sentence states what aof-tools commit actually does (no attribution trailer; store mode appends its own Refs #N line), checked in misc.cjs and commit-trailer.cjs"
  - "The SUMMARY skeleton keeps comments off value lines, because extractFrontmatter keeps an inline # comment as part of the value"

requirements-completed: [SC-1]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 19min
completed: 2026-10-18
tokens_input: 29787470
tokens_output: 107915
tokens_cache_read: 29506698
tokens_cache_write: 280488
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 82 TRD 07: build-cell fixes Summary

**Every FIX row of 82-DIAGNOSIS.md is in place and pinned by build-cell-reads.repo.test.cjs: the planner no longer has a reason to hunt a template, re-open its commit, pad a TRD or read the tool source. The executor no longer reads templates/summary.md or references/tdd.md up front (-24,117 bytes per executor) and reads its draft before the final Write. A 2-TRD tdd build is told to read 47,708 fewer bytes before the first write (78,927 -> 31,219).**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-18T03:24:05Z
- **Completed:** 2026-10-18T03:42:37Z
- **Tasks:** 2 (4 TRD commits: RED and GREEN per task; plus the extra score-test fix and the docs commit)
- **Files modified:** 9

## Progress
- [x] Task 1: Planner-side FIX rows (P-1, P-2, P-3, P-4, X-1) — 002117b3 (RED 85ec0064)
- [x] Task 2: Executor-side FIX rows (E-1, E-2, E-5), the offline effect and `## Fix applied` — 6e7574bf (RED f666a1e6), docs aa897b4f

## Fix-list rows

| id | disposition | commits | pinning test | change |
|---|---|---|---|---|
| P-1 | FIX | 85ec0064, 002117b3 | build-cell-reads test 1 | planner.md write_objective_prompt: "Each TRD follows the structure `<runtime>/references/trd-spec.md` defines ... there is no template file to look up: do not list or read `<runtime>/templates/`"; <plan_format> says trd-spec.md is the complete skeleton; trd-spec.md gained `stack`, `platform`, `api_contract` and `ui` |
| P-2 | FIX | 85ec0064, 002117b3 | test 2 | planner.md git_commit and executor.md task_commit_protocol: `aof-tools commit` is the only commit path and final; no attribution trailer; no `git log -1 --format=%B`, `git commit --amend` or `aof-tools commit --help` |
| P-3 | FIX | 85ec0064, 002117b3 | test 3 | TRD Scope Budget: 40,000 is a ceiling, not a target; a TRD of up to 2 tasks and 6 files stays near 15,000-20,000 chars; never pad `<context>`, `<output>`, `<embedded_context>` |
| P-4 | FIX | 85ec0064, 002117b3 | test 4 | validate_plan: exactly frontmatter validate, verify job-structure, trd-tdd inspect, then verify trd-pre after plan put-trd; output authoritative; do not read `<runtime>/bin`; angle-bracket literals are fine |
| P-5 | JUSTIFY | none | n/a | testing-strategy.md whole read kept (under 5% of either delta; holds the layer table) |
| E-1 | FIX | f666a1e6, 6e7574bf | test 5 | summary.md dropped from both executor spawns, executor.md and execute-trd.md; 1,631-char SUMMARY skeleton in executor.md <summary_creation>; the template only for a field the skeleton lacks, with offset/limit |
| E-2 | FIX | f666a1e6, 6e7574bf | test 6 | tdd.md dropped from both executor spawns and execute-trd.md <required_reading>; <tdd_execution> is the procedure (plus unrelated-test, test-naming and TDD-EXCEPTION lines); tdd.md only for a TDD-precedence question |
| E-4 | FIX | 82-02: 5496d55f, 0e5e3da1, cad6bc8a, b1e2850e; 82-11: 35400216, ccb30f7a, 21adb02a, 7a78a9b0, 2b094ba1, add7a1d8 | runtime-path-reads.repo.test.cjs, runtime-root.test.cjs | done before this TRD; every path added here uses `<runtime>/` or `{runtime_root}/`, guard green |
| E-5 | FIX | f666a1e6, 6e7574bf | test 7 | summary_creation: `summary checkpoint --tick` edits the draft in place; Read the draft immediately before the final Write (or Edit); never Write the whole SUMMARY twice |
| X-1 | FIX | 85ec0064, 002117b3 | test 8 | `verify trd-structure` -> `verify job-structure`; test 8 checks every `aof-tools verify <sub>` in agents, skills, workflows and references against the CLI's list |
| X-2 | JUSTIFY | none | n/a | scratch-copy check kept (3.0.0 did it too; proves the TRD's verify commands run) |

E-3 was rejected in the diagnosis (cause 9): no row, no test.

## Offline effect (from 82-DIAGNOSIS.md `## Fix applied`)

- **Resident bytes per spawn** (`scripts/eval81/static-prompt.cjs`; JSON and markdown under the session scratchpad's `82-07/`): planner 54,865 at 99950509 -> 57,036 at HEAD 6e7574bf (+2,171, +3.96%; 82-07 alone, from f9181405: +1,618, +2.92%); executor 52,632 -> 55,668 (+3,036, +5.77%; 82-07 alone +2,493, +4.69%: body +2,696, spawn prompt -203).
- **Bytes told to read before the first write, 2-TRD tdd build:** planner 30,693 -> 31,219 (+526: trd-spec.md's stack fields and 82-11's rewrite); the planner's template look-up (8,416 bytes, not named but read in both 3.1.0 runs) ruled out; executor 24,117 -> 0 per spawn. Build: 78,927 -> 31,219 (-47,708, -60.4%), or 87,343 -> 31,219 (-56,124, -64.3%) counting the template look-up. Net of 82-07's resident growth for the build (+6,604 bytes): about 41,000-49,500 bytes less.
- Token effects remain the Fix list's upper bounds (P-1 243,936-442,456; P-2 216,601-307,698; P-4 210,496; E-1 + E-2 543,391 over 2 executors; E-5 about 121,000); 82-09 measures them live.

## Accomplishments

- Pins for every FIX row in a new repo test (8 tests), RED before GREEN for both tasks.
- The executor spawn now lists checkpoints.md (conditional), anti-patterns.md (not needed) and execute-trd.md (only if unclear), nothing else.
- trd-spec.md carries every section tag and frontmatter field templates/trd-prompt.md had.
- 82-DIAGNOSIS.md `## Fix applied` parses with eval82's `fixListAsApplied` (11 rows: 9 FIX, 2 JUSTIFY, matching the Fix list).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Planner-side FIX rows | `node --test build-cell-reads.repo.test.cjs` (5/5), then every `*.repo.test.cjs`, model-profiles, planning-audit, rg-flag-guard, stack-*, frontmatter, tokens-cli, eval81 batches A-E and static-prompt (898 tests) | 0 | PASS |
| 2: Executor-side FIX rows, offline effect, Fix applied | `node --test build-cell-reads.repo.test.cjs` (8/8), the same batch plus summary-pairing, summary-worktree, planning-verbs e2e, templates, verify-completion and gate-executor-stop (914 tests); full suite (see gates) | 0 | PASS |
| extra: eval81 score test | `node --test scripts/eval81/score.test.cjs` (14/14); `prereg.cjs --check` (81) OK, 86 files | 0 | PASS |

## Task Commits

1. **Extra (orchestrator):** `d27390c5` test(82-07): eval81 score test reads the live P1 tier
2. **Task 1:** RED `85ec0064` (test), GREEN `002117b3` (fix)
3. **Task 2:** RED `f666a1e6` (test), GREEN `6e7574bf` (fix), eval82 test fix `bc46e935` (deviation 8), docs `aa897b4f` (82-DIAGNOSIS.md `## Fix applied`)

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (Task 1) | `node --test build-cell-reads.repo.test.cjs` | 1 (tests 1-4 and 8 fail: "Use template structure", no final-commit sentence, "target 40,000", no `verify job-structure`, `planner.md:976 verify trd-structure`) | FAIL (correct) |
| GREEN (Task 1) | same | 0 (5/5) | PASS (correct) |
| RED (Task 2) | same | 1 (tests 5-7 fail: no skeleton fence, no TDD-EXCEPTION in <tdd_execution>, no `--tick` sentence) | FAIL (correct) |
| GREEN (Task 2) | same | 0 (8/8) | PASS (correct) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | npm test's globs, `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` excluded (fish hang), HOME/TMPDIR under the session scratchpad, 469 files: 13773 tests, 13746 pass, 0 fail, 0 cancelled, 27 skipped | 0 | PASS |
| prereg 81 | `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` | 0 | PASS: 86 files |
| prereg 82 | same with `.aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json` (covers scripts/eval82 and 82-CHECK-RULES.md; nothing here touches them) | 0 | PASS: 25 files |

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 5/5 (every FIX row pinned and every JUSTIFY row has its paragraph; `## Fix applied` with commits, pins and offline effect; 81's frozen modules untouched (`git diff f9181405 HEAD -- scripts/eval81 scripts/eval82` shows only score.test.cjs) and A/B pass without an ignore-list change, since no fix touched the verifier or job-checker spawn; the runtime-path guard green; the full suite passes with watcher-shell named as the one exclusion)
- **Gate failures:** None

## Files Created/Modified

- `plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs` - the pins (tests 1-8)
- `plugins/aoforge/agents/planner.md` - P-1, P-2, P-3, P-4, X-1
- `plugins/aoforge/agents/executor.md` - P-2, E-1, E-2, E-5
- `plugins/aoforge/aoforge/references/trd-spec.md` - P-1 (stack-pack fields, `ui`)
- `plugins/aoforge/aoforge/workflows/execute-objective.md` - E-1, E-2 (both executor spawns)
- `plugins/aoforge/aoforge/workflows/execute-trd.md` - E-1, E-2
- `scripts/eval81/score.test.cjs` - the extra fix
- `scripts/eval82/check-rules.test.cjs` - deviation 8
- `.aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md` - `## Fix applied`

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Orchestrator extra] eval81 score test reads the live P1 tier**
- **Issue:** `scripts/eval81/score.test.cjs:274` expected the report to propose `start ui-evaluator at haiku on budget/balanced`, but 82-03 applied that proposal, so `decide.cjs` returns the note "ui-evaluator already starts at haiku on budget/balanced; the evidence weakly supports it" and no proposal.
- **Fix:** the test expects the note and asserts the proposal text is absent; comment names objective 82 / 82-03. score.test.cjs is not in 81's prereg manifest; the check still passes (86 files).
- **Committed in:** d27390c5

**2. [Scope] P-2's sentence lands in executor.md in Task 1**, because the row names both planner.md and executor.md.

**3. [Scope] trd-spec.md completed for P-1**: the stack-pack fields (`stack`, `platform`, `api_contract`) and `ui` in the `type` row were the only things templates/trd-prompt.md carried that trd-spec.md lacked (the TRD's P-1 catalogue asks for this; the row's change does not forbid it).

**4. [Rule 1 - wording] Two planner lines reworded for the planning-write guard**: "Write each TRD ..." and "Write what the executor needs" were flagged by planning-writes.repo.test.cjs (a write verb next to "TRD" with no verb call nearby); they now read "Each TRD follows the structure ..." and "Give the executor what it needs". Committed in 002117b3.

**5. [Test shape] The executor-spawn helper in test 5 stops at the next spawn**, so the background-execution sketch (`prompt="..."`) is not counted as a third spawn. Committed in 6e7574bf.

**6. [Test list] Numbering follows the Fix-list order** (P-1 to P-4 = 1-4, E-1 = 5, E-2 = 6, E-5 = 7, X-1 = 8); the TRD's example list had an E-3 test, which the diagnosis rejected.

**7. [Catalogue vs row] E-2 has no separate "TDD card"**: the row says `<tdd_execution>` is the procedure; it gained the three lines it lacked from tdd.md (unrelated tests, test naming, TDD-EXCEPTION) rather than a parallel card.

**8. [Rule 3 - blocking] eval82 check-rules test 9a assumed 82-DIAGNOSIS.md had no `## Fix applied`**
- **Found during:** Task 2 (first full-suite run: 2 failures)
- **Issue:** 9a appends a synthetic `## Fix applied` to the live diagnosis and expects E-5 to read JUSTIFY; `fixListAsApplied` (frozen in 82-06's manifest) reads the first such section, which is now the real one (E-5 FIX).
- **Fix:** the test strips the real section before appending its synthetic ones, and asserts the real section keeps every listed disposition. check-rules.test.cjs is excluded from objective 82's prereg manifest; check-rules.cjs is untouched and the check still passes (25 files).
- **Committed in:** bc46e935

---

**Total deviations:** 8 (1 orchestrator extra, 2 scope, 1 wording, 2 test-shape, 1 catalogue choice, 1 blocking test assumption). **Impact on plan:** none on the design.

## Issues Encountered

- **Todo candidates (not done here):**
  1. `references/trd-spec.md`'s TRD skeleton still lists `<runtime>/templates/summary.md` in `<execution_context>` (82-11's runtime-path test 17 pins it), so every TRD names the template to its executor. executor.md says the skeleton replaces it; 82-09 shows whether executors still open it. Dropping it needs test 17 changed.
  2. `templates/summary.md` writes `requirements-completed: []  # REQUIRED ...`; `extractFrontmatter` keeps the inline comment, so a verbatim copy parses as a string. Move the comment to its own line or strip inline comments in the parser.
  3. `templates/trd-prompt.md` is no longer read by any agent (only planning-audit and two repo tests name it); it could become a pointer to trd-spec.md.
- The background-execution sketch in execute-objective.md (`prompt="..."`) restates the executor spawn and so inherits its list; nothing to change.
- The first full-suite run also failed `ui-metrics.test.cjs` "fix_per_feat ..." with git's "unable to create temporary file: Invalid argument" under the parallel run; the file passes alone (17/17) and in the second full run, and this TRD does not touch it.

## User Setup Required

None - no external service configuration required.

## Next Objective Readiness

82-09 can re-run the build cell: 82-06's check rules read `## Fix applied` (verified with `fixListAsApplied`: 9 FIX, 2 JUSTIFY), and every FIX row's category has its target count. 82-08 and 82-10 were not started.

## Self-Check: PASSED

- Commits d27390c5, 85ec0064, 002117b3, f666a1e6, 6e7574bf, bc46e935 and aa897b4f are in `git log f9181405..HEAD`.
- build-cell-reads.repo.test.cjs exists and passes 8/8; 82-DIAGNOSIS.md has `## Fix applied` with a line for each of the 11 Fix-list rows.
- Full suite 13773 tests, 13746 pass, 0 fail, 0 cancelled, 27 skipped (watcher-shell.test.cjs excluded); prereg 81 OK (86 files), prereg 82 OK (25 files).
- `git diff f9181405 HEAD -- scripts/eval81 scripts/eval82` touches only score.test.cjs and check-rules.test.cjs, neither frozen.
- Nothing added here claims the Read tool fails on `~`; E-4's text says the guessed absolute home was the defect.
