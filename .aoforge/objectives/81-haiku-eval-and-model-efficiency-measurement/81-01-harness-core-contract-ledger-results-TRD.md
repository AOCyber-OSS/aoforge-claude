---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "01"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval81/lib/contract.cjs
  - scripts/eval81/lib/contract.test.cjs
  - scripts/eval81/lib/result.cjs
  - scripts/eval81/lib/result.test.cjs
  - scripts/eval81/lib/secret.cjs
  - scripts/eval81/lib/secret.test.cjs
  - scripts/eval81/lib/ledger.cjs
  - scripts/eval81/lib/ledger.test.cjs
  - scripts/eval81/lib/caps.cjs
  - scripts/eval81/lib/caps.test.cjs
  - scripts/eval81/__fixtures__/stream-json.cjs
  - scripts/eval81/__fixtures__/calibration.cjs
autonomous: true
requirements: [SC-1]
must_haves:
  truths:
    - "validateDescriptor accepts the documented run-descriptor shape and rejects an unknown batch, an unknown model, a missing or non-positive capUsd, a non-allowlisted env key and an id with characters outside [A-Za-z0-9._-]"
    - "parseStream turns a `claude -p --output-format stream-json --verbose` log into a run record: reported cost, usage split (input, cache_creation, cache_read, output), first-turn input tokens (deduped by message id), modelUsage per model, model_ran against the requested tier's pinned id, duration, num_turns, session_id, init tools, and a status of ok | error | cap_hit | rate_limited (with the reset epoch when the message carries one) | no_result"
    - "The ledger starts a run only when total + run cap <= $100 and the batch's spent + run cap <= the batch cap, records each run id once, charges the run cap when no cost was reported, writes atomically, and refuses a batch out of the order A, B, D, E, C"
    - "capFor derives a per-run cap from calibration agent_overhead p90 cost times a tier factor, clamped to a floor and a per-batch ceiling, and returns the derivation string"
    - "childEnv builds the child environment from an allowlist (no inherited ANTHROPIC_*, CLAUDECODE, CLAUDE_CODE_* other than the OAuth token, or AOFORGE_* other than AOFORGE_SKIP_*=1); the token is never in argv, never in a log line, and scanForSecret finds any file that contains it"
  artifacts:
    - path: scripts/eval81/lib/contract.cjs
      provides: "BATCHES, ORDER, MODELS, PLUGINS, STATUSES, validateDescriptor, validateRecord"
    - path: scripts/eval81/lib/result.cjs
      provides: "parseStream, parseResultEvent, firstTurnInput, modelRan, isRateLimit, toolInputsMentioning"
    - path: scripts/eval81/lib/ledger.cjs
      provides: "loadLedger, saveLedger, canStart, recordRun, setBatchStatus, assertOrder, totalUsd, BATCH_CAPS, GLOBAL_CAP_USD"
    - path: scripts/eval81/lib/caps.cjs
      provides: "capFor, capForWorkflow, TIER_FACTOR, FALLBACK_P90"
    - path: scripts/eval81/lib/secret.cjs
      provides: "readToken, childEnv, scanForSecret, redact"
  key_links:
    - from: scripts/eval81/lib/result.cjs
      to: plugins/aoforge/aoforge/references/model-profiles.json
      via: "models{} tier -> pinned id for the model_ran check"
      pattern: "model-profiles.json"
    - from: scripts/eval81/lib/ledger.cjs
      to: scripts/eval81/lib/contract.cjs
      via: "ORDER and BATCHES"
      pattern: "require\\('./contract.cjs'\\)"
---

# TRD 81-01: Harness core (run contract, stream parser, ledger, caps, secret handling)

<objective>
Build the pure core of the objective-81 eval harness: the run-descriptor and run-record contract every later TRD
codes against, the parser that turns a headless `claude -p` stream into a run record, the $100 running-total
ledger, per-run cap sizing from calibration p90, and the token handling that keeps the OAuth token out of argv,
logs and committed files.

Purpose: SC-1's harness needs a ledger that stops cleanly before $100 and a record of each run's verdict inputs,
tokens (cached/uncached in/out), reported cost and wall time. Every other harness TRD (runner 81-08, batch specs
81-09..81-12) consumes these modules, so the contract is fixed here first.
Output: five tested modules under `scripts/eval81/lib/` and two fixture builders under `scripts/eval81/__fixtures__/`.
No live call, no `claude` spawn, no network.
</objective>

