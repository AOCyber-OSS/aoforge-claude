completed: 2026-10-18
---
created: 2026-10-17T23:00:00.000Z
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

## Resolution (objective 82, 2026-10-18)

**Applied as approved (arch only).** `focus.codebase-mapper.arch` is sonnet / sonnet / sonnet; `agents.codebase-mapper`
stays sonnet / haiku / haiku and `focus.codebase-mapper` has exactly the keys `arch` and `concerns` (no `tech`, no
`quality`). P2 was not part of objective 82's live check (only P1, P4 and P5 were), so it stands on objective 81's
evidence above with its caveat (the refusal rests on three misnamed files in one Haiku fleet run).

- **Commits** (TRD 82-03): RED `9d8333f8` (the new focus tests failed on the old table, the key-set pin included,
  since `arch` was missing), GREEN `10311e5c` (the JSON diff touches only the `focus` block), docs `a1d60a9b`
  (model-profiles.md's focus table and P2's evidence and caveat). The focus key `arch` is the one `init.cjs`
  `mapper_models` and `map-codebase.md` already use.
- **Pin tests**, re-run on 2026-10-18: `node --test --test-name-pattern 'objective 82: approved tier proposals'
  plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs` printed `✔ init map-codebase: arch and concerns resolve to
  sonnet, tech and quality to haiku, on balanced and budget`, `✔ resolve-model codebase-mapper --focus arch is sonnet
  from the focus table on every profile`, `✔ table pins: P2 arch, P3 concerns, P4 architecture (reverted by 82-08), P5
  pitfalls`, `✔ the shared mapper row is untouched and tech and quality get no focus entry (P2 is arch only)`,
  `pass 5`, `fail 0`.
- Documented in CHANGELOG `## [3.1.0]` (`### 3.1.0 follow-ups (objective 82)`), model-profiles.md and USER-GUIDE
  Model Profiles (TRD 82-10).
