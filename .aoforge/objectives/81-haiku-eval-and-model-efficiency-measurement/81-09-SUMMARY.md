---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "09"
subsystem: testing
tags: [eval81, haiku-eval, verifier, job-checker, batch-spec, scorer, node-test]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: "81-01 contract/caps/result, 81-02 score.cjs and the batch result contract, 81-03 A fixtures and key, 81-04 B fixtures and key"
provides:
  - "scripts/eval81/batches/A.cjs: batch A module (runs, materialize, collect) with VERIFIER_TEMPLATE and shared helpers (fillTemplate, roadmapObjective, interleave, findVerification, contamination)"
  - "scripts/eval81/batches/B.cjs: batch B module with CHECKER_TEMPLATE and the per-set pre-check cache"
  - "scripts/eval81/score/A.cjs: score({root, outDir}) for the verifier, plus run-dir helpers shared with score/B.cjs"
  - "scripts/eval81/score/B.cjs: score({root, outDir}) for the job-checker, parseChecker"
  - "scripts/eval81/__fixtures__/agent-outputs.cjs: hand-written VERIFICATION.md and checker returns, okRecord, runDir"
affects: [81-08, 81-13, 81-14, 81-15, 81-19]

tech-stack:
  added: []
  patterns:
    - "Production prompts as module constants, asserted byte-equal to the workflow file by a test that extracts the template itself"
    - "One-pass strict template fill: an unknown or unused placeholder throws"
    - "Per-fixture prompt-input cache under <root>/cache/<batch>/<id>/ so every repeat gets a byte-identical prompt"

key-files:
  created:
    - scripts/eval81/__fixtures__/agent-outputs.cjs
    - scripts/eval81/batches/A.cjs
    - scripts/eval81/batches/A.test.cjs
    - scripts/eval81/score/A.cjs
    - scripts/eval81/score/A.test.cjs
    - scripts/eval81/batches/B.cjs
    - scripts/eval81/batches/B.test.cjs
    - scripts/eval81/score/B.cjs
    - scripts/eval81/score/B.test.cjs
  modified: []

key-decisions:
  - "The B pre-check is the default JSON of `verify trd-pre 2` (what plan-objective.md captures in PRECHECK), not `--raw`, which prints only the summary line"
  - "A pre-check cache computed by another aof-tools (checkout vs tree 3.1.0) is refused, never reused or overwritten, so one batch never mixes two pre-checks"
  - "A's 'gaps section' is the frontmatter gaps block taken whole, or a body section whose heading contains 'gap' (the template's ### Gaps Summary)"
  - "Info-severity checker issues neither detect nor alarm; a clean run with no verdict heading is an abstention, not a false alarm"
  - "unrelated_blockers is {total, runs} over planted runs; cost_usd is the total charged over scored runs, with mean cost, wall time and first-turn input beside it"

patterns-established:
  - "Batch modules export their shared helpers; scorers read collect() output from record.outputs or outputs/outputs.json, then fall back to the run dir (work/, tmp/, stream.jsonl)"

requirements-completed: [SC-1, SC-3]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 21min
completed: 2026-10-17
tokens_input: 19908737
tokens_output: 151406
tokens_cache_read: 19612785
tokens_cache_write: 295770
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 09: Batch specs and scorers for A (verifier) and B (job-checker) Summary

**Batch A and B are runnable and scorable: 36 + 36 `--agent` runs whose prompts are the production verifier and checker prompts (asserted byte-equal to the workflow files), filled from each fixture's ROADMAP and, for B, a cached `verify trd-pre 2` JSON; and two scorers that apply 81-DECISION-RULE.md's metrics with exclusions, both proven on hand-written agent outputs. No live call.**

## Progress
- [x] Task 1: Canned agent outputs (fixture builder) — 09104850
- [x] Task 2: Batch A module and scorer — 6cd930b2
- [x] Task 3: Batch B module and scorer — 1e8090eb

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-17T16:43:04Z
- **Completed:** 2026-10-17T17:04:07Z
- **Tasks:** 3
- **Files created:** 9

## Accomplishments

