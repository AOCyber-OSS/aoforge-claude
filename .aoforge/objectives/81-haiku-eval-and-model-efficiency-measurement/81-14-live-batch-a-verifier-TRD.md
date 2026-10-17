---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "14"
type: standard
wave: 4
depends_on: ["81-13"]
files_modified:
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.json
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A-spotcheck.md
autonomous: false
requirements: [SC-3]
must_haves:
  truths:
    - "Before any spend, the user saw that the token file exists, the ledger total, batch A's plan (36 runs, ~$5 estimate, $7.50 batch cap) and the pre-registered rule's interpretive choices, and replied to go"
    - "Batch A ran live (36 verifier runs, haiku and sonnet, 3 repeats of 6 fixtures) under the ledger, with any rate-limit pause resumed rather than retried, and the tripwire clean"
    - "results/A.json and results/A.md report per model detection, false pass, false fail, abstain and detected-but-unnamed with n, plus exclusions; a hand spot-check of 6 verdicts agrees with the scorer or the disagreement is recorded"
    - "No committed file contains the token (scanned before commit) and prereg --check passes before and after"
  artifacts:
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.json
      provides: "batch A scored results"
  key_links:
    - from: "R/ledger.json"
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.md
      via: "batch A spend recorded in the results and the SUMMARY"
      pattern: "spent"
---

# TRD 81-14: Live batch A (verifier, Haiku vs Sonnet)

<objective>
Spend the first money: after the user confirms, run test A's 36 verifier runs headless under the ledger, score them
against the committed answer key, spot-check the scorer by hand, and commit the scored results.

Purpose: SC-3 (runs in order A, B, D, E, C within $100; scored per role with n) for the verifier, and the A
false-pass gate the decision rule applies to every role.
Output: `results/A.json`, `results/A.md`, `results/A-spotcheck.md`; run evidence stays in the eval root.
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
- Runner exit codes: 0 complete, 2 usage/order, 3 budget stop, 4 paused on a rate/usage limit (queue file has
  `resume_after`), 5 tripwire, 6 harness error (scripts/eval81/README.md).
</codebase_examples>

<anti_patterns>
- Never print, echo, cat or log the token or the token file. Presence is `test -s <T>`; the secret scan reads it
  inside a node process and prints only file paths.
- Never re-run the batch in a loop after exit 4: wait until `resume_after` (Monitor until-loop on the clock), then
  run the same command once; the runner resumes pending ids.
- Never start batch B from this TRD.
- Never modify a frozen file (prereg manifest) to make a run or a score work; a needed change is a post-hoc
  deviation recorded in the SUMMARY and the report, made only after telling the user.
</anti_patterns>

<error_recovery>
- Exit 6 on the first run because the init tools check misfired: open that run's `stream.jsonl` init event and the
  run's first assistant turn. If the session plainly ran as the verifier (its first actions follow verifier.md) and
  only the init tool listing differs from the frontmatter, stop and tell the user what the CLI reports; continue only
  after the user accepts relaxing the check (a post-hoc harness deviation, test-first in tripwire/runner). If the
  session did NOT run as the agent, the `--agent` name is wrong: try `aoforge:verifier` vs `verifier` in a single
  further run only with the user's go-ahead.
- Exit 5 (tripwire): stop everything and report the diff to the user immediately; do not score or commit.
- Exit 3 on batch A (should not happen at ~$5): report the ledger and stop; the user decides.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
@scripts/eval81/README.md
</context>

<gotchas>
- The batch takes tens of minutes. Start it with `run_in_background` and wait for the completion notification;
  do not poll with sleep.
- The verifier's spot-check: pick 6 runs with a fixed seed (3 planted, 3 clean, both models), read each run's
  `outputs/` VERIFICATION.md and compare with the scorer's outcome for that run.
