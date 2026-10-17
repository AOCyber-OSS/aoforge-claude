---
objective: quick-43
trd: 01
subsystem: adopt, upgrade migrations
tags: [adopt, migrate, gitignore, migration-0005, claude-md, docs, state]
requires: [objective 80 (adopt migrates legacy projects)]
provides:
  - "adopt.cjs migrateFinished(): an ignored report ends the adopt at its commit (in HEAD's history or the adopt branch's commit reachable from HEAD)"
  - "adopt.cjs MIGRATE_COMMIT_SUBJECT shared by reportMigrate's commit_message and the --grep needle"
  - "adopt begin returns a next that names adopt scaffold"
  - "migration 0005 bounds the rules section at the next heading of any level"
  - "migrate checker stamp_current ok detail counts new-key and unstamped configs"
affects: [adopt preflight/begin routing, upgrade --apply on CLAUDE.md blocks with ## sections, AOF-TOOLS-REFERENCE, USER-GUIDE, CHANGELOG, STATE.md]
tech-stack:
  added: []
  patterns: ["fact computed in preflight, decideRoute unchanged", "subject constant as both message and search needle"]
key-files:
  created: []
  modified:
    - plugins/aoforge/aoforge/bin/lib/adopt.cjs
    - plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.cjs
    - plugins/aoforge/aoforge/bin/lib/__fixtures__/adopt-e2e-assert.cjs
    - plugins/aoforge/aoforge/workflows/adopt.md
    - plugins/aoforge/aoforge/bin/lib/adopt-migrate-report.legacy.test.cjs
    - plugins/aoforge/aoforge/bin/lib/adopt-migrate.legacy.test.cjs
    - plugins/aoforge/aoforge/bin/lib/adopt-preflight.test.cjs
    - plugins/aoforge/aoforge/bin/lib/adopt-migrate-e2e.legacy.test.cjs
    - plugins/aoforge/aoforge/bin/lib/migrations/0005-claude-md-block.test.cjs
    - docs/AOF-TOOLS-REFERENCE.md
    - docs/USER-GUIDE.md
    - CHANGELOG.md
    - .aoforge/STATE.md
key-decisions:
  - "A migrate adopt whose report git ignores is finished when the report step ran and either the adopt commit (by MIGRATE_COMMIT_SUBJECT) is in base..HEAD or the adopt branch tip is above base and reachable from HEAD; decideRoute is unchanged"
  - "Migration 0005 ends the # Development Rules section at the next heading of any level (/^#{1,6}[ \\t]/m); a user ## subsection under the rules is kept, not owned"
  - "Interrupted-adopt record gap stays documented, not fixed (pre-writing the record would list changes that never happened)"
duration: 20 min
completed: 2026-10-17
---

# Quick 43: adopt routes past a migrated gitignored tree — Summary

**A migrate adopt on a planning tree git ignores now ends at its own commit (also after a merge and a deleted branch, or a hand-recorded commit), migration 0005 converges in one apply and no longer deletes `##` sections after the rules, `adopt begin` names `adopt scaffold`, the checker tells stamped from unstamped configs, and the reference doc names `/aoforge:adopt` first.**

BASE: `4b3c15278872515844b40e5ce01ec6392091246f` (branch `integrate/3.1.0`; `git status` at start: `?? .aoforge/quick/43-…/` and `?? amp`). Preflight `exec-context check` passed (`checkout` = `repo_root` = `/Users/justin/dev/aoforge-claude`, not a worktree).

## Progress
- [x] Task 1: a migrate adopt on an ignored tree ends at its commit; begin names the next step — d0e1db45 (RED), 87bbd21a (GREEN)
- [x] Task 2: migration 0005 converges in one apply; checker stamp detail — 259a38af (RED), d679e745 (0005 GREEN), b141f61e (checker GREEN)
- [x] Task 3: docs name adopt and drop the fixed limits; STATE via verbs; full validation — bbc2cdbd (docs), 81e89eb2 (STATE)

## Commits (in order, all through `aof-tools commit`)

| # | Hash | Message |
|---|---|---|
| 1 | d0e1db45 | test(quick-43): adopt routing after an ignored tree's commit; begin names the next step (RED) |
| 2 | 87bbd21a | fix(quick-43): a migrate adopt on an ignored planning tree is finished at its commit; begin names adopt scaffold (GREEN) |
| 3 | 259a38af | test(quick-43): 0005 converges and keeps ## sections; stamp_current detail counts unstamped configs (RED) |
| 4 | d679e745 | fix(quick-43): migration 0005 ends the rules section at the next heading of any level (GREEN) |
| 5 | b141f61e | test(quick-43): migrate checker stamp_current detail names unstamped configs (GREEN) |
| 6 | bbc2cdbd | docs(quick-43): reference names /aoforge:adopt; guide and changelog drop the fixed adopt limits |
| 7 | 81e89eb2 | docs(quick-43): STATE records objective 80 verified and 79's release position |

## Counts at BASE and at the end

All runs with `HOME=<S>/q43/home TMPDIR=<S>/q43/tmp`, `<S>` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.

| Run | BASE | End |
|---|---|---|
| Task 1 scoped set (7 files) | 165 tests, 165 pass, 0 fail, 0 todo | 173 tests, 173 pass, 0 fail, 0 todo |
| adopt-migrate-e2e.legacy | 20 tests, 18 pass, 0 fail, 2 todo | 21 tests, 21 pass, 0 fail, 0 todo |
| Task 2 scoped set (0005, upgrade, adopt-scaffold) | 70 tests, 70 pass | 72 tests, 72 pass |
| Guards (rename-guard, doc-refs, context-budget, stack-neutrality, planning-writes, dispatch-completeness, adopt-skill-contract) | n/a | 92 tests, 92 pass, 0 fail |
| **Full suite** (408 files, watcher-shell.test.cjs excluded) | **12,748 tests, 12,719 pass, 0 fail, 0 cancelled, 27 skipped, 2 todo** (97.7 s, measured here, equal to 80-09's figure) | **12,759 tests, 12,732 pass, 0 fail, 0 cancelled, 27 skipped, 0 todo** (100.0 s) |

The +11 tests are report rows 19, 20 (x2), 21, 22, 23, 24, adopt-migrate row 17, 0005 tests 16 and 17, and checker row P1. Pass rose by 13: those 11 plus the two former `todo` rows E13 and E14.

## RED evidence

**Task 1** (scoped set: 173 tests, 167 pass, 6 fail; e2e: 18 pass, 1 fail, 1 todo):
- Report row 19: preflight returned `"route": "resume"`, message `resuming adopt on branch 'aoforge/adopt'`.
- Report row 20, both variants (`--ff-only`, `--no-ff -m 'merge adopt'`): `"route": "refuse"`, `"reason": "adopt-in-progress-elsewhere"` (the marker stays active on a deleted branch).
- Report row 21: `"route": "resume"`.
- adopt-migrate row 17: `+ 'aof-tools --cwd <target> adopt begin'` / `- 'aof-tools --cwd <target> adopt scaffold'`.
- adopt-preflight test 11: `The input did not match the regular expression /adopt scaffold/. Input: 'aof-tools --cwd <target> adopt begin'`.
- E13: `preflight after a finished adopt: resume (resume: all steps done, ready to commit)`.
- Rows 22, 23, 24 passed at RED, as planned (they pin that the fix does not end an unfinished adopt).

**Task 2** (0005: 17 tests, 15 pass, 2 fail; e2e: 19 pass, 2 fail, 0 todo):
- 0005 test 16: `CLAUDE.md # Development Rules section differs from the template (drift)` after the first apply.
- 0005 test 17: the expected/actual diff shows `## Local rules\n\n- keep me\n\n` deleted by apply.
- E14: `still pending: ["0005: CLAUDE.md # Development Rules section differs from the template (drift)"]`.
- P1: the detail read `1 config.json file(s): "aoforge" key, no "<legacy key>" key` for a config that holds neither key (the F2 claim). The counts pinned (0/1 for `{ stamp: null }`, 2/0 for the nested default) matched what GREEN produced; no adjustment was needed.
- Scratch repro of the data loss before the fix (`<S>/q43/d2-repro.cjs`): `detect 1: ... differs from the template (drift)`, then after the second apply `has ## Codebase map: false | ## Release flow: false`. After the fix: `detect 1: ... is current (v=2)`, both sections `true`.

## Planning-context items and their evidence

| Item | Outcome | Evidence |
|---|---|---|
| 1. D1: an ignored report never reaches HEAD, so preflight/begin route to `resume` after the commit | Fixed | `migrateFinished()` in adopt.cjs (87bbd21a). Green: E13, report rows 19, 20 (ff and no-ff, branch deleted), 21 (hand-recorded). Kept: rows 22 (resume, ready to commit), 23 (refuse elsewhere), 24 (resume, reported false), report row 5 (tracked tree) and adopt-migrate 13 (staged vs committed) unchanged |
| 2. D2: 0005 bounded the rules at the next `# ` only; second apply deleted `##` sections | Fixed | `NEXT_HEADING_RE = /^#{1,6}[ \t]/m` (d679e745). Green: 0005 tests 16, 17; E14 (`up_to_date: true`, `## Codebase map` kept); 0005 tests 1-15 and upgrade.test unchanged |
| 3. AOF-TOOLS-REFERENCE pointed at 3.0.x and never named adopt | Fixed | bbc2cdbd: the 11 targeted substitutions (validation, upgrade, adopt, doctor and rename-leftovers bullets). Every project-conversion `3.0.x` mention now follows `/aoforge:adopt`; the remaining `3.0.x` mentions on line 26 are home-level (runtime home), which adopt does not touch |
| 4a. F2: checker `stamp_current` ok detail claimed the new key for an unstamped config | Fixed | b141f61e; row P1 |
| 4b. F3: `adopt begin` returned `next` naming `adopt begin` (migrate and fresh) | Fixed | `NEXT_AFTER_BEGIN` (87bbd21a); adopt-migrate row 17 (JSON and `--raw` `migrate: aof-tools --cwd <target> adopt scaffold`), adopt-preflight test 11 |
| 5. STATE.md said 80 "ready for verification" | Fixed | 81e89eb2 via `state update` (Current focus, Status, Milestone), `state update-progress`, `state record-session`; every verb printed `updated: true` / `recorded: true`; `git diff` showed only those five lines |
| Interrupted-adopt record gap | Not fixed (Locked decision 6) | Stays documented: USER-GUIDE "Known limit of the migrate path" (the one remaining bullet) and CHANGELOG 3.1.0 "Known limit" bullet |

## D2 root cause

Migration 0005 owns only the `# Development Rules` section of a CLAUDE.md block and found its end with `/^# /m`, the next H1. The fleet fixture's block (and any block map-codebase wrote with `##` sections) has no rules section and only `##` headings, so the first `upgrade --apply` inserted the rules as the first section and the following `## Codebase map` became, to `locateRules`, part of the rules section, which then ran to the end of the block. The next `detect` compared that whole tail with the template's rules and reported drift, and the second `apply` replaced the whole tail with the template's rules: **it deleted `## Codebase map` and every section after it**. That is user content loss, not only a missing convergence; a block written with H1 sections (smartWellness in 80-07) never hit it. The template's rules section has no sub-heading, so its parsed `rules` is unchanged by the new bound (0005 test 2 still pins it).

## Deviations from Plan

### Auto-fixed Issues

None in product code. Process notes:

1. **[Process] `summary checkpoint` not run per task.** The dispatch said not to run `quick summary` and the JOB says the orchestrator commits the SUMMARY, so the `## Progress` checkpoint was kept in the draft only and no task commit carries the SUMMARY.
2. **[Process] One malformed search command.** A `rg` call quoted its patterns in double quotes, so the shell expanded the backticks inside them (`git mv`, `gh rebrand` and a few words ran as commands with no arguments). Each printed usage or "command not found"; `git status --short` right after showed nothing changed. The search was redone from a pattern file.
3. **[Test helper] `versionedClaudeMd` now delegates to a new `blockWith(start, sections)`** in the 0005 test file, so tests 16 and 17 use the same canonical form without a second copy of the template string. Tests 1-15 are byte-for-byte unchanged in behaviour (all green).
4. **[Doc wording] The checker detail string** is split across two template-string lines; the text is exactly Locked decision 5.
5. **[Process] No token stamp.** `aof-tools tokens stamp quick-43 --draft <draft>` exits 1 (`invalid TRD id "quick-43" (expected <objective>-<NN>)`): the stamp takes TRD ids only, so this quick SUMMARY carries no token fields.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1 | `node --test` Task 1 scoped set (7 files) | 0 | PASS (173/173) |
| 1 | `node --test .../adopt-migrate-e2e.legacy.test.cjs` | 0 | PASS (19 pass, 1 todo = row 14, as planned) |
| 2 | `node --test .../migrations/0005-claude-md-block.test.cjs .../upgrade.test.cjs .../adopt-scaffold.test.cjs` | 0 | PASS (72/72; 0005 has 17 tests) |
| 2 | `node --test .../adopt-migrate-e2e.legacy.test.cjs` | 0 | PASS (21/21, 0 todo) |
| 2 | `node --test .../adopt-e2e.test.cjs` (other checker user) | 0 | PASS |
| 3 | guards (rename-guard, doc-refs, context-budget, stack-neutrality, planning-writes, dispatch-completeness, adopt-skill-contract) | 0 | PASS (92/92) |
| 3 | `aof-tools changelog check 3.1.0` | 0 | PASS (`ok: true, present: true`) |
| 3 | `aof-tools validate docs --raw` | 0 | PASS (`no documentation advisories`) |
| 3 | `git diff BASE -G 8080 --stat -- . ':!amp'` | 0 | PASS (empty) |
| 3 | full suite (`xargs node --test < <S>/q43/files.txt`) | 0 | PASS (12,759 tests, 0 fail, 0 cancelled, 0 todo) |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| T1 RED | Task 1 scoped set + e2e file | 1 / 1 | FAIL (correct): 19, 20x2, 21, migrate 17, preflight 11, E13 |
| T1 GREEN | same | 0 / 0 | PASS (correct) |
| T2 RED | 0005 file + e2e file | 1 / 1 | FAIL (correct): 16, 17, E14, P1 |
| T2 GREEN (0005) | Task 2 scoped set | 0 | PASS (correct) |
| T2 GREEN (checker) | e2e file | 0 | PASS (correct), 21/21, 0 todo |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | full suite by the 80-09 method (`npm test` itself is not run here because watcher-shell.test.cjs hangs on this machine; it is the only file excluded) | 0 | PASS |

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 9/9 (D1 routes and non-routes, D2, E13/E14 un-todo, begin `next`, checker detail, reference doc and docs, STATE via verbs, full suite and guards)
- Gate failures: None
- `git diff BASE --stat` touches exactly the 13 files in `files_modified`; `amp` untouched and unstaged; no push, tag, release or PR.
- `state update-progress` recomputed the bar as 582/583 TRDs, which still rounds to `[██████████] 100%`; the line did not change.

## Follow-ups

1. **Interrupted-adopt record gap.** A stop between `convertResidue` and the marker write leaves conversions done but missing from the Migration table. Options: pre-write the planned record (rejected: a stop before the conversion would list changes that never happened), or derive the record from the git diff against `base_sha` at report time, which is always truthful. The second is the better follow-up.
2. **Squash merge with a new title plus a deleted branch, on an ignored tree.** Neither signal sees it: the squash commit's subject is not `MIGRATE_COMMIT_SUBJECT`, and with the branch deleted there is no tip to test. By the same logic as row 20 at BASE (not tested here), preflight on the base branch would refuse `adopt-in-progress-elsewhere` until the user deletes the marker. A third signal (for example, the base branch's history holding the report's `commit_files` change since `base_sha`, or the marker recording the commit sha once `aof-tools commit` returns) would cover it.
3. `migrations/0007-doc-refs-fix.cjs` line 40 comments that its bound "mirrors 0005's locateRules"; 0007 bounds at `^## ` and was not touched. Only the comment's claim of mirroring is now looser.

## Self-Check: PASSED

- All 7 commits found with `git log --no-walk` (d0e1db45, 87bbd21a, 259a38af, d679e745, b141f61e, bbc2cdbd, 81e89eb2).
- adopt.cjs holds `MIGRATE_COMMIT_SUBJECT`, `function migrateFinished` and `NEXT_AFTER_BEGIN` (8 references); 0005 holds `NEXT_HEADING_RE` and no `NEXT_H1_RE`.
- Working tree clean apart from the untracked quick directory and `amp`.
