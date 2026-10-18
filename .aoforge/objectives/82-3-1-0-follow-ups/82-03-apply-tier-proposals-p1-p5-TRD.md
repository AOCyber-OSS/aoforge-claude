---
objective: 82-3-1-0-follow-ups
trd: "03"
type: standard
wave: 1
depends_on: []
files_modified:
  - plugins/aoforge/aoforge/references/model-profiles.json
  - plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs
  - plugins/aoforge/aoforge/references/model-profiles.md
  - plugins/aoforge-stack-flutter/aoforge-stack.json
  - plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs
  - plugins/aoforge-stack-flutter/CHANGELOG.md
autonomous: true
requirements: [SC-3, MEF-06]
must_haves:
  truths:
    - "model-profiles.json carries exactly the approved P2-P5: new focus.codebase-mapper.arch sonnet/sonnet/sonnet (quality/balanced/budget); focus.codebase-mapper.concerns sonnet/sonnet/sonnet; focus.project-researcher.architecture and .pitfalls opus/sonnet/haiku; agents.codebase-mapper stays sonnet/haiku/haiku and tech and quality get no focus entry"
    - "aoforge-stack.json models.ui-evaluator is opus/haiku/haiku (P1); the split-vote escalation goes one rung up from haiku to sonnet (`resolve-model ui-evaluator --escalate-from haiku` → sonnet)"
    - "Tests written before the JSON changes pin every value above and the resolution paths (resolve-model --focus arch, init map-codebase, init new-project, the pack judgeTier) on every profile"
    - "model-profiles.md and the pack CHANGELOG state each change with its 81 evidence and caveat (P1 on the 10-point bound with a 40% split rate; P4/P5 n=2 runs per model reversing 76-06's raise; P2 arch-only), and that 82-08 measures P1, P4 and P5 and reverts any that fail its pre-registered rule"
  artifacts:
    - path: plugins/aoforge/aoforge/references/model-profiles.json
      provides: "P2-P5"
    - path: plugins/aoforge-stack-flutter/aoforge-stack.json
      provides: "P1"
  key_links:
    - from: plugins/aoforge/aoforge/references/model-profiles.json
      to: "init map-codebase mapper_models.arch, init new-project researcher_models"
      via: "init.cjs agentTierMap / MODEL_FOCUS"
      pattern: "focus"
    - from: plugins/aoforge-stack-flutter/aoforge-stack.json
      to: "flutter-ui-eval.cjs judgeTier and resolve-model ui-evaluator"
      via: "manifest models{}"
      pattern: "ui-evaluator"
---

# TRD 82-03: Apply the five approved tier proposals (P1-P5)

<objective>
Objective 81 put five tier proposals to the user, who approved them on 2026-10-17 ("P3, P2-arch-only, P1, P4, P5";
81-HAIKU-EVAL.md, Decision). Apply them exactly as approved, pin them with tests written first, and document each with
its evidence and caveat. P1, P4 and P5 carry a measurement condition: TRD 82-08 measures them and reverts any that
fail the rule pre-registered in 82-CHECK-RULES.md (82-06); this TRD applies them and says so.

