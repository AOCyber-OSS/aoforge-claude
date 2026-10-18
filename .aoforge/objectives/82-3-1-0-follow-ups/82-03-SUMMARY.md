---
objective: 82-3-1-0-follow-ups
job: "03"
subsystem: model-tiers
tags: [model-profiles, focus-tiers, ui-evaluator, flutter-pack, tier-proposals]
requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement
    provides: the five approved tier proposals (81-HAIKU-EVAL.md, Decision, 2026-10-17)
provides:
  - "P2-P5 live in model-profiles.json focus{} and pinned on every profile through init and resolve-model"
  - "P1 live in the Flutter pack manifest and pinned through judgeTier and a mirrored-pack resolve-model"
  - "model-profiles.md and the pack CHANGELOG state each change with its 81 evidence, caveat and the 82-08 condition"
affects: [82-08, 82-10]
tech-stack:
  added: []
  patterns: ["literal pin tests beside dynamic manifest-reading tests"]
key-files:
  created: []
  modified:
    - plugins/aoforge/aoforge/references/model-profiles.json
    - plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs
    - plugins/aoforge/aoforge/references/model-profiles.md
    - plugins/aoforge-stack-flutter/aoforge-stack.json
    - plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs
    - plugins/aoforge-stack-flutter/CHANGELOG.md
key-decisions:
  - "The mapper focus key is `arch` (init.cjs mapper_models and the workflow spawn use it); no rename needed."
  - "The pack CHANGELOG entry goes under `## [1.0.0]` (unreleased): `git tag -l 'aoforge-stack-flutter--*'` is empty."
  - "model-profiles.md describes the UI judge pack-neutrally: stack-neutrality.repo.test.cjs refuses the word Flutter in core references, so the Flutter detail lives in the pack CHANGELOG."
requirements-completed: [SC-3, MEF-06]
verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true
duration: 4min
completed: 2026-10-17
tokens_input: 5282313
tokens_output: 33224
tokens_cache_read: 5174273
tokens_cache_write: 107942
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 82: TRD 03 Summary

**The five approved tier proposals (P1-P5) are live and pinned: the architecture mapper and concerns mapper run on sonnet on every profile, the researcher architecture and pitfalls foci drop to haiku on budget, and the UI judge starts at haiku on balanced and budget, escalating to sonnet on a split vote.**

## Performance

- **Duration:** about 4 min between the first and last task commit
- **Tasks:** 3 of 3
- **Files modified:** 6 (plus this SUMMARY)

## Progress
- [x] Task 1: P2-P5 in model-profiles.json (test list 1-5) — 10311e5c
- [x] Task 2: P1 in the Flutter pack manifest (test list 6-7) — f95f7b7a
- [x] Task 3: Document P1-P5 with evidence and caveats — a1d60a9b

## Accomplishments

Tier edits made, each as before to after (quality / balanced / budget):

| Id | File, key | Before | After | Commit | Pin test |
|---|---|---|---|---|---|
| P1 | `plugins/aoforge-stack-flutter/aoforge-stack.json` `models.ui-evaluator` | opus / sonnet / sonnet | opus / haiku / haiku | f95f7b7a | flutter-ui-eval.test.cjs `P1-1`, `P1-2` |
| P2 | `plugins/aoforge/aoforge/references/model-profiles.json` `focus.codebase-mapper.arch` (new key) | no entry (agent row sonnet / haiku / haiku) | sonnet / sonnet / sonnet | 10311e5c | model-profiles.test.cjs `init map-codebase`, `resolve-model --focus arch`, table pins |
| P3 | same file, `focus.codebase-mapper.concerns` | sonnet / sonnet / haiku | sonnet / sonnet / sonnet | 10311e5c | same describe, table pins |
| P4 | same file, `focus.project-researcher.architecture` | opus / sonnet / sonnet | opus / sonnet / haiku | 10311e5c | `init new-project and new-milestone`, table pins |
| P5 | same file, `focus.project-researcher.pitfalls` | opus / sonnet / sonnet | opus / sonnet / haiku | 10311e5c | same |

Not touched, and pinned as untouched: `agents.codebase-mapper` stays sonnet / haiku / haiku, and `focus.codebase-mapper` has exactly the keys `arch` and `concerns` (no `tech`, no `quality`). `verdict_floor` is unchanged.

