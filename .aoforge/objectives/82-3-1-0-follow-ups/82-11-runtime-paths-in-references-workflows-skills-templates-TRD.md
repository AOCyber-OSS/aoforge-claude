---
objective: 82-3-1-0-follow-ups
trd: "11"
type: standard
wave: 2
depends_on: ["82-02"]
files_modified:
  - plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
  - "plugins/aoforge/aoforge/references/*.md (anti-patterns, unattended-operation, verification-patterns, trd-spec, model-profile-resolution, defaults-table, testing-strategy, built-ins: only lines the guard flags)"
  - "plugins/aoforge-stack-flutter/{agents,fragments,profiles,references}/**/*.md and plugins/aoforge-stack-web/{agents,fragments}/**/*.md (only lines the guard flags, and the pinned block)"
  - "plugins/aoforge/aoforge/workflows/*.md (spawn prompts and flagged lines)"
  - "plugins/aoforge/skills/**/SKILL.md (flagged lines and spawn prompts only)"
  - "plugins/aoforge/aoforge/templates/**/*.md (flagged lines only)"
  - "plugins/aoforge-stack-flutter/{skills,workflows}/**/*.md and plugins/aoforge-stack-web skills/workflows (flagged lines and spawn prompts only)"
  - scripts/eval81/batches/A.test.cjs
  - scripts/eval81/batches/B.test.cjs
  - scripts/eval81/batches/C.test.cjs
autonomous: true
requirements: [SC-2]
must_haves:
  truths:
    - "No reference or pack agent-material file asks an agent to Read a `~/` path: they name `<runtime>/<rel>`; trd-spec.md's TRD skeleton `<execution_context>` lines name `<runtime>/workflows/execute-trd.md` and `<runtime>/templates/summary.md`; every pack agent that names `<runtime>/` carries 82-02's pinned `<runtime_paths>` block"
    - "No workflow, skill or template asks an agent or the orchestrator to Read a `~/` path; the guard's PENDING list is empty and ENFORCED holds every scope, with zero offenders on the real tree"
    - "Every `Task(` spawn of an AOForge or pack agent in core workflows, core skills and pack skills/workflows carries the line `AOForge runtime: {runtime_root}` inside its prompt, and every file with such a spawn supplies `{runtime_root}` from an `aof-tools init` JSON (82-02) or a `RUNTIME_ROOT=$(echo ~/.claude/aoforge)` fallback"
    - "Objective 81's frozen harness modules are untouched; its A/B/C unit tests that compare frozen spawn templates with the live workflows drop exactly the line `AOForge runtime: {runtime_root}`, with a comment naming objective 82, and pass; 81's prereg check stays OK"
    - "The full suite passes (watcher-shell excluded and named)"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
      provides: "the guard enforced on every scope, with the spawn-line tests"
  key_links:
    - from: "spawn prompts in workflows and skills"
      to: "agents' <runtime_paths> block (82-02)"
      via: "AOForge runtime: {runtime_root}"
      pattern: "AOForge runtime: \\{runtime_root\\}"
    - from: plugins/aoforge/aoforge/workflows/new-project.md
      to: scripts/eval82/batches/C.cjs
      via: "the researcher spawn's runtime line, filled with the sandbox runtime root by 82-06's batch C"
      pattern: "AOForge runtime"
    - from: plugins/aoforge/aoforge/references/trd-spec.md
      to: "every future TRD's <execution_context>"
      via: "the planner copies the skeleton lines"
      pattern: "<runtime>/workflows/execute-trd.md"
---

# TRD 82-11: Absolute runtime paths in references, pack material, workflows, skills and templates

<objective>
82-02 gave every init an absolute `runtime_root`, rewrote the core agents and added the guard with every other scope
PENDING. Finish SC-2's text half scope by scope: references and pack agent material first (agents read them), then
workflows with their spawn prompts (the orchestrator reads them and hands `AOForge runtime: {runtime_root}` to every
agent it spawns), then skills, templates and pack skills/workflows, moving each scope to ENFORCED as it turns green.
82-07's build-cell fixes edit some of the same workflow lines and run after this TRD.

Purpose: SC-2 (orchestrator-facing half; the guard on every scope).
Output: rewritten references, pack material, workflows, skills and templates; spawn lines; the guard fully enforced.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/objectives/82-3-1-0-follow-ups/82-02-SUMMARY.md

Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
Never push or tag; never port 8080; never write the real `~/.claude`. Tests:
`SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-11 TMPDIR=$SP/tmp-82-11 node --test <files>`.