<file_tree>
scripts/eval81/
├── __fixtures__/
│   ├── stream-json.cjs      ← CREATE (hand-built stream-json event builders)
│   └── calibration.cjs      ← CREATE (hand-built calibration.json builder)
└── lib/
    ├── contract.cjs (+ .test.cjs)   ← CREATE
    ├── result.cjs   (+ .test.cjs)   ← CREATE
    ├── secret.cjs   (+ .test.cjs)   ← CREATE
    ├── ledger.cjs   (+ .test.cjs)   ← CREATE
    └── caps.cjs     (+ .test.cjs)   ← CREATE
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Test file shape used by `scripts/*.test.cjs` (copy it: header comment naming the TRD, node:test, hand-built
fixtures, mkdtemp dirs, no network, no ~/.claude):

```js
'use strict';
// Tests for scripts/eval81/lib/ledger.cjs (TRD 81-01). Every ledger is a hand-built literal written into an
// mkdtemp directory; no network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
```

The dedupe rule for assistant usage already used by `plugins/aoforge/aoforge/bin/lib/token-usage.cjs` `sumUsage`
(reuse the rule, not the function, because the input here is a stream log): only `type:'assistant'` rows with an
object `message.usage` and a model other than `<synthetic>` count; the key is `message.id`, else the row `uuid`; per
key the record with the largest `output_tokens` wins.

A real `claude -p --output-format json` result object from this machine (the subscription token, Haiku 5.5) is at
`/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval-auth/out.json`
(no secret in it; read it, do not copy it into the repo). Its top-level keys are the stream's final `type:"result"`
event fields: `total_cost_usd`, `usage{input_tokens, cache_creation_input_tokens, cache_read_input_tokens,
output_tokens, cache_creation{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}, iterations[]}`,
`modelUsage{<id>:{inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD,
canonicalModel}}`, `duration_api_ms`, `stop_reason`, `session_id`, `terminal_reason`, `subagent_stats`,
`permission_denials`. Build the stream builders from these names; where the stream adds fields (`type`, `subtype`,
`is_error`, `num_turns`, `duration_ms`, `result`, `structured_output`), keep both a present and an absent variant in
the tests so the parser does not depend on an optional field.

Model pins (read, never hard-code): `plugins/aoforge/aoforge/references/model-profiles.json` → `models` =
`{opus: claude-opus-5-5, sonnet: claude-sonnet-5-5, haiku: claude-haiku-5-5}`.

Calibration agent_overhead shape (`~/.claude/aoforge/calibration.json`, read-only; tests use the builder):
`agent_overhead.<agent>.cost_usd.{p50,p90,max,n}`; present today for verifier (p90 1.7634), job-checker (1.5977),
objective-researcher (3.2655), planner (15.2542), integration-checker, roadmapper. codebase-mapper and
project-researcher have no samples.
</codebase_examples>

<anti_patterns>
- Never put the token in argv (visible in `ps`) or in any string that reaches stdout/stderr, a log file, a run
  record or a thrown error. Errors name the token FILE path only.
- Never inherit `process.env` wholesale into the child: a nested `claude` that sees the parent session's
  `CLAUDECODE`/`CLAUDE_CODE_*` variables, `ANTHROPIC_API_KEY` or the user's `AOFORGE_*` settings measures the wrong
  thing or authenticates the wrong way.
- No property-based testing library and no generated test data (`no_property_based_default`, `no_llm_test_data`):
  every stream, ledger and calibration in the tests is a hand-built literal from the builders.
- No hard-coded session scratchpad path in committed code (stack principle 12): the eval root and token file are
  arguments.
- Do not import `token-usage.cjs` to parse streams: it reads transcript files by path and its dedupe key is the
  same, but a stream log carries `type:"result"` and `system/init` events it ignores.
</anti_patterns>

<error_recovery>
- A ledger file that fails JSON.parse: `loadLedger` throws naming the path and refuses to start (never silently
  replaces it; spend tracking must not reset).
- A stream with no `type:"result"` event (killed, timed out): status `no_result`, cost `null`; the ledger charges the
  run's cap (`cost_source: "cap_charged"`).
- A rename failure on atomic save: leave the tmp file, throw; the previous ledger stays intact.
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@plugins/aoforge/aoforge/references/model-profiles.json
@plugins/aoforge/aoforge/bin/lib/token-usage.cjs (lines 40-100: the usage dedupe rule)

User-approved test design (2026-10-17), binding for this TRD:
- $100 running total across all batches; a run starts only if it cannot push the total past $100 (its cap is the
  worst case). Batch estimates: A ~$5, B ~$4, D ~$2, E ~$44, C ~$28 (mapper ~$11, researcher ~$12, grader ~$5).
