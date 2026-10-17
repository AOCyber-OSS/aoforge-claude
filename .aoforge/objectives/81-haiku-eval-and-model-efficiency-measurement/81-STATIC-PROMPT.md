# 81-STATIC-PROMPT: static resident-prompt comparison, 3.0.0 vs 3.1.0

The free half of 76-08 (SC-4). These are **static bytes** read from two release trees; no model was called and
nothing was run. The live first-turn input tokens per role, with the real fixture content filled in, come from
test E (TRD 81-17). Machine-readable copy: `results/static-prompt.json` (TRD 81-12 reads it).

Reproduce: `node scripts/eval81/static-prompt.cjs --from v3.0.0 --to HEAD --json <file> --md <file>`
(`node --test scripts/eval81/static-prompt.test.cjs` for its tests).

## Refs

| Name | Ref | Commit | `plugins/` tree |
|---|---|---|---|
| 3.0.0 | tag `v3.0.0` | b4a9d87030fbbdfe707514cedbd06601598e4041 | 37fc721610edeb12b7713f3a1ed6645ff5ffc61f |
| 3.1.0 | this branch's HEAD at the run (`plugin.json` and `package.json` say 3.1.0; no tag yet) | c4694697820d8f7094541b358bc5582bbec81260 | 32213984d1f70c6038506adc8fb648cf514aea69 |

The 3.1.0 `plugins/` tree is the same tree as the wave base `8ba149b6` (`git rev-parse 8ba149b6:plugins` and
`HEAD:plugins` print the same hash): the commits of this TRD touch only `scripts/` and `.aoforge/`. The tree hash,
not the commit, is what the numbers depend on.

## Method

- **Read-only.** `git ls-tree -r` and `git show <ref>:<path>` for every file. No checkout, no worktree, no write
  except the two output files.
