---
objective: quick-41
trd: 01
subsystem: estimation (agent-overhead calibration)
tags: [calibrate, agent-overhead, transcripts, checkout-move, also-root, tests]
requires: []
provides:
  - "calibrate --also-root <dir> (repeatable): former checkout roots whose overhead spawns still count, recorded in method.also_roots"
  - "token-usage.repoMatcher(root, { alsoRoots }): former roots match by REPO_ROOT, cwd, worktree base and planning-path prefix (current and legacy planning dir, aliases only)"
  - "a rebuilt live ~/.claude/aoforge/calibration.json with all six overhead agents sampled (164 matched spawns)"
affects: [calibrate, agent-overhead, token-usage, help, docs/USER-GUIDE.md, docs/AOF-TOOLS-REFERENCE.md, CHANGELOG.md]
tech-stack:
  added: []
  patterns: [opt-in method key recorded only when non-empty so the default bytes and digest are unchanged, library errors tagged with a code the CLI maps to usage errors]
key-files:
  created: []
  modified:
    - plugins/aoforge/aoforge/bin/lib/token-usage.cjs
    - plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs
    - plugins/aoforge/aoforge/bin/lib/agent-overhead.cjs
    - plugins/aoforge/aoforge/bin/lib/agent-overhead.test.cjs
    - plugins/aoforge/aoforge/bin/lib/legacy-names.cjs
    - plugins/aoforge/aoforge/bin/lib/calibrator.cjs
    - plugins/aoforge/aoforge/bin/lib/calibrator.test.cjs
    - plugins/aoforge/aoforge/bin/lib/calibrate-cli.cjs
    - plugins/aoforge/aoforge/bin/lib/calibrate-cli.test.cjs
    - plugins/aoforge/aoforge/bin/lib/help.cjs
    - plugins/aoforge/aoforge/bin/aof-tools.cjs
    - docs/USER-GUIDE.md
    - docs/AOF-TOOLS-REFERENCE.md
    - CHANGELOG.md
decisions:
  - "An alias equal to the project root is filtered out inside repoMatcher too, so it can never give the project root the legacy planning directory"
  - "alsoRoots errors that the CLI cannot pre-check (two projects, an ancestor root) carry code ERR_CALIBRATE_ALSO_ROOTS (calibrator.ALSO_ROOTS_ERROR); calibrate-cli maps exactly that code to a usage error with the usage line"
  - "The decomposition run was priced with a rates file rebuilt from the backup's own models and model_aliases, because scratchpad/model-rates.old.json and cd6bbbc5^ both carry claude-haiku-5-5 (as_of 2026-10-16), which the backup does not"
metrics:
  completed: 2026-10-17
  tasks: 3
  commits: 5
  files: 14
status: complete
---

# Quick 41: calibrate --also-root counts a moved checkout's agent overhead

`calibrate --also-root <dir>` (repeatable) lets the agent-overhead scan claim spawns recorded under a former checkout
path. The flag is recorded in `method.also_roots` and so in `inputs_digest`. Without it the calibration is byte-identical
to BASE on real data. The live calibration was rebuilt from 164 matched spawns (127 on 2026-10-08, 22 today without the
alias), and all six agents are sampled again.

## Progress

- [x] Task 1: The transcript matcher accepts former checkout roots — 4dab0068 (RED), 634ff914 (GREEN)
- [x] Task 2: calibrate --also-root records the former roots and feeds the overhead scan — 8a435742 (RED), dc1452b7 (GREEN)
- [x] Task 3: Docs and changelog, then recalibrate the live file and report old against new — 7983bacd

## BASE and commits

