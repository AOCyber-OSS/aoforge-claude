---
created: 2026-10-17T23:00:00.000Z
title: "Apply objective 81 tier proposal: codebase-mapper:concerns"
area: model-tiers
files: [plugins/aoforge/aoforge/references/model-profiles.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json]
disposition: follow-up
disposition_reason: "Objective 81 proposal P3, approved by the user on 2026-10-17 (approve-selected)"
disposition_target: "a follow-up objective or quick task (not objective 81)"
disposition_date: 2026-10-17
disposition_by: objective 81 (TRD 81-19 decision)
---

## Problem

Objective 81's batch C refused Haiku 5.5 for codebase-mapper:concerns under the pre-registered rule: its recall was
more than 10 points below Sonnet's. The rule's proposal is P3, which raises the concerns focus budget tier to
Sonnet. The user approved it on 2026-10-17. Nothing was changed in objective 81.

## Change

- **File:** `plugins/aoforge/aoforge/references/model-profiles.json`
- **Key:** `focus.codebase-mapper.concerns`
- **Current tier per profile:** quality sonnet, balanced sonnet, budget haiku
- **Proposed tier per profile:** quality sonnet, balanced sonnet, budget sonnet (only `budget` changes)
- Update the `model-profiles.test.cjs` expectation for the concerns focus on budget.

## Evidence (81-HAIKU-EVAL.md, results/C.json)

- Rule outcome: **REFUSE** on the recall margin. Haiku 21/38 (55.3%, 95% CI 39.7-69.9%) against Sonnet 26/38 (68.4%,
  95% CI 52.5-80.9%), -13.2 points. n is 4 runs per model (2 synthetic, 2 fleet).
- By codebase: synthetic 14/16 vs 16/16, fleet 7/22 vs 10/22. Fleet concerns recall is weak for both models.
- Errors: Haiku 2/38, Sonnet 0/38.
- The refusal holds under every post-hoc reading of the fabrication check: module paths excluded, grader-only
  fabrications, and the hand reading. It rests on recall, not fabrications.
- Spot-check: 6 of 6 grader verdicts agree.
- Cost on the eval: Haiku $0.05, Sonnet $0.31 for 4 concerns runs each.
