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
    - "The ledger starts a run only when total + reserve <= $100, where reserve = max(cap x 1.25, cap + the largest overshoot already observed for the same batch and role), and when the batch's spent + cap <= the batch cap; it charges max(reported cost, transcript-priced cost), records cap, reserve, both costs and the overshoot per run, charges the reserve when neither cost exists, records each run id once, writes atomically, and refuses a batch out of the order A, B, D, E, C"
    - "transcriptCost prices a run's copied transcripts (main session plus every subagent file, deduped by message id) from model-rates.json, so a reported cost that leaves out subagent spend is caught and the ledger charges the larger figure"
    - "rebuildLedger reconstructs the ledger from the spend blocks committed in results/<X>.json, so losing the scratch eval root never resets spend to $0"
    - "capFor derives a per-run cap from calibration agent_overhead p90 cost times a tier factor plus the headless base-prompt allowance (~36K cached tokens per run), clamped to a floor and a per-batch ceiling, and returns the derivation string"
    - "childEnv builds the child environment from an allowlist (no inherited ANTHROPIC_*, CLAUDECODE, CLAUDE_CODE_* other than the OAuth token, or AOFORGE_* other than AOFORGE_SKIP_*=1); the token is never in argv, never in a log line, and scanForSecret finds any file that contains it"
  artifacts:
    - path: scripts/eval81/lib/contract.cjs
      provides: "BATCHES, ORDER, MODELS, PLUGINS, STATUSES, COST_SOURCES, validateDescriptor, validateRecord, validateSpendBlock"
    - path: scripts/eval81/lib/result.cjs
      provides: "parseStream, parseResultEvent, firstTurnInput, modelRan, isRateLimit, toolInputsMentioning, transcriptCost"
    - path: scripts/eval81/lib/ledger.cjs
      provides: "loadLedger, saveLedger, canStart, reserveFor, recordRun, setBatchStatus, assertOrder, totalUsd, rebuildLedger, chargeLost, BATCH_CAPS, GLOBAL_CAP_USD, OVERSHOOT_FACTOR"
    - path: scripts/eval81/lib/caps.cjs
      provides: "capFor, capForWorkflow, basePromptUsd, TIER_FACTOR, FALLBACK_P90, BASE_PROMPT_TOKENS, BASE_TURNS"
    - path: scripts/eval81/lib/secret.cjs
      provides: "readToken, childEnv, scanForSecret, redact"
  key_links:
    - from: scripts/eval81/lib/result.cjs
      to: plugins/aoforge/aoforge/references/model-profiles.json
      via: "models{} tier -> pinned id for the model_ran check"
      pattern: "model-profiles.json"
    - from: scripts/eval81/lib/result.cjs
      to: plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs
      via: "loadRates/rateFor price each transcript message for transcriptCost (and caps.cjs basePromptUsd)"
      pattern: "rateFor"
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
Revision (job-checker, 2026-10-17): `--max-budget-usd` is enforced between turns, so a run can report more than its
cap, and whether the reported cost includes subagent spend is unknown. The ledger therefore reserves more than the
cap before a run, charges the larger of the reported and the transcript-priced cost after it, and can be rebuilt from
committed results if the scratch eval root is lost.
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

Pricing (read, never from memory): `plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs` exports
`loadRates(file = RATES_PATH)` and `rateFor(rates, modelId)` → `{id, input, output, cache_read, cache_write_5m,
cache_write_1h}` in $ per million tokens from `references/model-rates.json`. Today: opus 5.5 4 / 20 / 0.2 / 5 / 8,
sonnet 5.5 2 / 10 / 0.1 / 2.5 / 4, haiku 5.5 0.1 / 0.5 / 0.01 / 0.125 / 0.2 (input / output / cache_read / 5m write /
1h write); Haiku's `note` says prompts over 100K tokens cost 5x each rate (0.50 input, 0.625 / 1 writes, 0.05 hits,
2.50 output).

