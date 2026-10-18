---
objective: 82-3-1-0-follow-ups
trd: "10"
type: standard
wave: 5
depends_on: ["82-03", "82-04", "82-08", "82-09"]
files_modified:
  - CHANGELOG.md
  - docs/USER-GUIDE.md
  - docs/AOF-TOOLS-REFERENCE.md
  - CLAUDE.md
  - site/data/aoforge.json
  - plugins/aoforge-stack-flutter/CHANGELOG.md
  - plugins/aoforge-stack-web/CHANGELOG.md
  - .aoforge/REQUIREMENTS.md
  - .aoforge/ROADMAP.md
  - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
  - ".aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-*.md (moved to todos/completed by todo complete)"
  - ".aoforge/todos/pending/<date>-measure-the-debugger-start-tier*.md (new, written by todo add; none exists at planning time)"
  - .aoforge/objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md
autonomous: true
requirements: [SC-3, SC-5, MEF-06]
must_haves:
  truths:
    - "CHANGELOG's `## [3.1.0]` section carries an objective 82 subsection (runtime paths and the guard; the build-cell fixes with the measured effect; P1-P5 as finally kept or reverted with evidence and caveats; `tokens --also-root`; objective 77's records) and `changelog check 3.1.0` passes; USER-GUIDE, AOF-TOOLS-REFERENCE and CLAUDE.md state the same facts, CLAUDE.md within its 200-line / 20,000-char budget"
    - "Objective 77's STK-01 and PCK-01..04 are Complete in REQUIREMENTS.md (checkboxes and traceability rows) and its Progress row reads 5/5 Complete with Completed 2026-10-16 (the landing date, PRs #132-#134) and 77-VERIFICATION's 2026-10-17 verification date noted beside it in the Status cell, agreeing with 77-VERIFICATION (passed 5/5)"
    - "MEF-06 is recorded from evidence in REQUIREMENTS.md and 76-VERIFICATION.md: the UI judge's start tier as 82-TIER-CHECKS.md decided it, and the debugger's start tier not measured by objective 82 (out of scope by the ROADMAP's own sentence), so MEF-06 stays Partial by design"
    - "A pending todo records the debugger's start-tier measurement as MEF-06's remaining half (written here, since none exists), and the MEF-06 rows cite it"
    - "The five tier-proposal todos each carry a `## Resolution (objective 82, <date>)` with checkable evidence (commits, pin tests and their pass lines, the 82-TIER-CHECKS verdict and any revert) and are moved by `todo complete`"
    - "`validate health`, `validate requirements` and `validate consistency` are clean; the full suite passes with watcher-shell excluded and named; 79-08's checks (CI gate self-test, node:26 Docker CI-equivalent, named guards incl. the two new ones, fleet drafter test, site data, release preconditions, both prereg checks) pass and are recorded in a 79-REVALIDATION.md addendum with the new VALIDATED_SHA"
  artifacts:
    - path: .aoforge/objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md
      provides: "the addendum: integrate/3.1.0 re-validated after objective 82"
  key_links:
    - from: .aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md
      to: "todo resolutions, MEF-06 rows, CHANGELOG and model docs"
      via: "verdicts KEEP / REVERT"
      pattern: "82-TIER-CHECKS"
    - from: "79-REVALIDATION.md validated_sha"
      to: "79-09 push precondition"
      via: "only planning files may differ between VALIDATED_SHA and the pushed head"
      pattern: "validated_sha"
---

# TRD 82-10: Docs, records and the re-validation of integrate/3.1.0

<objective>
Objective 82 lands in 3.1.0, which is not yet pushed or tagged. Write its user-facing record (CHANGELOG 3.1.0, guides,
CLAUDE.md), close the records it owns (objective 77's requirements and Progress row, MEF-06 from evidence, the five
tier todos), then re-run 79-08's validation on the whole tree and record it as an addendum to 79-REVALIDATION.md so
79-09 has a current VALIDATED_SHA.

