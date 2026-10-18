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
  - scripts/eval82/lib/guessed-paths.cjs
  - scripts/eval82/lib/guessed-paths.test.cjs
  - "scripts/eval82/__fixtures__/runs-81/** (trimmed real transcript lines from objective 81's eval root, username replaced)"
autonomous: true
requirements: [SC-1, SC-2, SC-3]
must_haves:
  truths:
    - "`node scripts/eval82/ledger82.cjs --init --root <R>` writes a ledger the frozen objective-81 runner accepts, with a $20 global cap, order D, C, E, batch caps D $4.5, C $3.5, E $12, and A and B stopped; it refuses to overwrite an existing ledger"
    - "`ledger82.cjs --fit --root <R>` prints whether E's second build can start: D and C at their caps (or their spend once closed) + E's spend + build 1 at its $6.5 cap + build 2's reserve from the frozen reserveFor, against the global cap and E's batch cap, beside the expected case and the break-even build-1 cost; `--raise --cap <usd> [--e-cap <usd>] --reason <text>` changes only those two ledger fields through the frozen loader and saver"
    - "`lib/guessed-paths.cjs` counts, directly from a run's transcripts (tool_use deduplicated by id, plus permission denials absent from them), every Read, Glob or Grep input that starts with `~` and every absolute input under the real home's parent; on the recorded objective 81 run C-res-architecture-h-2 it finds 2 `~` Reads where `record.access` recorded none"
    - "Batch E (objective 82) is two `/aoforge:build` runs on the 3.1.0 tree, identical to 81's b31 runs except id, order and a $6.5 cap; an opt-in control adds one 3.0.0 build; the E scorer renders 82-MEASUREMENT.md comparing the new runs per role with 81's recorded 3.0.0 and 3.1.0 build runs and reports per run the scanner's `tilde` and `guessed_home` counts beside the runner's recorded `real`, `guessed_nonexistent` and `tilde_denied` classes"
    - "Batch D (objective 82) judges each of the 20 D states in its own session, 3 samples each at haiku and at sonnet, then plans sonnet escalation sessions exactly for the states the engine's own rules (scoreState, judgeEscalation, every state expect:pass) would escalate; with `EVAL82_SANDBOX_ROOT=<S>` each prompt names the screenshot by its absolute path `<S>/runs/D/<id>/work/<state>.png`; the module never opens the answer key"
    - "The D scorer reports per-arm state accuracy, broken_missed, false_fail, split and escalation rates, escalated-verdict agreement with the Sonnet start, and charged cost of a Haiku start (with escalations) against a Sonnet start (with its own estimated opus escalations), with n and Wilson intervals"
    - "Every module is written test-first on hand-built records (and, for the scanner, trimmed real 81 transcript lines); a dry run of D through `scripts/eval81/run.cjs --batch-dir scripts/eval82/batches` makes zero API calls (E's dry run is part of 82-06's rehearsal); no file under scripts/eval81 changes"
  artifacts:
    - path: scripts/eval82/ledger82.cjs
      provides: "the $20 hard-capped ledger, its build-2 fit report and the recorded cap raise"
    - path: scripts/eval82/lib/guessed-paths.cjs
      provides: "the transcript scan for `~` and guessed-home inputs SC-2 counts (E and C scorers, 82-08, 82-09)"
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
    - from: scripts/eval82/score/E.cjs
      to: scripts/eval82/lib/guessed-paths.cjs
      via: "scanGuessedPaths per run, never record.access alone"
      pattern: "scanGuessedPaths"
    - from: scripts/eval82/ledger82.cjs
      to: "82-08 and 82-09 spend gates"
      via: "--fit output shown before any spend; --raise on the user's word"
      pattern: "--fit"
---

# TRD 82-05: Objective 82's eval harness, part 1: the $20 ledger, batch E and batch D