- Batch order A, B, D, E, C.
- Per-run caps sized from calibration p90.
- On a rate-limit/usage error: pause and resume, never tight retry (the runner in 81-08 acts on the status set here).
- Auth only through env `CLAUDE_CODE_OAUTH_TOKEN` read from the token file; never printed, committed or logged.
</context>

<gotchas>
- Subscription auth reports `total_cost_usd` at list price (`modelUsage.<id>.costBasis: "list"`); that is the
  number the ledger counts. Haiku 5.5 is priced higher above 100K prompt tokens (model-rates.json note), so the
  haiku tier factor is 0.25 of sonnet, not the 0.05 list ratio.
- Claude Code may bill a small side model (e.g. a title or command-prefix call). `model_ran` is true when the
  requested pinned id carries at least 90% of output tokens; other ids go to `side_models`, never silently dropped.
- Stream-json repeats one assistant message once per content block with the same usage; dedupe by `message.id`
  or first-turn and totals double-count.
- A subscription usage limit arrives as result text like `Claude AI usage limit reached|1760000000` (epoch seconds
  after the bar) or an API error with status 429 / `rate_limit_error`. Parse the epoch when present.
</gotchas>

## Test list

Behaviour cases, outermost first, written before any test code. Each becomes one named `test(...)`.

contract
1. A complete descriptor (`id`, `batch`, `kind`, `agent`, `model`, `plugin`, `prompt`, `capUsd`, `timeoutMs`,
   `env`, `fixture`, `order`) validates ok.
2. Unknown batch `F`, unknown model `fable`, `capUsd` 0 or missing, id `a/b`, env key `ANTHROPIC_API_KEY` or
   `AOFORGE_SKIP_EDIT_GATE: "0"` each fail with an error naming the field.
3. `ORDER` is exactly `['A','B','D','E','C']`; `kind` is one of `agent | prompt | workflow`.
4. validateRecord accepts each status in STATUSES and rejects a record with neither `cost_usd` nor `cost_source`.

result (parseStream)
5. Happy stream (init, two assistant messages, result success): cost, usage split, num_turns, session_id,
   duration_ms, init tools and status `ok`.
6. First-turn input = input + cache_creation + cache_read of the FIRST assistant message id, counted once when
   the stream repeats that message for two content blocks.
7. model_ran true when the requested tier's id carries >= 90% of output; a 2% side model is listed in
   `side_models`; model_ran false when sonnet was requested and haiku carried the output.
8. Result `subtype` naming the budget limit (`error_max_budget_usd` or any subtype/text containing `budget`) ->
   `cap_hit` with the reported cost.
9. `Claude AI usage limit reached|1760000000` -> `rate_limited`, `reset_epoch: 1760000000`; a 429 /
   `rate_limit_error` without an epoch -> `rate_limited`, `reset_epoch: null`.
10. No result event -> `no_result`, `cost_usd: null`.
11. `structured_output` present -> copied to the record; absent -> `null` (fenced-JSON fallback belongs to the
    batch collectors, not here).
12. toolInputsMentioning(stream, [/answer-key/, /scripts\/eval81/]) returns the tool_use ids whose input mentions a
    pattern (the contamination scan the scorers use); none on a clean stream.

secret
13. readToken returns the trimmed contents; a missing or empty file throws with the path in the message and no
    file contents.
14. childEnv keeps PATH/LANG/TERM/USER/LOGNAME/SHELL, sets HOME, CLAUDE_CONFIG_DIR, TMPDIR and
    CLAUDE_CODE_OAUTH_TOKEN, passes `AOFORGE_SKIP_EDIT_GATE: "1"`, and drops ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, CLAUDECODE, CLAUDE_CODE_ENTRYPOINT and AOFORGE_MODEL_PROFILE even when
    they are set in the parent.
15. redact replaces every occurrence of the token in a string (and in a JSON-serialised env) with `<redacted>`.
16. scanForSecret over a dir tree returns the relative path of each file holding the token (text and binary) and
    an empty list when none does.

ledger
17. A missing ledger with `create: true` starts at total 0, cap 100, every batch `pending`; with `create: false`
    it throws naming the path.
18. canStart: total 99.50 + cap 0.60 -> refused `global_cap`; batch A spent 7.00 + cap 0.60 with A cap 7.50 ->
    refused `batch_cap`; total 10 + cap 2 -> ok.
19. recordRun adds reported cost; a record with `cost_usd: null` charges its cap with `cost_source:
    "cap_charged"`; recording the same id twice changes nothing.
20. assertOrder: starting B while A is `pending` throws; after A is `complete` or `stopped` it passes; C requires A,
    B, D and E done.
