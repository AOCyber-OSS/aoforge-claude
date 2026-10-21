---
objective: 80-adopt-migrates-legacy-projects
trd: "03"
type: standard
wave: 3
depends_on: ["80-02"]
files_modified:
  - plugins/aoforge/aoforge/bin/lib/adopt.cjs
  - plugins/aoforge/aoforge/bin/lib/adopt-cli.cjs
  - plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs
autonomous: true
requirements: [SC-1, SC-2, SC-4]
must_haves:
  truths:
    - "`adopt scaffold` on a migrate resume renames the config stamp key, the CLAUDE.md block markers and the ignore lines (legacy-migrate.convertResidue) after a backup outside the repo, and writes nothing else: no PROJECT/STATE/ROADMAP/STACK, no new CLAUDE.md block, no upgrade.apply"
    - "`adopt report` on a migrate resume writes ADOPT-REPORT.md at the marker's report_path with a `## Migration` table, validate-health findings per planning root, pending upgrade migrations and next steps, and returns compact commit_files (directory entries for moved trees, never thousands of paths) and a commit_message"
    - "`aof-tools commit <commit_message> --files <commit_files>` records exactly one commit on aoforge/adopt: every moved planning file is a 100%-similarity rename except config.json (one key line) and the new ADOPT-REPORT.md; the tree is clean; `git log --follow` crosses the move"
    - "After that commit, `validate health` at every planning root reports none of W066/W067/W069, and `adopt preflight` no longer resumes (the report is in HEAD)"
    - "A legacy code still present after scaffold, or `commit_docs: false` with a tracked moved tree, sets `commit_blocked` with a reason and the fix instead of letting a partial commit happen"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/adopt.cjs
      provides: "migrate-mode scaffold and report, compact commit files"
      exports: [scaffold, report]
    - path: plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs
      provides: "scaffold/report/commit tests for the migrate route"
  key_links:
    - from: plugins/aoforge/aoforge/bin/lib/adopt.cjs scaffold
      to: legacy-migrate.convertResidue
      via: "migrate marker only, after upgrade.backup per planning root"
      pattern: "convertResidue"
    - from: plugins/aoforge/aoforge/bin/lib/adopt.cjs report
      to: legacy-migrate.renderMigrationSection
      via: "the report's Migration section from marker.migration"
      pattern: "renderMigrationSection"
    - from: plugins/aoforge/aoforge/bin/lib/adopt.cjs report
      to: upgrade.check
      via: "pending migrations per planning root, as needs-review rows"
      pattern: "upgrade\\.check"
---

# TRD 80-03: Migrate scaffold and report, and the one recorded change

<objective>
Finish the migrate route's deterministic half: `adopt scaffold` converts the residue (stamp key, CLAUDE.md block
markers, ignore lines) and records what it did in the marker; `adopt report` writes ADOPT-REPORT.md listing the
migration, checks health, and returns the compact file list and message for adopt's one commit. A test drives the
real `aof-tools commit` with that list and proves the result is one clean, history-keeping change.

Purpose: SC-1 (one change on aoforge/adopt, nothing else written into planning content, health clean of the legacy
codes afterwards), SC-2 (idempotent, resumes) and SC-4's report requirement. The workflow wiring is TRD 80-05.
Output: migrate branches in scaffold/report, CLI messages, tests.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-01-SUMMARY.md (convertResidue / renderMigrationSection shapes)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-02-SUMMARY.md (migrate marker, preflight/begin JSON)
@plugins/aoforge/aoforge/bin/lib/adopt.cjs (lines 452-1135: scaffold, report, computeCommitFiles, renderReport)
@plugins/aoforge/aoforge/bin/lib/adopt-cli.cjs
@plugins/aoforge/aoforge/bin/lib/upgrade.cjs (backup at ~294, check at ~427)
@plugins/aoforge/aoforge/bin/lib/misc.cjs (cmdCommit at ~583: commit_docs filter, ignored-path probe, pathspec commit)
@plugins/aoforge/aoforge/bin/lib/planning-layout.cjs (CODE, CONFIG_CODE, CLAUDE_MD_CODE)

