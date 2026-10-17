---
objective: 80-adopt-migrates-legacy-projects
trd: "07"
subsystem: adopt
tags: [adopt, legacy-migration, simulated-run, fleet, read-only-clone]

requires:
  - objective: 80-adopt-migrates-legacy-projects
    provides: "TRD 80-05 migrate path in workflows/adopt.md and the adopt skill; TRD 80-06 adopt-e2e-assert.cjs --mode migrate"
provides:
  - "evidence that the adopt skill and workflow text, followed verbatim with the 3.1.0 tools and a fake HOME, migrate two real fleet layouts (aodex: three nested planning roots and a stamp key; smartWellness: a pre-v1 CLAUDE.md block) in one commit each"
  - "a hand-migration comparison (identical validate-health codes at every planning root) and a proof that the source repositories were never written"
affects: [80-08, 80-09]

tech-stack:
  added: []
  patterns:
    - "a simulated run: read the skill and workflow, run each step with only the documented path substitutions, judge the end state with the checker"

key-files:
  created: []
  modified: []

key-decisions:
  - "No product code changed: neither known defect (D1, D2) reproduced on these two fleet repositories, so the todo rows stay in adopt-migrate-e2e.legacy.test.cjs and the fixes are left to a gap plan"

requirements-completed: [SC-1, SC-2, SC-4]

verification:
  gates_defined: 3
  gates_passed: 0
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: false

duration: 9min
completed: 2026-10-17
tokens_input: 14475749
tokens_output: 77385
tokens_cache_read: 14290122
tokens_cache_write: 185439
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 07: Simulated /aoforge:adopt on read-only copies of real fleet repositories Summary

**Following `skills/adopt/SKILL.md` and `workflows/adopt.md` verbatim with the repository's 3.1.0 tools and a fake HOME, aodex (three planning roots, `devflow` stamp, 1,169 moved files) and smartWellness (pre-v1 CLAUDE.md block, 106 moved files) each end in one commit on `aoforge/adopt`, a clean tree and a green `--mode migrate` checker; validate-health codes equal a hand migration at every root, a re-run routes to `upgrade` and writes nothing, and the source repositories are byte-for-byte untouched. No product defect found; D1 and D2 did not reproduce on this data.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-17T07:50:59Z
- **Completed:** 2026-10-17T08:00Z
- **Tasks:** 2 of 2
- **Files modified:** 0 product files (this SUMMARY only)

## Progress
- [x] Task 1: Clone read-only and follow /aoforge:adopt on both clones — 57eb670e
- [x] Task 2: Checks, comparisons, source-untouched proof, SUMMARY — (this commit)

## Paths and shas

