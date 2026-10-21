---
objective: 82-3-1-0-follow-ups
trd: "01"
subsystem: eval
tags: [token-diagnosis, transcripts, attribution, build-cell, 3.1.0]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: "scripts/eval81/lib/roles.cjs (roleOf, rolesForRun), scripts/eval81/__fixtures__/transcripts.cjs, the four recorded build runs (b30-r1, b30-r2, b31-r1, b31-r2) and 81-MEASUREMENT.md's build table"
provides:
  - "scripts/eval82/lib/attribution.cjs: roleSpawns, listRuns, spawnsOfRole, apiCalls, categorize, attribute, summarizeSpawn, summarizeRole, mergeSummaries, compare, pairSpawns, main (CLI: --run / --compare, --role, --json, --calls)"
  - "scripts/eval82/__fixtures__/attribution-transcripts.cjs: assistantCall, toolResult, writeRun, conversation, planner3031Pair (hand-computed totals)"
  - ".aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md: decomposition, category deltas, ranked causes with transcript evidence and the 3.1.0 / 3.0.0 trigger text, and the Fix list"
affects: [82-06, 82-07, 82-09]

tech-stack:
  added: []
  patterns:
    - "Per-call token attribution: issuing tokens partition a spawn total; carry = result tokens x later calls; removal = issuing + carry (upper bound)"
    - "mentions (presence per category, compound commands included) beside categories (tokens charged to the first category), and written (chars put into tool inputs) for mechanism checks"

key-files:
  created:
    - scripts/eval82/lib/attribution.cjs
    - scripts/eval82/lib/attribution.test.cjs
    - scripts/eval82/__fixtures__/attribution-transcripts.cjs
    - .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
  modified: []

key-decisions:
  - "Dedupe a call by message.id keeping the row with the largest output_tokens (objective 81's rule), not the first row, so every spawn total equals roles.cjs to the token"
  - "Carry uses the size of the text in the context; a persisted-output pointer contributes its preview and the persisted file's size is reported beside it (persisted_chars)"
  - "Causes are priced as removal upper bounds (issuing + carry of the cause's calls) and labelled single-run when they appear in one run only"
  - "The commit-tail cause (P-2) has no plugin trigger: the attribution reminder is in all four planner transcripts; the fix is one explicit sentence in planner.md and executor.md"

requirements-completed: []

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 26min
completed: 2026-10-18
tokens_input: 33009216
tokens_output: 227337
tokens_cache_read: 32566816
tokens_cache_write: 442144
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 82 TRD 01: Build-cell token diagnosis Summary

**The 3.1.0 planner's +67% is eight extra calls (a TRD-template hunt and a denied `git commit --amend` tail in both runs, plus larger TRDs) and the executors' +20% is two whole-file reads (`templates/summary.md`, `references/tdd.md`) that the 3.1.0 spawn text now obliges; every cause is carried to a FIX or JUSTIFY row.**

## Performance

- **Duration:** about 26 min
- **Started:** 2026-10-18T01:13:39Z
- **Completed:** 2026-10-18T01:40Z
- **Tasks:** 3 of 3
- **Files modified:** 4 created (module, its test, the fixture builder, the diagnosis)

## Accomplishments

- `attribution.cjs` turns a transcript into deduplicated API calls, tool calls with result sizes, a category per tool call and per category count, issuing tokens, carry, mentions and written chars; `--compare` prints the decomposition and the per-category deltas. 99 tests pass; its spawn totals equal objective 81's `rolesForRun` to the token, and the medians reproduce 81-MEASUREMENT.md (planner 1,321,277 / 2,205,630; executor 2,769,891 / 3,326,048).
- Decomposition (`dtotal = dcalls x meanCtx(3.0.0) + calls(3.1.0) x dMeanCtx + doutput`, residual 0):

