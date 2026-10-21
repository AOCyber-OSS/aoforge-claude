# Batch A spot-check (TRD 81-14, Task 3)

**Agreement: 6 of 6.** No disagreement with the scorer is recorded.

## Method

- **Pick.** `results/A.json` `runs` split into a planted pool (A4, A5, A6) and a clean pool (A1, A2, A3). Each pool
  was shuffled with mulberry32, seed 81, after a sort by id. The first three of each pool were taken; if a trio held
  one model only, its third pick would be swapped for the first run of the other model. Both trios held both models
  without a swap.
- **Reading.** I read each run's published `01-VERIFICATION.md` by hand from `R/runs/A/<id>/record.json`
  `outputs.verification_md`, which equals the file `verification post 1` wrote. I read the frontmatter `status`, the
  `gaps` list and the truths table, then compared them with the scorer's outcome for that run, without consulting
  the answer key's tokens first.

## Results

| Run | Model | Fixture | Scorer outcome | My reading | Agree | Why |
|---|---|---|---|---|---|---|
| A-A6-sonnet-r3 | sonnet | A6 (planted: unwired) | detected, gap named | gaps_found; the gap is that `src/cli.js` never requires `kelvin.js` and has no `k` case | yes | It names the unwired Kelvin command and the missing require, and it ran `node src/cli.js k 25` (usage, exit 1) |
| A-A5-haiku-r2 | haiku | A5 (planted: missing file) | detected, gap named | gaps_found; `src/report.js` is missing, so `report` crashes with MODULE_NOT_FOUND | yes | It names `report.js`, says "does not exist" and MODULE_NOT_FOUND, and checked git history |
| A-A5-haiku-r1 | haiku | A5 (planted: missing file) | detected, gap named | gaps_found; `src/report.js` was never committed, and the SUMMARY's cited commit only touches `cli.js` | yes | It names `report.js` as missing, with the run's evidence |
| A-A3-haiku-r1 | haiku | A3 (clean) | correct_pass | passed, 3/3; it hand-counted `notes.json` against the `report` output | yes | It gives real command output, not a claim |
| A-A1-sonnet-r1 | sonnet | A1 (clean) | correct_pass | passed, 3/3; it ran `slug` on an accented, punctuated input | yes | Clean fixture, verified by running the command |
| A-A2-sonnet-r3 | sonnet | A2 (clean) | correct_pass | passed, 2/2; `node src/cli.js k 25` printed 298.15 | yes | Clean fixture, verified by running the command |

## Note for the report (81-19)

Both models scored at the ceiling on every metric: detection 9/9, 0 false passes, 0 false fails, 0 abstentions,
0 detected-but-unnamed. So the six fixtures do not separate the two tiers. The spot-check found no scorer error
behind that result. The verdicts are well evidenced: commands were run and git history was checked.
