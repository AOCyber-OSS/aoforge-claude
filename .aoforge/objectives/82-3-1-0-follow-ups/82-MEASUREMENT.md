# Objective 82: build-cell re-measurement (3.1.0)

Generated 2026-10-18T12:15:22.455Z by scripts/eval82/score.cjs --batch E.

## Method

Objective 81's build cell (`/aoforge:build` on the notekit fixture, balanced profile) re-run on the 3.1.0 tree through objective 81's frozen runner with scripts/eval82/batches/E.cjs: the same descriptors as 81's b31-r1 and b31-r2 but for id, order and a $6.5 cap (a test proves the rest identical). Columns 3.0.0 and 3.1.0 are objective 81's recorded build cells (.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json); 3.1.0-82 is this objective's runs. Per-role figures are per spawn from the copied transcripts (objective 81's lib/roles.cjs); deltas are new minus each recorded column.

## Outcomes

| Run | Column | Status | Acceptance | Tests | Verification | TRDs | Summaries | Cost (reported) | Charged |
|---|---|---|---|---|---|---:|---:|---:|---:|
| b31-r1 | 3.1.0 (81) | ok | yes | yes | passed | 2 | 2 | 5.0873 | 5.0873 |
| b30-r1 | 3.0.0 (81) | ok | yes | yes | passed | 2 | 2 | 4.8969 | 4.8969 |
| b30-r2 | 3.0.0 (81) | ok | yes | yes | passed | 1 | 1 | 3.6042 | 3.6042 |
| b31-r2 | 3.1.0 (81) | ok | yes | yes | passed | 1 | 1 | 4.3540 | 4.3540 |
| b82-r1 | 3.1.0-82 | ok | yes | yes | passed | 1 | 1 | 3.3899 | 3.3899 |
| b82-r2 | 3.1.0-82 | ok | yes | yes | passed | 2 | 2 | 4.0474 | 4.0473 |

## Per role

Medians:

| Role | Metric | 3.0.0 median | 3.1.0 median | 3.1.0-82 median | new - 3.0.0 | new - 3.1.0 |
|---|---|---:|---:|---:|---:|---:|
| orchestrator | first-turn input | 39,188 | 37,779 | 37,666 | -1,521 (-3.88%) | -112 (-0.30%) |
| orchestrator | total tokens | 664,325 | 599,408 | 647,050 | -17,274 (-2.60%) | +47,642 (+7.95%) |
| orchestrator | cache writes | 48,894 | 47,799 | 45,754 | -3,140 (-6.42%) | -2,044 (-4.28%) |
| orchestrator | cost (USD) | 0.6339 | 0.6181 | 0.6168 | -0.0170 (-2.69%) | -0.0013 (-0.21%) |
| orchestrator | wall (s) | 784 | 942 | 706 | -78 (-9.95%) | -236 (-25.04%) |
| planner | first-turn input | 29,726 | 27,238 | 27,925 | -1,801 (-6.06%) | +688 (+2.52%) |
| planner | total tokens | 1,321,277 | 2,205,630 | 1,096,338 | -224,939 (-17.02%) | -1,109,292 (-50.29%) |
| planner | cache writes | 70,669 | 104,473 | 81,514 | +10,845 (+15.35%) | -22,958 (-21.98%) |
| planner | cost (USD) | 1.1608 | 1.7838 | 0.9978 | -0.1630 (-14.04%) | -0.7860 (-44.06%) |
| planner | wall (s) | 278 | 425 | 249 | -29 (-10.35%) | -176 (-41.38%) |
| job-checker | first-turn input | 14,502 | 14,501 | 14,670 | +168 (+1.16%) | +170 (+1.17%) |
| job-checker | total tokens | 66,857 | 70,801 | 53,761 | -13,096 (-19.59%) | -17,040 (-24.07%) |
| job-checker | cache writes | 22,315 | 30,590 | 26,201 | +3,886 (+17.41%) | -4,388 (-14.35%) |
| job-checker | cost (USD) | 0.0736 | 0.0967 | 0.0826 | +0.0090 (+12.24%) | -0.0141 (-14.59%) |
| job-checker | wall (s) | 11 | 13 | 11 | 0 (-4.12%) | -3 (-20.12%) |
| executor | first-turn input | 30,845 | 25,100 | 26,112 | -4,733 (-15.34%) | +1,012 (+4.03%) |
| executor | total tokens | 2,769,891 | 3,326,048 | 1,951,363 | -818,528 (-29.55%) | -1,374,685 (-41.33%) |
| executor | cache writes | 81,736 | 97,358 | 69,230 | -12,506 (-15.30%) | -28,128 (-28.89%) |
| executor | cost (USD) | 0.6920 | 0.8717 | 0.5434 | -0.1485 (-21.46%) | -0.3283 (-37.66%) |
| executor | wall (s) | 165 | 194 | 133 | -32 (-19.31%) | -61 (-31.21%) |
| verifier | first-turn input | 28,770 | 23,191 | 23,424 | -5,345 (-18.58%) | +233 (+1.00%) |
| verifier | total tokens | 239,812 | 174,188 | 173,918 | -65,893 (-27.48%) | -270 (-0.16%) |
| verifier | cache writes | 40,740 | 31,447 | 31,276 | -9,463 (-23.23%) | -171 (-0.54%) |
| verifier | cost (USD) | 0.2243 | 0.1128 | 0.1165 | -0.1078 (-48.07%) | +0.0037 (+3.30%) |
| verifier | wall (s) | 34 | 19 | 22 | -12 (-34.85%) | +3 (+15.77%) |
| general-purpose | first-turn input | 15,393 | 15,079 | 15,004 | -389 (-2.53%) | -75 (-0.50%) |
| general-purpose | total tokens | 1,317,721 | 1,256,163 | 1,402,480 | +84,759 (+6.43%) | +146,317 (+11.65%) |
| general-purpose | cache writes | 84,815 | 87,255 | 80,989 | -3,825 (-4.51%) | -6,266 (-7.18%) |
| general-purpose | cost (USD) | 0.8382 | 0.8720 | 0.8865 | +0.0483 (+5.76%) | +0.0145 (+1.66%) |
| general-purpose | wall (s) | 382 | 428 | 355 | -27 (-6.98%) | -73 (-17.06%) |

