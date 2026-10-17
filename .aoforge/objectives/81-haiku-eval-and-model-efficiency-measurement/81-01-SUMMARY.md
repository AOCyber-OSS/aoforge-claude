---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "01"
subsystem: testing
tags: [eval, harness, ledger, stream-json, claude-p, oauth]

requires: []
provides:
  - "scripts/eval81/lib/contract.cjs: BATCHES, ORDER, MODELS, PLUGINS, KINDS, STATUSES, COST_SOURCES, BATCH_STATUSES, ENTRY_STATUSES, ENV_ALLOW, validateDescriptor, validateRecord, validateSpendBlock (RunDescriptor/RunRecord/LedgerEntry/SpendBlock documented in the module comment)"
  - "scripts/eval81/lib/result.cjs: parseStream, parseResultEvent, firstTurnInput, modelRan, pinnedId, isRateLimit, toolInputsMentioning, transcriptCost, LONG_PROMPT"
  - "scripts/eval81/lib/ledger.cjs: newLedger, loadLedger, saveLedger, totalUsd, reserveFor, canStart, chargeFor, recordRun, setBatchStatus, assertOrder, spendBlockFor, rebuildLedger, chargeLost, BATCH_CAPS, GLOBAL_CAP_USD, OVERSHOOT_FACTOR"
  - "scripts/eval81/lib/caps.cjs: capFor, capForWorkflow, basePromptUsd, TIER_FACTOR, FLOOR, CEILING, FALLBACK_P90, BASE_PROMPT_TOKENS, BASE_TURNS"
  - "scripts/eval81/lib/secret.cjs: readToken, childEnv, redact, scanForSecret"
  - "scripts/eval81/__fixtures__/stream-json.cjs and calibration.cjs hand-built builders"
affects: [81-02, 81-08, 81-09, 81-10, 81-11, 81-12, 81-13, 81-14, 81-17]

tech-stack:
  added: []
  patterns:
    - "Reserve-before-run ledger: total + max(cap x 1.25, cap + largest overshoot for the same batch and role) <= $100"
    - "Charge max(reported, transcript-priced) cost after a run; the reserve when neither exists"
    - "Child env from an allowlist; token only in CLAUDE_CODE_OAUTH_TOKEN, errors name the token file path only"

key-files:
  created:
    - scripts/eval81/lib/contract.cjs
    - scripts/eval81/lib/result.cjs
    - scripts/eval81/lib/secret.cjs
    - scripts/eval81/lib/ledger.cjs
    - scripts/eval81/lib/caps.cjs
    - scripts/eval81/__fixtures__/stream-json.cjs
    - scripts/eval81/__fixtures__/calibration.cjs
  modified: []

key-decisions:
  - "Overshoot history raises the reserve only for the same batch AND role, so E's subagent-heavy builds never starve single-agent C runs"
  - "recordRun never charges a dry_run or skipped_budget record (nothing was spawned); a run with no reported cost and an unpriced transcript is charged at least its reserve"
  - "FALLBACK_P90 also carries verifier 1.7634, job-checker 1.5977, planner 15.2542 and executor 4.0386 (today's calibration) so the batch modules' calibration: null call sizes every role"
  - "Executor p90 comes from calibration trd_level.cost_usd.p90 (it has no agent_overhead row); the build/quick orchestrator is costed as planner p90 x opus"
  - "capFor requires batch A-D (E goes through capForWorkflow) so no cap is ever unclamped"

patterns-established:
  - "eval81 tests: node:test, hand-built literals from __fixtures__, mkdtemp under TMPDIR, no network, no ~/.claude"

requirements-completed: [SC-1]

verification:
  gates_defined: 2
  gates_passed: 2
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 12min
completed: 2026-10-17
tokens_input: 11695125
tokens_output: 120288
tokens_cache_read: 11432411
tokens_cache_write: 262588
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 01: Harness core (run contract, stream parser, ledger, caps, secret handling) Summary

**Pure, tested core of the objective-81 eval harness: a documented run contract, a stream-json parser with transcript pricing (subagents, 1h writes, Haiku 5x over 100K), a $100 reserve-before-run ledger that charges max(reported, transcript) and rebuilds from committed spend blocks, calibration-p90 cap sizing with the 36K base-prompt allowance, and allowlisted child env that keeps the OAuth token out of argv, logs and files.**

## Progress
- [x] Task 1: Fixture builders and the run contract — 7e9151b7
- [x] Task 2: Stream parser and secret handling — 781b6261
- [x] Task 3: Ledger and cap sizing — 7c69ab5a

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-17T15:58:17Z
- **Completed:** 2026-10-17T16:10:20Z
- **Tasks:** 3
- **Files created:** 12