<objective>
Objective 82 re-uses objective 81's frozen harness (`scripts/eval81/run.cjs`, its runner, sandbox, ledger library,
access classification, tripwire) without editing it, through its documented extension points: a fresh eval root with
its own ledger, batch modules loaded with `--batch-dir`, results written with `--results-dir`. This TRD builds the
ledger initialiser (with the build-2 fit report the spend gates show), the transcript scan that counts `~` and
guessed-home inputs, the build-cell re-run batch (E) and the per-state UI-judge escalation batch (D), with their
scorers, all test-first. Batch C (researcher) and the pre-registered rules follow in 82-06.

Purpose: the measurement tooling for SC-1 (re-run of the E build cell), SC-2 (the sandboxed guessed-path count) and
SC-3 (the P1 escalation rate).
Output: `scripts/eval82/` ledger, guessed-path scanner, batches E and D, scorers, README.
</objective>

<file_tree>
scripts/eval82/
├── README.md                ← CREATE
├── ledger82.cjs             ← CREATE (+ .test.cjs; --init, --fit, --raise)
├── score.cjs                ← CREATE (CLI: --batch D|E|C --root R --out O)
├── lib/guessed-paths.cjs    ← CREATE (+ .test.cjs; library + CLI --root R --batch X)
├── __fixtures__/records.cjs ← CREATE (hand-built run records and transcripts)
├── __fixtures__/runs-81/    ← CREATE (three trimmed real 81 run dirs: C-res-architecture-h-2, b31-r1, b31-r2)
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
- With `--sandbox-root S` a run's home/tmp/work live under `S/runs/<X>/<id>/{home,tmp,work}` (sandbox.cjs
  `makeSandbox`) while records stay under R; the runner stores S as `fs.realpathSync(S)`; plugin trees come from
  `S/trees.json` (`sandbox.exportTrees({repo, root: S, refs: {'3.1.0': <sha>}})`). runs() receives R, not S, so an
  absolute path inside the sandbox can only come from the environment: the live commands set `EVAL82_SANDBOX_ROOT=S`
  (82-06's batch C uses the same variable for its runtime line). The Read tool takes absolute paths, so D's judge must
  be handed `<S>/runs/D/<id>/work/<state>.png`, not a bare file name it would have to place itself.
- 81's E batch (`scripts/eval81/batches/E.cjs`): `runs({calibration})` returns 10 descriptors (kind workflow, model
  opus, profile balanced, env flags, build timeout 90 min, role `workflow:build`, cap from capForWorkflow = $15 for a
  build); `materialize` builds the notekit fixture stamped 3.0.0; `collect` runs the hidden acceptance checks.
- 81's D batch exports `loadStates`, `engineText(state, surfaces)`, `runSchema()`, `parseResults(record)`, `MODELS`;
  20 states on 4 surfaces in `scripts/eval81/fixtures/D/states.json`; the key is `fixtures/D/labels.json` (scorer only).
- Engine (`plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs`): `aggregateVotes(samples)` →
  `{is_broken, votes, split, tie}`; `scoreState({samples})` → `'pass'|'fail'|'review'` (review on a tie or a split
  with an ok majority); `judgeEscalation({live, judgeTier, reviews, states})` requests escalation for the `reviews`
  states whose samples split (`flake: true`).
- 81's per-role metrics: `scripts/eval81/lib/roles.cjs` (`rolesForRun`), stats `lib/stats.cjs` (Wilson).
- 81's recorded build runs: `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/E.json`
  (`runs[]` rows with per-run metrics, `per_role`, `outcomes`).

