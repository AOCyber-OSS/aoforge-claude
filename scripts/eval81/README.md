# Objective 81 eval harness: runner

`run.cjs` runs one eval batch (A verifier, B job-checker, C mapper and researcher, D UI judge, E 3.0.0 vs 3.1.0
workflows). It runs each of the batch's runs headless as `claude -p`, one at a time. Each run gets its own throwaway
HOME and stays under a $100 running-total ledger. `score.cjs` (TRD 81-02) scores what the runs leave behind. This file covers the runner (TRD 81-08).
The run contract (descriptors, records, ledger entries, spend blocks) is documented in `lib/contract.cjs`.

A dry run (`--dry-run`) makes **zero API calls**: it never spawns the claude binary and never reads the token file
(it only checks that the file exists and is non-empty).

## Commands

```
node scripts/eval81/run.cjs --batch X --root <R> --token-file <T> [--dry-run [--materialize none|first|all]]
     [--init-ledger] [--stop-after N] [--reopen --reason <text>] [--claude-bin <bin>|node:<path>]
     [--results-dir <dir>] [--calibration <path>] [--repo <checkout>] [--batch-dir <dir>] [--sandbox-root <S>] [--raw]
node scripts/eval81/run.cjs --rebuild-ledger --root <R> [--results-dir <dir>] [--charge-lost X=<usd>]... [--raw]
node scripts/eval81/run.cjs --close-batch X --reason <text> --root <R> [--raw]
```

For live use, `R` (the eval root) and `T` (the token file) are always passed on the command line, never defaulted in
code. Both live in the session scratchpad. The live TRDs (81-13..81-18) give the exact paths, and so does TRD 81-08's
context section.

| Flag | Meaning |
|---|---|
| `--batch X` | The batch to run, `A`-`E`. Its module is `<batch dir>/X.cjs`. |
| `--root R` | The eval root (layout below). Created if missing. |
| `--token-file T` | The OAuth token file. A live run reads it once. A dry run only checks that it exists. |
| `--claude-bin` | The binary to spawn. Default `claude`, looked up on PATH. A path containing `/` is resolved against the current directory. `node:<path>` runs `<path>` with this node, for a CI without an executable bit. |
| `--dry-run` | Plan the batch without spawning anything (see Dry run). |
| `--materialize` | Dry run only: `none`, `first` (default) or `all`. Says which runs get a fixture copy and a runtime mirror. |
| `--stop-after N` | Live: stop cleanly after N spawned runs, exit 0. The batch stays `running`. |
| `--init-ledger` | Create `R/ledger.json` when it is missing (the first batch only). Refused once any `results/<X>.json` exists. |
| `--reopen --reason <text>` | Let a `stopped` batch run again. Use it only on the user's word. The reason is stored on the batch's ledger row (`reopen_reason`). |
| `--rebuild-ledger` | Rebuild `R/ledger.json` from the committed spend blocks. Needs only `--root` and `--results-dir`. Never overwrites an existing ledger. |
| `--charge-lost X=<usd>` | With `--rebuild-ledger`: charge a batch that started but never committed (entry `X-lost-root`) and stop it. Repeatable. |
| `--close-batch X --reason <text>` | Stop a batch partway (e.g. E after its pilots). The reason is stored as `stop_reason`. Nothing spawns. |
| `--results-dir` | Where the committed results live. Default `<repo>/.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results`. |
| `--calibration` | Read-only calibration for the batch modules' caps. Default `<real home>/.claude/aoforge/calibration.json`. |
| `--repo` | This checkout. Default `git rev-parse --show-toplevel`. Its parent directory is a deny root, and it is tripwired. |
| `--batch-dir` | Where `<X>.cjs` batch modules live. Default `scripts/eval81/batches/`. |
| `--sandbox-root S` | **Post-hoc 3.** Put what each run sees (home, config dir, tmp, work, settings.json) under `S/runs/<X>/<id>/` and read the plugin trees from `S/trees.json` (`sandbox.exportTrees`); the record dir stays under R. The runner refuses (exit 2, nothing spawned) when S, a plugin dir or any path handed to a run names the user or the checkout after realpath (`lib/opaque.cjs`). |
| `--raw` | Print the JSON report on stdout instead of a short summary. |
| `--real-home <dir>` | **Test only.** A stand-in for the real home. Default `os.userInfo().homedir`. The live TRDs never pass it. |
| `--rates <file>` | **Test only.** A model-rates file for transcript pricing. Default `references/model-rates.json`. The live TRDs never pass it. |

