---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "14"
subsystem: testing
tags: [eval, live, batch-a, verifier, haiku, sonnet, ledger]
status: checkpoint
---

# Objective 81 TRD 14: Live batch A (verifier) Summary

**Checkpoint, not complete.** Batch A's first live run stopped the batch with exit 6 (init tools check). The
session ran as the verifier; only the CLI's tool listing differs from the frontmatter. Waiting on the user.

## Progress
- [x] Task 1: Confirm spend for batch A — (this commit)
- [ ] Task 2: Run batch A live — next step: on the user's acceptance, relax `checkTools` in `scripts/eval81/lib/runner.cjs` test-first (alias Agent=Task, Grep/Glob served by Bash, Edit allowed with Write), re-freeze the manifest, re-key `A-A1-haiku-r1` to `@attempt1`, then `run.cjs --batch A ... --batch-dir <scratchpad>/eval81-pilot-batch --reopen --reason <text> --stop-after 3 --raw` for the rest of the pilot
- [ ] Task 3: Score, spot-check and commit batch A

## User gate decisions (2026-10-17, from the dispatch)

1. "go A" as a pilot: exactly 4 live runs, 2 Haiku and 2 Sonnet, on different fixtures, at least one planted fixture
   per model; check first-run isolation, denials and first-turn tokens.
2. Resize the per-batch caps from the pilot's charged cost so A and B complete 36 runs and D 24, global $100 and the
   reserve rule kept, order A, B, D, E, C (C absorbs the shortfall). Record the C decisions: (a) move `R/fleet` and
   `R/d-capture` to a sibling dir before C; (b) C's research dimensions use project-researcher; (c) the mapper
   fabrication check exempts negated claims, test-first in the scorer. Via the amendment procedure.
3. Run the remaining 32 only if A <= $15 and A+B+D+E <= $80 projected.
4. Score A, commit results/A.json, stop. Batch B needs the user's own go.

## Task 1 checks (before any spend)

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 84 files match, sha256 438d80f9... |
| token file | present (`test -s`) |
| dry run A (`--materialize none`) | exit 0: 36 runs, caps $44.2287, reserves $55.285884, base prompt $4.5522, estimate $5, batch cap $7.50, order ok, ledger $0 |

## Pilot selection

The runner has no run-id selection and A's default first four runs (A1 haiku, A1 sonnet, A2 sonnet, A2 haiku) are all
clean fixtures. A shim batch dir outside the checkout
(`/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81-pilot-batch/A.cjs`)
re-exports the frozen `batches/A.cjs` and only moves four ids to the front: `A-A1-haiku-r1` (clean),
`A-A2-sonnet-r1` (clean), `A-A4-haiku-r1` (planted, stub), `A-A5-sonnet-r1` (planted, missing file). Descriptors are
unchanged (dry run through the shim: same caps and reserves).

## First live run: A-A1-haiku-r1 (exit 6)

| Field | Value |
|---|---|
| status | `harness_error` (init tools check) |
| ran as the verifier | yes: roadmap get-objective, verify objective-evidence, CLI and test checks, `planning draft`, `verification post 1`, "## VERIFICATION COMPLETE" |
| verdict | `passed`, published; A1 is clean, so correct |
| cost | reported $0.01111496, transcript $0.011115, charged $0.011115 (cap $0.45975, 2.4% of it) |
| tokens | input 14, cache creation 35,220, cache read 183,206, output 4,475; 13 turns; 24 s wall |
| first_turn_input | 25,030 (the caps assume 36K) |
| isolation | sandbox project present, no real projects entry, none under R's key |
| permission_denials | none; escape_attempt false |
| tripwire | no diff |
| contaminated | false |
| init tools | `Read, Write, Bash, Task, Edit` vs frontmatter `Read, Write, Bash, Grep, Glob, Agent` |

Ledger after: $0.011115, batch A `stopped` (stop_reason: the tools mismatch). The run is in `queue.done`, so a
reopen would not re-run it.
