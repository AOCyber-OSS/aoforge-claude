---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "06"
subsystem: testing
tags: [eval81, test-c, codebase-mapper, project-researcher, grader, fixtures, go]

requires: []
provides:
  - "scripts/eval81/fixtures/C/synthetic.cjs: buildSynthetic(dir), syntheticFiles(), minimalAoforge({title, paragraph}), SYNTHETIC_FACTS, SYNTHETIC_PROJECT, FLEET_PROJECT, COMMITS, AUTHOR"
  - "checklists-synthetic.json: 41 mapper items (tech 11, arch 11, quality 11, concerns 8 incl. 6 seeded), each with file + RegExp evidence"
  - "fleet-commitment.json: alias fleet-go-service, source_commit, sha256 of the private checklist, items_per_focus {tech 12, arch 12, quality 11, concerns 11}"
  - "researcher-topic.md (Domain / Project title / Project summary sections) and checklists-researcher.json (stack 10, features 11, architecture 11, pitfalls 11)"
  - "grader-prompt.md ({{TASK}}, {{CHECKLIST}}, {{DOCUMENT}}) and grader-schema.json (items[{id, verdict found|wrong|missing, evidence}], fabrications[{claim, why}])"
  - "private/.gitignore (tracked) keeping private/fleet-checklists.json untracked"
affects: [81-11-batch-spec-grader-and-scorer-c, 81-13-rehearsal-and-preregistration-freeze, 81-18-live-batch-c-mapper-researcher]

tech-stack:
  added: []
  patterns:
    - "Fixture repos as string literals materialised into mkdtemp with a local deterministic git helper (fixed author/dates, GIT_CONFIG_GLOBAL=/dev/null)"
    - "Checklist evidence = {path, pattern (RegExp, m flag), absent?}; a directory path matches entry names"
    - "Private content committed only as a sha256 commitment; ignore rule '*' + '!.gitignore'"

key-files:
  created:
    - scripts/eval81/fixtures/C/synthetic.cjs
    - scripts/eval81/fixtures/C/checklists-synthetic.json
    - scripts/eval81/fixtures/C/fleet-commitment.json
    - scripts/eval81/fixtures/C/researcher-topic.md
    - scripts/eval81/fixtures/C/checklists-researcher.json
    - scripts/eval81/fixtures/C/grader-prompt.md
    - scripts/eval81/fixtures/C/grader-schema.json
    - scripts/eval81/fixtures/C/proofs.test.cjs
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/.gitignore
  modified: []

key-decisions:
  - "Synthetic .aoforge/config.json inlines the full 3.1.0 config template plus the stamp: a minimal config left migration 0001 pending, so the SessionStart upgrade hook would rewrite and commit config.json inside a mapper run"
  - "The same minimal planning tree is exported as minimalAoforge(FLEET_PROJECT) so 81-11 prepares the fleet copy identically; FLEET_PROJECT's paragraph is neutral and says nothing about the private code"
  - "Concerns checklist marks the six specified defects seeded: true and adds two inherent ones (SSRF, non-atomic write) to reach the 8-item floor; path traversal and the counter race were confirmed empirically in a scratch probe"
  - "Per-task commits instead of the TRD's single Task 3 commit (executor contract: one task, one commit); the Task 3 commit carries the TRD's message"

patterns-established:
  - "Proof tests skip, never fail, when Go is absent or the private file is not on the machine"
  - "Strings a guard scans for are built in pieces or from LEGACY so the proof file does not match itself"

requirements-completed: [SC-2]

verification:
  gates_defined: 2
  gates_passed: 2
  auto_fix_cycles: 1
  tdd_evidence: false
  test_pairing: true

duration: 25min
completed: 2026-10-17
tokens_input: 31184881
tokens_output: 164831
tokens_cache_read: 30840483
tokens_cache_write: 344138
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 06: Test C fixtures Summary

**Deterministic stdlib-only Go `linkcheck` service with 41 evidence-proved mapper items (six seeded defects, two confirmed by probe), a hash-committed private checklist for one pinned fleet Go repo (46 items, sha256 86f909f5…), a version-drift-proof research topic with 43 items over four dimensions, and a blind found/wrong/missing grader prompt and schema, all proved by a 10-case test.**

## Progress
- [x] Task 1: Synthetic codebase builder and its checklists — de7b47d4
- [x] Task 2: Fleet clone and private checklists, researcher topic and checklists, grader prompt and schema — fc7b34cd
- [x] Task 3: Proof test and commit — 3ee315db (rename-guard fix 7392fd37)

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-17T16:16:33Z
- **Completed:** 2026-10-17T16:41:00Z
- **Tasks:** 3
- **Files modified:** 9 tracked (plus 1 untracked private file)