## Accomplishments
- The run contract (RunDescriptor, RunRecord, LedgerEntry, SpendBlock) is fixed in one module comment with validators the runner and batch specs call; ORDER is A, B, D, E, C.
- parseStream turns a stream-json log into the record fields: reported cost, usage split, first-turn input (deduped by message id, main thread only), modelUsage, model_ran against the profile pin (>= 90% of output, side models listed), status ok | error | cap_hit | rate_limited (with reset epoch) | no_result, permission_denials and structured_output.
- transcriptCost prices main and subagent transcripts from model-rates.json via rateFor, splitting 5m/1h cache writes and applying Haiku's 5x rate above a 100K prompt; an unknown model is counted as unpriced and flags the result.
- The ledger reserves max(cap x 1.25, cap + the largest same-batch-and-role overshoot) before a run, charges max(reported, transcript) after, the reserve when neither exists, writes atomically, refuses out-of-order batches and rebuilds from committed spend blocks; chargeLost covers a lost scratch root.
- capFor/capForWorkflow size caps from calibration p90 x tier factor + the 36K base-prompt allowance, floored and clamped per batch, with a derivation string.
- childEnv builds the child env from an allowlist and the token only ever travels in CLAUDE_CODE_OAUTH_TOKEN; scanForSecret finds the token in any text or binary file.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Fixture builders and the run contract | `node --test scripts/eval81/lib/contract.test.cjs` | 0 | PASS (7/7) |
| 2: Stream parser and secret handling | `node --test scripts/eval81/lib/result.test.cjs scripts/eval81/lib/secret.test.cjs` | 0 | PASS (20/20) |
| 3: Ledger and cap sizing | `node --test scripts/eval81/lib/ledger.test.cjs scripts/eval81/lib/caps.test.cjs` | 0 | PASS (17/17) |

All test runs used `HOME` and `TMPDIR` under the session scratchpad.

## Task Commits

1. **Task 1: Fixture builders and the run contract** - `7e9151b7` (feat)
2. **Task 2: Stream parser and secret handling** - `781b6261` (feat)
3. **Task 3: Ledger and cap sizing** - `7c69ab5a` (feat)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81) | `node --test 'scripts/eval81/lib/*.test.cjs'` | 0 | PASS (44/44) |
| test (full suite) | npm test globs from `git ls-files` minus watcher-shell.test.cjs (422 files; node_modules symlinked temporarily, removed after) | 0 | PASS (15,249 passing, 0 failing) |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (contract) | `node --test scripts/eval81/lib/contract.test.cjs` | 1 | FAIL (correct: module missing) |
| GREEN (contract) | same | 0 | PASS (correct) |
| RED (result) | `node --test scripts/eval81/lib/result.test.cjs` | 1 | FAIL (correct: 16 failing) |
| GREEN (result) | same | 0 | PASS (14/14) |
| RED (secret) | `node --test scripts/eval81/lib/secret.test.cjs` | 1 | FAIL (correct: 9 failing) |
| GREEN (secret) | same | 0 | PASS (6/6) |
| RED (ledger) | `node --test scripts/eval81/lib/ledger.test.cjs` | 1 | FAIL (correct: module missing) |
| GREEN (ledger) | same | 0 | PASS (13/13) |
| RED (caps) | `node --test scripts/eval81/lib/caps.test.cjs` | 1 | FAIL (correct: module missing) |
| GREEN (caps) | same | 0 | PASS (4/4) |

No REFACTOR phase was needed.

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 7/7 truths, 5/5 artifacts, 3/3 key links (`model-profiles.json` and `rateFor` in result.cjs, `require('./contract.cjs')` in ledger.cjs)
- **Gate failures:** None
- `rg -n "process\.env" scripts/eval81/lib/` matches only secret.cjs's `parentEnv = process.env` default (and its doc line); `readToken` and `CLAUDE_CODE_OAUTH_TOKEN` appear only in secret.cjs.
- `rg -n "oauth-token|/private/tmp/claude-501" scripts/eval81/` matches nothing.
- `rg -n "console\." scripts/eval81/lib/secret.cjs` matches nothing (also asserted by a test).

## Files Created/Modified
- `scripts/eval81/lib/contract.cjs` - run contract shapes, constants and validators
- `scripts/eval81/lib/result.cjs` - stream-json parser, model_ran, rate-limit detection, contamination scan, transcript pricing
- `scripts/eval81/lib/secret.cjs` - token read, allowlisted child env, redact, token scan
- `scripts/eval81/lib/ledger.cjs` - $100 running-total ledger with reserves, atomic save, rebuild and lost-root charge
- `scripts/eval81/lib/caps.cjs` - per-run and per-workflow caps from calibration p90
- `scripts/eval81/__fixtures__/stream-json.cjs` - hand-built stream event builders and six canned streams
- `scripts/eval81/__fixtures__/calibration.cjs` - hand-built calibration builder
- `scripts/eval81/lib/*.test.cjs` - 44 tests covering test list 1-26 with 12b, 18b and 22b

