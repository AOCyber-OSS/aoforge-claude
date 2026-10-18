---
objective: 82-3-1-0-follow-ups
trd: "08"
type: standard
wave: 3
depends_on: ["82-03", "82-06", "82-07"]
files_modified:
  - .aoforge/objectives/82-3-1-0-follow-ups/results/D.json
  - .aoforge/objectives/82-3-1-0-follow-ups/results/D.md
  - .aoforge/objectives/82-3-1-0-follow-ups/results/C.json
  - .aoforge/objectives/82-3-1-0-follow-ups/results/C.md
  - .aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md
  - "only on a REVERT verdict: plugins/aoforge-stack-flutter/aoforge-stack.json, plugins/aoforge-stack-flutter/lib/flutter-ui-eval.test.cjs, plugins/aoforge-stack-flutter/CHANGELOG.md, plugins/aoforge/aoforge/references/model-profiles.json, plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs, plugins/aoforge/aoforge/references/model-profiles.md"
autonomous: false
requirements: [SC-3, MEF-06]
must_haves:
  truths:
    - "Before any spend the user saw: token file present, both prereg checks OK, the $20 ledger at its current total, batch D and C plans with caps and estimates, E's reserved $12, the tree sha, the Claude Code version against objective 81's, and the pre-registered keep/revert rules; and replied to go"
    - "Batch D ran 120 per-state start sessions and then exactly the escalation sessions the engine's rules asked for; batch C ran 16 researcher runs and their graders; every run inside the opaque sandbox root with no real escape"
    - "82-TIER-CHECKS.md gives P1's escalation rate, escalated-verdict agreement with a Sonnet start, final verdict accuracy and cost against a Sonnet start, and P4/P5's recall, fabrications and item matrix on the two new topics beside objective 81's topic, each with the verdict 82-CHECK-RULES.md assigns"
    - "Each REVERT verdict is applied test-first (pin test changed to the reverted tier, then the JSON) and documented; each KEEP leaves 82-03's tiers in place"
    - "SC-2's sandboxed check for the researcher runs: zero `tilde`, `guessed_nonexistent` and `real` access classes"
  artifacts:
    - path: .aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md
      provides: "the P1, P4 and P5 measurements and verdicts"
  key_links:
    - from: .aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md
      to: "82-10 todo resolutions and MEF-06"
      via: "verdict per proposal"
      pattern: "KEEP|REVERT"
---

# TRD 82-08: Live checks for P1 (UI judge escalation) and P4/P5 (researcher follow-up)

<objective>
After the user approves the spend, run batch D (UI judge: Haiku start with engine-rule escalation against a Sonnet
start, per state) and batch C (project-researcher architecture and pitfalls at Haiku vs Sonnet on two new real-product
topics) under objective 82's $20 ledger, score them, apply the pre-registered keep/revert rules, and revert any tier
that fails.

Purpose: SC-3's measurement condition for P1, P4 and P5; MEF-06's UI-judge start-tier evidence; SC-2 (researcher runs).
Output: results D and C, 82-TIER-CHECKS.md, and any revert.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-05-SUMMARY.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-06-SUMMARY.md
@scripts/eval81/README.md

Names (write the literal paths in every command; shell variables do not persist between calls):
- `SP` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`
- `R` = `SP/eval82` (eval root: ledger, record dirs; create on first use)
- `T` = `SP/eval-auth/oauth-token` (the subscription token; only ever passed as `--token-file T`; never print, cat or log it)
- `S1` = `/private/tmp/claude-501/e82-<16 hex>`: an opaque sandbox root, created in Task 1 from
  `node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"`; no path a run sees names the user or the checkout
- `O` = `.aoforge/objectives/82-3-1-0-follow-ups`
- Runner: `node scripts/eval81/run.cjs --batch <D|C> --root R --token-file T --batch-dir scripts/eval82/batches --results-dir O/results --sandbox-root S1 --raw`
  (batch C commands are prefixed `EVAL82_SANDBOX_ROOT=S1 ` so researcher spawn prompts carry their sandbox runtime root).