Purpose: SC-3 (apply, pin, document; the measurement is 82-08's), MEF-06's UI-judge start tier.
Output: two JSON changes, pin tests, model-profiles.md and the pack CHANGELOG.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-ui-evaluator.md
@.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-codebase-mapper-arch.md
@.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-codebase-mapper-concerns.md
@.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-project-researcher-architecture.md
@.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-project-researcher-pitfalls.md

Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
Never push or tag; never port 8080; never write the real `~/.claude`. Tests:
`SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-03 TMPDIR=$SP/tmp-82-03 node --test <files>`.

The approved changes (from the todos; current → proposed, quality/balanced/budget):
| Id | File, key | Current | Approved |
|---|---|---|---|
| P1 | `plugins/aoforge-stack-flutter/aoforge-stack.json` `models.ui-evaluator` | opus/sonnet/sonnet | opus/haiku/haiku |
| P2 | `model-profiles.json` `focus.codebase-mapper.arch` (new key) | (agent row) sonnet/haiku/haiku | sonnet/sonnet/sonnet |
| P3 | `model-profiles.json` `focus.codebase-mapper.concerns` | sonnet/sonnet/haiku | sonnet/sonnet/sonnet |
| P4 | `model-profiles.json` `focus.project-researcher.architecture` | opus/sonnet/sonnet | opus/sonnet/haiku |
| P5 | `model-profiles.json` `focus.project-researcher.pitfalls` | opus/sonnet/sonnet | opus/sonnet/haiku |
Not approved: the quality half of P2 (codebase-mapper quality stays on the shared row) and any change to the shared
`agents.codebase-mapper` row.

Existing tests to keep green: `model-profiles.test.cjs` "focus entries only raise a tier (a lower one needs a recorded
eval first)" compares a focus tier with the AGENT ROW: P4/P5 lower the focus budget to haiku, which equals the
project-researcher row's budget (haiku), so the test still passes; do not weaken it. The pack test
`flutter-ui-eval.test.cjs` "judge tier and split-vote escalation (quick 42)" reads `manifest.models['ui-evaluator']`
dynamically; `flutter-ui-eval-dogfood.test.cjs` Case J5 exercises `resolve-model ui-evaluator --escalate-from`.
The pack is released with core 3.1.0 as `aoforge-stack-flutter` 1.0.0; check `git tag -l 'aoforge-stack-flutter--*'`:
no tag means the entry goes into the pack CHANGELOG's `## [1.0.0]` section (unreleased), otherwise `## [Unreleased]`.
`site/data/aoforge.json` (docs data, generated from model-profiles.json by `scripts/gen-docs-data.cjs`) is regenerated
by 82-10, not here.

Evidence to quote in docs (81-HAIKU-EVAL.md): P1 accuracy 18/20 vs 20/20 (exactly -10.0, the bound), split rate 8/20
vs 2/20, engine escalations on ok states 4/7 vs 1/7, about 1/16 of Sonnet's cost; P2 arch fabrications 3.00 vs 0.75
per run (recall 41/46 vs 39/46; the refusal rests on 3 misnamed files in one Haiku fleet run); P3 concerns recall
21/38 vs 26/38 (-13.2); P4 recall 21/22 vs 17/22; P5 22/22 vs 21/22; P4/P5 n=2 runs per model, fabrications 0 vs 0.
</context>

<embedded_context>

<codebase_examples>
Existing pattern for resolution tests (model-profiles.test.cjs, describe "TRD 76-06"):
```js
function project(config) { /* temp dir with .aoforge/config.json = config */ }
function resolveIn(dir, ...args) {
  const r = spawnSync(process.execPath, [DF_TOOLS, 'resolve-model', ...args], { cwd: dir, encoding: 'utf8' });
  return JSON.parse(r.stdout);
}
// resolveIn(dir, 'codebase-mapper', '--focus', 'concerns') → { tier, focus, tier_source: 'focus', ... }
```
Pack judge tier (flutter-ui-eval.cjs): `judgeTier(profile, override?)` returns the manifest tier for the profile;
`judgeEscalation({live, judgeTier, reviews, states})` records the split-vote signal; the escalation re-spawn uses
`resolve-model ui-evaluator --escalate-from <tier>` (one rung up; opus is the ceiling).
</codebase_examples>

<anti_patterns>
- Editing `agents.codebase-mapper` (the shared row: tech and quality would move too; not approved).
- Adding a `quality` focus override for codebase-mapper.
- Changing `verdict_floor` or adding ui-evaluator to it.
- Weakening the "only raise" test to make P4/P5 pass (they pass as they are; if it fails, the values are wrong).
- Writing USER-GUIDE or the core CHANGELOG here (82-10 owns them).
</anti_patterns>

