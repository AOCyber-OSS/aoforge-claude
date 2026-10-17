---
objective: quick-43
trd: 01
type: standard
wave: 1
depends_on: []
gap_closure: true
files_modified:
  - plugins/aoforge/aoforge/bin/lib/adopt.cjs
  - plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs
  - plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs
  - plugins/aoforge/aoforge/bin/lib/adopt-preflight.test.cjs
  - plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs
  - plugins/aoforge/aoforge/workflows/adopt.md
  - plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.cjs
  - plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.test.cjs
  - plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
  - docs/AOF-TOOLS-REFERENCE.md
  - docs/USER-GUIDE.md
  - CHANGELOG.md
  - .aoforge/STATE.md
autonomous: true
must_haves:
  truths:
    - "D1 fixed: after adopt's own commit on a repository whose planning tree git ignores, `adopt preflight` and `adopt begin` route to `upgrade` (exit 0) and write nothing. This holds on aoforge/adopt, after the branch is merged into the base branch (ff or --no-ff) and deleted, and after the user recorded the change by hand on aoforge/adopt once the report step ran"
    - "Still `resume` when it should be: report written but nothing committed (steps all true, next 'ready to commit'); a commit on aoforge/adopt made before the report step. A commit on another branch while the adopt is in progress still refuses `adopt-in-progress-elsewhere`. Tracked-tree routing is unchanged (report in HEAD)"
    - "D2 fixed: migration 0005 ends the `# Development Rules` section at the next heading of any level, so one `upgrade --apply` converges for a block whose other sections are `##` headings, and no apply deletes a section that follows the rules"
    - "adopt-migrate-e2e.legacy.test.cjs rows 13 and 14 are ordinary passing tests (no `todo`)"
    - "`adopt begin` returns a `next` that names the following step (`aof-tools --cwd <target> adopt scaffold` on the migrate route), never `adopt begin`"
    - "The migrate checker's `stamp_current` ok detail counts configs with the new key and configs with neither key; it never says a config with neither key has the new key"
    - "docs/AOF-TOOLS-REFERENCE.md names `/aoforge:adopt` first wherever it says how to convert a project's pre-rename layout. USER-GUIDE, CHANGELOG and workflows/adopt.md no longer describe D1 or D2 as current behaviour. The interrupted-adopt gap stays documented"
    - "STATE.md, through state verbs only: objective 80 verified 5/5; 79 in progress (79-01..79-08 done; 79-09/79-10 await approval after re-validation); quick 40-43 done"
    - "Full suite (watcher-shell excluded, scratch HOME) has 0 failures and 0 todo. rename-guard, doc-refs, adopt-skill-contract and context-budget pass. Nothing is pushed, tagged or released, and no port 8080"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/adopt.cjs
      provides: "migrateFinished() (report in HEAD, or ignored report + adopt commit in HEAD's history / adopt branch tip reachable), MIGRATE_COMMIT_SUBJECT, begin's next per route"
    - path: plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.cjs
      provides: "locateRules bounded by the next heading of any level"
    - path: plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
      provides: "stamp_current detail with per-state counts"
  key_links:
    - from: "adopt.cjs preflight()"
      to: "migrateFinished(target, env, marker, gf)"
      via: "`finished` fact passed to decideRoute (decideRoute stays pure and unchanged)"
    - from: "adopt.cjs reportMigrate commit_message"
      to: "MIGRATE_COMMIT_SUBJECT"
      via: "the same constant is the --grep needle in migrateFinished, so the message and the signal cannot drift"
---

## Objective

Close what objective 80 left open (`.aoforge/objectives/80-adopt-migrates-legacy-projects/80-VERIFICATION.md`,
"Known limitations weighed" and "Gaps"; 80-06 SUMMARY "Defects found"; 80-07 SUMMARY findings F2/F3; 80-09
SUMMARY key-decision 3), and bring STATE.md up to date.

1. **D1 (bug, reproduced at BASE).** A migrate adopt counts as finished only when its report is in `HEAD`
   (`adopt.cjs` preflight, about line 445). If git ignores the planning tree, the report is written into an
   ignored directory and never reaches `HEAD`. After the commit, `adopt preflight` and `adopt begin` keep
   returning `resume: all steps done, ready to commit`. Planner repro on a `legacyFleetRepo({ untrackedTree: true })`
   copy: commit `.gitignore` + `CLAUDE.md` with subject
   `chore(aoforge): adopt — move the pre-rename planning layout (AOForge v3.1.0)`, then preflight returned `resume`.
   `git check-ignore -q <report_path>` exited 0, and `git log -F --grep=<subject> <base_sha>..HEAD` found the
   commit.
