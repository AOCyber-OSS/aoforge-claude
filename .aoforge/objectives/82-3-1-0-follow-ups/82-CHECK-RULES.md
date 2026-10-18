# Objective 82: pre-registered check rules (P1, P4, P5, the build-cell effect, guessed paths, spend)

**Pre-registered.** Written for TRD 82-06 on 2026-10-18, before any live run of objective 82 (no batch D, C or E run
has spent anything; the ledger does not exist yet). It is frozen by sha256 in
`.aoforge/objectives/82-3-1-0-follow-ups/results/prereg-manifest.json` together with `scripts/eval82/**`, and TRDs
82-08 and 82-09 check that manifest (`node scripts/eval81/prereg.cjs --check --manifest <it>`) before spending.

Changing a rule after a result is seen invalidates it. A harness defect found during a live run is fixed test-first,
re-frozen with the same `prereg.cjs --write` command, and recorded in a "Post-hoc" section appended to this file,
labelled post-hoc wherever it is applied; it never rewrites the text below.

The rules are code in `scripts/eval82/check-rules.cjs` (`p1Verdict`, `researcherVerdict`, `mechanismChecks`,
`guessedPathVerdict`, `renderTierChecks`); `node scripts/eval82/score.cjs --rules --out <objective dir>` renders
`82-TIER-CHECKS.md` from `results/D.json` and `results/C.json`. Where this file and the code disagree, this file wins
and the code is fixed test-first as a post-hoc amendment.

