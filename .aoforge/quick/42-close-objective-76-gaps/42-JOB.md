---
objective: quick-42
trd: 01
type: standard
wave: 1
depends_on: []
gap_closure: true
files_modified:
  - plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs
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
autonomous: true
must_haves:
  truths:
    - "Every identifier model placeholder in a `model=\"{x}\"` or `model: \"{x}\"` position, in core workflows, core skills and every stack pack's skills, workflows and fragments, has a source: a key the file's own `init <cmd>` prints (run in a fixture project), a `NAME=$(… resolve-model …)` assignment in the file, or a `<!-- model-source: NAME from SRC -->` annotation whose SRC is itself supplied. `model-placeholders.repo.test.cjs` fails CI otherwise, and was RED at BASE with exactly 8 findings"
    - "execute-objective.md: the gap-closure planner spawns with a model from `resolve-model planner --objective`, the autonomous checkpoint verifier uses init's `verifier_model`, and `{resolved_executor_model}` is declared as step 3's per-plan choice. No `{resolved_verifier_model}` remains"
    - "`verify flutter-ui-eval <m> --judge live --judge-tier <haiku|sonnet|opus>` judges with that rung's pinned model id and reports `judge_tier`. An unknown or missing value, or the flag without `--judge live`, is a usage error (exit 1). A run without the flag keeps every existing field and exit code; scored rollups only gain `tier_escalation` (plus `judge_tier` on live runs)"
    - "A live run whose unexpected reviews include a split-vote state (`flake: true`) reports `tier_escalation: {requested: true, trigger: 'split-votes', from_tier, states}`. Credential or network reviews, advisory (labels) runs and expect:fail states never request it"
    - "ui-evaluator returns `## ESCALATION REQUESTED` on that signal (never on a design-review run or an already-escalated run). /aoforge:ui-eval re-spawns it once, one rung up, from `resolve-model ui-evaluator --escalate-from <judge tier>`, with `--judge-tier` set; at the ceiling it reports the first rollup and the split states stay on human verification"
    - "`benchmark per-objective` counts executor spawns: `aoforge:executor`, and in history the pre-rename namespace's and the install-prefixed executor, all built from legacy-names.cjs. A fixture with one executor and one verifier spawn gives `executor_calls: 1`"
    - "`npm test` with a scratch HOME shows no new failures against BASE; stack-neutrality.repo passes; nothing is pushed, tagged or released; the diff adds no port 8080"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs
      provides: "the guard: placeholder scan over core and pack prompts, behavioural init-key lookup, unit cases for the 76 defect class"
    - path: plugins/aoforge/aoforge/workflows/execute-objective.md
      provides: "resolved gap-closure planner model, init verifier_model at the checkpoint, declared resolved_executor_model"
    - path: plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs
      provides: "judgeTier, judgeModel tier override, --judge-tier, judgeEscalation, rollup judge_tier + tier_escalation"
    - path: plugins/aoforge-stack-flutter/agents/ui-evaluator.md
      provides: "## ESCALATION REQUESTED return on split votes; --judge-tier passthrough on an escalated re-spawn"
    - path: plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md
      provides: "UI_EVALUATOR_MODEL resolution and the one-rung re-spawn handler"
    - path: plugins/aoforge/aoforge/bin/lib/benchmark.cjs
      provides: "isExecutorType: executor_calls counts AOForge executor spawns"
  key_links:
    - from: "execute-objective.md auto_gap_closure planner Task"
      to: "resolve-model planner --objective"
      via: "PLANNER_MODEL=$(…) assignment, model=\"{PLANNER_MODEL}\""
    - from: "flutter-ui-eval.cjs rollup tier_escalation"
      to: "ui-evaluator `## ESCALATION REQUESTED`"
      via: "the agent reads tier_escalation.requested off the --raw rollup"
    - from: "skills/ui-eval/SKILL.md escalation handler"
      to: "resolve-model ui-evaluator --escalate-from (pack manifest models via packAgentTiers)"
      via: "result.model → Task model, result.tier → --judge-tier"
    - from: "benchmark.cjs buildPerObjective"
      to: "legacy-names.cjs NAMES.agentNs / LEGACY.agentNs / LEGACY.installPrefix"
      via: "EXECUTOR_TYPE_RE, the agent-overhead.cjs history rule (TRD 72-10)"
---

## Objective

Close objective 76's two verification gaps and one defect found beside them
(`.aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md`, retroactive,
`gaps_found` 5/7):

1. **SC1 / MEF-01: model placeholders with no source.** `execute-objective.md` spawns the gap-closure planner with
   `model="{planner_model}"`, which `init execute-objective` does not print and the workflow never resolves. It
   spawns the autonomous checkpoint verifier with `model="{resolved_verifier_model}"`, a name defined nowhere.
   TRD 76-01 fixed the same class in build.md. Fix both, then add a guard so the class cannot recur. Run at BASE,
   the guard finds 8 placeholders with no source, not 2. The other six are a third execute-objective name
   (`resolved_executor_model`, used 3 times and never declared), build.md's 76-01 fix (resolved by plain commands
   with no named output), new-milestone's `{MODEL}` template field and research-objective.md's `{researcher_model}`.
2. **SC6 / MEF-06: the UI judge cannot escalate.** The debugger and executor return `## ESCALATION REQUESTED` and
   their orchestrators re-spawn them one rung up. `ui-evaluator`, which moved to the `aoforge-stack-flutter` pack,
   has no such path. The judge's verdict is the vision model the engine calls (`judgeModel()`), not the agent's
   own tier, so a real escalation has to change the engine's rung too. Add a `--judge-tier` override, a recorded
   signal in the rollup, the agent's return and the skill's re-spawn. All of it stays in the pack, so core stays
   stack-neutral.
3. **benchmark.cjs:353** compares `r.agentType === 'df-executor'`, which never matches an AOForge transcript, so
   `executor_calls` is always 0. Quick 40 deferred this to here.

Then gather the re-verification evidence. The orchestrator re-runs a verifier after this JOB.

