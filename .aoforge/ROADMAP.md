# Roadmap: AOForge

## Milestones

- ✅ **v1.1 — DevFlow Coordination Layer** — Objectives 0–9, 6, 8, 24 (shipped 2026-05-06)
- ✅ **v1.2 — Token Efficiency + Ambient Mode + Handoff Polish** — Objectives 10–23, 25 (shipped 2026-07-22)
- ✅ **v1.3 — Autonomy hardening, stack profile, upgrade/adopt, doc auto-correction** — Objectives 27–41 (completed 2026-09-28; plugin v2.11.0, merged to `main` with 2.13.0)
- ✅ **v1.4 — GitHub as system of record, stack drafter, doctor, autonomy hardening** — Objectives 42–54 (completed 2026-10-05; plugin v2.13.0 + v2.13.1; 26 killed)
- ✅ **v1.5 — Gate & Plumbing** — Objectives 55–64 (completed 2026-10-08; 55 in plugin v2.13.2, 56–64 unreleased; EST-08 not met, accepted)
- ✅ **v1.6 — Hardening & Release** — Objectives 65–82 (completed 2026-10-21; plugin v2.14.0, v3.0.0 and v3.1.0; EST-11 not met and MEF-06 partial, accepted)

Full archived roadmaps: `.aoforge/milestones/v1.2-ROADMAP.md` (v1.1 + v1.2 detail), `.aoforge/milestones/v1.3-ROADMAP.md` (v1.3 detail; audit: `milestones/v1.3-MILESTONE-AUDIT.md`), `.aoforge/milestones/v1.4-ROADMAP.md` (v1.4 detail; audit: `milestones/v1.4-MILESTONE-AUDIT.md`), `.aoforge/milestones/v1.5-ROADMAP.md` (v1.5 detail; audit: `milestones/v1.5-MILESTONE-AUDIT.md`; requirements: `milestones/v1.5-REQUIREMENTS.md`), `.aoforge/milestones/v1.6-ROADMAP.md` (v1.6 detail; requirements: `milestones/v1.6-REQUIREMENTS.md`). Milestone history: `.aoforge/MILESTONES.md`.

## Objectives

<details>
<summary>✅ v1.1 DevFlow Coordination Layer — SHIPPED 2026-05-06</summary>

