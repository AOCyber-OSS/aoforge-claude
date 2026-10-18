---
objective: 82-3-1-0-follow-ups
trd: "01"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval82/__fixtures__/attribution-transcripts.cjs
  - scripts/eval82/lib/attribution.cjs
  - scripts/eval82/lib/attribution.test.cjs
  - .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
autonomous: true
requirements: [SC-1]
must_haves:
  truths:
    - "attribution.cjs, written test-first against hand-built transcripts, turns one subagent transcript into deduplicated API calls (context = input + cache creation + cache read), tool calls with result sizes, a category per tool call, and per-category counts, issuing-call tokens and carry"
    - "82-DIAGNOSIS.md decomposes the planner (+67%) and executor (+20%) build-cell growth for both pairs (b30-r1/b31-r1, b30-r2/b31-r2) into API-call count, mean context per call and output, and attributes the delta to named categories with run id, call index and the tool input as evidence"
    - "Every cause in 82-DIAGNOSIS.md names the 3.1.0 text or output that triggers it (file:line at 99950509, or the command output) and the 3.0.0 counterpart at v3.0.0, and is either rejected with evidence or carried to the Fix list"
    - "The Fix list gives each row an id from the candidate catalogue (P-1..P-5, E-1..E-5, or a new X-n), a disposition FIX or JUSTIFY, the change, the test that will pin it, the attribution category whose count the re-run checks, and the expected tokens per build"
  artifacts:
    - path: scripts/eval82/lib/attribution.cjs
      provides: "per-call token attribution and run comparison over Claude Code transcripts (reused by 82-09)"
    - path: .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
      provides: "the diagnosis and the Fix list 82-07 implements and 82-06 turns into mechanism checks"
  key_links:
    - from: .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md
      to: 82-07 Tasks 2 and 3
      via: "Fix list rows with disposition FIX"
      pattern: "## Fix list"
    - from: scripts/eval82/lib/attribution.cjs
      to: 82-09 mechanism checks
      via: "category counts per new run"
      pattern: "categorize"
---

# TRD 82-01: Diagnose the build-cell planner and executor token growth

<objective>
81-MEASUREMENT.md found that on the small 2-TRD build, 3.1.0's planner used 67% more tokens than 3.0.0 (median
2.21M vs 1.32M, n=2) and its executors 20% more (3.33M vs 2.77M), while the first-turn input of both fell. Find out
why from the recorded transcripts, offline and at zero API cost, and write the diagnosis with a Fix list that TRD
82-07 implements test-first (or a recorded justification per cause).

Purpose: SC-1, first half (the cause named with transcript evidence).
Output: `scripts/eval82/lib/attribution.cjs` (+ test, + fixture builder) and `82-DIAGNOSIS.md`.
</objective>

<file_tree>
scripts/eval82/
├── __fixtures__/attribution-transcripts.cjs   ← CREATE (hand-built transcript builder)
└── lib/
    ├── attribution.cjs                          ← CREATE
    └── attribution.test.cjs                     ← CREATE
.aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md   ← CREATE (through `doc put`)
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`. Use the repo CLI
`node plugins/aoforge/aoforge/bin/aof-tools.cjs` (named `AOF` below). Planning mode is local. Never push, tag or
open a PR. Never port 8080. Never write the real `~/.claude` or any fleet repository. Tests run with HOME and TMPDIR
under the session scratchpad: `SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-01 TMPDIR=$SP/tmp-82-01 node --test <files>` (create both directories first).

Inputs (read-only):
- The recorded build runs: `R81=$SP/eval81`, run dirs `R81/runs/E/{b30-r1,b30-r2,b31-r1,b31-r2}` (ignore every
  `*.prev-*` dir). Each has `transcripts/<project key>/<session>.jsonl` (the orchestrator) and
  `<session>/subagents/agent-*.jsonl` with a sibling `agent-*.meta.json` whose `agentType` is the role
  (`aoforge:planner`, `aoforge:executor`, ...). Large tool results may live in `<session>/tool-results/*.txt`.
- Committed aggregates: `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-MEASUREMENT.md` and
  `results/E.json`.
- The two plugin trees by git ref: 3.0.0 = `v3.0.0` (b4a9d870), 3.1.0 as measured = `99950509` (the eval tree; the
  scratch worktrees under `R81/trees/` are gone, so read files with `git show <ref>:<path>` and diff with
  `git diff v3.0.0 99950509 -- <path>`).
- Objective 81's role metrics (`scripts/eval81/lib/roles.cjs`) and fixture transcripts
  (`scripts/eval81/__fixtures__/transcripts.cjs`) are frozen by objective 81's pre-registration manifest: import
  them, never edit any file under `scripts/eval81/`.

Planner-time scan (a per-call listing done while planning; hypotheses to confirm or reject with numbers, not
conclusions). Unique API calls per planner: b30-r1 21, b31-r1 29, b30-r2 18, b31-r2 26; context per call late in
the run is 70-108K, so each extra late call costs about 100K tokens.
- H-P1 template hunt: both 3.1.0 planners ran `ls ~/.claude/aoforge/templates/` and read
  `templates/trd-prompt.md` (head/tail or sed); neither 3.0.0 planner did.
- H-P2 commit tail: both 3.1.0 planners ran `git log -1 --format=%B` after `aof-tools commit`, then
  `git commit --amend ... -m "Co-Authored-By: ..."`, then `aof-tools commit --help` / grep under `bin/lib`; neither
  3.0.0 planner did. Read the tool result of the amend: the commit gate should have denied it (a planning-time probe
  of HEAD's `hooks/pre-bash.js` denies `git commit --amend` in an initialised project). Find what made 3.1.0 look at
  the message at all (its `aof-tools commit` output, a prompt line, or nothing identifiable).
- H-P3 larger drafts: b31-r2 wrote one TRD of 29,155 chars vs b30-r2's 18,382; b31-r1 20,981 + 18,731 vs b30-r1
  16,273 + 16,683; and more post-publish validation calls (`verify trd-pre`, a scratch copy test).
- H-P4 the 3.1.0 planner reads `references/testing-strategy.md` whole (6.4K) where 3.0.0 grepped it.
- H-E1 3.1.0 executors read `templates/summary.md` whole (about 11.9K) before the first checkpoint and
  `references/tdd.md` (about 14.8K) for the tdd TRD; check which 3.0.0 executors did.
- H-E2 executors Read the TRD file (23-31K) while the spawn prompt may already embed it (`{TRD_CONTENT}` in
  execute-objective.md's executor spawn): check the executor's first user message for the embedded TRD.
- H-E3 guessed home: both 3.1.0 TRD 01-01 executors tried `Read` of `references/tdd.md` at an invented absolute home
  (b31-r1 the real home, denied; b31-r2 `/Users/aocyber`), then `ls ~/.claude/aoforge/references/; echo $HOME`.
- H-E4 larger TRDs to read (downstream of H-P3). H-E5 b31-r2 wrote its SUMMARY twice (Write, Read, Write).
</context>

<embedded_context>

<codebase_examples>
A transcript line is one JSON object. Assistant content blocks of ONE API call are split across several lines that
share `message.id` and repeat the same `message.usage`, so per-line sums double-count; dedupe by `message.id`:
```js
// user record carrying a tool result
{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"...text or [{type:'text',text}]..."}]}}
// assistant record (one of several with the same id)
{"type":"assistant","message":{"id":"msg_1","model":"claude-opus-5-5","usage":{"input_tokens":4,"cache_creation_input_tokens":1200,"cache_read_input_tokens":27000,"output_tokens":300},"content":[{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"node ~/.claude/aoforge/bin/aof-tools.cjs init plan-objective 1"}}]}}
```
Role discovery: `transcripts/**/subagents/agent-<id>.meta.json` → `{"agentType":"aoforge:planner", ...}`; the jsonl
beside it is that spawn. 81's `scripts/eval81/lib/roles.cjs` already does this for its per-role tables: reuse its
discovery so numbers agree with 81-MEASUREMENT.md.

Test style in this repo: `node:test` + `node:assert/strict`, a numbered `// Test list` comment at the top, tests named
by their numbers (`test('3. tool results join their tool_use by id', ...)`).
</codebase_examples>

