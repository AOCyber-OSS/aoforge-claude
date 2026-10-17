# Objective 81: pre-registration record

## 1. Status

**Frozen before the first live run.** The commit `test(81-13): freeze objective 81 pre-registration manifest`, made
with `aof-tools commit`, adds this file and `results/prereg-manifest.json`. A commit cannot carry its own hash, so
read the SHA with `git log --format=%H -1 -- .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`.

- Manifest: `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`, 84 files
  (82 in the repo, 2 extras), sha256 `438d80f98fd7e3bffecedd2930fb7e14934c208e4143b68363e512082af970c1`.
- Written at `head` `fe56ba4a5a7c4f3b9382f08307760cd215b72d25`. The freeze commit is that commit's child, and no
  frozen file changed between them.

**Rules from here on:**

1. Every live TRD (81-14 to 81-18) starts by running this command from the repo root, with the real HOME (the
   calibration extra resolves under it). It must exit 0:

   ```
   node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json
   ```

   Exit 1 lists every `changed:`, `added:` or `missing:` file. Exit 2 means the manifest is missing or malformed.
2. **An amendment before batch A's first live run** follows TRD 81-14 Task 1, in this order:
   - edit the frozen file (`decide.cjs` test-first when its behaviour changes);
   - re-run the Regenerate command (section 8);
   - fill section 9 below;
   - commit;
   - `prereg.cjs --check`;
   - only then ask for a fresh "go A".

   An amendment reply is not a go.
3. **Any change to a frozen file after the first live run** is a post-hoc deviation. It is recorded where it is
   applied, labelled post-hoc, and never replaces the text it amends (81-DECISION-RULE.md section 1).

## 2. What is frozen, and why

The manifest holds the sha256 of each file's bytes, so PNGs are covered byte for byte. A file is frozen when it
matches an include and either matches no exclude or matches a keep glob:

| List | Globs |
|---|---|
| includes | `scripts/eval81/**`, `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md`, `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/static-prompt.json` |
| excludes | `**/*.test.cjs`, `scripts/eval81/__fixtures__/fake-claude.cjs` |
| keep | `scripts/eval81/fixtures/*/proofs.test.cjs` |
| extras (hash only) | `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/fleet-checklists.json`, `~/.claude/aoforge/calibration.json` |

What that covers:

- **Harness:** `run.cjs`, `score.cjs`, `static-prompt.cjs`, `prereg.cjs`, `README.md` and `lib/*.cjs` (caps, command,
  contract, decide, ledger, report, result, roles, runner, sandbox, secret, stats, tripwire). Caps, reserves, the
  ledger rules, the command line, the isolation layers and the decision code are all in here.
- **Batch modules and scorers:** `batches/{A,B,C,D,E}.cjs` and `score/{A,B,C,D,E}.cjs`. They hold the prompts,
  descriptors, collect logic and metric definitions as code.
- **Fixtures and answer keys:**
  - A and B: `answer-key.json` and `build.cjs`.
  - C: `checklists-synthetic.json`, `checklists-researcher.json`, `fleet-commitment.json`, `grader-prompt.md`,
    `grader-schema.json`, `synthetic.cjs` and `researcher-topic.md`.
  - D: `labels.json`, `states.json`, `recipe.json`, `capture.cjs`, `png.cjs` and the 20 PNGs.
  - E: `build.cjs`, `acceptance.cjs` and `reference.cjs`.
- **The five fixture proofs** (`fixtures/{A,B,C,D,E}/proofs.test.cjs`). They are the evidence that each answer key
  is right, so they are frozen even though other tests are not.
- **The decision rule** (`81-DECISION-RULE.md`).
- **`results/static-prompt.json`** (81-07). E's scorer falls back to it for the static resident-prompt bytes.
- **`__fixtures__/` builders other than the fake binary.** These are stream-json, transcripts, canned outputs and
  calibration builders. They feed the scorers' and runner's tests, and some scorers share helpers with them.