Quick mode: one JOB with three tasks, test first. `<repo>` is the checkout the orchestrator gave you
(`/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`, unless it names a worktree). Planning mode is
`local`. `<scratchpad>` is `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.

Resolved intent (objective 76): kind `plugin`, work `refactor` (OBJECTIVE.md). tdd `strict` (characterization
first), test_list_first `required`, fixture_strategy `inline`, back_compat `behavioral`. Constraints: hand-built
fixtures only (no generated test data), no property-based testing, no Gherkin.

## Locked decisions

1. **Three placeholder sources, and only three.** (a) A top-level key of the JSON that the file's own
   `aof-tools.cjs init <cmd>` prints. The guard runs the command in a fixture project and never parses init.cjs:
   quick 40 is reworking init.cjs, and a static parse would break on a refactor. (b) A line
   `NAME=$(node … resolve-model …)` in the same file. (c) `<!-- model-source: NAME from SRC -->` in the same file,
   where SRC's root (the text before the first `.`) is supplied by (a) or (b). Names compare case-insensitively,
   so `DEBUGGER_MODEL=$(…)` supplies `{debugger_model}`. Only identifier placeholders are scanned
   (`{x}`, `{x.y}`, `{x.<focus>}`). Prose placeholders with spaces (`{model from the result}`,
   `{the escalated model}`) are out of scope by design: they name an escalation result in the same paragraph.
2. **No init.cjs change.** It belongs to quick 40. execute-objective resolves the planner in the workflow
   (`resolve-model planner --objective "${OBJECTIVE_NUMBER}" --raw`), as build.md did in 76-01.
3. **Scan set:** `plugins/aoforge/aoforge/workflows/**/*.md`, `plugins/aoforge/skills/**/*.md`, and for every
   `plugins/aoforge-stack-*/` its `skills/`, `workflows/` and `fragments/` `.md` files. `__fixtures__/` is
   skipped. The guard lives in its own file, `model-placeholders.repo.test.cjs`, because quick 40 owns
   model-profiles.test.cjs.
4. **The judge escalates its vision rung, and the orchestrator decides.** The engine records the signal
   (`tier_escalation`) and the agent returns the block. The skill then gets the next rung from
   `resolve-model ui-evaluator --escalate-from <judge tier>`, the single rung source, and re-spawns once with
   Task `model` = result `model` and engine `--judge-tier` = result `tier`. Budget: one escalation per
   /aoforge:ui-eval run (escalation-policy "bounded burst"). The engine never escalates itself.
5. **The only trigger is split votes on a live run.** A state in `reviews[]` (expect:pass) whose detail has
   `flake: true` (the N live samples disagreed). Reviews from credential, network or refusal errors carry no
   `flake` and never escalate: that is environment friction, not a tier problem (escalation-policy: not on tool
   errors). Advisory (labels) runs never escalate, because no model judged anything. Design-review is a single
   advisory critique with no recorded signal, so it never escalates; say so in ui-evaluator.md.
6. **`--judge-tier` is strict.** Allowed values are `haiku`, `sonnet` and `opus`. The flag is valid only with
   `--judge live`. Anything else is a usage error through the module's `error()` (exit 1), the same posture as
   the `--judge` check (aodex#485 "never silently").
7. **benchmark is a history reader.** It reads past transcripts (`--since`), so it follows agent-overhead.cjs
   (TRD 72-10): it counts `NAMES.agentNs`, `LEGACY.agentNs` and `LEGACY.installPrefix` + `executor`, with the
   regex built from legacy-names.cjs and no legacy literal in source.
8. **Quick 40 overlap is CHANGELOG.md only.** Every other file here is disjoint from quick 40's
   `files_modified`. Never stage or edit quick 40's files.

## Test list

Outer to inner. Task 1 (`model-placeholders.repo.test.cjs`, guarded by `IS_AOFORGE_CHECKOUT`):

1. Real tree: every identifier placeholder in the scan set has a source. **RED at BASE with exactly 8
   findings**: `plugins/aoforge/aoforge/workflows/build.md:279 {verifier_model}`,
   `execute-objective.md:418, :500 and :1017 {resolved_executor_model}`, `execute-objective.md:910
   {resolved_verifier_model}`, `execute-objective.md:1323 {planner_model}`, `new-milestone.md:175 {MODEL}` and
   `research-objective.md:88 {researcher_model}`. The failure message lists `file:line {name}`.
2. Real tree: no stale `model-source` annotation, meaning every annotation's NAME is used as a placeholder in
   its file. Green at BASE, because there are none yet.
3. Behavioural init lookup: each `init <cmd>` named anywhere in the scan set runs in the fixture project with a
   fixture HOME, exits 0 and prints JSON. If one cannot run, the test fails and names it, so there is no silent
   pass. The union of model keys seen includes `executor_model`, `verifier_model`, `planner_model`,
   `checker_model`, `researcher_model`, `researcher_models`, `synthesizer_model`, `roadmapper_model`,
   `mapper_models` and `auditor_model`.
4. Unit (the 76 defect): text holding `aof-tools.cjs init execute-objective` and `model="{planner_model}"` gives
   1 finding. Adding the line
   `PLANNER_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model planner --objective "${OBJECTIVE_NUMBER}" --raw)`
   gives 0.
5. Unit: `init execute-objective` with `model="{resolved_verifier_model}"` gives 1; with
   `model="{verifier_model}"` it gives 0.
6. Unit: `<!-- model-source: resolved_executor_model from executor_model -->` with `init execute-objective`
   supplies `{resolved_executor_model}` (0). The same annotation `from planner_model` gives 1, because
   execute-objective does not print planner_model. An annotation whose NAME is never used is 1 stale finding.
7. Unit: `{mapper_models.<focus>}` and `model: "{mapper_models.tech}"` (YAML form) resolve by root under
   `init map-codebase`. `model="{model from the result}"` is not scanned. `FOO_MODEL=$(echo sonnet)` does not
   supply `{FOO_MODEL}`, because there is no `resolve-model`.
8. Coverage: more than 60 files are scanned, including `plugins/aoforge/aoforge/workflows/execute-objective.md`,
   `build.md`, `plugins/aoforge/skills/debug/SKILL.md` and `plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md`.

Task 2 (engine unit cases in `flutter-ui-eval.test.cjs`, CLI and contract cases in
`flutter-ui-eval-dogfood.test.cjs`):

9. J1 CLI, credential-less (strip `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL`, as in
   Case G3): `verify flutter-ui-eval <fixture manifest> --judge live --judge-tier opus --raw` gives
   `judge_tier: 'opus'`, `gate: 'binding'`, `verdict: 'fail'` (as G3) and
   `tier_escalation` deepEqual `{requested: false, trigger: null, from_tier: 'opus', states: []}`. RED.
10. J2 CLI: `--judge-tier opus` with no `--judge`, and `--judge labels --judge-tier opus`, both exit non-zero
    with stderr matching `/--judge-tier/`. RED (today the flag is ignored and the run exits per verdict).
11. J3 CLI: `--judge live --judge-tier nonsense` and `--judge live --judge-tier` with no value both exit
    non-zero with `/--judge-tier/`. If the harness appends `--raw`, the missing value reads as `--raw`, which is
    also rejected. RED.
12. J4 CLI, behavioural parity: the default labels run's rollup has `tier_escalation` deepEqual
    `{requested: false, trigger: null, from_tier: null, states: []}`, no `judge_tier` key, and every Case G1
    assertion still holds. RED on the new field only.
13. J5 contract pin (**green at BASE**; it pins the call the skill makes): with the flutter pack mirrored into a
    temp stacks dir (`mirrorPack` from `plugins/aoforge/aoforge/bin/lib/pack-mirror.cjs`, env only on that spawn:
    `HOME=<tmp home>`, `AOFORGE_STACKS_DIR=<tmp stacks>`), `resolve-model ui-evaluator --escalate-from sonnet`
    gives `tier: 'opus'`, `model: 'inherit'`, `ceiling: false`, and `--escalate-from opus` gives `ceiling: true`.
14. J6 prose contract: `agents/ui-evaluator.md` contains `## ESCALATION REQUESTED`, `split-votes`,
    `**Judge tier:**` and `--judge-tier`. `skills/ui-eval/SKILL.md` contains `UI_EVALUATOR_MODEL=$(`,
    `resolve-model ui-evaluator --escalate-from` and `--judge-tier`. RED until step 3.
