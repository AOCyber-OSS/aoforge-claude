---
objective: 82-3-1-0-follow-ups
trd: "05"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval82/README.md
  - scripts/eval82/ledger82.cjs
  - scripts/eval82/ledger82.test.cjs
  - scripts/eval82/batches/E.cjs
  - scripts/eval82/batches/E.test.cjs
  - scripts/eval82/batches/D.cjs
  - scripts/eval82/batches/D.test.cjs
  - scripts/eval82/score/E.cjs
  - scripts/eval82/score/E.test.cjs
  - scripts/eval82/score/D.cjs
  - scripts/eval82/score/D.test.cjs
  - scripts/eval82/score.cjs
  - scripts/eval82/__fixtures__/records.cjs
autonomous: true
requirements: [SC-1, SC-3]
must_haves:
  truths:
    - "`node scripts/eval82/ledger82.cjs --init --root <R>` writes a ledger the frozen objective-81 runner accepts, with a $20 global cap, order D, C, E, batch caps D $4.5, C $3.5, E $12, and A and B stopped; it refuses to overwrite an existing ledger"
    - "Batch E (objective 82) is two `/aoforge:build` runs on the 3.1.0 tree, identical to 81's b31 runs except id, order and a $6.5 cap; an opt-in control adds one 3.0.0 build; the E scorer renders 82-MEASUREMENT.md comparing the new runs per role with 81's recorded 3.0.0 and 3.1.0 build runs and counts guessed runtime paths"
    - "Batch D (objective 82) judges each of the 20 D states in its own session, 3 samples each at haiku and at sonnet, then plans sonnet escalation sessions exactly for the states the engine's own rules (scoreState, judgeEscalation, every state expect:pass) would escalate; the module never opens the answer key"
    - "The D scorer reports per-arm state accuracy, broken_missed, false_fail, split and escalation rates, escalated-verdict agreement with the Sonnet start, and charged cost of a Haiku start (with escalations) against a Sonnet start (with its own estimated opus escalations), with n and Wilson intervals"
    - "Every module is written test-first on hand-built records; dry runs of D and E through `scripts/eval81/run.cjs --batch-dir scripts/eval82/batches` make zero API calls; no file under scripts/eval81 changes"
  artifacts:
    - path: scripts/eval82/ledger82.cjs
      provides: "the $20 hard-capped ledger"
    - path: scripts/eval82/batches/E.cjs
      provides: "the build-cell re-run batch"
    - path: scripts/eval82/batches/D.cjs
      provides: "the P1 escalation check batch"
    - path: scripts/eval82/score.cjs
      provides: "score CLI for objective 82 batches"
  key_links:
    - from: scripts/eval82/batches/E.cjs
      to: scripts/eval81/batches/E.cjs
      via: "E81.runs() filtered to b31-r1/b31-r2, re-id'd and re-capped; materialize/collect delegated"
      pattern: "require\\('../../eval81/batches/E.cjs'\\)"
    - from: scripts/eval82/batches/D.cjs
      to: plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs
      via: "scoreState + judgeEscalation decide the escalation set"
      pattern: "judgeEscalation"
---

# TRD 82-05: Objective 82's eval harness, part 1: the $20 ledger, batch E and batch D

<objective>
Objective 82 re-uses objective 81's frozen harness (`scripts/eval81/run.cjs`, its runner, sandbox, ledger library,
access classification, tripwire) without editing it, through its documented extension points: a fresh eval root with
its own ledger, batch modules loaded with `--batch-dir`, results written with `--results-dir`. This TRD builds the
ledger initialiser, the build-cell re-run batch (E) and the per-state UI-judge escalation batch (D), with their
scorers, all test-first. Batch C (researcher) and the pre-registered rules follow in 82-06.

Purpose: the measurement tooling for SC-1 (re-run of the E build cell) and SC-3 (the P1 escalation rate).
Output: `scripts/eval82/` ledger, batches E and D, scorers, README.
</objective>

