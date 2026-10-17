---
objective: 80-adopt-migrates-legacy-projects
trd: "09"
type: standard
wave: 6
depends_on: ["80-04", "80-07", "80-08"]
files_modified:
  - docs/MIGRATING-TO-AOFORGE.md
  - site/content/docs/getting-started/migrating-to-aoforge.md
  - docs/USER-GUIDE.md
  - CHANGELOG.md
  - CLAUDE.md
autonomous: true
requirements: [SC-3, SC-5]
must_haves:
  truths:
    - "The migration guide (repo and site copies) gives `/aoforge:adopt` as the 3.1 way to move a project, before the 3.0.x and manual options, says what it changes and refuses, and quotes the current legacy-layout message"
    - "USER-GUIDE's adopt section routes a pre-rename project to the migrate path (no longer 'refused'), lists the new refusals, and every USER-GUIDE mention of moving a project names adopt"
    - "CHANGELOG's single `## [3.1.0]` section describes objective 80 (adopt migrates; the legacy messages name it) and `aof-tools changelog check 3.1.0` passes"
    - "CLAUDE.md's adopt line says adopt also moves a pre-rename project, within the context-budget caps (200 lines, 20,000 chars)"
    - "The full suite passes (watcher-shell.test.cjs excluded and named), and the rename, stack-neutrality, context-budget, reconcile, doc-refs, planning-writes, builtin-sweep and adopt contract guards pass; `validate health` and `doctor` on this repository are clean"
  artifacts:
    - path: docs/MIGRATING-TO-AOFORGE.md
      provides: "the 3.1 adopt path for a 2.x project"
    - path: CHANGELOG.md
      provides: "objective 80 in the 3.1.0 entry"
  key_links:
    - from: docs/MIGRATING-TO-AOFORGE.md
      to: plugins/aoforge/aoforge/bin/lib/planning-layout.cjs legacyLayoutMessage
      via: "the quoted message equals the function's output for `<root>`"
      pattern: "/aoforge:adopt"
---

# TRD 80-09: Docs describe adopt's migration; the whole tree passes

<objective>
Write the user-facing description of what objective 80 shipped (migration guide and its site copy, USER-GUIDE,
CHANGELOG 3.1.0, CLAUDE.md), then run the full validation the release relies on.

Purpose: SC-5 (docs describe it; guards and full suite pass) and SC-3's user-facing half (the guide quotes the new
message). Output: five doc files, a SUMMARY with the validation evidence.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-03-SUMMARY.md (what migrate scaffold/report do)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-04-SUMMARY.md (the final message text, verbatim)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-07-SUMMARY.md (real-fleet evidence)
@docs/MIGRATING-TO-AOFORGE.md (lines 1-20, 90-175, 340-352)
@docs/USER-GUIDE.md (lines 25-90 rename section, 330-365 adopt section)
@CHANGELOG.md (the `## [3.1.0] - 2026-10-16` section head, lines ~34-60)
@CLAUDE.md (the "Adopt and doctor" line)

Objective-wide rules (every task):
- Repo CLI `node plugins/aoforge/aoforge/bin/aof-tools.cjs ...`; commit only through
  `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-09): <desc>" --files <paths>`; one plain command
  per Bash call.
- Rename guard: the migration guides and USER-GUIDE may spell legacy names ONLY inside
  `<!-- rename-guard:ignore-start -->` … `<!-- rename-guard:ignore-end -->` regions (they are IGNORE_REGION_FILES);
  CHANGELOG is skipped by the guard; CLAUDE.md may not spell them at all.
- Never port 8080 (`docs:serve` is 8091 if you preview); never push, tag or release; versions stay 3.1.0.
- Concurrency: quick 42 also edits CHANGELOG.md. Re-read the 3.1.0 section immediately before editing, add only
  objective 80's lines, and stage only this TRD's files.
- Test runs use `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
</context>

<embedded_context>

<codebase_examples>
**The guide's "Upgrading from 2.x" today (docs/MIGRATING-TO-AOFORGE.md:138-175):** "3.1 cannot move a 2.x install or
project. Pick one path." then **Option A: AOForge 3.0.x once (recommended)** and **Option B: by hand** (git mv, rename
the stamp key, rename the block markers, update .gitignore, run the upgrade).

**Target structure:**
- Opening: 3.1 moves a project with `/aoforge:adopt`; the install-level leftovers (the old runtime home, the global
  `~/.claude/CLAUDE.md` block, the old environment variables, the old plugin) still need 3.0.x or the manual steps.
- **Option A: `/aoforge:adopt` in each project (3.1).** What it does: every planning tree in the repository (the root
  one and component ones) moves with `git mv` on a new `aoforge/adopt` branch; the config stamp key and the CLAUDE.md
  block markers (and the old names inside the block) are renamed; `.gitignore` lines are rewritten and
  `.git/info/exclude` gains the new lines; ADOPT-REPORT.md lists every change; one commit, never pushed; planning
  content otherwise untouched; next step `aof-tools upgrade --check` (the next session start applies automatic
  migrations). Refuses (changing nothing): a dirty tree, an operation in progress, a detached HEAD, both planning
  directories in one place, a malformed old block. Re-running resumes. Then merge `aoforge/adopt` yourself.
- **Option B: AOForge 3.0.x once** (the old Option A, unchanged; still the path for the install-level items).
- **Option C: by hand** (the old Option B, unchanged).
- Fix internal references: "Option A above" (line ~207), "Option A" (line ~268) → the 3.0.x option's new letter.

**The quoted message (lines ~102-106):** replace with 80-04's final text for `<root>`, wrapped at the same width.
</codebase_examples>

<anti_patterns>
- A legacy spelling outside an ignore region in the guides or USER-GUIDE (the rename guard fails it), or anywhere in
  CLAUDE.md.
- A second `## [3.1.0]` heading, or editing other objectives' CHANGELOG lines.
- Growing CLAUDE.md past 20,000 characters (context-budget.repo.test): reword inside the adopt line instead.
- Claiming adopt fixes install-level leftovers (runtime home, global block, env vars): it does not.
- Skipping the full suite because the targeted tests passed.
</anti_patterns>

