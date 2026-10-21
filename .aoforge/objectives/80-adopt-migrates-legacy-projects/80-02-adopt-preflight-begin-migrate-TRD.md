---
objective: 80-adopt-migrates-legacy-projects
trd: "02"
type: standard
wave: 2
depends_on: ["80-01"]
files_modified:
  - plugins/aoforge/aoforge/bin/lib/adopt.cjs
  - plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs
  - plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.cjs
  - plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs
  - plugins/aoforge/aoforge/bin/lib/help.cjs
autonomous: true
requirements: [SC-1, SC-2]
must_haves:
  truths:
    - "`aof-tools --cwd <legacy repo> adopt preflight` runs (no legacy-layout refusal from the CLI guard) and returns route `migrate` with the planned moves, stamps, blocks and ignore changes; it writes nothing"
    - "A dirty tree, an operation in progress, a detached HEAD, both planning directories at one planning root, or a malformed pre-rename block each return route `refuse` (exit 3) with one message and a `next` naming the fix; the tree is byte-identical afterwards and nothing moved"
    - "`adopt begin` on route `migrate` creates `aoforge/adopt`, writes the marker (`mode: migrate`, the planned moves, `report_path`) and then moves every tree with `git mv`; it never creates `.aoforge/` before the move"
    - "Re-running preflight/begin mid-migration resumes: after an interrupted begin, begin finishes the move; staged renames under either planning directory, .gitignore and CLAUDE.md are the adopt's own and never read as a dirty tree"
    - "Fresh and brownfield adopt routing is unchanged: every existing adopt-preflight/scaffold/report/e2e test passes; an adopt is finished only when its ROADMAP (fresh) or report (migrate) is in HEAD"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/adopt.cjs
      provides: "the migrate route in preflight/decideRoute, migrate begin and resume steps"
      exports: [decideRoute, preflight, begin, resumeSteps]
    - path: plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs
      provides: "routing, refusal, begin and resume tests for the migrate route"
    - path: plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.cjs
      provides: "adopt exempt, with its reason"
  key_links:
    - from: plugins/aoforge/aoforge/bin/lib/adopt.cjs preflight
      to: legacy-migrate.planMigration / refusalFor
      via: "facts.legacy, decided after the dirty-tree rule and before the aoforge/greenfield rules"
      pattern: "planMigration"
    - from: plugins/aoforge/aoforge/bin/lib/adopt.cjs begin
      to: legacy-migrate.moveTrees
      via: "after branch + marker"
      pattern: "moveTrees"
    - from: plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.cjs EXEMPT_COMMANDS
      to: adopt
      via: "reason string"
      pattern: "adopt:"
---

# TRD 80-02: Adopt routes a legacy project to `migrate`, refuses what it cannot move, and begin moves it

<objective>
Teach adopt's deterministic front door about pre-rename projects: preflight routes a legacy repository to a new
`migrate` route (or refuses with one message naming the fix), `begin` creates the adopt branch and marker and moves
the planning trees with `git mv`, and a half-finished migration resumes. The CLI legacy-layout guard lets `adopt`
through, since adopt is now the 3.1 path for exactly that layout.

Purpose: SC-1 (the move, recorded on `aoforge/adopt`) and SC-2 (refusals change nothing; re-runs resume). TRD 80-03
adds the residue conversion (`scaffold`) and the report; TRD 80-05 the workflow text.
Output: adopt.cjs migrate route + begin + resume, guard exemption, help text, tests.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/ROADMAP.md (Objective 80 section only)
@.aoforge/objectives/80-adopt-migrates-legacy-projects/80-01-SUMMARY.md (planMigration plan shape, exports)
@plugins/aoforge/aoforge/bin/lib/adopt.cjs (lines 1-450: gitFacts, marker, resumeSteps, decideRoute, preflight, begin)
@plugins/aoforge/aoforge/bin/lib/adopt-preflight.test.cjs (test list header: the 19 rows that must stay green)
@plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.cjs
@plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs (lines 1-60, 235-280)
@plugins/aoforge/aoforge/bin/lib/help.cjs (the `adopt` entry, around line 173)

Objective-wide rules (every task):
- Repo CLI `node plugins/aoforge/aoforge/bin/aof-tools.cjs ...`; commit only through
  `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<type>(80-02): <desc>" --files <paths>`; RED before GREEN;
  one plain command per Bash call.
