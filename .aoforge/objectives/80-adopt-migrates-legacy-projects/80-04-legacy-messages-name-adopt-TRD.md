---
objective: 80-adopt-migrates-legacy-projects
trd: "04"
type: standard
wave: 1
depends_on: []
files_modified:
  - plugins/aoforge/aoforge/bin/lib/planning-layout.cjs
  - plugins/aoforge/aoforge/bin/lib/upgrade.cjs
  - plugins/aoforge/aoforge/bin/lib/upgrade-retired.legacy.test.cjs
  - plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs
autonomous: true
requirements: [SC-3]
must_haves:
  truths:
    - "The one legacy-layout message (planning-layout.legacyLayoutMessage, and W066's fix) names `/aoforge:adopt` as the 3.1 path first, then AOForge 3.0.x, then the manual `git mv`; every surface that prints it (validate health W066, the aof-tools CLI guard, the SessionStart notice, doctor check 27 and doctor's project note) shows the adopt path"
    - "W067's fix and the project W069 fix also name `/aoforge:adopt`; the global (~/.claude/CLAUDE.md) W069 text does not, because adopt never touches the global file"
    - "`aof-tools upgrade --apply --only 0012|0013|0014` names `/aoforge:adopt` beside 3.0.x and the manual step"
    - "Every existing legacy-message test still passes (they check for 3.0.x, `git mv` and the guide, which stay)"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/planning-layout.cjs
      provides: "layoutFix / W067 / W069 text naming the adopt path"
    - path: plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs
      provides: "outside-in proof that each surface names /aoforge:adopt"
  key_links:
    - from: plugins/aoforge/aoforge/bin/lib/planning-layout.cjs layoutFix
      to: NAMES.commandNs + 'adopt'
      via: "built from NAMES, no literal"
      pattern: "commandNs"
    - from: plugins/aoforge/aoforge/bin/lib/upgrade.cjs retiredMessage
      to: the adopt path
      via: "one sentence before the 3.0.x path"
      pattern: "retiredMessage"
---

# TRD 80-04: Every legacy-layout message names `/aoforge:adopt` as the 3.1 path

