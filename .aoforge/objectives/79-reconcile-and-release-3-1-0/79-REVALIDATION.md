---
objective: 79-reconcile-and-release-3-1-0
kind: revalidation
repeats: 79-08
verdict: PASS
release_hold: "CHANGELOG [Unreleased] carries 9 entries (quick 40, 41, 42) that ship in v3.1.0 code; decide before 79-09"
validated_sha: 7da7485fdb2137ae60422da82b85b5b8ef47e608
supersedes_validated_sha: 9a4b09971d8d80a873d13b97c7fef8a06daf1c37
date: 2026-10-18
---

# Objective 79: re-validation of `integrate/3.1.0` before the release PR

**Every check of TRD 79-08 passes again at VALIDATED_SHA `9a4b09971d8d80a873d13b97c7fef8a06daf1c37`.** Since
79-08 validated `5d470e24`, 80 commits landed: the retroactive 76/77 verification and SUMMARYs, quick 40 (`df-`
leftovers), quick 41 (`calibrate --also-root`), quick 42 (objective-76 gaps), objective 80 (adopt migrates legacy
projects) and quick 43 (adopt / migration 0005 fixes). Nothing under `.github/` (release.yml included) or
`plugins/aoforge/hooks/hooks.json` changed, so no release-workflow check needed a re-run beyond the ones below.

**One release hold, not a check failure:** see "Release hold" at the end.

## Suite and CI gate

| Run | Result |
|---|---|
| Full suite, Node 24.13.1, npm test's four globs: 418 files, `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` excluded (W-3 fish hang on this machine; it runs in the node:26 run), 417 run. HOME and TMPDIR under the session scratchpad (not `/var/folders`) | tests 13,048 / suites 2,141 / pass 13,021 / **fail 0 / cancelled 0** / skipped 27 / 110.4 s |
| `node --test scripts/ci-unit-gate.test.cjs` (local, scratch HOME) | 88/88 pass |
| node:26 in Docker as the non-root `node` user (uid 1000), CI's two steps after `npm ci`: gate self-test, then `node scripts/ci-unit-gate.cjs` | node v26.11.1; `npm ci` 0; self-test exit 0; `patterns resolve to 418 test file(s)`; `known-failure entries: 1`; `tests: 13130 reported 13082 executed (floor 3000) failures: 0 skipped: 48`; `files: 418 selected; 418 attributed`; `runner exit: 0`, 153 s; **`[ci-unit-gate] PASS`** |

Against 79-08: +186 tests, +6 files. `.github/known-test-failures.json` is unchanged (one entry). The root-only
`verify-completion.test.js` "unwritable path" case 79-08 deferred now skips under root (since `5d470e24`).

## Guards (each in its own call, scratch HOME)

| Guard | tests | pass | fail |
|---|---|---|---|
| rename-guard.repo | 25 | 25 | 0 |
| stack-neutrality.repo | 7 | 7 | 0 |
| reconcile-guard.repo | 30 | 30 | 0 |
| context-budget.repo | 6 | 6 | 0 |
| hooks/pre-bash-equivalence | 60 | 60 | 0 |
| model-placeholders.repo (new, quick 42) | 8 | 8 | 0 |
| planning-writes.repo | 11 | 11 | 0 |
| hooks/planning-writes.audit | 65 | 65 | 0 |
| builtin-sweep.repo | 17 | 17 | 0 |
| flag-spec.repo | 14 | 14 | 0 |
| doc-refs.repo / doc-refs / doc-refs.legacy | 17 / 17 / 5 | all | 0 |
| adopt-skill-contract / adopt-e2e / adopt-migrate-e2e.legacy | 19 / 6 / 21 | all | 0 |

## Health, doctor, changelog