15. E1 unit `judgeTier(profile, override)`: with no override, `'balanced'` and `'quality'` return the pack
    manifest's `models['ui-evaluator']` tier for that profile (read aoforge-stack.json in the test, no literal).
    `judgeTier('balanced', 'opus') === 'opus'`. `judgeTier('balanced', 'gpt-9')` throws `/judge-tier/`. RED.
16. E2 unit: `judgeModel('balanced', 'opus')` equals core `references/model-profiles.json` `models.opus`, read
    in the test. `judgeModel('balanced')` equals `models[<manifest balanced tier>]`, unchanged from BASE. RED on
    the override.
17. E3 unit: `buildVisionRequest({...req, judge_tier: 'opus'}).body.model === models.opus`. Without
    `judge_tier`, `body.model === judgeModel()` (parity). RED on the first.
18. E4 unit `judgeEscalation({live, judgeTier, reviews, states})`, hand-built inputs:
    a. live, `reviews: ['s1']`, `states: [{state_id:'s1', verdict:'review', flake:true}]` gives
       `{requested: true, trigger: 'split-votes', from_tier: 'sonnet', states: ['s1']}`;
    b. live, a review state with no `flake` (live error) gives `requested: false`;
    c. `live: false` with the case (a) inputs gives `{requested: false, trigger: null, from_tier: null, states: []}`;
    d. live, a `flake: true` review state that is NOT in `reviews[]` (an expect:fail state) gives
       `requested: false`;
    e. live, `reviews: []` gives `requested: false, from_tier: 'sonnet'`. RED (not exported).

Task 3 (`benchmark.test.cjs`):

19. B1 `buildPerObjective` on a fixture `projectDir` (`<tmp>/sess-1/subagents/a.jsonl` + `a.meta.json`, and
    `b.*`). Both have first prompt `Execute TRD 76-01` and one assistant usage line. Their meta `agentType` is
    `${NAMES.agentNs}executor` and `${NAMES.agentNs}verifier`. `repo` is an empty temp dir (no `.aoforge/`, so
    no git call), `since: null`, `model: 'opus'`. Key `obj-76` has `agent_calls: 2`, `executor_calls: 1`,
    `executor_cost` equal to record a's cost, and `by_agent` holding both types. **RED at BASE**
    (`executor_calls: 0`).
20. B2 `isExecutorType`: true for `${NAMES.agentNs}executor`, `${LEGACY.agentNs}executor` and
    `${LEGACY.installPrefix}executor`; false for `${NAMES.agentNs}executor-x`, `${NAMES.agentNs}verifier`,
    `executor`, `general-purpose`, `undefined` and `''`. RED (not exported).

## Behavioral parity checklist (back_compat: behavioral)

The new code must reproduce these BASE behaviours. Read the source and tests as the contract:

- `verify flutter-ui-eval` without `--judge-tier`: same exit codes and same fields. Scored rollups only add
  `tier_escalation` (and `judge_tier` on live runs). All existing dogfood cases (D*, DF*, N1, C5, G1-G4, X1) and
  `verifier-ui-eval-invocation.test.cjs` V1-V6 pass unchanged.
- `judgeModel()` with no arguments, `judgeProfile()` and `buildVisionRequest(req)` without `judge_tier` return
  the BASE values. `flutter-ui-design-review.cjs:66` calls `judgeModel()` bare and must be unaffected.
- execute-objective: the same spawns, agents and step-3 complexity rule. Only the model names' sources change.
- build.md: the same two `resolve-model` calls, now assigned to names.
- benchmark: `by_agent`, `cost`, totals and the summary/session commands are unchanged. Only `executor_*`
  changes, from always 0 to counted.

<embedded_context>
<codebase_examples>
Placeholder sites at BASE (`plugins/aoforge/aoforge/workflows/execute-objective.md`). Step 3 (:376-388) picks
a per-plan executor model but never names the result:

```
3. **Assess plan complexity for model selection:**
   ...
   - **Simple** (task_count <= 2, files_modified <= 3): use sonnet — straightforward implementation
   - **Standard** (task_count 3-5): use `executor_model` from profile — normal execution
   - **Complex** (task_count > 5 or files_modified > 8): use opus — benefits from stronger context management
   Log any overrides: `Model override: executor {executor_model} → {override} for {plan_id} (reason: {simple|complex} plan)`
   Safety rule: never downgrade executor below sonnet.
```

The autonomous checkpoint verifier (:907-910) uses `model="{resolved_verifier_model}"`. In auto_gap_closure,
item 1 (:1309-1326) has `Spawn planner with \`--gaps\` flag:` followed by a Task with `subagent_type="planner",
model="{planner_model}"`. Init parse line (:25): `executor_model`, `verifier_model`, … (no planner).
The objective variable used by other shell calls in this file is `"${OBJECTIVE_NUMBER}"` (:63, :245, :601).

build.md (:33-40), the 76-01 fix, has plain commands with no named output:

