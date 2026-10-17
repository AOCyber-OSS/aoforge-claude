---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "15"
type: standard
wave: 5
depends_on: ["81-14"]
files_modified:
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.json
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B-spotcheck.md
autonomous: false
requirements: [SC-3]
must_haves:
  truths:
    - "Before any spend on B, the user saw the token file is present, the ledger total after A, batch A's headline and batch B's plan (36 runs, ~$4, $6 cap), and replied to go"
    - "Batch B ran live (36 job-checker runs) under the ledger with the tripwire clean, after batch A was complete"
    - "results/B.json and results/B.md report per model detection, false alarm, missed-as-pass and unrelated blockers with n, split into defects the pre-check flags and judgment-only defects; a hand spot-check of 6 returns is recorded"
    - "No committed file contains the token and prereg --check passes"
  artifacts:
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.json
      provides: "batch B scored results"
  key_links:
    - from: scripts/eval81/score/B.cjs
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.json
      via: "score CLI"
      pattern: "job-checker"
---

# TRD 81-15: Live batch B (job-checker, Haiku vs Sonnet)

<objective>
After the user confirms, run test B's 36 job-checker runs headless under the ledger, score them against the
committed answer key, spot-check, and commit the scored results.

Purpose: SC-3 for the job-checker (second in the order A, B, D, E, C).
Output: `results/B.json`, `results/B.md`, `results/B-spotcheck.md`.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Paths `R`, `T`, `O` and runner exit codes exactly as in TRD 81-14 (`scripts/eval81/README.md`).
- `R` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81`
- `T` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval-auth/oauth-token`
- `O` = `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement`
</codebase_examples>

<anti_patterns>
- Never print or log the token; presence is `test -s <T>`.
- No tight retry after exit 4; wait for `resume_after`, then run the same command once.
- Never start batch D from this TRD; never modify a frozen file.
</anti_patterns>

<error_recovery>
- Exit 5: stop, report the tripwire diff to the user, do not score or commit.
- Exit 6 on the first run: as in 81-14 (the job-checker declares Read, Bash, Glob, Grep).
- A checker return with neither heading: the scorer marks it `none` (abstain); include those run ids in the SUMMARY.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md (B metrics)
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-14-SUMMARY.md
@scripts/eval81/fixtures/B/answer-key.json (precheck_flags per set; the scorer reads it, the runs never see it)
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm spend for batch B</name>
  <files>(none)</files>
  <action>Approve batch B's spend. Claude has already run the checks below.</action>
  <instructions>
    Claude runs first: `prereg.cjs --check` (exit 0); `test -s <T>`; `node scripts/eval81/run.cjs --batch B --root <R>
    --token-file <T> --dry-run --materialize none --raw` (ledger total, 36 runs, caps, estimate ~$4, cap $6, order
    status showing A complete). Present: token present/missing; ledger $<total> of $100; batch A headline from
    results/A.md (per model false passes and detection, k/n); batch B plan. If A shows a Haiku false pass, say that
    the pre-registered rule already refuses Haiku for every role; B, D, E and C still run for the record unless the
    user stops.
  </instructions>
  <verify>The user's reply is recorded in the SUMMARY.</verify>
  <done>The user replied "go B" or "stop".</done>
  <verification>prereg check passed, token present, ledger total shown, A complete.</verification>
  <resume-signal>Type "go B" to run batch B (up to $6), or "stop".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Run batch B live</name>
  <files>(eval root only)</files>
  <action>
`node scripts/eval81/run.cjs --batch B --root <R> --token-file <T> --raw` with `run_in_background`; handle exit
codes as in 81-14 (0 continue; 4 wait for resume_after then run once more; 3/5/6 stop and report). Record ledger
total, batch spent, ok/excluded counts and wall time.
  </action>
  <verify>`R/ledger.json` batch B `complete`; runner exit 0.</verify>
  <done>Batch B complete within its cap, tripwire clean.</done>
  <recovery>On an unexplained partial stop, leave the ledger, report the queue file and last stderr, and wait for the user.</recovery>
</task>

<task type="auto">
  <name>Task 3: Score, spot-check and commit batch B</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/B-spotcheck.md</files>
  <action>
`node scripts/eval81/score.cjs --batch B --root <R> --out <O>`. Spot-check 6 runs (seeded; at least one per planted
kind plus a clean one) by reading the checker returns in each run's record/outputs; write `results/B-spotcheck.md`.
Secret scan of `<O>/results/` (node in-process, paths only). `prereg.cjs --check`. Commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-15): batch B job-checker results" --files <O>/results/B.json <O>/results/B.md <O>/results/B-spotcheck.md`.
SUMMARY: ledger total after B, per-model detection (judgment-only vs pre-check-flagged), false alarms, spot-check
agreement.
  </action>
  <verify>results/B.json has role job-checker with both models and the precheck split; secret scan empty; prereg check 0.</verify>
  <done>Batch B scored, spot-checked and committed.</done>
  <recovery>Record scorer/spot-check disagreements in B-spotcheck.md; do not change the scorer now.</recovery>
</task>

</tasks>

<verification>
- Ledger: A and B complete, total under $100.
- The commit lists only the three B result files.
</verification>

<success_criteria>
Batch B ran only after the user's go, stayed within its cap, and its results are committed with n, the pre-check
split and a spot-check.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-15-SUMMARY.md`
</output>