The last line on stderr is always `run: exit <code>: <message>`. Progress lines go to stderr and to `R/queue/<X>.log`.
Every line goes through `secret.redact`.

## Exit codes

| Code | Meaning | What to do |
|---|---|---|
| 0 | Complete, nothing pending, or `--stop-after` reached | Continue. |
| 2 | Usage, order, ledger or deny-root refusal (nothing spawned) | Read the message. Examples: the ledger is missing, a batch is out of order, a batch is stopped, R lies under a deny root, another runner holds the lock. |
| 3 | Budget stop: the next run's reserve would take the total past $100, or its cap would take the batch past its batch cap. The refused run is recorded `skipped_budget`. Nothing spawned. | The user decides. Re-run the same command after a decision, or `--close-batch X --reason <text>`. |
| 4 | Paused on a usage or rate limit. `R/queue/<X>.json` has `resume_after` and the run stays pending. | Wait until `resume_after` (a Monitor until-loop on the clock), then run the same command once. Running it earlier exits 4 again without spawning. |
| 5 | Tripwire or isolation breach. The batch is now `stopped`. | Report the diff to the user. Resume only on their word, with `--reopen --reason <text>`. |
| 6 | Harness error. Before a spawn: batch module, descriptor, mirror or materialize failure, nothing charged. After a spawn: the token in the run dir, an init-tools mismatch, or a denial inside the sandbox. In the after-spawn cases the batch is `stopped`, so at most one run's cap is spent finding out. | Fix the cause, then `--reopen --reason <text>` if the batch stopped. |

## Why `--agent`

With `--agent aoforge:<name>`, the session IS the agent: it has that agent's system prompt and tool list. So the run's
reported cost, usage and `modelUsage` belong to that agent alone, and the model is exactly `--model`. A thin prompt that
spawns the agent through Task would add an orchestrator turn on the same model. It would split tokens across two
transcripts, and it would let the subagent's model alias differ from `--model`. There is one difference from production: a subagent
there receives the spawn prompt as its first user message. The batch modules cover it by using the production spawn
prompt text as the `-p` prompt (81-09, 81-11).

## The command

```
claude -p --output-format stream-json --verbose --model <tier> --max-budget-usd <cap>
  --permission-mode bypassPermissions --settings <run dir>/settings.json [--plugin-dir <tree>/plugins/aoforge]
  [--agent <plugin>:<name>] [--tools a,b] [--json-schema <json>] -- <prompt>
```

- The prompt comes last, after `--`. A prompt that starts with `-` is never read as a flag, and no variadic flag can
  swallow it.
- `--plugin-dir` is resolved from `R/trees.json`. `--agent` is added for kind `agent` only. `--tools ""` turns all
  tools off (the C grader). `tools: null` omits the flag.
- stdin is `/dev/null` (spawn stdio `'ignore'`), so `claude -p` never waits for stdin.
- cwd is the run's fresh work dir. Every run has a timeout: SIGTERM, then SIGKILL after 10 s.
- `--max-budget-usd` is checked between turns, so a run can end above it. It is never treated as a spend bound (see
  Ledger).
- `--bare` is not usable: it never reads OAuth.

## Root layout

```
R/ledger.json                       the $100 running-total ledger (lib/ledger.cjs)
R/trees.json                        {"3.0.0": {ref, sha, path}, "3.1.0": {ref, sha, path}}, absolute worktree paths
R/trees/v3.0.0/, R/trees/v3.1.0/    detached git worktrees (sandbox.ensureTrees, TRD 81-13 only)
R/queue/<X>.json                    {done: [ids], attempts: {id: n}, resume_after: {epoch, iso, id, reason} | null}
R/queue/<X>.log                     progress lines (redacted)
R/runs/<X>/<id>/home/               the run's HOME; home/.claude is its CLAUDE_CONFIG_DIR (runtime mirror inside)
R/runs/<X>/<id>/work/               the session cwd: a fresh materialised fixture copy
R/runs/<X>/<id>/tmp/                its TMPDIR
R/runs/<X>/<id>/argv.json           bin, args, cwd, env (token redacted), timeout
R/runs/<X>/<id>/settings.json       the --settings deny list
R/runs/<X>/<id>/stream.jsonl        the stream-json log
R/runs/<X>/<id>/stderr.txt          the child's stderr
R/runs/<X>/<id>/transcripts/        copy of home/.claude/projects/** after the child exited (main + subagents)
R/runs/<X>/<id>/outputs/outputs.json  what the batch module's collect() returned (also record.outputs)
R/runs/<X>/<id>/record.json         the RunRecord
R/runs/<X>/<id>.prev-<n>/           an earlier dir for the same id, moved aside, never deleted
R/tripwire/<X>-before.json, <X>-after.json
R/.runner.lock                      one runner per root (pid); a stale lock from a dead pid is taken over
```