<file_tree>
scripts/eval82/
├── README.md                ← CREATE
├── ledger82.cjs             ← CREATE (+ .test.cjs)
├── score.cjs                ← CREATE (CLI: --batch D|E|C --root R --out O)
├── __fixtures__/records.cjs ← CREATE (hand-built run records and transcripts)
├── batches/E.cjs, D.cjs     ← CREATE (+ .test.cjs)
└── score/E.cjs, D.cjs       ← CREATE (+ .test.cjs)
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@scripts/eval81/README.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-12-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-10-SUMMARY.md

Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
Never push or tag; never port 8080; never write the real `~/.claude` or a fleet repo; no live API call in this TRD
(dry runs and fake claude only). Tests: `SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test <files>`; the npm test glob `scripts/**/*.test.cjs` picks
the new tests up in CI, so they must not depend on the scratchpad, the network or the real home.

Frozen: every file listed in `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`
(all of `scripts/eval81/**` except unit tests). Import from them; never edit them;
`node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`
must stay OK.

Runner facts that shape the design (scripts/eval81/lib/runner.cjs, ledger.cjs, contract.cjs):
- Batch ids are A-E only (`contract.BATCHES`); the runner loads `<batch dir>/<X>.cjs` and plans `mod.runs({root, trees, calibration})`
  on EVERY invocation, so a batch can grow pending runs later (a complete batch re-opens when runs() adds ids).
- `ledger.canStart`: global `total + reserve <= ledger.cap_usd` (read from the file), batch `spent + cap <= batches[X].cap_usd`,
  reserve = max(cap x 1.25, cap + largest overshoot of the same batch and role); `assertOrder` uses `ledger.order`
  (earlier batches must be complete or stopped). `--init-ledger` would write objective 81's $100 ledger: never use it here.
- With `--sandbox-root S` a run's home/tmp/work live under `S/runs/<X>/<id>/` while records stay under R; plugin
  trees come from `S/trees.json` (`sandbox.exportTrees({repo, root: S, refs: {'3.1.0': <sha>}})`). runs() receives
  R, not S, so a prompt must not embed an absolute work-dir path: name files relative to the session's working
  directory (the run's cwd is its work dir).
- 81's E batch (`scripts/eval81/batches/E.cjs`): `runs({calibration})` returns 10 descriptors (kind workflow, model
  opus, profile balanced, env flags, build timeout 90 min, role `workflow:build`, cap from capForWorkflow = $15 for a
  build); `materialize` builds the notekit fixture stamped 3.0.0; `collect` runs the hidden acceptance checks.
- 81's D batch exports `loadStates`, `engineText(state, surfaces)`, `runSchema()`, `parseResults(record)`, `MODELS`;
  20 states on 4 surfaces in `scripts/eval81/fixtures/D/states.json`; the key is `fixtures/D/labels.json` (scorer only).
- Engine (`plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs`): `aggregateVotes(samples)` →
  `{is_broken, votes, split, tie}`; `scoreState({samples})` → `'pass'|'fail'|'review'` (review on a tie or a split
  with an ok majority); `judgeEscalation({live, judgeTier, reviews, states})` requests escalation for the `reviews`
  states whose samples split (`flake: true`).
- 81's per-role metrics: `scripts/eval81/lib/roles.cjs` (`rolesForRun`), stats `lib/stats.cjs` (Wilson), access
  classes in `record.access` (`real`, `non_escape` with classes `tilde`, `guessed_nonexistent`, ...).
- 81's recorded build runs: `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json`
  (`runs[]` rows with per-run metrics, `per_role`, `outcomes`).

Proposed hard cap (the 82-08 gate shows it to the user): global $20; D $4.5 (estimate ~$3.8: 60 haiku sessions
~$0.2, 60 sonnet ~$2.7, ~8 escalated states x 3 sonnet ~$1); C $3.5 (estimate ~$2.6, 82-06); E $12 (2 builds at
~$4.7, per-run cap $6.5, 81's 3.1.0 builds cost $4.35 and $5.09).
</context>

<embedded_context>

<codebase_examples>
Batch module interface (81-08): `module.exports = { batch: 'D', runs({root, trees, calibration}), materialize(desc, workDir, {root, trees, home}), collect(desc, workDir, {root, home, record}) }`.
Descriptor fields (validated by `contract.validateDescriptor`): `id, batch, kind ('agent'|'prompt'|'workflow'), agent,
model, plugin, prompt, tools, jsonSchema, capUsd, capBasis, timeoutMs, env, fixture, order, role`.
Reading an earlier run's record from runs() (81's C pattern): `<root>/runs/<X>/<id>/record.json` (never `*.prev-*`),
status `ok` plus `outputs`/`structured_output`.
Invocation used by the live TRDs:
```
node scripts/eval81/run.cjs --batch D --root <R82> --token-file <T> --batch-dir scripts/eval82/batches \
  --results-dir .aoforge/objectives/82-3-1-0-follow-ups/results --sandbox-root <S> [--dry-run --materialize none] --raw
```
</codebase_examples>

