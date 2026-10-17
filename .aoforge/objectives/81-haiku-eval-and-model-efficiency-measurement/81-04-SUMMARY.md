---
objective: 81-haiku-eval-and-model-efficiency-measurement
job: "04"
subsystem: testing
tags: [eval81, job-checker, test-b, planned-trd-sets, answer-key, node-test]

requires:
  - objective: 76-model-efficiency-and-stack-specific-content
    provides: the open 76-06 question (Haiku vs Sonnet on the job-checker) this fixture set will measure
provides:
  - "buildFixture(id, dir) for six deterministic AOForge 3.1.0 projects (B1..B6), each a completed objective 1 plus a planned, unexecuted objective 2"
  - "answer-key.json for test B: expected verdict, planted TRDs, kind, match tokens, dimension hint, precheck_flags and the observed verify trd-pre result per set"
  - "proofs.test.cjs: planted-defect, base-diff, trd-pre, health and no-leak proofs (16 tests)"
affects: [81-09, 81-13, 81-15]

tech-stack:
  added: []
  patterns:
    - "fixture TRDs authored as data and rendered by one function, so a mutation is a data change and isolation holds by construction"
    - "deterministic git: fixed author, dates, subjects, GIT_CONFIG_GLOBAL=/dev/null, so equal trees give equal commit ids"

key-files:
  created:
    - scripts/eval81/fixtures/B/build.cjs
    - scripts/eval81/fixtures/B/answer-key.json
    - scripts/eval81/fixtures/B/proofs.test.cjs
  modified: []

key-decisions:
  - "Only B4 (task with no verify element) is flagged by the mechanical pre-check; B3, B5 and B6 pass it, so they are judgment-only defects for the scorer"
  - "precheck.blockers is a list of strings dimension:trd[:detail] (B4: task_completeness:02-02:verify) so the scorer and the proof compare plain values"
  - "B2's 02-04 documents only the input format (it depends on 02-01 alone), so the clean set carries no dependency a careful checker could fairly question"

patterns-established:
  - "Test B sets are mutated by whole-TRD replacement at the data level; ROADMAP, REQUIREMENTS, STATE and objective 1 are byte-identical across a base and its planted set"

requirements-completed: [SC-2]

verification:
  gates_defined: 2
  gates_passed: 2
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: true

duration: 15min
completed: 2026-10-17
tokens_input: 11143846
tokens_output: 160209
tokens_cache_read: 10888907
tokens_cache_write: 254825
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 81 TRD 04: Test B fixtures, answer key and planted-defect proofs Summary

**Six deterministic TRD sets for the job-checker eval (two consistent, four with exactly one real flaw each), an answer key that records what `verify trd-pre` already catches, and 16 passing proofs that each flaw is real and isolated.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-17T16:06:42Z
- **Completed:** 2026-10-17T16:21:57Z
- **Tasks:** 2
- **Files modified:** 3 created (plus this SUMMARY)

## Accomplishments

- `buildFixture(id, dir)` materialises B1 (textkit, export formats) and B2 (tempconv, batch conversion) as git repos with six commits each (scaffold, plan 1, implement, test, summary, plan 2), and B3..B6 as one-TRD-data-change mutations of them. Two builds give the same commit ids, files and contents.
- Every set passes `validate health` with zero errors and zero warnings, `upgrade --check` reports current, objective 1's own `node --test` passes, and every TRD is under 4 KB (largest 3,253 bytes).
- The pre-check view is recorded and asserted: B1, B2, B3, B5 and B6 pass `verify trd-pre 2`; B4 alone reports `task_completeness` incomplete for 02-02, so B4 alone has `precheck_flags: true`.
- Each planted flaw has a structural predicate true on the planted set and false on its base: B3 two wave-1 TRDs sharing `src/cli.js`; B4 exactly one task without `<verify>`; B5 a wave-1 TRD depending on a wave-2 TRD with no cycle and no orphan; B6 no TRD mentions `unknown format` while the ROADMAP lists it.
- A planted set differs from its base only in the named TRD files (B3: 02-01 and 02-02; B4 and B5: 02-02; B6: 02-03), and the first five commits are shared byte for byte.
- No materialised file, path, commit subject or author contains a revealing word or a set id.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Fixture builder for B1..B6 | `node -e "const b=require('./scripts/eval81/fixtures/B/build.cjs'); ... buildFixture(id,d) ..."` (TMPDIR under the scratchpad); B1/B3/B6 list `01-note-storage,02-export-formats`, B2/B4/B5 list `01-single-conversion,02-batch-conversion` | 0 | PASS |
| 2: Answer key and planted-defect proofs | `node --test scripts/eval81/fixtures/B/proofs.test.cjs` (TMPDIR under the scratchpad) | 0 | PASS (16/16) |