With `--sandbox-root S` (post-hoc 3, TRD 81-17) the layout splits:

```
S/trees.json, S/trees/v<version>/   plain copies of each ref's plugins/ (git archive, no .git), sandbox.exportTrees
S/runs/<X>/<id>/home|tmp|work/      what the run sees; S/runs/<X>/<id>/settings.json is its --settings
R/runs/<X>/<id>/                    record.json, stream.jsonl, stderr.txt, argv.json, transcripts/, outputs/
```

S is an opaque directory (`/private/tmp/claude-501/e81-<hex>` in the live TRDs): no path a run is handed names the
user or the checkout, even after realpath, so an agent cannot infer the real home from its cwd. argv.json records the
check (`opaque: {tokens, checked, violations}`).

The runner resolves plugin dirs from the paths in `trees.json`. So another root can reuse the same trees by copying
`trees.json`.

A run dir is never reused. Before a new attempt, the existing dir is renamed `<id>.prev-<n>`: a dry run's dir, a rate-limited attempt, a
run that died. **Scorers read `R/runs/<X>/<id>/record.json` only, never `*.prev-*`.**

Batch modules (`batches/<X>.cjs`, TRDs 81-09..81-12; mirrored by `__fixtures__/stub-batch.cjs`) export
`{batch, runs({root, trees, calibration}), materialize(desc, workDir, {root, trees, home}), collect(desc, workDir,
{root, home, record}), needsWatchedRepos?(root)}`.

The runtime pre-mirror runs the tree's own `hooks/sync-runtime.js` with only `PATH`, `HOME=<sandbox home>` and
`CLAUDE_PLUGIN_ROOT=<plugin dir>`. The session's own SessionStart copy then takes its fast path.
`AOFORGE_SKIP_GLOBAL_UPGRADE` is **not** set, so the sandbox `CLAUDE.md` gets the managed block production users
get.

## Dry run

`--dry-run` loads the ledger (creating it only with `--init-ledger`), the batch module and its descriptors. It checks
the deny roots, then plans every pending run. Each planned run gets:

- its cap and cap basis
- its reserve and reserve basis
- its base-prompt share, at real rates
- whether it would fit the ledger now

It writes each run's `settings.json`, redacted `argv.json` and a `dry_run` record.json. With `--materialize first`
(the default), the first run also gets its runtime mirror and fixture copy, so the rehearsal can inspect them.

The JSON report adds:

- `token_file_present`
- `sum_caps_usd`
- `worst_case_usd` (the sum of reserves) and `worst_case_total_usd`
- `estimate_usd` (the batch estimate) and `projected_total_usd`
- `base_prompt_usd`
- `caps_exceed_batch_cap`
- `order` (`{ok, message}`). An out-of-order batch is reported, not refused, so 81-13 can rehearse every batch.

A dry run never spawns, never charges and never changes a batch status. `dry_run` is never "done": a later live run
runs those ids.

## Safety rules

- **Token.** The token travels only in the child's `CLAUDE_CODE_OAUTH_TOKEN` (built by `secret.childEnv` from an
  allowlist; the parent's `CLAUDECODE`, `CLAUDE_CODE_*`, `ANTHROPIC_*` and `AOFORGE_*` never reach the child). It is
  never in argv, a record, a log line or an error. After every run the whole run dir is scanned for it (exit 6 on a
  hit, naming the run dir, never the token).