- Tests: mkdtemp repos + fake HOME, never the real `~/.claude`; run them as
  `TMPDIR=<S>/80-02/tmp HOME=<S>/80-02/home node --test <files>` with
  `<S>=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
- Never write a real fleet repository; never port 8080; never push, tag or release.
- Rename guard: adopt.cjs, legacy-layout-guard.cjs and help.cjs gain no legacy spelling: call legacy-migrate's
  functions and use its messages. Test files named `*.legacy.test.cjs` may spell them.
- Concurrency: quick 42 may still be committing here; stage only this TRD's files.
</context>

<embedded_context>

<codebase_examples>
**The current rule order in `decideRoute` (adopt.cjs:212-341) — insert the legacy rules between 7 and 8:**

```
1 not a directory → 2 not a git repo → 3 not the repo root → 4 operation in progress → 5 detached HEAD
6 an in-progress marker → resume | adopt-in-progress-elsewhere | dirty-tree (owned paths exempt)
7 dirty tree (no marker) → refuse dirty-tree
  7a legacy conflicts (both dirs)   → refuse both-planning-dirs          ← NEW
  7b malformed pre-rename block     → refuse legacy-block-malformed      ← NEW
  7c legacy plan applies            → no-commits / adopt-branch-exists / migrate   ← NEW
