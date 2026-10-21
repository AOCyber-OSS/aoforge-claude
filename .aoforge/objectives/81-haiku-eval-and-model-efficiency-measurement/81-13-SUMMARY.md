---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "13"
subsystem: testing
tags: [eval, rehearsal, dry-run, preregistration, manifest, sha256, ledger, projection]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRDs 81-01..81-12)
    provides: "runner (run.cjs, sandbox.ensureTrees, ledger, caps), batch modules A-E, scorers A-E, score.cjs and both report renderers, fixtures with answer keys and proofs, the fake claude"
provides:
  - "scripts/eval81/prereg.cjs: --write (sha256 manifest of the frozen files plus hash-only extras, run context and the exact argv) and --check (exit 1 naming each changed, added or missing file)"
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json: 84 files (82 repo, 2 extras), sha256 438d80f98fd7e3bffecedd2930fb7e14934c208e4143b68363e512082af970c1"
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md: the pre-registration record (frozen set, pins, dry run, projection with INSUFFICIENT risk and options, rehearsal, known limitations, Regenerate command, empty Pre-run amendments)"
  - "Eval root R: plugin trees 3.0.0 (b4a9d870) and 3.1.0 (99950509) as detached worktrees, trees.json, ledger.json at $0 with every batch pending, dry-run records, projection.json and projection-manifest.json"
affects: [81-14, 81-15, 81-16, 81-17, 81-18, 81-19]

tech-stack:
  added: []
  patterns:
    - "Pre-registration by hash: include/exclude/keep globs plus hash-only extras, recorded in the manifest so --check re-walks the same set"
    - "Projection by replaying the planned order through the real ledger rules (canStart, recordRun) under cost scenarios"

key-files:
  created:
    - scripts/eval81/prereg.cjs
    - scripts/eval81/prereg.test.cjs
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json
  modified: []

key-decisions:
  - "The frozen set adds results/static-prompt.json (81-07) to the TRD's includes, because E's scorer falls back to it"
  - "The private fleet checklist and the real calibration.json enter the manifest as sha256 only; the private hash equals fleet-commitment.json (86f909f5...)"
  - "trees in the manifest keep {ref, sha} per version; the scratch worktree paths are dropped"
  - "Caps were not amended: with the real calibration A and B complete only up to 1.17x and 1.10x of their estimates, and at production-median verifier/checker costs plus the headless base prompt both stop at 18 of 36 runs (INSUFFICIENT); options are in 81-PREREG.md section 5 for the user's batch-A checkpoint"

patterns-established:
  - "Every live TRD starts with `node scripts/eval81/prereg.cjs --check --manifest <O>/results/prereg-manifest.json` from the repo root with the real HOME"

requirements-completed: [SC-1, SC-2]

verification:
  gates_defined: 2
  gates_passed: 2
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 22min
completed: 2026-10-17
tokens_input: 38967281
tokens_output: 148277
tokens_cache_read: 38590794
tokens_cache_write: 376173
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 13: Rehearsal and pre-registration freeze Summary

**The objective-81 pipeline is now proven end to end at zero cost, and frozen by a committed sha256 manifest.**

- The two plugin trees are pinned, and the $100 ledger is initialised at $0.
- All five batches dry-run with zero API calls. Each batch's first run was materialised and checked.
- A fake-claude rehearsal drove every batch through runner, collect, score and both reports. That includes C's
  graders, a ledger rebuild that matches, and a clean secret scan.
- `prereg.cjs` freezes 84 files: harness, batch modules, scorers, fixtures and answer keys, the five proofs, the
  decision rule, and the private checklist and calibration by hash. Every live TRD checks it first.

## Progress
- [x] Task 1: Trees, ledger and dry run of every batch — 3da9790a
- [x] Task 2: Fake-claude end-to-end rehearsal — fe56ba4a
- [x] Task 3: Pre-registration manifest, record and full suite — 05f93927

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-17T17:35:15Z
- **Completed:** 2026-10-17T17:57:00Z
- **Tasks:** 3
- **Files created:** 4 in the repo. Eval-root files sit under R, R2 and R3 in the session scratchpad.

## Accomplishments

**Trees (Task 1).**
- `git diff --stat 10f9365f HEAD -- plugins/` was empty.
- `sandbox.ensureTrees` created `R/trees/v3.0.0` (v3.0.0, b4a9d87030fbbdfe707514cedbd06601598e4041) and
  `R/trees/v3.1.0` (99950509d10a9905ff2d845e09df9d6b2e55e455). Both are detached, the `plugin.json` versions were
  checked, and both show in `git worktree list`.

**Dry runs (Task 1).** A, B, D, E and C each exit 0, with 36, 36, 24, 10 and 48 planned runs. The 48 C graders are
listed on C's second invocation. The dry run only stats the token file (checked in `runner.cjs` `dryRun`). The ledger
total is $0, and every batch is pending.

