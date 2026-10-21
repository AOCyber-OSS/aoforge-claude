---
objective: 80-adopt-migrates-legacy-projects
trd: "06"
type: standard
wave: 4
depends_on: ["80-03"]
files_modified:
  - plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs
  - plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
autonomous: true
requirements: [SC-1, SC-2, SC-4]
must_haves:
  truths:
    - "A scripted run of the workflow's command sequence on three fixtures passes under the 3.1.0 tree: a fresh repo (routes to new-project and changes nothing), a brownfield repo with code and no planning (the full adopt pipeline, one commit, checker green), and a fleet-shaped pre-rename repo (the migrate path, one commit, checker green)"
    - "The migrated repo is indistinguishable, to validate health, from the same repo migrated by hand per the guide's manual steps (same finding codes at every planning root), and its health has no error"
    - "Re-running adopt after success is safe (upgrade route, or adopt-branch-exists for a nested-only repo; nothing written), and an adopt interrupted after begin, after scaffold or after report resumes to the same final tree"
    - "Every 3.1 tool works on the migrated repo: state load, roadmap analyze, validate health, doctor, upgrade --check and --apply (its change commits cleanly), init plan-objective"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs
      provides: "the three-fixture end-to-end proof for SC-4, with idempotency and resume"
    - path: plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
      provides: "`check --mode migrate` structural checks"
  key_links:
    - from: plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs
      to: plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
      via: "spawned `check <root> --home <home> --mode migrate`"
      pattern: "--mode"
    - from: plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
      to: legacy-migrate.planMigration / planning-layout codes
      via: "no legacy layout left, without a literal legacy spelling"
      pattern: "planMigration"
---

# TRD 80-06: Adopt end to end on a fresh, a brownfield and a pre-rename fixture

<objective>
Prove SC-4's three-fixture run deterministically in the suite: the exact command sequence the workflow prescribes,
on a fresh repo, a brownfield repo and a fleet-shaped pre-rename repo, each ending in the state the workflow promises
and checked by the structural checker (extended with a migrate mode). Add the re-run and resume matrix and the "every
3.1 tool works" probe on the migrated result.

Purpose: SC-1, SC-2 and SC-4 in CI. The live, agent-followed runs on real fleet copies are TRDs 80-07/80-08.
Output: one e2e test file, checker extension.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-03-SUMMARY.md (report JSON, commit_files)
@plugins/aoforge/aoforge/bin/lib/adopt-e2e.test.cjs (the scripted brownfield pipeline to mirror)
@plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
@plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-fixtures.cjs (makeFixture kinds, writeMappedDocs, writeProjectMd, writeInferences)
@plugins/aoforge/aoforge/bin/lib/__fixtures__/legacy-adopt-fixtures.cjs (from 80-01)
@plugins/aoforge/aoforge/workflows/adopt.md (the command sequence; 80-05 may land in the same wave, so take the
 sequence from 80-02/80-03 SUMMARYs: preflight → begin → scaffold → report → commit for migrate)

Objective-wide rules (every task):
- Repo CLI `node plugins/aoforge/aoforge/bin/aof-tools.cjs ...`; commit only through
  `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-06): <desc>" --files <paths>`; one plain command
  per Bash call.