</gotchas>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm spend for batch A</name>
  <files>(none)</files>
  <action>Approve the first live spend (batch A). Claude has already run the checks below; only the go/stop decision is the user's.</action>
  <instructions>
    Claude runs first, one plain command each:
    1. `node scripts/eval81/prereg.cjs --check --manifest <O>/results/prereg-manifest.json` (must exit 0).
    2. `test -s <T>` and report only "token file present" or "token file missing".
    3. `node scripts/eval81/run.cjs --batch A --root <R> --token-file <T> --dry-run --materialize none --raw` and read:
       ledger total, batch A runs (36), sum of caps, estimate (~$5), batch cap ($7.50), order status.
    Present to the user:
    - Token file: present / missing.
    - Ledger: $<total> spent of $100.
    - Batch A: 36 runs (verifier; Haiku 5.5 and Sonnet 5.5; 6 fixtures x 3 repeats), estimate ~$5, batch cap
      $7.50; nothing else will spend.
    - Pre-registered interpretive choices (81-DECISION-RULE.md section 6), which can still be amended now, before
      any run, and not afterwards: (1) one Haiku false pass in A refuses Haiku for every role; (2) C (mapper,
      researcher) uses the same 10-point margin on checklist recall plus a fabrication bound; (3) "~10 points" is on
      point estimates; (4) human_needed counts as an abstention; (5) INSUFFICIENT below 2/3 of runs scored or when
      Sonnet itself scores under 0.5. Also: D is judged through a headless Claude Code session using the engine's
      own rubric (no API key); C's four research dimensions use project-researcher.
  </instructions>
  <verify>The user's reply is recorded in the SUMMARY.</verify>
  <done>The user replied "go A" (or amended the rule first, recorded as a pre-run amendment, then "go A"), or "stop".</done>
  <verification>Token present, prereg check passed, ledger total shown.</verification>
  <resume-signal>Type "go A" to run batch A (up to $7.50), describe a rule amendment first if you want one, or "stop" to end the eval here.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Run batch A live</name>
  <files>(eval root only)</files>
  <action>
On "go A": `node scripts/eval81/run.cjs --batch A --root <R> --token-file <T> --raw` with `run_in_background`.
On completion read the exit code and the JSON. 0: continue. 4: read `resume_after` from `R/queue/A.json`, wait
until then with a Monitor until-loop on the clock, run the same command once more; repeat only on a new exit 4.
3, 5, 6: follow error_recovery and stop. Afterwards record: ledger total, batch A spent, runs ok / excluded and why,
wall time.
  </action>
  <verify>`R/ledger.json` shows batch A `complete`; `R/tripwire/A-after.json` diff is empty (the runner exited 0).</verify>
  <done>Batch A complete within its cap, tripwire clean.</done>
  <recovery>If the batch stops partway for a reason not covered above, leave the ledger as it is, report to the user with the queue file and the last run's stderr, and wait.</recovery>
</task>

<task type="auto">
  <name>Task 3: Score, spot-check and commit batch A</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A-spotcheck.md</files>
  <action>
`node scripts/eval81/score.cjs --batch A --root <R> --out <O>`. Spot-check 6 runs (seeded pick) by reading their
VERIFICATION.md and write `results/A-spotcheck.md` (run id, model, fixture id, scorer outcome, your reading,
agree yes/no, one line why). Secret scan of `<O>/results/` with a node one-liner that reads `<T>` in-process and
calls `scanForSecret` (prints paths only; must print none). `prereg.cjs --check` again. Commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-14): batch A verifier results" --files <O>/results/A.json <O>/results/A.md <O>/results/A-spotcheck.md`.
In the SUMMARY: ledger total after A, per-model headline (false passes k/n, detection k/n), spot-check agreement.
  </action>
  <verify>results/A.json has role verifier with both models; the secret scan prints nothing; prereg check exits 0; the commit lists the three files.</verify>
  <done>Batch A scored, spot-checked and committed; the ledger total is reported.</done>
  <recovery>If the spot-check disagrees with the scorer on a run, do not change the scorer now: record the disagreement in A-spotcheck.md; the final report (81-19) lists it beside the metric.</recovery>
</task>

</tasks>

<verification>
- Ledger: batch A complete, total under $100.
- `git show --stat HEAD` lists only the three result files.
</verification>

<success_criteria>
Batch A ran only after the user's go, stayed within its cap, and its scored results with n and a hand spot-check are
committed without the token.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-14-SUMMARY.md`
</output>
