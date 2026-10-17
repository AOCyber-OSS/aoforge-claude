---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "11"
type: standard
wave: 2
depends_on: ["81-01", "81-02", "81-06"]
files_modified:
  - scripts/eval81/__fixtures__/c-outputs.cjs
  - scripts/eval81/batches/C.cjs
  - scripts/eval81/batches/C.test.cjs
  - scripts/eval81/score/C.cjs
  - scripts/eval81/score/C.test.cjs
autonomous: true
requirements: [SC-1, SC-3]
must_haves:
  truths:
    - "batches/C.cjs yields 32 mapper runs (synthetic and fleet copy x tech, arch, quality, concerns x haiku, sonnet x 2) as `--agent aoforge:codebase-mapper` with map-codebase.md's per-focus prompt, and 16 researcher runs (stack, features, architecture, pitfalls x 2 models x 2) as `--agent aoforge:project-researcher` with new-project.md's per-dimension prompt filled for the fixed topic"
    - "Grader runs (fixed Sonnet, no tools, the committed grader prompt and schema, blind to the producing model) are listed only for agent runs whose outputs have been collected, so a second invocation of batch C grades what the first produced"
    - "The fleet copy is prepared once per eval root from the read-only source at the committed commit (clone with --no-optional-locks, origin removed, .planning/ and .claude/ removed, minimal .aoforge/ added) and copied per run; the private checklist is used only after its sha256 matches the committed commitment"
    - "score/C.cjs reports per role (codebase-mapper:<focus>, project-researcher:<dimension>) and model: checklist recall, error rate, missing, fabrications per run (grader plus a mechanical check of backticked repo paths against the codebase), with a per-codebase split"
    - "A seeded spot-check sample of grader verdicts is written to the eval root (never to a committed file) for the orchestrator to check by hand"
  artifacts:
    - path: scripts/eval81/batches/C.cjs
      provides: "batch C module (mapper, researcher and grader runs)"
    - path: scripts/eval81/score/C.cjs
      provides: "score({root, outDir}) for C, spotCheckSample"
  key_links:
    - from: scripts/eval81/batches/C.cjs
      to: scripts/eval81/fixtures/C/fleet-commitment.json
      via: "sha256 check of private/fleet-checklists.json before use"
      pattern: "fleet-commitment"
    - from: scripts/eval81/batches/C.cjs
      to: plugins/aoforge/aoforge/workflows/map-codebase.md
      via: "per-focus prompt text, asserted equal by a test"
      pattern: "Focus: "
---

# TRD 81-11: Batch spec, grader and scorer for C (codebase-mapper, project-researcher)

<objective>
Make test C runnable and scorable: the mapper runs on two codebases and four foci, the researcher runs on four
dimensions of one topic, the blind Sonnet grader runs that apply the committed checklists, and the scorer that
turns grades into recall, errors and fabrications per role.

Purpose: SC-1/SC-3 for test C (checklist recall/errors/fabrications). C runs last (order A, B, D, E, C).
Output: batch module, scorer, canned outputs, tests. No live call.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Mapper prompts (`plugins/aoforge/aoforge/workflows/map-codebase.md`, spawn_agents step): one fenced `Prompt:` block per
focus, beginning `Focus: tech` / `Focus: arch` / `Focus: quality` / `Focus: concerns`, telling the agent to write its
documents to drafts printed by `node ~/.claude/aoforge/bin/aof-tools.cjs planning draft codebase/<NAME>.md` and
return confirmation only. Drafts land under the session's `$TMPDIR/aoforge-drafts/<repo-key>/codebase/<NAME>.md`.

Researcher prompts (`plugins/aoforge/aoforge/workflows/new-project.md` ~lines 586-760): one `Task(prompt="..."` per
dimension with `<research_type>`, `<milestone_context>` (greenfield), `<question>`, `<project_context>`,
`<downstream_consumer>`, `<quality_gate>`, `<output>` (draft `research/<DIM>.md`, publish with `doc put`, template
`~/.claude/aoforge/templates/research-project/<DIM>.md`). Fill `[domain]` and `[PROJECT.md summary ...]` from
`scripts/eval81/fixtures/C/researcher-topic.md`; keep everything else verbatim. Published output is
`.aoforge/research/<DIM>.md` in the work dir (local mode).

Fixtures from TRD 81-06: `synthetic.cjs` (`buildSynthetic`), `checklists-synthetic.json`, `fleet-commitment.json`,
`researcher-topic.md`, `checklists-researcher.json`, `grader-prompt.md` (`{{TASK}}`, `{{CHECKLIST}}`,
`{{DOCUMENT}}`), `grader-schema.json`; private `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/
private/fleet-checklists.json` (`source_path`, `source_commit`, `prepared`, checklists).
</codebase_examples>

