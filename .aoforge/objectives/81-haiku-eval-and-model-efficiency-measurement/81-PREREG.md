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

### Post-hoc 2 (2026-10-17, TRD 81-14): caps resized from batch A's pilot

The user took option 1 and then option 2. The pilot was 4 runs plus one re-run, on different fixtures, with a planted
fixture for each model. Their charged costs:

| Run | Model | Fixture | Verdict | Charged |
|---|---|---|---|---|
| `A-A1-haiku-r1@attempt1` | haiku | A1 clean | passed (run excluded: tools check, 9.1) | $0.011115 |
| `A-A1-haiku-r1` (attempt 2) | haiku | A1 clean | passed | $0.005823 |
| `A-A2-sonnet-r1` | sonnet | A2 clean | passed | $0.152767 |
| `A-A4-haiku-r1` | haiku | A4 planted | gaps_found, gap named | $0.010841 |
| `A-A5-sonnet-r1` | sonnet | A5 planted | gaps_found, gap named | $0.144013 |

- **Means.** Haiku $0.00926 per run (n 3), sonnet $0.14839 (n 2). That is about 2% and 7.4% of the per-run caps.
  Each run's first-turn input was about 25.0K tokens.
- **New batch caps.** A $10, B $10, D $5, E $55 (unchanged), C the remainder. They live in `lib/ledger.cjs`
  `BATCH_CAPS` and in `<R>/ledger.json`'s rows. A's estimate is now $3. Per-run caps and the reserve rule are
  unchanged.
- **Projection.** It replays the order from the real ledger through `ledger.cjs`. A and B run at m x the pilot
  per-model means, with B using A as its proxy. D runs at m x 81-10's upper end (sonnet $0.20, haiku $0.04). E
  runs at its estimate (x1.25 for m >= 2), and C at its estimate. The full numbers are embedded in the manifest's
  `projection.post_hoc_2_pilot_resize`.

| m | A | B | D | E | C | Total |
|---|---|---|---|---|---|---|
| 1 | 36/36, $2.85 | 36/36, $2.84 | 24/24, $2.88 | 10/10, $44 | complete | $80.56 |
| 2 | 36/36, $5.37 | 36/36, $5.68 | stops at 20/24 (10/12 each, 2/3 ok) | 9/10 (`b31-r2`) | complete | $90.25 |
| 3 | 36/36, $7.89 | 36/36, $8.51 | stops at 13/24 (haiku 7/12, sonnet 6/12: INSUFFICIENT) | 9/10 | complete | $95.25 |

- **Completes all runs up to:** A 3.2x the pilot, B 3.0x, D 1.65x 81-10's upper end. Under the old caps these were
  A 2.15x, B 1.55x and D 0.9x.
- **The user's gate for the remaining 32 A runs** was "A <= $15 and A+B+D+E projected <= $80". Projected A is $2.85,
  and its cap is $10. Projected A+B+D+E is $52.56, and the four batch caps sum to $80. Both hold.
- **D is unmeasured.** Its cap is re-checked against its own first runs at the D checkpoint (TRD 81-16).

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
   - **Done (post-hoc 2, 2026-10-17, user decision a):** both now sit in
     `<scratchpad>/eval81-private-backup/{fleet,d-capture}`. The checklist copy's sha256 is still `86f909f5...`.
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
   - **Answered (post-hoc 2, 2026-10-17):**
     - project-researcher (decision b);
     - caps: C has no batch cap and keeps the remainder, at least $20 now (section 5, post-hoc 2);
     - negated claims are exempt from the path check (decision c; 81-DECISION-RULE.md section 9).
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

None before the first live run. The amendments below were made after it and are **post-hoc** (section 1, rule 3).
None replaces the text it amends.

### 9.1 Post-hoc 1 (2026-10-17, TRD 81-14): relaxed init-tools check

- **Why.** Batch A's first live run, `A-A1-haiku-r1`, ran as the verifier and published a correct `passed` on a clean
  fixture. The runner still stopped batch A with exit 6, because Claude Code 2.1.302 listed the init tools as
  `Read, Write, Bash, Task, Edit` against the frontmatter's `Read, Write, Bash, Grep, Glob, Agent`.
- **The user's words** (2026-10-17): "relax, re-run" (1 + 2a): relax the check as proposed, keep it correct for B's
  job-checker and C's agents, and re-run the stopped run.
