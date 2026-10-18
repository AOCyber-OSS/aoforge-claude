---
objective: 82-3-1-0-follow-ups
trd: "07"
type: standard
wave: 2
depends_on: ["82-01", "82-02"]
files_modified:
  - "plugins/aoforge/aoforge/workflows/*.md (spawn prompts and flagged lines)"
  - "plugins/aoforge/skills/**/SKILL.md (flagged lines only)"
  - "plugins/aoforge/aoforge/templates/**/*.md (flagged lines only)"
  - "plugins/aoforge-stack-flutter/{skills,workflows}/**/*.md and plugins/aoforge-stack-web skills/workflows (flagged lines only)"
  - plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
  - scripts/eval81/batches/A.test.cjs
  - scripts/eval81/batches/B.test.cjs
  - scripts/eval81/batches/C.test.cjs
  - plugins/aoforge/agents/planner.md
  - plugins/aoforge/agents/executor.md
  - "plugins/aoforge/aoforge/references/{trd-spec,tdd}.md and templates/summary.md (only if a FIX row names them)"
  - plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs
  - .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
autonomous: true
requirements: [SC-1, SC-2]
must_haves:
  truths:
    - "No workflow, skill or template asks an agent or the orchestrator to Read a `~/` path; the guard enforces every scope (PENDING is empty) and every AOForge agent spawn prompt carries `AOForge runtime: {runtime_root}` from its file's init JSON"
    - "Every FIX row of 82-DIAGNOSIS.md's Fix list is implemented with a test written first that pins it (build-cell-reads.repo.test.cjs or the module's own test); every JUSTIFY row has its paragraph"
    - "82-DIAGNOSIS.md gains a `## Fix applied` section: per row the commit, the pinning test, and the offline effect (resident bytes per spawn from 81's static-prompt.cjs, 99950509 vs HEAD; the bytes the planner and executor are told to read before their first write for a 2-TRD tdd build, before vs after)"
    - "Objective 81's frozen harness modules are untouched; its unit tests that compare frozen spawn templates with the live workflows ignore exactly the runtime line objective 82 adds"
    - "The full suite passes (watcher-shell excluded and named)"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs
      provides: "pins for the planner and executor fixes"
  key_links:
    - from: "spawn prompts in workflows"
      to: "agents' <runtime_paths> block (82-02)"
      via: "AOForge runtime: {runtime_root}"
      pattern: "AOForge runtime: \\{runtime_root\\}"
    - from: .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
      to: plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs
      via: "one test per FIX row"
      pattern: "P-|E-"
---

# TRD 82-07: Fix the build-cell token growth, and put absolute runtime paths in every spawn

<objective>
Implement what 82-DIAGNOSIS.md's Fix list marks FIX, test-first, and finish SC-2's runtime-path work in the
orchestrator-facing files (workflows, skills, templates) that the executor's "read these files yourself" list and the
other spawn prompts live in. The two share files and lines (the executor spawn's read list is both the guessed-home
source and a token cost), so they land together and in this order: runtime paths first, then the planner fixes, then
the executor fixes.

Purpose: SC-1 (the fix or recorded justification), SC-2 (orchestrator half; the guard complete).
Output: rewritten spawn prompts and flagged lines, the planner and executor fixes with their pins, `## Fix applied`.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-02-SUMMARY.md

Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
Never push or tag; never port 8080; never write the real `~/.claude`. Tests:
`SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-07 TMPDIR=$SP/tmp-82-07 node --test <files>`.

From 82-02: every init JSON has `runtime_root`; agents carry the `<runtime_paths>` block and name runtime files
`<runtime>/<rel>`; the guard `runtime-path-reads.repo.test.cjs` enforces agents, references and pack agent material
and lists `core_workflows`, `core_skills`, `core_templates`, `pack_skills_workflows` as PENDING (their offender counts
are in 82-02-SUMMARY.md). Allowed classes: shell commands, skill line-start `@~/` includes (Claude Code expands
them), CLAUDE.md template imports, ALLOW entries.

Workflows are read by the main-session orchestrator, which already ran its init: name runtime files there as
`{runtime_root}/<rel>` ("`runtime_root` from the init JSON above"). A workflow with no init call names the fallback
once: `RUNTIME_ROOT=$(echo ~/.claude/aoforge)` and then `{runtime_root}` means that value. Spawn prompts (44 `Task(`
blocks at planning time across workflows, skills and pack skills) get the line `AOForge runtime: {runtime_root}` inside
the prompt text, right after its opening tag/line; keep each block's closing shape byte-identical (for example the
researcher tail `", subagent_type="project-researcher", model="{researcher_models.<dim>}"` that 82-06's batch C and
81's C extractor find).