<error_recovery>
- `init map-codebase` does not emit `mapper_models.arch` from a focus entry named `arch` (the focus key the workflow
  uses may differ, for example `architecture`): read `init.cjs` `MODEL_FOCUS` and `map-codebase.md`'s spawn for the
  exact focus key, use that key in model-profiles.json, and record the name in the SUMMARY.
- A pack test elsewhere assumed balanced = sonnet for the judge: update it to read the manifest (no literal) and name it.
</error_recovery>

</embedded_context>

## Test list

model-profiles.test.cjs, new describe "objective 82: approved tier proposals (81 P2-P5)" (outermost first)
1. `init map-codebase` in a budget project: `mapper_models.arch` resolves to the sonnet model, `tech` and `quality`
   to haiku, `concerns` to sonnet; in a balanced project arch sonnet, tech/quality haiku, concerns sonnet.
2. `init new-project` (and `init new-milestone` if it emits researcher_models) in budget: `researcher_models.architecture`
   and `.pitfalls` resolve to haiku; balanced sonnet; quality the opus/inherit value.
3. `resolve-model codebase-mapper --focus arch` gives tier sonnet and `tier_source: focus` on quality, balanced and budget.
4. Table pins: focus.codebase-mapper.arch = {quality: sonnet, balanced: sonnet, budget: sonnet}; .concerns = all
   sonnet; focus.project-researcher.architecture and .pitfalls = {quality: opus, balanced: sonnet, budget: haiku}.
5. agents.codebase-mapper = {quality: sonnet, balanced: haiku, budget: haiku}; focus.codebase-mapper has exactly the
   keys arch and concerns (no tech, no quality).
flutter-ui-eval.test.cjs, new case "P1 (objective 82)"
6. `manifest.models['ui-evaluator']` = {quality: opus, balanced: haiku, budget: haiku}; `judgeTier('balanced')` and
   `judgeTier('budget')` are haiku, `judgeTier('quality')` opus.
7. With the pack mirrored into a fixture HOME (the helper Case J5 uses), `resolve-model ui-evaluator` in a budget
   project gives haiku and `resolve-model ui-evaluator --escalate-from haiku` gives sonnet.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: P2-P5 in model-profiles.json (test list 1-5)</name>
  <files>plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs, plugins/aoforge/aoforge/references/model-profiles.json</files>
  <action>
RED: add the describe with tests 1-5 (use the file's existing `project()`/`resolveIn()` helpers; one temp project per
profile). Run the file: 1-4 fail on the current values (record which), 5 passes. Commit
`AOF commit "test(82-03): pin the approved focus tiers P2-P5 (RED)" --files plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs`.
GREEN: edit `focus` in model-profiles.json: add `"arch": { "quality": "sonnet", "balanced": "sonnet", "budget": "sonnet" }`
under codebase-mapper (focus key as error_recovery says), set concerns budget to sonnet, set project-researcher
architecture and pitfalls budget to haiku. Keep the file's column alignment. Run model-profiles.test.cjs, init tests,
model-placeholders.repo.test.cjs, and `AOF resolve-model codebase-mapper --focus arch --raw` in a scratch budget project.
Commit `AOF commit "feat(82-03): apply approved focus tiers P2-P5 (objective 81)" --files plugins/aoforge/aoforge/references/model-profiles.json plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs`.
  </action>
  <verify>`env HOME=$SP/home-82-03 TMPDIR=$SP/tmp-82-03 node --test plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs plugins/aoforge/aoforge/bin/lib/init.test.cjs plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs` pass; `git diff HEAD~1 -- plugins/aoforge/aoforge/references/model-profiles.json` touches only the `focus` block</verify>
  <done>P2-P5 are in the table and pinned on every profile through init and resolve-model.</done>
  <recovery>If test 2's init does not emit researcher_models for new-milestone, pin new-project only and say so.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: P1 in the Flutter pack manifest (test list 6-7)</name>
  <files>plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs, plugins/aoforge-stack-flutter/aoforge-stack.json</files>
  <action>