Means:

| Role | Metric | 3.0.0 mean | 3.1.0 mean | 3.1.0-82 mean | new - 3.0.0 | new - 3.1.0 |
|---|---|---:|---:|---:|---:|---:|
| orchestrator | first-turn input | 39,188 | 37,779 | 37,666 | -1,521 | -112 |
| orchestrator | total tokens | 664,325 | 599,408 | 647,050 | -17,274 | +47,642 |
| orchestrator | cache writes | 48,894 | 47,799 | 45,754 | -3,140 | -2,044 |
| orchestrator | cost (USD) | 0.6339 | 0.6181 | 0.6168 | -0.0170 | -0.0013 |
| orchestrator | wall (s) | 784 | 942 | 706 | -78 | -236 |
| planner | first-turn input | 29,726 | 27,238 | 27,925 | -1,801 | +688 |
| planner | total tokens | 1,321,277 | 2,205,630 | 1,096,338 | -224,939 | -1,109,292 |
| planner | cache writes | 70,669 | 104,473 | 81,514 | +10,845 | -22,958 |
| planner | cost (USD) | 1.1608 | 1.7838 | 0.9978 | -0.1630 | -0.7860 |
| planner | wall (s) | 278 | 425 | 249 | -29 | -176 |
| job-checker | first-turn input | 14,502 | 14,501 | 14,670 | +168 | +170 |
| job-checker | total tokens | 66,857 | 70,801 | 53,761 | -13,096 | -17,040 |
| job-checker | cache writes | 22,315 | 30,590 | 26,201 | +3,886 | -4,388 |
| job-checker | cost (USD) | 0.0736 | 0.0967 | 0.0826 | +0.0090 | -0.0141 |
| job-checker | wall (s) | 11 | 13 | 11 | 0 | -3 |
| executor | first-turn input | 30,793 | 25,067 | 26,117 | -4,676 | +1,050 |
| executor | total tokens | 2,801,590 | 3,268,868 | 2,049,822 | -751,768 | -1,219,047 |
| executor | cache writes | 74,837 | 92,459 | 64,979 | -9,858 | -27,480 |
| executor | cost (USD) | 0.6746 | 0.8029 | 0.5519 | -0.1227 | -0.2510 |
| executor | wall (s) | 161 | 190 | 140 | -21 | -50 |
| verifier | first-turn input | 28,793 | 23,217 | 23,406 | -5,387 | +189 |
| verifier | total tokens | 258,362 | 156,570 | 189,273 | -69,089 | +32,703 |
| verifier | cache writes | 40,940 | 24,518 | 25,436 | -15,505 | +917 |
| verifier | cost (USD) | 0.2447 | 0.0945 | 0.1094 | -0.1353 | +0.0149 |
| verifier | wall (s) | 34 | 17 | 23 | -11 | +5 |
| general-purpose | first-turn input | 15,393 | 15,079 | 15,004 | -389 | -75 |
| general-purpose | total tokens | 1,317,721 | 1,256,163 | 1,402,480 | +84,759 | +146,317 |
| general-purpose | cache writes | 84,815 | 87,255 | 80,989 | -3,825 | -6,266 |
| general-purpose | cost (USD) | 0.8382 | 0.8720 | 0.8865 | +0.0483 | +0.0145 |
| general-purpose | wall (s) | 382 | 428 | 355 | -27 | -73 |