<objective>
Change the single source of the legacy-layout text so every place 3.1 reports a pre-rename project points at
`/aoforge:adopt` first, alongside AOForge 3.0.x and the manual `git mv`. The surfaces (W066 in validate health, the
aof-tools CLI guard, the upgrade-project SessionStart notice, doctor check 27 and doctor's project note) all build
their text from planning-layout.cjs, so this is one module plus the retired-migration line in upgrade.cjs, proved
outside-in by a new test that drives each surface.

Purpose: SC-3. Independent of the adopt code changes (TRDs 80-01..80-03); it lands in the same release.
Output: updated message text, a retired-id line, one new test file, one updated test.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@plugins/aoforge/aoforge/bin/lib/planning-layout.cjs (layoutProblem, layoutFix, legacyConfigKeyIssue, legacyBlockMessage)
@plugins/aoforge/aoforge/bin/lib/upgrade.cjs (lines 15-50 and 340-370: RETIRED_MIGRATIONS, retiredMessage)
@plugins/aoforge/aoforge/bin/lib/upgrade-retired.legacy.test.cjs (lines 30-110)
@plugins/aoforge/hooks/upgrade-project.legacy.test.js (lines 1-60: how the hook is spawned with a fake HOME)
@plugins/aoforge/aoforge/bin/lib/doctor-checks/27-legacy-planning-layout.legacy.test.cjs (lines 1-60, 160-180)
@plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs (lines 1-80: spawning a refused command)

Objective-wide rules (every task):
- Repo CLI `node plugins/aoforge/aoforge/bin/aof-tools.cjs ...`; commit only through
  `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-04): <desc>" --files <paths>`; RED before GREEN;
  one plain command per Bash call.
- Tests: mkdtemp fixtures + fake HOME; run as `TMPDIR=<S>/80-04/tmp HOME=<S>/80-04/home node --test <files>` with
  `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
- Never port 8080; never push, tag or release. planning-layout.cjs and upgrade.cjs stay free of legacy spellings
  (build from NAMES/LEGACY as today).
- Concurrency: quick 42 may still be committing here; stage only this TRD's files. This TRD runs in wave 1 beside
  80-01, which touches none of these files; 80-02 later edits legacy-layout-guard.legacy.test.cjs, so do NOT edit
  that file here (the new test file covers the CLI guard surface).
</context>

<embedded_context>

<codebase_examples>
**Today's fix text (planning-layout.cjs:126-138):**

```js
function layoutFix() {
  return `Move it with ${PRODUCT} ${SHIM_RELEASE} (\`${CLI} upgrade --apply\`) or by hand: \`git mv ${OLD_DIR} ${NEW_DIR}\`, `
    + `then rename a "${OLD_KEY}" key in ${NEW_DIR}/config.json to "${NEW_KEY}" (see ${MIGRATION_GUIDE}, "Upgrading from 2.x")`;
}
function legacyLayoutMessage(root) {
  return `${layoutProblem(root)}. ${layoutFix()}.`;
}
```

**Target text (adapt wording, keep every existing part so the include-checks in the older tests still hold):**

```js
const ADOPT = `${NAMES.commandNs}adopt`;   // "/aoforge:adopt"
function layoutFix() {
  return `Run \`${ADOPT}\` there (${PRODUCT} ${SHIM_REMOVAL} moves it to ${NEW_DIR}/ as one recorded change on `
    + `${NAMES.adoptBranch}), or move it with ${PRODUCT} ${SHIM_RELEASE} (\`${CLI} upgrade --apply\`) or by hand: `
    + `\`git mv ${OLD_DIR} ${NEW_DIR}\`, then rename a "${OLD_KEY}" key in ${NEW_DIR}/config.json to "${NEW_KEY}" `
    + `(see ${MIGRATION_GUIDE}, "Upgrading from 2.x")`;
}
```

**Surfaces and where they read the text (all unchanged code, they pick up the new text):**
- validate.cjs:213 and :844 → `legacyPlanningIssue(cwd)` (W066 message + fix)
- legacy-layout-guard.cjs:67 → `legacyLayoutMessage(root)` (aof-tools main → error → stderr, exit 1)
- hooks/upgrade-project.js:191 → `layout.legacyLayoutMessage(real)` (global notice, key `legacy-layout:<root>`)
- doctor-checks/27-legacy-planning-layout.cjs:32 → `legacyPlanningIssue(root)`; doctor-cli.cjs:96 → `legacyLayoutMessage`
- init.cjs:579 → `legacyPlanningIssue(cwd)` as an advisory line
</codebase_examples>

<anti_patterns>
- Hard-coding `/aoforge:adopt` or `aoforge/adopt` as literals: build from NAMES (commandNs, adoptBranch).
- Naming adopt in the GLOBAL W069 text (`~/.claude/CLAUDE.md`): adopt only rewrites project files.
- Dropping 3.0.x, `git mv` or the guide from the text: older tests and the migration guide rely on them, and some
  users will prefer the manual path.
- Editing legacy-layout-guard.legacy.test.cjs (owned by 80-02 in wave 2).
</anti_patterns>

<error_recovery>
- A test elsewhere compares the full message string literally (not via the function): find it with
  `rg -n "Move it with" plugins/` and switch it to compare against the function's output, in a separate commit
  that lists the file.
</error_recovery>

</embedded_context>

<gotchas>
- `SHIM_REMOVAL` is `'3.1.0'` and `SHIM_RELEASE` is `'3.0.x'` (legacy-names.cjs); planning-layout imports
  SHIM_RELEASE today, add SHIM_REMOVAL to that import.
- `legacyBlockMessage(fileLabel)` is shared by W069 (project, label `CLAUDE.md`) and the global upgrade (label
  `~/.claude/CLAUDE.md`) and by managed-block's ELEGACYBLOCK refusal. Name adopt only when the label is the project
  one; global-upgrade.legacy.test and managed-block.legacy.test must stay green.
- The doctor 27 test asserts `finding.includes('3.0.x') && includes('git mv ...')`; keep both.
- `docs/MIGRATING-TO-AOFORGE.md` quotes the old message verbatim (around line 105). That guide is TRD 80-09's file;
  do not edit it here, but name the quote in your SUMMARY so 80-09 updates it.
</gotchas>

## Test list

`legacy-layout-adopt-path.legacy.test.cjs`, outermost first (fixtures: legacy-layout-fixtures `planningProject`).

1. CLI guard: in a legacy-only project, `aof-tools state load` exits 1 and its stderr contains `/aoforge:adopt`,
   `aoforge/adopt`, `3.0.x`, `git mv` and the guide name; no `.aoforge/` appears.
2. validate health: `aof-tools validate health --raw` in that project → status broken, one W066 whose `fix` contains
   `/aoforge:adopt` before `3.0.x` (index order).
3. SessionStart notice: spawn hooks/upgrade-project.js at the project root (fake HOME, CLAUDE_PLUGIN_ROOT = this
   repo's plugin dir, as upgrade-project.legacy.test.js does) → the queued global notice message contains
   `/aoforge:adopt`.
4. doctor: `aof-tools doctor --raw` in that project → the note contains `/aoforge:adopt`; check 27 run directly on the
   root → its finding contains `/aoforge:adopt`, `3.0.x` and `git mv`.
5. W067 (an `.aoforge/` project with only the pre-rename stamp key): the fix names `/aoforge:adopt`; with both keys,
   the fix names `/aoforge:adopt` too.
6. W069 project (`claudeMd: 'legacy-block'`): `legacyClaudeMdIssue(root).fix` names `/aoforge:adopt`;
   `legacyBlockMessage('~/.claude/CLAUDE.md').fix` does NOT name it.
7. Retired ids: `aof-tools upgrade --apply --only 0012` in an `.aoforge/` project exits 1 with one line naming
   `retired`, `/aoforge:adopt`, `3.0.x` and the guide (upgrade-retired.legacy.test's expected-string helper updated
   to match).
8. Unit: `legacyLayoutMessage(root)` = problem + `. ` + fix + `.`; the adopt clause precedes the 3.0.x clause; the
   text holds no literal outside what NAMES/LEGACY produce (compare against a string built from NAMES/LEGACY).

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED test across the five surfaces</name>
  <files>plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs, plugins/aoforge/aoforge/bin/lib/upgrade-retired.legacy.test.cjs</files>
  <action>
Write the Test list as named tests (header comment = the list). Rows 1-7 fail today (no adopt clause). In
upgrade-retired.legacy.test.cjs update the expected-message helper (lines ~60-62) to the new wording, so its row 3
goes RED too. Commit `test(80-04): legacy-layout surfaces name /aoforge:adopt (RED)`.
  </action>
  <verify>TMPDIR=<S>/80-04/tmp HOME=<S>/80-04/home node --test plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/upgrade-retired.legacy.test.cjs → the adopt-clause assertions fail, nothing else</verify>
  <done>Eight rows written; RED for the missing clause only; RED commit recorded.</done>
  <recovery>If spawning the hook needs more env than the hook test sets, copy that test's spawn helper verbatim into the new file.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — the text in planning-layout.cjs and upgrade.cjs</name>
  <files>plugins/aoforge/aoforge/bin/lib/planning-layout.cjs, plugins/aoforge/aoforge/bin/lib/upgrade.cjs</files>
  <action>
1. planning-layout.cjs: import SHIM_REMOVAL; add `const ADOPT = \`${NAMES.commandNs}adopt\`` near the other
   constants; rewrite `layoutFix()` per codebase_examples (adopt clause first, then 3.0.x, then the manual step).
   W067: the only-legacy fix becomes `In <file>, rename the key to "<new>" (or run \`/aoforge:adopt\`, which
   renames it as one recorded change, or ${PRODUCT} ${SHIM_RELEASE}'s \`${CLI} upgrade --apply\` once)`; the both-keys
   fix adds `(or run \`/aoforge:adopt\`)`. `legacyBlockMessage(fileLabel)`: when `fileLabel === 'CLAUDE.md'`, append
   `, or run \`/aoforge:adopt\` (it renames both markers)` to the fix; otherwise unchanged. Update the module header
   comment: "every message names the same three fixes: /aoforge:adopt (3.1), AOForge 3.0.x, or the manual step".
2. upgrade.cjs `retiredMessage(id)`: `migration <id> (<title>) was retired after AOForge 3.0.x: run /aoforge:adopt
   (3.1 moves the planning directory, the stamp key and the CLAUDE.md markers), run it with AOForge 3.0.x, or do it
   by hand (<guide>, "Upgrading from 2.x")` built from NAMES/SHIM_RELEASE/layout().MIGRATION_GUIDE.
3. Run the new file, upgrade-retired, and every existing legacy-message test: planning-layout.legacy,
   planning-layout-detect.legacy, old-layout.legacy, compat.legacy, doctor-checks/27 legacy, hooks
   upgrade-project.legacy, legacy-layout-guard.legacy, managed-block.legacy, global-upgrade.legacy,
   planning-verbs-worktree.legacy, rename-guard.repo.
Commit `feat(80-04): the legacy-layout message, W067/W069 and retired ids name /aoforge:adopt`.
  </action>
  <verify>TMPDIR=<S>/80-04/tmp HOME=<S>/80-04/home node --test plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/upgrade-retired.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/planning-layout.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/planning-layout-detect.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/old-layout.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/doctor-checks/27-legacy-planning-layout.legacy.test.cjs plugins/aoforge/hooks/upgrade-project.legacy.test.js plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/managed-block.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/global-upgrade.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs → 0 failures</verify>
  <done>All five surfaces and the retired-id line name /aoforge:adopt; global W069 does not; every older legacy test green.</done>
  <recovery>If an older test pins an exact string that now differs, change that assertion to compare against the planning-layout function's output (same test intent), add the file to this TRD's commit and list it in the SUMMARY.</recovery>
</task>

</tasks>

<validation_gates>
<test>TMPDIR=<S>/80-04/tmp HOME=<S>/80-04/home node --test plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/upgrade-retired.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/planning-layout.legacy.test.cjs</test>
<lint>not_available</lint>
<build>not_available</build>
</validation_gates>

<verification>
- In a legacy-only fixture: `aof-tools state load` stderr, `validate health` W066 fix, the SessionStart notice,
  `doctor` note and check 27 each name `/aoforge:adopt` before 3.0.x.
- Global W069 text unchanged.
</verification>

<success_criteria>
- SC-3 holds: every 3.1 legacy-layout surface names `/aoforge:adopt` as the 3.1 path beside 3.0.x and the manual move.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-04-SUMMARY.md` (`planning draft` +
`summary post`), quoting the final message text verbatim (TRD 80-09 updates the migration guide's quote from it).
</output>