The executor spawn in `execute-objective.md` (two places, about lines 430 and 1043) lists runtime files "Read these
files yourself": `~/.claude/aoforge/templates/summary.md` (before the first checkpoint), `references/checkpoints.md`
(only for checkpoint tasks), `references/tdd.md` (TDD TRDs), `anti-patterns.md` (not needed), `workflows/execute-trd.md`
(only if unclear). Its `{TRD_CONTENT}` embeds the whole TRD.

Objective 81's unit tests `scripts/eval81/batches/A.test.cjs` (verifier spawn in execute-objective.md, anchor
`Task(\n  prompt="Verify objective`), `B.test.cjs` (job-checker spawn in plan-objective.md) and `C.test.cjs` (mapper
blocks in map-codebase.md, researcher Tasks in new-project.md) assert the FROZEN modules' templates equal the live
spawn prompts. Unit tests are outside 81's freeze (prereg excludes `**/*.test.cjs`); the modules are inside it. When a
spawn prompt gains the runtime line, change only the comparison: drop lines equal to `AOForge runtime: {runtime_root}`
from the live text before comparing, with a comment naming objective 82. Any other spawn change the fixes make to
those four prompts gets the same treatment, line by line, named in the comment.

Candidate catalogue (82-DIAGNOSIS.md's Fix list rows use these ids; a row's own "change" column wins where it differs):
- P-1 template hunt: find the text that sends the planner to `templates/trd-prompt.md`; make `<runtime>/references/trd-spec.md`
  the one skeleton the planner reads (move into trd-spec anything only trd-prompt.md has), and say in planner.md's
  `<plan_format>` that trd-spec is complete. Pin: planner.md and plan-objective.md never tell the planner to open
  `templates/trd-prompt.md`; trd-spec.md contains each section the template carried.
- P-2 commit inspect/amend tail: remove the trigger the diagnosis found; and in planner.md's `git_commit` step: the
  `aof-tools commit` it runs is final; it does not read the message back, amend it or add trailers. Pin that sentence.
- P-3 draft size, P-4 validation/publish calls, P-5 full reference reads: apply the row's change (for example one
  `verify trd-pre` call that covers frontmatter, structure and budget instead of per-file validate calls, if trd-pre
  covers them: check its output fields first). Pin the step text.
- E-1 summary template: the executor gets an inline SUMMARY skeleton (frontmatter keys `summary post` and the
  validators require, from `FRONTMATTER_SCHEMAS.summary` in lib, plus the required sections), at most about 2,000
  chars; `templates/summary.md` is read only for a case the skeleton does not cover. Pin: the skeleton names every
  required key (test reads the schema), and the spawn list no longer requires summary.md before the first checkpoint.
- E-2 tdd.md: an inline TDD card (RED commit, GREEN commit, optional REFACTOR, evidence lines, test naming) of at most
  about 1,500 chars; tdd.md only for an open question. Pin the card's required phrases and the spawn list entry.
- E-3 duplicate TRD read: the TRD is embedded in the spawn; the executor body says to work from it and Read the file
  only to re-check after context compaction or when the embed is missing. Pin the sentence.
- E-4 guessed runtime path: done by 82-02 and Task 1 here (the guard). E-5 repeated SUMMARY write: the row's change or JUSTIFY.
</context>

<embedded_context>

<codebase_examples>
Spawn prompt shape after Task 1 (execute-objective.md executor spawn):
```
     prompt="
       AOForge runtime: {runtime_root}

       <objective>
       Execute plan {plan_number} of objective {objective_number}-{objective_name}.
       ...
       <execution_context>
       A Task prompt does not expand @ references. Read these files yourself, each at the moment it is needed:
       - {runtime_root}/references/checkpoints.md — only if the TRD has a checkpoint task, before that task
       ...
```
Pin-test style (tokens-cli.test.cjs 11/12 assert executor.md text and order):
```js
const exec = fs.readFileSync(path.join(PLUGIN, 'agents', 'executor.md'), 'utf8');
assert.match(exec, /<the pinned phrase>/, 'E-3: the executor works from the embedded TRD');
```
</codebase_examples>

