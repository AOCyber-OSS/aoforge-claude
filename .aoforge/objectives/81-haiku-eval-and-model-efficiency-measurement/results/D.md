# Batch D results

Scored at 2026-10-17T19:20:08.982Z. Planned runs: haiku 60, sonnet 60.

## ui-evaluator

Primary metric: accuracy.

| Metric | haiku | sonnet |
|---|---|---|
| runs scored / planned | 60/60 | 60/60 |
| accuracy | 18/20 (90.0%, 95% CI 69.9-97.2%) | 20/20 (100.0%, 95% CI 83.9-100.0%) |
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

## Notes

- One session judges every state of a surface (about five), so the judge can compare states; the engine judges each state in its own call. Mitigations: the state order is shuffled per repeat (seed = repeat x 1000 + surface index), each state is judged against its own expected text, and the prompt says to judge each screenshot on its own.
- engine_escalations is the pre-registered rule (ok-labelled states with split votes); engine_reviews counts the ok-labelled states the engine's scoreState would put in review. accuracy_by_defect_type and accuracy_by_severity group broken-labelled states by the key's primary defect type and severity; none is the ok-labelled states.

Spend: spent $0.74 of the batch; ledger total $4.56 (status complete, 24 runs).
