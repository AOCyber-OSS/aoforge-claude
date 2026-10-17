---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "16"
subsystem: testing
tags: [eval, live, batch-d, ui-judge, haiku, sonnet, ledger]
status: checkpoint
---

# Objective 81 TRD 16: Live batch D (UI judge) Summary

## Progress
- [x] Task 1: Confirm spend for batch D — 756daad2
- [x] Task 2: Run batch D live — (this commit)
- [ ] Task 3: Score, spot-check and commit batch D — next step: commit results/D.json, D.md and D-spotcheck.md (already scored, scanned and prereg-checked) with `aof-tools commit "docs(81-16): batch D UI judge results"`

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

## Pilot (2 runs, `--stop-after 2`)

The first two planned runs are one haiku and one sonnet session on the same surface, so no reorder shim was needed.

| Run | Model | Status | Reported | Transcript | Charged | First turn | Turns | Wall | Init tools | Isolation / denials | Results from |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D-home-haiku-r1 | haiku | ok | $0.0042882 | $0.004288 | $0.004288 | 6,882 | 7 | 14.7 s | Read, StructuredOutput | clean / 0 | structured output, 5 states |
| D-home-sonnet-r1 | sonnet | ok | $0.067499 | $0.067499 | $0.067499 | 6,112 | 7 | 10.0 s | Read, StructuredOutput | clean / 0 | structured output, 5 states |

- `StructuredOutput` is the CLI's `--json-schema` tool. D runs are kind `prompt`, so the tools check does not apply.
- **Projection for the full 24 at pilot cost:** 12 x $0.004288 + 12 x $0.067499 = $0.86. That is well under D's $5
  cap. Even at 3x the pilot ($2.58), every sonnet session starts below the $4.3992 threshold. **No resize is needed.**
- **Projected A+B+D+E:** $2.691417 + $1.132036 + $0.86 + $44 (E estimate) = $48.69. The rule is <= $80.
- The remaining 22 ran with the same command, without `--stop-after`.

## Task 2: batch D live

- Pilot `--stop-after 2`: exit 0. Rest: exit 0, 22 run, 0 pending, `tripwire.diffs` [].
- Batch D spent $0.736393 (cap $5); ledger total $4.559846.
- Wall: 19:15:01Z to 19:19:47Z. Summed run wall: haiku 142 s, sonnet 118 s.
- Results source: structured output 24, fenced block 0, none 0. Every session returned 5 states.
- Init tools on every session: `Read, StructuredOutput`. No plugin.
- Isolation clean on 24/24; 0 permission denials; 0 escape attempts; 0 contaminated; largest overshoot $0.
- Transcript cost above reported only by rounding (at most 5.0e-7).
