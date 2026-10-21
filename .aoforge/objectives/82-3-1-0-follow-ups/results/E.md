# Batch E (objective 82) results

Scored at 2026-10-18T12:15:22.455Z. Full report: 82-MEASUREMENT.md.

| Run | Column | Status | Acceptance | Verification | Priced cost | Charged |
|---|---|---|---|---|---:|---:|
| b82-r1 | 3.1.0-82 | ok | yes | passed | 3.1123 | 3.3899 |
| b82-r2 | 3.1.0-82 | ok | yes | passed | 4.0389 | 4.0473 |

Guessed runtime paths: none (every run scanned; tilde, guessed_home, real, guessed_nonexistent and tilde_denied all 0).

`guessed_home` is the defect signal: an absolute path under the home's parent the agent built itself instead of using `~` or a path it was handed. `tilde` counts `~` inputs for the record; the Read tool expands `~`, so a `~` Read is not a failure. The recorded columns are the runner's `record.access` classes, which miss an allowed `~` Read by design; the scan columns come from the transcripts.

| Run | Scan | tilde | guessed_home | real (recorded) | guessed_nonexistent (recorded) | tilde_denied (recorded) |
|---|---|---:|---:|---:|---:|---:|
| b82-r1 | scanned | 0 | 0 | 0 | 0 | 0 |
| b82-r2 | scanned | 0 | 0 | 0 | 0 | 0 |

Spend: batch E 7.4372 USD (complete); ledger total 11.4749 USD.
