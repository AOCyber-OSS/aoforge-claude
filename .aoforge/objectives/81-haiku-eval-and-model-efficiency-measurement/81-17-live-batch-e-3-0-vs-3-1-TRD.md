---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "17"
type: standard
wave: 7
depends_on: ["81-16"]
files_modified:
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md
autonomous: false
requirements: [SC-3, SC-4]
must_haves:
  truths:
    - "Before any spend on E, the user saw the token file is present, the ledger total after D, the remaining budget, batch E's plan (10 runs, ~$44, $55 cap, session model and profile) and replied to go"
    - "A pilot pair (the first 3.1.0 and 3.0.0 quick runs) completed headless with transcripts and outcomes before the other 8 runs started"
    - "Batch E ran the fixed workload under both plugin trees in ABBA order under the ledger, tripwire clean"
    - "81-MEASUREMENT.md compares 3.0.0 and 3.1.0 per role and per run (first-turn input tokens, total tokens, cache writes, cost, wall time, tests and verification outcome) beside the static resident bytes per spawn, with n per cell"
  artifacts:
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md
      provides: "the 76-08 measurement report"
  key_links:
    - from: scripts/eval81/score/E.cjs
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md
      via: "score CLI extra_files"
      pattern: "81-MEASUREMENT"
---

# TRD 81-17: Live batch E (3.0.0 vs 3.1.0 on a fixed workload; 76-08)

<objective>
After the user confirms, run the fixed workload (per version: `/aoforge:quick` x3 and a 2-TRD `/aoforge:build` x2)
under the 3.0.0 and 3.1.0 plugins, starting with a pilot pair, then score per role and publish the 76-08 measurement
report.

Purpose: SC-4 (76-08's report) and SC-3's order (fourth: A, B, D, E, C).
Output: `results/E.json`, `results/E.md`, `81-MEASUREMENT.md`.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
- `R` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81`
- `T` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval-auth/oauth-token`
- `O` = `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement`
- Batch E (81-12): 10 runs in order q31-r1, q30-r1, q30-r2, q31-r2, q31-r3, q30-r3, b31-r1, b30-r1, b30-r2, b31-r2;
  session model `SESSION_MODEL` (opus) and `model_profile: balanced` for both versions; caps quick $6, build $15;
  timeouts 30 and 90 minutes. E runs are kind `workflow` (slash-command prompts, no `--agent`).
</codebase_examples>

<anti_patterns>
- Never print or log the token. No tight retry after exit 4. Never start batch C from this TRD. Never modify frozen
  files.
- The runs exercise real AOForge skills in a sandbox: they commit inside the fixture copy only. If the tripwire
  reports any change to this checkout, the fleet or the real ~/.claude, stop everything and report.
</anti_patterns>

<error_recovery>
- Pilot failure modes: a run that hangs on an interactive prompt (timeout), ends without the expected spawns, or
  whose transcripts lack subagent files. Stop after the pilot, show the user the run's stderr tail and the stream's
  last events, and continue only with their go (any fix is a post-hoc deviation, test-first, recorded).
- Exit 3 (budget stop) mid-E: report which runs completed; E's report renders on what exists and marks missing
  cells; the user decides whether C still runs on the remainder.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-12-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-STATIC-PROMPT.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-16-SUMMARY.md
</context>

<gotchas>
- E is the long batch (up to ~4 hours of wall time for the builds). Run each invocation in the background and wait
  for the notification.
- `--stop-after 2` runs the pilot pair (q31-r1, q30-r1) and stops cleanly with them done; the next invocation
  without it continues with the remaining 8.
</gotchas>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm spend for batch E</name>
  <files>(none)</files>
  <action>Approve batch E's spend (the largest batch). Claude has already run the checks below.</action>
  <instructions>
    Claude runs first: `prereg.cjs --check`; `test -s <T>`; `node scripts/eval81/run.cjs --batch E --root <R>
    --token-file <T> --dry-run --materialize none --raw`. Present: token present/missing; ledger $<total> of $100
    and the remaining budget; batch E: 10 runs (per version quick x3 and build x2) on one fixture, session model
    opus with profile balanced for both versions (switching to sonnet would cut cost and change what is measured;
    say so), estimate ~$44, batch cap $55, about 3-4 hours wall time; a pilot pair runs first; C (~$28) runs after E
    on whatever the ledger leaves.
  </instructions>
  <verify>The user's reply (and any session-model change) is recorded in the SUMMARY.</verify>
  <done>The user replied "go E" (optionally "go E sonnet"), or "stop".</done>
  <verification>prereg check passed, token present, ledger and remaining budget shown, A, B, D complete.</verification>
  <resume-signal>Type "go E" to run batch E (up to $55), "go E sonnet" to run it with a Sonnet session model (a recorded deviation), or "stop".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Pilot pair, then the rest of batch E</name>
  <files>(eval root only)</files>
  <action>
If the user chose sonnet, change nothing frozen: prefix both runner commands with `EVAL81_E_SESSION_MODEL=sonnet`
(an env assignment keeps it one plain command; batches/E.cjs reads it, 81-12) and record the choice.
Pilot: `node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --stop-after 2 --raw` in the background.
Check both pilot runs: status ok, transcripts include subagent files, collect outputs show acceptance and tests
results, roles found (planner, executor). If anything is off, follow error_recovery. Otherwise run the same
command without `--stop-after` in the background; handle exit codes as in 81-14.
  </action>
  <verify>`R/ledger.json` batch E `complete` (or stopped by budget, reported); runner exit 0 on the final invocation.</verify>
  <done>All 10 E runs done (or the budget stop recorded), tripwire clean.</done>
  <recovery>A single run timing out does not stop the batch (status timeout, cap charged); report it and keep going.</recovery>
</task>

<task type="auto">
  <name>Task 3: Score E and publish the 76-08 measurement</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md</files>
  <action>
`node scripts/eval81/score.cjs --batch E --root <R> --out <O>` (writes results/E.json, results/E.md and
81-MEASUREMENT.md). Read the report against two runs' raw records by hand (one per version): the per-run cost
equals the record's reported cost, the first-turn input of the planner row equals the first assistant usage in that
transcript. Add a short "Reading" section by hand at the end of 81-MEASUREMENT.md: what moved between versions per
role, what did not, and the outcomes, with no tier recommendation (76-08 is a measurement). Secret scan,
`prereg.cjs --check`, then commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-17): 76-08 measurement, 3.0.0 vs 3.1.0" --files <O>/results/E.json <O>/results/E.md <O>/81-MEASUREMENT.md`.
SUMMARY: ledger total after E, remaining budget for C.
  </action>
  <verify>81-MEASUREMENT.md has the per-role and per-run tables with both versions and the static column; the two hand checks match; secret scan empty.</verify>
  <done>The 76-08 report is committed with n per cell and outcomes.</done>
  <recovery>If a hand check disagrees, fix nothing frozen: record the discrepancy in the Reading section and the SUMMARY.</recovery>
</task>

</tasks>

<verification>
- Ledger: A, B, D, E done; total under $100; remaining budget reported.
- `81-MEASUREMENT.md` covers every SC-4 field.
</verification>

<success_criteria>
The fixed workload ran under both plugin versions after the user's go, and the 76-08 comparison is published per
role and per run with outcomes and the static bytes.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-17-SUMMARY.md`
</output>
