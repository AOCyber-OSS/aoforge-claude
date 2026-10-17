---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "08"
type: standard
wave: 2
depends_on: ["81-01"]
files_modified:
  - scripts/eval81/__fixtures__/fake-claude.cjs
  - scripts/eval81/__fixtures__/stub-batch.cjs
  - scripts/eval81/lib/sandbox.cjs
  - scripts/eval81/lib/sandbox.test.cjs
  - scripts/eval81/lib/command.cjs
  - scripts/eval81/lib/command.test.cjs
  - scripts/eval81/lib/tripwire.cjs
  - scripts/eval81/lib/tripwire.test.cjs
  - scripts/eval81/lib/runner.cjs
  - scripts/eval81/run.cjs
  - scripts/eval81/run.test.cjs
  - scripts/eval81/README.md
autonomous: true
requirements: [SC-1]
must_haves:
  truths:
    - "`node scripts/eval81/run.cjs --batch X --root R --token-file T` runs a batch's descriptors one at a time, each as `claude -p` with `--output-format stream-json --verbose`, `--model`, `--max-budget-usd <cap>`, `--permission-mode bypassPermissions`, `--plugin-dir` for its tree and `--agent` for agent runs, in a fresh HOME and CLAUDE_CONFIG_DIR under the run dir, cwd = a fresh materialised fixture copy, stdin closed"
    - "`--dry-run` makes zero API calls: it never spawns the claude binary, reports token-file presence without printing it, the planned runs, their caps and derivations, the worst-case and estimated spend against the ledger, and writes each run's redacted argv"
    - "Before every run the ledger check applies (total + cap <= $100, batch cap); a refused run stops the batch cleanly with exit 3 and nothing spawned; re-running the same command resumes and skips finished run ids"
    - "A rate-limited or usage-limited run is never retried in a tight loop: the runner waits in-process with backoff only when the reset is within 15 minutes, otherwise stops with exit 4 and the resume time; the run stays pending"
    - "After each run the runner saves the stream, stderr, copied transcripts and the run record, scans the run dir for the token (exit 6 on a hit, never printing it) and records model_ran; after the batch, a tripwire compares this checkout, any watched fleet source and the real ~/.claude settings files with their pre-batch state (exit 5 on a change)"
  artifacts:
    - path: scripts/eval81/run.cjs
      provides: "runner CLI with exit codes 0 complete, 2 usage/order, 3 budget stop, 4 paused (rate limit), 5 tripwire, 6 harness error"
    - path: scripts/eval81/lib/sandbox.cjs
      provides: "makeSandbox, mirrorRuntime, ensureTrees, copyTranscripts"
    - path: scripts/eval81/lib/command.cjs
      provides: "buildArgv"
    - path: scripts/eval81/lib/tripwire.cjs
      provides: "snapshot, diffSnapshots"
    - path: scripts/eval81/README.md
      provides: "harness usage, root layout, safety rules, exit codes"
  key_links:
    - from: scripts/eval81/lib/runner.cjs
      to: scripts/eval81/lib/ledger.cjs
      via: "canStart before each spawn, recordRun after"
      pattern: "canStart"
    - from: scripts/eval81/lib/runner.cjs
      to: "scripts/eval81/batches/<X>.cjs (81-09..81-12)"
      via: "runs(), materialize(), collect() loaded by batch id"
      pattern: "batches"
    - from: scripts/eval81/lib/sandbox.cjs
      to: "<plugin dir>/hooks/sync-runtime.js"
      via: "pre-mirror the runtime into the sandbox HOME (HOME and CLAUDE_PLUGIN_ROOT set)"
      pattern: "sync-runtime.js"
---

# TRD 81-08: Harness runner (sandbox, command, queue, pause/resume, budget stop, tripwire, dry run)

