# Objective 82 eval harness (`scripts/eval82/`)

Objective 82 re-uses objective 81's frozen harness (`scripts/eval81/`: runner, sandbox, ledger library, access
classification, tripwire) through its documented extension points, and adds only what 82 measures:

- a fresh eval root with its own **$20 hard-capped ledger** (`ledger82.cjs`), shown at every spend gate with
  `--fit` before any money is spent;
- the **transcript scan for guessed paths** (`lib/guessed-paths.cjs`, SC-2);
- **batch E**: objective 81's build cell re-run on the 3.1.0 tree (SC-1), and its scorer;
- **batch D**: the per-state UI-judge escalation check for proposal P1 (SC-3), and its scorer;
- **batch C**: the researcher follow-up measurement for proposals P4 and P5 on two new topics (SC-3), and its scorer
  (TRD 82-06);
- **the pre-registered rules** as code (`check-rules.cjs`, 82-CHECK-RULES.md) and the freeze of this directory and
  the rules by sha256 (TRD 82-06).

**Never edit anything under `scripts/eval81/`.** It is pre-registered: from the repository root,
`node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`
must stay OK. Import its modules; never copy them. (A worktree reports one `missing` file there, the gitignored
`private/fleet-checklists.json`; that is not a change.)

## Commands

```
# 1. The ledger (never the runner's --init-ledger: that writes objective 81's $100 ledger)
node scripts/eval82/ledger82.cjs --init --root <R82>
node scripts/eval82/ledger82.cjs --fit --root <R82> [--raw]            # shown at every spend gate
node scripts/eval82/ledger82.cjs --raise --root <R82> --cap 25 --e-cap 15 --reason "user: <their words>"

# 2. A batch, through the frozen runner (D and C carry EVAL82_SANDBOX_ROOT; E does not need it)
EVAL82_SANDBOX_ROOT=<S> node scripts/eval81/run.cjs --batch D --root <R82> --token-file <T> \
  --batch-dir scripts/eval82/batches --results-dir .aoforge/objectives/82-3-1-0-follow-ups/results \
  --sandbox-root <S> [--dry-run --materialize first] --raw

# 3. Score (writes results/<X>.json, results/<X>.md and, for E, 82-MEASUREMENT.md under --out)
node scripts/eval82/score.cjs --batch E --root <R82> --out .aoforge/objectives/82-3-1-0-follow-ups
node scripts/eval82/score.cjs --batch D --root <R82> --out .aoforge/objectives/82-3-1-0-follow-ups
node scripts/eval82/score.cjs --batch C --root <R82> --out .aoforge/objectives/82-3-1-0-follow-ups [--c81 <81 C.json>]

# 4. The pre-registered verdicts for P1, P4, P5 and SC-2 (researcher runs): <out>/82-TIER-CHECKS.md
node scripts/eval82/score.cjs --rules --root <R82> --out .aoforge/objectives/82-3-1-0-follow-ups

# 5. The guessed-path scan of any batch's recorded runs
node scripts/eval82/lib/guessed-paths.cjs --root <R82> --batch D --raw

# 6. Before any spend: both pre-registrations unchanged
node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json
node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json
```

`<S>` is an opaque sandbox root such as `/private/tmp/claude-501/e82-<16 hex>` holding `trees.json` from
`sandbox.exportTrees({repo, root: S, refs: {'3.1.0': <sha>}})`; the runner refuses a root that names the user or the
checkout. The runner stores it as `fs.realpathSync(S)`, and the batch modules resolve `EVAL82_SANDBOX_ROOT` the same
way.

## The $20 ledger

| Batch | Order | Cap | Estimate | What |
|---|---|---:|---:|---|
| D | 1 | $4.5 | $3.8 | 60 haiku + 60 sonnet single-state judge sessions, plus sonnet escalations |
| C | 2 | $3.5 | $2.6 | researcher re-run (TRD 82-06) |
| E | 3 | $12 | $9.4 | two `/aoforge:build` runs at $6.5 each (optional 3.0.0 control) |
| A, B | - | $0 | - | stopped: "not an objective 82 batch" |

