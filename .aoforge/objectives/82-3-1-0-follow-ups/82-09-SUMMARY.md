---
objective: 82-3-1-0-follow-ups
trd: "09"
subsystem: testing
tags: [eval82, live, batch-e, build-cell, planner, executor, guessed-paths]
status: checkpoint
---

# Objective 82 TRD 09: Live build-cell re-run Summary

## Progress
- [x] Task 1: Confirm spend for batch E — ac242e6d
- [x] Task 2: Run batch E — (this commit)
- [ ] Task 3: Score, mechanism checks, guessed-path check, publish 82-MEASUREMENT.md — next step: `node scripts/eval82/score.cjs --batch E --root <R> --out <O>`, then `node <SP>/82-09/mech.cjs <R> <SP>/82-09/E-scan.json <SP>/82-09/mech.json` and fill `## Mechanism checks` in a `planning draft` of 82-MEASUREMENT.md

## User gate decision (2026-10-18)

From the dispatch, before any spend: **"Go D, C, E at cap $25"**. The approval covers this gate. E runs the two
3.1.0 builds only (no 3.0.0 control). The caps were raised at 82-08's gate (global $25, E $15), so no second raise.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` (objective 82) | exit 0: OK, 25 files, 817bc181... |
| `prereg.cjs --check` (objective 81) | exit 0: OK, 86 files, 70f92eca... |
| token file | present (`test -s` only) |
| tree under test | HEAD e29fa16f04b089fc04b593436295ce4950ab3382 (82-07's FIX rows P-1, P-2, P-3, P-4, E-1, E-2, E-5, X-1; 82-02/82-11's E-4; 82-08's P1 and P4 reverts) |
| exported tree | `planner.md` carries P-1's "no template file to look up", `executor.md` E-5's "never Write the whole SUMMARY twice", `model-profiles.json` the P4 revert |
| Claude Code | 2.1.302, the same as both manifests |
| S2 | `/private/tmp/claude-501/e82-b36bc77c513b45df` (new opaque root; `trees.json` 3.1.0 = HEAD) |
| E dry run | exit 0: b82-r1, b82-r2; model opus, plugin 3.1.0, role workflow:build, cap $6.5, reserve $8.125 each, 90-min timeout, would_fit true; caps $13, worst case $16.25, estimate $9.4; every argv path under S2 |
| ledger | $4.037729 of $25 ($20.962271 left); D $1.279572 and C $2.758157 complete; E $0 of $15 |

### Build-2 fit on the actual D and C spend

| Case | D | C | build 1 | build-2 reserve | total vs cap | E batch |
|---|---:|---:|---:|---:|---|---|
| worst | 1.279572 | 2.758157 | 6.5 | 8.125 | 18.662729 of 25 (fits, 6.337271 spare) | 13 of 15 (fits) |
| expected | 1.279572 | 2.758157 | 4.72 | 8.125 | 16.882729 of 25 (fits, 8.117271 spare) | 11.22 of 15 (fits) |

Break-even build-1 cost: 8.5. **Build 2 guaranteed: yes.**

## Task 2: batch E live

`node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --batch-dir scripts/eval82/batches --results-dir
<O>/results --sandbox-root <S2> --repo <checkout> --raw` (no control), one invocation, exit 0, tripwire no diffs,
batch E `complete`, nothing pending.

| Run | Status | Reported | Transcript | Charged | Cap | Overshoot | Wall | TRDs / SUMMARYs | Acceptance | Tests | Verification | Transcripts | real / non-escape | Isolation |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---:|---|---|
| b82-r1 | ok | $3.389853 | $3.112273 | $3.389853 | $6.5 | 0 | 595 s | 1 / 1 | pass | ok | passed | 6 | 0 / 0 | sandbox project, no real entry |
| b82-r2 | ok | $4.047350 | $4.038930 | $4.047350 | $6.5 | 0 | 818 s | 2 / 2 | pass | ok | passed | 8 | 0 / 0 | sandbox project, no real entry |

- **Ledger:** E $7.437203 of $15; total **$11.474932 of $25**.
- **Denials inside the sandbox (b82-r2, 2, not escapes):** a Bash call running the notekit CLI against a
  `mktemp -d` scratch file, and a raw `git add ... && git commit` (with an attribution trailer) from the backstop
  verifier, refused by AOForge's `gate-commits` (its message is in the transcript). `escape_paths` and
  `denied_inside` are empty, `escape_attempt` false.

### Guessed-path scan (`guessed-paths.cjs --root <R> --batch E --raw`)

| Run | Files | Tool uses | tilde | guessed_home | real | guessed_nonexistent | tilde_denied |
|---|---:|---:|---:|---:|---:|---:|---:|
| b82-r1 | 6 | 122 | 0 | 0 | 0 | 0 | 0 |
| b82-r2 | 8 | 184 | 0 | 0 | 0 | 0 | 0 |

Baseline, the same scan over objective 81's recorded build runs (`--root <SP>/eval81 --batch E`): b30-r1 0, b30-r2 1
(`/Users/../private/tmp/.../b30-r2/home/.claude/aoforge/templates/summary.md`), b31-r1 1 (`<home>/.claude/aoforge/references/tdd.md`,
denied), b31-r2 1 (`/Users/<guess>/.claude/aoforge/references/tdd.md`); `tilde` 0 in all four.