From 82-02 (read its SUMMARY for the PENDING counts per scope): every compound init JSON has `runtime_root`; core
agents carry the pinned `<runtime_paths>` block (the guard's `RUNTIME_BLOCK` constant, byte for byte) and name runtime
files `<runtime>/<rel>`; `runtime-path-reads.repo.test.cjs` has SCOPES `core_agents` (ENFORCED) and `core_references`,
`pack_agent_material`, `core_workflows`, `core_skills`, `core_templates`, `pack_skills_workflows` (PENDING). Allowed
classes: shell commands, skill line-start `@~/` includes (Claude Code expands them), CLAUDE.md template imports, ALLOW
entries (at most 12; an agent-read instruction is never allowlisted).

Inventory at planning time (non-`node` occurrences of `~/.claude/aoforge`): references 12 — anti-patterns 28,
unattended-operation 135, verification-patterns 761, trd-spec 43-44 (the TRD skeleton's `<execution_context>` lines,
which the planner copies into every TRD), model-profile-resolution 24, defaults-table 32 and 40 (user-file locations:
ALLOW candidates), testing-strategy 27/80/87, built-ins 3. Pack agent material (15 raw matches, most of them shell
`node ~/.claude/aoforge/stacks/...` lines, which stay): flutter fragments/executor 63 and 246, fragments/planner 36,
profiles dart 60 and flutter 53.
Workflows 52 occurrences and 39 `Task(` blocks; core skills 65 occurrences (35 are line-start `@~/` includes, allowed)
and 4 `Task(` blocks; templates 25; pack skills/workflows 7 (the line-start includes are allowed).

Readers decide the form:
- References and pack agent material are read by agents: `<runtime>/<rel>` (the agent's `<runtime_paths>` block says
  where `<runtime>` comes from). A pack agent that gains `<runtime>/` gets the pinned block after `</role>`.
- Workflows are read by the main-session orchestrator, which already ran its init: name runtime files as
  `{runtime_root}/<rel>` ("`runtime_root` from the init JSON above"). A workflow with no init call names the fallback
  once: `RUNTIME_ROOT=$(echo ~/.claude/aoforge)` and then `{runtime_root}` means that value.
- Skills: a mid-line runtime path the skill does not include at a line start becomes `{runtime_root}/<rel>` when the
  skill runs an init, else `<runtime>/<rel>` with the fallback line. Templates: one that becomes a planning file an
  agent reads uses `<runtime>/<rel>`; one that becomes CLAUDE.md keeps line-start imports.
- Spawn prompts (44 `Task(` blocks across workflows, skills and pack skills) get the line `AOForge runtime: {runtime_root}`
  inside the prompt text, right after its opening tag/line; keep each block's closing shape byte-identical (for
  example the researcher tail `", subagent_type="project-researcher", model="{researcher_models.<dim>}"` that 81's C
  extractor and 82-06's batch C find).

The executor spawn in `execute-objective.md` (two places, about lines 430 and 1043) lists runtime files "Read these
files yourself" (`~/.claude/aoforge/templates/summary.md`, `references/checkpoints.md`, `references/tdd.md`,
`anti-patterns.md`, `workflows/execute-trd.md`): rewrite each to `{runtime_root}/<rel>` and leave the list's entries
and conditions as they are; 82-07's E-rows change the list after this TRD.

Objective 81's unit tests `scripts/eval81/batches/A.test.cjs` (verifier spawn in execute-objective.md, anchor
`Task(\n  prompt="Verify objective`), `B.test.cjs` (job-checker spawn in plan-objective.md) and `C.test.cjs` (mapper
blocks in map-codebase.md, researcher Tasks in new-project.md) assert the FROZEN modules' templates equal the live
spawn prompts. Unit tests are outside 81's freeze (prereg excludes `**/*.test.cjs`); the modules are inside it. When a
spawn prompt gains the runtime line, change only the comparison: drop lines equal to `AOForge runtime: {runtime_root}`
(after trimming indentation) from the live text before comparing, with a comment naming objective 82.
</context>

<embedded_context>

<codebase_examples>
Spawn prompt shape after Task 2 (execute-objective.md executor spawn):
```
     prompt="
       AOForge runtime: {runtime_root}

       <objective>
       Execute plan {plan_number} of objective {objective_number}-{objective_name}.
       ...
       <execution_context>
       A Task prompt does not expand @ references. Read these files yourself, each at the moment it is needed:
       - {runtime_root}/templates/summary.md — before the first checkpoint
       - {runtime_root}/references/checkpoints.md — only if the TRD has a checkpoint task, before that task
       ...
```
Rewrite shapes:
```
See also: `@~/.claude/aoforge/references/tdd.md` for ...        →   See also: `<runtime>/references/tdd.md` for ...   (reference)
@~/.claude/aoforge/workflows/execute-trd.md   (trd-spec skeleton) →   <runtime>/workflows/execute-trd.md
Read ~/.claude/aoforge/references/ui-brand.md   (workflow)        →   Read {runtime_root}/references/ui-brand.md
@~/.claude/aoforge/workflows/quick.md   (SKILL.md line start)     →   unchanged (skill_include)
node ~/.claude/aoforge/bin/aof-tools.cjs init quick ...           →   unchanged (shell)
```
</codebase_examples>

