---
created: 2026-10-17T23:30:00.000Z
title: "Apply objective 81 tier proposal: ui-evaluator"
area: model-tiers
files: [plugins/aoforge-stack-flutter/aoforge-stack.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.json]
disposition: follow-up
disposition_reason: "Objective 81 proposal P1, approved by the user on 2026-10-17 (approve-selected) knowing it sits exactly on the 10-point bound; the escalation rate must be measured on real projects before or while it is applied"
disposition_target: "a follow-up objective or quick task (not objective 81)"
disposition_date: 2026-10-17
disposition_by: objective 81 (TRD 81-19 decision)
---

## Problem

Objective 81's batch D gave the UI judge (ui-evaluator) a WEAK_ENDORSE for Haiku 5.5 under the pre-registered rule,
exactly at the 10-point bound. The rule's proposal is P1: start the judge at Haiku on balanced and budget, and
escalate on split votes. The user approved it on 2026-10-17. Nothing was changed in objective 81.

## Change

- **File:** `plugins/aoforge-stack-flutter/aoforge-stack.json`
- **Key:** `models.ui-evaluator`
- **Current tier per profile:** quality opus, balanced sonnet, budget sonnet
- **Proposed tier per profile:** quality opus, balanced haiku, budget haiku. The split-vote escalation one rung up
  (`judgeEscalation`, `## ESCALATION REQUESTED`, `resolve-model ui-evaluator --escalate-from`, quick 42) is already
  wired.

## Evidence (81-HAIKU-EVAL.md, results/D.json)

- Rule outcome: **WEAK_ENDORSE**: accuracy within the 10-point margin (exactly -10.0), zero Haiku false passes in A.
- State accuracy, majority of 3 samples: Haiku 18/20 (90.0%, 95% CI 69.9-97.2%), Sonnet 20/20 (100.0%, 95% CI
  83.9-100.0%).
- Sample accuracy: Haiku 48/60 (80.0%), Sonnet 58/60 (96.7%).
- Broken states missed: Haiku 1/13, Sonnet 0/13. False fails on ok states: Haiku 1/7, Sonnet 0/7.
- Split rate: Haiku 8/20 (40%), Sonnet 2/20 (10%). Engine escalations on ok states: Haiku 4/7, Sonnet 1/7.
- Cost per 5-state session: Haiku about $0.0036, Sonnet about $0.058 (about 1/16).
- Spot-check: 4 of 4 labels hold. Both states either model got wrong (d02, d17) depend on the eval's
  one-session-per-surface design. The engine judges one state per call. Without them both models are 18/18.

## Condition attached by the user

The evidence sits on the bound, and Haiku's votes split four times as often as Sonnet's. **Measure the escalation
rate on real projects before or while applying this change.** For example, run `/aoforge:ui-eval --judge live` with
`--judge-tier haiku` on two or three real surfaces. Record:

- how often a state escalates to Sonnet;
- whether the escalated verdicts agree with a Sonnet-only run;
- the total cost against a Sonnet start.

Apply the tier change only if escalation keeps the verdicts right and the cost below a Sonnet start. Otherwise record
why it was not applied.

## Not in scope

Objective 81 did not measure the debugger's starting tier. MEF-06's start-tier half stays "not met" in
76-VERIFICATION.md until this todo is applied.
