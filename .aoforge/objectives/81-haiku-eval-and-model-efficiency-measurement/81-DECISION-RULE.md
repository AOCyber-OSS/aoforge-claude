# Objective 81: pre-registered decision rule (Haiku 5.5 vs Sonnet 5.5, 76-06)

## 1. Status

**Pre-registered.** This file is fixed before any live run of objective 81. It was registered by the commit
`docs(81-02): pre-register the Haiku eval decision rule`, made with `aof-tools commit`. A commit cannot carry its own
hash, so read the SHA with `git log --format=%H --diff-filter=A -- <this file>`.

Changing this file after the first live run invalidates the pre-registration. An amendment made after that point is
the user's call, is labelled **post-hoc** wherever it is applied, and never replaces the text it amends. An amendment
made before the first live run (for example at the batch-A checkpoint) follows TRD 81-14's amendment procedure.

The rule is implemented in `scripts/eval81/lib/decide.cjs` (constants `MARGIN`, `MIN_SCORED_SHARE`, `SONNET_FLOOR`,
`FAB_MARGIN`) and the intervals in `scripts/eval81/lib/stats.cjs`. Where this file and the code disagree, this file
wins: the code is fixed and a test quoting the line is added.

## 2. The rule

The user's decision rule (2026-10-17), verbatim:

> "Haiku for a role only with zero false passes in A and within ~10 points of Sonnet's detection in A/B/D; small n can refuse but only weakly endorse; any tier change is a proposal to the user, never applied in this objective."

## 3. Metrics

Every metric is a proportion `k/n` per role and model, except fabrications (a count per run). Runs whose record
status is not `ok`, whose model did not run as requested (`model_ran: false`) or which are contaminated are
**excluded**: they are not in any `n`, and they are listed with their reason in the batch result's `excluded` list.

Roles and their primary metric:

| Batch | Role key | Primary metric |
|---|---|---|
| A | `verifier` | detection |
| B | `job-checker` | detection |
| D | `ui-evaluator` | accuracy |
| C | `codebase-mapper:<focus>`, focus in `tech`, `arch`, `quality`, `concerns` | recall |
| C | `project-researcher:<dimension>`, dimension in `stack`, `features`, `architecture`, `pitfalls` | recall |

The gate metric is Haiku's `false_pass` in A (global, see section 5).

### A: verifier (3 clean + 3 planted repos x 3 repeats = 9 clean + 9 planted runs per model)

The verdict is the `status` field of the VERIFICATION.md frontmatter the verifier published: `passed`,
`gaps_found` or `human_needed`.

- **false_pass** = planted runs with verdict `passed` / planted runs scored.
- **detection** = planted runs with verdict `gaps_found` AND the planted gap named / planted runs scored.
- **gap named**: one gap entry, or the gaps section, contains every `must_mention` token of the fixture's answer key
  and at least one of its `any_of` tokens (case-insensitive substring match).
- **detected_unnamed** (reported, not used by the rule) = planted runs with `gaps_found` whose gaps do not name the
  planted gap / planted runs scored. Such a run is neither a detection nor a false pass.
- **false_fail** = clean runs with verdict `gaps_found` / clean runs scored.
- **abstain** = runs whose verdict is `human_needed` or which published no verdict. An abstention is scored (it is in
  `n`), but it is never a pass and never a detection.

### B: job-checker (2 clean + 4 planted TRD sets x 3 repeats = 6 clean + 12 planted runs per model)

- **detection** = planted runs returning `ISSUES FOUND` with an issue (blocker or warning) whose text contains every
  `must_mention` token and at least one `any_of` token of the answer key / planted runs scored.
- **false_alarm** = clean runs with at least one blocker / clean runs scored (warnings alone are a correct pass).
- **missed_as_pass** (reported) = planted runs returning `VERIFICATION PASSED` / planted runs scored.
- Detection is also reported separately for defects that `verify trd-pre` already flags (`precheck_flags: true` in
  the answer key) and for judgment-only defects. The rule uses the pooled detection (interpretive choice 9).

### D: UI judge (about 20 labelled states x 3 samples per model)

Per state, the engine's `aggregateVotes` combines the 3 samples into a majority `is_broken` and a split flag.

- **accuracy** = states whose majority `is_broken` equals the label / states judged.
- **broken_missed** = broken-labelled states with an ok majority / broken-labelled states judged.
- **split_rate** = states with split votes / states judged (how often the judge would escalate).
- **engine_escalations** = ok-labelled states with split votes / ok-labelled states judged (the engine's
  `judgeEscalation` rule).