```
used to spawn with an empty model). Resolve both; use them as `{executor_model}` and `{verifier_model}`:
```bash
node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model executor --objective "$OBJECTIVE_NUMBER" --raw
```
```bash
node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model verifier --objective "$OBJECTIVE_NUMBER" --raw
```
```

new-milestone.md (:175) spawns researchers with `model="{MODEL}"`. Its dimension table row (:187) is
`| MODEL | \`researcher_models.stack\` | … |`, and `init new-milestone` prints `researcher_models`.
research-objective.md (:12-17) Step 0 is the `@…/model-profile-resolution.md` reference plus "Resolve model
for: - `objective-researcher`". Step 1 normalizes `${OBJECTIVE}` and ends at "If `found` is false: Error and
exit.". :88 spawns with `model="{researcher_model}"`.

The convention already used in skills (`plugins/aoforge/skills/debug/SKILL.md:44`):

```bash
DEBUGGER_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model debugger --raw)
```

Behavioural init harness to copy (`model-profiles.test.cjs:381-395`, quick 35, not exported):

```js
function project(config, { objectiveDir } = {}) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mp-q35-'));
  fs.mkdirSync(path.join(dir, '.aoforge')); fs.mkdirSync(path.join(dir, 'home'));
  fs.writeFileSync(path.join(dir, '.aoforge', 'config.json'), JSON.stringify(config));
  ...
}
function aof(dir, args) {
  const env = { ...process.env, HOME: path.join(dir, 'home') };
  delete env.AOFORGE_STACKS_DIR;
  const r = spawnSync(process.execPath, [DF_TOOLS, ...args], { cwd: dir, encoding: 'utf8', env });
```

The planner probed this at HEAD 5fccd65d. A fixture with `.aoforge/{config.json {}, PROJECT.md (kind: cli,
default_work: feature), ROADMAP.md ("### Objective 1: Demo"), STATE.md, objectives/01-demo/OBJECTIVE.md (work:
feature)}` runs `init execute-objective 1`, `plan-objective 1`, `verify-work 1`, `objective-op 1`, `quick x`,
`new-project`, `new-milestone`, `map-codebase`, `security-audit`, `milestone-op` and `progress`, and every one
prints JSON. A prototype of the scan over the real tree found exactly the 8 findings in Test list 1.
`IS_AOFORGE_CHECKOUT` pattern: `context-budget.repo.test.cjs:31`.

Escalation pattern to mirror (`plugins/aoforge/agents/debugger.md:569-595` and
`plugins/aoforge/skills/debug/SKILL.md:205-216`): the agent returns

```markdown
## ESCALATION REQUESTED
**Debug Session:** … **Trigger:** hypotheses-exhausted | no-progress-stuck **Attempts:** …
### What was tried / ### Why it is not converging / ### What a higher rung should do differently
```

and the orchestrator runs `resolve-model debugger --escalate-from "{model this round ran on}"`. On
`ceiling: false` with no escalation yet in the session, it re-spawns with `model="{the escalated model}"` and the
block verbatim in `<prior_attempt>`. Otherwise it reports the attempt as inconclusive.

The engine today (`plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs`):

```js
function judgeModel(profile = judgeProfile()) {                                   // :530
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'aoforge-stack.json'), 'utf-8'));
  const tier = ((manifest.models || {})['ui-evaluator'] || {})[profile] || 'sonnet';
  const profiles = JSON.parse(fs.readFileSync(require('./core.cjs').corePath('..', '..', 'references', 'model-profiles.json'), 'utf-8'));
  return profiles.models[tier] || tier;
}
function buildVisionRequest(request) { const model = judgeModel(); ... }          // :537
// CLI (:711-721): --judge parsed from `list`; unknown value -> error(`unrecognised --judge value ...`)
// live loop (:842-878): request = { state_id, surface, screenshot_path, expected, defect_types, severities };
//   stateDetail entries carry `flake: agg.split === true || agg.tie === true`; a live error pushes
//   { verdict: 'review', … } with NO flake field.
// rollup (:915-951): outputRollup({ …, gate, model: liveJudge ? liveModel : undefined, …,
//   known_broken: rollup.known_broken, usage: …, states: stateDetail }, rollup.verdict)
```

The pack manifest `models['ui-evaluator']` is `{quality: opus, balanced: sonnet, budget: sonnet}`. The live path is
the only place a model judges anything. Verifier Step 8c runs the default labels path (advisory), so it needs
no escalation (decision 5; OPS-01 keeps the live judge local through `/aoforge:ui-eval --judge live`).

The `resolve-model` result the skill consumes (probed with the pack mirrored):

```json
{ "model": "inherit", "agent": "ui-evaluator", "tier": "opus", "model_id": "claude-opus-5-5",
  "tier_source": "escalation", "escalated_from": "sonnet", "ceiling": false }
```

Without the pack mirror, `resolve-model ui-evaluator` is an unknown agent (`unknown_agent: true`, no `ceiling`,
`--escalate-from` ignored). The skill treats that as the ceiling.

benchmark (`plugins/aoforge/aoforge/bin/lib/benchmark.cjs`): imports `planningRoot` from compat.cjs (:21) and
`escapeRegExp` (:22). The dead check at :353 is `if (r.agentType === 'df-executor') {`. `buildPerObjective` is
exported (:673). `extractObjectiveId('Execute TRD 76-01')` gives `obj-76`. agent-overhead.cjs:34-36 has the
history regex to mirror:

```js
const AGENT_PREFIX_RE = new RegExp(
  `^(?:${[NAMES.agentNs, LEGACY.agentNs, LEGACY.installPrefix].map(escapeRegExp).join('|')})`
);
```
</codebase_examples>