- **What changed.** `runner.checkTools` (test-first: `scripts/eval81/lib/runner-tools.test.cjs`, 11 tests, RED 11/11
  then GREEN 11/11):
  - `Agent` and `Task` satisfy each other;
  - `Grep` and `Glob` count as present when `Bash` is listed;
  - `Edit` is allowed when `Write` is declared;
  - any other missing tool, and an undeclared Edit, Write, WebFetch, WebSearch or NotebookEdit, still fails. The
    job-checker (no Write) still fails on Edit.
  - The record's `tools_check.satisfied_by` names each tool met another way.
- **Frozen files whose hashes changed:** `scripts/eval81/lib/runner.cjs`, `scripts/eval81/README.md`. Nothing that
  decides or scores an outcome changed.
- **The stopped run.** Its ledger entry was re-keyed to `A-A1-haiku-r1@attempt1`, keeping its $0.011115 charged, and
  the id was dropped from `R/queue/A.json` `done`, so the run re-runs as attempt 2. Its first dir stays as
  `A-A1-haiku-r1.prev-<n>`. Batch A was reopened with `--reopen --reason "relaxed init-tools check (user 2026-10-17)"`.
- **New manifest:** sha256 `be06f165c9928862c0e78e70e0143c66b41e62eabfe392b0b850da314abfa62a`, 84 files, written at
  head `fed025502a25160b90b63397435a6238ea19d744`.

### 9.2 Post-hoc 2 (2026-10-17, TRD 81-14): caps from the pilot and the C decisions

- **The user's words** (2026-10-17): "From the pilot's measured per-run cost (charged = max(reported,
  transcript-priced)), resize the per-batch caps so A and B can complete all 36 runs each and D its 24, keeping the
  global $100 limit, the reserve rule and the order A,B,D,E,C (C absorbs any shortfall). Also record the C decisions
  now so the plan is frozen once: (a) move `R/fleet` and `R/d-capture` [...] out of the eval root to a sibling dir
  before C and point the batch-C spec at the new location; (b) C's research dimensions use project-researcher; (c)
  the mapper fabrication check exempts negated claims (e.g. "there is no go.sum") — implement test-first in the
  scorer."
- **When.** After the 4-run pilot, before the remaining 32 A runs. The pilot runs were made under the old caps and
  the old C scorer. Neither affects them: no A run came near its batch cap, and A is not scored by `score/C.cjs`.
- **What changed:**
  - `lib/ledger.cjs` `BATCH_CAPS` A 7.5 -> 10, B 6 -> 10, D 3 -> 5, E 55, C null. `BATCH_ESTIMATES.A` 5 -> 3. This
    was test-first: `ledger.test.cjs` 17b went RED then GREEN, and test 18's batch-cap case is now relative to
    `BATCH_CAPS.A`.
  - `<R>/ledger.json` rows A, B and D took the same caps and A's estimate. No entry was touched.
  - `score/C.cjs`: negated claims are exempt (`negatedMention`, `pathCheck`). This was test-first: `C.test.cjs` 8g
    and 8h went RED then GREEN. `spotcheck/C-paths.md` now lists flagged and exempt paths.
  - `81-DECISION-RULE.md` section 3 (C fabrications) has a post-hoc note, and its new section 9 records decisions a,
    b and c with the user's words.
  - `README.md` (Ledger) gives the new caps.
  - Section 5 above (post-hoc 2) holds the pilot table and the re-projection. The manifest embeds it as
    `projection.post_hoc_2_pilot_resize`.
  - Section 7 records decision a as done and the C answers.
  - TRD 81-18 names the new private-backup location.
- **Frozen files whose hashes changed:** `scripts/eval81/lib/ledger.cjs`, `scripts/eval81/score/C.cjs`,
  `scripts/eval81/README.md`, `81-DECISION-RULE.md`.
- **New manifest:** sha256 `e5cb39631065c33c6c3ff2ed2da805d8e095e42129c3a0336981f091f528dd33`, 84 files, written at
  head `14963158`. It is committed by `docs(81-14): post-hoc 2, resize batch caps from the A pilot and freeze the C
  decisions`.

### 9.3 Post-hoc 3 (2026-10-17, TRD 81-17): opaque run paths

