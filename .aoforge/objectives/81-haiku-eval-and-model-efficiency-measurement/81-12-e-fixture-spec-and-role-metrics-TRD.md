---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "12"
type: standard
wave: 2
depends_on: ["81-01", "81-02", "81-07"]
files_modified:
  - scripts/eval81/fixtures/E/build.cjs
  - scripts/eval81/fixtures/E/acceptance.cjs
  - scripts/eval81/fixtures/E/reference.cjs
  - scripts/eval81/fixtures/E/proofs.test.cjs
  - scripts/eval81/__fixtures__/transcripts.cjs
  - scripts/eval81/batches/E.cjs
  - scripts/eval81/batches/E.test.cjs
  - scripts/eval81/lib/roles.cjs
  - scripts/eval81/lib/roles.test.cjs
  - scripts/eval81/score/E.cjs
  - scripts/eval81/score/E.test.cjs
autonomous: true
requirements: [SC-2, SC-4]
must_haves:
  truths:
    - "buildFixture(dir) materialises one small Node CLI project (`notekit`) with an AOForge planning tree valid for both 3.0.0 and 3.1.0, an unplanned two-feature objective 1 for /aoforge:build, and config `model_profile: balanced`, `mode: yolo`, `workflow.auto_advance: true`, `workflow.research: false`"
    - "Hidden acceptance checks (never copied into the fixture) decide each run's outcome; a proof test shows they fail on the base fixture and pass on a hand-written reference solution for the quick change and for the build objective"
    - "batches/E.cjs yields 10 runs per the fixed workload (per version: `/aoforge:quick <fixed text>` x3 and `/aoforge:build 1 --skip-research --auto` x2), version-interleaved, same session model and profile for both versions, caps from capForWorkflow"
    - "roles.cjs reads a run's copied transcripts and gives, per spawn (main session = orchestrator; subagents by meta agentType): first-turn input tokens, totals (via token-usage.cjs sumUsage), cache writes, cost priced from model-rates.json, wall time, and the model"
    - "score/E.cjs writes results/E.json and returns `81-MEASUREMENT.md` (76-08 report) comparing 3.0.0 and 3.1.0 per role and per run (first-turn input, total tokens, cache writes, cost, wall time, tests and verification outcome) beside the static resident bytes from results/static-prompt.json"
  artifacts:
    - path: scripts/eval81/fixtures/E/build.cjs
      provides: "buildFixture(dir), QUICK_TEXT, BUILD_ARGS"
    - path: scripts/eval81/fixtures/E/acceptance.cjs
      provides: "checkQuick(dir, env), checkBuild(dir, env)"
    - path: scripts/eval81/lib/roles.cjs
      provides: "rolesForRun(runDir, {rates}), firstTurnInput(file)"
    - path: scripts/eval81/score/E.cjs
      provides: "score({root, outDir}) for E, renderMeasurement"
  key_links:
    - from: scripts/eval81/lib/roles.cjs
      to: plugins/aoforge/aoforge/bin/lib/token-usage.cjs
      via: "sumUsage(file) per transcript"
      pattern: "sumUsage"
    - from: scripts/eval81/score/E.cjs
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json
      via: "static resident bytes per role beside live first-turn tokens"
      pattern: "static-prompt.json"
---

# TRD 81-12: Test E fixture, workload spec, per-role transcript metrics and the 76-08 report renderer

<objective>
Prepare test E (76-08): one fixture project, a fixed workload run under the 3.0.0 and 3.1.0 plugins, hidden
acceptance checks that decide each run's outcome, per-role metrics read from each run's transcripts, and the renderer
for the 76-08 measurement report.