- **Isolation, four layers** (W3). Runs use `bypassPermissions` plus Bash, so:
  1. HOME, CLAUDE_CONFIG_DIR and TMPDIR are inside the run dir and cwd is the sandbox work dir.
  2. A `--settings` deny list. Each deny root gets `Read(//<p>/**)`, `Edit(//<p>/**)` and `Write(//<p>/**)` (an
     absolute rule; `~/` would mean the sandbox HOME). The deny roots, derived at run time and never hard-coded, are:
     `dirname(repo)` (this checkout and its siblings), `<real home>/.claude`, every watched repo, and the realpath of
     each when it differs. The runner refuses (exit 2, before any spawn) when R, a tree or a plugin dir lies under a
     deny root.
  3. A per-run isolation proof (`record.isolation`). The session's project dir exists under the sandbox config dir.
     No real `~/.claude/projects` entry exists for the work dir. No new real entry exists under R's key. Otherwise
     exit 5. A run that never reached a session (a silent timeout) is not required to have a project dir.
  4. The tripwire. Before the batch and after every run, the runner compares the before and after state of:
     - this checkout and every watched fleet source (HEAD, and `status --porcelain=v1 -uall` through
       `git --no-optional-locks`)
     - the real `~/.claude/settings.json` and `CLAUDE.md`
     - the real `~/.claude/aoforge/.plugin-version` and `calibration.json`
     - the real projects entries under R's key

     Any change is exit 5 and stops the batch. The real home is only read (stat, readdir, sha256). Another session of
     the user's can change these files (a re-mirror, a `calibrate`). That is still exit 5: report the diff, the user
     says whether it was theirs, and the batch resumes only with `--reopen --reason`.

  Bash is not path-scoped by permission rules (they match command text), so layers 1, 3 and 4 cover Bash. Whether
  deny rules bind under `bypassPermissions` is observed, not probed with a paid run. A run's `permission_denials`
  naming a path under a deny root is recorded as `escape_attempt: true`; the run continues and the report counts it. A
  denial of a path inside the run dir, a tree or the plugin dir means the deny list broke the agent: `harness_error`,
  exit 6 after that run.
- **Hooks fire in the sandbox.** Agent runs (A, B, C) pass `AOFORGE_SKIP_EDIT_GATE=1`, because a session started
  with `--agent` may carry no `agent_type`. Every run passes `AOFORGE_SKIP_AWARENESS_POPULATE=1`,
  `AOFORGE_SKIP_TRANSCRIPT_EXPORT=1` and `AOFORGE_SKIP_PRUNE=1`. These are set by the batch descriptors' `env`, which
  allows only `AOFORGE_SKIP_*`.