- Work area `<S>/80-07/`, `<S>` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`; fake HOME `<S>/80-07/home` (built by `adopt-fixtures.cjs home`).
- aodex source `/Users/justin/dev/aodex` HEAD `c42149326a226aca6a298385c4b694c6104ab798` (branch `fix/ci-listtile-material`); smartWellness source `/Users/justin/dev/smartWellness` HEAD `23271c475cab19cd6289716975e9c707eda08a52` (branch `df/riverpod3-bump`). Clones take HEAD only; the sources have uncommitted work that the clones never see.
- Tools: this checkout's `plugins/aoforge/aoforge/bin/aof-tools.cjs` (3.1.0, waves 1-4), every command prefixed `HOME=<S>/80-07/home`.

| Clone | Adopt commit | Hand commit | Tree after |
|---|---|---|---|
| `aodex` | `ada03a49` on `aoforge/adopt` | `aodex-hand` `d3cc1c52` | clean |
| `smartwellness` | `0b3d2d2` on `aoforge/adopt` | `smartwellness-hand` `8de0805` | clean |

## The workflow, step by step

Substitutions used (the only ones permitted): `node ~/.claude/aoforge/bin/aof-tools.cjs` became `HOME=<S>/80-07/home node <checkout>/plugins/aoforge/aoforge/bin/aof-tools.cjs`; `$TARGET` became the clone. Every command exited 0.

| Step | aodex | smartwellness |
|---|---|---|
| resolve_target | path exists | path exists |
| preflight | `migrate`: 3 moves (`.planning` 1038, `flutter/.planning` 129, `go/.planning` 2 files, all tracked), 1 stamp rename, 0 blocks, 5 ignore rewrites | `migrate`: 1 move (106 files, tracked), 0 stamps, 1 pre-v1 block in CLAUDE.md, 1 ignore rewrite |
| begin | 3 `git mv`, branch `aoforge/adopt` created, no `skill-active --start` (migrate path) | 1 `git mv`, branch created |
| map, infer_project, confirm_stack_profile, health | skipped (migrate path) | skipped |
| scaffold | `converted: 6` (1 stamp, 5 ignore lines), 3 backups under the fake HOME | `converted: 2` (the block, 1 ignore line), 1 backup |
| report | `commit_blocked: null`, 74 needs-review rows | `commit_blocked: null`, 7 rows |
| commit | `aof-tools commit` with the report's `commit_message` and `commit_files` (`.aoforge .gitignore .planning flutter/.aoforge flutter/.planning go/.aoforge go/.planning`): `ada03a49` | same, files `.aoforge .gitignore .planning CLAUDE.md`: `0b3d2d2` |
| summary | branch `aoforge/adopt`, sha, `.aoforge/ADOPT-REPORT.md`, 74 rows, merge instruction, "nothing was pushed", `upgrade --check` next | same, 7 rows |

Commands that printed long JSON (`report`, the re-run preflights) had stdout redirected to a scratchpad file and were read with `jq`; the commands themselves were unchanged.

## Acceptance checker (`adopt-e2e-assert.cjs check <clone> --home <home> --mode migrate`), verbatim ids

Both clones: `ok: true`, exit 0.

| Id | aodex | smartwellness |
|---|---|---|
| on_adopt_branch | ok: HEAD branch `aoforge/adopt` | ok |
| one_commit | ok: 1 commit since base_sha | ok |
| tree_clean | ok | ok |
| not_pushed | ok: no upstream; no remote branch contains HEAD | ok |
| no_legacy_layout | ok: `planMigration applies false at 3 root(s)`; no W066/W067/W069 | ok at 1 root |
| history_kept | ok: `.aoforge/.dup-detect-log.jsonl` 6 commits; `flutter/.aoforge/.micro-description` 2; `go/.aoforge/objectives/03-management-bootstrap/00-MIGRATE-INFRA-FIX.md` 2 | ok: `.aoforge/.awareness-cache.json` 4 commits |
| report_lists_migration | ok: `## Migration` lists 3 moved trees | ok: 1 tree |
| stamp_current | ok: 2 config.json files | ok: 1 config.json file (see finding F2) |

## validate health: adopt clone vs hand clone

`validate health --raw` at every planning root, finding codes counted by severity. The code counts and the finding messages were equal for every pair (`message-only-in-adopt=0`, `message-only-in-hand=0`); no W066, W067 or W069 anywhere.

| Root | Status | Codes (adopt = hand) |
|---|---|---|
| aodex `/` | broken | E002 x1, E030 x1, W005 x26, W006 x1, W007 x21, W040 x1, I001 x59 |
| aodex `flutter/` | degraded | W002 x1, W007 x12, W040 x1, I001 x23, I030 x1 |
| aodex `go/` | broken | E002 x1, E003 x1, E004 x1, W003 x1, W040 x1, I001 x1, I030 x1 |
| smartwellness `/` | broken | E030 x1, W007 x3, W040 x1 |

What remains is not caused by the move:

- **Environment (the fake HOME):** E030 on aodex `/` and smartwellness `/`, `STK009: component profile 'flutter' not found`. The fake HOME has no stack-pack plugin owning the profile; the hand clone shows the same code. Doctor's three global warns (`runtime-mirror`, `hooks-registry`, `model-profiles`) come from the same cause.
- **The projects' own state:** aodex `/` E002 (no PROJECT.md); `go/` holds only `objectives/`, hence E002, E003, E004, W003; W005 (26 objective directories not named `NN-name`), W006, W007 and W002 (roadmap and objective drift); I030 (a Dart manifest with no STACK.md).
- **Pending upgrade, expected after adopt:** W040 (`stamped v2.13.1` / `stamped never`); the report names the pending migrations (aodex `/` 0008; `flutter/` and `go/` 0001 and 0004; smartwellness 0001, 0005, 0008). `upgrade --apply` or the next session start applies them.

## Diff summary (`git diff -M --name-status <clone HEAD before> HEAD`)

| Clone | Renames | Others |
|---|---|---|
| aodex (1,171 entries) | 1,168 x R100 | `R099 .planning/config.json -> .aoforge/config.json` (the stamp key, the only changed line), `A .aoforge/ADOPT-REPORT.md`, `M .gitignore` (5 ignore lines) |
| smartwellness (109 entries) | 106 x R100 | `A .aoforge/ADOPT-REPORT.md`, `M .gitignore` (1 line), `M CLAUDE.md` |