Why the guessed-path count needs its own scan (read `scripts/eval81/lib/access.cjs` `scanAccess`, lines ~231-262):
the runner's `record.access` holds only `real` (an existing real path outside the sandbox: an escape, exit 5),
`non_escape` entries of class `guessed_nonexistent` (a non-existent path under the real home's parent) and
`tilde_denied` (a `~` path that was DENIED), plus `impaired`. A `~` Read that was not denied is not recorded at all, and
81's E records (b30/b31) predate the field entirely. Counting `record.access` alone is therefore vacuous. Evidence in
objective 81's eval root `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81`:
- `runs/C/C-res-architecture-h-2`: haiku researcher, two undenied Reads `~/.claude/aoforge/templates/research-project/ARCHITECTURE.md`
  (tool_use `toolu_01NQahkEbCyDpsuBvTZ9FLSS`) and `~/.claude/aoforge/references/research-tooling.md`
  (`toolu_01KRddTMiGy3K9QNAorNAg7A`); each appears on its own assistant line (26, 28) and again in an
  `api-request-blob` line (33), so only dedupe by tool_use id gives 2; both returned content (this Claude Code expanded
  `~`), and `record.access` is `{"real":[],"non_escape":[],"impaired":false,...}`.
- `runs/E/b31-r2`: an executor subagent (`subagents/agent-a90723f46bd8738db.jsonl`) Read
  `/Users/aocyber/.claude/aoforge/references/tdd.md` (a guessed home); the record has no `access` field.
- `runs/E/b31-r1`: an executor Read of the real user's home `.../.claude/aoforge/references/tdd.md`, in
  `record.permission_denials` (denied); no `access` field. (Under today's runner that read is a `real` escape.)
- `runs/E/b30-r2`: a Read of `/Users/../private/tmp/claude-501/e81-<hex>/runs/E/b30-r2/home/...` (a home-parent detour
  that lands inside the sandbox: still counted, the agent did not know its home).
The scanner's classes: `tilde` = a Read `file_path`, Glob `path` or `pattern`, or Grep `path` whose string starts with
`~`; `guessed_home` = such an input that is absolute and whose text starts with `<home parent>/` (`/Users/` here). A
sandbox root is never under the home parent (the runner refuses roots that name the user), so no legitimate input of
a sandboxed run starts there. Default home parent: `path.dirname(os.userInfo().homedir)` (the passwd home, not `$HOME`,
so a scratch HOME does not move it); tests pass it explicitly.

Proposed hard cap (the 82-08 gate shows it to the user): global $20; D $4.5 (estimate ~$3.8: 60 haiku sessions
~$0.2, 60 sonnet ~$2.7, ~8 escalated states x 3 sonnet ~$1); C $3.5 (estimate ~$2.6, 82-06); E $12 (2 builds at
~$4.72 each, the mean of 81's 3.1.0 builds $4.35 and $5.09; per-run cap $6.5).
Build-2 fit (what `--fit` computes, from `ledger.canStart`: global `total + reserve <= cap_usd`, batch
`spent + cap <= batch cap`): build 2's reserve is `reserveFor(E, workflow:build, 6.5)` = 6.5 x 1.25 = 8.125 (more if
build 1 overshot). Worst case at $20: D 4.5 + C 3.5 + build 1 6.5 + 8.125 = 22.625 > 20, so build 2 is not
guaranteed; expected case: 3.8 + 2.6 + 4.72 + 8.125 = 19.245 (fits, $0.755 spare). Break-even build-1 cost =
min(cap_usd - D/C - reserve, E cap - 6.5): 3.875 with D and C at their caps, 5.475 at their estimates; E's $12 batch
cap alone stops build 2 once build 1 costs more than $5.50. At a $25 global cap and a $15 E cap the worst case fits,
and keeps fitting while build 1 overshoots its cap by up to $2 (a capped run is charged past its cap; build 2's
reserve becomes 6.5 + the overshoot): 8 + 8.5 + 8.5 <= 25 and 8.5 + 6.5 <= 15.
</context>

<embedded_context>

<codebase_examples>
Batch module interface (81-08): `module.exports = { batch: 'D', runs({root, trees, calibration}), materialize(desc, workDir, {root, trees, home}), collect(desc, workDir, {root, home, record}) }`.
Descriptor fields (validated by `contract.validateDescriptor`): `id, batch, kind ('agent'|'prompt'|'workflow'), agent,
model, plugin, prompt, tools, jsonSchema, capUsd, capBasis, timeoutMs, env, fixture, order, role`.
Reading an earlier run's record from runs() (81's C pattern): `<root>/runs/<X>/<id>/record.json` (never `*.prev-*`),
status `ok` plus `outputs`/`structured_output`.
Invocation used by the live TRDs (D and C carry the variable; E does not need it):
```
EVAL82_SANDBOX_ROOT=<S> node scripts/eval81/run.cjs --batch D --root <R82> --token-file <T> --batch-dir scripts/eval82/batches \
  --results-dir .aoforge/objectives/82-3-1-0-follow-ups/results --sandbox-root <S> [--dry-run --materialize none] --raw
node scripts/eval82/ledger82.cjs --fit --root <R82>             # shown at every spend gate
node scripts/eval82/lib/guessed-paths.cjs --root <R82> --batch D --raw
```
</codebase_examples>

<anti_patterns>
- Editing anything under scripts/eval81 (frozen); copying its modules instead of importing them.
- Opening `fixtures/D/labels.json` from the batch module (contamination: only the scorer reads the key).
- Building an absolute path from R or a guess in a prompt: the only absolute sandbox path a prompt may carry is one
  built from `EVAL82_SANDBOX_ROOT` (resolved with `fs.realpathSync`, as the runner resolves `--sandbox-root`).
- Counting guessed paths from `record.access` alone, or by matching raw lines (one tool_use appears on several lines):
  scan tool_use inputs deduplicated by id.
- Copying whole 81 transcripts into the repo (they are hundreds of KB and name the user in paths): commit only the
  trimmed lines the tests need, the real username replaced.
- Property-based or generated test data: hand-built records and transcripts only (fixture builders in `__fixtures__/`);
  the `runs-81/` extracts are recorded data, copied, never synthesised.
- Letting the escalation phase use labels: it uses only the haiku samples and the engine's rules.
</anti_patterns>

<error_recovery>
- The frozen runner refuses a ledger field this initialiser writes (validation error on load): build the ledger from
  `ledger.newLedger()` and change only `cap_usd`, `order` and the per-batch rows; run `ledger.validate`/load round
  trip in the test. `--raise` stores nothing new (the reason is printed for the SUMMARY), for the same reason.
- objective 81's eval root is gone when Task 1 runs: build `runs-81/` from the shapes quoted in context (event
  `type`, `message.content[].type: tool_use` with `id`/`name`/`input`, an `api-request-blob` repeat, a
  `tool_result` user line), say so in the SUMMARY, and keep the test names; never weaken the 2-versus-0 assertion.
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
15. `--fit --root <tmp> --raw` on the fresh ledger prints `worst` {d: 4.5, c: 3.5, e_spent: 0, build1: 6.5,
    build2_reserve: 8.125, total: 22.625, cap: 20, fits: false, e_batch: {need: 13, cap: 12, fits: false}},
    `expected` {total: 19.245, fits: true, spare: 0.755}, `break_even_build1` {at_caps: 3.875, at_estimates: 5.475},
    `cap_needed_worst` 22.625, `build2_guaranteed: false` (true only when both the global and the E-batch check fit);
    after D and C are closed with spent 3.0 and 2.0 (hand-built entries) the worst total is 19.625 and the global check
    fits while the E-batch check still fails (13 > 12); with a hand-built E entry overshooting by 2.0, build 2's reserve
    is 8.5 (cap + overshoot).
