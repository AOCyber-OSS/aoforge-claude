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
    - "`node scripts/eval81/run.cjs --batch X --root R --token-file T` runs a batch's descriptors one at a time, each as `claude -p` with `--output-format stream-json --verbose`, `--model`, `--max-budget-usd <cap>`, `--permission-mode bypassPermissions`, `--settings <run dir>/settings.json` (deny Read/Edit/Write under this checkout's parent dir, the real ~/.claude and every watched repo), `--plugin-dir` for its tree and `--agent` for agent runs, in a fresh HOME and CLAUDE_CONFIG_DIR under the run dir, cwd = a fresh materialised fixture copy inside the sandbox, stdin from /dev/null"
    - "`--dry-run` makes zero API calls: it never spawns the claude binary, reports token-file presence without printing it, the planned runs, their caps, reserves and derivations, the worst-case (sum of reserves) and estimated spend against the ledger, and writes each run's redacted argv and settings.json"
    - "Before every run the ledger check applies (total + reserve <= $100, where reserve = max(cap x 1.25, cap + the largest overshoot seen for that batch and role); batch spent + cap <= batch cap); a refused run stops the batch cleanly with exit 3 and nothing spawned; re-running the same command resumes and skips finished run ids"
    - "After each run the ledger charges max(reported cost, transcript-priced cost of the main session plus every subagent) and records cap, reserve and overshoot, so a cap the CLI overshoots or a reported cost that omits subagents cannot hide spend"
    - "The ledger survives the loss of the scratch root: `--init-ledger` is refused once any results/<X>.json exists in the results dir, and `--rebuild-ledger` reconstructs the ledger from the committed spend blocks (with `--charge-lost X=<usd>` for a batch that started but never committed)"
    - "A rate-limited or usage-limited run is never retried in a tight loop: the runner waits in-process with backoff only when the reset is within 15 minutes, otherwise stops with exit 4 and the resume time; the run stays pending"
    - "After each run the runner saves the stream, stderr, copied transcripts and the run record, scans the run dir for the token (exit 6 on a hit, never printing it), records model_ran and permission_denials, and proves isolation: the session's project dir exists under the sandbox CLAUDE_CONFIG_DIR and no real ~/.claude/projects entry exists for the run's work dir or the eval root (exit 5 otherwise); after the batch, a tripwire compares this checkout, any watched fleet source, the real ~/.claude settings.json and CLAUDE.md, the real ~/.claude/aoforge/.plugin-version and calibration.json, and the real projects entries under the eval root's key with their pre-batch state (exit 5 on a change)"
  artifacts:
    - path: scripts/eval81/run.cjs
      provides: "runner CLI with exit codes 0 complete, 2 usage/order/ledger, 3 budget stop, 4 paused (rate limit), 5 tripwire or isolation breach, 6 harness error; --rebuild-ledger, --charge-lost and --close-batch"
    - path: scripts/eval81/lib/sandbox.cjs
      provides: "makeSandbox, mirrorRuntime, ensureTrees, copyTranscripts"
    - path: scripts/eval81/lib/command.cjs
      provides: "buildArgv, buildSettings, denyRoots"
    - path: scripts/eval81/lib/tripwire.cjs
      provides: "snapshot, diffSnapshots, projectKey, realProjectsEntries, isolationCheck"
    - path: scripts/eval81/README.md
      provides: "harness usage, root layout, safety rules, exit codes"
  key_links:
    - from: scripts/eval81/lib/runner.cjs
      to: scripts/eval81/lib/ledger.cjs
      via: "canStart before each spawn, recordRun after (with transcriptCost), rebuildLedger for --rebuild-ledger"
      pattern: "canStart"
    - from: scripts/eval81/lib/runner.cjs
      to: scripts/eval81/lib/result.cjs
      via: "transcriptCost over the copied transcripts after every run"
      pattern: "transcriptCost"
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
Revision (job-checker, 2026-10-17): the runner reserves more than the cap and charges max(reported, transcript
cost) (blocker); the ledger is rebuildable from committed results and cannot be re-initialised once a batch is
committed (W1); the tripwire also covers the real runtime files and proves per run that HOME / CLAUDE_CONFIG_DIR
isolation held, and every session gets a `--settings` deny list for paths outside the sandbox (W3).
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
model, plugin, prompt, tools, jsonSchema, capUsd, capBasis, timeoutMs, env, fixture, order, role}`; RunRecord,
LedgerEntry and SpendBlock as listed there. Ledger API: `loadLedger(file, {create})`, `saveLedger`, `reserveFor`,
`canStart(l, {batch, role, capUsd})`, `recordRun`, `setBatchStatus`, `assertOrder`, `totalUsd`, `rebuildLedger`,
`chargeLost`. Result API: `parseStream(text, {requestedModel})`, `toolInputsMentioning`, `transcriptCost(dir,
{rates})`. Secret API: `readToken`, `childEnv`, `scanForSecret`, `redact`. Caps: `capFor`, `capForWorkflow`
(include the ~36K-token base-prompt allowance). Rates: `loadRates()` from
`plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs`. Spend blocks are committed by `score.cjs` (81-02) as
`results/<X>.json` `spend`.

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
(repeatable), `--model`, `--max-budget-usd` (print only; checked between turns, so a run can end above it),
`--output-format stream-json` (needs `--verbose` in print mode), `--permission-mode bypassPermissions`, `--settings
<file-or-json>` (additional settings, here only `permissions.deny`), `--tools "Read,Bash"`, `--json-schema <json>`.
`claude -p` must get stdin from /dev/null or a file: otherwise it waits 3 s and warns "no stdin data received" (seen
in the orchestrator's smoke test). Spawn with stdio[0] `'ignore'` (Node opens /dev/null). `--bare` is NOT usable:
it never reads OAuth. Auth via `CLAUDE_CODE_OAUTH_TOKEN` in a scratch HOME is confirmed (2026-10-17 smoke test:
subscription auth, claude-haiku-5-5 answered). A bare headless session reads about 36K cached base-prompt tokens per
run (in caps through 81-01's base allowance). Session transcripts land in
`$CLAUDE_CONFIG_DIR/projects/<key>/<session>.jsonl` with subagents under `<session>/subagents/agent-<id>.jsonl` and
`.meta.json`, where `<key>` is the session cwd with every character outside `[A-Za-z0-9]` replaced by `-` (this
checkout's own key is `-Users-justin-dev-aoforge-claude`). Permission rule paths: `//abs/path/**` is absolute; `~/`
would resolve to the sandbox HOME, so the real home is always written absolute.
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
- Never treat `--max-budget-usd` as a spend bound and never charge a run less than max(reported, transcript cost).
- Never write the real home's files from the runner or its tests: the real home is read (stat, readdir, sha256)
  only, and tests inject a stand-in `realHome` directory.