Global cap $20. The frozen runner enforces it: before each run `total + reserve <= cap_usd` with
`reserve = max(cap x 1.25, cap + the largest overshoot of the same batch and role)`, and per batch
`spent + cap <= the batch cap`; a batch starts only when every earlier batch in `order` (D, C, E) is complete or
stopped.

### Can E's second build start? (`ledger82.cjs --fit`)

Build 2's reserve is `reserveFor(E, workflow:build, 6.5)` = 6.5 x 1.25 = 8.125 (more if build 1 overshot).

- Worst case, fresh ledger: D 4.5 + C 3.5 + build 1 6.5 + 8.125 = **22.625 > 20**, and the E batch check
  6.5 + 6.5 = 13 > 12 fails too: build 2 is **not guaranteed**.
- Expected case: 3.8 + 2.6 + 4.72 + 8.125 = **19.245** (fits, $0.755 spare). $4.72 is the mean of objective 81's
  two 3.1.0 builds ($5.09 and $4.35).
- Break-even build-1 cost = min(cap - D - C - reserve, E cap - 6.5): **3.875** with D and C at their caps,
  **5.475** at their estimates. E's $12 batch cap alone stops build 2 once build 1 costs more than $5.50.
- At a $25 global cap and a $15 E cap the worst case fits, and keeps fitting while build 1 overshoots its cap by up
  to $2 (8 + 8.5 + 8.5 <= 25 and 8.5 + 6.5 <= 15). Raising needs the user's word: `--raise ... --reason`.

`--fit` counts D and C at their spend once they are complete or stopped, and build 1 at 0 once `b82-r1` is charged
(its cost is then in E's spend).

## Batch E (`batches/E.cjs`, `score/E.cjs`)

Objective 81's own descriptors for b31-r1 and b31-r2, re-id'd `b82-r1` and `b82-r2`, at order 0 and 1 and a $6.5 cap
(`E_RUN_CAP_USD`; 81's capForWorkflow gave $15). Prompt, session model (81's `EVAL81_E_SESSION_MODEL` switch passes
through), plugin 3.1.0, env flags, 90-minute timeout, role `workflow:build` and fixture are 81's, proven deep-equal
by a test. `EVAL82_E_CONTROL=1` adds `b30c-r1` (81's b30-r1: the 3.0.0 tree on today's Claude Code); any other value
throws. `materialize` and `collect` delegate to 81's.

The scorer compares per role (orchestrator, planner, job-checker, executor, verifier) the median and mean first-turn
input, total tokens, cache writes, cost and wall time of objective 81's recorded 3.0.0 and 3.1.0 build cells
(`results/E.json` of objective 81) with the new runs, with deltas new minus each, and renders `82-MEASUREMENT.md`
(Method, Outcomes, Per role, Per run, Guessed runtime paths, a `## Mechanism checks` heading TRD 82-09 fills, Limits).

## Batch D (`batches/D.cjs`, `score/D.cjs`)

Proposal P1 moves the ui-evaluator to haiku with escalation on split votes. Batch D measures how often that escalation
fires and what it costs, judging each state the way the engine's `--judge live` does: **one state per session**.

- **Start phase:** for each of objective 81's 20 shown states (`scripts/eval81/fixtures/D/states.json` order), six
  sessions in the order h1 s1 h2 s2 h3 s3: `D-<state>-h-<k>` (haiku, cap $0.05) and `D-<state>-s-<k>` (sonnet, cap
  $0.15), 120 in all; kind `prompt`, tools `[Read]`, plugin none, 5-minute timeout, 81's D env flags, role
  `ui-evaluator`. Prompt: a one-state opening, the engine's own per-state text (81's `engineText`) and the screenshot
  line; schema: 81's run schema held to one result.
