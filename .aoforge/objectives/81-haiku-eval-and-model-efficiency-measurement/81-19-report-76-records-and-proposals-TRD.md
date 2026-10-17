---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "19"
type: standard
wave: 9
depends_on: ["81-18"]
files_modified:
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md
  - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
  - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md
  - .aoforge/ROADMAP.md
  - .aoforge/REQUIREMENTS.md
  - ".aoforge/todos/pending/*-apply-objective-81-tier-proposal-*.md"
autonomous: false
requirements: [SC-3, SC-4, SC-5]
must_haves:
  truths:
    - "81-HAIKU-EVAL.md (76-06 report) gives, per role, each model's metrics with n and 95% Wilson intervals, the pre-registered outcome (REFUSE / WEAK_ENDORSE / INSUFFICIENT) with reasons, the proposals, spot-check agreement, every deviation from the pre-registration, total spend from the ledger, and a link to 81-MEASUREMENT.md"
    - "76-VERIFICATION.md's deferred items 76-06 and 76-08 are recorded closed or explicitly not met with the evidence files; MEF-05 and MEF-06 are updated from the evidence in 76-VERIFICATION.md, 76-RETROACTIVE-SUMMARY.md, ROADMAP.md (76-06/76-08 rows) and REQUIREMENTS.md, and `validate requirements --objective 76` reports no finding"
    - "The tier-change proposals were presented to the user as a decision; whatever the user chose is recorded in the report, and no model-profiles.json or stack-pack tier was changed in this objective"
    - "Approved proposals, if any, exist as todos for a follow-up (`.aoforge/todos/pending/<date>-apply-objective-81-tier-proposal-<role>.md`), each naming the file, key, current and proposed tier and the evidence"
    - "Every commit in this TRD ran the commit scan over every path in its --files list (81-HAIKU-EVAL.md, the four 76 records, the todo files) and found no token"
  artifacts:
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md
      provides: "the 76-06 eval report with per-role recommendations"
  key_links:
    - from: .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md
      via: "deferred item 76-06 evidence"
      pattern: "81-HAIKU-EVAL"
    - from: .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md
      via: "deferred item 76-08 evidence"
      pattern: "81-MEASUREMENT"
---

# TRD 81-19: The 76-06 report, the 76 records, and the tier-change proposals

<objective>
Close the eval: render the 76-06 report from the scored batches with the pre-registered rule, record 76-06 and 76-08
in objective 76's records from the evidence, and put any tier-change proposals to the user as a decision. Nothing in
this objective changes a tier.

Purpose: SC-3 (results per role with n and intervals), SC-4 (the 76-08 report is linked into the 76 records) and
SC-5 (recommendation per role by the pre-registered rule; proposals only; 76 records and MEF-05/MEF-06 updated).
Output: `81-HAIKU-EVAL.md`, updated 76 records, and todos for any approved proposal.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
- `O` = `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement`; `R` and `T` (token file) as in 81-14.
- The commit scan (81-14 codebase_examples): run it over every path of a commit's `--files` list immediately before
  that commit; it reads `<T>` in-process and prints only matching paths. If `<T>` no longer exists (the eval root was
  cleaned up), say so in the SUMMARY and scan with the user's go only after they re-create it; never commit unscanned
  files that came from run outputs.
- `node scripts/eval81/score.cjs --report --out <O>` renders `81-HAIKU-EVAL.md` from `results/{A,B,C,D}.json` with
  decide() (81-02) against `plugins/aoforge/aoforge/references/model-profiles.json` and
  `plugins/aoforge-stack-flutter/aoforge-stack.json`.