smartWellness `CLAUDE.md` (118 lines, all of it the block): the diff has exactly four hunks, lines 1 and 118 (the markers; line 1 also `/devflow:map-codebase` to `/aoforge:map-codebase`) and lines 9 and 70 (`.claude/devflow/references/tdd.md` to `.claude/aoforge/references/tdd.md`, `.planning/codebase/PATTERNS.md` to `.aoforge/codebase/PATTERNS.md`), all inside the block. The file has no bytes outside the block. The two vendored `CLAUDE.md` files (`vendor/github.com/jackc/pgx/v5`, `vendor/github.com/minio/minio-go/v7`) hash identically before and after (`195703c8...`, `cc8bd9d0...`).

`diff -r -x .git` of each adopt clone against its hand clone: aodex differs by `ADOPT-REPORT.md` only; smartwellness by `ADOPT-REPORT.md` and by `CLAUDE.md`, where adopt also converts the three names inside the block that the guide's Option B (markers only) leaves (the adopt behaviour the TRD's must-have asks for).

## Re-run, tool probes

- **Re-run:** `adopt preflight` and a second `adopt begin` on each adopt clone: `route: "upgrade"` ("already an AOForge project"), exit 0. `adopt-e2e-assert.cjs snapshot` before and `compare` after: `{"ok":true,"changed":[]}` for both; HEAD (`ada03a49`, `0b3d2d2`) and `git status --porcelain` unchanged.
- **3.1 tools on the aodex adopt clone** (all exit 0): `state load` (`config_exists`, `roadmap_exists`, `state_exists` all true; STATE.md 253,323 bytes); `roadmap analyze` (33 objectives, 18 complete, current 4, next 11); `doctor --json` check `legacy-planning-layout` (27) `severity: ok`, `findings: []` (the overall status is `broken`: `legacy-runtime-state` error for the tracked `.aoforge/.dup-detect-log.jsonl` that migration 0008 untracks, `validate-health` error E002/E030, the three fake-HOME global warns, `pending-migrations` warn); `upgrade --check` pending 0008 (auto), nothing needing confirmation; `init plan-objective 1` last (objective found, `01-natural-handback`), the tree stays clean.
- **D2 probe on real data (smartwellness adopt clone, after every check above):** `upgrade --check` listed 0001, 0005 ("CLAUDE.md AOFORGE block has a legacy unversioned marker; template is v=2") and 0008; one `upgrade --apply` applied all three (CLAUDE.md 15 lines changed, marker `v=2`) and the next `upgrade --check` reported `up_to_date: true`. D2 did not reproduce.

## Source-untouched proof

Every command that named a fleet repository was `git --no-optional-locks -C <repo> ...` (or `ls`, `stat`, `shasum`, which take no locks); no writing command used a source as cwd or `--cwd`.