<objective>
Build the part of the harness that actually runs things: per-run sandbox HOME, the runtime pre-mirror, the two
plugin trees, the exact `claude -p` command, a sequential resumable queue with the ledger check before each run,
rate-limit pauses, the post-run secret scan and a tripwire on everything the runs must never touch. A dry-run mode
exercises all of it without calling the API. All tests use a fake `claude` binary.

Purpose: SC-1 (harness runs one agent headless in a sandbox HOME with a chosen plugin dir and model, per-run cap,
$100 total, stops cleanly, records verdict/output, tokens, cost and wall time; dry-run with no API call).
Output: runner modules, the CLI, a fake claude, a stub batch, a README. No live call.
</objective>

<file_tree>
scripts/eval81/
├── __fixtures__/fake-claude.cjs   ← CREATE (executable; canned stream-json by scenario)
├── __fixtures__/stub-batch.cjs    ← CREATE (a 3-run batch module for tests)
├── lib/sandbox.cjs  (+ .test.cjs) ← CREATE
├── lib/command.cjs  (+ .test.cjs) ← CREATE
├── lib/tripwire.cjs (+ .test.cjs) ← CREATE
├── lib/runner.cjs                 ← CREATE (tested through run.test.cjs)
├── run.cjs          (+ .test.cjs) ← CREATE
└── README.md                      ← CREATE
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Contract from TRD 81-01 (`scripts/eval81/lib/contract.cjs` block comment): RunDescriptor `{id, batch, kind, agent,
model, plugin, prompt, tools, jsonSchema, capUsd, capBasis, timeoutMs, env, fixture, order, role}`; RunRecord fields
as listed there. Ledger API: `loadLedger(file, {create})`, `saveLedger`, `canStart`, `recordRun`, `setBatchStatus`,
`assertOrder`, `totalUsd`. Result API: `parseStream(text, {requestedModel})`, `toolInputsMentioning`. Secret API:
`readToken`, `childEnv`, `scanForSecret`, `redact`. Caps: `capFor`, `capForWorkflow`.

Batch module interface (implemented by 81-09..81-12 as `scripts/eval81/batches/<X>.cjs`; mirror it in
`__fixtures__/stub-batch.cjs`):
```
module.exports = {
  batch: 'A',
  runs({ root, trees, calibration }) -> RunDescriptor[]      // sorted by order
  materialize(desc, workDir, { root, trees, home }) -> void  // fresh copy of the fixture into workDir
  collect(desc, workDir, { root, home, record }) -> outputs  // e.g. VERIFICATION.md text, drafts, return text
  needsWatchedRepos?(root) -> [{label, path}]               // extra tripwire repos (C's fleet source)
}
```

The runtime mirror (`plugins/aoforge/hooks/sync-runtime.js`): reads `CLAUDE_PLUGIN_ROOT` and `os.homedir()`, copies
`<plugin>/aoforge/` to `$HOME/.claude/aoforge/` and writes `.plugin-version` (and `.plugin-digest`) last. Running it
with `HOME=<sandbox home>` and `CLAUDE_PLUGIN_ROOT=<plugin dir>` before the session makes the runtime deterministic;
the SessionStart copy then takes its fast path. Set `AOFORGE_SKIP_GLOBAL_UPGRADE=1` for that pre-mirror call only if
you want no managed block in the sandbox CLAUDE.md; default: let it run (production behaviour) and say which in the
README.

Real `claude -p` facts on this machine (claude --help, 2026-10-17): `--agent <agent>`, `--plugin-dir <path>`
(repeatable), `--model`, `--max-budget-usd` (print only), `--output-format stream-json` (needs `--verbose` in print
mode), `--permission-mode bypassPermissions`, `--tools "Read,Bash"`, `--json-schema <json>`. Without stdin redirected
the CLI waits 3 s and warns "no stdin data received" (seen in the earlier auth smoke test): spawn with stdin
`'ignore'`. `--bare` is NOT usable: it never reads OAuth. Session transcripts land in
`$CLAUDE_CONFIG_DIR/projects/<key>/<session>.jsonl` with subagents under `<session>/subagents/agent-<id>.jsonl` and
`.meta.json`.
</codebase_examples>