<anti_patterns>
- Editing anything under scripts/eval81 (frozen); copying its modules instead of importing them.
- Opening `fixtures/D/labels.json` from the batch module (contamination: only the scorer reads the key).
- Embedding an absolute work-dir path in a prompt (the sandbox root moves it).
- Property-based or generated test data: hand-built records and transcripts only (fixture builders in `__fixtures__/`).
- Letting the escalation phase use labels: it uses only the haiku samples and the engine's rules.
</anti_patterns>

<error_recovery>
- The frozen runner refuses a ledger field this initialiser writes (validation error on load): build the ledger from
  `ledger.newLedger()` and change only `cap_usd`, `order` and the per-batch rows; run `ledger.validate`/load round
  trip in the test.
- 81's E.runs throws without both trees: it does not take trees (it takes `{calibration}`); if a later check needs
  `trees['3.0.0']`, only the control run uses it.
- The dry run reports `order` refused for D: the order list or A/B status is wrong; fix the initialiser, not the runner.
</error_recovery>

</embedded_context>

## Test list

ledger82.test.cjs
1. `--init --root <tmp>` writes `ledger.json` that `scripts/eval81/lib/ledger.cjs` loads without error, with
   `cap_usd` 20, `order` [D, C, E, A, B], D {cap 4.5, estimate 3.8}, C {cap 3.5, estimate 2.6}, E {cap 12, estimate 9.4},
   A and B `stopped` with `stop_reason` "not an objective 82 batch"; a second `--init` exits 2 and leaves the file.
2. With that ledger, `ledger.assertOrder(l, 'D')` passes, C and E are refused until D (then C) is complete or stopped,
   and `canStart` refuses an E run with cap 6.5 when the total is 12 (12 + 8.125 > 20).
batches/E.test.cjs
3. `runs()` returns `b82-r1`, `b82-r2` whose descriptors deep-equal 81's `b31-r1`/`b31-r2` after removing id, order,
   capUsd and capBasis (fairness proof); capUsd 6.5, plugin `3.1.0`, role `workflow:build`.
4. With `EVAL82_E_CONTROL=1` in the env passed to runs(), a third run `b30c-r1` equals 81's `b30-r1` the same way
   (plugin `3.0.0`); any other value of the variable throws.
5. materialize and collect delegate to 81's E (same fixture bytes: hash of the built tree equals 81's for the same id kind).
batches/D.test.cjs
6. Start phase: 120 descriptors `D-<state>-h-<k>` and `D-<state>-s-<k>` (k 1-3), kind `prompt`, tools [Read],
   one-state jsonSchema, prompt = a one-state opening + the engine text for that state + "the screenshot is the file
   `<state>.png` in your working directory" (no absolute path); per state the order is h1 s1 h2 s2 h3 s3; caps haiku
   0.05, sonnet 0.15.
7. Escalation phase: with hand-built ok records for all three haiku samples of a state whose votes split 2 ok / 1
   broken, runs() adds `D-<state>-esc-1..3` (sonnet); a state 3/0 or with a 2 broken / 1 ok majority adds none; a state
   with any haiku sample missing adds none yet.
8. materialize copies exactly that state's PNG into the given work dir; the module source never references labels.json.
score/D.test.cjs
9. On hand-built records and a hand-built key: per arm state majority, scoreState outcome, split; the Haiku-start final
   verdict takes the escalation triple's majority for escalated states; accuracy, broken_missed, false_fail, split
   rate, escalation rate (over 20 states and over ok-labelled states), escalated-verdict agreement with the Sonnet
   start, each with n and a Wilson interval.
10. Cost: Haiku start = charged haiku samples + charged escalation samples; Sonnet start = charged sonnet samples +
    an estimate of opus escalations for the sonnet arm's own escalation set (those states' sonnet session tokens
    priced at opus rates from model-rates.json), labelled "estimate".
11. Missing samples: a state with fewer than 3 samples in an arm is `incomplete` and excluded from that arm's rates
    (listed); the report says how many.
