---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "12"
subsystem: testing
tags: [eval, 76-08, fixture, transcripts, role-metrics, measurement, workload]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: "81-01 contract.cjs validateDescriptor, caps.cjs capForWorkflow, result.cjs LONG_PROMPT/transcriptCost; 81-02 score.cjs extra_files; 81-07 results/static-prompt.json"
provides:
  - "scripts/eval81/fixtures/E/build.cjs: buildFixture(dir), describeFixture(), QUICK_TEXT, BUILD_ARGS, QUICK_PROMPT, BUILD_PROMPT, V300_MIGRATIONS"
  - "scripts/eval81/fixtures/E/acceptance.cjs: checkQuick(dir, env), checkBuild(dir, env), runTests, verificationOf, frontmatterStatus, objectiveOneDirs"
  - "scripts/eval81/fixtures/E/reference.cjs: applyQuick(dir), applyBuild(dir)"
  - "scripts/eval81/batches/E.cjs: batch module (runs, materialize, collect), SESSION_MODEL, sessionModel(env), RUN_ORDER, PILOT_IDS, RUN_ENV, UPGRADE_SUBJECT"
  - "scripts/eval81/lib/roles.cjs: rolesForRun(runDir, {rates}), firstTurnInput(file), roleOf(meta)"
  - "scripts/eval81/score/E.cjs: score({root, outDir, rates?, staticFallback?, now?}), renderMeasurement, stats"
  - "scripts/eval81/__fixtures__/transcripts.cjs: hand-built main/subagent JSONL and meta.json writers, STANDARD_RUN + EXPECTED_STANDARD, SCORE_RUNS, STATIC_PROMPT, writeRunDir"
affects: [81-13, 81-17, 81-19]

tech-stack:
  added: []
  patterns:
    - "Hidden checks run against a seeded notes file in a fresh temp cwd named by NOTEKIT_FILE, so the work dir's own data is never touched and copied output cannot pass"
    - "Per-role rows price each deduped message with the ledger's transcriptCost rule, so the rows sum to the charged transcript figure"
    - "The scorer keeps the CLI-reported cost as reported and flags a >10% gap to the transcript price instead of overwriting either"

key-files:
  created:
    - scripts/eval81/fixtures/E/build.cjs
    - scripts/eval81/fixtures/E/acceptance.cjs
    - scripts/eval81/fixtures/E/reference.cjs
    - scripts/eval81/fixtures/E/proofs.test.cjs
    - scripts/eval81/__fixtures__/transcripts.cjs
    - scripts/eval81/batches/E.cjs
    - scripts/eval81/batches/E.test.cjs
    - scripts/eval81/lib/roles.cjs
    - scripts/eval81/lib/roles.test.cjs
    - scripts/eval81/score/E.cjs
    - scripts/eval81/score/E.test.cjs
  modified: []

key-decisions:
  - "Session model opus (SESSION_MODEL, the user's own session model); EVAL81_E_SESSION_MODEL=sonnet|opus switches it without editing the frozen module, anything else throws"
  - "The project is stamped 3.0.0 with every v3.0.0 migration id (0001..0014): v3.0.0 reports it healthy and up to date; 3.1.0 reports W040 only and has nothing pending but the stamp, so its upgrade hook commits chore(aoforge): upgrade project to v3.1.0"
  - "Role cells count only runs that ended ok, per spawn (n = spawns (runs)); every recorded run stays in the per-run table, and a non-ok run is flagged and listed as excluded"
  - "Static resident bytes come from <out>/results/static-prompt.json, else the repository's committed 81-07 copy (the rehearsal's out dir has none), else n/a; the orchestrator's static cell is n/a (not a spawn)"
  - "collect returns exactly {acceptance, tests, verification_status, trd_count, summaries, git_log_subjects}; for quick, trd_count counts the quick plan (*-JOB.md) under .aoforge/quick/"
  - "The scorer reads collect outputs from record.outputs, else outputs/outputs.json or collect.json, else per-key outputs/<key>.json, else any outputs/*.json holding acceptance, because 81-08's layout was not visible to this wave"

patterns-established:
  - "Test E outcome = hidden check pass AND node --test green (AND VERIFICATION.md status passed when present, for builds)"
  - "A proof that needs another release's aof-tools exports it read-only with git archive into a temp dir and skips, with the reason, when the tag is not in the clone"

