---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "08"
subsystem: testing
tags: [eval, harness, runner, sandbox, claude-p, tripwire, dry-run, ledger]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRD 81-01)
    provides: "contract.cjs validators, ledger.cjs (canStart, chargeFor, recordRun, rebuildLedger, chargeLost), result.cjs (parseStream, transcriptCost), secret.cjs (readToken, childEnv, redact, scanForSecret), caps.cjs basePromptUsd, __fixtures__/stream-json.cjs"
provides:
  - "scripts/eval81/run.cjs: runner CLI with exit codes 0 complete, 2 usage/order/ledger/deny-root, 3 budget stop, 4 paused, 5 tripwire or isolation breach, 6 harness error; --dry-run, --init-ledger, --rebuild-ledger, --charge-lost, --close-batch, --reopen --reason, --stop-after"
  - "scripts/eval81/lib/runner.cjs: runBatch(opts, {sleep, now, killGraceMs, parentEnv, stderr})"
  - "scripts/eval81/lib/sandbox.cjs: makeSandbox, mirrorRuntime, ensureTrees, copyTranscripts, moveAside"
  - "scripts/eval81/lib/command.cjs: buildArgv, buildSettings, denyRoots, underDenyRoot"
  - "scripts/eval81/lib/tripwire.cjs: snapshot, diffSnapshots, projectKey, realProjectsEntries, isolationCheck"
  - "scripts/eval81/__fixtures__/fake-claude.cjs (13 scenarios, TEST_RATES) and __fixtures__/stub-batch.cjs (makeStubBatch, stubSpendBlock)"
  - "scripts/eval81/README.md: usage, root layout, safety rules, exit codes, durability, resuming"
affects: [81-09, 81-10, 81-11, 81-12, 81-13, 81-14, 81-15, 81-16, 81-17, 81-18]

tech-stack:
  added: []
  patterns:
    - "Fresh sandbox per attempt (HOME, CLAUDE_CONFIG_DIR = HOME/.claude, TMPDIR, work dir inside the run dir); an existing run dir is moved to <id>.prev-<n>, never deleted"
    - "Reserve before the spawn (ledger.canStart), charge max(reported, transcript-priced) after, before any exit for a breach"
    - "Isolation in four layers: sandbox env, --settings deny list, per-run isolation proof, tripwire after every run"
    - "Every file and line the runner writes goes through secret.redact; argv.json shows the env with the token redacted by value"

key-files:
  created:
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
  modified: []

key-decisions:
  - "The prompt is the last argv element, after `--`, so a prompt starting with `-` is never read as a flag"
  - "A rate-limited attempt is charged as <id>@attempt<n> and the retry runs in a fresh sandbox (the limited attempt's dir becomes <id>.prev-<n>), so a scored run never inherits a half-done work dir or double-counts transcripts"
  - "The tripwire is compared after every run, not only after the batch, so a breach stops the batch at the run that caused it"
  - "A stopped batch (tripwire, isolation, post-spawn harness error, --close-batch) runs again only with --reopen --reason <text>; the reason is stored on the ledger row"
  - "R/.runner.lock enforces one runner per eval root; a lock held by a dead pid is taken over"
  - "The isolation proof requires a sandbox project dir only when the run reached a session (a result event or an assistant message)"
  - "--rebuild-ledger with no results file is refused (it would equal --init-ledger and silently reset spend if --results-dir were wrong)"

patterns-established:
  - "Runner tests: a stub world per test (<base>/dev/repo, <base>/home stand-in, <base>/eval, <base>/results, a stub plugin tree, <X>.cjs shims over stub-batch.cjs), --rates TEST_RATES, in-process main() with an injected sleep, and the CLI as a child where real stdout/stderr or a parent env matter"

requirements-completed: [SC-1]

verification:
  gates_defined: 2
  gates_passed: 2
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 30min
completed: 2026-10-17
tokens_input: 21614833
tokens_output: 220822
tokens_cache_read: 21265892
tokens_cache_write: 348771
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 08: Harness runner (sandbox, command, queue, pause/resume, budget stop, tripwire, dry run) Summary

## Progress
- [x] Task 1: Fake claude and stub batch (fixture builders) — 78f0dd40
- [x] Task 2: Sandbox, command builder and tripwire — 91c5b6a4
- [x] Task 3: Runner, CLI, dry run and README — 80fc2920