</anti_patterns>

<error_recovery>
- Ledger missing and no `--init-ledger`: exit 2 "ledger not found at <path>; pass --init-ledger only for the first
  batch, or --rebuild-ledger --results-dir <dir> if the eval root was lost". This stops a lost scratch dir from
  silently resetting spend to $0.
- `--init-ledger` while the results dir holds any of `A.json, B.json, C.json, D.json, E.json`: exit 2 naming the file
  and pointing at `--rebuild-ledger`. `--rebuild-ledger` while `R/ledger.json` exists: exit 2 (never overwrite live
  spend).
- A run killed by its timeout: SIGTERM, then SIGKILL after 10 s; status `timeout`; charged its transcript cost if
  transcripts exist, else its reserve.
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
resume_after) and `<batch>.log`, `R/runs/<batch>/<id>/{home/, work/, tmp/, argv.json (redacted), settings.json,
stream.jsonl, stderr.txt, record.json, transcripts/, outputs/}`, `R/tripwire/<batch>-{before,after}.json`.

Durability (W1): R and T live in the session scratchpad under /private/tmp, which a reboot or tmp cleanup can remove.
The committed copy of spend is `<results-dir>/<X>.json` `spend` (written by score.cjs right after each batch;
`--results-dir` defaults to `<repo>/.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results`).
After a loss: the user re-creates the token file, `--rebuild-ledger --root <new R> --results-dir <dir>` rebuilds the
ledger, `ensureTrees` re-creates the trees at the SHAs pinned in `results/prereg-manifest.json`, and a batch that had
started but not committed is charged with `--charge-lost X=<usd>` (the live TRDs say which figure).
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
- Isolation choice (W3; record it in the README and the SUMMARY). Runs use bypassPermissions plus Bash, so the
  guard is layered: (1) HOME, CLAUDE_CONFIG_DIR and TMPDIR inside the run dir and cwd = the sandbox work dir; (2) a
  `--settings` deny list, `Read(//<p>/**)`, `Edit(//<p>/**)`, `Write(//<p>/**)` for each deny root (`dirname(repo)`,
  i.e. ~/dev with this checkout and its siblings; `<realHome>/.claude`; every watched repo), derived at run time,
  never hard-coded; (3) a per-run isolation check (sandbox project dir present, no real projects entry); (4) the
  batch tripwire. Bash is not path-scoped (permission rules match command text, not the paths a command touches),
  so layers 1, 3 and 4 are what cover Bash. Whether deny rules bind under bypassPermissions is not probed with a
  paid run; it is observed: a run's `permission_denials` naming a path under a deny root is recorded as
  `escape_attempt` (the run continues, the report counts them), and a denial of a path inside the run dir or a tree
  means the deny list broke the agent (`harness_error`, exit 6 after that run). The runner refuses (exit 2, before
  any spawn) when R, a tree or the plugin dir lies under a deny root, since the agent could not then read its own
  inputs.
