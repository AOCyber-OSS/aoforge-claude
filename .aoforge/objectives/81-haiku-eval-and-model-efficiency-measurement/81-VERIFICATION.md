---
objective: 81-haiku-eval-and-model-efficiency-measurement
verified: 2026-10-17T23:59:00Z
status: passed
score: 5/5 must-haves verified
notes:
  - kind: test_portability
    path: scripts/eval81/prereg.cjs
    note: "prereg.test.cjs tests 1 and 2c fail (508/510) when TMPDIR is the macOS default /var/folders/... (a symlink to /private/var). extraLabel() compares the extra's path with the repo path without realpath, so a repo extra is labelled absolute. With a realpath TMPDIR the suite is 510/510. The committed manifest is unaffected (the checkout path has no symlink) and prereg --check passes. Advisory: realpath both sides in extraLabel/isInside."
  - kind: stale_wording
    path: .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
    note: "The frontmatter score line, the requirements_traceability note (MEF-06 SATISFIED) and the closing paragraph still say 76-06/76-08 stay open; the deferred[] entries and the 'Closed by objective 81' addendum say closed and MEF-06 PARTIALLY SATISFIED. The authoritative entries are correct; the older lines are stale."
  - kind: stale_checkbox
    path: .aoforge/REQUIREMENTS.md
    note: "MEF-05's checkbox (line 70) is still [ ] while its traceability row says Complete. validate requirements --objective 76 reports no findings."
  - kind: objective_gate
    note: "npm test: 13612/13641 pass, 1 fail (watcher-shell.test.cjs W-3, fish ShellSession, 600 s timeout under the scratch HOME). Objective 81 changed nothing under plugins/ (git diff 7e9151b7^ HEAD -- plugins/ is empty), so this is environmental or pre-existing, not a gap of this objective. Re-run under the real HOME to confirm."
  - kind: workload_shape
    note: "The E build workload asked for a small 2-TRD build; b30-r2 and b31-r2 planned 1 TRD each. 81-MEASUREMENT.md reports TRDs per run, so this is visible, not hidden."
---

# Objective 81: Haiku eval and model-efficiency measurement Verification Report