- BASE: `3d23c8f95d21af869028d9fb4192ab9794773362` (quick 40's last commit, `docs(quick-40): df- leftovers and root skip`)
- `4dab0068` test(quick-41): transcripts under a former checkout root match only when named (RED)
- `634ff914` feat(quick-41): transcript matcher accepts former checkout roots
- `8a435742` test(quick-41): calibrate --also-root (RED)
- `dc1452b7` feat(quick-41): calibrate --also-root counts a moved checkout's agent overhead
- `7983bacd` docs(quick-41): calibrate --also-root in the guide, reference and changelog

All five went through `aof-tools commit`. Nothing was pushed, tagged or released. The SUMMARY is not committed; the
orchestrator does that.

## What changed

- `token-usage.repoMatcher(repoRoot, { alsoRoots = [] } = {})`. Each alias root is resolved and realpath'd (it does not
  have to exist). It joins `isRepo` and `contains`, its `<dirname>/.df-worktrees/<basename>` base joins `inWorktree`, and
  its `<root>/.aoforge/` and `<root>/<LEGACY.planningDir>/` prefixes are appended after the project root's. The project
  root keeps `PLANNING_DIR_NAMES` only. With no aliases every field equals BASE, and `repoMatch` is unchanged.
  `alsoRoots` that is not an array of non-empty absolute strings throws a TypeError naming `alsoRoots`.
- `agent-overhead.indexOverheadTranscripts` / `collectOverhead` pass `projects[i].alsoRoots` to the matcher.
- `calibrator.buildCalibration({ alsoRoots })`: the roots are normalised (resolve, de-duplicate, sort by code unit).
  An alias equal to the project root is dropped. These cases throw `ERR_CALIBRATE_ALSO_ROOTS`: no transcripts root,
  more than one project, or an alias that contains the project. `method.also_roots` and `ALSO_ROOTS_NOTE` (the
  locked wording) are added only when the list is non-empty, and they are set before `inputsDigest`.
  `CALIBRATION_VERSION` is unchanged (3).
- `calibrate-cli`: `--also-root` is a list flag with the "needs a value" rule. It is refused together with
  `--no-overhead`, and each value resolves against cwd. Library `ERR_CALIBRATE_ALSO_ROOTS` errors become usage errors
  (exit 1, usage line, nothing written). The `--raw` line ends ` · also roots <a, b>`. `USAGE`, `help.cjs` (usage +
  one details passage), the `aof-tools.cjs` header and the `case 'calibrate'` comment (`[--also-root dir]...`,
  `quick-41`) name the flag.
- `legacy-names.cjs` header: token-usage added to the history readers (comment only).
- Untouched as required: `compat.cjs` (empty diff against BASE), `token-backfill.cjs` and `tokens-cli.cjs` (no
  `alsoRoots`), `estimate-format.cjs`, `estimate-cli.cjs`, `flag-spec.cjs`.

## RED failures

Task 1 (scoped run, `scoped-t1-red.txt`):
- token-usage: `q41-1: a REPO_ROOT line naming a former root matches only when that root is named in alsoRoots`,
  `q41-2: with no REPO_ROOT line, a cwd in a former root or its worktree base matches; a prefix sibling does not`,
  `q41-3: a former root's current or legacy planning path matches; the project root gets no legacy directory`,
  `q41-5: alsoRoots must be an array of non-empty absolute paths` (`q41-4` passed, as expected)
- agent-overhead: `q41-6: alsoRoots claims a former root's spawns (cwd and worktree) for the project; without it they are foreign`,
  `q41-7: collectOverhead with alsoRoots is deterministic`

Task 2 (`scoped-t2-red.txt`):
- calibrator: `q41-9: a former root claims its verifier spawn and is recorded in method, a note and inputs_digest`,
  `q41-10: alsoRoots are resolved, de-duplicated and sorted; an alias equal to the project root is dropped`,
  `q41-11: alsoRoots without a transcripts root, with two projects, or containing the project throw` (`q41-8` passed, as expected)