- [x] Objective 0: Refine (kind, work) defaults table (6/6 plans)
- [x] Objective 1: GitHub coordination layer (6/6 plans)
- [x] Objective 2: Cross-repo awareness layer (7/7 plans)
- [x] Objective 3: Planning-time org awareness (7/7 plans)
- [x] Objective 4: Duplicate-work detection + resolution flow (6/6 plans)
- [x] Objective 5: Initiative context layer (5/5 plans)
- [x] Objective 6: Unified check-todos (4/4 plans)
- [x] Objective 7: Handoff watcher (shipped via PR #19)
- [x] Objective 8: Program-aware TUI viewer (3/3 plans)
- [x] Objective 9: Roadmap ↔ disk reconciliation (3/3 delivered; 09-03 SUMMARY.md missing — docs gap only)
- [x] Objective 24: Natural-language routing trigger fixes (3/3 plans)

</details>

<details>
<summary>✅ v1.2 Token Efficiency + Ambient Mode + Handoff Polish — SHIPPED 2026-07-22</summary>

- [x] Objective 10: Phase E — Agent-spawn audit (2/2 plans)
- [x] Objective 11: Phase D — build → verifier wiring (1/1 plan)
- [x] Objective 12: Phase G+I — Skill consolidation 28→14 (7/7 plans)
- [x] Objective 13: Phase H — Prompt extraction to references (4/4 plans)
- [x] Objective 14: Phase F — Default-on safety nets (5/5 plans)
- [x] Objective 15: Phase A — Authoritative routing keystone (5/5 plans)
- [x] Objective 16: Phase B — /devflow:micro skill (4/4 plans)
- [x] Objective 17: Phase C — Auto-init detection (4/4 plans)
- [x] Objective 18: v1.1 polish bundle (3/3 plans)
- [x] Objective 19: PTY support for handoff watcher (5/5 plans)
- [x] Objective 20: Daemon polish bundle (5/5 plans)
- [x] Objective 21: Bidirectional GH sync + configurable defaults table (5/5 plans)
- [x] Objective 22: Workflow-impediment fixes (4/4 plans)
- [x] Objective 10: Autonomous mode overhaul (9/9 plans) <!-- duplicate number, parallel session -->
- [x] Objective 23: Claude compatibility cleanup (5/5 plans)
- [x] Objective 10: Flutter UI verification process (9/9 plans, released v2.2.0) <!-- duplicate number, parallel session -->
- [x] Objective 25: Fleet audit fixes (6/6 plans, UAT 8/8 pass)

</details>

<details>
<summary>✅ v1.3 Autonomy Hardening, Stack Profile, Upgrade/Adopt, Doc Auto-correction — COMPLETED 2026-09-28 (plugin v2.11.0)</summary>

- [x] Objective 27: Gate correctness (5/6; 27-03 deferred → DECISION-001) — verified 6/6
- [x] Objective 28: Model tier binding and escalation (5/6; 28-06 deferred) — verified 6/6
- [x] Objective 29: Context discipline (4/4) — verified 5/5
- [x] Objective 30: Agent environment hygiene (4/4) — verified 5/5
- [x] Objective 31: Telemetry and retention (3/3) — verified 6/6
- [x] Objective 32: Visual-eval default path tells the truth (4/4) — verified 23/23, human_needed (CI secret)
- [x] Objective 33: The visual gate actually runs in CI (3/3) — verified 22/22
- [x] Objective 34: UI Oracle Loop W1b — Surface Spec (11/11) — verified 9/9, human_needed (branch protection)
- [x] Objective 35: Stack profile loader (11/11) — verified 10/10
- [x] Objective 36: Upgrade in place (10/10) — verified 66/66
- [x] Objective 37: /devflow:adopt + backup pruning (16/16) — verified 7/7
- [x] Objective 38: Documentation auto-correction (12/12) — verified 9/9
- [x] Objective 39: Wire the telemetry & audit CLI (5/5, gap closure) — verified 12/12
- [x] Objective 40: Tooling correctness (6/6, gap closure) — verified 8/8
- [x] Objective 41: Retroactive verification of 27–34 (8/8, gap closure) — verified 6/6

</details>

<details>
<summary>✅ v1.4 GitHub as System of Record, Stack Drafter, Doctor, Autonomy Hardening — COMPLETED 2026-10-05 (plugin v2.13.0 + v2.13.1)</summary>

- [x] Objective 42: Codebase-aware stack drafter (15/15) — verified 5/6, gap closed by 43
- [x] Objective 43: Stack drafter rules (15/15, gap closure) — verified 36/36
- [x] Objective 44: Autonomy hardening (10/10) — verified 7/7
- [x] Objective 45: DevFlow doctor + runtime hygiene (10/10) — verified 13/13
- [x] Objective 46: GitHub sync foundations (10/10) — verified 6/6
- [x] Objective 47: GitHub authoritative store (14/14) — verified 6/6
- [x] Objective 48: Planning write-path migration (23/23) — verified 10/10, human_needed (live smoke)
- [x] Objective 49: Objective branch and PR lifecycle (15/15) — verified 4/4
- [x] Objective 50: GitHub enforcement and setup (13/13) — verified 4/4
- [x] Objective 51: GitHub migration and docs (10/10) — verified 3/3
- [x] Objective 52: Store-mode polish (6/6, tech debt) — verified 32/32
- [x] Objective 53: Worktree and health hygiene (7/7, tech debt) — verified 8/8
- [x] Objective 54: CodeQL cleanup (10/10) — verified 9/9; CodeQL on main 56 → 0
- [—] Objective 26: GitHub issue auto-build monitor — killed 2026-10-01 (GMD-04)

</details>

<details>
<summary>✅ v1.5 Gate & Plumbing — COMPLETED 2026-10-08 (Objective 55 in plugin v2.13.2; 56–64 unreleased)</summary>

- [x] Objective 55: Store live-smoke fixes (8/8) — verified 7/7
- [x] Objective 56: Objective-number correctness (5/5) — verified 6/6
- [x] Objective 57: Estimation data foundation (7/7) — verified 4/4
- [x] Objective 58: Estimation engine and surfacing (10/10) — verified 4/4
- [x] Objective 59: State and merge plumbing (7/7) — verified 5/5
- [x] Objective 60: Edit gate enforces the action (7/7) — verified 5/5
- [x] Objective 61: Store-mode rough edges and observability (9/9) — verified 5/5
- [x] Objective 62: Built-in sweep (11/11) — verified 3/3, UAT approved
- [x] Objective 63: Todo store, hook coexistence and built-in inventory (7/7) — verified 3/3, UAT approved
- [x] Objective 64: Estimate accuracy validation (10/10, incl. one gap-closure cycle) — verified 2/3; EST-08 not met, accepted

</details>

<details>
<summary>✅ v1.6 Hardening & Release — COMPLETED 2026-10-21 (plugin v2.14.0, v3.0.0, v3.1.0)</summary>

- [x] Objective 65: Release v1.5
- [x] Objective 66: Executor token stamp
- [x] Objective 67: Minutes recalibration
- [x] Objective 68: Milestone and objective verbs
- [x] Objective 69: Drafts, health and doctor
- [x] Objective 70: CLI defects and hook shape
- [x] Objective 71: Stack drafter and verify policy
- [x] Objective 72: Rename to AOForge and naming cleanup
- [x] Objective 73: Handoff gaps and result injection
- [x] Objective 74: Operations decisions
- [x] Objective 75: Prospective estimate retest and todo sweep
- [x] Objective 76: Model efficiency and stack-specific content
- [x] Objective 77: Stack packs: contract and extraction
- [x] Objective 78: Remove the rename shims
- [x] Objective 79: Reconcile and release 3.1.0
- [x] Objective 80: Adopt migrates legacy projects
- [x] Objective 81: Haiku eval and model-efficiency measurement
- [x] Objective 82: 3.1.0 follow-ups

Detail: `.aoforge/milestones/v1.6-ROADMAP.md`.

</details>

## Progress

| Objective | Milestone | Plans | Status | Completed |
|---|---|---|---|---|
| 0–9, 6, 8, 24 (13 objectives) | v1.1 | 53/53 | Complete | 2026-05-06 |
| 10–23 (15 objectives) | v1.2 | 71/71 | Complete | 2026-05-25 |
| 25. Fleet audit fixes | v1.2 | 6/6 | Complete | 2026-07-22 |
| 27–41 (15 objectives) | v1.3 | 107/109 | Complete (27-03, 28-06 deferred) | 2026-09-28 |
| 42–54, 26 (13 objectives + 26 killed) | v1.4 | 158/158 | Complete | 2026-10-05 |
| 55–64 (10 objectives) | v1.5 | 81/81 | Complete (EST-08 not met, accepted) | 2026-10-08 |
| 65. Release v1.5 | v1.6 | 4/4 | Complete | 2026-10-08 |
| 66. Executor token stamp | v1.6 | 4/4 | Complete | 2026-10-08 |
| 67. Minutes recalibration | v1.6 | 9/9 | Complete | 2026-10-08 |
| 68. Milestone and objective verbs | v1.6 | 7/7 | Complete | 2026-10-08 |
| 69. Drafts, health and doctor | v1.6 | 6/6 | Complete | 2026-10-08 |
| 70. CLI defects and hook shape | v1.6 | 3/3 | Complete | 2026-10-08 |
| 71. Stack drafter and verify policy | v1.6 | 5/5 | Complete | 2026-10-08 |
| 72. Install and naming cleanup | v1.6 | 27/27 | Complete | 2026-10-09 |
| 73. Handoff gaps and result injection | v1.6 | 14/14 | Complete | 2026-10-10 |
| 74. Operations decisions | v1.6 | 9/9 | Complete | 2026-10-21 |
| 75. Prospective estimate retest and todo sweep | v1.6 | 5/5 | Complete | 2026-10-10 |
| 76. Model efficiency and stack-specific content | v1.6 | 8/8 | Complete (MEF-06 partial; the start-tier half is objective 82's) | 2026-10-17 |
| 77. Stack packs: contract and extraction | v1.6 | 5/5 | Complete (verified 2026-10-17, 77-VERIFICATION) | 2026-10-16 |
| 78. Remove the rename shims | v1.6 | 12/12 | Complete | 2026-10-17 |
| 79. Reconcile and release 3.1.0 | v1.6 | 10/10 | Complete | 2026-10-21 |
| 80. Adopt migrates legacy projects | v1.6 | 9/9 | Complete | 2026-10-17 |
| 81. Haiku eval and model-efficiency measurement | v1.6 | 19/19 | Complete | 2026-10-17 |
| 82. 3.1.0 follow-ups | v1.6 | 11/11 | Complete | 2026-10-18 |
