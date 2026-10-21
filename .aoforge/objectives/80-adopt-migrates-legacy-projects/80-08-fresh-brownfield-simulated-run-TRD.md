---
objective: 80-adopt-migrates-legacy-projects
trd: "08"
type: standard
wave: 5
depends_on: ["80-05"]
files_modified: []
autonomous: true
requirements: [SC-4]
must_haves:
  truths:
    - "Following `/aoforge:adopt` verbatim on a fresh repository (no code) under 3.1.0 routes to `new-project`, stops, and changes nothing (snapshot compare unchanged); a `git init`-only directory does the same"
    - "Following `/aoforge:adopt` verbatim on a brownfield repository (code, no planning) under 3.1.0 maps, infers, scaffolds and reports, ending in one commit on `aoforge/adopt` with `adopt-e2e-assert check` green (default mode)"
    - "A second `/aoforge:adopt` on the adopted brownfield repository routes to `upgrade` and never re-scaffolds"
    - "The migrate-path edits in workflows/adopt.md (TRD 80-05) cost the fresh and brownfield paths nothing: no step was skipped, reordered or misread (deviation list)"
  artifacts: []
  key_links:
    - from: plugins/aoforge/aoforge/workflows/adopt.md
      to: "the fresh and brownfield routes"
      via: "an agent following the text verbatim"
      pattern: "new-project"
---

# TRD 80-08: Simulated `/aoforge:adopt` on a fresh and a brownfield repository under 3.1.0

<objective>
Re-prove, under 3.1.0 and after TRD 80-05's workflow edits, that adopt's original routes still work when an agent
follows the text: a fresh repository is pointed at `/aoforge:new-project` with nothing changed, and a brownfield
repository goes through the whole unattended pipeline into one recorded change. Objective 37 proved these on DevFlow
2.x (TRDs 37-11..37-13); this run is the 3.1.0 regression proof the user asked for.

Purpose: SC-4 (fresh and brownfield end to end). Output: a SUMMARY with evidence (and a test-first fix only if a defect
is found).
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-05-SUMMARY.md
@.aoforge/objectives/37-adopt-existing-repos/37-12-SUMMARY.md (the 2.x Node-CLI simulated run: what "green" looked like)
@plugins/aoforge/skills/adopt/SKILL.md
@plugins/aoforge/aoforge/workflows/adopt.md
@plugins/aoforge/aoforge/workflows/map-codebase.md (`<non_interactive_mode>`)

