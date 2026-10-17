---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "18"
subsystem: testing
tags: [eval, live, batch-c, codebase-mapper, project-researcher, grader]
status: checkpoint
---

# Objective 81 TRD 18: Live batch C (mapper and researcher) Summary

## Progress
- [x] Task 1: Confirm spend for batch C — (this commit)
- [ ] Task 2: Run batch C live (agents, then graders) — next step: run the agent runs in chunks with `node scripts/eval81/run.cjs --batch C --root <R> --token-file <T> --sandbox-root /private/tmp/claude-501/e81-5752f4931a905580 --stop-after 4 --raw` (background), scanning each chunk with `scratchpad/81-17-scripts/escape-scan.cjs <R>/runs/C`, then the same command without `--stop-after` for the graders
- [ ] Task 3: Score, spot-check and commit batch C

## User gate decision (2026-10-17)

"Go E rest and C": run 81-18 batch C (mapper, project-researcher and graders on the remaining budget, using the moved
private fleet data location), score, commit results/C.json, and stop before 81-19. C's human-action gate is
satisfied by this decision. Stop conditions: any further escape attempt, isolation breach, init-tools mismatch beyond
the relaxed rule, or projection breach of the global $100. Delete `/private/tmp/claude-501/e81-*` at the very end
of C.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 85 files, 8080f63b... |
| token file | present (`test -s` only) |
| private data out of R | `R/fleet` and `R/d-capture` absent (both are in `scratchpad/eval81-private-backup/`) |
| dry run C (`--sandbox-root S --materialize none`) | exit 0: 48 agent runs (fleet included, so the private checklist hash verified), caps $74.1976, reserves $92.747, estimate $28, order ok, ledger $32.628238, every run fits now |
| remaining budget | $67.371762 under the global $100 |

## Known risk before C (fixture content, not harness paths)

- **The fleet copy names real paths.** Its `go.mod`, `Makefile`, `Dockerfile`, CI workflow and code comments contain
  absolute `/Users/<user>/dev/...` paths to sibling repositories, including a `replace` directive.
- **What happens if a mapper follows one.**
  - With the Read tool, the deny list refuses it, `escape_attempt` is true, and C stops (user rule).
  - With Bash, the read is not path-scoped and is not flagged. `escape-scan.cjs` lists every tool input naming a
    `/Users/<name>` path after each chunk.
- **Not visible:** the Go toolchain following the `replace` on its own (for example `go build`). Its command text
  names no path.
