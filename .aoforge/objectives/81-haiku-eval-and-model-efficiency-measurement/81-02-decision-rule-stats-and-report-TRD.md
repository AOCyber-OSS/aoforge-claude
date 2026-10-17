---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "02"
type: standard
wave: 1
depends_on: []
files_modified:
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md
  - scripts/eval81/__fixtures__/metrics.cjs
  - scripts/eval81/lib/stats.cjs
  - scripts/eval81/lib/stats.test.cjs
  - scripts/eval81/lib/decide.cjs
  - scripts/eval81/lib/decide.test.cjs
  - scripts/eval81/lib/report.cjs
  - scripts/eval81/lib/report.test.cjs
  - scripts/eval81/score.cjs
  - scripts/eval81/score.test.cjs
autonomous: true
requirements: [SC-3, SC-5]
must_haves:
  truths:
    - "81-DECISION-RULE.md quotes the user's rule verbatim, defines every metric (false pass, false fail, detection, false alarm, gap named, per-state accuracy, split rate, checklist recall, errors, fabrications), the outcome categories REFUSE / WEAK_ENDORSE / INSUFFICIENT (never a strong endorsement), the proposal mapping, and lists each interpretive choice; it is committed before any live run"
    - "wilson(k, n) returns the 95% Wilson score interval (z = 1.96) and handles n = 0 and k = 0 / k = n"
    - "decide() applies the rule per role: a Haiku false pass in A refuses Haiku for every role; otherwise a role's Haiku primary metric must be >= Sonnet's minus 10 points; fewer than 2/3 of planned runs scored for either model, or Sonnet's own primary metric below 0.5, gives INSUFFICIENT"
    - "decide() turns outcomes into proposals against the current tiers (model-profiles.json and the flutter pack's ui-evaluator models) and never writes either file"
    - "`node scripts/eval81/score.cjs --batch X` loads `scripts/eval81/score/X.cjs` dynamically and writes `results/X.json` and `results/X.md`; `--report` renders the 76-06 report from the A-D results"
  artifacts:
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md
      provides: "pre-registered decision rule and metric definitions"
    - path: scripts/eval81/lib/stats.cjs
      provides: "wilson, rate, pointsDiff"
    - path: scripts/eval81/lib/decide.cjs
      provides: "decide, OUTCOMES, ROLE_PRIMARY, proposalsFor"
    - path: scripts/eval81/lib/report.cjs
      provides: "renderEvalReport (76-06), renderBatchTable"
    - path: scripts/eval81/score.cjs
      provides: "score CLI: --batch A|B|C|D|E, --report"
  key_links:
    - from: scripts/eval81/score.cjs
      to: "scripts/eval81/score/<batch>.cjs (created by 81-09..81-12)"
      via: "dynamic require by batch id"
      pattern: "'score'"
    - from: scripts/eval81/lib/decide.cjs
      to: plugins/aoforge/aoforge/references/model-profiles.json
      via: "current tiers for proposals (read only)"
      pattern: "model-profiles.json"
---

# TRD 81-02: Pre-registered decision rule, statistics, scoring CLI and the 76-06 report renderer

<objective>
Pre-register how the eval will be judged before any fixture is run: write the decision rule and metric definitions,
then implement them as tested code (Wilson intervals, the per-role decision, proposals against the current tiers),
plus the scoring CLI that the batch scorers plug into and the renderer for the 76-06 report.

Purpose: SC-5 requires a recommendation per role that follows a rule fixed in advance, and SC-3 requires results
per role with n and intervals. Writing the rule as code now means the final TRD only runs it.
Output: `81-DECISION-RULE.md` (committed in this TRD) and five tested modules. No live call.
</objective>