- **The private fleet checklist, by commitment only.** The manifest records its sha256,
  `86f909f54de3ea4f95933be99d6eb23da932435b8bb6da71c5be63cd4be05115`. That equals `fleet-commitment.json`'s
  `sha256`, and no contents are copied. A machine without the file fails `--check` with
  `missing: .../private/fleet-checklists.json`.
- **The real `~/.claude/aoforge/calibration.json`, hashed read-only.** The runner reads it to size the caps.

**Not frozen:**

- Unit tests other than the five proofs. They can be fixed without changing what runs.
- `__fixtures__/fake-claude.cjs`. It is never used live.
- This file, the SUMMARYs and the TRDs.

## 3. Pins

| Pin | Value |
|---|---|
| Plugin tree 3.0.0 | `v3.0.0` = `b4a9d87030fbbdfe707514cedbd06601598e4041` |
| Plugin tree 3.1.0 | `99950509d10a9905ff2d845e09df9d6b2e55e455` (this branch's HEAD when 81-13 started) |
| `claude --version` | `2.1.302 (Claude Code)` |
| calibration.json sha256 | `e8d76a2687e0ea19b3403060b3cf7c982f96dc8fb0fa93934c0a058820ea88a1` |
| private fleet checklist sha256 | `86f909f54de3ea4f95933be99d6eb23da932435b8bb6da71c5be63cd4be05115` (= fleet-commitment.json) |
| Node | v24.13.1 |

More on the pins:

- **3.1.0 plugin tree.** `git diff --stat 10f9365f HEAD -- plugins/` was empty, so its `plugins/` is the plugin as it
  stood when objective 81 began.
- **Both trees.** They are detached worktrees under the eval root (`<R>/trees/v3.0.0`, `<R>/trees/v3.1.0`), created
  by `sandbox.ensureTrees`, which checked each tree's `plugin.json` version. `<R>/trees.json` holds the paths. A lost
  root re-creates them at these SHAs.
- **Calibration.** It gives the verifier p90 1.7634 and the job-checker p90 1.5977, equal to `caps.cjs` FALLBACK_P90.
  It has no row for codebase-mapper, project-researcher, judge or grader, so those use FALLBACK_P90. Running
  `aof-tools calibrate` before or during the live batches changes the hash. Then `--check` fails, and the tripwire
  stops a running batch with exit 5.

## 4. Dry run (SC-1)

Each command ran with `--root <R> --token-file <T> --dry-run --materialize first --raw` (`--init-ledger` on A
only), in the order A, B, D, E, C. E was also run with `--materialize all`, so that both trees got a runtime mirror.

| Batch | Exit | Planned runs | Materialised check |
|---|---|---|---|
| A | 0 | 36 | `A-A1-haiku-r1`: sandbox `.claude/aoforge/.plugin-version` = 3.1.0 |
| B | 0 | 36 | `B-B1-haiku-r1`: mirror 3.1.0 |
| D | 0 | 24 | `D-home-haiku-r1`: no plugin; cwd = `D.workDirFor(R, id)` = the five `Screenshot file:` paths in the prompt, all present; the prompt is the last argv element, after `--` |
| E | 0 | 10 | all 10: the 3.1.0 runs mirror 3.1.0 and the 3.0.0 runs mirror 3.0.0; the managed CLAUDE.md is present; the fixture HEAD is `345a708e` in every run and in a separate scratch build; the fixture's own tests pass 6/6 |
| C | 0 | 48 agent runs; 48 graders are listed on the second invocation | `C-map-tech-a-s-1`: mirror 3.1.0 (synthetic); the first fleet run `C-map-tech-b-h-1` was materialised through `C.materialize`, see below |

The fleet run check for C:

- `<R>/cache/C/fleet-prepared` has no legacy planning directory and no `.claude/`.
- It has `.aoforge/`, a clean status and no remote.
- The fleet source's HEAD and porcelain status were unchanged.

Across all five dry runs:

- No API call was made, and the claude binary was never spawned.
- The token file was only stat'ed: `token_file_present: true`, and `test -s` exited 0.
- The ledger total is $0.00, and every batch is `pending`.

## 5. Projection, for the user's batch checkpoints

Caps come from the real calibration, read-only. Every cap includes a base-prompt allowance: the 36K-token cached
base prompt priced over 40 turns for an agent and 3 for a prompt.

| Batch | Runs | Cap per run | Sum of caps | Sum of reserves | Base-prompt share | Estimate | Batch cap | A run can start while batch spend is at most |
|---|---|---|---|---|---|---|---|---|
| A verifier | 36 (18 haiku, 18 sonnet) | haiku $0.45975, sonnet $1.9974 | $44.23 | $55.29 | $4.55 | $5 | $7.50 | haiku $7.04, **sonnet $5.50** |
| B job-checker | 36 (18 + 18) | haiku $0.418325, sonnet $1.8317 | $40.50 | $50.63 | $4.55 | $4 | $6 | haiku $5.58, **sonnet $4.17** |
| D UI judge | 24 sessions (12 + 12) | haiku $0.25558, sonnet $0.6008 | $10.28 | $12.85 | $1.28 | $2 | $3 | haiku $2.74, **sonnet $2.40** |
| E 3.0.0 vs 3.1.0 | 10 (6 quick, 4 build; opus session) | quick $6, build $15 | $96.00 | $120.00 | $6.12 | $44 | $55 | quick $49, **build $40** |
| C mapper, researcher | 48 agents + 48 graders | mapper h $0.5189, s $2.234; researcher h $0.7689, s $3.00; grader $0.6008 | $103.04 (agents $74.20 + graders $28.84) | $128.80 | $10.91 | $28 | none (global $100 only) | n/a |
| **Total** | **202** | | **$294.04** | **$367.55** | **$27.41** | **$83 vs the $100 cap** | | |

How the ledger enforces these limits:

- Before each spawn, a run must fit two limits:
  - the global one: `total + reserve <= $100`;
  - the batch one: `batch spent + that run's cap <= batch cap`.
- A refused run stops the batch with exit 3, and the user decides what happens next.
- The sum of caps exceeding a batch cap is by design: caps bound a run's turns, and the ledger charges actual spend.
- The batch rule has one consequence that matters. Every A, B and D sonnet run reserves its whole cap against the
  batch cap. So the batch stops well before its spend reaches the batch cap.

### Where a batch is likely to end with fewer than 2/3 of its runs scored (INSUFFICIENT)

Each column below is the largest uniform multiple of the estimate at which the condition still holds. Run costs are
assumed proportional to their caps, in planned order, with every run ok.

| Batch | Completes all runs at | Both models reach 2/3 of planned at | Flat average per run that still completes / still reaches 2/3 |
|---|---|---|---|
| A | <= 1.17 x estimate ($5.85) | <= 1.80 x (haiku <= $0.094, sonnet <= $0.41 per run) | $0.16 / $0.25 |
| B | <= 1.10 x ($4.40) | <= 1.71 x (haiku <= $0.070, sonnet <= $0.31) | $0.12 / $0.19 |
| D | <= 1.31 x | <= 2.06 x (haiku <= $0.10, sonnet <= $0.24) | $0.11 / $0.17 |
| E | <= 1.08 x ($47.5); the binding run is `b31-r2`, the last 3.1.0 build | n/a (E is a measurement) | $4.44 / n/a |
| C | <= 1.59 x, with A, B, D and E at their estimates ($55 before C); **<= 1.00 x if A, B, D and E each reach their batch caps ($71.50 before C)** | same: every researcher dimension needs 2 of 2 scored, and graders run last | $0.47 per run (agents and graders) |

What the 2/3 need means per batch:

- **A and B:** 2/3 of 18 per model is 12 runs each. In the interleaved order, that is the first 24 runs (two full
  repeats).
- **D:** 2/3 is 40 of 60 samples per model, which is 8 of 12 sessions.
- **Exclusions:** any excluded run (`cap_hit`, an error, contamination) among those raises the number of runs that
  must complete.

The four scenarios below replay the planned order through the real `ledger.cjs` (`canStart`, `recordRun`). Each one
stops a batch at its first refusal and assumes the user then closes it. The models are labelled
`<scored>/<planned>`:

| Scenario | A | B | D | E | C | Total |
|---|---|---|---|---|---|---|
| At the estimates | 36/36 | 36/36 | 24/24 | 10/10 | 48/48, 48 graders | $83.00 |
| Estimates x 1.5 | stops at 29 (haiku 15/18, sonnet 14/18), 2/3 ok | stops at 26 (13/18, 13/18), 2/3 ok | stops at 21, 2/3 ok | 8/10 (stops at `b30-r2`) | 48 agents, **45 graders: researcher architecture (sonnet) and pitfalls (both models) INSUFFICIENT** | $99.46 |
| Calibration p50 (verifier $0.3134, job-checker $0.2066 for sonnet, 0.25x for haiku, no base overhead; D sonnet $0.15, haiku $0.03) | stops at 29, 2/3 ok | stops at 33, 2/3 ok | 24/24 | 10/10 | complete | $83.91 |
| Calibration p50 plus each run's base allowance (D sonnet $0.20, haiku $0.04; E at 1.25x) | **stops at 18 (haiku 9/18, sonnet 9/18): verifier INSUFFICIENT, and the A gate is not established** | **stops at 18 (9/18, 9/18): job-checker INSUFFICIENT** | stops at 21, 2/3 ok | 9/10 (stops at `b31-r2`) | complete | $87.25 |

**Plainly:**

- **A and B are the batches at risk.** They complete at their estimates. But the calibration's production median
  for one sonnet verifier spawn is $0.31, and for a job-checker $0.21. A headless `--agent` session adds its own
  cached base prompt on top. At those costs both batches stop at about half their runs. Each role is then
  INSUFFICIENT.
- **A failure in A spreads.** If A ends INSUFFICIENT, decision rule step 6 (the A gate is not established) turns
  every role that would otherwise be WEAK_ENDORSE into INSUFFICIENT.
- **The open question is the real per-run cost on these small fixtures.** The fixtures are smaller than production
  objectives, so the cost may well be lower. A's first few runs will show it.
- **D keeps 2/3 in every scenario above.** It loses its last sonnet sessions if a sonnet session averages above about
  $0.11.
- **E loses its last 3.1.0 build (`b31-r2`) if a build averages above about $6.9.** The production planner's median
  alone is $7.19, so this is likely. 3.1.0 build would then have one run against 3.0.0's two. E decides no outcome,
  but the comparison weakens.
- **C has no batch cap, so it absorbs what A, B, D and E leave.**
  - If those batches run to their batch caps, C's $28 estimate is the most it can spend.
  - A shortfall lands on the graders, which run last. Every researcher dimension needs 2 of 2 graded runs, so even
    one missing grader makes that dimension INSUFFICIENT.
- **The ledger never lets the total pass $100,** in any scenario.

### Options for the user (none applied here)

Each option below that changes a frozen file is a pre-run amendment if made before batch A's first live run (81-14
Task 1), and post-hoc after it.