## Per run

| Run | Column | First-turn input | Total tokens | Cache writes | Priced cost | Wall (s) | Spawns | Claude Code |
|---|---|---:|---:|---:|---:|---:|---|---|
| b82-r1 | 3.1.0-82 | 37,666 | 5,753,343 | 340,943 | 3.1123 | 595 | orchestrator 1, planner 1, job-checker 1, executor 1, verifier 1, general-purpose 1 | 2.1.302 |
| b82-r2 | 3.1.0-82 | 37,666 | 7,363,198 | 399,217 | 4.0389 | 818 | orchestrator 1, planner 1, job-checker 1, executor 2, verifier 2, general-purpose 1 | 2.1.302 |

## Guessed runtime paths

Guessed runtime paths: none (every run scanned; tilde, guessed_home, real, guessed_nonexistent and tilde_denied all 0).

`guessed_home` is the defect signal: an absolute path under the home's parent the agent built itself instead of using `~` or a path it was handed. `tilde` counts `~` inputs for the record; the Read tool expands `~`, so a `~` Read is not a failure. The recorded columns are the runner's `record.access` classes, which miss an allowed `~` Read by design; the scan columns come from the transcripts.

| Run | Scan | tilde | guessed_home | real (recorded) | guessed_nonexistent (recorded) | tilde_denied (recorded) |
|---|---|---:|---:|---:|---:|---:|
| b82-r1 | scanned | 0 | 0 | 0 | 0 | 0 |
| b82-r2 | scanned | 0 | 0 | 0 | 0 | 0 |

## Mechanism checks

Filled by TRD 82-09 with `scripts/eval82/check-rules.cjs`: `fixListAsApplied(82-DIAGNOSIS.md)` gives the FIX rows as
applied (P-1, P-2, P-3, P-4, E-1, E-2, E-4, E-5, X-1; P-5 and X-2 are JUSTIFY in `## Fix applied` and are not
checked), `attributionForRun` gives each new run's planner and executor spawns with their call lists (b82-r1: 1
planner, 1 executor; b82-r2: 1 planner, 2 executors), and `mechanismChecks` applies 82-CHECK-RULES.md section 3.

| Row | Run | Category | Count | Target | Result |
|---|---|---|---|---|---|
| P-1 | b82-r1 | template look-ups and `templates/trd-prompt.md` reads on planner spawns | 0 | 0 | pass |
| P-1 | b82-r2 | same | 0 | 0 | pass |
| P-2 | b82-r1 | planner `commit_inspect` / `raw_commit` / commit `tool_investigation`; executor `commit_inspect`, commit `tool_investigation` | planner 0; executor 0 and 0 | planner 0; executor <= 3 and <= 1 | pass |
| P-2 | b82-r2 | same | planner 0; executor 0 and 0 | same | pass |
| P-3 | b82-r1 | largest `draft_write` per TRD | 01-01-TRD.md 18,858 chars (1 TRD) | <= 22,000 per TRD | pass |
| P-3 | b82-r2 | same | 01-01-TRD.md 14,464, 01-02-TRD.md 14,165 (2 TRDs) | <= 22,000 per TRD | pass |
| P-4 | b82-r1 | non-commit `tool_investigation` on planner spawns | 0 | 0 | pass |
| P-4 | b82-r2 | same | 0 | 0 | pass |
| E-1 | b82-r1 | `runtime_read:templates/summary.md` on executor spawns | 0 | 0 | pass |
| E-1 | b82-r2 | same | 0 | 0 | pass |
| E-2 | b82-r1 | `runtime_read:references/tdd.md` on executor spawns | 0 | 0 | pass |
| E-2 | b82-r2 | same | 0 | 0 | pass |
| E-4 | b82-r1 | `guessed_runtime_path` on executor spawns | 0 | 0 | pass |
| E-4 | b82-r2 | same | 0 | 0 | pass |
| E-5 | b82-r1 | `draft_write` errors; writes per executor | 0 errors; at most 2 | 0; <= 2 | pass |
| E-5 | b82-r2 | same | 0 errors; at most 2 | 0; <= 2 | pass |
| X-1 | b82-r1 | `validate_publish` errors on planner spawns | 0 | 0 | pass |
| X-1 | b82-r2 | same | 0 | 0 | pass |