## Decisions Made
- Reserve history is keyed by batch AND role (the module comment names this reading of the checker's "cap + max observed overshoot").
- `recordRun` returns `{recorded, reason, entry}`: `duplicate` for a repeated id (ledger untouched), `not_charged` for `dry_run` / `skipped_budget`. `chargeFor(l, record)` exposes the same money fields without mutating, so the runner can fill record.json before it calls recordRun.
- `spendBlockFor(l, batch)` builds the SpendBlock exactly as 81-02's score.cjs is to write it; `rebuildLedger` sorts blocks into A, B, D, E, C order.
- A LedgerEntry status may also be `lost_root` (contract `ENTRY_STATUSES`), used only by chargeLost; run records keep the nine STATUSES.
- parseStream detects a budget stop from the subtype or terminal reason, or from the result text only on an error result, so an answer that discusses budgets is not a cap hit; likewise a 429 in text counts only on an error result.
- first_turn_input skips relayed subagent rows (`parent_tool_use_id` set).
- No calibration passed means FALLBACK_P90 for every role; capFor never auto-reads ~/.claude.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] FALLBACK_P90 extended with verifier, job-checker, planner and executor**
- **Found during:** Task 3
- **Issue:** 81-09/81-12 call `runs({calibration: null})`, which reaches `capFor({role: 'verifier' | 'job-checker'})` and `capForWorkflow` (planner, executor) with no calibration; the TRD's FALLBACK_P90 had no entry for those roles, so the calls would throw.
- **Fix:** added today's calibration values (verifier 1.7634, job-checker 1.5977, planner 15.2542 agent_overhead p90; executor 4.0386 trd_level p90), named in the module comment.
- **Files modified:** scripts/eval81/lib/caps.cjs
- **Verification:** caps test 24 (null-calibration verifier basis names the fallback), test 26 (`capForWorkflow('quick')` bare call)

**2. [Rule 2 - Missing critical] Partial transcript pricing never under-charges a run with no reported cost**
- **Found during:** Task 3
- **Issue:** a killed run (no result event) whose transcripts include a model with no rate would be charged only the priced part.
- **Fix:** `chargeFor` charges at least the reserve when `cost_usd` is null and `transcript_unpriced > 0` (the RunRecord carries `transcript_unpriced` from `transcriptCost().unpriced.messages`); documented in the contract comment.
- **Files modified:** scripts/eval81/lib/ledger.cjs (the optional `transcript_unpriced` RunRecord field was already documented in contract.cjs in Task 1)
- **Verification:** ledger test "an unpriced transcript with no reported cost charges at least the reserve"

**3. [Rule 3 - Blocking] Gate command form on Node 24**
- **Found during:** validation gates
- **Issue:** `node --test scripts/eval81/lib/` (the TRD's gate) fails on Node v24.13.1: a directory argument is resolved as a module (`Cannot find module .../scripts/eval81/lib`), not searched for tests.
- **Fix:** ran the same gate as `node --test 'scripts/eval81/lib/*.test.cjs'`. Later TRDs that write `node --test scripts/eval81/<dir>/` should use the glob form.
- **Files modified:** none

---

**Total deviations:** 3 (2 missing critical, 1 blocking)
**Impact on plan:** Additive only; every TRD-specified name, constant and signature is as written.

## Issues Encountered
- Three of my own test literals were wrong against the spec arithmetic and were corrected before implementation or on the first run: the `partial` reserve case shared batch/role with an earlier overshoot; C with spent 60 and cap 32 lands exactly on $100 (cap 33 is the refusal case); a basis regex expected `executor ` where the basis reads `p90(executor, trd_level)`.
- The real `out.json` sample was present and was read (not copied); its field names drive the stream builders.

## User Setup Required

None - no external service configuration required.

## Next Objective Readiness
- 81-02 (score.cjs) can write `spend` blocks in the SpendBlock shape; `ledger.spendBlockFor` produces the same shape and `rebuildLedger` reads it back.
- 81-08 (runner) has every API it lists: `canStart` (refuse -> `skipped_budget`), `chargeFor`/`recordRun`, `transcriptCost(dir, {rates: loadRates()})` (pass `transcript_unpriced` into the record), `childEnv`, `redact`, `scanForSecret`, `assertOrder`, `rebuildLedger`, `chargeLost`.
- 81-09..81-12 can call `capFor({role, model, batch, calibration})` and `capForWorkflow('quick' | 'build')` unchanged.
- With today's calibration both E workflows clamp (build 15, quick 6), since planner p90 x opus alone is 30.5.

## Self-Check: PASSED

- FOUND: scripts/eval81/lib/{contract,result,secret,ledger,caps}.cjs and their five .test.cjs files
- FOUND: scripts/eval81/__fixtures__/stream-json.cjs, scripts/eval81/__fixtures__/calibration.cjs
- FOUND: 7e9151b7, 781b6261, 7c69ab5a on df/exec-81-01-harness-core-contract-ledger-results
- Worktree clean after the Task 3 commit; the temporary node_modules symlink was removed
