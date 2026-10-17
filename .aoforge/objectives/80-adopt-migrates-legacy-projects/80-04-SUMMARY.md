---
objective: 80-adopt-migrates-legacy-projects
trd: "04"
subsystem: legacy-layout-reporting
tags: [adopt, legacy-layout, W066, W067, W069, upgrade, messages]

requires:
  - objective: 78-drop-legacy-shims
    provides: planning-layout.cjs as the one source of the legacy-layout text, retired migration ids 0012-0014
provides:
  - "Every legacy-layout surface names /aoforge:adopt as the 3.1 path, ahead of AOForge 3.0.x and the manual git mv"
  - "W067 and the project W069 fixes name /aoforge:adopt; the global W069 text does not"
  - "upgrade --apply --only 0012|0013|0014 names /aoforge:adopt beside 3.0.x and the manual step"
affects: [80-09 migration guide quote, 80-02 legacy-layout-guard.legacy.test.cjs]

tech-stack:
  added: []
  patterns:
    - "Message text built from NAMES.commandNs / NAMES.adoptBranch / SHIM_REMOVAL, no literal slash command"

key-files:
  created:
    - plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs
  modified:
    - plugins/aoforge/aoforge/bin/lib/planning-layout.cjs
    - plugins/aoforge/aoforge/bin/lib/upgrade.cjs
    - plugins/aoforge/aoforge/bin/lib/upgrade-retired.legacy.test.cjs

key-decisions:
  - "Only the project W069 fix names adopt: legacyBlockMessage keys on fileLabel === 'CLAUDE.md', so the global text and the managed-block ELEGACYBLOCK refusal for ~/.claude/CLAUDE.md stay unchanged"
  - "The existing 3.0.x, git mv and guide clauses stay in every message; adopt is added in front, so no older legacy test needed editing"

patterns-established:
  - "Outside-in surface test: one file drives the CLI guard, validate health, the SessionStart hook, doctor and upgrade --only against a legacy fixture"

requirements-completed: [SC-3]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 4min
completed: 2026-10-17
tokens_input: 5199740
tokens_output: 39594
tokens_cache_read: 5061897
tokens_cache_write: 137767
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 04: Every legacy-layout message names /aoforge:adopt Summary

**planning-layout.cjs and upgrade.cjs now point every pre-rename report (W066 in validate health, the CLI guard, the SessionStart notice, doctor check 27 and its project note, W067, the project W069, and retired migration ids) at `/aoforge:adopt` first, with AOForge 3.0.x and the manual `git mv` kept behind it.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-17T06:54:41Z
- **Completed:** 2026-10-17T06:58:35Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Progress
- [x] Task 1: RED test across the five surfaces — 4b482167
- [x] Task 2: GREEN — the text in planning-layout.cjs and upgrade.cjs — e59b93da

## Accomplishments

- `layoutFix()` is the single source for the legacy-only message; its surfaces all pick up the adopt clause without
  code changes of their own (validate.cjs, legacy-layout-guard.cjs, hooks/upgrade-project.js, doctor check 27,
  doctor-cli, init.cjs).
- W067 (both variants) and the project W069 name `/aoforge:adopt`; `legacyBlockMessage('~/.claude/CLAUDE.md')` is
  byte-identical to before.
- `retiredMessage(id)` in upgrade.cjs names `/aoforge:adopt` between the "retired after 3.0.x" opening and the
  3.0.x / by-hand alternatives.
- New outside-in test (16 tests) drives each surface with a spawned CLI, the hook and the doctor.

## Final message text (verbatim; TRD 80-09 updates the migration guide quote from this)

Legacy-only layout (`legacyLayoutMessage(root)`, `<root>` is the project path):

```
<root> still uses the pre-rename planning directory .planning/, which AOForge no longer reads. Run `/aoforge:adopt` there (AOForge 3.1.0 moves it to .aoforge/ as one recorded change on aoforge/adopt), or move it with AOForge 3.0.x (`aof-tools upgrade --apply`) or by hand: `git mv .planning .aoforge`, then rename a "devflow" key in .aoforge/config.json to "aoforge" (see docs/MIGRATING-TO-AOFORGE.md, "Upgrading from 2.x").
```

W067, pre-rename key alone:

```
In .aoforge/config.json, rename the key to "aoforge" (or run `/aoforge:adopt`, which renames it as one recorded change, or AOForge 3.0.x's `aof-tools upgrade --apply` once)
```