Purpose: SC-4 (3.0.0 vs 3.1.0 per role and per run: first-turn input tokens, total tokens, cache writes, cost, wall
time, tests and verification outcome, plus static resident bytes) and the E part of SC-2.
Output: fixture builder, acceptance checks, reference solutions, batch module, roles module, scorer, tests. No live
call.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
`plugins/aoforge/aoforge/bin/lib/token-usage.cjs` exports `sumUsage(file)` → `{readable, messages, input,
cache_creation, cache_read, output, by_model}` (assistant rows deduped by message id) and `pickModel(byModel)`.
`plugins/aoforge/aoforge/bin/lib/agent-overhead.cjs` exports transcript helpers (`transcriptSpanMinutes` is
module-internal; copy its first-to-last timestamp rule rather than reaching into internals).
`plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs` exports `loadRates` and `rateFor` (prices per million from
`references/model-rates.json`: input, cache_write_5m, cache_write_1h, cache_read, output; Haiku 5.5 has a
higher over-100K tier in its note). Subagent transcripts: `<projects>/<key>/<session>/subagents/agent-<id>.jsonl`
plus `agent-<id>.meta.json` with `agentType` (e.g. `aoforge:planner`).

Both versions accept the workload flags: v3.0.0's build SKILL argument-hint lists `--skip-research`, and its
build.md skips plan mode on `--auto` or `workflow.auto_advance`; quick takes the description from `$ARGUMENTS`
(no `--full`: planner + executor only, as the user specified `/aoforge:quick`). v3.0.0's migrations end at 0014.
</codebase_examples>

<anti_patterns>
- Acceptance checks and reference solutions never enter the fixture copy the session sees.
- Do not let the two versions differ in anything but the plugin tree: same fixture bytes, same prompt, same session
  model, same env, interleaved order.
- Do not price tokens from memory; read model-rates.json through calibration-inputs.cjs.
- No generated test data: transcripts in the tests are hand-built JSONL from `__fixtures__/transcripts.cjs`.
</anti_patterns>

<error_recovery>
- A run whose transcripts are missing or unreadable: its role rows are `unreadable`, the run's CLI-reported totals
  still count, and the report says which.
- Priced transcript cost differs from the run's reported `total_cost_usd` by more than 10%: keep both, flag the run
  (cache-tier pricing or a side model), never overwrite the reported figure.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-07-SUMMARY.md (static-prompt.json shape)
@.aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md (76-08 deferred item)
@plugins/aoforge/aoforge/bin/lib/token-usage.cjs (lines 40-130)
</context>

