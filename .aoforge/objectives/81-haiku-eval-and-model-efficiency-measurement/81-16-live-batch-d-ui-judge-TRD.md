---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "16"
type: standard
wave: 6
depends_on: ["81-15"]
files_modified:
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.json
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D-spotcheck.md
autonomous: false
requirements: [SC-3]
must_haves:
  truths:
    - "Before any spend on D, the user saw the token file is present, the ledger total after B, the A and B headlines and batch D's plan (24 runs, ~$2, $3 cap), and replied to go"
    - "Batch D ran live (24 judge sessions: 4 surfaces x haiku, sonnet x 3 repeats) with only the Read tool and no plugin, under the ledger, tripwire clean"
    - "results/D.json and results/D.md report per model per-state accuracy, broken-missed, split rate (escalation frequency), engine-rule escalations and accuracy by defect type and severity, with n states; a hand spot-check of 4 states (looking at the PNG) is recorded"
  artifacts:
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.json
      provides: "batch D scored results"
  key_links:
    - from: scripts/eval81/score/D.cjs
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.json
      via: "score CLI"
      pattern: "ui-evaluator"
---

# TRD 81-16: Live batch D (UI judge, Haiku vs Sonnet)

<objective>
After the user confirms, run test D's 24 judge sessions on the labelled docs screenshots, score them with the
engine's vote rules against the committed labels, spot-check four states by looking at them, and commit the results.

Purpose: SC-3 for the UI judge (third in the order) and the evidence for MEF-06's UI-judge starting tier.
Output: `results/D.json`, `results/D.md`, `results/D-spotcheck.md`.
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
- Runner exit codes and handling as in TRD 81-14. D runs are kind `prompt` (no `--agent`), so the first-run tools
  check does not apply; the init event should list only Read.
</codebase_examples>

<anti_patterns>
- Never print or log the token. No tight retry after exit 4. Never start batch E from this TRD. Never modify
  frozen files (states.json, labels.json, PNGs).
</anti_patterns>

<error_recovery>
- Exit 5: stop and report. Exit 6: read the run's stderr and stream; report; continue only with the user's go.
- Many runs returning no structured output (schema not honoured): stop after the batch, report the rate, and let
  the user decide whether a fenced-JSON-only rerun is a post-hoc deviation worth its cost; do not rerun on your own.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md (D metrics)
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-15-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm spend for batch D</name>
  <files>(none)</files>
  <action>Approve batch D's spend. Claude has already run the checks below.</action>
  <instructions>
    Claude runs first: `prereg.cjs --check`; `test -s <T>`; `node scripts/eval81/run.cjs --batch D --root <R>
    --token-file <T> --dry-run --materialize none --raw`. Present: token present/missing; ledger $<total> of $100;
    A and B headlines (k/n per model); batch D plan: 24 sessions, one per surface x model x repeat, about 5 states
    each, judged with the engine's per-state rubric through a Claude Code session (the engine's API-key path is not
    used), estimate ~$2, cap $3. Note the known limitation: one session sees all states of a surface, so it can
    compare them; the order is shuffled per repeat.
  </instructions>
  <verify>The user's reply is recorded in the SUMMARY.</verify>
  <done>The user replied "go D" or "stop".</done>
  <verification>prereg check passed, token present, ledger shown, A and B complete.</verification>
  <resume-signal>Type "go D" to run batch D (up to $3), or "stop".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Run batch D live</name>
  <files>(eval root only)</files>
  <action>
`node scripts/eval81/run.cjs --batch D --root <R> --token-file <T> --raw` with `run_in_background`; exit handling as
in 81-14. Record ledger total, batch spent, the count of runs whose results came from structured output vs a fenced
block vs none.
  </action>
  <verify>`R/ledger.json` batch D `complete`; runner exit 0.</verify>
  <done>Batch D complete within its cap.</done>
  <recovery>On an unexplained partial stop, report and wait for the user.</recovery>
</task>

<task type="auto">
  <name>Task 3: Score, spot-check and commit batch D</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/D-spotcheck.md</files>
  <action>
`node scripts/eval81/score.cjs --batch D --root <R> --out <O>`. Spot-check 4 states (seeded: two the models got
right, two they disagreed on or got wrong): open each PNG with the Read tool, read the labels.json entry and both
models' majority verdicts, and write `results/D-spotcheck.md` (state id, label, haiku majority, sonnet majority,
your reading, and whether the label still looks right). Secret scan, `prereg.cjs --check`, then commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-16): batch D UI judge results" --files <O>/results/D.json <O>/results/D.md <O>/results/D-spotcheck.md`.
SUMMARY: ledger total after D, per-model accuracy (k/n states), broken-missed, split rate.
  </action>
  <verify>results/D.json has role ui-evaluator with both models; secret scan empty; prereg check 0.</verify>
  <done>Batch D scored, spot-checked and committed.</done>
  <recovery>If the spot-check suggests a label is wrong, do not edit labels.json: record it; the final report shows the metric with and without that state as a sensitivity line.</recovery>
</task>

</tasks>

<verification>
- Ledger: A, B and D complete, total under $100.
- The commit lists only the three D result files.
</verification>

<success_criteria>
Batch D ran only after the user's go, within its cap, and its per-state accuracy and escalation frequency are
committed with n and a visual spot-check.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-16-SUMMARY.md`
</output>