- A state with one missing sample is aggregated on the other two and flagged; a state with no sample is unjudged and
  not in `n`.

### C: codebase-mapper and project-researcher (mapper: 2 codebases x 4 foci x 2 repeats; researcher: 4 dimensions x 2 repeats; per model)

A fixed Sonnet grader marks each checklist item `found`, `wrong` or `missing` and lists fabrications.

- **recall** = items found / checklist items (summed over the role's scored runs).
- **error** = items wrong / checklist items. **missing** = items missing / checklist items (reported).
- **fabrications per run** = (grader fabrications + mechanical path fabrications) / scored runs. A mechanical path
  fabrication is a backticked repository path that does not exist in the run's codebase.
- A run whose grader output is missing or unparseable is ungraded and excluded with its reason.

### Contamination

A run whose tool inputs mention an answer key or `scripts/eval81` is contaminated: it is excluded, not in `n`, and
named in its role's reasons. A run marked contaminated in a batch result's `runs` list but missing from `excluded`
means the scorer counted it, so its role is INSUFFICIENT until the result is re-scored (interpretive choice 8).

## 4. Statistics

- Every proportion is reported with its **Wilson score 95% interval** (z = 1.96), clamped to [0, 1], with the lower
  bound exactly 0 when k = 0 and the upper bound exactly 1 when k = n. With n = 0 the rate is undefined and the
  interval is [0, 1].
- `n` is runs for A and B, states for D and checklist items for C. Fabrications are reported as total / runs.
- The scored share uses runs (samples for D): `n_scored / planned` per role and model. `planned` is read from
  `roles.<role>.models.<model>.planned`, else `roles.<role>.planned.<model>`, else the batch's `planned.<model>`.
- Differences are Haiku minus Sonnet, in points (1 point = 0.01), rounded to 1e-9 before any comparison so that
  floating-point noise never moves a boundary.

## 5. Outcomes per role

There are exactly three outcomes: **REFUSE**, **WEAK_ENDORSE** and **INSUFFICIENT**. There is no strong
endorsement: at these sample sizes the evidence can refuse Haiku but can only weakly endorse it. WEAK_ENDORSE is the
strongest outcome this design can give.

The checks run in this order for each role; the first that applies decides.

1. **Batch missing**: the role's batch has no results, or the batch results have no entry for the role ->
   INSUFFICIENT ("batch X not run").
2. **Scored share**: either model scored fewer than 2/3 of its planned runs (`n_scored x 3 < planned x 2`), or
   reports no plan -> INSUFFICIENT. Example: Haiku scored 10 of 18 planned -> INSUFFICIENT. Exactly 2/3 is enough.
   A primary metric with n = 0 for either model, or (C) a missing fabrication count, is also INSUFFICIENT here.
3. **Sonnet floor**: Sonnet's own primary metric is below 0.5 -> INSUFFICIENT ("comparison not informative").
   Example: Sonnet detection 4/9.
4. **A gate**: Haiku has one or more false passes in A -> REFUSE ("A false pass"), for every role, even where the
   role's own metric passes. Example: Haiku 1/9 false passes in A refuses the verifier, the job-checker, the UI judge
   and every C role.
5. **Margin**: Haiku's primary rate is more than 10 points below Sonnet's (`haiku_rate < sonnet_rate - 0.10`) ->
   REFUSE. Example: detection 8/9 vs 9/9 is 11.1 points below -> REFUSE; 9/9 vs 9/9 passes. For C roles, also REFUSE
   when Haiku's fabrications per run exceed Sonnet's by more than 0.5. Example: recall 0.70 vs 0.78 with
   fabrications 1.0 vs 0.8 passes; fabrications 1.5 vs 0.8 (+0.7) -> REFUSE.
6. **A gate not established**: batch A was not run, Haiku scored fewer than 2/3 of its planned A runs, or no planted
   A run was scored -> INSUFFICIENT for a role that would otherwise be WEAK_ENDORSE. Refusals from steps 4 and 5
   stand.
7. Otherwise -> **WEAK_ENDORSE**.

Excluded runs (contamination included) are named in the role's reasons whatever the outcome.

Batch E (76-08) is a measurement, not a tier decision: the rule ignores it.

## 6. Interpretive choices

These are the readings of the rule this file commits to. Each can be amended by the user before the first live run
(the batch-A checkpoint); after it, only as a post-hoc amendment.

1. **The A gate is global.** One Haiku false pass in A refuses Haiku for every role, C roles included. This is the
   conservative reading of "for a role only with zero false passes in A".
2. **The C extension.** The rule names A/B/D. C (codebase-mapper, project-researcher) is judged with the same
   10-point margin on checklist recall, plus a fabrication bound: Haiku's fabrications per run may exceed Sonnet's
   by at most 0.5. This is an extension of the user's text.
3. **"~10 points" means point estimates.** The test is `haiku_rate >= sonnet_rate - 0.10` on point estimates, with
   exactly 10 points below counting as within. The Wilson intervals are reported beside it and are not the test: at
   n = 9-20 the intervals always overlap, so an interval test could never refuse.
4. **`human_needed` is an abstention.** It is scored, it is never a pass (so never a false pass) and never a
   detection. A run that published no verdict is treated the same way.
5. **INSUFFICIENT thresholds.** Fewer than 2/3 of planned runs scored for either model, or Sonnet's own primary
   metric below 0.5, gives INSUFFICIENT.
6. **The A gate must be established before an endorsement.** Without a usable batch A (not run, under 2/3 of
   Haiku's planned A runs scored, or no planted run scored) zero false passes is unproven, so a role that would be
   WEAK_ENDORSE is INSUFFICIENT. A refusal on the role's own metric still stands.
7. **"Detection" in D is per-state accuracy.** The UI judge has no planted-gap detection; its primary metric is the
   majority-vote accuracy against the labels, which counts missed broken states and false alarms alike.
   `broken_missed` is reported beside it.
8. **Contamination is checked, not trusted.** Excluded runs are attributed to a role by their `role` field, else to
   every role of the batch. A contaminated run left in `runs` without an exclusion makes its role INSUFFICIENT.
9. **Only the named metrics decide.** The rule names false passes (A) and detection (A/B/D). False fails (A), false
   alarms (B), the precheck split (B), escalations (D) and errors (C) are reported with intervals but do not change
   an outcome. B's detection pools precheck-flagged and judgment-only defects.
10. **Proposal mapping beyond the named cases.** A weak endorsement of a role outside `verdict_floor` other than the
    UI judge proposes lowering only its budget profile (section 7).

## 7. Proposals

Outcomes become proposals against the current tiers, read at report time from
`plugins/aoforge/aoforge/references/model-profiles.json` (`agents`, `focus`, `verdict_floor`) and
`plugins/aoforge-stack-flutter/aoforge-stack.json` (`models.ui-evaluator`). A focus role reads
`focus.<agent>.<focus>` when it exists, else the agent's row (which every focus without an override shares).

| Outcome | Current tiers | Proposal |
|---|---|---|
| INSUFFICIENT | any | none |
| REFUSE | some profiles run haiku | "raise `<agent>` `<profiles>` to sonnet", e.g. codebase-mapper:tech while balanced and budget are haiku -> "raise codebase-mapper balanced, budget to sonnet" |
| REFUSE | no profile runs haiku | none; note "the refusal confirms the current tiers" |
| WEAK_ENDORSE | role in `verdict_floor` (verifier, job-checker) | none; note "verdict_floor keeps sonnet; evidence weakly supports haiku" |
| WEAK_ENDORSE | ui-evaluator, budget/balanced above haiku | "start ui-evaluator at haiku on budget/balanced, escalate on split votes (split rate X)", X = Haiku's split rate |
| WEAK_ENDORSE | other role, budget above haiku | "lower `<agent>` budget to haiku (weak endorsement; quality and balanced unchanged)" |
| WEAK_ENDORSE | other role, budget already haiku | none; note that the current haiku tiers are weakly supported |

Proposals are text for the user's `checkpoint:decision` in TRD 81-19. Nothing in objective 81 changes
`model-profiles.json` or `aoforge-stack.json`: `decide.cjs` and `report.cjs` read the tiers and never write them.

## 8. Not decided here

- **E (76-08)** is a measurement of 3.0.0 vs 3.1.0 per role (prompt size, tokens, cost, wall time, outcome). It feeds
  `81-MEASUREMENT.md`, not a tier decision.
- **The debugger's start tier** is not measured by this design; it stays as configured.
- **Opus** is not compared: every comparison is Haiku 5.5 against Sonnet 5.5.