16. `--raise --cap 25 --e-cap 15 --reason "user: go D C cap 25"` leaves every other field byte-identical (diff of the
    parsed JSON), the frozen loader reloads it, and `--fit` then reports `build2_guaranteed: true`; `--raise` without
    `--reason`, or with a cap below the current total, exits 2 and leaves the file.
lib/guessed-paths.test.cjs (`__fixtures__/runs-81/` are trimmed real lines; the rest hand-built)
17. On `runs-81/C-res-architecture-h-2` (homeParent `/Users`): `tilde` 2 (the two tool_use ids above), `guessed_home`
    0, `files_scanned` 1, `tool_uses_scanned` >= 2; the same fixture's `record.json` `access.non_escape` has no entry
    of any class, so a count over `record.access` gives 0: the test asserts both numbers side by side (the old
    vacuous count fails to see what the scan sees).
18. On `runs-81/b31-r2`: `guessed_home` 1 (`/Users/aocyber/...`, from a `subagents/` file); on `runs-81/b31-r1`:
    `guessed_home` 1 with `denied: true` (its tool_use id is in `record.permission_denials`), the stored path redacted
    by the frozen `redactPath` (`<home>/...`) given the fixture's realHome `/Users/realuser`.
19. Hand-built: a Bash `cat ~/.claude/aoforge/x.md` is not counted (the shell expands `~`); a Glob with pattern
    `~/.claude/aoforge/**/*.md` and a Grep with path `/Users/someone/.claude/aoforge` are counted; a Read inside the
    run's sandbox (`/private/tmp/claude-501/e82-0123456789abcdef/runs/E/x/home/.claude/aoforge/a.md`) is not; a
    denial whose tool_use id is absent from the transcripts is counted once; a run dir with no `*.jsonl` returns
    `files_scanned: 0` (callers treat that as not scanned, never as zero).
