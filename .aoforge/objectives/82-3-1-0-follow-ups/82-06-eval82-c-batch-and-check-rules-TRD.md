---
objective: 82-3-1-0-follow-ups
trd: "06"
type: standard
wave: 2
depends_on: ["82-01", "82-05"]
files_modified:
  - scripts/eval82/fixtures/C/topic-gateway.md
  - scripts/eval82/fixtures/C/topic-hub.md
  - scripts/eval82/fixtures/C/checklists-82.json
  - scripts/eval82/fixtures/C/proofs.test.cjs
  - scripts/eval82/batches/C.cjs
  - scripts/eval82/batches/C.test.cjs
  - scripts/eval82/score/C.cjs
  - scripts/eval82/score/C.test.cjs
  - scripts/eval82/check-rules.cjs
  - scripts/eval82/check-rules.test.cjs
  - scripts/eval82/score.cjs
  - scripts/eval82/README.md
  - .aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md
  - .aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json
autonomous: true
requirements: [SC-1, SC-3]
must_haves:
  truths:
    - "Two research topics drawn from real AOCyber products (an LLM gateway in Go; a Flutter macOS hub for a local daemon) and their architecture and pitfalls checklists (10-12 items each, each with a source) are committed and frozen before any live run"
    - "Batch C (objective 82) runs project-researcher architecture and pitfalls at haiku and sonnet, 2 repeats per topic, with the production spawn prompt read from the tree under test, and plans a Sonnet grader run for each finished researcher run"
    - "82-CHECK-RULES.md pre-registers, before any live run, the keep/revert rule for P1 (D), for P4 and P5 (C), the build-cell mechanism checks for SC-1 (E) built from 82-DIAGNOSIS.md's Fix list, the sandbox and escape rules, and the spend rules"
    - "check-rules.cjs implements those rules as pure functions tested on hand-built results and renders 82-TIER-CHECKS.md; a fake-claude rehearsal runs D, C and E end to end in a scratch root with zero API calls"
    - "`results/prereg-manifest.json` freezes scripts/eval82 (unit tests excepted) and 82-CHECK-RULES.md, and `prereg.cjs --check` on it exits 0"
  artifacts:
    - path: .aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md
      provides: "the pre-registered keep/revert and effect rules"
    - path: scripts/eval82/check-rules.cjs
      provides: "p1Verdict, researcherVerdict, mechanismChecks, renderTierChecks"
    - path: .aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json
      provides: "the freeze 82-08 and 82-09 check before spending"
  key_links:
    - from: .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
      to: scripts/eval82/check-rules.cjs mechanismChecks
      via: "Fix list rows: category and target count per run"
      pattern: "mechanismChecks"
    - from: scripts/eval82/check-rules.cjs
      to: .aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md
      via: "renderTierChecks in 82-08"
      pattern: "82-TIER-CHECKS"
---

# TRD 82-06: Objective 82's eval harness, part 2: batch C, the pre-registered rules and the freeze