- **Why.** In batch E's build pilot, b31-r1's TRD 01-01 executor tried to Read
  `/Users/justin/.claude/aoforge/references/tdd.md`, the real home. The run's cwd sat under the session scratchpad,
  whose name encodes the home (`-Users-justin-dev-aoforge-claude`), and the agent resolved `~` from it.
  - The deny list refused the read, and the runner recorded `escape_attempt: true`.
  - The agent then read the sandbox copy.
  - Nothing outside the sandbox was read or written, and the tripwire was clean.
- **The user's words** (2026-10-17): "Opaque paths + continue".
  - Make a test-first post-hoc harness change so that no run's cwd, sandbox HOME, config dir or work dir contains the
    username or the repo/checkout name, even after realpath.
  - Place the per-run roots under a new opaque sibling directory, `/private/tmp/claude-501/e81-<random hex>/`, holding
    the plugin trees, fixture copies and sandbox HOMEs. The ledger, results and token file stay where they are, and
    the token is passed only through the env.
  - Keep the deny list.
  - Add a test that every path handed to a run has no `justin`, `aoforge-claude` or `Users-` component after
    `fs.realpathSync`.
  - Re-freeze, and delete `/private/tmp/claude-501/e81-*` at the very end of C.
- **What changed.** Everything below was written test-first. RED was 9 failures across the four test files, GREEN
  40/40, and the full eval81 suite went from 477 to 495/495.
  - `lib/opaque.cjs` (new): `forbiddenTokens({realHome, repo})` gives `['justin', 'aoforge-claude', 'Users-']` here,
    and `opaqueViolations` checks every component of each path's real form. Tests: `lib/opaque.test.cjs`.
  - `lib/sandbox.cjs`: `makeSandbox({sandboxRoot})` puts home, tmp and work under `S/runs/<X>/<id>/` and keeps the
    record dir under R. `exportTrees` writes plain copies of each ref's `plugins/` (`git archive`, no `.git`) to
    `S/trees/` and records them in `S/trees.json`. Tests: `lib/sandbox-opaque.test.cjs`.
  - `lib/runner.cjs` and `run.cjs`: a new `--sandbox-root S` flag.
    - Trees are read from `S/trees.json`, and `settings.json` is written in the sandbox dir.
    - The runner refuses with exit 2, nothing spawned, when S, a plugin dir or any handed path (cwd, HOME,
      CLAUDE_CONFIG_DIR, TMPDIR, `--settings`, `--plugin-dir`) names a token after realpath. argv.json records the
      check.
    - The isolation and tripwire project roots cover S, denials inside S count as inside the sandbox, and collect
      receives `tmp`.
    - Test: `run-opaque.test.cjs` (fake claude, stand-in home `<base>/Users/justin`, checkout `<base>/dev/aoforge-claude`).
  - `lib/tripwire.cjs`: `isolationCheck` accepts a list of roots.
  - `batches/C.cjs`: collect reads drafts from `ctx.tmp` when the runner passes it. Test: `C.test.cjs` 6b2.
  - `README.md`: the flag, the split layout, and the safety rule with its known gaps. The parent's argv is visible to
    `ps`, and PATH, USER and LOGNAME still pass through the child env.
- **Live use.**
  - S is `/private/tmp/claude-501/e81-5752f4931a905580`, made fresh. Its trees were exported at the pinned SHAs, and
    `diff -rq` against `<R>/trees/v*/plugins` printed nothing.
  - The remaining six E runs and all of C pass `--sandbox-root S`. R keeps the ledger, queue, tripwire snapshots and
    every record dir.
  - The deny list is unchanged.
- **Effect on the measurement.** E's four pilots ran with their cwd under the scratchpad path, and the remaining six
  under the shorter S path. The session's environment text and tool outputs carry the cwd, so first-turn input can
  differ by a few tokens. Each version has one quick run and one build run in each group, so the version comparison
  stays balanced.
- **Frozen files whose hashes changed:**
  - `scripts/eval81/lib/runner.cjs`, `lib/sandbox.cjs`, `lib/tripwire.cjs`, `run.cjs`, `batches/C.cjs`, `README.md`;
  - added: `scripts/eval81/lib/opaque.cjs`.
- **New manifest:** sha256 `8080f63b0655061d9196467f39588e275bb63ad9af13c9a4a2c08280a857fdcd`, 85 files, written at
  head `4f3619dc`.

