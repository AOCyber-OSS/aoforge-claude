# Batch C (objective 82) results

Scored 2026-10-18T11:44:10.116Z. The project-researcher (architecture and pitfalls) at haiku and sonnet on two new topics (gateway, hub), 2 runs per topic, dimension and model, each graded blind by Sonnet against fixtures/C/checklists-82.json. Recall is found / checklist items over the graded runs, with a Wilson 95% interval (objective 81's lib/stats.cjs).

## Recall per topic

| Topic | Dimension | Model | Graded runs | Recall (Wilson 95%) | Fabrications | Per run |
|---|---|---|---:|---|---:|---:|
| gateway | architecture | haiku | 2 | 24/24 (100.0%, 86.2%-100.0%) | 0 | 0 |
| gateway | architecture | sonnet | 2 | 23/24 (95.8%, 79.8%-99.3%) | 0 | 0 |
| gateway | pitfalls | haiku | 2 | 21/22 (95.5%, 78.2%-99.2%) | 0 | 0 |
| gateway | pitfalls | sonnet | 2 | 22/22 (100.0%, 85.1%-100.0%) | 0 | 0 |
| hub | architecture | haiku | 2 | 19/22 (86.4%, 66.7%-95.3%) | 0 | 0 |
| hub | architecture | sonnet | 2 | 22/22 (100.0%, 85.1%-100.0%) | 0 | 0 |
| hub | pitfalls | haiku | 2 | 18/22 (81.8%, 61.5%-92.7%) | 0 | 0 |
| hub | pitfalls | sonnet | 2 | 20/22 (90.9%, 72.2%-97.5%) | 0 | 0 |

## Pooled over the new topics

| Dimension | Model | Graded runs | Recall (Wilson 95%) | Fabrications per run |
|---|---|---:|---|---:|
| architecture | haiku | 4 | 43/46 (93.5%, 82.5%-97.8%) | 0 |
| architecture | sonnet | 4 | 45/46 (97.8%, 88.7%-99.6%) | 0 |
| pitfalls | haiku | 4 | 39/44 (88.6%, 76.0%-95.0%) | 0 |
| pitfalls | sonnet | 4 | 42/44 (95.5%, 84.9%-98.7%) | 0 |

## Item matrix

Per checklist item: graded runs that found it, Sonnet and Haiku (found/graded).

### gateway / architecture

| Item | Sonnet | Haiku |
|---|---|---|
| GA-A01 | 2/2 | 2/2 |
| GA-A02 | 2/2 | 2/2 |
| GA-A03 | 2/2 | 2/2 |
| GA-A04 | 2/2 | 2/2 |
| GA-A05 | 2/2 | 2/2 |
| GA-A06 | 2/2 | 2/2 |
| GA-A07 | 1/2 | 2/2 |
| GA-A08 | 2/2 | 2/2 |
| GA-A09 | 2/2 | 2/2 |
| GA-A10 | 2/2 | 2/2 |
| GA-A11 | 2/2 | 2/2 |
| GA-A12 | 2/2 | 2/2 |

### gateway / pitfalls

| Item | Sonnet | Haiku |
|---|---|---|
| GA-P01 | 2/2 | 2/2 |
| GA-P02 | 2/2 | 2/2 |
| GA-P03 | 2/2 | 2/2 |
| GA-P04 | 2/2 | 2/2 |
| GA-P05 | 2/2 | 2/2 |
| GA-P06 | 2/2 | 2/2 |
| GA-P07 | 2/2 | 2/2 |
| GA-P08 | 2/2 | 2/2 |
| GA-P09 | 2/2 | 1/2 |
| GA-P10 | 2/2 | 2/2 |
| GA-P11 | 2/2 | 2/2 |

### hub / architecture

| Item | Sonnet | Haiku |
|---|---|---|
| HU-A01 | 2/2 | 0/2 |
| HU-A02 | 2/2 | 2/2 |
| HU-A03 | 2/2 | 2/2 |
| HU-A04 | 2/2 | 2/2 |
| HU-A05 | 2/2 | 2/2 |
| HU-A06 | 2/2 | 2/2 |
| HU-A07 | 2/2 | 2/2 |
| HU-A08 | 2/2 | 1/2 |
| HU-A09 | 2/2 | 2/2 |
| HU-A10 | 2/2 | 2/2 |
| HU-A11 | 2/2 | 2/2 |

### hub / pitfalls

| Item | Sonnet | Haiku |
|---|---|---|
| HU-P01 | 2/2 | 2/2 |
| HU-P02 | 0/2 | 1/2 |
| HU-P03 | 2/2 | 1/2 |
| HU-P04 | 2/2 | 2/2 |
| HU-P05 | 2/2 | 1/2 |
| HU-P06 | 2/2 | 2/2 |
| HU-P07 | 2/2 | 2/2 |
| HU-P08 | 2/2 | 2/2 |
| HU-P09 | 2/2 | 2/2 |
| HU-P10 | 2/2 | 2/2 |
| HU-P11 | 2/2 | 1/2 |

## Per run

| Run | Status | Verdict | Found | Wrong | Missing | Items | Fabrications | Cost | Charged | Grader charged | Reason |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| C82-res-gateway-architecture-s-1 | ok | graded | 12 | 0 | 0 | 12 | 0 | $0.1664 | $0.1664 | $0.0757 |  |
| C82-res-gateway-architecture-h-1 | ok | graded | 12 | 0 | 0 | 12 | 0 | $0.0235 | $0.0235 | $0.0757 |  |
| C82-res-gateway-pitfalls-h-1 | ok | graded | 11 | 0 | 0 | 11 | 0 | $0.0368 | $0.0368 | $0.0813 |  |
| C82-res-gateway-pitfalls-s-1 | ok | graded | 11 | 0 | 0 | 11 | 0 | $0.1850 | $0.1850 | $0.0761 |  |
| C82-res-hub-architecture-s-1 | ok | graded | 11 | 0 | 0 | 11 | 0 | $0.1284 | $0.1284 | $0.0586 |  |
| C82-res-hub-architecture-h-1 | ok | graded | 10 | 0 | 1 | 11 | 0 | $0.0732 | $0.0732 | $0.0718 |  |
| C82-res-hub-pitfalls-h-1 | ok | graded | 8 | 0 | 3 | 11 | 0 | $0.0469 | $0.0469 | $0.0669 |  |
| C82-res-hub-pitfalls-s-1 | ok | graded | 10 | 0 | 1 | 11 | 0 | $0.1886 | $0.1886 | $0.0802 |  |
| C82-res-gateway-architecture-h-2 | ok | graded | 12 | 0 | 0 | 12 | 0 | $0.0213 | $0.0213 | $0.0699 |  |
| C82-res-gateway-architecture-s-2 | ok | graded | 11 | 0 | 1 | 12 | 0 | $0.1297 | $0.1297 | $0.0613 |  |
| C82-res-gateway-pitfalls-s-2 | ok | graded | 11 | 0 | 0 | 11 | 0 | $0.1931 | $0.1931 | $0.0794 |  |
| C82-res-gateway-pitfalls-h-2 | ok | graded | 10 | 0 | 1 | 11 | 0 | $0.0478 | $0.0478 | $0.0855 |  |
| C82-res-hub-architecture-h-2 | ok | graded | 9 | 0 | 2 | 11 | 0 | $0.0469 | $0.0469 | $0.0576 |  |
| C82-res-hub-architecture-s-2 | ok | graded | 11 | 0 | 0 | 11 | 0 | $0.1284 | $0.1284 | $0.0597 |  |
| C82-res-hub-pitfalls-s-2 | ok | graded | 10 | 0 | 1 | 11 | 0 | $0.1722 | $0.1722 | $0.0731 |  |
| C82-res-hub-pitfalls-h-2 | ok | graded | 10 | 0 | 1 | 11 | 0 | $0.0150 | $0.0150 | $0.0822 |  |

## Cost

Charged: researcher haiku $0.3114, researcher sonnet $1.2917, graders $1.1550; total $2.7582.
Ledger: batch C complete, spent $2.7582; ledger total $4.0377.

## Guessed runtime paths

From each researcher run's transcripts (Read, Glob, Grep inputs; scripts/eval82/lib/guessed-paths.cjs) beside the runner's recorded classes. `guessed_home` (an absolute path the agent built under the home's parent) is the defect; `tilde` is counted for the record (the Read tool expands `~`). A run with no transcripts or no tool use is "not scanned", never zero. 82-CHECK-RULES.md section 4 decides what these numbers mean.

| Run | Scan | tilde | guessed_home | Recorded (runner) |
|---|---|---:|---:|---|
| C82-res-gateway-architecture-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-gateway-architecture-h-1 | 1 file(s), 6 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-gateway-pitfalls-h-1 | 1 file(s), 7 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-gateway-pitfalls-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-architecture-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-architecture-h-1 | 1 file(s), 10 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-pitfalls-h-1 | 1 file(s), 8 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-pitfalls-s-1 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-gateway-architecture-h-2 | 1 file(s), 6 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-gateway-architecture-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-gateway-pitfalls-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-gateway-pitfalls-h-2 | 1 file(s), 7 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-architecture-h-2 | 1 file(s), 8 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-architecture-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-pitfalls-s-2 | 1 file(s), 4 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |
| C82-res-hub-pitfalls-h-2 | 1 file(s), 5 tool use(s) | 0 | 0 | real 0, guessed_nonexistent 0, tilde_denied 0 |

Totals: 16 run(s), 16 scanned, 0 not scanned; tilde 0, guessed_home 0; recorded real 0, guessed_nonexistent 0, tilde_denied 0; access not recorded on 0.

## Objective 81 topic (recorded context)

objective 81's topic: recorded context, not voting; its C.json holds no item-level verdicts, so it is aggregate only (recall, fabrications, cost) (source `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json`).

| Dimension | Model | Scored runs | Recall | Fabrications | Cost | Grader cost |
|---|---|---:|---|---|---:|---:|
| architecture | haiku | 2 | 21/22 (95.5%, 78.2%-99.2%) | 0 over 2 run(s) | $0.0805 | $0.1341 |
| architecture | sonnet | 2 | 17/22 (77.3%, 56.6%-89.9%) | 0 over 2 run(s) | $0.2654 | $0.1172 |
| pitfalls | haiku | 2 | 22/22 (100.0%, 85.1%-100.0%) | 0 over 2 run(s) | $0.0893 | $0.1846 |
| pitfalls | sonnet | 2 | 21/22 (95.5%, 78.2%-99.2%) | 0 over 2 run(s) | $0.3689 | $0.1410 |

## Notes

- Graded runs only enter recall and fabrications; a run excluded or not run is listed with its reason.
- Guessed paths are scanned from each researcher run's transcripts; `tilde` is counted for the record (the Read tool expands `~`), `guessed_home` is the defect signal, and the runner's recorded classes stand beside them.
- Objective 81's topic is recorded context, not voting (82-CHECK-RULES.md section 2).
