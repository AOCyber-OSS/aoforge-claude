# Batch B results

Scored at 2026-10-17T19:10:35.066Z. Planned runs: haiku 18, sonnet 18.

## job-checker

Primary metric: detection.

| Metric | haiku | sonnet |
|---|---|---|
| runs scored / planned | 18/18 | 18/18 |
| detection | 9/12 (75.0%, 95% CI 46.8-91.1%) | 11/12 (91.7%, 95% CI 64.6-98.5%) |
| false_alarm | 0/6 (0.0%, 95% CI 0.0-39.0%) | 0/6 (0.0%, 95% CI 0.0-39.0%) |
| missed_as_pass | 2/12 (16.7%, 95% CI 4.7-44.8%) | 0/12 (0.0%, 95% CI 0.0-24.3%) |
| unrelated_blockers | 0 in 12 runs (0.00 per run) | 4 in 12 runs (0.33 per run) |
| abstain | 0/18 (0.0%, 95% CI 0.0-17.6%) | 0/18 (0.0%, 95% CI 0.0-17.6%) |
| detection_split.precheck_flagged | 3/3 (100.0%, 95% CI 43.8-100.0%) | 3/3 (100.0%, 95% CI 43.8-100.0%) |
| detection_split.judgment_only | 6/9 (66.7%, 95% CI 35.4-87.9%) | 8/9 (88.9%, 95% CI 56.5-98.0%) |
| cost (USD) | 0.06 | 1.07 |
| mean wall time | 14.9 s | 15.2 s |

## Notes

- precheck_flags split of detection (verify trd-pre flags B4; judgment only on B3, B5, B6): haiku 3/3 precheck-flagged, 6/9 judgment-only; sonnet 3/3 precheck-flagged, 8/9 judgment-only
- Structured Issues YAML not parseable, scored from the Markdown sections: 1 (B-B5-haiku-r2)
- ignored run dirs: B-B1-haiku-r1.prev-1, B-B1-haiku-r1.prev-2, B-B1-haiku-r2.prev-1, B-B1-haiku-r2.prev-2, B-B1-haiku-r3.prev-1, B-B1-haiku-r3.prev-2, B-B1-sonnet-r1.prev-1, B-B1-sonnet-r1.prev-2, B-B1-sonnet-r2.prev-1, B-B1-sonnet-r2.prev-2, B-B1-sonnet-r3.prev-1, B-B1-sonnet-r3.prev-2, B-B2-haiku-r1.prev-1, B-B2-haiku-r1.prev-2, B-B2-haiku-r2.prev-1, B-B2-haiku-r2.prev-2, B-B2-haiku-r3.prev-1, B-B2-haiku-r3.prev-2, B-B2-sonnet-r1.prev-1, B-B2-sonnet-r1.prev-2, B-B2-sonnet-r2.prev-1, B-B2-sonnet-r2.prev-2, B-B2-sonnet-r3.prev-1, B-B2-sonnet-r3.prev-2, B-B3-haiku-r1.prev-1, B-B3-haiku-r1.prev-2, B-B3-haiku-r2.prev-1, B-B3-haiku-r2.prev-2, B-B3-haiku-r3.prev-1, B-B3-haiku-r3.prev-2, B-B3-sonnet-r1.prev-1, B-B3-sonnet-r1.prev-2, B-B3-sonnet-r2.prev-1, B-B3-sonnet-r2.prev-2, B-B3-sonnet-r3.prev-1, B-B3-sonnet-r3.prev-2, B-B4-haiku-r1.prev-1, B-B4-haiku-r1.prev-2, B-B4-haiku-r2.prev-1, B-B4-haiku-r2.prev-2, B-B4-haiku-r3.prev-1, B-B4-haiku-r3.prev-2, B-B4-sonnet-r1.prev-1, B-B4-sonnet-r1.prev-2, B-B4-sonnet-r2.prev-1, B-B4-sonnet-r2.prev-2, B-B4-sonnet-r3.prev-1, B-B4-sonnet-r3.prev-2, B-B5-haiku-r1.prev-1, B-B5-haiku-r1.prev-2, B-B5-haiku-r2.prev-1, B-B5-haiku-r2.prev-2, B-B5-haiku-r3.prev-1, B-B5-haiku-r3.prev-2, B-B5-sonnet-r1.prev-1, B-B5-sonnet-r1.prev-2, B-B5-sonnet-r2.prev-1, B-B5-sonnet-r2.prev-2, B-B5-sonnet-r3.prev-1, B-B5-sonnet-r3.prev-2, B-B6-haiku-r1.prev-1, B-B6-haiku-r1.prev-2, B-B6-haiku-r2.prev-1, B-B6-haiku-r2.prev-2, B-B6-haiku-r3.prev-1, B-B6-haiku-r3.prev-2, B-B6-sonnet-r1.prev-1, B-B6-sonnet-r1.prev-2, B-B6-sonnet-r2.prev-1, B-B6-sonnet-r2.prev-2, B-B6-sonnet-r3.prev-1, B-B6-sonnet-r3.prev-2

Spend: spent $1.13 of the batch; ledger total $3.82 (status complete, 36 runs).
