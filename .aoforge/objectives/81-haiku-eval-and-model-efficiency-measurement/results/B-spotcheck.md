# Batch B spot-check (TRD 81-15, Task 3)

**Agreement: 5 of 6.** One disagreement (B-B6-haiku-r2): the scorer's substring match missed a return that names
the planted gap in other words. Two further scorer artefacts turned up while reading around the picks; they are listed
below as sensitivity lines. The scorer was not changed (TRD 81-15 recovery rule).

## Method

- **Pick** (`scratchpad/81-15-scripts/spotcheck-pick.cjs`, mulberry32 seed 81, each pool sorted by id before the
  shuffle): the first run of each planted set B3, B4, B5 and B6, the first run of the clean pool (B1 and B2), and
  the first of the remaining runs the scorer called `missed` or `missed_as_pass`. The six hold both models, so no swap
  was needed.
- **Reading.** I read each checker return by hand from `R/runs/B/<id>/record.json` `result_text`: the verdict
  heading, the Blockers and Warnings sections and the YAML block. I judged whether a blocker or warning names the
  set's planted defect, then compared that with the scorer's outcome.

## Results

| Run | Model | Set | Scorer outcome | My reading | Agree | Why |
|---|---|---|---|---|---|---|
| B-B3-haiku-r3 | haiku | B3 (planted: same-wave overlap) | detected | ISSUES; blocker 1 says 02-01 and 02-02 are both wave 1, both modify `src/cli.js` and race on the `EXPORTERS` declaration | yes | It names the two TRDs, the file and the parallel race, and proposes serializing them |
| B-B4-sonnet-r3 | sonnet | B4 (planted: missing verify) | detected | ISSUES; blocker 1 says 02-02 Task 1 has no `<verify>` and gives a runnable check | yes | It names the TRD, the task and the missing element |
| B-B5-sonnet-r2 | sonnet | B5 (planted: later-wave dependency) | detected | ISSUES; blocker 1 says 02-02 is wave 1 but depends on 02-04 (wave 2) | yes | It names both TRDs and the wave arithmetic, and notes the pre-check does not test waves |
| B-B6-sonnet-r3 | sonnet | B6 (planted: uncovered success criterion) | detected (warning) | ISSUES; warning 1 says an unknown `--format` value is not handled and throws | yes | It names the gap the roadmap's criterion 3 covers. It proposes "return 1", not the criterion's exit 2, and never cites the criterion |
| B-B1-sonnet-r1 | sonnet | B1 (clean) | correct_pass | PASSED, 9/10; it checked the waves, the key links and that `loadNotes` returns `[]` for a missing file | yes | Clean set, no blocker |
| B-B6-haiku-r2 | haiku | B6 (planted: uncovered success criterion) | **missed** | ISSUES; warning 1 is "Unknown `--format` value is unspecified (02-03, Task 1)": add an "unknown-format error on stderr and return 1" | **no** | It names the same gap as B-B6-sonnet-r3, at the same severity and with the same "return 1" fix. The text has no exact `any_of` substring: the words are split by a backticked `--format`, or hyphenated as "unknown-format" |

## Sensitivity lines for the report (81-19)

1. **B6 lexical misses.** On substance, B-B6-haiku-r2 (spot-checked) and B-B6-sonnet-r2 (read while checking B6;
   "Unsupported or missing `--format` value is not handled") both detect the planted gap. Counting them:
   - haiku detection 9/12 -> 10/12, judgment-only 6/9 -> 7/9;
   - sonnet detection 11/12 -> 12/12, judgment-only 8/9 -> 9/9.

   haiku's two B6 `missed_as_pass` runs stay misses: both published VERIFICATION PASSED. B-B6-haiku-r1 mentions the
   unknown-format case only as a "consider stating it" note.
2. **No B6 return cites the success criterion.** None of the six B6 returns mentions criterion 3 or exit 2. Every one
   that saw the gap proposed exit 1. Read strictly as "found the uncovered success criterion", B6 detection is 0 of 6
   for both models. What the models found is the unhandled behaviour.
3. **Sonnet's unrelated blockers are restatements.** Sonnet's 4 unrelated blockers (all on B3) come from YAML entries
   that restate the planted overlap in words the Markdown items did not use, so they neither merged nor matched:
   - B-B3-sonnet-r3: 1, the YAML copy of the overlap blocker.
   - B-B3-sonnet-r2: 3, the YAML copy of the overlap, and "`EXPORTERS` is declared three times" in both Markdown and
     YAML. That is a consequence of the same overlap.

   Read by hand, sonnet's unrelated blockers are 0 (or 1, if the duplicate declaration counts as a separate finding).
   haiku's 0 is unchanged.

## Observations (no effect on any metric)

- **haiku says ISSUES FOUND on clean sets.** It did so on 4 of 6 (B1-r1, B1-r3, B2-r1, B2-r3), with warnings only and
  no blocker, so each scores `correct_pass`. sonnet passed all 6 clean sets. In production a warnings-only ISSUES
  FOUND can still trigger a revision round.
- **sonnet's duplicate `</output>` claim.** 10 of 18 sonnet returns, as a warning or an info, say each TRD ends with
  a duplicate `</output>`. The fixture copies of B4, B5 and B6 each have exactly one closing tag. haiku never makes
  the claim. Warnings and info never count as alarms, so no metric moves.