| Surface | Result |
|---|---|
| `upgrade --check --raw` | `up to date (v3.1.0)` |
| `validate health --raw` | `healthy`, no errors, no warnings; I001 x2 (79-09, 79-10 have no SUMMARY: not started) |
| `validate consistency --raw` | `passed` |
| `validate requirements --raw` | agrees with VERIFICATION (70 objectives, 52 requirements) |
| `validate docs --raw` | no documentation advisories |
| `validate roadmap-coverage --raw` | 41/41 v1 requirements mapped |
| `stack validate` | ok, no errors or warnings |
| `doctor --json --path <repo>` (read-only, scratch HOME) | `degraded`, 16 ok / 4 warn / 0 error / 1 fixable. runtime-mirror, hooks-registry, model-profiles: no installed plugin under the scratch HOME (artifact). legacy-runtime-state (fixable): four untracked leftover `.aoforge/` runtime files, the user's own `doctor --fix`. Same four as 79-08 |
| `changelog check 3.1.0` | `ok: true, present: true` |

## Release preconditions

| Check | Result |
|---|---|
| Installed changelog gate (`~/.claude/plugins/cache/aocyber/aoforge/3.0.0/hooks/changelog-on-tag.js`), `git tag -a v3.1.0` / `aoforge--v3.1.0` | both allowed (no output); control `v9.9.9` denied. The 3.0.0 hook does not gate `aoforge--v*` at all (its `aoforge--v9.9.9` control is allowed) |
| Repo hook (`plugins/aoforge/hooks/changelog-on-tag.js`), same tags | `v3.1.0` and `aoforge--v3.1.0` allowed; controls `v9.9.9` and `aoforge--v9.9.9` denied |
| `scripts/release-tag.cjs` offline (`planTag`, `runRelease` with a fake exec, no git/gh call) | `v3.1.0`: kind core, plugin aoforge 3.1.0, alias `aoforge--v3.1.0`, latest; notes from `## [3.1.0]` (44,849 chars) via `--notes-file`. `aoforge--v3.1.0`: core-alias, nothing to do |
| Versions | package.json, package-lock (`.version`, `packages[""]`), aoforge plugin.json, marketplace top level and its aoforge entry: 3.1.0. Packs: aoforge-stack-flutter and aoforge-stack-web 1.0.0 in both plugin.json and marketplace, each depending on `aoforge >=3.1.0` |
| `git ls-files .planning` | empty |
| Tracked conflict markers | none |
| `gen-docs-data` | only `generatedAt` differs (restored, not committed); skills 32, agents 12, hooks 24, workflows 39 |
| Fleet STACK.md drafter, `AOFORGE_FLEET_ROOT=/Users/justin/dev`, read-only | 50 tests: 26 pass / 0 fail / 24 skip. 9 repos ran and passed (ao-terminal, aofamily, aostudio, dfip, EdenDocs, github-enterprise-migration, qrCodeBuilder, quanta-local, torrentConsole); 24 skipped, each "still uses the pre-rename planning directory" (TRD 78-07), as in 79-08 |
| `git status --porcelain` | `?? amp` only |

## Release hold (a decision for the user, not a check failure)

`git diff 5d470e24..HEAD -- CHANGELOG.md` adds 49 lines under `## [Unreleased]` (lines 7-57: quick 42's
model-placeholders guard under Added; quick 40's `df-` prefix removal under Removed and Changed; quick 41's
`calibrate --also-root`, quick 42's model-placeholder and `benchmark per-objective` fixes and more under Fixed; 9
entries) and 39 lines inside `## [3.1.0]` (objective 80). All of that code is on this branch and ships in the v3.1.0
tag, but `release-tag.cjs` takes the release notes from `## [3.1.0]` only, so the Unreleased entries, including a
removal (`df-` agent names no longer bind), would be missing from the 3.1.0 notes. `plugins/aoforge-stack-flutter/CHANGELOG.md`
likewise gained an `## [Unreleased]` section (quick 42, `--judge-tier` and tier escalation) above its untagged
`## [1.0.0]`. 79-08 recorded Unreleased as empty.

