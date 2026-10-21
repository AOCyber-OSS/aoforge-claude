---
created: 2026-10-18T12:30:00.000Z
title: "Measure the debugger's start tier (MEF-06's remaining half)"
area: model-tiers
files: [plugins/aoforge/aoforge/references/model-profiles.json, plugins/aoforge/agents/debugger.md, .aoforge/REQUIREMENTS.md, .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md]
---

## Problem

MEF-06 reads: "The debugger and the UI judge start cheap and escalate on a recorded signal; orchestrators act on
`ESCALATION REQUESTED`." The escalation half is complete (quick 42; TRD 76-07 wired `## ESCALATION REQUESTED` for the
debugger through `/aoforge:debug` and `diagnose-issues`). The start-tier half has two parts, and only one has been
measured:

- **The UI judge:** measured. Objective 81's batch D gave it a WEAK_ENDORSE for Haiku (P1); objective 82 applied P1
  (TRD 82-03) and measured it live (TRD 82-08, `82-TIER-CHECKS.md`), and the pre-registered rule reverted it
  (broken_missed 1 of 13, the rule needs 0). The judge starts at sonnet on balanced and budget.
- **The debugger:** never measured. Objective 81's harness has no debugger batch (A verifier, B job-checker, C mapper
  and researcher, D UI judge, E builds), and objective 82 scoped it out on purpose. ROADMAP Objective 82: "The
  debugger's start tier is not measured here and stays a recorded todo, so MEF-06 remains Partial by design."

The debugger's tiers are opus / sonnet / sonnet (quality / balanced / budget), unchanged since objective 76.

## What is missing

A start-tier check for the debugger, done the way 82-08 checked P1:

1. A labelled fixture set: small repositories with a seeded bug each and a known root cause (and a few with no bug or
   an environment-only failure), enough states that one miss is not the whole sample (82-08's 20 states left P1
   decided by one state).
2. Two arms on the same fixtures and prompt, through `/aoforge:debug`'s real escalation loop: a cheap start (Haiku on
   budget and balanced, or Sonnet on quality) that escalates on `## ESCALATION REQUESTED`, against today's start.
3. A rule written and frozen before any live run, scored like `82-CHECK-RULES.md` section 1: KEEP the cheaper start
   only if no seeded root cause is missed after escalation, its diagnosis accuracy is at least the current start's,
   and its total cost (escalations included) is lower. Record the escalation rate and whether escalated diagnoses
   agree with the current start.
4. Live runs behind a user approval gate and a spend cap, in an isolated sandbox, through a frozen runner (objective
   81's `scripts/eval81/run.cjs` and `prereg.cjs` are the model).

## When done

Apply or refuse the debugger tier change test-first, then record MEF-06 from that evidence in REQUIREMENTS.md and
76-VERIFICATION.md. Until the debugger has a result MEF-06 stays Partial. Once it has one, whether a start tier that
was measured and kept at Sonnet (the UI judge today) satisfies "start cheap" is a decision to put to the user, not
one to infer.
