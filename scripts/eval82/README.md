# Objective 82 eval harness (`scripts/eval82/`)

Objective 82 re-uses objective 81's frozen harness (`scripts/eval81/`: runner, sandbox, ledger library, access
classification, tripwire) through its documented extension points, and adds only what 82 measures:

- a fresh eval root with its own **$20 hard-capped ledger** (`ledger82.cjs`), shown at every spend gate with
  `--fit` before any money is spent;
- the **transcript scan for guessed paths** (`lib/guessed-paths.cjs`, SC-2);
- **batch E**: objective 81's build cell re-run on the 3.1.0 tree (SC-1), and its scorer;
- **batch D**: the per-state UI-judge escalation check for proposal P1 (SC-3), and its scorer;
- batch C (researcher) and the pre-registered rules follow in TRD 82-06.

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

# 4. The guessed-path scan of any batch's recorded runs
node scripts/eval82/lib/guessed-paths.cjs --root <R82> --batch D --raw
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
