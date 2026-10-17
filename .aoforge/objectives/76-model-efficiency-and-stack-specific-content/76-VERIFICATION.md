---
objective: 76-model-efficiency-and-stack-specific-content
verified: 2026-10-17T00:00:00Z
status: gaps_found
score: 5/7 must-haves verified (2 partial; deferred items 76-06 eval and 76-08 measurement excluded, not failures)
retroactive: true
retroactive_note: "Objective 76 landed on main through plain PRs #132/#133/#134 on 2026-10-16, outside the AOForge flow (no TRDs, SUMMARYs or VERIFICATION carried here). Verified goal-backward against branch integrate/3.1.0 at HEAD a589d306, with quick 34-39 fixes in the tree."
deferred:
  - item: "76-06 Haiku 5.5 eval"
    criterion: "SC5 (haiku tier re-pinned after a recorded eval)"
    state: open
    note: "Pin is already claude-haiku-5-5; no tier is lowered until the eval is recorded. Not a code gap."
  - item: "76-08 before/after measurement"
    criterion: "SC6 starting-tier half (debugger / UI judge start on a cheaper tier)"
    state: open
    note: "ROADMAP: starting tiers unchanged pending 76-08; needs real runs after release, not doable in CI. Not a code gap."
gaps:
  - truth: "SC1: no agent spawn in a workflow or skill names a model placeholder its init does not emit"
    status: partial
    reason: "execute-objective.md has two spawns whose model placeholder is neither emitted by `init execute-objective` (which emits only executor_model and verifier_model) nor resolved anywhere in the workflow or skill. The same defect class TRD 76-01 fixed in build.md."
    artifacts:
      - path: "plugins/aoforge/aoforge/workflows/execute-objective.md"
        issue: "line ~1323 auto_gap_closure spawns subagent_type=planner with model=\"{planner_model}\"; init execute-objective emits no planner_model and the file has no `resolve-model planner`"
      - path: "plugins/aoforge/aoforge/workflows/execute-objective.md"
        issue: "line ~910 autonomous human-verify checkpoint spawns the verifier with model=\"{resolved_verifier_model}\", a name defined nowhere (step 3 only defines executor overrides; init emits verifier_model)"
    missing:
      - "Resolve the gap-closure planner model (`resolve-model planner --objective N --raw`, or emit planner_model from init execute-objective) and use that name"
      - "Rename {resolved_verifier_model} to {verifier_model} (or define it)"
      - "Optional: a repo test that cross-checks every model=\"{x}\" placeholder against the init/resolve-model output its file uses (the ad-hoc scan in this report found exactly these two)"
  - truth: "SC6: the UI judge escalates one rung on a recorded signal"
    status: partial
    reason: "Escalation is wired for the executor (execute-objective 5e) and debugger (/aoforge:debug, diagnose-issues) via `resolve-model --escalate-from`. The UI judge (ui-evaluator, now in aoforge-stack-flutter) has no escalation return and its ui-eval/design-review skills never re-spawn one rung up; `flutter-ui-eval.cjs` 'escalation' is a verdict rule (flake budget -> fail), not a tier change. The 'start cheaper' half is deferred with 76-08; the escalate half for the judge is not implemented."
    artifacts:
      - path: "plugins/aoforge-stack-flutter/agents/ui-evaluator.md"
        issue: "no ESCALATION REQUESTED return"
      - path: "plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md"
        issue: "spawns with resolve-model ui-evaluator but never --escalate-from"
    missing:
      - "Either add an escalation return + one-rung re-spawn to the ui-eval/design-review skills, or record that the judge's escalation is folded into 76-08 and reword SC6/MEF-06"
---

# Objective 76: Model efficiency and stack-specific content Verification Report

