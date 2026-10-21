---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "09"
type: standard
wave: 2
depends_on: ["81-01", "81-02", "81-03", "81-04"]
files_modified:
  - scripts/eval81/__fixtures__/agent-outputs.cjs
  - scripts/eval81/batches/A.cjs
  - scripts/eval81/batches/A.test.cjs
  - scripts/eval81/score/A.cjs
  - scripts/eval81/score/A.test.cjs
  - scripts/eval81/batches/B.cjs
  - scripts/eval81/batches/B.test.cjs
  - scripts/eval81/score/B.cjs
  - scripts/eval81/score/B.test.cjs
autonomous: true
requirements: [SC-1, SC-3]
must_haves:
  truths:
    - "batches/A.cjs yields 36 verifier runs (A1..A6 x haiku, sonnet x 3 repeats) as `--agent aoforge:verifier` on the 3.1.0 tree, each prompt being execute-objective.md's verifier spawn text filled for the fixture, with caps from calibration and runs interleaved by repeat and model"
    - "batches/B.cjs yields 36 job-checker runs (B1..B6 x 2 models x 3) whose prompt is plan-objective.md's checker prompt filled with the fixture's goal, TRD paths, the `verify trd-pre` JSON computed from the 3.1.0 tree, requirement IDs and REQUIREMENTS.md"
    - "Neither batch's prompt, fixture copy or run id visible to the model contains an answer-key word or the fixture's planted kind"
    - "score/A.cjs scores each run from the VERIFICATION.md the verifier published (frontmatter status and gaps) against answer-key A: detection, false pass, false fail, abstain, detected-but-unnamed, with exclusions for non-ok runs, model_ran false and contaminated runs"
    - "score/B.cjs scores each checker return against answer-key B: detection, false alarm, missed-as-pass and unrelated blockers, split by precheck_flags"
  artifacts:
    - path: scripts/eval81/batches/A.cjs
      provides: "batch A module (runs, materialize, collect)"
    - path: scripts/eval81/batches/B.cjs
      provides: "batch B module"
    - path: scripts/eval81/score/A.cjs
      provides: "score({root, outDir}) for A"
    - path: scripts/eval81/score/B.cjs
      provides: "score({root, outDir}) for B"
  key_links:
    - from: scripts/eval81/batches/A.cjs
      to: plugins/aoforge/aoforge/workflows/execute-objective.md
      via: "the verifier spawn prompt text, asserted equal by a test"
      pattern: "Verify objective"
    - from: scripts/eval81/batches/B.cjs
      to: plugins/aoforge/aoforge/workflows/plan-objective.md
      via: "the checker prompt template, asserted equal by a test"
      pattern: "verification_context"
    - from: scripts/eval81/score/A.cjs
      to: scripts/eval81/fixtures/A/answer-key.json
      via: "must_mention / any_of match rule"
      pattern: "answer-key.json"
---

# TRD 81-09: Batch specs and scorers for A (verifier) and B (job-checker)

<objective>
Turn the A and B fixtures into runnable batches and scorable results: the batch modules that list the 36 + 36 runs
with production spawn prompts, materialise fixture copies and collect outputs, and the scorers that apply the
pre-registered rule's metrics to those outputs.