2. **D2 (bug, root cause found).** Migration 0005's `locateRules` ends the `# Development Rules` section at the
   next `# ` (H1) line only. For a block with no rules section whose other sections are `##` headings (the fleet
   fixture's `## Codebase map`), the first apply inserts the rules first. The next detect reads the rules section
   as running to the end of the block (it swallows `## Codebase map`) and reports drift. **The second apply then
   DELETES `## Codebase map` and its bullets.** This is data loss, not merely a second pass. The planner
   prototyped `/^#{1,6}[ \t]/m` in the scratchpad: detect is false after one apply, a second apply is
   byte-identical, and the `##` section is kept. Every template revision in git history (8 of them) has no
   sub-heading inside the rules section, and `# Code Style` follows it. So the template's parsed `rules` does not
   change. smartWellness (80-07) converged because its block uses H1 sections.
3. **docs/AOF-TOOLS-REFERENCE.md** still points at AOForge 3.0.x for converting a pre-rename project and never
   names `/aoforge:adopt`. The migration guide makes adopt Option A, 3.0.x Option B and the manual steps Option C.
4. **Nits.** F2: the checker's `stamp_current` ok detail is a fixed template that claims the new key even when a
   config has neither key. F3: `adopt begin` returns `next: "aof-tools --cwd <target> adopt begin"`, which points
   at itself. Reproduced at BASE on the migrate route. The fresh route does the same, because `begin` spreads
   `...pf` and keeps preflight's `next`.
5. **STATE.md** still says "Objective 80 executed — 9/9 TRDs complete, ready for verification" and
   `Progress 100%`.

**Interrupted-adopt gap (not fixed, decided).** A stop between `convertResidue` and the marker write leaves the
conversions done but missing from the Migration table. The only small fix is to pre-write the planned record
before converting. A stop between that write and the conversion would then list changes that never happened,
which is worse than a short table. The git diff stays the full record. Keep it documented (USER-GUIDE third bullet,
CHANGELOG 3.1.0) and name it as a follow-up in the SUMMARY.

## Locked decisions

1. **The `finished` rule for a migrate marker** (computed in `preflight`, passed as the `finished` fact;
   `decideRoute` is unchanged):
   `finished = reportInHead || (reportIgnored && marker.steps.reported === true && (adoptCommitInHistory || adoptBranchCarriesIt))`.
   - `reportInHead`: today's check (`inHead(target, env, marker.report_path)`, not unborn). Tracked trees are
     unchanged.
   - `reportIgnored`: `isGitIgnored(target, env, marker.report_path)`, the helper adopt.cjs already has at about
     line 1583. Only an ignored report needs another signal. A tracked report that is missing from HEAD keeps
     today's `resume`.
   - `marker.steps.reported`: the marker field reportMigrate writes. Use it, not the file on disk: a user may
     delete the ignored report after committing.
   - `adoptCommitInHistory`: `git log -1 --format=%H -F --grep=<MIGRATE_COMMIT_SUBJECT> <base_sha>..HEAD` prints
     a sha. It survives a merge into the base branch, ff or `--no-ff`, and deleting the branch.
   - `adoptBranchCarriesIt`: `refs/heads/<marker.branch>` resolves to a tip with `tip !== base_sha`,
     `merge-base --is-ancestor <base_sha> <tip>` and `merge-base --is-ancestor <tip> HEAD`. This covers a change
     the user recorded by hand with another message.
   - A missing `base_sha`, an unborn HEAD or a failed git call means not finished.
2. **`MIGRATE_COMMIT_SUBJECT`** = `` `chore(${NAMES.slug}): adopt — move the pre-rename planning layout` ``, a
   module constant. reportMigrate's `commit_message` becomes `` `${MIGRATE_COMMIT_SUBJECT} (${NAMES.product} v${pluginVersion})` ``.
   It must stay byte-identical: adopt-migrate-report.legacy row 2 pins it.
3. **Begin's `next`.** On the migrate route (fresh begin) it is `'aof-tools --cwd <target> adopt scaffold'`. On a
   fresh adopt it is `'map the codebase and write PROJECT.md, then aof-tools --cwd <target> adopt scaffold'`.
   `resumeMove` keeps `nextForResume(...)`. A begin that returned a preflight route (upgrade, new-project, refuse,
   or a resume with the move done) keeps preflight's `next`.
4. **0005:** rename `NEXT_H1_RE` to `NEXT_HEADING_RE = /^#{1,6}[ \t]/m`, used by `locateRules` only. Nothing
   else in 0005 changes, apart from the header comment ("from its heading to the next heading of any level").
5. **Checker detail** (ok case only; failure text unchanged):
   `` `${seen} config.json file(s): ${withNew} with the "${NAMES.configKey}" key, ${unstamped} with neither key (unstamped), none with the "${LEGACY.configKey}" key` ``.
   `withNew` counts configs that hold the new key and not the old one. `unstamped` counts configs that hold
   neither.
6. **Interrupted-adopt gap stays documented** (see Objective). The executor writes no code for it.
7. **STATE.md changes go through `state update` / `state record-session` / `state update-progress` only.** The
   line `**Objective complete:** 80 — …` stays as it is. No verb can target it (`state update` rewrites the
   first `**Objective complete:**` field, which is objective 0's), and it is already true.
8. **Quick-row 43 is not the executor's.** The quick workflow's Step 7 appends it. Rows 40-42 are already in the
   table. Do not add a row.

## Test list

Write each test before its code (RED first, then GREEN). Hand-built fixtures only:
`legacyFleetRepo(...)` from `__fixtures__/legacy-adopt-fixtures.cjs` and `makeFixture` from `adopt-fixtures.cjs`.
No generated data, no property-based tests, no `.feature` files.

**Task 1: adopt routing (D1) and begin's next (F3)**, outermost first:

- E13 (`adopt-migrate-e2e.legacy.test.cjs` row 13, spawned workflow sequence): remove the `todo` option.
  `fleet(t, { untrackedTree: true })`, then `runSeq(repo)`, then `adopt preflight` exits 0 with route `upgrade`.
  Add: `adopt begin` exits 0 with route `upgrade` and `created_branch: false`. `repo.snapshot()` and `HEAD` are
  the same before and after both calls. RED at BASE: route `resume`.
- In `adopt-migrate-report.legacy.test.cjs`, add rows 19-24 to the header list and the file. Each uses
  `fleet(t, { untrackedTree: true })` and the in-process `pipeline(repo)`. A commit through the report's own
  message is the file's `committed(repo, report)` / `commitChange` helper. Route checks spawn `repo.run(['adopt', 'preflight'])`.
  - 19 (outermost happy). After `committed(...)`: preflight route `upgrade`, `adopt.mode` `adopt`; begin route
    `upgrade`; snapshot and HEAD unchanged. RED: `resume`.
  - 20 (merged, branch deleted). For each of `['--ff-only']` and `['--no-ff', '-m', 'merge adopt']`, on a fresh
    fixture: commit, `git switch main`, `git merge <flags> aoforge/adopt`, `git branch -D aoforge/adopt`. Preflight
    route is `upgrade`. RED: the marker stays active on a deleted branch and preflight refuses
    `adopt-in-progress-elsewhere`. Only `adoptCommitInHistory` can fire here.
  - 21 (recorded by hand). After `pipeline`: `git add -- <report.commit_files>`, then
    `git commit -q -m "record the move myself"`. Preflight route is `upgrade`; only `adoptBranchCarriesIt` can
    fire. RED: `resume`.
  - 22 (edge: not yet committed). After `pipeline`, with no commit: preflight route `resume`, steps
    `{ moved: true, scaffolded: true, reported: true }`, `next` matches `/ready to commit/`. Green at BASE: it pins
    that the fix does not end an unfinished adopt.
  - 23 (failure: a commit elsewhere is not the adopt's). After `pipeline`: `git switch main`, write `OTHER.md`,
    `git add OTHER.md`, `git commit -q -m "unrelated"`. Preflight exits 3 with reason
    `adopt-in-progress-elsewhere`; snapshot unchanged. Green at BASE: it pins that neither signal fires on "HEAD
    moved".
  - 24 (failure: a commit before the report step). `pipeline(repo, 'scaffold')`, then commit an unrelated
    `OTHER.md` on aoforge/adopt. Preflight route `resume`, steps
    `{ moved: true, scaffolded: true, reported: false }`. Green at BASE: `steps.reported` gates the branch
    signal.
- In `adopt-migrate.legacy.test.cjs`, add row 17 to the header and the file (F3, migrate). `begun(repo)` on
  `fleet(t, { nested: true })`: `report.next === 'aof-tools --cwd <target> adopt scaffold'`, and it does not
  match `/adopt begin/`. `repo.run(['adopt', 'begin', '--raw'])` on a second fresh fixture prints
  `migrate: aof-tools --cwd <target> adopt scaffold`. RED: `next` names `adopt begin`.
- `adopt-preflight.test.cjs` test 11 (F3, fresh): also assert `report.next` matches `/adopt scaffold/` and not
  `/adopt begin/`. Add the sentence to the header list item 11. RED: it names `adopt begin`.
- Update the 80-02 header sentence in `adopt-migrate.legacy.test.cjs` item 13 ("finished only when its ROADMAP
  (fresh) or report (migrate) is in HEAD") to add "or, for a report git ignores, when the adopt commit is in
  HEAD's history (quick 43)". Comment only.

**Task 2: 0005 convergence (D2) and the checker detail (F2):**

- E14 (`adopt-migrate-e2e.legacy.test.cjs` row 14): remove the `todo` option. As written, one committed
  `upgrade --apply` leaves `upgrade --check` `up_to_date: true`. Add: `CLAUDE.md` still contains the fixture's
  `## Codebase map` heading. RED: 0005 is still pending ("differs from the template (drift)").
- `0005-claude-md-block.test.cjs` gets two new tests; add them to the header list as items 16 and 17.
  - 16: a v=2 block in canonical form with no `# Development Rules`, whose sections are `## Codebase map` (with
    two bullets) and `## Release flow` (one line). `apply` inserts the rules first. `detect` is then
    `applies: false`. A second `apply` leaves the file byte-identical. Both `##` sections and their bullets are
    present after both applies. RED: detect reports drift, and the second apply removes both sections.
  - 17: a v=2 block with `# Project Overview`, then `# Development Rules` with one stale bullet followed by a
    user `## Local rules\n\n- keep me` subsection, then `# Code Style`. `apply` replaces the rules list with the
    template's and keeps `## Local rules\n\n- keep me` byte for byte. `detect` is false afterwards. RED: apply
    deletes `## Local rules`.
  - Existing tests 1-15 stay green unchanged. Test 2 pins `loadClaudeMdTemplate().rules`.
- In the checker rows of `adopt-migrate-e2e.legacy.test.cjs`, add a positive row P1 to the header ("Checker
  negatives" becomes "Checker rows") and the file. `migrated(t, { stamp: null })` gives a converted repository
  whose root config has neither key: `stamp_current` is ok and its detail matches
  `/0 with the "aoforge" key, 1 with neither key \(unstamped\)/`. `migrated(t)` (the nested default): detail matches
  `/2 with the "aoforge" key, 0 with neither key/`. Build `"aoforge"` from `NEW_KEY`. If the counts differ, read
  the actual counts at RED and pin those, and note it in the SUMMARY. RED: the detail is the fixed template.

## Behavioral parity checklist

These must hold before and after (existing tests that must stay green unedited, except where Task 1/2 says so):
adopt-migrate-report.legacy 1-18 (row 2 pins the exact commit message; row 5 has tracked-tree preflight →
`upgrade`; row 7 has resume before the commit), adopt-migrate.legacy 1-16, adopt-migrate-e2e rows 1-12 and
N1-N4, adopt-e2e, adopt-preflight 1-17, adopt-scaffold, adopt-report, adopt-skill-contract 1-19 (rows 15 and 16
pin `migrate path`, `nothing_to_commit` and `Continue to \`report\``), 0005 tests 1-15.

<embedded_context>
<codebase_examples>
`adopt.cjs` preflight, the block to replace (about lines 443-449):
```js
  // The marker counts until the adopt's own commit is in HEAD: a fresh adopt's ROADMAP, a migrate adopt's report.
  let finished = false;
  if (marker) {
    finished = markerMode(marker) === 'migrate'
      ? typeof marker.report_path === 'string' && !gf.unborn && inHead(target, env, marker.report_path)
      : gf.roadmap_tracked;
  }
```
Helpers already in adopt.cjs: `git(root, env, args)` returns `{ ok, out }`. `inHead(root, env, rel)`.
`const isGitIgnored = (root, env, rel) => git(root, env, ['check-ignore', '-q', '--', rel]).ok;` (about line 1583,
a `const` arrow defined after preflight; calling it from preflight at run time is fine). `markerMode(marker)`.

reportMigrate (about line 1774):
```js
    commit_message: `chore(${NAMES.slug}): adopt — move the pre-rename planning layout (${NAMES.product} v${pluginVersion})`,
```
begin (about line 599). `beginMigrate` returns `{ ...out, moved, created_branch: true }` and the fresh path returns
`{ ...pf, git, adopt, created_branch: true }`. Both carry preflight's `next` today. Set `next` on these two
returns only.

0005 (`migrations/0005-claude-md-block.cjs`):
```js
const RULES_HEADING_RE = /^# Development Rules[ \t]*\r?$/m;
const NEXT_H1_RE = /^# /m;
function locateRules(content) {
  const h = RULES_HEADING_RE.exec(content);
  if (!h) return null;
  const afterHeading = h.index + h[0].length;
  const n = NEXT_H1_RE.exec(content.slice(afterHeading));
  return { start: h.index, end: n ? afterHeading + n.index : content.length };
}
```
The fixture CLAUDE.md after adopt (from the planner's repro) is the D2 shape:
```
<!-- AOFORGE:START - Auto-generated by /aoforge:map-codebase. Edit between these markers will be overwritten. -->
## Codebase map

This project uses AOForge. Refresh the map with `/aoforge:map-codebase`; it writes `.aoforge/codebase/`.

- State lives in `.aoforge/STATE.md`; read it with `node ~/.claude/aoforge/bin/aof-tools.cjs state load`.
- Small fixes go through `/aoforge:quick`.
<!-- AOFORGE:END -->
```
0005 test helper (reuse its shape for tests 16 and 17): `versionedClaudeMd(startMarker, rulesSection)` builds
`${BEFORE}${start}\n\n${sections.join('\n\n')}\n${END}${AFTER}` with `V2_START = '<!-- AOFORGE:START v=2 src=claude-md -->'`.
Tests 16 and 17 need their own section lists. Write a local builder or literal strings in the same canonical form:
one blank line after START, none before END.

Checker (`__fixtures__/adopt-e2e-assert.cjs`, about lines 204-223): a loop over `plan.roots` reads each
`<dir>/.aoforge/config.json`, then calls
`add('stamp_current', stampProblems.length === 0, stampProblems.length === 0 ? \`${stampsSeen} config.json file(s): "${NAMES.configKey}" key, no "${LEGACY.configKey}" key\` : stampProblems.join('; '))`.
Count `withNew` and `unstamped` inside the same loop.

The workflow sentence to drop (`workflows/adopt.md`, commit step, about lines 241-243):
"That is the normal outcome of a re-run after the change was recorded: a planning tree that git ignores keeps
the report out of the change, so `adopt preflight` still routes such a project to `resume`." Replace it with:
"That happens when the change was already recorded another way; after adopt's own commit, `adopt preflight`
routes the project to `upgrade`." Keep the sentence before it, which carries `nothing_to_commit`.

e2e rows to un-todo (`adopt-migrate-e2e.legacy.test.cjs` about lines 648-670). The header comment lines 50-56
("Defects the matrix found, pinned as `todo` rows") become "Fixed in quick 43 (were `todo` rows)", with each row
stating the behaviour it now asserts.
</codebase_examples>

<anti_patterns>
- Do not change `decideRoute` or its rule order. The fix is the `finished` fact preflight computes.
- Do not use "HEAD moved past base_sha" alone as the signal. Row 23 must keep refusing.
- Do not end a migrate adopt on a commit made before the report step (`marker.steps.reported` gates both new
  signals).
- Do not touch the tracked-tree path. A tracked report missing from HEAD keeps routing to `resume`.
- Do not spell a pre-rename name (old directory, stamp key, block tag, product) in adopt.cjs, 0005,
  AOF-TOOLS-REFERENCE.md or the checker. Tests build them from `legacy-names.cjs` (`LEGACY.*`) as the files
  already do.
- Do not edit STATE.md with Edit/Write or sed. Use state verbs only, and add no quick row.
- Do not rewrite whole files. Use targeted Edits. AOF-TOOLS-REFERENCE lines are single very long lines, so match
  on the unique substrings given in Task 3.
- Do not stage the untracked `amp` file at the repo root. It is not ours.
</anti_patterns>

<error_recovery>
- E13 or row 19 still routes `resume` after the fix: print the marker (`steps.reported`, `base_sha`,
  `report_path`), `git check-ignore -v <report_path>` and `git log --format=%s <base_sha>..HEAD`. The likely
  cause is the subject constant differing from the message by a byte (the em dash). Compare
  `report.commit_message.startsWith(MIGRATE_COMMIT_SUBJECT)` in a scratch script.
- Row 23 routes `upgrade`: `adoptBranchCarriesIt` is too loose. Check the `is-ancestor` argument order
  (ancestor first) and that `tip !== base_sha`.
- An existing 0005 test fails after the regex change: its fixture has a sub-heading inside a rules section. Stop
  and report it in the SUMMARY. Do not loosen the regex back.
- `upgrade --check` after one apply in E14 lists a migration other than 0005: record it and pin it. If it is not
  0005, keep E14's assertion to "0005 is not pending" and name the other one as a follow-up.
- `state update` prints `updated: false`: report the field in the SUMMARY. Do not hand-edit STATE.md.
- A full-suite failure: re-run that file alone at BASE (`git stash` is not allowed; use
  `git worktree add <S>/q43/base <BASE>` and run it there with the same HOME). If it also fails at BASE it is
  pre-existing; record it. Remove the worktree afterwards with `git worktree remove`.
- `aof-tools commit` refuses because something outside `--files` is staged: do not unstage it. Stop and report.
</error_recovery>
</embedded_context>

<gotchas>
- **Scratch dirs:** `<S>` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
  Every test run uses `HOME=<S>/q43/home TMPDIR=<S>/q43/tmp` (create both once). Nothing may read or write the
  real `~/.claude`. Never touch a real fleet repository (aodex, smartWellness, ...).
- **One plain command per Bash call**, absolute paths. `<repo>` = `/Users/justin/dev/aoforge-claude`; the CLI is
  `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs` (the repo copy, not the installed mirror).
- **Commits** only through `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<msg>" --files <paths>`.
  Raw `git commit` is gated in your shell. (Raw git inside test fixtures, via spawnSync, is fine.)
- `adopt-migrate-e2e.legacy.test.cjs` takes about 45 s. Run it alone, not in a loop.
- `git log -F --grep` takes a fixed string. Pass it as one argv element through `git(root, env, [...])` (execFileSync,
  no shell), so the em dash and parentheses need no escaping.
- `git merge-base --is-ancestor A B` exits 0 when A is an ancestor of B and 1 when it is not. The helper's `.ok`
  is the answer. An error (bad sha) also reads as false, which is what we want.
- The fixtures' base branch is `main` (adopt-migrate-report row 9 uses `main..HEAD`).
- After `git switch main` on an ignored-tree fixture, the moved `.aoforge/` stays on disk (ignored), and the
  modified `.gitignore`/`CLAUDE.md` carry over when the adopt is uncommitted (row 23). That is expected.
- context-budget.repo pins skill/workflow footprints. The workflow edit only shrinks text.
- CHANGELOG convention since quick 40: quick entries go under `## [Unreleased]`, suffixed `(quick 43)`.
- Port 8080 is off limits. No push, tag, release or PR.
</gotchas>

<validation_gates>
- task gate: `npm test` (`aof-tools stack command test` → `npm test`; `gates.task: [test]`). No lint or build gate.
  On this machine run the full suite by the 80-09 method (Task 3), because `watcher-shell.test.cjs` hangs here.
- Task 1 scoped (from `<repo>`, scratch HOME/TMPDIR): `node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-preflight.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-skill-contract.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-e2e.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-scaffold.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-report.test.cjs`, then `node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs`
- Task 2 scoped: `node --test plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.test.cjs plugins/aoforge/aoforge/bin/lib/upgrade.test.cjs plugins/aoforge/aoforge/bin/lib/adopt-scaffold.test.cjs`, then `node --test plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs`
- Guards (Task 3): `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs plugins/aoforge/aoforge/bin/lib/context-budget.repo.test.cjs plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs plugins/aoforge/aoforge/bin/lib/planning-writes.repo.test.cjs plugins/aoforge/aoforge/bin/lib/dispatch-completeness.test.cjs`, plus `aof-tools changelog check 3.1.0` and `aof-tools validate docs --raw`.
  If `upgrade.test.cjs` or `dispatch-completeness.test.cjs` does not exist under that name, find the file with
  `rg -l` and use it.
</validation_gates>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: a migrate adopt on an ignored tree ends at its commit; begin names the next step</name>
  <files>plugins/aoforge/aoforge/bin/lib/adopt.cjs, plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs, plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs, plugins/aoforge/aoforge/bin/lib/adopt-preflight.test.cjs, plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs, plugins/aoforge/aoforge/workflows/adopt.md</files>
  <action>
Step 0 (once, before any edit): record `BASE=$(git rev-parse HEAD)` (expected 4b3c1527 or a descendant) and
`git status --short` (expect only `?? amp`). Create `<S>/q43/home` and `<S>/q43/tmp`. Run the Task 1 scoped set
and the e2e file at BASE and save the counts. The e2e file should show 18 pass and 2 todo.

RED: write the Task 1 tests from the Test list: E13 un-todo plus the begin assertions, report rows 19-24 with
header lines, adopt-migrate row 17 with its header line, the preflight test 11 assertion, and the 80-02 header
sentence. Run them. Expected failures: E13, 19, 20 (both variants), 21, adopt-migrate 17, preflight 11. Rows
22-24 pass. Commit `test(quick-43): adopt routing after an ignored tree's commit; begin names the next step (RED)`.

GREEN in adopt.cjs:
```
const MIGRATE_COMMIT_SUBJECT = `chore(${NAMES.slug}): adopt — move the pre-rename planning layout`;  // near ADOPT_BRANCH

/** A migrate adopt is finished once its change is recorded (Locked decision 1). */
function migrateFinished(target, env, marker, gf):
  if gf.unborn or typeof marker.report_path !== 'string' -> false
  if inHead(target, env, marker.report_path) -> true            # tracked tree: unchanged
  if !isGitIgnored(target, env, marker.report_path) -> false    # only an ignored report needs another signal
  if !(marker.steps && marker.steps.reported === true) -> false # never before the report step
  base = marker.base_sha; if typeof base !== 'string' || !base -> false
  log = git(target, env, ['log', '-1', '--format=%H', '-F', `--grep=${MIGRATE_COMMIT_SUBJECT}`, `${base}..HEAD`])
  if log.ok && log.out.trim() -> true                           # adopt's commit, merged or not
  tip = git(target, env, ['rev-parse', '-q', '--verify', `refs/heads/${marker.branch}`])
  if !tip.ok -> false
  t = tip.out.trim()
  return t !== base
    && git(target, env, ['merge-base', '--is-ancestor', base, t]).ok
    && git(target, env, ['merge-base', '--is-ancestor', t, 'HEAD']).ok
```
- In preflight replace the migrate branch of `finished` with `migrateFinished(target, env, marker, gf)`. Update
  the comment above it and the `finished` line in the decideRoute header comment, which currently reads "the
  adopt's own commit is in HEAD (a fresh adopt: its ROADMAP; a migrate adopt: its report)". Add: "or, for a
  report git ignores, the adopt commit in HEAD's history or the adopt branch's commit reachable from HEAD".
- reportMigrate: `commit_message: \`${MIGRATE_COMMIT_SUBJECT} (${NAMES.product} v${pluginVersion})\``.
- begin: add `const NEXT_AFTER_BEGIN = Object.freeze({ migrate: 'aof-tools --cwd <target> adopt scaffold', adopt: 'map the codebase and write PROJECT.md, then aof-tools --cwd <target> adopt scaffold' });`.
  Set `next: NEXT_AFTER_BEGIN.migrate` in beginMigrate's success return (not in its `branch-failed` refusal, and
  not in `moveFailure`). Set `next: NEXT_AFTER_BEGIN.adopt` in the fresh path's return.

Workflow: replace the D1 sentence in the commit step (see codebase_examples). The "On the migrate path, an
empty `commit_files`, or a result whose `reason` is `nothing_to_commit` ..." sentence stays.

Run the Task 1 scoped set, then the e2e file: all green, with E13 passing and row 14 still `todo` (Task 2 owns
it). Commit
`fix(quick-43): a migrate adopt on an ignored planning tree is finished at its commit; begin names adopt scaffold (GREEN)`.
The files are adopt.cjs and workflows/adopt.md.

# CRITICAL: decideRoute stays pure and unchanged. Only the `finished` value differs.
# GOTCHA: the subject constant must reproduce report row 2's exact message. Run row 2 first if in doubt.
  </action>
  <verify>Task 1 scoped set exit 0; `node --test .../adopt-migrate-e2e.legacy.test.cjs` exit 0 with 19 pass, 1 todo (row 14); `git log --oneline BASE..HEAD` shows the RED then GREEN commit.</verify>
  <done>On an ignored tree, preflight/begin after adopt's commit, after a merge and branch delete, and after a hand-recorded commit route `upgrade` and write nothing. Before the commit, a commit elsewhere, or a commit before the report step keeps resume/refuse. Begin's `next` names `adopt scaffold`. The workflow no longer says preflight routes to `resume` after the commit.</done>
  <recovery>If GREEN breaks a parity test, `git diff HEAD -- plugins/aoforge/aoforge/bin/lib/adopt.cjs` and narrow the change; never edit a parity test to fit.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: migration 0005 converges in one apply and keeps sections after the rules; checker stamp detail</name>
  <files>plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.cjs, plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.test.cjs, plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs, plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs</files>
  <action>
RED: write 0005 tests 16 and 17 (and their header items), un-todo E14 with its `## Codebase map` assertion, and
add checker row P1 with its header line (Test list, Task 2). Run the 0005 file and the e2e file. Expected
failures: 16, 17, E14, P1. Commit `test(quick-43): 0005 converges and keeps ## sections; stamp_current detail counts unstamped configs (RED)`.

GREEN:
- 0005: `const NEXT_HEADING_RE = /^#{1,6}[ \t]/m;` replaces `NEXT_H1_RE` in `locateRules`. Update the header
  comment's "replaces that one section by string slicing" sentence to say the section runs from its heading to
  the next heading of any level, so the sections after it are never touched. Commit
  `fix(quick-43): migration 0005 ends the rules section at the next heading of any level (GREEN)`.
- Checker: count `withNew` and `unstamped` in the stamp loop and emit the Locked decision 5 detail when ok.
  Commit `test(quick-43): migrate checker stamp_current detail names unstamped configs (GREEN)`. The checker is
  a test fixture, so the type is `test`.

Run the Task 2 scoped set and the e2e file: e2e 21 pass (with P1), 0 todo, 0 fail; 0005 has 17 tests, all
passing.

# PATTERN: one regex change. Do not touch replaceRulesSection, detect or apply.
  </action>
  <verify>`node --test .../migrations/0005-claude-md-block.test.cjs` exit 0 (17 tests); e2e file exit 0 with 0 todo; Task 2 scoped set exit 0.</verify>
  <done>One `upgrade --apply` (committed) leaves a migrated fleet fixture `up_to_date: true` with its `## Codebase map` intact. A user `##` subsection under the rules survives apply. The checker's ok detail tells stamped from unstamped configs.</done>
  <recovery>If an existing 0005 test fails, see error_recovery. Do not revert to H1-only bounding.</recovery>
</task>

<task type="auto">
  <name>Task 3: docs name adopt and drop the fixed limits; STATE via verbs; full validation</name>
  <files>docs/AOF-TOOLS-REFERENCE.md, docs/USER-GUIDE.md, CHANGELOG.md, .aoforge/STATE.md</files>
  <action>
<!-- TDD-EXCEPTION: documentation and state records; guarded by doc-refs, rename-guard, changelog check -->
**docs/AOF-TOOLS-REFERENCE.md.** Targeted Edits on these unique substrings, in the migration guide's order
(adopt, then 3.0.x, then by hand):
1. Validation bullet: "`--repair` included; convert with AOForge 3.0.x, or `git mv` the directory by hand" →
   "`--repair` included; run `/aoforge:adopt` there, which moves it to `.aoforge/` as one recorded change on
   `aoforge/adopt`, or convert with AOForge 3.0.x, or `git mv` the directory by hand".
2. Same bullet: "alone, rename it to `aoforge`; beside" → "alone, rename it to `aoforge` or run `/aoforge:adopt`; beside".
3. Same bullet: "rename the two markers by hand)" → "rename the two markers by hand or run `/aoforge:adopt`,
   which renames them; the global block is never adopt's)".
4. Upgrade bullet: "exits 1 naming AOForge 3.0.x and the migration guide" → "exits 1 naming `/aoforge:adopt`,
   AOForge 3.0.x and the migration guide". Then "report `legacy_layout` as their one failure." → "report
   `legacy_layout` as their one failure, whose message names `/aoforge:adopt` first.".
5. Adopt bullet, after "Idempotent — a half-finished adopt resumes.", insert: "A pre-rename project (an old
   planning directory, config stamp key or CLAUDE.md block markers) takes the `migrate` route: `begin` moves each
   planning tree with `git mv`, `scaffold` renames the stamp key, block markers and ignore lines after a backup,
   `report` writes the Migration table and the commit list, and the workflow records it as one commit on
   `aoforge/adopt` (objective 80)."
6. Doctor bullet: "(report-only since 3.1.0: the conversions belong to 3.0.x or the manual steps)" →
   "(report-only since 3.1.0: `/aoforge:adopt` converts a project's pre-rename layout, and the home-level
   conversions belong to 3.0.x or the manual steps)". Then "the layout message is a doctor note)" → "the layout
   message is a doctor note naming `/aoforge:adopt` first)".
7. Rename-leftovers bullet: "the conversion path every legacy message names)" → "the conversion path every
   legacy message names after `/aoforge:adopt`)". Then "to convert it on request (`gh rebrand` with
   `lib/legacy-rewrite.cjs`)" → "to convert it on request (`/aoforge:adopt` with `lib/legacy-migrate.cjs`,
   `gh rebrand` with `lib/legacy-rewrite.cjs`)". Then "gets one message (`legacyLayoutMessage`):" → "gets one
   message (`legacyLayoutMessage`, which names `/aoforge:adopt` first):".