<anti_patterns>
- Rewriting shell commands or a skill's line-start `@~/` include (both expand `~`).
- Hard-coding `/Users/...`, or a second placeholder name: agents use `<runtime>`, orchestrator text uses `{runtime_root}`.
- Changing anything a FIX row of 82-DIAGNOSIS.md owns (the executor spawn's list entries and conditions, planner step
  text): 82-07 does that next; here only the path form changes.
- Editing scripts/eval81 modules (only its three unit tests' comparisons, as described).
- Growing ALLOW to dodge rewrites; ALLOW is for human-facing statements of where a user file lives.
</anti_patterns>

<error_recovery>
- A workflow's Task block is a prose description rather than a literal spawn (test 2 finds no prompt string): exempt it
  in the test by name with a reason, and say so in the SUMMARY.
- The context-budget guard (skills <= 90,000 resolved chars, agents <= 65,000) fails after adding blocks or lines:
  shorten the added text, never raise a cap.
- model-placeholders.repo.test.cjs flags `{runtime_root}`: it is not a model placeholder; the line sits in a `model=`
  position by mistake.
- An existing test pins the old `~/` wording: update the assertion to the new form in the same GREEN commit and name it
  in the SUMMARY.
</error_recovery>

</embedded_context>

## Test list

runtime-path-reads.repo.test.cjs (extended; outermost: the real tree)
1. Real tree, per scope as it moves to ENFORCED: zero offenders, `file:line` listed per offender; after Task 3 PENDING
   is empty and ENFORCED holds every scope.
2. Every `Task(` block in core workflows, core skills and pack skills/workflows whose `subagent_type` names an AOForge
   or pack agent carries a line `AOForge runtime: {runtime_root}` inside its prompt (run per scope as each moves).
3. Every file with such a spawn supplies `{runtime_root}`: it runs an `aof-tools.cjs init <cmd>` (whose JSON has
   runtime_root, checked by 82-02's runtime-root.test.cjs) or defines `RUNTIME_ROOT=$(echo ~/.claude/aoforge)`.
4. Every pack agent file containing `<runtime>/` carries the pinned `<runtime_paths>` block exactly once (82-02's test
   13 covers this once pack agents change; it must stay green).
5. trd-spec.md's skeleton `<execution_context>` names `<runtime>/workflows/execute-trd.md` and
   `<runtime>/templates/summary.md` and no `@~/` line.
scripts/eval81 unit tests
6. A/B/C template comparisons pass with exactly the runtime line ignored; a live prompt with any other added line still
   fails the comparison (one hand-built negative case per file).

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: References and pack agent material (test list 1, 4, 5 for core_references and pack_agent_material)</name>
  <files>plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs, plugins/aoforge/aoforge/references/*.md (flagged lines only), plugins/aoforge-stack-flutter/{agents,fragments,profiles,references}/**/*.md and plugins/aoforge-stack-web/{agents,fragments}/**/*.md (flagged lines and the pinned block only)</files>
  <action>
RED: in the guard move `core_references` and `pack_agent_material` to ENFORCED and add test 5; run it (offenders
listed). Commit `AOF commit "test(82-11): enforce the runtime-path guard on references and pack agent material (RED)" --files plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs`.
GREEN: rewrite each offender to `<runtime>/<rel>` keeping its condition; trd-spec.md's skeleton lines as test 5; the
defaults-table user-file statements become ALLOW entries only if they tell a human where to edit a file (reason in the
entry), else `<runtime>/`; insert the pinned block after `</role>` in each pack agent that now names `<runtime>/`. Do
not touch `node ~/...` lines. Run the guard, context-budget, stack-neutrality, rename, doc-refs, and every test that
reads reference or pack text (`rg -l -e "references'" -e 'fragments' -e 'stack-profiles' plugins/aoforge/aoforge/bin/lib plugins/aoforge-stack-flutter/lib --glob '*.test.*'`).
Commit `AOF commit "fix(82-11): references and pack agent material name runtime files at <runtime>" --files <every changed file>`.
  </action>
  <verify>The guard passes with core_agents, core_references and pack_agent_material ENFORCED (the other four PENDING, counts printed); context-budget, stack-neutrality, rename and doc-refs pass</verify>
  <done>Everything an agent reads names runtime files at `<runtime>/`, and the TRD skeleton the planner copies does too.</done>
  <recovery>A reference is only ever included by a skill (never read by an agent): use `{runtime_root}/` there only if that skill runs an init; otherwise `<runtime>/` with a one-line note of where it comes from; never a third form.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Workflows, their spawn lines and 81's template comparisons (test list 1-3 for core_workflows, 6)</name>
  <files>plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs, plugins/aoforge/aoforge/workflows/*.md, scripts/eval81/batches/A.test.cjs, scripts/eval81/batches/B.test.cjs, scripts/eval81/batches/C.test.cjs</files>
  <action>
RED: move `core_workflows` to ENFORCED and add tests 2-3 scoped to workflows; in A/B/C.test.cjs add test 6's negative
case. Run (offenders and missing spawn lines listed; 81's comparisons fail once the lines land). Commit
`AOF commit "test(82-11): workflows carry the runtime line and no ~ reads (RED)" --files plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs scripts/eval81/batches/A.test.cjs scripts/eval81/batches/B.test.cjs scripts/eval81/batches/C.test.cjs`.
GREEN: rewrite each workflow offender to `{runtime_root}/<rel>`; add the spawn line to every AOForge agent spawn; add
the `RUNTIME_ROOT` fallback line to a spawning workflow with no init; change A/B/C.test.cjs comparisons per context. A
one-off script under `$SP/82-11/` may do the mechanical part; review every hunk of execute-objective.md,
plan-objective.md, new-project.md, map-codebase.md, quick.md and build.md by hand. Run the guard, model-placeholders,
context-budget, builtin-sweep, planning-writes, doc-refs, rename and stack-neutrality guards,
`node --test scripts/eval81/batches/*.test.cjs`, and `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`.
Commit `AOF commit "fix(82-11): workflow spawns carry the absolute runtime root; no ~ reads in workflows" --files <every changed file>`.
  </action>
  <verify>The guard passes with core_workflows ENFORCED; `rg -n 'AOForge runtime: \{runtime_root\}' plugins/aoforge/aoforge/workflows | rg -c .` equals the workflow spawn count test 2 reports; eval81 batch tests pass; 81's prereg check OK</verify>
  <done>Every workflow spawn hands its agent the absolute runtime path, and no workflow asks for a `~/` Read.</done>
  <recovery>If a comparison in A/B/C.test.cjs fails for a reason other than the runtime line, stop and report: the spawn changed in a way 81's frozen template does not model, and 82-06's batch C extractor depends on it.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Skills, templates and pack skills/workflows; PENDING emptied (test list 1-3 for the remaining scopes)</name>
  <files>plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs, plugins/aoforge/skills/**/SKILL.md (flagged lines and spawns only), plugins/aoforge/aoforge/templates/**/*.md (flagged lines only), pack skills/workflows (flagged lines and spawns only)</files>
  <action>
RED: move `core_skills`, `core_templates` and `pack_skills_workflows` to ENFORCED (PENDING becomes empty; test 1's
final assertion) and extend tests 2-3 to skills and pack skills; run. Commit
`AOF commit "test(82-11): enforce the runtime-path guard on skills and templates (RED)" --files plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs`.
GREEN: rewrite each offender per context (skills: `{runtime_root}/` with an init, else the fallback; templates by
their reader); add the spawn line to the skills' and pack skills' AOForge agent spawns. Run the guard,
model-placeholders, context-budget, builtin-sweep, planning-writes, doc-refs, rename, stack-neutrality, the init and
runtime-root tests, then the full suite once (npm test's globs, `watcher-shell.test.cjs` excluded and named,
HOME/TMPDIR under $SP) and record tests/pass/fail. Commit
`AOF commit "fix(82-11): no ~ reads in skills or templates; the guard enforces every scope" --files <every changed file>`.
  </action>
  <verify>The guard passes with PENDING empty; every listed guard passes; full suite 0 fail / 0 cancelled with the one named exclusion</verify>
  <done>SC-2's text half is complete: no `~/` read instruction anywhere in scope, and every spawn hands the agent its absolute runtime path.</done>
  <recovery>A full-suite failure outside these files: run the same file in a scratch worktree at the commit before this TRD's first; pre-existing only if it fails there too; otherwise fix it here or return failed.</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (locally: npm test's globs with `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` excluded for its fish hang; HOME/TMPDIR under the session scratchpad)</test>
</validation_gates>

<verification>
- The guard enforces every scope with zero offenders; every AOForge spawn carries the runtime line and its file
  supplies `{runtime_root}`; 81's frozen modules untouched and its A/B/C tests green; full suite green.
</verification>

<success_criteria>
- No AOForge instruction anywhere makes an agent or the orchestrator guess a home directory, and every spawned agent
  is told its absolute runtime path; CI fails if either regresses.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-11-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the offender counts per scope before and after,
the spawn count, the ALLOW entries added with reasons, and any exempted Task block.
</output>
