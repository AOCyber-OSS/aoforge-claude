---
created: 2026-10-17T23:00:00.000Z
title: "Apply objective 81 tier proposal: project-researcher:architecture"
area: model-tiers
files: [plugins/aoforge/aoforge/references/model-profiles.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json]
disposition: follow-up
disposition_reason: "Objective 81 proposal P4, approved by the user on 2026-10-17 (approve-selected); n is 2 runs per model and it reverses a raise objective 76 made on purpose, so apply it with a follow-up measurement"
disposition_target: "a follow-up objective or quick task (not objective 81)"
disposition_date: 2026-10-17
disposition_by: objective 81 (TRD 81-19 decision)
---

## Problem

Objective 81's batch C gave project-researcher:architecture a WEAK_ENDORSE for Haiku 5.5 under the pre-registered
rule. The rule's proposal is P4: lower the architecture focus budget tier to Haiku, leaving quality and balanced
unchanged. The user approved it on 2026-10-17. Nothing was changed in objective 81.

## Change

- **File:** `plugins/aoforge/aoforge/references/model-profiles.json`
- **Key:** `focus.project-researcher.architecture`
- **Current tier per profile:** quality opus, balanced sonnet, budget sonnet
- **Proposed tier per profile:** quality opus, balanced sonnet, budget haiku (only `budget` changes)
- Update the `model-profiles.test.cjs` expectation for this focus on budget.

## Evidence (81-HAIKU-EVAL.md, results/C.json)

- Rule outcome: **WEAK_ENDORSE**. Recall Haiku 21/22 (95.5%, 95% CI 78.2-99.2%) against Sonnet 17/22 (77.3%, 95% CI
  56.6-89.9%), +18.2 points. Zero Haiku false passes in A.
- Fabrications: 0.00 vs 0.00 per run. Errors: 0/22 for both models.
- Spot-check: 6 of 6 C grader verdicts agree (the sample spans all C roles).
- Cost on the eval: Haiku $0.08, Sonnet $0.27 for 2 runs each.

## Conditions attached by the user

- **n is 2 runs per model (22 checklist items each).** At that size the design can refuse Haiku but only weakly
  endorse it.
- **This reverses a raise objective 76 made on purpose.** TRD 76-06 raised the architecture dimension above the
  agent row's budget tier.
- **Apply it with a follow-up measurement.** After the change, compare budget-profile architecture research on real
  projects with a Sonnet run of the same topic, on two or three topics. Record recall against a checklist, or a
  reviewer's verdict, and the cost. Revert if Haiku misses architecture findings Sonnet makes.