**Materialised first runs (Task 1).**
- A, B, C and E have the sandbox `.plugin-version` 3.1.0.
- E dry-run with `--materialize all`: its six 3.1.0 runs mirror 3.1.0, its four 3.0.0 runs mirror 3.0.0, and the
  fixture HEAD is `345a708e` everywhere. The fixture's own tests pass 6/6.
- D's cwd equals `workDirFor` and the five `Screenshot file:` paths in its prompt. The prompt follows `--`.
- C's first fleet run was prepared through `C.materialize`: no legacy planning dir, no `.claude/`, a clean status
  and no remote. The fleet source's HEAD and porcelain were unchanged.

**claude version (Task 1).** `claude --version` = 2.1.302 (Claude Code), with no API call.

**Rehearsal (Task 2).**
- Every batch ran ok and exited 0, with 0 tripwire diffs and 0 escape attempts:

  | Batch | Runs | Spent |
  |---|---|---|
  | A | 36/36 | $4.42296 |
  | B | 36/36 | $4.05 |
  | D | 24/24 | $1.02768 |
  | E | 10/10 | $19.20 (charged at the transcript sum) |
  | C | 48/48 agents + 3 seeded graders | $7.60 |

- Scoring of all five batches and `--report` succeeded. Each results JSON has a spend block, and both
  `81-HAIKU-EVAL.md` and `81-MEASUREMENT.md` render.
- R3's rebuilt ledger equals R2's: $36.30064, per-batch spent and status, 157 entries.
- `--init-ledger` against R2's results is refused (exit 2).
- The secret scan hits only `dummy-token`.

**Freeze (Task 3).** `prereg.cjs` was written test-first (12 tests), and the manifest committed in 05f93927.
`prereg --check` exits 0 before and after the commit.

## Dry-run projection per batch (calibration read-only; caps include the base-prompt allowance)

| Batch | Runs | Sum of caps | Sum of reserves | Base-prompt share | Estimate | Batch cap | Last sonnet / build start at batch spend <= | Completes at <= x estimate | Both models 2/3 at <= x estimate |
|---|---|---|---|---|---|---|---|---|---|
| A | 36 | $44.23 | $55.29 | $4.55 | $5 | $7.50 | $5.50 | 1.17 | 1.80 |
| B | 36 | $40.50 | $50.63 | $4.55 | $4 | $6 | $4.17 | 1.10 | 1.71 |
| D | 24 | $10.28 | $12.85 | $1.28 | $2 | $3 | $2.40 | 1.31 | 2.06 |
| E | 10 | $96.00 | $120.00 | $6.12 | $44 | $55 | build $40 | 1.08 (`b31-r2` first lost) | n/a |
| C | 48 + 48 graders | $103.04 | $128.80 | $10.91 | $28 | none | n/a | 1.59 (A-E at estimates); 1.00 if A-E reach their batch caps | same |
| Total | 202 | $294.04 | $367.55 | $27.41 | **$83 of $100** | | | | |

The projection replays the planned order through `ledger.cjs` under four cost scenarios:

| Scenario | Outcome | Total |
|---|---|---|
| At the estimates | everything completes | $83.00 |
| x1.5 | A, B, D and E stop early but keep 2/3. C runs out of global room after 45 of 48 graders: 3 researcher role-models INSUFFICIENT | $99.46 |
| Production p50 (verifier $0.31, job-checker $0.21 sonnet) | A stops at 29 and B at 33, both still 2/3 | $83.91 |
| p50 plus the headless base prompt | **A and B stop at 18 of 36 each: INSUFFICIENT, and the A gate is not established.** D 21/24 (2/3 ok), E 9/10 | $87.25 |

81-PREREG.md section 5 lists five options for the user's batch-A checkpoint. Option 1, the `--stop-after 4` pilot,
needs no change to any frozen file. Nothing was amended here.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Trees, ledger, dry runs | `run.cjs --batch {A,B,D,E,C} --root R --token-file T --dry-run --materialize first --raw` (`--init-ledger` on A); `R/ledger.json` total 0, all pending; `git worktree list` shows `R/trees/v3.0.0` b4a9d870 and `R/trees/v3.1.0` 99950509 | 0 (x5, plus E `--materialize all`) | PASS |
| 2: Rehearsal | `run.cjs --batch X --root R2 --token-file R2/dummy-token --claude-bin scripts/eval81/__fixtures__/fake-claude.cjs --results-dir R2/out/results --raw` for A, B, D, E, C (x3); `score.cjs --batch X` x5 and `--report`; `--rebuild-ledger --root R3` totals equal; `--init-ledger` refused | 0 (refusal 2, as expected) | PASS |
| 3: Manifest, record, suite | `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` after the commit: `prereg check: OK, 84 files match the manifest (sha256 438d80f9...)` | 0 | PASS |