**The part of the eval harness that runs things. It runs a batch module's descriptors one at a time as `claude -p --output-format stream-json --verbose --agent ... --plugin-dir ... --max-budget-usd ... --settings <deny list>`. Each run gets a fresh sandbox HOME and CLAUDE_CONFIG_DIR, stdin from /dev/null, and an allowlisted env. Before each spawn the run must fit a reserve (total + max(cap x 1.25, cap + the largest overshoot seen) <= $100). After it, the ledger charges max(reported, transcript-priced) cost. The runner pauses on usage limits, proves per run that the session stayed in its sandbox, and runs a tripwire on the checkout, watched repos and real ~/.claude files. A dry run plans everything with zero API calls. All of it is tested against a scenario-driven fake claude.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-17T16:43:25Z
- **Completed:** 2026-10-17T17:13:54Z
- **Tasks:** 3
- **Files created:** 12

## Accomplishments
- `run.cjs` / `runBatch` runs a batch end to end:
  - ledger first: create only with `--init-ledger`, refused once any results/<X>.json exists
  - order A, B, D, E, C
  - descriptors validated against the 81-01 contract
  - plugin dirs resolved from R/trees.json
  - deny-root refusal (R, a tree or a plugin dir under a deny root exits 2 before any spawn)
  - per run: canStart, fresh sandbox, runtime pre-mirror through the tree's own sync-runtime.js, materialize, settings.json plus redacted argv.json, spawn, stream parse, transcript copy and pricing, isolation proof, permission-denial classification, tools check, collect, charge, secret scan, tripwire compare
- Exit codes 0 complete, 2 usage/order/ledger, 3 budget stop, 4 paused, 5 tripwire or isolation breach, 6 harness error. The library never calls process.exit.
- Spend can neither hide nor be lost:
  - an overshooting cap is charged the reported 0.90, not the 0.50 cap, and raises the next same-role reserve to 0.90
  - a subagent-heavy run is charged its transcript sum (0.60 against a reported 0.10)
  - a killed run is charged its partial transcript cost, or its reserve when it left none
  - `--rebuild-ledger` (with `--charge-lost X=<usd>`) reconstructs the ledger from committed spend blocks and never overwrites a live one
- Usage limits:
  - a reset within 15 minutes is waited out in-process (backoff 60/120/240/480 s or reset + 30 s, max 4 waits); the limited attempt is charged as `<id>@attempt<n>`
  - a later reset exits 4 with `resume_after` in R/queue/<X>.json; re-running early spawns nothing
- Isolation, in four layers:
  - sandbox env
  - `--settings` deny list on dirname(repo), <real home>/.claude and every watched repo
  - per-run `record.isolation`
  - the tripwire after every run, which stops the batch with exit 5 at the run that breached
- `--dry-run` writes every run's settings.json, redacted argv.json and a dry_run record. It materialises the first run by default and reports caps, reserves, bases, the real-rate base-prompt share, worst case (sum of reserves), the batch estimate and order status. It never spawns, never reads the token (stat only), never charges and never changes a batch status.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Fake claude and stub batch | `printf '' \| node scripts/eval81/__fixtures__/fake-claude.cjs -p x --model haiku` in a temp dir holding `.fake-scenario` = happy (HOME in the scratchpad) | 0 | PASS: stream-json ending in a `result` event; transcript priced at TEST_RATES = reported 0.05 (main 0.04 + subagent 0.01) |
| 2: Sandbox, command builder and tripwire | `node --test scripts/eval81/lib/sandbox.test.cjs scripts/eval81/lib/command.test.cjs scripts/eval81/lib/tripwire.test.cjs` | 0 | PASS (19/19); `git worktree list` of this repo unchanged |
| 3: Runner, CLI, dry run and README | `node --test scripts/eval81/run.test.cjs` (HOME and TMPDIR in the scratchpad) | 0 | PASS (25/25) |

## Task Commits

