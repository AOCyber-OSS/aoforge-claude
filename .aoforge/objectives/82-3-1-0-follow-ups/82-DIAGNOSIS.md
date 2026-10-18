# 82-01 diagnosis: why 3.1.0's build-cell planner (+67%) and executors (+20%) spend more tokens than 3.0.0

Written by TRD 82-01 from objective 81's recorded transcripts, offline and at zero API cost. Every number below is computed by
`scripts/eval82/lib/attribution.cjs` (committed in this TRD with its tests); the evidence lines name the run, the call number and the
tool input so each can be found again with `attribution.cjs --run <run dir> --role <role> --json --calls`.

## Headline

- **Planner, +67% (2,642,554 -> 4,411,259 tokens over the two runs; per-run medians 1,321,277 -> 2,205,630).** Both 3.1.0 planners made **8 more API calls** than their 3.0.0 pair (21 -> 29 and 18 -> 26), each late call costing 90-110K tokens of context. The extra calls are three behaviours that **neither 3.0.0 planner showed and both 3.1.0 planners did**: hunting a TRD template under `templates/` and reading `trd-prompt.md` (P-1: 243,936 / 442,456 tokens, 30% / 46% of the pair's delta), inspecting the commit message and trying a `git commit --amend` that the commit gate denied (P-2: 216,601 / 307,698, 27% / 32%), and larger TRD drafts (P-3). One run each also spent a call group on reading the tooling source (P-4, r1: 210,496) or on a scratch copy of the project (r2: 106,737, also done by one 3.0.0 planner).
- **Executor, +20% (medians 2,769,891 -> 3,326,048; all six spawns 8,404,769 -> 9,806,605).** The executors did **not** make more calls (128 -> 130 over the three pairs, +2%); their **mean context per call rose by 15%** (65,154 -> 74,843) while the first-turn input fell 18%. The cause is in the spawn text: 3.0.0's executor spawn listed five `@` references, which a Task prompt does not expand and which no 3.0.0 executor followed; 3.1.0 turned them into "Read these files yourself" lines (`execute-objective.md` 432-434), and **all three 3.1.0 executors read `templates/summary.md` (10.7-11.9K chars) and `references/tdd.md` (13.3-14.8K chars) whole before the first task** (E-1: 355,684 tokens, E-2: 441,270, over the build), and they stay in the context of the ~40 calls that follow. The TRD each executor reads is 13-58% larger than in 3.0.0 (18,347 / 17,976 / 19,853 -> 23,054 / 20,246 / 31,409 chars) and adds 196,994 more (P-3 downstream). These causes account for 71% of the executor delta.
- Everything is carried to the Fix list below; 82-07 implements the FIX rows test-first, 82-09 re-runs the build cell and checks each row's category.

## Inputs

- Runs (read-only): `R81=<session scratchpad>/eval81`, `R81/runs/E/{b30-r1,b30-r2,b31-r1,b31-r2}` (`*.prev-*` dirs ignored). b30 = AOForge 3.0.0 (`v3.0.0`, b4a9d870), b31 = 3.1.0 as measured (`99950509`). Same project (notekit), same prompt, same session model (planner: claude-opus-5-5; executor/verifier/job-checker: sonnet), Claude Code 2.1.302 (81's prereg manifest, `claude_version`).
- Transcripts: all four run dirs have the orchestrator and every subagent transcript with its `agent-*.meta.json`; the planner and executor transcripts have no persisted-output pointers (only the job-checker and the "Execute Objective" general-purpose spawns do). No transcript line was skipped (skipped_lines 0 in all ten planner and executor spawns). b30-r2 and b31-r2 ran under a different sandbox root (`/private/tmp/claude-501/e81-5752f4931a905580/`), so their recorded absolute paths differ from the on-disk run dir; the module reads each spawn's own home from its `User` instructions attachment.
- Plugin trees: not on disk any more (`R81/trees/` is gone); triggers are read with `git show 99950509:<path>` and `git show v3.0.0:<path>`, line numbers cited as `path:line@ref`.
- Counting (objective 81's rules, so the totals agree with 81-MEASUREMENT.md): one API call per `message.id` (the row with the largest output wins), context = input + cache creation + cache read, a call's total = context + output. **Sanity check passed:** the ten planner and executor spawn totals equal `scripts/eval81/lib/roles.cjs` `rolesForRun` to the token (0% difference); medians recomputed from them are planner 1,321,277 vs 2,205,630 and executor 2,769,891 vs 3,326,048, the 81-MEASUREMENT.md build-table values (1,321,277 / 2,205,630 and 2,769,891 / 3,326,048). The executor median is over all three executor spawns of each version (b30: 2,769,891, 2,508,774, 3,126,104; b31: 3,731,175, 2,749,382, 3,326,048).
- Tool calls are attributed to a category by the ordered rule list in `attribution.cjs` `categorize` (first simple command of a Bash line that matches wins; `also` lists the rest, and `mentions` counts a compound command under every category it touches). "Issuing" = the context + output of the call that issued the tool (split 1/k for k tools in one call; the categories partition the spawn total, so the issuing deltas sum to the delta). "Carry" = result tokens (chars/4) times the calls after it. "Removal" below = issuing + carry of the cause's calls, an **upper bound** (a removed call's thinking would partly move to the next call).

## Decomposition

`dtotal = dcalls x meanContext(3.0.0) + calls(3.1.0) x dMeanContext + doutput` (residual 0 in every row).

| role | pair | total 3.0.0 | total 3.1.0 | delta | calls | mean context | output | dcalls x mean ctx | calls x d mean ctx | d output |
|---|---|---|---|---|---|---|---|---|---|---|
| planner | b30-r1 vs b31-r1, all spawns | 1,558,034 | 2,366,860 | +808,826 (+52%) | 21 -> 29 | 72,429.4 -> 80,136.3 | 37,017 -> 42,907 | 579,435 | 223,501 | 5,890 |
| planner | b30-r2 vs b31-r2, all spawns | 1,084,520 | 2,044,399 | +959,879 (+89%) | 18 -> 26 | 59,180.8 -> 77,013.7 | 19,265 -> 42,044 | 473,447 | 463,653 | 22,779 |
| executor | b30-r1 vs b31-r1, all spawns | 5,278,665 | 6,480,557 | +1,201,892 (+23%) | 82 -> 89 | 63,868.1 -> 72,278.9 | 41,478 -> 47,733 | 447,077 | 748,560 | 6,255 |
| executor | b30-r1 vs b31-r1, TRD 01-01 | 2,769,891 | 3,731,175 | +961,284 (+35%) | 43 -> 51 | 63,902.4 -> 72,635.9 | 22,087 -> 26,742 | 511,219 | 445,410 | 4,655 |
| executor | b30-r1 vs b31-r1, TRD 01-02 | 2,508,774 | 2,749,382 | +240,608 (+10%) | 39 -> 38 | 63,830.3 -> 71,799.8 | 19,391 -> 20,991 | -63,830 | 302,838 | 1,600 |
| executor | b30-r2 vs b31-r2, all spawns | 3,126,104 | 3,326,048 | +199,944 (+6%) | 46 -> 41 | 67,446.3 -> 80,410.3 | 23,575 -> 29,226 | -337,231 | 531,524 | 5,651 |

- **Planner:** the call-count term is 72% (r1) and 49% (r2) of the delta, the context term 28% and 48%, output 1% and 2%. Both pairs grew by exactly +8 calls.
- **Executor:** the call-count term is **negative or small** (+447K over r1's two spawns, -337K in r2) and the context term is 62-100%+ of the delta: the executors got heavier per call, not longer. First-turn input fell (planner 29,726 -> 27,238, executor 30,793 -> 25,067), so the growth is made *during* the run, by what the agent reads and writes.

## Category deltas

**planner, b30-r1 (3.0.0) vs b31-r1 (3.1.0)**: delta 808,826 tokens. Rows under 2% share are folded into "other rows".

| category | count 3.0.0 -> 3.1.0 | issuing tokens (delta) | carry tokens (delta) | share of the delta |
|---|---|---|---|---|
| `tool_investigation` | 0 -> 2 | +199,911 | +5,690 | 24.7% |
| `other` | 4 -> 2 | -188,170 | +87,629 | -23.3% |
| `validate_publish` | 4 -> 5 | +149,540 | +8,409 | 18.5% |
| `draft_edit` | 5 -> 6 | +112,948 | +2,442 | 14.0% |
| `raw_commit` | 0 -> 1 | +108,030 | +164 | 13.4% |
| `commit_inspect` | 0 -> 1 | +107,417 | +134 | 13.3% |
| `runtime_lookup` | 0 -> 2 | +100,393 | +28,434 | 12.4% |
| `runtime_read:templates/trd-prompt.md` | 0 -> 1 | +61,964 | +35,800 | 7.7% |
| `context_load` | 3 -> 4 | +45,583 | +18,693 | 5.6% |
| `git_inspect` | 2 -> 1 | +44,674 | -14,807 | 5.5% |
| `test_run` | 1 -> 1 | +23,306 | -45,957 | 2.9% |
| `runtime_grep:references/testing-strategy.md` | 1 -> 0 | -23,105 | -11,872 | -2.9% |
| `draft_write` | 2 -> 2 | +19,463 | +576 | 2.4% |
| `scratch_copy` | 1 -> 1 | +16,516 | -530 | 2.0% |
| other rows (7) | 5 -> 7 | +30,356 | 99,976 | 3.8% |

**planner, b30-r2 (3.0.0) vs b31-r2 (3.1.0)**: delta 959,879 tokens. Rows under 2% share are folded into "other rows".

| category | count 3.0.0 -> 3.1.0 | issuing tokens (delta) | carry tokens (delta) | share of the delta |
|---|---|---|---|---|
| `other` | 3 -> 5 | +174,020 | +15,418 | 18.1% |
| `runtime_read:templates/trd-prompt.md` | 0 -> 2 | +133,632 | +37,823 | 13.9% |
| `validate_publish` | 4 -> 4 | +122,394 | +13,514 | 12.8% |
| `tool_investigation` | 0 -> 1 | +102,363 | +624 | 10.7% |
| `raw_commit` | 0 -> 1 | +101,397 | +328 | 10.6% |
| `commit_inspect` | 0 -> 1 | +100,811 | +153 | 10.5% |
| `scratch_copy` | 0 -> 1 | +96,846 | +540 | 10.1% |
| `draft_setup` | 0 -> 1 | +69,752 | +496 | 7.3% |
| `runtime_lookup` | 0 -> 1 | +65,075 | +2,299 | 6.8% |
| `runtime_grep:references/testing-strategy.md` | 1 -> 0 | -57,916 | -4,950 | -6.0% |
| `runtime_read:references/goal-backward.md` | 1 -> 1 | -44,087 | +13,222 | -4.6% |
| `test_run` | 1 -> 1 | -35,192 | +1,580 | -3.7% |
| `(final)` | 1 -> 1 | +29,532 | +0 | 3.1% |
| `commit` | 1 -> 1 | +26,419 | +128 | 2.8% |
| `runtime_read:references/testing-strategy.md` | 0 -> 1 | +25,879 | +32,140 | 2.7% |
| `draft_edit` | 1 -> 1 | +25,635 | -46 | 2.7% |
| `draft_write` | 1 -> 1 | +19,564 | +330 | 2.0% |
| other rows (4) | 8 -> 7 | +3,754 | 72,359 | 0.4% |

**executor, b30-r1 (3.0.0) vs b31-r1 (3.1.0)**: delta 1,201,892 tokens. Rows under 2% share are folded into "other rows".

| category | count 3.0.0 -> 3.1.0 | issuing tokens (delta) | carry tokens (delta) | share of the delta |
|---|---|---|---|---|
| `other` | 40 -> 50 | +615,949 | +42,266 | 51.2% |
| `test_run` | 15 -> 15 | +269,436 | +33,104 | 22.4% |
| `commit` | 10 -> 12 | +218,444 | +1,173 | 18.2% |
| `validate_publish` | 14 -> 10 | -93,989 | -18,732 | -7.8% |
| `context_load` | 1 -> 6 | +83,150 | +78,404 | 6.9% |
| `git_inspect` | 16 -> 14 | +49,905 | -1,499 | 4.2% |
| `draft_write` | 4 -> 3 | -40,411 | -744 | -3.4% |
| `state_record` | 16 -> 3 | -37,239 | -33 | -3.1% |
| `runtime_read:references/tdd.md` | 0 -> 2 | +35,893 | +287,718 | 3.0% |
| `runtime_read:templates/summary.md` | 0 -> 2 | +35,893 | +231,522 | 3.0% |
| `commit_inspect` | 3 -> 3 | +31,033 | -1,286 | 2.6% |
| `(final)` | 2 -> 2 | +25,436 | +0 | 2.1% |
| `tool_investigation` | 1 -> 1 | -24,639 | +2,007 | -2.1% |
| other rows (5) | 12 -> 13 | +33,031 | 104,991 | 2.7% |

**executor, b30-r2 (3.0.0) vs b31-r2 (3.1.0)**: delta 199,944 tokens. Rows under 2% share are folded into "other rows".

| category | count 3.0.0 -> 3.1.0 | issuing tokens (delta) | carry tokens (delta) | share of the delta |
|---|---|---|---|---|
| `other` | 39 -> 27 | -242,653 | -35,075 | -121.4% |
| `test_run` | 7 -> 8 | +156,331 | -2,532 | 78.2% |
| `draft_write` | 2 -> 3 | +118,576 | +297 | 59.3% |
| `git_inspect` | 7 -> 8 | +84,068 | +1,978 | 42.0% |
| `commit` | 5 -> 5 | +80,038 | -187 | 40.0% |
| `draft_edit` | 3 -> 1 | -69,722 | -3,132 | -34.9% |
| `validate_publish` | 6 -> 6 | +67,634 | +14,730 | 33.8% |
| `state_record` | 8 -> 1 | -62,420 | -253 | -31.2% |
| `runtime_read:references/tdd.md` | 0 -> 1 | +22,186 | +137,344 | 11.1% |
| `(final)` | 1 -> 1 | +21,830 | +0 | 10.9% |
| `context_load` | 2 -> 2 | +14,944 | -15,104 | 7.5% |
| `guessed_runtime_path` | 0 -> 1 | +13,294 | +1,209 | 6.6% |
| `runtime_read:templates/summary.md` | 1 -> 1 | -11,015 | +67,934 | -5.5% |
| `runtime_lookup` | 0 -> 1 | +10,542 | +7,904 | 5.3% |
| other rows (3) | 3 -> 3 | -3,690 | 89,711 | -1.8% |

(In the executor r2 table the delta is small, so shares exceed 100%: read the issuing and carry columns, not the share.) The planner tables are dominated by categories that are **new** in 3.1.0 (`runtime_lookup`, `runtime_read:templates/trd-prompt.md`, `commit_inspect`, `raw_commit`, `tool_investigation`); the executor tables by `runtime_read:references/tdd.md` and `runtime_read:templates/summary.md` (count 0 -> 2 in r1, 0 -> 1 in r2; the carry column is the cost) and by project-specific work (`other`, `test_run`, `commit`) that varies from run to run. Two things went the other way and are not costs: 3.1.0 executors record state with `trd finalize` (`state_record` mentions 16 -> 3 in r1, 8 -> 1 in r2) and run fewer `validate_publish` calls (14 -> 10 in r1).

## Causes

Ranked by tokens. "Both" means it shows in both 3.1.0 runs and neither 3.0.0 run unless stated. Removal = upper bound, per 3.1.0 spawn.

### 1. P-1 Template hunt (planner) - CONFIRMED, both runs, absent from both 3.0.0 runs

Evidence (run · call # · tool · detail · context at the call):
- b31-r1 · call 8 · Bash · `ls ~/.claude/aoforge/templates/ ~/.claude/aoforge/workflows/ | head -60; ls ~/.claude/aoforge/templates/ | grep -i -e trd -e plan`; the planner's text: "Before drafting, I'll check the templates directory for a TRD template." · context 57,558 · output 3,615
- b31-r1 · call 9 · Bash · `wc -c ~/.claude/aoforge/templates/trd-prompt.md; sed -n 1,200p ~/.claude/aoforge/templates/trd-prompt.md` (7,159 chars) · context 61,829
- b31-r2 · call 7 · Bash · `ls ~/.claude/aoforge/templates/ | head -50; ls ~/.claude/aoforge/templates | grep -i -e trd -e plan` (description "List AOForge templates to find a TRD template") · context 54,586 · output 10,489
- b31-r2 · calls 8 and 9 · Bash · `head -c 6000 .../trd-prompt.md` and `tail -c 2500 .../trd-prompt.md` (6,042 and 2,499 chars) · context 65,353 and 68,032
- 3.0.0 counterpart: neither planner read `trd-prompt.md` (mentions 0 of 2). b30-r1 · call 6 · Bash · `ls ~/.claude/aoforge/workflows/execute-trd.md ~/.claude/aoforge/templates/summary.md` is an existence check (723 chars), not a hunt.

Trigger (text): `plugins/aoforge/agents/planner.md:910@99950509` "Use template structure for each TRD.md." names no file; the same line is at `planner.md:1021@v3.0.0`. What changed next to it: `planner.md:488` was `@~/.claude/aoforge/references/trd-spec.md` at v3.0.0 and is now "Read ~/.claude/aoforge/references/trd-spec.md with the Read tool before writing the first TRD (always; an @ line in an agent prompt is not expanded for you)". No agent, workflow or reference at either ref mentions `templates/trd-prompt.md` (`git grep trd-prompt` finds only `planning-audit.cjs` and two repo tests). So "template" has no referent in either version; the 3.0.0 planners took it to mean the trd-spec they had just `cat`-ed, the 3.1.0 planners went looking, in both runs. The trigger is the ambiguous line plus the model's reading of it; the planners state that reason themselves (quoted above).
Cost: removal **243,936** (r1, 30% of the pair's delta) and **442,456** (r2, 46%). Side effect: the 3.1.0 TRD drafts are larger (see 4).

### 2. P-2 Commit tail: inspect the message, `git commit --amend`, read the commit helper (planner) - CONFIRMED, both runs, absent from both 3.0.0 runs

Evidence:
- b31-r1 · call 27 · Bash · `aof-tools estimate objective 01 --table --raw; echo; git log -1 --format=%B | tail -3` (description "Estimate the objective and check commit message") · context 107,201
- b31-r1 · call 28 · Bash · `git commit --amend -q -m "docs(01): create objective TRDs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && ...`; the planner's text: "The tool-made commit is missing the required Co-Authored-By trailer." · context 107,606. **The gate denied it** (tool error, 657 chars): "PreToolUse:Bash hook error: AOForge project detected. Raw `git commit` is blocked. Use `node ~/.claude/aoforge/bin/aof-tools.cjs commit ...`". The planner's final note records the missing trailer as an open item.
- b31-r2 · calls 23, 24, 25 · `git log -1 --format=%B; aof-tools estimate ...` (context 100,644), the same `git commit --amend` (denied, context 100,958), then `aof-tools commit --help | head -30; grep -n -i -e amend -e co-authored -e trailer ~/.claude/aoforge/bin/lib/commit*.cjs ...` (context 101,720; the planner's text: "The hook blocks raw git commit. Rather than use its bypass, I'll check whether the sanctioned helper can amend or carry a trailer").
- 3.0.0 counterpart: neither planner printed or amended the message (`commit_inspect`, `raw_commit` mentions 0 of 2); both ran `aof-tools commit` once and went straight to `estimate objective`.

Trigger: **no plugin text identifies it.** The instruction the planners quote is Claude Code's own commit-attribution reminder ("End git commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"), which is in the system prompt and in a `remote_session_change` attachment of **all four** planner transcripts, 3.0.0 included. `aof-tools commit` prints only `{committed, hash, reason}`; nothing in `planner.md` (the `git diff v3.0.0 99950509 -- agents/planner.md` has no hunk in the commit step) says anything about trailers, and the four planner spawn prompts (1,791-2,555 chars) do not mention commits at all. The difference is the planner's choice to look (2 of 2 vs 0 of 2, n=2), against a reminder that conflicts with the commit gate. Executors show the same inspection in **both** versions (`commit_inspect` 3 -> 3 mentions, `tool_investigation` 1 -> 1), so it is a standing conflict, not a 3.1.0 regression; it only grew in the planner.
Cost: removal **216,601** (r1, 27%) and **307,698** (r2, 32%).

### 3. E-1 and E-2 Whole-file reads of `templates/summary.md` and `references/tdd.md` (executor) - CONFIRMED, 3 of 3 3.1.0 executors, 0 of 3 for tdd.md and 0 of 3 whole for summary.md in 3.0.0

Evidence:
- b31-r1 · TRD 01-01 · call 4 · Read `references/tdd.md` (14,846 chars) and Read `templates/summary.md` (11,953 chars) in one call · context 42,446; they ride in the context of the remaining 47 calls. The same two reads, again at calls 4-5: b31-r1 TRD 01-02 (13,325 and 10,716 chars, context 42,659) and b31-r2 (14,846 and 11,953 chars, context 44,125 and 50,968).
- The orchestrator's spawn text for these executors says it: "A Task prompt does not expand @ references: Read these files yourself ... - ~/.claude/aoforge/templates/summary.md - before the first `summary checkpoint` - ~/.claude/aoforge/references/tdd.md - the TRD tasks carry tdd=true, read it before Task 1".
- 3.0.0 counterpart: the b30-r1 spawn text listed `@~/.claude/aoforge/workflows/execute-trd.md`, `@.../templates/summary.md`, `@.../references/checkpoints.md`, `@.../references/tdd.md`, `@.../references/anti-patterns.md` plus "(~ is <run home>)". No executor opened any of the five except **b30-r2, which Read `summary.md` with `limit: 120`** (4,173 chars, call 8); none opened tdd.md.

Trigger (text): `plugins/aoforge/aoforge/workflows/execute-objective.md:432,434@99950509` (and the second spawn site `:1045,1047`), `agents/executor.md:741@99950509` ("Read ~/.claude/aoforge/templates/summary.md before the first `summary checkpoint` (once per TRD)"), `workflows/execute-trd.md:14,178@99950509`. At v3.0.0 the same places are `@` lines: `execute-objective.md:428,430,1018,1020@v3.0.0`, `executor.md:967@v3.0.0`, `execute-trd.md:13,177@v3.0.0`. The 3.1.0 change meant to make the references reachable ("each at the moment it is needed") made them *obeyed*, and the executors read both up front. `executor.md` already carries the full RED/GREEN/REFACTOR procedure in `<tdd_execution>` and the SUMMARY section list in `<summary_creation>`, so both reads duplicate text the agent already has. A second effect: with the 11.9K template in context the SUMMARY drafts are 9.0-9.8K chars (b31-r1 01-01, b31-r2) against 5.1-5.9K in 3.0.0.
Cost (removal per 3.1.0 executor): summary.md 149,305 / 94,465 / 111,914; tdd.md 183,192 / 116,429 / 141,649. Over the three spawns: **E-1 355,684, E-2 441,270**, together 57% of the executor delta (b30-r2's partial summary read, about 40K, is not netted out).

### 4. P-3 Larger TRD drafts, and the larger TRD every executor then reads (planner and executor) - CONFIRMED, both runs

Evidence: draft chars written by the planner (`written.draft_write`): b30-r1 16,273 + 16,683 vs b31-r1 20,981 + 18,731 (+21%); b30-r2 18,382 vs b31-r2 29,155 (+59%). Planner output 37,017 -> 42,907 (r1) and 19,265 -> 42,044 (r2); the 3.1.0 planners spend 10,489 output tokens at b31-r2 call 7 and 18,931 at call 11 (the draft write). The executor reads the TRD once per spawn in both versions (the duplicate read is rejected, cause 9) and carries it for all later calls: TRD read of 18,347 chars (b30-r1 01-01) vs 23,054 (b31-r1 01-01) and 31,409 (b31-r2). Carry of the TRD read, 3.0.0 -> 3.1.0: 200,733 -> 291,792, 173,347 -> 189,137, 228,899 -> 319,044 tokens (+196,994).
Trigger: **not a text change.** The size budget text is identical (`planner.md:474@both`: "target 40,000 characters, ceiling 60,000"); b31-r2's final note calls its 29,000-char TRD "against a 40,000 budget", so the budget is read as a target. The 3.1.0 TRDs are larger in every section (`<context>` 451 -> 1,244 chars, `<output>` 73 -> 482, frontmatter 1,811 -> 2,397 in r1 TRD 01-01), which fits having read the 8.4K `trd-prompt.md` template (P-1) but does not prove it. n=2, so treat the cause as "unbounded size target plus the template read".
Cost: planner side about 31K (r1) and 43K (r2) of output and carry; executor side +196,994 over the build; **about 137,849 (r1 build) and 133,145 (r2 build)**.

### 5. P-4 Reading the tooling source while validating (planner) - CONFIRMED in one run (r1), absent in r2 and in 3.0.0

Evidence: b31-r1 · calls 19 and 20 · Bash · `cd ~/.claude/aoforge/bin && grep -rn -e '<name>' -e '<done>' -e '<verify>' -e '<action>' --include=*.cjs .` (first one fails on a zsh glob, the second returns the usage comments of the whole bin tree, 2,480 chars); the planner's text: "I'll check how the tooling parses task elements, to see whether the `<id>`/`<tag>` literals elsewhere in task bodies can break anything." Context 99,503 and 99,900. No such calls in b31-r2 or either 3.0.0 planner.
Trigger: none in the text; the planner's own caution about angle-bracket literals in the TRD body (every run's TRD has `notekit tag <id> <tag>`).
Cost: removal **210,496** (26% of r1's delta). Single-run: the fix is a text rule, not a certainty.

### 6. E-5 Final SUMMARY written twice (executor) - CONFIRMED in one run (b31-r2)

Evidence: b31-r2 · call 30 · Write `.../aoforge-drafts/.../01-01-SUMMARY.md` (9,725 chars) failed: "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it."; call 31 Read of the draft; call 32 the same 9.8K chars written again. Context 92,980 and 98,056, output 4,328 and 4,597. b31-r1's two executors had no failed write.
Trigger (text): `executor.md:202-208@99950509` tells the executor to write the draft once at the first task and then tick it with `summary checkpoint --tick`, which edits the file in place; the final full SUMMARY is then a Write over a file the verb changed since the executor last read it, and Claude Code refuses a Write over a changed file. 3.0.0 had no `--tick`: the executor rewrote the whole draft with `--from` each time (b30 executors: 2 writes, both succeeded).
Cost: the failed write plus its carry, about **121K** (3.6% of that spawn). Single-run, but the mechanism is deterministic once the tick has touched the draft.

### 7. P-5 Whole read of `references/testing-strategy.md` (planner) - CONFIRMED, small: net about 28K in r1

Evidence: b30-r1 · call 5 · `grep -n -i -A12 'cli' ~/.claude/aoforge/references/testing-strategy.md | head -90` (2,967 chars) and b30-r2 · call 7 · a grep (1,798 chars); b31-r1 · call 5 and b31-r2 · call 6 · Read of the whole file (6,428 chars). Trigger: `planner.md:318@both` ("Reference: @~/.claude/aoforge/references/testing-strategy.md (loaded conditionally ...)") is unchanged; the 3.1.0 planners Read it, the 3.0.0 planners grepped it. Cost: removal 43K (r1) and 35K (r2) against 15K and 64K of the greps they replaced, net about +28K in r1 and below zero in r2: under 5% of either delta.

### 8. E-4 Guessed absolute home path (executor) - CONFIRMED, 2 of 3 3.1.0 executors, 0 of 3 3.0.0

Evidence: b31-r1 · TRD 01-01 · call 3 · Read `/Users/justin/.claude/aoforge/references/tdd.md` -> tool error (99 chars); b31-r2 · call 2 · Read `/Users/aocyber/.claude/aoforge/references/tdd.md` -> error (125 chars), then call 3 `ls ~/.claude/aoforge/references/ | head -50; echo ---; echo $HOME` (the right home is recovered from the environment). The spawn text carried `~/.claude/aoforge/references/tdd.md`; the agent rewrote it as an absolute path under a guessed home. The `~` form itself works: in objective 81's run C-res-architecture-h-2 two Reads of `~/.claude/aoforge/...` paths returned their files (6,136 and 5,338 chars). The defect is the guessed absolute home, not `~`. 3.0.0's spawn gave the expanded home ("(~ is <run home>)"); 3.1.0's gives none. Cost: 4-13K each, under 1% of the delta; disposition is a correctness fix owned by 82-02 and 82-11, not a token fix.

### 9. E-3 Duplicate TRD read (executor) - REJECTED

Evidence: every executor in both versions read the TRD exactly once (`trd_read` count 1 per spawn, 6 of 6); the sequential-wave spawn prompt (3,426-4,547 chars in all six) holds the TRD path, not its text ("read it in full from disk before starting"), and the `{TRD_CONTENT}` embedding in `execute-objective.md` applies only to isolated (worktree) runs. The cost of the TRD read is its size (cause 4), not a repeat.

### 10. X-1, X-2 Smaller findings

- **X-1** `planner.md:972@99950509` (and `:1083@v3.0.0`) tells the planner to run `aof-tools verify trd-structure`; that subcommand does not exist ("Error: Unknown verify subcommand. Available: job-structure, objective-completeness, ..."; b31-r1 call 15, the planner then writes "The `trd-structure` subcommand isn't in this runtime"). All four planners hit it, so it is in the baseline, not a growth cause; it is a one-line correctness fix with a few thousand tokens of confusion per planner.
- **X-2** The scratch-copy check (`mktemp -d` + `cp -R` of the project to run the TRD's own `<verify>` commands): b31-r1 call 23 (context 102,967), b31-r2 call 17 (95,807); b30-r1 did it too (call 13, 86,254). Removal 116,056 / 106,737. It proves the TRD's commands run, which is what the checker and the executor rely on, so it is kept.

## Fix list

Disposition FIX: 82-07 implements it test-first; 82-06 turns the category into a mechanism check for 82-09. JUSTIFY: no change, reason in the change column. "Tokens per build" are removal upper bounds for the two-TRD build (b31-r1) / the one-TRD build (b31-r2) where they differ.

| id | cause | disposition | change | pinning test | category checked by 82-09 | target count per run | expected tokens per build |
|---|---|---|---|---|---|---|---|
| P-1 | template hunt | FIX | `planner.md:910`: replace "Use template structure for each TRD.md." with "Write each TRD in the structure `references/trd-spec.md` defines (you already read it). There is no template file to look up: do not list or read `~/.claude/aoforge/templates/`." | repo test: `planner.md` has no "Use template structure" line and its `write_objective_prompt` step names `trd-spec.md` | `runtime_lookup` (templates) and `runtime_read:templates/trd-prompt.md` mentions on planner spawns | 0 | 243,936 - 442,456 |
| P-2 | commit inspect / amend / read the helper | FIX | `planner.md` git_commit step and `executor.md` task_commit_protocol: one sentence, "`aof-tools commit` is the only commit path and it adds no trailer; a harness attribution reminder does not apply to it. Do not run `git log -1 --format=%B`, `git commit --amend` or `aof-tools commit --help`." | repo test: both files contain the sentence | `commit_inspect`, `raw_commit`, `tool_investigation` (commit) mentions | 0 on the planner; executors not above 3.0.0's (3 and 1) | 216,601 - 307,698 (planner) |
| P-3 | TRD size treated as a 40,000-char target; larger TRD read by every executor | FIX | `planner.md` TRD Scope Budget: state that 40,000 is a ceiling, that a TRD of up to 2 tasks and 6 files stays near 15,000-20,000 chars, and that `<context>`, `<output>` and `<embedded_context>` are not padded to fill space | repo test on the sentence; 82-09 compares `written.draft_write` per planner | `draft_write` (`written` chars per TRD) | at most 22,000 chars per TRD on the notekit build | about 137,849 (r1 build), 133,145 (r2 build) |
| P-4 | reading the tooling source while validating (r1 only) | FIX | `planner.md` validate_plan: name the exact set (`frontmatter validate`, `verify job-structure`, `trd-tdd inspect`, then `verify trd-pre` after `plan put-trd`) and add "the checkers' output is authoritative; do not read `~/.claude/aoforge/bin`; angle-bracket literals in task text are fine" | repo test on the sentence | `tool_investigation` (non-commit) mentions | 0 | 210,496 (r1 only) |
| P-5 | whole read of `testing-strategy.md` where 3.0.0 grepped | JUSTIFY | below 5% of either delta (net +28K in r1, negative in r2); the file is 6.4K and holds the layer table the planner needs for its test list; no change | n/a: JUSTIFY | `runtime_read:references/testing-strategy.md` | 1 | 28,000 not recovered |
| E-1 | whole read of `templates/summary.md` before the first checkpoint | FIX | drop the summary.md line from both spawn sites in `execute-objective.md` (432, 1045), `executor.md:741` and `execute-trd.md:178`; add a 20-line SUMMARY skeleton (frontmatter keys and the section headings of the template) to `executor.md` `<summary_creation>`; "read the template only for a field the skeleton lacks, with a `limit`" | repo test: no summary.md read directive in the four places; the skeleton lists every section heading the template's File Template has | `runtime_read:templates/summary.md` mentions on executor spawns | 0 | 243,770 (2 executors) / 111,914 (1 executor) |
| E-2 | whole read of `references/tdd.md` for a tdd TRD | FIX | drop the tdd.md line from both spawn sites (434, 1047) and `execute-trd.md:14`; `executor.md` `<tdd_execution>` is the procedure; "read tdd.md only to settle a TDD-precedence question" | repo test: no tdd.md read directive in the three places; `<tdd_execution>` still holds RED, GREEN, REFACTOR and the evidence rules | `runtime_read:references/tdd.md` mentions on executor spawns | 0 | 299,621 (2 executors) / 141,649 (1 executor) |
| E-4 | guessed absolute home path | FIX | done by 82-02 and 82-11 | their tests | `guessed_runtime_path` mentions | 0 | 4,000 - 13,000 per executor (a correctness fix) |
| E-5 | final SUMMARY write refused after `--tick` edited the draft | FIX | `executor.md` summary_creation: the draft changes under `summary checkpoint --tick`; Read the draft immediately before the final Write, or build the body with Edit; never Write the whole SUMMARY twice | repo test on the sentence | `draft_write` tool errors (`is_error`) and `draft_write` count | 0 errors, at most 2 writes per executor | about 121,000 (single-run) |
| X-1 | `planner.md` names the nonexistent `verify trd-structure` | FIX | `planner.md:972`: `verify trd-structure` -> `verify job-structure` (the output fields differ: it returns `valid, errors, warnings, task_count, tasks`) | repo test: every `verify <sub>` an agent or workflow names is a subcommand `aof-tools verify` lists | `validate_publish` tool errors (`is_error`) | 0 | under 10,000 per planner |
| X-2 | scratch-copy check of the TRD's own verify commands | JUSTIFY | present in 3.0.0 too (b30-r1 call 13); it proves the commands the executor will run; no change | n/a: JUSTIFY | `scratch_copy` | at most 1 | not recovered |

Rejected, no row: **E-3** (cause 9). Net effect if every FIX row lands: the planner returns to about 3.0.0's call count (P-1, P-2, P-4 remove the 8 extra calls) and the executor's mean context per call returns to about 3.0.0's (E-1, E-2 remove 6.7K tokens from each call after call 4, P-3 shrinks the TRD it carries).

## Not diagnosed here

- The quick cell's orchestrator +52% (81-MEASUREMENT.md q30 vs q31): a different workflow and role; not part of SC-1's build cell.
- The 3.1.0 verifier and job-checker costs in the build cell and the orchestrator ("Execute Objective" general-purpose spawn): not named in SC-1.
- Whether the 3.1.0 TRDs are *better* for their extra size and for the extra reads (quality is 81's score, not a token question).
- The harness commit-attribution reminder conflicting with the commit gate beyond the planner and executor commit step (P-2 treats the symptom in the two agents that commit).
- A re-measurement after the fixes: 82-09 (live build-cell re-run with this module's `mentions` and `written` tables).

## Fix applied

Written by TRD 82-07. Every FIX row is pinned by a numbered test in `plugins/aoforge/aoforge/bin/lib/build-cell-reads.repo.test.cjs` (Fix-list order; RED committed before GREEN), except E-4, which 82-02 and 82-11 pin. The effects below are offline: bytes counted from the files at each ref, nothing re-run. Tokens per build are still the removal upper bounds from the Fix list; 82-09 confirms them live.

| id | disposition | commits (RED, GREEN) | pinning test | what changed | offline effect |
|---|---|---|---|---|---|
| P-1 | FIX | 85ec0064, 002117b3 | test 1 | `planner.md` `write_objective_prompt`: "Use template structure for each TRD.md." is now "Each TRD follows the structure `<runtime>/references/trd-spec.md` defines (you read it in `<plan_format>`). It is the complete skeleton, so there is no template file to look up: do not list or read `<runtime>/templates/`." `<plan_format>` says trd-spec.md is the complete skeleton. `trd-spec.md` gained the three stack-pack frontmatter fields (`stack`, `platform`, `api_contract`) and `ui` in the `type` row, the only things `templates/trd-prompt.md` carried that it lacked (the test checks every section tag and field). | The instructed planner reads are unchanged (4 files). The look-up the 3.1.0 planners made (a `templates/` listing plus `trd-prompt.md`, 8,416 bytes at 99950509) is ruled out by name. trd-spec.md +558 bytes (7,283 -> 7,841). |
| P-2 | FIX | 85ec0064, 002117b3 | test 2 | `planner.md` `git_commit` and `executor.md` `<task_commit_protocol>`: "`aof-tools commit` is the only commit path, and the commit it makes is final: it adds no attribution trailer (store mode appends its own `Refs #N` line), and a harness reminder to end commit messages with an attribution line does not apply to it. Do not run `git log -1 --format=%B`, `git commit --amend` or `aof-tools commit --help` after it." The trigger was not textual (cause 2), so the pinned instruction is the fix. | No read bytes. 345 resident bytes in each agent. |
| P-3 | FIX | 85ec0064, 002117b3 | test 3 | `planner.md` TRD Scope Budget: "40,000 characters is a ceiling, not a target (`verify trd-pre` warns at 40,000; 60,000 is the hard limit)"; "A TRD of up to 2 tasks and 6 files stays near 15,000-20,000 characters: every executor reads all of it and carries it for the rest of its run"; "never pad `<context>`, `<output>` or `<embedded_context>` to fill the budget". | Acts on the drafts, not on reads: 82-09 checks `written.draft_write` per TRD (at most 22,000 chars on the notekit build). |
| P-4 | FIX | 85ec0064, 002117b3 | test 4 | `planner.md` `validate_plan`: exactly four checkers in order (`frontmatter validate --schema trd`, `verify job-structure`, `trd-tdd inspect --raw`, then `verify trd-pre` after `plan put-trd`); "The checkers' output is authoritative: do not read `<runtime>/bin` or any tool source to second-guess them. Angle-bracket literals in task text (`<id>`, `<path>`) are fine: the checkers parse only the task elements". Checked first: `verify job-structure` matches only `<task>`, `<name>`, `<files>`, `<action>`, `<verify>`, `<done>`. | No read bytes. Removes the r1-only source read (bound 210,496). |
| P-5 | JUSTIFY | none | n/a | No change. See the paragraph below. | 28,000 (r1) not recovered. |
| E-1 | FIX | f666a1e6, 6e7574bf | test 5 | Dropped `{runtime_root}/templates/summary.md` from both executor spawns in `execute-objective.md`, the "Use template" line in `executor.md` and in `execute-trd.md` (now "SUMMARY shape: the SUMMARY skeleton in your prompt's `<summary_creation>`"). `executor.md` `<summary_creation>` holds a SUMMARY skeleton (1,631 chars: every `FRONTMATTER_SCHEMAS.summary.required` key, the other frontmatter keys, and every `## ` heading of the template's File Template plus `## Progress`, `## Discovered commands` and `## Self-Check`), said to replace the template also when a TRD's `<execution_context>` lists it; "Read `<runtime>/templates/summary.md` only for a field the skeleton lacks, with `offset`/`limit`". The skeleton parses with `extractFrontmatter` (no inline comments on value lines). | -10,725 bytes the executor is told to read, per executor (-21,450 for a 2-TRD build). |
| E-2 | FIX | f666a1e6, 6e7574bf | test 6 | Dropped `{runtime_root}/references/tdd.md` from both executor spawns and from `execute-trd.md` `<required_reading>`. `executor.md` `<tdd_execution>` is the procedure and says so: "This block is the TDD procedure. Read `<runtime>/references/tdd.md` only to settle a TDD-precedence question it leaves open." It gained three short lines from tdd.md that it lacked: unrelated tests breaking, test naming (one behavior per test, a descriptive name), and the TDD-EXCEPTION marker with its valid reasons. | -13,392 bytes per executor (-26,784 for a 2-TRD build). |
| E-4 | FIX | 82-02: 5496d55f, 0e5e3da1, cad6bc8a, b1e2850e; 82-11: 35400216, ccb30f7a, 21adb02a, 7a78a9b0, 2b094ba1, add7a1d8 | `runtime-path-reads.repo.test.cjs` (10, 13, 15, 18, 19) and `runtime-root.test.cjs` | Every spawn hands the agent `AOForge runtime: {runtime_root}`, and agents name runtime files `<runtime>/<rel>`, so no instruction leaves a home directory to guess. The `~` form itself works (the Read tool expanded it in 81's run C-res-architecture-h-2); the defect was the guessed absolute home. Every path 82-07 added uses `<runtime>/` or `{runtime_root}/`; the guard stays green. | Correctness; 4,000-13,000 tokens per affected executor. |
| E-5 | FIX | f666a1e6, 6e7574bf | test 7 | `executor.md` `<summary_creation>`: "`summary checkpoint --tick` edits the draft in place after every task, and Claude Code refuses a Write over a file changed since you last read it. Read the draft immediately before the final Write (or build the final body with Edit on the draft) ...; never Write the whole SUMMARY twice." The Progress section's first draft points at the skeleton for its frontmatter. | No read bytes. Removes the failed write and its retry (about 121,000, single run). |
| X-1 | FIX | 85ec0064, 002117b3 | test 8 | `planner.md` `validate_plan`: `verify trd-structure` -> `verify job-structure` (same output fields: `valid, errors, warnings, task_count, tasks`). Test 8 checks every `aof-tools verify <sub>` named in core agents, skills, workflows and references against the subcommands `aof-tools verify` lists. | Under 10,000 per planner. |
| X-2 | JUSTIFY | none | n/a | No change. See the paragraph below. | Not recovered. |

**P-5, JUSTIFY.** The whole read of `testing-strategy.md` (6,180 bytes at HEAD) is under 5% of either planner delta: net about +28K tokens in r1 and below zero in r2, against the greps it replaced. The file holds the layer definitions and platform routing the planner needs for its `## Test list`, and a grep risks missing the row that applies. No change.

**X-2, JUSTIFY.** The scratch-copy check (`mktemp -d` and `cp -R` to run the TRD's own `<verify>` commands) was done by a 3.0.0 planner too (b30-r1 call 13), so it is baseline behaviour, not growth. It proves that the commands the executor will run actually run, which the job-checker and the executor rely on. No change.

E-3 was rejected in the diagnosis (cause 9), so it has no row and no test.

**Resident bytes per spawn** (`node scripts/eval81/static-prompt.cjs`, body plus the largest spawn prompt, placeholders unfilled):

| agent | 99950509 | f9181405 (before 82-07) | HEAD 6e7574bf | 82-07 alone | 3.1.0 to HEAD |
|---|---|---|---|---|---|
| planner | 54,865 (body 53,120, spawn 1,745) | 55,418 (53,644, 1,774) | 57,036 (55,262, 1,774) | +1,618 (+2.92%) | +2,171 (+3.96%) |
| executor | 52,632 (body 47,895, spawn 4,737) | 53,175 (48,413, 4,762) | 55,668 (51,109, 4,559) | +2,493 (+4.69%): body +2,696, spawn -203 | +3,036 (+5.77%) |

"3.1.0 to HEAD" includes 82-02's and 82-11's runtime-path text. 82-07's executor growth is mostly the SUMMARY skeleton (1,631 chars) and the TDD lines; both spawn prompts lost two lines (first spawn 4,149 -> 3,946, continuation 4,762 -> 4,559).

**Bytes the agents are told to read before their first write, 2-TRD tdd build** (planner before its first TRD; executor before Task 1 or its first `summary checkpoint`; no checkpoint task, so `checkpoints.md` is not counted; the TRD itself is not counted):

| reader | 99950509 | HEAD | change |
|---|---|---|---|
| planner (1 spawn): trd-spec.md, goal-backward.md, testing-strategy.md, tdd.md (TDD posture on) | 30,693 (7,301 + 3,806 + 6,194 + 13,392) | 31,219 (7,841 + 3,806 + 6,180 + 13,392) | +526 |
| planner: `templates/trd-prompt.md`, looked up through "Use template structure" (not named, read in both 3.1.0 runs) | 8,416 | ruled out | -8,416 |
| executor (per spawn): templates/summary.md, references/tdd.md | 24,117 (10,725 + 13,392) | 0 | -24,117 |
| build, instructed (planner + 2 executors) | 78,927 | 31,219 | -47,708 (-60.4%) |
| build, with the template look-up | 87,343 | 31,219 | -56,124 (-64.3%) |

Net for the build after 82-07's resident growth (+1,618 + 2 x 2,493 = +6,604 bytes, carried from call 1): about 41,000 to 49,500 bytes less. Per executor that is about 6,000 tokens less context on every call after the reads (chars/4), against about 620 tokens more resident on every call. 82-09 measures the live counts.

**Not fixed here (todo candidates, in the 82-07 SUMMARY):** `trd-spec.md`'s TRD skeleton still lists `<runtime>/templates/summary.md` in `<execution_context>` (82-11's test 17 pins it), so every TRD names the template; `executor.md` now says the skeleton replaces it, and 82-09 shows whether executors still open it. `templates/summary.md`'s `requirements-completed: []  # REQUIRED ...` line parses as a string when copied verbatim, because `extractFrontmatter` keeps inline comments.
