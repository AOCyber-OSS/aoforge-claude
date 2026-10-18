---
objective: 82-3-1-0-follow-ups
trd: "04"
subsystem: estimation
tags: [tokens, transcripts, also-root, coverage, backfill]

# Dependency graph
requires:
  - objective: quick-41
    provides: token-usage.repoMatcher(repoRoot, {alsoRoots}) and calibrate --also-root
provides:
  - "tokens trd|coverage|backfill --also-root <dir> (repeatable, relative to cwd; stamp refuses it)"
  - "indexExecutorTranscripts({root, repoRoot, alsoRoots}) and planBackfill({..., alsoRoots})"
  - "formerRootExecutor fixture builder in __fixtures__/transcript-fixtures.cjs"
affects: [82-10, estimation, EST-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Former checkout roots are resolved and normalised in the CLI; the library takes absolute roots only and passes them to the one repoMatcher"
    - "A new JSON key or text suffix appears only when the flag leaves a non-empty list, so default output stays byte-identical"

key-files:
  created: []
  modified:
    - plugins/aoforge/aoforge/bin/lib/token-usage.cjs
    - plugins/aoforge/aoforge/bin/lib/token-backfill.cjs
    - plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs
    - plugins/aoforge/aoforge/bin/lib/help.cjs
    - plugins/aoforge/aoforge/bin/aof-tools.cjs
    - docs/AOF-TOOLS-REFERENCE.md
    - plugins/aoforge/aoforge/bin/lib/__fixtures__/transcript-fixtures.cjs
    - plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs
    - plugins/aoforge/aoforge/bin/lib/token-backfill.test.cjs
    - plugins/aoforge/aoforge/bin/lib/tokens-cli.test.cjs

key-decisions:
  - "tokens-cli carries its own resolveAlsoRoots with calibrate's rules (resolve against cwd, de-duplicate, sort by code unit, drop the repo, refuse a root containing it): calibrator.cjs does not export normalizeAlsoRoots/applicableAlsoRoots, exporting them would edit calibrator.cjs (outside this TRD), and their messages name calibrate. The matcher itself is not copied: alsoRoots go to token-usage.repoMatcher unchanged"
  - "With --also-root, ` · also roots <a, b>` ends the FIRST text line (the headline) of coverage and backfill, which print several lines; for trd the text is one line, so it ends the output, as calibrate's does"
  - "v1.6 coverage is 111/113 with and without --also-root /Users/justin/dev/devflow-claude: the former root adds 367 executor transcripts (65 of them for 62 v1.6 TRDs), but every one of those SUMMARYs is already stamped live, and the two missing ones (65-02, 65-03) have no executor transcript under either root"

patterns-established:
  - "Repeatable list flags in tokens-cli: LIST_FLAGS per subcommand, values kept in order and resolved after the repository is known"

requirements-completed: [SC-4]

# Verification evidence
verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

# Metrics
duration: 15min
completed: 2026-10-17
---

# Objective 82 TRD 04: `tokens --also-root` Summary

**`tokens trd`, `tokens coverage` and `tokens backfill` take a repeatable `--also-root <dir>` that hands former checkout roots to the same `token-usage.repoMatcher` `calibrate --also-root` uses, so a moved checkout's executor history counts when named; without the flag every output is byte-identical, and `stamp` refuses it.**

## Progress
- [x] Task 1: The index and backfill take alsoRoots (test list 8-9) — RED 5f697e77, GREEN 4b773418
- [x] Task 2: tokens-cli --also-root on trd, coverage and backfill; help and reference (test list 1-7, 10) — RED 0ba40e3b, GREEN a3d34271
- [x] Task 3: Report v1.6 coverage and backfill with and without the former root — (this commit)

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-18T01:14:25Z
- **Completed:** 2026-10-18T01:29Z
- **Tasks:** 3
- **Files modified:** 10 (plus this SUMMARY)

## Accomplishments
- `indexExecutorTranscripts({root, repoRoot, alsoRoots = []})` passes `alsoRoots` to `repoMatcher`; `planBackfill` forwards an `alsoRoots` option. Omitted or `[]` gives the index and plan of before (byte literal captured from HEAD).
- `tokens trd|coverage|backfill --also-root <dir>` (repeatable, relative to cwd): resolved, de-duplicated and sorted; a root equal to the repository is dropped; one containing it is a usage error (exit 1). When any remain, the JSON gains `also_roots` and the first text line ends ` · also roots <a, b>`. `tokens stamp --also-root` is a usage error ("--also-root applies to tokens trd, coverage and backfill"), nothing written.
- Help usage and details, the aof-tools.cjs header and case comment, and the AOF-TOOLS-REFERENCE.md Estimation data line name the flag.
- Measured on the real transcripts (read-only): the former root `/Users/justin/dev/devflow-claude` takes identified executor transcripts from 82 to 449 and recovers 64-09 and 64-10 in the backfill dry run; v1.6 coverage stays 111/113.

## v1.6 coverage and backfill, with and without the former root

Runs from the main checkout (`--cwd /Users/justin/dev/aoforge-claude`) with this worktree's aof-tools, real `~/.claude/projects` read-only, outputs saved in the session scratchpad under `82-04/`. All exit 0; `git status --porcelain` unchanged in both trees afterwards (main: only the pre-existing `?? amp`; worktree: clean).

| Run | live/counted | missing by reason | backfill recovered / unrecovered (by reason) | executor index (identified / foreign of 1269) |
|---|---|---|---|---|
| without `--also-root` | 111/113 = 0.9823 (target 95%: met) | no_transcript 2 (65-02, 65-03) | 0 / 174 (no_transcript 165, unkeyed 9) | 82 / 1060 |
| `--also-root /Users/justin/dev/devflow-claude` | 111/113 = 0.9823 (target 95%: met) | no_transcript 2 (65-02, 65-03) | 2 / 172 (no_transcript 163, unkeyed 9) | 449 / 693 |
| difference the flag makes | none | none | +2 recovered: 64-09, 64-10 | +367 identified (306 REPO_ROOT, 58 cwd, 3 worktree) |

First text lines:
- `v1.6 forward-stamped 111/113 = 0.9823 (target 95%: met) · live 111 · backfill 0 · unlabeled 0 · missing 2 · in progress 0 (not counted)`
- `v1.6 forward-stamped 111/113 = 0.9823 (target 95%: met) · live 111 · backfill 0 · unlabeled 0 · missing 2 · in progress 0 (not counted) · also roots /Users/justin/dev/devflow-claude`
- `summaries 602 · already stamped 428 · recovered 0 · unrecovered 174 (no_transcript 165, unkeyed 9)`
- `summaries 602 · already stamped 428 · recovered 2 · unrecovered 172 (no_transcript 163, unkeyed 9) · also roots /Users/justin/dev/devflow-claude`

`tokens trd 64-09` (a pre-move TRD unrecovered without the flag): without, `not found: no_transcript`; with, `tokens_input=7672368 tokens_output=53518 transcripts=1 · also roots /Users/justin/dev/devflow-claude`. 64-10 with the flag: `tokens_input=21039586 tokens_output=78126 transcripts=1`.

Why v1.6 does not move: the coverage JSON with the flag equals the one without apart from `also_roots`. Of the 367 transcripts the former root adds, 65 belong to 62 v1.6 TRDs (65-01, 65-04, 66-01..04, 67-01..09, 68-01..07, 69-01..06, 70-01..03, 71-01..05, 72-01..26), and every one of those SUMMARYs is already stamped live. The two missing v1.6 SUMMARYs, 65-02 and 65-03, ran inline (no executor subagent), so neither root has a transcript for them. The flag's effect is on history: objectives 35-64 gain 302 identified transcripts, and the backfill gains 64-09 and 64-10; the other 163 no_transcript SUMMARYs have no executor transcript under either root.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: index and backfill take alsoRoots | `env HOME=$SP/home-82-04 TMPDIR=$SP/tmp-82-04 node --test token-usage.test.cjs token-backfill.test.cjs agent-overhead.test.cjs calibrator.test.cjs` | 0 | PASS |
| 2: tokens-cli --also-root, help, reference | `env HOME=... TMPDIR=... node --test tokens-cli help help-delegation flag-spec.repo doc-refs.repo token-coverage token-usage token-backfill executor-token-stamp.repo` | 0 | PASS |
| 2: stamp refuses the flag | `AOF tokens stamp 01-01 --draft x --also-root y` | 1 (expected; usage line printed) | PASS |
| 2: help names the flag | `AOF tokens --help` | 0 (`[--also-root <dir>]...` in usage and details) | PASS |
| 3: coverage and backfill with and without | `AOF --cwd <main> tokens coverage [--also-root /Users/justin/dev/devflow-claude] [--raw]`, `tokens backfill [...]`, `tokens trd 64-09 [...]` | 0 (all ten runs) | PASS |
| 3: read-only | `git status --porcelain` in the main checkout and the worktree | 0 (no change) | PASS |

## Task Commits

1. **Task 1: The index and backfill take alsoRoots** - `5f697e77` (test, RED), `4b773418` (feat, GREEN)
2. **Task 2: tokens-cli --also-root on trd, coverage and backfill; help and reference** - `0ba40e3b` (test, RED), `a3d34271` (feat, GREEN)
3. **Task 3: Report v1.6 coverage and backfill with and without the former root** - this SUMMARY's Task 3 checkpoint commit (docs)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (task, scoped) | `node --test` on the Task 1 and Task 2 files, HOME/TMPDIR in the scratchpad | 0 | PASS |
| test (bin/lib regression) | every `plugins/aoforge/aoforge/bin/lib/*.test.cjs` except watcher-shell, plus `bin/aof-tools.test.cjs`, scratch HOME/TMPDIR | running | pending |
| repo static checks | rename-guard, planning-writes, aof-tools-deprecations, estimate-surfacing, regex-escape, stack-neutrality, context-budget `.repo.test.cjs` | 0 | PASS |
| objective 81 frozen modules | `node scripts/eval81/prereg.cjs --check --repo <checkout> --manifest .aoforge/objectives/81-.../results/prereg-manifest.json` | 0 (86 files match) | PASS |

The full `npm test` run belongs to 82-10.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (Task 1) | `node --test token-usage.test.cjs token-backfill.test.cjs` | 1 (q82-1, q82-3, q82-4 fail; q82-2, q82-5 byte baselines pass) | FAIL (correct) |
| GREEN (Task 1) | `node --test token-usage, token-backfill, agent-overhead, calibrator tests` | 0 | PASS (correct) |
| RED (Task 2) | `node --test --test-name-pattern=82-04 tokens-cli.test.cjs` | 1 (1-6 and 10 fail; 7, the byte baseline, passes) | FAIL (correct) |
| GREEN (Task 2) | same, then the full Task 2 file set | 0 (8/8, then all) | PASS (correct) |
| REFACTOR | none needed | - | - |

## Post-TRD Verification

- **Auto-fix cycles used:** 0
- **Must-haves verified:** 4/4 (flag on trd/coverage/backfill through repoMatcher alsoRoots; default byte-identical and stamp refuses; tests first; v1.6 numbers with and without)
- **Gate failures:** None

## Files Created/Modified
- `plugins/aoforge/aoforge/bin/lib/token-usage.cjs` - `indexExecutorTranscripts` takes `alsoRoots` and passes it to `repoMatcher`; header and JSDoc updated
- `plugins/aoforge/aoforge/bin/lib/token-backfill.cjs` - `planBackfill` forwards `alsoRoots`
- `plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs` - `LIST_FLAGS`, `--also-root` parsing, `resolveAlsoRoots`, `also_roots` JSON and ` · also roots` text only when non-empty; stamp refuses the flag; USAGE and header
- `plugins/aoforge/aoforge/bin/lib/help.cjs` - tokens usage and details sentences (general, trd, backfill, coverage)
- `plugins/aoforge/aoforge/bin/aof-tools.cjs` - header lines and the `case 'tokens'` comment
- `docs/AOF-TOOLS-REFERENCE.md` - Estimation data line names `tokens trd|coverage|backfill [--also-root <dir>]...`
- `plugins/aoforge/aoforge/bin/lib/__fixtures__/transcript-fixtures.cjs` - `formerRootExecutor`
- `plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs` - q82-1..3 (former-root matches by REPO_ROOT, cwd, worktree; byte literal of the default index; library stays strict)
- `plugins/aoforge/aoforge/bin/lib/token-backfill.test.cjs` - q82-4..5 (recovered only with alsoRoots, nothing written; omitted equals empty)
- `plugins/aoforge/aoforge/bin/lib/tokens-cli.test.cjs` - 82-04 1-7 and 10 end to end

## Decisions Made
- Normalisation lives in tokens-cli (`resolveAlsoRoots`) with calibrate's rules, because calibrator.cjs exports neither helper and is not in this TRD's files (error_recovery's "re-export only if one line" did not hold: it would move two functions and change their messages). Matching stays in `repoMatcher`: no second matcher.
- The ` · also roots` suffix ends the headline line of coverage and backfill (multi-line outputs) and the whole output of trd (one line), so every text form's first line says which roots applied.
- Test 7's default-output check stores the --raw text literally and the default JSON as sha256 of the placeholdered output (449, 121, 2484 and 746 bytes), captured with the pre-change tokens-cli.cjs; a mismatch prints the actual JSON.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The fixture builder lives in `__fixtures__/transcript-fixtures.cjs`, a file not in `files_modified`**
- **Found during:** Task 1
- **Issue:** The TRD asks for `formerRootExecutor` in token-usage.test.cjs and for Task 2's tests to reuse it from tokens-cli.test.cjs and token-backfill.test.cjs; a builder defined inside one test file cannot be shared.
- **Fix:** Added `formerRootExecutor(projectsRoot, {former, trdId, objectiveDir})` to the shared transcript fixtures module (one exported function, nothing else changed there).
- **Files modified:** plugins/aoforge/aoforge/bin/lib/__fixtures__/transcript-fixtures.cjs
- **Verification:** All three test files use it; the existing fixture users still pass.
- **Committed in:** 5f697e77

**2. [Rule 3 - Blocking] The objective 81 frozen-module check fails in any worktree on a gitignored private file**
- **Found during:** preflight
- **Issue:** `prereg.cjs --check` from the checkout reports `0 changed, 0 added, 1 missing`: `.aoforge/objectives/81-.../private/fleet-checklists.json` is gitignored, so no worktree has it.
- **Fix:** Linked the main checkout's copy in temporarily, ran the check (OK, 86 files match), removed the link; `git status --ignored` on that directory is clean. None of this TRD's files is in the manifest.
- **Files modified:** none
- **Committed in:** n/a

---

**Total deviations:** 2 auto-fixed (2 blocking). **Impact on plan:** none on scope; one shared fixture function added.

## Issues Encountered
- The TRD's `--raw JSON` wording: in `aof-tools tokens`, JSON is the default output and `--raw` prints text. Implemented as the test list describes: the JSON gains `also_roots` only when given, and the text ends its first line with ` · also roots`.

## Discovered commands
None: the test command came from STACK.md (`node --test {files}`).

## User Setup Required
None - no external service configuration required.

## Next Objective Readiness
- 82-10 (docs, records and revalidation) owns the CHANGELOG and USER-GUIDE lines for `tokens --also-root` and the full `npm test` run.
- Running `tokens backfill --write --also-root /Users/justin/dev/devflow-claude` would stamp 64-09 and 64-10; not run here (the TRD forbids `--write`).

---
*Objective: 82-3-1-0-follow-ups*
*Completed: 2026-10-17*