### 9.4 Post-hoc 4 (2026-10-17, TRD 81-18): access classes, impaired runs re-run once

- **Why.** After post-hoc 3, batch C stopped after 12 of 48 agent runs.
  - Two fleet mappers (C-map-arch-b-s-1, C-map-quality-b-s-1, sonnet) ran `cd ~/.claude/aoforge/templates/codebase && cat ...`.
    The CLI checks a `~` path in Bash against the deny list as the REAL home, so the run's own templates were denied.
    Bash itself would have read the sandbox HOME.
  - Three runs tried guessed homes that do not exist (`/Users/unknown/...`, `/Users/.claude/...`, `/Users/../.claude/...`).
  - Nothing real was read.
- **The user's words** (2026-10-17): "Reclassify + re-run impaired".
  - (a) A permission denial whose path is the `~`-expansion of a path the agent addressed via `~`, and any access
    attempt on a non-existent guessed path, are recorded as non-escapes with the attempted path class. The real path
    text never appears in committed files, and the username is redacted.
  - (b) A REAL escape, meaning any attempt (allowed or denied) on an existing real path outside the sandbox other than
    via `~` expansion, still stops C immediately.
  - (c) Runs where a denial blocked the agent's own templates or references are flagged `impaired` and re-run once,
    charged to the ledger. If still impaired, they are scored as `impaired` (excluded from model-error rates, reported
    separately), not as model error. C-map-arch-b-s-1 and C-map-quality-b-s-1 are reclassified under this rule.
  - Then finish C within the global $100, with the reserve rule unchanged.
- **What changed.** Everything below was written test-first. RED was 6 failures; GREEN passed. The full eval81 suite
  passed 510/510.
  - `lib/access.cjs` (new).
    - It classifies every path a run's tool inputs name: the path fields of file tools, and Bash commands read through
      `shell-words.parseCommand`. Heredoc bodies, echo/printf arguments, grep/rg patterns, sed/awk/jq programs,
      interpreter `-e`/`-c` code and `git -m` messages count as data.
    - The classes are `inside`, `tilde`, `guessed_nonexistent` (the text starts with the real home's parent),
      `nonexistent`, `real` and `system`.
    - A real path is one of: the real home or anything under it; its parent; a deny root; the eval root; the sandbox
      root's parent; or any path whose real form names the user or the checkout.
    - The real home is written `<home>`, the user `<user>`, the home's parent `<users>-` and the checkout `<checkout>`.
    - Tests: `lib/access.test.cjs`.
  - `lib/runner.cjs`.
    - After each run, `record.access = {real, non_escape, impaired, impaired_by}` and `record.impaired`.
    - A real escape gives exit 5 and stops the batch.
    - A first impaired attempt is charged as `<id>@impaired<n>`, stays out of `queue.done` and is re-run at once. A
      second impaired attempt is final with `impaired: true`.
    - Test: `run-access.test.cjs` (fake claude `tool_paths` scenario).
    - `run.test.cjs` 20 was updated: a denied read of an existing file under a deny root is now a real escape.
  - `score/C.cjs`: a final `impaired` record is excluded (reason `impaired: ...`), counted per model as `n_impaired`,
    listed in the result's `impaired`, and noted. Test: `score/C.test.cjs` 9g.
  - `README.md`: the access classes. `__fixtures__/fake-claude.cjs` (not frozen): the `tool_paths` scenario.
- **Reclassification of the 12 runs that came before it.** It ran with `lib/access.cjs` (scratch
  `81-17-scripts/reclassify-c.cjs`).
  - No real escape.
  - Non-escapes in 3 runs.
  - Impaired: C-map-arch-b-s-1 and C-map-quality-b-s-1. Both had their ledger entry re-keyed to `<id>@impaired1`
    with the charge kept, `record.json` annotated, and the id dropped from `queue/C.json` `done`, so the next
    invocation re-runs each once.
- **Known gap.** A heredoc fed to an interpreter (`python3 - <<EOF`) is not read for paths.
- **Frozen files whose hashes changed:**
  - `scripts/eval81/lib/runner.cjs`, `score/C.cjs`, `README.md`;
  - added: `scripts/eval81/lib/access.cjs`.
- **New manifest:** sha256 `70f92eca1b291f4296e62c402f37da5e89920f40380bac0666b5625e5b710e81`, 86 files, written at
  head `611b2c17`.
