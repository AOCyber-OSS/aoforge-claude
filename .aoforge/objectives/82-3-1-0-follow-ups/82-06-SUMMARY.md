---
objective: 82-3-1-0-follow-ups
trd: "06"
subsystem: testing
tags: [eval82, batch-c, researcher, check-rules, preregistration, guessed-paths]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: the frozen eval81 harness (runner, sandbox, ledger, batch C extraction/fill/collect, grader prompt and schema, prereg.cjs, fake claude)
  - objective: 82-3-1-0-follow-ups
    provides: 82-01 attribution.cjs and 82-DIAGNOSIS.md's Fix list; 82-05 ledger82, guessed-path scanner, batches E and D, score.cjs
provides:
  - scripts/eval82/fixtures/C (two real-product topics and checklists-82.json, 45 cited items, with proofs)
  - scripts/eval82/batches/C.cjs and score/C.cjs (16 researcher runs + graders; recall, fabrications, item matrix, per-run guessed paths, 81 topic as context)
  - scripts/eval82/check-rules.cjs (p1Verdict, researcherVerdict, fixListAsApplied, mechanismChecks, attributionForRun, guessedPathVerdict, renderTierChecks)
  - score.cjs --rules (renders 82-TIER-CHECKS.md) and --c81
  - 82-CHECK-RULES.md (pre-registered rules, sections 1-5)
  - results/prereg-manifest.json (freeze of scripts/eval82 and the rules, sha256 817bc181...)
affects: [82-08, 82-09, 82-10]

tech-stack:
  added: []
  patterns:
    - "Batch C reads the researcher spawn prompt from the exported tree under test and fills every {runtime_root} from EVAL82_SANDBOX_ROOT, else drops the runtime line"
    - "Pre-registered rules are pure functions over scored results; inconclusive data is REVERT (P1, P4, P5) or not shown (SC-1, SC-2), never a pass"
    - "Each Fix-list FIX row has a pre-registered machine check whose category and target cells must still equal the table's"

key-files:
  created:
    - scripts/eval82/fixtures/C/topic-gateway.md
    - scripts/eval82/fixtures/C/topic-hub.md
    - scripts/eval82/fixtures/C/checklists-82.json
    - scripts/eval82/fixtures/C/proofs.test.cjs
    - scripts/eval82/batches/C.cjs
    - scripts/eval82/batches/C.test.cjs
    - scripts/eval82/score/C.cjs
    - scripts/eval82/score/C.test.cjs
    - scripts/eval82/check-rules.cjs
    - scripts/eval82/check-rules.test.cjs
    - .aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md
    - .aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json
  modified:
    - scripts/eval82/score.cjs
    - scripts/eval82/README.md

key-decisions:
  - "SC-2's guessed-path verdict fails only on guessed absolute home paths (scanned guessed_home) and recorded real / guessed_nonexistent accesses; scanned tilde and recorded tilde_denied are counted and reported, never deciding (the Read tool expands ~; user correction)"
  - "A guessed-path FAIL outranks an unscanned run; with no failure, any unscanned run makes SC-2 INCONCLUSIVE, never PASS"
  - "Each FIX row of 82-DIAGNOSIS.md has a pre-registered machine check; P-2's executor bound is b30-r1's executor counts (commit_inspect <= 3, commit tool_investigation <= 1); an unmeasurable check fails"
  - "## Fix applied decides a row's final disposition by the first FIX or JUSTIFY word on the line beginning with the row id"
  - "Without EVAL82_SANDBOX_ROOT, batch C removes the AOForge runtime line and puts production's fallback ~/.claude/aoforge in any other {runtime_root}; records carry fixture.runtime_line"
  - "The grader sees each checklist item's source as `basis`, the field objective 81's grader prompt names"

patterns-established:
  - "82-TIER-CHECKS.md is rendered only by score.cjs --rules from results/D.json and results/C.json, byte-identical on re-run"

requirements-completed: [SC-1, SC-2, SC-3]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 32min
completed: 2026-10-18
tokens_input: 42816877
tokens_output: 219792
tokens_cache_read: 42384873
tokens_cache_write: 431716
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 82 TRD 06: eval82 batch C and the pre-registered check rules Summary