<anti_patterns>
- Summing usage per jsonl line (double counts) or treating cache reads as free: the measurement counts input + cache
  creation + cache read + output, and so does this analysis.
- Concluding from one run: every cause must show in both 3.1.0 runs (or be labelled single-run) and be absent or
  smaller in both 3.0.0 runs.
- Editing anything under `scripts/eval81/` (frozen by `results/prereg-manifest.json`; `prereg.cjs --check` must
  stay OK).
- Writing 82-DIAGNOSIS.md with Write/Edit under `.aoforge/` (use `planning draft` + `doc put`).
- Proposing a fix that removes a check the executor or verifier needs; a JUSTIFY row is the honest answer when a
  cost buys correctness.
</anti_patterns>

<error_recovery>
- The run dirs are missing (the scratchpad was cleared): record it, build the diagnosis from `results/E.json`
  (per-role and per-run aggregates) plus the static text diffs (`git diff v3.0.0 99950509 -- plugins/aoforge/agents/planner.md`
  and the planner/executor workflows), mark every cause "static evidence only", and say that 82-09's re-run is then
  the first transcript evidence.
- A tool result is a pointer to `tool-results/<id>.txt` (persisted output): measure the file it points to.
- A transcript line that is not JSON: skip it, count it in the output (`skipped_lines`), never throw.
</error_recovery>

</embedded_context>

## Test list

Outermost first (the CLI an analyst runs, then the functions under it).
1. CLI: `node scripts/eval82/lib/attribution.cjs --run <run dir> --role aoforge:planner --json` on a hand-built run
   dir prints one JSON object per spawn of that role with `calls`, `total_tokens`, `mean_context`, `output_tokens`
   and `categories`; `--compare <run dir A> <run dir B> --role <r>` prints the per-category deltas and the
   decomposition; exit 1 with a usage line on a missing flag.
2. roleSpawns(runDir) finds the main session and each subagent by meta `agentType`; a subagent without meta is role
   `unknown`; `*.prev-*` siblings are never read.
3. apiCalls(lines) dedupes assistant records by `message.id`: a call spread over three lines counts once and its
   usage once; calls keep transcript order.
4. A call's context is input + cache_creation + cache_read; the spawn total is the sum of context + output over its
   calls and equals the hand-computed number.
5. Tool results join their `tool_use` by id; result size is measured for string content, array content and a
   persisted `tool-results/*.txt` pointer.
6. categorize(tool) maps (each a separate case): Read of `<any>/.claude/aoforge/references/tdd.md` →
   `runtime_read:references/tdd.md`; Bash `cat`/`head`/`tail`/`sed -n` of a `.claude/aoforge/templates/...` file →
   `runtime_read:templates/<name>`; `ls ~/.claude/aoforge/<dir>` → `runtime_lookup`; Write/Edit under an
   `aoforge-drafts` path → `draft_write` / `draft_edit`; `aof-tools.cjs init|state digest|intent resolve|stack context|stack resolve|history-digest` → `context_load`;
   `frontmatter validate|verify <x>|trd-tdd|plan put-trd|plan push|summary checkpoint|summary post|tokens stamp` →
   `validate_publish`; `aof-tools.cjs commit` → `commit`; `git commit` (any flags, incl. `--amend`) → `raw_commit`;
   `git log -1 --format=%B` → `commit_inspect`; `--help` or a grep under `.claude/aoforge/bin` → `tool_investigation`;
   Read of a `*-TRD.md` → `trd_read`; Read of an absolute `.claude/aoforge/` path outside the run's own home →
   `guessed_runtime_path`; `node --test`/`npm test` → `test_run`; anything else `other`.
7. attribute(calls) per category: count, issuing tokens (context + output of the call that issued the tool; a call
   issuing k tools gives each 1/k), carry (result chars / 4 × number of later calls).
8. compare(a, b): per-category delta of count, issuing tokens and carry; decomposition
   `Δtotal = Δcalls × meanContext(a) + calls(b) × ΔmeanContext + Δoutput` holds on a hand-built pair (to rounding).
