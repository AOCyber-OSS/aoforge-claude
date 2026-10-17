---
objective: 81-haiku-eval-and-model-efficiency-measurement
job: "07"
subsystem: testing
tags: [static-prompt, resident-prompt, 76-08, model-efficiency, git-show]

requires:
  - objective: 76-model-efficiency-and-stack-specific-content
    provides: the prompt cuts (Flutter procedure to packs, dead @ lists) and the finding that @ paths do not cross the Task boundary
provides:
  - scripts/eval81/static-prompt.cjs, a read-only (git ls-tree and git show) measurement of agent definition and spawn-prompt bytes between two refs
  - 81-STATIC-PROMPT.md, the 3.0.0 vs 3.1.0 per-agent comparison (free half of 76-08, SC-4)
  - results/static-prompt.json, the same numbers for the 76-08 report (TRD 81-12)
affects: [81-12, 81-17, 81-19]

tech-stack:
  added: []
  patterns:
    - "Read two release trees with git show only; no checkout, no worktree"
    - "A number that cannot be found is null with a reason, never a guess"

key-files:
  created:
    - scripts/eval81/static-prompt.cjs
    - scripts/eval81/static-prompt.test.cjs
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-STATIC-PROMPT.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json
  modified: []

key-decisions:
  - "Resident bytes = agent body (frontmatter excluded) + the largest spawn-prompt template; named @ paths and stack-pack fragments are reported apart, not resident"
  - "3.1.0 is the branch HEAD at the run (c4694697, plugins tree 32213984, identical to the wave base 8ba149b6); the tree hash is recorded because the commit moves"
  - "A like-for-like core total (agents core in both trees) is reported next to the plain core total because ui-evaluator left core for a pack"
  - "Pack fragments an agent Reads at run time are tabulated: for a Flutter project the verifier, executor and planner carry 2.6 to 4.5 KB more than 3.0.0 once the fragment is read, so the cut is a move for those projects"

requirements-completed: [SC-4]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 13min
completed: 2026-10-17
tokens_input: 12521684
tokens_output: 108579
tokens_cache_read: 12313654
tokens_cache_write: 207882
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 81 TRD 07: Static resident-prompt comparison, 3.0.0 vs 3.1.0 Summary

**Verifier resident prompt falls 35.2% (48,026 to 31,109 bytes), executor 18.4% and planner 10.4% between 3.0.0 and 3.1.0, measured by reading both release trees with `git show`; Flutter projects read 2.6 to 4.5 KB of pack fragment on top.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-17T16:23:23Z
- **Completed:** 2026-10-17T16:36:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 created (script, test, report, JSON), plus this SUMMARY

## Accomplishments

- `scripts/eval81/static-prompt.cjs` (`measureRef`, `extractSpawnPrompts`, `namedAtPaths`, `compare`, CLI) reads a ref through
  `git ls-tree` and `git show` only, finds every agent spawn in workflows, skills, templates and pack fragments, and
  reports per agent the definition bytes, the largest spawn template (file and line for every site), the named `@`
  bytes and a resident estimate in bytes and tokens. 19 tests, hand-built snippets and a temp repo with two tags.
- `81-STATIC-PROMPT.md` compares the two trees for 15 agents: verifier -16,917 bytes (-35.22%), executor -11,897
  (-18.44%), planner -6,390 (-10.43%), security-auditor -5,035 (-34.27%); core total 318,035 to 271,757 bytes
  (-14.55%), -12.63% like for like. Pack agents (ui-evaluator, web-ui-verifier) are counted apart; named `@` paths are
  their own table because they do not cross the Task boundary.
- `results/static-prompt.json` carries the same rows, every spawn site and the totals for TRD 81-12.
- Three hand spot-checks agree with the script: verifier agent bytes (47839 and 30490 by `wc -c`), one spawn prompt
  (946 bytes counted by hand), the executor's named-`@` sum (121,022).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Static prompt measurement script | `node --test scripts/eval81/static-prompt.test.cjs` (19 tests, 19 pass) | 0 | PASS |
| 2: Run 3.0.0 vs 3.1.0 and publish the comparison | three hand spot-checks equal the script; `git show --stat HEAD` lists the files | 0 | PASS |

## Task Commits

1. **Task 1: Static prompt measurement script**
   - `b9a2ad90` test (RED: tests written, module absent)
   - `83da5230` feat (GREEN, plus the `Agent(` and adjacent-block shapes found on the real trees)
   - `c4694697` feat (like-for-like core total)