- `batches/A.cjs` lists 36 verifier runs (A1..A6 x haiku, sonnet x 3), ids `A-<fx>-<model>-r<n>`, `--agent aoforge:verifier` on plugin 3.1.0, 15-minute timeout, the four `AOFORGE_SKIP_*` env entries, caps from `capFor({role: 'verifier'})`, in the interleaved order (repeat-major, key order, haiku first on A1/A3/A5 and sonnet first on A2/A4/A6). Each prompt is execute-objective.md's verifier spawn prompt filled with objective 1, the objective dir, and the goal and requirement IDs read from the fixture's built ROADMAP.md (cached in `<root>/cache/A/<id>/facts.json`).
- `collect` (A) returns the published `01-VERIFICATION.md`, else the newest `aoforge-drafts/**/01-VERIFICATION.md` under the run's TMPDIR with `published: false`, plus the result text and a contamination flag from a tool-input scan of `stream.jsonl`.
- `batches/B.cjs` lists 36 job-checker runs the same way. Each prompt is plan-objective.md's checker prompt filled with objective 2's goal, the `ls`-ordered TRD paths, the `verify trd-pre 2` JSON, the requirement IDs, REQUIREMENTS.md and "No CONTEXT.md: no locked decisions." Each set is built once into `<root>/cache/B/<id>/repo/` and its pre-check computed there with the 3.1.0 tree's aof-tools (this checkout's when `trees` is null, recorded as `source: "checkout"`), so all repeats of a set share one prompt.
- `score/A.cjs` scores each run from its VERIFICATION.md frontmatter status and gaps: detected, detected_unnamed, false_pass, abstain on planted runs; correct_pass, false_fail, abstain on clean ones. It reports detection split by evidence_flags, the unpublished count, and the runs excluded for `status:<s>`, `model_ran:false` or `contaminated`.
- `score/B.cjs` parses the checker return (verdict heading, Blockers and Warnings items, and the Structured Issues YAML deduped by description, with a Markdown fallback when the YAML does not parse). It scores detection, false_alarm, missed_as_pass, unrelated_blockers and abstain, with detection split by precheck_flags.
- `score.cjs --batch A|B` runs both scorers end to end, and `--report` accepts their results.

## Planned runs and caps (calibration null, i.e. caps.cjs FALLBACK_P90, which equals today's calibration)

| Batch | Model | Runs | Cap per run (USD) | Basis | Sum of caps |
|---|---|---|---|---|---|
| A | haiku | 18 | 0.45975 | p90(verifier) 1.7634 x 0.25 + base 0.0189 | 8.2755 |
| A | sonnet | 18 | 1.9974 | p90(verifier) 1.7634 x 1.0 + base 0.234 | 35.9532 |
| B | haiku | 18 | 0.418325 | p90(job-checker) 1.5977 x 0.25 + base 0.0189 | 7.52985 |
| B | sonnet | 18 | 1.8317 | p90(job-checker) 1.5977 x 1.0 + base 0.234 | 32.9706 |

Worst case (sum of caps): A $44.23, B $40.50. The ledger's batch caps are A $7.50 and B $6 (estimates $5 and $4). A cap only bounds a run's turns, but under 81-08's rule "batch spent + cap <= batch cap", A cannot start a sonnet run once it has spent more than $5.50, and B more than $4.17. See "Notes for downstream".

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Canned agent outputs | `node -e "...vGapsSlugify().split('\n')[1]"` printed `objective: 01-slug-command` (verifier.md key order, see deviation 1); the status line is `status: gaps_found`; every canned output parsed with yaml-lite as intended (the two malformed ones throw by design) | 0 | PASS |
| 2: Batch A module and scorer | `node --test scripts/eval81/batches/A.test.cjs scripts/eval81/score/A.test.cjs` (26/26) | 0 | PASS |
| 3: Batch B module and scorer | `node --test scripts/eval81/batches/B.test.cjs scripts/eval81/score/B.test.cjs` (20/20); `node scripts/eval81/score.cjs --batch B --root <hand-built root> --out <tmp>` wrote results/B.json and B.md | 0 | PASS |

All test runs used HOME and TMPDIR under the session scratchpad.

## Task Commits

