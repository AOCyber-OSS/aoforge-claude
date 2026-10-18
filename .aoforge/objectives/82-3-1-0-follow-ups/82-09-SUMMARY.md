---
objective: 82-3-1-0-follow-ups
trd: "09"
subsystem: testing
tags: [eval82, live, batch-e, build-cell, planner, executor, guessed-paths]

requires:
  - objective: 82-3-1-0-follow-ups (TRDs 82-02, 82-05, 82-06, 82-07, 82-08, 82-11)
    provides: "the FIX rows applied, batch E and its scorer, the mechanism and guessed-path rules, the raised ledger"
provides:
  - ".aoforge/objectives/82-3-1-0-follow-ups/results/E.json and E.md: two /aoforge:build runs on the fixed 3.1.0 tree"
  - ".aoforge/objectives/82-3-1-0-follow-ups/82-MEASUREMENT.md: per-role totals against 81's 3.0.0 and 3.1.0 build cells, Mechanism checks (SC-1: effect shown), Guessed runtime paths (SC-2: PASS), Reading"
affects: [82-10]

tech-stack:
  added: []
  patterns:
    - "Compare build runs by TRD count, not by run id: the planner picks the TRD count, so id pairs can mix workloads"

key-files:
  created:
    - .aoforge/objectives/82-3-1-0-follow-ups/results/E.json
    - .aoforge/objectives/82-3-1-0-follow-ups/results/E.md
    - .aoforge/objectives/82-3-1-0-follow-ups/82-MEASUREMENT.md
  modified: []

key-decisions:
  - "SC-1: effect shown. All nine FIX rows' mechanism checks pass in b82-r1 and b82-r2 (18 of 18) and both builds pass acceptance, tests and verification"
  - "SC-2: PASS. Both builds scanned (6 and 8 transcript files), zero guessed_home, tilde, real, guessed_nonexistent and tilde_denied; three of objective 81's four build runs had one guessed home path each"
  - "Attribution is reported by TRD-matched pairs (b82-r1 planned 1 TRD, b82-r2 2, the reverse of 81's id order) beside the id pairs the TRD named"
  - "Both sandbox roots (S1 from 82-08, S2) were deleted after E was scored; R is kept for 82-10"

patterns-established: []

requirements-completed: [SC-1, SC-2]

verification:
  gates_defined: 0
  gates_passed: 0
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: false

duration: 28min
completed: 2026-10-18
---

# Objective 82 TRD 09: Live build-cell re-run Summary

**Two `/aoforge:build` runs on the fixed 3.1.0 tree passed acceptance, tests and verification for $3.39 and $4.05
($7.44 in all; ledger $11.47 of $25). Every FIX row's mechanism check passed in both (SC-1: effect shown), no agent
guessed a home path (SC-2: PASS), and the planner and executor fell below objective 81's 3.1.0 build cell by 45-55%
and 23-45% in TRD-matched pairs, the planner back at 3.0.0's size.**

## Progress
- [x] Task 1: Confirm spend for batch E — ac242e6d
- [x] Task 2: Run batch E — d1686e17
- [x] Task 3: Score, mechanism checks, guessed-path check, publish 82-MEASUREMENT.md — 0afec582

## Performance

- **Duration:** about 28 min (11:49Z to 12:18Z); the two builds ran 11:50:35Z to 12:14:10Z (595 s and 818 s)
- **Tasks:** 3 of 3
- **Spend:** E $7.437203 of $15; ledger total $11.474932 of $25

## User gate decision (2026-10-18)

