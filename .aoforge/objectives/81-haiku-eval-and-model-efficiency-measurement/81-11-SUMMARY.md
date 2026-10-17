---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "11"
subsystem: testing
tags: [eval81, test-c, codebase-mapper, project-researcher, grader, batch-spec, scorer, blind-grading]

requires:
  - objective: 81-01
    provides: "capFor / FALLBACK_P90, validateDescriptor, toolInputsMentioning, ledger roles"
  - objective: 81-02
    provides: "batch result contract (planned per role or model), score.cjs CLI, decide() and renderBatchTable"
  - objective: 81-06
    provides: "synthetic codebase, committed checklists, fleet hash commitment and private checklist, researcher topic, grader prompt and schema"
provides:
  - "scripts/eval81/batches/C.cjs: runs, materialize, collect, needsWatchedRepos, prepareFleet, makeBatch, plan, readRunRecord and prompt extraction helpers"
  - "scripts/eval81/score/C.cjs: score({root, outDir}), spotCheckSample({root, seed, k}), pathFabrications, indexFromFiles"
  - "scripts/eval81/__fixtures__/c-outputs.cjs: hand-written canned documents and grades, cRoot, fakeFleet"
affects: [81-13-rehearsal-and-preregistration-freeze, 81-18-live-batch-c-mapper-researcher, 81-19-report-76-records-and-proposals]

tech-stack:
  added: []
  patterns:
    - "Batch factory (makeBatch) so tests bind a made-up private file and commitment while the runner loads the default export"
    - "Plan note <root>/cache/C/plan.json written by runs() so the scorer and the report know which plan ran (fleet omitted or not)"
    - "Two-invocation batch: graders are listed only for agent runs whose collected outputs exist"
    - "Private content only in the eval root: results carry ids, counts and rates; the sample with quotes goes to <root>/spotcheck/"

key-files:
  created:
    - scripts/eval81/__fixtures__/c-outputs.cjs
    - scripts/eval81/batches/C.cjs
    - scripts/eval81/batches/C.test.cjs
    - scripts/eval81/score/C.cjs
    - scripts/eval81/score/C.test.cjs
  modified: []

key-decisions:
  - "Opaque run ids (C-map-<focus>-<a|b>-<h|s>-<rep>, C-res-<dim>-<h|s>-<rep>): the agent sees its working-directory path, so no id says synthetic, fleet or a model name"
  - "Prompts are read at runs() time from this checkout's workflows (map-codebase.md fenced block, new-project.md Task text) and filled with three substitutions only; the test extracts them independently"
  - "A run is scored only when the grader gave exactly one valid verdict for every checklist item; an omitted or duplicated item excludes the run with its reason (recall keeps the fixed checklist-size denominator)"
  - "The mechanical path check is literal and mapper-only, run against the pristine codebase (not the agent's work copy), lenient on path tails, and ignores import paths, MIME types, globs and capital-letter pairs"
  - "Fleet preparation commits its strip-and-add step in the prepared clone so git status is clean for every run"

patterns-established:
  - "Fixture builders stay independent of the module under test; one test proves collect() reproduces the fixture's output shape from raw files"

requirements-completed: [SC-1, SC-3]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 1
  tdd_evidence: true
  test_pairing: true

duration: 22min
completed: 2026-10-17
tokens_input: 16997182
tokens_output: 201520
tokens_cache_read: 16651709
tokens_cache_write: 345331
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 81 TRD 11: Batch spec, grader and scorer for test C Summary

**Test C is runnable and scorable without a live call: 32 mapper and 16 researcher agent runs with production prompts, blind Sonnet grader runs listed from the collected outputs, a sha256-gated private fleet checklist, and a scorer that reports checklist recall, error, missing and fabrications per role and model with a per-codebase split and a seeded spot-check sample kept out of every committed file.**

## Progress
- [x] Task 1: Canned C outputs (fixture builder) — adf4fc7f
- [x] Task 2: Batch C module (mapper, researcher, grader) — d1d4230c
- [x] Task 3: Scorer C and spot-check sampler — 2fc7cb42

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-17T17:09:36Z
- **Completed:** 2026-10-17T17:32:00Z
- **Tasks:** 3
- **Files created:** 5 (plus this SUMMARY)

