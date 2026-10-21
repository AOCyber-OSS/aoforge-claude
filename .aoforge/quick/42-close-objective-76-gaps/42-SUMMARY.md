---
objective: quick-42
trd: 01
subsystem: model-resolution
tags: [model-placeholders, resolve-model, escalation, ui-judge, benchmark, requirements-agreement]
requires:
  - objective: 76
    provides: "resolve-model --escalate-from, the debugger escalation pattern, 76-VERIFICATION gaps SC1/SC6"
  - objective: 77
    provides: "aoforge-stack-flutter pack (ui-evaluator, flutter-ui-eval engine), pack-mirror"
provides:
  - "model-placeholders.repo.test.cjs: every spawn model placeholder names a source its file supplies"
  - "execute-objective, build, new-milestone, research-objective spawn with supplied models"
  - "verify flutter-ui-eval --judge-tier; rollup judge_tier + tier_escalation; ui-evaluator ESCALATION REQUESTED; /aoforge:ui-eval one-rung re-spawn"
  - "benchmark per-objective counts executor spawns (isExecutorType)"
  - "retroactive objective 76/77 SUMMARYs: requirements-agreement and validate requirements green"
affects: [objective 76 re-verification, objective 79 release]
key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs
    - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md
    - .aoforge/objectives/77-stack-packs-contract-and-extraction/77-RETROACTIVE-SUMMARY.md
  modified:
    - plugins/aoforge/aoforge/workflows/execute-objective.md
    - plugins/aoforge/aoforge/workflows/build.md
    - plugins/aoforge/aoforge/workflows/new-milestone.md
    - plugins/aoforge/aoforge/workflows/research-objective.md
    - plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs
    - plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs
    - plugins/aoforge-stack-flutter/lib/flutter-ui-eval-dogfood.test.cjs
    - plugins/aoforge-stack-flutter/agents/ui-evaluator.md
    - plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md
    - plugins/aoforge/aoforge/bin/lib/benchmark.cjs
    - plugins/aoforge/aoforge/bin/lib/benchmark.test.cjs
    - plugins/aoforge-stack-flutter/CHANGELOG.md
    - CHANGELOG.md
key-decisions:
  - "Objective 76/77 requirements are recorded in one retroactive, TRD-unkeyed SUMMARY per objective (76-RETROACTIVE-SUMMARY.md, 77-RETROACTIVE-SUMMARY.md) via summary post --file, so no ROADMAP TRD row is ticked and token coverage skips them"
  - "The judge escalates only on split live votes on expect:pass states; the engine records tier_escalation, the agent returns the block, the skill re-spawns once"
requirements-completed: []
completed: 2026-10-17
---

# Quick 42: Close objective 76 gaps Summary

## Progress
- [x] Task 1: model placeholder guard (RED) — cd389f39
- [x] Task 1: workflows name a supplied model (GREEN) — e05d8b84
- [x] Task 2: judge tier tests (RED) — c872d2a3
- [x] Task 2: engine --judge-tier + tier_escalation — d34272eb
- [x] Task 2: ui-evaluator + /aoforge:ui-eval escalation prose — d6fb7843
- [x] Task 3: benchmark executor count (RED) — aa24ec68
- [x] Task 3: benchmark executor count (GREEN) — fd363a43
- [x] Extra: retroactive 76/77 SUMMARYs (requirements agreement) — 801103e5
- [x] Task 3: changelogs — 1cb50783
- [x] Task 3: full suite and evidence — no commit (evidence only)

**One-liner:** A CI guard now proves every spawn `model` placeholder has a source (it found 8 that did not, all fixed); the UI judge escalates one vision rung on split live votes through `--judge-tier`, a recorded `tier_escalation`, an agent `## ESCALATION REQUESTED` and a one-rung re-spawn in `/aoforge:ui-eval`; `benchmark per-objective` counts executor spawns; and retroactive objective 76/77 SUMMARYs make the requirements-agreement check green.

## Base and context

- BASE: `d35f120c6124ea56a4cf4aead86257d3aecfd6f0` (branch `integrate/3.1.0`; exec-context check ok, main checkout, not a worktree).
- Quick 40 at Step 0: `40-SUMMARY.md` exists and quick 40/41 were fully committed (HEAD d35f120c). `git status --short` showed only `?? amp`. CHANGELOG.md was clean, so the changelog step ran (no pending section).
- During the run, someone else's uncommitted work appeared in the main checkout: `.aoforge/ROADMAP.md` (objective 80 added) and `.aoforge/objectives/80-adopt-migrates-legacy-projects/`. Not mine; not staged, not touched. `amp` left alone.