<objective>
P4 and P5 were approved "with a follow-up measurement: compare budget-profile architecture (pitfalls) research on
real projects with a Sonnet run of the same topic, on two or three topics; revert if Haiku misses findings Sonnet
makes". P1 was approved "only if escalation keeps the verdicts right and the cost below a Sonnet start". Build the
researcher batch on two new topics (objective 81's topic, already measured, is the third), write the keep/revert
rules and the build-cell effect rule down before any run, implement them as tested functions, rehearse every batch
with the fake claude binary, and freeze the harness by hash.

Purpose: SC-3's follow-up measurement design and SC-1's effect rule, fixed before spending.
Output: topics and checklists, batch C and its scorer, 82-CHECK-RULES.md, check-rules.cjs, the prereg manifest.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-05-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md

Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
No live API call here (fake claude and dry runs only). Never edit scripts/eval81 (frozen; import from it). Tests:
`SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-06 TMPDIR=$SP/tmp-82-06 node --test <files>`.

81's batch C (`scripts/eval81/batches/C.cjs`) exports what is parameter-free or takes a topic:
`extractResearcherTemplate(workflowText, dimension)` (finds the `Task(prompt="...", subagent_type="project-researcher",
model="{researcher_models.<dim>}"` block of new-project.md), `fillResearcherPrompt(template, topic)` (fills `[domain]`,
`[greenfield OR subsequent]`, `[PROJECT.md summary ...]`), `graderItems(items)`, `joinDocuments`, `readRunRecord(root, id)`,
`RESEARCH_DOC` (dimension → document name, e.g. architecture → ARCHITECTURE.md), `MODELS`, `DIMENSIONS`; its
`loadTopic()` reads 81's fixed topic file, and its grader prompt/schema are `fixtures/C/grader-prompt.md` and
`grader-schema.json` (Sonnet, tools off: `tools: []`). 81 ran researchers with `AOFORGE_SKIP_EDIT_GATE=1` plus the
background-skip env, timeout 25 min, grader 5 min. Read C.cjs for how a researcher run is materialised (greenfield
project with `.aoforge/PROJECT.md` = `# <title>` + summary) and collected (the newest research document from the
run's draft dirs), and reuse by import wherever the function takes its inputs as parameters.

Spawn-prompt runtime line: after 82-07, new-project.md's researcher spawn carries `AOForge runtime: {runtime_root}`.
In batch C fill `{runtime_root}` with `<S>/runs/C/<id>/home/.claude/aoforge` when the runner env has
`EVAL82_SANDBOX_ROOT=<S>` (82-08 sets it on the command), else remove that line (tests and dry runs). If 82-07 has not
landed when this runs, the placeholder is absent and the fill is a no-op (handle both).

Costs (81, per run): researcher architecture haiku ~$0.04 / sonnet ~$0.14, pitfalls ~$0.045 / ~$0.19; grader ~$0.064.
82 C plan: 2 topics x 2 dimensions x 2 models x 2 repeats = 16 researcher runs + 16 grader runs, ~$2.6, batch cap $3.5;
per-run caps haiku researcher 0.3, sonnet researcher 0.6, grader 0.25.
</context>

<embedded_context>

<codebase_examples>
Topic file shape (81's researcher-topic.md; the parser reads these headings exactly):
```markdown
# Test C research topic (objective 82): <name>
<one paragraph: who wrote it, when, before any run; do not edit once a run has started>
## Domain
<one line>
## Project title
<one word>
## Project summary
<one paragraph>
```
The two topics, fixed here (copy the text verbatim):
- `topic-gateway.md`: Domain "An LLM gateway service, written in Go, that sits between internal applications and
  several hosted model providers". Title `modelgate`. Summary: "modelgate is a service, written in Go, that sits
  between a company's internal applications and several hosted large-language-model providers. Applications call one
  HTTP API; modelgate authenticates each caller with a per-tenant API key, enforces per-tenant rate limits and monthly
  spend budgets, streams responses back as they arrive, records every request's token usage for cost accounting,
  keeps a searchable request log, and fails over to another provider when one is slow or down. It runs as several
  stateless instances behind a load balancer."
- `topic-hub.md`: Domain "A macOS desktop application, written in Flutter, that controls a local developer-platform
  daemon". Title `devhub`. Summary: "devhub is a macOS desktop application, written in Flutter, that controls a
  developer-platform daemon running on the same machine. It shows the status of the local services the daemon
  manages, starts and stops them, streams their logs live, and edits the daemon's settings. The daemon exposes a
  local API; it can be restarted or upgraded while devhub is open, and devhub must keep working through that. devhub
  ships signed and notarized, starts at login and lives in the menu bar."
Checklist JSON shape (as 81's checklists-researcher.json): `{written, scoring, topics: {gateway: {architecture:
[{id, statement, accept_any: [...], source}], pitfalls: [...]}, hub: {...}}}`; ids like `GA-A01`, `GA-P01`, `HU-A01`.
</codebase_examples>

<anti_patterns>
- Writing checklist items after seeing any run output (none may exist yet), or in bulk without a source: each item is
  one established practice or failure mode with a named, citable source (a spec, vendor documentation, a well-known
  engineering guide), stated so a reader can judge "the document says this" without the item naming a library version.
- Rules that read the result first: 82-CHECK-RULES.md is committed and hashed before 82-08 spends a cent.
- Property-based or generated test data (hand-built results in tests).
- Editing scripts/eval81.
</anti_patterns>

<error_recovery>
- 81's C functions do not expose materialise/collect for a researcher with a given topic: re-implement the small
  topic-dependent parts in scripts/eval82/batches/C.cjs and keep the rest imported; a test proves the prompt equals
  `fillResearcherPrompt(extractResearcherTemplate(<tree new-project.md>, dim), topic)` with the runtime line handled.
- 82-DIAGNOSIS.md's Fix list has no FIX rows (all JUSTIFY): §3 of the rules then checks outcomes and reports totals
  only, and says so.
- prereg.cjs refuses an include (outside the repo, or a `..`): use repo-relative globs only.
</error_recovery>

</embedded_context>

## Test list

fixtures/C/proofs.test.cjs (outermost: the answer key)
1. Both topic files parse with the three headings; titles `modelgate` and `devhub`.
2. checklists-82.json: two topics x two dimensions, 10-12 items each, unique ids, every item has a non-empty
   statement, accept_any and source, and no item names a version number (`/\bv?\d+\.\d+/`).
batches/C.test.cjs
3. `runs({root, trees})` lists 16 researcher descriptors `C82-res-<topic>-<dim>-<h|s>-<k>`, agent
   `aoforge:project-researcher`, model haiku|sonnet, plugin `3.1.0`, the prompt from the tree's new-project.md filled
   with the topic (runtime line filled under `EVAL82_SANDBOX_ROOT`, removed otherwise), caps as the context says.
4. A grader descriptor `C82-grade-<researcher id>` (sonnet, tools [], jsonSchema = 81's grader schema, prompt = the
   grader template filled with the dimension task, the checklist items and the bounded document) appears only when
   that researcher's record is `ok` with a document; none otherwise.
5. materialize writes the greenfield project for the topic; collect returns the dimension's document text (or a
   recorded absence).
score/C.test.cjs
6. On hand-built researcher and grader records: recall (found / items) per topic x dimension x model with Wilson
   intervals; pooled recall per dimension x model over the new topics; grader-reported fabrications per run;
   an item matrix (Sonnet found in 0/1/2 runs, Haiku found in 0/1/2 runs); cost per run; writes results/C.json, C.md.
check-rules.test.cjs
7. p1Verdict on hand-built D results: KEEP when broken_missed(haiku start, final) = 0, accuracy(haiku start, final) >=
   accuracy(sonnet start) and cost(haiku start incl. escalations) < cost(sonnet start incl. its estimate); REVERT with
   the failing condition named for each single violation; REVERT (inconclusive) when any state is incomplete.
8. researcherVerdict(dim) on hand-built C results: REVERT when an item is found by Sonnet in both runs and by Haiku in
   neither on a topic, or pooled Haiku recall < pooled Sonnet recall - 10 points, or Haiku fabrications per run >
   Sonnet's + 0.5; KEEP otherwise; REVERT (inconclusive) when a topic x model has fewer than 2 graded runs.
9. mechanismChecks(attribution per run, fixList) passes when every FIX row's category count equals its target in
   every new run and fails naming the row and run otherwise; outcomes (acceptance, tests, verification) must all hold.
10. renderTierChecks writes a document with sections P1, P4, P5 (and the 81 topic as recorded context), each with the
    verdict, the rule clause that decided it, and the numbers; deterministic.

<tasks>

<task type="auto">
  <name>Task 1: Topics, checklists and their proofs (test list 1-2)</name>
  <files>scripts/eval82/fixtures/C/topic-gateway.md, scripts/eval82/fixtures/C/topic-hub.md, scripts/eval82/fixtures/C/checklists-82.json, scripts/eval82/fixtures/C/proofs.test.cjs</files>
  <action>
Write the two topic files with the text in codebase_examples. Then write checklists-82.json by hand, item by item,
before any run: for each topic, 10-12 architecture items and 10-12 pitfalls items. Cover, for the gateway:
streaming pass-through, provider adapters, key handling (hashed keys), rate limiting across instances, budget and
usage metering, request-log pipeline and redaction, failover and circuit breaking, timeouts and client-cancellation
propagation, horizontal scaling with shared state, observability; pitfalls such as proxy buffering of streams, cost
leaks when a client disconnects, billing before a stream completes, logging secrets or personal data, limiter races
across instances, retries that duplicate cost, provider error mapping, unbounded bodies, retry storms. For the hub:
the local IPC choice and its authentication, separating the daemon client from UI state, reconnection with backoff
and a status stream, bounded log streaming and list virtualisation, version negotiation with the daemon, macOS
signing/notarization/hardened runtime and sandbox entitlements, start at login and menu bar; pitfalls such as App
Sandbox blocking local sockets, binding to all interfaces, an unauthenticated local API, UI jank from logs on the main
isolate, uncancelled streams, daemon restart races, version skew. Each item: `statement`, 2-4 `accept_any` phrasings,
`source` (name the document). Proofs test 1-2. Commit
`AOF commit "test(82-06): objective 82 research topics and checklists, written before any run" --files <the four files>`.
  </action>
  <verify>`env HOME=$SP/home-82-06 TMPDIR=$SP/tmp-82-06 node --test scripts/eval82/fixtures/C/proofs.test.cjs` passes</verify>
  <done>Two real-product topics with frozen-ready answer keys exist.</done>
  <recovery>If an area has fewer than 10 citable items for a dimension, use 10 and say which areas were dropped; never pad with uncited items.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Batch C and its scorer (test list 3-6)</name>
  <files>scripts/eval82/batches/C.cjs, scripts/eval82/batches/C.test.cjs, scripts/eval82/score/C.cjs, scripts/eval82/score/C.test.cjs, scripts/eval82/score.cjs</files>
  <action>
RED: tests 3-6 (hand-built records with `scripts/eval82/__fixtures__/records.cjs`; a fixture tree dir holding a
minimal `plugins/aoforge/aoforge/workflows/new-project.md` with two researcher Task blocks, one carrying an
`AOForge runtime: {runtime_root}` line). Commit `AOF commit "test(82-06): researcher batch C and scorer (RED)" --files <test files>`.
GREEN: batches/C.cjs per tests 3-5 (order: repeat 1 of every topic x dim before repeat 2; models alternate within a
pair, as 81). score/C.cjs per test 6, plus `score.cjs --batch C`. Also read 81's `results/C.json` for the 81 topic's
architecture and pitfalls rows (recall, fabrications and, if present, item-level verdicts) and carry them into
`results/C.json` under `recorded_81` (no recomputation). Commit
`AOF commit "feat(82-06): researcher batch C on two real-product topics, and its scorer" --files <files>`.
  </action>
  <verify>`node --test scripts/eval82/batches/C.test.cjs scripts/eval82/score/C.test.cjs` pass under the scratch HOME; `rg -n "eval81/batches/C.cjs" scripts/eval82/batches/C.cjs` shows the import</verify>
  <done>Batch C plans 16 researcher runs and their graders; the scorer gives recall, fabrications and the item matrix.</done>
  <recovery>If 81's C.json lacks item-level data for its topic, record aggregate-only for the third topic and say so in the scorer output.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Pre-registered rules, check-rules.cjs, fake-claude rehearsal and the freeze (test list 7-10)</name>
  <files>.aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md, scripts/eval82/check-rules.cjs, scripts/eval82/check-rules.test.cjs, scripts/eval82/README.md, .aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json</files>
  <action>
1. Draft 82-CHECK-RULES.md (`AOF planning draft objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md`): §1 P1 rule (test
   7's three conditions, the production default "every state expect:pass", escalation by the engine's rules, the
   Sonnet-start opus estimate, inconclusive → REVERT; REVERT means `models.ui-evaluator` balanced and budget back to
   sonnet); §2 P4/P5 rule per dimension (test 8's three clauses over the two new topics; 81's topic reported beside
   it as recorded context, not voting; inconclusive → REVERT; REVERT means that focus's budget back to sonnet);
   §3 build-cell effect (SC-1): the mechanism checks are the rows of 82-DIAGNOSIS.md's Fix list that are FIX as
   finally applied (82-07 records each row's outcome in `## Fix applied` before any E run; a row it moved to JUSTIFY
   is not checked); each check is the row's category and target count per run; copy today's FIX rows into a table as
   the expected set; "effect shown" = every mechanism check passes in every new E run AND acceptance, tests and
   verification hold; totals are reported against both recorded versions with n=2 and carry no verdict; §4 sandbox: opaque sandbox root
   `/private/tmp/claude-501/e82-<hex>`, the runner's deny list, 81's post-hoc 4 access classes (`tilde` and
   `guessed_nonexistent` are non-escapes and are counted; any `real` access is an escape: exit 5 stops the batch);
   SC-2's sandboxed check = zero `tilde`, `guessed_nonexistent` and `real` in E and C; §5 spend: global $20 hard cap,
   batch caps D 4.5, C 3.5, E 12, order D, C, E, per-run caps, the ledger charges the larger of reported and transcript
   cost, a budget stop (exit 3) goes to the user. Publish with `AOF doc put ... --from <draft>`.