**docs/USER-GUIDE.md**, "Known limits of the migrate path" (about line 385): delete the first bullet (the
ignored-tree `resume` one) and the second (0005 may need a second apply); keep the third. Change the label to
"**Known limit of the migrate path.**". In "Routing by repo state", extend the first bullet: "... never
re-scaffolded. A finished adopt routes here too, including one whose planning tree git ignores."

**CHANGELOG.md**:
- `## [Unreleased]` → `### Fixed`: add three bullets, each ending `(quick 43)`.
  (a) `adopt preflight` and `adopt begin` routed a migrated project whose planning tree git ignores to `resume`
  after the adopt commit, because the report never reaches `HEAD`. A migrate adopt with an ignored report now
  counts as finished once the report step ran and `HEAD`'s history holds the adopt commit, or the
  `aoforge/adopt` branch's commit is reachable from `HEAD`. Such a project routes to `upgrade`, also after the
  merge.
  (b) Migration 0005 ended the `# Development Rules` section only at the next `# ` heading. In a block whose
  other sections are `##` headings, the inserted rules ran to the end of the block: `upgrade --check` reported
  drift after the first apply, and a second `upgrade --apply` deleted those sections. The section now ends at
  the next heading of any level, so one apply converges and nothing after the rules is removed.
  (c) `adopt begin` returned a `next` naming `adopt begin` itself. It now names `adopt scaffold`.