<error_recovery>
- Full suite failure: decide whether it is objective 80's (rerun that file alone; read the failing assertion). Ours →
  fix test-first in the owning file, commit `fix(80-09): …`, rerun the suite. Not ours (quick 42's files, a known
  environment issue) → record it with evidence in the SUMMARY, do not paper over it, and report it to the orchestrator.
- The site mirror drifts structurally from the repo guide (front matter, relative links): mirror the content edits
  only, keep the site file's own front matter and link forms.
</error_recovery>

</embedded_context>

<gotchas>
- The site copy is a hand mirror (rename-guard test 3e checks both copies separately); apply the same edits to both.
- `docs:data` already ran in 80-05 for the skill description; nothing here changes skill frontmatter.
- USER-GUIDE line ~63 quotes the message too ("which names AOForge 3.0.x, the manual `git mv` ..."): add adopt there.
- CLAUDE.md is ~19,925 characters today; 75 characters of headroom. Check `wc -c CLAUDE.md` after the edit.
- The full-suite method that 79-08 validated: list files with
  `git ls-files -co --exclude-standard -- 'plugins/aoforge/**/*.test.cjs' 'plugins/aoforge-stack-*/**/*.test.cjs' 'plugins/aoforge/**/*.test.js' 'scripts/**/*.test.cjs'`,
  drop `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` (its fish W-3 test hangs on this machine), and run
  `env HOME=<S>/80-09/home TMPDIR=<S>/80-09/tmp xargs node --test < <S>/80-09/files.txt` from the repo root.
  `/var/folders` as HOME or TMPDIR makes repo-state call fixtures scratch.
</gotchas>

<tasks>

<task type="auto">
  <name>Task 1: Migration guide (repo and site)</name>
  <files>docs/MIGRATING-TO-AOFORGE.md, site/content/docs/getting-started/migrating-to-aoforge.md</files>
  <action>
1. Intro bullet "Coming from 2.x, or a project that 3.0.x never moved": add "run `/aoforge:adopt` in the project
   (3.1 moves it for you), or see Upgrading from 2.x".
2. The quoted message → 80-04's text (verbatim from its SUMMARY, `<root>` placeholder kept); the sentence before it
   names adopt.
3. "Upgrading from 2.x" → the target structure in codebase_examples (inside the existing ignore region; extend the
   region if new legacy spellings fall outside it). Re-letter the options and fix the "Option A" references.
4. Troubleshooting table row W066 → fix column: "`/aoforge:adopt`, or [Upgrading from 2.x](#upgrading-from-2x)";
   add W067/W069 rows' adopt mention if those rows exist.
5. Apply the same content edits to the site copy.
6. Run `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs`.
Commit `docs(80-09): migration guide gives /aoforge:adopt as the 3.1 path for a project`.
  </action>
  <verify>node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs → 0 failures; `rg -n "aoforge:adopt" docs/MIGRATING-TO-AOFORGE.md site/content/docs/getting-started/migrating-to-aoforge.md` shows the intro, the message, Option A and the table row in both</verify>
  <done>Both guide copies lead with adopt for projects, keep 3.0.x and manual paths, quote the current message, and pass the guards.</done>
  <recovery>If test 3e (a legacy word appended outside every region is exactly one finding) fails, a region boundary moved: re-check that every legacy spelling is inside a region and every region is closed.</recovery>
</task>

<task type="auto">
  <name>Task 2: USER-GUIDE, CHANGELOG, CLAUDE.md</name>
  <files>docs/USER-GUIDE.md, CHANGELOG.md, CLAUDE.md</files>
  <action>
