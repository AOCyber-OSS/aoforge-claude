---
objective: 82-3-1-0-follow-ups
verified: 2026-10-18T00:00:00Z
status: passed
score: 5/5 must-haves verified
notes:
  - kind: flaky_test
    path: plugins/aoforge/aoforge/bin/lib/merge-driver-cli.test.cjs
    note: "Test 19 failed once in the full run, in fixture cleanup (rmSync ENOTEMPTY on a df-wave temp dir under TMPDIR), which is a teardown race. Rerun alone it passed 3 of 3 (13/13 each time). Objective 82 did not touch it. Advisory."
  - kind: stale_wording
    path: .aoforge/objectives/82-3-1-0-follow-ups/82-08-SUMMARY.md
    note: "The frontmatter `provides:` still says 'P1, P4, P5 applied'. The body, the code and the tests record that P1 and P4 were reverted. Cosmetic."
---

# Objective 82: 3.1.0 follow-ups Verification Report

**Objective Goal:** Close the follow-ups that objectives 79-81 left before 3.1.0 ships: the build-cell token growth, guessed home paths, tier proposals P1-P5, `tokens --also-root`, objective 77's records and MEF-06 from evidence.
**Verified:** 2026-10-18
**Status:** passed
**Re-verification:** No (initial verification)

Branch `integrate/3.1.0` at HEAD eb037099. Checked against the code, tests and committed evidence, not against the SUMMARY claims. No live `claude -p` calls were made. Tests ran with HOME and TMPDIR set to the scratchpad.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A diagnosis names the cause of the build-cell planner (+67%) and executor (+20%) growth with transcript evidence; a fix lands; a live E re-run behind an approval gate and a spend cap shows the effect | VERIFIED | 82-DIAGNOSIS.md names 10 causes from the b30/b31 transcripts (P-1 template hunt, P-2 commit inspect/amend, P-3 TRD size, P-4 tool-source reads, E-1/E-2 whole reads of summary.md/tdd.md, E-4 guessed home, E-5 double write; P-5/X-2 JUSTIFY; E-3 REJECTED). The Fix list and `## Fix applied` table give commits for each row. `build-cell-reads.repo.test.cjs` pins every FIX row (8/8). 82-MEASUREMENT.md: 18/18 mechanism checks pass and gives "SC-1 verdict: effect shown". The user gate "Go D, C, E at cap $25" was given before any spend, and the ledger was raised to $25 (82-08-SUMMARY). |
| 2 | No agent, skill or workflow asks an agent to Read a `~/...` path; agents get an absolute runtime path from init; a repo test fails if one returns; a sandboxed run shows no guessed home paths | VERIFIED | `runtime-path-reads.repo.test.cjs` enforces all seven scopes (agents 12, references 36, skills 32, templates 38, workflows 39, pack material 10, pack skills/workflows 10; 0 offenders; PENDING is empty) and checks 43 spawns for `AOForge runtime: {runtime_root}`. `init execute-objective 82` returns an expanded `runtime_root` under the given HOME. The `~/.claude/aoforge` strings left in agents are shell commands (the shell expands `~`) or `@` includes. Guessed-path verdict PASS on the build runs (82-MEASUREMENT: b82-r1/r2 scanned, all counts 0) and on 16 researcher runs (82-TIER-CHECKS). |
| 3 | P1-P5 carried as the recorded decisions; pinned; documented with evidence and caveats; P1 escalation and P4/P5 quality measured live behind a gate; five todos completed with evidence | VERIFIED | 82-TIER-CHECKS.md: P1 REVERT, P4 REVERT, P5 KEEP. Net diff of model-profiles.json since cc56fce0: P2 `codebase-mapper.arch` sonnet on every tier (arch only; the shared row, tech and quality are unchanged), P3 `concerns` budget sonnet, P5 `pitfalls` budget haiku, P4 `architecture` back to opus/sonnet/sonnet. The Flutter pack manifest has `ui-evaluator` opus/sonnet/sonnet (P1 reverted). Pins pass: model-profiles.test.cjs "objective 82" block, flutter-ui-eval.test.cjs P1-1/P1-2. CHANGELOG 3.1.0 (lines 554-580), model-profiles.md, USER-GUIDE (882-884) and the Flutter pack CHANGELOG state each decision with its numbers. P1 escalation rate measured at 1/20. The five `apply-objective-81-tier-proposal-*` todos are in todos/completed with a `## Resolution` section (ae88543b). |
| 4 | `tokens trd|coverage|backfill --also-root` (repeatable), same matcher as calibrate, tests first, v1.6 coverage with and without | VERIFIED | tokens-cli.cjs uses `token-usage.repoMatcher` `alsoRoots`, the same matcher calibrate uses. RED 0ba40e3b is an ancestor of GREEN a3d34271. The CLI accepts the flag live. 82-04-SUMMARY gives v1.6 coverage of 111/113 both with and without `--also-root /Users/justin/dev/devflow-claude`, and explains why the number does not move. |
| 5 | Objective 77's records agree with 77-VERIFICATION; validators clean; full suite passes (watcher-shell excluded) | VERIFIED | REQUIREMENTS: STK-01 and PCK-01..04 are `[x]`, each row "Complete (77-VERIFICATION)". 77-VERIFICATION is `status: passed`, 5/5. Progress row: "Complete (verified 2026-10-17, 77-VERIFICATION) \| 2026-10-16". MEF-06 is Partial from evidence and the debugger todo is pending. `validate health`: healthy, no errors or warnings (I001 for 79-09/79-10 only). `validate requirements`: agrees (71 objectives, 51 requirements). `validate consistency`: passed. Full suite over npm test's 469 files minus watcher-shell: 13,773 tests, 1 failure, a teardown race in merge-driver-cli test 19 that passed 3/3 rerun alone (see notes). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| 82-DIAGNOSIS.md | VERIFIED | Decomposition, causes, Fix list and Fix applied, with commits |
| 82-MEASUREMENT.md | VERIFIED | Per-role medians, mechanism checks 18/18, guessed-path verdict |
| 82-TIER-CHECKS.md, 82-CHECK-RULES.md | VERIFIED | Rendered by check-rules.cjs from results/D.json and C.json under the pre-registered rules |
| results/{C,D,E}.json/.md, prereg-manifest.json | VERIFIED | `prereg.cjs --check`: objective 81 OK (86 files, 70f92eca...), objective 82 OK (25 files, 817bc181...) |
| model-profiles.json, aoforge-stack-flutter/aoforge-stack.json | VERIFIED | Match the recorded decisions |
| runtime-path-reads.repo.test.cjs, build-cell-reads.repo.test.cjs | VERIFIED | Pass; included in the targeted run |
| tokens-cli.cjs `--also-root` | VERIFIED | Wired to the shared repoMatcher |
| 79-REVALIDATION.md addendum | VERIFIED | PASS at 7da7485f, with objective 82's guards and both prereg checks listed |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| init commands | agent spawns | `runtime_root` -> `AOForge runtime: {runtime_root}` spawn line | WIRED (43 spawns checked) |
| agents | runtime files | `<runtime_paths>` block, `<runtime>/<rel>` | WIRED (test 13) |
| resolve-model | focus tiers / pack manifest | model-profiles.json `focus`, mirrored pack | WIRED (P1-2 runs resolve-model on a mirrored pack) |
| tokens-cli | token-usage.repoMatcher | `alsoRoots` | WIRED |