9. Deterministic: the same input gives byte-identical JSON.

<tasks>

<task type="auto">
  <name>Task 1: Hand-built transcript builder for attribution tests</name>
  <files>scripts/eval82/__fixtures__/attribution-transcripts.cjs</files>
  <action>
Write factory functions (no generated data; every value literal or computed from the arguments):
`assistantCall({id, usage, tools: [{id, name, input}], text?, splitInto = 1})` returns `splitInto` jsonl records that
share the message id and usage (to exercise dedupe); `toolResult({toolUseId, content, persistedPath?})` returns a user
record; `writeRun(dir, {main: lines, subagents: [{agentId, agentType|null, lines}], toolResults: {name: text}})` lays
out `transcripts/<key>/<session>.jsonl`, `<session>/subagents/agent-<id>.jsonl` (+ `.meta.json` when agentType is
set) and `<session>/tool-results/`. Reuse `scripts/eval81/__fixtures__/transcripts.cjs` helpers by import where they
fit; do not edit that file. Also provide `planner3031Pair()` returning two small hand-built planner spawns (a "3.0.0"
one with 4 calls and a "3.1.0" one with 6 calls, including one `ls ~/.claude/aoforge/templates/` and one
`git commit --amend`) whose totals you computed by hand in a comment, for tests 7-8.
  </action>
  <verify>`node -e "require('./scripts/eval82/__fixtures__/attribution-transcripts.cjs')"` loads; `git status --porcelain scripts/eval81` is empty</verify>
  <done>Builders exist for every record shape tests 1-9 need, with hand-computed expected totals in comments.</done>
  <recovery>If the 81 helpers do not fit, write local builders; never modify scripts/eval81.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: attribution.cjs (test list 1-9)</name>
  <files>scripts/eval82/lib/attribution.cjs, scripts/eval82/lib/attribution.test.cjs</files>
  <action>
RED: write `attribution.test.cjs` with the Test list above (numbered names), using Task 1's builders under a
`fs.mkdtempSync(path.join(os.tmpdir(), 'attr-'))` directory; run it and confirm each case fails for the missing
module/function (record the failing names). Commit RED:
`AOF commit "test(82-01): transcript attribution (RED)" --files scripts/eval82/lib/attribution.test.cjs scripts/eval82/__fixtures__/attribution-transcripts.cjs`.

GREEN: implement `attribution.cjs` (CommonJS, sync fs, no dependencies) exporting `roleSpawns`, `apiCalls`,
`categorize`, `attribute`, `compare`, `summarizeSpawn`, and a `main(argv)` CLI guarded by `require.main === module`.
Approach:
1. roleSpawns: reuse 81 `roles.cjs` discovery if it exposes it; else walk `transcripts/` exactly two levels as 81 does.
2. apiCalls: parse lines (skip bad JSON, count `skipped_lines`); Map by `message.id`; keep the first usage; collect
   tool_use blocks; join tool results by id (string, array of text blocks, or persisted pointer file).
3. categorize: the ordered rule list of test 6 (first match wins); return `{category, detail}` where detail is the
   runtime-relative path or the command head (first 120 chars), never the full input.