- 76-VERIFICATION.md frontmatter today: `deferred: [{item: "76-06 Haiku 5.5 eval", criterion: "SC5 ...", state:
  open, note}, {item: "76-08 before/after measurement", criterion: "SC6 starting-tier half ...", state: open, note}]`;
  its Requirements Coverage table rows MEF-05 ("SATISFIED except deferred eval (76-06)") and MEF-06 ("SATISFIED for
  escalation; start-tier lowering deferred (76-08)").
- 76-RETROACTIVE-SUMMARY.md: a "Still open" section listing 76-06 and 76-08, and `requirements-completed`.
- ROADMAP.md objective 76 section: rows `- [ ] 76-06-per-focus-tiers-and-haiku-eval-TRD.md — ... Open: the Haiku 5.5
  eval ...` and `- [ ] 76-08-measure-TRD.md — ...`; REQUIREMENTS.md traceability rows MEF-05 and MEF-06 (Pending).
- `node ~/.claude/aoforge/bin/aof-tools.cjs todo add --from <draft>` (draft from `planning draft todos/pending/<stem>.md`).
</codebase_examples>

<anti_patterns>
- Never edit model-profiles.json, aoforge-stack.json or any agent file in this objective, whatever the user decides:
  approval creates a todo for a follow-up; the change itself is separate work.
- Never re-score with a changed rule. Post-hoc views (a sensitivity line without a doubtful label, a reading of a
  spot-check disagreement) are labelled post-hoc and sit beside the pre-registered result, never in its place.
- Edits to ROADMAP.md stay inside the objective 76 section's two rows and the Progress row for 76; nothing else in
  the file changes (check `git diff .aoforge/ROADMAP.md` line by line before committing).
- No private fleet content in the report.
</anti_patterns>

<error_recovery>
- `validate requirements --objective 76` (health W065) flags a requirement after the edits: make
  76-RETROACTIVE-SUMMARY.md's `requirements-completed` agree with the SATISFIED rows of 76-VERIFICATION.md's table.
- A batch that never ran (the user stopped): its roles are INSUFFICIENT "batch X not run"; 76-06 is then "not met"
  for those roles, stated per role.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-18-SUMMARY.md
@.aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
@.aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md
</context>

<gotchas>
- 76-06 closes when the eval is recorded, whatever it found (MEF-05's text is "the haiku tier is re-pinned after a
  recorded eval"; the pin claude-haiku-5-5 is already current). Record each role's outcome; refusals are findings,
  not failures.
- 76-08 has two halves: the measurement (81-MEASUREMENT.md: closed if E ran) and the starting tiers (MEF-06). The UI
  judge's starting tier has evidence from D; the debugger's was not measured by this design. Unless the user approves
  a start-tier change (as a follow-up todo), MEF-06's start-tier half stays "not met: tiers unchanged; evidence
  recorded" and says why.
- Write the report with the facts first: spend, n, outcomes; then proposals.
</gotchas>

<tasks>

<task type="auto">
  <name>Task 1: Render and complete the 76-06 report</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md</files>
  <action>
Run `node scripts/eval81/prereg.cjs --check --manifest <O>/results/prereg-manifest.json` (record its result; a
failure is reported in the report as a deviation, not hidden), then `node scripts/eval81/score.cjs --report --out <O>`.
Append by hand, below the generated part: "Spend" (ledger total and per batch from `R/ledger.json`); "Spot-checks"
(agreement per batch from `results/*-spotcheck.md`); "Deviations from the pre-registration" (every post-hoc change,
reduction or amendment recorded in 81-14..81-18 SUMMARYs, or "none"); "Limitations" (n per role; D judged one surface
per session; C graded by one Sonnet grader; the verifier and job-checker are held at Sonnet by verdict_floor
regardless; results are for Haiku 5.5 and Sonnet 5.5 on these fixtures only; the per-run cap did not bound spend,
the reserve and the charge-the-larger rule did, with the largest overshoot and the subagent-cost finding from
81-17); "76-08" (one paragraph pointing to 81-MEASUREMENT.md with its headline numbers). Commit scan over
`<O>/81-HAIKU-EVAL.md`, then commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-19): 76-06 Haiku eval report" --files <O>/81-HAIKU-EVAL.md`.
  </action>
  <verify>81-HAIKU-EVAL.md has a row per role (verifier, job-checker, ui-evaluator, 4 mapper foci, 4 researcher dimensions) with both models, n, CIs and an outcome; it contains "No tier assignment was changed".</verify>
  <done>The 76-06 report is complete and committed.</done>
  <recovery>If a results file is missing for a batch that did run, re-run that batch's score command (scoring spends nothing) before rendering.</recovery>
</task>

<task type="auto">
  <name>Task 2: Record 76-06 and 76-08 in objective 76's records</name>
  <files>.aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md, .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md, .aoforge/ROADMAP.md, .aoforge/REQUIREMENTS.md</files>
  <action>
76-VERIFICATION.md: set each deferred item's `state` to `closed` or `not_met` with `evidence:` (the 81 report paths)
and a one-line `note` of the outcome; update the MEF-05 and MEF-06 rows of the Requirements Coverage table from the
evidence (see gotchas); add a dated paragraph "Closed by objective 81" under the Gaps Summary. Keep everything else
byte-identical.
76-RETROACTIVE-SUMMARY.md: replace the "Still open" bullets with what 81 recorded; keep `requirements-completed`
equal to the SATISFIED rows.
ROADMAP.md (objective 76 section only): the 76-06 and 76-08 rows say "closed by objective 81 (81-HAIKU-EVAL.md)" /
"(81-MEASUREMENT.md)" or "not met: <why>", ticked only when closed; the Progress row for 76 updated to match.
REQUIREMENTS.md: MEF-05 and MEF-06 traceability rows updated from the evidence (no other row).
Run `node plugins/aoforge/aoforge/bin/aof-tools.cjs validate requirements --objective 76 --raw` and `validate
health --raw` (repo copy of aof-tools, per CLAUDE.md, because the installed runtime lags) and confirm no new finding.
Check `git diff .aoforge/ROADMAP.md` touches only the 76 rows and the Progress row. Commit scan over the four paths,
then commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-19): record 76-06 and 76-08 from objective 81" --files <the four paths>`.
  </action>
  <verify>`validate requirements --objective 76` reports no finding; the ROADMAP diff is limited to the 76 rows and its Progress row.</verify>
  <done>76's records say what objective 81 found, with evidence links; MEF-05 and MEF-06 reflect the evidence.</done>
  <recovery>If the ROADMAP diff strays outside the 76 rows, `git restore .aoforge/ROADMAP.md` and redo the two-row edit.</recovery>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 3: Decide on the tier-change proposals</name>
  <files>(none)</files>
  <action>Present the per-role outcomes and the proposals from 81-HAIKU-EVAL.md and record the user's choice.</action>
  <decision>Which, if any, of the eval's tier-change proposals should become follow-up work?</decision>
  <context>
    The pre-registered rule produced one outcome per role (REFUSE, WEAK_ENDORSE or INSUFFICIENT) and, where an
    outcome differs from today's tiers, a proposal (for example: raise codebase-mapper balanced/budget to Sonnet; start
    the UI judge at Haiku with split-vote escalation). Show each proposal with its role, current tier per profile,
    proposed tier, the deciding numbers (k/n and CI for both models) and the spot-check agreement. Nothing has been
    changed; approval creates follow-up todos only.
  </context>
  <options>
    <option id="record-only">
      <name>Record the proposals, change nothing</name>
      <pros>No follow-up work; the evidence stays on record in 81-HAIKU-EVAL.md and the 76 records.</pros>
      <cons>Any refusal on a role that runs Haiku today keeps running Haiku.</cons>
    </option>
    <option id="approve-all">
      <name>Approve every proposal as a follow-up todo</name>
      <pros>Acts on all the evidence; each todo names file, key, current and proposed tier.</pros>
      <cons>Weak endorsements at small n become planned changes.</cons>
    </option>
    <option id="approve-selected">
      <name>Approve only the proposals I name</name>
      <pros>Lets refusals (raise a tier) proceed while weak endorsements (lower a tier) wait.</pros>
      <cons>Needs a per-proposal choice.</cons>
    </option>
    <option id="reject">
      <name>Reject the proposals</name>
      <pros>Keeps today's tiers deliberately.</pros>
      <cons>The report records the rejection beside the evidence.</cons>
    </option>
  </options>
  <verify>The chosen option (and the named proposals for approve-selected) is recorded in the SUMMARY.</verify>
  <done>The user picked an option.</done>
  <resume-signal>Reply with record-only, approve-all, approve-selected (naming the proposals), or reject.</resume-signal>
