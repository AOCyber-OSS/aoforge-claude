---
objective: 80-adopt-migrates-legacy-projects
trd: "05"
type: standard
wave: 4
depends_on: ["80-03"]
files_modified:
  - plugins/aoforge/aoforge/workflows/adopt.md
  - plugins/aoforge/skills/adopt/SKILL.md
  - plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs
  - site/data/aoforge.json
autonomous: true
requirements: [SC-4, SC-5]
must_haves:
  truths:
    - "workflows/adopt.md routes `migrate` (and a migrate `resume`) through begin → scaffold → report → commit → summary, skipping the skill marker, map, infer_project, confirm_stack_profile and the health repair, and stops before commit when report returns `commit_blocked`"
    - "The fresh/brownfield path of the workflow reads exactly as before (same commands, same order), so the existing contract rows and the objective 37 simulated runs still hold"
    - "The adopt skill's description and objective say it also moves a pre-rename project onto .aoforge/ as one recorded change, without spelling a legacy name"
    - "adopt-skill-contract.test.cjs pins the migrate path (route coverage, skipped steps, no --repair on migrate, commit_blocked stop, summary content); context-budget, rename-guard, builtin-sweep, doc-refs and planning-writes repo tests pass"
  artifacts:
    - path: plugins/aoforge/aoforge/workflows/adopt.md
      provides: "the migrate path in the unattended adopt workflow"
    - path: plugins/aoforge/skills/adopt/SKILL.md
      provides: "skill text naming the migration"
    - path: plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs
      provides: "contract rows for the migrate path"
  key_links:
    - from: plugins/aoforge/aoforge/workflows/adopt.md preflight step
      to: "aof-tools adopt preflight route `migrate`"
      via: "route list"
      pattern: "migrate"
    - from: plugins/aoforge/aoforge/workflows/adopt.md report step
      to: "report JSON commit_blocked"
      via: "stop before commit"
      pattern: "commit_blocked"
---

# TRD 80-05: The adopt workflow and skill learn the migrate path

<objective>
Wire the migrate route into the prose an agent follows: `workflows/adopt.md` sends a pre-rename project through
begin → scaffold → report → commit without the brownfield-only steps, and stops cleanly when report blocks the
commit. The skill text says adopt also migrates. The contract test pins it, and the generated site data picks up the
new skill description.

Purpose: SC-4 (adopt runs end to end through the skill's workflow) and SC-5 (adopt skill docs describe it, guards
pass). Simulated runs of this text are TRDs 80-07 and 80-08.
Output: workflow, skill, contract test, regenerated site data.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-02-SUMMARY.md (preflight/begin JSON for migrate)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-03-SUMMARY.md (scaffold/report JSON for migrate)
@plugins/aoforge/aoforge/workflows/adopt.md
@plugins/aoforge/skills/adopt/SKILL.md
@plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs
@plugins/aoforge/aoforge/references/built-ins.md (no prose choices; AskUserQuestion rules)

Objective-wide rules (every task):
- Repo CLI `node plugins/aoforge/aoforge/bin/aof-tools.cjs ...`; commit only through
  `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-05): <desc>" --files <paths>`; RED before GREEN;
  one plain command per Bash call.