Runtime model (binding):
- Work area `<S>/80-08/` with `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
- Prefix every `node` and `git` command against a fixture with `HOME=<S>/80-08/home`. The only real-home access is the
  read-only backups listing.
- One plain command per Bash call. Never port 8080 (the node-cli fixture starts no server). No push, tag or release.
- Commits to THIS repository go through `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-08): <desc>"
  --files <paths>`. The fixtures' adopt commits go through the fixture-targeted `aof-tools --cwd <fixture> commit`
  as the workflow says; never `--no-gpg-sign`.
</context>

<embedded_context>

<codebase_examples>
Substitutions (the ONLY permitted rewrites):

| Workflow text | Run it as |
|---|---|
| `node ~/.claude/aoforge/bin/aof-tools.cjs …` | `HOME=<S>/80-08/home node /Users/justin/dev/aoforge-claude/plugins/aoforge/aoforge/bin/aof-tools.cjs …` |
| `@~/.claude/aoforge/workflows/<f>.md`, `templates/<f>` | Read `plugins/aoforge/aoforge/workflows/<f>.md` / `plugins/aoforge/aoforge/templates/<f>` here |
| `$ARGUMENTS` | the fixture's absolute path |
| `git -C "$TARGET" …` | `HOME=<S>/80-08/home git -C "<fixture>" …` |
| Spawn codebase-mapper agents (Task) | The workflow's declared fallback: perform each mapper focus yourself, in sequence, writing the same 8 documents |

Setup (one per Bash call):

```
mkdir -p <S>/80-08
node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-fixtures.cjs home <S>/80-08/home
node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-fixtures.cjs make empty <S>/80-08/fresh --home <S>/80-08/home
node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-fixtures.cjs make node-cli <S>/80-08/brownfield --home <S>/80-08/home
mkdir -p <S>/80-08/bare
HOME=<S>/80-08/home git -C <S>/80-08/bare init -q
HOME=<S>/80-08/home node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs snapshot <S>/80-08/fresh --out <S>/80-08/fresh-before.json
HOME=<S>/80-08/home node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs snapshot <S>/80-08/bare --out <S>/80-08/bare-before.json
ls -la ~/.claude/aoforge/backups
```

Acceptance:

```
HOME=<S>/80-08/home node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs compare <S>/80-08/fresh --before <S>/80-08/fresh-before.json
HOME=<S>/80-08/home node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs compare <S>/80-08/bare --before <S>/80-08/bare-before.json
HOME=<S>/80-08/home node plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs check <S>/80-08/brownfield --home <S>/80-08/home
```
</codebase_examples>

<anti_patterns>
- Driving subcommands from memory; skipping the mapping step because "it is just a fixture".
- Fixing a fixture by hand after a failed step.
- Running anything in a real repository or with the real HOME.
</anti_patterns>

<error_recovery>
- A step fails or a check is false: record it; a small defect in objective-80 code or the workflow text (<= 5 tool
  calls) → fix test-first in the owning file, commit `fix(80-08): …`, rebuild a FRESH fixture and re-run the whole
  simulation; otherwise STOP and report the gap (owning TRD, evidence).
</error_recovery>

</embedded_context>

<gotchas>
- `/private/tmp/...` is not a scratch prefix, so preflight should report `brownfield` for the node-cli fixture; if it
  says `scratch`, adopt still proceeds (objective 37 behaviour): note it.
- Keep the mapper documents proportionate to a ~6-file repo but over map-codebase's 20-line floor, or expect a
  needs-review row for a short doc; either is acceptable, record which.
- Write PROJECT.md (through `planning draft` + `doc put`, as the workflow says) and `.adopt-inferences.json` into the
  FIXTURE's `.aoforge/`, never this repository's.
- The fresh fixture's route is decided by preflight alone; the workflow must stop at `new-project` without running
  begin. The bare (unborn) directory routes to `new-project` too (greenfield beats no-commits).
</gotchas>

<tasks>

<task type="auto">
  <name>Task 1: Fresh and bare repositories through /aoforge:adopt</name>
  <files>(none in this repo)</files>
  <action>
Run setup. Read SKILL.md then adopt.md. Follow the workflow for `<S>/80-08/fresh`, then for `<S>/80-08/bare`, with the
substitutions. Each must stop at the `new-project` route, printing the pointer to `/aoforge:new-project`. Run the two
`compare` acceptance commands (exit 0, unchanged). Record each step's command and route.
  </action>
  <verify>both compare commands exit 0; `HOME=<S>/80-08/home git -C <S>/80-08/fresh branch --list aoforge/adopt` prints nothing</verify>
  <done>Fresh and bare repositories route to new-project and are byte-identical afterwards.</done>
  <recovery>error_recovery above.</recovery>
</task>

<task type="auto">
  <name>Task 2: Brownfield through /aoforge:adopt, re-run, SUMMARY</name>
  <files>.aoforge/objectives/80-adopt-migrates-legacy-projects/80-08-SUMMARY.md</files>
  <action>
1. Follow the workflow for `<S>/80-08/brownfield` end to end (preflight → begin → skill marker → map (fallback: each
   focus yourself) → infer_project → scaffold → confirm_stack_profile → health → report → commit → summary). Keep a
   deviation list, paying attention to whether any migrate-path sentence (80-05) caused a skip or a misread on this
   route.
2. Run the checker (save its JSON). Then follow the workflow again on the same fixture: preflight must route to
   `upgrade`; follow that route (upgrade --check; apply/commit only if pending); confirm nothing was re-scaffolded
   (`git log --oneline` count and `.aoforge/` file list unchanged apart from any upgrade commit).
3. `ls -la ~/.claude/aoforge/backups` → identical to before.
4. SUMMARY: fixture and home paths, routes, each step's command and result code, the deviation list, checker JSON,
   ADOPT-REPORT.md needs-review rows (field + confidence), the re-run result, the real-home comparison. Commit it via
   aof-tools commit (SUMMARY only, plus nothing else).
  </action>
  <verify>checker exit 0 with every check ok; second run route `upgrade`; `git status --porcelain` in THIS repo shows only the SUMMARY before its commit</verify>
  <done>Brownfield adoption under 3.1.0 is one recorded change with a green checker; a re-run upgrades and never re-scaffolds; the deviation list shows no harm from the migrate-path text.</done>
  <recovery>error_recovery above.</recovery>
</task>

</tasks>

<verification>
- Fresh/bare: unchanged snapshots, no branch. Brownfield: checker green, one commit, re-run → upgrade.
</verification>

<success_criteria>
- SC-4's fresh and brownfield halves hold when an agent follows the 3.1.0 workflow text.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-08-SUMMARY.md` (`planning draft` +
`summary post`).
</output>