- calibrate-cli: `q41-12. --also-root (repeatable, relative to cwd) counts the former root's spawns, is recorded, and reruns unchanged`
  (`unknown flag --also-root for calibrate`), `q41-13. --also-root usage errors exit 1 with the usage line and write nothing`,
  `q41-14. calibrate --help, USAGE, the help usage and the case comment name --also-root`

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: matcher accepts former roots | scoped set (13 files, scratch HOME); `git diff BASE -- compat.cjs` empty; `rg alsoRoots token-backfill.cjs tokens-cli.cjs` empty | 0 | PASS |
| 2: calibrate --also-root | scoped set; `aof-tools calibrate --help` shows `--also-root`; `calibrate --also-root x --no-overhead --dry-run` exits 1 with the usage line | 0 / 1 (expected) | PASS |
| 3: docs, byte-identity, recalibration | scoped set; `cmp` BASE vs HEAD no-alias (identical); dry run floors met; live write; `estimate task --class code_tdd --raw`; second write `unchanged` | 0 | PASS |

## Scoped set, per file (scratch HOME)

| File | BASE | After Task 1 | After Task 2 | Final |
|---|---|---|---|---|
| token-usage.test.cjs | 15/15 | 20/20 | 20/20 | 20/20 |
| agent-overhead.test.cjs | 5/5 | 7/7 | 7/7 | 7/7 |
| calibrator.test.cjs | 75/75 | 75/75 | 79/79 | 79/79 |
| calibrate-cli.test.cjs | 37/37 | 37/37 | 40/40 | 40/40 |
| calibration-inputs.test.cjs | 101/101 | 101/101 | 101/101 | 101/101 |
| token-backfill.test.cjs | 12/12 | 12/12 | 12/12 | 12/12 |
| tokens-cli.test.cjs | 33/33 | 33/33 | 33/33 | 33/33 |
| token-coverage.test.cjs | 26/26 | 26/26 | 26/26 | 26/26 |
| estimate-cli.test.cjs | 83/83 | 83/83 | 83/83 | 83/83 |
| rename-guard.repo.test.cjs | 25/25 | 25/25 | 25/25 | 25/25 |
| legacy-names.legacy.test.cjs | 6/6 | 6/6 | 6/6 | 6/6 |
| flag-spec.repo.test.cjs | 14/14 | 14/14 | 14/14 | 14/14 |
| doc-refs.repo.test.cjs | 17/17 | 17/17 | 17/17 | 17/17 |

pass/tests. The counts include the describe suites node reports as tests. No file in the set was missing. Also run
after Task 2: `help.test.cjs` and `help-delegation.test.cjs`, 34/34.

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (full, scratch HOME, watcher-shell.test.cjs excluded) | `node --test` over the `npm test` globs | 1 (2 known failures, same as BASE) | PASS: no new failures |

Full suite, 411 files, `HOME=<scratchpad>/home-q41`, `watcher-shell.test.cjs` excluded:

| Run | tests | suites | pass | fail | skipped |
|---|---|---|---|---|---|
| BASE (`3d23c8f9`) | 12869 | 2125 | 12840 | 2 | 27 |
| Final (`7983bacd`) | 12883 | 2129 | 12854 | 2 | 27 |

+14 tests (q41-1 to q41-14) and +4 suites (the four new describes), nothing else. The two failures are the known ones
at BASE, objective 76/77 records, being fixed in quick 42, and they were not touched here:
- `requirements-agreement`: `11. no satisfied requirement is missing from every SUMMARY of its objective`
  (suite `requirements-completed agrees with VERIFICATION in this repository`)
- `validate-requirements`: `9. this repository (read-only): validate requirements finds nothing`
  (suite `validate requirements: the read-only form for one objective or all`)

## Step 2: default path is byte-identical on real data

The BASE tree (`git archive BASE plugins/aoforge/aoforge`) and HEAD each ran `calibrate --paths
/Users/justin/dev/aoforge-claude --root /Users/justin/.claude/projects --window 10 --minutes trd_level --through 66`
(real HOME, `--out` in the scratchpad), back to back. `cmp` printed nothing: **identical**. Both have sha256
`c91fc2e135e11df8891598dbf58ac40f165038a519ef5fafa1149d5a8d3b2025` and `inputs_digest`
`sha256:a7624a716af0a3fd612b408559e6bb6121453e237cab355dec739eae2af0f00f`. Both report overhead planner 8,
job-checker 7, verifier 7, with 22 matched of 589 spawns.

## Step 3: the live recalibration