<anti_patterns>
- Never write to the fleet source or run a locking git command in it; one `git --no-optional-locks clone
  --no-hardlinks` into `R/cache/C/fleet-src`, then `git -C <clone> checkout --detach <source_commit>`; per run copy
  the prepared tree with fs.cpSync. Expose the source path through `needsWatchedRepos()` so the runner's tripwire
  watches it.
- No private fleet content in any committed file: score/C.cjs results carry item ids, counts and rates only; the
  spot-check sample with quotes goes to `R/spotcheck/C.md`.
- The grader prompt must not name the model or the run id; it receives only the task line, the checklist and the
  document.
- No generated test data: canned mapper docs, researcher docs and grader outputs are hand-written.
</anti_patterns>

<error_recovery>
- Private checklist missing or its sha256 differs from the commitment: runs() throws "fleet checklist missing or
  changed since it was committed", which stops the batch before any spend (fleet runs cannot be scored without it).
- A mapper run that published to `.aoforge/codebase/` instead of drafts: collect reads either location (drafts
  first), and records which.
- A grader returns no structured output: one retry is NOT automatic; the item verdicts for that run are
  `ungraded` and the run is excluded from recall with the reason.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md (C metrics)
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-06-SUMMARY.md
@plugins/aoforge/aoforge/workflows/map-codebase.md (spawn_agents)
@plugins/aoforge/aoforge/workflows/new-project.md (~lines 586-760)
</context>

<gotchas>
- Two invocations: the first `run.cjs --batch C` runs the 48 agent runs (runs() lists graders only for collected
  outputs, of which there are none yet); the second lists the 48 grader runs (81-08 test 4b: a complete batch with
  new pending runs re-opens). Grader ids `C-grade-<agent run id>`; grader model `sonnet` fixed, tools `[]` (built as
  `--tools ""`), jsonSchema from grader-schema.json, cap `capFor({role: 'grader', model: 'sonnet', batch: 'C'})`,
  timeout 5 minutes. A grader's prompt embeds the collected document text, read at runs() time.
- Mapper env: `AOFORGE_SKIP_EDIT_GATE=1` and the three other skip flags; researcher the same. Mapper timeout 20
  minutes, researcher 25 minutes (web research). Caps `capFor({role: 'codebase-mapper' | 'project-researcher',
  model, batch: 'C'})` (fallback p90s from 81-01 since calibration has no samples for them).
- The synthetic and fleet copies each get the same minimal `.aoforge/` (3.1.0 config stamp; PROJECT.md `kind:
  api`); the researcher's greenfield project gets `.aoforge/{config.json, PROJECT.md}` built from the topic file.
- Order: researcher runs after mapper runs; within each, interleave models and repeats as in A.
- The ROADMAP names objective-researcher for C; the four dimensions belong to project-researcher (objective-researcher
  has no dimensions). The batch uses project-researcher and says so in its header comment; switching the agent name
  is a one-line change if the user redirects at the batch-C checkpoint.
</gotchas>

## Test list

Outermost first.
batch C
1. With no outputs collected, `runs()` returns 48 valid agent descriptors (32 mapper, 16 researcher) with unique ids,
   agents `aoforge:codebase-mapper` / `aoforge:project-researcher`, plugin `3.1.0`, caps and bases, mapper before
   researcher.
2. With hand-written outputs present for 3 agent runs, `runs()` also returns exactly 3 grader descriptors whose
   prompt is grader-prompt.md filled with the task line, the right checklist JSON and the document, and contains no
   model name or run id.
3. Each mapper prompt equals map-codebase.md's fenced block for its focus (extracted in the test); each researcher
   prompt equals new-project.md's dimension template with `[domain]` and the project summary filled from the topic
   file and nothing else changed.
4. With a temp private file whose sha256 differs from a temp commitment, runs() throws the "changed since" error;
   with matching hashes it proceeds; with no private file, fleet runs are omitted and a note says why only if an
   explicit `allowMissingFleet` option is set (default: throw). The runner cannot pass options, so runs() also
   reads `EVAL81_C_SKIP_FLEET=1` from its own process env as `allowMissingFleet` plus "omit fleet runs" (a recorded
   reduction the user can choose at the batch-C checkpoint); the score result notes it.
5. materialize: synthetic -> buildSynthetic into work; fleet -> a copy of the prepared clone (from a temp source repo
   in the test) with `.planning/` and `.claude/` absent and `.aoforge/` present; researcher -> greenfield project.