<anti_patterns>
- Never inherit `process.env` into the child; always `childEnv()` (81-01). The parent is itself a Claude Code
  session: its CLAUDECODE / CLAUDE_CODE_* / AOFORGE_* variables must not reach the run.
- Never pass the token in argv, never print it, never write it outside the child env. The dry run does not read
  the token at all (stat only).
- Never add a worktree to, or write into, this checkout from a test: tests build their own temp repos. Only the
  real `ensureTrees` call in TRD 81-13 adds the two worktrees, under the eval root.
- No tight retry on any error. No parallel runs (the ledger and the rate limit both assume one at a time).
- No port is opened by the runner; never 8080 anywhere.
</anti_patterns>

<error_recovery>
- Ledger missing and no `--init-ledger`: exit 2 "ledger not found at <path>; pass --init-ledger only for the first
  batch". This stops a lost scratch dir from silently resetting spend to $0.
- A run killed by its timeout: SIGTERM, then SIGKILL after 10 s; status `timeout`; the cap is charged.
- First run of a batch whose init event shows a tool set that does not match the agent (the `--agent` flag did not
  take): status `harness_error`, exit 6 after that one run, so at most one run's cap is spent finding out.
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-01-SUMMARY.md (the contract as built)
@plugins/aoforge/hooks/sync-runtime.js (lines 1-80)

Fixed paths for live use (CLI arguments, never defaults in code):
- eval root `R` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81`
- token file `T` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval-auth/oauth-token`

Root layout (document in README): `R/ledger.json`, `R/trees.json` (`{"3.0.0": {ref, sha, path}, "3.1.0": {ref,
sha, path}}` with absolute worktree paths; the runner resolves plugin dirs from these paths, so another root can
reuse the same trees by copying trees.json),
`R/trees/v3.0.0/`, `R/trees/v3.1.0/` (detached git worktrees), `R/queue/<batch>.json` (done ids, attempts,
resume_after) and `<batch>.log`, `R/runs/<batch>/<id>/{home/, work/, tmp/, argv.json (redacted), stream.jsonl,
stderr.txt, record.json, transcripts/, outputs/}`, `R/tripwire/<batch>-{before,after}.json`.
</context>

<gotchas>
- Why `--agent` and not a thin prompt that spawns the agent through Task: with `--agent aoforge:<name>` the session
  IS the agent (its system prompt and tool list), so the run's reported cost, usage and modelUsage belong to that
  agent alone and the model is exactly `--model`. A Task-spawning wrapper adds an orchestrator turn on the same
  model, splits tokens across two transcripts, and lets the subagent's model alias differ. Record this rationale in
  the README. The difference from production (a subagent receives the spawn prompt as its first user message) is
  covered by using the production spawn prompt text as the `-p` prompt (81-09, 81-11).
- Hooks still fire in the sandbox. For agent runs (A, B, C) the batch passes `AOFORGE_SKIP_EDIT_GATE=1`: a session
  started with `--agent` may carry no `agent_type`, so the edit gate would deny the writes production allows for
  `aoforge:*` subagents. For all runs pass `AOFORGE_SKIP_AWARENESS_POPULATE=1`, `AOFORGE_SKIP_TRANSCRIPT_EXPORT=1`
  and `AOFORGE_SKIP_PRUNE=1` (background work with no bearing on the measured tokens, and identical for every arm).
- `model_ran` false does not stop the batch (the record says so and the scorer excludes it); an init-tools mismatch
  on the first agent run does stop it.
- Copy transcripts with fs.cpSync after the child exits; the sandbox HOME stays in the run dir for evidence and
  is never reused.
</gotchas>

## Test list

Outermost first; every test uses mkdtemp roots, a fake token file with a random test value, the fake claude and
the stub batch (passed as `--batch-dir <dir of stub-batch.cjs>` / `--claude-bin <fake>`).