## Task Commits

1. **Task 1: Trees, ledger and dry run of every batch** - `3da9790a` (chore; the SUMMARY checkpoint only, since the
   task writes no repo files)
2. **Task 2: Fake-claude end-to-end rehearsal** - `fe56ba4a` (chore; the SUMMARY checkpoint only)
3. **Task 3: Pre-registration manifest, record and full suite** - `05f93927`
   (`test(81-13): freeze objective 81 pre-registration manifest`). It carries exactly the TRD's four files and is
   the commit that holds the prereg manifest.

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81, glob form) | `node --test 'scripts/eval81/**/*.test.cjs'`: 463 tests, 463 pass, 0 skipped (the private checklist is present) | 0 | PASS |
| test (full suite) | npm test globs over tracked and untracked-not-ignored files minus `watcher-shell.test.cjs`: 449 files, 13,511 tests, 13,484 pass, 0 fail, 27 skipped, 0 cancelled (HOME and TMPDIR in the scratchpad) | 0 | PASS |
| repo guards (after the commit) | `node --test 'plugins/aoforge/**/*.repo.test.cjs' 'scripts/**/*.repo.test.cjs' plugins/aoforge/hooks/planning-writes.audit.test.js`: 372/372 | 0 | PASS |

The first full-suite attempt failed 4,199 tests because the scratch TMPDIR had not been created yet. The re-run with
the directory present is the result above.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test scripts/eval81/prereg.test.cjs` before prereg.cjs existed (MODULE_NOT_FOUND) | 1 | FAIL (correct) |
| GREEN | same, 12/12 | 0 | PASS (correct) |

No REFACTOR phase was needed.

## Discovered commands

None. Every command came from the TRD, the README or the package.json test globs.

## Decisions Made

- **The default includes freeze `results/static-prompt.json`** besides `scripts/eval81/**` and the decision rule.
  E's scorer falls back to it, so it shapes a reported number.
- **The extras record what they are, not what they hold.**
  - An extra is recorded by its repo-relative path, else `~/...` under the home, else its absolute path.
  - `--calibration` is an extra whose hash also fills `calibration_sha256`.
  - `--trees` keeps `{ref, sha}` per version.
  - `--projection` embeds the compact projection verbatim, so a lost eval root can extract it back (81-PREREG.md
    section 8).
- **Walks skip `.git` and `.DS_Store`.** A symlink hashes as its link text.
- **The projection uses the real calibration.** The runner reads it at the same path. Its verifier and job-checker
  p90s equal `caps.cjs` FALLBACK_P90, and the other roles fall back, so the caps match the `calibration: null` figures
  of 81-09..81-12.
- **The freeze commit holds only the TRD's four files.** The SUMMARY and state go in the final docs commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `results/static-prompt.json` added to the frozen set**
- **Found during:** Task 3
- **Issue:** The TRD's include list (`scripts/eval81/**` minus tests and the fake, the proofs, the decision rule) left
  out the committed 81-07 results file. `score/E.cjs` falls back to it for the static resident-prompt bytes.
- **Fix:** It is in `DEFAULT_INCLUDES`, and the manifest records the includes.
- **Files modified:** scripts/eval81/prereg.cjs
- **Commit:** 05f93927

**2. [Rule 3 - Blocking] C graders seeded in the rehearsal**
- **Found during:** Task 2
- **Issue:** The fake claude writes no mapper or researcher document. So C's second invocation lists no grader, and
  the grader path (`--tools ""`, `--json-schema`, no plugin, complete -> running -> complete) would go unexercised.
- **Fix:** A scratch script seeded a stand-in document into three rehearsal records (synthetic mapper, fleet mapper,
  researcher) in R2 only. The third invocation then ran three graders. No code changed.
- **Files modified:** none in the repo

**3. [Rule 3 - Blocking] Both trees' runtime mirrors checked in R**
- **Found during:** Task 1
- **Issue:** Every batch's first run uses the 3.1.0 tree, so `--materialize first` never mirrors 3.0.0. C's first run
  is synthetic, so the fleet copy was never prepared.
- **Fix:**
  - E got a second dry run with `--materialize all`. The runner moved the first dry run's E dirs to `.prev-1`, as
    designed.
  - C's first fleet run (`C-map-tech-b-h-1`) was materialised through `C.materialize` into a scratch work dir. That
    prepared `R/cache/C/fleet-prepared` by the module's own read-only clone.
- **Files modified:** none in the repo

**4. [Rule 3 - Blocking] Node 24 gate form**
- `node --test scripts/eval81/` loads the directory as a module on Node 24.13.1, so the gate ran as
  `node --test 'scripts/eval81/**/*.test.cjs'`.