## Task Commits

1. **Task 1: Fixture builder for B1..B6** - `01580a1c` (test)
2. **Task 2: Answer key and planted-defect proofs** - `7b70d856` (test)

**Plan metadata:** the final docs commit that carries this SUMMARY, STATE and ROADMAP.

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `node --test scripts/eval81/fixtures/B/proofs.test.cjs` | 0 | PASS (16 tests) |
| rename guard | `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs` | 0 | PASS (25 tests) |
| tree-wide guards (extra) | `node --test .../doc-refs.repo.test.cjs .../stack-neutrality.repo.test.cjs .../regex-escape.repo.test.cjs .../requirements-agreement.repo.test.cjs` | 0 | PASS (32 tests) |

## Observed `verify trd-pre 2` per set (recorded in answer-key.json)

| Set | passed | blockers | precheck_flags |
|---|---|---|---|
| B1 | true | none | n/a |
| B2 | true | none | n/a |
| B3 | true | none | false |
| B4 | false | `task_completeness:02-02:verify` | true |
| B5 | true | none | false |
| B6 | true | none | false |

Scope and budget are quiet on every set (no warning TRD, no TRD over the warn budget, no linked-bulk finding), so a mutation changes nothing except its own dimension. `verify job-structure` reports no error and no warning on any TRD except 02-02 of B4, which warns `Task 'Task 1: Formatter' missing <verify>`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `verify trd-pre --raw` prints only the summary line**
- **Found during:** Task 2 (recording the pre-check per set)
- **Issue:** the TRD says to run `verify trd-pre 2 --raw` and read the keys; `--raw` prints `valid - 5/5 dimensions passed`, and the JSON is the default output.
- **Fix:** read the JSON form (no `--raw`) for the key and for the proof test.
- **Commit:** 7b70d856

**2. [Rule 2 - Missing critical] PROJECT.md needed a `## Requirements` section**
- **Found during:** Task 1 (first `validate health` run)
- **Issue:** `validate health` raised W001 on every set, which would have made `health_warnings` non-empty noise for the checker.
- **Fix:** added a Validated/Active requirements section to both projects' PROJECT.md; every set now has zero warnings.
- **Commit:** 01580a1c

**3. [Process] A scripted edit corrupted build.cjs before its first commit**
- **Found during:** Task 1 (a Python replace with an empty match inserted text between every character)
- **Fix:** deleted the file and rewrote it from the full source; the corrupted version was never committed or run.

### Decisions where the TRD left room

- Commit author is `Project Author <author@example.invalid>` rather than `Fixture Author`, per the hint from 81-03 (the word is banned in built repos).
- The proof test has 16 tests for the 11 list items: items 1 and 2 are split, and it adds checks that objective 1's tests pass, that the clean sets are internally consistent (waves follow dependencies, every requirement and success criterion is covered by a truth) and that scope and budget are quiet.
- `describeFixture(id)` also returns `changedFiles` (TRD files whose text differs from the base), computed from the TRD data, for the scorer and the isolation proof.
- B3's third tasks register the format in an `EXPORTERS` table that 02-03 also builds. That redundancy is a consequence of the single planted change (02-01 and 02-02 touching `src/cli.js`), so a checker may mention it alongside the overlap; the key matches on the overlap tokens.
- Before committing, every `verify` command in the B1 and B2 TRDs was run against a scratch implementation of the TRD text (outside the repo) and printed exactly what the TRD claims, so the clean sets describe work that works.

## Auth gates

None.

## Discovered commands

None (all commands came from the TRD or the repo's existing verbs).

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 (buildFixture deterministic and six-project; B1/B2 consistent and B3..B6 one defect each; proofs true on planted and false on base, plus the base-diff; trd-pre recorded and asserted; answer key per spec)
- Gate failures: None

## Self-Check: PASSED

- FOUND: scripts/eval81/fixtures/B/build.cjs
- FOUND: scripts/eval81/fixtures/B/answer-key.json
- FOUND: scripts/eval81/fixtures/B/proofs.test.cjs
- FOUND commit: 01580a1c
- FOUND commit: 7b70d856

## Progress
- [x] Task 1: Fixture builder for B1..B6 — 01580a1c
- [x] Task 2: Answer key and planted-defect proofs — 7b70d856
