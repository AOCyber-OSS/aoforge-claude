---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "17"
subsystem: testing
tags: [eval, live, batch-e, measurement, 76-08, post-hoc]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRD 81-16)
    provides: "batches A, B, D complete, ledger $4.559846"
provides:
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md: the 76-08 report, 3.0.0 vs 3.1.0 per role and per run, with the pilot cost check and a hand-written Reading"
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json and E.md (10/10 runs, spend block = ledger)"
  - "Post-hoc 3: opaque run paths (--sandbox-root, lib/opaque.cjs, sandbox.exportTrees), re-frozen manifest 8080f63b"
affects: [81-18, 81-19]

tech-stack:
  added: []
  patterns:
    - "Opaque sandbox root: what a run sees lives under /private/tmp/claude-501/e81-<hex>, records stay under R; every handed path is checked after realpath"

key-files:
  created:
    - scripts/eval81/lib/opaque.cjs
    - scripts/eval81/lib/opaque.test.cjs
    - scripts/eval81/lib/sandbox-opaque.test.cjs
    - scripts/eval81/run-opaque.test.cjs
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.md
  modified:
    - scripts/eval81/lib/runner.cjs
    - scripts/eval81/lib/sandbox.cjs
    - scripts/eval81/lib/tripwire.cjs
    - scripts/eval81/run.cjs
    - scripts/eval81/batches/C.cjs
    - scripts/eval81/batches/C.test.cjs
    - scripts/eval81/README.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json

key-decisions:
  - "The CLI's reported cost includes subagent spend (all four pilots); the ledger charged max(reported, transcript) on all ten runs"
  - "Post-hoc 3 (user: 'Opaque paths + continue'): E's last six runs and all of C run under an opaque --sandbox-root; the runner refuses any handed path naming the user or the checkout after realpath"
  - "b31-r2's Read of a guessed, non-existent /Users/aocyber path was not treated as a stop: it was not denied, named no real path and is what the opaque paths are meant to produce; reported to the user"

patterns-established:
  - "A frozen-file change after the first live run: test-first, prereg --write, 81-PREREG section 9 entry quoting the user, token scan, commit, prereg --check (third use)"

requirements-completed: []

verification:
  gates_defined: 4
  gates_passed: 4
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 120min
completed: 2026-10-17
---

# Objective 81 TRD 17: Live batch E (3.0.0 vs 3.1.0) Summary

**Batch E ran 10 of 10 runs, all passing their hidden acceptance, for $28.07 (ledger $32.63). 3.1.0 cuts the
first-turn prompt of the executor and verifier by about 19% and of the planner by about 9%. Whole-run cost moved
less: quick -10%, build +11% at the median, n 3 and 2. The CLI's reported cost includes subagent spend. The build
pilot found an executor reading the real home off the cwd, which led to post-hoc 3 (opaque run paths).**

## Progress
- [x] Task 1: Confirm spend for batch E — 6db987e4
- [x] Task 2: Quick pilot pair, then build pilot pair — 77da5312, 3998f900
- [x] Task 3: Review the pilots before the remaining 6 E runs — user decisions; post-hoc 3 in 0a680d94
- [x] Task 4: The remaining E runs, then score and publish the 76-08 measurement — 4073e6c7

## Performance

- **Duration:** about 2 h (19:22Z to 21:20Z), including the stop at the checkpoint.
- **Batch E wall time:**
  - quick pilots 19:23Z to 19:35Z;
  - build pilots 19:36Z to 20:10Z;
  - the other six 20:29Z to 21:14Z.
- **Spend:** batch E $28.068392 of its $55 cap; ledger $32.628238 of $100.

## User gate decisions (2026-10-17)

1. **"go E":** run the pilot pairs (quick, then build) and stop at Task 3's checkpoint. Session model opus.
2. **After the checkpoint, "Opaque paths + continue":** the post-hoc harness change below. Then **"Go E rest and C"**:
   the remaining six E runs, score, 81-MEASUREMENT.md and commit, then 81-18.