- **Tools check.** On every agent run with an init event, every tool the agent's frontmatter declares (or `--tools`
  names) must appear in the init tools. Edit, Write, WebFetch, WebSearch and NotebookEdit must be absent unless
  declared. MCP wildcards are ignored. A mismatch means `--agent` did not take: `harness_error`, exit 6 after that
  one run. **Post-hoc (TRD 81-14, user-accepted 2026-10-17):** batch A's first live run showed Claude Code 2.1.302
  listing the verifier's tools as `Read, Write, Bash, Task, Edit` against the declared `Read, Write, Bash, Grep, Glob,
  Agent`. The check now treats `Agent` and `Task` as one tool, counts `Grep` and `Glob` as present when `Bash` is
  listed, and allows `Edit` when `Write` is declared. Any other missing tool, and an undeclared Edit, Write, WebFetch,
  WebSearch or NotebookEdit, still fails. The record's `tools_check.satisfied_by` names each tool met another way.
- **Opaque paths (post-hoc 3, TRD 81-17, user 2026-10-17).** Batch E's build pilot b31-r1 had an executor resolve
  `~/.claude/...` to the real home it read off the cwd (the scratchpad name encodes it); the deny list refused the
  read. From then on E and C run with `--sandbox-root`: cwd, HOME, CLAUDE_CONFIG_DIR, TMPDIR, `--settings`,
  `--plugin-dir` and the fixture copy are checked after realpath against the tokens `forbiddenTokens` derives from
  the real home and the checkout (here `justin`, `aoforge-claude`, `Users-`). The deny list is unchanged. Not covered:
  the parent's own argv (visible to `ps`), and PATH, USER and LOGNAME, which the child env still passes through.
- **Access classes (post-hoc 4, TRD 81-18, user 2026-10-17: "Reclassify + re-run impaired").** After every run
  `lib/access.cjs` reads each tool input (path fields; Bash through shell-words, heredoc bodies, echo/printf arguments,
  grep patterns and interpreter code being data) and the denials. (a) A denied `~` path (the CLI checks `~` in Bash
  against the REAL home) and any access to a non-existent guessed path are non-escapes, recorded in `record.access`
  with the username redacted. (b) Any attempt, allowed or denied, on an existing real path outside the sandbox (the
  real home, its parent, a deny root, the eval root, the sandbox root's parent, or a path naming the user or checkout)
  other than via `~` is a real escape: exit 5 after that run, batch stopped. (c) A denied `~/.claude/...` path impairs
  the run: it is re-run once, the first attempt charged as `<id>@impaired<n>`; still impaired, it is final with
  `impaired: true`, and score/C.cjs excludes it from the model rates and lists it under `impaired`.
- **Order.** A, B, D, E, C. A live run of a batch refuses (exit 2) until every earlier batch is `complete` or
  `stopped`. A `complete` batch whose `runs()` lists new runs (C's graders) goes back to `running`, runs only the new
  ids and completes again.
- **One at a time.** Runs are sequential, never parallel. `R/.runner.lock` refuses a second runner on the same root.
  No port is opened.

## Ledger: reserve before, charge after

- Before every spawn: `total + reserve <= $100`. The reserve is `max(cap x 1.25, cap + the largest overshoot seen for
  the same batch and role)`. The batch must also fit: `batch spent + cap <= batch cap` (pre-registered: A 7.5, B 6,
  D 3, E 55, C the remainder; **post-hoc 2, TRD 81-14, user 2026-10-17: A 10, B 10, D 5, E 55, C the remainder**,
  sized from batch A's 4-run pilot). A refused run is recorded `skipped_budget`, with the reason (`global_cap` or
  `batch_cap`) and a basis naming the reserve. Then the batch stops with exit 3.
- After every run, the ledger charges `max(reported total_cost_usd, the transcript-priced cost of the main session
  plus every subagent)`. So a cap the CLI overshoots, or a reported cost that leaves out subagents, cannot hide spend.
  The record keeps both figures, `cap_usd`, `reserve_usd`, `overshoot_usd` and `cost_source` (`reported`,
  `transcript_sum` or `reserve_charged`).
- A run killed by its timeout is charged its transcript cost when transcripts exist, else its reserve. It is never
  charged just the cap.
- A rate-limited attempt is charged as `<id>@attempt<n>` (usually $0). The run itself stays pending.
- A dry run and a `skipped_budget` record are never charged.

## Rate and usage limits

The runner never retries in a tight loop. It waits in-process only when the reset is within 15 minutes:

- backoff waits of 60 s, 120 s, 240 s and 480 s, or until reset + 30 s, whichever is later
- at most 4 waits and 15 minutes in all

Each new attempt gets a fresh sandbox. Otherwise the runner stops with exit 4 and `resume_after`; the run stays
pending. Re-running the same command before `resume_after` exits 4 again without spawning.

## Durability

R and T live in the session scratchpad under `/private/tmp`, which a reboot or a tmp cleanup can remove. The committed
copy of spend is each batch's `results/<X>.json` `spend` block. score.cjs (81-02) writes it right after the batch.

After a loss:

1. The user re-creates the token file. The runner never writes it.
2. `--rebuild-ledger --root <new R> --results-dir <dir>` rebuilds the ledger from the committed spend blocks. It never
   overwrites an existing ledger.
3. `sandbox.ensureTrees` re-creates the trees at the SHAs pinned in `results/prereg-manifest.json`.
4. A batch that had started but not committed is charged with `--charge-lost X=<usd>`, which leaves it `stopped`. The
   live TRDs say which figure.

`--init-ledger` is refused as soon as any `results/<X>.json` exists, so a lost root can never silently reset spend to
$0.

## Resuming

- **Exit 3:** the user decides. Either re-run the same command after a decision, or close the batch with
  `--close-batch X --reason <text>` so the next batch can start.
- **Exit 4:** wait until `resume_after`, then run the same command once. Finished ids are skipped (`R/queue/<X>.json`
  plus the ledger).
- **Exit 5 or 6 (batch stopped):** on the user's word, `--reopen --reason <text>`.

## Tests

`node --test 'scripts/eval81/lib/*.test.cjs' scripts/eval81/run.test.cjs` (Node 24 needs the glob form, not a
directory). The runner tests use:

- `__fixtures__/fake-claude.cjs`, scenario-driven: happy, usage_limit, slow, wrong_model, wrong_tools, leak_token,
  touch_watched, env_dump, overshoot, subagent_cost, touch_real_projects, deny_inside and deny_outside
- `__fixtures__/stub-batch.cjs`, through `<X>.cjs` shims in a temp batch dir
- a stand-in `--real-home`
- `--rates` with the fake's `TEST_RATES`

They never run the real claude binary, never read the real `~/.claude` and never write this checkout.