requirements-completed: [SC-2, SC-4]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 19min
completed: 2026-10-17
tokens_input: 28019932
tokens_output: 174963
tokens_cache_read: 27667847
tokens_cache_write: 351869
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 12: Test E fixture, workload spec, per-role transcript metrics and the 76-08 renderer Summary

**Test E is ready to run with no live call: a deterministic `notekit` project valid for both 3.0.0 and 3.1.0, hidden checks proven to fail on the base project and pass on hand-written solutions, a 10-run pilot-first ABBA workload at caps $6/$15, per-spawn transcript metrics that sum to the ledger's priced cost, and the 81-MEASUREMENT.md renderer proven on hand-built transcripts.**

## Progress
- [x] Task 1: E fixture, hidden acceptance checks, reference solutions and proofs — ea82d8eb
- [x] Task 2: Batch E module and per-role transcript metrics — f222dcd7
- [x] Task 3: Scorer E and the 76-08 measurement renderer — 75d87e18

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-17T16:48:25Z
- **Completed:** 2026-10-17T17:07:28Z
- **Tasks:** 3
- **Files created:** 11

## Accomplishments
- `buildFixture(dir)` writes `notekit` (CommonJS CLI with `add`/`list`, `src/store.js` over `notes.json` or `NOTEKIT_FILE`, 6 passing `node --test` tests) plus an `.aoforge/` tree with an unplanned objective 1 "Tags" (TAG-01, TAG-02), config `model_profile: balanced`, `mode: yolo`, `workflow.auto_advance: true`, `workflow.research: false`, the v3.0.0 config template and a 3.0.0 stamp; three commits with a fixed author ("Project Author") and fixed dates, so two builds give the same HEAD.
- Proven on both versions: this checkout's (3.1.0) `validate health` has no errors and only W040 (stamped 3.0.0, 0 pending), `upgrade --check` has nothing pending but the stamp; v3.0.0's own aof-tools (exported with `git archive`) reports the project healthy and `up to date (v3.0.0)`; both versions' `init plan-objective 1` find objective 1 unplanned.
- `checkQuick` / `checkBuild` fail on the base project (its own tests green) and pass on `applyQuick` / `applyBuild` with `node --test` green (8 and 10 tests); each solution fails the other check; a VERIFICATION.md with status other than passed (or none) fails `checkBuild`; a solution printing the project's notes instead of the seeded ones fails `checkQuick`.
- `batches/E.cjs` returns the 10 runs `q31-r1 q30-r1 b31-r1 b30-r1 q30-r2 q31-r2 q31-r3 q30-r3 b30-r2 b31-r2`, all valid descriptors identical per workflow except id, order, plugin and version bookkeeping; `collect` runs the hidden check in the work dir with HOME = the sandbox home (proven by a project test that asserts HOME) and never throws on a broken work dir.
- `roles.cjs` gives one row per spawn (orchestrator from the main session, subagents by meta `agentType`) with first-turn input, totals from `sumUsage`, cache writes, priced cost (5m/1h split, Haiku long-prompt rule) and wall seconds; on the hand-built standard run the rows equal the hand-computed values and their sum equals `transcriptCost` to the cent fraction.
- `score/E.cjs` aggregates per version x workflow x role (median/mean/min/max over spawns), 3.1.0 minus 3.0.0 deltas with the percentage of the 3.0.0 median, per-run rows with costs, tokens, wall time, acceptance, tests, verification, TRD and SUMMARY counts and the upgrade commit, joins the 81-07 static bytes, and renders 81-MEASUREMENT.md; `node scripts/eval81/score.cjs --batch E --root <hand-built root> --out <tmp>` wrote results/E.json, results/E.md and 81-MEASUREMENT.md.

## Batch E plan (for 81-13 and 81-17)