CLI and runner
1. Dry run with `--init-ledger`: exit 0; JSON (`--raw`) lists 3 planned runs with caps and bases, worst-case and
   estimate, `token_file_present: true`; each run dir has a redacted `argv.json`; ledger total 0; the fake's marker
   file does not exist (no spawn); stdout and stderr do not contain the token; batch statuses in the ledger are
   unchanged. A later live run treats the dry-run ids as pending (dry_run is never "done").
2. No ledger and no `--init-ledger` -> exit 2 naming the flag.
3. Order: a live run of batch B while A is pending -> exit 2 naming A. A dry run of B reports the order status in
   its JSON and is not refused (so 81-13 can rehearse every batch).
4. Live with the `happy` scenario: 3 runs `ok`, ledger total = sum of the fake's costs, batch `complete`, each run
   dir has stream.jsonl, record.json and transcripts/; exit 0. Running again spawns nothing and exits 0.
4b. Re-open: a batch marked `complete` whose `runs()` now returns new pending runs (batch C lists its grader runs
   only once the agent outputs exist) goes back to `running`, runs only the new ids, and is `complete` again.
5. Ledger preset to 99.80 total: exit 3, record status `skipped_budget` for the first run, no spawn.
6. `usage_limit` with reset in 30 s on the first attempt, then `happy`: the injected sleep is called with >= 30 s,
   the attempt is logged as `<id>@attempt1` with its (zero) cost, the run ends `ok`. Reset in 2 h: exit 4,
   `queue/<batch>.json` has `resume_after`, the run is still pending.
7. `slow` scenario beyond timeoutMs: status `timeout`, cap charged.
8. `wrong_model`: record `model_ran: false`, batch continues. `wrong_tools` on the first agent run: exit 6 after one
   run.
9. `leak_token` (the fake writes its token env value into a work file): exit 6; the printed message names the run
   dir; neither stdout nor stderr contains the token.
10. Tripwire: a temp git repo passed as a watched repo; the `touch_watched` scenario modifies it -> exit 5 and the
    batch status `stopped`.
11. Child env: the `env_dump` scenario writes its env NAMES to a file: PATH, HOME, CLAUDE_CONFIG_DIR, TMPDIR,
    CLAUDE_CODE_OAUTH_TOKEN and the descriptor's AOFORGE_SKIP_* are present; ANTHROPIC_API_KEY, CLAUDECODE and
    AOFORGE_MODEL_PROFILE are absent even though the test sets them in the parent; HOME is inside the run dir;
    stdin delivered 0 bytes.
sandbox
12. mirrorRuntime with this checkout's `plugins/aoforge` into a temp HOME writes `.claude/aoforge/.plugin-version`
    equal to the plugin.json version; the test's real HOME is not read or written (the test sets a sentinel HOME
    for itself first).
13. ensureTrees on a temp repo with tags t1, t2 creates two detached worktrees under the temp root, writes
    trees.json with both SHAs, and is a no-op the second time.
command
14. buildArgv: `--agent` only for kind `agent`; one `--plugin-dir` per plugin dir; `--tools` joined with commas
    (`tools: []` gives `--tools ""`, all tools off, for the C grader; `tools: null` omits the flag);
    `--json-schema` as a JSON string; `--max-budget-usd` as a decimal string; `--output-format stream-json
    --verbose`; never the token.
tripwire
15. snapshot/diffSnapshots report HEAD change, porcelain change and file size/mtime/sha256 change; identical
    snapshots diff to an empty list.

<tasks>

<task type="auto">
  <name>Task 1: Fake claude and stub batch (fixture builders)</name>
  <files>scripts/eval81/__fixtures__/fake-claude.cjs, scripts/eval81/__fixtures__/stub-batch.cjs</files>
  <action>