Live smoke test facts (the orchestrator, 2026-10-17): auth through env `CLAUDE_CODE_OAUTH_TOKEN` in a scratch HOME
works (subscription; claude-haiku-5-5 answered); a bare headless `claude -p` session reads about 36K cached
base-prompt tokens per run before doing anything, so per-run caps must include that allowance; `claude -p` must get
stdin from /dev/null or a file (otherwise it waits 3 s for stdin; the runner in 81-08 spawns with stdin `'ignore'`).
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
- A stream with no `type:"result"` event (killed, timed out): status `no_result`, reported cost `null`; the ledger
  charges the transcript-priced cost when transcripts exist, else the run's reserve (`cost_source:
  "reserve_charged"`), never just the cap (the run may have passed it before it was killed).
- A rename failure on atomic save: leave the tmp file, throw; the previous ledger stays intact.
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@plugins/aoforge/aoforge/references/model-profiles.json
@plugins/aoforge/aoforge/bin/lib/token-usage.cjs (lines 40-100: the usage dedupe rule)

User-approved test design (2026-10-17), binding for this TRD:
- $100 running total across all batches; a run starts only if it cannot push the total past $100. The worst case
  is its reserve, not its cap (job-checker blocker, 2026-10-17: `--max-budget-usd` is checked between turns, so the
  last turn can overshoot). Batch estimates: A ~$5, B ~$4, D ~$2, E ~$44, C ~$28 (mapper ~$11, researcher ~$12,
  grader ~$5).
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
- `--max-budget-usd` is a between-turn check: a run's reported cost can exceed its cap by up to one turn (and, if
  the CLI does not count subagent spend against it, by every subagent's cost). Never treat the cap as a spend bound;
  the reserve is. The overshoot observed for one batch and role sets the next reserve for that same batch and role
  only: E's subagent-heavy builds must not inflate the reserve of single-agent C runs and starve C for no safety gain
  (this is the interpretation of the checker's "cap + max observed overshoot"; name it in the module comment).
- The result event's usage is the CLI's own sum, but whether it includes subagent sessions is unverified until the
  81-17 pilot. Charging max(reported, transcriptCost) is correct either way; keep both figures in the record.
- transcriptCost prices `cache_creation` by its `ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens` split
  when present, else at the 5m rate (the CLI default), and applies Haiku's 5x rates to a message whose prompt
  (input + cache_creation + cache_read) exceeds 100K. A test asserts the Haiku rate note still reads 0.50 input, so a
  rate-file change fails loudly instead of mispricing.
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
12b. transcriptCost over a hand-built transcripts dir (a main `<session>.jsonl` with one message repeated for two
    content blocks, and `<session>/subagents/agent-1.jsonl` on another model) returns `{cost_usd, main_usd,
    subagent_usd, by_model, files}` equal to the hand-computed sum from a test rates object; a message with a 1h
    cache write is priced at the 1h rate; a Haiku message with a 120K prompt is priced at 5x; an empty or missing dir
    returns `cost_usd: null`. parseStream records `permission_denials` from the result event (empty list when absent).

secret
13. readToken returns the trimmed contents; a missing or empty file throws with the path in the message and no
    file contents.
14. childEnv keeps PATH/LANG/TERM/USER/LOGNAME/SHELL, sets HOME, CLAUDE_CONFIG_DIR, TMPDIR and
    CLAUDE_CODE_OAUTH_TOKEN, passes `AOFORGE_SKIP_EDIT_GATE: "1"`, and drops ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, CLAUDECODE, CLAUDE_CODE_ENTRYPOINT and AOFORGE_MODEL_PROFILE even when
    they are set in the parent.
15. redact replaces every occurrence of the token in a string (and in a JSON-serialised env) with `<redacted>`.
16. scanForSecret over a dir tree returns the relative path of each file holding the token (text and binary) and
    an empty list when none does; given a single file it returns `[basename]` on a hit and `[]` otherwise (the live
    TRDs scan every path of a commit's `--files` list, files and dirs alike).

ledger
17. A missing ledger with `create: true` starts at total 0, cap 100, every batch `pending`; with `create: false`
    it throws naming the path.
18. canStart checks the global cap against the reserve: total 99.40 + cap 0.40 (reserve 0.50) -> ok; total 99.60 +
    cap 0.40 -> refused `global_cap` even though total + cap = 100.00 would fit; batch A spent 7.00 + cap 0.60 with A
    cap 7.50 -> refused `batch_cap` (the batch check uses the cap); total 10 + cap 2 -> ok with `reserve: 2.5`. The
    result carries `{ok, reason, total, cap, reserve, reserve_basis, projected}`.
18b. reserveFor after an observed overshoot: an A/verifier entry with cap 0.50 charged 1.10 (overshoot 0.60) makes
    the next A/verifier run with cap 0.50 reserve 1.10 (cap + 0.60 beats 0.625) with a basis naming the entry id; an
    A/other-role run and an E run with the same cap still reserve cap x 1.25.
19. recordRun charges max(reported, transcript): reported 0.40 with transcript 0.55 -> charged 0.55, `cost_source:
    "transcript_sum"`; reported 0.55 with transcript 0.40 -> 0.55 `"reported"`; both null -> the run's reserve,
    `"reserve_charged"`. The entry stores `cap_usd, reserve_usd, reported_usd, transcript_usd, charged_usd,
    overshoot_usd = max(0, charged - cap)`; recording the same id twice changes nothing; totalUsd sums `charged_usd`.
20. assertOrder: starting B while A is `pending` throws; after A is `complete` or `stopped` it passes; C requires A,
    B, D and E done.
21. saveLedger writes through a tmp file and rename; a corrupt ledger file makes loadLedger throw.
22. Batch C has no fixed batch cap (remainder of the $100, still under the reserve rule).
22b. rebuildLedger([spendA, spendB]) (hand-built SpendBlocks) returns a ledger whose entries deep-equal the blocks'
    entries, whose A and B statuses come from the blocks, whose other batches are `pending`, and whose total equals
    the sum of the blocks' `spent_usd`; a block whose entries do not sum to its `spent_usd` (to 1e-6) throws naming the
    batch; two blocks for one batch throw. chargeLost(l, 'D', 3) adds one entry `D-lost-root` with `cost_source:
    "lost_root_charged"` and sets D `stopped`.

caps
23. capFor({role:'verifier', model:'sonnet', kind:'agent'}) = p90 x tier + base allowance, where
    basePromptUsd({model, kind, rates}) = 36_000 x (cache_write_5m + cache_read x BASE_TURNS[kind]) / 1e6. With
    today's rates: sonnet 1.7634 + 36_000 x (2.5 + 0.1 x 40) / 1e6 = 1.7634 + 0.234 = 1.9974 (within the A ceiling 2),
    basis `p90(verifier)=1.7634 x sonnet 1.0 + base 36K x 40 turns=0.234`; haiku = max(floor 0.25, 1.7634 x 0.25) +
    36_000 x (0.125 + 0.01 x 40) / 1e6 = 0.44085 + 0.0189. The test uses a hand-built rates object with the same
    numbers.
24. No calibration sample for `codebase-mapper` -> FALLBACK_P90 used and named in the basis.
25. A value above the batch ceiling is clamped and the basis says `clamped`.
26. capForWorkflow('build') sums the p90 of planner, job-checker, executor x2 and verifier at their balanced tiers
    plus the orchestrator and one base allowance for the opus top-level session (`BASE_TURNS.workflow` 60), clamped to
    the E build ceiling 15; 'quick' (planner, executor) to 6.

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
`COST_SOURCES = ['reported','transcript_sum','reserve_charged','lost_root_charged']`,
`ENV_ALLOW = /^AOFORGE_SKIP_[A-Z_]+$/` (value must be `"1"`), `validateDescriptor(d)`, `validateRecord(r)` and
`validateSpendBlock(b)` returning `{ok, errors[]}`. Document the shapes in a block comment at the top of the module —
this is the contract 81-02 and 81-08..81-12 import:

```
RunDescriptor { id, batch, kind, agent|null, model, plugin, prompt, tools|null, jsonSchema|null,
  capUsd, capBasis, timeoutMs, env{AOFORGE_SKIP_*:"1"}, fixture{...opaque to the runner}, order, role }