- **Escalation phase:** the runner plans `runs()` on every invocation, so once a state's three haiku records ended
  `ok`, the engine's own rules decide, every state treated as expect:pass: `scoreState` gives the reviews,
  `aggregateVotes().split` the flake flag, `judgeEscalation({live: true, judgeTier: 'haiku', ...})` the states.
  Each gets `D-<state>-esc-1..3` (sonnet). No answer key and no sonnet sample feed the decision.
- **Screenshot line:** with `EVAL82_SANDBOX_ROOT=<S>` (absolute, holding `trees.json`, resolved with
  `fs.realpathSync` as the runner resolves `--sandbox-root`) the prompt names
  `` `<S>/runs/D/<id>/work/<state>.png` ``; a relative value or one without `trees.json` throws. Unset, the line names
  `<state>.png` in the working directory and every descriptor carries `fixture.screenshot_path: 'relative'`, so a live
  run without the variable is visible in every record. `materialize` copies exactly that state's PNG and refuses a work
  dir other than the one an absolute prompt names.
- **Scorer:** per arm (haiku start = the P1 policy, haiku raw, sonnet start) accuracy, broken_missed, false_fail,
  split and escalation rates (over complete states and over ok-labelled states), and the escalated-verdict agreement
  with the Sonnet start, each with n and a Wilson 95% interval; a state with fewer than three samples in an arm is
  incomplete, listed and left out of that arm's rates. Cost: Haiku start = charged haiku + escalation sessions;
  Sonnet start = charged sonnet sessions + an **estimate** of its own opus escalations (those states' sonnet session
  tokens priced at opus rates from `references/model-rates.json`). Only the scorer opens the answer key.

## Batch C (`batches/C.cjs`, `score/C.cjs`)

Proposals P4 and P5 move the budget profile's researcher architecture and pitfalls foci to haiku "with a follow-up
measurement ... revert if Haiku misses findings Sonnet makes". Batch C measures that on two new topics drawn from
real AOCyber products; objective 81's topic (notesearch) is the third, already measured, and is carried as recorded
context only.

- **Topics and answer key** (`fixtures/C/`): `topic-gateway.md` (modelgate, an LLM gateway in Go) and `topic-hub.md`
  (devhub, a Flutter macOS hub for a local daemon), each with the three headings objective 81's topic file has;
  `checklists-82.json` holds 11-12 architecture and 11-12 pitfalls items per topic, each with 2-4 `accept_any`
  phrasings and a named source, written before any run. `proofs.test.cjs` holds them to that shape (and to no version
  numbers).
- **Researcher runs**: 16, `C82-res-<topic>-<dim>-<h|s>-<k>` (repeat 1 of every topic x dimension before repeat 2, the
  models alternating within a pair as in 81), agent `aoforge:project-researcher`, plugin 3.1.0, caps haiku $0.3 and
  sonnet $0.6, 25 minutes. The prompt is new-project.md's researcher `Task(prompt=...)` **from the tree under test**
  (`trees['3.1.0'].path`), extracted and filled with objective 81's own functions.
- **Runtime line** (`AOForge runtime: {runtime_root}`, added to spawns by TRD 82-11): with `EVAL82_SANDBOX_ROOT=<S>`
  every `{runtime_root}` becomes the run's own `<S>/runs/C/<id>/home/.claude/aoforge` (S resolved exactly as batch D
  resolves it); without it the line is removed and any other `{runtime_root}` becomes production's fallback
  `~/.claude/aoforge`; a tree without the placeholder is used as it is. `fixture.runtime_line` records which
  (`filled`, `removed`, `absent`) in every record.
- **Grader runs**: `C82-grade-<researcher id>` for each researcher record that is ok, ran its model and collected a
  document (planned from the next runner invocation on): sonnet, tools off, objective 81's grader prompt and schema,
  the topic x dimension items (source shown as `basis`), cap $0.25, 5 minutes.