6. collect: mapper drafts found under the run tmp `aoforge-drafts/**/codebase/*.md` and concatenated per focus in a
   fixed doc order; researcher `.aoforge/research/<DIM>.md`; grader structured_output.
score C
7. A grader output with 7 found, 2 wrong, 1 missing of 10 items and 1 fabrication -> recall 0.7, error 0.2,
   fabrications 1 for that run.
8. The mechanical check counts a backticked `internal/missing/x.go` that does not exist in the synthetic build as a
   fabrication and ignores `go.mod` (exists) and plain words.
9. Aggregation per role over runs and both codebases: k/n of items with Wilson-ready counts; per-codebase split;
   fabrications per run mean; ungraded runs excluded with reason.
10. spotCheckSample(seed 81, k 6) picks the same 6 (run, item) pairs every time and writes them to the eval root,
    never under `--out`.

<tasks>

<task type="auto">
  <name>Task 1: Canned C outputs (fixture builder)</name>
  <files>scripts/eval81/__fixtures__/c-outputs.cjs</files>
  <action>
Hand-write a short STACK.md + INTEGRATIONS.md pair for the synthetic codebase (some items right, one wrong, one
backticked nonexistent path), a PITFALLS.md for the topic, grader outputs `{items: [{id, verdict, evidence}],
fabrications: [{claim, why}]}` matching them, and `cRoot(root, plan)` writing C run dirs (agent runs with drafts in
`tmp/aoforge-drafts/...`, grader runs with structured_output) as the runner would.
  </action>
  <verify>node -e "require('./scripts/eval81/__fixtures__/c-outputs.cjs')" exits 0</verify>
  <done>Builders cover every case in the test list.</done>
  <recovery>Keep canned docs short (under 40 lines each); they test parsing, not quality.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Batch C module (mapper, researcher, grader)</name>
  <files>scripts/eval81/batches/C.cjs, scripts/eval81/batches/C.test.cjs</files>
  <action>
RED first per test list 1-6. Export `{batch: 'C', runs, materialize, collect, needsWatchedRepos, prepareFleet}`.
`runs({root, trees, calibration, repo, allowMissingFleet})`: verify the private checklist hash against
fleet-commitment.json (sha256 of the file bytes), build agent descriptors, then scan `R/runs/C/*/record.json` with
status `ok` and non-empty collected outputs and add a grader descriptor for each. `prepareFleet(root, privateInfo)`
clones once into `R/cache/C/fleet-src` and prepares `R/cache/C/fleet-prepared` (idempotent).
  </action>
  <verify>node --test scripts/eval81/batches/C.test.cjs</verify>
  <done>Test list 1-6 pass; tests never touch /Users/justin/dev (temp source repos only).</done>
  <recovery>If the map-codebase prompt extraction is ambiguous, anchor on the fenced block that starts with the `Focus: <name>` line and ends at the closing fence.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Scorer C and spot-check sampler</name>
  <files>scripts/eval81/score/C.cjs, scripts/eval81/score/C.test.cjs</files>
  <action>
RED first per test list 7-10. `score({root, outDir})` joins each agent run with its grader run, applies the
mechanical path check (paths in backticks containing `/` or ending in a known source/manifest extension, checked
against the run's work copy), aggregates per role and model, and returns the 81-02 batch result object (roles
`codebase-mapper:<focus>` and `project-researcher:<dimension>`, metrics recall, error, missing, fabrications
{total, runs}). `spotCheckSample({root, seed, k})` writes `R/spotcheck/C.md`.
Commit with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "feat(81-11): batch spec, grader and scorer for test C" --files <the five paths>`.
  </action>
  <verify>node --test scripts/eval81/score/C.test.cjs</verify>
  <done>Test list 7-10 pass; results written under `--out` contain no checklist statement text for fleet items (test asserts).</done>
  <recovery>If grader item ids do not match checklist ids, treat unknown ids as ungraded and report them; never guess a mapping.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/</test>
</validation_gates>

<verification>
- `node -e "..."` calling `require('./scripts/eval81/batches/C.cjs').runs({root: '<tmp>', trees: null, calibration: null, repo: process.cwd()})` on this checkout (private file present from 81-06) lists 48 runs.
- `git status --porcelain` shows only the five committed paths changed by this TRD.
</verification>

<success_criteria>
Test C's 48 agent runs and 48 grader runs are listable and scorable with the committed checklists and the blind
grader, with the private fleet checklist hash-checked and kept out of committed results.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-11-SUMMARY.md`
</output>
