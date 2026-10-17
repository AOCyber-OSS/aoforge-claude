---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "18"
subsystem: testing
tags: [eval, live, batch-c, codebase-mapper, project-researcher, grader]
status: checkpoint
---

# Objective 81 TRD 18: Live batch C (mapper and researcher) Summary

## Progress
- [x] Task 1: Confirm spend for batch C — 759016dd
- [ ] Task 2: Run batch C live (agents, then graders) — STOPPED for the user after 12 of 48 agent runs (this commit). Batch C is `running`, with 36 agent runs pending and no grader run yet. next step: on the user's word, resume with `node scratchpad/81-17-scripts/c-driver.cjs <R> <T> /private/tmp/claude-501/e81-5752f4931a905580 4 scratchpad/c-driver.log` (background), which calls the frozen runner with `--sandbox-root` and `--stop-after 4` and scans each chunk
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

## Task 2 so far: 12 of 48 agent runs, then a stop for the user

- **How it ran.** The driver `scratchpad/81-17-scripts/c-driver.cjs` calls the frozen runner in chunks of
  `--stop-after 4` with `--sandbox-root S`, then scans each chunk with `escape-scan.cjs`. It checks escape_attempt,
  the tools check, isolation, and any tool input whose path, URL or Bash command (heredoc bodies removed) names
  `/Users/<name>`.
- **First version of the scan.** It also matched documents that QUOTE the fleet's `go.mod` path while writing into
  the sandbox. That is data, not an access, so the scan was narrowed and the driver resumed.
- **What ran.** C-map tech, arch and quality, both codebases, both models: 12 runs, all ok, every one with its
  documents (location drafts, none missing).
  - The runner flagged no escape attempt and no tools mismatch, and isolation was clean on all 12.
  - Batch C has spent $0.957525, and the ledger stands at $33.585763.
- **Why it stopped.** Three fleet (`b`) runs touched paths outside the sandbox:

| Run | What | Result |
|---|---|---|
| C-map-arch-b-s-1 (sonnet) | Bash `cd ~/.claude/aoforge/templates/codebase/ && cat ...` | **permission DENIED.** The CLI applied the real-home `Read(//<real home>/.claude/**)` deny rule to a Bash `~` path, though bash would have resolved `~` to the sandbox HOME. `escape_attempt` stays false because the input has no absolute path. It also tried Read `/Users/../.claude/...`, which does not exist |
| C-map-quality-b-s-1 (sonnet) | the same Bash `cd ~/.claude/...` | **permission DENIED** (same cause); it also tried Read `/Users/.claude/aoforge/templates/codebase/conventions.md`, which does not exist |
| C-map-quality-b-h-1 (haiku) | Read `/Users/unknown/.claude/aoforge/templates/codebase/*.md` ×3; Bash `ls /Users/unknown` | a guessed home that does not exist; not denied |

- **Readings.**
  - Nothing real was read, the real home was never reached, and the documents were still produced.
  - The fleet copy's own files (go.mod, Makefile, CI) name `/Users/<real user>/dev/...`. Fleet runs read those
    names, which undoes post-hoc 3's opaque cwd for this codebase.
  - The CLI's permission layer resolves `~` in Bash commands to the real home, so every mapper that reads its
    templates through `cd ~/.claude/...` gets denied by the deny list. The agent asked for its own sandbox file.
- **The stop.** The user's rule is "any further escape attempt ... stop and report". Two permission denials of a
  `.claude` path under the real-home deny rule meet that literally. Nothing more was spawned.
