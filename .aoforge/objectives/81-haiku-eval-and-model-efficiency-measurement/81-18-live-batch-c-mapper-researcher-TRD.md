---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "18"
type: standard
wave: 8
depends_on: ["81-17"]
files_modified:
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C-spotcheck.md
autonomous: false
requirements: [SC-3]
must_haves:
  truths:
    - "Before any spend on C, the user saw the token file is present, the ledger total after E, the remaining budget against C's ~$28 estimate, and the C plan (32 mapper + 16 researcher runs, then 48 Sonnet grader runs), and replied to go"
    - "Batch C ran last: the agent runs, then the grader runs, under the ledger (stopping cleanly if the $100 total is reached), with the fleet source watched by the tripwire and unchanged"
    - "results/C.json and results/C.md report per role (codebase-mapper per focus, project-researcher per dimension) and model: checklist recall, error rate, missing and fabrications per run, with n items and a per-codebase split; no private fleet content is in any committed file"
    - "A hand spot-check of 6 grader verdicts is recorded as agreement counts in the committed file, with the quotes kept in the eval root"
  artifacts:
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json
      provides: "batch C scored results"
  key_links:
    - from: scripts/eval81/score/C.cjs
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json
      via: "score CLI"
      pattern: "codebase-mapper"
---

# TRD 81-18: Live batch C (codebase-mapper and project-researcher, Haiku vs Sonnet, blind Sonnet grader)

<objective>
After the user confirms, run test C last: the mapper on two codebases and four foci, the researcher on four
dimensions, then the fixed Sonnet grader over every output; score, spot-check, and commit the results without any
private fleet content.

Purpose: SC-3 (C runs last, within $100; checklist recall/errors/fabrications per role with n).
Output: `results/C.json`, `results/C.md`, `results/C-spotcheck.md`.
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
- Batch C (81-11): first invocation runs the 48 agent runs; the second lists and runs the 48 grader runs for the
  collected outputs. Spot-check sample: `R/spotcheck/C.md` (quotes stay there).
</codebase_examples>

<anti_patterns>
- Never print or log the token. No tight retry after exit 4. Never modify frozen files.
- Never copy fleet checklist text, fleet document quotes or fleet paths into a committed file; committed results use
  item ids, counts and the alias `fleet-go-service`.
- Never write to `/Users/justin/dev/aoedge`; the batch reads it once through a no-lock clone into the eval root.
</anti_patterns>

<error_recovery>
- `runs()` throws "fleet checklist missing or changed": stop before any spend and report; the hash commitment
  failed, so fleet runs cannot be scored as pre-registered. Offer the user: run C on the synthetic codebase and the
  researcher only (a recorded reduction), or stop.
- Exit 3 (the $100 total reached) during the agent runs or the graders: stop; score what exists; roles below 2/3
  scored come out INSUFFICIENT by the pre-registered rule. Report the remaining unspent ids.
- Exit 5 with a change in the fleet source: stop everything and report immediately.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md (C metrics, extension)
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-17-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm spend for batch C</name>
  <files>(none)</files>
  <action>Approve batch C's spend (the last batch). Claude has already run the checks below.</action>
  <instructions>
    Claude runs first: `prereg.cjs --check`; `test -s <T>`; `node scripts/eval81/run.cjs --batch C --root <R>
    --token-file <T> --dry-run --materialize none --raw` (this also verifies the private checklist hash). Present:
    token present/missing; ledger $<total> of $100; remaining $<100 - total>; C plan: 32 mapper runs (synthetic and
    fleet copy x 4 foci x 2 models x 2), 16 researcher runs (4 dimensions x 2 x 2; project-researcher, since only it
    has dimensions), then 48 Sonnet grader runs; estimate ~$28 (mapper ~$11, researcher ~$12, grader ~$5); if the
    remainder is below that, the ledger stops C cleanly and short roles come out INSUFFICIENT.
  </instructions>
  <verify>The user's reply is recorded in the SUMMARY.</verify>
  <done>The user replied "go C", "go C synthetic-only" (a recorded reduction), or "stop".</done>
  <verification>prereg check passed, private hash verified by the dry run, token present, ledger and remainder shown.</verification>
  <resume-signal>Type "go C" to run batch C within the remaining budget, or "stop".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Run batch C live (agents, then graders)</name>
  <files>(eval root only)</files>
  <action>
If the user chose "go C synthetic-only", prefix both commands below with `EVAL81_C_SKIP_FLEET=1` and record the
reduction. `node scripts/eval81/run.cjs --batch C --root <R> --token-file <T> --raw` in the background (48 agent runs); handle
exit codes as in 81-14. Then the same command again in the background (48 grader runs). Record ledger total, spent,
ok/excluded counts, and which outputs had no grader.
  </action>
  <verify>`R/ledger.json` batch C `complete` (or stopped by budget, reported); the fleet source's HEAD and porcelain equal the tripwire's before-state.</verify>
  <done>Agent and grader runs done (or the budget stop recorded); tripwire clean.</done>
  <recovery>On a grader that returns no structured output, do not rerun it automatically: it stays ungraded and is reported.</recovery>
</task>

<task type="auto">
  <name>Task 3: Score, spot-check and commit batch C</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/C-spotcheck.md</files>
  <action>
`node scripts/eval81/score.cjs --batch C --root <R> --out <O>`; the scorer writes `R/spotcheck/C.md`. Read its 6
sampled (run, item) pairs against the documents and checklists, and write `results/C-spotcheck.md` with run id,
item id, grader verdict, your verdict, agree yes/no, and nothing else for fleet items (no quotes, no statements).
Check `rg -n -i -e aoedge -e aocybersystems <O>/results` finds nothing. Secret scan; `prereg.cjs --check`; commit
with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-18): batch C mapper and researcher results" --files <O>/results/C.json <O>/results/C.md <O>/results/C-spotcheck.md`.
SUMMARY: final ledger total (all batches), per-role recall headline per model, grader spot-check agreement.
  </action>
  <verify>results/C.json has the eight C roles with both models; the leak checks find nothing; prereg check 0.</verify>
  <done>Batch C scored, spot-checked and committed; final spend reported.</done>
  <recovery>If grader/spot-check agreement is below 5 of 6, flag C's results as low-confidence in C.md's notes (the final report carries it) rather than re-grading.</recovery>
</task>

</tasks>

<verification>
- Ledger: all five batches done or explicitly stopped; total at or under $100.
- No committed file under `<O>/results/` names or quotes the private fleet repository.
</verification>

<success_criteria>
C ran last, after the user's go, within the $100 total, and its checklist-based results per role are committed with n,
a spot-checked grader, and no private content.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-18-SUMMARY.md`
</output>
