---
status: active
---

<purpose>
Route an existing repository through AOForge's unattended adoption pipeline: preflight decides
what happens next, then — for a fresh or resumed adoption — map the code, infer PROJECT.md,
scaffold the planning tree, verify health, and produce ADOPT-REPORT.md, ending in exactly one
recorded change on `aoforge/adopt`. Nothing here ever asks a question; every uncertain call is
written down with its confidence and evidence instead.

A pre-rename project (its planning directory, config stamp key or CLAUDE.md block markers date
from before the rename) takes the migrate path instead: it is moved onto `.aoforge/` as the same
one recorded change, with nothing mapped or inferred.
</purpose>

<rules>
- Never call AskUserQuestion — every uncertain inference is written down with its confidence and
  evidence instead of being asked.
- One target per invocation — no batch or fleet loop over multiple repositories.
- Every `aof-tools.cjs` call in this workflow carries `--cwd "$TARGET"`.
- One plain command per Bash call — never chain with `&&`/`;`, never pipe, never prefix with `cd`.
- Commits: only via `node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" commit`; never another
  way, never push, never stash, never reset, and never bypass signing or verification hooks in any
  form.
- Never bind a dev server to the disallowed default web port; use 8091 if a server is ever needed
  for verification.
</rules>

<process>

<step name="resolve_target">
`TARGET` is the absolute path of the argument passed to `/aoforge:adopt`, or the current working
directory if none was given. If that path does not exist, say so and stop — nothing else runs.

Continue to `preflight`.
</step>

<step name="preflight">
Run:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" adopt preflight
```

Parse the JSON. `route` is one of `refuse`, `new-project`, `upgrade`, `resume`, `adopt`, `migrate`.

- **`refuse`** — print `reason` and `next` verbatim, stop. Nothing changes.
  The migrate reasons `both-planning-dirs` and `legacy-block-malformed` (from this step) and
  `move-failed` (from `begin`) stop the same way.
- **`new-project`** — this repository has no source code yet; say so and point at
  `/aoforge:new-project`, stop.
- **`upgrade`** — this is already an AOForge project. Run
  `node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" upgrade --check`. If `pending_confirm`
  is non-empty, report those migrations and point at `/aoforge:status check --migrate`, stop —
  never re-scaffold. If `pending` auto migrations exist, run
  `node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" upgrade --apply`, then record exactly
  its `changed_files` via `node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" commit`, then
  stop.
- **`resume`** — an adoption was already in progress on this target. Note `adopt.steps` (the flags
  `mapped`, `project_md`, `scaffolded`, `reported`) — the steps below use them to skip work already
  done. Continue to `begin`. With `adopt.mode` `migrate` the steps are `moved`, `scaffolded` and
  `reported` instead, and the migrate path applies; every step of it is safe to re-run.
- **`adopt`** — fresh adoption. Continue to `begin`.
- **`migrate`** — a pre-rename project: its planning directory, config stamp key or CLAUDE.md
  block markers date from before the rename. `migration` lists what will move and change. Continue
  to `begin` and follow the migrate path: `begin`, `scaffold`, `report`, `commit`, `summary`.
</step>

<step name="begin">
On the migrate path the command below also moves the planning trees itself, with `git mv`. Nothing
is edited by hand, and a project whose planning lives only in component directories has no root
planning directory to hold a skill marker, so do not run `skill-active --start` afterwards.
Continue to `scaffold`. A `refuse` from it (`move-failed`) is printed and stops the run;
re-running `/aoforge:adopt` resumes the move.

Run:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" adopt begin
```

This is idempotent — safe to re-run on `resume`. It creates the `aoforge/adopt` branch and its
marker. Then start the skill marker so `.aoforge/` edits are allowed for the rest of this run:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" skill-active --start adopt
```

Continue to `map`.
</step>

<step name="map">
Skip on the migrate path.

Unless `steps.mapped` is already true (from `resume`), follow
`@~/.claude/aoforge/workflows/map-codebase.md` for `$TARGET` in non-interactive mode — see that
workflow's `<non_interactive_mode>` section. If the Task tool is unavailable in this run, perform
each mapper focus (tech, arch, quality, concerns) yourself in sequence instead of spawning agents.