2. **Task 2: Run and publish** - `e466b75f` (docs: report, JSON, SUMMARY checkpoint)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (TRD validation gate) | `node --test scripts/eval81/static-prompt.test.cjs` | 0 | PASS |
| repo guards that scan scripts | `node --test rename-guard.repo.test.cjs regex-escape.repo.test.cjs planning-writes.repo.test.cjs doc-refs.repo.test.cjs` (59 tests) | 0 | PASS |
| full suite (`npm test`) | not run: the TRD's gate is the scoped test above, and the full suite carries a known hanging test | - | not_available |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test scripts/eval81/static-prompt.test.cjs` | 1 (Cannot find module './static-prompt.cjs') | FAIL (correct) |
| GREEN | `node --test scripts/eval81/static-prompt.test.cjs` | 0 (16 tests, then 19 with the two real-tree shapes and the core_both assertion) | PASS (correct) |

## Discovered commands

None. The repo's STACK.md supplies `node --test {files}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Two spawn shapes the first run on the real trees missed**
- **Found during:** Task 2 (first run against v3.0.0 and HEAD, before the Task 1 commit landed)
- **Issue:** the web pack's `Agent(subagent_type="aoforge-stack-web:web-ui-verifier", ...)` in `fragments/verifier.md`
  had no row, and four skill sites (`prompt=filled_prompt`, `prompt=continuation_prompt` in `debug` and
  `research-objective` SKILL.md) were null because their template is an unlabelled markdown block directly above the call.
- **Fix:** added tests 2e, 4c and 4d first (2e and 4c seen failing), then `Agent(` as a call form and a third
  variable-resolution rule (a markdown block with only blank lines between its closing fence and the call). The rule
  records `form: variable:adjacent-block`; a bash block or a block with prose between stays null (test 4d).
- **Files modified:** scripts/eval81/static-prompt.cjs, scripts/eval81/static-prompt.test.cjs
- **Commit:** 83da5230 (landed with the GREEN commit rather than separately)

**2. [Rule 2 - Missing critical functionality] A like-for-like total**
- **Found during:** Task 2 (reading the totals)
- **Issue:** `ui-evaluator` is core in 3.0.0 and a pack agent in 3.1.0, so the plain core delta (-46,278) includes
  6,981 bytes that left core without shrinking anywhere.
- **Fix:** `totals.core_both` (agents core and defined in both trees: -39,297, -12.63%) with a test assertion and a
  table row.
- **Commit:** c4694697

### Decisions

- Resident excludes the YAML frontmatter (it is not part of the subagent's system prompt); `agent_bytes` (whole
  file) is in the JSON for `wc -c` checks.
- Token metrics use the key `delta_tokens`; byte metrics use `delta_bytes` as the TRD specified.
- Task 1 has three commits, not one: the TDD flow commits RED and GREEN separately and the like-for-like total came
  after the first run on real data.

### Auth gates

None.

## Post-TRD Verification

- Auto-fix cycles used: 0 (two Rule 2 additions, no failing gate)
- Must-haves verified: 4/4 truths. CLI via `git show` only (test 1 asserts a clean repo, one worktree and only the
  two output files); every template identified by file and line; the report compares per agent with deltas, counts
  pack agents apart and states that named `@` paths are reported apart; the JSON carries the same numbers.
- Gate failures: None
- Every line-anchored `Task(`/`Agent(` and every parameter block in either tree became a site (43 + 7 = 50 in
  3.0.0, 45 + 7 = 52 in 3.1.0); 10 rows (5 locations per tree) have no measured prompt, each with a reason, none
  changing an agent's maximum.
- Git state: `git status --porcelain` clean after the commits; this TRD added no worktree.

## Self-Check: PASSED

Files found: scripts/eval81/static-prompt.cjs, scripts/eval81/static-prompt.test.cjs, 81-STATIC-PROMPT.md,
results/static-prompt.json, 81-07-SUMMARY.md. Commits found: b9a2ad90, 83da5230, c4694697, e466b75f.

## Progress
- [x] Task 1: Static prompt measurement script — b9a2ad90 (RED), 83da5230 (GREEN), c4694697 (like-for-like total)
- [x] Task 2: Run 3.0.0 vs 3.1.0 and publish the comparison — e466b75f
