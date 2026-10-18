---
objective: 82-3-1-0-follow-ups
trd: "09"
type: standard
wave: 4
depends_on: ["82-07", "82-08"]
files_modified:
  - .aoforge/objectives/82-3-1-0-follow-ups/results/E.json
  - .aoforge/objectives/82-3-1-0-follow-ups/results/E.md
  - .aoforge/objectives/82-3-1-0-follow-ups/82-MEASUREMENT.md
autonomous: false
requirements: [SC-1, SC-2]
must_haves:
  truths:
    - "Before any spend the user saw: token present, both prereg checks OK, the ledger total after D and C and what is left of $20, batch E's plan (two builds on HEAD with the fixes, session model opus, profile balanced, $6.5 per run, $12 batch cap, ~$9.4), whether the second build fits the ledger, the Claude Code version against objective 81's, and the optional 3.0.0 control; and replied"
    - "Two `/aoforge:build` runs of the 81 workload ran on the fixed 3.1.0 tree in an opaque sandbox with no real escape, both passing the hidden acceptance with green tests and a passed verification"
    - "82-MEASUREMENT.md compares the new runs per role with 81's recorded 3.0.0 and 3.1.0 build runs (first-turn input, total tokens, cache writes, cost, wall time, n per cell) and fills `## Mechanism checks` with every FIX row's category count per new run and the SC-1 verdict (effect shown or not) by 82-CHECK-RULES.md section 3"
    - "SC-2's sandboxed check: the new runs have zero `tilde`, `guessed_nonexistent` and `real` access classes and no Read of a `.claude/aoforge` path outside the run's own home"
  artifacts:
    - path: .aoforge/objectives/82-3-1-0-follow-ups/82-MEASUREMENT.md
      provides: "the build-cell re-measure (SC-1) and the guessed-path check (SC-2)"
  key_links:
    - from: scripts/eval82/lib/attribution.cjs
      to: .aoforge/objectives/82-3-1-0-follow-ups/82-MEASUREMENT.md
      via: "per-run category counts for mechanismChecks"
      pattern: "Mechanism checks"
---

# TRD 82-09: Re-run the build cell on the fixed 3.1.0 tree

<objective>
After the user approves, run objective 81's build workload twice on HEAD (the 82-07 fixes and the runtime-path work
in), under the same harness, fixture, prompt, session model and profile as 81's b31 runs, score it against 81's
recorded 3.0.0 and 3.1.0 build runs, check the fix mechanisms run by run, and check that no agent guessed a home path.

Purpose: SC-1 (the re-run shows the effect), SC-2 (a sandboxed run shows no guessed home paths).
Output: results E, 82-MEASUREMENT.md.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-08-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md

