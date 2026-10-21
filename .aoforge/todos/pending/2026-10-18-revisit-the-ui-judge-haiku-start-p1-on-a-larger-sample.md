---
created: 2026-10-18T12:31:00.000Z
title: "Revisit the UI judge's Haiku start (P1) on a larger sample"
area: model-tiers
files: [plugins/aoforge-stack-flutter/aoforge-stack.json, scripts/eval81/fixtures/D/labels.json, scripts/eval81/fixtures/D/states.json, .aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md, .aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md, .aoforge/objectives/82-3-1-0-follow-ups/results/D.json]
---

## Problem

Objective 81's proposal P1 (start the Flutter pack's UI judge, `ui-evaluator`, at Haiku on balanced and budget and
escalate a split vote to Sonnet) was applied by TRD 82-03 and reverted by TRD 82-08 under the rule pre-registered in
`82-CHECK-RULES.md` section 1. One state decided it:

| Condition (KEEP needs all three) | Haiku start | Sonnet start | Holds |
|---|---|---|---|
| broken states that ended ok (needs 0) | 1/13 (d17) | 1/13 (d17) | no |
| accuracy | 19/20 | 18/20 | yes |
| cost (escalations included) | $0.1334 | $1.1462 | yes |

Split rate 2/20 (10%), escalation rate 1/20 (5%); the one escalated state (d02) ended ok, agreeing with the Sonnet
start; false fails 0/7 against Sonnet's 1/7.

**Both judges passed d17.** All three Haiku sessions and all three Sonnet sessions judged it ok. d17 is labelled
`broken` (`defect_type: misalignment`, severity medium, a 200 x 690 region at x 20, y 110 of the `ui-eval-guide`
surface at 1280 x 800, baseline d19, `min_share` 0.07). In objective 81's batch D, which judged a surface's states in
one session, Haiku missed d17 and Sonnet caught it (81's spot-check tied its d02 and d17 errors to that session
design); 82-08 judged one state per session, as the engine does, and both models missed it. So the miss reads as a
fixture or judge-prompt question, not a tier question: the misalignment may only be visible beside its baseline, or
the judge's rubric may not ask about it.

## What to do

1. Look at d17 against d19 by hand: is the defect visible, and does the engine's rubric ask for misalignment of that
   kind? If the label or the rubric is the problem, fix it first and record the change.
2. Re-run the comparison on a larger labelled set (20 states left the decision to one state; 40 to 60 states, with
   more broken states of each defect type, would let one miss not decide it).
3. Pre-register the rule before any run. The section 1 rule's absolute clause (no broken state may end ok) failed
   for both starts; decide in advance whether the cheaper start must be perfect or no worse than the current start
   on broken states, and freeze that choice with the harness (`prereg.cjs`).
4. Run live behind a user approval gate and a spend cap. 82-08's D batch cost $1.28 for 123 sessions.

## When done

Apply P1 again test-first if the new rule keeps it (the pin tests in
`plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs` P1-1 and P1-2 change with it), or record why not. Update
MEF-06's UI-judge half in REQUIREMENTS.md and 76-VERIFICATION.md from that evidence.