- Tests: run as `TMPDIR=<S>/80-05/tmp HOME=<S>/80-05/home node --test <files>` with
  `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
- Never port 8080 (the workflow keeps naming 8091 only); never push, tag or release.
- No legacy spelling in adopt.md or SKILL.md (they are in the rename guard's scan set and the user-facing set): say
  "pre-rename planning directory", "pre-rename config stamp key", "pre-rename CLAUDE.md block markers".
- Concurrency: quick 42 edits other workflows (execute-objective, build, new-milestone, research-objective); this TRD
  touches adopt.md only. Stage only this TRD's files.
</context>

<embedded_context>

<codebase_examples>
**Current preflight route list (adopt.md:42-57) — extend it, keep the existing bullets verbatim:**

```
- **`refuse`** — print `reason` and `next` verbatim, stop. Nothing changes.
- **`new-project`** — ...
- **`upgrade`** — ...
- **`resume`** — ... Note `adopt.steps` (the flags `mapped`, `project_md`, `scaffolded`, `reported`) ...
- **`adopt`** — fresh adoption. Continue to `begin`.
```

New bullets / sentences to add (wording is yours, content is fixed):
- **`migrate`** — a pre-rename project: its planning directory, config stamp key or CLAUDE.md block markers date from
  before the rename. `migration` lists what will move and change. Continue to `begin` and follow the migrate path:
  begin → scaffold → report → commit → summary.
- `resume` with `adopt.mode` `migrate`: the steps are `moved`, `scaffolded`, `reported`; follow the migrate path.
- `refuse` reasons now include `both-planning-dirs`, `legacy-block-malformed` and `move-failed`; still print and stop.

**Step-level skips (one sentence each, at the top of the step):**
- begin: on the migrate path begin moves the planning trees itself; do not run `skill-active --start adopt` (nothing is
  edited by hand, and a project whose planning lives only in component directories has no root planning directory to
  hold the marker). Continue to `scaffold`.
- map, infer_project, confirm_stack_profile: "Skip on the migrate path."
- scaffold: on the migrate path it renames the config stamp key, the CLAUDE.md block markers and ignore lines
  (prints `migrated: <n> converted`); exit 1 → stop and report (re-running `/aoforge:adopt` resumes). Continue to
  `report` (skip `confirm_stack_profile` and `health`).
- health: "Skip on the migrate path: report checks health at every planning root itself, and `--repair` would write
  planning content."
- report: on the migrate path, a non-null `commit_blocked` → print its `reason` and `message`, skip `commit`, stop
  with the resume hint. Otherwise keep `commit_files` / `commit_message`.
- commit: on the migrate path there is no skill marker to end; run the same commit command.
- summary: on the migrate path report the branch and sha, the `report_path` and its needs-review count, "Review
  `<report_path>`, then `git switch <base_branch> && git merge aoforge/adopt`. Nothing was pushed.", and the next
  step `aof-tools --cwd "$TARGET" upgrade --check` (the next session start applies automatic migrations).
</codebase_examples>

<anti_patterns>
- A second copy of the whole workflow for migrate: keep one step sequence with per-path skips.
- Any question to the user, or prose offering choices ("do you want to..."): builtin-sweep fails it, and adopt never asks.
- A line with `aof-tools.cjs` that lacks `--cwd "$TARGET"` (contract row 5).
- Telling the agent to edit planning files on the migrate path, or to run `validate health --repair` there.
- Spelling a legacy name in the workflow or skill.
</anti_patterns>

<error_recovery>
- context-budget.repo.test fails on the adopt skill's resolved footprint (cap 90,000 chars; it is ~22K today): you
  wrote far too much; trim to the sentences above.
- planning-writes.repo.test flags a new instruction: the migrate path must not tell the agent to write a planning
  file; re-word so the CLI does the write.
</error_recovery>

</embedded_context>

<gotchas>
- Contract row 4 checks the FIRST index of each marker string in order (`adopt preflight`, `adopt begin`,
  `skill-active --start adopt`, `non-interactive`, `.adopt-inferences.json`, `adopt scaffold`, `validate health`,
  `adopt report`, `skill-active --end`, ` commit `). New migrate sentences must not mention a later marker before an
  earlier one's first occurrence (e.g. do not write `adopt report` inside the preflight step; say "the report step").
- Contract row 6 allows `AskUserQuestion` exactly once, on a line containing `Never`.
- The skill description is YAML block text; keep `Triggers on:` and the three existing phrases (contract row 1). One
  more phrase is fine (e.g. "move this project to aoforge").
- site/data/aoforge.json is generated from skill frontmatter by `npm run docs:data` (scripts/gen-docs-data.cjs); run
  it after editing SKILL.md and commit the regenerated file (only the adopt entry should change; if more changes,
  someone else's skill edit is pending: commit only if the diff is the adopt entry, else report it).
</gotchas>

## Test list

New rows in `adopt-skill-contract.test.cjs` (keep rows 1-13 unchanged):

14. Route coverage: adopt.md mentions `migrate` as a route value and the refusal reasons `both-planning-dirs` and
    `legacy-block-malformed`.
15. Migrate path skips: the `begin` step says the migrate path does not run `skill-active --start`; the `map`,
    `infer_project` and `confirm_stack_profile` steps each contain "migrate path" with "Skip"; the `health` step says
    the migrate path skips it and never runs `--repair`.
16. Migrate stop: the `report` step names `commit_blocked` and says to skip `commit` and stop.
17. Migrate summary: the `summary` step names `report_path`, `git merge aoforge/adopt`, "Nothing was pushed" and
    `upgrade --check`.
18. SKILL.md: description and `<objective>` mention "pre-rename"; neither contains a legacy spelling (built from
    LEGACY: planningDir, configKey, blockTag, slug).
19. Fresh-path invariance: the sequence of `aof-tools.cjs` command lines that appear in adopt.md before this TRD (list
    them in the test as a fixed array) all still appear, in the same relative order.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED contract rows</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs</files>
  <action>
Add rows 14-19 (update the header test list). Row 19's fixed array is the command lines as they stand now
(`adopt preflight`, `upgrade --check`, `upgrade --apply`, `commit`, `adopt begin`, `skill-active --start adopt`,
`planning draft PROJECT.md`, `doc put PROJECT.md`, `adopt scaffold`, `stack verify --run --raw`,
`validate health --raw`, `validate health --repair`, `adopt report`, `skill-active --end`, the final `commit`), so it
passes now and guards the fresh path. Rows 14-18 fail. Commit `test(80-05): adopt contract covers the migrate path (RED)`.
  </action>
  <verify>TMPDIR=<S>/80-05/tmp HOME=<S>/80-05/home node --test plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs → rows 14-18 fail, 1-13 and 19 pass</verify>
  <done>Rows written; RED as stated; commit recorded.</done>
  <recovery>If row 19's extraction is brittle, match each command by a distinctive substring rather than whole lines.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — workflow, skill, site data</name>
  <files>plugins/aoforge/aoforge/workflows/adopt.md, plugins/aoforge/skills/adopt/SKILL.md, site/data/aoforge.json</files>
  <action>
1. adopt.md: update `<purpose>` (one sentence: a pre-rename project is moved onto `.aoforge/` as the same one recorded
   change); add the `migrate` route and the migrate `resume` note to `preflight`; add the step-level sentences from
   codebase_examples; add to `<success_criteria>`: "A `migrate` route ends in one recorded change on `aoforge/adopt`
   that moves the planning trees with history and converts only the config stamp key, the CLAUDE.md block markers and
   ignore lines; a blocked commit stops with the reason." Keep every existing line of the fresh path.
2. SKILL.md: description gains one sentence ("Also brings a pre-rename project onto .aoforge/: moves its planning
   directory with git mv and renames its config stamp key and CLAUDE.md block markers, as the same one recorded change.")
   and one trigger phrase; `<objective>` gains the matching sentence.
3. `npm run docs:data`; check `git diff --stat site/data/aoforge.json` touches only the adopt entry.
4. Run: adopt-skill-contract, context-budget.repo, rename-guard.repo, stack-neutrality.repo, builtin-sweep.repo,
   doc-refs.repo, planning-writes.repo, aoforge-workflows.repo, prompt-raw-commit.repo and rg-flag-guard tests.
Commit `docs(80-05): adopt workflow and skill run the migrate path`.
  </action>
  <verify>TMPDIR=<S>/80-05/tmp HOME=<S>/80-05/home node --test plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs plugins/aoforge/aoforge/bin/lib/context-budget.repo.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs plugins/aoforge/aoforge/bin/lib/builtin-sweep.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs plugins/aoforge/aoforge/bin/lib/planning-writes.repo.test.cjs plugins/aoforge/aoforge/bin/lib/aoforge-workflows.repo.test.cjs plugins/aoforge/aoforge/bin/lib/prompt-raw-commit.repo.test.cjs plugins/aoforge/aoforge/bin/lib/rg-flag-guard.test.cjs → 0 failures</verify>
  <done>Contract rows 1-19 pass; every listed repo guard passes; site data regenerated for the adopt entry only.</done>
  <recovery>If a repo guard named above does not exist under that name, find it with `ls plugins/aoforge/aoforge/bin/lib/*.repo.test.cjs` and run the matching one; record the substitution.</recovery>
</task>

</tasks>

<validation_gates>
<test>TMPDIR=<S>/80-05/tmp HOME=<S>/80-05/home node --test plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs plugins/aoforge/aoforge/bin/lib/context-budget.repo.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs</test>
<lint>not_available</lint>
<build>`npm run docs:data` (exit 0)</build>
</validation_gates>

<verification>
- Reading adopt.md top to bottom with `route: migrate` gives exactly: preflight → begin → scaffold → report →
  (stop on commit_blocked) → commit → summary.
- Reading it with `route: adopt` gives the same commands in the same order as before this TRD (row 19).
</verification>

<success_criteria>
- The workflow and skill describe and drive the migrate path; all contract and repo guards pass.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-05-SUMMARY.md` (`planning draft` +
`summary post`).
</output>
