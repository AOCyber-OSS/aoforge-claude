---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "07"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval81/static-prompt.cjs
  - scripts/eval81/static-prompt.test.cjs
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-STATIC-PROMPT.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json
autonomous: true
requirements: [SC-4]
must_haves:
  truths:
    - "`node scripts/eval81/static-prompt.cjs --from v3.0.0 --to <ref>` reads both trees through `git show` (no checkout, no worktree) and reports, per spawned agent, the agent definition bytes, the largest spawn-prompt template bytes, the bytes of `@` paths named in either, and a resident estimate in bytes and tokens (4 chars per token)"
    - "Every spawn template it measures is identified by file and line, so each number can be checked by hand"
    - "81-STATIC-PROMPT.md compares 3.0.0 and 3.1.0 per agent with the delta, counts stack-pack agents separately, and states that named `@` paths are reported apart because they do not cross the Task boundary"
    - "results/static-prompt.json carries the same numbers for the 76-08 report (TRD 81-12 reads it)"
  artifacts:
    - path: scripts/eval81/static-prompt.cjs
      provides: "measureRef, extractSpawnPrompts, namedAtPaths, compare, CLI"
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-STATIC-PROMPT.md
      provides: "the free static resident-prompt comparison (part of 76-08)"
  key_links:
    - from: scripts/eval81/static-prompt.cjs
      to: plugins/aoforge/aoforge/bin/lib/context-audit.cjs
      via: "CHARS_PER_TOKEN"
      pattern: "CHARS_PER_TOKEN"
---

# TRD 81-07: Static resident-prompt comparison, 3.0.0 vs 3.1.0 (free half of 76-08)

<objective>
Measure, without any model call, how many bytes each agent spawn carries in 3.0.0 and in 3.1.0: the agent
definition (the subagent's system prompt), the orchestrator's spawn prompt template, and the `@` paths either one
names. Publish the comparison and a JSON copy for the 76-08 report.

Purpose: SC-4 asks for "the static resident-prompt bytes per spawn" next to the live per-role numbers from test E.
Objective 76 cut the executor, verifier and planner prompts (Flutter procedure moved to packs, dead `@` lists
dropped); this puts numbers on that from the two release trees.
Output: a tested script, `81-STATIC-PROMPT.md` and `results/static-prompt.json`. No model call, no network.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Spawn template shapes the extractor must handle (both exist in both trees):

1. `Task(` blocks with a `prompt="..."` string and `subagent_type="<agent>"`, e.g.
   `plugins/aoforge/aoforge/workflows/execute-objective.md` ~line 1250 (verifier), `plan-objective.md` ~670
   (job-checker, whose prompt is a fenced block named "Checker prompt:" above the call), `quick.md` 201/369,
   `research-objective.md` 90, `build.md` 278, `new-project.md` 625-742 (project-researcher, prompt string ends with
   `", subagent_type="project-researcher", ...)`).
2. map-codebase.md's parameter block (`subagent_type: "codebase-mapper"`) followed by a fenced `Prompt:` block, four
   times (one per focus).

When a spawn's prompt is a variable filled from an earlier fenced block (plan-objective's `checker_prompt`), take
that fenced block. When the extractor cannot find a prompt for a site, record the site with `prompt_bytes: null`
and a reason; never guess.

Agents: `plugins/aoforge/agents/*.md` in both trees; in 3.1.0 also `plugins/aoforge-stack-flutter/agents/
ui-evaluator.md` and `plugins/aoforge-stack-web/agents/web-ui-verifier.md` (pack agents; in 3.0.0 ui-evaluator was
a core agent: `git diff --stat v3.0.0 HEAD -- plugins/aoforge/agents` shows it removed from core and verifier.md
-301 lines).

`plugins/aoforge/aoforge/bin/lib/context-audit.cjs` exports `CHARS_PER_TOKEN` (4).
</codebase_examples>

<anti_patterns>
- Do not check out either ref or add a worktree: `git show <ref>:<path>` and `git ls-tree -r --name-only <ref>`
  read everything needed and touch nothing.
- Do not count `@` path bytes as resident: objective 76's audit found they do not cross the Task boundary. Report
  them in their own column.
- No generated test data: the unit tests use hand-written workflow snippets and a temp git repo with two tags.
</anti_patterns>

<error_recovery>
- A workflow present in one ref but not the other: report the role's template as absent in that ref.
- `git show` failing for a path listed by ls-tree (should not happen): throw with the ref and path.
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@.aoforge/objectives/76-model-efficiency-and-stack-specific-content/OBJECTIVE.md (the 2026-10-15 audit findings)