**Objective Goal:** Each agent spends top-model tokens only on judgment. The configured tier is the tier that runs, mechanical work runs as aof-tools code, each spawn loads only the instructions it needs, and stack-specific procedure lives in the stack profiles rather than in agent prompts.
**Verified:** 2026-10-17
**Status:** gaps_found (two small wiring gaps; deferred items are not counted)
**Re-verification:** No — retroactive initial verification (objective landed outside the AOForge flow)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | resolve-model and every init model field honour the objective's model_profile; no spawn omits model= or names an unemitted placeholder; UI judge reads the project profile | PARTIAL | `resolveAgentModel` (init.cjs:444) is the single resolver for resolve-model and init (quick 35); `resolveProfile` binds intent `model_profile` (objective/TRD override, `auto` -> defaults table). Scratch project `model_profile: budget` -> verifier/job-checker sonnet (verdict_floor). UI judge `flutter-ui-eval.cjs:510-517` reads config `model_profile`. build.md now resolves executor/verifier. Scan of 26 typed spawns: only the 3 `general-purpose` hand-offs (build.md:246, discuss-objective.md:468, plan-objective.md:831) lack model=, which the objective scopes out. **Gap:** execute-objective.md `{planner_model}` (gap closure) and `{resolved_verifier_model}` (checkpoint verifier) are not emitted/resolved. |
| 2 | No spawn carries `@` refs across the Task boundary; mapper/researcher load only their own templates | VERIFIED | Scan of every Task/Agent spawn in skills/ and workflows/: zero `@...md` references inside prompts. codebase-mapper.md:161 per-focus template table; new-project.md:623-782 one `research-project/<DIM>.md` template per researcher spawn. |
| 3 | `verify trd-pre` runs before the job-checker; mechanical failures go straight to revision; checker covers judgment only | VERIFIED | plan-objective.md:620-640 runs trd-pre before every checker spawn and skips the spawn on mechanical blockers; verify-work.md:536 likewise. job-checker.md Step 4 reads the pre-check, Step 5 "Check the judgment dimensions". `verify trd-pre 79` ran: passed, 5 checks. |
| 4 | Post-TRD bookkeeping, verifier evidence, codebase facts, roadmap coverage, security sweep are aof-tools commands agents call once | VERIFIED | `trd finalize` (executor.md:864), `verify objective-evidence` (verifier.md:130), `validate roadmap-coverage` (roadmapper.md:471), `codebase facts --focus` (codebase-mapper.md:85), `security sweep --focus` (security-auditor.md:43). All five ran on this repo: evidence 8/10 final SUMMARYs for 79; coverage 41/41; facts and sweep output with `[REDACTED]` values. |
| 5 | Tiers per focus/dimension; haiku re-pinned after recorded eval; verdicts at Sonnet+ on every profile | VERIFIED (eval DEFERRED) | model-profiles.json `focus{}` (mapper concerns; researcher architecture/pitfalls) and `verdict_floor {tier: sonnet, agents: [verifier, job-checker]}`. `resolve-model codebase-mapper --focus concerns` -> tier_source focus. Haiku pin `claude-haiku-5-5`; the eval itself is 76-06, OPEN by design. |
| 6 | Debugger and UI judge start cheaper and escalate on a recorded signal; ESCALATION REQUESTED re-spawns one rung up | PARTIAL (start-tier DEFERRED) | `resolve-model debugger --escalate-from sonnet` -> opus, `ceiling:false`; from opus -> `ceiling:true`. execute-objective 5e, skills/debug/SKILL.md:207, diagnose-issues.md:157 act on `## ESCALATION REQUESTED`; debugger.md:569 has the return. **Gap:** no escalation path for the UI judge. Starting tiers unchanged pending 76-08 (deferred). |
| 7 | Flutter/Go/Dart/web procedure is delivered via profiles/packs; non-Flutter executor/verifier/planner prompts carry none | VERIFIED | Delivered by objective 77 (76-05 superseded). Core executor/verifier/planner contain no Flutter/Dart/Maestro/Playwright procedure; only the decided `mcp__gopls__*`/`mcp__dart__*` grants, the executor's five read-only browser grants (quick 38, guarded by GRANT_ALLOW), and generic `go test` examples in the worktree command-discipline section. `stack context verifier` in a no-pack project emits no Stack packs block. stack-neutrality.repo.test.cjs passes. |