- **Scorer**: per topic x dimension x model and pooled over the new topics, recall (found / items over graded runs)
  with Wilson intervals, grader fabrications per run, the item matrix (Sonnet and Haiku found-in counts per item),
  cost per run, and per researcher run the transcript scan (`tilde`, `guessed_home`) beside the runner's recorded
  classes; objective 81's architecture and pitfalls rows under `recorded_81` (aggregate only: 81's C.json holds no
  item-level verdicts).

## The pre-registered rules (`check-rules.cjs`, 82-CHECK-RULES.md)

`.aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md` fixes, before any spend, what every live number means:
P1's keep/revert rule (section 1, batch D), P4 and P5 per dimension (section 2, batch C), the build-cell mechanism
checks for SC-1 (section 3, batch E, from 82-DIAGNOSIS.md's FIX rows as applied), SC-2's guessed-path rule (section 4)
and the spend rules (section 5). `check-rules.cjs` implements them as pure functions: `p1Verdict`,
`researcherVerdict`, `fixListAsApplied` + `mechanismChecks` (input per run: `attributionForRun`, i.e. attribution.cjs
`summarizeRole(..., {calls: true})` for the planner and executor), `guessedPathVerdict` and `renderTierChecks`.
Inconclusive data is a REVERT for P1, P4 and P5 and "not shown" for SC-1 and SC-2, never a pass.

## The freeze

`scripts/eval82/**` (unit tests excepted, the batch C proofs kept) and 82-CHECK-RULES.md are frozen by sha256 in
`.aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json`, written from the repository root with:

```
node scripts/eval81/prereg.cjs --write --out .aoforge/objectives/82-3-1-0-follow-ups/results \
  --include 'scripts/eval82/**' --include '.aoforge/objectives/82-3-1-0-follow-ups/82-CHECK-RULES.md' \
  --exclude '**/*.test.cjs' --keep 'scripts/eval82/fixtures/*/proofs.test.cjs' --claude-version "<claude --version>"
```

A harness defect found during a live run is fixed test-first, re-frozen with the same command and recorded under
"Post-hoc" in 82-CHECK-RULES.md.

## Guessed runtime paths (`lib/guessed-paths.cjs`)

The Read tool expands `~` (objective 81's run C-res-architecture-h-2 read both `~` files it asked for). The defect
objective 82 measures is an agent **building an absolute home path itself** (`/Users/<guess>/.claude/...`) instead of
using `~` or a path it was handed.

The scan reads every `*.jsonl` under a run's `transcripts/` (subagents included), collects tool_use blocks
deduplicated by id (the CLI repeats each block in an `api-request-blob` line), adds permission denials absent from
them, and classifies each Read `file_path`, Glob `path`/`pattern` and Grep `path`:

- `guessed_home`: absolute and under the real home's parent (`/Users/`): **the defect signal**;
- `tilde`: starts with `~`: counted for the record, not a failure.

Bash commands are not scanned (the shell expands `~`). The runner's `record.access` misses an allowed `~` Read by
design and objective 81's E records predate the field, so counting `record.access` alone is vacuous: the scan
reports both side by side. A run with no transcripts reports `files_scanned: 0`, which callers print as "not
scanned", never as zero. On objective 81's recorded runs (`__fixtures__/runs-81/`, trimmed real lines with the
username replaced): C-res-architecture-h-2 `tilde` 2 where `record.access` has none; b31-r2 `guessed_home` 1
(`/Users/aocyber/...`, a subagent); b31-r1 `guessed_home` 1, denied (the real home, redacted `<home>/...`).

## Tests

`node --test scripts/eval82/**/*.test.cjs` (picked up by `npm test`'s `scripts/**/*.test.cjs` glob). Every test is
hand-built data or the recorded `runs-81/` extracts; none needs the network, the claude binary or the real home.
