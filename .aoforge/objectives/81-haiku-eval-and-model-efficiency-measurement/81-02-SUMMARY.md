---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "02"
subsystem: testing
tags: [eval, statistics, wilson, decision-rule, pre-registration, haiku, scoring-cli]

# Dependency graph
requires: []
provides:
  - "81-DECISION-RULE.md: the pre-registered Haiku eval rule, metric definitions and 10 numbered interpretive choices (committed e404e0f2 before any decision code)"
  - "scripts/eval81/lib/stats.cjs: wilson, rate, pointsDiff, round9, formatPct"
  - "scripts/eval81/lib/decide.cjs: decide, proposalsFor, OUTCOMES, ROLE_PRIMARY, ROLE_BATCH, MARGIN, MIN_SCORED_SHARE, SONNET_FLOOR, FAB_MARGIN"
  - "scripts/eval81/lib/report.cjs: renderEvalReport (81-HAIKU-EVAL.md, 76-06), renderBatchTable, renderSpendLine, formatProportion"
  - "scripts/eval81/score.cjs: --batch A|B|C|D|E (dynamic scorer load, spend block from <root>/ledger.json, extra_files) and --report"
  - "scripts/eval81/__fixtures__/metrics.cjs: hand-built batch result builders and tier fixtures"
affects: [81-09, 81-10, 81-11, 81-12, 81-13, 81-14, 81-19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch result contract: roles.<role>.models.<haiku|sonnet>.{n_scored, planned?, metrics{<name>: {k,n} | {total,runs} | {<sub>: {k,n}}}}"
    - "planned resolved per model, then per role, then per batch (C roles need per-role planned)"
    - "Boundaries compared after rounding to 1e-9 (exactly 10 points below and exactly +0.5 fabrications are within)"

key-files:
  created:
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md
    - scripts/eval81/__fixtures__/metrics.cjs
    - scripts/eval81/lib/stats.cjs
    - scripts/eval81/lib/stats.test.cjs
    - scripts/eval81/lib/decide.cjs
    - scripts/eval81/lib/decide.test.cjs
    - scripts/eval81/lib/report.cjs
    - scripts/eval81/lib/report.test.cjs
    - scripts/eval81/score.cjs
    - scripts/eval81/score.test.cjs
  modified: []

key-decisions:
  - "pointsDiff(h, s) = haiku minus sonnet per the TRD action's signature; test list 11's literal argument order (0.78, 0.70) contradicted it"
  - "A gate unestablished (A not run, Haiku under 2/3 of A scored, or no planted A run) turns a would-be WEAK_ENDORSE into INSUFFICIENT; refusals stand (interpretive choice 6)"
  - "A contaminated run left in runs without an exclusion makes its role INSUFFICIENT (interpretive choice 8)"
  - "WEAK_ENDORSE for a non-floor role other than ui-evaluator proposes lowering only the budget profile (interpretive choice 10)"
  - "score.cjs main() is async (resolves the exit code) so batch scorers may be sync or async"

patterns-established:
  - "Pre-registration: the rule doc is committed in its own commit before the code that applies it; the doc wins over the code"
  - "score.cjs validates everything (ledger, scorer result, extra_files paths) before its first write"

requirements-completed: [SC-3, SC-5]

# Verification evidence
verification:
  gates_defined: 2
  gates_passed: 2
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

# Metrics
duration: 30min
completed: 2026-10-17
---

# Objective 81 TRD 02: Pre-registered decision rule, statistics, scoring CLI and report renderer Summary

**The Haiku eval rule is pre-registered in 81-DECISION-RULE.md (committed first), and implemented as tested code: Wilson 95% intervals, a per-role decide() with a global A false-pass gate, a 10-point margin on point estimates and a C fabrication bound, text-only tier proposals, the `score.cjs` CLI that writes results with a committed ledger spend block, and the 76-06 report renderer.**

## Progress
- [x] Task 1: Write and commit the pre-registered decision rule, plus metrics fixture builders — e404e0f2
- [x] Task 2: Statistics and the decision function — 5ff5da55
- [x] Task 3: Scoring CLI and the 76-06 report renderer — (this commit)

## Performance

- **Duration:** about 30 min
- **Started:** 2026-10-17T15:56:34Z
- **Tasks:** 3
- **Files created:** 10 (plus this SUMMARY)

## Accomplishments
- `81-DECISION-RULE.md` quotes the user's rule verbatim and defines every metric per batch (A false pass, detection, gap named, false fail, abstain; B detection, false alarm, missed-as-pass with the precheck split; D accuracy, broken missed, split rate, engine escalations; C recall, error, fabrications per run; contamination), the Wilson statistics, the three outcomes (no strong endorsement), the ordered checks, 10 numbered interpretive choices, the proposal mapping and what is not decided here. It was committed (e404e0f2) before any decision code.
- `decide()` applies the rule per role in the pre-registered order: missing batch, scored share (below 2/3), Sonnet floor (below 0.5), the global A gate, the 10-point margin and the C fabrication bound, then A-gate-established, else WEAK_ENDORSE. It turns outcomes into text proposals against `model-profiles.json` and the flutter pack's `models.ui-evaluator`, read only.
- `score.cjs --batch X` refuses to write anything without `<root>/ledger.json`, copies the batch's ledger row and entries into a `spend` block (the shape 81-01's `rebuildLedger` reads back), and writes `results/X.json` and `results/X.md`; `extra_files` are written under `--out` with absolute and `..` paths refused before any write. `--report` renders `81-HAIKU-EVAL.md`, with a missing batch's roles INSUFFICIENT "batch X not run".

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Decision rule + metrics fixtures | `rg -n "small n can refuse but only weakly endorse" .aoforge/objectives/81-.../81-DECISION-RULE.md` (line 21) and `git log --oneline -1 -- .../81-DECISION-RULE.md` (e404e0f2) | 0 | PASS |
| 2: Statistics and decide | `node --test scripts/eval81/lib/stats.test.cjs scripts/eval81/lib/decide.test.cjs` (56 tests, 56 pass); `rg -n "writeFile" scripts/eval81/lib/decide.cjs` empty | 0 | PASS |
| 3: Score CLI and report | `node --test scripts/eval81/score.test.cjs scripts/eval81/lib/report.test.cjs` (25 tests, 25 pass) | 0 | PASS |