- 81-PREREG.md records the glob form for later TRDs, including 81-14 Task 1's amendment step 2.

**5. [Process] Task 1 and Task 2 commits carry only the SUMMARY checkpoint**
- Those tasks write only to the eval roots, and the executor contract commits each task.

---

**Total deviations:** 5 (1 missing critical, 3 blocking, 1 process)
**Impact on plan:** Additive. Every TRD name, flag, path, commit message and file list is as written.

## Findings for the user (recorded in 81-PREREG.md, nothing changed)

1. **Cap sizing.**
   - A and B reserve whole sonnet caps against small batch caps. A sonnet run can start only while A's spend is at
     most $5.50, and B's at most $4.17.
   - At the production-median spawn cost plus the headless base prompt, both batches stop at 18 of 36 runs.
     Haiku and sonnet then each have 9 of 18, which is INSUFFICIENT, and a failed A gate turns every would-be
     endorsement INSUFFICIENT.
   - E loses `b31-r2` above about $6.9 per build.
   - C has no batch cap. It completes only up to 1.00x its estimate if A to E reach their batch caps.
   - Options are in 81-PREREG.md section 5: a pilot with `--stop-after 4`, raising the batch caps, lowering the sonnet
     caps, reserving an expected cost, or deciding at exit 3.
2. **Answer-key material inside R.**
   - `R/fleet/fleet-checklists.json` is a byte-identical copy of the private checklist (81-06's scratch backup).
   - `R/cache/C/fleet-src` keeps the fleet's legacy planning directory.
   - `R/trees/v3.1.0` contains `scripts/eval81/fixtures`.
   - R is not a deny root, and Bash is not path-scoped. Recommended before batch C: move `R/fleet` and `R/d-capture`
     out of R.
3. **Blinding.**
   - The run id is in every session's cwd (A: `A-A5-haiku-r1`; C: role, focus, codebase and model letters).
   - A D session sees each broken state beside its ok baseline.
4. **81-08's first-live-run risks.** The prompt after `--` and the `--agent` tools check are both unobserved live. A
   token persisted under the sandbox HOME means exit 6 after one run.
5. **C questions.** Project-researcher or objective-researcher? The cap levels? A negation carve-out for the literal
   path rule? Also, researcher roles need 2 of 2.
6. **The tripwire compares this checkout's status after every run.** Do not edit or commit in the main checkout while
   a batch runs.

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 5/5 truths, 2/2 artifacts, 1/1 key link (`prereg-manifest.json` written by `prereg.cjs`
  with a sha256 per frozen file).
- **Gate failures:** None. The first full-suite attempt failed only because TMPDIR was missing, and that is fixed.
- **Real `claude` binary:** never spawned. Every live-mode runner call named the fake. `claude --version` was the only
  real invocation.
- **Real token file:** only `test -s` and the dry run's stat.
- **Real home and fleet:** no real `~/.claude/projects` entry exists for R or R2. Nothing was written to the real
  `~/.claude` or any `~/dev` fleet repo. The fleet source's HEAD and porcelain were unchanged.
- **Leaks:** no token-like string, private fleet name or legacy name is in the committed files. The private checklist
  appears only as its sha256.
- **Untouched:** the untracked `amp` file was not staged. Nothing was pushed, tagged or released. No port was opened.

## Next Objective Readiness (81-14 gate)

From the repo root with the real HOME, run each of these as a plain command:

1. `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` must exit 0.
2. `test -s /private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval-auth/oauth-token`
3. `node scripts/eval81/run.cjs --batch A --root /private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81 --token-file /private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval-auth/oauth-token --dry-run --materialize none --raw`

Then the user's "go A", an amendment, or "stop". State at handoff:

- ledger $0.00, every batch `pending`;
- trees pinned;
- dry-run dirs in `R/runs/<X>/`, which the runner moves aside before a live attempt.

## Self-Check: PASSED

- FOUND: scripts/eval81/prereg.cjs, scripts/eval81/prereg.test.cjs, 81-PREREG.md and results/prereg-manifest.json
  (`git ls-files --error-unmatch`).
- FOUND commits: 3da9790a, fe56ba4a, 05f93927.
- FOUND: R/trees.json (both SHAs), R/ledger.json (total 0, all pending), R/projection.json and
  R/projection-manifest.json.
- FOUND: R2/out/81-HAIKU-EVAL.md and R2/out/81-MEASUREMENT.md, with spend blocks in R2/out/results/{A,B,C,D,E}.json.
- FOUND: R3/ledger.json, total equal to R2's.
- `prereg.cjs --check` exits 0 at HEAD.