- **Resident bytes** for an agent = `body_bytes + max_spawn_bytes`.
  - `body_bytes`: the agent definition without its YAML frontmatter (the subagent's system prompt).
    `agent_bytes` (the whole file, what `git show <ref>:plugins/aoforge/agents/<name>.md | wc -c` prints) is in the JSON.
  - `max_spawn_bytes`: the largest spawn-prompt template that names the agent, as written in the workflow, skill,
    template or pack fragment, with its `{placeholders}` unfilled. The maximum over sites, not the sum: one spawn
    carries one prompt.
- **Tokens** = `round(bytes / 4)` (`CHARS_PER_TOKEN` from `lib/context-audit.cjs`). Bytes are UTF-8 bytes, which are
  at least the character count, so the estimate runs slightly high for text with em dashes.
- **Not resident, reported apart.**
  - Named `@~/.claude/aoforge/...` paths in the agent file or in a spawn prompt. Objective 76's audit found they do
    not cross the Task boundary (plan-objective.md says so). Summed in their own column below.
  - Stack-pack fragments an agent Reads at run time (3.1.0 only), shown in their own table.
  - Content the orchestrator fills in at spawn time (`{TRD_CONTENT}`, state, roadmap, requirements): placeholders
    count as their own characters only. That content is what test E measures.
  - Claude Code's own system prompt and tool schemas, which are the same in both trees.
- **Spawn sites** are found by two shapes (`Task(` / `Agent(` with `prompt=` and `subagent_type=`; a fenced
  parameter block with `subagent_type: "x"` followed by a `Prompt:` block). A `prompt=<variable>` is resolved to the
  fenced block labelled with the variable's name, else the nearest "... prompt:" block, else a markdown block directly
  above the call; the `form` column records which. A site whose prompt cannot be found is `-` with a reason, never a
  guess. Every site is listed with file and line in the appendix; every line-anchored `Task(`/`Agent(` and every
  parameter block in either tree became a site (43 + 7 = 50 in 3.0.0, 45 + 7 = 52 in 3.1.0).
- **Indentation counts.** A template nested in a list item keeps its leading spaces, as written.

## Resident bytes per agent, sorted by resident delta (largest cut first)

| Agent | Kind 3.0.0 / 3.1.0 | Body 3.0.0 | Body 3.1.0 | Spawn max 3.0.0 | Spawn max 3.1.0 | Resident 3.0.0 | Resident 3.1.0 | Delta bytes | Delta % | Tokens 3.0.0 | Tokens 3.1.0 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| verifier | core / core | 47080 | 30163 | 946 | 946 | 48026 | 31109 | -16917 | -35.22% | 12007 | 7777 |
| executor | core / core | 60376 | 47895 | 4153 | 4737 | 64529 | 52632 | -11897 | -18.44% | 16132 | 13158 |
| planner | core / core | 59510 | 53120 | 1745 | 1745 | 61255 | 54865 | -6390 | -10.43% | 15314 | 13716 |
| security-auditor | core / core | 14284 | 9249 | 410 | 410 | 14694 | 9659 | -5035 | -34.27% | 3674 | 2415 |
| codebase-mapper | core / core | 10936 | 10373 | 563 | 563 | 11499 | 10936 | -563 | -4.9% | 2875 | 2734 |
| job-checker | core / core | 24642 | 24596 | 834 | 834 | 25476 | 25430 | -46 | -0.18% | 6369 | 6358 |
| general-purpose | built-in | - | - | 57 | 57 | 57 | 57 | 0 | 0% | 14 | 14 |
| integration-checker | core / core | 14382 | 14382 | 376 | 376 | 14758 | 14758 | 0 | 0% | 3690 | 3690 |
| objective-researcher | core / core | 12816 | 12816 | 1950 | 1950 | 14766 | 14766 | 0 | 0% | 3692 | 3692 |
| research-synthesizer | core / core | 7860 | 7860 | 415 | 415 | 8275 | 8275 | 0 | 0% | 2069 | 2069 |
| project-researcher | core / core | 6634 | 6625 | 1263 | 1318 | 7897 | 7943 | +46 | +0.58% | 1974 | 1986 |
| roadmapper | core / core | 19499 | 19910 | 920 | 920 | 20419 | 20830 | +411 | +2.01% | 5105 | 5208 |
| debugger | core / core | 18895 | 19989 | 565 | 565 | 19460 | 20554 | +1094 | +5.62% | 4865 | 5139 |
| ui-evaluator | core / **pack** | 6981 | 9297 | - | 59 | 6981 | 9356 | +2375 | +34.02% | 1745 | 2339 |
| web-ui-verifier | absent / **pack** | - | 2962 | - | 120 | - | 3082 | - | - | - | 771 |

What moved:

- **Verifier -16,917 bytes (-35.2%), executor -11,897 (-18.4%), planner -6,390 (-10.4%).** These are the three
  prompts objective 76 cut (Flutter procedure moved to the packs, dead `@` lists dropped). The agent definitions
  account for all of it: the largest spawn template of the verifier (946) and of the planner (1,745) is the same size in both trees.
- **Executor spawn template grew +584 bytes** (main spawn `execute-objective.md` 3,540 -> 4,124; continuation 4,153
  -> 4,737). The agent body shrank 12,481, so the net is the figure above.
- **security-auditor -5,035 (-34.3%)** is a cut the objective 76 list did not name; `git diff --stat v3.0.0 8ba149b6` shows
  136 changed lines in `security-auditor.md`, all deletions.
- **Grew:** debugger +1,094, roadmapper +411, project-researcher +46 (a longer new-project spawn prompt, 1,263 ->
  1,318, while its body shrank 9).
- **Unchanged:** integration-checker, objective-researcher, research-synthesizer.
- **general-purpose** is Claude Code's built-in agent: the tree holds only the orchestrator's short prompts for it
  (57 bytes at most), not its system prompt, so it has no body figure.

## Totals

Per defined agent, summing each agent's resident bytes once. This is an inventory, not a session cost: a run spawns
only some agents, each carrying its own prompt on every spawn.

| Group | Agents 3.0.0 | Resident bytes 3.0.0 | Agents 3.1.0 | Resident bytes 3.1.0 | Delta bytes | Delta % |
|---|---:|---:|---:|---:|---:|---:|
| core | 13 | 318035 | 12 | 271757 | -46278 | -14.55% |
| core in both trees (like for like) | 12 | 311054 | 12 | 271757 | -39297 | -12.63% |
| pack | 0 | 0 | 2 | 12438 | +12438 | - |

Stack-pack agents are counted apart. `ui-evaluator` was a core agent in 3.0.0 and is a pack agent in 3.1.0
(`aoforge-stack-flutter`), so the plain core row shows 6,981 bytes leaving core that did not shrink anywhere; the
like-for-like row removes it from both sides. In 3.1.0 a pack agent's 12,438 bytes are loaded only when that pack's
agent is spawned (a UI evaluation or a web UI drive), not for every project.

One illustration, not a measurement: the planner, executor and verifier that a `/aoforge:quick` run spawns carry
173,810 bytes of resident prompt in 3.0.0 (61,255 + 64,529 + 48,026) and 138,606 in 3.1.0 (54,865 + 52,632 +
31,109): -35,204 bytes (-20.25%), about 8,800 tokens fewer, before any task content. Test E measures what a run
really sends.

## Stack-pack fragments (3.1.0): moved, not removed, for Flutter and web projects

The cut above is a cut for a project with no matching pack. In a project whose stack matches, the 3.1.0 agent Reads
its pack fragment at load time, so those bytes enter its context (as a tool result, not the system prompt). 3.0.0
had no fragments; the same procedure was inline in the agent file.

| Agent | Flutter fragment | Web fragment | 3.1.0 body + Flutter fragment | 3.0.0 body | Difference |
|---|---:|---:|---:|---:|---:|
| verifier | 19537 | 1650 | 49700 | 47080 | +2620 (+5.6%) |
| executor | 15387 | 4839 | 63282 | 60376 | +2906 (+4.8%) |
| planner | 10898 | - | 64018 | 59510 | +4508 (+7.6%) |

So for a Flutter project the 3.1.0 agents carry slightly more instruction text than 3.0.0 did, but not resident: it
arrives on demand, after the system prompt, and only when the stack matches. SC-4's resident figure is the first
table; this one is the honest counterweight for Flutter work. Whether a test E fixture reads a fragment depends on
the stack it is built in.

## Named `@` paths (reported apart; they do not cross the Task boundary)

Paths named by the agent file or by any of its spawn prompts, counted once each, with the size of the file the path
points at in that tree. `Missing` is a named path with no file in the tree (none).

| Agent | Paths 3.0.0 | Bytes 3.0.0 | Missing 3.0.0 | Paths 3.1.0 | Bytes 3.1.0 | Missing 3.1.0 |
|---|---:|---:|---:|---:|---:|---:|
| verifier | 3 | 13167 | 0 | 1 | 4830 | 0 |
| executor | 10 | 121022 | 0 | 1 | 42243 | 0 |
| planner | 5 | 74125 | 0 | 1 | 6194 | 0 |
| security-auditor | 0 | 0 | 0 | 0 | 0 | 0 |
| codebase-mapper | 9 | 67016 | 0 | 1 | 4830 | 0 |
| job-checker | 1 | 3806 | 0 | 1 | 3806 | 0 |
| general-purpose | 0 | 0 | 0 | 0 | 0 | 0 |
| integration-checker | 1 | 7020 | 0 | 1 | 7020 | 0 |
| objective-researcher | 1 | 4936 | 0 | 1 | 4936 | 0 |
| research-synthesizer | 0 | 0 | 0 | 0 | 0 | 0 |
| project-researcher | 6 | 29340 | 0 | 1 | 4936 | 0 |
| roadmapper | 0 | 0 | 0 | 0 | 0 | 0 |
| debugger | 1 | 20326 | 0 | 1 | 20326 | 0 |
| ui-evaluator | 0 | 0 | 0 | 0 | 0 | 0 |
| web-ui-verifier | - | - | - | 0 | 0 | 0 |

## Spawn sites without a measured prompt

Ten rows (five locations, in both trees). None changes an agent's maximum.

| Location | Why no number | Effect |
|---|---|---|
| `execute-objective.md:496` (3.0.0), `:501` (3.1.0) | `prompt="..."` is elided: the background-wave example points back at the full executor prompt | The full prompt is the site above it (3,540 / 4,124 bytes), already counted |
| `templates/planner-subagent-prompt.md:73`, `:82` | Documentation examples calling `prompt=filled_template`; the template block (1,301 bytes, hand-counted) is under a `## Template` heading, not a label matching the variable | Below the planner's measured maximum (1,745), so no effect |
| `templates/debug-subagent-prompt.md:56` | Same: documentation example with `filled_template` (the example at `:65`, `prompt=template`, did resolve to the 565-byte Template block) | The 565 bytes are counted |
| `workflows/diagnose-issues.md:96` (3.0.0), `:102` (3.1.0) | `prompt=filled_debug_subagent_prompt` is filled from the template file named in prose, which no label ties to the variable | That template is the 565-byte block above, already counted |

In 3.0.0 `ui-evaluator` has no site at all: the skills said "spawn the `ui-evaluator` agent via the Task tool" in
prose with no template. Its 3.0.0 row is therefore body-only. In 3.1.0 the pack skill gives a real `Task(` (59 bytes).

## Hand spot-checks

All three agree with the script.

1. **Verifier agent bytes.** `git show v3.0.0:plugins/aoforge/agents/verifier.md | wc -c` prints 47839, and
   `git show HEAD:plugins/aoforge/agents/verifier.md | wc -c` prints 30490; the JSON `agent_bytes` are 47839 and
   30490. Without frontmatter (awk dropping the lines between the leading `---` pair) the counts are 47080 and 30163,
   equal to `body_bytes`.
2. **One spawn prompt.** The 3.0.0 checkpoint-verification prompt at `execute-objective.md:888` (script: 946 bytes,
   `prompt_line` 888). Counted by hand from the file: the newline after `prompt="` (1), lines 889 to 911 (`sed -n
   889,911p | wc -c` = 941) and the four spaces before the closing quote on line 912 (4): 1 + 941 + 4 = 946.
3. **One named-`@` sum.** The executor in 3.0.0 names ten paths in the agent file and its spawn prompt (eight references, one template,
   one workflow). `git show v3.0.0:<path> | wc -c` for each of deviation-rules (4196), checkpoints
   (42355), anti-patterns (5268), verification-patterns (22888), full-output (3566), context-discipline (4830),
   escalation-policy (4182), summary (10725), execute-trd (9620) and tdd (13392) sums to 121,022, the script's
   `named_at.bytes`.

## Limits

- Template bytes exclude what the orchestrator fills in. They show how much fixed prompt each spawn starts with,
  not the size of a run.
- The maximum over a role's sites stands for the role. A role spawned from a smaller site (a quick-mode verifier
  prompt of 387 bytes against 946 at the execute-objective site) carries less.