1. **Task 1: Canned agent outputs** - `09104850` (test)
2. **Task 2: Batch A module and scorer** - `6cd930b2` (feat)
3. **Task 3: Batch B module and scorer** - `1e8090eb` (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (TRD gate, eval81) | `node --test 'scripts/eval81/**/*.test.cjs'`: 289 tests, 288 pass, 1 skipped, 0 fail | 0 | PASS |
| test (stack loop/task gate, scoped) | `node --test {files}` on the four new test files | 0 | PASS |
| tree-wide guards (extra) | `node --test 'plugins/aoforge/aoforge/bin/lib/*.repo.test.cjs' plugins/aoforge/hooks/planning-writes.audit.test.js`: 372/372 | 0 | PASS |

The full `npm test` suite was not run: this TRD adds only files under `scripts/eval81/`, every one of which the eval81 gate runs, and the tree-wide scans are covered by the guard row above.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (A) | `node --test scripts/eval81/batches/A.test.cjs scripts/eval81/score/A.test.cjs` before A.cjs existed: both files fail (MODULE_NOT_FOUND) | 1 | FAIL (correct) |
| GREEN (A) | same: 26/26 pass | 0 | PASS (correct) |
| RED (B) | `node --test scripts/eval81/batches/B.test.cjs scripts/eval81/score/B.test.cjs` before B.cjs existed: both files fail (MODULE_NOT_FOUND) | 1 | FAIL (correct) |
| GREEN (B) | same: 20/20 pass | 0 | PASS (correct) |

No REFACTOR phase was needed.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 truths, 4/4 artifacts, 3/3 key links. The templates are asserted equal to execute-objective.md ("Verify objective") and plan-objective.md (`<verification_context>`), and score/A.cjs requires `fixtures/A/answer-key.json`.
- TRD verification: `a.runs({root: <tmp>, trees: null, calibration: null}).length` printed 36, and the same call on B printed 36.
- Gate failures: None

## Files Created/Modified
- `scripts/eval81/__fixtures__/agent-outputs.cjs` - verificationMd and checkerReturn builders, 8 canned VERIFICATION.md and 12 canned checker returns, okRecord, runDir
- `scripts/eval81/batches/A.cjs` (+ test) - batch A module and the helpers B reuses
- `scripts/eval81/batches/B.cjs` (+ test) - batch B module with the pre-check cache
- `scripts/eval81/score/A.cjs` (+ test) - verifier scorer and the run-dir helpers B reuses
- `scripts/eval81/score/B.cjs` (+ test) - job-checker scorer and return parser

## Decisions Made
- **Prompt inputs.** A: objective number `1`, the goal and requirement IDs as written on the fixture ROADMAP's `**Goal**:` and `**Requirements**:` lines (brackets removed, like execute-objective.md's sed). B: objective `2` (the argument form, as passed to `verify trd-pre`), plan paths joined with newlines as `ls` prints them, REQUIREMENTS.md and the pre-check with trailing newlines removed as `$(...)` does. For B's requirement IDs I used objective 2's line. plan-objective.md's shell (`grep -i "Requirements:" | head -1` over the whole roadmap) would take objective 1's line, which is not what the template means.
- **Gap naming (A).** A run counts as a detection when the plant is named in one gap entry, in the frontmatter `gaps:` block taken whole, or in a body section whose heading contains "gap". This is my reading of the rule's "one gap entry, or the gaps section". A frontmatter that yaml-lite cannot parse is read from the raw text and noted.
- **Checker parsing (B).** Markdown items come first. A YAML entry with the same description merges into its Markdown item and keeps the Markdown severity; other YAML entries are added with their own severity. Info issues count for nothing. A return with no verdict heading is an abstention for clean and planted sets alike.
- **Money fields.** Per model, `cost_usd` is the total charged (charged_usd, else cost_usd) over scored runs. `mean_cost_usd`, `mean_wall_ms` and `mean_first_turn_input` sit beside it. Excluded runs' spend is in the ledger spend block.
- **Shared helpers.** These are exported from `batches/A.cjs` and `score/A.cjs` and required by the B modules, so no file beyond the TRD's nine was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Spec conflict] Task 1's verify command expects the status on line 2**
- **Found during:** Task 1
- **Issue:** `vGapsSlugify().split('\n')[1]` assumes `status:` is the first frontmatter key. verifier.md's template orders objective, verified, status.
- **Fix:** Followed verifier.md, as the task's recovery says. The command prints `objective: 01-slug-command`, and the status line (`status: gaps_found`) was checked by search. The scorers never depend on key order.
- **Commit:** 09104850