RunRecord { id, batch, role, model, requested_model_id, plugin, agent, status,
  cost_usd (reported, or null), transcript_cost_usd, charged_usd, cost_source, cap_usd, reserve_usd, overshoot_usd,
  usage{input, cache_creation, cache_read, output}, first_turn_input, model_usage{}, model_ran,
  side_models[], duration_ms, wall_ms, num_turns, session_id, init_tools[], permission_denials[], isolation{},
  structured_output, result_text, reset_epoch, claude_version, started_at, finished_at, outputs{}, error }
LedgerEntry { id, batch, role, status, cap_usd, reserve_usd, reported_usd, transcript_usd, charged_usd,
  cost_source, overshoot_usd, at }
SpendBlock { ledger_version, batch, status, spent_usd, ledger_total_usd, entries: LedgerEntry[] }
  // written by score.cjs (81-02) as results/<X>.json `spend`; read back by ledger.rebuildLedger
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
RED first per test list 5-16 (with 12b), one test at a time, then GREEN.

`result.cjs`:
- `parseStream(text, {requestedModel, profilesPath})` → RunRecord fields (minus id/batch/role and the ledger
  money fields, which the runner adds). Split on newlines, JSON.parse each non-empty line, skip unparseable lines
  (count them in `parse_skipped`). Usage totals come from the result event when present (the CLI's own sum; whether
  it includes subagents is checked by the 81-17 pilot); first-turn input comes from the first deduped assistant
  message; `permission_denials` is copied from the result event.