- Tests: mkdtemp repos + fake HOME; run as `TMPDIR=<S>/80-06/tmp HOME=<S>/80-06/home node --test <files>` with
  `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
  Under `/var/folders` repo-state would call the brownfield fixture `scratch`.
- Never write a real fleet repository; never port 8080; never push, tag or release.
- adopt-e2e-assert.cjs is not on the rename guard's ALLOW list: it detects legacy leftovers through legacy-migrate and
  planning-layout, never a literal. The test file is `*.legacy.test.cjs` and may spell names.
- Concurrency: stage only this TRD's files (80-05 runs in the same wave on other files).
</context>

<embedded_context>

<codebase_examples>
**The brownfield scripted pipeline (adopt-e2e.test.cjs, row 15) — mirror it for the brownfield fixture:**

```
preflight → begin → skill-active --start adopt → writeMappedDocs → writeProjectMd({kind}) → writeInferences
→ scaffold → validate health --raw → report → skill-active --end → commit "<commit_message>" --files <commit_files>
→ node __fixtures__/adopt-e2e-assert.cjs check <root> --home <home>   (exit 0, every check ok)
```

**The migrate sequence (no skill marker, no map/infer, no health step, no repair):**

```
preflight (route migrate) → begin → scaffold → report (commit_blocked null) → commit "<commit_message>" --files <commit_files>
→ node __fixtures__/adopt-e2e-assert.cjs check <root> --home <home> --mode migrate
```

**Checker library shape (adopt-e2e-assert.cjs): `runChecks({root, home, df}) -> {ok, checks:[{id, ok, detail}]}`;
CLI `check|snapshot|compare`.** Add `mode` (`adopt` default, `migrate`) to runChecks and `--mode` to `check`.
</codebase_examples>

<anti_patterns>
- Duplicating the migrator's unit assertions here: this file proves the sequence and end state, not each converter.
- Comparing whole-tree hashes across two fixtures built at different times (report dates differ); compare
  `git diff --name-status` sets, health codes and planning-file hashes instead.
- Running `init plan-objective` before the idempotency checks: it bootstraps OBJECTIVE.md files (3.1 behaviour) and
  dirties the tree. Run it last.
- Literal legacy spellings in adopt-e2e-assert.cjs.
</anti_patterns>

<error_recovery>
- A row fails because of a product defect (not the test): fix it test-first in the owning file (adopt.cjs,
  legacy-migrate.cjs) with a failing unit row in that TRD's test file, commit `fix(80-06): ...` listing those files,
  and say so in the SUMMARY. Larger than ~5 tool calls → stop and report the gap.
</error_recovery>

</embedded_context>

<gotchas>
- `upgrade --apply` on the migrated fixture runs auto migrations that write planning files (0001 stamp, 0003
  state.json, 0004 OBJECTIVE.md, ...): that is the user's next step, outside adopt's commit. Commit its
  `changed_files` with `aof-tools commit` and assert the tree is clean, to prove the project is upgradable.
- `doctor --raw` exit code is non-zero when it finds errors; assert on check 27's result (no finding) rather than on
  the overall exit code, and record anything else as environment.
- Stack-pack profiles are not installed in a fake HOME: a STACK.md naming a pack profile gives E030. The synthetic
  fixture has no such reference (80-01), so the synthetic migrated repo must be health-clean (no errors).
- Nested-only repo after success: preflight refuses `adopt-branch-exists` (the root is brownfield, the branch exists,
  no active marker). That is the safe answer; assert it writes nothing.
</gotchas>

## Test list

`adopt-migrate-e2e.legacy.test.cjs`, outermost first.

Three fixtures through the workflow sequence:
1. Fresh: adopt-fixtures `empty` → preflight and begin both return `new-project` (exit 0), no branch, no marker,
   snapshot unchanged; a `git init`-only directory → `new-project` too.
2. Brownfield: adopt-fixtures `node-cli` through the scripted brownfield pipeline → checker (default mode) exit 0;
   preflight afterwards → `upgrade`; `adopt.mode` was `adopt` throughout.
3. Pre-rename (2.x fleet shape, nested + decoys): the migrate sequence → checker `--mode migrate` exit 0 with every
   check ok: `on_adopt_branch`, `one_commit`, `tree_clean`, `not_pushed`, `no_legacy_layout` (planMigration applies
   false; refusalFor null; no W066/W067/W069 at any `.aoforge/` root), `history_kept` (`git log --follow` of a moved
   file spans more than the adopt commit), `report_lists_migration` (ADOPT-REPORT.md has `## Migration` and a row
   per planning root), `stamp_current` (every root config has the new key and not the old one).
4. Pre-rename 3.0-era (aoforge stamp in the old directory, AOFORGE block): migrate sequence → checker green; only
   moves in the report's Migration table.
5. Nested-only (no root tree): migrate sequence → checker green; the report is `api/.aoforge/ADOPT-REPORT.md`; no root
   `.aoforge/` on disk or in HEAD.

Equivalence with a hand migration:
6. A second copy of fixture 3, migrated by hand per the guide (git mv each tree, rename the stamp key in each config,
   rename the block markers, rewrite the ignore lines) and committed: `validate health --raw` finding codes at the
   root and at `api/` equal the adopt-migrated copy's; the adopt copy's root health has no error.
7. Planning content untouched: every file under the moved trees hashes the same before (legacy path) and after (new
   path), except each config.json (one line) and the new ADOPT-REPORT.md.

Re-runs and resume:
8. After success (fixture 3): preflight → `upgrade`, begin → `upgrade`; `snapshot`/`compare` unchanged.
9. After success (fixture 5): preflight → `adopt-branch-exists` refusal, nothing written.
10. Interrupted after begin / after scaffold / after report (three fresh copies): running the sequence again from
    preflight resumes (`route: resume`, `adopt.mode: migrate`) and ends in the same `git diff --name-status <base>
    HEAD` set, the same health codes and the same planning-file hashes as the uninterrupted run.