Folding them into the release sections changes `CHANGELOG.md` outside `.aoforge/`, which breaks 79-09's precondition
that only planning files differ from VALIDATED_SHA, so that fold needs a fresh re-validation (or an explicit
user-accepted exception for a changelog-only diff). If the entries are meant for a later release instead, this
VALIDATED_SHA stands as is.

## Changelog fold (2026-10-17)

**The user decided on 2026-10-17 to fold `## [Unreleased]` into the release sections and to date the release that
day.** Commit `14e87f47` does it. The release hold above is resolved by that decision. The frontmatter `release_hold`
field still carries the original text: this section is the record of how the hold was resolved.

### What changed since VALIDATED_SHA `9a4b0997`

`git diff --name-only 9a4b0997..HEAD` outside `.aoforge/` is four files, all changelog text or a test date:

| File | Change |
|---|---|
| `CHANGELOG.md` | The 9 `## [Unreleased]` entries moved into `## [3.1.0]`, with a bold lead to match the section. Quick 42's model-placeholders guard went to Added; quick 40's `df-` prefix removal to Removed, whose heading now names it; quick 40's rename-guard change to Changed; quick 41's `calibrate --also-root` fix, quick 42's two fixes and quick 43's three fixes to Fixed. `## [Unreleased]` is now an empty heading, and the heading reads `## [3.1.0] - 2026-10-17`. The lead paragraph names the `df-` agent-name break and `calibrate --also-root`, and now says objectives 73 to 80 and quick 34 to 43 (it said 73 to 78 and 34 to 39). Quick 37's "Release dates" line says 2026-10-17. |
| `plugins/aoforge-stack-flutter/CHANGELOG.md` | Its three `## [Unreleased]` entries (quick 42: `--judge-tier`, `tier_escalation`, the ui-evaluator escalation) moved, verbatim, to the end of `## [1.0.0]` Added. `## [Unreleased]` is now empty, and the heading reads `## [1.0.0] - 2026-10-17`. |
| `plugins/aoforge-stack-web/CHANGELOG.md` | Date only: `## [1.0.0] - 2026-10-17`. It had no Unreleased entries. |
| `plugins/aoforge/hooks/changelog-on-tag.test.js` | Quick 37's test 20 pins the new date, 2026-10-17, for all three headings (the name and the assertion). It is still an exact-line `assert.equal`, so the test is not weaker. The synthetic `## [3.1.0] - 2026-10-16` fixture of the quick 34 hint tests is not a pin on this repository's date and is unchanged. |

No code, workflow, manifest or version changed. Under `.aoforge/` the only change is this file (`7b7b27e5` and this
section). `git diff --stat 9a4b0997..14e87f47`: 5 files, 153 insertions, 70 deletions (this file +92, CHANGELOG.md
100 lines, the Flutter pack changelog 25, the web changelog 2, the test 4).

A check confirmed that the fold lost nothing. Every word of the 9 original core bullets is still in `## [3.1.0]`; the
only differences are two sentence-final punctuation marks, where a first sentence became the bold lead.

**For 79-09:** its precondition `git diff --name-only <VALIDATED_SHA> integrate/3.1.0`, every path under `.aoforge/`,
now lists the four files above. This section records them as the changelog and test-date exception the hold asked
for. Every check below ran on the folded tree. VALIDATED_SHA is not re-stamped.

### Checks on the folded tree

Every check ran with HOME and TMPDIR under the session scratchpad.