## Accomplishments
- `buildSynthetic(dir)` materialises `example.com/linkcheck` (go 1.23, stdlib only): five commits with a fixed author and dates, so two builds share a HEAD (`95ff619a…` on this machine). It is gofmt-clean, `go build`, `go vet` and `go test` pass offline, `planning draft` works in it and `upgrade --check` reports up to date.
- Six seeded defects as specified: `http.Get` with no timeout; an unvalidated id joined into a path (probe: `GET /checks/..%2Fsecret` returned 200 with a file outside the data dir); an unsynchronised `completed++` (probe under `-race`: DATA RACE, 16 of 20 increments kept); `defer f.Close()` on a written file; no tests in `internal/api`; `// TODO: rate limit` with no limiter. The probes were scratch-only and were never committed.
- Fleet: read-only clone of `/Users/justin/dev/aoedge` at `d125b8f0c60a917adeb0f825582bb00187311c57`, `origin` removed, `.planning/` removed (`.claude/` is not tracked at that commit), minimal `.aoforge/` added. Four checklists (12/12/11/11) were written by hand from the code only, and every one of the 46 evidence patterns matches the prepared clone. The source HEAD and porcelain are byte-identical before and after (`cmp` exit 0).
- Researcher: the fixed topic plus a PROJECT summary, and 43 items that cite their basis (fsnotify README, SQLite FTS5/WAL docs, the Go release policy and so on). No item pins a version.
- Grader: placeholders appear exactly once each, the prompt names no model, and it returns JSON only. The schema uses only core keywords (no `$schema`), so structured output accepts it.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Synthetic builder + checklists | `node -e "...buildSynthetic(d)..."` (TMPDIR under scratchpad) prints `.aoforge,.git,.github,.gitignore,Dockerfile,Makefile,README.md,cmd,go.mod,internal` | 0 | PASS |
| 1: (extra) | `gofmt -l`, `go vet ./...`, `go test -race ./...` in the build (offline env) | 0 | PASS |
| 2: Fleet + researcher + grader | `git check-ignore -v .../private/fleet-checklists.json` reports `private/.gitignore:1:*` | 0 | PASS |
| 2: (source untouched) | `cmp source-head-before.txt source-head-after.txt`; `cmp source-porcelain-before.txt source-porcelain-after.txt` | 0 | PASS |
| 2: (evidence) | scratch `check-evidence.cjs` on fleet clone `{"total":46,"bad":0}` and synthetic build `{"total":41,"bad":0}` | 0 | PASS |
| 3: Proof test | `node --test scripts/eval81/fixtures/C/proofs.test.cjs`: 10 pass, 0 fail, 0 skip | 0 | PASS |
| 3: (skip paths) | case 4 with `PATH=/usr/bin:/bin`: skipped "go is not on PATH"; case 5 with the private file moved aside: skipped "private fleet checklist not present on this machine" | 0 | PASS |
| 3: (commit) | `git log --stat 8ba149b6..HEAD -- .../private`: only `private/.gitignore`, ever | 0 | PASS |

## Task Commits

1. **Task 1: Synthetic codebase builder and its checklists** - `de7b47d4` (test)
2. **Task 2: Fleet commitment, researcher topic and checklists, grader prompt and schema, private/.gitignore** - `fc7b34cd` (test)
3. **Task 3: Proof test** - `3ee315db` (test), then `7392fd37` (fix: rename guard)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `node --test scripts/eval81/fixtures/C/proofs.test.cjs` | 0 | PASS (10/10) |
| test | `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs` | 0 | PASS (25/25, after fix 7392fd37) |
| test (extra) | `node --test 'plugins/aoforge/**/*.repo.test.cjs'` | 0 | PASS (307/307) |
| test (extra) | `node --test 'scripts/**/*.test.cjs'` | 0 | PASS (299/299) |
| leak scan | `rg -n -i -e aoedge -e aocybersystems scripts/eval81` | 1 (no match) | PASS |

The full `npm test` suite was not run; the scoped gates above cover every file this TRD touches.

## Post-TRD Verification

- **Auto-fix cycles used:** 1 (rename guard)
- **Must-haves verified:** 5/5 truths, 5/5 artifacts, 1/1 key_link (proofs.test.cjs checks the sha256 against fleet-commitment.json)
- **Gate failures:** rename-guard case 2 failed once on a legacy planning-dir literal in proofs.test.cjs and was fixed in 7392fd37

## TDD Exceptions

Task 3 carries `TDD-EXCEPTION`: fixture builders and reference checklists are test infrastructure, and the proofs are their tests.