<anti_patterns>
- Do not parse init.cjs to find emitted keys, and do not edit init.cjs (decisions 1 and 2).
- Do not add the guard to model-profiles.test.cjs (quick 40's file).
- Do not name Flutter, Dart, Maestro, Playwright or `browser_` in any core file you edit (stack-neutrality).
  Every judge change lives under `plugins/aoforge-stack-flutter/`.
- Do not let the engine escalate on its own or loop. One flag, one recorded signal; the skill decides once.
- Do not count a credential or network review as a split vote. Do not escalate an advisory run.
- Do not spell a legacy agent type (`df-executor`, the pre-rename namespace) as a literal in benchmark.cjs or
  its test. Build them from legacy-names.cjs.
- Do not rewrite whole files. Use targeted Edits; most prose changes are 1-15 lines.
- Do not use generated test data or property-based tests. Every fixture is hand-built inline.
</anti_patterns>

<error_recovery>
- If Test list 1's RED set differs from the 8 listed, record the actual list in the SUMMARY. Line numbers may
  shift if the tree moved. A placeholder the list does not name gets the same treatment as the 8: a resolve
  assignment, an init key or an annotation. Never an ALLOW list.
- If an init command fails in the fixture, add its argument to the ARGS table or the missing fixture file.
  Never skip the command.
- If a pinned-text suite (context-budget, executor-isolation, execute-objective-gh-sync, pr-lifecycle-prose,
  builtin-sweep, doc-refs, planning-writes, flag-spec) goes red after a workflow edit, the edit broke a pin.
  Restore the pinned text and add around it.
- If `aof-tools commit` refuses because something outside `--files` is staged (quick 40 running at the same
  time), do not unstage it. Stop and report it in the SUMMARY.
- If CHANGELOG.md has uncommitted changes you did not make, do not edit it. Put the intended bullets in the
  SUMMARY under `## Changelog (pending)`.
</error_recovery>
</embedded_context>

<gotchas>
- **Scratch HOME for every test run:** `HOME=<scratchpad>/home-q42` (create it once). Never a `mktemp -d` HOME
  under `/var/folders`, which breaks tests on macOS. Leave TMPDIR alone. In-test fixtures use
  `fs.realpathSync(os.tmpdir())`, as the existing suites do.
- **One plain command per Bash call.** The shell is zsh, so an unquoted `$var` holding `init quick x` does not
  word-split. Spell each command out.
- **Commits** go through `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<msg>" --files <paths>`,
  because raw commits are gated.
- **context-budget.repo:** `SKILL_CHARS` is 90,000, and execute-objective resolves to about 83K today. Keep the
  execute-objective additions under 1,000 characters.
- **Positional parse in the engine CLI:** `positional = list.filter(a => !a.startsWith('--'))`, so flag values
  (`live`, `opus`) count as positionals. The manifest or objective argument must come first in every command
  you write, as it does today.
- `error()` in flutter-ui-eval.cjs comes from core helpers and exits 1. Keep the `return` after it, as the
  `--judge` branch does.
- The dogfood fixture (`__fixtures__/flutter-ui-eval/manifest.json`) scores `fail` by design, so a live run
  exits non-zero. Use the tolerant capture Case G3 uses.
- The dogfood file already has a "Case C5". Name the new cases J1-J6 and the unit cases E1-E4.
- `judgeProfile()` reads the cwd's `.aoforge/config.json`. Unit tests pass an explicit profile.
- Guard samples that contain shell `${…}` (Test list 4) must be plain quoted strings, not JS template literals,
  or `${OBJECTIVE_NUMBER}` is interpolated as an undefined variable.
- Port 8080 is off limits. No push, tag or release.
</gotchas>

<validation_gates>
- task: `npm test` (`aof-tools stack command test` → `npm test`; `gates.task: [test]`). There is no lint, format or
  build gate.
- Task 1 scoped set (from `<repo>`, scratch HOME): `node --test plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs plugins/aoforge/aoforge/bin/lib/context-budget.repo.test.cjs plugins/aoforge/aoforge/bin/lib/executor-isolation.test.cjs plugins/aoforge/aoforge/bin/lib/execute-objective-gh-sync.test.cjs plugins/aoforge/aoforge/bin/lib/pr-lifecycle-prose.repo.test.cjs plugins/aoforge/aoforge/bin/lib/builtin-sweep.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs plugins/aoforge/aoforge/bin/lib/planning-writes.repo.test.cjs plugins/aoforge/aoforge/bin/lib/flag-spec.repo.test.cjs plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs`
- Task 2 scoped set: `node --test plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs plugins/aoforge-stack-flutter/lib/flutter-ui-eval-dogfood.test.cjs plugins/aoforge-stack-flutter/lib/verifier-ui-eval-invocation.test.cjs plugins/aoforge-stack-flutter/lib/flutter-ui-design-review.test.cjs plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs plugins/aoforge/aoforge/bin/lib/stack-packs.test.cjs plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs`
- Task 3 scoped set: `node --test plugins/aoforge/aoforge/bin/lib/benchmark.test.cjs plugins/aoforge/aoforge/bin/lib/agent-overhead.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs`
</validation_gates>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Guard that every spawn model placeholder has a source, then give execute-objective and its siblings one</name>
  <files>plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs, plugins/aoforge/aoforge/workflows/execute-objective.md, plugins/aoforge/aoforge/workflows/build.md, plugins/aoforge/aoforge/workflows/new-milestone.md, plugins/aoforge/aoforge/workflows/research-objective.md</files>
  <action>
Step 0 (BASE). Record `BASE` with `git -C <repo> rev-parse HEAD`. Check quick 40's state: does
`<repo>/.aoforge/quick/40-remove-df-leftovers-tighten-the-rename-g/40-SUMMARY.md` exist, and what does
`git -C <repo> status --short` show? Record both. None of this task's files are quick 40's (decision 8), so
continue either way. Create `<scratchpad>/home-q42`. Run the full `npm test` from `<repo>` with that HOME. Save
the totals and the failing test names to `<scratchpad>/q42-base-npm.txt`. Then run the three scoped sets and save
their per-file counts.

Step 1 (RED). Create `model-placeholders.repo.test.cjs`:
- Header comment: what it guards (76-VERIFICATION SC1; the class TRD 76-01 fixed in build.md), the three
  sources (decision 1), the scan set (decision 3), and Test list 1-8.
- `REPO_ROOT` (five levels up), `IS_AOFORGE_CHECKOUT` (as context-budget.repo:31), `AOF` = `../aof-tools.cjs`.
- Regexes:
  - `PLACEHOLDER_RE = /\bmodel\s*[=:]\s*"\{([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z0-9_<>]+)*)\}"/g`
  - `INIT_RE = /aof-tools\.cjs init ([a-z][a-z-]*)/g`
  - `ASSIGN_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)=\$\([^\n]*\bresolve-model\b/gm`
  - `ANNOT_RE = /<!--\s*model-source:\s*([A-Za-z_][A-Za-z0-9_]*)\s+from\s+([A-Za-z_][A-Za-z0-9_]*)\S*\s*-->/g`
- A pure `checkText(text, initKeysOf)` returns `{ unsupplied: [{name, line}], stale: [{name, line}] }`. Keys
  compare lowercased, and a placeholder's root is its name before the first `.`.
- A lazy `initKeysOf(cmd)` builds the fixture project once (see codebase_examples) and runs
  `aof-tools init <cmd> ...ARGS[cmd]` with `HOME=<fixture>/home` and `AOFORGE_STACKS_DIR` deleted. It asserts
  exit 0 and JSON, caches a Set of lowercased top-level keys, and removes the fixture in an `after` hook. ARGS:
  `{ 'execute-objective': ['1'], 'plan-objective': ['1'], 'verify-work': ['1'], 'objective-op': ['1'], quick: ['x'] }`.
- Tests 1-8. Test 1's message lists `rel:line {name}` for every finding.
Run it alone. Test 1 FAILS with exactly the 8 findings, and 2-8 pass. Save the failure text. Commit:
`test(quick-42): every spawn model placeholder names a source its file supplies (RED)`.

Step 2 (GREEN). Make targeted edits:
- execute-objective.md step 3: after "Safety rule: never downgrade executor below sonnet." add one line: "The model
  this step picks for a plan is `{resolved_executor_model}`, which every spawn of that plan below uses.
  <!-- model-source: resolved_executor_model from executor_model -->"
- execute-objective.md :910: change `model="{resolved_verifier_model}"` to `model="{verifier_model}"` (init
  prints it).
- execute-objective.md auto_gap_closure item 1: before "Spawn planner with `--gaps` flag:", add
  "`init execute-objective` prints no planner model (quick 42). Resolve it once per run:" followed by a bash block
  with `PLANNER_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model planner --objective "${OBJECTIVE_NUMBER}" --raw)`.
  Change the Task to `model="{PLANNER_MODEL}"`.
- build.md :36 and :39: make the two commands
  `EXECUTOR_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model executor --objective "$OBJECTIVE_NUMBER" --raw)` and
  `VERIFIER_MODEL=$(… resolve-model verifier …)`. Keep two separate blocks and the sentence above them.
- new-milestone.md: on its own line after the dimension table, add
  `<!-- model-source: MODEL from researcher_models.<dimension> -->`.
- research-objective.md: in Step 0, keep the `@` reference and replace the "Resolve model for:" list with
  "Step 1 resolves the researcher's model once the objective is normalized." At the end of Step 1, after
  "If `found` is false: Error and exit.", add a bash block with
  `RESEARCHER_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model objective-researcher --objective "${OBJECTIVE}" --raw)`.
  :88 stays `{researcher_model}`, which matches case-insensitively.
Run the Task 1 scoped set: all green. Check `wc -c` of execute-objective.md: under 80,300. Commit:
`fix(quick-42): spawns in execute-objective, build, new-milestone and research-objective name a supplied model (GREEN)`.

# CRITICAL: Test 1 must have been observed RED with the 8 findings before any workflow edit.
# GOTCHA: in a scratch project, prove `resolve-model planner --objective 1 --raw` and
#   `resolve-model objective-researcher --objective 1 --raw` each print one model alias (exit 0).
  </action>
  <verify>
`node --test <repo>/plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs` (scratch HOME): RED with
the 8 findings at the first commit, then all green. `rg -n 'resolved_verifier_model|model="\{planner_model\}"' <repo>/plugins/aoforge/aoforge/workflows/execute-objective.md`
prints nothing. The Task 1 scoped set matches the BASE counts, plus the new file's tests.
  </verify>
  <done>The RED and GREEN commits exist. No spawn in a core workflow, core skill or pack prompt names a model
placeholder without a source, and CI enforces it.</done>
  <recovery>If a pinned-text suite breaks, restore the pinned sentence and add around it (error_recovery). If
`resolve-model … --objective "${OBJECTIVE}"` errors on an unnormalized argument, move the assignment after the
line where Step 1 sets the normalized value, and record that in the SUMMARY.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The UI judge escalates one rung on split votes (engine flag + signal, agent return, skill re-spawn)</name>
  <files>plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs, plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs, plugins/aoforge-stack-flutter/lib/flutter-ui-eval-dogfood.test.cjs, plugins/aoforge-stack-flutter/agents/ui-evaluator.md, plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md</files>
  <action>
Step 1 (RED). Add `test.describe('judge tier and split-vote escalation (quick 42)')` to flutter-ui-eval.test.cjs
with E1-E4 (Test list 15-18). Add `test.describe('judge tier and escalation, CLI and wiring (quick 42)')` to
flutter-ui-eval-dogfood.test.cjs with J1-J6 (Test list 9-14). J5 mirrors the pack with
`require(path.join(__dirname, '..', '..', 'aoforge', 'aoforge', 'bin', 'lib', 'pack-mirror.cjs')).mirrorPack({ packRoot: path.join(__dirname, '..'), stacksDir })`
into a temp dir and spawns `<repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs` with a per-spawn env. It never
sets `process.env`. Run the Task 2 scoped set: J1-J4, J6 and E1-E4 fail, J5 and every pre-existing case pass.
Commit: `test(quick-42): judge tier override and split-vote escalation signal (RED)`.

Step 2 (GREEN, engine). In flutter-ui-eval.cjs:
- `const JUDGE_TIERS = ['haiku', 'sonnet', 'opus'];`
- `judgeTier(profile = judgeProfile(), override)`: if `override != null`, return it when it is in JUDGE_TIERS,
  else throw `Error(`--judge-tier must be one of haiku|sonnet|opus; got "${override}"`)`. Otherwise return the
  manifest tier for the profile (today's lookup, `|| 'sonnet'`).
- `judgeModel(profile = judgeProfile(), tierOverride)`: compute `const tier = judgeTier(profile, tierOverride)`,
  then do the same id lookup as today. A bare `judgeModel()` behaves exactly as at BASE.
- `buildVisionRequest`: `const model = judgeModel(judgeProfile(), request.judge_tier);`
- A pure `judgeEscalation({ live, judgeTier: tier, reviews = [], states = [] })`. Its `split` is the `reviews`
  ids whose `states` entry has `flake === true`. It returns
  `{ requested: !!live && split.length > 0, trigger: (that) ? 'split-votes' : null, from_tier: live ? tier : null, states: (that) ? split : [] }`.
- CLI, after the `--judge` parse: read `--judge-tier`. If the flag is present and `judgeMode !== 'live'`, call
  `error('--judge-tier applies only to --judge live (the labels path calls no model)')`. If the value is not in
  JUDGE_TIERS (a missing value included), call
  `error(`unrecognised --judge-tier value '${v}' — expected haiku, sonnet or opus`)`. Keep a `return` after each.
  Compute `const tier = liveJudge ? judgeTier(judgeProfile(cwd), judgeTierArg) : null;`. Add `judge_tier: tier`
  to the live `request`, so the reported tier is the tier the calls used.
- Rollup: after `model`, add `judge_tier: liveJudge ? tier : undefined,`. After `known_broken`, add
  `tier_escalation: judgeEscalation({ live: liveJudge, judgeTier: tier, reviews: rollup.reviews, states: stateDetail }),`.
- Usage string: add `[--judge-tier haiku|sonnet|opus]`. Add one sentence to the description: live only; the
  rung the vision calls use, set by /aoforge:ui-eval on a one-rung escalation.
- Export `judgeTier`, `judgeEscalation` and `JUDGE_TIERS`.
Run the Task 2 scoped set: everything except J6 passes. Commit:
`feat(quick-42): --judge-tier and the tier_escalation signal in the visual-eval engine`.

Step 3 (GREEN, prompts).
In `agents/ui-evaluator.md`:
- `score` step: pass `--judge live` when the prompt asks for the live judge. Add `--judge-tier <tier>` only when
  the prompt names one, which happens only on an escalated re-spawn. Keep the manifest argument first.
- New step `escalate` after `report`: if the run was live, `tier_escalation.requested` is true, and the prompt
  has no `<prior_attempt>` escalation block, write the evidence as usual (the first attempt stays on record) and
  then return `## ESCALATION REQUESTED` (below) instead of UI-EVAL COMPLETE. When the prompt carries
  `<prior_attempt>`, skip `capture` (the screenshots are on disk), re-score with the given `--judge-tier`, and
  always return UI-EVAL COMPLETE. A design-review run never escalates (decision 5).
- `<output>`: add the block, kept under the 300-token return budget:
  ```markdown
  ## ESCALATION REQUESTED

  **Manifest:** {manifest path}
  **Judge tier:** {tier_escalation.from_tier}
  **Trigger:** split-votes
  **States:** {tier_escalation.states, comma-separated}
  **Report:** .aoforge/objectives/{obj}/evidence/ui_eval/ui-eval-report.json

  ### What was tried
  {one line per split state: votes broken/ok at this tier}
  ### Why it is not converging
  The live samples disagreed, so the flake budget cannot tell a defect from judge noise.
  ### What a higher rung should do differently
  Re-judge the same captures with `--judge live --judge-tier {next rung}`; no recapture.
  ```
  Add `**Judge tier:** {judge_tier}` to UI-EVAL COMPLETE on live runs.
- `<critical_rules>`: the agent still never picks a model id or tier. Its only tier input is the
  `--judge-tier` the orchestrator passes.
In `skills/ui-eval/SKILL.md` `<process>`, replace the spawn paragraph with:
- a bash block `UI_EVALUATOR_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model ui-evaluator --raw)`,
  then a `Task(subagent_type="aoforge-stack-flutter:ui-evaluator", model="{UI_EVALUATOR_MODEL}", prompt=…manifest
  path, judge mode…)` block;
- **If the agent returns `## ESCALATION REQUESTED`** (MEF-06, quick 42): run
  `node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model ui-evaluator --escalate-from "{Judge tier from the block}"`
  and read the full JSON. If `ceiling: false` and this run has not escalated yet, re-spawn once with
  `model="{model from the escalation result}"`, add `--judge-tier {tier from the escalation result}` to the
  prompt, put the block verbatim in `<prior_attempt>`, and log
  `Escalated: ui-evaluator {from} → {tier} (split-votes)`. If `ceiling: true`, or `unknown_agent: true` (pack
  models not mirrored; point to `/aoforge:doctor`), or the run already escalated, report the first rollup as
  final, keep the split states on human verification, and show the block's last section;
- inline runs (no spawn) follow the same rule on the score step's `tier_escalation`: re-run the score step once
  with `--judge live --judge-tier {tier}`.
Run the Task 2 scoped set and the Task 1 guard: all green. The guard now covers the new skill placeholder.
Commit: `feat(quick-42): ui-evaluator requests escalation on split votes and /aoforge:ui-eval re-spawns it one rung up`.

# PATTERN: debugger.md ESCALATION REQUESTED + skills/debug/SKILL.md handler (codebase_examples).
# GOTCHA: `--escalate-from` takes the judge's TIER (sonnet), not the Task model alias (inherit). The result's
#   `model` feeds Task and its `tier` feeds --judge-tier.
  </action>
  <verify>
Task 2 scoped set and the guard are green. Credential-less (stripped env, scratch HOME):
`node <repo>/plugins/aoforge-stack-flutter/bin/aof-flutter.cjs verify flutter-ui-eval <repo>/plugins/aoforge-stack-flutter/lib/__fixtures__/flutter-ui-eval/manifest.json --judge live --judge-tier opus --raw`
prints `"judge_tier": "opus"` and `"requested": false`. The same command with `--judge labels` in place of
`--judge live` exits 1. `git diff BASE -- plugins/aoforge/` shows no change from this task.
  </verify>
  <done>The three commits exist. The judge's escalation changes the rung the vision calls use, it fires only on
split votes in a live run, and /aoforge:ui-eval re-spawns once from `resolve-model --escalate-from`. Core is
untouched.</done>
  <recovery>If a pre-existing dogfood or V-case breaks, the rollup or the exit path changed beyond the two new
fields. Restore parity first (behavioral parity checklist). If J5 fails at BASE, the mirror helper's signature
differs: read `pack-mirror.cjs` and adapt the call. Do not change core.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: benchmark counts AOForge executors, changelogs, full suite and objective 76 re-verification evidence</name>
  <files>plugins/aoforge/aoforge/bin/lib/benchmark.cjs, plugins/aoforge/aoforge/bin/lib/benchmark.test.cjs, plugins/aoforge-stack-flutter/CHANGELOG.md, CHANGELOG.md</files>
  <action>
Step 1 (RED). In benchmark.test.cjs, add `describe('executor spawns are counted (quick 42)')` with B1 and B2 (Test
list 19-20). Build the agent types from `require('./legacy-names.cjs')`. The fixture jsonl lines are
`{type:'user', message:{content:'Execute TRD 76-01'}}` and
`{type:'assistant', requestId:'r1', message:{id:'r1', usage:{input_tokens:100, cache_creation_input_tokens:0, cache_read_input_tokens:0, output_tokens:10}}}`.
Run the Task 3 scoped set: B1 and B2 fail. Commit: `test(quick-42): benchmark counts executor spawns (RED)`.

Step 2 (GREEN). In benchmark.cjs, require `{ NAMES, LEGACY }` from `./legacy-names.cjs`. Add
`EXECUTOR_TYPE_RE` built like agent-overhead.cjs:34-36 with `executor$` appended, and
`function isExecutorType(t) { return typeof t === 'string' && EXECUTOR_TYPE_RE.test(t); }`. Add a comment: a
history reader counts today's executor and, in old transcripts, the pre-rename and install-prefixed ones (TRD
72-10, quick 42). Replace :353 with `if (isExecutorType(r.agentType)) {` and export `isExecutorType`. Run the
scoped set: green. Run `rg -n "'df-" <repo>/plugins/aoforge/aoforge/bin/lib/benchmark.cjs`: it prints nothing.
Commit: `fix(quick-42): benchmark per-objective counts AOForge executor spawns (GREEN)`.

Step 3 (changelogs, last). Check `git -C <repo> status --short CHANGELOG.md`. If quick 40 left it dirty, follow
error_recovery. Otherwise, under `## [Unreleased]`, add to the existing subsections or create `### Fixed` and
`### Added`:
- Fixed: execute-objective spawned the gap-closure planner and the autonomous checkpoint verifier with model
  placeholders nothing supplied. The planner is now resolved with `resolve-model planner --objective`, the
  verifier uses init's `verifier_model`, and build, new-milestone and research-objective name their model
  sources (objective 76 SC1, quick 42).
- Added: `model-placeholders.repo.test.cjs` fails CI on a spawn `model` placeholder that is not an init key, a
  `resolve-model` assignment or a `model-source` annotation (quick 42).
- Fixed: `aof-tools benchmark per-objective` counted no executor spawns (`executor_calls` was always 0)
  (quick 42).
In `plugins/aoforge-stack-flutter/CHANGELOG.md`, add `## [Unreleased]` above `## [1.0.0]` with `### Added`: the
`--judge-tier haiku|sonnet|opus` flag for `verify flutter-ui-eval` (live only), the rollup's `judge_tier` and
`tier_escalation` (split votes on a live run), ui-evaluator's `## ESCALATION REQUESTED` return, and the one-rung
re-spawn in /aoforge:ui-eval (objective 76 SC6 / MEF-06, quick 42). Commit:
`docs(quick-42): changelogs`.

Step 4 (gate and re-verification evidence). Run the full `npm test` (scratch HOME) and compare it with
`<scratchpad>/q42-base-npm.txt`. Then collect the evidence for the orchestrator's verifier, one command per call:
- `node --test plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs`: pass count;
- `rg -n 'resolved_verifier_model|\{planner_model\}' plugins/aoforge/aoforge/workflows/execute-objective.md`:
  empty;
- `node plugins/aoforge/aoforge/bin/aof-tools.cjs resolve-model planner --objective 76 --raw`: the alias;
- the Task 2 credential-less `--judge-tier opus` run: `judge_tier`, `tier_escalation`;
- the J5 output, or the same `resolve-model ui-evaluator --escalate-from sonnet` with a mirrored pack;
- `node --test plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs`: pass.
Do not edit 76-VERIFICATION.md or REQUIREMENTS.md. The orchestrator owns re-verification and traceability.
  </action>
  <verify>`npm test` (scratch HOME): no new failures against BASE, and the total grows only by the new tests.
`git diff BASE --stat` lists only `files_modified`. `git diff BASE | rg -n '8080'` prints nothing.</verify>
  <done>executor_calls counts executor spawns, both changelogs carry the entries (or the SUMMARY carries them as
pending), the full suite shows no regression, and the SC1/SC6 evidence table is in the SUMMARY.</done>
  <recovery>If a full-suite failure also fails at BASE, it is pre-existing: list it and do not fix it. If it is new,
bisect it to the commit that caused it and fix it there with a follow-up commit.</recovery>
</task>

</tasks>

<verification>
- `npm test` (scratch HOME): no new failures against BASE.
- `git log --oneline BASE..HEAD` shows, in order: the Task 1 RED and GREEN commits, the Task 2 RED, engine and
  prompts commits, the Task 3 RED and GREEN commits, and the changelog commit, all made through `aof-tools commit`.
- SC1: the guard is green, and execute-objective has no unsupplied placeholder.
- SC6: a live run reports `judge_tier`. `judgeEscalation` requests escalation on split votes only.
  ui-evaluator.md and /aoforge:ui-eval carry the return and the one-rung re-spawn.
- stack-neutrality.repo passes, and `git diff BASE -- plugins/aoforge/ | rg -in 'flutter|dart|maestro|playwright'`
  shows only the test file's coverage assertion.
- No push, tag or release, and no 8080.
</verification>

<success_criteria>
- Objective 76 SC1 holds: no spawn names a model placeholder its file cannot supply, and CI keeps it that way.
- Objective 76 SC6's escalation half holds for the UI judge: a recorded signal (split live votes) re-runs the judge
  one rung up, once, through the same `resolve-model --escalate-from` path the debugger and executor use. The
  starting-tier half stays deferred to 76-08.
- `benchmark per-objective` reports real executor counts.
</success_criteria>

<output>
Write the SUMMARY into the draft that
`node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs planning draft quick/42-close-objective-76-gaps/42-SUMMARY.md`
prints
(`/var/folders/j2/r369kq256wd5qg5yn51x376m0000gn/T/aoforge-drafts/aoforge-claude-df646fc2/quick/42-close-objective-76-gaps/42-SUMMARY.md`).
Publish it with `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs --cwd <repo> quick summary 42 --from <that draft> --raw`.
Do not commit the SUMMARY; the orchestrator does that. Include:
- BASE, quick 40's state at Step 0, the npm test totals at BASE and at the end, and the scoped per-file counts
  before and after;
- the Task 1 RED failure text (the 8 findings), and the Task 2 and Task 3 RED failures;
- every commit hash;
- an SC1/SC6 evidence table (Task 3 Step 4) for the orchestrator's verifier;
- any file edited on a recovery path, and why; `## Changelog (pending)` if CHANGELOG.md was left alone;
- follow-up candidates: `references/escalation-policy.md` (quick 40's file) lists the orchestrators that act on
  ESCALATION REQUESTED and could add "a stack pack's judge skill" without naming a stack; the starting-tier half
  of SC6 is still 76-08's.
</output>