score/E.test.cjs
12. On hand-built records/transcripts for two new runs and a hand-built 81 E.json: per role (orchestrator, planner,
    job-checker, executor, verifier) medians and means of first-turn input, total tokens, cache writes, cost and wall
    for 3.0.0 (recorded), 3.1.0 (recorded) and 3.1.0-82 (new), with deltas new minus each; outcomes per run.
13. Guessed runtime paths: counts per run of `record.access` classes `tilde`, `guessed_nonexistent` and `real`, plus
    Read inputs naming a `.claude/aoforge/` path outside the run's home; zero gives "none".
14. `score.cjs --batch E|D --root R --out O` writes `results/<X>.json`, `results/<X>.md` and, for E,
    `82-MEASUREMENT.md` into O; deterministic for the same inputs.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fixture builders, ledger82, batch E and the E scorer (test list 1-5, 12-14 for E)</name>
  <files>scripts/eval82/__fixtures__/records.cjs, scripts/eval82/ledger82.cjs, scripts/eval82/ledger82.test.cjs, scripts/eval82/batches/E.cjs, scripts/eval82/batches/E.test.cjs, scripts/eval82/score/E.cjs, scripts/eval82/score/E.test.cjs, scripts/eval82/score.cjs, scripts/eval82/README.md</files>
  <action>
Fixture builders (`__fixtures__/records.cjs`): `runRecord({id, batch, model, status, charged, cost, structured, access, outputs})`,
`writeRunDir(root, batch, id, {record, transcripts?})` (reuse `scripts/eval81/__fixtures__/transcripts.cjs` for
transcripts), `e81Json({runs})` (a minimal 81 E.json with the fields the scorer reads). Every value literal.
RED: tests 1-5 and 12-14 (E parts); commit `AOF commit "test(82-05): ledger82, batch E and its scorer (RED)" --files <test files and fixtures>`.
GREEN:
- ledger82.cjs: CLI `--init --root <R>`; builds from `ledger.newLedger()`, sets `cap_usd: 20`, `order`, batch rows,
  A/B stopped; `ledger.saveLedger`; exit 2 if the file exists.
- batches/E.cjs: `runs({calibration, env = process.env})` filters `E81.runs({calibration, env})` to b31-r1/b31-r2 (+
  b30-r1 under `EVAL82_E_CONTROL=1`), re-ids (`b82-r1`, `b82-r2`, `b30c-r1`), sets capUsd 6.5 with capBasis
  "objective 82: $6.5 per build so two fit the $12 batch cap (81's capForWorkflow gave $15)", order 0..n, re-validates;
  `materialize`/`collect` delegate to E81.
- score/E.cjs + score.cjs: per-role metrics through `scripts/eval81/lib/roles.cjs` on the new runs' transcripts; the
  recorded columns from 81's E.json (build runs only); the access/guessed-path counts; render `results/E.json`,
  `results/E.md`, `82-MEASUREMENT.md` (Method, Outcomes, Per role, Per run, Guessed runtime paths, a placeholder
  `## Mechanism checks` heading that 82-09 fills, Limits: n=2 vs n=2, Claude Code version of each side).
- README.md: what objective 82 adds, the commands, the cap table, the order D, C, E, and "never edit scripts/eval81".
GREEN commit: `AOF commit "feat(82-05): hard-capped ledger, build-cell re-run batch and its scorer" --files <all task files>`.
  </action>
  <verify>`env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test scripts/eval82/ledger82.test.cjs scripts/eval82/batches/E.test.cjs scripts/eval82/score/E.test.cjs` pass; 81 prereg check OK</verify>
  <done>The ledger, batch E and its scorer exist and are proven on hand-built data.</done>
  <recovery>If roles.cjs needs a run layout the fixture lacks, extend the fixture builder (never roles.cjs).</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Batch D, start and escalation phases (test list 6-8)</name>
  <files>scripts/eval82/batches/D.cjs, scripts/eval82/batches/D.test.cjs</files>
  <action>