2. TDD check-rules.cjs: RED tests 7-10, commit `AOF commit "test(82-06): keep/revert and effect rules (RED)" --files scripts/eval82/check-rules.test.cjs`;
   GREEN `p1Verdict`, `researcherVerdict`, `mechanismChecks` (input: per-run category counts from
   `scripts/eval82/lib/attribution.cjs` and the FIX rows parsed from 82-DIAGNOSIS.md's Fix list, minus rows its
   `## Fix applied` section marks JUSTIFY when that section exists), `renderTierChecks`; add
   `score.cjs --rules` to render 82-TIER-CHECKS.md from results/D.json and results/C.json. Commit
   `AOF commit "feat(82-06): pre-registered keep/revert and effect rules as code" --files <files> .aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md`.
3. Fake-claude rehearsal (zero API) in a scratch root `$SP/82-06/rehearsal` with an opaque scratch sandbox root
   (`/private/tmp/claude-501/e82-rh-<hex>`): ledger82 --init; exportTrees({'3.1.0': 'HEAD'}); run D with
   `--claude-bin node:scripts/eval81/__fixtures__/fake-claude.cjs --stop-after 6`, then C `--stop-after 4` (close D
   first in the scratch ledger), then E dry-run only; score what exists. It proves records, ledger entries, access
   classification and scorers run end to end; record what the fake scenarios could not exercise. Delete the scratch
   roots after.