Continue to `infer_project`.
</step>

<step name="infer_project">
Skip on the migrate path.

Unless `steps.project_md` is already true (from `resume`), read the 8 codebase maps, any README*,
and the manifest files, then produce two files.

**PROJECT.md** — draft it at the path `node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" planning draft PROJECT.md`
prints, then publish it with `node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" doc put PROJECT.md --from "$DRAFT"`
(local mode, the normal case for adopt: that stores the draft's bytes as `$TARGET/.aoforge/PROJECT.md`).
Frontmatter `kind` and `default_work`, then these sections:
`## What This Is`, `## Core Value`, `## Requirements` (with `### Validated`, `### Active`,
`### Out of Scope`), `## Constraints`.

- `## What This Is` / `## Core Value` — drawn from the README and the ARCHITECTURE.md map.
- `### Validated` — what the code already does today, one bullet per capability, each citing the
  file path that proves it.
- `### Active` — exactly "None yet — add with /aoforge:objective add".
- `### Out of Scope` — empty.
- `## Constraints` — drawn from the STACK.md and CONCERNS.md maps.

**Kind rubric** (evidence-based, never guessed):
- `api` — a network server entrypoint (`net/http` `ListenAndServe`, an express/fastify `listen`
  call, a gRPC server).
- `app` — an end-user application (a Flutter `runApp`, a web or mobile UI entry point).
- `library` — an importable package with no entrypoint.
- `ui-lib` — a component library (widgets/components exported, no app entry point).
- `cli` — a declared binary or arg-parsing `main` with no server (a `package.json` `bin` field, a
  cobra/flag/clap parser).
- `plugin` — extends a host system (a Claude Code plugin manifest, an editor/extension manifest).

`default_work`: `feature` at `medium` confidence unless the repository's own docs state otherwise.

Confidence: `high` — one rule matched with direct evidence. `medium` — two plausible rules.
`low` — best guess, no strong signal.

**`$TARGET/.aoforge/.adopt-inferences.json`** — a JSON array of `{field, value, confidence,
evidence}`, one entry each for `kind`, `default_work`, `core_value`, every `### Validated` item,
and every `## Constraints` entry.

Continue to `scaffold`.
</step>

<step name="scaffold">
On the migrate path the command below renames the config stamp key, the CLAUDE.md block markers
and the ignore lines, after a backup, and writes nothing else (it prints `migrated: <n> converted`).
Exit 1 means the move is not finished: stop and report, fix nothing by hand; re-running
`/aoforge:adopt` resumes. Continue to `report` (skipping `confirm_stack_profile` and `health`);
the rest of this step is for the other routes.

Run:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" adopt scaffold
```

Exit 1 usually means a PROJECT.md field is malformed — fix that one field and retry once. Still
failing → stop and report; the fix is to re-run `/aoforge:adopt` later (nothing is undone).

Continue to `confirm_stack_profile`.
</step>

<step name="confirm_stack_profile">
Skip on the migrate path.

Best-effort: confirm the drafted `.aoforge/STACK.md` against the code with the gopls/dart MCP
tools when this session has them. `.mcp.json` servers need approval and a session restart, so
their absence is normal — never block on them, never install anything.

1. Probe: use ToolSearch for `mcp__gopls__go_workspace` and `mcp__dart__analyze_files` (no
   ToolSearch → look for `mcp__gopls__*` / `mcp__dart__*` in your tool list).
2. Go (gopls present): `go_workspace` — the module layout must match the drafted `components`;
   `go_vulncheck` — the `audit` key is meaningful; `go_diagnostics` on 1-2 files.
3. Dart/Flutter (dart present): `roots` for `$TARGET`, then `analyze_files` (baseline vs the
   drafted analyze flags); `run_tests` only when the server was started with `--enable cli`.
4. Otherwise, or additionally (safe keys only; nothing is installed, released or deployed):

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" stack verify --run --raw
```

5. Record each discrepancy as one `{field, value, confidence, evidence}` entry appended to
   `$TARGET/.aoforge/.adopt-inferences.json` — confidence `medium` (a failing key, a layout
   mismatch) or `low` (advisory) — so it lands in the report's needs-review rows.
   NEVER edit STACK.md silently: this step only records findings. A gate skipped `env_required`
   (it needs a database or other service) is a finding too: record it as a `low` confidence entry,
   and never re-run it with `--allow-services` from this workflow.
6. `.mcp.json` is opt-in per repo: a finding may suggest `stack mcp --write`; never run it here.
7. Start no server; the port rule in <rules> applies if one is ever needed.

Continue to `health`.
</step>

<step name="health">
Skip on the migrate path: the `report` step checks health at every planning root itself, and
`--repair` would write planning content, so it is never run there. Continue to `report`.

Run:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" validate health --raw
```

`errors.length > 0` → run once:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" validate health --repair
```

then re-check. Still errors after the repair → still run `report` (so the errors are listed in
it), skip `commit`, and stop with a resume hint (`/aoforge:adopt` picks up from `resume`).

Continue to `report`.
</step>

<step name="report">
Run:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" adopt report
```

Keep `commit_files` and `commit_message` from the result for the next step.

On the migrate path, read `commit_blocked` first. When it is not null, print its `reason`,
`message` and `fix`, skip `commit` and stop: nothing was committed, and re-running `/aoforge:adopt`
after the fix resumes. Otherwise keep `report_path` and the `needs_review` rows for the summary
too; `commit_files` is already compact (a directory entry per moved tree), pass it as it is.

Continue to `commit`.
</step>

<step name="commit">
On the migrate path no skill marker was started, so skip `skill-active --end` and run only the
`commit` command below. An empty `commit_files`, or a result whose `reason` is `nothing_to_commit`,
means nothing is left to record: do not commit, go on to `summary`. That is the normal outcome of
a re-run after the change was recorded: a planning tree that git ignores keeps the report out of
the change, so `adopt preflight` still routes such a project to `resume`.

End the skill marker first:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" skill-active --end
```

Then make the one recorded change, using the `commit_message` and `commit_files` from `report`:

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" commit "<commit_message>" --files <commit_files...>
```

A signing or commit failure → stop and report it verbatim; do not retry a different way — no
alternate commit path, no bypassing verification.

Continue to `summary`.
</step>

<step name="summary">
Report, in plain text:

- The branch (`aoforge/adopt`) and the commit sha:
  `git -C "$TARGET" rev-parse --short HEAD`.
- The needs-review count from `.aoforge/ADOPT-REPORT.md`.
- "Review `.aoforge/ADOPT-REPORT.md`, then `git switch <base_branch> && git merge aoforge/adopt`.
  Nothing was pushed."

On the migrate path report instead: the branch and commit sha as above (or that nothing was left
to record); the `report_path` and how many `needs_review` rows it holds; "Review `<report_path>`,
then `git switch <base_branch> && git merge aoforge/adopt`. Nothing was pushed."; and the next
step, `node ~/.claude/aoforge/bin/aof-tools.cjs --cwd "$TARGET" upgrade --check` (the next session
start applies the automatic migrations).

End workflow.
</step>

</process>

<success_criteria>
- Refusal routes change nothing and print the reason.
- The `new-project` and `upgrade` routes stop without scaffolding a second time.
- A fresh or resumed `adopt` route produces exactly one recorded change on `aoforge/adopt`, with
  PROJECT.md, the codebase maps, STACK.md, config/STATE/ROADMAP, the CLAUDE.md block, and
  `.aoforge/ADOPT-REPORT.md` all present.
- A `migrate` route ends in one recorded change on `aoforge/adopt` that moves the planning trees
  with history and converts only the config stamp key, the CLAUDE.md block markers and ignore
  lines; a blocked commit stops with the reason.
- Never asks the user anything, anywhere in the run.
- `.aoforge/.skill-active` is never part of the committed file list.
</success_criteria>