## Suite totals (npm test globs minus `watcher-shell.test.cjs`, HOME = scratchpad/home-q42)

| Run | Files | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|---|
| BASE d35f120c | 411 | 12883 | 12854 | 2 | 27 |
| END 1cb50783 | 412 | 12907 | 12880 | **0** | 27 |

BASE failures (both pre-existing, both fixed by the extra task): `requirements-agreement.repo.test.cjs` test 11 and
`validate-requirements.test.cjs` test 9. The +24 tests are the new ones: 8 guard, 8 engine (E1-E4e), 6 CLI/wiring (J1-J6), 2 benchmark (B1-B2).

## Scoped per-file counts (tests/pass/fail)

| File | BASE | END |
|---|---|---|
| model-placeholders.repo (new) | 8/7/1 (RED) | 8/8/0 |
| context-budget.repo | 6/6/0 | 6/6/0 |
| executor-isolation | 11/11/0 | 11/11/0 |
| execute-objective-gh-sync | 10/10/0 | 10/10/0 |
| pr-lifecycle-prose.repo | 21/21/0 | 21/21/0 |
| builtin-sweep.repo | 17/17/0 | 17/17/0 |
| doc-refs.repo | 17/17/0 | 17/17/0 |
| planning-writes.repo | 11/11/0 | 11/11/0 |
| flag-spec.repo | 14/14/0 | 14/14/0 |
| stack-neutrality.repo | 7/7/0 | 7/7/0 |
| flutter-ui-eval | 49/49/0 | 57/57/0 |
| flutter-ui-eval-dogfood | 22/22/0 | 28/28/0 |
| verifier-ui-eval-invocation | 14/14/0 | 14/14/0 |
| flutter-ui-design-review | 14/14/0 | 14/14/0 |
| stack-packs | 46/46/0 | 46/46/0 |
| benchmark | 33/33/0 | 35/35/0 |
| agent-overhead | 7/7/0 | 7/7/0 |
| rename-guard.repo | 25/25/0 | 25/25/0 |
| requirements-agreement.repo | 2/1/1 | 2/2/0 |
| validate-requirements | 8/7/1 | 8/8/0 |

## RED evidence

**Task 1** (model-placeholders.repo at BASE, test 1 failed, 2-8 passed). Exactly the 8 findings the JOB predicted:

```
plugins/aoforge/aoforge/workflows/build.md:279 {verifier_model}
plugins/aoforge/aoforge/workflows/execute-objective.md:418 {resolved_executor_model}
plugins/aoforge/aoforge/workflows/execute-objective.md:500 {resolved_executor_model}
plugins/aoforge/aoforge/workflows/execute-objective.md:910 {resolved_verifier_model}
plugins/aoforge/aoforge/workflows/execute-objective.md:1017 {resolved_executor_model}
plugins/aoforge/aoforge/workflows/execute-objective.md:1323 {planner_model}
plugins/aoforge/aoforge/workflows/new-milestone.md:175 {MODEL}
plugins/aoforge/aoforge/workflows/research-objective.md:88 {researcher_model}
```

**Task 2** (after c872d2a3): flutter-ui-eval 57/49/8 — E1 `engine.judgeTier is not a function`, E2/E3 `'claude-sonnet-5-5' !== 'claude-opus-5-5'`, E4a-e `engine.judgeEscalation is not a function`. Dogfood 28/23/5 — J1 `judge_tier undefined !== 'opus'`, J2/J3 stderr empty (flag ignored), J4 `tier_escalation undefined`, J6 `ui-evaluator.md must contain ## ESCALATION REQUESTED`. J5 green at BASE as designed. After the engine commit only J6 failed; after the prompts commit all green.

**Task 3** (after aa24ec68): B1 `executor_calls 0 !== 1`, B2 `bm.isExecutorType is not a function`.

**Extra task** (BASE): 9 `requirements-unlisted` findings, MEF-02..05 (objective 76) and PCK-01..04, STK-01 (objective 77).

## Commits

