---
objective: 77-stack-packs-contract-and-extraction
verified: 2026-10-17T00:00:00Z
status: passed
score: 5/5 must-haves verified
retroactive: true
retroactive_note: "Objective 77 landed on main through plain PRs #132/#133/#134 on 2026-10-16, outside the AOForge flow (no TRDs, SUMMARYs or VERIFICATION carried here). Verified goal-backward against branch integrate/3.1.0 at HEAD a589d306, with quick 34-39 fixes in the tree."
deployment_verification: not_available
notes:
  - kind: advisory
    note: "aoforge-stack-web ships no tests of its own (agents, fragments and the vendored sync hook only); its manifest, sync-pack byte-identity and selection are covered by core stack-packs.test.cjs."
  - kind: advisory
    note: "Pack install through the real Claude Code plugin manager (dependency range aoforge >=3.1.0) was not exercised; the version lockstep is enforced by a repo test in stack-packs.test.cjs (quick 34). No devcluster applies to plugin distribution."
  - kind: advisory
    note: "Neutrality allowlist keeps design-stack-flutter.md as known debt and the OBJECTIVE's 'left for later' items as data entries; quick 39 / objective 77 leftovers removed six of them."
---

# Objective 77: Stack packs: contract and extraction Verification Report

**Objective Goal:** Core AOForge names no stack. Flutter, Dart and web procedure ships in stack pack plugins that a project selects through its stack profile, and core reaches them only through the pack contract (`docs/PROPOSAL-stack-packs.md` M0 + M0.5, no compatibility shim).
**Verified:** 2026-10-17
**Status:** passed
**Re-verification:** No — retroactive initial verification (objective landed outside the AOForge flow)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Manifest (`schemas/stack-pack.schema.json`) discovered from its mirror, honoured only while its plugin is enabled, activated only by selection (extends, config, runtime); detection only proposes | VERIFIED | Scratch HOME: each pack's own `hooks/sync-pack.cjs` mirrored it to `~/.claude/aoforge/stacks/{flutter,web}`. Project with `pubspec.yaml` and no selection: `stack discover` -> `proposed: flutter`, nothing active. `stacks.enabled: [flutter]` -> `active: flutter (config stacks.enabled)`. `extends: flutter` in STACK.md -> `active: flutter (profile extends flutter)`. Registry without the flutter plugin -> `plugin not enabled`, not active. Runtime selection covered by stack-packs.test.cjs case 3. |
| 2 | `stack context <agent>` points agents at active packs' fragments and sub-agents; `stack verify --changed/--all` merges pack results; `missing` never passes; pack profiles resolve as a tier | VERIFIED | `stack context verifier` JSON: `packs.fragments` (flutter, web verifier.md paths) and `packs.subagents` (`aoforge-stack-web:web-ui-verifier`). No-pack project: zero "Stack packs" lines. Selected-but-disabled pack: `stack verify --all` -> `missing`, exit 2; `stack doctor` -> not ready, exit 1 (quick 35 fix). Tests: "merges a pack result", "neither passes", "mergeStatus orders error > missing > fail > pass". `extends: flutter` resolved through the pack profile tier; `resolve-model ui-evaluator` resolves from the pack manifest `models{}`. |
| 3 | `aoforge-stack-flutter` and `aoforge-stack-web` ship in the marketplace with moved modules, agents, skills, profiles and fragments; their tests pass from the pack | VERIFIED | marketplace.json: aoforge 3.1.0, aoforge-stack-flutter 1.0.0, aoforge-stack-web 1.0.0. Flutter pack: lib/ (16 test files), bin/aof-flutter.cjs, agents/ui-evaluator.md, skills ui-eval + design-review, profiles flutter/dart, fragments planner/executor/verifier, gate_policy + awareness hooks. Web pack: agents/web-ui-verifier.md, fragments executor/verifier. `node --test plugins/aoforge-stack-flutter/lib/*.test.cjs`: 268/268 pass. No core alias: `flutter-ui setup`, `verify flutter-state-coverage`, `verify flutter-ui-eval`, `generate uat` all return "Unknown command". |
| 4 | `stack-neutrality.repo.test.cjs` passes: no core agent, skill, hook, workflow or lib names a pack stack outside a data-only allowlist | VERIFIED | Passes in the targeted run. Since quick 39 it scans all of core (incl. templates, references, schemas, stack-profiles) and `browser_*` names from any MCP server; executor's five read-only browser grants are token-scoped (GRANT_ALLOW). Manual grep of executor/verifier/planner: only decided `mcp__gopls__*`/`mcp__dart__*` grants and generic `go test` examples. |
| 5 | Pack releases tag as `<pack>--vX.Y.Z` and the changelog gate checks them | VERIFIED | changelog-on-tag.js:69-70, 207-283 gates `<pack>--vX.Y.Z` on the pack CHANGELOG, plugin.json and marketplace entry, `aoforge--vX.Y.Z` like `vX.Y.Z`; tests at changelog-on-tag.test.js:486-578 pass. scripts/release-tag.cjs (quick 34) creates pack releases with `--latest=false`; release-tag.test.cjs passes. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status |
|----------|----------|--------|
| `plugins/aoforge/aoforge/schemas/stack-pack.schema.json` | manifest contract (incl. soft_depends) | VERIFIED |
| `plugins/aoforge/aoforge/bin/lib/stack-packs.cjs`, `stack-packs-cli.cjs`, `pack-mirror.cjs`, `stack-pack-hints.cjs` | discovery, selection, verify merge, mirror, install hints | VERIFIED |
| `plugins/aoforge-stack-flutter/` | moved Flutter/Dart procedure | VERIFIED |
| `plugins/aoforge-stack-web/` | web-ui-verifier + fragments | VERIFIED |
| `plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs` | neutrality guard | VERIFIED |
| `plugins/aoforge/hooks/changelog-on-tag.js`, `scripts/release-tag.cjs` | pack tag gate and release | VERIFIED |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| pack SessionStart hook | `~/.claude/aoforge/stacks/<name>` | sync-pack.cjs | WIRED (run live) |
| discoverPacks | plugin registry | pluginEnabled(installed_plugins.json, settings) | WIRED |
| STACK.md extends / config / runtime / TRD platform | activePacks | selection + soft_depends | WIRED |
| core verifier | web-ui-verifier | `packs.subagents` in stack context | WIRED |
| stack verify | pack CLI | mergeStatus, unavailableSelectedPacks | WIRED |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PCK-01 | SATISFIED | SC1, SC2 |
| PCK-02 | SATISFIED | SC2; quick 39 removed the remaining direct browser instructions from verify-work/checkpoints/verification-patterns |
| PCK-03 | SATISFIED | SC3, SC4 |
| PCK-04 | SATISFIED | SC5 |
| STK-01 | SATISFIED | core agent prompts carry no stack procedure (also objective 76 SC7) |