W067, both keys:

```
In .aoforge/config.json, delete the pre-rename key "devflow" (AOForge records its upgrades under "aoforge"), or run `/aoforge:adopt`
```

W069, project `CLAUDE.md`:

```
Rename <!-- DEVFLOW:START and <!-- DEVFLOW:END to AOFORGE; the next upgrade refreshes the block (or run AOForge 3.0.x's upgrade once), or run `/aoforge:adopt` (it renames both markers)
```

W069, global `~/.claude/CLAUDE.md` (unchanged, no adopt):

```
Rename <!-- DEVFLOW:START and <!-- DEVFLOW:END to AOFORGE; the next upgrade refreshes the block (or run AOForge 3.0.x's upgrade once)
```

Retired migration id (`upgrade --apply --only 0012`, same shape for 0013 and 0014):

```
migration 0012 (planning-dir move) was retired after AOForge 3.0.x: run /aoforge:adopt (AOForge 3.1.0 moves the planning directory, the stamp key and the CLAUDE.md markers), run it with AOForge 3.0.x, or do it by hand (docs/MIGRATING-TO-AOFORGE.md, "Upgrading from 2.x")
```

## For TRD 80-09

`docs/MIGRATING-TO-AOFORGE.md` line 103 quotes the old legacy-only message verbatim ("`<root> still uses the pre-rename
planning directory .planning/, which AOForge no longer reads. Move it with ...`"). That guide is 80-09's file and was
not edited here; replace the quote with the first block above.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: RED test across the five surfaces | `node --test legacy-layout-adopt-path.legacy.test.cjs upgrade-retired.legacy.test.cjs` (TMPDIR/HOME in the scratchpad) | 1 | PASS (RED: 20 failures, all the missing adopt clause; 11 unrelated tests green) |
| 2: GREEN, planning-layout.cjs and upgrade.cjs | `node --test` over the 11 files in the TRD verify line | 0 | PASS (211 tests, 211 pass) |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test legacy-layout-adopt-path.legacy.test.cjs upgrade-retired.legacy.test.cjs` | 1 | FAIL (correct: 20 of 31) |
| GREEN | the same two files plus 9 older legacy-message files | 0 | PASS (correct: 211 of 211) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `node --test legacy-layout-adopt-path.legacy.test.cjs upgrade-retired.legacy.test.cjs planning-layout.legacy.test.cjs` (inside the 211-test run) | 0 | PASS |
| lint | not defined | - | not_available |
| build | not defined | - | not_available |

Also run, all green: gh-seam.repo, doctor-checks/21-22-project, stack-drafter-fleet, compat.legacy,
planning-verbs-worktree.legacy, doc-refs.repo, validate (205 tests, 0 failures). The full suite was not run (the TRD
did not ask for it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Row 7 order assertion in the new test was wrong**
- **Found during:** Task 2 (GREEN run)
- **Issue:** The new test asserted `/aoforge:adopt` precedes `3.0.x` on the retired line, but that line opens with
  "retired after AOForge 3.0.x", so the check failed on correct text. TRD row 7 asks only that the line names
  `retired`, `/aoforge:adopt`, `3.0.x` and the guide.
- **Fix:** The order assertion compares adopt against the "run it with AOForge 3.0.x" clause instead.
- **Files modified:** plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs
- **Commit:** e59b93da

Otherwise none: the TRD was executed as written. No older legacy test needed its assertions changed.

## Discovered commands

None. Tests ran with `node --test {files}` from the stack profile.

## Post-TRD Verification

- Auto-fix cycles used: 1 (the row 7 assertion above)
- Must-haves verified: 4/4 (all surfaces name adopt first; W067 and project W069 name adopt while global W069 does
  not; `--only 0012|0013|0014` names adopt; every existing legacy-message test passes)
- Gate failures: None

## Issues Encountered

- The session's working directory is the main checkout, so a first GREEN run with relative paths executed against it
  and proved nothing. It was discarded and rerun with absolute worktree paths; the counts above come from that rerun.

## Self-Check: PASSED

- FOUND: plugins/aoforge/aoforge/bin/lib/legacy-layout-adopt-path.legacy.test.cjs
- FOUND: plugins/aoforge/aoforge/bin/lib/planning-layout.cjs
- FOUND: plugins/aoforge/aoforge/bin/lib/upgrade.cjs
- FOUND: commit 4b482167 (RED)
- FOUND: commit e59b93da (GREEN)
