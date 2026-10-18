# Objective 82: tier checks (P1, P4, P5)

Rendered by `node scripts/eval82/score.cjs --rules` from `results/D.json` (scored 2026-10-18T11:44:08.328Z) and `results/C.json` (scored 2026-10-18T11:44:10.116Z) under 82-CHECK-RULES.md sections 1, 2 and 4 (`scripts/eval82/check-rules.cjs`). The same results give the same bytes. Wilson 95% intervals are shown beside the numbers and decide nothing.

| Proposal | Verdict | Deciding clause |
|---|---|---|
| P1 | REVERT | broken_missed(Haiku start, final) = 1 of 13 broken states, needs 0 |
| P4 | REVERT | item lost: hub HU-A01 (Sonnet 2 of 2 runs, Haiku 0 of 2) |
| P5 | KEEP | no item lost, pooled recall 39/44 vs 42/44 (6.8 points), fabrications 0 vs 0 per run |
| SC-2 (researcher runs) | PASS | 16 run(s) scanned, no guessed absolute home path and no recorded escape (tilde 0, guessed_home 0, real 0, guessed_nonexistent 0, tilde_denied 0). |

## P1: the UI judge starts at haiku and escalates (batch D)

**Verdict: REVERT.** broken_missed(Haiku start, final) = 1 of 13 broken states, needs 0.

Rule (82-CHECK-RULES.md section 1): KEEP only when all three hold.

| Condition | Numbers | Holds |
|---|---|---|
| broken_missed(Haiku start, final) = 0 | 1/13 (7.7%, 1.4%-33.3%) broken states ended ok | no |
| accuracy(Haiku start) >= accuracy(Sonnet start) | 19/20 (95.0%, 76.4%-99.1%) vs 18/20 (90.0%, 69.9%-97.2%) | yes |
| cost(Haiku start) < cost(Sonnet start) | $0.1334 vs $1.1462 | yes |

Cost detail: Haiku start $0.0773 samples + $0.0561 escalations; Sonnet start $1.1462 samples + $0.0000 (estimate: the sonnet arm escalated no state).

Context, deciding nothing: escalation rate (haiku) 1/20 (5.0%, 0.9%-23.6%), split rate (haiku) 2/20 (10.0%, 2.8%-30.1%), escalation rate (sonnet) 0/20 (0.0%, 0.0%-16.1%), escalated-verdict agreement with the Sonnet start 1/1 (100.0%, 20.7%-100.0%), false_fail Haiku start 0/7 (0.0%, 0.0%-35.4%) vs Sonnet start 1/7 (14.3%, 2.6%-51.3%).

## P4: researcher architecture at haiku on budget (batch C)

**Verdict: REVERT.** item lost: hub HU-A01 (Sonnet 2 of 2 runs, Haiku 0 of 2).

Rule (82-CHECK-RULES.md section 2): REVERT when any condition fails; KEEP otherwise.

| Condition | Numbers | Holds |
|---|---|---|
| no item found by Sonnet in both runs and by Haiku in neither, on a topic | hub HU-A01 | no |
| pooled Haiku recall not more than 10 points below pooled Sonnet recall | pooled Haiku recall 43/46 (93.5%, 82.5%-97.8%) vs Sonnet 45/46 (97.8%, 88.7%-99.6%); Haiku 4.3 points below | yes |
| Haiku fabrications per graded run not more than Sonnet's + 0.5 | Haiku 0 over 4 run(s) (0 per run) vs Sonnet 0 over 4 (0 per run) | yes |

**Per topic** (graded runs, recall with Wilson 95%, fabrications per run):

| Topic | Model | Graded runs | Recall | Fabrications per run |
|---|---|---:|---|---:|
| gateway | haiku | 2 | 24/24 (100.0%, 86.2%-100.0%) | 0 |
| gateway | sonnet | 2 | 23/24 (95.8%, 79.8%-99.3%) | 0 |
| hub | haiku | 2 | 19/22 (86.4%, 66.7%-95.3%) | 0 |
| hub | sonnet | 2 | 22/22 (100.0%, 85.1%-100.0%) | 0 |

Items where the models differ: gateway GA-A07 Sonnet 1/2, Haiku 2/2; hub HU-A01 Sonnet 2/2, Haiku 0/2; hub HU-A08 Sonnet 2/2, Haiku 1/2.

### Recorded context: objective 81's topic (architecture, not voting)

