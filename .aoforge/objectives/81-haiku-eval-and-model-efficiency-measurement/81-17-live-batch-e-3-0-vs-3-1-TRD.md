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
    - "Before any spend on E, the user saw the token file is present, the ledger total after D, the remaining budget, batch E's plan (10 runs, ~$44, $55 cap, session model and profile, pilot structure) and replied to go"
    - "Two pilot pairs ran first: the quick pair (q31-r1, q30-r1), then the build pair (b31-r1, b30-r1), each with transcripts including subagent files and outcomes"
    - "The pilot established whether the CLI's reported cost includes subagent spend (reported vs transcript-priced main + subagents per pilot run) and what the build overshoot over its cap was; the ledger charged the larger figure either way, and the finding is recorded in results/E.json notes and the SUMMARY"
    - "After the build pilot the runs stopped and the user saw the pilot outcomes, cost findings, the reserve the remaining builds will need and the projected E and C spend, and replied to continue before the other 6 runs started"
    - "Batch E ran the fixed workload under both plugin trees in the pilot-first, ABBA-within-workflow order under the ledger, tripwire and every isolation check clean"
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
under the 3.0.0 and 3.1.0 plugins, starting with a quick pilot pair and a build pilot pair, stop for the user after
the build pilot, then run the rest, score per role and publish the 76-08 measurement report.

Revision (job-checker, 2026-10-17): E is the subagent-heavy batch, so it is where the unknowns of the spend rule
bite: whether `total_cost_usd` includes subagent spend, and whether `--max-budget-usd` caps it. The build pilot
answers both before most of E's money is spent (blocker), and the user decides on the remaining runs (W4).

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
- Batch E (81-12): 10 runs in order q31-r1, q30-r1, b31-r1, b30-r1, q30-r2, q31-r2, q31-r3, q30-r3, b30-r2, b31-r2
  (pilot pairs first; ABBA within each workflow); roles `workflow:quick` / `workflow:build`; session model
  `SESSION_MODEL` (opus) and `model_profile: balanced` for both versions; caps quick $6, build $15 (each including
  the base-prompt allowance); timeouts 30 and 90 minutes. E runs are kind `workflow` (slash-command prompts, no
  `--agent`).
- Runner exit codes, the commit scan command, the spend rules and the lost-root recovery as in TRD 81-14
  (`--charge-lost E=55` if E had started uncommitted, unless the user gives a usage figure).
- Cost fields per run record (81-01): `cost_usd` (the CLI's reported total), `transcript_cost_usd` (main session plus
  every `subagents/agent-*.jsonl`, priced from model-rates.json), `charged_usd` = the larger, `cost_source`,
  `cap_usd`, `reserve_usd`, `overshoot_usd`. `transcriptCost` also returns `main_usd` and `subagent_usd`; re-run it
  on a run's `transcripts/` with a node one-liner for the pilot table.
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
- The build pilot shows the reported cost leaves out subagent spend (transcript cost clearly above reported, the
  gap close to `subagent_usd`): the ledger already charged the transcript figure (`cost_source: transcript_sum`), so
  no code change is needed; record it, and expect `--max-budget-usd` not to bound subagent spend. The reserve for
  the remaining builds is then cap + the observed build overshoot; show the user what that leaves for C.
- A pilot run's transcript cost is far BELOW its reported cost (more than 10%): pricing gap (cache tier or a side
  model); the ledger charged the reported figure, which is correct; record it.
- Exit 3 (budget stop) mid-E: report which runs completed; E's report renders on what exists and marks missing
  cells; the user decides whether C still runs on the remainder (if so, `--close-batch E --reason "budget stop"`
  first, so C's order check passes).
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
- `--stop-after 2` runs the next two pending runs and stops cleanly with them done: the first invocation runs the
  quick pilot (q31-r1, q30-r1), the second the build pilot (b31-r1, b30-r1); the invocation after the user's
  continue runs the remaining 6 without `--stop-after`.
- The build pilot's first run has no observed build overshoot, so it reserves $15 x 1.25 = $18.75 plus whatever the
  ledger already holds; with A, B and D near $11 there is room even for a large overshoot, which is why the build
  pilot runs before the other builds rather than after them.
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
    say so), estimate ~$44, batch cap $55, about 3-4 hours wall time; a quick pilot pair, then a build pilot pair,
    after which the runs stop and the user is asked again before the other 6; C (~$28) runs after E on whatever the
    ledger leaves. Name the open question the build pilot answers: whether the reported cost and the per-run cap
    cover subagent spend (the ledger charges the larger of reported and transcript cost regardless).
  </instructions>
  <verify>The user's reply (and any session-model change) is recorded in the SUMMARY.</verify>
  <done>The user replied "go E" (optionally "go E sonnet"), or "stop".</done>
  <verification>prereg check passed, token present, ledger and remaining budget shown, A, B, D complete.</verification>
  <resume-signal>Type "go E" to run batch E (up to $55), "go E sonnet" to run it with a Sonnet session model (a recorded deviation), or "stop".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Quick pilot pair, then build pilot pair</name>
  <files>(eval root only)</files>
  <action>