### Tests run

| Run | Result |
|-----|--------|
| Targeted: model-profiles, flutter-ui-eval, runtime-path-reads, build-cell-reads, tokens-cli, token-backfill, token-usage, calibrate-cli, scripts/eval82 | 405/405 pass |
| Full suite (npm test globs, watcher-shell excluded, 469 files) | 13,773 tests: 13,745 pass, 1 fail (flaky teardown), 27 skipped |
| merge-driver-cli.test.cjs rerun alone x3 | 13/13 each time |
| prereg --check 81 and 82 | OK / OK |
| validate health / requirements / consistency | healthy / agrees / passed |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| 82-08-SUMMARY.md frontmatter | `provides:` says P1, P4, P5 "applied" although P1 and P4 were reverted | Info | None; the body and the code are right |

### Functional Verification

Skipped as a UI drive: the objective changes the CLI, prompts and records. The runtime behaviour was checked with `init` (runtime_root), `tokens coverage --also-root` and `resolve-model` on a mirrored pack (P1-2 test). The live sandboxed runs are recorded evidence from 82-08/82-09. They were not re-run, as the task asked.

### Human Verification Required

None.

### Gaps Summary

No gaps. SC-3's original proposal wording predates the live check. The shipped tiers match the decisions recorded in 82-TIER-CHECKS.md: P2, P3 and P5 are applied, and P1 and P4 are reverted under their pre-registered rules. MEF-06 stays Partial by design: the debugger start-tier todo is pending.

---

_Verified: 2026-10-18_
_Verifier: Claude (verifier)_