## Task Commits

1. **Task 1: Write and commit the pre-registered decision rule, plus metrics fixture builders** - `e404e0f2` (docs)
2. **Task 2: Statistics and the decision function** - `5ff5da55` (feat)
3. **Task 3: Scoring CLI and the 76-06 report renderer** - (this commit) (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81) | `node --test "scripts/eval81/**/*.test.cjs"` (81 tests, 81 pass; see deviation 2 for why not `node --test scripts/eval81/`) | 0 | PASS |
| test (suite) | npm test file set via `git ls-files`, minus `watcher-shell.test.cjs`, HOME/TMPDIR under the session scratchpad (421 files): 13129 tests, 13102 pass, 0 fail, 27 skipped | 0 | PASS |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (stats) | `node --test scripts/eval81/lib/stats.test.cjs` before stats.cjs existed: 11/11 fail (module not found) | 1 | FAIL (correct) |
| GREEN (stats) | same: 11/11 pass | 0 | PASS (correct) |
| RED (formatPct) | same, after adding the formatPct test: 1 fail (`formatPct is not a function`) | 1 | FAIL (correct) |
| GREEN (formatPct) | same: 12/12 pass | 0 | PASS (correct) |
| RED (decide) | `node --test scripts/eval81/lib/decide.test.cjs` before decide.cjs existed: every test fails (module not found) | 1 | FAIL (correct) |
| GREEN (decide) | same: 44/44 pass | 0 | PASS (correct) |
| RED (report, score) | `node --test scripts/eval81/score.test.cjs scripts/eval81/lib/report.test.cjs` before either module existed: every test fails | 1 | FAIL (correct) |
| GREEN (report, score) | same: 25/25 pass | 0 | PASS (correct) |
| REFACTOR | `node --test "scripts/eval81/**/*.test.cjs"`: 81/81 pass (report.cjs primary-row ordering rewritten as plain statements before the first green run) | 0 | PASS (correct) |

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 5/5 (rule doc sections and verbatim quote, committed first; wilson; decide per role; proposals text-only against the live tiers; score CLI --batch with spend and --report)
- **Gate failures:** None (the TRD's literal `node --test scripts/eval81/` cannot run on Node 24; the glob form ran the same files)

## Files Created/Modified
- `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md` - the pre-registered rule (8 sections)
- `scripts/eval81/__fixtures__/metrics.cjs` - km, modelStats, roleModels, batchResult, aResult/aPass/aFalsePass, bResult, dResult, cResult, allResults, profilesFixture, packModelsFixture
- `scripts/eval81/lib/stats.cjs` (+ test) - Wilson interval, rate, pointsDiff, round9, formatPct
- `scripts/eval81/lib/decide.cjs` (+ test) - decide, proposalsFor and the rule constants
- `scripts/eval81/lib/report.cjs` (+ test) - renderEvalReport, renderBatchTable, renderSpendLine, formatProportion
- `scripts/eval81/score.cjs` (+ test) - the scoring CLI

## Decisions Made
- **pointsDiff argument order.** The action defines `pointsDiff(h, s)` and the test list's parenthesis says "haiku minus sonnet"; test 11's literal arguments `(0.78, 0.70)` contradict both. Implemented `pointsDiff(h, s) = round9(h - s)`, so `pointsDiff(0.70, 0.78) = -0.08`; the test asserts both orders and quotes the discrepancy.
- **Interpretive choices 6-10 added to the rule doc** for cases the TRD left open: the A gate must be established before an endorsement (6); D's "detection" is per-state accuracy (7); contamination is checked, not trusted (8); only false passes and the primary metrics decide, the rest are reported (9); WEAK_ENDORSE on a non-floor role other than ui-evaluator proposes the budget profile only (10). All are amendable by the user at the batch-A checkpoint, before any spend.
- **Contract additions:** `planned` may be set per model or per role (C needs it); excluded runs may carry `role` (and `model`); decide output adds `note`, `diff_points`, `fab_diff` and `gate.{status, reason}`; `proposalsFor` takes an optional fifth argument (the Haiku view, for the split rate).
- **score.cjs:** `main(argv, deps)` is async and resolves the exit code; the scorer is checked before `--root`/`--out` so `--batch A` alone gives the 81-09 hint; an `extra_files` path that would overwrite `results/X.json|md` is refused too; a scorer returning another batch, or throwing, exits 1 with nothing written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test list 11's argument order contradicts the pointsDiff(h, s) signature**
- **Found during:** Task 2
- **Issue:** "pointsDiff(0.78, 0.70) = -0.08 (haiku minus sonnet)" cannot hold for `pointsDiff(h, s)`.
- **Fix:** Followed the signature and the case in test 7 (haiku 0.70, sonnet 0.78); the test asserts `pointsDiff(0.70, 0.78) = -0.08` and `pointsDiff(0.78, 0.70) = 0.08`.
- **Files modified:** scripts/eval81/lib/stats.cjs, scripts/eval81/lib/stats.test.cjs
- **Committed in:** 5ff5da55

**2. [Rule 3 - Blocking] `node --test scripts/eval81/` does not run on Node 24**
- **Found during:** Task 3 (validation gates)
- **Issue:** Node 24.13.1 loads a directory argument as a module (`Cannot find module .../scripts/eval81`), so the gate fails before any test runs.
- **Fix:** Ran the equivalent glob `node --test "scripts/eval81/**/*.test.cjs"` (the form `npm test` already uses). Later TRDs that cite `node --test scripts/eval81/` (81-13, 81-14) should use the glob.
- **Files modified:** none
- **Committed in:** n/a

---

**Total deviations:** 2 auto-fixed (1 bug in the TRD's test list, 1 blocking gate command)
**Impact on plan:** None on scope; both are recorded so the later TRDs read the same contract.

## Issues Encountered
- The worktree has no node_modules; it was symlinked from the main checkout for the full-suite gate only (excluded from git by `.git/info/exclude`) and removed afterwards.

## User Setup Required

None - no external service configuration required.

## Next Objective Readiness
- 81-09..81-12 plug in at `scripts/eval81/score/<X>.cjs` exporting `score({root, outDir})` and return the batch result shape documented at the top of `decide.cjs` and `__fixtures__/metrics.cjs`. C's scorer (81-11) must set `planned` per role (or per model), because the batch-level `planned` covers all eight C roles.
- 81-01's `rebuildLedger` reads `results/<X>.json` `spend` exactly as score.cjs writes it: `{ledger_version, batch, status, spent_usd, ledger_total_usd, entries}`.
- 81-13/81-14: the rule doc's interpretive choices 1-10 are the items for the user's batch-A checkpoint.

---
*Objective: 81-haiku-eval-and-model-efficiency-measurement*
*Completed: 2026-10-17*