- `modelRan(modelUsage, requestedModel, profilesPath)` reads the pinned id from model-profiles.json `models`.
- `isRateLimit(resultEvent)` → `{limited, reset_epoch}`.
- `toolInputsMentioning(text, patterns)` scans assistant `tool_use` blocks' JSON input.
- `transcriptCost(dir, {rates})` walks `dir` for `*.jsonl` (main sessions and `*/subagents/agent-*.jsonl`), dedupes
  assistant rows per file with the same rule as parseStream, prices each message with `rateFor(rates, model)` (unknown
  model → counted in `unpriced` and the result flagged, never silently $0), and returns `{cost_usd, main_usd,
  subagent_usd, by_model, files, unpriced}`. The runner passes `loadRates()` (calibration-inputs.cjs); tests pass a
  hand-built rates object.

`secret.cjs`:
- `readToken(file)`, `childEnv({home, configDir, tmpdir, token, extra, parentEnv = process.env})` (allowlist
  PATH, LANG, LC_ALL, TERM, USER, LOGNAME, SHELL from parentEnv; then the four set keys; then `extra` entries that
  pass contract ENV_ALLOW), `redact(str, token)`, `scanForSecret(target, token)` (a file → `[basename]` or `[]`; a
  dir → walk with fs.readdirSync, skip symlinks, Buffer.indexOf on each file, return sorted relative paths).

# CRITICAL: no function in secret.cjs logs; callers decide what to print, always through redact().
  </action>
  <verify>node --test scripts/eval81/lib/result.test.cjs scripts/eval81/lib/secret.test.cjs</verify>
  <done>Test list 5-16 and 12b pass; `rg -n "console\\." scripts/eval81/lib/secret.cjs` finds nothing.</done>
  <recovery>If a stream field name differs from the sample, make the parser accept both spellings and add a test for each.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Ledger and cap sizing</name>
  <files>scripts/eval81/lib/ledger.cjs, scripts/eval81/lib/ledger.test.cjs, scripts/eval81/lib/caps.cjs, scripts/eval81/lib/caps.test.cjs</files>
  <action>
RED first per test list 17-26 (with 18b and 22b).