RED commits: 9d8333f8 (P2-P5 tests) and d25e474f (P1 tests). On the old values all five new model-profiles tests failed (including the key-set pin, which the TRD expected to pass: `arch` was missing) and both P1 tests failed (P1-2: `sonnet !== haiku`).

Documentation: model-profiles.md carries the four focus rows, each proposal with its 81 evidence and caveat (P2 arch only on 3 misnamed files in one Haiku fleet run; P3 recall -13.2; P4 and P5 n=2 runs per model, reversing 76-06's raise), a "UI judge start tier" section (18/20 against 20/20 on the 10-point bound, split rate 8/20 against 2/20, engine escalations 4/7 against 1/7, about 1/16 of Sonnet's cost per judge session), and the condition that 82-08 measures P1, P4 and P5 and reverts any that fail `82-CHECK-RULES.md`. The pack CHANGELOG has a `### Changed` bullet under `## [1.0.0]`.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: P2-P5 | `node --test model-profiles.test.cjs init.test.cjs model-placeholders.repo.test.cjs` (88 tests); `resolve-model codebase-mapper --focus arch --raw` in a budget project printed `sonnet`; the JSON diff touches only the `focus` block | 0 | PASS |
| 2: P1 | `node --test plugins/aoforge-stack-flutter/lib/*.test.cjs` (284 tests); `stack-packs.test.cjs` (46); `stack-neutrality.repo.test.cjs`, `scripts/eval81` D/report/decide/static-prompt tests (155 with model-profiles) | 0 | PASS |
| 3: docs | `node --test model-profiles.test.cjs doc-refs.repo.test.cjs`, then all `*.repo.test.cjs` plus `changelog.test.cjs` (353 tests); `rg -n -e arch -e P1 -e 82-08 model-profiles.md` shows the new rows and the measurement note | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (scoped per task, TRD says the full suite runs in 82-10) | the per-task node --test runs above, under HOME and TMPDIR in the session scratchpad | 0 | PASS |
| objective 81 frozen modules | `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-.../results/prereg-manifest.json` from the worktree | 1 | not_available (see Deviations); 0 changed, 0 added, 1 missing; exit 0 from the main checkout |

## Deviations from Plan

**1. [Rule 3 - Blocking] Pack-neutral wording in model-profiles.md**
- **Found during:** Task 3, running `*.repo.test.cjs`.
- **Issue:** the TRD asked for a "UI judge start tier (Flutter pack)" section in core's model-profiles.md. `stack-neutrality.repo.test.cjs` fails CI on the word Flutter (and the pack skill name) in any core reference outside its ALLOW list.
- **Fix:** the section is titled "UI judge start tier (stack pack)" and names `ui-evaluator`, the pack manifest `models{}` and the `ui-eval` skill without saying Flutter. The Flutter-named statement is in the pack CHANGELOG. No ALLOW entry was added.
- **Files modified:** plugins/aoforge/aoforge/references/model-profiles.md
- **Commit:** a1d60a9b

**2. [Note] The TRD expected test 5 to pass at RED**
- It failed on the `arch` key-set pin (the shared-row half passed). Not a plan defect, recorded for the RED evidence.

**3. [Environment] prereg check from the worktree**
- `prereg.cjs --check` from the worktree reports `0 changed, 0 added, 1 missing` against 86 manifest entries; the missing file is `.aoforge/objectives/81-.../private/fleet-checklists.json`, which is gitignored (`private/.gitignore`) and therefore absent from a worktree. From the main checkout the same command exits 0 ("86 files match"). This TRD edited no `scripts/eval81/**` file (`git diff 76e77790 HEAD --name-only` lists none). I did not copy the private file into the worktree.

Otherwise none: the focus key `arch` matched `init.cjs` and no pack test hard-coded balanced = sonnet (E1 reads the manifest).

## Discovered commands

None.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 4/4 (table values; P1 and its escalation; tests written first; docs with evidence and the 82-08 condition)
- Gate failures: none apart from the environment item above

## Self-Check: PASSED

- Files: plugins/aoforge/aoforge/references/model-profiles.json, model-profiles.md, bin/lib/model-profiles.test.cjs, plugins/aoforge-stack-flutter/aoforge-stack.json, lib/flutter-ui-eval.test.cjs, CHANGELOG.md all exist and carry the changes above.
- Commits: 9d8333f8, 10311e5c, d25e474f, f95f7b7a, a1d60a9b all present on df/exec-82-03-apply-tier-proposals-p1-p5.
