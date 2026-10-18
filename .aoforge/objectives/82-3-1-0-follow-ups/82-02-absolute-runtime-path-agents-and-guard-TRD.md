---
objective: 82-3-1-0-follow-ups
trd: "02"
type: standard
wave: 1
depends_on: []
files_modified:
  - plugins/aoforge/aoforge/bin/lib/init.cjs
  - plugins/aoforge/aoforge/bin/lib/runtime-root.test.cjs
  - plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
  - "plugins/aoforge/agents/*.md (every agent with a non-shell runtime path)"
  - "plugins/aoforge/aoforge/references/*.md (anti-patterns, unattended-operation, verification-patterns, trd-spec, model-profile-resolution, defaults-table, testing-strategy, built-ins: only lines the guard flags)"
  - "plugins/aoforge-stack-flutter/{agents,fragments,profiles,references}/**/*.md and plugins/aoforge-stack-web/{agents,fragments}/**/*.md (only lines the guard flags)"
autonomous: true
requirements: [SC-2]
must_haves:
  truths:
    - "Every compound `aof-tools init <cmd>` JSON carries `runtime_root`, the absolute runtime directory built by compat.runtimeHome(os.homedir()), with no `~` in it; --raw single-field outputs are unchanged"
    - "runtime-path-reads.repo.test.cjs classifies every `~/.claude/aoforge` occurrence as shell, skill include, memory import, allowlisted or offender, and fails on any offender in the enforced scopes (agents, references, pack agent material)"
    - "No agent, reference or pack agent-material file asks an agent to Read a `~/` path: runtime files are named `<runtime>/<rel>`, and every agent that names one carries the pinned `<runtime_paths>` block telling it where `<runtime>` comes from"
    - "Workflows, skills and templates are listed as PENDING scopes in the guard (reported, not failing) so 82-07 can enforce them; no scope is in neither list"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
      provides: "the guard SC-2 asks for"
    - path: plugins/aoforge/aoforge/bin/lib/runtime-root.test.cjs
      provides: "init runtime_root tests"
  key_links:
    - from: plugins/aoforge/aoforge/bin/lib/init.cjs
      to: "spawn prompts (82-07) and agents' <runtime_paths> block"
      via: "runtime_root JSON field"
      pattern: "runtime_root"
    - from: plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs
      to: "82-07 Task 1"
      via: "PENDING scopes emptied there"
      pattern: "PENDING"
---

# TRD 82-02: Agents get an absolute runtime path, and a guard keeps `~` reads out

<objective>
The Read tool does not expand `~`. When an agent prompt says "Read ~/.claude/aoforge/references/tdd.md", the agent
must invent an absolute home: in objective 81's sandbox the 3.1.0 executor guessed the real home (denied) and
`/Users/aocyber` (absent). Give every init an absolute `runtime_root`, rewrite the agent-facing material to name
runtime files as `<runtime>/<rel>` with one pinned block that says where `<runtime>` comes from, and add the repo guard
that fails if a `~/` read instruction returns. Workflows, skills and templates follow in 82-07 (same guard).

Purpose: SC-2 (agents half; the guard).
Output: `runtime_root` in init, the guard, rewritten agents/references/pack agent material.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
Never push or tag; never port 8080; never write the real `~/.claude`. Tests: `SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-02 TMPDIR=$SP/tmp-82-02 node --test <files>`.

The mirror resolution already exists: `plugins/aoforge/aoforge/bin/lib/compat.cjs` `runtimeHome(home)` returns
`<home>/.claude/aoforge`; `hooks/sync-runtime.js` mirrors to `path.join(os.homedir(), '.claude', 'aoforge')`. Use
`runtimeHome(os.homedir())` (one source). `init.cjs` has 13 compound commands (`cmdInitExecuteObjective`,
`cmdInitPlanObjective`, `cmdInitNewProject`, `cmdInitNewMilestone`, `cmdInitQuick`, `cmdInitResume`,
`cmdInitVerifyWork`, `cmdInitObjectiveOp`, `cmdInitTodos`, `cmdInitMilestoneOp`, `cmdInitMapCodebase`,
`cmdInitSecurityAudit`, `cmdInitProgress`), each ending in `output(result, raw[, field])`.

