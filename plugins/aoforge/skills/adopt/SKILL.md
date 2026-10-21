---
name: adopt
description: |
  Turn an existing repository into an AOForge project, unattended: map the code, infer PROJECT.md
  and STACK.md, scaffold config/STATE/ROADMAP, add the CLAUDE.md block, and make one recorded
  change on an aoforge/adopt branch. Never asks a question — uncertain inferences are written down
  with their confidence and evidence for review. Also brings a pre-rename project onto .aoforge/:
  moves its planning directory with git mv and renames its config stamp key and CLAUDE.md block
  markers, as the same one recorded change.
  Use when the user has an existing repository they want AOForge set up in, without answering
  setup questions themselves.
  Triggers on: "adopt this repo", "set up aoforge here", "bootstrap this repo", "move this project to aoforge"
argument-hint: "[path]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - mcp__gopls__*
  - mcp__dart__*
disallowed-tools:
  - AskUserQuestion
---

<objective>
Turn the repository at [path] (default: the current directory) into an AOForge project, unattended:
map the code, infer PROJECT.md and STACK.md, scaffold config/STATE/ROADMAP (no invented objectives),
add the CLAUDE.md block, stamp the version, and make ONE recorded change on an `aoforge/adopt`
branch. Never pushes. Never asks: uncertain inferences go to `.aoforge/ADOPT-REPORT.md` under
"Needs review". Already an AOForge project → upgrade. No source code yet → /aoforge:new-project.
Dirty tree, rebase/merge in progress, detached HEAD, or not a git repo → stops with the reason,
changes nothing. A pre-rename project (planning directory, config stamp key or CLAUDE.md block
markers from before the rename) is moved onto `.aoforge/` instead, as the same one recorded change:
`git mv` of its planning directory (history follows), the stamp key and block markers renamed,
nothing else rewritten and nothing inferred.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/adopt.md
@~/.claude/aoforge/workflows/map-codebase.md
@~/.claude/aoforge/templates/project.md
</execution_context>

<process>
Execute the adopt workflow from @~/.claude/aoforge/workflows/adopt.md end-to-end for the target in
$ARGUMENTS. Never call AskUserQuestion.
</process>