Objective-wide rules (every task):
- Repo CLI `node plugins/aoforge/aoforge/bin/aof-tools.cjs ...`; commit only through
  `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-03): <desc>" --files <paths>`; RED before GREEN;
  one plain command per Bash call.
- Tests: mkdtemp repos + fake HOME; run as `TMPDIR=<S>/80-03/tmp HOME=<S>/80-03/home node --test <files>` with
  `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
- Never write a real fleet repository; never port 8080; never push, tag or release.
- No legacy spelling in adopt.cjs / adopt-cli.cjs: legacy-migrate renders and names everything legacy.
- Concurrency: quick 42 may still be committing here; stage only this TRD's files.
</context>

<embedded_context>

<codebase_examples>
**Probe run on a read-only clone of a fleet repo (2026-10-17, scratchpad): `git mv` then the commit verb with
directory entries works and keeps history:**

```
git switch -c aoforge/adopt; git mv .planning .aoforge; (rewrite .gitignore line)
node aof-tools.cjs commit "chore(aoforge): adopt (migrate)" --files .aoforge .planning .gitignore
→ one commit, 84 files changed (83 renames + .gitignore), `git status --porcelain` empty,
  `git log --follow -- .aoforge/ROADMAP.md` reaches the project's earlier commits
```
`git add .planning` fails silently there (the path is gone and already staged as removed), and the pathspec commit
still records the deletions because git overlays HEAD on the pathspec. Do not list thousands of files: the workflow
pastes `commit_files` into one Bash command, and eden-biz alone tracks ~3,000 planning files.

**What fresh-mode report does that migrate mode must NOT (it would write planning content):** redact codebase docs,
PROJECT.md and the CLAUDE.md block (adopt.cjs:917-921); write STACK-REPORT.md (1037-1052); read inferences;
add stack-draft and codebase-doc rows. Migrate mode keeps only: health rows, pending-upgrade rows, the Migration
section, commit files.

**Fresh scaffold writes (adopt.cjs:601-655) — none of these run in migrate mode:** STATE.md, ROADMAP.md,
STACK.md (initProfile), the CLAUDE.md block (upsert), `upgrade.apply`. `backupPrune.register` (runtime home only) does
run: a migrated repo is pruned like any other.
</codebase_examples>

<anti_patterns>
- Calling `upgrade.apply` inside the migrate path: migrations 0002/0003/0004 write planning files (TRD renames,
  state.json, OBJECTIVE.md). SC-1 forbids it; the report lists them as the next step instead.
- `validate health --repair` from adopt: it writes planning content.
- Per-file commit lists for moved trees; listing `.aoforge/.skill-active` or other transient files.
- Overwriting an ADOPT-REPORT.md the move carried over (an earlier adopt's).
- Spelling legacy names in adopt.cjs for the report: use renderMigrationSection.
</anti_patterns>

<error_recovery>
- `validate health` cannot be spawned or parsed for a root: record a priority row "health not checked for <root>"
  and do not set commit_blocked for it (the legacy-code check falls back to planning-layout's detectors in-process).
- convertResidue records an invalid config.json: a priority needs-review row naming the file and "rename the key by
  hand"; W067 then cannot be checked, so commit is not blocked by it.
</error_recovery>

</embedded_context>

<gotchas>
- `aof-tools commit` skips planning paths when the project's config says `commit_docs: false`; with a tracked moved
  tree that would commit the deletions without the additions. Detect it in report (read the root config's
  `planning.commit_docs` / top-level `commit_docs` the way loadConfig does) and block with the fix.
- An untracked moved tree (the whole legacy dir was ignored) contributes no directory entry: git knows nothing under
  either path, and `git commit -- <dir>` with an unknown pathspec fails the whole commit.
- `git add <dir>` sweeps untracked, non-ignored files. Before returning commit_files, append any untracked,
  non-ignored transient basename under a directory entry (`.skill-active`, `.adopt-inferences.json`, the notices
  file) to `.git/info/exclude` (local, never committed) and list it in the report's migration record.
- The report date comes from `marker.started_at` (as today) so a re-run renders the same bytes.
- The old ADOPT-REPORT.md the move may carry: read its bytes from HEAD at the pre-move path
  (`git show HEAD:<from>/ADOPT-REPORT.md`) so a re-run renders the same file; append it verbatim after a
  `## Previous adopt report` heading.