11. Refusal through the sequence: a `both` fixture → preflight `refuse` `both-planning-dirs`, the sequence stops,
    snapshot unchanged.

Every 3.1 tool works (fixture 3 after success, in this order):
12. `state load`, `roadmap analyze`, `validate health` exit 0 with no legacy-layout message; `doctor --raw` has no
    check-27 finding; `upgrade --check` exit 0 listing pending migrations; `upgrade --apply` exit 0 and committing
    its `changed_files` through `aof-tools commit` leaves a clean tree; `init plan-objective 1` exit 0 (last).

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Checker migrate mode (RED then GREEN)</name>
  <files>plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs, plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs</files>
  <action>
1. Write the test file with the full Test list (header = the list) plus three checker negatives: on a migrated
   fixture, (a) recreate an empty legacy planning tree with a STATE.md → `no_legacy_layout` false, exit 1;
   (b) add a second commit → `one_commit` false; (c) put the old stamp key back → `stamp_current` false.
   Commit RED: `test(80-06): three-fixture adopt e2e and checker migrate mode (RED)`.
2. adopt-e2e-assert.cjs: `runChecks({ root, home, df, mode = 'adopt' })`; `mode === 'migrate'` runs the migrate checks
   named in row 3 instead of the brownfield-only ones (PROJECT.md kind, zero-objective ROADMAP, versioned block,
   inferences); shared checks (branch, one commit, clean, not pushed) run in both. Detect leftovers with
   `require('../legacy-migrate.cjs').planMigration(root)` and validate health codes compared against
   `require('../planning-layout.cjs')` CODE / CONFIG_CODE / CLAUDE_MD_CODE; the stamp check reads each root's
   config.json for `NAMES.configKey` and the absence of `LEGACY.configKey` (via legacy-names, no literal). `check`
   gains `--mode <adopt|migrate>`; usage text updated; unknown mode → usage, exit 1.
3. Run the checker negatives and row 3 until green. Commit `test(80-06): adopt-e2e-assert check --mode migrate`.
  </action>
  <verify>TMPDIR=<S>/80-06/tmp HOME=<S>/80-06/home node --test --test-name-pattern="(3\.|negative)" plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs plus plugins/aoforge/aoforge/bin/lib/adopt-e2e.test.cjs → pass</verify>
  <done>Checker has a migrate mode with the eight named checks; negatives fail the right check; brownfield checker behaviour unchanged.</done>
  <recovery>If 80-03's commit_files/report shape differs from its SUMMARY, follow the code, and note the difference in this SUMMARY.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The rest of the matrix GREEN</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs</files>
  <action>
Make rows 1-2 and 4-12 pass. Helpers inside the test: `runSeq(root, home, mode, { stopAfter })` driving the CLI
commands of the sequence and returning each JSON; `handMigrate(copy)` doing the guide's manual steps with git and fs
(the test may spell legacy names); `planningHashes(root, dirs)`. Build every fixture fresh per row (no shared
mutable fixture). Keep the file's runtime reasonable: reuse one fake HOME per describe. Any product defect found:
error_recovery. Commit `test(80-06): adopt e2e on fresh, brownfield and pre-rename fixtures; resume and tool probes`.
  </action>
  <verify>TMPDIR=<S>/80-06/tmp HOME=<S>/80-06/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-e2e.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs → 0 failures</verify>
  <done>All 12 rows and the negatives pass; the brownfield e2e and guards pass.</done>
  <recovery>If one row is slow (> 60 s), split its copies across rows rather than raising the test timeout above 120 s.</recovery>
</task>

</tasks>

<validation_gates>
<test>TMPDIR=<S>/80-06/tmp HOME=<S>/80-06/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-e2e.test.cjs</test>
<lint>not_available</lint>
<build>not_available</build>
</validation_gates>

<verification>
- The three fixtures each end where the workflow promises; the checker's migrate mode is green on the migrated ones.
- Hand-migrated and adopt-migrated copies give the same health codes.
- Re-runs write nothing; interrupted runs resume to the same end state; every listed 3.1 command works.
</verification>

<success_criteria>
- SC-4's three-fixture run, SC-2's idempotency/resume and SC-1's "health clean, every 3.1 tool works" are proved in
  the suite.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-06-SUMMARY.md` (`planning draft` +
`summary post`) with the checker's migrate check ids and the row results.
</output>