**Outcomes:** b82-r1 acceptance true, tests_ok true, verification passed; b82-r2 acceptance true, tests_ok true,
verification passed.

**SC-1 verdict: effect shown.** Every FIX row's mechanism check passes in both new runs (18 of 18) and every outcome
holds.

**SC-2 verdict: PASS** (`guessedPathVerdict` over b82-r1 and b82-r2): 2 runs scanned (6 and 8 transcript files, 122
and 184 tool uses), no guessed absolute home path and no recorded escape (tilde 0, guessed_home 0, real 0,
guessed_nonexistent 0, tilde_denied 0). Before, the same scan over objective 81's recorded build runs (`--root
<scratchpad>/eval81 --batch E`, `record.access` not recorded for those runs): b30-r1 guessed_home 0, b30-r2 1
(`/Users/../private/tmp/<sandbox>/runs/E/b30-r2/home/.claude/aoforge/templates/summary.md`), b31-r1 1
(`<home>/.claude/aoforge/references/tdd.md`, denied), b31-r2 1 (`/Users/<user>/.claude/aoforge/references/tdd.md`);
tilde 0 in all four. By hand on b82-r2: `"file_path":"~` 0 and `"file_path":"/Users/` 0 across its transcripts, the
scan's counts; its runtime Reads name `<sandbox>/runs/E/b82-r2/home/.claude/aoforge/references/{goal-backward,tdd,trd-spec}.md`.

### Totals per role, against both recorded versions (n=2 each, no verdict)

From the Per role medians above (planner and executor rows, which SC-1 names):

| Role | Metric | 3.0.0 (81) | 3.1.0 (81) | 3.1.0-82 | vs 3.0.0 | vs 3.1.0 |
|---|---|---:|---:|---:|---:|---:|
| planner | total tokens | 1,321,277 | 2,205,630 | 1,096,338 | -17.0% | -50.3% |
| planner | first-turn input | 29,726 | 27,238 | 27,925 | -6.1% | +2.5% |
| planner | cache writes | 70,669 | 104,473 | 81,514 | +15.4% | -22.0% |
| planner | cost (USD) | 1.1608 | 1.7838 | 0.9978 | -14.0% | -44.1% |
| planner | wall (s) | 278 | 425 | 249 | -10.4% | -41.4% |
| executor | total tokens | 2,769,891 | 3,326,048 | 1,951,363 | -29.6% | -41.3% |
| executor | first-turn input | 30,845 | 25,100 | 26,112 | -15.3% | +4.0% |
| executor | cache writes | 81,736 | 97,358 | 69,230 | -15.3% | -28.9% |
| executor | cost (USD) | 0.6920 | 0.8717 | 0.5434 | -21.5% | -37.7% |
| executor | wall (s) | 165 | 194 | 133 | -19.3% | -31.2% |

Build cost per run: 3.0.0 (81) $4.90 and $3.60, 3.1.0 (81) $5.09 and $4.35, 3.1.0-82 **$3.39 and $4.05**. Objective
81 saw a run-to-run spread of $1.41 to $2.06 on its own quick runs, so a per-run cost difference of under about $2
carries no weight by itself.

### Attribution deltas (`attribution.cjs --compare`, all spawns of the role)

The planner decides the TRD count, and the new runs swapped it: b82-r1 planned 1 TRD (as b30-r2 and b31-r2 did), b82-r2
planned 2 (as b30-r1 and b31-r1 did). The TRD-count-matched pairs are the like-for-like ones; the id pairs the TRD
named are listed too.

| Pair (TRDs) | Role | Calls | Mean context per call | Total tokens | Delta |
|---|---|---|---|---|---|
| b31-r1 -> b82-r2 (2 / 2) | planner | 29 -> 16 | 80,136 -> 65,119 | 2,366,860 -> 1,069,517 | -1,297,343 (-54.8%) |
| b31-r1 -> b82-r2 (2 / 2) | executor (2 spawns) | 89 -> 67 | 72,279 -> 52,994 | 6,480,557 -> 3,582,903 | -2,897,654 (-44.7%) |
| b31-r2 -> b82-r1 (1 / 1) | planner | 26 -> 18 | 77,014 -> 61,759 | 2,044,399 -> 1,123,158 | -921,241 (-45.1%) |
| b31-r2 -> b82-r1 (1 / 1) | executor | 41 -> 41 | 80,410 -> 61,976 | 3,326,048 -> 2,566,562 | -759,486 (-22.8%) |
| b30-r1 -> b82-r2 (2 / 2) | planner | 21 -> 16 | 72,429 -> 65,119 | 1,558,034 -> 1,069,517 | -488,517 (-31.4%) |
| b30-r1 -> b82-r2 (2 / 2) | executor (2 spawns) | 82 -> 67 | 63,868 -> 52,994 | 5,278,665 -> 3,582,903 | -1,695,762 (-32.1%) |
| b30-r2 -> b82-r1 (1 / 1) | planner | 18 -> 18 | 59,181 -> 61,759 | 1,084,520 -> 1,123,158 | +38,638 (+3.6%) |
| b30-r2 -> b82-r1 (1 / 1) | executor | 46 -> 41 | 67,446 -> 61,976 | 3,126,104 -> 2,566,562 | -559,542 (-17.9%) |
| b31-r1 -> b82-r1 (2 / 1, id pair) | planner | 29 -> 18 | 80,136 -> 61,759 | 2,366,860 -> 1,123,158 | -1,243,702 |
| b31-r2 -> b82-r2 (1 / 2, id pair) | planner | 26 -> 16 | 77,014 -> 65,119 | 2,044,399 -> 1,069,517 | -974,882 |

Categories that moved, b31-r1 -> b82-r1 planner (issuing + carry): `validate_publish` 5 -> 3 calls (-284,755),
`draft_edit` 6 -> 1 (-208,855), `tool_investigation` 2 -> 0 (-205,601), `draft_write` 2 -> 1 (-116,058),
`raw_commit` 1 -> 0 (-108,194), `commit_inspect` 1 -> 0 (-107,551), `scratch_copy` 1 -> 0 (-105,850),
`runtime_lookup` 2 -> 0 (-128,827), `runtime_read:templates/trd-prompt.md` 1 -> 0 (-97,764); `other` rose 2 -> 6
(+191,247). In the 1-TRD executor pair (b31-r2 -> b82-r1) the call count is unchanged (41) and the whole delta is the
context term (-755,790): mean context per call fell 23%, the effect E-1, E-2 and P-3 target.

## Reading

- **What moved.** The planner is back at 3.0.0's size: per TRD-matched pair -31% (2 TRDs) and +4% (1 TRD) against
  3.0.0, -55% and -45% against 81's 3.1.0. Its extra calls are gone: no template hunt (P-1), no commit inspection or
  amend (P-2), no tooling-source reads (P-4), no failed `validate_publish` (X-1), and TRD drafts of 14-19K characters
  (P-3). The executors read neither `templates/summary.md` nor `references/tdd.md` (E-1, E-2), wrote each SUMMARY at
  most twice with no refused write (E-5), and carry 23-27% less context per call than 81's 3.1.0 executors in the
  TRD-matched pairs; the executor median is below both recorded versions (-30% against 3.0.0).
- **What did not.** First-turn input moved by a few percent only: the planner +2.5% and the executor +4.0% against
  81's 3.1.0 (82-02, 82-11 and 82-07 added resident text: +2,171 and +3,036 bytes, 82-DIAGNOSIS.md), both still
  below 3.0.0. The orchestrator and its general-purpose "Execute Objective" spawn rose +8% and +12% in tokens
  against 81's 3.1.0; SC-1 does not name them and 82-01 did not diagnose them.
- **Guessed paths.** None in either new run, where three of 81's four build runs had one; every runtime Read named the
  sandbox runtime root it was handed.
- **Limits.** n=2 against n=2. The planner chose 1 TRD for b82-r1 and 2 for b82-r2, the reverse of 81's id order, so
  only TRD-matched pairs compare like with like, and each is n=1. Per-run cost differences sit inside 81's
  run-to-run spread; the verdict rests on the mechanism checks, which pass in both runs, not on totals. Same Claude
  Code (2.1.302), fixture, prompt, session model (opus) and profile (balanced) as 81's b31 runs; the tree also carries
  82-08's tier reverts (UI judge and researcher architecture), which no role in this workload uses.

## Limits

- n=2 vs n=2 (and n=2 for 3.0.0): enough to see a large per-role shift, not to estimate a small one.
- Claude Code version: objective 81 ran 2.1.302 (Claude Code); these runs 2.1.302. A difference between them is a confound the per-role deltas cannot separate from the plugin change.
- The planner decides the TRD count, so a run with a different TRD count is a different workload.