</task>

<task type="auto">
  <name>Task 4: Record the decision, create approved todos, tidy the eval trees</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md, .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md, .aoforge/todos/pending/*-apply-objective-81-tier-proposal-*.md</files>
  <action>
Append "## Decision (YYYY-MM-DD)" to 81-HAIKU-EVAL.md with the option and, per proposal, approved or not. For each
approved proposal add a todo through `planning draft todos/pending/<YYYY-MM-DD>-apply-objective-81-tier-proposal-<role,
':' written as '-'>.md` + `todo add --from <draft>` (title "Apply objective 81 tier proposal: <role>", body: file, key, current tier per profile, proposed tier, evidence lines, the rule outcome). If
MEF-06's start-tier half changed status because of the decision, update that row in 76-VERIFICATION.md (only that
row). Remove the two eval worktrees with `git worktree remove <R>/trees/v3.0.0` and `git worktree remove
<R>/trees/v3.1.0` (they are clean, detached checkouts under the eval root); leave the rest of the eval root in place
as evidence. Commit scan over every file going into the commit, then commit with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "docs(81-19): record the tier-proposal decision" --files <O>/81-HAIKU-EVAL.md <each new .aoforge/todos/pending/<date>-apply-objective-81-tier-proposal-<role>.md> <76-VERIFICATION.md if its row changed>`
(list the todo files by name from `todo add`'s output; `git status --porcelain .aoforge/todos` must show no other
new todo).
No push, tag or release.
  </action>
  <verify>81-HAIKU-EVAL.md ends with the Decision section; `git worktree list` no longer lists the eval trees; `git diff HEAD~1 --stat` shows no change to model-profiles.json or aoforge-stack.json.</verify>
  <done>Decision recorded, approved proposals exist as todos, no tier changed, eval trees removed.</done>
  <recovery>If `git worktree remove` refuses (a modified file in a tree), report the modification (a run should never have written there; treat it as a tripwire finding) and leave the tree for the user.</recovery>
</task>

</tasks>

<verification>
- `rg -n "No tier assignment was changed" .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-HAIKU-EVAL.md` matches.
- `git log --format=%s -- plugins/aoforge/aoforge/references/model-profiles.json plugins/aoforge-stack-flutter/aoforge-stack.json` shows no commit from objective 81.
- `node plugins/aoforge/aoforge/bin/aof-tools.cjs validate requirements --objective 76 --raw` reports no finding.
</verification>

<success_criteria>
Every role has a pre-registered recommendation with n and intervals; 76-06 and 76-08 are recorded closed or not met
from evidence; MEF-05/MEF-06 reflect it; the user decided on the proposals and no tier was changed here.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-19-SUMMARY.md`
</output>
