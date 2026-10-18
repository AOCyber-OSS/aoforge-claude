---
objective: 82-3-1-0-follow-ups
trd: "04"
subsystem: estimation
tags: [tokens, transcripts, also-root, coverage, backfill]
---

# Objective 82 TRD 04: `tokens --also-root` Summary

## Progress
- [ ] Task 1: The index and backfill take alsoRoots (test list 8-9) — next step: RED committed (q82-1, q82-3, q82-4 fail); make `indexExecutorTranscripts` in plugins/aoforge/aoforge/bin/lib/token-usage.cjs take `alsoRoots = []` and pass it to `repoMatcher`, and forward an `alsoRoots` option from `planBackfill` in token-backfill.cjs; run the four Task 1 test files
- [ ] Task 2: tokens-cli --also-root on trd, coverage and backfill; help and reference (test list 1-7, 10)
- [ ] Task 3: Report v1.6 coverage and backfill with and without the former root