Names (literal paths in every command):
- `SP` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`
- `R` = `SP/eval82` (the same eval root and ledger as 82-08); `T` = `SP/eval-auth/oauth-token` (never print it)
- `S2` = a new opaque sandbox root `/private/tmp/claude-501/e82-<16 new hex>` (a fresh one: S1's trees.json holds the
  82-08 tree)
- `O` = `.aoforge/objectives/82-3-1-0-follow-ups`
- Runner: `node scripts/eval81/run.cjs --batch E --root R --token-file T --batch-dir scripts/eval82/batches --results-dir O/results --sandbox-root S2 --raw`
  (with the control: prefix `EVAL82_E_CONTROL=1 `).
- Batch E (82-05): `b82-r1`, `b82-r2`, each identical to 81's b31 runs except id, order and the $6.5 cap; the control
  `b30c-r1` (81's b30-r1 on the v3.0.0 tree) only under `EVAL82_E_CONTROL=1`, which also needs `'3.0.0': 'v3.0.0'` in S2's trees.
- Ledger: E batch cap $12; a build's reserve is $6.5 x 1.25 = $8.125 until one build has run; the second build fits
  only if total-after-the-first + its reserve <= the global cap.
- 81's recorded build runs cost $5.09 and $4.35 (3.1.0) and $4.90 and $3.60 (3.0.0); their transcripts may still be at
  `SP/eval81/runs/E/b3{0,1}-r{1,2}` (used for the attribution comparison if present; the mechanism checks need only
  the new runs).
Never push or tag; never port 8080; never write the real `~/.claude` or a fleet repo; never edit scripts/eval81.
</context>

<embedded_context>

<codebase_examples>
```
node -e "require('./scripts/eval81/lib/sandbox.cjs').exportTrees({repo: process.cwd(), root: '<S2>', refs: {'3.1.0': '<HEAD sha>'}})"
node scripts/eval82/score.cjs --batch E --root <R> --out <O>
node scripts/eval82/lib/attribution.cjs --run <R>/runs/E/b82-r1 --role aoforge:planner --json
node scripts/eval82/lib/attribution.cjs --compare <SP>/eval81/runs/E/b31-r1 <R>/runs/E/b82-r1 --role aoforge:planner
```
</codebase_examples>

<anti_patterns>
- Claiming an effect from totals at n=2: the verdict comes from the mechanism checks and outcomes (82-CHECK-RULES §3);
  totals are reported with n and the run-to-run spread 81 saw ($1.41 to $2.06 on its own quick runs).
- Re-running a build because its numbers look bad (a run is re-run only for a harness failure, recorded).
- Printing the token or the real home in any output (the runner redacts; keep your own commands from echoing either).
</anti_patterns>

<error_recovery>
- Exit 3 before the second build: score the one run, mark the second cell missing, and tell the user; SC-1 is then
  evidenced on n=1 for the mechanisms (state it).
- A build ends `cap_hit` at $6.5: it is a measurement failure, not a fix failure; record it, report the spend, and ask
  the user whether to re-run that id with a higher cap (`--reopen --reason` on their word).
- Hidden acceptance fails on a new run: report it; that is a regression signal for 82-10's re-validation and the
  SC-1 verdict is "not shown" until explained.
</error_recovery>

</embedded_context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Confirm spend for batch E</name>
  <files>(none)</files>
  <action>Approve the build-cell re-run. Claude has run the checks below first.</action>
  <instructions>
    Claude runs first, one plain command per call: both prereg checks (82's and 81's manifests); `test -s T && echo present`;
    `git rev-parse HEAD`; `claude --version` vs the manifests' `claude_version`; read R/ledger.json (total, D and C
    spent, E cap); make S2 and export HEAD to it; the E dry run (`--dry-run --materialize none`).
    Present: token; prereg checks; ledger total and $20 minus it; E: two builds on HEAD <sha> (fixes from 82-07:
    list the FIX row ids), session model opus, profile balanced, $6.5 cap each, $12 batch cap, ~$9.4 expected, about
    30-40 minutes; whether build 2 fits after build 1 at ~$4.7; Claude Code version same or different from 81's (a
    different version confounds totals, not the mechanism checks); the option of one 3.0.0 control build for a same-day
    baseline (+~$4.2; needs the global cap raised to about $25 and E's batch cap to about $18, the user's word).
  </instructions>
  <verify>The user's reply is recorded in the SUMMARY with the ledger numbers shown.</verify>
  <done>The user replied "go E", "go E +control cap <usd>", or "stop".</done>
  <resume-signal>Type "go E" to run the two builds (up to $12), "go E +control cap <usd>" to add the 3.0.0 control with a raised cap, or "stop".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Run batch E</name>
  <files>(eval root only)</files>
  <action>
On "+control": edit R/ledger.json's `cap_usd` and `batches.E.cap_usd` to the user's numbers (record the words), add
`'3.0.0': 'v3.0.0'` to S2's export, and prefix the runner with `EVAL82_E_CONTROL=1 `. Run the E runner command in the
background and wait. Per run check: status ok, transcripts with subagent files, collect outputs (acceptance, tests,
verification_status, trd_count), `record.access` classes, charged vs cap. Handle exits per 82-08's list.
  </action>
  <verify>R/ledger.json: E complete (or stopped with a reason); total <= cap; zero `real` access; per-run access classes recorded</verify>
  <done>The build cell ran on the fixed tree inside the ledger with clean isolation.</done>
  <recovery>A run that hangs past its 90-minute timeout is recorded `timeout` and charged; report it before anything else runs.</recovery>
</task>

<task type="auto">
  <name>Task 3: Score, mechanism checks, guessed-path check, publish 82-MEASUREMENT.md</name>
  <files>O/results/E.json, O/results/E.md, O/82-MEASUREMENT.md</files>
  <action>
1. `node scripts/eval82/score.cjs --batch E --root R --out O`. Hand checks: one new run's reported cost equals its
   record; its planner first-turn input equals the first deduped assistant usage in that transcript.
2. Attribution per new run for planner and executor spawns (`--json` into `SP/82-09/`); if 81's transcripts exist,
   `--compare` b31-r1 → b82-r1 and b31-r2 → b82-r2 (and b30 → b82) for planner and executor.
3. `mechanismChecks` (scripts/eval82/check-rules.cjs) over the new runs' category counts and 82-DIAGNOSIS.md's FIX rows
   as applied. Fill 82-MEASUREMENT.md's `## Mechanism checks` (draft with `node plugins/aoforge/aoforge/bin/aof-tools.cjs planning draft objectives/82-3-1-0-follow-ups/82-MEASUREMENT.md`):
   a row per FIX row x run (category, target, count, pass/fail), the outcomes line, the SC-1 verdict sentence ("effect
   shown" only if every check passes and every outcome holds), the totals per role against both recorded versions
   with n and the 81 spread, and the attribution deltas that moved. Add `## Guessed runtime paths`: per run the access
   class counts and the count of Read inputs naming a `.claude/aoforge` path outside the run's home (must be 0 for SC-2).
   Add a short `## Reading` (what moved, what did not, limits). Publish with `doc put`.
4. `results/E.json` spend equals the ledger's E `spent_usd`. Commit
   `node plugins/aoforge/aoforge/bin/aof-tools.cjs commit "docs(82-09): build-cell re-run on the fixed 3.1.0 tree" --files O/results/E.json O/results/E.md O/82-MEASUREMENT.md`.
   Delete S2 (literal path). Keep R until 82-10 is done (its records back the numbers).
  </action>
  <verify>82-MEASUREMENT.md has Mechanism checks (one row per FIX row x run), Guessed runtime paths (zeros or the offending runs listed), Reading; the hand checks match; the commit exists</verify>
  <done>SC-1's re-run evidence and SC-2's sandboxed check are recorded with a verdict each.</done>
  <recovery>A mechanism check fails: the verdict is "not shown"; name the run, the category and the count, and return it in the SUMMARY so the orchestrator can plan a gap TRD; do not edit the rule.</recovery>
</task>

</tasks>

<validation_gates>
<test>none run here (measurement only); 82-10 runs the full suite</test>
</validation_gates>

<verification>
- Spend approved and within the ledger; both builds scored; mechanism checks and the guessed-path check recorded.
</verification>

<success_criteria>
- The fixed planner and executor are measured live on the same workload, and SC-1 and SC-2 each have a verdict.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-09-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the user's reply, the ledger total, the per-run
costs, the mechanism-check table and both verdicts.
</output>