| role | pair | delta | dcalls x mean ctx | calls x d mean ctx | d output | calls | mean context |
|---|---|---|---|---|---|---|---|
| planner | b30-r1 vs b31-r1 | +808,826 (+52%) | 579,435 | 223,501 | 5,890 | 21 -> 29 | 72,429 -> 80,136 |
| planner | b30-r2 vs b31-r2 | +959,879 (+89%) | 473,447 | 463,653 | 22,779 | 18 -> 26 | 59,181 -> 77,014 |
| executor | b30-r1 vs b31-r1 (2 spawns) | +1,201,892 (+23%) | 447,077 | 748,560 | 6,255 | 82 -> 89 | 63,868 -> 72,279 |
| executor | b30-r2 vs b31-r2 | +199,944 (+6%) | -337,231 | 531,524 | 5,651 | 46 -> 41 | 67,446 -> 80,410 |

- **Diagnosis headline.** Planner +67%: both 3.1.0 planners made 8 more calls, from P-1 (template hunt: `ls templates/` then reading `trd-prompt.md`; removal 243,936 / 442,456 tokens), P-2 (inspect the commit message, `git commit --amend` that the gate denied, read the commit helper; 216,601 / 307,698) and P-3 (TRDs 21-59% larger), plus one-run extras (P-4 tooling-source grep, 210,496 in r1). Executor +20%: calls rose only 2%, mean context per call rose 15%; all three 3.1.0 executors read `summary.md` and `tdd.md` whole before task 1 because `execute-objective.md:432,434` (3.1.0) turned 3.0.0's un-followed `@` lines into read directives (E-1 355,684, E-2 441,270 tokens over the build), and the TRD they carry is 13-58% larger (+196,994). Those account for 71% of the executor delta.
- Fix list (82-07 implements the FIX rows test-first; 82-06 derives the category checks): **P-1 FIX, P-2 FIX, P-3 FIX, P-4 FIX, P-5 JUSTIFY, E-1 FIX, E-2 FIX, E-4 FIX (done by 82-02 and 82-11), E-5 FIX, X-1 FIX, X-2 JUSTIFY**; E-3 (duplicate TRD read) is rejected with evidence.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Hand-built transcript builder | `node -e "require('./scripts/eval82/__fixtures__/attribution-transcripts.cjs')"`; `git status --porcelain scripts/eval81` | 0 (empty status) | PASS |
| 2: attribution.cjs (test list 1-9) | `env HOME=$SP/home-82-01 TMPDIR=$SP/tmp-82-01 node --test scripts/eval82/lib/attribution.test.cjs` (99 pass); `node scripts/eval81/prereg.cjs --check --manifest .../prereg-manifest.json` | 0 | PASS |
| 3: Four-run attribution and 82-DIAGNOSIS.md | `rg -n -e '^## (Inputs\|Decomposition\|Category deltas\|Causes\|Fix list\|Not diagnosed here)$' 82-DIAGNOSIS.md` prints six lines; every Fix row has a disposition, a pinning test or "n/a: JUSTIFY", and a category | 0 | PASS |

## Task Commits

1. **Task 1: transcript builders** - `1a46961f` (test)
2. **Task 2: attribution module** - RED `bc27e3e0` (test, 74 tests failing on the missing module), GREEN `e77c26ca` (feat, 76 pass); refinements `da606623` (finer categories), `6b058037` (mentions), `426c7fb1` (written chars), `a261d0ec` (dot-dot home paths)
3. **Task 3: diagnosis** - `32fb8f3d` (docs)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (targeted, per the TRD) | `node --test scripts/eval82/lib/attribution.test.cjs` | 0 (99/99) | PASS |
| repo guards | `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs doc-refs.repo.test.cjs planning-writes.repo.test.cjs` with the attribution test (152 tests) | 0 | PASS |
| objective 81 freeze | `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` | 0 (86 files match) | PASS |