Refs: `v3.0.0` (b4a9d870, the 3.0.0 release) and the 3.1.0 tree = this branch's HEAD at the time of the run (record
the SHA in the report). Write the report directly in local planning mode (as 79-REVALIDATION.md was) and commit it
with `aof-tools commit`.
</context>

## Test list

1. CLI: `--from <tagA> --to <tagB> --json <file>` on a temp repo with two tagged trees writes JSON with one row per
   agent present in either tree and exits 0; an unknown ref exits 1 naming it.
2. extractSpawnPrompts finds a `Task(prompt="...", subagent_type="verifier", ...)` block and returns its prompt
   bytes, file and line.
3. It finds the map-codebase style (`subagent_type: "codebase-mapper"` parameter block plus a following fenced
   `Prompt:` block) once per focus.
4. It resolves a `prompt=checker_prompt` call to the nearest preceding fenced block labelled "Checker prompt:".
5. A site whose prompt cannot be found is returned with `prompt_bytes: null` and a reason.
6. namedAtPaths lists `@~/.claude/aoforge/<rest>` paths, maps them to `plugins/aoforge/aoforge/<rest>` in the ref,
   and sums the bytes of those that exist (missing ones listed, not counted).
7. compare() gives per agent `{from, to, delta_bytes, delta_pct}` for agent bytes, max spawn bytes and the resident
   estimate, and marks pack agents.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Static prompt measurement script</name>
  <files>scripts/eval81/static-prompt.cjs, scripts/eval81/static-prompt.test.cjs</files>
  <action>
RED first per test list 1-7, one test at a time. Hand-built snippets for 2-6; for 1, build a temp repo with
`git init`, two commits with small `plugins/aoforge/agents/*.md` and `plugins/aoforge/aoforge/workflows/*.md` files,
tags `t1` and `t2` (deterministic env: GIT_CONFIG_GLOBAL=/dev/null, fixed dates, gpgsign off).

Exports: `measureRef(repo, ref)` → `{ref, sha, agents: {<name>: {path, agent_bytes, body_bytes, pack: bool,
spawn_sites: [{file, line, prompt_bytes, reason}], max_spawn_bytes, named_at: {paths, bytes, missing},
resident_bytes, resident_tokens}}}`, `extractSpawnPrompts(text, file)`, `namedAtPaths(text)`, `compare(a, b)`;
CLI `--from --to [--repo .] [--json <file>] [--md <file>]`.
  </action>
  <verify>node --test scripts/eval81/static-prompt.test.cjs</verify>
  <done>Test list 1-7 pass; the script never writes outside `--json`/`--md`.</done>
  <recovery>If a real spawn site is not matched by either pattern, add its exact shape as a new test case before extending the extractor.</recovery>
</task>

<task type="auto">
  <name>Task 2: Run 3.0.0 vs 3.1.0 and publish the comparison</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-STATIC-PROMPT.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json</files>
  <action>
Run `node scripts/eval81/static-prompt.cjs --from v3.0.0 --to HEAD --json .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json --md <scratch>/static.md`.
Spot-check three numbers by hand (the verifier agent bytes with `git show v3.0.0:plugins/aoforge/agents/verifier.md
| wc -c`, one spawn prompt, one named-@ sum). Write `81-STATIC-PROMPT.md`: method (what counts as resident, what
does not, the 4 chars/token estimate), refs and SHAs, the per-agent table (3.0.0, 3.1.0, delta) sorted by resident
delta, the pack-agent note, spawn sites with `prompt_bytes: null` and why, and the hand spot-checks. State plainly
that these are static bytes; the live first-turn input tokens per role come from test E (TRD 81-17).
Commit both files with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-07): static resident-prompt comparison 3.0.0 vs 3.1.0" --files <both paths>`.
  </action>
  <verify>The three hand spot-checks equal the script's numbers; `git show --stat HEAD` lists the two files.</verify>
  <done>Report and JSON committed; every agent spawned by a workflow in either tree has a row.</done>
  <recovery>If a spot-check disagrees, fix the script (Task 1, with a new test) and re-run before committing.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/static-prompt.test.cjs</test>
</validation_gates>

<verification>
- `git status --porcelain` shows no checkout-side change other than the two committed files.
- `git worktree list` is unchanged by this TRD.
</verification>

<success_criteria>
A reproducible, hand-checkable static comparison of resident prompt bytes per spawn for 3.0.0 and 3.1.0, committed
and available as JSON to the 76-08 report.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-07-SUMMARY.md`
</output>