| Run | Version | Workflow | Session model | Cap (USD) | Timeout | Ledger role |
|---|---|---|---|---|---|---|
| q31-r1 (pilot) | 3.1.0 | quick | opus | 6 | 30 min | workflow:quick |
| q30-r1 (pilot) | 3.0.0 | quick | opus | 6 | 30 min | workflow:quick |
| b31-r1 (pilot) | 3.1.0 | build | opus | 15 | 90 min | workflow:build |
| b30-r1 (pilot) | 3.0.0 | build | opus | 15 | 90 min | workflow:build |
| q30-r2 | 3.0.0 | quick | opus | 6 | 30 min | workflow:quick |
| q31-r2 | 3.1.0 | quick | opus | 6 | 30 min | workflow:quick |
| q31-r3 | 3.1.0 | quick | opus | 6 | 30 min | workflow:quick |
| q30-r3 | 3.0.0 | quick | opus | 6 | 30 min | workflow:quick |
| b30-r2 | 3.0.0 | build | opus | 15 | 90 min | workflow:build |
| b31-r2 | 3.1.0 | build | opus | 15 | 90 min | workflow:build |

- Both caps clamp to their ceilings with today's fallback p90s: quick sums to $65.67 before the E_quick 6 ceiling, build to $73.07 before E_build 15 (the opus orchestrator costed as planner p90 x opus is $30.51 alone). Sum of caps $96; the ledger's batch E cap ($55) and reserves (cap x 1.25 = $7.50 quick, $18.75 build, or cap + observed same-role overshoot) bound the actual spend.
- Prompts: `/aoforge:quick Add a --json flag to `notekit list` that prints the notes as a JSON array of {id, text} objects, with a test.` and `/aoforge:build 1 --skip-research --auto`. Env: AOFORGE_SKIP_AWARENESS_POPULATE, AOFORGE_SKIP_TRANSCRIPT_EXPORT, AOFORGE_SKIP_PRUNE = "1"; never AOFORGE_SKIP_EDIT_GATE.
- `EVAL81_E_SESSION_MODEL=sonnet` before a runner command switches every E run to sonnet (81-17's "go E sonnet").

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: E fixture, hidden checks, reference solutions and proofs | `node --test scripts/eval81/fixtures/E/proofs.test.cjs` (HOME/TMPDIR under the scratchpad) | 0 | PASS (13/13) |
| 2: Batch E module and per-role transcript metrics | `node --test scripts/eval81/batches/E.test.cjs scripts/eval81/lib/roles.test.cjs` | 0 | PASS (20/20) |
| 3: Scorer E and the 76-08 renderer | `node --test scripts/eval81/score/E.test.cjs`; `node scripts/eval81/score.cjs --batch E --root <scratch root1> --out <scratch out1>` | 0, 0 | PASS (11/11; E.json, E.md, 81-MEASUREMENT.md written) |
| TRD verification | `node -e "...runs({root,trees:null,calibration:null}).map(r=>r.id).join(' ')"` | 0 | PASS (`q31-r1 q30-r1 b31-r1 b30-r1 q30-r2 q31-r2 q31-r3 q30-r3 b30-r2 b31-r2`) |
| TRD verification | `rg -n -i "acceptance\|reference" scripts/eval81/fixtures/E/build.cjs` | 0 | PASS (one line: STATE.md's standard `## Project Reference` heading, not a file; case-sensitive as written in the TRD it matches nothing) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (TRD gate, glob form) | `node --test 'scripts/eval81/**/*.test.cjs'` (287 tests: 286 pass, 0 fail, 1 skipped = 81-06's private fleet checklist absent here) | 0 | PASS |
| repo-wide guards | `node --test 'plugins/aoforge/**/*.repo.test.cjs' 'scripts/**/*.repo.test.cjs'` (307 tests, after the last commit) | 0 | PASS |
| full suite | not run: the TRD gate is the eval81 suite; this TRD adds files under scripts/ only, and the repo-wide guards that scan them ran | - | not_available |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (batch E, roles) | `node --test scripts/eval81/batches/E.test.cjs scripts/eval81/lib/roles.test.cjs` (20 fail: modules missing) | 1 | FAIL (correct) |
| GREEN (batch E, roles) | same (19 pass, then 20 after the test's version-fairness strip also nulled the pilot flag) | 0 | PASS (correct) |
| RED (score E) | `node --test scripts/eval81/score/E.test.cjs` (11 fail: module missing) | 1 | FAIL (correct) |
| GREEN (score E) | same (11 pass) | 0 | PASS (correct) |
| REFACTOR (score E rendering) | same, with assertions added for the double-backtick prompt span, the repo-relative static path and the profile wording | 0 | PASS (correct) |

Task 1 is the TRD's TDD exception (fixture and reference solutions); acceptance.cjs is proven by the proofs' fail-on-base / pass-on-reference pairs.

## Discovered commands

None. The repo's `node --test {files}` is used, in the glob form on Node 24.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gate command form on Node 24**
- **Found during:** validation gate
- **Issue:** `node --test scripts/eval81/` (the TRD's gate) cannot run on Node 24 (a directory argument is loaded as a module), as 81-01 and 81-02 recorded.
- **Fix:** ran `node --test 'scripts/eval81/**/*.test.cjs'`.
- **Files modified:** none

**2. [Rule 2 - Missing critical] The scorer falls back to the committed static-prompt.json**
- **Found during:** Task 3 (reading 81-13's rehearsal, which scores into `<R2>/out` with no results/static-prompt.json)
- **Issue:** reading only `<outDir>/results/static-prompt.json` would leave every static cell n/a in the rehearsal.
- **Fix:** `score` takes `staticFallback` (default: this repository's committed 81-07 copy), records `static.source` (`out` | `fallback` | null) and the path, and the report names it; null gives n/a cells.
- **Files modified:** scripts/eval81/score/E.cjs, scripts/eval81/score/E.test.cjs
- **Commit:** 75d87e18

**3. [Rule 2 - Missing critical] collect outputs are read from more than one layout**
- **Found during:** Task 3
- **Issue:** 81-08's runner (parallel, not visible) decides where collect's outputs land (`record.outputs` in the contract, an `outputs/` dir in its layout).
- **Fix:** record.outputs, else outputs/outputs.json or collect.json, else per-key `outputs/<key>.json`, else any outputs/*.json holding `acceptance`; a test covers the outputs.json form. If 81-13's rehearsal finds yet another layout, the fix belongs here, test first.
- **Commit:** 75d87e18

**4. [Process] One commit per task instead of the TRD's single commit of eleven files**
- **Found during:** Task 3
- **Issue:** Task 3's action commits all eleven files in one commit; the executor contract commits each task as it passes.
- **Fix:** three task commits (ea82d8eb, f222dcd7, 75d87e18) covering the same eleven files.

### Findings recorded (no change needed)
- 3.1.0's `validate health` on the 3.0.0-stamped project: errors none, warnings W040 only ("stamped v3.0.0, AOForge v3.1.0; 0 pending, 0 need confirmation"), the upgrade path itself (TRD recovery: assert warnings only). `upgrade --check` skips every migration including 0015 (STATE.md has no decisions), so the 3.1.0 hook's commit changes config.json's stamp only.
- The v3.0.0 half of proof 2 and the V300_MIGRATIONS check need the `v3.0.0` tag; CI's `actions/checkout` is shallow, so they skip with the reason there instead of failing.
- Balanced tiers for planner, executor, verifier and job-checker are identical in v3.0.0 and HEAD model-profiles.json; the planner inherits the session model, which the report header states.

---

**Total deviations:** 4 (1 blocking gate form, 2 missing critical, 1 process)
**Impact on plan:** Additive; every TRD name, signature, order, prompt, env flag, cap source and timeout is as written.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 truths, 4/4 artifacts, 2/2 key links (`sumUsage` in roles.cjs; `static-prompt.json` in score/E.cjs)
- Gate failures: None

## Issues Encountered
- My own first proof assertions were wrong on three details and were fixed in the test, not the code: git prints commit dates as `+00:00`, `upgrade --check --raw` prints text (JSON without `--raw`), and the base `list` ignores extra arguments so `list --tag work` exits 0 on the base project.

## User Setup Required

None.

## Next Objective Readiness
- 81-13: `run.cjs --batch E --dry-run --materialize first` gets valid descriptors and a deterministic project; the rehearsal's `score.cjs --batch E --root <R2> --out <R2>/out` renders 81-MEASUREMENT.md from fake transcripts, with static bytes from the committed fallback.
- 81-17: the checkpoint can show SESSION_MODEL opus and the sonnet switch; Task 2's cost check reads `transcriptCost` while the report shows reported vs priced per run and flags >10% gaps; the build pilot's TRD count is in collect's `trd_count`.

## Self-Check: PASSED

- FOUND: all eleven key files (`git ls-files --error-unmatch`)
- FOUND: ea82d8eb, f222dcd7, 75d87e18 on df/exec-81-12-e-fixture-spec-and-role-metrics
- No node_modules symlink was created; no live `claude -p` call; no token file read; nothing written outside the worktree except scratchpad files