Purpose: SC-1 (the harness records each run's verdict/output) and SC-3 (results scored against the keys with n and
intervals; intervals come from 81-02's stats when the report renders).
Output: two batch modules, two scorers, a builder of canned agent outputs, tests. No live call.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Verifier spawn prompt (`plugins/aoforge/aoforge/workflows/execute-objective.md` ~lines 1250-1260), used verbatim with
placeholders filled (objective number `1`, objective dir `.aoforge/objectives/01-<slug>`, goal and requirement IDs
from the fixture's ROADMAP):
```
Verify objective {objective_number} goal achievement.
Objective directory: {objective_dir}
Objective goal: {goal from ROADMAP.md}
Objective requirement IDs: {objective_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from TRD/JOB frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.
Draft VERIFICATION.md from `planning draft` and publish it with `node ~/.claude/aoforge/bin/aof-tools.cjs verification post {objective_number} --from <draft path>`.
The VERIFICATION frontmatter must carry `status: passed|gaps_found|human_needed` (optional `score:`); `verification post` reads it.
```
In local mode `verification post 1` writes `.aoforge/objectives/01-<slug>/01-VERIFICATION.md` in the fixture copy;
verifier frontmatter carries `status:` and, for gaps_found, `gaps: [{truth, status, reason, artifacts, missing}]`
(`plugins/aoforge/agents/verifier.md` ~lines 495-550).

Checker prompt (`plan-objective.md` ~lines 640-660): the `<verification_context>` block with Objective, Objective
Goal, Plans to verify (paths from `ls <objective_dir>/*-TRD.md`), Mechanical pre-check (verify trd-pre) JSON,
requirement IDs, Requirements content, and the context/preferences lines; then `<expected_output>` with the two
return headings. With no CONTEXT.md, the preferences slot reads "No CONTEXT.md: no locked decisions."

Checker return (`plugins/aoforge/agents/job-checker.md` ~lines 586-662): `## VERIFICATION PASSED` or `## ISSUES
FOUND`, sections `### Blockers (must fix)` and `### Warnings (should fix)` with `**N. [dimension] description**`,
`- Plan:`, `- Fix:`, and a `### Structured Issues` YAML list.

Batch module interface and RunDescriptor: see 81-08's README and 81-01's contract.cjs.
</codebase_examples>

<anti_patterns>
- Prompts carry no fixture id, no answer-key field, no planted kind: run ids (which include the fixture id) are
  harness-side only and never placed in the prompt or the work dir.
- Do not paraphrase the production prompts: a test extracts each template from the workflow file in this checkout
  and asserts the batch's text equals it after filling.
- Scorers never call a model. "Gap named" and "defect matched" are the token rules from the answer keys and
  81-DECISION-RULE.md, applied case-insensitively; the orchestrator spot-checks a sample in the live TRDs.
- No generated test data: agent outputs in the tests are hand-written in `__fixtures__/agent-outputs.cjs`.
</anti_patterns>

<error_recovery>
- VERIFICATION.md absent after a run (the verifier drafted but never published): collect falls back to the newest
  draft under the run's TMPDIR `aoforge-drafts/**/01-VERIFICATION.md`, and marks `published: false`; the scorer
  scores it and reports the count of unpublished verdicts.
- No return heading in a checker result: verdict `none`; scored as abstain (never a pass, never a detection).
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-01-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-03-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-04-SUMMARY.md
@scripts/eval81/fixtures/A/answer-key.json
@scripts/eval81/fixtures/B/answer-key.json
</context>

<gotchas>
- B's pre-check JSON must come from the 3.1.0 tree being tested. `runs()` builds each B fixture once into
  `R/cache/B/<id>/` and runs `node <trees 3.1.0>/plugins/aoforge/aoforge/bin/aof-tools.cjs verify trd-pre 2 --raw`
  there (HOME = a cache fake home); when `trees` is not yet created (unit tests), it uses this checkout's aof-tools
  and the test says so. Cache by fixture id so repeats get identical prompts.
- Order: for r in 1..3, for fixture in key order, models alternate starting haiku on odd fixtures and sonnet on even
  ones, so neither model systematically runs on a warmer prompt cache.
- Env per run: `AOFORGE_SKIP_EDIT_GATE=1`, `AOFORGE_SKIP_AWARENESS_POPULATE=1`, `AOFORGE_SKIP_TRANSCRIPT_EXPORT=1`,
  `AOFORGE_SKIP_PRUNE=1`. Timeout 15 minutes. Caps `capFor({role: 'verifier' | 'job-checker', model, batch})`.
- The verifier runs `memory: project`; a fresh fixture copy per run keeps one repeat's memory out of the next.
- Exclusions are reported, never silently dropped: `excluded: [{id, reason: 'status:<s>' | 'model_ran:false' |
  'contaminated'}]`.
</gotchas>

## Test list

Outermost first.
batch A
1. `runs()` returns 36 valid descriptors (81-01 validateDescriptor), unique ids `A-<fx>-<model>-r<n>`, kind `agent`,
   agent `aoforge:verifier`, plugin `3.1.0`, the interleaved order, caps with bases from a calibration builder.
2. Each prompt equals the execute-objective.md template (extracted from this checkout's workflow file in the test)
   filled with the fixture's objective dir, goal and requirement IDs; no prompt contains a key word (`stub`,
   `planted`, `unwired`, `missing_file`, `answer`, a fixture id).
3. materialize builds the fixture into the work dir; collect returns `{verification_md, published, result_text,
   contaminated}` from a work dir holding a hand-written VERIFICATION.md, and falls back to a draft.
score A
4. Planted run whose VERIFICATION says `gaps_found` with a gap naming `src/slugify.js` "returns a hard-coded
   value" -> `detected`; `gaps_found` with an unrelated gap -> `detected_unnamed`; `passed` -> `false_pass`;
   `human_needed` -> `abstain`.
5. Clean run `passed` -> `correct_pass`; `gaps_found` -> `false_fail`.
6. A record with status `cap_hit`, `model_ran: false`, or contaminated -> excluded with its reason, not in n.
7. score() over a hand-built root of 6 runs writes the batch result object of 81-02's contract with exact k/n per
   model, plus mean cost, wall time and first-turn input.
batch B
8. `runs()` returns 36 valid descriptors with agent `aoforge:job-checker`; the pre-check JSON in each prompt equals
   the cached `verify trd-pre 2 --raw` output for that fixture; repeats of a fixture have identical prompts.
9. Each prompt equals plan-objective.md's checker template filled; no key words.
score B
10. B3 return with a blocker naming `src/cli.js` and "same wave" -> `detected`; with only a warning that matches ->
    `detected`; with only an unrelated blocker -> `missed` plus `unrelated_blockers: 1`; `## VERIFICATION PASSED` ->
    `missed_as_pass`.
11. Clean return with one blocker -> `false_alarm`; with warnings only -> `correct_pass`.
12. B6 (empty must_mention) matches on any one any_of phrase.
13. score() splits detection into `precheck_flagged` and `judgment_only` per model.

<tasks>

<task type="auto">
  <name>Task 1: Canned agent outputs (fixture builder)</name>
  <files>scripts/eval81/__fixtures__/agent-outputs.cjs</files>
  <action>
Hand-write builders: `verificationMd({status, gaps: [{truth, reason, artifacts, missing}], body})` producing the
verifier's frontmatter + body shape; canned `vPassed()`, `vGapsSlugify()`, `vGapsUnrelated()`, `vHumanNeeded()`;
`checkerReturn({verdict, blockers: [{dimension, description, plan}], warnings: [...]})` producing the job-checker
return shape including the Structured Issues YAML; canned `cPassed()`, `cOverlapBlocker()`, `cOverlapWarningOnly()`,
`cUnrelatedBlocker()`, `cScMissing()`; and `runDir(root, batch, id, {record, outputs, stream})` writing a run dir the
way the runner does (record.json, outputs/, stream.jsonl).
  </action>
  <verify>node -e "const o=require('./scripts/eval81/__fixtures__/agent-outputs.cjs');console.log(o.vGapsSlugify().split('\n')[1])" prints the status line</verify>
  <done>Every canned output named above exists and parses with the shapes the scorers expect.</done>
  <recovery>If the verifier's real frontmatter shape differs from verifier.md's template, follow verifier.md and note it.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Batch A module and scorer</name>
  <files>scripts/eval81/batches/A.cjs, scripts/eval81/batches/A.test.cjs, scripts/eval81/score/A.cjs, scripts/eval81/score/A.test.cjs</files>
  <action>
RED first per test list 1-7. `batches/A.cjs` exports `{batch: 'A', runs, materialize, collect}` per the interface;
the prompt template is a constant in the module, and the test extracts the same template from
`plugins/aoforge/aoforge/workflows/execute-objective.md` (between `Task(\n  prompt="Verify objective` and the closing
`",`) to assert equality. `score/A.cjs` exports `score({root, outDir})` reading `R/runs/A/*/record.json` and
`outputs/`, the answer key, and returning the 81-02 batch result object (roles.verifier with metrics detection,
false_pass, false_fail, abstain, detected_unnamed; runs[]; excluded[]; notes including the unpublished count and the
evidence_flags split).
  </action>
  <verify>node --test scripts/eval81/batches/A.test.cjs scripts/eval81/score/A.test.cjs</verify>
  <done>Test list 1-7 pass.</done>
  <recovery>If the template extraction is brittle, anchor it on the two literal lines "Verify objective {objective_number} goal achievement." and "`verification post` reads it." and take the text between them inclusive.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Batch B module and scorer</name>
  <files>scripts/eval81/batches/B.cjs, scripts/eval81/batches/B.test.cjs, scripts/eval81/score/B.cjs, scripts/eval81/score/B.test.cjs</files>
  <action>
RED first per test list 8-13. `batches/B.cjs` exports the module; `runs()` builds and caches each fixture's
pre-check as described in the gotchas. `collect` returns `{result_text}` (the checker writes no file).
`score/B.cjs` parses the return: verdict heading; issues from the Blockers and Warnings sections and the YAML list
(dedupe by description); match rule from the key; outputs the batch result object (roles.job-checker: detection,
false_alarm, missed_as_pass, unrelated_blockers; detection split by precheck_flags).
Commit the TRD's files with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "feat(81-09): batch specs and scorers for tests A and B" --files <the nine paths>`.
  </action>
  <verify>node --test scripts/eval81/batches/B.test.cjs scripts/eval81/score/B.test.cjs</verify>
  <done>Test list 8-13 pass; `node scripts/eval81/score.cjs --batch B --root <hand-built root> --out <tmp>` writes results/B.json.</done>
  <recovery>If the YAML issues block is malformed in a real return, fall back to the Markdown sections; test both.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/</test>
</validation_gates>

<verification>
- `node -e "const a=require('./scripts/eval81/batches/A.cjs');console.log(a.runs({root: '<tmp>', trees: null, calibration: null}).length)"` prints 36; the same for B prints 36.
- The runner's dry run over these modules is exercised in TRD 81-13 (81-08 runs in the same wave as this TRD).
</verification>

<success_criteria>
Batches A and B are runnable by the 81-08 runner with production prompts and scorable by the score CLI with the
pre-registered metrics, all proven on hand-written outputs before any live run.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-09-SUMMARY.md`
</output>