- 3.1.0 is the branch tree, not a tagged release. The JSON records the commit and the `plugins/` tree hash so the
  figures can be re-derived once the tag exists.

## Appendix: spawn sites (every site, file and line)

`Site` is the line of the `Task(`/`Agent(` or `subagent_type:` line; `Template at` is the line where the measured prompt
starts (a fence for a variable or parameter-block prompt).

### 3.0.0 (`v3.0.0`)

| Agent | Site | Template at | Form | Bytes | Reason |
|---|---|---|---|---:|---|
| verifier | plugins/aoforge/aoforge/workflows/build.md:261 | 262 | literal | 505 |  |
| verifier | plugins/aoforge/aoforge/workflows/execute-objective.md:885 | 888 | literal | 946 |  |
| verifier | plugins/aoforge/aoforge/workflows/execute-objective.md:1221 | 1222 | literal | 632 |  |
| verifier | plugins/aoforge/aoforge/workflows/quick.md:363 | 364 | literal | 387 |  |
| executor | plugins/aoforge/aoforge/workflows/execute-objective.md:416 | 419 | literal | 3540 |  |
| executor | plugins/aoforge/aoforge/workflows/execute-objective.md:496 | 499 | literal | - | prompt is elided ("...") in the workflow; the full prompt is at an earlier site |
| executor | plugins/aoforge/aoforge/workflows/execute-objective.md:992 | 996 | literal | 4153 |  |
| executor | plugins/aoforge/aoforge/workflows/quick.md:301 | 302 | literal | 751 |  |
| planner | plugins/aoforge/aoforge/templates/planner-subagent-prompt.md:73 | 74 | variable | - | prompt=filled_template: no fenced block labelled "filled template", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| planner | plugins/aoforge/aoforge/templates/planner-subagent-prompt.md:82 | 83 | variable | - | prompt=filled_template: no fenced block labelled "filled template", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| planner | plugins/aoforge/aoforge/workflows/execute-objective.md:1289 | 1290 | literal | 222 |  |
| planner | plugins/aoforge/aoforge/workflows/plan-objective.md:540 | 487 | variable:nearest-labelled | 1745 |  |
| planner | plugins/aoforge/aoforge/workflows/plan-objective.md:715 | 692 | variable:label | 910 |  |
| planner | plugins/aoforge/aoforge/workflows/quick.md:106 | 107 | literal | 815 |  |
| planner | plugins/aoforge/aoforge/workflows/quick.md:244 | 227 | variable:label | 396 |  |
| planner | plugins/aoforge/aoforge/workflows/verify-work.md:502 | 503 | literal | 379 |  |
| planner | plugins/aoforge/aoforge/workflows/verify-work.md:592 | 593 | literal | 382 |  |
| security-auditor | plugins/aoforge/aoforge/workflows/security-audit.md:106 | 113 | parameter-block | 398 |  |
| security-auditor | plugins/aoforge/aoforge/workflows/security-audit.md:129 | 136 | parameter-block | 385 |  |
| security-auditor | plugins/aoforge/aoforge/workflows/security-audit.md:152 | 159 | parameter-block | 410 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:163 | 170 | parameter-block | 466 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:186 | 193 | parameter-block | 456 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:209 | 216 | parameter-block | 563 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:233 | 240 | parameter-block | 400 |  |
| job-checker | plugins/aoforge/aoforge/workflows/plan-objective.md:651 | 626 | variable:label | 707 |  |
| job-checker | plugins/aoforge/aoforge/workflows/quick.md:200 | 173 | variable:label | 834 |  |
| job-checker | plugins/aoforge/aoforge/workflows/verify-work.md:553 | 554 | literal | 344 |  |
| general-purpose | plugins/aoforge/aoforge/workflows/build.md:237 | 238 | literal | 57 |  |
| general-purpose | plugins/aoforge/aoforge/workflows/discuss-objective.md:468 | 469 | literal | 47 |  |
| general-purpose | plugins/aoforge/aoforge/workflows/plan-objective.md:814 | 815 | literal | 50 |  |
| integration-checker | plugins/aoforge/aoforge/workflows/audit-milestone.md:66 | 67 | literal | 376 |  |
| objective-researcher | plugins/aoforge/aoforge/workflows/plan-objective.md:204 | 174 | variable:label | 1035 |  |
| objective-researcher | plugins/aoforge/aoforge/workflows/research-objective.md:70 | 71 | literal | 545 |  |
| objective-researcher | plugins/aoforge/skills/research-objective/SKILL.md:237 | 179 | variable:adjacent-block | 1950 |  |
| objective-researcher | plugins/aoforge/skills/research-objective/SKILL.md:313 | 297 | variable:adjacent-block | 308 |  |
| research-synthesizer | plugins/aoforge/aoforge/workflows/new-milestone.md:192 | 192 | literal | 275 |  |
| research-synthesizer | plugins/aoforge/aoforge/workflows/new-project.md:768 | 768 | literal | 415 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-milestone.md:153 | 153 | literal | 750 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:588 | 588 | literal | 1261 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:627 | 627 | literal | 1263 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:666 | 666 | literal | 1226 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:705 | 705 | literal | 1199 |  |
| roadmapper | plugins/aoforge/aoforge/workflows/new-milestone.md:344 | 344 | literal | 879 |  |
| roadmapper | plugins/aoforge/aoforge/workflows/new-project.md:1024 | 1024 | literal | 920 |  |
| roadmapper | plugins/aoforge/aoforge/workflows/new-project.md:1128 | 1128 | literal | 234 |  |
| debugger | plugins/aoforge/aoforge/templates/debug-subagent-prompt.md:56 | 57 | variable | - | prompt=filled_template: no fenced block labelled "filled template", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| debugger | plugins/aoforge/aoforge/templates/debug-subagent-prompt.md:65 | 9 | variable:label | 565 |  |
| debugger | plugins/aoforge/aoforge/workflows/diagnose-issues.md:96 | 97 | variable | - | prompt=filled_debug_subagent_prompt: no fenced block labelled "filled debug subagent prompt", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| debugger | plugins/aoforge/skills/debug/SKILL.md:159 | 133 | variable:adjacent-block | 519 |  |
| debugger | plugins/aoforge/skills/debug/SKILL.md:238 | 218 | variable:adjacent-block | 289 |  |