- **Backup:** `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/calibration.backup-q41.json`
  (the path the orchestrator named; the job's `q41/calibration.pre-q41.json` was not used). The scratchpad is
  session-scoped, so these figures are the durable record.
- **Before (2026-10-08 file):** sha256 `f4d1ffa9e83276f195870fe51e39148003a8c83ceef2523a2c84847a8fc28134` (equal to
  the backup and to the older `scratchpad/calibration.backup.json`), `inputs_digest`
  `sha256:90dff7e9a38f0e4b66db873f2a668270ccc8a3ff764f078e3884e540c2faaac0`.
- **Dry run** (`--also-root /Users/justin/dev/devflow-claude`, frozen method, explicit `--out` to the live path):
  matched 164 of 589 spawns (foreign 377, quick 48, unreadable 0). That is planner 49, job-checker 44, verifier 53,
  objective-researcher 11, integration-checker 5 and roadmapper 2, with 75 TRDs, 177 tasks and 72 with tokens. Every
  floor is met (>= 127; 36/32/41/11/5/2; 75/177/72), and the planner's simulation gave the same 164.
- **After:** sha256 `e8d76a2687e0ea19b3403060b3cf7c982f96dc8fb0fa93934c0a058820ea88a1`, `inputs_digest`
  `sha256:c44d02f791a25e542513794db11582d3f7d4da01d5c067f250cdfffaed944dfd`, `method`
  `{"also_roots":["/Users/justin/dev/devflow-claude"],"minutes":"trd_level","through_objective":66,"window_objectives":10}`.
  `estimate task --class code_tdd --raw` printed `Task code_tdd: 4 min (P90 9 min) · tokens 4.0M in / 26K out · $0.90
  (P90 $1.57) · n=85, confidence high`. The second write reported `unchanged`.
- **Project label:** `sources[0].project` changed from `devflow-claude` to `aoforge-claude` (basename of the main
  root), as the job predicted. Overhead samples carry the same new label.
- **Decomposition:** `scratchpad/model-rates.old.json` and `cd6bbbc5^:references/model-rates.json` both differ from
  the backup's `models` by one entry, `claude-haiku-5-5` (as_of 2026-10-16). So the decomposition was priced with
  `q41/model-rates.backup.json`, built from the backup's own `models` and `model_aliases`. Its `models` deep-equal the
  backup's.

### Overhead, old against new

Cells: samples / minutes p50 / cost_usd p50 / cost_usd p90.

| Agent | Backup (2026-10-08, 2026-10-05 rates, 127 spawns) | Current root only (no alias, current rates) | Alias, backup rates (decomposition) | Live: alias, current rates |
|---|---|---|---|---|
| planner | 36 / 23.2 / $6.8052 / $11.2531 | 8 / 24.1 / $9.8326 / $15.5691 | 49 / 24.1 / $7.1934 / $15.2542 | 49 / 24.1 / $7.1934 / $15.2542 |
| job-checker | 32 / 0.7 / $0.2130 / $1.5977 | 7 / 1.6 / $0.5683 / $1.7978 | 44 / 0.7 / $0.2340 / $1.6838 | 44 / 0.7 / $0.2066 / $1.5977 |
| verifier | 41 / 2.5 / $0.4414 / $1.7374 | 7 / 2.4 / $0.4496 / $2.7308 | 53 / 1.9 / $0.3743 / $1.7634 | 53 / 1.9 / $0.3134 / $1.7634 |
| objective-researcher | 11 / 6.7 / $1.8358 / $3.2655 | 0 / — / — / — | 11 / 6.7 / $1.8358 / $3.2655 | 11 / 6.7 / $1.3988 / $3.2655 |
| integration-checker | 5 / 2.1 / $0.2859 / $1.5718 | 0 / — / — / — | 5 / 2.1 / $0.2859 / $1.5718 | 5 / 2.1 / $0.2433 / $1.5718 |
| roadmapper | 2 / 1.5 / $0.3153 / $0.4854 | 0 / — / — / — | 2 / 1.5 / $0.3153 / $0.4854 | 2 / 1.5 / $0.2895 / $0.4318 |

| Field | Backup | Current root only | Alias, backup rates | Live |
|---|---|---|---|---|
| agent_overhead_sources | spawns 513, matched 127, foreign 347, quick 39, unreadable 0 | spawns 589, matched 22, foreign 519, quick 48, unreadable 0 | spawns 589, matched 164, foreign 377, quick 48, unreadable 0 | spawns 589, matched 164, foreign 377, quick 48, unreadable 0 |
| sources[0].project | devflow-claude | aoforge-claude | aoforge-claude | aoforge-claude |
| rates_as_of | 2026-10-05 | 2026-10-16 | 2026-10-05 | 2026-10-16 |
| claude-sonnet-5-5 cache_read | 0.2 | 0.1 | 0.2 | 0.1 |
| inputs_digest | sha256:90dff7e9… | sha256:a7624a71… | sha256:f759a542… | sha256:c44d02f7… |

How to read it: going from backup to decomposition (same rates) shows the effect of the new spawns since 2026-10-08,
37 more matched. Going from decomposition to live (same spawns) shows the Sonnet 5.5 cache-read repricing to 0.05x
input. The repricing lowers the Sonnet-heavy agents' p50 (verifier $0.3743 to $0.3134, objective-researcher $1.8358 to
$1.3988). The planner runs on Opus, so it is unchanged. The full table is in
`/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/q41/report.md`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Decomposition rates file**
- **Found during:** Task 3, Step 3
- **Issue:** Neither suggested old-rates source deep-equals the backup's `models`. Both include `claude-haiku-5-5`.
- **Fix:** A rates file was built from the backup's own `models`/`model_aliases` and checked deep-equal before use.
- **Files modified:** scratchpad only
- **Commit:** none (no repo change)