<anti_patterns>
- Removing content an agent needs for correctness to save tokens: a check that buys a correct result stays, as JUSTIFY.
- Inventing fixes the diagnosis did not ask for; anything new found here goes to the SUMMARY as a todo candidate.
- Editing scripts/eval81 modules (only its three unit tests' comparisons, as described).
- Changing a skill's line-start `@~/` include (allowed and expanded by Claude Code) or a `node ~/...` command.
- Writing 82-DIAGNOSIS.md with Write/Edit (draft + `doc put`).
</anti_patterns>

<error_recovery>
- The context-budget guard (skills <= 90,000 resolved chars, agents <= 65,000) fails after adding cards or skeletons:
  move older resident prose of the same agent into its reference (read on demand) rather than raising a cap.
- A FIX row turns out to need more than about one task of work: implement the part that removes the measured cost,
  move the rest to JUSTIFY with the reason, and write a todo candidate in the SUMMARY.
- model-placeholders.repo.test.cjs fails on a new placeholder: `{runtime_root}` is not a model placeholder; if it
  is flagged, the line sits in a `model=` position by mistake.
</error_recovery>

</embedded_context>

## Test list

runtime-path-reads.repo.test.cjs (extended)
1. PENDING is empty and ENFORCED holds every scope; real tree: zero offenders in every scope.
2. Every `Task(` block in core workflows and skills and in pack skills/workflows whose `subagent_type` names an
   AOForge or pack agent carries a line `AOForge runtime: {runtime_root}` inside its prompt.
3. Every file with such a spawn supplies `{runtime_root}`: it runs an `aof-tools.cjs init <cmd>` (whose JSON has
   runtime_root, checked by 82-02's test) or defines `RUNTIME_ROOT=$(echo ~/.claude/aoforge)`.
build-cell-reads.repo.test.cjs (one numbered test per FIX row, in Fix-list order; for example)
4. P-1: planner.md and plan-objective.md never name `templates/trd-prompt.md` as a file to open; trd-spec.md has the
   sections the template carried.
5. P-2: planner.md's git_commit step carries the "final commit, no read-back, no amend, no trailers" sentence.
6. E-1: executor.md's SUMMARY skeleton names every key of FRONTMATTER_SCHEMAS.summary's required list; the executor
   spawn list no longer requires summary.md before the first checkpoint.
7. E-2: executor.md's TDD card names the RED and GREEN commits and the evidence lines; the spawn list reads tdd.md only
   for an open question.
8. E-3: executor.md tells the executor to work from the embedded TRD.
(Rows the diagnosis marks JUSTIFY get no test; rows it adds get their own.)
scripts/eval81 unit tests
9. A/B/C template comparisons pass with the runtime line (and only the named lines) ignored.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Runtime paths in workflows, skills and templates; spawn lines; guard fully enforced (test list 1-3, 9)</name>
  <files>plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs, plugins/aoforge/aoforge/workflows/*.md, plugins/aoforge/skills/**/SKILL.md, plugins/aoforge/aoforge/templates/**/*.md, pack skills/workflows, scripts/eval81/batches/A.test.cjs, scripts/eval81/batches/B.test.cjs, scripts/eval81/batches/C.test.cjs</files>
  <action>
RED: in the guard move the four PENDING scopes to ENFORCED and add tests 2-3; run it (offenders and missing spawn
lines listed). Commit `AOF commit "test(82-07): enforce the runtime-path guard on workflows, skills and templates (RED)" --files plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs`.
GREEN: rewrite each offender to `{runtime_root}/<rel>` (workflows, skills) or the form the template's reader knows
(a template becomes a planning file an agent reads: `<runtime>/<rel>`; one that becomes CLAUDE.md keeps line-start
imports); add the spawn line to every AOForge agent spawn; add the `RUNTIME_ROOT` fallback line to a spawning file with
no init. A one-off script under `$SP/82-07/` may do the mechanical part; review every hunk of execute-objective.md,
plan-objective.md, new-project.md, map-codebase.md, quick.md and build.md by hand. Update A/B/C.test.cjs comparisons
(test 9). Run: the guard, model-placeholders, context-budget, builtin-sweep, planning-writes, doc-refs, rename and
stack-neutrality guards, `node --test scripts/eval81/batches/*.test.cjs`, and the init tests. Commit
`AOF commit "fix(82-07): spawn prompts carry the absolute runtime root; no ~ reads in workflows, skills or templates" --files <every changed file>`.
  </action>
  <verify>All listed guards and test files pass; `rg -n 'AOForge runtime: \{runtime_root\}' plugins/aoforge/aoforge/workflows plugins/aoforge/skills plugins/aoforge-stack-*/skills | rg -c .` equals the spawn count test 2 reports; `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` OK</verify>
  <done>SC-2's text half is complete: no `~/` read instruction anywhere in scope, and every spawn hands the agent its absolute runtime path.</done>
  <recovery>If a workflow's Task block is a prose description rather than a literal spawn (test 2 finds no prompt string), exempt it in the test by name with a reason, and say so.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Planner-side FIX rows (P-n)</name>
  <files>plugins/aoforge/agents/planner.md, plugins/aoforge/aoforge/workflows/plan-objective.md, plugins/aoforge/aoforge/references/trd-spec.md (if P-1 says so), plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs</files>
  <action>
RED: create build-cell-reads.repo.test.cjs with one numbered test per planner FIX row (shape as test list 4-5);
commit `AOF commit "test(82-07): pin the planner build-cell fixes (RED)" --files plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs`.
GREEN: apply each planner FIX row (catalogue in context; the row's change wins). Keep planner.md under the agent cap.
If B.test.cjs's job-checker comparison is affected (plan-objective.md spawn), extend its ignore list by the named line.
Run the pin test, context-budget, model-profiles (Profile Definitions test reads agents), builtin-sweep and
scripts/eval81/batches/B.test.cjs. Commit
`AOF commit "fix(82-07): planner build-cell fixes (<row ids>)" --files <changed files>`.
  </action>
  <verify>build-cell-reads.repo.test.cjs planner tests pass; the guards listed pass</verify>
  <done>Each planner FIX row is in place and pinned.</done>
  <recovery>If a row's trigger cannot be found in any 3.1.0 text (P-2 may be model behaviour), the pinned instruction is the fix, and the row records that the trigger was not textual.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Executor-side FIX rows (E-n), the offline effect, and `## Fix applied`</name>
  <files>plugins/aoforge/agents/executor.md, plugins/aoforge/aoforge/workflows/execute-objective.md, plugins/aoforge/aoforge/workflows/execute-trd.md (if a row names it), plugins/aoforge/aoforge/templates/summary.md and references/tdd.md (only if a row names them), plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs, .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md</files>
  <action>
RED: add the executor FIX rows' tests (shape as test list 6-8); commit
`AOF commit "test(82-07): pin the executor build-cell fixes (RED)" --files plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs`.
GREEN: apply each executor FIX row; the executor spawn's read list keeps checkpoints.md (conditional) and loses
what the rows remove. Run the pin tests, tokens-cli.test.cjs (its tests 11-12 pin the stamp step's order),
executor-token-stamp.repo, context-budget, builtin-sweep, scripts/eval81/batches/A.test.cjs, and the summary
validators' tests. Commit `AOF commit "fix(82-07): executor build-cell fixes (<row ids>)" --files <changed files>`.
Offline effect: (a) `node scripts/eval81/static-prompt.cjs` comparing 99950509 with HEAD for planner and executor
(resident bytes per spawn; read its usage first; output to `$SP/82-07/`); (b) for a 2-TRD tdd build, the bytes the
planner and executor are instructed to read before their first write, before (99950509) vs after (HEAD), counted from
the files the instructions name. Draft 82-DIAGNOSIS.md (`AOF planning draft objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md`),
append `## Fix applied` (per row: commit, pinning test, offline effect; JUSTIFY rows' paragraphs), `AOF doc put ... --from <draft>`.
Then the full suite (npm test's globs, watcher-shell excluded and named, HOME/TMPDIR under $SP) and commit
`AOF commit "docs(82-07): fixes applied and their offline effect" --files .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md`.
  </action>
  <verify>All pin tests green; full suite 0 fail / 0 cancelled with the one named exclusion; 82-DIAGNOSIS.md has `## Fix applied` with a line per Fix-list row</verify>
  <done>The build-cell causes are fixed or justified, pinned by tests, and their offline effect is recorded for 82-09 to confirm live.</done>
  <recovery>A full-suite failure outside these files: check it at HEAD~N before this TRD's first commit in a scratch worktree; pre-existing only if it fails there too; otherwise fix it here or return failed.</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (locally: npm test's globs with `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` excluded for its fish hang; HOME/TMPDIR under the session scratchpad)</test>
</validation_gates>

<verification>
- The guard enforces every scope with zero offenders and every spawn carries the runtime line; each FIX row is pinned;
  `## Fix applied` records commits and the offline effect; full suite green.
</verification>

<success_criteria>
- 3.1.0's planner and executor no longer pay for the diagnosed causes, and no AOForge instruction makes an agent guess
  a home directory.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-07-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, listing each Fix-list row with its commit and test, and
the offline effect numbers.
</output>
