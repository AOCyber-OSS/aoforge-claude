---
objective: 82-3-1-0-follow-ups
trd: "08"
subsystem: testing
tags: [eval82, live, batch-d, batch-c, ui-evaluator, project-researcher, escalation, ledger]
status: checkpoint
---

# Objective 82 TRD 08: Live tier checks D and C Summary

## Progress
- [x] Task 1: Confirm spend for batches D and C — (this commit)
- [ ] Task 2: Run batch D (start, then escalations) and batch C (researchers, then graders) — next step: run `EVAL82_SANDBOX_ROOT=/private/tmp/claude-501/e82-700b16eaf4b9d141 node scripts/eval81/run.cjs --batch D --root <R> --token-file <T> --batch-dir scripts/eval82/batches --results-dir <O>/results --sandbox-root /private/tmp/claude-501/e82-700b16eaf4b9d141 --raw` in the background from the repo root
- [ ] Task 3: Score, apply the pre-registered verdicts, revert what fails, publish 82-TIER-CHECKS.md

## User gate decision (2026-10-18)

Given in the dispatch, before any spend: **"Go D, C, E at cap $25"**. The approval covers 82-08's gate (D and C)
and 82-09's gate (E's two 3.1.0 builds). Executed as "go D C cap 25": `ledger82 --raise --cap 25 --e-cap 15
--reason 'user (2026-10-18): Go D, C, E at cap $25'`.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` (objective 82 manifest) | exit 0: OK, 25 files, 817bc181... |
| `prereg.cjs --check` (objective 81 manifest) | exit 0: OK, 86 files, 70f92eca... |
| token file | present (`test -s` only) |
| tree under test | HEAD 5cea8f008344978c1569551944e1a2c549a889c7 (`integrate/3.1.0`); S1 `trees.json` 3.1.0 = the same sha |
| Claude Code | 2.1.302, the same as both manifests' `claude_version` |
| sandbox root S1 | `/private/tmp/claude-501/e82-700b16eaf4b9d141` (opaque, created and exported before this run) |
| D dry run (on record) | D-d01-h-1 argv names `<S1>/runs/D/D-d01-h-1/work/d01.png` |
| C dry run (on record) | C82-res-gateway-architecture-h-1 argv carries `AOForge runtime: <S1>/runs/C/<id>/home/.claude/aoforge` |
| ledger before | $0 of $20; D $4.5, C $3.5, E $12 |

### Build-2 fit at the gate (before the raise)

| Case | D | C | build 1 | build-2 reserve | total vs cap | E batch |
|---|---:|---:|---:|---:|---|---|
| worst | 4.5 | 3.5 | 6.5 | 8.125 | 22.625 of 20 (over by 2.625) | 13 of 12 (over) |
| expected | 3.8 | 2.6 | 4.72 | 8.125 | 19.245 of 20 (fits, 0.755 spare) | 11.22 of 12 (fits) |

Break-even build-1 cost: 3.875 (D and C at caps), 5.475 (at estimates). Build 2 guaranteed: no.

### After the raise (cap $25, E $15)

| Case | total vs cap | E batch |
|---|---|---|
| worst | 22.625 of 25 (fits, 2.375 spare) | 13 of 15 (fits) |
| expected | 19.245 of 25 (fits, 5.755 spare) | 11.22 of 15 (fits) |

Break-even build-1 cost: 8.5. **Build 2 guaranteed: yes.**
