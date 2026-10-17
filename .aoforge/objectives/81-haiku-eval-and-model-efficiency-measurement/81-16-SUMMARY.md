---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "16"
subsystem: testing
tags: [eval, live, batch-d, ui-judge, haiku, sonnet, ledger]
status: checkpoint
---

# Objective 81 TRD 16: Live batch D (UI judge) Summary

## Progress
- [x] Task 1: Confirm spend for batch D — (this commit)
- [ ] Task 2: Run batch D live — next step: run the 2-run pilot with `node scripts/eval81/run.cjs --batch D --root <R> --token-file <T> --stop-after 2 --raw` in the background (the first two planned runs are D-home-haiku-r1 and D-home-sonnet-r1, so no shim is needed), then project the full 24 against D's $5 cap
- [ ] Task 3: Score, spot-check and commit batch D

## User gate decision (2026-10-17)

"go D": first a 2-run pilot (1 Haiku, 1 Sonnet) and a check of the measured cost against D's $5 cap. If the full 24
would project above $5, resize D's cap by the post-hoc amendment procedure, as long as the projected A+B+D+E stays
<= $80. Then run the rest, score, commit results/D.json.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 84 files, e5cb3963... |
| token file | present (`test -s` only) |
| dry run D | exit 0: 24 sessions, caps $10.27656, reserves $12.8457, estimate $2, batch cap $5, order ok, ledger $3.823453 |
| A headline | haiku and sonnet both 9/9 detection, 0/9 false passes |
| B headline | detection haiku 9/12, sonnet 11/12; false alarms 0/6 each; haiku missed_as_pass 2/12 |
| per-run caps | haiku $0.25558, sonnet $0.6008 (fallback p90 judge 0.5); a sonnet session can start while D's spend is <= $4.3992 |
