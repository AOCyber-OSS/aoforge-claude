# 76-08 measurement: AOForge 3.0.0 vs 3.1.0 on one fixed workload

- Session model: opus (claude-opus-5-5)
- Profile: balanced (the planner inherits the session model; executor, verifier and job-checker run sonnet; the same in both versions)
- Runs recorded: 10 of 10 planned (3.0.0: 5, 3.1.0: 5)
- Scored: 2026-10-17T21:15:11.455Z

## Method

- Workload, fixed for both versions: on the `notekit` project (one small Node CLI, built byte-identical for every run by scripts/eval81/fixtures/E/build.cjs), per version three runs of `` /aoforge:quick Add a --json flag to `notekit list` that prints the notes as a JSON array of {id, text} objects, with a test. `` and two of `/aoforge:build 1 --skip-research --auto`.
- The two versions differ in the plugin tree only: same project bytes, same prompt, same session model, same env flags, caps and timeouts.
- Order (interleaved, pilots first, ABBA within each workflow): q31-r1, q30-r1, b31-r1, b30-r1, q30-r2, q31-r2, q31-r3, q30-r3, b30-r2, b31-r2. The pilots are q31-r1, q30-r1, b31-r1, b30-r1.
- Outcomes are decided by hidden checks that never enter the project a session sees: quick, `list --json` on a seeded notes file prints exactly the seeded {id, text} array and `node --test` passes; build, `tag 1 work` then `list --tag work` prints note 1 only, `node --test` passes, and the objective's VERIFICATION.md, when present, has status passed.
- The project is stamped 3.0.0, so the 3.1.0 runs include the SessionStart upgrade hook's commit (`chore(aoforge): upgrade project to v3.1.0`, code only, no tokens); the 3.0.0 runs have none.
- Roles come from the copied transcripts: the main session is the orchestrator; each subagent is its meta `agentType` without the `aoforge:` prefix.
- First-turn input is input + cache creation + cache read of a spawn's first API message: the prompt it started with (system prompt, tools and spawn prompt). Total tokens add every later message and the output; cache writes are cache creation tokens.
- Transcript cost is priced per message from references/model-rates.json (5-minute cache-write rate unless the 1-hour split is present). The CLI's reported cost is kept beside it, as reported; a run whose two figures differ by more than 10% is flagged and neither is overwritten. Charged is the ledger's figure (the larger).
- Wall time per run is the runner's measured wall clock; per spawn it is the transcript's first-to-last timestamp.
- Role statistics are per spawn, over the runs that ended ok; n is spawns (runs) and is shown in every cell. Deltas are 3.1.0 minus 3.0.0 of the medians (with the percentage of the 3.0.0 median) and of the means.
- Static resident bytes per role are the 81-07 measurement (agent body + largest spawn prompt), read from `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json` (the out dir), v3.0.0 b4a9d870 vs HEAD c4694697. The orchestrator is the session itself, so its static cell is "n/a (not a spawn)".
- This report measures; it does not propose model tiers.

## Outcomes

| Version | Workflow | Planned | Recorded | Ended ok | Acceptance pass | Tests green | Verification passed (present) | TRDs per run | Upgrade commit | Reported cost median / mean | Priced cost median / mean | Wall s median / mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3.0.0 | quick | 3 | 3 | 3 | 3/3 | 3/3 | 0 (0) | 1, 1, 1 | 0/3 | 1.7666 / 1.7465 | 1.7569 / 1.7433 | 370 / 333 |
| 3.1.0 | quick | 3 | 3 | 3 | 3/3 | 3/3 | 0 (0) | 1, 1, 1 | 3/3 | 1.5924 / 1.6288 | 1.5904 / 1.6281 | 341 / 336 |
| 3.0.0 | build | 2 | 2 | 2 | 2/2 | 2/2 | 2 (2) | 2, 1 | 0/2 | 4.2505 / 4.2505 | 4.2078 / 4.2078 | 785 / 785 |
| 3.1.0 | build | 2 | 2 | 2 | 2/2 | 2/2 | 2 (2) | 2, 1 | 2/2 | 4.7207 / 4.7207 | 4.7168 / 4.7168 | 943 / 943 |

## Per role

### quick

