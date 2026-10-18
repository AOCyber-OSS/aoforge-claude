---
objective: 82-3-1-0-follow-ups
trd: "08"
subsystem: testing
tags: [eval82, live, batch-d, batch-c, ui-evaluator, project-researcher, escalation, ledger]
status: checkpoint
---

# Objective 82 TRD 08: Live tier checks D and C Summary

## Progress
- [x] Task 1: Confirm spend for batches D and C — c2c99c2c
- [x] Task 2: Run batch D (start, then escalations) and batch C (researchers, then graders) — (this commit)
- [ ] Task 3: Score, apply the pre-registered verdicts, revert what fails, publish 82-TIER-CHECKS.md — next step: `node scripts/eval82/score.cjs --batch D --root <R> --out <O>`, then `--batch C`, then `--rules`; apply each verdict (P1 REVERT test-first in flutter-ui-eval.test.cjs if the rules say so)

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

## Task 2: batches D and C live

Runner: `EVAL82_SANDBOX_ROOT=<S1> node scripts/eval81/run.cjs --batch <D|C> --root <R> --token-file <T>
--batch-dir scripts/eval82/batches --results-dir <O>/results --sandbox-root <S1> --repo <checkout> --raw`, from the
repo root, one invocation at a time (11:07:26Z to 11:43:00Z). The checkout was not touched while a runner ran.

| Invocation | Exit | Runs | Status | Spent | Ledger total | Tripwire | real / non-escape | Isolation |
|---|---|---|---|---:|---:|---|---|---|
| D start | 0 | 120 | 120 ok | $1.223450 | $1.223450 | no diffs | 0 / 0 | 120 sandbox project, 0 real |
| D escalations | 0 | 3 (D-d02-esc-1..3) | 3 ok | +$0.056122 | $1.279572 | no diffs | 0 / 0 | clean |
| D again | 0 | 0 | nothing pending; D complete | - | $1.279572 | - | - | - |
| C researchers | 0 | 16 | 16 ok, tools check ok, 0 impaired, 16 documents | $1.603117 | $2.882689 | no diffs | 0 / 0 | clean |
| C graders | 0 | 16 | 16 ok | +$1.155040 | $4.037729 | no diffs | 0 / 0 | clean |
| C again | 0 | 0 | nothing pending; C complete | - | $4.037729 | - | - | - |

- **Escalations:** the engine's rules escalated one state (d02: haiku 2 ok / 1 broken, review). The TRD expected
  about 6-8 states from 81's 40% split rate; batch D's per-state haiku sessions split on 2 of 20 states (d02, d08)
  and the engine escalated only d02 (d08's haiku outcome was pass).
- **Screenshot path:** all 120 live D prompts (`argv.json`) name `<S1>/runs/D/<id>/work/<state>.png`; D-d01-h-1's
  transcript Reads exactly that path. No `screenshot_path: relative`.
- **C runtime line:** every researcher prompt carries `AOForge runtime: <S1>/runs/C/<id>/home/.claude/aoforge`; the
  hand-checked researcher (C82-res-hub-architecture-h-1) read `references/research-tooling.md` and
  `templates/research-project/ARCHITECTURE.md` under that root.
- **Ledger after D and C:** $4.037729 of $25 (D $1.279572 of $4.5, C $2.758157 of $3.5). E has $15 batch cap and
  $20.962271 of global room.

### Guessed-path scan (`guessed-paths.cjs --root <R> --batch <X> --raw`), after each invocation

| Scan | Runs | Scanned (files > 0 and tool uses > 0) | tilde | guessed_home | real | guessed_nonexistent | tilde_denied |
|---|---:|---:|---:|---:|---:|---:|---:|
| D after start | 120 | 120 | 0 | 0 | 0 | 0 | 0 |
| D after escalations | 123 | 123 | 0 | 0 | 0 | 0 | 0 |
| C after researchers (researcher rows) | 16 | 16 | 0 | 0 | 0 | 0 | 0 |
| C after graders (all rows) | 32 | 32 | 0 | 0 | 0 | 0 | 0 |

Hand check: `grep -c '"file_path":"~'` and `grep -c '"file_path":"/Users/'` over C82-res-hub-architecture-h-1's
transcripts both print 0, the scan's count.