Throughout, "haiku" and "sonnet" are the tiers `references/model-profiles.json` pins, and a Wilson 95% interval
(objective 81's `lib/stats.cjs`) is reported beside every rate. The intervals inform; they never decide.

## 1. P1: the UI judge starts at haiku and escalates (batch D)

P1 was approved "only if escalation keeps the verdicts right and the cost below a Sonnet start". P1 is live in
`plugins/aoforge-stack-flutter/aoforge-stack.json` `models.ui-evaluator` as opus / haiku / haiku
(quality / balanced / budget).

**What is measured** (`scripts/eval82/batches/D.cjs`, `score/D.cjs`). Each of objective 81's 20 shown states is judged
in its own session, three haiku and three sonnet samples. The production default holds: every state is treated as
`expect: pass`. Escalation follows the engine's own rules and nothing else: `scoreState` puts a state in review,
`aggregateVotes().split` flags a split vote, and `judgeEscalation({live: true, judgeTier: 'haiku', ...})` names the
states to escalate; each escalated state gets three sonnet sessions, whose majority is its final verdict. The answer
key (objective 81's `fixtures/D/labels.json`) is opened by the scorer only.

- **Haiku start** (the P1 policy): the haiku majority, replaced by the escalation majority for the escalated states.
- **Sonnet start** (the alternative): the sonnet majority. Its own escalations would go to opus and are not run.
- **Cost of the Haiku start**: the ledger's charged cost of the haiku samples plus the escalation sessions.
- **Cost of the Sonnet start**: the charged cost of the sonnet samples plus an **estimate** of its opus escalations:
  the states the sonnet arm's own samples escalate (the same engine rules, `judgeTier: 'sonnet'`), their sonnet
  sessions' tokens priced at the opus rate of `references/model-rates.json`.

**KEEP** when all three hold, over the complete states:

1. `broken_missed(Haiku start, final) = 0`: no state labelled broken ends with an ok final verdict.
2. `accuracy(Haiku start, final) >= accuracy(Sonnet start)`, compared as exact fractions k/n.
3. `cost(Haiku start incl. escalations) < cost(Sonnet start incl. its estimate)`, in US dollars.

**REVERT** when any one fails; the verdict names every failing condition.

**REVERT (inconclusive)** when any state is incomplete in either arm: fewer than three usable samples in the haiku or
sonnet arm, or an escalated state whose three escalation sessions are not all usable (a contaminated session gives
no sample), or `results/D.json` is missing. An incomplete batch D (for example a budget stop) is therefore a revert.

**REVERT means** `models.ui-evaluator` balanced and budget go back to sonnet (opus / sonnet / sonnet), test-first
(82-08). KEEP changes nothing.

Reported beside the verdict, deciding nothing: escalation rate and split rate of each arm, escalated-verdict agreement
with the Sonnet start, false_fail, and each rate's Wilson interval.

## 2. P4 and P5: budget-profile researcher architecture and pitfalls at haiku (batch C)

P4 (`focus.project-researcher.architecture`) and P5 (`focus.project-researcher.pitfalls`) were approved "with a
follow-up measurement: compare budget-profile architecture (pitfalls) research on real projects with a Sonnet run of
the same topic, on two or three topics; revert if Haiku misses findings Sonnet makes". Both are live as
opus / sonnet / haiku in `references/model-profiles.json`.

**What is measured** (`scripts/eval82/batches/C.cjs`, `score/C.cjs`). The project-researcher with the production spawn
prompt (new-project.md of the tree under test, filled with the topic) on two new topics drawn from real AOCyber
products, `gateway` (an LLM gateway in Go, `fixtures/C/topic-gateway.md`) and `hub` (a Flutter macOS hub for a local
daemon, `fixtures/C/topic-hub.md`), 2 runs per topic, dimension and model. A fixed blind Sonnet grader (objective
81's prompt and schema, tools off) grades each document against `fixtures/C/checklists-82.json`, written before any
run: 11-12 items per topic and dimension, each with its source. A run counts as **graded** only under objective 81's
rule: researcher record ok, its model ran, no contamination, a document collected, its grader ok with exactly one
valid verdict per item. Recall = found / items over graded runs; a `wrong` or `missing` verdict is not found.
Fabrications = the grader-reported fabrications per graded run.

The rule is applied **per dimension** (architecture decides P4, pitfalls decides P5) over the two new topics:

**REVERT** when any of these holds (every one that holds is named):

1. **Item lost**: on a topic, an item found by Sonnet in both of its graded runs and by Haiku in neither of its two
   graded runs.
2. **Recall**: pooled Haiku recall is more than 10 points below pooled Sonnet recall, that is
   `found_h / items_h < found_s / items_s - 0.10`, pooled over both new topics, compared exactly.
3. **Fabrications**: pooled Haiku fabrications per graded run exceed Sonnet's by more than 0.5,
   `fab_h / runs_h > fab_s / runs_s + 0.5`.

**KEEP** otherwise.

**REVERT (inconclusive)** when any topic x model of the dimension has fewer than 2 graded runs (or `results/C.json` is
missing).

**Objective 81's topic** (notesearch, measured by objective 81) is reported beside each verdict as recorded context,
carried from objective 81's `results/C.json` without recomputation. It does not vote. Its C.json holds no item-level
verdicts, so it is aggregate only (recall, fabrications, cost).

**REVERT means** that focus's budget tier goes back to sonnet (opus / sonnet / sonnet), test-first (82-08). KEEP
changes nothing.

## 3. Build-cell effect (SC-1, batch E)

SC-1 asks for the build cell's token growth to be fixed or justified. The check is mechanism first: each fix must
remove the behaviour it targets, in every new run, without breaking the outcome. Totals at n=2 carry no verdict.

**The mechanism checks** are the rows of `82-DIAGNOSIS.md`'s `## Fix list` whose disposition is FIX **as finally
applied**. TRD 82-07 records each row's outcome in a `## Fix applied` section of 82-DIAGNOSIS.md before any E run;
the line that begins with the row id there (a table row `| P-1 | ... |` or a list item `- P-1 ...`) decides: the
first of the words `FIX` or `JUSTIFY` on it is the row's final disposition, and a row it moves to JUSTIFY is not
checked. A row with no such line keeps the Fix list's disposition. A FIX row with no pre-registered machine check
below, a row whose category or target cell no longer matches the table below, or a checked row missing from the Fix
list fails its check (a post-hoc amendment is the only way to change the set).

Each check is the row's category and target count **per run**, over every new E run on the 3.1.0 tree (`b82-r1`,
`b82-r2`; the opt-in 3.0.0 control `b30c-r1` is not checked). Its input is, per run, `scripts/eval82/lib/attribution.cjs`
`summarizeRole(runDir, role, {calls: true})` for the planner and the executor spawns (the `--run <dir> --role <role>
--json --calls` rows): the per-category `mentions` and the per-call listing. A check the input cannot measure (no
spawn of the role, no per-call listing where one is needed) **fails**; it never passes by default.

The expected set (today's FIX rows; P-5 and X-2 are JUSTIFY and are not checked):

| Row | Role | Category (Fix list) | Count per run | Target (Fix list) | Passes when |
|---|---|---|---|---|---|
| P-1 | planner | `runtime_lookup` (templates) and `runtime_read:templates/trd-prompt.md` mentions on planner spawns | tool calls touching `runtime_read:templates/trd-prompt.md`, or `runtime_lookup` with a detail naming `templates` | 0 | count = 0 |
| P-2 | planner, executor | `commit_inspect`, `raw_commit`, `tool_investigation` (commit) mentions | planner: tool calls touching `commit_inspect` or `raw_commit`, or `tool_investigation` with a detail naming `commit`; executor: `commit_inspect` mentions and commit `tool_investigation` calls | 0 on the planner; executors not above 3.0.0's (3 and 1) | planner 0; executor `commit_inspect` <= 3 and commit `tool_investigation` <= 1 (b30-r1's executor counts in the diagnosis) |
| P-3 | planner | `draft_write` (`written` chars per TRD) | per TRD draft path (`...-TRD.md`), the largest single `draft_write` input in chars | at most 22,000 chars per TRD on the notekit build | every TRD <= 22,000, at least one TRD write seen |
| P-4 | planner | `tool_investigation` (non-commit) mentions | `tool_investigation` calls whose detail does not name `commit` | 0 | count = 0 |
| E-1 | executor | `runtime_read:templates/summary.md` mentions on executor spawns | the mentions, summed over executor spawns | 0 | count = 0 |
| E-2 | executor | `runtime_read:references/tdd.md` mentions on executor spawns | the mentions, summed over executor spawns | 0 | count = 0 |
| E-4 | executor | `guessed_runtime_path` mentions | the mentions, summed over executor spawns | 0 | count = 0 |
| E-5 | executor | `draft_write` tool errors (`is_error`) and `draft_write` count | per executor spawn: `draft_write` calls with `is_error`, and `draft_write` calls | 0 errors, at most 2 writes per executor | every executor 0 errors and <= 2 writes |
| X-1 | planner | `validate_publish` tool errors (`is_error`) | `validate_publish` calls with `is_error` on planner spawns | 0 | count = 0 |

(E-4 is checked on executor spawns as its row is an executor row; the guessed-path rule of section 4 covers every
transcript of every run.)

**Outcomes** must hold in every new E run: `acceptance` true, `tests_ok` true and `verification_status` `passed`
(objective 81's E collect, as `score/E.cjs` reports them); a missing outcome fails.

**"Effect shown"** = every mechanism check passes in every new E run **and** every outcome holds. Anything else is
"effect not shown", naming each failing row and run. If the Fix list as applied has no FIX row, the outcomes are
checked and the totals reported, and the verdict says that no mechanism was checked.

**Totals** (first-turn input, total tokens, cache writes, cost and wall time per role) are reported against both
recorded versions, objective 81's 3.0.0 and 3.1.0 build cells, with n=2 against n=2, and carry no verdict.

## 4. Sandbox, escapes and guessed runtime paths (SC-2)

**Sandbox.** Every D, C and E run lives under an opaque sandbox root `/private/tmp/claude-501/e82-<16 hex>` (the
runner's `--sandbox-root`, holding `trees.json` from `sandbox.exportTrees`); the runner refuses a root whose real path
names the user or the checkout (`lib/opaque.cjs`). Batches D and C carry `EVAL82_SANDBOX_ROOT=<the same root>` so the
absolute paths their prompts name (D's screenshot, C's `AOForge runtime:` line) are that run's own sandbox paths.
Each run's HOME, config dir, TMPDIR and work dir are under `<root>/runs/<batch>/<id>/`.

**Deny list.** The runner's settings deny the checkout's parent directory, the real home's `.claude/` and every
watched repo (`denyRoots`), and its tripwire watches the checkout and the real home's projects.

**Escapes.** Objective 81's post-hoc 4 classes, exactly as the frozen `scanAccess` records them in `record.access`:

- `real`: any access, allowed or denied, to an existing real path outside the sandbox other than via `~`. An
  **escape**: the runner exits 5 and the batch stops.
- `guessed_nonexistent`: an access to a path under the real home's parent (`/Users/`) that does not exist. A
  non-escape, counted.
- `tilde_denied`: a DENIED `~` path (the CLI checks a `~` path in a Bash command against the deny list as the real
  home). A non-escape, counted; the run is listed as impaired when it blocked the run's own runtime files.

The runner records nothing for an allowed `~` input: objective 81's run C-res-architecture-h-2 made two `~` Reads and
its `access` is empty. The Read tool expands `~` (that run read both files), so a `~` input is a correct way to
address the runtime, not a defect. The defect SC-2 targets is an agent **building an absolute home path itself**
(`/Users/<a guessed name>/.claude/...`) instead of using `~` or the path it was given. Because `record.access` cannot
see an allowed guessed path that happens to exist, nor objective 81's E runs (they predate the field), the check reads
the transcripts.

**SC-2's sandboxed check** is `guessedPathVerdict` over every new E run and every new C researcher run, each row the
transcript scan of `scripts/eval82/lib/guessed-paths.cjs` (Read `file_path`, Glob `path`/`pattern`, Grep `path`
inputs, every `*.jsonl` under the run's transcripts, deduplicated by tool_use id, plus denials absent from them)
beside `recordedAccess` (the runner's recorded classes; a missing `access` counts 0 for its classes and is listed):

- **FAIL** when any run has a scanned `guessed_home` input, or a recorded `real` or `guessed_nonexistent` access.
  The verdict names the run, the class and the redacted path (the real home as `<home>`, the user as `<user>`).
- **INCONCLUSIVE** (SC-2 not shown) when no run fails and any run is unscanned: `files_scanned` 0 (no transcripts)
  or `tool_uses_scanned` 0. An unscanned run is never counted as a clean zero.
- **PASS** only when every run is scanned and all three deciding counts are 0 in every run.

The scanned `tilde` count and the recorded `tilde_denied` count are reported beside the verdict for the record; they
do not decide it. A FAIL outranks an INCONCLUSIVE: a guessed path found in one run is not undone by another run that
could not be scanned. A rendered verdict states the counts in all five classes.

## 5. Spend

- **Global hard cap $20** for objective 82, in a ledger of its own (`node scripts/eval82/ledger82.cjs --init`), never
  objective 81's $100 ledger.
- **Batch caps** D $4.5, C $3.5, E $12 (estimates D $3.8, C $2.6, E $9.4); batches A and B stopped. **Order D, C, E**:
  a batch starts only when every earlier batch is complete or stopped.
- **Per-run caps** (`--max-budget-usd`): D haiku $0.05, D sonnet $0.15; C haiku researcher $0.3, C sonnet researcher
  $0.6, C grader $0.25; E $6.5 per build.
- **Charge**: the ledger charges each run the larger of its reported and its transcript-priced cost (the reserve when
  neither exists). Before each run the frozen runner requires `total + reserve <= cap` (reserve = the larger of cap x
  1.25 and cap + the largest overshoot of the same batch and role) and `batch spent + run cap <= batch cap`.
- **The build-2 fit** (`node scripts/eval82/ledger82.cjs --fit --root <R>`) is shown at both spend gates (before D and
  C in 82-08, before E in 82-09) with the cap-raise offer: whether E's second build is guaranteed, the worst and
  expected cases, and the break-even build-1 cost.
- **A cap is raised only on the user's recorded word**: `ledger82.cjs --raise --cap <usd> --e-cap <usd> --reason "user:
  <their words>"`. Never on a standing or inferred approval.
- **A budget stop** (runner exit 3) goes to the user; it is never retried, worked around or followed by a raise
  without their word.
- No live run starts unless both pre-registration checks (objective 81's and this objective's manifest) print OK.