| Role | Version | n spawns (runs) | First-turn input median / mean | Total tokens median / mean | Cache writes median / mean | Cost USD median / mean | Wall s median / mean | Static resident bytes |
|---|---|---|---|---|---|---|---|---|
| orchestrator | 3.0.0 | 3 (3) | 34,271 / 34,369 | 347,956 / 379,049 | 31,501 / 31,981 | 0.3933 / 0.4113 | 369 / 332 | n/a (not a spawn) |
| orchestrator | 3.1.0 | 3 (3) | 33,386 / 33,470 | 528,563 / 559,505 | 35,744 / 37,212 | 0.5011 / 0.5303 | 340 / 335 | n/a (not a spawn) |
| orchestrator | 3.1.0 - 3.0.0 | | -885 (-2.58%) / -899 | +180,607 (+51.91%) / +180,456 | +4,243 (+13.47%) / +5,232 | +0.1077 (+27.39%) / +0.1189 | -29 (-7.95%) / +4 | n/a (not a spawn) |
| planner | 3.0.0 | 3 (3) | 29,350 / 29,404 | 935,678 / 961,759 | 65,673 / 69,089 | 0.8626 / 0.8923 | 188 / 201 | 61,255 |
| planner | 3.1.0 | 3 (3) | 26,719 / 26,778 | 910,219 / 913,231 | 64,218 / 59,588 | 0.8671 / 0.8201 | 195 / 186 | 54,865 |
| planner | 3.1.0 - 3.0.0 | | -2,631 (-8.96%) / -2,626 | -25,459 (-2.72%) / -48,528 | -1,455 (-2.22%) / -9,501 | +0.0045 (+0.52%) / -0.0722 | +7 (+3.76%) / -15 | 61,255 -> 54,865 (-6,390) |
| executor | 3.0.0 | 3 (3) | 29,543 / 29,566 | 735,303 / 817,141 | 53,992 / 54,870 | 0.2949 / 0.4397 | 64 / 83 | 64,529 |
| executor | 3.1.0 | 3 (3) | 23,931 / 23,959 | 793,894 / 770,392 | 41,544 / 41,286 | 0.2596 / 0.2778 | 77 / 73 | 52,632 |
| executor | 3.1.0 - 3.0.0 | | -5,612 (-19.00%) / -5,606 | +58,591 (+7.97%) / -46,749 | -12,448 (-23.06%) / -13,584 | -0.0353 (-11.96%) / -0.1619 | +13 (+20.66%) / -10 | 64,529 -> 52,632 (-11,897) |

### build

| Role | Version | n spawns (runs) | First-turn input median / mean | Total tokens median / mean | Cache writes median / mean | Cost USD median / mean | Wall s median / mean | Static resident bytes |
|---|---|---|---|---|---|---|---|---|
| orchestrator | 3.0.0 | 2 (2) | 39,188 / 39,188 | 664,325 / 664,325 | 48,894 / 48,894 | 0.6339 / 0.6339 | 784 / 784 | n/a (not a spawn) |
| orchestrator | 3.1.0 | 2 (2) | 37,779 / 37,779 | 599,408 / 599,408 | 47,799 / 47,799 | 0.6181 / 0.6181 | 942 / 942 | n/a (not a spawn) |
| orchestrator | 3.1.0 - 3.0.0 | | -1,409 (-3.60%) / -1,409 | -64,916 (-9.77%) / -64,916 | -1,095 (-2.24%) / -1,095 | -0.0157 (-2.48%) / -0.0157 | +158 (+20.12%) / +158 | n/a (not a spawn) |
| planner | 3.0.0 | 2 (2) | 29,726 / 29,726 | 1,321,277 / 1,321,277 | 70,669 / 70,669 | 1.1608 / 1.1608 | 278 / 278 | 61,255 |
| planner | 3.1.0 | 2 (2) | 27,238 / 27,238 | 2,205,630 / 2,205,630 | 104,473 / 104,473 | 1.7838 / 1.7838 | 425 / 425 | 54,865 |
| planner | 3.1.0 - 3.0.0 | | -2,488 (-8.37%) / -2,488 | +884,353 (+66.93%) / +884,353 | +33,804 (+47.83%) / +33,804 | +0.6230 (+53.67%) / +0.6230 | +147 (+52.94%) / +147 | 61,255 -> 54,865 (-6,390) |
| job-checker | 3.0.0 | 2 (2) | 14,502 / 14,502 | 66,857 / 66,857 | 22,315 / 22,315 | 0.0736 / 0.0736 | 11 / 11 | 25,476 |
| job-checker | 3.1.0 | 2 (2) | 14,501 / 14,501 | 70,801 / 70,801 | 30,590 / 30,590 | 0.0967 / 0.0967 | 13 / 13 | 25,430 |
| job-checker | 3.1.0 - 3.0.0 | | -1 (-0.01%) / -1 | +3,944 (+5.90%) / +3,944 | +8,275 (+37.08%) / +8,275 | +0.0231 (+31.42%) / +0.0231 | +2 (+20.02%) / +2 | 25,476 -> 25,430 (-46) |
| executor | 3.0.0 | 3 (2) | 30,845 / 30,793 | 2,769,891 / 2,801,590 | 81,736 / 74,837 | 0.6920 / 0.6746 | 165 / 161 | 64,529 |
| executor | 3.1.0 | 3 (2) | 25,100 / 25,067 | 3,326,048 / 3,268,868 | 97,358 / 92,459 | 0.8717 / 0.8029 | 194 / 190 | 52,632 |
| executor | 3.1.0 - 3.0.0 | | -5,745 (-18.63%) / -5,726 | +556,157 (+20.08%) / +467,279 | +15,622 (+19.11%) / +17,623 | +0.1797 (+25.97%) / +0.1283 | +29 (+17.31%) / +29 | 64,529 -> 52,632 (-11,897) |
| verifier | 3.0.0 | 4 (2) | 28,770 / 28,793 | 239,812 / 258,362 | 40,740 / 40,940 | 0.2243 / 0.2447 | 34 / 34 | 48,026 |
| verifier | 3.1.0 | 3 (2) | 23,191 / 23,217 | 174,188 / 156,570 | 31,447 / 24,518 | 0.1128 / 0.0945 | 19 / 17 | 31,109 |
| verifier | 3.1.0 - 3.0.0 | | -5,578 (-19.39%) / -5,576 | -65,623 (-27.36%) / -101,792 | -9,292 (-22.81%) / -16,422 | -0.1116 (-49.73%) / -0.1502 | -15 (-43.72%) / -16 | 48,026 -> 31,109 (-16,917) |
| general-purpose | 3.0.0 | 2 (2) | 15,393 / 15,393 | 1,317,721 / 1,317,721 | 84,815 / 84,815 | 0.8382 / 0.8382 | 382 / 382 | 57 |
| general-purpose | 3.1.0 | 2 (2) | 15,079 / 15,079 | 1,256,163 / 1,256,163 | 87,255 / 87,255 | 0.8720 / 0.8720 | 428 / 428 | 57 |
| general-purpose | 3.1.0 - 3.0.0 | | -314 (-2.04%) / -314 | -61,558 (-4.67%) / -61,558 | +2,441 (+2.88%) / +2,441 | +0.0338 (+4.03%) / +0.0338 | +46 (+12.15%) / +46 | 57 -> 57 (0) |

