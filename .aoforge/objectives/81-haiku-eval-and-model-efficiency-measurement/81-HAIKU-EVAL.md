# Objective 81: Haiku 5.5 vs Sonnet 5.5 eval (76-06)

Generated 2026-10-17T22:46:31.731Z by `node scripts/eval81/score.cjs --report`, applying the pre-registered rule in `81-DECISION-RULE.md` to `results/{A,B,C,D}.json`. Batch E (76-08) is reported in `81-MEASUREMENT.md`.

Outcomes are REFUSE, WEAK_ENDORSE or INSUFFICIENT. WEAK_ENDORSE is the most this design can give: small n can refuse but only weakly endorse. Proportions are `k/n (rate%, 95% CI lo-hi%)` with the Wilson 95% interval; differences are Haiku minus Sonnet in points on point estimates.

## A gate

Haiku false passes in A: 0/9 (0.0%, 95% CI 0.0-29.9%): passed (zero Haiku false passes in A (0/9)).

## Summary

| Role | Batch | Primary | Haiku | Sonnet | Haiku minus Sonnet (points) | Outcome |
|---|---|---|---|---|---|---|
| verifier | A | detection | 9/9 (100.0%, 95% CI 70.1-100.0%) | 9/9 (100.0%, 95% CI 70.1-100.0%) | +0.0 | WEAK_ENDORSE |
| job-checker | B | detection | 9/12 (75.0%, 95% CI 46.8-91.1%) | 11/12 (91.7%, 95% CI 64.6-98.5%) | -16.7 | REFUSE |
| ui-evaluator | D | accuracy | 18/20 (90.0%, 95% CI 69.9-97.2%) | 20/20 (100.0%, 95% CI 83.9-100.0%) | -10.0 | WEAK_ENDORSE |
| codebase-mapper:tech | C | recall | 45/46 (97.8%, 95% CI 88.7-99.6%) | 46/46 (100.0%, 95% CI 92.3-100.0%) | -2.2 | WEAK_ENDORSE |
| codebase-mapper:arch | C | recall | 41/46 (89.1%, 95% CI 77.0-95.3%) | 39/46 (84.8%, 95% CI 71.8-92.4%) | +4.3 | REFUSE |
| codebase-mapper:quality | C | recall | 38/44 (86.4%, 95% CI 73.3-93.6%) | 29/33 (87.9%, 95% CI 72.7-95.2%) | -1.5 | REFUSE |
| codebase-mapper:concerns | C | recall | 21/38 (55.3%, 95% CI 39.7-69.9%) | 26/38 (68.4%, 95% CI 52.5-80.9%) | -13.2 | REFUSE |
| project-researcher:stack | C | recall | 18/20 (90.0%, 95% CI 69.9-97.2%) | 0/0 (n/a) | n/a | INSUFFICIENT |
| project-researcher:features | C | recall | 21/22 (95.5%, 95% CI 78.2-99.2%) | 22/22 (100.0%, 95% CI 85.1-100.0%) | -4.5 | WEAK_ENDORSE |
| project-researcher:architecture | C | recall | 21/22 (95.5%, 95% CI 78.2-99.2%) | 17/22 (77.3%, 95% CI 56.6-89.9%) | +18.2 | WEAK_ENDORSE |
| project-researcher:pitfalls | C | recall | 22/22 (100.0%, 95% CI 85.1-100.0%) | 21/22 (95.5%, 95% CI 78.2-99.2%) | +4.5 | WEAK_ENDORSE |

## Roles

### verifier (batch A): WEAK_ENDORSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 18/18 | 18/18 |
| detection (primary) | 9/9 (100.0%, 95% CI 70.1-100.0%) | 9/9 (100.0%, 95% CI 70.1-100.0%) |
| false_pass | 0/9 (0.0%, 95% CI 0.0-29.9%) | 0/9 (0.0%, 95% CI 0.0-29.9%) |
| false_fail | 0/9 (0.0%, 95% CI 0.0-29.9%) | 0/9 (0.0%, 95% CI 0.0-29.9%) |
| abstain | 0/18 (0.0%, 95% CI 0.0-17.6%) | 0/18 (0.0%, 95% CI 0.0-17.6%) |
| detected_unnamed | 0/9 (0.0%, 95% CI 0.0-29.9%) | 0/9 (0.0%, 95% CI 0.0-29.9%) |
| detection_split.evidence_flagged | 6/6 (100.0%, 95% CI 61.0-100.0%) | 6/6 (100.0%, 95% CI 61.0-100.0%) |
| detection_split.judgment_only | 3/3 (100.0%, 95% CI 43.8-100.0%) | 3/3 (100.0%, 95% CI 43.8-100.0%) |
| cost (USD) | 0.18 | 2.50 |
| mean wall time | 24.4 s | 18.9 s |

Reasons:

- within margin: Haiku detection 9/9 (100.0%) vs Sonnet 9/9 (100.0%) (+0.0 points); zero Haiku false passes in A (0/9); small n: a weak endorsement only

### job-checker (batch B): REFUSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 18/18 | 18/18 |
| detection (primary) | 9/12 (75.0%, 95% CI 46.8-91.1%) | 11/12 (91.7%, 95% CI 64.6-98.5%) |
| false_alarm | 0/6 (0.0%, 95% CI 0.0-39.0%) | 0/6 (0.0%, 95% CI 0.0-39.0%) |
| missed_as_pass | 2/12 (16.7%, 95% CI 4.7-44.8%) | 0/12 (0.0%, 95% CI 0.0-24.3%) |
| unrelated_blockers | 0 in 12 runs (0.00 per run) | 4 in 12 runs (0.33 per run) |
| abstain | 0/18 (0.0%, 95% CI 0.0-17.6%) | 0/18 (0.0%, 95% CI 0.0-17.6%) |
| detection_split.precheck_flagged | 3/3 (100.0%, 95% CI 43.8-100.0%) | 3/3 (100.0%, 95% CI 43.8-100.0%) |
| detection_split.judgment_only | 6/9 (66.7%, 95% CI 35.4-87.9%) | 8/9 (88.9%, 95% CI 56.5-98.0%) |
| cost (USD) | 0.06 | 1.07 |
| mean wall time | 14.9 s | 15.2 s |

Reasons:

- margin: Haiku detection 9/12 (75.0%) is 16.7 points below Sonnet 11/12 (91.7%) (more than 10)