<file_tree>
.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/
└── 81-DECISION-RULE.md          ← CREATE
scripts/eval81/
├── __fixtures__/metrics.cjs     ← CREATE (hand-built batch result objects)
├── lib/stats.cjs  (+ .test.cjs) ← CREATE
├── lib/decide.cjs (+ .test.cjs) ← CREATE
├── lib/report.cjs (+ .test.cjs) ← CREATE
└── score.cjs      (+ .test.cjs) ← CREATE
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Current tiers the proposals compare against (read at run time, never hard-coded):
- `plugins/aoforge/aoforge/references/model-profiles.json` `agents`: verifier and job-checker sonnet on every
  profile (`verdict_floor: {tier: sonnet, agents: [verifier, job-checker]}`); codebase-mapper quality sonnet,
  balanced haiku, budget haiku, with `focus.codebase-mapper.concerns` sonnet/sonnet/haiku; project-researcher
  opus/sonnet/haiku with `focus.project-researcher.{pitfalls,architecture}` opus/sonnet/sonnet; objective-researcher
  opus/sonnet/haiku.
- `plugins/aoforge-stack-flutter/aoforge-stack.json` `models.ui-evaluator`: quality opus, balanced sonnet, budget
  sonnet (this is the UI judge's starting tier, MEF-06).

Batch result object (the contract between the batch scorers 81-09..81-12 and this TRD; build `metrics.cjs` from
it):

```
{ batch: 'A', scored_at, planned: {haiku: 18, sonnet: 18},
  roles: { verifier: { primary: 'detection', models: {
      haiku:  { n_scored, metrics: { detection: {k, n}, false_pass: {k, n}, false_fail: {k, n}, abstain: {k, n} },
                cost_usd, mean_wall_ms },
      sonnet: { ... } } } },
  runs: [ { id, model, fixture, verdict, outcome, contaminated } ],
  excluded: [ { id, reason } ], notes: [] }
```
Role keys: A `verifier`; B `job-checker`; D `ui-evaluator`; C `codebase-mapper:<focus>` for focus in tech, arch,
quality, concerns, and `project-researcher:<dimension>` for stack, features, architecture, pitfalls.
Primary metric per role: verifier `detection`; job-checker `detection`; ui-evaluator `accuracy`; C roles `recall`.
Gate metric: A's `false_pass` for Haiku (global).
</codebase_examples>

<anti_patterns>
- Do not change the rule after a live run. If a later TRD finds the rule ambiguous, it records the ambiguity in
  the report and applies the text as written; amendments are the user's call and are labelled post-hoc.
- No strong endorsement category: these n cannot support one (user: "small n can refuse but only weakly endorse").
- decide() and report.cjs never write model-profiles.json or aoforge-stack.json; proposals are text.
- No generated test data; metrics fixtures are hand-built literals with hand-computable rates.
</anti_patterns>

<error_recovery>
- `score.cjs --batch X` with no `score/X.cjs` yet: exit 1 with "scorer for batch X not installed (TRD 81-09..81-12)".
- `--report` with a batch's results missing: render that role as INSUFFICIENT with the reason "batch X not run".
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@.aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md (deferred items)
@plugins/aoforge/aoforge/references/model-profiles.json
@plugins/aoforge-stack-flutter/aoforge-stack.json

User decision rule (2026-10-17), to be quoted verbatim in the doc:
"Haiku for a role only with zero false passes in A and within ~10 points of Sonnet's detection in A/B/D; small n
can refuse but only weakly endorse; any tier change is a proposal to the user, never applied in this objective."
</context>

<gotchas>
- "Within ~10 points" is operationalised as `haiku_rate >= sonnet_rate - 0.10` on point estimates; intervals are
  reported beside it, not used as the test (at n = 9-20 the intervals always overlap; using them would make the
  rule unable to refuse).
- The A gate is applied literally: one Haiku false pass in A refuses Haiku for EVERY role, C roles included. This
  is the conservative reading of "for a role only with zero false passes in A". The doc lists it as interpretive
  choice 1 so the user can amend it at the batch-A checkpoint, before any spend.
- The user's rule names A/B/D. C (mapper, researcher) is pre-registered here with the same 10-point margin on
  checklist recall plus a fabrication bound; the doc labels this an extension (interpretive choice 2).
- E (76-08) is a measurement, not a tier decision: decide() ignores it.
</gotchas>

## Test list

Outermost first.

score CLI
1. `node scripts/eval81/score.cjs --batch Z` exits 1 naming the valid batches; `--batch A` with no scorer
   installed exits 1 with the 81-09 hint.
2. With a stub scorer installed in a temp copy (the test passes `--scorer-dir <tmp>`), `--batch A --root <R>
   --out <tmp>` writes `results/A.json` (deep-equal to the stub's output plus `scored_at`) and `results/A.md`.
3. `--report --out <tmp>` with A, B, D results and no C renders `81-HAIKU-EVAL.md` whose C roles read
   INSUFFICIENT "batch C not run".
3b. A scorer may return `extra_files: {"<relative path>": "<text>"}` (batch E returns `81-MEASUREMENT.md`); the CLI
   writes each under `--out`, refuses an absolute path or one containing `..`, and strips `extra_files` from the
   saved JSON.

decide
4. Haiku 0/9 false passes, detection haiku 8/9 vs sonnet 9/9 (-11 points) -> verifier REFUSE, reason names the
   margin; 9/9 vs 9/9 -> WEAK_ENDORSE.
5. Haiku 1/9 false pass in A -> every role REFUSE with reason "A false pass", even where its own metric passes.
6. Haiku scored 10 of 18 planned (< 2/3) -> INSUFFICIENT; Sonnet detection 4/9 (< 0.5) -> INSUFFICIENT
   "comparison not informative".
7. C role: recall haiku 0.70 vs sonnet 0.78 and fabrications/run 1.0 vs 0.8 -> WEAK_ENDORSE; fabrications 1.5 vs
   0.8 (> +0.5) -> REFUSE.
8. Contaminated runs (listed in `excluded`) are not in n and are named in the reasons.
9. Proposals: codebase-mapper:tech REFUSE while balanced and budget are haiku -> proposal "raise
   codebase-mapper balanced, budget to sonnet"; ui-evaluator WEAK_ENDORSE while every profile starts sonnet ->
   proposal "start ui-evaluator at haiku on budget/balanced, escalate on split votes (split rate X)";
   verifier WEAK_ENDORSE -> no lowering proposal, note "verdict_floor keeps sonnet; evidence weakly supports
   haiku"; INSUFFICIENT -> no proposal.

stats
10. wilson(9, 9) upper 1.0 and lower ~0.701; wilson(0, 9) lower 0; wilson(0, 0) -> {low: 0, high: 1, n: 0};
    wilson(5, 10) symmetric around 0.5.
11. pointsDiff(0.78, 0.70) = -0.08 (haiku minus sonnet), rounded to 1e-9.

report
12. renderEvalReport lists, per role, model, n scored / planned, each metric as `k/n (rate%, 95% CI lo-hi%)`,
    the outcome with reasons, and the proposals section; it states that no tier was changed.

<tasks>

<task type="auto">
  <name>Task 1: Write and commit the pre-registered decision rule, plus metrics fixture builders</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md, scripts/eval81/__fixtures__/metrics.cjs</files>
  <action>
Write `81-DECISION-RULE.md` directly (local planning mode, as 79-REVALIDATION.md was; `doc put` refuses paths
without a wiki page). Sections:
1. **Status:** pre-registered, commit SHA filled by `aof-tools commit`; "changing this file after the first live
   run invalidates the pre-registration; amendments are recorded as post-hoc".
2. **The rule** (user text verbatim, quoted above).
3. **Metrics**, per batch:
   - A (verifier; 9 clean + 9 planted runs per model): verdict = VERIFICATION.md frontmatter `status`.
     false_pass = planted runs with `passed` / planted scored; detection = planted runs with `gaps_found` AND the
     gap named / planted scored; false_fail = clean runs with `gaps_found` / clean scored; abstain = `human_needed`
     or no verdict (never a pass, never a detection). Gap named: one gap entry or the gaps section contains every
     `must_mention` token of the answer key and at least one `any_of` token (case-insensitive).
   - B (job-checker; 6 clean + 12 planted runs per model): detection = planted runs returning ISSUES FOUND with
     an issue (blocker or warning) whose text contains every `must_mention` token and one `any_of` token;
     false_alarm = clean runs with at least one blocker / clean scored; missed_as_pass = planted runs returning
     VERIFICATION PASSED (reported). Reported separately for defects `verify trd-pre` flags (`precheck_flags:
     true`) and judgment-only defects.
   - D (UI judge; ~20 labelled states x 3 samples per model): per state the engine's `aggregateVotes` over the 3
     samples; accuracy = states whose majority `is_broken` equals the label / states; broken_missed = broken
     states with majority ok / broken states; split_rate = states with split votes / states (escalation
     frequency); engine_escalations = ok-labelled states with split votes (the engine's `judgeEscalation` rule).
   - C (mapper 2 codebases x 4 foci x 2 repeats; researcher 4 dimensions x 2 repeats; per model): the fixed
     Sonnet grader marks each checklist item found | wrong | missing and lists fabrications; recall = found /
     items; error_rate = wrong / items; fabrications per run = grader fabrications + mechanical path fabrications
     (backticked repo paths that do not exist in the codebase).
   - Contamination: a run whose tool inputs mention the answer keys or `scripts/eval81` is excluded and named.
4. **Statistics:** Wilson 95% interval (z = 1.96) for every proportion; n = runs (A, B), states (D), checklist
   items (C).
5. **Outcomes per role:** REFUSE, WEAK_ENDORSE, INSUFFICIENT, with the exact conditions of test list 4-8; never
   a strong endorsement.
6. **Interpretive choices** (numbered): (1) the A gate is global; (2) the C extension; (3) "~10 points" = point
   estimates; (4) human_needed is an abstention; (5) INSUFFICIENT below 2/3 scored or Sonnet primary < 0.5.
7. **Proposals:** mapping of test list 9; proposals are text for the user's checkpoint:decision in TRD 81-19;
   nothing in this objective changes model-profiles.json or aoforge-stack.json.
8. **Not decided here:** E (76-08) is a measurement; the debugger's start tier is not measured by this design.

Then `__fixtures__/metrics.cjs`: `batchResult({batch, roles})`, `roleModels({haiku, sonnet})`, `km(k, n)` and canned
results `aPass()`, `aFalsePass()`, `bResult()`, `dResult()`, `cResult()` with hand-computable rates.

Commit both with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-02): pre-register the Haiku eval decision rule" --files <both paths>`
before starting Task 2 (the rule is fixed before any decision code is written).
  </action>
  <verify>Two plain commands: `rg -n "small n can refuse but only weakly endorse" .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md` finds the line; `git log --oneline -1 -- .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md` shows the Task 1 commit.</verify>
  <done>The doc carries all 8 sections and the verbatim rule, and is committed in its own commit; metrics.cjs exports the canned results.</done>
  <recovery>If `aof-tools commit` refuses because unrelated files are staged, unstage only those you did not create and retry; never use a raw git commit.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Statistics and the decision function</name>
  <files>scripts/eval81/lib/stats.cjs, scripts/eval81/lib/stats.test.cjs, scripts/eval81/lib/decide.cjs, scripts/eval81/lib/decide.test.cjs</files>
  <action>
RED first per test list 4-11, one test at a time.

`stats.cjs`: `wilson(k, n, z = 1.96)` → `{k, n, rate, low, high}`; `rate(k, n)` (null for n = 0);
`pointsDiff(h, s)`.

`decide.cjs`: `OUTCOMES = ['REFUSE','WEAK_ENDORSE','INSUFFICIENT']`; `ROLE_PRIMARY` (verifier detection,
job-checker detection, ui-evaluator accuracy, C roles recall); `MARGIN = 0.10`; `MIN_SCORED_SHARE = 2/3`;
`SONNET_FLOOR = 0.5`; `FAB_MARGIN = 0.5`.
`decide({results: {A, B, C, D}, profiles, packModels})` → `{roles: {<role>: {outcome, reasons[], haiku, sonnet,
proposal|null}}, gate: {a_false_pass: {k, n}}}`. Order of checks per role: missing batch → INSUFFICIENT; scored
share → INSUFFICIENT; Sonnet floor → INSUFFICIENT; A gate → REFUSE; margin (and C fabrication bound) → REFUSE;
else WEAK_ENDORSE. `proposalsFor(outcome, role, profiles, packModels)` implements test list 9; focus roles read
`profiles.focus[agent][focus]` when present, else the agent's row.
  </action>
  <verify>node --test scripts/eval81/lib/stats.test.cjs scripts/eval81/lib/decide.test.cjs</verify>
  <done>Test list 4-11 pass; decide.cjs has no fs write call (`rg -n "writeFile" scripts/eval81/lib/decide.cjs` is empty).</done>
  <recovery>If a rule case in the doc and the code disagree, the committed doc wins: fix the code and add a test quoting the doc line.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Scoring CLI and the 76-06 report renderer</name>
  <files>scripts/eval81/score.cjs, scripts/eval81/score.test.cjs, scripts/eval81/lib/report.cjs, scripts/eval81/lib/report.test.cjs</files>
  <action>
RED first per test list 1-3, 3b and 12. When the scorer's result carries `extra_files`, write each under `--out`
(relative paths only) and drop the key from the saved JSON.

`score.cjs` CLI: `--batch A|B|C|D|E --root <eval root> --out <objective dir> [--scorer-dir <dir>]` requires
`<scorer-dir or __dirname/score>/<batch>.cjs`, calls its exported `score({root, outDir})`, adds `scored_at`, writes
`<out>/results/<batch>.json` (2-space JSON) and `<out>/results/<batch>.md` (renderBatchTable).
`--report --out <dir>` reads `results/{A,B,C,D}.json`, runs decide() with model-profiles.json and the flutter pack's
aoforge-stack.json read from this checkout, and writes `<out>/81-HAIKU-EVAL.md` via renderEvalReport. E is rendered
by its own scorer (TRD 81-12), not here. Export `main(argv)` returning an exit code; `require.main` sets
`process.exitCode`.

`report.cjs`: `renderBatchTable(result)` and `renderEvalReport({decisions, results, generatedAt})` (Markdown:
summary table per role, per-metric rows with Wilson CI, reasons, proposals, a closing line "No tier assignment was
changed by objective 81; proposals await the user's decision.").
  </action>
  <verify>node --test scripts/eval81/score.test.cjs scripts/eval81/lib/report.test.cjs</verify>
  <done>Test list 1-3 and 12 pass; the CLI writes only under `--out`.</done>
  <recovery>If dynamic require paths break under `node --test` cwd, resolve with path.join(__dirname, 'score', batch + '.cjs').</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/</test>
<test>npm test (git ls-files globs minus watcher-shell.test.cjs on this machine)</test>
</validation_gates>

<verification>
- `git log --format=%s -- .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md` shows the Task 1 commit before any commit touching decide.cjs.
- `node --test scripts/eval81/lib/stats.test.cjs scripts/eval81/lib/decide.test.cjs scripts/eval81/lib/report.test.cjs scripts/eval81/score.test.cjs` passes with TMPDIR under the session scratchpad.
</verification>

<success_criteria>
The rule is on disk and committed before code that applies it; decide() reproduces every case in the doc; the
report shows n, rates and 95% intervals per role and never claims a strong endorsement.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-02-SUMMARY.md`
</output>