- Report path for a nested-only repo is `<first root>/.aoforge/ADOPT-REPORT.md` (80-02's marker field); never create a
  root `.aoforge/`.
</gotchas>

## Test list

`adopt-migrate-report.legacy.test.cjs`, outermost first. Each test drives preflight → begin → scaffold → report
in-process (or through the CLI where named) on an 80-01 `legacyFleetRepo` variant, with a fake HOME.

1. 2.x fleet repo, full path then `aof-tools commit "<commit_message>" --files <commit_files>` (spawned): exit 0,
   `committed: true`; exactly one new commit on `aoforge/adopt` above the base sha; `git status --porcelain` empty;
   `git diff --find-renames=100% --name-status <base> HEAD` lists every moved planning file as `R100` except the
   root and `api` config.json (a D/A pair at that threshold; `git diff -M --name-status` shows them as `R0NN`, one
   changed line each) and the new ADOPT-REPORT.md (`A`); `.gitignore`,
   `api/.gitignore` and CLAUDE.md are `M`; nothing else changed; `git log --follow -- .aoforge/ROADMAP.md` reaches the
   fixture's first commit.
2. commit_files is compact: it contains `.planning`, `.aoforge`, `api/.planning`, `api/.aoforge`, `web/.planning`,
   `web/.aoforge`, `.gitignore`, `api/.gitignore`, `CLAUDE.md` and nothing under a moved tree; under 20 entries.
3. The config.json change is exactly one line (the key token); every other moved file's bytes equal its pre-move
   bytes (hash before at the legacy path, after at the new path).
4. ADOPT-REPORT.md: first heading `# Adopt report — <name>`, `**Mode:** migrate`, `## Migration` with one row per
   moved tree, stamp key, block and ignore line, the vendor decoy under "Not moved", `## Needs review` with the
   pending-upgrade row(s) naming `aof-tools upgrade --check`, and next steps naming
   `git switch <base> && git merge aoforge/adopt` and "Nothing was pushed".
5. After the commit: `validate health --raw` at the root and at `api/` has no W066/W067/W069; `adopt preflight`
   returns `upgrade` (the marker is ignored because the report is in HEAD) and writes nothing.
6. Idempotent: scaffold run twice → the second converts nothing and the marker's migration record is unchanged;
   report run twice → identical ADOPT-REPORT.md bytes and identical commit_files.
7. Resume after report, before commit: preflight `resume` with steps all true; report again → same result; the
   commit then succeeds as in 1.
8. Untracked tree (`untrackedTree: true`): commit_files holds no planning directory entry; `.gitignore` (the
   whole-dir line rewritten) is listed; commit succeeds; the moved tree stays untracked and ignored.
9. `commit_docs: false` with a tracked tree: report returns `commit_blocked.reason === 'commit-docs-false'` with a
   message naming the config file and the fix; a priority row says the same; nothing is committed by the test.
10. Residue-only repo (`adopted-on-aoforge`): commit_files = `.aoforge/ADOPT-REPORT.md`, `.aoforge/config.json`,
    `CLAUDE.md`; commit succeeds; W067 and W069 gone.
11. Carried-over report: a legacy tree with an earlier `ADOPT-REPORT.md` → the new report starts with the migrate
    report and ends with `## Previous adopt report` followed by the old bytes verbatim; re-run identical.
12. Transient guard: an untracked `.aoforge/.aoforge-notices.json` present at report time → added to
    `.git/info/exclude`; not in the commit.
13. scaffold before the move finished (migrate marker, `steps.moved: false`) → throws "run adopt begin first";
    report before scaffold → throws "run adopt scaffold first" (CLI exit 1, as today).
14. CLI prose: `adopt scaffold` prints `migrated: <n> converted` and `adopt report` prints `report: <n> to review`
    (plus `; commit blocked: <reason>` when blocked); `--raw` JSON carries `mode: 'migrate'`.
15. Regression: adopt-scaffold.test.cjs, adopt-report.test.cjs and adopt-e2e.test.cjs pass unchanged (fresh mode
    byte-identical).

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests for migrate scaffold/report/commit</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs</files>
  <action>
Write the Test list as named tests (header comment = the list). They fail today because scaffold/report run the fresh
path (PROJECT.md validation throws, STATE/ROADMAP get written). Commit
`test(80-03): adopt migrate scaffold, report and one recorded change (RED)`.
  </action>
  <verify>TMPDIR=<S>/80-03/tmp HOME=<S>/80-03/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs → rows 1-14 fail on missing migrate behaviour (not fixture errors); row 15 is a run of the three existing files and passes</verify>
  <done>Tests written and failing for the right reason; RED commit recorded.</done>
  <recovery>If row 1's commit step needs a git identity, take it from the fixture's hermetic env (legacyFleetRepo sets a local identity, signing off); never pass `--no-gpg-sign`.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Migrate scaffold (GREEN for 6, 13 and the scaffold half of 1-3, 10, 14)</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt.cjs, plugins/aoforge/aoforge/bin/lib/adopt-cli.cjs</files>
  <action>
In `scaffold`, after the `route !== 'resume'` early return, branch on `pf.adopt.marker.mode === 'migrate'`:
1. `steps.moved` false → `throw new Error('run adopt begin first: the move is not finished')`.
2. Planning roots: from the marker plan (dirs of the moves) plus `''` when the root has `.aoforge/`, sorted, `''`
   first. For each root take `upgrade.backup({ projectRoot: <abs root>, userHome })` once per scaffold that will
   convert something (skip when `steps.scaffolded` and nothing is left); record the backup paths.
3. `const done = legacyMigrate.convertResidue(target, { env, roots })`. First run: store
   `marker.migration = { moves: marker.plan.moves (with how = tracked ? 'git mv' : 'rename'), ...done, skipped:
   <planMigration(target).skipped>, backups }`. Later runs: merge only non-empty new entries; never replace the
   stored record with empty lists.
4. `backupPrune.register({ userHome, projectRoot: target, now })`; `marker.steps.scaffolded = true`; write the marker
   last.
5. Return `{ route: 'scaffold', mode: 'migrate', target, migration: marker.migration, marker }`. Nothing else is
   written: no readProjectMd, no STATE/ROADMAP/STACK, no block upsert, no upgrade.apply.
adopt-cli.cjs: for a migrate scaffold result print `migrated: <n> converted` where n counts stamps + blocks + ignore
changes (exclude lines excluded); fresh mode keeps `scaffolded: <n> created`.
Commit `feat(80-03): adopt scaffold converts a migrated project's stamp key, block markers and ignore lines`.
  </action>
  <verify>TMPDIR=<S>/80-03/tmp HOME=<S>/80-03/home node --test --test-name-pattern="^(6|13)\." plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs plus plugins/aoforge/aoforge/bin/lib/adopt-scaffold.test.cjs → pass</verify>
  <done>Migrate scaffold converts residue once, records it, writes nothing else; fresh scaffold unchanged.</done>
  <recovery>If upgrade.backup refuses a nested root (it calls planningRoot(projectRoot)), back up just that root's `.aoforge/config.json` and CLAUDE.md into the same backup dir by hand-copying, and record it.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Migrate report and compact commit files (GREEN for all rows)</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt.cjs, plugins/aoforge/aoforge/bin/lib/adopt-cli.cjs</files>
  <action>
In `report`, after the scaffolded precondition, branch on the migrate marker:
1. Health per planning root: `runValidateHealth(<abs root>, env)`; collect each error/warning as today's rows
   (priority / low) prefixed with the root (`api/: validate health warning W009 ...`); collect codes in
   `[layout.CODE, layout.CONFIG_CODE, layout.CLAUDE_MD_CODE]` into `legacy_codes` (fallback when health could not
   run: planning-layout's legacyPlanningIssue / legacyConfigKeyIssue / legacyClaudeMdIssue in-process).
2. Pending upgrades per root: `upgrade.check({ projectRoot, userHome, pluginVersion })`; `pending` → a low row
   "<n> automatic upgrade migration(s) pending (<ids>): the next session start applies them, or run
   `aof-tools upgrade --apply`"; `pending_confirm` → a low row naming `/aoforge:status check --migrate`.
3. A priority row "adopt changed no planning content beyond the stamp key; findings above come from the project's own
   files" when any health row exists (so a reader does not blame the move).
4. `commit_blocked`: `legacy_codes` non-empty → `{ reason: 'legacy-layout-remains', message: <codes and roots> }`;
   else root config `commit_docs === false` and any tracked move → `{ reason: 'commit-docs-false', message: 'set
   planning.commit_docs to true in <root>/.aoforge/config.json, or record the staged move yourself' }`; else null.
   Add a priority row for a block.
5. Render: `renderMigrateReport({ name, date (marker.started_at), version, branch, baseBranch, baseSha7, rows,
   migrationSection: legacyMigrate.renderMigrationSection(marker.migration), previous })` — header line as today plus
   ` · **Mode:** migrate`, then the Migration section, `## Needs review` (renderNeedsReviewTable), `## What adopt
   did` (moved N trees with git mv, renamed the stamp key / block markers, rewrote M ignore lines, backups), `## Next
   steps` (review; `git switch <base> && git merge <branch>`, nothing pushed; `aof-tools upgrade --check` then the
   session start or `upgrade --apply`; other branches of this repository still on the old layout move when they
   merge this one, or by re-running adopt there). Name from PROJECT.md heading when present at the first root, else
   the repo basename. `previous` = HEAD bytes of `<from>/ADOPT-REPORT.md` for the move whose `to` holds report_path,
   appended after `## Previous adopt report`.
6. Write the report at `marker.report_path`; `marker.steps.reported = true`; write the marker.
7. `computeMigrateCommitFiles(target, env, marker)`: from porcelain (after all writes): a dirty path under a tracked
   move's `from` or `to` contributes that directory once; any other dirty path that `ownsMigratePath` accepts and
   whose basename is not transient is listed itself; apply the transient info/exclude guard (gotchas) first; sort.
8. Return `{ route: 'report', mode: 'migrate', target, report_path, needs_review: rows, migration,
   legacy_codes, pending_upgrades, commit_files, commit_message:
   'chore(aoforge): adopt — move the pre-rename planning layout (AOForge v<version>)', commit_blocked, marker }`.
   Build the message from NAMES (no legacy spelling).
adopt-cli.cjs: migrate report prose `report: <n> to review` plus `; commit blocked: <reason>` when set.
Run the whole new file and the three fresh-mode files. Commit
`feat(80-03): adopt report lists the migration and returns one compact commit for the move`.
  </action>
  <verify>TMPDIR=<S>/80-03/tmp HOME=<S>/80-03/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-scaffold.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-report.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-e2e.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs → 0 failures</verify>
  <done>All 15 rows pass; one commit with renames, clean tree, no legacy codes; fresh mode unchanged.</done>
  <recovery>If `aof-tools commit` refuses the directory entries (e.g. its foreign-index check fires because git mv staged renames outside the listed paths), list exactly the moved directories it complains about rather than files, and add a test row for the case; do not change misc.cjs in this TRD without stopping to report it (it is shared by every workflow).</recovery>
</task>

</tasks>

<validation_gates>
<test>TMPDIR=<S>/80-03/tmp HOME=<S>/80-03/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-report.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-scaffold.test.cjs</test>
<lint>not_available</lint>
<build>not_available</build>
</validation_gates>

<verification>
- On the 2.x fleet-shaped repo, preflight → begin → scaffold → report → `aof-tools commit` gives one commit, clean
  tree, R100 renames, the stamp key line, and an ADOPT-REPORT.md that lists the migration.
- Health at every planning root shows no legacy code; preflight then routes to upgrade.
- Fresh adopt tests unchanged and green; rename guard green.
</verification>

<success_criteria>
- The migrate route ends in exactly one recorded change on aoforge/adopt that moves the trees with history and
  converts only the stamp key, block markers and ignore lines, plus the report.
- Every re-run before the commit reproduces the same report and file list.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-03-SUMMARY.md` (`planning draft` +
`summary post`). Record the scaffold/report JSON for the migrate route (fields and an example) for TRD 80-05's
workflow text and 80-06's e2e.
</output>