| Hash | Message |
|---|---|
| cd389f39 | test(quick-42): every spawn model placeholder names a source its file supplies (RED) |
| e05d8b84 | fix(quick-42): spawns in execute-objective, build, new-milestone and research-objective name a supplied model (GREEN) |
| c872d2a3 | test(quick-42): judge tier override and split-vote escalation signal (RED) |
| d34272eb | feat(quick-42): --judge-tier and the tier_escalation signal in the visual-eval engine |
| d6fb7843 | feat(quick-42): ui-evaluator requests escalation on split votes and /aoforge:ui-eval re-spawns it one rung up |
| aa24ec68 | test(quick-42): benchmark counts executor spawns (RED) |
| fd363a43 | fix(quick-42): benchmark per-objective counts AOForge executor spawns (GREEN) |
| 801103e5 | docs(quick-42): retroactive objective 76 and 77 SUMMARYs list the requirements their VERIFICATIONs mark satisfied |
| 1cb50783 | docs(quick-42): changelogs |

All through `aof-tools commit`, each `committed: true`.

## SC1 / SC6 re-verification evidence

| Check | Command | Result |
|---|---|---|
| SC1 guard | `node --test plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs` | 8/8 pass |
| SC1 no stale names | `rg -n 'resolved_verifier_model\|\{planner_model\}' plugins/aoforge/aoforge/workflows/execute-objective.md` | empty |
| SC1 planner resolves | `aof-tools resolve-model planner --objective 76 --raw` | `inherit` (exit 0); in a scratch project `--objective 1` gives `inherit`, `resolve-model objective-researcher --objective 1 --raw` gives `sonnet` |
| SC6 engine tier | credential-less `aof-flutter verify flutter-ui-eval <fixture manifest> --judge live --judge-tier opus --raw` | exit 1 (verdict fail by design), `"judge_tier": "opus"`, `gate: binding`, `tier_escalation: {requested: false, trigger: null, from_tier: "opus", states: []}` |
| SC6 strict flag | same with `--judge labels --judge-tier opus` | exit 1, `Error: --judge-tier applies only to --judge live (the labels path calls no model)` |
| SC6 rung source | pack mirrored to scratchpad `stacks-q42`, `resolve-model ui-evaluator --escalate-from sonnet` | `{model: inherit, tier: opus, model_id: claude-opus-5-5, tier_source: escalation, escalated_from: sonnet, ceiling: false}`; `--escalate-from opus` gives `ceiling: true` |
| SC6 prose | J6 | ui-evaluator.md has `## ESCALATION REQUESTED`, `split-votes`, `**Judge tier:**`, `--judge-tier`; ui-eval SKILL.md has `UI_EVALUATOR_MODEL=$(`, `resolve-model ui-evaluator --escalate-from`, `--judge-tier` |
| Neutrality | `node --test plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs` | 7/7 pass; in core code the only pack name added is the guard's test 8 coverage path |
| No 8080 | `git diff d35f120c -G8080 --stat` | empty |
| Health | `aof-tools validate health --raw` | `healthy` (was `degraded` with 9 W065) |

## What changed

**Task 1.** `model-placeholders.repo.test.cjs` scans core workflows, core skills and every pack's skills/workflows/fragments (more than 60 files) for identifier placeholders in a `model="{x}"` / `model: "{x}"` position. A placeholder is supplied only by a key its file's own `init <cmd>` prints (run in a fixture project with a fixture HOME; init.cjs is never parsed), a `NAME=$(… resolve-model …)` line, or a `<!-- model-source: NAME from SRC -->` annotation whose SRC root is supplied; names compare case-insensitively; stale annotations fail too. Fixes: execute-objective step 3 declares `{resolved_executor_model}` (annotation from `executor_model`); the checkpoint verifier uses `{verifier_model}`; the gap-closure planner uses `PLANNER_MODEL=$(… resolve-model planner --objective "${OBJECTIVE_NUMBER}" --raw)` (+408 chars, file 79,666 < 80,300). build.md assigns `EXECUTOR_MODEL`/`VERIFIER_MODEL`. new-milestone annotates `MODEL from researcher_models.<dimension>`. research-objective resolves `RESEARCHER_MODEL` after Step 1 normalizes the objective.

