---
objective: 80-adopt-migrates-legacy-projects
verified: 2026-10-17T00:00:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
---

# Objective 80: Adopt migrates legacy projects - Verification Report

**Goal:** `/aoforge:adopt` moves a legacy `.planning/` project to `.aoforge/` (stamp and block markers renamed) as one recorded change on `aoforge/adopt`, unattended and idempotent; fresh and brownfield adoption keep working.
**Status:** passed. **Re-verification:** No.

## Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Legacy tree moved with git mv, stamp and block renamed, one change on aoforge/adopt, health clean | VERIFIED | `lib/legacy-migrate.cjs` (748 lines), `adopt.cjs` migrate route. Re-run: legacy-migrate 24, adopt-migrate-report 19, adopt-migrate-e2e (hand-migration equivalence, R100 renames, 3.1 tool probes) pass. 80-07 aodex/smartWellness copies checker-green. |
| 2 | Dirty/in-progress/both-dirs refuse with one message, nothing moved; idempotent and resumes | VERIFIED | adopt-migrate.legacy and e2e re-run/resume matrix pass (0 fail). Residue-before-marker gap and D1 weighed below. |
| 3 | W066, CLI guard, SessionStart notice, doctor 27 name /aoforge:adopt | VERIFIED | `legacy-layout-adopt-path.legacy.test.cjs` (16 tests, spawned CLI, hook and doctor) pass. |
| 4 | Three fixtures end to end through the workflow commands; ADOPT-REPORT lists migration | VERIFIED | adopt-e2e (fresh, brownfield, fleet-shaped) pass; 80-07 and 80-08 simulated runs; checker `--mode migrate`. |
| 5 | Rename and stack-neutrality guards; ALLOW-listed module; docs; full suite | VERIFIED | rename-guard, stack-neutrality, doc-refs, flag-spec pass. Docs: migration guide, USER-GUIDE, CHANGELOG 3.1.0 "Added: adopt migrates pre-rename projects", CLAUDE.md. Full suite relied on from 80-09-SUMMARY (12,748 tests, 0 fail, 27 skipped, 2 todo, watcher-shell excluded); not re-run here. |

Targeted run (HOME/TMPDIR in scratchpad): 14 files, 288 tests, 286 pass, 0 fail, 2 todo.

## Known limitations weighed

- **D1** (untracked/ignored planning tree: preflight routes to `resume` after the commit): pinned as a `todo` test and todo row 13. Only affects an untracked planning tree, which is outside SC-1's "recorded change" repo shape; the change is recorded and re-running is harmless. Acceptable, documented.
- **D2** (migration 0005 may need a second `upgrade --apply`): belongs to migration 0005, not adopt; converges on re-run; did not reproduce on the real smartWellness copy. Acceptable.
- **Residue-before-marker-write gap** (80-05): documented; resume path covered. Acceptable.
- **docs/AOF-TOOLS-REFERENCE.md** says "convert with 3.0.x" without naming adopt: minor doc inconsistency (CHANGELOG, guide, USER-GUIDE do name it). Advisory, not an SC blocker.

## Gaps

None blocking. Advisory follow-ups: fix D1 and D2 (todo rows 13, 14); name `/aoforge:adopt` in docs/AOF-TOOLS-REFERENCE.md.

## Deployment verification

deployment_verification: not_available (not applicable; CLI/prompt changes only).

_Verifier: Claude (verifier)_