**Objective Goal:** Close 76-06 and 76-08 with measured evidence: Haiku 5.5 vs Sonnet 5.5 on seeded fixtures with answer keys committed before any run (A verifier, B job-checker, C mapper/researcher, D UI judge), and the 3.0.0 vs 3.1.0 fixed-workload measurement (E) plus a static resident-prompt comparison, all headless in a throwaway HOME within $100.
**Verified:** 2026-10-17
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Harness runs one agent headless in a sandbox HOME with plugin dir, model, per-run cap and $100 total, records verdict/tokens/cost/wall time; dry-run makes no API call | VERIFIED | `lib/command.cjs` builds `claude -p --model --max-budget-usd --plugin-dir`; `lib/secret.cjs` passes the token only via `CLAUDE_CODE_OAUTH_TOKEN` in an allowlisted env; `lib/ledger.cjs` GLOBAL_CAP_USD = 100, reserve rule, order, batch caps, exit 3 budget stop; `run.test.cjs` "dry run, ledger and order" proves zero spawns. 510/510 eval81 tests pass (realpath TMPDIR; see notes). |
| 2 | Fixtures and answer keys for A-D committed before the first live run; a test proves each planted defect real | VERIFIED | A: A1-A3 clean, A4 stub, A5 missing_file, A6 unwired. B: B1-B2 clean, B3 same-wave overlap, B4 missing verify, B5 later-wave dependency, B6 uncovered criterion. C: synthetic codebase + private fleet checklist committed by sha256 (`fleet-commitment.json`, verified by `prereg --check`) x 4 foci; researcher stack/features/architecture/pitfalls checklists. D: 20 labelled states on 4 surfaces. Proofs in `fixtures/{A,B,C,D,E}/proofs.test.cjs` pass. Keys committed 12:04-12:57 EDT; decision rule e404e0f2 12:00 EDT; manifest frozen 05f93927 13:56 EDT; first live charge 18:17:42Z (14:17 EDT). No fixture or key changed after the freeze. |
| 3 | Runs in order A, B, D, E, C within $100; scored against keys and reported per role with n and intervals | VERIFIED | Ledger entry timestamps: A 18:17-18:44Z, B 19:00-19:09Z, D 19:15-19:19Z, E 19:28-21:14Z, C 21:19-22:33Z. Independent sum of the 203 committed spend entries = $40.052491; `run.cjs --rebuild-ledger` into a scratch root gives the same total; 0 entries charged above their cap. `score.cjs --report` regenerated from results/ matches the generated part of 81-HAIKU-EVAL.md byte for byte (Wilson 95% CIs, n per cell, false-pass/false-fail/detection/false alarms/recall/errors/fabrications/per-state accuracy/escalations). Spot-checks A 6/6, B 5/6 (scorer wording miss, documented), C 6/6, D 4/4. |
| 4 | 76-08 report compares 3.0.0 vs 3.1.0 per role and per run (first-turn input, total tokens, cache writes, cost, wall time, tests, verification) plus static resident bytes | VERIFIED | 81-MEASUREMENT.md: Outcomes, Per role (quick, build) and Per run tables carry every listed column; static resident bytes per spawn from results/static-prompt.json (81-07, 81-STATIC-PROMPT.md); 10/10 runs ok, no flagged runs. |
| 5 | Per-role recommendation follows the pre-registered rule; tier changes are proposals only; 76-06/76-08 recorded; MEF-05/MEF-06 updated | VERIFIED | Outcomes follow 81-DECISION-RULE section 5 (A gate 0/9 Haiku false passes; job-checker -16.7 REFUSE; ui-evaluator exactly -10.0 WEAK_ENDORSE since REFUSE needs more than 10; mapper arch/quality REFUSE on fabrications > +0.5; concerns -13.2 REFUSE; researcher stack INSUFFICIENT). Proposals P1-P5 match section 7. User decision recorded ("P3, P2-arch-only, P1, P4, P5") with 5 follow-up todos in .aoforge/todos/pending/. model-profiles.json and both aoforge-stack.json files have no commit since 2026-10-17 02:03 (before objective 81 began). 76-VERIFICATION deferred[] marks 76-06 closed/met and 76-08 closed/not_met; REQUIREMENTS.md MEF-05 Complete, MEF-06 Partial. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/eval81/run.cjs`, `lib/*.cjs` | runner, ledger, sandbox, tripwire, secret handling | VERIFIED | tested, used for every batch |
| `scripts/eval81/score.cjs`, `score/*.cjs`, `lib/decide.cjs`, `lib/report.cjs` | scorers, rule, report | VERIFIED | regenerates the committed report exactly |
| `scripts/eval81/prereg.cjs` + `results/prereg-manifest.json` | pre-registration freeze | VERIFIED | `--check` OK, 86 files match (sha256 70f92eca...) |
| `scripts/eval81/fixtures/{A..E}` | fixtures, keys, proofs | VERIFIED | counts match SC2 |
| `81-DECISION-RULE.md`, `81-PREREG.md` | rule and amendments | VERIFIED | post-hoc 1-4 in PREREG 9.1-9.4, post-hoc 2 in DECISION-RULE section 9, each labelled post-hoc and dated |
| `results/{A,B,C,D,E}.json`, spot-checks | scored results and spend | VERIFIED | spend blocks sum to $40.052491 |
| `81-HAIKU-EVAL.md` | 76-06 report + Decision | VERIFIED | generated part + labelled hand-written part |
| `81-MEASUREMENT.md`, `81-STATIC-PROMPT.md`, `results/static-prompt.json` | 76-08 report | VERIFIED | |
| 76 records, REQUIREMENTS.md, 5 todos | closure records | VERIFIED | see notes for stale wording |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| answer keys / decision rule | live runs | commit order + prereg manifest | WIRED (keys 12:04-12:57 EDT, manifest 13:56 EDT, first charge 14:17 EDT) |
| results/*.json spend | ledger total | `run.cjs --rebuild-ledger` | WIRED ($40.052491 both ways) |
| results/{A..D}.json | 81-HAIKU-EVAL.md | `score.cjs --report` | WIRED (byte-identical regenerated section) |
| decide() outcomes | proposals | DECISION-RULE section 7 | WIRED |
| proposals | tier files | user decision -> todos only | WIRED, no tier file changed |
| token file | tracked files | `secret.scanForSecret` | No hit in 3,051 tracked files, the objective's history (`git log -p e404e0f2^..HEAD`) or untracked non-ignored files |

### Requirements Coverage

| Requirement | Source | Status | Evidence |
|---|---|---|---|
| MEF-05 (Haiku half) | ROADMAP obj 81 | SATISFIED | 81-HAIKU-EVAL.md; pin stays claude-haiku-5-5 |
| MEF-06 (start-tier half) | ROADMAP obj 81 | Explicitly NOT MET, recorded | P1 approved as a todo, not applied; debugger start tier not measured |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| scripts/eval81/prereg.cjs | 165-174 | path comparison without realpath | Warning | 2 tests fail under a symlinked TMPDIR; no effect on the frozen manifest |
| scripts/eval81/fixtures/C/synthetic.cjs | 169 | `// TODO: rate limit` | Info | planted concern in the synthetic codebase, intended |
| 81-HAIKU-EVAL.md | - | two `## Spend` headings (generated and hand-written) | Info | cosmetic |

### Objective gates

| Gate | Command | Result |
|---|---|---|
| test | `npm test` (HOME and TMPDIR in the scratchpad) | FAIL, 13612/13641 pass, 1 fail: `watcher-shell.test.cjs` W-3 (fish ShellSession) hit the 600 s timeout under the scratch HOME. Not attributable to objective 81: `git diff 7e9151b7^ HEAD -- plugins/` is empty (the objective changed no plugin code). |

eval81 suite (not in the npm test glob): `node --test 'scripts/eval81/**/*.test.cjs'` 510/510 with a realpath TMPDIR, 508/510 with the default macOS TMPDIR (notes).

### Functional Verification

_Skipped: verification.runtime is `none` in STACK.md; no UI. No live `claude -p` call was made during verification._

### Human Verification Required

None.

### Gaps Summary

No gaps. Every success criterion is met by committed evidence that reproduces: the report regenerates exactly, the ledger rebuilds to $40.052491 of $100, the pre-registration manifest checks clean, keys and rule predate the first live charge, amendments are labelled post-hoc, no token is in any tracked file or the objective's history, and no tier file changed. The notes list one test-portability defect and some stale wording in the 76 records, all advisory.

---

_Verified: 2026-10-17_
_Verifier: Claude (verifier)_