Inventory at planning time (`rg -n '~/\.claude/aoforge' ... | rg -v 'node ~/\.claude/aoforge/bin'`): 186 non-`node`
occurrences in core, 14 in the packs. Agents: 9 `@~/` lines (objective-researcher 89, codebase-mapper 212,
job-checker 49, planner 318, integration-checker 32, verifier 690, executor 335, debugger 107, project-researcher 67)
and prose reads in planner (488, 494, 506, 512), executor (281, 316, 510, 514, 527, 552, 575, 741), verifier (87, 709),
roadmapper (353, 357), codebase-mapper (156, 161), research-synthesizer (122, 139), debugger 574, project-researcher 76.
References: anti-patterns 28, unattended-operation 135, verification-patterns 761, trd-spec 43-44 (the TRD skeleton's
`<execution_context>` lines, which the planner copies into every TRD), model-profile-resolution 24, defaults-table
32 and 40, testing-strategy 27/80/87, built-ins 3. Pack: flutter fragments/executor 63 and 246, fragments/planner 36,
profiles dart 60 and flutter 53 (shell `node ~/...` lines are fine as they are).

Constraint from the context-budget guard: each agent body stays under 65,000 chars (executor.md is about 49.6K).
</context>

<embedded_context>

<codebase_examples>
The pinned block (exact text; the guard compares it byte for byte; place it right after `</role>`):
```
<runtime_paths>
`<runtime>` in this prompt is the absolute path of the AOForge runtime directory (the `~/.claude/aoforge` mirror). Take it from the `AOForge runtime:` line of your spawn prompt; else from `runtime_root` in the JSON of an `aof-tools init` command you already ran; else run `echo ~/.claude/aoforge` once in Bash and use the path it prints. The Read tool does not expand `~`: never type a home directory yourself, and never Read a path that starts with `~`. Shell commands (`node ~/.claude/aoforge/bin/aof-tools.cjs ...`) keep `~`, because the shell expands it.
</runtime_paths>
```
Rewrite shapes:
```
Read ~/.claude/aoforge/references/trd-spec.md with the Read tool ...   →   Read `<runtime>/references/trd-spec.md` with the Read tool ...
@~/.claude/aoforge/references/debugging-methods.md                     →   Read `<runtime>/references/debugging-methods.md` when ... (keep the agent's existing "when")
`~/.claude/aoforge/templates/codebase/`                                  →   `<runtime>/templates/codebase/`
node ~/.claude/aoforge/bin/aof-tools.cjs state digest --raw             →   unchanged (shell)
```
Guard occurrence classes (first match wins):
- `shell`: inside a fenced block whose info string is empty, bash, sh, shell, zsh or console, or inside an inline code
  span, when the text from the start of that code line/span to the occurrence contains a shell word (node, cat, ls,
  rg, grep, sed, awk, head, tail, test, wc, find, mkdir, cp, mv, rm, echo, jq, cd, diff, cmp, git, bash, sh, xargs,
  env, printf, tee, touch, stat, du, realpath) or `$(`, `|`, `&&`, or a `NAME=` assignment.
- `skill_include`: in a `skills/**/SKILL.md` (core or pack), a line starting with `@~/.claude/aoforge/`; or a
  mid-line `@~/.claude/aoforge/<rel>` whose `<rel>` the same file includes at a line start (already in context).
- `memory_import`: in `templates/claude-md.md` or `templates/global-claude-md.md`, a line starting with `@~/`
  (CLAUDE.md imports expand `~`).
- `allow`: an entry of the guard's ALLOW list `{file, needle, reason}` (a human-facing statement of where a user file
  lives, e.g. "edit `~/.claude/aoforge/defaults-table.md`"); at most 12 entries; a stale entry fails the guard.
- `offender`: everything else.
</codebase_examples>

<anti_patterns>
- Rewriting shell commands: `node ~/.claude/aoforge/bin/...` stays (the shell expands `~`); only Read/@/prose
  references change.
- Hard-coding `/Users/...` anywhere, or computing `runtime_root` from anything but compat.runtimeHome(os.homedir()).
- Changing a `--raw` single-value output of an init (callers parse those).
- Putting workflows, skills or templates in the enforced set here (82-07 owns them and touches the same lines as its
  fixes); they are PENDING.
- Growing ALLOW to dodge rewrites: an agent-read instruction is never allowlisted.
</anti_patterns>

<error_recovery>
- An existing test asserts the old wording (for example a test reading planner.md or executor.md for a `~/` read
  line): update that assertion to the `<runtime>/` form in the same GREEN commit and name it in the SUMMARY.
- A reference is read by the main session as well as by agents (via a skill include): `<runtime>/` still works there
  only if the reader knows `<runtime>`; if a reference is included by a skill and not read by an agent, leave it for
  82-07 (move its scope to PENDING with a comment) rather than inventing a second token.
</error_recovery>

</embedded_context>

## Test list