8 .aoforge/ present → upgrade   9 greenfield → new-project   10 unborn → no-commits
11 stale aoforge/adopt branch → adopt-branch-exists   12 adopt
```

**Finished-adopt detection today (index, not HEAD):**

```js
const roadmapRes = git(root, env, ['ls-files', '--error-unmatch', planningRel(root, 'ROADMAP.md')]);
const roadmap_tracked = roadmapRes.ok;
...
const activeMarker = (marker && !roadmapTracked) ? marker : null;
```
After `git mv`, the moved ROADMAP is in the INDEX immediately, so this would end a migrate adopt before its commit
and then refuse the staged renames as a dirty tree. Switch to HEAD: `git rev-parse -q --verify HEAD:<rel>`.

**begin today (adopt.cjs:415-450): creates the branch, then `fs.mkdirSync(planningRoot(target))`, then the marker.**
For migrate the mkdir must NOT run (git mv would nest the tree inside it).

**The existing dirty filter for a resumed adopt:**

```js
const offending = g.dirty.filter((p) => !isOwnedPath(p));
```
For a migrate marker use `legacyMigrate.ownsMigratePath` instead (both planning dir names at any depth, .gitignore,
CLAUDE.md).
</codebase_examples>

<anti_patterns>
- Spelling the legacy directory, stamp key or block tag in adopt.cjs: take messages and predicates from legacy-migrate.
- Moving anything in preflight, or in begin on any route other than `migrate` / resume-of-migrate.
- Exempting `adopt` from the guard without a reason string (legacy-layout-guard.legacy.test pins a non-empty reason).
- Changing the fresh-adopt marker shape (no `mode` field means `adopt`); existing markers must keep resuming.
- Generated fixtures; the fixtures come from 80-01's `legacyFleetRepo` and adopt-fixtures.cjs.
</anti_patterns>

<error_recovery>
- `moveTrees` throws inside begin (git mv failed): begin returns `route: 'refuse'`, `reason: 'move-failed'`, the git
  error as `message`, `next: 're-run /aoforge:adopt to resume (the marker records the plan)'`, exit 3. The branch and
  marker stay so the re-run resumes; nothing is deleted.
- An existing adopt-preflight test fails after the HEAD change: compare the test's fixture: if it commits ROADMAP
  through `aof-tools commit`, HEAD holds it and the result is the same. Investigate before changing a test.
</error_recovery>

</embedded_context>

<gotchas>
- The CLI guard (aof-tools.cjs main → legacyLayoutGuard) refuses `adopt` in a legacy-only root today; until Task 3
  lands, spawned-CLI tests in a legacy repo fail with the legacy-layout message. Unit-test decideRoute/preflight
  in-process first, spawn the CLI in Task 3.
- `legacy-layout-guard.legacy.test.cjs` test 8 asserts `adopt` is refused and pins EXPECTED_EXEMPT; both change here.
- A nested-only repo (no root planning dir, aohealth shape) is brownfield by repo-state but its plan applies, so the
  legacy rules MUST run before the greenfield/aoforge rules, and the report lives in the first planning root
  (`report_path` = `<first root>/.aoforge/ADOPT-REPORT.md`, root `''` first).
- `git status --porcelain -z` lists a rename as two entries (destination, then source); parsePorcelainZ already
  pushes both, so the owned-path filter sees the legacy source path too.
- A legacy repo's working tree must be clean for a fresh migrate (rule 7, untracked included): that is adopt's
  existing rule and SC-2's "dirty tree stops adopt"; keep the message and `next` as they are.
- The marker lives at `git rev-parse --git-path aoforge-adopt.json` (out of tree), never inside a planning dir.
</gotchas>

## Test list

`adopt-migrate.legacy.test.cjs`, outermost first. Fixtures: 80-01 `legacyFleetRepo`, adopt-fixtures `makeFixture`.

Spawned CLI (`aof-tools --cwd <repo> adopt <sub> --raw`, hermetic env):
1. 2.x fleet repo, clean: preflight exit 0, `route: 'migrate'`, `adopt.mode: 'migrate'`, `migration.moves` lists
   root, `api`, `web`; `next` names `adopt begin`; snapshot identical; no `.aoforge/` created.
2. Refusals, each exit 3 with nothing moved (snapshot identical, legacy trees still in place):
   `dirty` → `dirty-tree` naming `.planning/STATE.md`; `untracked` → `dirty-tree` naming `notes.txt`;
   `merge` → `operation-in-progress`; `rebase` → `operation-in-progress`; `detached` → `detached-head`;
   `both` → `both-planning-dirs` whose `next` is the fix; `nested-both` → `both-planning-dirs` naming `api/`;
   `claudeMd: 'malformed'` → `legacy-block-malformed` naming CLAUDE.md.
3. begin on the clean repo: exit 0, `created_branch: true`, current branch `aoforge/adopt`, HEAD sha unchanged,
   `moved` lists three `git mv` moves; `git status --porcelain` holds only renames; the marker has `mode: 'migrate'`,
   `status: 'in_progress'`, `base_branch`, `base_sha`, `plan.moves`, `report_path: '.aoforge/ADOPT-REPORT.md'`.
4. preflight after begin: `route: 'resume'`, `adopt.mode: 'migrate'`, `adopt.steps` =
   `{ moved: true, scaffolded: false, reported: false }`; the staged renames are not a dirty tree.
5. Interrupted begin: a marker written by begin's first half (simulate: run begin, then `git mv .aoforge .planning`
   back for the root tree only, keeping the marker) → preflight `resume` with `steps.moved: false`; begin again
   finishes the move (`moved` names the root move) and preflight then shows `moved: true`.
6. After begin, a user edit to `src/index.js` → preflight refuses `dirty-tree` naming only `src/index.js`.
7. After begin, `git switch -` → `adopt-in-progress-elsewhere`.
8. A stale `aoforge/adopt` branch with no marker on a legacy repo → `adopt-branch-exists`.
9. Nested-only repo (root has no planning dir): route `migrate`; begin's marker `report_path` is
   `api/.aoforge/ADOPT-REPORT.md`; no root `.aoforge/` is created.
10. Residue-only repo (`adopted-on-aoforge`: root `.aoforge/` with the old stamp key and a pre-rename block):
    route `migrate` (not `upgrade`), `migration.moves` empty, stamps and blocks listed; begin creates the branch and
    marker, moves nothing.
11. Fresh/brownfield/aoforge unchanged: go-service → `adopt`; empty → `new-project`; aoforge fixture → `upgrade`.

Pure `decideRoute(facts)` rows (in-process):
12. Precedence: busy beats legacy; dirty beats legacy conflicts; legacy conflicts beat malformed; legacy beats
    `aoforge` state and greenfield; unborn legacy → `no-commits`; branchExists legacy → `adopt-branch-exists`;
    resume (migrate marker, owned dirty only) beats dirty and legacy rules.
13. `facts.finished` (HEAD-tracked) true → marker ignored; existing callers that pass only `roadmapTracked` get the
    same result (back-compat alias).

Guard and help (Task 3):
14. `legacyLayoutGuard` returns null for `adopt` (every subcommand) in a legacy-only root; EXPECTED_EXEMPT gains
    `adopt`; the refused list no longer names it; every other refusal unchanged.
15. `aof-tools adopt --help` mentions the migrate route; help.test.cjs parity green.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests for the migrate route</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs, plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs</files>
  <action>
Write `adopt-migrate.legacy.test.cjs` with the Test list as named tests (header comment = the list). Spawned-CLI
tests (1-11) and the guard rows (14) fail today because the CLI guard refuses adopt in a legacy root and
decideRoute has no migrate route; in-process rows (12-13) fail on missing behaviour. In
legacy-layout-guard.legacy.test.cjs: add `adopt` to EXPECTED_EXEMPT and remove it from the "is refused" list in
test 8 (this is the RED for the guard). Commit `test(80-02): adopt migrate route, refusals, begin and resume (RED)`.
  </action>
  <verify>TMPDIR=<S>/80-02/tmp HOME=<S>/80-02/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs → the new rows fail for the expected reasons (legacy-layout refusal, no migrate route), not fixture errors</verify>
  <done>15 rows written and failing as expected; guard test RED; RED commit recorded.</done>
  <recovery>If a fixture variant from 80-01 is missing (e.g. `adopted-on-aoforge`), do not edit 80-01's fixture here: build that variant inline in the test from legacyFleetRepo plus a few writes, and note it in the SUMMARY.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: preflight, decideRoute, begin and resume for migrate (GREEN for 1-13)</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt.cjs</files>
  <action>
Approach:
1. `gitFacts`: replace `roadmap_tracked` (index) with a HEAD check `git rev-parse -q --verify HEAD:<rel>` for the
   ROADMAP; keep the field name. Add a helper `inHead(root, env, rel)`.
2. `preflight`: after gitFacts/repo-state/marker, compute `const plan = legacyMigrate.planMigration(target, {env})`
   (only for a top-level git work tree; else an empty plan). `finished` = marker
   ? (marker.mode === 'migrate' ? inHead(marker.report_path) : roadmap_tracked) : false. Pass
   `facts.legacy = { applies: plan.applies, refusal: legacyMigrate.refusalFor(plan) }` and `facts.finished`.
3. `decideRoute`: `const done = facts.finished ?? facts.roadmapTracked;` for the active-marker test. In rule 6 use
   `marker.mode === 'migrate' ? legacyMigrate.ownsMigratePath : isOwnedPath` for the dirty filter. After rule 7:
   `facts.legacy?.refusal` → refuse with its reason/message/next; `facts.legacy?.applies` → `g.unborn` → no-commits
   refusal; `branchExists` → adopt-branch-exists refusal; else
   `{ route: 'migrate', message: 'ready to migrate a pre-rename project', next: 'aof-tools --cwd <target> adopt begin' }`.
   Keep decideRoute pure and total.
4. preflight report: add `adopt.mode` ('migrate' when the route is migrate or the marker says so, else 'adopt') and
   `migration` (the plan's moves/stamps/blocks/ignores/exclude/skipped, post-move paths) whenever the route is
   `migrate` or a migrate resume. `resumeSteps(root, marker)`: for a migrate marker return
   `{ moved: legacyMigrate.movesDone(root, marker.plan.moves), scaffolded: !!marker.steps?.scaffolded,
   reported: fs.existsSync(join(root, marker.report_path)) }`; `nextForResume` orders by the mode's step list
   (`moved, scaffolded, reported` for migrate).
5. `begin`: route `migrate` → `git switch -c aoforge/adopt` (checkout -b fallback, as today), write the marker
   `{ version: 1, status: 'in_progress', mode: 'migrate', branch, base_branch, base_sha, started_at,
   plugin_version, steps: {}, plan: { moves }, report_path }` FIRST, then `legacyMigrate.moveTrees(target,
   plan.moves, {env})`; no mkdir. `report_path` = `<first root>/.aoforge/ADOPT-REPORT.md` using `plan.roots[0]`
   (posix join; `''` gives `.aoforge/ADOPT-REPORT.md`). Return `{ ...pf, created_branch: true, moved,
   adopt: {..., marker, mode: 'migrate'} }`. Route `resume` with a migrate marker and `!steps.moved` → run
   moveTrees with the marker's moves and return `{ ...pf, created_branch: false, moved }`. Any other route: unchanged.
   moveTrees throwing → the `move-failed` refusal (error_recovery).
6. Export what tests need (`decideRoute`, `resumeSteps` already exported).

# CRITICAL: no write in preflight; no mkdir of the planning dir on the migrate path.
# GOTCHA: fresh-adopt markers have no `mode`; treat absent as 'adopt' everywhere.
# PATTERN: keep the facts → decideRoute → report shape; legacy facts are just more facts.

Run adopt-migrate rows 1-13 in-process where possible (the CLI rows still need Task 3's guard change; run them
with the guard change stashed in your head, i.e. expect them green only after Task 3) and the whole existing adopt
suite: adopt-preflight, adopt-scaffold, adopt-report, adopt-e2e, file-identities.legacy, planning-layout.legacy.
Commit `feat(80-02): adopt routes a pre-rename project to migrate; begin moves it; resume by mode`.
  </action>
  <verify>TMPDIR=<S>/80-02/tmp HOME=<S>/80-02/home node --test plugins/aoforge/aoforge/bin/lib/adopt-preflight.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-scaffold.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-report.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-e2e.test.cjs plugins/aoforge/aoforge/bin/lib/file-identities.legacy.test.cjs → 0 failures; adopt-migrate rows 12-13 pass</verify>
  <done>decideRoute has the three legacy rules in the stated place; begin moves on migrate and resumes an interrupted move; existing adopt tests unchanged and green.</done>
  <recovery>If `git switch -c` succeeds but moveTrees fails half way, do not try to undo the branch: the marker plus moveTrees' leftover handling is the resume path (test 5).</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Guard exemption and help (GREEN for 1-11, 14-15)</name>
  <files>plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.cjs, plugins/aoforge/aoforge/bin/lib/help.cjs</files>
  <action>
1. legacy-layout-guard.cjs EXEMPT_COMMANDS: add
   `adopt: 'handles the layout itself: preflight routes a pre-rename project to migrate (or refuses with the fix) and begin moves it as adopt\'s one recorded change (objective 80)'`.
   Update the module header's "refused" sentence if it lists adopt.
2. help.cjs `adopt` details: add that preflight also routes a pre-rename project to `migrate` (begin moves the
   planning trees with git mv on aoforge/adopt; scaffold renames the config stamp key and CLAUDE.md block markers;
   report writes ADOPT-REPORT.md with the migration) and that both planning directories or a malformed pre-rename
   block refuse with exit 3. No legacy spelling: say "pre-rename planning directory", "pre-rename stamp key".
   Keep the usage line unchanged (no new subcommand or flag).
3. Run the whole adopt-migrate file, the guard test, help.test.cjs, dispatch-completeness.test.cjs,
   flag-spec.repo.test.cjs and rename-guard.repo.test.cjs.
Commit `feat(80-02): adopt runs in a pre-rename project (guard exemption); help names the migrate route`.
  </action>
  <verify>TMPDIR=<S>/80-02/tmp HOME=<S>/80-02/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/help.test.cjs plugins/aoforge/aoforge/bin/lib/dispatch-completeness.test.cjs plugins/aoforge/aoforge/bin/lib/flag-spec.repo.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs → 0 failures</verify>
  <done>All 15 rows pass; `adopt` is exempt with a reason; every other guarded command still refuses in a legacy-only root.</done>
  <recovery>If help.test pins the adopt details text, update only the assertion that compares that string, keeping parity checks intact.</recovery>
</task>

</tasks>

<validation_gates>
<test>TMPDIR=<S>/80-02/tmp HOME=<S>/80-02/home node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-preflight.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-layout-guard.legacy.test.cjs</test>
<lint>not_available</lint>
<build>not_available</build>
</validation_gates>

<verification>
- On a 2.x fleet-shaped repo: `preflight` → migrate (writes nothing), `begin` → branch + marker + `git mv` renames,
  `preflight` → resume with `moved: true`.
- Every refusal row leaves the snapshot identical.
- Existing adopt suites and the guard suite pass; the rename guard passes.
</verification>

<success_criteria>
- A pre-rename repository reaches adopt instead of the legacy-layout refusal, and adopt either moves it on
  `aoforge/adopt` or stops with one message naming the fix.
- Fresh and brownfield adoption routes are unchanged.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-02-SUMMARY.md` (`planning draft` +
`summary post`). Record the preflight/begin JSON shapes for the migrate route (route, adopt.mode, migration, moved,
marker fields) exactly: TRDs 80-03 and 80-05 rely on them.
</output>