### ui-evaluator (batch D): WEAK_ENDORSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 60/60 | 60/60 |
| accuracy (primary) | 18/20 (90.0%, 95% CI 69.9-97.2%) | 20/20 (100.0%, 95% CI 83.9-100.0%) |
| broken_missed | 1/13 (7.7%, 95% CI 1.4-33.3%) | 0/13 (0.0%, 95% CI 0.0-22.8%) |
| false_fail | 1/7 (14.3%, 95% CI 2.6-51.3%) | 0/7 (0.0%, 95% CI 0.0-35.4%) |
| split_rate | 8/20 (40.0%, 95% CI 21.9-61.3%) | 2/20 (10.0%, 95% CI 2.8-30.1%) |
| engine_escalations | 4/7 (57.1%, 95% CI 25.0-84.2%) | 1/7 (14.3%, 95% CI 2.6-51.3%) |
| engine_reviews | 3/7 (42.9%, 95% CI 15.8-75.0%) | 1/7 (14.3%, 95% CI 2.6-51.3%) |
| sample_accuracy | 48/60 (80.0%, 95% CI 68.2-88.2%) | 58/60 (96.7%, 95% CI 88.6-99.1%) |
| accuracy_by_defect_type.blank_empty | 2/2 (100.0%, 95% CI 34.2-100.0%) | 2/2 (100.0%, 95% CI 34.2-100.0%) |
| accuracy_by_defect_type.broken_layout | 1/1 (100.0%, 95% CI 20.7-100.0%) | 1/1 (100.0%, 95% CI 20.7-100.0%) |
| accuracy_by_defect_type.contrast_legibility | 2/2 (100.0%, 95% CI 34.2-100.0%) | 2/2 (100.0%, 95% CI 34.2-100.0%) |
| accuracy_by_defect_type.misalignment | 1/2 (50.0%, 95% CI 9.5-90.5%) | 2/2 (100.0%, 95% CI 34.2-100.0%) |
| accuracy_by_defect_type.overflow | 4/4 (100.0%, 95% CI 51.0-100.0%) | 4/4 (100.0%, 95% CI 51.0-100.0%) |
| accuracy_by_defect_type.overlap_zindex | 2/2 (100.0%, 95% CI 34.2-100.0%) | 2/2 (100.0%, 95% CI 34.2-100.0%) |
| accuracy_by_defect_type.none | 6/7 (85.7%, 95% CI 48.7-97.4%) | 7/7 (100.0%, 95% CI 64.6-100.0%) |
| accuracy_by_severity.high | 9/9 (100.0%, 95% CI 70.1-100.0%) | 9/9 (100.0%, 95% CI 70.1-100.0%) |
| accuracy_by_severity.medium | 3/4 (75.0%, 95% CI 30.1-95.4%) | 4/4 (100.0%, 95% CI 51.0-100.0%) |
| accuracy_by_severity.none | 6/7 (85.7%, 95% CI 48.7-97.4%) | 7/7 (100.0%, 95% CI 64.6-100.0%) |
| cost (USD) | 0.04 | 0.69 |
| mean wall time | 11.9 s | 9.8 s |

Reasons:

- within margin: Haiku accuracy 18/20 (90.0%) vs Sonnet 20/20 (100.0%) (-10.0 points); zero Haiku false passes in A (0/9); small n: a weak endorsement only

### codebase-mapper:tech (batch C): WEAK_ENDORSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 4/4 | 4/4 |
| recall (primary) | 45/46 (97.8%, 95% CI 88.7-99.6%) | 46/46 (100.0%, 95% CI 92.3-100.0%) |
| error | 1/46 (2.2%, 95% CI 0.4-11.3%) | 0/46 (0.0%, 95% CI 0.0-7.7%) |
| missing | 0/46 (0.0%, 95% CI 0.0-7.7%) | 0/46 (0.0%, 95% CI 0.0-7.7%) |
| fabrications | 17 in 4 runs (4.25 per run) | 41 in 4 runs (10.25 per run) |
| recall_by_codebase.synthetic | 22/22 (100.0%, 95% CI 85.1-100.0%) | 22/22 (100.0%, 95% CI 85.1-100.0%) |
| recall_by_codebase.fleet | 23/24 (95.8%, 95% CI 79.8-99.3%) | 24/24 (100.0%, 95% CI 86.2-100.0%) |
| fabrications_by_codebase.synthetic | 5 in 2 runs (2.50 per run) | 3 in 2 runs (1.50 per run) |
| fabrications_by_codebase.fleet | 12 in 2 runs (6.00 per run) | 38 in 2 runs (19.00 per run) |
| cost (USD) | 0.06 | 0.61 |
| mean wall time | 49.4 s | 32.4 s |

Reasons:

- within margin: Haiku recall 45/46 (97.8%) vs Sonnet 46/46 (100.0%) (-2.2 points); fabrications 4.25 vs 10.25 per run; zero Haiku false passes in A (0/9); small n: a weak endorsement only

### codebase-mapper:arch (batch C): REFUSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 4/4 | 4/4 |
| recall (primary) | 41/46 (89.1%, 95% CI 77.0-95.3%) | 39/46 (84.8%, 95% CI 71.8-92.4%) |
| error | 1/46 (2.2%, 95% CI 0.4-11.3%) | 1/46 (2.2%, 95% CI 0.4-11.3%) |
| missing | 4/46 (8.7%, 95% CI 3.4-20.3%) | 6/46 (13.0%, 95% CI 6.1-25.7%) |
| fabrications | 12 in 4 runs (3.00 per run) | 3 in 4 runs (0.75 per run) |
| recall_by_codebase.synthetic | 21/22 (95.5%, 95% CI 78.2-99.2%) | 20/22 (90.9%, 95% CI 72.2-97.5%) |
| recall_by_codebase.fleet | 20/24 (83.3%, 95% CI 64.1-93.3%) | 19/24 (79.2%, 95% CI 59.5-90.8%) |
| fabrications_by_codebase.synthetic | 6 in 2 runs (3.00 per run) | 2 in 2 runs (1.00 per run) |
| fabrications_by_codebase.fleet | 6 in 2 runs (3.00 per run) | 1 in 2 runs (0.50 per run) |
| cost (USD) | 0.07 | 0.55 |
| mean wall time | 65.5 s | 37.9 s |

Reasons:

- fabrications: Haiku 3.00 per run vs Sonnet 0.75 (+2.25, above +0.50)

### codebase-mapper:quality (batch C): REFUSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 4/4 | 3/4 |
| recall (primary) | 38/44 (86.4%, 95% CI 73.3-93.6%) | 29/33 (87.9%, 95% CI 72.7-95.2%) |
| error | 3/44 (6.8%, 95% CI 2.3-18.2%) | 1/33 (3.0%, 95% CI 0.5-15.3%) |
| missing | 3/44 (6.8%, 95% CI 2.3-18.2%) | 3/33 (9.1%, 95% CI 3.1-23.6%) |
| fabrications | 8 in 4 runs (2.00 per run) | 4 in 3 runs (1.33 per run) |
| recall_by_codebase.synthetic | 21/22 (95.5%, 95% CI 78.2-99.2%) | 20/22 (90.9%, 95% CI 72.2-97.5%) |
| recall_by_codebase.fleet | 17/22 (77.3%, 95% CI 56.6-89.9%) | 9/11 (81.8%, 95% CI 52.3-94.9%) |
| fabrications_by_codebase.synthetic | 2 in 2 runs (1.00 per run) | 4 in 2 runs (2.00 per run) |
| fabrications_by_codebase.fleet | 6 in 2 runs (3.00 per run) | 0 in 1 runs (0.00 per run) |
| cost (USD) | 0.12 | 0.44 |
| mean wall time | 111.2 s | 41.3 s |

Reasons:

- fabrications: Haiku 2.00 per run vs Sonnet 1.33 (+0.67, above +0.50)
- excluded (not in n): C-map-quality-b-s-1 (impaired: a permission denial blocked the agent's own runtime files (~/.claude) on its final attempt; excluded from the model rates (post-hoc 4))

### codebase-mapper:concerns (batch C): REFUSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 4/4 | 4/4 |
| recall (primary) | 21/38 (55.3%, 95% CI 39.7-69.9%) | 26/38 (68.4%, 95% CI 52.5-80.9%) |
| error | 2/38 (5.3%, 95% CI 1.5-17.3%) | 0/38 (0.0%, 95% CI 0.0-9.2%) |
| missing | 15/38 (39.5%, 95% CI 25.6-55.3%) | 12/38 (31.6%, 95% CI 19.1-47.5%) |
| fabrications | 5 in 4 runs (1.25 per run) | 6 in 4 runs (1.50 per run) |
| recall_by_codebase.synthetic | 14/16 (87.5%, 95% CI 64.0-96.5%) | 16/16 (100.0%, 95% CI 80.6-100.0%) |
| recall_by_codebase.fleet | 7/22 (31.8%, 95% CI 16.4-52.7%) | 10/22 (45.5%, 95% CI 26.9-65.3%) |
| fabrications_by_codebase.synthetic | 0 in 2 runs (0.00 per run) | 1 in 2 runs (0.50 per run) |
| fabrications_by_codebase.fleet | 5 in 2 runs (2.50 per run) | 5 in 2 runs (2.50 per run) |
| cost (USD) | 0.05 | 0.31 |
| mean wall time | 61.7 s | 25.5 s |

Reasons:

- margin: Haiku recall 21/38 (55.3%) is 13.2 points below Sonnet 26/38 (68.4%) (more than 10)

### project-researcher:stack (batch C): INSUFFICIENT

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 2/2 | 0/2 |
| recall (primary) | 18/20 (90.0%, 95% CI 69.9-97.2%) | 0/0 (n/a) |
| error | 0/20 (0.0%, 95% CI 0.0-16.1%) | 0/0 (n/a) |
| missing | 2/20 (10.0%, 95% CI 2.8-30.1%) | 0/0 (n/a) |
| fabrications | 1 in 2 runs (0.50 per run) | 0 in 0 runs (n/a per run) |
| cost (USD) | 0.26 | 0.00 |
| mean wall time | 102.9 s | n/a |

Reasons:

- sonnet scored 0 of 2 planned runs (below 2/3)
- excluded (not in n): C-res-stack-s-1 (model_ran false: the run did not use the requested model), C-res-stack-s-2 (model_ran false: the run did not use the requested model)

### project-researcher:features (batch C): WEAK_ENDORSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 2/2 | 2/2 |
| recall (primary) | 21/22 (95.5%, 95% CI 78.2-99.2%) | 22/22 (100.0%, 95% CI 85.1-100.0%) |
| error | 1/22 (4.5%, 95% CI 0.8-21.8%) | 0/22 (0.0%, 95% CI 0.0-14.9%) |
| missing | 0/22 (0.0%, 95% CI 0.0-14.9%) | 0/22 (0.0%, 95% CI 0.0-14.9%) |
| fabrications | 1 in 2 runs (0.50 per run) | 0 in 2 runs (0.00 per run) |
| cost (USD) | 0.11 | 0.27 |
| mean wall time | 77.2 s | 64.6 s |

Reasons:

- within margin: Haiku recall 21/22 (95.5%) vs Sonnet 22/22 (100.0%) (-4.5 points); fabrications 0.50 vs 0.00 per run; zero Haiku false passes in A (0/9); small n: a weak endorsement only

### project-researcher:architecture (batch C): WEAK_ENDORSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 2/2 | 2/2 |
| recall (primary) | 21/22 (95.5%, 95% CI 78.2-99.2%) | 17/22 (77.3%, 95% CI 56.6-89.9%) |
| error | 0/22 (0.0%, 95% CI 0.0-14.9%) | 0/22 (0.0%, 95% CI 0.0-14.9%) |
| missing | 1/22 (4.5%, 95% CI 0.8-21.8%) | 5/22 (22.7%, 95% CI 10.1-43.4%) |
| fabrications | 0 in 2 runs (0.00 per run) | 0 in 2 runs (0.00 per run) |
| cost (USD) | 0.08 | 0.27 |
| mean wall time | 63.2 s | 60.8 s |

Reasons:

- within margin: Haiku recall 21/22 (95.5%) vs Sonnet 17/22 (77.3%) (+18.2 points); fabrications 0.00 vs 0.00 per run; zero Haiku false passes in A (0/9); small n: a weak endorsement only

### project-researcher:pitfalls (batch C): WEAK_ENDORSE

| Metric | Haiku | Sonnet |
|---|---|---|
| runs scored / planned | 2/2 | 2/2 |
| recall (primary) | 22/22 (100.0%, 95% CI 85.1-100.0%) | 21/22 (95.5%, 95% CI 78.2-99.2%) |
| error | 0/22 (0.0%, 95% CI 0.0-14.9%) | 0/22 (0.0%, 95% CI 0.0-14.9%) |
| missing | 0/22 (0.0%, 95% CI 0.0-14.9%) | 1/22 (4.5%, 95% CI 0.8-21.8%) |
| fabrications | 0 in 2 runs (0.00 per run) | 0 in 2 runs (0.00 per run) |
| cost (USD) | 0.09 | 0.37 |
| mean wall time | 98.6 s | 92.4 s |

Reasons:

- within margin: Haiku recall 22/22 (100.0%) vs Sonnet 21/22 (95.5%) (+4.5 points); fabrications 0.00 vs 0.00 per run; zero Haiku false passes in A (0/9); small n: a weak endorsement only

## Proposals

Proposals are text for the user's decision (TRD 81-19). They follow `81-DECISION-RULE.md` section 7.

- verifier (WEAK_ENDORSE): no proposal. verdict_floor keeps sonnet; evidence weakly supports haiku.
- job-checker (REFUSE): no proposal. no profile runs haiku for job-checker; the refusal confirms the current tiers.
- ui-evaluator (WEAK_ENDORSE): start ui-evaluator at haiku on budget/balanced, escalate on split votes (split rate 40.0%) (aoforge-stack.json models.ui-evaluator).
- codebase-mapper:tech (WEAK_ENDORSE): no proposal. codebase-mapper already runs haiku on balanced, budget; the evidence weakly supports it.
- codebase-mapper:arch (REFUSE): raise codebase-mapper balanced, budget to sonnet (model-profiles.json agents.codebase-mapper). Note: the codebase-mapper row is shared by every codebase-mapper focus without an override.
- codebase-mapper:quality (REFUSE): raise codebase-mapper balanced, budget to sonnet (model-profiles.json agents.codebase-mapper). Note: the codebase-mapper row is shared by every codebase-mapper focus without an override.
- codebase-mapper:concerns (REFUSE): raise codebase-mapper focus concerns budget to sonnet (model-profiles.json focus.codebase-mapper.concerns).
- project-researcher:stack (INSUFFICIENT): no proposal.
- project-researcher:features (WEAK_ENDORSE): no proposal. project-researcher already runs haiku on budget; the evidence weakly supports it.
- project-researcher:architecture (WEAK_ENDORSE): lower project-researcher focus architecture budget to haiku (weak endorsement; quality and balanced unchanged) (model-profiles.json focus.project-researcher.architecture).
- project-researcher:pitfalls (WEAK_ENDORSE): lower project-researcher focus pitfalls budget to haiku (weak endorsement; quality and balanced unchanged) (model-profiles.json focus.project-researcher.pitfalls).

## Spend

| Batch | Status | Spent (USD) | Runs |
|---|---|---|---|
| A | complete | 2.69 | 37 |
| B | complete | 1.13 | 36 |
| D | complete | 0.74 | 24 |
| C | complete | 7.42 | 96 |

## Batch notes

- A: unpublished verdicts: 0 of 36 scored runs
- A: evidence_flags split of detection (verify objective-evidence reports the gap on A5, A6; judgment only on A4): haiku 6/6 evidence-flagged, 3/3 judgment-only; sonnet 6/6 evidence-flagged, 3/3 judgment-only
- A: ignored run dirs: A-A1-haiku-r1.prev-1, A-A1-haiku-r1.prev-2, A-A1-haiku-r1.prev-3, A-A1-haiku-r1.prev-4, A-A1-haiku-r2.prev-1, A-A1-haiku-r2.prev-2, A-A1-haiku-r2.prev-3, A-A1-haiku-r2.prev-4, A-A1-haiku-r3.prev-1, A-A1-haiku-r3.prev-2, A-A1-haiku-r3.prev-3, A-A1-haiku-r3.prev-4, A-A1-sonnet-r1.prev-1, A-A1-sonnet-r1.prev-2, A-A1-sonnet-r1.prev-3, A-A1-sonnet-r1.prev-4, A-A1-sonnet-r2.prev-1, A-A1-sonnet-r2.prev-2, A-A1-sonnet-r2.prev-3, A-A1-sonnet-r2.prev-4, A-A1-sonnet-r3.prev-1, A-A1-sonnet-r3.prev-2, A-A1-sonnet-r3.prev-3, A-A1-sonnet-r3.prev-4, A-A2-haiku-r1.prev-1, A-A2-haiku-r1.prev-2, A-A2-haiku-r1.prev-3, A-A2-haiku-r1.prev-4, A-A2-haiku-r2.prev-1, A-A2-haiku-r2.prev-2, A-A2-haiku-r2.prev-3, A-A2-haiku-r2.prev-4, A-A2-haiku-r3.prev-1, A-A2-haiku-r3.prev-2, A-A2-haiku-r3.prev-3, A-A2-haiku-r3.prev-4, A-A2-sonnet-r1.prev-1, A-A2-sonnet-r1.prev-2, A-A2-sonnet-r1.prev-3, A-A2-sonnet-r2.prev-1, A-A2-sonnet-r2.prev-2, A-A2-sonnet-r2.prev-3, A-A2-sonnet-r2.prev-4, A-A2-sonnet-r3.prev-1, A-A2-sonnet-r3.prev-2, A-A2-sonnet-r3.prev-3, A-A2-sonnet-r3.prev-4, A-A3-haiku-r1.prev-1, A-A3-haiku-r1.prev-2, A-A3-haiku-r1.prev-3, A-A3-haiku-r1.prev-4, A-A3-haiku-r2.prev-1, A-A3-haiku-r2.prev-2, A-A3-haiku-r2.prev-3, A-A3-haiku-r2.prev-4, A-A3-haiku-r3.prev-1, A-A3-haiku-r3.prev-2, A-A3-haiku-r3.prev-3, A-A3-haiku-r3.prev-4, A-A3-sonnet-r1.prev-1, A-A3-sonnet-r1.prev-2, A-A3-sonnet-r1.prev-3, A-A3-sonnet-r1.prev-4, A-A3-sonnet-r2.prev-1, A-A3-sonnet-r2.prev-2, A-A3-sonnet-r2.prev-3, A-A3-sonnet-r2.prev-4, A-A3-sonnet-r3.prev-1, A-A3-sonnet-r3.prev-2, A-A3-sonnet-r3.prev-3, A-A3-sonnet-r3.prev-4, A-A4-haiku-r1.prev-1, A-A4-haiku-r1.prev-2, A-A4-haiku-r1.prev-3, A-A4-haiku-r2.prev-1, A-A4-haiku-r2.prev-2, A-A4-haiku-r2.prev-3, A-A4-haiku-r2.prev-4, A-A4-haiku-r3.prev-1, A-A4-haiku-r3.prev-2, A-A4-haiku-r3.prev-3, A-A4-haiku-r3.prev-4, A-A4-sonnet-r1.prev-1, A-A4-sonnet-r1.prev-2, A-A4-sonnet-r1.prev-3, A-A4-sonnet-r1.prev-4, A-A4-sonnet-r2.prev-1, A-A4-sonnet-r2.prev-2, A-A4-sonnet-r2.prev-3, A-A4-sonnet-r2.prev-4, A-A4-sonnet-r3.prev-1, A-A4-sonnet-r3.prev-2, A-A4-sonnet-r3.prev-3, A-A4-sonnet-r3.prev-4, A-A5-haiku-r1.prev-1, A-A5-haiku-r1.prev-2, A-A5-haiku-r1.prev-3, A-A5-haiku-r1.prev-4, A-A5-haiku-r2.prev-1, A-A5-haiku-r2.prev-2, A-A5-haiku-r2.prev-3, A-A5-haiku-r2.prev-4, A-A5-haiku-r3.prev-1, A-A5-haiku-r3.prev-2, A-A5-haiku-r3.prev-3, A-A5-haiku-r3.prev-4, A-A5-sonnet-r1.prev-1, A-A5-sonnet-r1.prev-2, A-A5-sonnet-r1.prev-3, A-A5-sonnet-r2.prev-1, A-A5-sonnet-r2.prev-2, A-A5-sonnet-r2.prev-3, A-A5-sonnet-r2.prev-4, A-A5-sonnet-r3.prev-1, A-A5-sonnet-r3.prev-2, A-A5-sonnet-r3.prev-3, A-A5-sonnet-r3.prev-4, A-A6-haiku-r1.prev-1, A-A6-haiku-r1.prev-2, A-A6-haiku-r1.prev-3, A-A6-haiku-r1.prev-4, A-A6-haiku-r2.prev-1, A-A6-haiku-r2.prev-2, A-A6-haiku-r2.prev-3, A-A6-haiku-r2.prev-4, A-A6-haiku-r3.prev-1, A-A6-haiku-r3.prev-2, A-A6-haiku-r3.prev-3, A-A6-haiku-r3.prev-4, A-A6-sonnet-r1.prev-1, A-A6-sonnet-r1.prev-2, A-A6-sonnet-r1.prev-3, A-A6-sonnet-r1.prev-4, A-A6-sonnet-r2.prev-1, A-A6-sonnet-r2.prev-2, A-A6-sonnet-r2.prev-3, A-A6-sonnet-r2.prev-4, A-A6-sonnet-r3.prev-1, A-A6-sonnet-r3.prev-2, A-A6-sonnet-r3.prev-3, A-A6-sonnet-r3.prev-4
- B: precheck_flags split of detection (verify trd-pre flags B4; judgment only on B3, B5, B6): haiku 3/3 precheck-flagged, 6/9 judgment-only; sonnet 3/3 precheck-flagged, 8/9 judgment-only
- B: Structured Issues YAML not parseable, scored from the Markdown sections: 1 (B-B5-haiku-r2)
- B: ignored run dirs: B-B1-haiku-r1.prev-1, B-B1-haiku-r1.prev-2, B-B1-haiku-r2.prev-1, B-B1-haiku-r2.prev-2, B-B1-haiku-r3.prev-1, B-B1-haiku-r3.prev-2, B-B1-sonnet-r1.prev-1, B-B1-sonnet-r1.prev-2, B-B1-sonnet-r2.prev-1, B-B1-sonnet-r2.prev-2, B-B1-sonnet-r3.prev-1, B-B1-sonnet-r3.prev-2, B-B2-haiku-r1.prev-1, B-B2-haiku-r1.prev-2, B-B2-haiku-r2.prev-1, B-B2-haiku-r2.prev-2, B-B2-haiku-r3.prev-1, B-B2-haiku-r3.prev-2, B-B2-sonnet-r1.prev-1, B-B2-sonnet-r1.prev-2, B-B2-sonnet-r2.prev-1, B-B2-sonnet-r2.prev-2, B-B2-sonnet-r3.prev-1, B-B2-sonnet-r3.prev-2, B-B3-haiku-r1.prev-1, B-B3-haiku-r1.prev-2, B-B3-haiku-r2.prev-1, B-B3-haiku-r2.prev-2, B-B3-haiku-r3.prev-1, B-B3-haiku-r3.prev-2, B-B3-sonnet-r1.prev-1, B-B3-sonnet-r1.prev-2, B-B3-sonnet-r2.prev-1, B-B3-sonnet-r2.prev-2, B-B3-sonnet-r3.prev-1, B-B3-sonnet-r3.prev-2, B-B4-haiku-r1.prev-1, B-B4-haiku-r1.prev-2, B-B4-haiku-r2.prev-1, B-B4-haiku-r2.prev-2, B-B4-haiku-r3.prev-1, B-B4-haiku-r3.prev-2, B-B4-sonnet-r1.prev-1, B-B4-sonnet-r1.prev-2, B-B4-sonnet-r2.prev-1, B-B4-sonnet-r2.prev-2, B-B4-sonnet-r3.prev-1, B-B4-sonnet-r3.prev-2, B-B5-haiku-r1.prev-1, B-B5-haiku-r1.prev-2, B-B5-haiku-r2.prev-1, B-B5-haiku-r2.prev-2, B-B5-haiku-r3.prev-1, B-B5-haiku-r3.prev-2, B-B5-sonnet-r1.prev-1, B-B5-sonnet-r1.prev-2, B-B5-sonnet-r2.prev-1, B-B5-sonnet-r2.prev-2, B-B5-sonnet-r3.prev-1, B-B5-sonnet-r3.prev-2, B-B6-haiku-r1.prev-1, B-B6-haiku-r1.prev-2, B-B6-haiku-r2.prev-1, B-B6-haiku-r2.prev-2, B-B6-haiku-r3.prev-1, B-B6-haiku-r3.prev-2, B-B6-sonnet-r1.prev-1, B-B6-sonnet-r1.prev-2, B-B6-sonnet-r2.prev-1, B-B6-sonnet-r2.prev-2, B-B6-sonnet-r3.prev-1, B-B6-sonnet-r3.prev-2
- D: One session judges every state of a surface (about five), so the judge can compare states; the engine judges each state in its own call. Mitigations: the state order is shuffled per repeat (seed = repeat x 1000 + surface index), each state is judged against its own expected text, and the prompt says to judge each screenshot on its own.
- D: engine_escalations is the pre-registered rule (ok-labelled states with split votes); engine_reviews counts the ok-labelled states the engine's scoreState would put in review. accuracy_by_defect_type and accuracy_by_severity group broken-labelled states by the key's primary defect type and severity; none is the ok-labelled states.
- C: The mechanical path check applies to codebase-mapper runs only; a project-researcher run has no codebase to check against.
- C: The mechanical path check exempts negated claims (81-DECISION-RULE.md, post-hoc 2): a back-ticked path that is not in the codebase counts unless every mention of it says it is absent ("there is no `go.sum`"); flagged and exempt paths are listed in the eval root (spotcheck/C-paths.md).
- C: grader evidence quotes not found verbatim in the document: 1 of 437 (checked mechanically for every found or wrong verdict).
- C: Grader spend on the 45 scored runs: $2.88 (also included in the ledger).
- C: Post-hoc 4: 1 run impaired on the final attempt (a permission denial blocked the agent's own ~/.claude runtime files, after one re-run); excluded from the model rates and listed in `impaired` (haiku 0, sonnet 1).
- C: A seeded spot-check sample of grader verdicts and the flagged-path review were written to the eval root (spotcheck/C.md and spotcheck/C-paths.md), not to --out: check them by hand.

No tier assignment was changed by objective 81; proposals await the user's decision.

<!-- Everything above this line is generated by `score.cjs --report`. Everything below is written by hand (TRD 81-19). -->

---

The sections below were written by hand in TRD 81-19 (2026-10-17). The pre-registered outcomes above stand as
rendered. Every view below that differs from them is labelled **post-hoc**, sits beside the registered result and
never replaces it.

## Pre-registration check

`node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`
exited 0 before this report was rendered: 86 files match the manifest, sha256 `70f92eca...` (the manifest
re-frozen by post-hoc 4).

## Spend

From `<eval root>/ledger.json`. This TRD made no live run and spent $0.

| Batch | Ledger entries | Spent (USD) | Batch cap (USD) |
|---|---|---|---|
| A verifier | 37 (36 runs plus the re-keyed first attempt of post-hoc 1) | 2.691417 | 10 |
| B job-checker | 36 | 1.132036 | 10 |
| D UI judge | 24 sessions | 0.736393 | 5 |
| E 3.0.0 vs 3.1.0 (76-08) | 10 | 28.068392 | 55 |
| C mapper and researcher | 96 (48 agent runs, 2 impaired first attempts, 46 graders) | 7.424253 | none |
| **Total** | **203** | **40.052491** | **100 (global)** |

- The largest overshoot over any run's cap was $0, on all 203 entries.
- The largest charge relative to its cap was E's q30-r1: $2.0647 of $6 (34.4%).
- Haiku cost about 1/14 of Sonnet per verifier run, 1/17 per job-checker run, 1/16 per judge session and about 30%
  per mapper or researcher run.

## Spot-checks

| Batch | Sample (seed 81) | Agreement | File |
|---|---|---|---|
| A | 6 runs | 6 of 6 agree with the scorer | `results/A-spotcheck.md` |
| B | 6 runs | 5 of 6. The disagreement is a scorer wording miss (B-B6-haiku-r2); a second, the same miss on B-B6-sonnet-r2, was found while reading B6 | `results/B-spotcheck.md` |
| D | 4 states, PNGs viewed | 4 of 4 labels hold. Both states either model got wrong (d02, d17) depend on the one-session-per-surface design | `results/D-spotcheck.md` |
| C | 6 grader verdicts | 6 of 6 agree with the Sonnet grader. The flagged-path review found that the mechanical path check counts tokens that are not files (below) | `results/C-spotcheck.md` |

## Post-hoc readings beside the registered outcomes

None of these changes an outcome above. Each is a reading the user asked for or a scorer artefact found by a
spot-check.

### B: the two scorer wording misses (post-hoc)

The B scorer matches the answer key's `any_of` phrases as exact substrings. B-B6-haiku-r2 and B-B6-sonnet-r2 both
name the planted gap (an unknown `--format` value is not handled) in other words, so the scorer counted both as
missed. The frozen scorer was not changed.

| Detection | Haiku | Sonnet | Haiku minus Sonnet | Outcome |
|---|---|---|---|---|
| Scored (registered) | 9/12 (75.0%, 95% CI 46.8-91.1%) | 11/12 (91.7%, 95% CI 64.6-98.5%) | -16.7 | REFUSE |
| Spot-check corrected (post-hoc) | 10/12 (83.3%, 95% CI 55.2-95.3%) | 12/12 (100.0%, 95% CI 75.7-100.0%) | -16.7 | REFUSE |

Judgment-only detection moves from 6/9 vs 8/9 to 7/9 vs 9/9. Haiku's two `missed_as_pass` runs stay misses: both
published VERIFICATION PASSED on the uncovered-success-criterion set. No B6 return of either model cites the success
criterion itself (B-spotcheck.md, sensitivity line 2).

### D: the one-session-per-surface design (post-hoc)

Each D session judged every state of one surface, so a session could compare a broken state with its ok baseline.
Haiku's false fail (d02) gave a sibling state's defect to the wrong state. Sonnet's one subtle hit (d17) compared the
state with its baseline. Without d02 and d17 both models are 18/18 (100.0%, 95% CI 82.4-100.0%), and Haiku's
engine escalations are 3/6. The registered result (18/20 vs 20/20, exactly 10 points, WEAK_ENDORSE) stands.

### C: the mechanical fabrication check counts Go module paths as invented paths (post-hoc)

The mechanical path check counts every back-ticked token that looks like a repository path and does not exist in
the run's codebase. It therefore counts Go module import paths (the `owner/repo/vN` form) as invented files. That
inflates the fabrication counts, most of all for Sonnet's mapper:tech runs on the fleet codebase, because Sonnet lists
more dependencies. Of the 86 mechanical path fabrications in scored mapper runs, 39 are module paths named in the
codebase's `go.mod` or `go.sum` (Sonnet 34 of 45, Haiku 5 of 41). Sonnet's fleet tech runs alone carry 33 of their
38 fabrications as module paths: 19.00 per run as scored, 2.50 with module paths excluded (Haiku: 6.00 and 5.00).

A path counts as a module path here when it equals, or is a `/`-bounded suffix of, a module path in that codebase's
`go.mod` or `go.sum`. The count is mechanical (scratch script, eval root only).

Three readings of the fabrication bound (fabrications per run, Haiku vs Sonnet; step 5 refuses at more than +0.50).
Recall is unchanged in every column.

| Role | Registered (grader + mechanical) | Module paths excluded (post-hoc) | Grader only (post-hoc) | Flags read by hand + grader (post-hoc) |
|---|---|---|---|---|
| mapper:tech | 4.25 vs 10.25: WEAK_ENDORSE | 3.75 vs 2.00 (+1.75): REFUSE | 0.00 vs 0.75: WEAK_ENDORSE | 0.00 vs 0.75: WEAK_ENDORSE |
| mapper:arch | 3.00 vs 0.75 (+2.25): REFUSE | 3.00 vs 0.75 (+2.25): REFUSE | 0.00 vs 0.00: WEAK_ENDORSE | 0.75 vs 0.00 (+0.75): REFUSE; 0.75 vs 0.25 (+0.50, passes) if one borderline Sonnet path counts |
| mapper:quality | 2.00 vs 1.33 (+0.67): REFUSE | 2.00 vs 1.33 (+0.67): REFUSE | 0.00 vs 0.33: WEAK_ENDORSE | 0.00 vs 0.33: WEAK_ENDORSE |
| mapper:concerns | 1.25 vs 1.50; REFUSE on recall (-13.2) | 0.50 vs 1.25; REFUSE on recall | 0.25 vs 1.25; REFUSE on recall | 0.25 vs 1.25; REFUSE on recall |

**Flags read by hand.** One reader (the executor of this TRD) read each of the 86 flagged paths in context. Fleet
items are counted, not quoted. The categories:

| Category | Haiku | Sonnet |
|---|---|---|
| Module, repository or CI Action references (not files) | 9 (5 of them `go.mod`/`go.sum` modules) | 35 (34 modules) |
| Tokens that are not paths: identifiers such as `store.Save/Load`, suffix and naming conventions such as `_test.go`, placeholders such as `foo_test.go`, a platform string, environment variable names | 11 | 6 |
| Real things outside the source tree: the build output `bin/linkcheck` (gitignored), a CI-generated file, the agent's own template text (`.aoforge/STACK.md`) or output document, names quoted from code comments or a Makefile | 14 | 3 |
| New files the document proposes and says do not exist yet (for example `internal/api/handler_test.go`) | 2 | 1 (borderline: a "new route-level setting" location that also names an existing file name in another directory) |
| Negations the post-hoc 2 exemption missed ("`go.sum` not present", "No general ... package exists") | 2 | 0 |
| Files asserted to exist that do not, or are in another directory | 3 (all in one fleet arch run) | 0 |

So, read by hand, the mechanical check found 3 real path errors in 86 flags, all from one Haiku fleet arch run. The
registered mapper:quality refusal rests entirely on flags that are not fabrications. The mapper:arch refusal rests on
those three errors and is borderline. The mapper:tech weak endorsement survives the hand reading, but not the
module-paths-excluded reading, because what is left of Haiku's count after module paths go is also artefacts.

### C: Sonnet's project-researcher:stack cell (post-hoc sensitivity)

**Sonnet, project-researcher:stack: not scored (side-model exclusion, pre-registered 90% rule).** The CLI routed
about 18% of each run's output tokens to claude-haiku-5-5 as a side model, alongside the runs' WebFetch and
WebSearch calls (model share 0.818 and 0.819). `lib/result.cjs` (frozen) sets `model_ran` false below a 0.9 share, so
both runs were excluded, no grader ran, and the role is INSUFFICIENT.

Sensitivity, if both runs were included: the two documents were graded by hand against the frozen checklist
(`fixtures/C/checklists-researcher.json`, `stack`) with the grader prompt's rules. This TRD runs no live API call, so
the pre-registered Sonnet grader did not grade them.

| | Haiku (registered) | Sonnet (hand-graded, post-hoc) | Haiku minus Sonnet | Outcome if included |
|---|---|---|---|---|
| recall | 18/20 (90.0%, 95% CI 69.9-97.2%) | 19/20 (95.0%, 95% CI 76.4-99.1%) | -5.0 | WEAK_ENDORSE |
| fabrications per run | 0.50 | none identified by hand (versions not independently checked) | at most +0.50 | |

C-res-stack-s-1 found 10 of 10. C-res-stack-s-2 found 9 of 10: it never addresses ignore patterns (stack-08). Haiku's
0.50 per run cannot exceed any Sonnet count by more than 0.50, so the fabrication bound cannot refuse here. The
proposal would be none: project-researcher already runs Haiku on budget, and the stack dimension has no focus
override.

## Deviations from the pre-registration

Every change to a frozen file after the first live run is a post-hoc amendment (81-PREREG.md section 9). Each was
the user's decision, written test-first and re-frozen. None changed `decide.cjs`, the A, B or D scorers, or an answer
key.

| Amendment | When | What changed | Effect on the results |
|---|---|---|---|
| **Post-hoc 1**: relaxed init-tools check (81-PREREG 9.1) | 81-14, after A's first run | `runner.checkTools` accepts CLI 2.1.302's naming: Agent = Task, Grep and Glob served by Bash, Edit when Write is declared | Harness only. The stopped run `A-A1-haiku-r1` (a correct `passed`) was re-keyed to `@attempt1` with its $0.011115 kept and re-run as attempt 2. No scoring change. |
| **Post-hoc 2**: batch caps from the A pilot, and the C decisions (81-PREREG 9.2, 81-DECISION-RULE 9) | 81-14, after A's 4-run pilot | Batch caps A 10, B 10, D 5, E 55, C the remainder. The private fleet material left the eval root. C's research dimensions use project-researcher. The mechanical path check exempts negated claims. | Every batch ran to completion (no cap stop). The negation exemption removed 7 path counts (Haiku 5, Sonnet 2) and changed no outcome. The pilot runs were made under the old caps; none came near them. |
| **Post-hoc 3**: opaque run paths (81-PREREG 9.3) | 81-17, after E's build pilot | Every handed path (cwd, HOME, config, TMPDIR, work dir) moved under an opaque sandbox root that names neither the user nor the checkout | E's last 6 runs and all of C ran under the shorter path. First-turn input can differ by a few tokens; each version had one quick and one build run in each group, so the comparison stays balanced. No scoring change. |
| **Post-hoc 4**: access classes, impaired runs re-run once (81-PREREG 9.4) | 81-18, after 12 of C's 48 runs | A `~`-expansion denial or a guessed non-existent path is a non-escape; an existing real path outside the sandbox stops the batch; a run whose own runtime files were denied is re-run once, then excluded as impaired | C-map-arch-b-s-1 re-ran clean. C-map-quality-b-s-1 was impaired twice and is excluded, so Sonnet's mapper:quality has 3 of 4 runs (33 items). Its outcome is a fabrication-bound REFUSE either way, and 3 of 4 is above the 2/3 floor. |

Other deviations, none of which changed what a run saw or how it was scored:

- **81-14:** A's 4-run pilot was ordered by a shim batch dir outside the checkout that only re-exported the frozen
  module with a different order. A `run.test.cjs` assertion (a test, not frozen) was updated to the new A estimate.
- **81-15 and 81-16:** none. D's 2-run pilot used `--stop-after 2` on the frozen order. D's cap was not resized.
- **81-17:** b31-r2's Read of a guessed home that does not exist was judged not to be an escape (it was not denied
  and named no real path) and reported to the user. A post-hoc 3 test that used the scratchpad as an opaque base was
  fixed. An early claim that 3.0.0 always spawns the quick executor with no model was corrected: only q30-r1 did.
- **81-18:** C ran in chunks of 4 (`--stop-after 4`) so any stop would land between runs. A between-chunk scan was
  narrowed to access fields after it matched paths quoted inside documents. The sandbox root needed `chmod -R u+w`
  before deletion, because one researcher run downloaded Go modules into its sandbox HOME.
- **81-19 (this report):** the post-hoc readings above. No scorer, rule or result file was changed. The registered
  outcomes are the ones rendered by `score.cjs --report`.

## Limitations

- **n per role.**
  - A: 9 planted and 9 clean runs per model. Both models are at the ceiling (9/9 detection, 0/9 false passes, 0/9
    false fails), so A confirms the gate but does not separate the tiers.
  - B: 12 planted and 6 clean runs per model.
  - D: 20 states (60 samples) per model.
  - C mapper: 4 runs per focus per model, 33 to 46 checklist items. C researcher: 2 runs per dimension per model, 20 or
    22 items.
- **D judged one surface per session.** The engine judges one state per call. Both D disagreements depend on that
  difference.
- **C was graded by one Sonnet grader.** Its spot-check agreed 6 of 6. The mechanical path check is lexical, and its
  counts decide three of the four mapper outcomes (see the readings above).
- **The verifier and the job-checker are held at Sonnet by `verdict_floor`**, whatever the evidence says.
- **Scope.** The results are for Haiku 5.5 and Sonnet 5.5, on these fixtures (small synthetic fixtures and one fleet
  codebase), under Claude Code 2.1.302. Opus was not compared. The debugger's starting tier was not measured.
- **Spend control.** The per-run cap (`--max-budget-usd`) did not bound spend. No run reached 35% of its cap (the
  largest, q30-r1, reached 34.4%) and the largest overshoot was $0. What bounded spend was the ledger: its reserve
  rule before each spawn, and its charge of the larger of reported and transcript-priced cost. Batch E showed that
  the CLI's reported cost includes subagent spend (subagents were 74-88% of each pilot run). Whether the cap bounds
  subagent spend is untested.
- **Side models.** The CLI used Haiku as a side model for web tools in Sonnet's stack-research runs. The registered
  0.9 rule excluded both. A design that needs WebFetch or WebSearch will meet this again.

## 76-08: the 3.0.0 vs 3.1.0 measurement

The full report is `81-MEASUREMENT.md` (batch E, `results/E.json`). The static comparison is `81-STATIC-PROMPT.md`
(TRD 81-07).

- **Workload.** The `notekit` fixture, per version 3 `/aoforge:quick` and 2 `/aoforge:build` runs, opus session,
  balanced profile, ABBA order. 10 of 10 runs ended ok.
- **Outcomes do not move.** Every run passed its hidden acceptance with green tests, and every build reached a passed
  verification. Both versions planned the same TRD counts.
- **First-turn input (the resident prompt) is cut in 3.1.0**, median per spawn: executor -19% (-5,612 quick, -5,745
  build), verifier -19% (-5,578), planner -8% to -9% (-2,631, -2,488), orchestrator -3% to -4%, job-checker unchanged.
  The live cuts exceed the 81-07 static estimates (executor -2,974, verifier -4,230, planner -1,598 tokens).
- **81-07 static comparison.** Core resident bytes 318,035 to 271,757 (-14.55%; -12.63% like for like). Verifier
  -35.2%, executor -18.4%, planner -10.4%, security-auditor -34.3%.
- **Whole-run cost moved less, and not in one direction** (reported cost, median). Quick: $1.59 vs $1.77 (-10%).
  Build: $4.72 vs $4.25 (+11%).
  - The build increase comes from the planner, which used 67% more tokens (2.21M vs 1.32M, +54% cost), and the
    executors, which used 20% more tokens. The verifier's cost halved: 3.0.0 spawned an extra opus verifier.
  - In quick runs the 3.1.0 orchestrator used 52% more tokens and the executor got cheaper.
  - n is 3 quick and 2 build runs per version. The 3.0.0 quick runs alone range from $1.41 to $2.06, so deltas of a
    few percent are inside the run-to-run spread.
- **The CLI's reported cost includes subagent spend** (all four pilots). No run reached 35% of its cap, so whether
  the per-run cap bounds subagent spend is untested.
- **Starting tiers (MEF-06's start-tier half) are not lowered.** The UI judge's starting tier has evidence from D: a
  weak endorsement exactly at the bound, with a 40% split rate. That is proposal P1 below, awaiting the user's
  decision. The debugger's starting tier was not measured by this design. Tiers are unchanged.

Follow-ups from 76-08 (findings, not tier changes; this TRD files no todo for them):

1. **3.1.0 planner token growth on builds:** +67% tokens and +54% cost at the median (n 2 per version).
2. **3.1.0 agents guess an absolute home for `~` reads.** The Read tool does not expand `~`, and the 3.1.0
   executor's "read these files yourself" list names `~` paths. In both 3.1.0 builds the TRD 01-01 executor first
   tried a guessed absolute home. In batch C (3.1.0 tree) there were 13 accesses to guessed homes that do not exist
   and 1 `~` denial in Bash. In production a guess can land on another user's home.
3. **3.0.0's quick executor ran on opus once in three** (q30-r1 spawned it with no model). 3.1.0 passed sonnet every
   time, so this is fixed in 3.1.0.

## Recommendation per role

First the rule, applied mechanically (the outcomes rendered above). Then a reading that takes the spot-checks and
the post-hoc lines into account. The reading is advice for the user's decision, not a second rule.

Current tiers are quality / balanced / budget, read from `model-profiles.json` and the Flutter pack's
`aoforge-stack.json`.

| Role | Current tiers | Rule outcome | Rule proposal | Reading |
|---|---|---|---|---|
| verifier | sonnet / sonnet / sonnet (verdict_floor) | WEAK_ENDORSE | none (verdict_floor keeps Sonnet) | Keep Sonnet. A is at the ceiling for both models and cannot separate them. |
| job-checker | sonnet / sonnet / sonnet (verdict_floor) | REFUSE | none (confirms the tiers) | Keep Sonnet. The refusal holds after the spot-check correction (-16.7 either way), and Haiku passed an uncovered criterion twice. |
| ui-evaluator | opus / sonnet / sonnet (Flutter pack) | WEAK_ENDORSE (exactly -10.0) | **P1**: start at Haiku on budget and balanced, escalate on split votes | The weakest endorsement in the set: at the bound, n 20 states, both errors tied to the session design, and a 40% split rate that would send 4 of 7 ok states to escalation. Approve only with that escalation rate measured on real projects, or hold. |
| codebase-mapper:tech | sonnet / haiku / haiku (agent row) | WEAK_ENDORSE | none (already Haiku) | Recall 45/46 vs 46/46. Survives the hand reading, not the module-paths-excluded reading. |
| codebase-mapper:arch | sonnet / haiku / haiku (agent row) | REFUSE (fabrications) | **P2**: raise codebase-mapper balanced, budget to Sonnet | Haiku's recall is higher (41/46 vs 39/46). The refusal rests on 3 misnamed files in one Haiku fleet run, and is borderline. |
| codebase-mapper:quality | sonnet / haiku / haiku (agent row) | REFUSE (fabrications) | **P2** (same change) | The refusal rests on flags that are not fabrications. Under the grader-only and hand readings it is a weak endorsement. |
| codebase-mapper:concerns | sonnet / sonnet / haiku (focus override) | REFUSE (recall -13.2) | **P3**: raise the concerns focus budget to Sonnet | Robust under every reading. Fleet concerns recall is weak for both models (7/22 vs 10/22). |
| project-researcher:stack | opus / sonnet / haiku (agent row) | INSUFFICIENT (Sonnet not scored) | none | With both Sonnet runs hand-graded it would be a weak endorsement; no proposal either way. |
| project-researcher:features | opus / sonnet / haiku (agent row) | WEAK_ENDORSE | none (already Haiku on budget) | Current tiers weakly supported. |
| project-researcher:architecture | opus / sonnet / sonnet (focus override) | WEAK_ENDORSE (+18.2) | **P4**: lower the architecture focus budget to Haiku | n is 2 runs per model, and it reverses a raise objective 76 made on purpose. |
| project-researcher:pitfalls | opus / sonnet / sonnet (focus override) | WEAK_ENDORSE (+4.5) | **P5**: lower the pitfalls focus budget to Haiku | Same as P4. |

### The proposals, for the decision (TRD 81-19 Task 3)

| Id | File and key | Current (q / b / bu) | Proposed | Deciding numbers (Haiku vs Sonnet) | Spot-check |
|---|---|---|---|---|---|
| P1 | `plugins/aoforge-stack-flutter/aoforge-stack.json` `models.ui-evaluator` | opus / sonnet / sonnet | opus / haiku / haiku, escalating on split votes | accuracy 18/20 (69.9-97.2%) vs 20/20 (83.9-100.0%); split rate 8/20 vs 2/20; engine escalations 4/7 vs 1/7 | D: 4/4 labels hold |
| P2 | `plugins/aoforge/aoforge/references/model-profiles.json` `agents.codebase-mapper` (shared by tech, arch and quality) | sonnet / haiku / haiku | sonnet / sonnet / sonnet | arch fabrications 3.00 vs 0.75 per run, recall 41/46 (77.0-95.3%) vs 39/46 (71.8-92.4%); quality fabrications 2.00 vs 1.33, recall 38/44 (73.3-93.6%) vs 29/33 (72.7-95.2%) | C: 6/6 grader verdicts; the flagged-path review qualifies both refusals |
| P3 | `model-profiles.json` `focus.codebase-mapper.concerns` | sonnet / sonnet / haiku | sonnet / sonnet / sonnet | recall 21/38 (39.7-69.9%) vs 26/38 (52.5-80.9%), -13.2 | C: 6/6 |
| P4 | `model-profiles.json` `focus.project-researcher.architecture` | opus / sonnet / sonnet | opus / sonnet / haiku | recall 21/22 (78.2-99.2%) vs 17/22 (56.6-89.9%), +18.2; fabrications 0.00 vs 0.00 | C: 6/6 |
| P5 | `model-profiles.json` `focus.project-researcher.pitfalls` | opus / sonnet / sonnet | opus / sonnet / haiku | recall 22/22 (85.1-100.0%) vs 21/22 (78.2-99.2%), +4.5; fabrications 0.00 vs 0.00 | C: 6/6 |

A narrower variant of P2 fits the hand reading better: add focus overrides that raise only `arch` (and, if wanted,
`quality`), leaving tech on Haiku. The rule's mapping names the shared agent row, so the variant is the user's call.

No tier assignment was changed by objective 81. `model-profiles.json` and `aoforge-stack.json` are untouched. The
proposals await the user's decision; an approval creates a follow-up todo, never a change in this objective.