Purpose: SC-3 (docs and todos), SC-5 (77 records, validators, full suite), MEF-06 from evidence; the release gate.
Output: docs, records, the re-validation addendum.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/objectives/82-3-1-0-follow-ups/82-TIER-CHECKS.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-MEASUREMENT.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-04-SUMMARY.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-07-SUMMARY.md
@.aoforge/objectives/82-3-1-0-follow-ups/82-11-SUMMARY.md
@.aoforge/objectives/79-reconcile-and-release-3-1-0/79-08-full-validation-TRD.md
@.aoforge/objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md

Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
Planning mode is local. Never push, tag, open or merge a PR, or dispatch a workflow (79-09/79-10 do that on the user's
word). Never port 8080. Never write the real `~/.claude`; `doctor --fix`, `validate health --repair` and
`upgrade --global` are not run here. Tests: `SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
HOME and TMPDIR under SP (`SP/home-82-10`, `SP/tmp-82-10`).

Facts:
- CHANGELOG `## [3.1.0] - 2026-10-17` has subsections per line of work (`### Model efficiency (objective 76) ...`,
  `### Stack packs ...`); its intro paragraph lists what the release ships ("objectives 73 to 80 and quick 34 to 43").
  Do not change the version date; that is the release step's.
- USER-GUIDE sections: `### Estimation data (aof-tools tokens, aof-tools calibrate)` (line ~484), `### Stack packs`
  (~617), `### Model Profiles (Per-Agent Breakdown)` (~843), `### Model Costs Too High` (~972).
- docs/AOF-TOOLS-REFERENCE.md holds the long-form command bullets (Compound init commands; Estimation data was edited
  by 82-04).
- CLAUDE.md is at its budget (147 lines, about 20,000 chars; `context-budget.repo.test.cjs` caps 200 lines and 20,000
  characters): every added clause must be paid for by trimming in the same file.
