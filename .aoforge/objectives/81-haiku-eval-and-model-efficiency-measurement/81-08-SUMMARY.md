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
---

# Objective 81 TRD 08: Harness runner (sandbox, command, queue, pause/resume, budget stop, tripwire, dry run) Summary

## Progress
- [x] Task 1: Fake claude and stub batch (fixture builders) — 78f0dd40
- [x] Task 2: Sandbox, command builder and tripwire — 91c5b6a4
- [x] Task 3: Runner, CLI, dry run and README — (this commit)