REQUIREMENTS.md still lists these as Pending; updating traceability is the orchestrator's call.

### Defects found by the 2026-10-16 end-to-end test and closed by quick tasks

| Quick | Defect (77 surface) | Closed? | Evidence on this tree |
|-------|---------------------|---------|-----------------------|
| 34 | core at 3.0.0 failed the packs' `aoforge >=3.1.0` (Claude Code disabled both); unresolvable `extends: flutter` gave no install hint | CLOSED | all release files 3.1.0; stack-pack-hints.cjs; repo test in stack-packs.test.cjs |
| 34 | pack tag form / changelog hint wrote `## [aoforge--vX.Y.Z]`; pack tags shortened the changelog range | CLOSED | release-tag.cjs; changelog-on-tag tests 536-578 |
| 35 | `stack verify --task ../..` escaped the verify dir | CLOSED | task-id validation test passes |
| 35 | selected-but-unavailable pack: verify `pass` / doctor "No active stack packs", exit 0 | CLOSED | reproduced live: verify exit 2 `missing`, doctor exit 1 |
| 37 | release dry run and tag ruleset inspection | CLOSED | release-tag/tag-rules tests pass |
| 38 | Flutter web TRDs did not select the web pack (coverage fell silently to humans) | CLOSED | reproduced live: TRD `platform: [mobile, web]` -> `active: web (soft dependency of flutter for platform web)` |
| 38 | web executor self-check missing | CLOSED | plugins/aoforge-stack-web/fragments/executor.md; five-token grant guarded |
| 39 | verify-work and references still instructed browser tool calls; Flutter TRD/UAT fields in core templates; guard did not scan all of core | CLOSED | neutrality guard scope widened; test passes |

### Anti-Patterns Found

None blocking. Raw output of `stack verify --raw` / `stack doctor --raw` ends without a trailing newline (cosmetic).

### Functional Verification

_Skipped (UI): not a UI objective; runtime is the aof-tools CLI and plugin mirror._ Exercised live in a scratch project with a scratch HOME (never the real `~/.claude`, never port 8080): mirror, discover, select by config and extends, soft dependency, disabled plugin blocking, stack context fragments/subagents, pack-tier model resolution.

### Human Verification Required

None. (Optional, not blocking: `/plugin install aoforge-stack-flutter@aocyber` against a real Claude Code with core 3.1.0 to confirm the dependency range is accepted.)

### Gaps Summary

No gaps. The pack contract, mirror, selection-by-intent, verify merge, extraction to two marketplace packs, neutrality guard and pack tag gate all exist, are wired and were exercised. The defects the 2026-10-16 end-to-end test found on this surface (version lockstep, unavailable selected packs passing, task-path escape, missing web selection for Flutter web, residual browser procedure in core) are closed on this tree.

---

_Verified: 2026-10-17 (retroactive)_
_Verifier: Claude (verifier)_