1. USER-GUIDE adopt section (~334-363): "What it does" gains one paragraph for a pre-rename project (the migrate path:
   moves every planning tree with git mv, renames the stamp key and block markers, rewrites ignore lines, writes
   ADOPT-REPORT.md with a Migration table, one commit on `aoforge/adopt`; no mapping, no scaffolding, no upgrade
   migrations: `aof-tools upgrade --check` is the next step). "Routing by repo state" gains the pre-rename bullet.
   Replace "A project that holds only the pre-rename planning directory is refused with the legacy-layout message"
   with the new refusals (both planning directories, a malformed old block) and the resume note. Line ~63 (rename
   section): the message now names `/aoforge:adopt` first. Any other USER-GUIDE sentence telling a user how to move a
   project (`rg -n "3\.0\.x" docs/USER-GUIDE.md`) names adopt too. Legacy spellings only inside ignore regions.
2. CHANGELOG `## [3.1.0] - 2026-10-16`: in the intro paragraph, "a 2.x project upgrades through 3.0.x first" becomes
   "a 2.x project moves with `/aoforge:adopt` (or through 3.0.x, or by hand)"; add a subsection
   `### Added: adopt migrates pre-rename projects (objective 80)` with bullets: the migrate route (what moves and what
   is renamed, the one recorded change, nested planning trees, the report's Migration table, compact commit); the
   refusals and resume; the CLI guard lets `adopt` run in a pre-rename project; every legacy-layout message, W067, the
   project W069 and `upgrade --only 0012|0013|0014` name `/aoforge:adopt`; the e2e and fleet-copy proofs (TRDs
   80-06..80-08). Then `node plugins/aoforge/aoforge/bin/aof-tools.cjs changelog check 3.1.0`.
3. CLAUDE.md "Adopt and doctor" line: add that adopt also moves a pre-rename project onto `.aoforge/` (objective 80)
   in at most ~60 characters, rewording within the line if needed; `wc -c CLAUDE.md` <= 20000 and lines <= 200.
4. Run rename-guard, doc-refs, context-budget, reconcile-guard repo tests.
Commit `docs(80-09): user guide, changelog and CLAUDE.md describe adopt's migration`.
  </action>
  <verify>node plugins/aoforge/aoforge/bin/aof-tools.cjs changelog check 3.1.0 exits 0; node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs plugins/aoforge/aoforge/bin/lib/context-budget.repo.test.cjs plugins/aoforge/aoforge/bin/lib/reconcile-guard.repo.test.cjs → 0 failures</verify>
  <done>USER-GUIDE, CHANGELOG 3.1.0 and CLAUDE.md describe adopt's migration; guards and the changelog check pass.</done>
  <recovery>If CHANGELOG's 3.1.0 section changed under you (quick 42), re-read and re-apply only your lines; never resolve by rewriting the section.</recovery>
</task>

<task type="auto">
  <name>Task 3: Full validation and SUMMARY</name>
  <files>.aoforge/objectives/80-adopt-migrates-legacy-projects/80-09-SUMMARY.md</files>
  <action>
1. Build the file list (gotchas) into `<S>/80-09/files.txt` minus watcher-shell; run the full suite with the scratch
   HOME/TMPDIR; record files, tests, pass, fail, skipped, cancelled.
2. Named guards (run separately, record counts): rename-guard, stack-neutrality, context-budget, reconcile-guard,
   doc-refs, planning-writes, builtin-sweep, prompt-raw-commit, aoforge-workflows, flag-spec, adopt-skill-contract,
   and every objective-80 test file (legacy-migrate, adopt-migrate, adopt-migrate-report, adopt-migrate-e2e,
   legacy-layout-adopt-path).
3. `node plugins/aoforge/aoforge/bin/aof-tools.cjs validate health --raw` (healthy, no warning beyond what 79-08
   recorded) and `node plugins/aoforge/aoforge/bin/aof-tools.cjs doctor --raw` (0 errors) on this repository.
4. SUMMARY: the numbers, the excluded file and why, an SC-1..SC-5 table with evidence pointers into the objective's
   SUMMARYs (80-03 commit proof, 80-06 matrix, 80-07 fleet copies, 80-08 fresh/brownfield, 80-04 messages, this
   TRD's guards), and any non-objective-80 failure with evidence. Commit it.
  </action>
  <verify>full-suite run reports 0 failures and 0 cancelled with watcher-shell excluded; every named guard 0 failures; health healthy; doctor 0 errors</verify>
  <done>Objective 80's tree is green end to end and the SUMMARY maps every success criterion to evidence.</done>
  <recovery>error_recovery above.</recovery>
</task>

</tasks>

<validation_gates>
<test>env HOME=<S>/80-09/home TMPDIR=<S>/80-09/tmp xargs node --test < <S>/80-09/files.txt (watcher-shell.test.cjs excluded)</test>
<lint>not_available</lint>
<build>`npm run docs:data` is not needed here (no skill frontmatter change)</build>
</validation_gates>

<verification>
- Guides, USER-GUIDE, CHANGELOG 3.1.0 and CLAUDE.md describe the adopt migration; the guides quote the current message.
- Full suite and named guards green; health and doctor clean.
</verification>

<success_criteria>
- SC-5: docs describe it, the rename and stack-neutrality guards pass, the full suite passes.
- SC-3 user-facing: the guide's quoted message and W066 row name `/aoforge:adopt`.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-09-SUMMARY.md` (`planning draft` +
`summary post`).
</output>
