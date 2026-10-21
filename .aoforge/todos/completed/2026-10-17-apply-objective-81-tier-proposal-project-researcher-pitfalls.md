completed: 2026-10-18
---
created: 2026-10-17T23:00:00.000Z
title: "Apply objective 81 tier proposal: project-researcher:pitfalls"
area: model-tiers
files: [plugins/aoforge/aoforge/references/model-profiles.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json]
disposition: follow-up
disposition_reason: "Objective 81 proposal P5, approved by the user on 2026-10-17 (approve-selected); n is 2 runs per model and it reverses a raise objective 76 made on purpose, so apply it with a follow-up measurement"
disposition_target: "a follow-up objective or quick task (not objective 81)"
disposition_date: 2026-10-17
disposition_by: objective 81 (TRD 81-19 decision)
---

## Problem

Objective 81's batch C gave project-researcher:pitfalls a WEAK_ENDORSE for Haiku 5.5 under the pre-registered rule.
The rule's proposal is P5: lower the pitfalls focus budget tier to Haiku, leaving quality and balanced unchanged.
The user approved it on 2026-10-17. Nothing was changed in objective 81.

## Change

- **File:** `plugins/aoforge/aoforge/references/model-profiles.json`
- **Key:** `focus.project-researcher.pitfalls`
- **Current tier per profile:** quality opus, balanced sonnet, budget sonnet
- **Proposed tier per profile:** quality opus, balanced sonnet, budget haiku (only `budget` changes)
- Update the `model-profiles.test.cjs` expectation for this focus on budget.

## Evidence (81-HAIKU-EVAL.md, results/C.json)

- Rule outcome: **WEAK_ENDORSE**. Recall Haiku 22/22 (100.0%, 95% CI 85.1-100.0%) against Sonnet 21/22 (95.5%, 95%
  CI 78.2-99.2%), +4.5 points. Zero Haiku false passes in A.
- Fabrications: 0.00 vs 0.00 per run. Errors: 0/22 for both models.
- Spot-check: 6 of 6 C grader verdicts agree (the sample spans all C roles).
- Cost on the eval: Haiku $0.09, Sonnet $0.37 for 2 runs each.

## Conditions attached by the user

- **n is 2 runs per model (22 checklist items each).** At that size the design can refuse Haiku but only weakly
  endorse it.
- **This reverses a raise objective 76 made on purpose.** TRD 76-06 raised the pitfalls dimension above the agent
  row's budget tier.
- **Apply it with a follow-up measurement.** After the change, compare budget-profile pitfalls research on real
  projects with a Sonnet run of the same topic, on two or three topics. Record recall against a checklist, or a
  reviewer's verdict, and the cost. Revert if Haiku misses pitfalls Sonnet finds.

## Resolution (objective 82, 2026-10-18)

**Applied and kept after its follow-up measurement.** `focus.project-researcher.pitfalls` is opus / sonnet / haiku
(budget sonnet to haiku).

- **Applied test-first** by TRD 82-03: RED `9d8333f8`, GREEN `10311e5c`, docs `a1d60a9b`.
- **Measured** by TRD 82-08 (batch C, `74e2954d`; verdicts `f98d7230`), the follow-up measurement this todo asked
  for: two new real-product topics (gateway, hub), 2 Haiku and 2 Sonnet researcher runs per topic, each graded blind
  against a checklist, under `82-CHECK-RULES.md` section 2 (frozen before any live run). **Verdict KEEP**
  (`82-TIER-CHECKS.md`):

  | Condition | Numbers | Holds |
  |---|---|---|
  | no item found by Sonnet in both runs and by Haiku in neither, on a topic | none | yes |
  | pooled Haiku recall not more than 10 points below Sonnet's | 39/44 (88.6%) vs 42/44 (95.5%), 6.8 points | yes |
  | Haiku fabrications per graded run not more than Sonnet's + 0.5 | 0 vs 0 | yes |

  Per topic: gateway Haiku 21/22 vs Sonnet 22/22; hub 18/22 vs 20/22. Items where the models differ: GA-P09, HU-P03,
  HU-P05 and HU-P11 (Sonnet 2/2, Haiku 1/2) and HU-P02 (Sonnet 0/2, Haiku 1/2); none lost in both Haiku runs. Cost per
  researcher run: Haiku $0.015-$0.073, Sonnet $0.128-$0.193.
- **Pin tests**, re-run on 2026-10-18: `node --test --test-name-pattern 'objective 82: approved tier proposals'
  plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs` printed `✔ init new-project and new-milestone: researcher
  architecture opus/sonnet/sonnet (P4 reverted), pitfalls opus/sonnet/haiku (P5 kept)`, `✔ table pins: P2 arch, P3
  concerns, P4 architecture (reverted by 82-08), P5 pitfalls`, `pass 5`, `fail 0`.
- Caveat: n=2 runs per model per topic, and Haiku's pooled recall is 6.8 points under Sonnet's, inside the bound.