- `## [3.1.0]`, objective 80 "**Known limits**" bullet (about lines 127-131): replace it with
  "- **Known limit** (described in the user guide). A stop between the conversion of the stamp keys, block
  markers and ignore lines and the write of the adopt marker leaves those files converted but unlisted in the
  Migration table." Wrap at 120 columns like its neighbours.

Commit `docs(quick-43): reference names /aoforge:adopt; guide and changelog drop the fixed adopt limits`.

**STATE.md** (Locked decisions 7 and 8). One command per Bash call, from `<repo>`:
- `node plugins/aoforge/aoforge/bin/aof-tools.cjs state update "Current focus" "Objective 79: Reconcile and release 3.1.0 (79-01..79-08 done; 79-09 and 79-10, the live release steps, await per-action approval after re-validation)"`
- `node plugins/aoforge/aoforge/bin/aof-tools.cjs state update Status "Objective 80 verified 2026-10-17 (5/5, 80-VERIFICATION.md passed; its open limits closed in quick 43). Objective 79 in progress: 79-01..79-08 done, 79-09/79-10 await approval after re-validation. Quick 40-43 done"`
- `node plugins/aoforge/aoforge/bin/aof-tools.cjs state update Milestone "v1.6 Hardening & Release — started 2026-10-08; Objectives 65-79, 41 requirements mapped; Objectives 65-73, 75, 77 and 78 complete; 74 in progress (OPS-03 deferred by the user); 76 open on 76-06/76-08 as \`main\` recorded it; 79 in progress (reconcile and release 3.1.0: 79-01..79-08 done; 79-09 and 79-10 await approval after re-validation); 80 (adopt migrates legacy projects) complete and verified 5/5 2026-10-17. AOForge 3.0.0 released: tag \`v3.0.0\` on \`main\` b4a9d870, 2026-10-09. v1.5 complete 2026-10-08 (archived to .aoforge/milestones/v1.5-*; EST-08 not met, accepted)."`
  (Read the current value first with `state get "Current Position"` or `rg -n '^\*\*Milestone:' .aoforge/STATE.md`.
  If it differs from the text this JOB quotes in the Objective, keep the user's other clauses and change only
  the 79/80 parts.)