20. CLI `node scripts/eval82/lib/guessed-paths.cjs --root <R> --batch <X> --raw` prints one row per run dir under
    `<R>/runs/<X>/` (never `*.prev-*`) with the scan counts and the record's `access` class counts (`not_recorded`
    when the record has no `access`); exit 1 with a usage line on a missing flag.
batches/E.test.cjs
3. `runs()` returns `b82-r1`, `b82-r2` whose descriptors deep-equal 81's `b31-r1`/`b31-r2` after removing id, order,
   capUsd and capBasis (fairness proof); capUsd 6.5, plugin `3.1.0`, role `workflow:build`.
4. With `EVAL82_E_CONTROL=1` in the env passed to runs(), a third run `b30c-r1` equals 81's `b30-r1` the same way
   (plugin `3.0.0`); any other value of the variable throws.
5. materialize and collect delegate to 81's E (same fixture bytes: hash of the built tree equals 81's for the same id kind).
batches/D.test.cjs
6. Start phase: 120 descriptors `D-<state>-h-<k>` and `D-<state>-s-<k>` (k 1-3), kind `prompt`, tools [Read],
   one-state jsonSchema, prompt = a one-state opening + the engine text for that state + the screenshot line; per
   state the order is h1 s1 h2 s2 h3 s3; caps haiku 0.05, sonnet 0.15.
6a. Screenshot line: with `env.EVAL82_SANDBOX_ROOT` set to a temp dir holding a `trees.json`, the line is "The
   screenshot is the file `<realpath S>/runs/D/<id>/work/<state>.png`. Open it with the Read tool." for that
   descriptor's own id (the test computes the expected path with `path.join` and checks it is absolute and contains
   no `~`); set to a relative path, or to a dir without `trees.json`, runs() throws naming the variable; unset (unit
   tests, dry runs) the line names `<state>.png` in the working directory and the descriptor carries
   `fixture.screenshot_path: 'relative'` so a live run without the variable is visible in every record.
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
13. Guessed runtime paths, per run: the scanner's `tilde` and `guessed_home` counts (lib/guessed-paths.cjs, with the
    offending inputs listed, redacted) beside the runner's recorded `real`, `guessed_nonexistent` and `tilde_denied`
    counts (`not recorded` when the record has no `access`); a run with `files_scanned: 0` prints "not scanned", never
    "none"; "none" only when every run was scanned and all five counts are 0. A fixture run whose `access` is empty
    but whose transcript holds a `~` Read (built like test 17) shows `tilde` 1, not "none".