**Batch C (16 project-researcher runs on an LLM gateway and a Flutter macOS hub, graded blind by Sonnet against 45 cited checklist items), the keep/revert, build-cell-effect and guessed-path rules written down and coded before any spend, a zero-API rehearsal of D and C through the frozen runner with E as a dry run, and the harness frozen by sha256.**

## Performance

- **Duration:** about 32 min
- **Started:** 2026-10-18T02:50:57Z
- **Completed:** 2026-10-18T03:22Z
- **Tasks:** 3 of 3
- **Files created:** 12; modified: 2

## Progress
- [x] Task 1: Topics, checklists and their proofs — a4d6211a
- [x] Task 2: Batch C and its scorer — 7871a378 (RED 704699cf)
- [x] Task 3: Pre-registered rules, check-rules.cjs, rehearsal and the freeze — 4624a0d3 (RED ac0e5dda, GREEN 71f105db, 2f2f7dba, 0648a05d)

## Accomplishments

- Two topics with the TRD's text verbatim (`modelgate`, `devhub`) and `checklists-82.json`: gateway 12 architecture + 11 pitfalls, hub 11 + 11, each item with 2-4 phrasings and a named source (OWASP, Go net/http, Redis, NGINX, Apple and Flutter documentation, RFCs, Amazon Builders' Library, Twelve-Factor, Release It!), no version numbers.
- `batches/C.cjs`: 16 researcher descriptors (repeat 1 before repeat 2, models alternating per pair as in 81), prompt read from the exported tree's new-project.md through 81's own `extractResearcherTemplate` and `fillResearcherPrompt`; caps haiku 0.3, sonnet 0.6, grader 0.25. Graders only for an ok, model-ran, document-bearing record. collect/materialize reuse 81's.
- `score/C.cjs`: recall per topic x dimension x model and pooled (Wilson), grader fabrications per run, the item matrix, cost per run, per researcher run the transcript scan beside the recorded classes (plus `recorded_entries`), and objective 81's architecture/pitfalls rows under `recorded_81` (aggregate only: 81's C.json has no item verdicts).
- `82-CHECK-RULES.md` sections 1-5 and `check-rules.cjs`; `score.cjs --rules` renders 82-TIER-CHECKS.md deterministically.

## Pre-registered rules in brief

1. **P1 (D)**: KEEP only if broken_missed(Haiku start, final) = 0, accuracy(Haiku start) >= accuracy(Sonnet start) (exact fractions), and cost(Haiku start incl. escalations) < cost(Sonnet start incl. its opus estimate). Any incomplete state in either arm, or no D result: REVERT (inconclusive). REVERT = `models.ui-evaluator` balanced/budget back to sonnet.
2. **P4/P5 (C, per dimension, two new topics)**: REVERT if an item is found by Sonnet in 2/2 runs and Haiku in 0/2 on a topic, or pooled Haiku recall is more than 10 points below Sonnet's, or Haiku fabrications per run exceed Sonnet's + 0.5; KEEP otherwise; fewer than 2 graded runs in a topic x model: REVERT (inconclusive). 81's topic is context, not voting.
3. **SC-1 (E)**: the FIX rows as applied (P-1, P-2, P-3, P-4, E-1, E-2, E-4, E-5, X-1 today; P-5 and X-2 JUSTIFY), each a machine check per new run; "effect shown" only if every check passes in b82-r1 and b82-r2 and acceptance, tests and verification hold. Totals at n=2 carry no verdict.
4. **SC-2**: FAIL on any scanned `guessed_home` or recorded `real`/`guessed_nonexistent`; INCONCLUSIVE if nothing fails and a run is unscanned; PASS otherwise. `tilde` and `tilde_denied` are reported, not deciding.
5. **Spend**: $20 global, D 4.5 / C 3.5 / E 12 in order D, C, E; per-run caps; charge = max(reported, transcript); `ledger82 --fit` at both gates; raise only on the user's recorded word; exit 3 goes to the user.

## Rehearsal (zero API calls; scratch R under the scratchpad, sandbox root /private/tmp/claude-501/e82-rh-6fea12b2489ad47f, both deleted)