| Item | Before | After |
|---|---|---|
| aodex HEAD | `c42149326a226aca6a298385c4b694c6104ab798` | identical |
| smartWellness HEAD | `23271c475cab19cd6289716975e9c707eda08a52` | identical |
| `git status --porcelain=v1` (both) | saved | `diff` empty |
| `ls -la .planning` (both), `flutter/.planning`, `go/.planning` | saved | `diff` empty |
| `.git/index` sha-256 | aodex `4952d6df...a127535`, smartWellness `b7e3202c...ab894f6` | identical |
| `.git/index` and `.git/HEAD` mtime and size (aodex index mtime 1791294024 size 525525; smartWellness index mtime 1790691247 size 259762) | saved | `diff` empty |
| Real `~/.claude/aoforge/backups` listing | saved | `diff` empty (no entry named after a clone or fixture, and no other session's change either) |

The fake HOME's backups hold only `aodex-bb417ef4`, `flutter-ed087dec`, `go-8d40122b`, `smartwellness-501f6cae`.

## Needs-review rows of each ADOPT-REPORT.md (item and confidence)

smartwellness (7): `validate health error E030` (priority); `adopt changed no planning content beyond the stamp key` (priority); `validate health warning W007` x3 (low); `validate health warning W040` (low); `3 automatic upgrade migrations pending (0001, 0005, 0008)` (low).

aodex (74 = 6 priority + 68 low): priority: `validate health error E002`, `validate health error E030`, `go/: validate health error E002`, `go/: ... E003`, `go/: ... E004`, `adopt changed no planning content beyond the stamp key`; low: W005 x26, W006 x1, W007 x21 and W040 at `/`; W002 x1, W007 x12, W040 under `flutter/`; W003 and W040 under `go/`; three "automatic upgrade migrations pending" rows (one per root).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: clone and follow the workflow | `git -C <clone> log --oneline -2` on aodex and smartwellness | 0 | PASS (`ada03a49` above `c4214932`; `0b3d2d2` above `23271c4`; both hand clones committed `d3cc1c52`, `8de0805`) |
| 2: checks, comparisons, proof | `adopt-e2e-assert.cjs check ... --mode migrate` x2; `validate health --raw` at 4 roots x2; before/after `diff` of 9 source evidence files | 0 | PASS (ok=true x2; all codes equal; all diffs empty) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | not run (no product code changed; the suite was not run, so `watcher-shell.test.cjs` was never in play) | - | not_available |
| lint | not_available | - | not_available |
| build | not_available | - | not_available |

## Deviations from Plan

1. **[Rule 3 - tool] The before/after evidence files were written by shell redirection into the scratchpad, not with the Write tool,** because the aodex `status --porcelain` listing is about 300 lines of untracked screenshots; content is the same.
2. **`git add -u` before the hand-clone commits.** The TRD's commit command (`git commit -q -m "hand migration"`) alone would not stage the `sed` edits; `git mv` had staged only the renames.
3. **`doctor --json` in addition to `doctor --raw`.** `--raw` is the text report; the JSON form carries `legacy-planning-layout` by id (as 80-06 already noted).
4. **"first objective number" read as 1** for `init plan-objective`: the aodex roadmap numbers are unordered with duplicates (`4, 2, 1, 3, 4, 5, ..., 9, 9, ..., 510, ..., 510`), so `analyze` first-listed (4) would not be a stable choice.
5. **Extra D2 probe** (`upgrade --check`/`--apply` on the smartwellness adopt clone), after every TRD-listed check; it wrote only to the scratch clone.
6. **Two harmless slips:** a duplicate `--no-optional-locks` made one source `git status` fail with usage (exit 129, read nothing), and one background re-read of the aodex status ran for nothing. Neither wrote anything; the saved before-files come from later single runs.

## Findings (none blocking; no product code changed)

- **F1 workflow wording (`workflows/adopt.md`, `scaffold`):** it says the command "prints `migrated: <n> converted`". That line is only the `--raw` form (`adopt-cli.cjs` line 38); the workflow's command has no `--raw`, so the agent sees JSON with `converted: <n>`. Harmless to an agent that reads JSON; a one-word fix ("`converted` count") when the workflow is next touched.
- **F2 checker detail wording (`adopt-e2e-assert.cjs`, `stamp_current`):** the `ok` detail is a fixed template (`"aoforge" key, no "devflow" key`), so it reads as true for smartWellness whose `config.json` carries neither key. The check is right (a config with neither key is unstamped, not a leftover; 80-06 decision), only the message misleads.
- **F3 stale `next`:** `adopt begin` still returns `next: "aof-tools --cwd <target> adopt begin"` after it ran. The workflow says "continue to `scaffold`", so there is no ambiguity for an agent following the text.
- **D1 / D2 (80-06) not reproduced here.** D1 (`resume` after a finished adopt) needs an ignored planning tree; both fleet repos track theirs, so the report reaches HEAD and the re-run routes to `upgrade`. D2 (0005 needing two applies) needs the template-shaped legacy block of the fixtures; smartWellness's map-codebase block converged in one apply. Todo rows 13 and 14 in `adopt-migrate-e2e.legacy.test.cjs` stay as they are, and `adopt.cjs` and the 0005 code were not touched. A fleet repo with `.planning/` in `.gitignore` (check with `git check-ignore .planning`) would hit D1; that is the case worth a fixture-free retest before 3.1.0 ships.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 (aodex migrates in one commit through the workflow text with checker ok and an ADOPT-REPORT.md Migration section; smartWellness's block markers and the names inside the block are converted, the vendored CLAUDE.md files are byte-identical; adopt and hand clones give equal validate-health codes at all four roots, remaining findings classified; HEAD, status, planning listings, index hash, index mtime and the real backups listing identical before and after; re-run routes to `upgrade` and the snapshot compare is empty)
- Gate failures: None
- The four clones (`du -sk`: aodex 201,632 KB, aodex-hand 201,600 KB, smartwellness 95,392 KB, smartwellness-hand 95,368 KB) were deleted after this SUMMARY recorded their numbers; the fake HOME, the saved JSON and the before/after evidence files remain under `<S>/80-07/`.

## Self-Check: PASSED

- FOUND: commit 57eb670e in `git log` (the Task 1 checkpoint)
- FOUND: clone commits `ada03a49`, `0b3d2d2` (adopt) and `d3cc1c52`, `8de0805` (hand), read from the clones before deletion
- `git status --porcelain` in this repository was empty before the SUMMARY; this TRD changes only this SUMMARY and the state files