| Check | Result |
|---|---|
| `changelog check 3.1.0` (repo CLI) | `ok: true, present: true` |
| Repo hook `plugins/aoforge/hooks/changelog-on-tag.js` against the working tree | `v3.1.0`, `aoforge--v3.1.0`, `aoforge-stack-flutter--v1.0.0` and `aoforge-stack-web--v1.0.0` are allowed (exit 0, no decision). The controls `v9.9.9` (core CHANGELOG has no entry) and `aoforge-stack-web--v9.9.9` (pack CHANGELOG has no entry) are denied. |
| `scripts/release-tag.cjs` offline (`planTag` + `runRelease` with a fake exec, no git push or gh call) | `v3.1.0`: kind core, alias `aoforge--v3.1.0` tagged and pushed (fake), latest. Notes come from `## [3.1.0]` via `--notes-file` (510 lines, 49,148 chars; 44,849 before) and hold the moved entries (each one checked by its text), the new lead clause, the 2026-10-17 release-dates line and the Reconcile section, with no `## [Unreleased]` or `## [3.0.0]` text. `aoforge--v3.1.0`: core-alias, no exec call. `aoforge-stack-flutter--v1.0.0`: kind pack, `--latest=false`, notes 2,277 chars including `--judge-tier` and `tier_escalation`. `aoforge-stack-web--v1.0.0`: kind pack, `--latest=false`, notes 1,103 chars. |
| `node --test` of `hooks/changelog-on-tag.test.js`, `scripts/release-tag.test.cjs`, `bin/lib/changelog.test.cjs` and `bin/lib/stack-packs.test.cjs` | 115 tests, 115 pass, 0 fail (test 20 `... 2026-10-17` included) |
| `node scripts/ci-unit-gate.cjs`, local (Node 24.13.1) | Did not finish. `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` held a `fish` child for over 9 minutes (the known W-3 hang on this machine, as above), so the run was stopped. Not a verdict. |
| CI's two steps in node:26 Docker as the non-root `node` user (uid 1000) on a copy of the folded working tree: `npm ci`, then `node --test scripts/ci-unit-gate.test.cjs`, then `node scripts/ci-unit-gate.cjs` | node v26.11.1. The self-test passes 88/88 (exit 0). The gate resolves the patterns to 418 test files, with 1 known-failure entry. `tests: 13130 reported 13082 executed (floor 3000) failures: 0 skipped: 48`; `files: 418 selected; 418 attributed`; `runner exit: 0`, 151 s; **`[ci-unit-gate] PASS`**, gate exit 0. These are the same counts as the run above. |
| `git status --porcelain` after the fold commit | `?? amp` only |

## Re-validation after objective 82 (2026-10-18)

**Every check of TRD 79-08 passes again at VALIDATED_SHA `7da7485fdb2137ae60422da82b85b5b8ef47e608` (verdict
PASS).** It supersedes `9a4b0997`. TRD 82-10 ran the checks. Every check used HOME and TMPDIR under the session
scratchpad. Nothing was pushed, tagged or released.

### What landed since `9a4b0997`

`git rev-list --count 9a4b0997..7da7485f` is 197 commits:

| Line of work | Commits |
|---|---:|
| The changelog fold and its records (79, above) | 4 |
| Quick 44 (objective 76 records, MEF-06 partial; eval81 prereg tests symlink-safe) | 4 |
| Objective 81 (the Haiku eval and model-efficiency measurement: the `scripts/eval81` harness and its records) | 91 |
| Objective 82 (3.1.0 follow-ups: runtime paths and the guard, the build-cell fixes, tier proposals P1-P5 applied, measured and partly reverted, `tokens --also-root`, the `scripts/eval82` harness, this TRD's docs and records) | 79 |
| Wave merges | 19 |

`git diff --shortstat 9a4b0997 7da7485f -- . ':!.aoforge'` reports 244 files changed, 39,802 insertions and 345 deletions.
Nothing under `.github/` changed, and neither did `plugins/aoforge/hooks/hooks.json`, `package.json`,
`package-lock.json` or any plugin.json of core and the stack packs. The only manifest change is
`.claude-plugin/marketplace.json`, which gives `eden-ui-web` 1.0.2 (below).

**One fix during the re-validation.** The first full pass ran at `ae88543b` and was green. Then a check of the sibling
plugins against `v3.0.0` found `eden-ui-web` changed by TRD 82-11, in its frontend-design skill and its brand presets,
while still at 1.0.1. The 72-18 rule (applied by 79-06 to `eden-ui-flutter`) gives a changed sibling a patch bump.
Commit `7da7485f` sets `eden-ui-web` to 1.0.2 in its plugin.json and its marketplace entry, and adds one CHANGELOG
clause. `eden-ui-flutter` was already at 1.0.2 (79-06) and is still unreleased, so its 82-11 change ships in 1.0.2. Every
check below was then re-run at `7da7485f`. Counts that differ from the `ae88543b` pass are noted.

### Suite and CI gate

| Run | Result |
|---|---|
| Full suite, Node 24.13.1, over npm test's four globs | 470 files. `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` was excluded (W-3, its fish hang on this machine; it runs in the node:26 run below), so 469 ran. tests 13,773 / suites 2,257 / pass 13,746 / **fail 0 / cancelled 0** / skipped 27 / 104.5 s. The `ae88543b` pass had identical counts in 106.0 s. |
| `node --test scripts/ci-unit-gate.test.cjs` (local) | 88/88 pass |
| node:26 in Docker as the non-root `node` user (`id -u` 1000), CI's steps after `npm ci`: the gate self-test, then `node scripts/ci-unit-gate.cjs` | node v26.11.1. `npm ci` 0. Self-test 88/88. `patterns resolve to 470 test file(s)`, `known-failure entries: 1`. `tests: 13855 reported 13806 executed (floor 3000) failures: 0 skipped: 49`. `files: 470 selected by the patterns; 470 attributed`. `runner exit: 0`, 168 s. **`[ci-unit-gate] PASS`**, gate exit 0. Identical at `ae88543b`. |

Against the previous addendum this is +725 tests and +52 files: objective 81's and 82's harness tests, plus 82's
runtime-path, build-cell and `tokens` tests. `.github/known-test-failures.json` is unchanged, with one entry (PW-9).
No new entry was added.

### Guards (each in its own `node --test` process)

| Guard | tests | pass | fail |
|---|---:|---:|---:|
| rename-guard.repo | 25 | 25 | 0 |
| stack-neutrality.repo | 7 | 7 | 0 |
| reconcile-guard.repo | 30 | 30 | 0 |
| context-budget.repo (CLAUDE.md 148 lines / 19,978 chars of 200 / 20,000) | 6 | 6 | 0 |
| runtime-path-reads.repo (new, objective 82: seven scopes enforced) | 18 | 18 | 0 |
| build-cell-reads.repo (new, objective 82: one pin per FIX row) | 8 | 8 | 0 |
| hooks/pre-bash-equivalence | 60 | 60 | 0 |
| model-placeholders.repo | 8 | 8 | 0 |
| planning-writes.repo | 11 | 11 | 0 |
| hooks/planning-writes.audit | 65 | 65 | 0 |
| builtin-sweep.repo | 17 | 17 | 0 |
| flag-spec.repo | 14 | 14 | 0 |
| doc-refs.repo / doc-refs / doc-refs.legacy | 17 / 17 / 5 | all | 0 |
| requirements-agreement.repo | 2 | 2 | 0 |
| adopt-skill-contract / adopt-e2e / adopt-migrate-e2e.legacy | 19 / 6 / 21 | all | 0 |

### Health, doctor, changelog

| Surface | Result |
|---|---|
| `upgrade --check --raw` | `up to date (v3.1.0)` |
| `validate health --raw` | `healthy`, no errors, no warnings. I001 x2: 79-09 and 79-10 have no SUMMARY because they have not started. |
| `validate consistency --raw` | `passed` |
| `validate requirements --raw` | agrees with VERIFICATION (71 objectives, 51 requirements) |
| `validate docs --raw` | no documentation advisories |
| `validate roadmap-coverage --raw` | 41/41 v1 requirements mapped. This failed at the start of 82-10 with `duplicate: MEF-06 -> objectives 76, 82`, because objective 82's Requirements line listed MEF-06. That line now reads `none mapped (...)`, as objective 81's does. MEF-06 stays objective 76's and Partial. |
| `stack validate` | ok, no errors or warnings |
| `doctor --json --path <repo>` (read-only, scratch HOME) | `degraded`, 16 ok / 4 warn / 0 error / 1 fixable. runtime-mirror, hooks-registry and model-profiles warn because the scratch HOME has no installed plugin. legacy-runtime-state (fixable) is the same four untracked leftover `.aoforge/` runtime files as before, left for the user's own `doctor --fix`. |
| `changelog check 3.1.0` | `ok: true, present: true` |
| Both prereg checks | objective 81: `OK, 86 files match` (70f92eca...); objective 82: `OK, 25 files match` (817bc181...) |

### Release preconditions

| Check | Result |
|---|---|
| Installed changelog gate (`~/.claude/plugins/cache/aocyber/aoforge/3.0.0/hooks/changelog-on-tag.js`) | `git tag -a v3.1.0` allowed (no output). The control `v9.9.9` is denied. |
| Repo hook (`plugins/aoforge/hooks/changelog-on-tag.js`) | `v3.1.0`, `aoforge--v3.1.0`, `aoforge-stack-flutter--v1.0.0` and `aoforge-stack-web--v1.0.0` are allowed. The control `aoforge-stack-web--v9.9.9` is denied. |
| `scripts/release-tag.cjs` offline (`planTag` + `runRelease` with a fake exec, no git push or gh call) | `v3.1.0`: kind core, alias `aoforge--v3.1.0`, latest. The notes file holds 55,343 chars (572 lines) from `## [3.1.0]`, including `### 3.1.0 follow-ups (objective 82)` and no `## [Unreleased]` or `## [3.0.0]` text. `aoforge--v3.1.0`: core-alias, no exec call. `aoforge-stack-flutter--v1.0.0`: pack, `--latest=false`, 3,161 chars, including the P1 revert and the runtime-path bullet. `aoforge-stack-web--v1.0.0`: pack, `--latest=false`, 1,104 chars (unchanged). |
| `node --test` of `scripts/ci-unit-gate.test.cjs`, `bin/lib/stack-packs.test.cjs` and `scripts/release-tag.test.cjs` | all pass |
| Versions | package.json, package-lock (`.version`, `packages[""]`), aoforge plugin.json, and the marketplace top level and its aoforge entry are 3.1.0. The packs aoforge-stack-flutter and aoforge-stack-web are 1.0.0 (plugin.json and marketplace), each depending on `aoforge >=3.1.0`. Each of the 8 marketplace entries equals its plugin.json; `eden-ui-flutter` and `eden-ui-web` are at 1.0.2. |
| `git ls-files .planning` | empty |
| Tracked conflict markers (`git grep -e '^<<<<<<< ' -e '^>>>>>>> '`) | none (exit 1) |
| `node scripts/gen-docs-data.cjs` | Only `generatedAt` differs, so it was restored, not committed. skills 32, agents 12, hooks 24, workflows 39, references 36, templates 31, commands 84. |
| Fleet STACK.md drafter, `AOFORGE_FLEET_ROOT=/Users/justin/dev`, read-only | 50 tests: 26 pass / 0 fail / 24 skip. The same 9 repos ran and passed. 24 were skipped, each "still uses the pre-rename planning directory", as before. |
| `git status --porcelain` | `?? amp` only |

**For 79-09:** `git diff --name-only 7da7485f <pushed head>` may list `.aoforge/` paths only. After this addendum,
82-10's SUMMARY, the state records and objective 82's completion records land under `.aoforge/`. The org cutover freeze
that blocked 79-09's push (STATE.md blocker; rulesets cutover-freeze-branches and cutover-freeze-tags) is outside this
re-validation. 79-09 re-checks it before it pushes.