1. **Task 1: Fake claude and stub batch (fixture builders)** - `78f0dd40` (test)
2. **Task 2: Sandbox, command builder and tripwire** - `91c5b6a4` (feat)
3. **Task 3: Runner, CLI, dry run and README** - `80fc2920` (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81) | `node --test 'scripts/eval81/**/*.test.cjs'` (glob form; Node 24 rejects a directory argument) | 0 | PASS (287 tests: 286 pass, 1 skipped = 81-06's private-checklist proof, absent on this machine) |
| test (full suite) | npm test globs over tracked + untracked files minus watcher-shell.test.cjs (436 files; node_modules symlinked temporarily and removed after) | 0 | PASS (15,528 tests, 0 failures) |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (Task 2) | `node --test scripts/eval81/lib/{sandbox,command,tripwire}.test.cjs` | 1 | FAIL (correct: 19/19 failing, modules missing) |
| GREEN (Task 2) | same | 0 | PASS (19/19) |
| RED (Task 3) | `node --test scripts/eval81/run.test.cjs` | 1 | FAIL (correct: 25/25 failing, run.cjs missing) |
| GREEN (Task 3) | same | 0 | PASS (25/25) |

No REFACTOR phase was needed. Task 1 is a fixture task (no tdd flag).

## Dry-run projection (stub batch)

The real batch modules (81-09..81-12) are wave-2 siblings, so this TRD's only projection is the stub batch A (3 runs, caps 0.5, haiku/sonnet/haiku):

- planned 3; sum of caps $1.5; worst case (sum of reserves) $1.875 (each 0.5 x 1.25 = 0.625)
- batch estimate $5; projected total $5; worst-case total $1.875; caps within A's $7.5 batch cap
- base-prompt share at real rates $0.2718 in all ($0.0189 per haiku run)
- `token_file_present: true`; ledger total $0; every batch `pending`; nothing spawned

The real projection for every batch is 81-13's job (Task 1, `R/projection.json`).

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 7/7 truths (tests 1-11, 16-22), 5/5 artifacts, 4/4 key links. The links are: `canStart`, `recordRun`, `rebuildLedger` and `chargeLost` in runner.cjs; `transcriptCost` after every run; batch modules loaded from `<batch dir>/<X>.cjs`; `sync-runtime.js` in sandbox.mirrorRuntime.
- **Gate failures:** None
- `rg -n "CLAUDE_CODE_OAUTH_TOKEN" scripts/eval81 --glob '!*.test.cjs'` matches only lib/secret.cjs and README.md.
- `rg -n "userInfo" scripts/eval81/lib` matches only the `realHome` default in runner.cjs.
- `rg -n "oauth-token|/private/tmp/claude-501|8080"` over the new files matches nothing.
- `git status --porcelain` showed only this TRD's files after every test run, and `git worktree list` was unchanged.
- No test touched the real home. Every runner test passes `--real-home <tmp>/home`, and every test ran with HOME and TMPDIR in the scratchpad.
- The real `claude` binary was never executed. Every live test passes `--claude-bin <fake>`, and the dry run never spawns.
- The real token file was not touched.

## Files Created/Modified
- `scripts/eval81/__fixtures__/fake-claude.cjs` - executable fake `claude`. It covers 13 scenarios and emits stream-json through the 81-01 builders. Its transcripts price to the reported cost at TEST_RATES (except `subagent_cost`), and it reads agent frontmatter so real batch modules pass the tools check.
- `scripts/eval81/__fixtures__/stub-batch.cjs` - the batch module interface with 3 descriptors, tuned by `<root>/stub-batch.json`. Also exports `makeStubBatch(X)` and `stubSpendBlock`.
- `scripts/eval81/lib/sandbox.cjs` - makeSandbox (moves an existing dir to `<id>.prev-<n>`), mirrorRuntime, ensureTrees (detached worktrees, version check, idempotent trees.json), copyTranscripts.
- `scripts/eval81/lib/command.cjs` - buildArgv (prompt last after `--`), denyRoots (plus realpath forms), buildSettings, underDenyRoot.
- `scripts/eval81/lib/tripwire.cjs` - snapshot/diffSnapshots (HEAD, porcelain, file size/mtime/sha256, real projects entries), projectKey, realProjectsEntries, isolationCheck.
- `scripts/eval81/lib/runner.cjs` - runBatch: ledger, order, plan, dry run, live loop, rate-limit waits, rebuild, close, lock.
- `scripts/eval81/run.cjs` - CLI parsing, defaults (repo from git, results dir, calibration from the real home), report printing.
- `scripts/eval81/README.md` - usage, `--agent` rationale, root layout, flags, exit codes, safety rules, ledger, rate limits, durability, resuming.
- `scripts/eval81/*.test.cjs`, `lib/{sandbox,command,tripwire}.test.cjs` - 44 tests covering test list 1-22 with 4b and 15b.

## Decisions Made
- The prompt is the last argv element, after `--`. A prompt starting with `-` (YAML front matter, a list) is then never read as a flag, and no variadic flag can swallow it. commander, which the CLI uses, treats `--` as the end of options. The first live run (81-14) confirms this.
- The CLAUDE_CONFIG_DIR is `<run>/home/.claude`, the production layout, so the runtime mirror sits at `$CLAUDE_CONFIG_DIR/aoforge/`.
- The pre-mirror lets sync-runtime's global upgrade run (AOFORGE_SKIP_GLOBAL_UPGRADE not set), so the sandbox CLAUDE.md matches production. The README says so.
- Post-spawn harness errors stop the batch: a token in the run dir, an init-tools mismatch, or a denial inside the sandbox. This is so a blind re-run cannot spend a second cap. Pre-spawn harness errors (module, descriptor, mirror, materialize, spawn failure) leave the status alone and charge nothing.
- The tools check runs on every agent run with an init event, not only the first. Its expected list is `desc.tools` when the descriptor sets `--tools`, else the agent frontmatter. An agent file with no `tools:` line skips the check, because that agent gets all tools.
- outputs/outputs.json holds collect()'s return value, which is also in `record.outputs`. 81-09's scorer reads both.
- The dry run's base-prompt share is priced at the real rates even when the test-only `--rates` is given, because it projects real money.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `--reopen --reason <text>` for a stopped batch**
- **Found during:** Task 3
- **Issue:** The TRD has three things that stop a batch: tripwire hits, isolation breaches and `--close-batch`. It then makes a live run of a stopped batch exit 2 (test 22). It also says a tripwire hit resumes "only on the user's word". Without a flag, there was no path back except hand-editing ledger.json.
- **Fix:** `--reopen --reason <text>` lets a stopped batch run again and stores `reopen_reason` / `reopened_at` on the ledger row. Without `--reason` it is a usage error (exit 2).
- **Files modified:** scripts/eval81/lib/runner.cjs, scripts/eval81/run.cjs, scripts/eval81/README.md
- **Verification:** run.test.cjs "--reopen --reason resumes a stopped batch on the user's word"
- **Committed in:** 80fc2920

**2. [Rule 2 - Missing critical] One runner per eval root (`R/.runner.lock`)**
- **Found during:** Task 3
- **Issue:** The TRD forbids parallel runs (the ledger and the rate limit assume one at a time) but nothing enforced it. Two invocations on one root would race the ledger.
- **Fix:** an O_EXCL lock file holding the pid. A live pid is refused (exit 2). A dead pid's lock is taken over. The lock is released in `finally`.
- **Files modified:** scripts/eval81/lib/runner.cjs
- **Verification:** run.test.cjs "lock: a second runner on the same root is refused with exit 2"
- **Committed in:** 80fc2920

**3. [Rule 1 - Bug] Charge before the secret-scan exit**
- **Found during:** Task 3
- **Issue:** The TRD lists "write record.json, scanForSecret (hit -> exit 6), recordRun + saveLedger". In that order a leaking run would exit before its spend reached the ledger.
- **Fix:** record.json, recordRun and saveLedger come first, then the scan. Test 9 asserts the leaking run is charged.
- **Files modified:** scripts/eval81/lib/runner.cjs
- **Committed in:** 80fc2920

**4. [Rule 2 - Missing critical] A fresh sandbox per rate-limit retry; the fake's call counter lives outside cwd**
- **Found during:** Task 1 / Task 3
- **Issue:** Retrying in the same work dir would let a scored attempt inherit a half-done work dir. Its copied transcripts would also include the limited attempt's session, which is already charged as `<id>@attempt<n>` (a double charge). But the TRD's "counter file in cwd" for `usage_limit` only works if the retry reuses cwd.
- **Fix:** each attempt gets a fresh sandbox, and the limited attempt's dir becomes `<id>.prev-<n>`. The fake keeps its counter in `./.fake-state-dir` (written by materialize, `R/fake-state/<id>`), falling back to cwd.
- **Files modified:** scripts/eval81/__fixtures__/fake-claude.cjs, scripts/eval81/__fixtures__/stub-batch.cjs, scripts/eval81/lib/runner.cjs
- **Verification:** run.test.cjs test 6 (`A-stub-1.prev-1` exists; the final record has `attempt: 2`)
- **Committed in:** 78f0dd40, 80fc2920

**5. [Rule 1 - Bug] The isolation proof expects a sandbox project dir only from a run that reached a session**
- **Found during:** Task 3
- **Issue:** Test 7's silent timeout writes no transcript at all. Read literally ("the session's project dir exists ... exit 5 otherwise"), it would be an isolation breach.
- **Fix:** the record always carries `isolation`. The batch counts a breach when any of these holds: a real projects entry for the work dir, a new real entry under R's key, or a missing sandbox project dir for a run with a result event or an assistant message.
- **Files modified:** scripts/eval81/lib/runner.cjs
- **Committed in:** 80fc2920

**6. [Rule 3 - Blocking] Test batch dir of shims instead of `--batch-dir <dir of stub-batch.cjs>`**
- **Found during:** Task 3
- **Issue:** The runner loads `<batch dir>/<X>.cjs` by batch id. The fixtures dir has no `A.cjs`, and it holds fake-claude.cjs, which runs when required as main.
- **Fix:** stub-batch.cjs exports `makeStubBatch(X)`. Each test writes `<tmp>/batches/<X>.cjs` shims (`module.exports = require(<stub>).makeStubBatch('X')`) and passes that dir.
- **Files modified:** scripts/eval81/__fixtures__/stub-batch.cjs, scripts/eval81/run.test.cjs
- **Committed in:** 78f0dd40, 80fc2920

**7. [Rule 2 - Missing critical] Token name kept out of everything but secret.cjs**
- **Found during:** Task 3 verification
- **Issue:** The verification requires the token env name to appear only in secret.cjs and the README. My first runner draft named it when redacting argv.json, and the fake named it in `leak_token`.
- **Fix:** argv.json's env is redacted by value. `leak_token` now writes the whole environment the way an agent running `env > leak.txt` would, so the token leaks without the fake naming it.
- **Files modified:** scripts/eval81/lib/runner.cjs, scripts/eval81/__fixtures__/fake-claude.cjs
- **Committed in:** 80fc2920

**8. [Rule 2 - Missing critical] Small refusals**
- **Found during:** Task 3
- **Fix:** the runner now refuses each of the following:
  - `--rebuild-ledger` with no results file. It would equal `--init-ledger`, so a wrong `--results-dir` would silently reset spend.
  - `--close-batch` on a complete batch.
  - `--charge-lost` without `--rebuild-ledger`.
  - `--materialize` without `--dry-run`.

  Each exits 2.
- **Files modified:** scripts/eval81/lib/runner.cjs, scripts/eval81/run.cjs
- **Committed in:** 80fc2920

**9. [Rule 2 - Missing critical] The tripwire runs after every run**
- **Found during:** Task 3
- **Issue:** The TRD only snapshots before and after the batch. A breach on run 2 of 48 would then go unnoticed for 46 more spawns.
- **Fix:** the after-snapshot is taken and compared after every run, which also covers "after the batch". R/tripwire/<X>-after.json holds the latest.
- **Files modified:** scripts/eval81/lib/runner.cjs
- **Verification:** test 10 (exit 5 after run 2, run 3 never spawned)
- **Committed in:** 80fc2920

---

**Total deviations:** 9 (2 bugs, 6 missing critical, 1 blocking)
**Impact on plan:** All additive or stricter. Every TRD-specified name, flag, exit code and test expectation holds as written.

## Issues Encountered
- `git symbolic-ref` exits 1 on a detached HEAD, so test 13's detached check uses `rev-parse --abbrev-ref HEAD` = `HEAD` instead.
- None of the runner tests needed a second iteration after RED.

## Risks for the first live run (81-14)
- If the real CLI persists `CLAUDE_CODE_OAUTH_TOKEN` anywhere under the sandbox HOME, the post-run scan will find it and exit 6 after one run. That costs one run's cap and is the safe outcome. The live TRD decides how to proceed.
- The tools check expects `--agent` sessions to list the agent's tools in the init event. If the real CLI lists them differently, the first run exits 6, as the TRD anticipates.
- `--` before the prompt is standard commander behaviour, but it has not been observed live.

## User Setup Required

None. No external service configuration is required.

## Next Objective Readiness
- 81-09..81-12 batch modules plug in as `scripts/eval81/batches/<X>.cjs`. 81-09's scorer already skips `<id>.prev-<n>` and reads `record.outputs` plus `outputs/outputs.json`, matching what the runner writes.
- 81-13 can run `ensureTrees`, the five dry runs (`--dry-run --init-ledger --materialize first --raw` for A, then B, D, E, C) and the fake-claude rehearsal with `--claude-bin scripts/eval81/__fixtures__/fake-claude.cjs` (a relative path is resolved against the current directory). The fake prices every transcript at TEST_RATES and reports 10% of each run's cap, so rehearsal spend stays well under the batch caps.
- The live TRDs use exit 3/4/5/6 as the README describes, and `--close-batch` / `--reopen --reason` for user decisions.

## Self-Check: PASSED

- FOUND: scripts/eval81/__fixtures__/{fake-claude.cjs (mode 100755), stub-batch.cjs}
- FOUND: scripts/eval81/lib/{sandbox,command,tripwire}.cjs and their .test.cjs files, scripts/eval81/lib/runner.cjs
- FOUND: scripts/eval81/run.cjs, scripts/eval81/run.test.cjs, scripts/eval81/README.md
- FOUND: 78f0dd40, 91c5b6a4, 80fc2920 on df/exec-81-08-harness-runner-sandbox-dry-run
- Worktree clean after the Task 3 commit; the temporary node_modules symlink was removed