<gotchas>
- Session model for every E run: `opus` (claude-opus-5-5, the model the user's sessions run). Under `balanced`,
  planner = opus (inherit), executor, verifier, job-checker = sonnet. Put the choice in a `SESSION_MODEL` constant
  with this rationale; the batch-E checkpoint shows it so the user can switch to sonnet before spending. runs()
  honours `EVAL81_E_SESSION_MODEL` (sonnet | opus; anything else throws) so that switch needs no edit to this frozen
  module; the chosen model is in every descriptor and in the report header (add a test to test list 4).
- The fixture's config stamp is 3.0.0 with v3.0.0's `migrations_applied`, so 3.0.0 sees a current project and
  3.1.0's SessionStart upgrade hook migrates it in place (real upgrade behaviour; code only, zero tokens). Record in
  the report that 3.1.0 runs include that hook's commit.
- Workload text is fixed in build.cjs: QUICK_TEXT = "Add a --json flag to `notekit list` that prints the notes as a
  JSON array of {id, text} objects, with a test." Build prompt: `/aoforge:build 1 --skip-research --auto`.
- Order: q31-r1, q30-r1, q30-r2, q31-r2, q31-r3, q30-r3, b31-r1, b30-r1, b30-r2, b31-r2 (ABBA) so cache warmth and
  time of day do not favour one version.
- Env: `AOFORGE_SKIP_AWARENESS_POPULATE=1`, `AOFORGE_SKIP_TRANSCRIPT_EXPORT=1`, `AOFORGE_SKIP_PRUNE=1` for both
  versions; never AOFORGE_SKIP_EDIT_GATE (skills set their own marker; the gates are part of the measured flow).
- Timeouts: quick 30 minutes, build 90 minutes. Caps: `capForWorkflow('quick' | 'build')`.
- A 2-TRD build is the target, not a guarantee; the planner decides. Record the actual TRD count per build run.
</gotchas>

## Fixture specification

`notekit`: Node CommonJS, no deps, `src/cli.js` with `add <text>` and `list`, storage `notes.json` (array of `{id,
text}`), `src/store.js`, tests `test/*.test.js`, `npm test` = `node --test`. Planning: PROJECT.md (`kind: cli`,
`default_work: feature`), REQUIREMENTS.md (TAG-01 tag a note, TAG-02 list by tag), ROADMAP.md with Objective 1 "Tags"
(goal: notes can be tagged and listed by tag; success criteria: `notekit tag <id> <tag>` persists a tag;
`notekit list --tag <tag>` lists only matching notes; tests cover both), OBJECTIVE.md (`work: feature`), STATE.md,
config.json as in the truths, git history of three commits (fixed dates and author as in 81-03).
Acceptance (hidden): quick — `node src/cli.js list --json` on a seeded notes.json prints a JSON array of `{id,
text}` and `node --test` passes; build — `tag 1 work` then `list --tag work` prints only note 1, `node --test`
passes, and the objective's VERIFICATION.md (if present) has `status: passed`.

## Test list

Outermost first.
fixture (proofs.test.cjs)
1. buildFixture is deterministic and contains no acceptance or reference file.
2. This checkout's `validate health` reports no errors on it.
3. checkQuick and checkBuild fail on the base fixture; applying `reference.cjs` quick (or build) solution makes the
   matching check pass with `node --test` green.
batch E
4. `runs()` returns 10 valid descriptors in the ABBA order: kind `workflow`, agent null, plugin `3.0.0` / `3.1.0`,
   model `opus`, prompts exactly `/aoforge:quick <QUICK_TEXT>` and `/aoforge:build 1 --skip-research --auto`, env
   flags as listed, caps from capForWorkflow, timeouts.
5. collect runs the hidden checks in the work dir (HOME = the run's sandbox home) and returns `{acceptance, tests,
   verification_status, trd_count, summaries, git_log_subjects}`.
roles
6. firstTurnInput = input + cache_creation + cache_read of the first deduped assistant message.
7. rolesForRun on a hand-built transcripts dir (one main session, subagents planner, executor x2, verifier) returns
   one row per spawn with role, model, first-turn input, totals, cache writes, priced cost (from a test rates
   object), wall seconds.
8. A subagent meta with `agentType` `aoforge:job-checker` maps to role `job-checker`; an unknown type keeps its
   name; a missing meta gives role `unknown`.
score E
9. score() over a hand-built root with two runs per version produces per version x workflow x role: spawns,
   median/mean first-turn input, total tokens, cache writes, cost, wall; per-run rows with outcomes; 3.1.0 minus
   3.0.0 deltas; and the static bytes per role from a test static-prompt.json.
10. The returned `extra_files['81-MEASUREMENT.md']` has the method, the per-role table, the per-run table, outcomes,
    the static comparison column, flagged runs, and the session model and profile.

<tasks>

<task type="auto">
  <name>Task 1: E fixture, hidden acceptance checks, reference solutions and proofs</name>
  <files>scripts/eval81/fixtures/E/build.cjs, scripts/eval81/fixtures/E/acceptance.cjs, scripts/eval81/fixtures/E/reference.cjs, scripts/eval81/fixtures/E/proofs.test.cjs, scripts/eval81/__fixtures__/transcripts.cjs</files>
  <action>
<!-- TDD-EXCEPTION for the fixture and reference solutions (test infrastructure); acceptance.cjs is logic and is proven by the proofs' fail-on-base / pass-on-reference pairs (test list 1-3). -->
Write the builder per the fixture specification (local deterministic git helper; stamp `aoforge.version: "3.0.0"`
with v3.0.0's migration ids, read once by hand with `git ls-tree --name-only v3.0.0
plugins/aoforge/aoforge/bin/lib/migrations/` and fixed in the builder). Write acceptance.cjs (pure node, spawnSync
with a given env), reference.cjs (`applyQuick(dir)`, `applyBuild(dir)` overlays), proofs per test list 1-3, and
`__fixtures__/transcripts.cjs` (hand-built main and subagent JSONL plus meta.json writers) for Tasks 2-3.
  </action>
  <verify>node --test scripts/eval81/fixtures/E/proofs.test.cjs (TMPDIR under the session scratchpad)</verify>
  <done>Test list 1-3 pass.</done>
  <recovery>If 3.1.0's validate health errors on the 3.0.0 stamp, record the finding (that is the upgrade path) and assert warnings only; if it errors, fix the fixture shape, not the check.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Batch E module and per-role transcript metrics</name>
  <files>scripts/eval81/batches/E.cjs, scripts/eval81/batches/E.test.cjs, scripts/eval81/lib/roles.cjs, scripts/eval81/lib/roles.test.cjs</files>
  <action>
RED first per test list 4-8. `batches/E.cjs` per the gotchas; collect uses acceptance.cjs. `roles.cjs`:
`rolesForRun(runDir, {rates})` walks `<runDir>/transcripts/**` (main `<session>.jsonl` files = orchestrator;
`subagents/agent-*.jsonl` with meta), uses token-usage.cjs `sumUsage`, its own `firstTurnInput(file)` and a
first-to-last timestamp wall time, and prices with `rateFor` (cache writes at the 5-minute rate unless the usage
row carries `ephemeral_1h_input_tokens`, then split).
  </action>
  <verify>node --test scripts/eval81/batches/E.test.cjs scripts/eval81/lib/roles.test.cjs</verify>
  <done>Test list 4-8 pass.</done>
  <recovery>If `rateFor` needs a calibration-shaped object rather than the rates file, build it from `loadRates()` and say so in the module comment.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Scorer E and the 76-08 measurement renderer</name>
  <files>scripts/eval81/score/E.cjs, scripts/eval81/score/E.test.cjs</files>
  <action>
RED first per test list 9-10. `score({root, outDir})` reads all E records and outputs, calls rolesForRun per run,
aggregates, joins `<outDir>/results/static-prompt.json` (from 81-07) by role, and returns the result object plus
`extra_files: {'81-MEASUREMENT.md': renderMeasurement(...)}` (81-02 test 3b writes it). The report states the
method (fixed workload, session model, profile, interleaving, what first-turn input means, that transcript prices
come from model-rates.json and the CLI's reported cost is kept beside them) and n per cell; it makes no tier
recommendation.
Commit the eleven files with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "feat(81-12): test E fixture, workload spec, role metrics and 76-08 renderer" --files <paths>`.
  </action>
  <verify>node --test scripts/eval81/score/E.test.cjs</verify>
  <done>Test list 9-10 pass; `node scripts/eval81/score.cjs --batch E --root <hand-built root> --out <tmp>` writes results/E.json and 81-MEASUREMENT.md.</done>
  <recovery>If static-prompt.json lacks a role present in E (for example the orchestrator), show "n/a (not a spawn)" in that cell.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/</test>
</validation_gates>

<verification>
- `node -e "console.log(require('./scripts/eval81/batches/E.cjs').runs({root:'<tmp>',trees:null,calibration:null}).map(r=>r.id).join(' '))"` prints the 10 ids in ABBA order.
- `rg -n "acceptance|reference" scripts/eval81/fixtures/E/build.cjs` shows no file of either kind written into the fixture.
</verification>

<success_criteria>
Test E is a fixed, version-fair workload with objective outcomes and per-role metrics from transcripts, and its
76-08 report renders from hand-built data before any live run.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-12-SUMMARY.md`
</output>