objective 81's topic: recorded context, not voting; its C.json holds no item-level verdicts, so it is aggregate only (recall, fabrications, cost) (source `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json`).

| Dimension | Model | Scored runs | Recall | Fabrications |
|---|---|---:|---|---|
| architecture | haiku | 2 | 21/22 (95.5%, 78.2%-99.2%) | 0 over 2 run(s) |
| architecture | sonnet | 2 | 17/22 (77.3%, 56.6%-89.9%) | 0 over 2 run(s) |

## P5: researcher pitfalls at haiku on budget (batch C)

**Verdict: KEEP.** no item lost, pooled recall 39/44 vs 42/44 (6.8 points), fabrications 0 vs 0 per run.

Rule (82-CHECK-RULES.md section 2): REVERT when any condition fails; KEEP otherwise.

| Condition | Numbers | Holds |
|---|---|---|
| no item found by Sonnet in both runs and by Haiku in neither, on a topic | none | yes |
| pooled Haiku recall not more than 10 points below pooled Sonnet recall | pooled Haiku recall 39/44 (88.6%, 76.0%-95.0%) vs Sonnet 42/44 (95.5%, 84.9%-98.7%); Haiku 6.8 points below | yes |
| Haiku fabrications per graded run not more than Sonnet's + 0.5 | Haiku 0 over 4 run(s) (0 per run) vs Sonnet 0 over 4 (0 per run) | yes |

**Per topic** (graded runs, recall with Wilson 95%, fabrications per run):

| Topic | Model | Graded runs | Recall | Fabrications per run |
|---|---|---:|---|---:|
| gateway | haiku | 2 | 21/22 (95.5%, 78.2%-99.2%) | 0 |
| gateway | sonnet | 2 | 22/22 (100.0%, 85.1%-100.0%) | 0 |
| hub | haiku | 2 | 18/22 (81.8%, 61.5%-92.7%) | 0 |
| hub | sonnet | 2 | 20/22 (90.9%, 72.2%-97.5%) | 0 |

Items where the models differ: gateway GA-P09 Sonnet 2/2, Haiku 1/2; hub HU-P02 Sonnet 0/2, Haiku 1/2; hub HU-P03 Sonnet 2/2, Haiku 1/2; hub HU-P05 Sonnet 2/2, Haiku 1/2; hub HU-P11 Sonnet 2/2, Haiku 1/2.

### Recorded context: objective 81's topic (pitfalls, not voting)

objective 81's topic: recorded context, not voting; its C.json holds no item-level verdicts, so it is aggregate only (recall, fabrications, cost) (source `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json`).

| Dimension | Model | Scored runs | Recall | Fabrications |
|---|---|---:|---|---|
| pitfalls | haiku | 2 | 22/22 (100.0%, 85.1%-100.0%) | 0 over 2 run(s) |
| pitfalls | sonnet | 2 | 21/22 (95.5%, 78.2%-99.2%) | 0 over 2 run(s) |

## Guessed runtime paths (SC-2, researcher runs)

**Verdict: PASS.** 16 run(s) scanned, no guessed absolute home path and no recorded escape (tilde 0, guessed_home 0, real 0, guessed_nonexistent 0, tilde_denied 0).

Rule (82-CHECK-RULES.md section 4): a scanned `guessed_home` input or a recorded `real` / `guessed_nonexistent` access fails; an unscanned run makes it inconclusive; `tilde` (the Read tool expands `~`) and `tilde_denied` are counted, not deciding.

| Run | Scan | tilde | guessed_home | real | guessed_nonexistent | tilde_denied |
|---|---|---:|---:|---:|---:|---:|
| C82-res-gateway-architecture-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-gateway-architecture-h-1 | 1 file(s), 6 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-gateway-pitfalls-h-1 | 1 file(s), 7 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-gateway-pitfalls-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-architecture-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-architecture-h-1 | 1 file(s), 10 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-pitfalls-h-1 | 1 file(s), 8 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-pitfalls-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-gateway-architecture-h-2 | 1 file(s), 6 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-gateway-architecture-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-gateway-pitfalls-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-gateway-pitfalls-h-2 | 1 file(s), 7 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-architecture-h-2 | 1 file(s), 8 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-architecture-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-pitfalls-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | 0 | 0 | 0 |
| C82-res-hub-pitfalls-h-2 | 1 file(s), 5 tool use(s) | 0 | 0 | 0 | 0 | 0 |