`ledger.cjs`: `GLOBAL_CAP_USD = 100`; `OVERSHOOT_FACTOR = 1.25`; `BATCH_CAPS = {A: 7.5, B: 6, D: 3, E: 55, C: null}`
(1.5x the estimate for A/B/D; E bounded so C keeps its ~$28; C = remainder); `BATCH_ESTIMATES = {A: 5, B: 4, D: 2,
E: 44, C: 28}`. Ledger JSON: `{version: 1, cap_usd, order, batches: {X: {cap_usd, estimate_usd, status, spent_usd}},
entries: LedgerEntry[], rebuilt_from: null|[...], updated_at}`. Functions: `loadLedger(file, {create})`,
`saveLedger(file, ledger)` (write `<file>.tmp-<pid>` then renameSync), `totalUsd(l)` (sum of `charged_usd`),
`reserveFor(l, {batch, role, capUsd})` → `{reserve, basis}` = max(capUsd x OVERSHOOT_FACTOR, capUsd + the largest
`overshoot_usd` among entries with the same batch and role), `canStart(l, {batch, role, capUsd})` → `{ok, reason:
null|'global_cap'|'batch_cap', total, cap, reserve, reserve_basis, projected}` (global: total + reserve <= 100; batch:
spent + cap <= batch cap), `recordRun(l, record)` (idempotent by id; charged = max of the non-null reported and
transcript costs, else the reserve; fills the LedgerEntry money fields), `setBatchStatus(l, batch, status)`
(`pending|running|complete|stopped`), `assertOrder(l, batch)`, `rebuildLedger(spendBlocks)` (pure; validates each
block with `validateSpendBlock`; sets `rebuilt_from` to the block batches) and `chargeLost(l, batch, usd)`. Round
money to 1e-6 in sums, never to cents.

`caps.cjs`: `TIER_FACTOR = {haiku: 0.25, sonnet: 1, opus: 2}`, `FLOOR = 0.25`, `CEILING = {A: 2, B: 2, C: 3, D: 0.75,
E_quick: 6, E_build: 15}`, `FALLBACK_P90 = {'codebase-mapper': 2, 'project-researcher': 3, 'objective-researcher':
3.27, judge: 0.5, grader: 0.5}`, `BASE_PROMPT_TOKENS = 36000` (comment: measured by the orchestrator's 2026-10-17
smoke test, a bare headless session's cached base prompt), `BASE_TURNS = {agent: 40, prompt: 3, workflow: 60}`,
`basePromptUsd({model, kind, rates, profilesPath})`, `capFor({role, model, kind, batch, calibration, rates})` →
`{cap, basis}`, `capForWorkflow({workflow, calibration, rates})` → `{cap, basis}` using the balanced tiers from
model-profiles.json for each spawned role, an opus orchestrator equal to the planner's p90 share and one base
allowance. Calibration and rates are passed in (the runner loads `~/.claude/aoforge/calibration.json` read-only and
`loadRates()`; tests pass builder objects). Defaults keep the batch modules' existing calls
(`capFor({role, model, batch})` in 81-09..81-11, `capForWorkflow('quick' | 'build')` in 81-12) valid without edits:
`kind` defaults from the role (`judge` and `grader` → `prompt`, every other role → `agent`) and `rates` to
`loadRates()`. The base allowance is a cap-sizing input only: the first live run's
recorded `first_turn_input` shows the real figure, and 81-14 reports it.
  </action>
  <verify>node --test scripts/eval81/lib/ledger.test.cjs scripts/eval81/lib/caps.test.cjs</verify>
  <done>Test list 17-26, 18b and 22b pass; a ledger round-trip through saveLedger/loadLedger is deep-equal; rebuildLedger of a ledger's own spend blocks reproduces its entries and total.</done>
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
Test list 1-26 (with 12b, 18b, 22b) pass. The contract block comment documents RunDescriptor, RunRecord,
LedgerEntry and SpendBlock exactly as the later TRDs use them. The ledger reserves more than the cap before each run,
charges the larger of the reported and transcript-priced cost after it, never lets a run start whose reserve would
take the total past $100, and can be rebuilt from committed spend blocks.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-01-SUMMARY.md`
</output>