## Per run

| Run | Version | Workflow | Status | Reported cost | Priced cost | Charged | First-turn input | Total tokens | Cache writes | Wall s | Acceptance | Tests | Verification | TRDs | SUMMARYs | Upgrade commit | Spawns |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| q31-r1 | 3.1.0 | quick | ok | 1.7786 | 1.7786 | 1.7786 | 33,637 | 2,388,584 | 160,803 | 345 | yes | yes (9 pass, 0 fail) | n/a | 1 | 1 | yes | orchestrator 1, planner 1, executor 1 |
| q30-r1 | 3.0.0 | quick | ok | 2.0647 | 2.0647 | 2.0647 | 34,564 | 2,424,883 | 158,004 | 370 | yes | yes (9 pass, 0 fail) | n/a | 1 | 1 | no | orchestrator 1, planner 1, executor 1 |
| b31-r1 | 3.1.0 | build | ok | 5.0873 | 5.0828 | 5.0873 | 37,967 | 10,856,720 | 476,952 | 1,110 | yes | yes (27 pass, 0 fail) | passed | 2 | 2 | yes | orchestrator 1, planner 1, job-checker 1, executor 2, verifier 1, general-purpose 1 |
| b30-r1 | 3.0.0 | build | ok | 4.8969 | 4.8489 | 4.8969 | 39,418 | 9,483,357 | 464,565 | 957 | yes | yes (33 pass, 0 fail) | passed | 2 | 2 | no | orchestrator 1, planner 1, job-checker 1, executor 2, verifier 2, general-purpose 1 |
| q30-r2 | 3.0.0 | quick | ok | 1.4084 | 1.4084 | 1.4084 | 34,271 | 1,754,831 | 147,810 | 237 | yes | yes (11 pass, 0 fail) | n/a | 1 | 1 | no | orchestrator 1, planner 1, executor 1 |
| q31-r2 | 3.1.0 | quick | ok | 1.5924 | 1.5904 | 1.5924 | 33,386 | 2,162,298 | 141,506 | 322 | yes | yes (9 pass, 0 fail) | n/a | 1 | 1 | yes | orchestrator 1, planner 1, executor 1 |
| q31-r3 | 3.1.0 | quick | ok | 1.5155 | 1.5155 | 1.5155 | 33,386 | 2,178,502 | 111,950 | 341 | yes | yes (11 pass, 0 fail) | n/a | 1 | 1 | yes | orchestrator 1, planner 1, executor 1 |
| q30-r3 | 3.0.0 | quick | ok | 1.7666 | 1.7569 | 1.7666 | 34,271 | 2,294,133 | 162,006 | 391 | yes | yes (10 pass, 0 fail) | n/a | 1 | 1 | no | orchestrator 1, planner 1, executor 1 |
| b30-r2 | 3.0.0 | build | ok | 3.6042 | 3.5668 | 3.6042 | 38,957 | 6,695,220 | 377,091 | 613 | yes | yes (19 pass, 0 fail) | passed | 1 | 1 | no | orchestrator 1, planner 1, job-checker 1, executor 1, verifier 2, general-purpose 1 |
| b31-r2 | 3.1.0 | build | ok | 4.3540 | 4.3507 | 4.3540 | 37,590 | 7,683,598 | 414,212 | 775 | yes | yes (33 pass, 0 fail) | passed | 1 | 1 | yes | orchestrator 1, planner 1, job-checker 1, executor 1, verifier 2, general-purpose 1 |