The full suite was not run (the TRD asks for targeted runs; `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` hangs and is excluded by instruction). `npm test`'s `scripts/**/*.test.cjs` glob picks the new test up.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test scripts/eval82/lib/attribution.test.cjs` (74 tests, 0 pass, all `Cannot find module './attribution.cjs'`) | 1 | FAIL (correct) |
| GREEN | same (76 tests) | 0 | PASS (correct) |
| RED (finer categories) | same (92 tests, 14 failing) | 1 | FAIL (correct) |
| RED (mentions) | same (96 tests, 4 failing) | 1 | FAIL (correct) |
| RED (written) | same (97 tests, 1 failing) | 1 | FAIL (correct) |
| RED (dot-dot home) | same (99 tests, 1 failing) | 1 | FAIL (correct) |
| GREEN (final) | same (99 tests) | 0 | PASS (correct) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Finer categories for the `other` bucket**
- **Found during:** Task 3 (first run on the real transcripts: `other` held 25-50% of the deltas)
- **Fix:** test-first, added `draft_setup`, `state_record`, `exec_context`, `git_inspect`, `scratch_copy`, `stack command` in `context_load`, `do`/`then` prefixes, and tracking of a `cd` into the aoforge bin dir (the P-4 tooling-source grep was invisible without it)
- **Files modified:** scripts/eval82/lib/attribution.cjs, attribution.test.cjs
- **Commit:** da606623

**2. [Rule 2 - Missing critical functionality] `also` and `mentions` for compound commands**
- **Found during:** Task 3 (`cat goal-backward.md; echo; cat tdd.md` was charged to goal-backward only, hiding the tdd.md read)
- **Fix:** test-first, `categorize` returns every category a command touches and `attribute` counts them as `mentions`, which 82-09's presence checks use; tokens are still charged to the first category
- **Commit:** 6b058037

**3. [Rule 2 - Missing critical functionality] `written` chars per category**
- **Found during:** Task 3 (P-3 is about draft size, which no token column shows directly)
- **Fix:** test-first, per-tool `input_chars` and a `written` table, so 82-09 can check the size of `draft_write`
- **Commit:** 426c7fb1

**4. [Rule 1 - Bug] A path with `..` was classified as a guessed home**
- **Found during:** Task 3 (b30-r2's Read of `/Users/../private/tmp/.../home/.claude/aoforge/templates/summary.md` was flagged `guessed_runtime_path`, which would have put a false guessed-path in the 3.0.0 column)
- **Fix:** test-first, `normPath` resolves dot-dot segments before comparing with the run home
- **Commit:** a261d0ec

### Plan-text differences (no code deviation)

- The TRD says to keep the first usage of a call; the module keeps the row with the largest `output_tokens`, objective 81's rule (the TRD's own recovery note says to follow 81 where they disagree), so every spawn total equals `roles.cjs` to the token.
- The TRD's error-recovery note says to measure a persisted-output pointer by the file it points to. Carry is the text that is in the context (the pointer and its preview); the file's size is reported as `persisted_chars`. No planner or executor transcript holds a pointer, so no number changes.
- `prereg.cjs --check` reports one missing file in a worktree, `private/fleet-checklists.json`, which is gitignored and exists only in the main checkout. It was copied in read-only for each check and removed afterwards; with it present the check exits 0 and nothing under `scripts/eval81` changed.
- The share column of the module is reported to 6 decimals, so the shares sum to 1 within 1e-5, not 1e-9 (test 8 uses 1e-5).

## Auth gates

None.

## Discovered commands

None (no stack command was discovered; the TRD's gate is the targeted test run).

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 4/4 (module test-first and hand-computed; decomposition for both pairs and both roles; every cause names its trigger at 99950509 and v3.0.0 or the command output, and is rejected or carried to the Fix list; every Fix row has id, disposition, change, pinning test, category, target count and expected tokens)
- Gate failures: None
- Not measured: whether the fixes bring the build cell back to 3.0.0's totals (82-09); the P-2 trigger is the harness attribution reminder, identified from n=2 vs n=2 runs

## Progress
- [x] Task 1: Hand-built transcript builder for attribution tests — 1a46961f
- [x] Task 2: attribution.cjs (test list 1-9) — bc27e3e0 (RED), e77c26ca (GREEN), da606623, 6b058037, 426c7fb1, a261d0ec
- [x] Task 3: Run the attribution on the four build runs and publish 82-DIAGNOSIS.md — 32fb8f3d

## Self-Check: PASSED

- FOUND: scripts/eval82/__fixtures__/attribution-transcripts.cjs, scripts/eval82/lib/attribution.cjs, scripts/eval82/lib/attribution.test.cjs, .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
- FOUND commits: 1a46961f, bc27e3e0, e77c26ca, da606623, 6b058037, 426c7fb1, a261d0ec, 32fb8f3d