4. attribute / compare / decomposition as in tests 7-8; tokens are integers, chars/4 rounded.
Run the test file to GREEN, then commit:
`AOF commit "feat(82-01): per-call token attribution over transcripts" --files scripts/eval82/lib/attribution.cjs scripts/eval82/lib/attribution.test.cjs`.
  </action>
  <verify>`env HOME=$SP/home-82-01 TMPDIR=$SP/tmp-82-01 node --test scripts/eval82/lib/attribution.test.cjs` passes 9/9 (plus any sub-cases); `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` prints OK</verify>
  <done>RED and GREEN commits exist; the module reproduces hand-computed totals and categories.</done>
  <recovery>If 81's roles.cjs discovery disagrees with yours on a real run, use 81's (the measurement's numbers are the reference) and note it.</recovery>
</task>

<task type="auto">
  <name>Task 3: Run the attribution on the four build runs and publish 82-DIAGNOSIS.md</name>
  <files>.aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md</files>
  <action>
1. Sanity: for each of the four runs, the planner and executor spawn totals from `summarizeSpawn` match the per-run
   role numbers behind 81-MEASUREMENT.md within 1% (recompute medians and compare with the build table: planner
   1,321,277 vs 2,205,630; executor 2,769,891 vs 3,326,048). A mismatch stops the task: find the counting difference
   first.
2. Run `--compare` for planner and executor on both pairs (b30-r1 vs b31-r1, b30-r2 vs b31-r2; for executors compare
   the TRD 01-01 spawn with its counterpart, and the totals per run). Save raw JSON to `$SP/82-01/` (scratch).
3. For each hypothesis H-P1..H-P4, H-E1..H-E5 and anything else the category deltas show above 5% of the role's
   delta: confirm or reject with numbers; for each confirmed cause find its trigger in the 3.1.0 tree at 99950509
   (`git show 99950509:<path> | rg -n <text>`) and the 3.0.0 counterpart (`git show v3.0.0:<path>`), or the command
   output that triggered it (quote at most two lines). Check the amend's tool result and say whether the gate denied it.
4. Write the draft: `D=$(AOF planning draft objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md)` (pass the literal printed
   path in later calls), with these sections:
   - `## Inputs` (run dirs, refs and shas, transcript availability, Claude Code version from 81's prereg manifest).
   - `## Decomposition` (per role and pair: calls, mean context, output, total; the identity of test 8 with numbers).
   - `## Category deltas` (table per role: category, count 3.0.0 → 3.1.0, issuing tokens, carry, share of the delta).
   - `## Causes` (ranked by tokens; each with evidence lines `run · call # · tool · detail · context at the call`,
     trigger text 3.1.0 vs 3.0.0, and confirmed/rejected).
   - `## Fix list` table with columns `id | cause | disposition | change | pinning test | category checked by 82-09 | target count per run | expected tokens per build`.
     Ids: P-1 template hunt, P-2 commit inspect/amend tail, P-3 draft size, P-4 validation/publish calls, P-5 full
     reference reads; E-1 summary template read, E-2 tdd.md read, E-3 duplicate TRD read, E-4 guessed runtime path,
     E-5 repeated SUMMARY write; X-n for anything else. E-4 is FIX with "done by 82-02 and 82-07 Task 1" as its change.
     JUSTIFY rows carry the reason in the change column (a cost that buys correctness, or below 5% of the delta).
   - `## Not diagnosed here` (the quick cell's orchestrator +52% and anything outside SC-1, one line each).
5. Publish and commit: `AOF doc put objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md --from <draft path>` then
   `AOF commit "docs(82-01): build-cell token diagnosis" --files .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md`.
  </action>
  <verify>`rg -n -e '^## (Inputs|Decomposition|Category deltas|Causes|Fix list|Not diagnosed here)$' .aoforge/objectives/82-3-1-0-follow-ups/82-DIAGNOSIS.md` prints six lines; the Fix list has a row for every confirmed cause and each row has a disposition, a pinning test (or "n/a: JUSTIFY") and a category</verify>
  <done>The cause of each role's growth is named with transcript evidence and every confirmed cause is FIX or JUSTIFY.</done>
  <recovery>If no single category explains the planner delta (it is spread thin), say so in Causes with the top five categories and their shares, and make the Fix list cover the ones above 5%; SC-1 accepts a justification.</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (full suite in Task 3's end check is not required here; run `env HOME=$SP/home-82-01 TMPDIR=$SP/tmp-82-01 node --test scripts/eval82/lib/attribution.test.cjs` per task)</test>
</validation_gates>

<verification>
- attribution.test.cjs green; 81's prereg check OK; 82-DIAGNOSIS.md has the six sections and a complete Fix list.
</verification>

<success_criteria>
- The planner and executor growth is explained by named, evidenced causes, each carried to a FIX or JUSTIFY row that
  82-07 can implement without re-diagnosing.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-01-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`. Include the decomposition numbers and the Fix list ids
with dispositions.
</output>