## Pilots and the cost check (R/pilot/E-cost.md)

| Run | Reported | Transcript | Main | Subagents | Charged | Cap | Overshoot | Verdict |
|---|---|---|---|---|---|---|---|---|
| q31-r1 | $1.7786 | $1.7786 | $0.4701 | $1.3085 | $1.7786 | $6 | $0 | includes subagents |
| q30-r1 | $2.0647 | $2.0647 | $0.4538 | $1.6108 | $2.0647 | $6 | $0 | includes subagents |
| b31-r1 | $5.0873 | $5.0828 | $0.6314 | $4.4514 | $5.0873 | $15 | $0 | includes subagents |
| b30-r1 | $4.8969 | $4.8489 | $0.6091 | $4.2398 | $4.8969 | $15 | $0 | includes subagents |

- **Verdict: the reported cost includes subagent spend.** The ledger charged `max(reported, transcript)` on all ten
  runs.
- **Pricing gap.** On the builds, reported exceeds transcript by at most 1.3%, which is under the 10% flag.
- **Untested:** whether `--max-budget-usd` bounds subagent spend. No run reached 35% of its cap.

## Finding: the b31-r1 escape attempt

- **What happened.** In b31-r1, the 3.1.0 TRD 01-01 executor (sonnet, spawn depth 2) tried to Read
  `/Users/justin/.claude/aoforge/references/tdd.md`.
  - The deny list refused it, and the runner recorded `escape_attempt: true`.
  - It then read the sandbox copy.
  - No other tool input in the four pilots named a real path, and the isolation proof and tripwire were clean.
- **Cause.** The cwd sat under the session scratchpad, whose name encodes the real home, and the agent resolved `~`
  from it.
- **Handling.** I started nothing after it. b30-r1 was already running and finished. I stopped at the checkpoint and
  reported.

## Post-hoc 3: opaque run paths (81-PREREG section 9.3, commit 0a680d94)

- **The user's words:** "Opaque paths + continue".
- **Test-first.** The new tests failed 9 of 31 (RED), then passed 40/40 (GREEN). The eval81 suite passed 495/495 and
  the repo guards 372/372.
- **`lib/opaque.cjs`:**
  - `forbiddenTokens` returns `['justin', 'aoforge-claude', 'Users-']` on this machine;
  - `opaqueViolations` checks every component of each path's realpath.
- **`--sandbox-root S`:**
  - home, config, tmp, work and settings.json live under `S/runs/<X>/<id>/`;
  - the trees are plain `git archive` copies in `S/trees/`;
  - records stay under R;
  - the runner refuses with exit 2, before any spawn, when a handed path names a token.
  - The isolation and tripwire roots cover S, and C's collect reads drafts from `ctx.tmp`.
- **The deny list is unchanged.**
- **S** = `/private/tmp/claude-501/e81-5752f4931a905580`. Its trees are identical to the pinned ones (`diff -rq` was
  empty).
- **Manifest:** 8080f63b..., 85 files.
- **Known gaps** (README):
  - the runner's own argv, visible to `ps`;
  - PATH, USER and LOGNAME in the child env;
  - the deny list in settings.json, which names the real home.
- **Content check of the materialised E sandboxes.** The only username mentions are settings.json's deny list and a
  comment in the plugin's `decline-tracker.cjs`.

## The remaining six runs (under S)

`run.cjs --batch E ... --sandbox-root S --raw` exited 0. All six were ok, with `tripwire.diffs` [] and batch E
`complete`.
- Every handed path was opaque, as recorded in each argv.json's `opaque.violations` [].
- The runner flagged no escape attempt.
- **One judgment call: b31-r2.** The same 3.1.0 TRD 01-01 executor tried `Read /Users/aocyber/.claude/aoforge/references/tdd.md`.
  - That is a guessed home that does not exist. The result was "File does not exist", it was not denied, and it named
    no real path. It then read the sandbox copy.
  - I did not treat it as an escape attempt. It is the behaviour opaque paths are meant to produce: the agent could
    not find the real home.
  - It is reported to the user.

