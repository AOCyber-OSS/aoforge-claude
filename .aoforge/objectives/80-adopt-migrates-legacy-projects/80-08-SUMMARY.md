---
objective: 80-adopt-migrates-legacy-projects
trd: "08"
subsystem: adopt
tags: [adopt, simulated-run, fresh, brownfield, regression, workflow]

requires:
  - objective: 80-adopt-migrates-legacy-projects
    provides: "TRD 80-05 workflow and skill edits (migrate path) and TRD 80-06 assertion fixture (adopt-e2e-assert snapshot/compare/check)"
provides:
  - "3.1.0 regression proof that /aoforge:adopt still routes a fresh and a git-init-only directory to new-project with nothing changed"
  - "3.1.0 regression proof that a brownfield repo goes through the whole unattended pipeline into one commit on aoforge/adopt with the checker green, and that a second run routes to upgrade"
affects: [80-09]

tech-stack:
  added: []
  patterns:
    - "an agent follows workflows/adopt.md verbatim against fixture repositories with a throwaway HOME and TMPDIR"

key-files:
  created: []
  modified: []

key-decisions:
  - "No code or workflow text was changed: the run found no defect that cost the fresh or brownfield path anything, so no test-first fix and no fixture rebuild were needed"
  - "Two wording ambiguities in workflows/adopt.md (migrate-path paragraphs whose later sentences are not scoped) are recorded as advisories for the text's owner, not edited here"

patterns-established:
  - "Simulated-run template: setup, snapshot, follow the workflow with the declared substitutions, compare/check, record deviations"

requirements-completed: [SC-4]

verification:
  gates_defined: 3
  gates_passed: 3
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: true

duration: 8min
completed: 2026-10-17
tokens_input: 8405735
tokens_output: 57337
tokens_cache_read: 8254500
tokens_cache_write: 151101
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 80 TRD 08: Simulated /aoforge:adopt on a fresh and a brownfield repository under 3.1.0 Summary

**Following `workflows/adopt.md` verbatim under 3.1.0, a fresh repository and a git-init-only directory both stop at the `new-project` route byte-identical, a brownfield Node CLI is mapped, inferred, scaffolded and reported into one commit (`6616b86`) on `aoforge/adopt` with all 13 checker checks green, and a second run routes to `upgrade` and re-scaffolds nothing; the migrate-path edits from TRD 80-05 cost this run no skipped, reordered or misread step.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-17T07:51:12Z
- **Completed:** 2026-10-17T07:59:00Z
- **Tasks:** 2 of 2
- **Files modified in this repository:** 1 (this SUMMARY; no code or workflow text changed)

## Progress
- [x] Task 1: Fresh and bare repositories through /aoforge:adopt — 1edee692
- [x] Task 2: Brownfield through /aoforge:adopt, re-run, SUMMARY — (this commit)

## Paths