## Accomplishments
- `batches/C.cjs` yields 48 valid agent descriptors (32 mapper, 16 researcher; agents `aoforge:codebase-mapper` and `aoforge:project-researcher`, plugin 3.1.0, `capFor` caps with bases, mapper before researcher, models alternating inside each pair, repeat 1 of everything before repeat 2) and, once outputs exist, one `C-grade-<id>` grader descriptor per ok run that has a document: model sonnet, no plugin, `tools: []`, the committed schema, a 5-minute timeout, a prompt that is `grader-prompt.md` with the task line, the committed checklist and the document, and no model name or run id.
- Mapper prompts are the fenced `Focus:` blocks of `map-codebase.md` verbatim; researcher prompts are the `new-project.md` `Task(prompt=...)` text with `[domain]`, the project summary and the greenfield marker filled from `researcher-topic.md`. Both are asserted equal to an independent extraction in the test.
- The private fleet checklist is gated by sha256 against `fleet-commitment.json` ("fleet checklist missing or changed since it was committed") before any descriptor is returned; `EVAL81_C_SKIP_FLEET=1` and `allowMissingFleet` are the recorded reductions.
- `prepareFleet` clones the read-only fleet source once into `<root>/cache/C/fleet-src` with `git --no-optional-locks clone --no-checkout --no-hardlinks`, detaches at the committed commit, removes origin, the legacy planning directory and `.claude/`, adds the minimal 3.1.0 `.aoforge/` and commits it. Smoke-run against the real source into scratch: 405 ms, 46 of 46 private evidence patterns still match, source HEAD and porcelain byte-identical, prepared tree clean with no remote.
- `score/C.cjs` joins each agent run with its grader run and returns the 81-02 result: eight roles in fixed order, per model `n_scored`, `planned` (per role and model: 4 mapper / 2 researcher, 2 mapper when the fleet is omitted), `recall`, `error`, `missing` as k/n of checklist items, `fabrications` as {total, runs}, `recall_by_codebase` and `fabrications_by_codebase`, cost, grader cost, wall time, exclusions with reasons and notes. It feeds `decide()` and `renderBatchTable` unchanged.
- `spotCheckSample` writes a seeded sample (seed 81, 6 pairs, round-robin over found, wrong and missing) to `<root>/spotcheck/C.md` and refuses a path under `--out`; `score()` also writes `spotcheck/C-paths.md` listing every flagged path with its line.

## Planned runs and caps (batch C)

Caps come from `capFor` with `calibration: null` (FALLBACK_P90: mapper 2, researcher 3, grader 0.5; the calibration has no samples for these roles) and include the 36K-token base-prompt allowance.

| Runs | Count | Cap each (USD) | Sum (USD) |
|---|---|---|---|
| codebase-mapper, haiku | 16 | 0.5189 | 8.30 |
| codebase-mapper, sonnet | 16 | 2.2340 | 35.74 |
| project-researcher, haiku | 8 | 0.7689 | 6.15 |
| project-researcher, sonnet | 8 | 3.0000 (clamped to the C ceiling) | 24.00 |
| agent runs | 48 | | 74.20 |
| grader, sonnet (listed on the second invocation) | 48 | 0.6008 | 28.84 |
| all 96 | | | 103.04 |