If the user chose sonnet, change nothing frozen: prefix every runner command in this TRD with
`EVAL81_E_SESSION_MODEL=sonnet` (an env assignment keeps it one plain command; batches/E.cjs reads it, 81-12) and
record the choice.
Quick pilot: `node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --stop-after 2 --raw` in the
background. Check both runs: status ok, isolation clean, transcripts include subagent files, collect outputs show
acceptance and tests results, roles found (planner, executor). If anything is off, follow error_recovery and stop.
Build pilot: the same command again (the next two pending ids are b31-r1, b30-r1). Check the same items plus roles
planner, job-checker, executor, verifier, and the build's TRD count.
Cost check for all four pilot runs (blocker): from each record take `cost_usd`, `transcript_cost_usd`,
`charged_usd`, `cost_source`, `cap_usd`, `overshoot_usd`, and from `transcriptCost(<run>/transcripts)` the
`main_usd` and `subagent_usd`. Verdict per run: reported includes subagents if `cost_usd` >= 0.95 x
`transcript_cost_usd`; excludes them if `cost_usd` is within 10% of `main_usd` while `subagent_usd` > 0. Confirm the
ledger charged `max(cost_usd, transcript_cost_usd)` for each. Write the table and the verdict to
`R/pilot/E-cost.md` (scratch; it feeds Task 4's notes).
  </action>
  <verify>Ledger shows four E entries (q31-r1, q30-r1, b31-r1, b30-r1), each charged the larger of its two costs; `R/pilot/E-cost.md` holds the per-run table and the verdict; runner exit 0 on both invocations.</verify>
  <done>Both pilot pairs done and checked; whether reported cost includes subagent spend is answered from evidence; nothing else in E has run.</done>
  <recovery>A pilot run timing out: status timeout, charged its transcript cost (else its reserve); stop after the pilot and show the user the stderr tail and the stream's last events.</recovery>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Review the pilots before the remaining 6 E runs</name>
  <files>(none)</files>
  <action>Claude has run both pilot pairs and their checks; the user decides whether the remaining six E runs spend.</action>
  <what-built>Two pilot pairs (quick and build, 3.1.0 and 3.0.0 each) with outcomes and the cost check.</what-built>
  <how-to-verify>
    Claude runs `node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --dry-run --materialize none --raw`
    and presents:
    - Per pilot run: status, acceptance and tests result, roles seen, TRD count (builds), wall time.
    - Cost table from `R/pilot/E-cost.md`: reported vs transcript (main, subagents), charged, cap, overshoot, and the
      verdict on whether the reported cost includes subagent spend.
    - Reserve each remaining quick and build run will need (cap + observed overshoot for its role, or cap x 1.25),
      the projected spend of the remaining 6, the ledger total, and what that leaves for C against its ~$28.
  </how-to-verify>
  <verify>The user's reply is recorded in the SUMMARY.</verify>
  <done>The user replied "go E rest", "stop E" (E keeps its 4 runs; the report renders on them and marks missing cells), or asked for a change (a recorded deviation).</done>
  <resume-signal>Type "go E rest" to run the remaining 6 E runs, or "stop E" to score E on the pilots only and keep the budget for C.</resume-signal>
</task>

<task type="auto">
  <name>Task 4: The remaining E runs, then score and publish the 76-08 measurement</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md</files>
  <action>
On "go E rest": `node scripts/eval81/run.cjs --batch E --root <R> --token-file <T> --raw` in the background; handle
exit codes as in 81-14. On "stop E": `node scripts/eval81/run.cjs --close-batch E --root <R> --reason "user stopped
after the pilots" --raw` (marks E `stopped`, spawns nothing, so C's order check passes), then score; the scorer marks
the missing cells.
Then `node scripts/eval81/score.cjs --batch E --root <R> --out <O>` (writes results/E.json, results/E.md and
81-MEASUREMENT.md). Add the pilot cost verdict from `R/pilot/E-cost.md` to `results/E.json` `notes` and to
81-MEASUREMENT.md (numbers only). Read the report against two runs' raw records by hand (one per version): the
per-run cost equals the record's reported cost, the first-turn input of the planner row equals the first assistant
usage in that transcript. Add a short "Reading" section by hand at the end of 81-MEASUREMENT.md: what moved between
versions per role, what did not, and the outcomes, with no tier recommendation (76-08 is a measurement). Check
`results/E.json` `spend.spent_usd` equals batch E's `spent_usd` in `R/ledger.json`. Commit scan over the three files,
`prereg.cjs --check`, then commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-17): 76-08 measurement, 3.0.0 vs 3.1.0" --files <O>/results/E.json <O>/results/E.md <O>/81-MEASUREMENT.md`.
SUMMARY: ledger total after E, remaining budget for C, the pilot cost verdict.
  </action>
  <verify>81-MEASUREMENT.md has the per-role and per-run tables with both versions and the static column; the two hand checks match; results/E.json carries the spend block and the pilot cost verdict; commit scan empty.</verify>
  <done>The 76-08 report is committed with n per cell, outcomes and the cost finding.</done>
  <recovery>A single run timing out does not stop the batch (status timeout, charged its transcript cost or reserve); report it and keep going. If a hand check disagrees, fix nothing frozen: record the discrepancy in the Reading section and the SUMMARY.</recovery>
</task>

</tasks>

<verification>
- Ledger: A, B, D, E done (E `complete`, or `stopped` by the user or the budget); total under $100; remaining budget
  reported.
- `81-MEASUREMENT.md` covers every SC-4 field and states whether the CLI's reported cost includes subagent spend.
- The ledger's E entries were each charged max(reported, transcript cost); the four pilot runs precede every other E
  run in the ledger.
</verification>

<success_criteria>
The fixed workload ran under both plugin versions after the user's go, the build pilot answered the subagent-cost
question before the remaining runs and the user approved them, and the 76-08 comparison is published per role and
per run with outcomes and the static bytes.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-17-SUMMARY.md`
</output>