## Flagged runs

None.

## Not run

None.

## Pilot cost check (TRD 81-17 Task 2)

| Run | Reported | Transcript | Main session | Subagents | Charged | Cap | Overshoot |
|---|---|---|---|---|---|---|---|
| q31-r1 | 1.7786 | 1.7786 | 0.4701 | 1.3085 | 1.7786 | 6 | 0 |
| q30-r1 | 2.0647 | 2.0647 | 0.4538 | 1.6108 | 2.0647 | 6 | 0 |
| b31-r1 | 5.0873 | 5.0828 | 0.6314 | 4.4514 | 5.0873 | 15 | 0 |
| b30-r1 | 4.8969 | 4.8489 | 0.6091 | 4.2398 | 4.8969 | 15 | 0 |

- **Subagent spend.** The CLI's reported cost includes it on all four pilots: reported is at least 0.95 x the
  transcript-priced main session plus subagents, and the subagents are 74-88% of each run.
- **The cap was never tested.** No run of the ten reached 35% of its cap, so this batch cannot say whether
  `--max-budget-usd` bounds subagent spend.

## Reading

**Outcomes do not move.** All ten runs passed the hidden acceptance, with green tests. Every build reached a passed
verification. Both versions planned the same TRD counts: quick 1, 1, 1 and build 2, 1.

**What moved: first-turn input (the resident prompt), cut in 3.1.0 for every role that has a cut.**

| Role | 3.1.0 vs 3.0.0, median first-turn input | Static estimate (81-07, bytes / 4) |
|---|---|---|
| executor | -5,612 (quick), -5,745 (build), about -19% | -2,974 |
| verifier | -5,578, -19% | -4,230 |
| planner | -2,631 (quick), -2,488 (build), -8% to -9% | -1,598 |
| orchestrator | -885 (quick), -1,409 (build), -3% to -4% | not a spawn |
| job-checker | -1 | -11 |
| general-purpose | -314 | 0 |

The live cuts exceed the static estimate for the executor, verifier and planner. The static estimate counts agent
bodies and spawn templates, so something else in the first turn also shrank. This report does not separate it.

**Whole-run tokens and cost moved less, and not in one direction.** n is 3 quick and 2 build runs per version.

| | Quick, 3.1.0 vs 3.0.0 | Build, 3.1.0 vs 3.0.0 |
|---|---|---|
| Reported cost, median | 1.59 vs 1.77 (-10%) | 4.72 vs 4.25 (+11%) |
| Reported cost, mean | 1.63 vs 1.75 (-7%) | |
| Wall time, median | 341 s vs 370 s | 943 s vs 785 s |

- **Quick.** The executor got cheaper. The 3.1.0 orchestrator, though, used about 52% more tokens (median 529K vs
  348K).
- **Build.**
  - **Planner:** used 67% more tokens in 3.1.0 (median 2.21M vs 1.32M) and cost 54% more ($1.78 vs $1.16).
  - **Executors:** used 20% more tokens.
  - **Verifier:** cost fell by half ($0.11 vs $0.22). 3.0.0 spawned a second, opus verifier from the orchestrator in
    both builds; 3.1.0 spawned one or two, both sonnet.
- **Sum over the ten runs:** $13.74 for 3.0.0 and $14.33 for 3.1.0.

**Model per spawn was not always the same.**
- 3.0.0's quick executor ran on sonnet twice and on opus once (q30-r1 spawned it with no model).
- 3.1.0 passed sonnet every time.

**Observed in 3.1.0 only.** In both 3.1.0 builds the TRD 01-01 executor tried to Read
`~/.claude/aoforge/references/tdd.md` at a guessed absolute home before reading the sandbox copy:
- b31-r1 guessed the real home, and the deny list refused it;
- b31-r2 guessed `/Users/aocyber`, which does not exist.

The 3.1.0 executor's "read these files yourself" list names `~`-paths, and the Read tool does not expand `~`.

**Limits.** n is 3 and 2 per cell, on one small project with one session model. The six runs after the pilots ran
under a shorter, opaque cwd (post-hoc 3). Deltas of a few percent in totals are inside the run-to-run spread: the
3.0.0 quick runs alone range from $1.41 to $2.06.