- `node plugins/aoforge/aoforge/bin/aof-tools.cjs state update-progress`
- `node plugins/aoforge/aoforge/bin/aof-tools.cjs state record-session --stopped-at "Quick 43: adopt finishes on an ignored tree's commit; 0005 converges in one apply; reference names adopt"`
Each must print `updated: true` (or the verb's success). Check with `git diff -- .aoforge/STATE.md`: only those
lines change. Commit `docs(quick-43): STATE records objective 80 verified and 79's release position` with
`--files .aoforge/STATE.md`.

**Full validation** (80-09 method, from `<repo>`):
1. `git ls-files -co --exclude-standard -- 'plugins/aoforge/**/*.test.cjs' 'plugins/aoforge-stack-*/**/*.test.cjs' 'plugins/aoforge/**/*.test.js' 'scripts/**/*.test.cjs'`.
   Save the output to `<S>/q43/files-all.txt` with the Write tool from the command output, or by shell
   redirection into the scratchpad.
2. Drop `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` and save the rest as `<S>/q43/files.txt`.
3. `env HOME=<S>/q43/home TMPDIR=<S>/q43/tmp xargs node --test < <S>/q43/files.txt` (one command).
   Expected: 0 fail, 0 cancelled, 0 todo. The test count is the 80-09 run's 12,748 plus the tests added here
   (about 13), give or take quick 40-42's additions. State the BASE figure you measured (run the same command at
   BASE in Step 0 if time allows, else quote 80-09's).
4. Guards from validation_gates, plus `aof-tools changelog check 3.1.0` (exit 0) and `aof-tools validate docs --raw`
   ("no documentation advisories").
5. `git diff BASE -- . ':!amp' | rg -n '8080'` prints nothing.
  </action>
  <verify>Guards exit 0; full suite 0 fail / 0 todo; `git diff BASE --stat` touches only files_modified; `git log --oneline BASE..HEAD` lists the RED/GREEN/docs/STATE commits in order; `rg -n '3\.0\.x' docs/AOF-TOOLS-REFERENCE.md` shows every project-conversion mention preceded by `/aoforge:adopt`.</verify>
  <done>The reference doc agrees with the migration guide (adopt first). USER-GUIDE and CHANGELOG list only the interrupted-adopt limit. STATE.md shows 80 verified and 79's real position, written by verbs. The full suite is clean.</done>
  <recovery>doc-refs or rename-guard red after a doc edit: the edit spelled a stale command or a legacy name. Reword with "pre-rename" and NAMES-era terms, and never add an ALLOW entry.</recovery>
</task>

</tasks>

<verification>
- Full suite (watcher-shell excluded, scratch HOME/TMPDIR): 0 fail, 0 cancelled, 0 todo.
- D1: report rows 19-21 and E13 green (routes `upgrade`); rows 22-24 green (resume/refuse kept).
- D2: 0005 tests 16-17 and E14 green; upgrade.test and adopt-scaffold unchanged-green.
- F2/F3: P1, adopt-migrate 17 and adopt-preflight 11 green.
- `git log --oneline BASE..HEAD`, in order: T1 RED, T1 GREEN, T2 RED, T2 0005 GREEN, T2 checker, T3 docs,
  T3 STATE. All made through `aof-tools commit`.
- No push, tag, release or PR; no 8080; the `amp` file untouched and unstaged.
</verification>

<success_criteria>
- Objective 80's verifier advisories are closed: D1 fixed, D2 fixed (with the data-loss path removed),
  AOF-TOOLS-REFERENCE names `/aoforge:adopt`. The two `todo` rows are real assertions.
- The adopt workflow text matches the routing the code now does.
- STATE.md tells the next session where 79 and 80 stand.
</success_criteria>

<output>
Write the SUMMARY into the draft that
`node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs planning draft quick/43-adopt-routes-past-a-migrated-gitignored-/43-SUMMARY.md`
prints
(`/var/folders/j2/r369kq256wd5qg5yn51x376m0000gn/T/aoforge-drafts/aoforge-claude-df646fc2/quick/43-adopt-routes-past-a-migrated-gitignored-/43-SUMMARY.md`).
Publish it with `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs --cwd <repo> quick summary 43 --from <that draft> --raw`.
Do not commit the SUMMARY; the orchestrator does, and it adds the quick row. Include:
- BASE, the scoped and full-suite counts at BASE and at the end, and the RED failure text for each task;
- every commit hash;
- a table mapping each planning-context item (1-5, plus the interrupted-adopt gap) to its evidence (test row,
  commit) or to the decision not to fix;
- D2's root cause in one paragraph (the second apply deleted `##` sections), so the verifier can judge severity;
- follow-ups: the interrupted-adopt record gap (pre-write vs diff-derived record); the squash-merge-with-new-title
  plus deleted-branch case for an ignored tree, which still reads as unfinished (neither signal can see it).
</output>
