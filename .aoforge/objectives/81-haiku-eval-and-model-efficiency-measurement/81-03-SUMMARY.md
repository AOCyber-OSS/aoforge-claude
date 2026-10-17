---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "03"
subsystem: model-eval
tags: [haiku-eval, verifier, fixtures, answer-key, planted-defects, test-a]

requires: []
provides:
  - "scripts/eval81/fixtures/A/build.cjs: FIXTURES, buildFixture(id, dir), describeFixture(id) for six deterministic AOForge 3.1.0 projects A1..A6"
  - "scripts/eval81/fixtures/A/answer-key.json: test A answer key (verdict, planted kind and artifact, must_mention and any_of tokens, evidence flags, health warnings)"
  - "scripts/eval81/fixtures/A/proofs.test.cjs: 37 tests proving each planted gap is real and each clean twin complete"
affects: [81-09, 81-13, 81-14]

tech-stack:
  added: []
  patterns:
    - "fixture repositories live as string literals in a builder and are materialised into a temp dir, never as files under scripts/"
    - "matched clean/planted twins differ only in the planted files; the proof test asserts the exact differing path set"
    - "fixed git identity, dates, messages and env make two builds hash-identical"

key-files:
  created:
    - scripts/eval81/fixtures/A/build.cjs
    - scripts/eval81/fixtures/A/answer-key.json
    - scripts/eval81/fixtures/A/proofs.test.cjs
  modified: []

key-decisions:
  - "Commit author is Project Author, not the spec's Fixture Author: the anti-pattern bans the word fixture anywhere in the materialised repository and the author name is part of it"
  - "Each project ships a full 3.1.0 config.json and a hand-written state.json so upgrade --check reports nothing pending and validate health has no warnings"
  - "evidence_flags is a boolean as specified; evidence_reports (the rollup keys that fired) and twin were added to the key as extra fields"
  - "The standard AOForge config label key for gap-closure objectives is masked in the revealing-word scan: it is identical in all six projects and says nothing about the plant"

requirements-completed: [SC-2]

verification:
  gates_defined: 2
  gates_passed: 2
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: true

duration: 12min
completed: 2026-10-17
tokens_input: 9367523
tokens_output: 100684
tokens_cache_read: 9134310
tokens_cache_write: 233099
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 81 TRD 03: Test A verifier fixtures Summary

**Six deterministic AOForge 3.1.0 verifier fixtures (three domains, each a complete project and a twin with exactly one planted gap: a hard-coded slugify, a Kelvin command never wired into the CLI, a SUMMARY claiming a report module that does not exist), an answer key with match tokens, and 37 passing proofs that every plant is real and every clean twin is whole.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-17T15:54:35Z
- **Completed:** 2026-10-17T16:06:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `buildFixture(id, dir)` materialises A1..A6 as five-commit git repositories (scaffold, plan, implementation, tests, SUMMARY) with a fixed author, dates, messages and environment; two builds give the same tree, history and HEAD hash. The planting is one overlay per twin: A4 replaces `src/slugify.js` and its test, A6 replaces `src/cli.js`, A5 leaves out `src/report.js` and `test/report.test.js`.
- Each clean twin meets its success criteria (`hello-world`, `unicode-text`; `273.15`, `0`; the sorted `tag: count` report), has every SUMMARY key file, TRD artifact and key link, and passes `node --test`. Each planted twin passes its own tests, yet A4 prints `hello-world` for every input, A6 prints usage and exits 1 for `k 0`, and A5 fails `report` with MODULE_NOT_FOUND.
- All six pass this checkout's `validate health` (no errors, no warnings) and `upgrade --check` (up to date v3.1.0). `answer-key.json` records, per fixture, what `verify objective-evidence` reports: A1..A4 nothing; A5 `artifacts_failed` and `missing_key_files`; A6 `key_links_failed`.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Fixture builder for A1..A6 | `node -e "...buildFixture(id, mkdtemp)..." (TMPDIR in scratchpad)` printed `.aoforge,.git,.gitignore,README.md,package.json,src,test` for each id (A3, A5 also `notes.json`) | 0 | PASS |
| 2: Answer key and planted-defect proofs | `node --test scripts/eval81/fixtures/A/proofs.test.cjs` (37 tests, 37 pass, 6.2 s) | 0 | PASS |