**2. [Rule 3 - Blocking] `verify trd-pre 2 --raw` prints only the summary line**
- **Found during:** Task 3 (and noted by 81-04)
- **Fix:** The pre-check is the default JSON output, which is also what plan-objective.md captures (`PRECHECK=$(... verify trd-pre "$OBJECTIVE" 2>/dev/null)`).
- **Commit:** 1e8090eb

**3. [Rule 2 - Missing critical] A mixed-source pre-check cache is refused**
- **Found during:** Task 3
- **Issue:** Suppose a dry run with `trees: null` cached the checkout's pre-check in the live root. Without a check, the live batch (with trees) would silently reuse it, or overwriting the cache would change the prompts mid-batch, because the JSON carries `elapsed_ms`.
- **Fix:** The cache records `source` and `tool`, and a mismatch throws. The error names the directory to remove.
- **Commit:** 1e8090eb

**4. [Rule 3 - Blocking] Gate command form on Node 24**
- `node --test scripts/eval81/` cannot load a directory on Node 24.13.1, so the gate ran as `node --test 'scripts/eval81/**/*.test.cjs'`.

### Decisions where the TRD left room
- **Per-task commits.** I made one commit per task (3 commits), following the executor contract, instead of the single commit Task 3's action names.

---

**Total deviations:** 4 (1 spec conflict, 2 blocking, 1 missing critical)
**Impact on plan:** None on scope; every TRD name and signature is as written.

## Notes for downstream (81-08 runner, 81-13 rehearsal, 81-14/81-15 live)

- **What the runner must provide.**
  - The scorers read collect()'s return from `record.outputs` or `<run dir>/outputs/outputs.json`, and either works.
  - Without either, A falls back to `work/` and `tmp/` in the run dir, and B falls back to `record.result_text`, then the stream's result event.
  - A's collect assumes workDir is `<run dir>/work`, the run's TMPDIR is `<run dir>/tmp`, and the stream is at `<run dir>/stream.jsonl` (81-08's documented layout). `opts.tmp` overrides the TMPDIR guess.
- **Run id in the cwd.** The runner's work path `R/runs/<batch>/<id>/work` puts the run id (fixture id and model, e.g. `A-A5-haiku-r1`) in the session's cwd and in A5's MODULE_NOT_FOUND stack trace. It carries no key word and no planted kind, and the prompt has neither, but an opaque work-dir name in the runner would remove it entirely. This is 81-08's file, so it is left unchanged here.
- **Caps vs batch caps.** The per-run caps (sonnet verifier about $2, sonnet checker about $1.83) are large against the batch caps ($7.50, $6). Under "batch spent + cap <= batch cap", A stops before a sonnet run once more than $5.50 is spent, and B once more than $4.17 is spent. If real runs average above about $0.15 (A) or $0.12 (B), a batch can stop with fewer than 2/3 of its runs scored. 81-13's rehearsal or the batch-A checkpoint should check this before spend (caps.cjs and ledger.cjs are 81-01's).
- **B4 differs from production.** plan-objective.md skips the checker spawn when `verify trd-pre` finds a task_completeness blocker. B4 is such a set, and the eval spawns the checker anyway, which is what the precheck split measures.

## Auth gates

None.

## Discovered commands

None (every command came from the TRD or STACK.md).

## User Setup Required

None.

## Self-Check: PASSED

- FOUND: scripts/eval81/__fixtures__/agent-outputs.cjs, batches/A.cjs, batches/A.test.cjs, score/A.cjs, score/A.test.cjs, batches/B.cjs, batches/B.test.cjs, score/B.cjs, score/B.test.cjs
- FOUND commits: 09104850, 6cd930b2, 1e8090eb on df/exec-81-09-batch-specs-and-scorers-a-b
- No live `claude -p` call, no network, nothing written outside the worktree except scratchpad files; no node_modules symlink was created