## Files Created/Modified
- `scripts/eval81/fixtures/C/synthetic.cjs` - builder, deterministic git helper, minimal 3.1.0 planning tree, SYNTHETIC_FACTS (read from the checklist file)
- `scripts/eval81/fixtures/C/checklists-synthetic.json` - mapper checklists per focus with evidence and accept_any
- `scripts/eval81/fixtures/C/fleet-commitment.json` - hash, counts and alias only
- `scripts/eval81/fixtures/C/researcher-topic.md` - fixed topic, title and PROJECT summary
- `scripts/eval81/fixtures/C/checklists-researcher.json` - four dimension checklists with basis
- `scripts/eval81/fixtures/C/grader-prompt.md` - blind grader template
- `scripts/eval81/fixtures/C/grader-schema.json` - grader structured-output schema
- `scripts/eval81/fixtures/C/proofs.test.cjs` - test list 1-9 plus 1b
- `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/.gitignore` - `*` then `!.gitignore`

## Decisions Made
- The config template is inlined (see key-decisions): it pins the fixture and keeps `upgrade --check` up to date. Proof 1b asserts this only while the plugin is 3.1.0, so a later release does not fail CI.
- An `absent: true` evidence form and a directory-path form were added so that "no require directive" and "no tests in internal/api" are proved by the pattern, not just asserted.
- `syntheticFiles()`, `minimalAoforge()` and `FLEET_PROJECT` were exported beyond the two named exports. 81-11 needs them to prepare the fleet copy the same way and for the mechanical path check.
- Case 6 scans the C directory in JS rather than with `rg`, so it runs in CI without ripgrep.
- Case 4 also runs `go test ./...` and `gofmt -l`, a superset of the specified build and vet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Minimal config left migration 0001 pending**
- **Found during:** Task 1
- **Issue:** With only `mode`, `depth`, `planning` and the stamp, `upgrade --check` reported 0001 pending (missing template sections). In a run the SessionStart upgrade hook would then rewrite and commit config.json.
- **Fix:** Inlined the full 3.1.0 `templates/config.json` plus the stamp. `upgrade --check` now reports "up to date (v3.1.0)".
- **Files modified:** scripts/eval81/fixtures/C/synthetic.cjs
- **Verification:** proof 1b
- **Committed in:** de7b47d4

**2. [Rule 1 - Bug] Legacy planning-directory literal tripped the rename guard**
- **Found during:** Task 3 (gate re-run after the commit made the file tracked)
- **Issue:** proofs.test.cjs spelled the legacy planning directory in the expected `prepared` array.
- **Fix:** The name is now built from `LEGACY.planningDir` / `NAMES.planningDir` (legacy-names.cjs).
- **Files modified:** scripts/eval81/fixtures/C/proofs.test.cjs
- **Verification:** rename guard 25/25, proofs 10/10
- **Committed in:** 7392fd37

**3. [Protocol] One commit per task**
- The TRD's Task 3 names one commit for all C files. Following the executor contract, Tasks 1 and 2 committed their own files and Task 3 committed the proof test with the TRD's message. `private/.gitignore` was therefore tracked before Task 3. The TRD's pre-commit `??` check became: `ls-files` shows it tracked, and `!!` shows the checklist ignored.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 1 protocol
**Impact on plan:** Both fixes were needed for correctness; there was no scope creep.

## Issues Encountered
- `validate health` on the synthetic build reports E003/E004 (no ROADMAP.md/STATE.md). The TRD specifies a minimal tree (config + PROJECT.md), the state of a brownfield repo before planning, and `planning draft` works in it. Record this for 81-11 if a run needs a healthy tree.
- `.claude/` is not tracked at the fleet commit. `prepared` keeps the TRD's three strings, and `prepared_notes` in the private file says the removal is a no-op.

## Hand-off: the private checklist does not travel with the merge
`private/fleet-checklists.json` is untracked and ignored, so merging this branch delivers `private/.gitignore` but not the checklist. 81-11 expects it at `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/fleet-checklists.json` in the checkout that runs batch C. After the merge, when the ignore rule is in place in the main checkout, copy it from this worktree or from the durable scratch copy `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81/fleet/fleet-checklists.json`. Copying it before the merge would leave it unignored in a public repository. Its sha256 must equal `86f909f54de3ea4f95933be99d6eb23da932435b8bb6da71c5be63cd4be05115`, and proof 5 checks this.

## User Setup Required

None. No external service configuration is required.

## Next Objective Readiness
- 81-11 can consume every fixture. The prepared fleet clone stays at `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81/fleet/aoedge` (scratch; 81-11 re-prepares its own under the eval root).
- Blocker for 81-11 until resolved: the private file hand-off above.

## Self-Check: PASSED

- FOUND: all 9 tracked files under scripts/eval81/fixtures/C/ and private/.gitignore; FOUND (untracked, ignored): private/fleet-checklists.json
- FOUND commits: de7b47d4, fc7b34cd, 3ee315db, 7392fd37 (`git log --oneline 8ba149b6..HEAD`)
- sha256 of the private file equals the commitment (proof 5 and `shasum -a 256`); fleet source HEAD and porcelain unchanged (`cmp` exit 0)

---
*Objective: 81-haiku-eval-and-model-efficiency-measurement*
*Completed: 2026-10-17*