## Task Commits

1. **Task 1: Fixture builder for A1..A6** - `9f007856` (feat)
2. **Task 2: Answer key and planted-defect proofs** - `e39e017a` (test)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `node --test scripts/eval81/fixtures/A/proofs.test.cjs` | 0 | PASS |
| rename guard | `node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs` | 0 | PASS |
| stack neutrality (extra) | `node --test plugins/aoforge/aoforge/bin/lib/stack-neutrality.repo.test.cjs` | 0 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in spec] Commit author name**
- **Found during:** Task 1 (writing the git helper)
- **Issue:** The TRD names the author `Fixture Author <author@example.invalid>`, but its own anti-patterns forbid the word `fixture` anywhere in the materialised repository, and `git log` shows the author name.
- **Fix:** The author is `Project Author <author@example.invalid>`. Proof 8 scans commit author, committer and messages for the revealing words.
- **Files modified:** scripts/eval81/fixtures/A/build.cjs
- **Commit:** 9f007856

**2. [Rule 3 - Blocking] A 3.1.0 config and a state sidecar are needed to be current**
- **Found during:** Task 1 verification (`upgrade --check` reported 0001 and 0003 pending, `validate health` W009 and W040)
- **Issue:** The spec's stamp alone leaves a minimal config.json short of the template shape (0001) and no `.aoforge/state.json` (0003).
- **Fix:** Every project carries the full config shape with the spec's stamp (`0001 0004 0007 0009 0012 0013`, 2026-10-01T09:00:00.000Z) and a hand-written `state.json` per planning stage.
- **Files modified:** scripts/eval81/fixtures/A/build.cjs
- **Commit:** 9f007856

**3. [Rule 2 - Missing critical] Extra proofs**
- **Issue:** The test list did not pin that a pair differs only in the planted files, that the SUMMARY text is identical across a pair, or that only the planted command is affected (A5 `list` still works).
- **Fix:** Proof 10 asserts the exact differing path set per pair; proof 6 asserts `list` still works on A5; proof 1 also compares the HEAD hash and checks the tree is fully committed.
- **Commit:** e39e017a

**4. [Decision] Task 2 commit also carries the SUMMARY checkpoint; the builder has its own commit**
- The TRD lists one commit for all three files; the executor contract is one commit per task, so the builder (Task 1) and the key plus proofs (Task 2) are separate commits.

## Notes for downstream TRDs

- `answer-key.json` extra fields: `twin` and `evidence_reports`. A scorer should treat `evidence_flags: true` (A5, A6) as mechanical-assisted detection: the verifier's own `verify objective-evidence` call reports the gap (A5 `artifacts_failed`, `missing_key_files`; A6 `key_links_failed`). A4 (the stub) is not reported mechanically: its artifacts, key link, SUMMARY and tests all pass.
- A5's MODULE_NOT_FOUND text and every Node stack trace carry the absolute path of the directory the repository is built in; the batch runner should build into a neutral directory name so the path does not reveal the test.
- Repository text avoids the words stub, planted, gap, broken, clean, fixture and eval in file contents, paths, commit messages and author. The one exception is the standard config label key for gap-closure objectives, identical in all six projects and masked in proof 8.
- The materialised projects use the TRD/SUMMARY/ROADMAP/REQUIREMENTS shapes of a real 3.1.0 project, so the production verifier prompt (objective directory, goal, requirement ids) resolves against them.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 5/5 (builder determinism and layout; three clean and three planted; planted-gap proofs with clean-twin predicates; health and upgrade; answer key)
- Gate failures: None

## Progress
- [x] Task 1: Fixture builder for A1..A6 — 9f007856
- [x] Task 2: Answer key and planted-defect proofs — e39e017a

## Self-Check: PASSED

- FOUND: scripts/eval81/fixtures/A/build.cjs
- FOUND: scripts/eval81/fixtures/A/answer-key.json
- FOUND: scripts/eval81/fixtures/A/proofs.test.cjs
- FOUND commit: 9f007856
- FOUND commit: e39e017a