## Batch E result (81-MEASUREMENT.md, results/E.json)

| Version / workflow | Runs ok | Acceptance | Reported cost median (mean) | Wall median |
|---|---|---|---|---|
| 3.0.0 quick | 3/3 | 3/3 | $1.7666 ($1.7465) | 370 s |
| 3.1.0 quick | 3/3 | 3/3 | $1.5924 ($1.6288) | 341 s |
| 3.0.0 build | 2/2 | 2/2, verification passed 2/2 | $4.2505 | 785 s |
| 3.1.0 build | 2/2 | 2/2, verification passed 2/2 | $4.7207 | 943 s |

- **First-turn input, 3.1.0 minus 3.0.0 (medians):**
  - executor -5,612 (quick) and -5,745 (build), -19%;
  - verifier -5,578 (-19%);
  - planner -2,631 and -2,488 (-9% and -8%);
  - orchestrator -885 and -1,409;
  - job-checker -1;
  - general-purpose -314.

  All three cuts exceed the 81-07 static estimates (executor -2,974, verifier -4,230, planner -1,598).
- **Build whole-run.**
  - 3.1.0's planner used 67% more tokens (+54% cost), and its executors 20% more.
  - Its verifier cost halved: 3.0.0 spawns an extra opus verifier from the orchestrator.
- **Quick whole-run.** 3.1.0's orchestrator used 52% more tokens, and its executor was cheaper.
- **Executor model.** 3.0.0's quick executor ran on opus once in three (q30-r1 had no model passed). 3.1.0 always
  passed sonnet.
- **Hand checks.**
  - q31-r2 (3.1.0): reported 1.5924 = record 1.5923637. The planner's first assistant message usage is 2 + 23,704 +
    3,013 = 26,719, equal to the 3.1.0 quick planner median.
  - b30-r2 (3.0.0): 3.6042 = 3.6041623. The planner's first turn is 29,661, and (29,791 + 29,661) / 2 = 29,726, the
    3.0.0 build planner cell.
  - Both match.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Gate | `prereg.cjs --check`, `test -s <T>`, `run.cjs --batch E ... --dry-run --materialize none --raw` | 0 | PASS |
| 2: Pilots | two `run.cjs --batch E ... --stop-after 2 --raw` runs; ledger has q31-r1, q30-r1, b31-r1, b30-r1 first, each charged max(reported, transcript); `R/pilot/E-cost.md` written | 0 | PASS |
| 3: Checkpoint | the user's decisions recorded; post-hoc 3 committed (0a680d94); `prereg --check` OK at 8080f63b | 0 | PASS |
| 4: Rest + measurement | `run.cjs --batch E ... --sandbox-root S --raw` (6 run, complete, tripwire []); `score.cjs --batch E`; E.json spend 28.068392 = ledger; commit scan empty; `git show --stat` = the three files (4073e6c7) | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81) | `TMPDIR=<scratch> node --test 'scripts/eval81/**/*.test.cjs'`: 495/495 | 0 | PASS |
| repo guards | `node --test 'plugins/aoforge/**/*.repo.test.cjs' 'scripts/**/*.repo.test.cjs' plugins/aoforge/hooks/planning-writes.audit.test.js`: 372/372 | 0 | PASS |
| prereg | `prereg.cjs --check`: OK, 8080f63b... (85 files) | 0 | PASS |
| commit scan | the token scan over every committed file: no output | 0 | PASS |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (post-hoc 3) | `node --test lib/opaque.test.cjs lib/sandbox-opaque.test.cjs run-opaque.test.cjs batches/C.test.cjs`: 9 fail of 31 | 1 | FAIL (correct) |
| GREEN (post-hoc 3) | same: 40/40 | 0 | PASS (correct) |

