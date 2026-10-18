---
objective: 82-3-1-0-follow-ups
trd: "04"
subsystem: estimation
tags: [tokens, transcripts, also-root, coverage, backfill]
---

# Objective 82 TRD 04: `tokens --also-root` Summary

## Progress
- [x] Task 1: The index and backfill take alsoRoots (test list 8-9) — RED 5f697e77, GREEN 4b773418
- [ ] Task 2: tokens-cli --also-root on trd, coverage and backfill; help and reference (test list 1-7, 10) — next step: RED committed (82-04 1-6 and 10 fail, 7 passes); in plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs parse a repeatable `--also-root` for trd/coverage/backfill (stamp refuses it), resolve against cwd, drop the repo, refuse a root containing it, pass alsoRoots to every index, add `also_roots` and the ` · also roots` headline suffix only when non-empty; then help.cjs, aof-tools.cjs comments and docs/AOF-TOOLS-REFERENCE.md
- [ ] Task 3: Report v1.6 coverage and backfill with and without the former root