runtime-root.test.cjs (outermost: the CLI)
1. Each of the 13 `init <cmd>` commands, run with `spawnSync(process.execPath, [aof-tools, 'init', ...])` in a fixture
   project with `HOME=<fixture home>`, prints JSON whose `runtime_root` equals `path.join(<fixture home>, '.claude', 'aoforge')`.
2. `runtime_root` is absolute, contains no `~`, is the same from two different cwds, and is printed when the runtime
   directory does not exist (init never creates it).
3. An init whose `--raw` prints one field still prints only that field.

runtime-path-reads.repo.test.cjs
4. Unit: a bash fence line `node ~/.claude/aoforge/bin/aof-tools.cjs init x` → shell; inline `` `cat ~/.claude/aoforge/x.md` `` → shell.
5. Unit: inline `` `~/.claude/aoforge/x.md` `` alone, and prose `Read ~/.claude/aoforge/references/tdd.md` → offender.
6. Unit: `@~/.claude/aoforge/workflows/quick.md` at a line start in a SKILL.md → skill_include; the same line in an
   agent → offender; mid-line `@~/.claude/aoforge/x.md` in a SKILL.md → skill_include only when x.md is also included
   at a line start.
7. Unit: a line-start `@~/` in templates/claude-md.md → memory_import.
8. Unit: an ALLOW entry matches → allow; a stale ALLOW entry (needle absent) is reported by test 12.
9. Unit: `<runtime>/references/tdd.md` is never an occurrence.
10. Real tree, enforced scopes (core agents, core references, pack agents/fragments/profiles/references): zero
    offenders; the message lists `file:line` per offender (RED before Task 3 with the count).
11. Every scope is in ENFORCED or PENDING (none forgotten); PENDING scopes print their offender counts and do not fail.
12. Every ALLOW entry still matches its file.
13. Every core and pack agent file containing `<runtime>/` carries the pinned `<runtime_paths>` block exactly once;
    executor, planner and verifier carry it (they read pack fragments and references).
14. Coverage: more than 60 files scanned, including agents/executor.md and references/trd-spec.md.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: runtime_root in every compound init (test list 1-3)</name>
  <files>plugins/aoforge/aoforge/bin/lib/init.cjs, plugins/aoforge/aoforge/bin/lib/runtime-root.test.cjs</files>
  <action>
Fixture builder first, inside the test file: `makeProject({home})` creates a temp project with `.aoforge/` holding the
minimal PROJECT.md, ROADMAP.md (one objective `01-demo` with OBJECTIVE.md), STATE.md and config.json each init needs,
and a temp HOME; reuse an existing init test helper if one builds this (look in `init.test.cjs`). RED: tests 1-3,
commit `AOF commit "test(82-02): init prints runtime_root (RED)" --files plugins/aoforge/aoforge/bin/lib/runtime-root.test.cjs`.
GREEN: in init.cjs add one helper `runtimeRootField()` returning `{ runtime_root: compat.runtimeHome(os.homedir()) }`
(import `runtimeHome` from `./compat.cjs`) and spread it into every `result` before `output(...)`. Commit
`AOF commit "feat(82-02): init prints the absolute runtime_root" --files plugins/aoforge/aoforge/bin/lib/init.cjs plugins/aoforge/aoforge/bin/lib/runtime-root.test.cjs`.
Then run the init, model-placeholders and model-profiles test files (their init JSON grows by one key).
  </action>
  <verify>`env HOME=$SP/home-82-02 TMPDIR=$SP/tmp-82-02 node --test plugins/aoforge/aoforge/bin/lib/runtime-root.test.cjs plugins/aoforge/aoforge/bin/lib/init.test.cjs plugins/aoforge/aoforge/bin/lib/model-placeholders.repo.test.cjs plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs` all pass</verify>
  <done>All 13 inits print an absolute runtime_root; nothing else in their output changed.</done>
  <recovery>If an init lives outside init.cjs (grep `cmdInit` in aof-tools.cjs), add the field there too and extend test 1.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The guard, RED on the real tree (test list 4-14)</name>
  <files>plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs</files>
  <action>