21. saveLedger writes through a tmp file and rename; a corrupt ledger file makes loadLedger throw.
22. Batch C has no fixed batch cap (remainder of the $100).

caps
23. capFor({role:'verifier', model:'sonnet'}) = p90 1.7634 within the A ceiling, basis
    `p90(verifier)=1.7634 x sonnet 1.0`; haiku = max(floor 0.25, 1.7634 x 0.25).
24. No calibration sample for `codebase-mapper` -> FALLBACK_P90 used and named in the basis.
25. A value above the batch ceiling is clamped and the basis says `clamped`.
26. capForWorkflow('build') sums the p90 of planner, job-checker, executor x2 and verifier at their balanced tiers
    plus the orchestrator, clamped to the E build ceiling 15; 'quick' (planner, executor) to 6.

<tasks>

<task type="auto">
  <name>Task 1: Fixture builders and the run contract</name>
  <files>scripts/eval81/__fixtures__/stream-json.cjs, scripts/eval81/__fixtures__/calibration.cjs, scripts/eval81/lib/contract.cjs, scripts/eval81/lib/contract.test.cjs</files>
  <action>
Hand-built builders first (no generated data):
- `stream-json.cjs`: `initEvent({model, tools, plugins, agents, permissionMode})`, `assistantMsg({id, model,
  usage, content})` (option to repeat one id for two content blocks), `resultEvent({subtype, is_error, total_cost_usd,
  usage, modelUsage, duration_ms, num_turns, session_id, result, structured_output})`, `toLines(events)` (JSONL
  string), and canned streams: `happyStream()`, `capHitStream()`, `usageLimitStream(epoch)`, `http429Stream()`,
  `noResultStream()`, `sideModelStream()`. Field names follow the real out.json sample described above.
- `calibration.cjs`: `makeCalibration({agentOverhead})` returning a calibration-shaped object with
  `agent_overhead.<agent>.cost_usd.p90` and a `writeCalibration(dir, obj)` helper.

Then `contract.cjs` (TDD, test list 1-4): export `BATCHES = ['A','B','C','D','E']`, `ORDER = ['A','B','D','E','C']`,
`MODELS = ['haiku','sonnet','opus']`, `PLUGINS = ['3.0.0','3.1.0', null]`, `KINDS = ['agent','prompt','workflow']`,
`STATUSES = ['ok','error','cap_hit','rate_limited','no_result','timeout','harness_error','skipped_budget','dry_run']`,
`ENV_ALLOW = /^AOFORGE_SKIP_[A-Z_]+$/` (value must be `"1"`), `validateDescriptor(d)` and `validateRecord(r)` returning
`{ok, errors[]}`. Document the descriptor and record shapes in a block comment at the top of the module — this is
the contract 81-08..81-12 import:

```
RunDescriptor { id, batch, kind, agent|null, model, plugin, prompt, tools|null, jsonSchema|null,
  capUsd, capBasis, timeoutMs, env{AOFORGE_SKIP_*:"1"}, fixture{...opaque to the runner}, order, role }
RunRecord { id, batch, role, model, requested_model_id, plugin, agent, status, cost_usd, cost_source,
  usage{input, cache_creation, cache_read, output}, first_turn_input, model_usage{}, model_ran,
  side_models[], duration_ms, wall_ms, num_turns, session_id, init_tools[], structured_output,
  result_text, reset_epoch, claude_version, started_at, finished_at, outputs{}, error }
```
  </action>
  <verify>node --test scripts/eval81/lib/contract.test.cjs</verify>
  <done>Test list 1-4 pass; builders export every canned stream named above; no test reads ~/.claude or the network.</done>
  <recovery>If the out.json sample is missing, build from the field names listed in codebase_examples; note it in the SUMMARY.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Stream parser and secret handling</name>
  <files>scripts/eval81/lib/result.cjs, scripts/eval81/lib/result.test.cjs, scripts/eval81/lib/secret.cjs, scripts/eval81/lib/secret.test.cjs</files>
  <action>
RED first per test list 5-16, one test at a time, then GREEN.

`result.cjs`:
- `parseStream(text, {requestedModel, profilesPath})` → RunRecord fields (minus id/batch/role, which the runner
  adds). Split on newlines, JSON.parse each non-empty line, skip unparseable lines (count them in
  `parse_skipped`). Usage totals come from the result event when present (it is the CLI's own sum, subagents
  included); first-turn input comes from the first deduped assistant message.
