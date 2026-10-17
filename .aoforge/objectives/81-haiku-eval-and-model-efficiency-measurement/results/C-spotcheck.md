# Batch C spot-check (TRD 81-18, Task 3)

**Agreement: 6 of 6** grader verdicts.

## Method

The scorer writes `R/spotcheck/C.md`, which stays in the eval root. It picks 6 (run, item) pairs with seed 81,
round-robin over the found, wrong and missing verdicts. For each pair I read the run's collected document in full
(`R/runs/C/<run>/record.json` `outputs.document`) against the checklist item and gave my own verdict. As the TRD
requires, fleet items are listed by id only: no quotes and no statements.

## Results

| Sample | Run | Item | Grader verdict | My verdict | Agree |
|---|---|---|---|---|---|
| S1 | C-res-features-s-2 | features-10 | found | found | yes |
| S2 | C-res-features-h-2 | features-08 | wrong | wrong | yes |
| S3 | C-map-concerns-a-h-1 | concerns-04 | missing | missing | yes |
| S4 | C-map-tech-b-h-1 | tech-11 | found | found | yes |
| S5 | C-map-arch-b-h-2 | arch-06 | wrong | wrong | yes |
| S6 | C-map-concerns-b-s-2 | concerns-10 | missing | missing | yes |

Notes on the non-fleet items:
- **S2 sits between wrong and missing.** The document treats front matter as noise to strip from the index and
  never offers tag filtering. That is a recommendation against the checklist item, so I read it as wrong.
- **S3: nothing about the ignored error.** The document discusses `Save` (its truncate-then-write race) but never the
  ignored `Close` error.

## Notes for the report (81-19)

- **Mechanical fabrication counts on fleet mapper runs are inflated by Go module paths.** The flagged-path review
  (`R/spotcheck/C-paths.md`, eval root only) shows that most of the tech-focus "fabrications" are back-ticked module
  import paths (`owner/repo/vN`), not files. The path check reads them as paths absent from the codebase. sonnet lists
  more modules, so its count is inflated more: fleet tech fabrications are 19 per run for sonnet against 6 for haiku
  (grader and mechanical together).
- **The two sonnet `project-researcher:stack` runs are excluded as `model_ran false`.** The CLI routed about 18% of
  their output tokens to claude-haiku-5-5 as a side model. Both runs used WebFetch and WebSearch. The pre-registered
  0.9 share rule excludes them, so that cell has 0 of 2 scored.