**Score:** 5/7 truths verified (SC1 and SC6 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `plugins/aoforge/aoforge/bin/lib/init.cjs` | resolveAgentModel / resolveProfile / escalation | VERIFIED | single resolver, tier_source provenance |
| `plugins/aoforge/aoforge/references/model-profiles.json` | focus{}, verdict_floor, model pins | VERIFIED | |
| `plugins/aoforge/aoforge/bin/lib/trd-pre-check.cjs` | mechanical checker dimensions | VERIFIED | wired from plan-objective and verify-work |
| `.../lib/trd-finalize.cjs`, `objective-evidence.cjs`, `roadmap-coverage.cjs`, `codebase-facts.cjs`, `security-sweep.cjs` | mechanical verbs | VERIFIED | all run; agents call them |
| `plugins/aoforge/aoforge/workflows/execute-objective.md` | every spawn has a resolvable model | PARTIAL | two unresolved placeholders (see gaps) |
| `plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs` | judge reads project profile | VERIFIED | escalation not present (SC6 gap) |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| resolve-model CLI | init model fields | resolveAgentModel | WIRED |
| intent model_profile | resolve-model | resolveProfile(objective) | WIRED |
| plan-objective.md | job-checker | trd-pre JSON in prompt | WIRED |
| executor / verifier / roadmapper / mapper / auditor | mechanical verbs | Bash calls in agent bodies | WIRED |
| debugger `## ESCALATION REQUESTED` | re-spawn one rung up | resolve-model --escalate-from | WIRED |
| ui-evaluator | escalation | — | NOT_WIRED |
| execute-objective gap-closure planner | planner model | `{planner_model}` | NOT_WIRED |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| MEF-01 | configured tier runs; every spawn passes an emitted model; judge reads profile | PARTIAL | SC1 gap |
| MEF-02 | no unusable instructions/templates per spawn | SATISFIED | SC2 |
| MEF-03 | trd-pre before checker | SATISFIED | SC3 |
| MEF-04 | mechanical verbs | SATISFIED | SC4 |
| MEF-05 | per-focus tiers, verdict floor, haiku re-pin after eval | SATISFIED except deferred eval (76-06) | SC5 |
| MEF-06 | debugger and UI judge start cheap and escalate | PARTIAL | debugger done; judge not wired; start tiers deferred (76-08) |

REQUIREMENTS.md still lists MEF-01..06 as Pending; updating traceability is the orchestrator's call.

### Defects found by the 2026-10-16 end-to-end test and closed by quick tasks

| Quick | Defect (76 surface) | Closed? | Evidence on this tree |
|-------|---------------------|---------|-----------------------|
| 34 | `security sweep` copied secret bodies into transcripts; regex rows backtracked catastrophically; missing `--root` reported clean | CLOSED | sweep output shows `[REDACTED]`; security-sweep.test.cjs passes |
| 35 | `agent_models` / `model_overrides` ignored by resolve-model and init | CLOSED | resolveAgentModel with tier_source; model-profiles/config/init tests pass |
| 35 | no-progress guard matcher missed MCP and several tools | CLOSED | hooks.json `^(?!Bash$).*`; pre-bash and hook-coexistence tests pass |
| 35 | `state advance-job` archive rows not committed in worktrees | CLOSED | state-archive-commit.repo.test.cjs passes |
| 36 | `validate roadmap-coverage` own regex: false orphans/false mapped | CLOSED | shared parser; ran 41/41 on this repo |
| 36 | `verify objective-evidence` counted checkpoint SUMMARYs as done | CLOSED | evidence reports "final SUMMARY"; mechanical-verbs tests pass |
| 36 | `trd finalize` re-run duplicated archive rows | CLOSED | record-metric upsert, add-decision dedupe; tests pass |
| 36 | planning verbs wrote the main checkout from a worktree | CLOSED | resolveVerbRoot; planning-verbs-worktree.test.cjs passes |
| 37 | Sonnet 5.5 cache-read rate $0.20 (should be $0.10) | CLOSED | model-rates.json claude-sonnet-5-5 cache_read 0.1, as_of 2026-10-16 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| execute-objective.md | ~1323, ~910 | model placeholder with no source | Warning | spawn may run on an empty or guessed model |
| execute-objective.md | ~380-385 | complexity rule hard-codes sonnet/opus for executor | Info | pre-existing; bypasses profile for simple/complex TRDs (documented behaviour, not new) |
| security-sweep.cjs | 37 | SKIP_DIRS does not skip gitignored `.claude/` worktrees | Info | 103 duplicate hits from `.claude/worktrees/agent-*` on this repo; noise, values redacted |

### Functional Verification

_Skipped (UI): not a UI objective; runtime is the aof-tools CLI._ CLI exercised in a scratch project under the session scratchpad with a scratch HOME (resolve-model across profiles, focus and escalation; trd-pre; objective-evidence; roadmap-coverage; codebase facts; security sweep). Targeted test run: 851/851 pass (model-profiles, mechanical-verbs, stack-packs, stack-neutrality, trd-pre-check, security-sweep, codebase-facts, changelog, state-archive-commit, planning-verbs-worktree, init, config, changelog-on-tag, pre-bash, hook-coexistence, flutter pack lib, release-tag, tag-rules).

### Human Verification Required

None beyond the deferred measurement items (76-06 Haiku eval, 76-08 before/after `context` / `tokens trd` comparison on real runs).

### Gaps Summary

The objective's mechanisms are real and wired: one resolver binds the intent profile and overrides, the verdict floor and focus tiers apply, trd-pre runs before the checker, the five mechanical verbs exist and agents call them, spawns carry no dead `@` lists, and stack procedure left the core prompts. Two small gaps remain. (1) execute-objective.md still has two spawns whose model placeholders nothing produces: the gap-closure planner (`{planner_model}`) and the autonomous checkpoint verifier (`{resolved_verifier_model}`), the same defect class 76-01 fixed in build.md. (2) The UI judge has no escalation path, so MEF-06 holds only for the executor and debugger. The Haiku eval (76-06) and the measurement that would lower starting tiers (76-08) are OPEN by design and are recorded as deferred, not as failures.

---

_Verified: 2026-10-17 (retroactive)_
_Verifier: Claude (verifier)_