From the dispatch, before any spend: **"Go D, C, E at cap $25"**. The approval covers this gate. E runs the two
3.1.0 builds only (no 3.0.0 control). The caps were raised at 82-08's gate (global $25, E $15), so no second raise.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` (objective 82) | exit 0: OK, 25 files, 817bc181... |
| `prereg.cjs --check` (objective 81) | exit 0: OK, 86 files, 70f92eca... |
| token file | present (`test -s` only) |
| tree under test | HEAD e29fa16f04b089fc04b593436295ce4950ab3382 (82-07's FIX rows P-1, P-2, P-3, P-4, E-1, E-2, E-5, X-1; 82-02/82-11's E-4; 82-08's P1 and P4 reverts) |
| exported tree | `planner.md` carries P-1's "no template file to look up", `executor.md` E-5's "never Write the whole SUMMARY twice", `model-profiles.json` the P4 revert |
| Claude Code | 2.1.302, the same as both manifests |
| S2 | `/private/tmp/claude-501/e82-b36bc77c513b45df` (new opaque root; `trees.json` 3.1.0 = HEAD) |
| E dry run | exit 0: b82-r1, b82-r2; model opus, plugin 3.1.0, role workflow:build, cap $6.5, reserve $8.125 each, 90-min timeout, would_fit true; caps $13, worst case $16.25, estimate $9.4; every argv path under S2 |
| ledger | $4.037729 of $25 ($20.962271 left); D $1.279572 and C $2.758157 complete; E $0 of $15 |

### Build-2 fit on the actual D and C spend

| Case | D | C | build 1 | build-2 reserve | total vs cap | E batch |
|---|---:|---:|---:|---:|---|---|
| worst | 1.279572 | 2.758157 | 6.5 | 8.125 | 18.662729 of 25 (fits, 6.337271 spare) | 13 of 15 (fits) |
| expected | 1.279572 | 2.758157 | 4.72 | 8.125 | 16.882729 of 25 (fits, 8.117271 spare) | 11.22 of 15 (fits) |

Break-even build-1 cost: 8.5. **Build 2 guaranteed: yes.**

## Task 2: batch E live

`node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --batch-dir scripts/eval82/batches --results-dir
<O>/results --sandbox-root <S2> --repo <checkout> --raw` (no control), one invocation, exit 0, tripwire no diffs,
batch E `complete`, nothing pending.

| Run | Status | Reported | Transcript | Charged | Cap | Overshoot | Wall | TRDs / SUMMARYs | Acceptance | Tests | Verification | Transcripts | real / non-escape | Isolation |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---:|---|---|
| b82-r1 | ok | $3.389853 | $3.112273 | $3.389853 | $6.5 | 0 | 595 s | 1 / 1 | pass | ok | passed | 6 | 0 / 0 | sandbox project, no real entry |
| b82-r2 | ok | $4.047350 | $4.038930 | $4.047350 | $6.5 | 0 | 818 s | 2 / 2 | pass | ok | passed | 8 | 0 / 0 | sandbox project, no real entry |

- **Ledger:** E $7.437203 of $15; total **$11.474932 of $25**.
- **Denials inside the sandbox (b82-r2, 2, not escapes):** a Bash call running the notekit CLI against a
  `mktemp -d` scratch file, and a raw `git add ... && git commit` (with an attribution trailer) from the backstop
  verifier, refused by AOForge's `gate-commits` (its message is in the transcript). `escape_paths` and
  `denied_inside` are empty, `escape_attempt` false.

### Guessed-path scan (`guessed-paths.cjs --root <R> --batch E --raw`)

| Run | Files | Tool uses | tilde | guessed_home | real | guessed_nonexistent | tilde_denied |
|---|---:|---:|---:|---:|---:|---:|---:|
| b82-r1 | 6 | 122 | 0 | 0 | 0 | 0 | 0 |
| b82-r2 | 8 | 184 | 0 | 0 | 0 | 0 | 0 |

Baseline, the same scan over objective 81's recorded build runs (`--root <SP>/eval81 --batch E`): b30-r1 0, b30-r2 1
(`/Users/../private/tmp/.../b30-r2/home/.claude/aoforge/templates/summary.md`), b31-r1 1 (`<home>/.claude/aoforge/references/tdd.md`,
denied), b31-r2 1 (`/Users/<guess>/.claude/aoforge/references/tdd.md`); `tilde` 0 in all four.

## Task 3: score, mechanism checks, guessed paths (82-MEASUREMENT.md)

`node scripts/eval82/score.cjs --batch E --root <R> --out <O>` wrote results/E.json, E.md and 82-MEASUREMENT.md;
`## Mechanism checks` and `## Reading` were filled in a `planning draft` and published with `doc put`. The
mechanism checks come from `check-rules.cjs` (`fixListAsApplied` over 82-DIAGNOSIS.md, `attributionForRun`,
`mechanismChecks`, `guessedPathVerdict`) run by a scratch script (`<SP>/82-09/mech.cjs`, read-only).

### Mechanism checks (82-CHECK-RULES.md section 3)

| Row | b82-r1 | b82-r2 | Target |
|---|---|---|---|
| P-1 template hunt (planner) | 0, pass | 0, pass | 0 |
| P-2 commit inspect / amend (planner; executor) | 0; 0 and 0, pass | 0; 0 and 0, pass | planner 0; executor <= 3, <= 1 |
| P-3 largest TRD draft | 18,858 chars (1 TRD), pass | 14,464 and 14,165 (2 TRDs), pass | <= 22,000 per TRD |
| P-4 tooling-source reads (planner) | 0, pass | 0, pass | 0 |
| E-1 `templates/summary.md` reads (executor) | 0, pass | 0, pass | 0 |
| E-2 `references/tdd.md` reads (executor) | 0, pass | 0, pass | 0 |
| E-4 guessed runtime path (executor) | 0, pass | 0, pass | 0 |
| E-5 draft_write errors; writes per executor | 0; <= 2, pass | 0; <= 2, pass | 0; <= 2 |
| X-1 `validate_publish` errors (planner) | 0, pass | 0, pass | 0 |

P-5 and X-2 are JUSTIFY in `## Fix applied` and not checked. Outcomes: both runs acceptance true, tests_ok true,
verification passed. **SC-1 verdict: effect shown.**

### Guessed runtime paths (SC-2)

**PASS:** both runs scanned (b82-r1 6 files / 122 tool uses, b82-r2 8 / 184), tilde 0, guessed_home 0, real 0,
guessed_nonexistent 0, tilde_denied 0. Before (objective 81's recorded build runs, same scan): b30-r1 0, b30-r2 1,
b31-r1 1 (denied), b31-r2 1.

### Totals (n=2 vs n=2, no verdict)

| Role | Metric (median) | 3.0.0 (81) | 3.1.0 (81) | 3.1.0-82 |
|---|---|---:|---:|---:|
| planner | first-turn input | 29,726 | 27,238 | 27,925 |
| planner | total tokens | 1,321,277 | 2,205,630 | 1,096,338 |
| planner | cache writes | 70,669 | 104,473 | 81,514 |
| planner | cost | $1.1608 | $1.7838 | $0.9978 |
| planner | wall | 278 s | 425 s | 249 s |
| executor | first-turn input | 30,845 | 25,100 | 26,112 |
| executor | total tokens | 2,769,891 | 3,326,048 | 1,951,363 |
| executor | cache writes | 81,736 | 97,358 | 69,230 |
| executor | cost | $0.6920 | $0.8717 | $0.5434 |
| executor | wall | 165 s | 194 s | 133 s |
| build | cost per run | $4.90, $3.60 | $5.09, $4.35 | $3.39, $4.05 |

TRD-matched attribution (planner; executor): 2-TRD b31-r1 -> b82-r2 -54.8%; -44.7%; 1-TRD b31-r2 -> b82-r1 -45.1%;
-22.8%; against 3.0.0, 2-TRD b30-r1 -> b82-r2 -31.4%; -32.1%; 1-TRD b30-r2 -> b82-r1 +3.6%; -17.9%. 81 saw a
run-to-run spread of $1.41 to $2.06 on its own quick runs.

### Hand checks

- **Cost:** b82-r1's `cost_usd` in E.json (3.389852699999998) equals its record's.
- **Planner first-turn input:** the first deduped assistant usage in b82-r1's planner transcript
  (`agent-afb88dba373b61566.jsonl`) is 27,901 (input + cache creation + cache read), the attribution's
  `first_context`; with b82-r2's 27,949 the median is 27,925, E.json's planner median.
- **Guessed paths by hand:** `"file_path":"~` 0 and `"file_path":"/Users/` 0 over b82-r2's transcripts, the scan's
  counts; its runtime Reads name `<S2>/runs/E/b82-r2/home/.claude/aoforge/references/{goal-backward,tdd,trd-spec}.md`
  (planner reads; no executor read of tdd.md).
- **Spend:** results/E.json `spend.spent_usd` 7.437203 equals the ledger's E `spent_usd`.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Gate | both `prereg.cjs --check` (OK 25, OK 86); `test -s <T>`; S2 export of HEAD; E `--dry-run --materialize none`; `ledger82 --fit` (build 2 guaranteed) | 0 | PASS |
| 2: Batch E live | `run.cjs --batch E`: exit 0, 2 ok, E `complete`, total $11.474932 <= $25, tripwire no diffs, 0 `real`; `guessed-paths.cjs --batch E`: both runs scanned | 0 | PASS |
| 3: Score and checks | `score.cjs --batch E`; mechanism checks 18/18 pass, outcomes hold; `guessedPathVerdict` PASS; 82-MEASUREMENT.md has Mechanism checks, Guessed runtime paths, Reading; hand checks agree; commit 0afec582 | 0 | PASS |

## Validation Gate Results

None run here (measurement only; the TRD's gate is "none", 82-10 runs the full suite).

## Deviations from Plan

### Auto-fixed Issues

None.

### Other deviations

- **No second cap decision:** the user's dispatch approval ("Go D, C, E at cap $25") covered this gate and 82-08 had
  already raised the caps; `--fit` showed build 2 guaranteed, so no `--raise` here.
- **Attribution pairs:** the TRD names b31-r1 -> b82-r1 and b31-r2 -> b82-r2; the planner chose 1 TRD for b82-r1 and 2
  for b82-r2 (the reverse of 81), so 82-MEASUREMENT.md reports the TRD-matched pairs first and the id pairs beside
  them.
- **Mechanism-check runner:** `check-rules.cjs` has no CLI, so a read-only scratch script called its exports; nothing
  under `scripts/eval82` changed (prereg OK).
- **S1 deleted here** (not at the end of 82-08), per the dispatch's "only after E is scored", together with S2.

## Issues Encountered

- b82-r2 recorded two permission denials inside the sandbox (see Task 2), neither an escape: one refused by AOForge's
  `gate-commits` (a raw commit with an attribution trailer from the backstop verifier).

## Discovered commands

None. The commands come from the TRD.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 4/4 (gate shown with the fit table on actual D and C spend and the user's word; two builds on
  the fixed tree in an opaque sandbox, no real escape, both passing acceptance, tests and verification;
  82-MEASUREMENT.md compares per role with 81's 3.0.0 and 3.1.0 and fills Mechanism checks with every FIX row per run
  and the SC-1 verdict; SC-2 PASS from the transcript scan, with 81's runs scanned as the before column)
- Gate failures: None
- Not done here: nothing pushed, tagged or released; nothing written to the real `~/.claude`, the checkout during
  runs, or a fleet repo; `amp` untouched; no port opened.

## Self-Check: PASSED

- FOUND: results/E.json, results/E.md, 82-MEASUREMENT.md (`git ls-files`).
- FOUND commits: ac242e6d, d1686e17, 0afec582.
- FOUND: ledger E `complete`, total $11.474932; `/private/tmp/claude-501/e82-*` removed; R kept.
