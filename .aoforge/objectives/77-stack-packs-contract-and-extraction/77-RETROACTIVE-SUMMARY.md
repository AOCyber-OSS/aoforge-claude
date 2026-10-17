---
objective: 77-stack-packs-contract-and-extraction
retroactive: true
retroactive_note: "Objective 77 landed on main through plain PRs #132 and #134 on 2026-10-16, outside the AOForge flow, so no TRD or per-TRD SUMMARY exists in this tree. This file is the objective-level record that 77-VERIFICATION.md (retroactive, 2026-10-17) is checked against. It is not a SUMMARY of any one TRD and keys to none (77-01..77-05 stay as ROADMAP.md records them)."
subsystem: stack-packs
tags: [stack-packs, pack-contract, neutrality, aoforge-stack-flutter, aoforge-stack-web, release-tag, retroactive]
provides:
  - "Stack pack contract: manifest schema, discovery from the mirror gated on the plugin being enabled, selection, a pack profile tier, `stack discover|doctor|verify --changed|--all`"
  - "Agents reach stack procedure only through `stack context <agent>` (fragments and pack sub-agents)"
  - "aoforge-stack-flutter and aoforge-stack-web packs; stack-neutrality.repo.test.cjs guards core"
  - "`<pack>--vX.Y.Z` releases gated on the pack CHANGELOG and manifests"
affects: [objective 76, objective 79, quick 42]
key-files:
  created:
    - plugins/aoforge/aoforge/schemas/stack-pack.schema.json
    - plugins/aoforge/aoforge/bin/lib/stack-packs.cjs
    - plugins/aoforge/aoforge/bin/lib/stack-packs-cli.cjs
    - plugins/aoforge/aoforge/bin/lib/pack-mirror.cjs
    - plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs
    - plugins/aoforge-stack-flutter/aoforge-stack.json
    - plugins/aoforge-stack-web/aoforge-stack.json
  modified:
    - plugins/aoforge/hooks/changelog-on-tag.js
requirements-completed: [PCK-01, PCK-02, PCK-03, PCK-04, STK-01]
completed: 2026-10-16
---

# Objective 77: Stack packs, contract and extraction, retroactive Summary

**Core names no stack: Flutter, Dart and web procedure ships in the aoforge-stack-flutter and aoforge-stack-web packs, which a project selects through its stack profile and core reaches only through the pack contract. Landed on `main` via PRs #132 and #134; recorded here after the fact.**

## Why this file exists

Objective 77 was built on `main` through plain PRs, not through `/aoforge:execute-objective`, so its TRDs and their
SUMMARYs were never carried into this tree. `77-VERIFICATION.md` (commit 5fccd65d, status passed, 5/5) marks five
requirements SATISFIED. The requirements-agreement check (`validate requirements`, health W065) requires every
satisfied requirement to appear in some SUMMARY of the objective. This file lists exactly those five. It is an
objective-level record, deliberately keyed to no TRD: it ticks no ROADMAP row, and token coverage reports it as
unkeyed rather than counting it.

## Where the work is

| Source | What | Evidence |
|---|---|---|
| PR #132 | Objectives 76 and 77: model efficiency, and stack packs | merge commit f7636bdc |
| PR #134 | Objectives 76 and 77: mechanical verbs, focus tiers, escalation, and the last stack-pack moves | merge commit ee93e66f |
| quick 34 | pack version lockstep test; `scripts/release-tag.cjs` pack releases | `.aoforge/quick/34-release-blockers-for-3-1-0-and-security-/` |
| quick 35 | `stack doctor` reports a selected-but-disabled pack as not ready | `.aoforge/quick/35-model-overrides-no-progress-matcher-adva/` |
| quick 38 | flutter web selects the web pack; executor's read-only browser grants | `.aoforge/quick/38-flutter-web-selects-web-pack-web-pack-ex/` |
| quick 39 | the remaining web and Flutter procedure moved out of core; neutrality scans all of core | `.aoforge/quick/39-move-remaining-web-and-flutter-procedure/` |

The objective was merged into this branch through `afbe19a4` (objective 79).

## Requirements

| Requirement | 77-VERIFICATION status | Listed here |
|---|---|---|
| PCK-01 | SATISFIED (SC1, SC2) | yes |
| PCK-02 | SATISFIED (SC2; quick 39) | yes |
| PCK-03 | SATISFIED (SC3, SC4) | yes |
| PCK-04 | SATISFIED (SC5) | yes |
| STK-01 | SATISFIED (core agent prompts carry no stack procedure; also objective 76 SC7) | yes |

## Deviations from Plan

None as a TRD record: there was no AOForge plan. The work was planned and reviewed in the PRs above.

## Self-Check: PASSED

- FOUND: `.aoforge/objectives/77-stack-packs-contract-and-extraction/77-VERIFICATION.md`
- FOUND: merge commits f7636bdc (#132) and ee93e66f (#134) in `git log`
- FOUND: quick 34, 35, 38 and 39 directories under `.aoforge/quick/`
- FOUND: every path under `key-files`
- `requirements-completed` equals the SATISFIED rows of 77-VERIFICATION's Requirements Coverage table