## Task Commits

1. **Task 1:** `6db987e4` (chore), the gate record.
2. **Task 2:** `77da5312` (quick pilots) and `3998f900` (build pilots, stopped at the checkpoint), plus `ee393766`
   and `4f3619dc` (the STATE blocker).
3. **Post-hoc 3:** `0a680d94` (fix), the harness, tests, README, PREREG 9.3, the re-frozen manifest and the TRD notes.
4. **Task 4:** `4073e6c7` (docs), `docs(81-17): 76-08 measurement, 3.0.0 vs 3.1.0`, exactly the three files.

## Deviations from Plan

### User-approved post-hoc deviation
**Post-hoc 3: opaque run paths** (0a680d94; 81-PREREG section 9.3). It was triggered by the b31-r1 escape attempt.
Six frozen files changed and one was added; nothing that scores an outcome changed. C's collect change only relocates
where the drafts are read from.

### Auto-fixed Issues
**1. [Rule 1 - Bug] A test-first test used os.tmpdir() as an opaque base**
- **Found during:** GREEN.
- **Issue:** os.tmpdir() is the scratchpad, which itself names the user.
- **Fix:** The test now uses an opaque base, EVAL81_OPAQUE_TMP or the real /tmp.

**2. [Rule 1 - Correction] The pilot claim that "3.0.0 spawns the quick executor with no model"**
- **Issue:** It held for q30-r1 only. q30-r2 and q30-r3 passed sonnet.
- **Fix:** Corrected in E.json's notes and in 81-MEASUREMENT.

**Total deviations:** 1 user-approved post-hoc, 2 auto-fixed.

## Findings for the user

1. **The opaque paths worked.** None of the six later runs could name the real home. One agent guessed
   `/Users/aocyber` (it does not exist) and moved on.
2. **A 3.1.0 behaviour to fix in the plugin.** In both 3.1.0 builds the TRD 01-01 executor reads
   `~/.claude/aoforge/...` at a guessed absolute home first, because the Read tool does not expand `~`. In production
   that guess can land on the wrong user. It never happened in 3.0.0.
3. **Cost.**
   - The reported cost includes subagents.
   - 3.1.0 is cheaper on quick and dearer on build in this small sample. The per-role prompts are clearly smaller,
     but the planner and executors do more work per build.
   - Outcomes are identical.
4. **Gaps left in post-hoc 3:**
   - PATH, USER and LOGNAME in the child env name the user;
   - the parent runner's argv is visible to `ps`;
   - the deny list text names the real home.

## Post-TRD Verification

- **Auto-fix cycles used:** 0.
- **Must-haves verified:** 6 of 6.
  1. Each go was recorded.
  2. The pilots ran first.
  3. The cost question is answered.
  4. The user was asked after the build pilot.
  5. 10 runs ran in order, with the tripwire clean.
  6. 81-MEASUREMENT has per-role and per-run tables with n and the static column.
- **Gate failures:** none.
- **Real home, fleet and checkout:**
  - none was written;
  - the checkout was not edited while a runner ran;
  - `amp` was untouched;
  - nothing was pushed.

## Next Objective Readiness (81-18)

Ledger $32.628238, with $67.37 left for C (estimate about $28). Batch E is complete. C runs with
`--sandbox-root /private/tmp/claude-501/e81-5752f4931a905580`, and `e81-*` is deleted after C.

## Self-Check: PASSED

- **Files.** 81-MEASUREMENT.md, results/E.json and results/E.md are committed in 4073e6c7. lib/opaque.cjs and the
  three new test files are committed in 0a680d94.
- **Commits found:** 6db987e4, 77da5312, 3998f900, ee393766, 4f3619dc, 0a680d94, 4073e6c7.
- **Ledger.** `R/ledger.json` batch E is `complete` at $28.068392, with the four pilots first among its 10 entries.
- **Manifest.** `prereg.cjs --check` exits 0 at HEAD (8080f63b...).