RED: tests 6-8; commit `AOF commit "test(82-05): per-state UI judge batch with escalation phase (RED)" --files scripts/eval82/batches/D.test.cjs`.
GREEN: D.cjs imports 81's D (`loadStates`, `engineText`, `runSchema`, `parseResults`) and the engine. runs({root}):
start descriptors per state in states.json order, h1 s1 h2 s2 h3 s3, prompt = "Judge the UI state below on its own.
Open the screenshot with the Read tool and compare it with its expected appearance. Return one result." + engine text +
the relative file line; jsonSchema = 81's runSchema (one result expected); caps haiku 0.05 / sonnet 0.15 with a basis
line; timeout 5 min; env as 81's D; role `ui-evaluator`; fixture `{state, arm: 'haiku'|'sonnet'|'escalation', sample}`.
Escalation: for each state whose three `-h-` records are `ok`, parse samples (`parseResults`), and with every state
treated as expect:pass compute `scoreState({samples})`; reviews = states scored `review`; `judgeEscalation({live: true,
judgeTier: 'haiku', reviews, states: [{state_id, flake: aggregateVotes(samples).split}]})`; add `-esc-1..3` (sonnet) for
each requested state. materialize copies `fixtures/D/<png>` to `<workDir>/<state>.png`. GREEN commit
`AOF commit "feat(82-05): per-state UI judge batch with engine-rule escalation" --files scripts/eval82/batches/D.cjs scripts/eval82/batches/D.test.cjs`.
  </action>
  <verify>`node --test scripts/eval82/batches/D.test.cjs` passes under the scratch HOME; `rg -n 'labels' scripts/eval82/batches/D.cjs` prints nothing</verify>
  <done>D plans 120 start sessions and exactly the escalations the engine's rules ask for.</done>
  <recovery>If engineText needs the profile pinned (it sets AOFORGE_MODEL_PROFILE itself), call it as 81 does; never pass labels.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: The D scorer, then dry runs of D and E through the frozen runner (test list 9-11, 14 for D)</name>
  <files>scripts/eval82/score/D.cjs, scripts/eval82/score/D.test.cjs, scripts/eval82/score.cjs, scripts/eval82/README.md</files>
  <action>
RED: tests 9-11 and test 14's D part; commit `AOF commit "test(82-05): D scorer (RED)" --files scripts/eval82/score/D.test.cjs`.
GREEN: score/D.cjs reads `scripts/eval81/fixtures/D/labels.json` (broken ↔ is_broken), all D records under
`<R>/runs/D/` (never `*.prev-*`), computes the metrics of tests 9-11 with `lib/stats.cjs` Wilson intervals and prices
the opus estimate from `plugins/aoforge/aoforge/references/model-rates.json`; writes `results/D.json` and `results/D.md`.
GREEN commit `AOF commit "feat(82-05): D scorer: escalation rate, verdicts and cost against a Sonnet start" --files <files>`.
Dry runs (zero API): in a scratch root `$SP/82-05/dry`, `node scripts/eval82/ledger82.cjs --init --root $SP/82-05/dry`,
export trees to an opaque scratch sandbox root `$SP/82-05/s` (`sandbox.exportTrees({repo, root, refs: {'3.1.0': 'HEAD'}})`
via a node one-liner), a dummy non-empty token file `$SP/82-05/token`, then
`node scripts/eval81/run.cjs --batch D --root $SP/82-05/dry --token-file $SP/82-05/token --batch-dir scripts/eval82/batches --results-dir $SP/82-05/results --sandbox-root $SP/82-05/s --dry-run --materialize first --raw`
and the same for E (expect E refused by order until D/C close in that scratch ledger: close them with
`--close-batch D --reason dry` and `--close-batch C --reason dry` in the scratch root only). Record planned run
counts, reserves and fits in the SUMMARY. If `$SP/82-05/s` names the user or checkout after realpath (the runner
refuses), use `/private/tmp/claude-501/e82-dry-<hex>` instead.
  </action>
  <verify>All eval82 tests pass; both dry runs exit 0 with planned counts D 120 and E 2; `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` OK; `git status --porcelain scripts/eval81` empty</verify>
  <done>Batches D and E and both scorers are ready; the frozen runner plans them under the $20 ledger without spending.</done>
  <recovery>A dry run refusal names its cause (exit 2 or 6): fix the module; never patch the runner. Delete scratch dry roots at the end (they are under $SP or /private/tmp/claude-501/e82-dry-*).</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (scoped: `node --test scripts/eval82/**/*.test.cjs` under the scratch HOME; the full suite runs in 82-10)</test>
</validation_gates>

<verification>
- All new tests green; 81's prereg check OK; dry runs plan D 120 and E 2 with zero API calls.
</verification>

<success_criteria>
- Objective 82's live checks can run D and E under a $20 hard cap with the frozen runner, and score them.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-05-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the dry-run plans (counts, caps, reserves).
</output>