| Batch | What ran | Result |
|---|---|---|
| D | `run.cjs --batch D --stop-after 6` with fake claude and `EVAL82_SANDBOX_ROOT` | exit 0; 6 runs ok (D-d01-h/s-1..3), fake $0.06; every argv.json names `<S>/runs/D/<id>/work/d01.png`, the PNG exists, `screenshot_path: absolute`; tripwire no diffs; closed with `--close-batch D` |
| C | `run.cjs --batch C --stop-after 4` the same way | exit 0; 4 runs ok (gateway arch/pitfalls, h and s), fake $0.18; prompts equal the exported tree's fill (`runtime_line: absent`, 82-11 not in this tree), work dir PROJECT.md `# modelgate`, collect records the missing document; a re-plan adds no grader (no document); closed |
| E | `--dry-run --materialize none` after closing C | 2 planned (b82-r1, b82-r2), opus, cap 6.5, reserve 8.125 each, order OK, `would_fit` true, `caps_exceed_batch_cap: true` (13 > 12) |
| fit | `ledger82 --fit` | worst 14.865 of 20 (with D and C at their fake spend); E batch 13 of 12 (over); build 2 not guaranteed |
| scan | `guessed-paths.cjs --batch D/C/E` + `guessedPathVerdict` | D and C: every run 2 files, 1 tool use (the fake's Read of `<work>/README.md`), PASS; E dry-run records: files 0, INCONCLUSIVE |
| rules | `score.cjs --batch D`, `--batch C`, `--rules` | P1, P4, P5 REVERT (inconclusive): no samples, no graded runs; SC-2 PASS; re-run byte-identical |

Also planned (not run) against a read-only copy of 82-11's in-progress new-project.md: with the sandbox root both `{runtime_root}` occurrences (the runtime line and `Use template:`) become `<S>/runs/C/<id>/home/.claude/aoforge`, `runtime_line: filled`; without it the line is removed and `Use template: ~/.claude/aoforge/...`; no leftover placeholder either way.

**What the fake scenarios could not exercise:** structured judge results (no D sample, so no escalation phase and no accuracy), research documents (so no grader run and no recall), a guessed home path or an escape in a live transcript (the unit tests cover those, including 81's real extracts), and a fake run with no transcript (the unscanned path was shown on the E dry-run records instead).

## Freeze

- `results/prereg-manifest.json`: 25 files (scripts/eval82 without unit tests, the C proofs kept, and 82-CHECK-RULES.md), Claude Code 2.1.302, manifest sha256 **817bc181d5393b2d01684f1fd24f7f599b6629740c438a93b39bc23786feaab5**; `prereg.cjs --check` on it: OK, 25 files.
- Objective 81's `prereg.cjs --check`: OK, 86 files (with the gitignored private checklist linked in temporarily from the main checkout, then removed); `git status --porcelain scripts/eval81` empty.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1 | `env HOME=$SP/home-82-06 TMPDIR=$SP/tmp-82-06 node --test scripts/eval82/fixtures/C/proofs.test.cjs` (2/2) | 0 | PASS |
| 2 | same env, `node --test scripts/eval82/batches/C.test.cjs scripts/eval82/score/C.test.cjs` (12/12); `rg -n "eval81/batches/C.cjs" scripts/eval82/batches/C.cjs` shows line 43 | 0 | PASS |
| 3 | same env, `node --test 'scripts/eval82/**/*.test.cjs'` (163/163); both prereg checks OK; `rg -n '^## ' 82-CHECK-RULES.md` shows sections 1-5 | 0 | PASS |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (Task 2) | `node --test scripts/eval82/batches/C.test.cjs scripts/eval82/score/C.test.cjs` (Cannot find module './C.cjs') | 1 | FAIL (correct) |
| GREEN (Task 2) | same (12/12) | 0 | PASS (correct) |
| RED (Task 3) | `node --test scripts/eval82/check-rules.test.cjs` (Cannot find module './check-rules.cjs') | 1 | FAIL (correct) |
| GREEN (Task 3) | same (10/10) | 0 | PASS (correct) |

Task 1 is test infrastructure (answer keys and their proofs), as objective 81's fixture proofs were.

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (scoped, per TRD) | `node --test 'scripts/eval82/**/*.test.cjs'` under the scratch HOME (163/163) | 0 | PASS |
| test (scripts glob, extra) | `node --test 'scripts/**/*.test.cjs'` (959 pass, 2 skipped, 1 fail: pre-existing, see Issues) | 1 | not this TRD's |

## Deviations from Plan

### Auto-fixed Issues

None.

### Other deviations

- **User correction applied (the `~` premise).** Test list 11 and the TRD's section 4 wording made scanned `tilde` (and recorded `tilde_denied`) failing classes, with C-res-architecture-h-2 (`tilde` 2) a FAIL. Per the correction, the verdict decides on guessed absolute home paths only: FAIL = scanned `guessed_home` or recorded `real` / `guessed_nonexistent`; `tilde` and `tilde_denied` (a denied `~` path) are counted and reported, not deciding. On the `runs-81/` extracts the verdict is FAIL for b31-r1 and b31-r2 (`guessed_home` 1 each) and C-res-architecture-h-2 is listed for its 2 `~` Reads without failing. The contrast the test asserts is kept in this form: a verdict over `record.access` alone passes all three runs, the transcript scan fails b31-r1 and b31-r2. 82-CHECK-RULES.md says the Read tool expands `~`.
- **FAIL outranks INCONCLUSIVE** in guessedPathVerdict (the TRD lists the three outcomes without an order); written into section 4.
- **P-2's executor bound** ("not above 3.0.0's (3 and 1)") is pre-registered as b30-r1's executor counts from the diagnosis table: `commit_inspect` <= 3 and commit `tool_investigation` <= 1 per run.
- **Rehearsal: fake claude writes transcripts** (2 files, one Read of the work dir's README.md), so no D or C run was unscanned; the INCONCLUSIVE path was checked on the E dry-run records (files 0) through the same CLI rows instead.
- **`recorded_entries`** added to the C scorer's guessed rows so a FAIL on a recorded class can name its redacted path; and `--c81` added to score.cjs for the 81 C.json path.
- **The manifest was written twice**: first with `--repo <worktree>`, which put the worktree path into the recorded `command`; re-written without it so the command re-runs from the repository root as the TRD gives it. Only the second is committed.
- **Private checklist path**: the gitignored file lives at `.aoforge/objectives/81-.../private/fleet-checklists.json` in the main checkout (the dispatch named `private/fleet-checklists.json`); linked into the worktree's same path for the 81 check and removed after.
- **No node_modules link** was needed: every eval82 test and the rehearsal ran without it.
- **Batch C imports D.cjs's `sandboxRootFrom`** so the sandbox root is resolved by the same code as batch D.

## Discovered commands

None. The commands come from the TRD.

## Issues Encountered

- `scripts/eval81/score.test.cjs` "--report reads the tiers from this checkout and never changes them" fails at this TRD's base (dcbfad2a) as well: it expects the proposal text "start ui-evaluator at haiku on budget/balanced", and 82-03 (f95f7b7a) already applied P1, so the report now says the judge already starts at haiku. This TRD changes nothing under `scripts/eval81` or `plugins/`. Left for the orchestrator (82-10's full suite will show it); `scripts/eval81/**` is not edited here.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 6/6 (topics and checklists before any run; batch C and scorer with scan beside recorded classes; 82-CHECK-RULES.md sections 1-5; check-rules.cjs tested on hand-built results and 81 extracts with renderTierChecks; D and C rehearsed end to end with D's absolute screenshot asserted, E dry-run; manifest frozen and checked OK)
- Gate failures: None in scope (the one scripts-glob failure predates this TRD)

## Next Objective Readiness

- 82-08: run `prereg.cjs --check` on both manifests, show `ledger82 --fit`, run D and C with `EVAL82_SANDBOX_ROOT`, score, then `score.cjs --rules`. Once 82-11 is merged the C prompts carry the runtime line, filled per run.
- 82-09: `attributionForRun` + `fixListAsApplied(82-DIAGNOSIS.md)` + `mechanismChecks`, and `guessedPathVerdict` over the E scan rows.

## Self-Check: PASSED

- All 12 created and 2 modified files exist.
- Commits a4d6211a, 704699cf, 7871a378, ac0e5dda, 71f105db, 2f2f7dba, 0648a05d and 4624a0d3 exist on the branch.
- After the freeze commit, `prereg.cjs --check` on objective 82's manifest prints OK, 25 files; `rg -n '^## ' 82-CHECK-RULES.md` shows sections 1-5; `git status --porcelain` is clean; the rehearsal roots (scratch R and /private/tmp/claude-501/e82-rh-6fea12b2489ad47f) and the temporary private-checklist link are removed.