RED: add tests 6-7 to flutter-ui-eval.test.cjs (reuse the pack-mirror fixture helper from flutter-ui-eval-dogfood.test.cjs
Case J5 or core's stack-packs test helper; never the real HOME). Commit
`AOF commit "test(82-03): pin the UI judge start tier P1 (RED)" --files plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs`.
GREEN: `models.ui-evaluator` → `{"quality": "opus", "balanced": "haiku", "budget": "haiku"}`. Run every pack test
(`node --test plugins/aoforge-stack-flutter/lib/*.test.cjs`) and core `stack-packs.test.cjs`; fix any test that
hard-coded balanced = sonnet per error_recovery. Commit
`AOF commit "feat(82-03): start the UI judge at haiku on balanced and budget (objective 81 P1)" --files plugins/aoforge-stack-flutter/aoforge-stack.json plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs`.
  </action>
  <verify>All pack tests and core stack-packs.test.cjs pass under the scratch HOME; tests 6-7 green</verify>
  <done>The judge starts at haiku on balanced and budget and escalates one rung to sonnet on split votes.</done>
  <recovery>If the pack version lockstep test (stack-packs.test.cjs) fails, a manifest change needs no version bump; read the failure, fix only what it names.</recovery>
</task>

<task type="auto">
  <name>Task 3: Document P1-P5 with evidence and caveats</name>
  <files>plugins/aoforge/aoforge/references/model-profiles.md, plugins/aoforge-stack-flutter/CHANGELOG.md</files>
  <action>
model-profiles.md, section "Per-focus tiers and the verdict floor": update the focus table (rows codebase-mapper
`arch` sonnet/sonnet/sonnet, `concerns` sonnet/sonnet/sonnet, project-researcher `architecture` and `pitfalls`
opus/sonnet/haiku); rewrite the paragraph that says lowering a focus "waits on a recorded eval": P4/P5 are lowered on
objective 81's recorded eval (weak endorsement, n=2 runs per model, reversing 76-06's raise) and stay only if 82-08's
follow-up measurement passes 82-CHECK-RULES.md; P2 raises arch alone (tech and quality stay on the shared row; the
refusal rests on 3 misnamed files in one Haiku run); P3 rests on recall (-13.2 points). Add a short "UI judge start
tier (Flutter pack)" paragraph: the pack manifest's `models.ui-evaluator` starts at haiku on balanced and budget,
escalates one rung (sonnet) on split votes through `/aoforge:ui-eval`, evidence 18/20 vs 20/20 on the 10-point bound
with a 40% split rate, measured by 82-08 and reverted if escalation does not keep verdicts right at a cost below a
Sonnet start. Keep the Profile Definitions table test (TRD 41-07) green. Pack CHANGELOG: one `### Changed` bullet for
P1 in the section chosen by the tag check, with the same caveat in one sentence. Run model-profiles.test.cjs and
`doc-refs.repo.test.cjs`. Commit
`AOF commit "docs(82-03): model profiles and pack changelog state P1-P5 with their evidence" --files plugins/aoforge/aoforge/references/model-profiles.md plugins/aoforge-stack-flutter/CHANGELOG.md`.
  </action>
  <verify>`rg -n -e 'arch' -e 'P1' -e '82-08' plugins/aoforge/aoforge/references/model-profiles.md` shows the new rows and the measurement note; model-profiles and doc-refs tests pass</verify>
  <done>A reader of model-profiles.md and the pack CHANGELOG sees each new tier, its evidence and its condition.</done>
  <recovery>If model-profiles.md must stay within a size cap (context-budget), shorten older prose in the same section rather than dropping evidence.</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (scoped per task as above; the full suite runs in 82-10)</test>
</validation_gates>

<verification>
- JSON diffs touch only the approved keys; tests 1-7 green; docs state evidence and the 82-08 condition.
</verification>

<success_criteria>
- P1-P5 are live exactly as approved, pinned by tests, and documented with their caveats.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-03-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, listing each proposal with its commit and pin test.
</output>