- `modelRan(modelUsage, requestedModel, profilesPath)` reads the pinned id from model-profiles.json `models`.
- `isRateLimit(resultEvent)` → `{limited, reset_epoch}`.
- `toolInputsMentioning(text, patterns)` scans assistant `tool_use` blocks' JSON input.

`secret.cjs`:
- `readToken(file)`, `childEnv({home, configDir, tmpdir, token, extra, parentEnv = process.env})` (allowlist
  PATH, LANG, LC_ALL, TERM, USER, LOGNAME, SHELL from parentEnv; then the four set keys; then `extra` entries that
  pass contract ENV_ALLOW), `redact(str, token)`, `scanForSecret(root, token)` (walk with fs.readdirSync, skip
  symlinks, Buffer.indexOf on each file, return sorted relative paths).

# CRITICAL: no function in secret.cjs logs; callers decide what to print, always through redact().
  </action>
  <verify>node --test scripts/eval81/lib/result.test.cjs scripts/eval81/lib/secret.test.cjs</verify>
  <done>Test list 5-16 pass; `rg -n "console\\." scripts/eval81/lib/secret.cjs` finds nothing.</done>
  <recovery>If a stream field name differs from the sample, make the parser accept both spellings and add a test for each.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Ledger and cap sizing</name>
  <files>scripts/eval81/lib/ledger.cjs, scripts/eval81/lib/ledger.test.cjs, scripts/eval81/lib/caps.cjs, scripts/eval81/lib/caps.test.cjs</files>
  <action>
RED first per test list 17-26.

`ledger.cjs`: `GLOBAL_CAP_USD = 100`; `BATCH_CAPS = {A: 7.5, B: 6, D: 3, E: 55, C: null}` (1.5x the estimate for
A/B/D; E bounded so C keeps its ~$28; C = remainder); `BATCH_ESTIMATES = {A: 5, B: 4, D: 2, E: 44, C: 28}`.
Ledger JSON: `{version: 1, cap_usd, order, batches: {X: {cap_usd, estimate_usd, status, spent_usd}}, entries:
[{id, batch, cost_usd, cost_source, status, at}], updated_at}`. Functions: `loadLedger(file, {create})`,
`saveLedger(file, ledger)` (write `<file>.tmp-<pid>` then renameSync), `totalUsd(l)`, `canStart(l, {batch,
capUsd})` → `{ok, reason: null|'global_cap'|'batch_cap', total, projected}`, `recordRun(l, record)` (idempotent
by id; null cost charges `capUsd`), `setBatchStatus(l, batch, status)` (`pending|running|complete|stopped`),
`assertOrder(l, batch)`. Round money to 1e-6 in sums, never to cents.

`caps.cjs`: `TIER_FACTOR = {haiku: 0.25, sonnet: 1, opus: 2}`, `FLOOR = 0.25`, `CEILING = {A: 2, B: 2, C: 3, D: 0.75,
E_quick: 6, E_build: 15}`, `FALLBACK_P90 = {'codebase-mapper': 2, 'project-researcher': 3, 'objective-researcher':
3.27, judge: 0.5, grader: 0.5}`, `capFor({role, model, batch, calibration})` → `{cap, basis}`, `capForWorkflow({workflow,
calibration})` → `{cap, basis}` using the balanced tiers from model-profiles.json for each spawned role and an
opus orchestrator equal to the planner's p90 share. Calibration is passed in (the runner loads
`~/.claude/aoforge/calibration.json` read-only; tests pass the builder object).
  </action>
  <verify>node --test scripts/eval81/lib/ledger.test.cjs scripts/eval81/lib/caps.test.cjs</verify>
  <done>Test list 17-26 pass; a ledger round-trip through saveLedger/loadLedger is deep-equal.</done>
  <recovery>If the balanced tier lookup for a role is missing from model-profiles.json, fall back to sonnet and name it in the basis string.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/lib/</test>
<test>npm test (full suite; on this machine run the same globs from `git ls-files` minus watcher-shell.test.cjs, which hangs with fish installed)</test>
</validation_gates>

<verification>
- `TMPDIR=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81-test-tmp node --test scripts/eval81/lib/` passes (create the dir first).
- `rg -n "process\\.env" scripts/eval81/lib/secret.cjs` shows parentEnv defaulting only; no other module reads the token.
- No file under `scripts/eval81/` matches `rg -n "oauth-token|/private/tmp/claude-501"` except comments naming the argument.
</verification>

<success_criteria>
Test list 1-26 pass. The contract block comment documents RunDescriptor and RunRecord exactly as the later TRDs
use them. The ledger cannot let a run start that would take the total past $100 under any reported cost.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-01-SUMMARY.md`
</output>