**2. Backup path.** The orchestrator's constraint named `scratchpad/calibration.backup-q41.json`. That path was used in
place of the job's `scratchpad/q41/calibration.pre-q41.json`.

**3. Task 3 order.** Steps 2 and 3 (the measurements) ran before the docs commit, so the CHANGELOG went in once with
the measured figures. No follow-up figures commit was needed.

**4. Not run:** `quick summary` (the orchestrator said not to). The draft is left for the orchestrator to publish and
commit. `tokens stamp quick-41 --draft <draft>` exits 1 (`invalid TRD id "quick-41"`; it takes `<objective>-<NN>`
only), so the draft has no token fields.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 7/7. Matcher rule with a non-existent root; project root unchanged, with `PLANNING_DIR_NAMES`
  and tokens untouched; default bytes (`cmp`) and the three-key method; `also_roots` sorted, de-duplicated and in the
  digest, with a note and an unchanged rerun; usage errors exit 1 and write nothing; live rebuild over every floor,
  backed up with both sha256 values; full suite shows no new failures and the diff adds no 8080.
- Gate failures: none new. The full suite has the two failures already present at BASE (above).
- `git diff BASE --stat` lists exactly the 14 `files_modified`. `git diff BASE -G 8080` is empty.

## Follow-up candidate

`tokens` has the same blind spot. Re-measured today (read-only, the planner's `q41/sim-exec.cjs`):
`indexExecutorTranscripts` identifies 53 executor transcripts for `/Users/justin/dev/aoforge-claude` and 367 for the
former root (306 by REPO_ROOT, 58 by cwd, 3 by worktree), out of 1233. A `tokens --also-root` could reuse
`repoMatcher(root, { alsoRoots })` unchanged. Only the executor index and the tokens CLI would need the option threaded
through.

## Self-Check: PASSED

- Commits found: 4dab0068, 634ff914, 8a435742, dc1452b7, 7983bacd (`git log --no-walk`).
- The 14 modified files are in `git diff BASE --stat`, and no other file is.
- Live calibration: version 3, `method.also_roots` `["/Users/justin/dev/devflow-claude"]`, `trd_level`, window 10,
  through 66, matched 164, and all six agents sampled.
- Backup present: `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/calibration.backup-q41.json`
  (sha256 f4d1ffa9…8134).