Write the guard as a repo test (pattern: `context-budget.repo.test.cjs`, `model-placeholders.repo.test.cjs`; resolve
REPO_ROOT from `__dirname`; skip with a message when not in an AOForge checkout). Export nothing; keep
`classifyOccurrence(fileRel, lines, lineIndex, column)`, `SCOPES`, `ENFORCED`, `PENDING`, `ALLOW` and `RUNTIME_BLOCK`
as module-level constants in the test file. SCOPES: `core_agents` (plugins/aoforge/agents/*.md), `core_references`
(plugins/aoforge/aoforge/references/*.md), `pack_agent_material` (plugins/aoforge-stack-*/{agents,fragments,profiles,references}/**/*.md),
`core_workflows`, `core_skills`, `core_templates` (templates/**/*.md), `pack_skills_workflows`. ENFORCED = the first
three; PENDING = the other four, with a comment "82-07 Task 1 moves these to ENFORCED". Fence tracking: a line
starting with three backticks opens or closes a fence and records its info string. Run it: tests 10 and 13 must fail
listing the current offenders (record the count per file in the SUMMARY); the unit tests pass. Commit
`AOF commit "test(82-02): guard against ~ runtime reads (RED on agents and references)" --files plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs`.
  </action>
  <verify>`env HOME=$SP/home-82-02 TMPDIR=$SP/tmp-82-02 node --test plugins/aoforge/aoforge/bin/lib/runtime-path-reads.repo.test.cjs`: unit tests 4-9, 11, 12, 14 pass; 10 and 13 fail naming file:line offenders</verify>
  <done>The guard exists, classifies by the five classes, and fails only on the enforced scopes' real offenders.</done>
  <recovery>A class rule misfires on a real line (a shell command the word list misses): add the word or the pattern to the rule with a unit case, never to ALLOW.</recovery>
</task>

<task type="auto">
  <name>Task 3: Rewrite agents, references and pack agent material until the guard is green</name>
  <files>plugins/aoforge/agents/*.md, plugins/aoforge/aoforge/references/*.md (flagged lines only), plugins/aoforge-stack-flutter/** and plugins/aoforge-stack-web/** agent material (flagged lines only)</files>
  <action>
For each offender of test 10: rewrite to `<runtime>/<rel>` keeping the sentence's condition ("only when ...",
"before ..."); a line-start `@~/...` in an agent becomes "Read `<runtime>/<rel>` <the condition that already sits in
that section, or 'when you need it'>". In `references/trd-spec.md` the TRD skeleton's `<execution_context>` lines
become `<runtime>/workflows/execute-trd.md` and `<runtime>/templates/summary.md` (the planner copies these into TRDs;
the executor carries the block). Insert the pinned `<runtime_paths>` block once after `</role>` in every core and
pack agent that now names `<runtime>/`. Do not touch any `node ~/...` command. You may do the mechanical part with a
one-off script kept in `$SP/82-02/` (never in the repo); review `git diff --stat` and every hunk of planner.md,
executor.md and trd-spec.md by hand. Then run, besides the guard: `context-budget.repo.test.cjs`,
`stack-neutrality.repo.test.cjs`, `rename-guard.repo.test.cjs`, `doc-refs.repo.test.cjs`, and every test file that
reads agent or reference text (`rg -l -e "'agents'" -e 'agents/' -e "references'" plugins/aoforge/aoforge/bin/lib plugins/aoforge/hooks plugins/aoforge-stack-flutter/lib --glob '*.test.*'`).
Fix assertions that pinned the old wording (error_recovery). Commit
`AOF commit "fix(82-02): agents read runtime files at an absolute <runtime> path" --files <every changed file>`.
Finally the full suite once (npm test's globs, `watcher-shell.test.cjs` excluded, HOME/TMPDIR under $SP) and record
tests/pass/fail; the guard's PENDING counts go in the SUMMARY for 82-07.
  </action>
  <verify>The guard passes in full (10 and 13 green; PENDING counts printed); context-budget, stack-neutrality, rename and doc-refs guards pass; full suite 0 fail / 0 cancelled with the one named exclusion</verify>
  <done>No enforced file asks an agent to Read a `~/` path; each such agent knows where `<runtime>` comes from.</done>
  <recovery>If the full suite shows a failure unrelated to these files, compare with `git stash`-free evidence: run the same file at `git worktree add $SP/82-02-base HEAD~3` (scratch) and record it as pre-existing only if it fails there too.</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (locally: npm test's globs with `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` excluded for its fish hang; HOME/TMPDIR under the session scratchpad)</test>
</validation_gates>

<verification>
- 13 inits print runtime_root; the guard is green on agents, references and pack agent material and reports the
  PENDING scopes; budget/neutrality/rename/doc-refs guards and the full suite pass.
</verification>

<success_criteria>
- An agent never has to guess a home directory to read an AOForge runtime file, and CI fails if such an instruction
  returns to agent material.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-02-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the RED offender counts, the PENDING counts left for
82-07 and the ALLOW entries with their reasons.
</output>