14. `score.cjs --batch E|D --root R --out O` writes `results/<X>.json`, `results/<X>.md` and, for E,
    `82-MEASUREMENT.md` into O; deterministic for the same inputs.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fixture builders, ledger82 (--init, --fit, --raise) and the guessed-path scanner (test list 1-2, 15-20)</name>
  <files>scripts/eval82/__fixtures__/records.cjs, scripts/eval82/__fixtures__/runs-81/**, scripts/eval82/ledger82.cjs, scripts/eval82/ledger82.test.cjs, scripts/eval82/lib/guessed-paths.cjs, scripts/eval82/lib/guessed-paths.test.cjs</files>
  <action>
Fixture builders (`__fixtures__/records.cjs`): `runRecord({id, batch, model, status, charged, cost, structured, access, permission_denials, outputs})`,
`writeRunDir(root, batch, id, {record, transcripts?})` (reuse `scripts/eval81/__fixtures__/transcripts.cjs` for
transcripts), `e81Json({runs})` (a minimal 81 E.json with the fields the scorer reads). Every value literal.
Real-shape extracts (`__fixtures__/runs-81/<id>/`), copied from objective 81's eval root (context) with a one-off
node script kept in `$SP/82-05/` (never in the repo): for C-res-architecture-h-2, b31-r1 and b31-r2, the transcript
lines (verbatim JSON) whose `message.content` carries the tool_use ids of the inputs named in context, the
`tool_result` lines answering them, and the `api-request-blob` line that repeats them, written to the same relative
file path under `transcripts/` (`<session>.jsonl` or `<session>/subagents/agent-<id>.jsonl`, the long dir key
shortened to `k`); a `record.json` holding only `id`, `batch`, `status`, `permission_denials` and (C only) `access`,
verbatim. Then replace the real username with `realuser` in every copied byte, and check
`rg -n -i justin scripts/eval82/__fixtures__` prints nothing and the directory is under 40 KB.
RED: tests 1-2 and 15-20; commit `AOF commit "test(82-05): ledger82 fit/raise and the guessed-path scanner (RED)" --files <test files and fixtures>`.
GREEN:
- ledger82.cjs: CLI `--init --root <R>` builds from `ledger.newLedger()`, sets `cap_usd: 20`, `order`, batch rows, A/B
  stopped, `ledger.saveLedger`, exit 2 if the file exists. `--fit` loads with `ledger.loadLedger`, takes D and C as
  their spend when complete or stopped, else the larger of spend and cap (worst) or estimate (expected), E's spend,
  build 1 at `E_RUN_CAP_USD` 6.5 (worst) or 4.72 (expected), build 2's reserve from `ledger.reserveFor`, and prints
  the test-15 object (`--raw`) or a short table. `--raise` loads, sets `cap_usd` and, if given, `batches.E.cap_usd`,
  saves, reloads, prints the before/after and the reason.
- lib/guessed-paths.cjs: `scanGuessedPaths({transcriptsDir, denials = [], homeParent, realHome})` walks every
  `*.jsonl` under the dir (subagents included), collects tool_use blocks deduplicated by `id`, adds denials whose
  id is absent, and classifies the input fields named in context; returns `{files_scanned, tool_uses_scanned, tilde,
  guessed_home, entries: [{class, tool, path (redactPath from scripts/eval81/lib/access.cjs), denied, file}]}`.
  `recordedAccess(record)` returns the `real`, `guessed_nonexistent`, `tilde_denied` counts or `null`. CLI per test 20.
GREEN commit: `AOF commit "feat(82-05): hard-capped ledger with build-2 fit, and the transcript scan for guessed paths" --files <all task files>`.
  </action>
  <verify>`env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test scripts/eval82/ledger82.test.cjs scripts/eval82/lib/guessed-paths.test.cjs` pass; test 17 asserts 2 versus 0 on the real C-res-architecture-h-2 lines; `git status --porcelain scripts/eval81` empty</verify>
  <done>The ledger reports whether build 2 fits and can be raised on the user's word; the scanner sees the `~` and guessed-home reads that `record.access` misses, proven on objective 81's own recorded runs.</done>
  <recovery>If a copied line's shape breaks the scanner (a content block form the hand-built fixtures lacked), fix the scanner and add a hand-built case for that shape; never edit the copied line except the username.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Batch E and the E scorer (test list 3-5, 12-14 for E)</name>
  <files>scripts/eval82/batches/E.cjs, scripts/eval82/batches/E.test.cjs, scripts/eval82/score/E.cjs, scripts/eval82/score/E.test.cjs, scripts/eval82/score.cjs, scripts/eval82/README.md</files>
  <action>
RED: tests 3-5 and 12-14 (E parts); commit `AOF commit "test(82-05): batch E and its scorer (RED)" --files <test files>`.
GREEN:
- batches/E.cjs: `runs({calibration, env = process.env})` filters `E81.runs({calibration, env})` to b31-r1/b31-r2 (+
  b30-r1 under `EVAL82_E_CONTROL=1`), re-ids (`b82-r1`, `b82-r2`, `b30c-r1`), sets capUsd `E_RUN_CAP_USD` (6.5,
  exported; ledger82 imports it) with capBasis "objective 82: $6.5 per build so two fit the $12 batch cap (81's
  capForWorkflow gave $15)", order 0..n, re-validates; `materialize`/`collect` delegate to E81.
- score/E.cjs + score.cjs: per-role metrics through `scripts/eval81/lib/roles.cjs` on the new runs' transcripts; the
  recorded columns from 81's E.json (build runs only); per run `scanGuessedPaths` + `recordedAccess` (test 13); render
  `results/E.json`, `results/E.md`, `82-MEASUREMENT.md` (Method, Outcomes, Per role, Per run, Guessed runtime paths, a
  placeholder `## Mechanism checks` heading that 82-09 fills, Limits: n=2 vs n=2, Claude Code version of each side).
- README.md: what objective 82 adds, the commands (incl. `ledger82 --fit`/`--raise` and `lib/guessed-paths.cjs`), the
  cap table and the build-2 fit arithmetic, the order D, C, E, `EVAL82_SANDBOX_ROOT`, and "never edit scripts/eval81".
GREEN commit: `AOF commit "feat(82-05): build-cell re-run batch and its scorer" --files <all task files>`.
  </action>
  <verify>`env HOME=$SP/home-82-05 TMPDIR=$SP/tmp-82-05 node --test scripts/eval82/batches/E.test.cjs scripts/eval82/score/E.test.cjs` pass; 81 prereg check OK</verify>
  <done>Batch E and its scorer exist and are proven on hand-built data; the scorer's guessed-path section cannot report "none" for an unscanned run.</done>
  <recovery>If roles.cjs needs a run layout the fixture lacks, extend the fixture builder (never roles.cjs).</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Batch D with the absolute screenshot path, the D scorer, and a D dry run (test list 6-11, 14 for D)</name>
  <files>scripts/eval82/batches/D.cjs, scripts/eval82/batches/D.test.cjs, scripts/eval82/score/D.cjs, scripts/eval82/score/D.test.cjs, scripts/eval82/score.cjs, scripts/eval82/README.md</files>
  <action>
RED: tests 6-11 and test 14's D part; commit `AOF commit "test(82-05): per-state UI judge batch and D scorer (RED)" --files scripts/eval82/batches/D.test.cjs scripts/eval82/score/D.test.cjs`.
GREEN batch: D.cjs imports 81's D (`loadStates`, `engineText`, `runSchema`, `parseResults`) and the engine.
`runs({root, env = process.env})`: start descriptors per state in states.json order, h1 s1 h2 s2 h3 s3, prompt =
"Judge the UI state below on its own. Open the screenshot with the Read tool and compare it with its expected
appearance. Return one result." + engine text + the screenshot line of test 6a; jsonSchema = 81's runSchema (one
result expected); caps haiku 0.05 / sonnet 0.15 with a basis line; timeout 5 min; env as 81's D; role `ui-evaluator`;
fixture `{state, arm: 'haiku'|'sonnet'|'escalation', sample, screenshot_path: 'absolute'|'relative'}`. Escalation: for
each state whose three `-h-` records are `ok`, parse samples (`parseResults`), and with every state treated as
expect:pass compute `scoreState({samples})`; reviews = states scored `review`; `judgeEscalation({live: true,
judgeTier: 'haiku', reviews, states: [{state_id, flake: aggregateVotes(samples).split}]})`; add `-esc-1..3` (sonnet,
same screenshot line) for each requested state. materialize copies `fixtures/D/<png>` to `<workDir>/<state>.png`.
GREEN scorer: score/D.cjs reads `scripts/eval81/fixtures/D/labels.json` (broken ↔ is_broken), all D records under
`<R>/runs/D/` (never `*.prev-*`), computes the metrics of tests 9-11 with `lib/stats.cjs` Wilson intervals, prices the
opus estimate from `plugins/aoforge/aoforge/references/model-rates.json`, writes `results/D.json` and `results/D.md`.
GREEN commit `AOF commit "feat(82-05): per-state UI judge batch with engine-rule escalation, and its scorer" --files <files>`.
D dry run (zero API; E's dry run is part of 82-06's rehearsal): in `$SP/82-05/dry`, `node scripts/eval82/ledger82.cjs --init --root $SP/82-05/dry`,
export trees to an opaque scratch sandbox root `/private/tmp/claude-501/e82-dry-<16 hex>` (`sandbox.exportTrees({repo,
root, refs: {'3.1.0': 'HEAD'}})` via a node one-liner), a dummy non-empty token file `$SP/82-05/token`, then
`EVAL82_SANDBOX_ROOT=<that root> node scripts/eval81/run.cjs --batch D --root $SP/82-05/dry --token-file $SP/82-05/token --batch-dir scripts/eval82/batches --results-dir $SP/82-05/results --sandbox-root <that root> --dry-run --materialize first --raw`.
Record planned count, reserve and fit, and check by hand that the first planned prompt names
`<that root>/runs/D/<id>/work/<state>.png` and the materialized PNG exists there. Run `node scripts/eval82/ledger82.cjs --fit --root $SP/82-05/dry` and record its output.
  </action>
  <verify>All eval82 tests pass; the D dry run exits 0 planning 120 sessions with the absolute screenshot path; `rg -n 'labels' scripts/eval82/batches/D.cjs` prints nothing; `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` OK; `git status --porcelain scripts/eval81` empty</verify>
  <done>D plans 120 start sessions, each handing the judge an absolute screenshot path, and exactly the escalations the engine's rules ask for; the D scorer is proven on hand-built data; the frozen runner plans D under the $20 ledger without spending.</done>
  <recovery>A dry run refusal names its cause (exit 2 or 6): fix the module; never patch the runner. If engineText needs the profile pinned (it sets AOFORGE_MODEL_PROFILE itself), call it as 81 does; never pass labels. Delete the scratch dry roots at the end (under $SP or /private/tmp/claude-501/e82-dry-*).</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (scoped: `node --test scripts/eval82/**/*.test.cjs` under the scratch HOME; the full suite runs in 82-10)</test>
</validation_gates>

<verification>
- All new tests green; 81's prereg check OK; the D dry run plans 120 sessions with absolute screenshot paths and zero
  API calls; the guessed-path scanner reports 2 `~` Reads on 81's C-res-architecture-h-2 where `record.access` has none.
</verification>

<success_criteria>
- Objective 82's live checks can run D and E under a $20 hard cap with the frozen runner, show the user whether
  build 2 fits before spending, and score them, with SC-2's guessed-path count taken from the transcripts themselves.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-05-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the D dry-run plan (count, caps, reserves), the
`--fit` output on the fresh ledger, and the scanner's counts on the three `runs-81/` extracts.
</output>