- The real-home tripwire files can change for reasons outside the eval (another Claude Code session of the user's
  re-mirroring the runtime, a `calibrate` run). Such a hit is still exit 5: report the diff, the user says whether it
  was theirs, and the batch resumes only on their word.
- The fake transcripts must use the real key rule (`projectKey(cwd)`), so the isolation check is exercised the same
  way in tests and live.
</gotchas>

## Test list

Outermost first; every test uses mkdtemp roots, a fake token file with a random test value, the fake claude, the
stub batch (passed as `--batch-dir <dir of stub-batch.cjs>` / `--claude-bin <fake>`), a temp `--results-dir`, a temp
`--repo` git repo, and a stand-in real home passed as `--real-home <tmp>` (test-only flag, documented in the README;
the default is `os.userInfo().homedir`). Layout per test: `<tmp>/dev/repo` (so the deny root `dirname(repo)` is
`<tmp>/dev`), `<tmp>/home` (stand-in real home), `<tmp>/eval` (R), `<tmp>/results`; tests that need R inside a deny
root say so.

CLI and runner
1. Dry run with `--init-ledger`: exit 0; JSON (`--raw`) lists 3 planned runs with caps, reserves and bases,
   worst-case (sum of reserves) and estimate, `token_file_present: true`; each run dir has a redacted `argv.json` and
   a `settings.json`; ledger total 0; the fake's marker file does not exist (no spawn); stdout and stderr do not
   contain the token; batch statuses in the ledger are unchanged. A later live run treats the dry-run ids as pending
   (dry_run is never "done").
2. No ledger and no `--init-ledger` -> exit 2 naming both `--init-ledger` and `--rebuild-ledger`.
3. Order: a live run of batch B while A is pending -> exit 2 naming A. A dry run of B reports the order status in
   its JSON and is not refused (so 81-13 can rehearse every batch).
4. Live with the `happy` scenario: 3 runs `ok`, ledger total = sum of the fake's costs, batch `complete`, each run
   dir has stream.jsonl, record.json and transcripts/; exit 0. Running again spawns nothing and exits 0.
4b. Re-open: a batch marked `complete` whose `runs()` now returns new pending runs (batch C lists its grader runs
   only once the agent outputs exist) goes back to `running`, runs only the new ids, and is `complete` again.
5. Ledger preset to 99.80 total: exit 3, record status `skipped_budget` for the first run, no spawn. Ledger preset
   to 99.45 with caps 0.5: exit 3 too (total + cap = 99.95 fits, total + reserve 0.625 does not), the record's
   reason is `global_cap` and its basis names the reserve.