### 3.1.0 (`HEAD`)

| Agent | Site | Template at | Form | Bytes | Reason |
|---|---|---|---|---:|---|
| verifier | plugins/aoforge/aoforge/workflows/build.md:270 | 271 | literal | 505 |  |
| verifier | plugins/aoforge/aoforge/workflows/execute-objective.md:911 | 914 | literal | 946 |  |
| verifier | plugins/aoforge/aoforge/workflows/execute-objective.md:1249 | 1250 | literal | 632 |  |
| verifier | plugins/aoforge/aoforge/workflows/quick.md:362 | 363 | literal | 387 |  |
| executor | plugins/aoforge/aoforge/workflows/execute-objective.md:419 | 422 | literal | 4124 |  |
| executor | plugins/aoforge/aoforge/workflows/execute-objective.md:501 | 504 | literal | - | prompt is elided ("...") in the workflow; the full prompt is at an earlier site |
| executor | plugins/aoforge/aoforge/workflows/execute-objective.md:1018 | 1022 | literal | 4737 |  |
| executor | plugins/aoforge/aoforge/workflows/quick.md:300 | 301 | literal | 859 |  |
| planner | plugins/aoforge/aoforge/templates/planner-subagent-prompt.md:73 | 74 | variable | - | prompt=filled_template: no fenced block labelled "filled template", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| planner | plugins/aoforge/aoforge/templates/planner-subagent-prompt.md:82 | 83 | variable | - | prompt=filled_template: no fenced block labelled "filled template", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| planner | plugins/aoforge/aoforge/workflows/execute-objective.md:1322 | 1323 | literal | 222 |  |
| planner | plugins/aoforge/aoforge/workflows/plan-objective.md:540 | 487 | variable:nearest-labelled | 1745 |  |
| planner | plugins/aoforge/aoforge/workflows/plan-objective.md:732 | 709 | variable:label | 910 |  |
| planner | plugins/aoforge/aoforge/workflows/quick.md:106 | 107 | literal | 910 |  |
| planner | plugins/aoforge/aoforge/workflows/quick.md:243 | 226 | variable:label | 396 |  |
| planner | plugins/aoforge/aoforge/workflows/verify-work.md:486 | 487 | literal | 540 |  |
| planner | plugins/aoforge/aoforge/workflows/verify-work.md:581 | 582 | literal | 382 |  |
| security-auditor | plugins/aoforge/aoforge/workflows/security-audit.md:106 | 113 | parameter-block | 398 |  |
| security-auditor | plugins/aoforge/aoforge/workflows/security-audit.md:129 | 136 | parameter-block | 385 |  |
| security-auditor | plugins/aoforge/aoforge/workflows/security-audit.md:152 | 159 | parameter-block | 410 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:163 | 170 | parameter-block | 466 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:186 | 193 | parameter-block | 456 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:209 | 216 | parameter-block | 563 |  |
| codebase-mapper | plugins/aoforge/aoforge/workflows/map-codebase.md:233 | 240 | parameter-block | 400 |  |
| job-checker | plugins/aoforge/aoforge/workflows/plan-objective.md:668 | 642 | variable:label | 770 |  |
| job-checker | plugins/aoforge/aoforge/workflows/quick.md:199 | 172 | variable:label | 834 |  |
| job-checker | plugins/aoforge/aoforge/workflows/verify-work.md:541 | 542 | literal | 485 |  |
| general-purpose | plugins/aoforge/aoforge/workflows/build.md:246 | 247 | literal | 57 |  |
| general-purpose | plugins/aoforge/aoforge/workflows/discuss-objective.md:468 | 469 | literal | 47 |  |
| general-purpose | plugins/aoforge/aoforge/workflows/plan-objective.md:831 | 832 | literal | 50 |  |
| integration-checker | plugins/aoforge/aoforge/workflows/audit-milestone.md:66 | 67 | literal | 376 |  |
| objective-researcher | plugins/aoforge/aoforge/workflows/plan-objective.md:204 | 174 | variable:label | 1035 |  |
| objective-researcher | plugins/aoforge/aoforge/workflows/research-objective.md:73 | 74 | literal | 545 |  |
| objective-researcher | plugins/aoforge/skills/research-objective/SKILL.md:237 | 179 | variable:adjacent-block | 1950 |  |
| objective-researcher | plugins/aoforge/skills/research-objective/SKILL.md:313 | 297 | variable:adjacent-block | 308 |  |
| research-synthesizer | plugins/aoforge/aoforge/workflows/new-milestone.md:195 | 195 | literal | 275 |  |
| research-synthesizer | plugins/aoforge/aoforge/workflows/new-project.md:768 | 768 | literal | 415 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-milestone.md:153 | 153 | literal | 750 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:588 | 588 | literal | 1318 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:627 | 627 | literal | 1263 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:666 | 666 | literal | 1226 |  |
| project-researcher | plugins/aoforge/aoforge/workflows/new-project.md:705 | 705 | literal | 1199 |  |
| roadmapper | plugins/aoforge/aoforge/workflows/new-milestone.md:347 | 347 | literal | 879 |  |
| roadmapper | plugins/aoforge/aoforge/workflows/new-project.md:1024 | 1024 | literal | 920 |  |
| roadmapper | plugins/aoforge/aoforge/workflows/new-project.md:1128 | 1128 | literal | 234 |  |
| debugger | plugins/aoforge/aoforge/templates/debug-subagent-prompt.md:56 | 57 | variable | - | prompt=filled_template: no fenced block labelled "filled template", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| debugger | plugins/aoforge/aoforge/templates/debug-subagent-prompt.md:65 | 9 | variable:label | 565 |  |
| debugger | plugins/aoforge/aoforge/workflows/diagnose-issues.md:102 | 103 | variable | - | prompt=filled_debug_subagent_prompt: no fenced block labelled "filled debug subagent prompt", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site |
| debugger | plugins/aoforge/skills/debug/SKILL.md:159 | 133 | variable:adjacent-block | 519 |  |
| debugger | plugins/aoforge/skills/debug/SKILL.md:248 | 228 | variable:adjacent-block | 289 |  |
| ui-evaluator | plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md:72 | 75 | literal | 59 |  |
| web-ui-verifier | plugins/aoforge-stack-web/fragments/verifier.md:19 | 22 | literal | 120 |  |