`fake-claude.cjs` (shebang `#!/usr/bin/env node`, chmod 755): parse argv (`--model`, `--agent`, `--max-budget-usd`),
read the scenario from `./.fake-scenario` in its cwd (the stub batch's materialize writes it) and an optional
`FAKE_CLAUDE_MARKER` path from `./.fake-marker`; write the marker; emit stream-json lines on stdout built with
`__fixtures__/stream-json.cjs` (81-01) for scenarios `happy`, `usage_limit:<seconds>` (first call only, tracked by a
counter file in cwd), `slow:<ms>`, `wrong_model`, `wrong_tools`, `leak_token`, `touch_watched:<path>`, `env_dump`;
write a fake transcript (`$CLAUDE_CONFIG_DIR/projects/-fake/<session>.jsonl` plus one subagent jsonl and meta.json).
With no `.fake-scenario` file the scenario is `happy`. In `happy`, when `--agent <plugin>:<name>` and `--plugin-dir`
are given, the init event lists the tools from `<plugin-dir>/agents/<name>.md` frontmatter, so real batch modules
pass the runner's first-run tools check in 81-13's rehearsal (`wrong_tools` deliberately lists other tools).
The runner's tools check reads that same frontmatter `tools:` list: every declared non-MCP tool must appear in the
init event's tools, and the core tools the agent does NOT declare among Edit, Write, WebFetch, WebSearch and
NotebookEdit must be absent (MCP wildcards such as `mcp__gopls__*` are ignored). How the real CLI reports tools for
`--agent` is first observed on batch A's first live run; the live TRD says what to do if the check misfires.
`stub-batch.cjs`: batch `A`, three descriptors (kind agent, agent `aoforge:verifier`, models haiku/sonnet/haiku,
caps 0.5), materialize writes the scenario files from `desc.fixture.scenario`, collect returns `{echo: true}`.
  </action>
  <verify>printf '' | node scripts/eval81/__fixtures__/fake-claude.cjs -p x --model haiku (run in a temp dir containing .fake-scenario = happy) prints stream-json ending in a result event</verify>
  <done>The fake emits every scenario; stub-batch exports the batch module interface.</done>
  <recovery>If spawning the fake through its shebang fails on CI, invoke it as `process.execPath fake-claude.cjs` via a `--claude-bin` value of `node:<path>` handled by the runner (document it).</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Sandbox, command builder and tripwire</name>
  <files>scripts/eval81/lib/sandbox.cjs, scripts/eval81/lib/sandbox.test.cjs, scripts/eval81/lib/command.cjs, scripts/eval81/lib/command.test.cjs, scripts/eval81/lib/tripwire.cjs, scripts/eval81/lib/tripwire.test.cjs</files>
  <action>
RED first per test list 12-15.
- `sandbox.cjs`: `makeSandbox({root, batch, id})` → `{runDir, home, configDir, tmp, work}` (all created, fresh; an
  existing run dir for a pending id is moved to `<id>.prev-<n>` first, never deleted); `mirrorRuntime({pluginDir,
  home})` (spawnSync `process.execPath <pluginDir>/hooks/sync-runtime.js`, env `{PATH, HOME: home,
  CLAUDE_PLUGIN_ROOT: pluginDir}`, stdin ignore; then assert `.plugin-version`); `ensureTrees({repo, root, refs})`
  (`git -C <repo> worktree add --detach <root>/trees/v<ver> <ref>` when absent; verify
  `plugins/aoforge/.claude-plugin/plugin.json` version equals the key; write `trees.json`); `copyTranscripts(configDir,
  dest)`.
- `command.cjs`: `buildArgv(desc, {pluginDirs})` per test 14; `pluginDirs` is `[]` when `desc.plugin` is null.
- `tripwire.cjs`: `snapshot({repos: [{label, path}], files: [path]})` using `git --no-optional-locks -C <path>
  rev-parse HEAD` and `status --porcelain=v1 -uall`, and size/mtimeMs/sha256 per file (missing → `null`);
  `diffSnapshots(a, b)` → list of `{what, label, before, after}`.
  </action>
  <verify>node --test scripts/eval81/lib/sandbox.test.cjs scripts/eval81/lib/command.test.cjs scripts/eval81/lib/tripwire.test.cjs</verify>
  <done>Test list 12-15 pass; `git worktree list` in this checkout is unchanged after the tests.</done>
  <recovery>If sync-runtime.js needs more env than PATH/HOME/CLAUDE_PLUGIN_ROOT, add only what it reads (check with `rg -n "process.env" plugins/aoforge/hooks/sync-runtime.js`).</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Runner, CLI, dry run and README</name>
  <files>scripts/eval81/lib/runner.cjs, scripts/eval81/run.cjs, scripts/eval81/run.test.cjs, scripts/eval81/README.md</files>
  <action>
RED first per test list 1-11, one test at a time.

`runner.cjs` `runBatch(opts)` with injectable `sleep` and `now` (tests pass fakes). Per batch: load ledger (create
only with `initLedger`), `assertOrder`, load the batch module from `opts.batchDir` (default
`<__dirname>/../batches`), validate every descriptor (81-01), tripwire snapshot (this checkout from `opts.repo`,
plus `needsWatchedRepos`, plus `~/.claude/settings.json` and `~/.claude/CLAUDE.md` of the REAL home read via
`os.userInfo().homedir`, stat/read only). Then per pending run in order: `canStart` (refuse → `skipped_budget`, exit
3); sandbox; mirrorRuntime when `desc.plugin`; materialize; dry run → write redacted argv, record `dry_run`, next;
live → spawn (async `child_process.spawn`, stdio `['ignore', streamFd, stderrFd]`, `env: childEnv(...)`, cwd work,
timeout), parse the stream, rate-limit handling per the truths (waits ≤ 15 min total per run, backoff 60 s → 120 s →
240 s → 480 s or until reset + 30 s, whichever is later, max 4 waits), collect outputs, copy transcripts, write
record.json, `scanForSecret(runDir)` (hit → exit 6), `recordRun` + `saveLedger`, update the queue file. After the
loop: second tripwire snapshot and diff (exit 5), batch status `complete` when nothing is pending.

`run.cjs` CLI flags: `--batch --root --token-file [--claude-bin claude] [--dry-run] [--materialize none|first|all]
(dry run only; default first) [--stop-after N] [--init-ledger] [--calibration <path, default
~/.claude/aoforge/calibration.json, read-only>] [--repo <this checkout, default git rev-parse --show-toplevel>]
[--batch-dir <dir>] [--raw]`. Progress lines go to `R/queue/<batch>.log` and stderr, always through `redact()`.

README.md: purpose, the `--agent` rationale, root layout, every flag, exit codes, the safety rules (token, sandbox,
tripwire, order, ledger), how to resume after exit 3/4, and that dry runs make zero API calls.
  </action>
  <verify>node --test scripts/eval81/run.test.cjs (TMPDIR under the session scratchpad)</verify>
  <done>Test list 1-11 pass; `node --test scripts/eval81/` passes as a whole.</done>
  <recovery>If async spawn complicates the CLI exit, keep runBatch async and have run.cjs await it and set process.exitCode; never call process.exit inside the library.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/</test>
<test>npm test (git ls-files globs minus watcher-shell.test.cjs on this machine)</test>
</validation_gates>

<verification>
- `node --test scripts/eval81/` passes with TMPDIR and HOME pointed at scratch dirs.
- `git worktree list` and `git status --porcelain` of this checkout are unchanged by the tests.
- `rg -n "CLAUDE_CODE_OAUTH_TOKEN" scripts/eval81 --glob '!*.test.cjs'` appears only in secret.cjs and the README.
</verification>

<success_criteria>
The runner can execute any batch module's runs headless and sequentially under the ledger, pause on limits, stop
cleanly on budget, refuse to leak the token, detect writes outside its sandbox, and rehearse everything with zero
API calls.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-08-SUMMARY.md`
</output>