6. `usage_limit` with reset in 30 s on the first attempt, then `happy`: the injected sleep is called with >= 30 s,
   the attempt is logged as `<id>@attempt1` with its (zero) cost, the run ends `ok`. Reset in 2 h: exit 4,
   `queue/<batch>.json` has `resume_after`, the run is still pending.
7. `slow` scenario beyond timeoutMs: status `timeout`; charged the transcript cost of what the fake wrote before it
   was killed, or the reserve when it wrote none (`reserve_charged`), never just the cap.
8. `wrong_model`: record `model_ran: false`, batch continues. `wrong_tools` on the first agent run: exit 6 after one
   run.
9. `leak_token` (the fake writes its token env value into a work file): exit 6; the printed message names the run
   dir; neither stdout nor stderr contains the token.
10. Tripwire: a temp git repo passed as a watched repo; the `touch_watched` scenario modifies it -> exit 5 and the
    batch status `stopped`.
11. Child env: the `env_dump` scenario writes its env NAMES to a file: PATH, HOME, CLAUDE_CONFIG_DIR, TMPDIR,
    CLAUDE_CODE_OAUTH_TOKEN and the descriptor's AOFORGE_SKIP_* are present; ANTHROPIC_API_KEY, CLAUDECODE and
    AOFORGE_MODEL_PROFILE are absent even though the test sets them in the parent; HOME is inside the run dir;
    stdin delivered 0 bytes and was not a TTY or pipe left open (the fake reports EOF at once).
16. Overshoot (blocker): `overshoot:0.40` on a cap-0.50 run reports `total_cost_usd` 0.90; the record has
    `cost_usd 0.90, cap_usd 0.50, overshoot_usd 0.40, cost_source "reported"`; the ledger total rises by 0.90 (not
    0.50); the next run of the same batch and role reserves 0.90 and, with the total preset so that total + 0.625
    fits but total + 0.90 does not, is refused with exit 3.
17. Subagent spend (blocker): `subagent_cost:0.50` reports 0.10 but writes a subagent transcript whose priced usage
    (test rates passed with `--rates <file>`, test-only) brings the transcript total to 0.60; the record keeps
    `cost_usd 0.10, transcript_cost_usd 0.60` and the ledger charges 0.60 with `cost_source "transcript_sum"`.
18. Ledger durability (W1): with `<results-dir>/A.json` present, `--init-ledger` exits 2 naming that file;
    `--rebuild-ledger --results-dir <dir>` over hand-built A.json and B.json (spend blocks per 81-01) writes
    `R/ledger.json` whose total equals their summed `spent_usd`, A and B `complete`, and exits 0 without spawning;
    a second `--rebuild-ledger` exits 2 (ledger exists); `--rebuild-ledger --charge-lost D=3` adds `D-lost-root` and
    leaves D `stopped`; a following live run of D refuses (D is not pending) and E's order check passes.
19. Isolation (W3): in `happy`, each run's record has `isolation: {sandbox_project: true, real_project: false,
    real_entries_under_root: []}`; the `touch_real_projects` scenario (the fake creates
    `<realHome>/.claude/projects/<projectKey(cwd)>/x.jsonl`; the stand-in real home path reaches the fake through a
    `.fake-real-home` file the stub batch writes) -> exit 5 after that run, batch `stopped`, message names the entry.
20. Settings deny list (W3): argv has `--settings <runDir>/settings.json`; the file denies Read, Edit and Write on
    `//<dirname(repo)>/**`, `//<realHome>/.claude/**` and each watched repo, and nothing else; a root R placed under
    `dirname(repo)` -> exit 2 before any spawn naming the deny root; the `deny_inside` scenario (a permission denial
    naming a path in the run dir) -> `harness_error`, exit 6 after one run; `deny_outside` (a denial naming
    `<repo>/package.json`) -> the run is `ok` with `escape_attempt: true` and the batch continues.
21. Real-home tripwire files: changing the stand-in `<realHome>/.claude/aoforge/calibration.json` (or
    `.plugin-version`) between the before and after snapshots (the `touch_watched` scenario pointed at it) -> exit 5
    naming the file.