The ledger has no batch cap for C (`BATCH_CAPS.C` is null; estimate $28), so the limit is the global $100: `canStart` reserves max(cap x 1.25, cap + the largest same-batch-and-role overshoot) before each run, at most $3.75 for a researcher sonnet run. The sum of caps (103.04) exceeds $100, but caps bound a run, not the batch; the figure to watch is the running total after A, B, D and E. Risk to decide at the batch-C checkpoint: a Haiku mapper cap of $0.52 and a researcher cap of $0.77 are guesses from fallback p90s; a run that hits its cap is `cap_hit` and is excluded, which lowers the scored share the rule needs (2/3 of planned: 3 of 4 per mapper role, 2 of 2 per researcher role). Raising `FALLBACK_P90` or `CEILING.C` in `lib/caps.cjs` (81-01's file) is the lever.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Canned C outputs | `node -e "require('./scripts/eval81/__fixtures__/c-outputs.cjs')"` (HOME/TMPDIR in scratch); verdict counts and verbatim quotes checked against the checklists (tech 8/1/2, stack 7/2/1, pitfalls 5/1/5) | 0 | PASS |
| 2: Batch C module | `node --test 'scripts/eval81/batches/C.test.cjs'` (22 tests) | 0 | PASS |
| 3: Scorer C | `node --test 'scripts/eval81/score/C.test.cjs'` (17 tests) | 0 | PASS |
| TRD verification | `C.runs({root: <scratch>, trees: null, calibration: null, repo: process.cwd()})` on this checkout with the private file present lists 48 runs; `git status --porcelain` clean after the commits | 0 | PASS |
| Leak scan | `rg -n -i -e aoedge -e aocybersystems scripts/eval81` (no match, exit 1); private statements and the source path searched in every changed file and in a real-default result: 0 hits | 1 (no match) | PASS |

## Task Commits

1. **Task 1: Canned C outputs (fixture builder)** - `adf4fc7f` (test)
2. **Task 2: Batch C module (mapper, researcher, grader)** - `d1d4230c` (feat)
3. **Task 3: Scorer C and spot-check sampler** - `2fc7cb42` (feat; carries the TRD's message)

**Plan metadata:** the final `docs(81-11)` commit carrying this SUMMARY, STATE.md and ROADMAP.md

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (C) | `node --test 'scripts/eval81/batches/C.test.cjs' 'scripts/eval81/score/C.test.cjs'` | 0 | PASS (39/39) |
| test (eval81) | `node --test 'scripts/eval81/**/*.test.cjs'` (the TRD's `node --test scripts/eval81/` cannot run on Node 24) | 0 | PASS (282/282) |
| test (rename guard) | `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs` | 0 | PASS (25/25, after fix d1d4230c) |

The full `npm test` suite was not run; the scoped gates cover every file this TRD touches. HOME and TMPDIR were under the session scratchpad for every run.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (batch C) | `node --test 'scripts/eval81/batches/C.test.cjs'` before C.cjs existed (Cannot find module './C.cjs') | 1 | FAIL (correct) |
| GREEN (batch C) | same, after C.cjs: 21/21, then 22/22 with the replacement-pattern test | 0 | PASS (correct) |
| RED (scorer C) | `node --test 'scripts/eval81/score/C.test.cjs'` before score/C.cjs existed (Cannot find module './C.cjs') | 1 | FAIL (correct) |
| GREEN (scorer C) | same, after score/C.cjs: 17/17 | 0 | PASS (correct) |

Task 1 carries a TDD exception: it is test infrastructure (hand-written fixtures), proved by the two test files that consume it, including a test that `collect()` reproduces the fixture's output shape from raw files.

## Post-TRD Verification

- **Auto-fix cycles used:** 1 (rename guard)
- **Must-haves verified:** 5/5 truths, 2/2 artifacts, 2/2 key links (`fleet-commitment` sha256 check in `loadPrivateFrom`; the map-codebase fenced-block equality test)
- **Gate failures:** rename-guard case 2 failed once on the legacy planning-directory literal in three of my files; fixed in d1d4230c by building the name from `LEGACY.planningDir`

## Files Created/Modified
- `scripts/eval81/__fixtures__/c-outputs.cjs` - canned tech, stack and pitfalls documents with grades, `cRoot`, `fakeFleet`
- `scripts/eval81/batches/C.cjs` - the batch module (header comment documents ids, the hash gate, reductions and the collected-output shapes)
- `scripts/eval81/batches/C.test.cjs` - 22 tests: test list 1-6 plus caps, ids, truncation, stray runs
- `scripts/eval81/score/C.cjs` - scorer, mechanical path check, spot-check sampler
- `scripts/eval81/score/C.test.cjs` - 17 tests: test list 7-10 plus exclusions, reductions, decide and CLI integration

## Decisions Made
- **Ids.** Opaque on purpose (see key-decisions); the readable data is in `fixture` and the records.
- **Prompt source.** Read from `repo` (default this checkout) rather than from the plugin tree in `trees`, whose layout the runner does not yet fix; `trees` is accepted and unused.
- **Strict grading completeness.** A grader that omits or duplicates an item excludes the run; ids not on the checklist are ignored and counted, never mapped.
- **Mapper-only path check.** The decision rule says "the run's codebase"; a researcher run has none, so only the grader's fabrications count for it (stated in the result notes).
- **Literal path rule.** "No `go.sum`" in a document is counted like an invented path, as the pre-registered rule reads. `spotcheck/C-paths.md` lists the lines so a person can see how many are of that kind. A negation carve-out would change the pre-registered definition, so it is left to the user.
- **Fleet prep commit.** The prepared clone commits its removal and `.aoforge/` addition (fixed identity, the source commit's date) so `git status` is clean; the marker `fleet-ready.json` records the source commit and the prepared HEAD.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Legacy planning-directory literal tripped the rename guard**
- **Found during:** Task 2 (gate run before the commit)
- **Issue:** `.planning` appeared in `C.cjs`, `C.test.cjs` and `c-outputs.cjs`, and `rename-guard.repo.test.cjs` case 2 fails on any legacy name outside its allow list.
- **Fix:** the name is built from `LEGACY.planningDir` (legacy-names.cjs); comments say "the legacy planning directory".
- **Files modified:** scripts/eval81/batches/C.cjs, scripts/eval81/batches/C.test.cjs, scripts/eval81/__fixtures__/c-outputs.cjs
- **Verification:** rename guard 25/25
- **Committed in:** d1d4230c

**2. [Rule 2 - Missing critical] makeBatch ignored `undefined` options**
- **Found during:** Task 3 (the scorer passes optional `repo`, `privateFile`, `commitmentFile` straight through)
- **Issue:** `{repo: undefined}` overrode the default checkout and broke the default call from `score.cjs`.
- **Fix:** `makeBatch` keeps its default for any option that is undefined or null.
- **Files modified:** scripts/eval81/batches/C.cjs
- **Verification:** the CLI integration test (9f) and the real-default score call
- **Committed in:** 2fc7cb42

### Departures from the TRD text (recorded, none changes a must-have)

- **Third prompt fill.** The TRD says the researcher prompt is the template with `[domain]` and the project summary filled "and nothing else changed". The template also carries `[greenfield OR subsequent]`, an instruction to the orchestrator; it is set to `greenfield` (the TRD's own embedded context says `<milestone_context>` (greenfield)). The unused `Subsequent:` line, with its `[target features]`, stays verbatim. A side effect of filling `[domain]` verbatim from the topic file is the capitalised "for A command-line tool ..." wording in the prompts.
- **One commit per task** instead of the single Task 3 commit (executor contract); the Task 3 commit carries the TRD's message.
- **Test 1 runs on a made-up fleet.** The real private file is gitignored, so a test that required it would fail in CI; tests 1-6 bind `fakeFleet` through `makeBatch`, and test 1e checks the default export against the real file when it is on the machine (skipped otherwise).
- **Additions.** `cache/C/plan.json` (which plan ran), `cache/C/fleet-ready.json` (idempotence marker), `planned` also at role level, `grader_cost_usd`, a note counting grader quotes not found verbatim in their documents, and `spotcheck/C-paths.md`.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical), 4 recorded departures
**Impact on plan:** none on scope; additions are in-scope support for the scorer and the live checklist.

## Issues Encountered
- The runner (81-08) was not visible while this was written. The batch and scorer assume its documented layout: `<root>/runs/C/<id>/{record.json, work/, tmp/, stream.jsonl}`, `record.outputs` holding what `collect()` returned (also read from `outputs/outputs.json`), `record.structured_output` and `record.result_text` available to a grader's `collect()` through `ctx.record`, `record.status`, `model_ran`, `cost_usd`, `wall_ms`. `materialize` is called with `ctx.root` and `collect` with `ctx.root` and `ctx.record`; drafts are read from `<run>/tmp/aoforge-drafts/**` (the runner sets TMPDIR to the run's tmp). 81-13's dry run is where a layout mismatch will show.
- A draft path from `planning draft` lands under the real TMPDIR (the tool's contract), outside the scratch directory the tests use.

## User Setup Required

None. For the live run the private checklist must be at `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/fleet-checklists.json` in the checkout that runs batch C (sha256 86f909f5...); it is copied into this worktree and ignored.

## Next Objective Readiness
- 81-13 (rehearsal): run `node scripts/eval81/run.cjs --batch C --dry-run` to confirm the runner's layout against the assumptions above; `runs()` writes `<root>/cache/C/plan.json` on every call.
- 81-18 (live batch C): run the batch twice. The first invocation spends on 48 agent runs; the second lists the 48 graders (`C-grade-<id>`). Then `node scripts/eval81/score.cjs --batch C --root R --out <objective dir>`; read `R/spotcheck/C.md` (6 verdicts, model hidden, key at the end) and `R/spotcheck/C-paths.md` by hand. To drop the fleet runs at the checkpoint: `EVAL81_C_SKIP_FLEET=1` (recorded in the result notes, planned counts halve for mappers).
- Questions for the user at the batch-C checkpoint: project-researcher versus objective-researcher for the four dimensions (one line, `AGENTS` in C.cjs); the cap levels above; whether the literal path rule should get a negation carve-out before any run.

## Self-Check: PASSED

- FOUND: scripts/eval81/__fixtures__/c-outputs.cjs, scripts/eval81/batches/C.cjs, scripts/eval81/batches/C.test.cjs, scripts/eval81/score/C.cjs, scripts/eval81/score/C.test.cjs
- FOUND commits: adf4fc7f, d1d4230c, 2fc7cb42 (`git log --oneline 2d5d3f94..HEAD`)
- The private fleet checklist is untracked and ignored (`private/.gitignore:1:*`); no private statement text or source path in any changed file; no node_modules symlink was created; no live API call was made.

---
*Objective: 81-haiku-eval-and-model-efficiency-measurement*
*Completed: 2026-10-17*