- Objective 77: 77-VERIFICATION.md status passed 5/5, coverage SATISFIED for PCK-01..04 and STK-01;
  77-RETROACTIVE-SUMMARY.md `requirements-completed: [PCK-01, PCK-02, PCK-03, PCK-04, STK-01]`, `completed: 2026-10-16`;
  REQUIREMENTS.md lines 72 and 76-79 are `- [ ]` and rows 133-137 read Pending; the ROADMAP Progress row reads
  `| 77. Stack packs: contract and extraction | v1.6 | 5/5 | In Progress | - |`. 77 landed on `main` on 2026-10-16
  (77-VERIFICATION `retroactive_note`: PRs #132/#133/#134) and was verified retroactively on 2026-10-17
  (`verified: 2026-10-17`): the Completed column takes the landing date; the verification date goes beside it, as row
  76 carries its note in the Status cell. Quick 44 closed objective 76 the same way (`requirements mark-complete`,
  bounded ROADMAP edits, diffs checked line by line).
- MEF-06: REQUIREMENTS.md line 71 (`- [ ]`) and row 132 ("Partial: escalation complete (quick 42); start-tier half not
  met ..."); 76-VERIFICATION.md row 106 (published through `verification post 76`). The debugger's start tier was not
  measured by objective 81 or 82: ROADMAP Objective 82 says so ("The debugger's start tier is not measured here and
  stays a recorded todo, so MEF-06 remains Partial by design"). No pending todo covers it at planning time (only the
  ui-evaluator tier todo mentions it, line 55).
- Todos: the five files `.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-{ui-evaluator,codebase-mapper-arch,codebase-mapper-concerns,project-researcher-architecture,project-researcher-pitfalls}.md`.
  Procedure (objective 75-04): `AOF planning draft todos/pending/<file>` → append the Resolution section (never
  shorten the body, never change `title:`) → `AOF todo add --stem <filename without .md> --from <draft>` (check it
  overwrote the same file, not a new one) → `AOF todo complete <filename>`.
- 79-REVALIDATION.md frontmatter: `verdict`, `validated_sha` (9a4b0997...), `supersedes_validated_sha`, `date`; the
  body has Suite and CI gate, Guards, Health/doctor/changelog, Release preconditions, Release hold, Changelog fold.
- Installed plugin for the changelog gate dry run: list `~/.claude/plugins/cache/aocyber/aoforge/` (3.0.0 at planning
  time) and use `<that dir>/<version>/hooks/changelog-on-tag.js`.
</context>

<embedded_context>

<codebase_examples>
Full suite, as 79-08 ran it (each line its own Bash call; write S literally):
```
git -C /Users/justin/dev/aoforge-claude ls-files -co --exclude-standard -- 'plugins/aoforge/*.test.cjs' 'plugins/aoforge/*.test.js' 'plugins/aoforge-stack-*/*.test.cjs' 'scripts/*.test.cjs'   (> S/all.txt)
rg -v 'watcher-shell\.test\.cjs$' S/all.txt   (> S/files.txt)
env HOME=S/home TMPDIR=S/tmp xargs node --test < S/files.txt > S/suite.txt 2>&1     (run_in_background; wait)
rg -n -e '^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)' -e '^not ok' S/suite.txt
```
node:26 CI-equivalent as the non-root `node` user (79-REVALIDATION):
```
docker run --rm --user node -v /Users/justin/dev/aoforge-claude:/src:ro node:26 bash -c 'cp -a /src /home/node/repo && cd /home/node/repo && rm -rf node_modules && npm ci && node --test scripts/ci-unit-gate.test.cjs && node scripts/ci-unit-gate.cjs'
```
Changelog gate dry run (no output = allowed):
```
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git tag -a v3.1.0 -m x HEAD"},"cwd":"/Users/justin/dev/aoforge-claude"}' | node <installed>/hooks/changelog-on-tag.js
```
</codebase_examples>

<anti_patterns>
- Marking MEF-06 Complete on the UI judge alone (its debugger half is unmeasured).
- Completing a todo without its Resolution evidence, or completing P1/P4/P5 as "applied" when 82-TIER-CHECKS reverted
  them (a reverted proposal completes as "measured; not applied: <clause>", which is what its todo asks for).
- Editing ROADMAP.md outside the objective 77 Progress row (and the objective 77/82 rows this TRD names).
- Adding `.github/known-test-failures.json` entries, or calling a new failure "known" without proof it fails at the
  previous VALIDATED_SHA too.
- Any push, tag, PR or deploy.
</anti_patterns>

<error_recovery>
- `requirements mark-complete` changes lines beyond the 5 checkboxes and 5 rows: `git restore .aoforge/REQUIREMENTS.md`
  and apply the changes through a draft and `doc put REQUIREMENTS.md`, checking the diff.
- Docker is unavailable: record why; the PR's CI run in 79-09 becomes the first node:26 run.
- A re-validation check fails beyond a one-line obvious fix: write the addendum with `verdict: FAIL` and the list, and
  return failed so the orchestrator plans a gap TRD (79-09 refuses to start without a PASS).
</error_recovery>

</embedded_context>

<tasks>

<task type="auto">
  <name>Task 1: CHANGELOG 3.1.0, guides, reference, CLAUDE.md, pack changelogs, site data</name>
  <files>CHANGELOG.md, docs/USER-GUIDE.md, docs/AOF-TOOLS-REFERENCE.md, CLAUDE.md, site/data/aoforge.json, plugins/aoforge-stack-flutter/CHANGELOG.md, plugins/aoforge-stack-web/CHANGELOG.md</files>
  <action>
CHANGELOG `## [3.1.0]`: add `### 3.1.0 follow-ups (objective 82)` with bullets: agents and spawns read runtime files at
an absolute path (`init` JSON `runtime_root`, the `<runtime_paths>` block, `AOForge runtime: {runtime_root}` in spawn
prompts, guard `runtime-path-reads.repo.test.cjs` on every scope; 82-09's SC-2 verdict from the transcript scan); the build-cell token fixes by Fix-list id with 82-MEASUREMENT.md's
verdict and numbers (n=2, the spread caveat); each tier proposal P1-P5 as finally kept or reverted with its evidence and
caveat (from 82-03's docs and 82-TIER-CHECKS.md: escalation rate, verdicts, cost against a Sonnet start; recall and item
matrix for P4/P5); `tokens trd|coverage|backfill --also-root <dir>` with 82-04's coverage numbers; objective 77's records
closed. Add "objective 82" to the intro's list. Run `AOF changelog check 3.1.0`.
USER-GUIDE: Estimation data (`tokens --also-root` beside calibrate's), Model Profiles (the focus overrides and the UI
judge's start tier and escalation, as finally decided), Stack packs (pack agent material uses `<runtime>`), and one
troubleshooting line under Model Costs Too High if a reverted tier changes the advice. AOF-TOOLS-REFERENCE: Compound
init commands mention `runtime_root`. CLAUDE.md: the "Where we left off" paragraph gains objective 82's outcome in one
or two sentences and the Estimation bullet `tokens ... --also-root`, paid for by trimming within the file; run
`context-budget.repo.test.cjs`. Pack changelogs: one bullet each for the runtime-path change to pack agent material
(same section rule as 82-03: `[1.0.0]` while no `<pack>--v*` tag exists). `node scripts/gen-docs-data.cjs`; if
`git status --porcelain site/data` shows a change, include it. Run doc-refs, rename, context-budget, changelog tests
(`plugins/aoforge/hooks/changelog-on-tag.test.js`, `plugins/aoforge/aoforge/bin/lib/changelog*.test.cjs`). Commit
`AOF commit "docs(82-10): 3.1.0 changelog, guides and CLAUDE.md for objective 82" --files <changed files>`.
  </action>
  <verify>`AOF changelog check 3.1.0` passes; context-budget, doc-refs and rename guards pass; `rg -n 'objective 82' CHANGELOG.md` shows the subsection and the intro mention</verify>
  <done>Every user-facing document states objective 82's changes and outcomes consistently.</done>
  <recovery>If CLAUDE.md cannot fit the clauses within budget, keep only the "Where we left off" sentence and point to CHANGELOG/USER-GUIDE.</recovery>
</task>

<task type="auto">
  <name>Task 2: Objective 77 records, MEF-06 from evidence, the five todos</name>
  <files>.aoforge/REQUIREMENTS.md, .aoforge/ROADMAP.md, .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md, .aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-*.md</files>
  <action>
1. `AOF requirements mark-complete STK-01,PCK-01,PCK-02,PCK-03,PCK-04`; `git diff .aoforge/REQUIREMENTS.md` must be
   exactly the 5 checkboxes and the 5 traceability rows (error_recovery otherwise); each row cites
   `objectives/77-stack-packs-contract-and-extraction/77-VERIFICATION.md` if the verb leaves the cell without a source
   (add it through a draft + `doc put REQUIREMENTS.md`).
2. ROADMAP Progress row for 77 → `| 77. Stack packs: contract and extraction | v1.6 | 5/5 | Complete (verified 2026-10-17, 77-VERIFICATION) | 2026-10-16 |`
   (Completed = the landing date 2026-10-16; the verification date beside it; one bounded Edit of ROADMAP.md, which
   is hand-maintained in local mode (`doc put` refuses it); `git diff` shows exactly one `-` and one `+` line).
3. MEF-06 (draft REQUIREMENTS.md; `doc put`): the traceability row states the evidence: "Partial: escalation complete
   (quick 42); UI judge start tier <KEEP: haiku on balanced and budget, escalation rate x/20, final accuracy, cost vs a
   Sonnet start (82-TIER-CHECKS.md)> | <REVERT: measured by objective 82 and not applied: <clause>>; debugger start tier
   not measured". The checkbox stays `[ ]` (both halves are not met). The same facts go into 76-VERIFICATION.md's MEF-06
   row (draft, `AOF verification post 76 --from <draft>`), frontmatter untouched. Then write the debugger todo (none
   exists; check `rg -l -i 'debugger' .aoforge/todos/pending` first and reuse one only if it is about the start tier):
   `AOF todo add --from <draft>` with title "Measure the debugger's start tier (MEF-06's remaining half)", area
   model-tiers, body: what objective 81 and 82 measured (the UI judge only), what is missing (a debugger start-tier
   check at Haiku or Sonnet with escalation, scored like 82-08's P1 rule), and the ROADMAP Objective 82 sentence that
   scoped it out; cite the todo's file name in the MEF-06 traceability row and 76-VERIFICATION's row.
4. The five todos per the procedure in context. Resolution evidence per todo: 82-03's commits and pin-test pass lines
   (`node --test --test-name-pattern '<test name>' <file>` output), and for P1, P4 and P5 the 82-TIER-CHECKS.md verdict
   with its numbers and, if reverted, 82-08's revert commits ("measured; not applied: <clause>").
5. `AOF validate requirements --raw` (no findings), `AOF validate health --raw` (no error; no W065), `AOF validate consistency --raw`
   (passed), the roadmap-coverage check named in `AOF validate --help`; and the records tests:
   `requirements-agreement.repo.test.cjs`, `requirements-agreement.test.cjs`, `validate-requirements*.test.cjs`,
   `roadmap-reconcile*.test.cjs` under the scratch HOME.
Commit `AOF commit "docs(82-10): objective 77 records, MEF-06 from evidence, tier todos resolved, debugger todo" --files .aoforge/REQUIREMENTS.md .aoforge/ROADMAP.md .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md <the todo paths the verbs wrote, the new debugger todo included>`.
  </action>
  <verify>REQUIREMENTS diff as stated; ROADMAP diff one row reading Completed 2026-10-16 with "verified 2026-10-17" beside it; `ls .aoforge/todos/completed | rg -c 'apply-objective-81-tier-proposal'` prints 5 and none remain pending; `ls .aoforge/todos/pending | rg -c 'debugger'` prints 1; validators clean; records tests pass</verify>
  <done>Objective 77's records agree with its verification, MEF-06 says exactly what the evidence shows (Partial by design, the debugger half a recorded todo), and the five todos are closed with evidence.</done>
  <recovery>`todo add --stem` wrote a new file: `todo complete` the stray as a duplicate, note it, redo with the exact stem.</recovery>
</task>

<task type="auto">
  <name>Task 3: Re-validate integrate/3.1.0 (79-08's checks) and record the addendum</name>
  <files>.aoforge/objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md</files>
  <action>
One command per Bash call, each result recorded:
1. `AOF upgrade --check --raw` (nothing pending); `AOF validate health --raw`, `validate consistency`, `validate requirements`,
   `validate docs`, roadmap-coverage, `AOF stack validate`, `AOF doctor --json` (read-only; global pre-rename leftovers
   are the user's own call, as 79-08 says).
2. Full suite per codebase_examples (background; wait): 0 fail, 0 cancelled; record tests/suites/pass/skipped/duration
   and the excluded file with its reason.
3. `env HOME=S/home node --test scripts/ci-unit-gate.test.cjs`; the node:26 Docker run (background) and its verdict
   lines (`docker info` first; record and skip if unavailable).
4. Named guards, each its own call: rename-guard, stack-neutrality, reconcile-guard, context-budget,
   runtime-path-reads, build-cell-reads (all `.repo.test.cjs` under plugins/aoforge/aoforge/bin/lib), and
   `plugins/aoforge/hooks/pre-bash-equivalence.test.js`.
5. Fleet: `env HOME=S/home AOFORGE_FLEET_ROOT=/Users/justin/dev node --test plugins/aoforge/aoforge/bin/lib/stack-drafter-fleet.test.cjs`
   (read-only); per-repo pass/skip.
6. Site data stable: `node scripts/gen-docs-data.cjs` then `git status --porcelain site/data` empty.
7. Both prereg checks (81's and 82's manifests) OK.
8. Release preconditions: the changelog gate dry run prints nothing; `git ls-files .planning` empty; no tracked conflict
   markers (`git grep -n -e '^<<<<<<< ' -e '^>>>>>>> '`); package.json, plugin.json and marketplace.json at 3.1.0;
   `git status --porcelain` shows only `?? amp`.
9. VALIDATED_SHA = `git rev-parse HEAD`.
Draft 79-REVALIDATION.md (`AOF planning draft objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md`): set
frontmatter `validated_sha` to VALIDATED_SHA, `supersedes_validated_sha` to the previous value, `date`, `verdict`
(PASS only if 1-8 pass); append `## Re-validation after objective 82 (<date>)` with every number, what landed since the
previous VALIDATED_SHA (objective 82's TRDs and the commits count), and anything that changed under `.github/` or
`hooks/hooks.json` (none expected). `AOF doc put objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md --from <draft>`;
commit `AOF commit "docs(82-10): re-validate integrate/3.1.0 after objective 82" --files .aoforge/objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md`.
  </action>
  <verify>Suite 0 fail / 0 cancelled with the named exclusion; every named guard passes; Docker verdict recorded (PASS or the reason it did not run); the addendum carries the new validated_sha and verdict</verify>
  <done>integrate/3.1.0 with objective 82 in it is proven green and the head 79-09 may push is recorded.</done>
  <recovery>On a failure that is not a one-line obvious fix: verdict FAIL with the list, return failed; nothing is pushed either way.</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (locally: npm test's globs with `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` excluded for its fish hang; CI-equivalent: node scripts/ci-unit-gate.cjs on node:26)</test>
</validation_gates>

<verification>
- Docs consistent and within budget; 77 records, MEF-06 and the todos closed from evidence; validators clean; the
  re-validation addendum PASS with a new VALIDATED_SHA.
</verification>

<success_criteria>
- 3.1.0 can be released with objective 82 in it: documented, recorded, and green the way CI will see it.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-10-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, carrying VALIDATED_SHA, the verdict and the SC-1..SC-5
evidence table for objective 82.
</output>