- Exit codes (81 README): 0 done or nothing pending; 2 refusal (nothing spawned); 3 budget stop (the user decides);
  4 paused on a rate limit (wait until `resume_after` with a Monitor until-loop, then run the same command once);
  5 tripwire or real escape (batch stopped: report to the user, resume only on their word with `--reopen --reason`);
  6 harness error.
- Ledger (from 82-05): global $20, order D, C, E; D cap $4.5 (~$3.8 expected), C $3.5 (~$2.6), E $12 kept for 82-09.
Never push or tag; never port 8080; never write the real `~/.claude` or a fleet repo; never edit scripts/eval81.
</context>

<embedded_context>

<codebase_examples>
Tree export (S1 gets a plain copy of HEAD's plugins/):
```
node -e "require('./scripts/eval81/lib/sandbox.cjs').exportTrees({repo: process.cwd(), root: '<S1>', refs: {'3.1.0': '<HEAD sha>'}})"
```
Score and rules:
```
node scripts/eval82/score.cjs --batch D --root <R> --out <O>
node scripts/eval82/score.cjs --batch C --root <R> --out <O>
node scripts/eval82/score.cjs --rules --root <R> --out <O>      # renders O/82-TIER-CHECKS.md
```
</codebase_examples>

<anti_patterns>
- Spending before the user's go, or past the ledger: the cap is the user's; raising it is their word, recorded.
- Tight retries after exit 4; reopening a stopped batch without the user.
- Changing a rule after seeing a result: a harness defect found live is fixed test-first as a post-hoc amendment
  (re-freeze with 82-06's prereg command, recorded under "Post-hoc" in 82-CHECK-RULES.md), and the rule text stays.
- Reverting without a failing verdict, or keeping a tier whose verdict is REVERT.
</anti_patterns>

<error_recovery>
- Exit 3 in D: score what exists (incomplete states are listed; P1's rule makes an incomplete D a REVERT), tell the
  user, and ask whether C still runs on the remainder (close D with `--close-batch D --reason "<words>"` first).
- A researcher run is impaired (its own runtime files denied once): the runner re-runs it once (81 post-hoc 4); if
  impaired again it is excluded and its topic x model is inconclusive under the rule.
- The grader output fails its schema: the run's verdicts are missing; the rule's inconclusive clause applies.
</error_recovery>

</embedded_context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm spend for batches D and C</name>
  <files>(none)</files>
  <action>Approve batches D and C under objective 82's $20 ledger. Claude has run the checks below first.</action>
  <instructions>
    Claude runs first, one plain command per Bash call: `node scripts/eval81/prereg.cjs --check --manifest O/results/prereg-manifest.json`;
    the same for objective 81's manifest; `test -s T && echo present`; `git rev-parse HEAD`; `claude --version`
    (compare with `claude_version` in O/results/prereg-manifest.json and 81's manifest); create R if missing and
    `node scripts/eval82/ledger82.cjs --init --root R` (skip if R/ledger.json exists); make S1 and export the HEAD
    tree to it; dry runs of D and C with `--dry-run --materialize none`.
    Present: token present or missing; both prereg checks; ledger total of $20; D: 20 states x 3 samples x 2 models =
    120 start sessions, then sonnet escalation sessions for the states the engine's rules escalate (81 saw a 40%
    Haiku split rate: expect about 6-8 states, 18-24 sessions), ~$3.8, cap $4.5; C: 2 topics x 2 dimensions x 2 models
    x 2 repeats = 16 researcher runs + 16 Sonnet grader runs, ~$2.6, cap $3.5; E's $12 stays reserved for 82-09; the
    HEAD sha under test; the Claude Code versions; the rules in one line each (P1 KEEP iff no broken state passes,
    accuracy at least the Sonnet start's, cost below the Sonnet start's; P4/P5 REVERT if Sonnet finds an item in both
    runs that Haiku finds in neither, or recall is more than 10 points lower, or fabrications more than 0.5 per run
    higher).
  </instructions>
  <verify>The user's reply is recorded in the SUMMARY with the ledger total shown.</verify>
  <done>The user replied "go D C", "go D C cap <usd>" (raise the global cap: edit only `cap_usd` in R/ledger.json and record the word), "go D only", or "stop".</done>
  <resume-signal>Type "go D C" to run both batches (up to $8 of the $20), "go D C cap <usd>" to change the global cap first, "go D only", or "stop".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Run batch D (start, then escalations) and batch C (researchers, then graders)</name>
  <files>(eval root only)</files>
  <action>
D start: the runner command for D in the background; wait for the notification. Check: status per run, no real
escape, ledger total. D escalations: the same command again (runs() now lists `-esc-` runs for the escalated states;
"nothing pending" means none were escalated, record that). C (unless the user said "go D only"):
`EVAL82_SANDBOX_ROOT=S1 node scripts/eval81/run.cjs --batch C ...` in the background; when it ends, the same command
again for the grader runs, until it reports nothing pending. After each invocation record: runs ok / not ok, the
ledger total, and the access summary (counts of `record.access` classes over the batch's records:
`node -e` over `R/runs/<X>/*/record.json`, skipping `*.prev-*`). Handle exits per context.
  </action>
  <verify>R/ledger.json: D and C complete (or stopped with a recorded reason); total <= the cap; zero `real` access; access class counts recorded</verify>
  <done>Both batches ran within the ledger with clean isolation, or stopped with the user told why.</done>
  <recovery>Exit 5: stop, show the user the diff/escape the runner reports, and wait; nothing else runs.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Score, apply the pre-registered verdicts, revert what fails, publish 82-TIER-CHECKS.md</name>
  <files>O/results/D.json, O/results/D.md, O/results/C.json, O/results/C.md, O/82-TIER-CHECKS.md, and on REVERT the tier files listed in frontmatter</files>
  <action>
1. Score D and C, then render the rules (codebase_examples). Hand checks: one D state's three Haiku verdicts and its
   escalation triple read from the records by hand agree with D.json; one C grader's verdict list agrees with C.json;
   `results/D.json` and `C.json` spend equals the ledger's batch `spent_usd`.
2. For each verdict in 82-TIER-CHECKS.md:
   - P1 REVERT: RED first: change 82-03's P1 pin test (flutter-ui-eval.test.cjs "P1 (objective 82)") to expect
     sonnet on balanced and budget, run it (fails), then set `models.ui-evaluator` balanced and budget to sonnet
     (GREEN), and change the pack CHANGELOG bullet and model-profiles.md's UI judge paragraph to "measured by 82-08
     and not applied: <the failing clause>".
   - P4 or P5 REVERT: the same pattern on model-profiles.test.cjs and that focus's budget (back to sonnet), plus
     model-profiles.md.
   - KEEP: nothing changes; model-profiles.md's sentence "measured by 82-08" gains the result in one clause.
3. Commit the results first:
   `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "docs(82-08): P1 escalation and P4/P5 follow-up measurements" --files O/results/D.json O/results/D.md O/results/C.json O/results/C.md O/82-TIER-CHECKS.md`
   then each revert as RED and GREEN commits (`test(82-08): ...`, `fix(82-08): revert <id> after its measurement`),
   running model-profiles.test.cjs and the pack tests. Delete S1 (`rm -rf` the literal S1 path) at the end.
  </action>
  <verify>82-TIER-CHECKS.md has P1, P4 and P5 sections each with a verdict and the deciding clause; every REVERT has its RED and GREEN commits and the tests pass; `node scripts/eval82/score.cjs --rules` re-run gives identical bytes</verify>
  <done>Each conditional proposal is kept or reverted by its pre-registered rule, with the numbers recorded.</done>
  <recovery>A hand check disagrees with the scorer: fix nothing frozen; record the discrepancy in 82-TIER-CHECKS.md's notes and the SUMMARY, and treat the affected verdict as the rule's inconclusive case if the disagreement changes it.</recovery>
</task>

</tasks>

<validation_gates>
<test>Scoped: model-profiles.test.cjs and `node --test plugins/aoforge-stack-flutter/lib/*.test.cjs` after any revert (scratch HOME)</test>
</validation_gates>

<verification>
- Spend approved and within the ledger; D and C scored; verdicts applied; isolation clean.
</verification>

<success_criteria>
- P1, P4 and P5 stand or are reverted on measured evidence fixed in advance, and the escalation rate is known.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-08-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the user's reply, the ledger total after D and C,
the access counts and each verdict.
</output>