`<S>` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`

| Item | Path |
|---|---|
| Work area | `<S>/80-08/` |
| Fixture home (`HOME` for every fixture command) | `<S>/80-08/home` |
| Fixture `TMPDIR` | `<S>/80-08/tmp` |
| Fresh (empty fixture, one commit) | `<S>/80-08/fresh` (snapshot `fresh-before.json`) |
| Bare (`git init` only, unborn) | `<S>/80-08/bare` (snapshot `bare-before.json`) |
| Brownfield (`node-cli`, 6 files) | `<S>/80-08/brownfield` (post-adopt snapshot `brownfield-adopted.json`, checker JSON `brownfield-check.json`) |
| aof-tools used for every fixture run | `/Users/justin/dev/.df-worktrees/aoforge-claude/80-08-fresh-brownfield-simulated-run/plugins/aoforge/aoforge/bin/aof-tools.cjs` (3.1.0, waves 1-4) |

## Routes and step results (Task 1)

| Fixture | Command | Result |
|---|---|---|
| fresh | `adopt preflight` | exit 0, route `new-project`, message "no source code yet", repo_state `greenfield`. Workflow stopped there; `begin` never ran. |
| bare | `adopt preflight` | exit 0, route `new-project` (greenfield beats no-commits), `git.unborn: true`. Workflow stopped there. |
| fresh | `adopt-e2e-assert compare --before fresh-before.json` | exit 0, `{"ok":true,"changed":[]}` |
| bare | `adopt-e2e-assert compare --before bare-before.json` | exit 0, `{"ok":true,"changed":[]}` |
| fresh | `git branch --list aoforge/adopt` | prints nothing |

## Brownfield step log (Task 2)

Preflight reported `brownfield` for the node-cli fixture (`is_scratch_dir: false`, so the `/private/tmp` location did not make it `scratch`).

| Step | Command (fixture `--cwd`, `HOME`, `TMPDIR` as above) | Result |
|---|---|---|
| resolve_target | target path exists | ok |
| preflight | `adopt preflight` | exit 0, route `adopt`, "ready to adopt (brownfield)", 4 code files, javascript |
| begin | `adopt begin` | exit 0, `created_branch: true`, branch `aoforge/adopt`, base `main` @ `e0022a4` |
| skill marker | `skill-active --start adopt` | exit 0, marker in the fixture `.aoforge/` |
| map | `init map-codebase`, then 8 drafts (`planning draft codebase/<NAME>.md`) written by hand, then 8 sequential `doc put codebase/<NAME>.md --from <draft>` | all exit 0. Task tool not used (declared fallback). Draft sizes: STACK 54, INTEGRATIONS 57, ARCHITECTURE 64, STRUCTURE 64, CONVENTIONS 67, TESTING 73, PATTERNS 82, CONCERNS 51 lines (all over the 20-line floor). Secret-pattern scan: no hit. |
| generate_claude_md | wrote the versioned `<!-- AOFORGE:START v=2 src=claude-md -->` block to `CLAUDE.md` (none existed) | ok |
| infer_project | `planning draft PROJECT.md`, wrote it (`kind: cli`, `default_work: feature`), `doc put PROJECT.md --from`; wrote `.aoforge/.adopt-inferences.json` | exit 0, 15 entries (14 here plus the `stack verify` finding added later) |
| scaffold | `adopt scaffold` | exit 0. Created `STATE.md`, `ROADMAP.md`, `STACK.md`; CLAUDE.md `unchanged`; upgrade applied 0001, 0003 with a backup under the FIXTURE home. |
| confirm_stack_profile | probe for `mcp__gopls__*` / `mcp__dart__*` (absent, not a Go/Dart repo), then `stack verify --run --raw` | exit 0: `lint resolved run=0`, `test resolved skipped=not-included`, other keys `skipped=no-command`. One `low` finding appended to the inferences file. |
| health | `validate health --raw` | exit 0, `status: healthy`, no errors, no warnings, so no `--repair` |
| report | `adopt report` | exit 0, `report_path .aoforge/ADOPT-REPORT.md`, 7 `needs_review` rows, 11 high-confidence rows, 0 redactions, 17 `commit_files`, no `commit_blocked` |
| commit | `skill-active --end` (exit 0), then `commit "chore(aoforge): adopt repository (AOForge v3.1.0)" --files <the 17 commit_files>` | `committed: true`, hash `6616b86` |
| summary | `git rev-parse --short HEAD` -> `6616b86`; needs-review count 7; merge instruction and "Nothing was pushed" | printed per the workflow |

### ADOPT-REPORT.md needs-review rows (field, confidence)

| # | Field | Confidence |
|---|---|---|
| 1 | stack verify: test gate not run | low |
| 2 | stack: unsupported area (node): no tier-2 profile | low |
| 3 | test: npm test, breadth-unknown | low |
| 4 | no command evidence for 'build' | low |
| 5 | default_work = feature | medium |
| 6 | core_value (README is a single heading) | medium |
| 7 | constraint: runtime (no `engines` field) | medium |

No short-document row appeared: every mapper document was over the 20-line floor.

### Checker (default mode), `adopt-e2e-assert check <brownfield> --home <S>/80-08/home`, exit 0

`{"ok": true, ...}` with 13 checks, every one `ok: true`:

| Check | Detail |
|---|---|
| branch_is_adopt | HEAD branch: aoforge/adopt |
| one_commit | commit count since base_sha: 1 |
| tree_clean | clean |
| not_pushed | no upstream; no remote branch contains HEAD |
| health_no_errors | errors: [] |
| stack_valid | ok |
| roadmap_zero_objectives | 0 entries under .aoforge/objectives |
| claude_block_versioned | v=2 src=claude-md |
| stamp_current | stamp version 3.1.0, expected 3.1.0 |
| report_needs_review | heading present; 4 low/medium field(s) accounted for |
| project_kind_valid | kind="cli" default_work="feature" |
| commit_contents | 17 file(s), all under .aoforge/ or CLAUDE.md |
| no_secrets | clean |

The checker was run twice (before and after the re-run below) with an identical result; the first run's JSON is saved at `<S>/80-08/brownfield-check.json`.

### Re-run on the adopted brownfield

| Step | Command | Result |
|---|---|---|
| preflight | `adopt preflight` | route `upgrade`, "already an AOForge project", `repo_state.state: aoforge` |
| upgrade route | `upgrade --check` | `up_to_date: true`, `pending: []`, `pending_confirm: []`, `changed_files: []`. 0012-0014 do not appear in `skipped` because they were retired in 3.1.0 (`lib/upgrade.cjs` `RETIRED_MIGRATIONS`). Nothing to apply or commit, so the route stopped, as the workflow says. |
| nothing re-scaffolded | `adopt-e2e-assert compare --before brownfield-adopted.json` | exit 0, `changed: []` |
| | `git log --oneline --all` | 2 commits before and after (`6616b86`, `e0022a4`) |
| | `.aoforge/` file list | 16 files (8 codebase maps, PROJECT, STATE, ROADMAP, STACK, STACK-REPORT, ADOPT-REPORT, config.json, state.json), identical before and after; `git status --porcelain` empty |

### Real-home comparison

`ls -la ~/.claude/aoforge/backups` before and after: identical line for line (the `.last-prune.json` and `.registry.json` timestamps unchanged, no entry named `brownfield-*`, `fresh-*` or `bare-*`). The scaffold's backup went to `<S>/80-08/home/.claude/aoforge/backups/brownfield-6e9edc0b/2026-10-17T07-55-15-862Z`. No other differences to attribute to other sessions.

## Accomplishments

- Fresh and bare directories route to `new-project`, change nothing and create no branch (SC-4 fresh half).
- Brownfield: mapped, inferred, scaffolded, reported and committed as one change, checker 13/13 (SC-4 brownfield half).
- Re-run on the adopted repo routes to `upgrade` and re-scaffolds nothing.
- Real `~/.claude` untouched.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Fresh and bare through adopt | `adopt-e2e-assert compare` (fresh) and (bare); `git branch --list aoforge/adopt` | 0, 0, prints nothing | PASS |
| 2: Brownfield, re-run, SUMMARY | `adopt-e2e-assert check <brownfield> --home <home>` (13/13 ok); second preflight route `upgrade`; `compare` against the adopted snapshot unchanged; `git status --porcelain` in this repo before the SUMMARY post: empty | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| fresh/bare unchanged | `adopt-e2e-assert compare` x2 | 0 | PASS |
| brownfield checker | `adopt-e2e-assert check` | 0 | PASS |
| workflow text pinned | `node --test adopt-skill-contract.test.cjs` (19 rows incl. fresh-path invariance, row 19) | 0 | PASS (19/19) |

No code was changed, so no wider suite was run; `watcher-shell.test.cjs` was never in play.

## Deviation list: did the migrate-path text (TRD 80-05) cost the fresh or brownfield path anything?

No step was skipped, reordered or misread. Substitutions and notes, in order of the workflow:

1. **Tool copy.** The workflow's `node ~/.claude/aoforge/bin/aof-tools.cjs` was run as the 3.1.0 copy in this worktree (the dispatch said to use it; the TRD text names the main checkout's copy), with `HOME` and `TMPDIR` both pointed into the work area.
2. **Mapper agents.** The Task tool was not used; the workflow's declared fallback was followed (each mapper focus performed in sequence, the same 8 documents).
3. **preflight / resume bullets.** The added migrate text (route `migrate`, migrate `resume`, the three migrate refusals) was not triggered on either route and did not interfere with `adopt` or `upgrade`.
4. **begin.** The paragraph "On the migrate path the command below also moves the planning trees itself ... so do not run `skill-active --start` afterwards. Continue to `scaffold`." sits before the `Run:` block. Read as scoped by its first sentence, it does not apply here; I ran `adopt begin`, then `skill-active --start adopt`, then went on to `map` per the step's closing "Continue to `map`.". See advisory A below.
5. **map, infer_project, confirm_stack_profile, health.** Each opens with "Skip on the migrate path" (health adds a reason); on the adopt route none of them was skipped. All four ran.
6. **scaffold.** The opening migrate paragraph ends "Continue to `report` (skipping `confirm_stack_profile` and `health`); the rest of this step is for the other routes." followed by the shared `Run:` block. Read as migrate-only; the command ran and `confirm_stack_profile` and `health` ran after it. See advisory A.
7. **report.** "On the migrate path, read `commit_blocked` first" is migrate-only; the adopt-route JSON has no `commit_blocked` key at all. `commit_files` was used as printed.
8. **commit.** The paragraph "On the migrate path no skill marker was started, so skip `skill-active --end` ..." is migrate-only; `skill-active --end` ran, then the commit. Its second sentence about an empty `commit_files` / `nothing_to_commit` is not scoped to the migrate path in the text but did not apply (17 files). See advisory A.
9. **summary.** The adopt-route text was used as written. The migrate alternative was not needed.

### Advisories for the text's owner (no defect observed, nothing changed)

- **A. Unscoped sentences in migrate paragraphs of `workflows/adopt.md`.** In `begin` ("Continue to `scaffold`. A `refuse` from it ..."), `scaffold` ("Exit 1 means the move is not finished: stop and report, fix nothing by hand" and "the rest of this step is for the other routes") and `commit` ("An empty `commit_files`, or a result whose `reason` is `nothing_to_commit` ...") only the first sentence of each paragraph names the migrate path. A literal reader could take `begin`'s "Continue to `scaffold`" as unconditional (skipping the skill marker, `map` and `infer_project` on the adopt route), could take `scaffold`'s "Exit 1 ... fix nothing by hand" as overriding the later "fix that one field and retry once" for the other routes, and could read "the rest of this step is for the other routes" as excluding the shared `Run:` block. I read each as migrate-scoped and nothing went wrong, and contract rows 4, 13 and 19 pin the ordering, but starting those sentences with "Migrate path:" would remove the doubt. Repro: read `begin` as written and ask which `Continue to` applies to the adopt route. Owner: TRD 80-05's files (`workflows/adopt.md`), candidate for 80-09.
- **B. The adopt marker stays `in_progress` after the commit** (`adopt preflight` on the re-run still prints `marker.status: in_progress`, `steps` `scaffolded` and `reported` only). Harmless here because the project state `aoforge` wins and the route is `upgrade`; the same shape as 80-03's open item about a finished signal. No change made.

## Deviations from Plan

None. The TRD's setup, substitutions and acceptance commands were run as written (apart from the tool-copy and `TMPDIR` additions in item 1 above, which the dispatch required). No Rule 1-3 fix was needed, so no test-first fix and no fixture rebuild.

## Defects found in objective-80 code

None in `adopt.cjs`, `adopt-cli.cjs`, the upgrade migrations or `managed-block.cjs` on the fresh and brownfield routes.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 4/4 (fresh and bare route to new-project with unchanged snapshots; brownfield ends in one commit on `aoforge/adopt` with the checker green; the re-run routes to `upgrade` and re-scaffolds nothing; the migrate-path text cost the fresh and brownfield paths nothing, see the deviation list)
- Gate failures: None
- Test counts: no code changed; `adopt-skill-contract.test.cjs` 19/19; checker 13/13 (twice)

## Self-Check: PASSED

- FOUND: fixtures and evidence files under `<S>/80-08/` (`fresh`, `bare`, `brownfield`, `home`, `fresh-before.json`, `bare-before.json`, `brownfield-adopted.json`, `brownfield-check.json`)
- FOUND: Task 1 commit `1edee692` in `git log`
- `git status --porcelain` in this repository was empty before this SUMMARY was posted; this SUMMARY is the only file this TRD adds
