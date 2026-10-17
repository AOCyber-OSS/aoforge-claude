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
- [x] Task 2: Run batch C live (agents, then graders) — 12 runs before the stop (611b2c17), post-hoc 4 (2258d733), the rest (this commit)
- [ ] Task 3: Score, spot-check and commit batch C — next step: commit results/C.json, C.md and C-spotcheck.md (already scored, leak-checked, scanned and prereg-checked) with `aof-tools commit "docs(81-18): batch C mapper and researcher results"`, then delete /private/tmp/claude-501/e81-*

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

## User decision after the stop (2026-10-17): "Reclassify + re-run impaired"

- **(a)** A `~`-expansion denial and an access to a guessed path that does not exist are non-escapes, recorded by class
  with the username redacted.
- **(b)** A real escape (an existing real path outside the sandbox, allowed or denied, not via `~`) still stops C.
- **(c)** A run where a denial blocked its own templates or references is `impaired` and re-run once. If it is still
  impaired, it is excluded from the model rates and reported apart.
- Then finish C within $100, score and commit, delete `e81-*`, and stop before 81-19.

## Post-hoc 4 (81-PREREG section 9.4)

- **New code:** `lib/access.cjs`, and the runner's `record.access` with the re-run once on impairment, plus
  `score/C.cjs` impaired handling. All of it was written test-first: RED 6 failures, GREEN, full suite 510/510.
- **New manifest:** 70f92eca..., 86 files.
- **Reclassification of the first 12 runs:**
  - real escapes: 0;
  - non-escapes: 3 runs;
  - impaired: C-map-arch-b-s-1 and C-map-quality-b-s-1, which are re-run once.

## Task 2, finished after post-hoc 4

- **Reclassification applied.** C-map-arch-b-s-1 and C-map-quality-b-s-1 were re-keyed to `<id>@impaired1` with their
  charges kept, then re-run once:
  - C-map-arch-b-s-1 attempt 2 was clean;
  - C-map-quality-b-s-1 attempt 2 was denied `cd ~/.claude/...` again, so it is final and impaired.
- **The driver** (`c-driver.cjs`, `--sandbox-root S`, `--stop-after 4`) ran 23 chunks: the remaining 36 agent runs, the 2 re-runs
  and 46 graders. Every runner exit was 0. Batch C is `complete`, having spent .424253 over 96 ledger entries
  (48 agent runs, 46 graders, 2 `@impaired1`). The ledger stands at .052491.
- **Access classes over every final C record:**
  - real escapes: 0;
  - tilde denials: 1 (quality-b-s-1);
  - accesses to guessed homes that do not exist: 13, all made-up names (`/Users/.claude`, `/Users/x`, `/Users/aoforge`,
    `/Users/placeholder`, `/Users/lukas`, `/Users/..`), never the real one.
  - Tools check ok on every agent run, isolation clean, tripwire clean.
- **No grader** for the two sonnet stack researcher runs: they are `model_ran false`, because about 18% of their
  output went to haiku as a side model.