1. **Pilot within A, no change.** Run `run.cjs --batch A ... --stop-after 4`. Those are the first four planned runs:
   A1 haiku, A1 sonnet, A2 sonnet and A2 haiku. Then read their charged costs and re-project. Batch A stays
   `running`, and the same command continues it. Nothing frozen changes.
2. **Raise A's and B's (and D's) batch caps within $100.** For example, A $12, B $10, D $4.
   - E's or C's share must shrink to stay under $100. C keeps $29+ only if E's cap drops to about $45, which is about
     E's estimate.
   - The caps live in `ledger.cjs` `BATCH_CAPS` (frozen; change it test-first and regenerate the manifest).
   - They also live in the existing `<R>/ledger.json` rows, which were created with the old caps. Before any spend,
     move that file aside and run `--init-ledger` again. No results exist yet, so this is allowed.
3. **Lower the sonnet per-run caps** for verifier and job-checker, for example to $1.00. A's sonnet start threshold
   rises to $6.50, and B's to $5.00. The risk is that a sonnet run that hits its cap is `cap_hit` and excluded, which
   lowers the scored share. The caps live in `caps.cjs` (frozen).
4. **Reserve an expected cost, not the cap, against the batch cap.** For example, `batch spent + p50-based estimate
   <= batch cap`, keeping the global reserve rule. This is a `ledger.cjs` change, test-first. It is the most flexible
   option and the largest change.
5. **Accept the limits and decide at exit 3.** When a batch stops on `batch_cap`, the user can raise that batch's
   `cap_usd` in `<R>/ledger.json` and re-run the same command, recorded as a post-hoc deviation. Or the user can
   close the batch with `--close-batch X --reason <text>`.

## 6. Rehearsal (Task 2): every batch end to end on the fake claude

**Setup.**

- Rehearsal root R2 = `.../scratchpad/eval81-rehearsal`. R's `trees.json` was copied, so R2 used the same trees.
- The token was a random dummy, in `R2/dummy-token`.
- Every runner call passed `--claude-bin scripts/eval81/__fixtures__/fake-claude.cjs` and
  `--results-dir R2/out/results`. No real `claude` process ran.

**The runs.**

| Batch | Runs | Status | Spent |
|---|---|---|---|
| A | 36 | ok | $4.42296 |
| B | 36 | ok | $4.05 |
| D | 24 | ok | $1.02768 |
| E | 10 | ok | $19.20 |
| C | 48 agents | ok | $7.41976 |

- Every batch exited 0, with no tripwire diff and no escape attempt.
- Every run's isolation proof passed: a sandbox project dir, no real projects entry.
- E's charge is the transcript sum: opus transcripts priced at the real rates come to twice the fake's
  reported cost. This shows the max(reported, transcript) charge working.

**C graders.**

- C's second invocation listed no grader, because the fake writes no mapper or researcher document.
- To drive the grader path, a stand-in document was seeded into 3 rehearsal records: a synthetic mapper, a fleet
  mapper and a researcher.
- The third invocation then ran 3 graders: sonnet, `--tools ""`, `--json-schema`, no plugin, cap $0.6008. The batch
  went complete -> running -> complete. C total $7.60.
- The layout 81-11 assumed was confirmed: `<root>/runs/C/<id>/{record.json, outputs/outputs.json, work, tmp,
  stream.jsonl}`, with a run-local TMPDIR, HOME and CLAUDE_CONFIG_DIR.

**Scoring.**

- `score.cjs --batch X --root R2 --out R2/out` worked for all five batches, and each results JSON has a `spend`
  block.
- `--report` rendered `81-HAIKU-EVAL.md`, with every role INSUFFICIENT, as expected on fakes.
- E's scorer rendered `81-MEASUREMENT.md`.
- Exclusions:
  - D: 24 unparsed.
  - C: 45 with no document collected, and 3 ungraded.
  - A and B: none. A run with no published verdict is a scored abstention.

**Rebuild (W1).** `--rebuild-ledger --root R3 --results-dir R2/out/results` into a fresh R3 rebuilt the ledger:

- total $36.30064, equal to R2's;
- per-batch spent and status equal;
- 157 entries with the same ids.

**Refusal and secret scan.**

- `--init-ledger` against `R2/out/results` was refused with exit 2.
- `scanForSecret` over R2 found the dummy token only in `dummy-token` itself. Over R3 it found nothing.

## 7. Known limitations and open questions

1. **The run id is in the session's cwd** (`<R>/runs/<X>/<id>/work`), for every batch.
   - **A:** `A-A5-haiku-r1` names the fixture and the model, and it shows in A5's MODULE_NOT_FOUND trace. It names
     no planted defect and no answer-key word, and neither does the prompt.
   - **C:** the ids (`C-map-tech-b-h-1`) name the role, the focus, the codebase letter and the model letter.
   - **The fix:** opaque work-dir names in `sandbox.makeSandbox` (81-08's file, frozen). That is a pre-run amendment
     option.
2. **D shows each broken state beside its ok baseline.** One D session judges one surface, and each broken state is
   that surface's ok state plus one CSS injection. So a session sees both and can compare them. The per-repeat
   shuffle, the per-state expected text and the "judge each screenshot alone" instruction mitigate this; they do not
   remove it.
3. **Answer-key material is reachable by Bash from inside the eval root.** The settings deny list covers this
   checkout's parent dir, the real `~/.claude` and the fleet source, not R. Bash is not path-scoped.
   - (a) `<R>/trees/v3.1.0` is a full checkout of this branch, so it includes `scripts/eval81/fixtures` (A and B
     answer keys, D labels, C checklists). A read naming `scripts/eval81` or `answer-key` is caught as
     contamination; a blind recursive grep is not.
   - (b) **`<R>/fleet/fleet-checklists.json` is a byte-identical copy of the private fleet checklist** (sha256
     `86f909f5...`). It is 81-06's durable scratch backup, and `<R>/fleet/` also holds 81-06's prepared fleet
     clone. `<R>/d-capture` holds 81-05's capture work.
   - (c) `<R>/cache/C/fleet-src` is the clone `prepareFleet` copies from. It still holds the fleet's legacy planning
     directory, with no codebase map or research inside.
   - **Recommended before batch C (the user's call):** move `<R>/fleet` and `<R>/d-capture` out of R, for example
     `mv <R>/fleet <scratchpad>/eval81-private-backup`. That keeps the backup. A direct read of a path naming
     `fleet-checklists` is still flagged by C's contamination patterns.
4. **81-08's first-live-run risks.**
   - The prompt goes last, after `--`. Commander treats `--` as the end of options, but this has not been observed
     live.
   - The tools check reads the init event of an `--agent` session.
   - If the real CLI saves the token under the sandbox HOME, or lists tools differently, the batch exits 6 after one
     run. The batch is then `stopped` and resumes only with `--reopen --reason <text>`.
   - One runner per eval root (`<R>/.runner.lock`).
5. **The tripwire compares this checkout's status after every run.** Do not edit, commit or create files in the main
   checkout while a batch runs. Another session changing the real `~/.claude/settings.json`, `CLAUDE.md`,
   `.plugin-version` or `calibration.json` also stops a batch, with exit 5.
6. **C, open questions for the batch-C checkpoint:**
   - project-researcher or objective-researcher for the four research dimensions (one line, `AGENTS` in `C.cjs`);
   - the cap levels above;
   - whether the literal path rule gets a negation carve-out. Today "there is no `go.sum`" counts as a fabricated
     path, and `spotcheck/C-paths.md` lists such lines.
   - Researcher roles need 2 of 2 scored runs, so a single excluded researcher run makes that dimension INSUFFICIENT
     for that model.
7. **E.** The session model is opus. `EVAL81_E_SESSION_MODEL=sonnet` before the runner command switches every E run
   to sonnet (81-17's "go E sonnet"). The E scorer falls back to the committed `results/static-prompt.json`, which
   is frozen here.
8. **Node 24.** `node --test <directory>` fails, because the directory is loaded as a module. Where a TRD cites
   `node --test scripts/eval81/`, run the glob form instead: `node --test 'scripts/eval81/**/*.test.cjs'`. 81-14
   Task 1's amendment step 2 is one such place.

## 8. Regenerate

Run this from the repo root with the real HOME. It is the manifest's `command`, verbatim:

```
node scripts/eval81/prereg.cjs --write --out .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results --extra .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/fleet-checklists.json --calibration /Users/justin/.claude/aoforge/calibration.json --trees /private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81/trees.json --claude-version '2.1.302 (Claude Code)' --projection /private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81/projection-manifest.json
```

It reads two scratch files, `<R>/trees.json` and `<R>/projection-manifest.json`. If the eval root was lost:

- `sandbox.ensureTrees` re-creates `trees.json` at the SHAs in section 3.
- Extract the committed projection before regenerating, one plain command:

  ```
  node -e "const m=require('./.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json');require('fs').writeFileSync('<R>/projection-manifest.json', JSON.stringify(m.projection, null, 2) + '\n')"
  ```

  The projection is embedded verbatim in the manifest under `projection`.

## 9. Pre-run amendments

None.