**Task 2.** Engine: `JUDGE_TIERS`, `judgeTier(profile, override)` (strict, throws on an unknown tier), `judgeModel(profile, tierOverride)` (bare call unchanged, so `flutter-ui-design-review.cjs` is unaffected), `buildVisionRequest` honours `request.judge_tier`, pure `judgeEscalation()`. CLI: `--judge-tier` only with `--judge live`, only haiku|sonnet|opus (missing value included), via `error()` with `return`. Rollups add `tier_escalation` (all scored runs) and `judge_tier` (live only); every other field and exit code unchanged. Agent: score-step flag passthrough, new `escalate` step (never on design-review, labels, credential/network reviews or an already-escalated re-spawn), the `## ESCALATION REQUESTED` block, `**Judge tier:**` on live UI-EVAL COMPLETE, and a critical rule that the agent never picks a tier. Skill: `UI_EVALUATOR_MODEL=$(… resolve-model ui-evaluator --raw)`, a Task block, the one-rung handler (`--escalate-from "{Judge tier}"`; ceiling, `unknown_agent` or already-escalated reports the first rollup) and the inline-run rule. Core untouched by Task 2.

**Task 3.** `benchmark.cjs` builds `EXECUTOR_TYPE_RE` from `legacy-names.cjs` (`NAMES.agentNs`, `LEGACY.agentNs`, `LEGACY.installPrefix` + `executor$`), exports `isExecutorType`; the pre-rename literal is gone (`rg -n "'df-" benchmark.cjs` empty).

**Extra task (requirements agreement).** Objectives 76/77 landed via PRs #132/#134 with no TRDs or SUMMARYs in this tree, while their retroactive VERIFICATIONs (5fccd65d) mark requirements SATISFIED. Fixed at the source, not in the check: one retroactive SUMMARY per objective, published with `summary post 76-00 --file 76-RETROACTIVE-SUMMARY.md` and `summary post 77-00 --file 77-RETROACTIVE-SUMMARY.md` (local mode). Frontmatter `retroactive: true` with a note, `requirements-completed` exactly the SATISFIED rows (76: MEF-02, MEF-03, MEF-04, MEF-05; 77: PCK-01..04, STK-01), body pointing at merge commits f7636bdc (#132) and ee93e66f (#134) and quick 34-39. MEF-01 and MEF-06 (PARTIAL) are not listed; 76-06 and 76-08 stay open. The name keys to no TRD on purpose: ROADMAP reconcile ticks no row from it, and `tokens coverage` reports it as `unkeyed` (not counted).

## Deviations from Plan

1. **[Extra task, orchestrator-directed] Retroactive 76/77 SUMMARYs** — commit 801103e5, files under `.aoforge/objectives/76-*/` and `77-*/` (outside the JOB's `files_modified`, as the dispatch asked). Side effects, all honest and advisory: `validate consistency` gains 2 warnings (`76-RETROACTIVE-SUMMARY.md` / `77-RETROACTIVE-SUMMARY.md` "has no matching TRD.md", true, since there are none); `roadmap analyze` now reports 76 and 77 as `partial` (1 summary / 0 TRDs, was `empty`), `total_summaries` 112 to 114, `progress_percent` 97 to 99, and `next_objective` 76 to 80. ROADMAP.md itself was not touched.
2. Test 3's init set includes `resume` and `todos` (named in resume-project.md, check-todos.md, add-todo.md); both ran in the fixture with no ARGS entry, so no table change was needed.
3. J3 runs three argument shapes (unknown value, missing value at the end, missing value followed by `--raw`).

No pinned-text suite broke; no recovery path was used.

## Follow-ups

- If the orchestrator's re-verification marks MEF-01 or MEF-06 satisfied in objective 76, add them to `76-RETROACTIVE-SUMMARY.md`'s `requirements-completed` (or a SUMMARY in that directory), or `requirements-agreement.repo` test 11 goes red again.
- `references/escalation-policy.md` (quick 40's file) lists the orchestrators that act on `ESCALATION REQUESTED`; it could add "a stack pack's judge skill" without naming a stack.
- The starting-tier half of SC6 (debugger and judge start cheaper) is still 76-08's.

## Self-Check: PASSED

- FOUND: plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs
- FOUND: .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md
- FOUND: .aoforge/objectives/77-stack-packs-contract-and-extraction/77-RETROACTIVE-SUMMARY.md
- FOUND: all 9 commits (cd389f39, e05d8b84, c872d2a3, d34272eb, d6fb7843, aa24ec68, fd363a43, 801103e5, 1cb50783) in `git log d35f120c..HEAD`
- Full suite: 0 failures