22. `--close-batch A --reason "user stop"` with A `running` and one run pending: A becomes `stopped` with the
    reason stored, nothing spawns, exit 0; a later live run of A exits 2 ("batch A is stopped"); B's order check
    passes. (The live TRDs use it when the user stops a batch partway, e.g. E after its pilots.)
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
    --verbose`; `--settings <path>` when given; never the token. buildSettings(denyRoots) returns exactly
    `{permissions: {deny: [...]}}` with the three rules per root in `//abs/**` form; denyRoots({repo, realHome,
    watched}) dedupes and refuses a relative path.
tripwire
15. snapshot/diffSnapshots report HEAD change, porcelain change, file size/mtime/sha256 change and a change in the
    `projects` name list; identical snapshots diff to an empty list.
15b. projectKey('/private/tmp/a_b/c.d') = '-private-tmp-a-b-c-d'; realProjectsEntries({realHome, roots}) lists the
    names under `<realHome>/.claude/projects/` that start with projectKey of any root (given and realpath forms) and
    ignores other names (e.g. this checkout's own key); isolationCheck({realHome, configDir, workDir, root}) returns
    `{sandbox_project, real_project, real_entries_under_root}`.

<tasks>

<task type="auto">
  <name>Task 1: Fake claude and stub batch (fixture builders)</name>
  <files>scripts/eval81/__fixtures__/fake-claude.cjs, scripts/eval81/__fixtures__/stub-batch.cjs</files>
  <action>
`fake-claude.cjs` (shebang `#!/usr/bin/env node`, chmod 755): parse argv (`--model`, `--agent`, `--max-budget-usd`),
read the scenario from `./.fake-scenario` in its cwd (the stub batch's materialize writes it) and an optional
`FAKE_CLAUDE_MARKER` path from `./.fake-marker`; write the marker; emit stream-json lines on stdout built with
`__fixtures__/stream-json.cjs` (81-01) for scenarios `happy`, `usage_limit:<seconds>` (first call only, tracked by a
counter file in cwd), `slow:<ms>`, `wrong_model`, `wrong_tools`, `leak_token`, `touch_watched:<path>`, `env_dump`,
and for the revision: `overshoot:<usd>` (reported `total_cost_usd` = its `--max-budget-usd` + usd), `subagent_cost:<usd>`
(reported cost stays small; the subagent transcript carries usage worth usd more at the test rates),
`touch_real_projects` (creates `<real home>/.claude/projects/<projectKey(cwd)>/x.jsonl`, the real home read from
`./.fake-real-home`), `deny_inside` / `deny_outside` (a result event whose `permission_denials` names a path in cwd /
the path in `./.fake-deny-target`); write a fake transcript (`$CLAUDE_CONFIG_DIR/projects/<projectKey(cwd)>/
<session>.jsonl` plus one subagent jsonl and meta.json) whose usage prices to the reported cost at the test rates in
every scenario except `subagent_cost`. The fake inlines the key rule (`cwd.replace(/[^A-Za-z0-9]/g, '-')`; Task 2's
projectKey is the tested copy) and never writes outside its cwd, its CLAUDE_CONFIG_DIR and the paths a scenario
names.
With no `.fake-scenario` file the scenario is `happy`. In `happy`, when `--agent <plugin>:<name>` and `--plugin-dir`
are given, the init event lists the tools from `<plugin-dir>/agents/<name>.md` frontmatter, so real batch modules
pass the runner's first-run tools check in 81-13's rehearsal (`wrong_tools` deliberately lists other tools).
The runner's tools check reads that same frontmatter `tools:` list: every declared non-MCP tool must appear in the
init event's tools, and the core tools the agent does NOT declare among Edit, Write, WebFetch, WebSearch and
NotebookEdit must be absent (MCP wildcards such as `mcp__gopls__*` are ignored). How the real CLI reports tools for
`--agent` is first observed on batch A's first live run; the live TRD says what to do if the check misfires.
`stub-batch.cjs`: batch `A`, three descriptors (kind agent, agent `aoforge:verifier`, role `verifier`, models
haiku/sonnet/haiku, caps 0.5), materialize writes the scenario files from `desc.fixture.scenario` (plus
`.fake-real-home` / `.fake-deny-target` from `desc.fixture` when set), collect returns `{echo: true}`. A second
export `stubSpendBlock(batch, entries)` builds a results/<X>.json body with a valid spend block for test 18.
  </action>
  <verify>printf '' | node scripts/eval81/__fixtures__/fake-claude.cjs -p x --model haiku (run in a temp dir containing .fake-scenario = happy) prints stream-json ending in a result event</verify>
  <done>The fake emits every scenario; stub-batch exports the batch module interface.</done>
  <recovery>If spawning the fake through its shebang fails on CI, invoke it as `process.execPath fake-claude.cjs` via a `--claude-bin` value of `node:<path>` handled by the runner (document it).</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Sandbox, command builder and tripwire</name>
  <files>scripts/eval81/lib/sandbox.cjs, scripts/eval81/lib/sandbox.test.cjs, scripts/eval81/lib/command.cjs, scripts/eval81/lib/command.test.cjs, scripts/eval81/lib/tripwire.cjs, scripts/eval81/lib/tripwire.test.cjs</files>
  <action>
RED first per test list 12-15 and 15b.
- `sandbox.cjs`: `makeSandbox({root, batch, id})` → `{runDir, home, configDir, tmp, work}` (all created, fresh; an
  existing run dir for a pending id is moved to `<id>.prev-<n>` first, never deleted); `mirrorRuntime({pluginDir,
  home})` (spawnSync `process.execPath <pluginDir>/hooks/sync-runtime.js`, env `{PATH, HOME: home,
  CLAUDE_PLUGIN_ROOT: pluginDir}`, stdin ignore; then assert `.plugin-version`); `ensureTrees({repo, root, refs})`
  (`git -C <repo> worktree add --detach <root>/trees/v<ver> <ref>` when absent; verify
  `plugins/aoforge/.claude-plugin/plugin.json` version equals the key; write `trees.json`); `copyTranscripts(configDir,
  dest)`.
- `command.cjs`: `buildArgv(desc, {pluginDirs, settingsPath})` per test 14; `pluginDirs` is `[]` when `desc.plugin`
  is null. `denyRoots({repo, realHome, watched})` → absolute paths `[dirname(repo), <realHome>/.claude, ...watched]`;
  `buildSettings(roots)` → the deny-only settings object (test 14).
- `tripwire.cjs`: `snapshot({repos: [{label, path}], files: [path], projects: {realHome, roots}})` using `git
  --no-optional-locks -C <path> rev-parse HEAD` and `status --porcelain=v1 -uall`, size/mtimeMs/sha256 per file
  (missing → `null`) and the sorted `realProjectsEntries` list; `diffSnapshots(a, b)` → list of `{what, label,
  before, after}`; `projectKey(p)`; `realProjectsEntries({realHome, roots})`; `isolationCheck({realHome, configDir,
  workDir, root})`. The runner's file list is `<realHome>/.claude/settings.json`, `<realHome>/.claude/CLAUDE.md`,
  `<realHome>/.claude/aoforge/.plugin-version` and `<realHome>/.claude/aoforge/calibration.json`, read only.
  </action>
  <verify>node --test scripts/eval81/lib/sandbox.test.cjs scripts/eval81/lib/command.test.cjs scripts/eval81/lib/tripwire.test.cjs</verify>
  <done>Test list 12-15 and 15b pass; `git worktree list` in this checkout is unchanged after the tests.</done>
  <recovery>If sync-runtime.js needs more env than PATH/HOME/CLAUDE_PLUGIN_ROOT, add only what it reads (check with `rg -n "process.env" plugins/aoforge/hooks/sync-runtime.js`).</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Runner, CLI, dry run and README</name>
  <files>scripts/eval81/lib/runner.cjs, scripts/eval81/run.cjs, scripts/eval81/run.test.cjs, scripts/eval81/README.md</files>
  <action>
RED first per test list 1-11 and 16-22, one test at a time.

`runner.cjs` `runBatch(opts)` with injectable `sleep` and `now` (tests pass fakes). Ledger first: `--rebuild-ledger`
→ read every present `<results-dir>/{A,B,D,E,C}.json` `spend`, `rebuildLedger`, apply each `--charge-lost X=<usd>`
with `chargeLost`, save, exit 0 (no batch run, no spawn); `--init-ledger` → refuse when any of those results exists;
else load (create only with `initLedger`). Then `assertOrder`, load the batch module from `opts.batchDir` (default
`<__dirname>/../batches`), validate every descriptor (81-01), compute `denyRoots` and refuse (exit 2) when R, a
tree path or a plugin dir lies under one, and take the tripwire snapshot (this checkout from `opts.repo`, plus
`needsWatchedRepos`, plus the four real-home files and the real projects entries under R's key, all read via
`opts.realHome`, default `os.userInfo().homedir`, stat/read only). Then per pending run in order: `canStart` with
the descriptor's role (refuse → `skipped_budget`, exit 3); sandbox; mirrorRuntime when `desc.plugin`; materialize;
write `settings.json`; dry run → write redacted argv, record `dry_run` with cap and reserve, next; live → spawn
(async `child_process.spawn`, stdio `['ignore', streamFd, stderrFd]`, `env: childEnv(...)`, cwd work, timeout),
parse the stream, rate-limit handling per the truths (waits ≤ 15 min total per run, backoff 60 s → 120 s → 240 s →
480 s or until reset + 30 s, whichever is later, max 4 waits), collect outputs, copy transcripts, `transcriptCost`
on the copy (rates from `loadRates()`, or `--rates <file>` in tests), classify `permission_denials` (inside run
dir/tree → `harness_error`; under a deny root → `escape_attempt: true`), `isolationCheck` (breach → exit 5 after
recording), write record.json, `scanForSecret(runDir)` (hit → exit 6), `recordRun` + `saveLedger`, update the queue
file. After the loop: second tripwire snapshot and diff (exit 5), batch status `complete` when nothing is pending.

`run.cjs` CLI flags: `--batch --root --token-file [--claude-bin claude] [--dry-run] [--materialize none|first|all]
(dry run only; default first) [--stop-after N] [--init-ledger] [--rebuild-ledger] [--charge-lost X=<usd>]...
[--close-batch X --reason <text>]
[--results-dir <dir, default <repo>/.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results>]
[--calibration <path, default ~/.claude/aoforge/calibration.json, read-only>] [--repo <this checkout, default git
rev-parse --show-toplevel>] [--batch-dir <dir>] [--raw]`, plus the test-only `--real-home <dir>` and `--rates <file>`
(documented as such; the live TRDs never pass them). `--rebuild-ledger` needs only `--root` and `--results-dir`.
Progress lines go to `R/queue/<batch>.log` and stderr, always through `redact()`.

README.md: purpose, the `--agent` rationale, root layout, every flag, exit codes, the safety rules (token, sandbox,
isolation choice and its four layers, deny list, tripwire, order, ledger reserve and charging rule), durability
(results carry spend; rebuild and charge-lost; the token file must be re-created by the user), how to resume after
exit 3/4, and that dry runs make zero API calls.
  </action>
  <verify>node --test scripts/eval81/run.test.cjs (TMPDIR under the session scratchpad)</verify>
  <done>Test list 1-11 and 16-22 pass; `node --test scripts/eval81/` passes as a whole.</done>
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
- No test reads or writes the real `~/.claude` (every test passes `--real-home <tmp>/home`); `rg -n "userInfo"
  scripts/eval81/lib` shows it only as the `realHome` default.
</verification>

<success_criteria>
The runner can execute any batch module's runs headless and sequentially under the ledger, reserve for overshoot and
charge the larger of reported and transcript cost, pause on limits, stop cleanly on budget, rebuild its ledger from
committed results, refuse to leak the token, prove per run that the session stayed in its sandbox home, detect
writes outside its sandbox, and rehearse everything with zero API calls.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-08-SUMMARY.md`
</output>
