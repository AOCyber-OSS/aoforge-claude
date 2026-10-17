---
created: 2026-10-17T23:30:00.000Z
title: "Apply objective 81 tier proposal: codebase-mapper:arch"
area: model-tiers
files: [plugins/aoforge/aoforge/references/model-profiles.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json]
disposition: follow-up
disposition_reason: "Objective 81 proposal P2, approved by the user on 2026-10-17 in its narrower arch-only variant (a focus override); the shared codebase-mapper row and the quality focus stay as they are"
disposition_target: "a follow-up objective or quick task (not objective 81)"
disposition_date: 2026-10-17
disposition_by: objective 81 (TRD 81-19 decision)
---

## Problem

Objective 81's batch C refused Haiku 5.5 for codebase-mapper:arch under the pre-registered rule. Haiku's recall was
higher, but its fabrications per run exceeded Sonnet's by more than 0.5. The rule's proposal (P2) raised the shared
`agents.codebase-mapper` row, which tech, arch and quality all use. The user approved only the narrower variant:
raise arch alone, through a focus override. Nothing was changed in objective 81.

## Change

- **File:** `plugins/aoforge/aoforge/references/model-profiles.json`
- **Key:** `focus.codebase-mapper.arch` (new). `agents.codebase-mapper` and the existing
  `focus.codebase-mapper.concerns` are not touched by this todo.
- **Current tier per profile:** none of its own. The arch focus uses the agent row: quality sonnet, balanced haiku,
  budget haiku.
- **Proposed tier per profile:** quality sonnet, balanced sonnet, budget sonnet.
- **How it takes effect:** `init map-codebase` emits `mapper_models.arch` through the focus layer
  (`init.cjs` `agentTierMap`, `MODEL_FOCUS`). `map-codebase.md` spawns the arch mapper with
  `model="{mapper_models.arch}"`. Add a `model-profiles.test.cjs` case for the new focus.

## Evidence (81-HAIKU-EVAL.md, results/C.json)

- Rule outcome: **REFUSE** on the fabrication bound. Haiku 3.00 fabrications per run against Sonnet 0.75 (+2.25,
  above +0.50).
- Recall: Haiku 41/46 (89.1%, 95% CI 77.0-95.3%), Sonnet 39/46 (84.8%, 95% CI 71.8-92.4%), +4.3. n is 4 runs per
  model (2 synthetic, 2 fleet).
- Post-hoc readings (labelled in the report, not the registered result):
  - **Grader-only fabrications:** 0.00 vs 0.00, which would be a WEAK_ENDORSE.
  - **The 86 mechanical flags read by hand:** 3 real path errors, all in one Haiku fleet arch run. They are files
    named as existing that do not exist, or that sit in another directory. That gives 0.75 vs 0.00 to 0.25 per run,
    a borderline REFUSE.
- Spot-check: 6 of 6 grader verdicts agree.
- Cost on the eval: Haiku $0.07, Sonnet $0.55 for 4 arch runs each.

## Not approved

The quality half of P2 was not approved. Its refusal (2.00 vs 1.33 fabrications per run) rests on mechanical flags
that are not fabrications. Quality stays on the shared row.