4. Freeze: `node scripts/eval81/prereg.cjs --write --out .aoforge/objectives/82-3-1-0-follow-ups/results --include 'scripts/eval82/**' --include '.aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md' --exclude '**/*.test.cjs' --keep 'scripts/eval82/fixtures/*/proofs.test.cjs' --claude-version "<output of claude --version>"`,
   then `--check --manifest .aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json` exits 0. Commit
   `AOF commit "chore(82-06): freeze the objective 82 harness and rules before any live run" --files .aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json scripts/eval82/README.md`.
  </action>
  <verify>All scripts/eval82 tests pass; the 82 prereg check prints OK; 81's prereg check prints OK; `rg -n '^## ' .aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md` shows the five sections</verify>
  <done>The rules are written and coded before any spend, every batch has been rehearsed without the API, and the harness is frozen.</done>
  <recovery>The fake claude cannot produce a D or C structured output shape: rehearse the plumbing with the scenario it has (records and ledger) and test the scorer on hand-built records only; record the gap. A later harness fix (in 82-08) is a post-hoc amendment: test-first, re-freeze with the same command, recorded in 82-CHECK-RULES.md under "Post-hoc".</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (scoped: `node --test scripts/eval82/**/*.test.cjs` under the scratch HOME)</test>
</validation_gates>

<verification>
- Topics and checklists frozen; batch C and scorer tested; rules written and coded; rehearsal done; prereg checks OK.
</verification>

<success_criteria>
- Every live number 82-08 and 82-09 will produce has a rule, fixed in advance, that decides what it means.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-06-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the manifest sha256 and the rehearsal findings.
</output>
