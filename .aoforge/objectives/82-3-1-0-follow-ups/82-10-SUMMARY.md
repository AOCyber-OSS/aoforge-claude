---
objective: 82-3-1-0-follow-ups
trd: "10"
subsystem: release
tags: [changelog, docs, requirements, todos, revalidation, model-tiers]

requires:
  - objective: 82-3-1-0-follow-ups (TRDs 82-01..82-09, 82-11)
    provides: "the diagnosis and fixes, runtime paths and the guard, P1-P5 applied and measured (82-TIER-CHECKS.md), tokens --also-root, the build-cell re-run (82-MEASUREMENT.md)"
provides:
  - "CHANGELOG [3.1.0] `### 3.1.0 follow-ups (objective 82)` and objective 82 in the intro; USER-GUIDE, AOF-TOOLS-REFERENCE, model-profiles.md, CLAUDE.md and the Flutter pack CHANGELOG state the same facts"
  - "Objective 77's records: STK-01, PCK-01..04 Complete with 77-VERIFICATION cited; Progress row Complete 2026-10-16 (verified 2026-10-17)"
  - "MEF-06 recorded from evidence in REQUIREMENTS.md and 76-VERIFICATION.md: Partial by design"
  - "The five tier todos completed with Resolution evidence; two new pending todos (debugger start tier, P1 revisit)"
  - "79-REVALIDATION.md addendum: integrate/3.1.0 PASS at VALIDATED_SHA 7da7485fdb2137ae60422da82b85b5b8ef47e608"
affects: [79-09, 79-10]

tech-stack:
  added: []
  patterns:
    - "A ROADMAP Requirements line for an objective that only updates another objective's requirement reads `none mapped (...)`, so roadmap-coverage stays single-owner and `objective complete` ticks nothing"

key-files:
  created:
    - .aoforge/todos/pending/2026-10-18-measure-the-debugger-start-tier-mef-06-remaining-half.md
    - .aoforge/todos/pending/2026-10-18-revisit-the-ui-judge-haiku-start-p1-on-a-larger-sample.md
  modified:
    - CHANGELOG.md
    - CLAUDE.md
    - docs/USER-GUIDE.md
    - docs/AOF-TOOLS-REFERENCE.md
    - plugins/aoforge/aoforge/references/model-profiles.md
    - plugins/aoforge-stack-flutter/CHANGELOG.md
    - plugins/eden-ui-web/.claude-plugin/plugin.json
    - .claude-plugin/marketplace.json
    - scripts/eval81/score.test.cjs
    - .aoforge/REQUIREMENTS.md
    - .aoforge/ROADMAP.md
    - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
    - .aoforge/objectives/79-reconcile-and-release-3-1-0/79-REVALIDATION.md
    - ".aoforge/todos/completed/2026-10-17-apply-objective-81-tier-proposal-*.md (5, moved from pending)"

key-decisions:
  - "Objective 82's ROADMAP Requirements line reads `none mapped (MEF-06 stays objective 76's; ...)`: listing MEF-06 made roadmap-coverage fail (duplicate 76/82) and would have let `objective complete 82` tick MEF-06, which is Partial"
  - "eden-ui-web 1.0.1 -> 1.0.2 (plugin.json, marketplace, one CHANGELOG clause): 82-11 changed its skill and brand presets, and the 72-18 sibling patch rule (applied by 79-06 to eden-ui-flutter) bumps a changed sibling; the re-validation then ran again at that commit"
  - "VALIDATED_SHA 7da7485fdb2137ae60422da82b85b5b8ef47e608 (supersedes 9a4b0997); only .aoforge/ paths differ after it"
  - "The web pack CHANGELOG gets no bullet: objective 82 changed no web pack file"

patterns-established: []

requirements-completed: [SC-3, SC-5]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: true

duration: 32min
completed: 2026-10-18
tokens_input: 61719827
tokens_output: 133064
tokens_cache_read: 61318682
tokens_cache_write: 400701
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 82 TRD 10: Docs, records and re-validation Summary

**Objective 82 is documented in CHANGELOG 3.1.0 and the guides, objective 77's records and MEF-06 (Partial by design)
agree with the evidence, the five tier todos are closed (P2, P3, P5 applied; P1, P4 evaluated and reverted by rule),
and integrate/3.1.0 re-validates PASS at VALIDATED_SHA `7da7485fdb2137ae60422da82b85b5b8ef47e608`: full suite
13,773 tests with 0 failures, the node:26 CI gate PASS, and all 19 named guards green.**

## Progress
- [x] Task 0 (dispatch): eval81 score test reads the reverted P1 tier — c4855638
- [x] Task 1: CHANGELOG 3.1.0, guides, reference, CLAUDE.md, pack changelogs, site data — cfa364a5
- [x] Task 2: Objective 77 records, MEF-06 from evidence, the five todos — ae88543b
- [x] Task 3: Re-validate integrate/3.1.0 (79-08's checks) and record the addendum — 7da7485f (eden-ui-web 1.0.2), 402b4e48

## Performance

- **Duration:** about 32 min (12:20Z to 12:52Z)
- **Tasks:** 3 of 3, plus the dispatch's test fix
- **Live API runs:** none

## Objective 82 success criteria (evidence)

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 build-cell token growth found, fixed, re-measured | MET | 82-DIAGNOSIS.md (82-01): planner +67% from 8 extra calls (template hunt, commit inspect/amend, larger TRDs), executor +20% from larger context per call (summary.md and tdd.md reads); fixes P-1..P-4, X-1, E-1, E-2, E-4, E-5 test-first (82-07, `build-cell-reads.repo.test.cjs`); live re-run behind the user's gate and a $25 cap (82-09): 18/18 mechanism checks pass, both builds pass acceptance, tests and verification; planner median tokens 2.21M -> 1.10M and executor 3.33M -> 1.95M against 81's 3.1.0, below 3.0.0's 1.32M / 2.77M (82-MEASUREMENT.md; n=2 against n=2) |
| SC-2 no `~` read instruction; absolute runtime path; guard; sandbox shows no guessed home path | MET | `runtime_root` in every compound init JSON and the `<runtime_paths>` block in 11 core agents (82-02); every scope enforced and 43 spawns carry `AOForge runtime: {runtime_root}` (82-11); `runtime-path-reads.repo.test.cjs` 18/18; guessed_home 0 in both builds (82-09) and the 16 researcher runs (82-08), where three of 81's four build runs had one |
| SC-3 P1-P5 applied as approved, pinned, documented; P1/P4/P5 measured live; five todos completed with evidence | MET (P1 and P4 reverted under their approval's own condition) | 82-03 applied all five test-first (9d8333f8/10311e5c, d25e474f/f95f7b7a); 82-08 measured P1, P4, P5 under the pre-registered 82-CHECK-RULES.md: P1 REVERT (broken_missed 1/13 on d17, which the Sonnet start also missed; accuracy 19/20 vs 18/20, cost $0.13 vs $1.15, escalation 1/20, split 2/20), P4 REVERT (hub HU-A01 lost), P5 KEEP (39/44 vs 42/44, fabrications 0/0); reverts test-first (3732d4c5/22324411, 73b392bd/dd42d22a); pins pass (model-profiles.test.cjs 5/5 for P2-P5, flutter-ui-eval.test.cjs P1-1/P1-2); CHANGELOG, model-profiles.md, USER-GUIDE and the Flutter pack CHANGELOG state each with evidence and caveats (cfa364a5); the five todos completed through `todo complete` with Resolution sections (ae88543b) |
| SC-4 `tokens trd|coverage|backfill --also-root` | MET | 82-04: repeatable, calibrate's matcher, tests first; v1.6 coverage 111/113 with and without the former root; documented in CHANGELOG, USER-GUIDE, AOF-TOOLS-REFERENCE and CLAUDE.md (cfa364a5) |
| SC-5 objective 77 records agree; validators clean; full suite passes | MET | STK-01, PCK-01..04 Complete citing 77-VERIFICATION; Progress row `Complete (verified 2026-10-17, 77-VERIFICATION) \| 2026-10-16`; `validate health` healthy (I001 x2 for 79-09/79-10 only), `validate requirements` agrees (71 objectives, 51 requirements), `validate consistency` passed, roadmap-coverage 41/41; full suite 13,773 / 0 fail (watcher-shell excluded, W-3) |

MEF-06 stays Partial by design: the UI judge's start tier was measured and stays at sonnet, the debugger's start tier is
`todos/pending/2026-10-18-measure-the-debugger-start-tier-mef-06-remaining-half.md`. The checkbox stays `[ ]`.

## Accomplishments

### Task 0 (from the dispatch): the eval81 score test

`scripts/eval81/score.test.cjs` "--report reads the tiers from this checkout and never changes them" asserted 82-03's
P1 state (`ui-evaluator already starts at haiku`), so it failed after 82-08's revert. It now reads the live pack tiers,
asserts they are above haiku on budget and balanced (P1 reverted by 82-08) and expects the report's proposal text.
The test file is outside objective 81's frozen manifest; `prereg.cjs --check` for 81 (86 files) and 82 (25 files) both
print OK before and after. 14/14 in the file pass.

### Task 1: user-facing record

- CHANGELOG `## [3.1.0]`: intro names objective 82 and `tokens --also-root`; new `### 3.1.0 follow-ups (objective 82)`
  with five bullets (runtime paths and the guard; the build-cell fixes by Fix-list id with 82-MEASUREMENT's numbers and
  caveats; P1-P5 as finally kept or reverted with evidence and caveats; `tokens --also-root` with 82-04's coverage;
  objective 77's records and MEF-06). The `~` wording is correct: agents built absolute home paths themselves; the Read
  tool expands `~`, so `~` was not the defect. Quick 41's bullet no longer says `tokens` lacks the flag.
- USER-GUIDE: `tokens ... --also-root` in Estimation data (and calibrate's paragraph points to it); Model Profiles has
  the verdict floor, the focus override table and the UI judge's start tier with P1's measurement, and the stale
  verifier/job-checker budget cells (Haiku) now read Sonnet as model-profiles.json does; Stack packs states that pack
  agent material uses `<runtime>/` and pack skills hand spawns `AOForge runtime: {runtime_root}`; Model Costs Too High
  explains which agents budget keeps on Sonnet and why.
- AOF-TOOLS-REFERENCE: Compound init commands mention `runtime_root` and the spawn line.
- model-profiles.md: P1's split and escalation rates and the d17 caveat with the revisit todo.
- CLAUDE.md: Estimation bullet gains `--also-root`; the Agents paragraph names `<runtime>/<rel>`, `runtime_root` and the
  guard (and drops the stale "tdd.md only for a TDD TRD", which E-2 removed); "Where we left off" gains objective 82's
  outcome. Paid for by trimming the W066 detail (kept in AOF-TOOLS-REFERENCE), a module name, and the stale "this
  machine still holds the pre-rename runtime home" sentence (`~/.claude/devflow` no longer exists). 148 lines /
  19,978 chars.
- Flutter pack CHANGELOG `[1.0.0]`: one bullet for the runtime-path change to pack agent material and the ui-eval
  spawn line.

### Task 2: records

- `requirements mark-complete STK-01,PCK-01..04`: exactly 5 checkboxes and 5 rows; each row then cites
  77-VERIFICATION.md through a draft and `doc put REQUIREMENTS.md`.
- ROADMAP Progress row 77: one `-` and one `+` line.
- MEF-06 in REQUIREMENTS.md and 76-VERIFICATION.md (`verification post 76`, one line, frontmatter untouched).
- Todos: the five tier todos got `## Resolution (objective 82, 2026-10-18)` sections (append-only, numstat `+N 0`),
  were rewritten in place by `todo add --stem` (no stray file) and moved by `todo complete`. New pending:
  `2026-10-18-measure-the-debugger-start-tier-mef-06-remaining-half.md` and
  `2026-10-18-revisit-the-ui-judge-haiku-start-p1-on-a-larger-sample.md` (d17 was missed by both judges in 82-08's
  per-state sessions, while 81's Sonnet caught it beside its baseline: a fixture or judge-prompt question).

### Task 3: re-validation (79-REVALIDATION.md addendum)

Verdict PASS at `7da7485f`; supersedes `9a4b0997`; 197 commits since (fold 4, quick 44 4, objective 81 91, objective 82
79, merges 19); nothing under `.github/` or `hooks/hooks.json` changed.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 0: score test | `node --test scripts/eval81/score.test.cjs` (14/14); both `prereg.cjs --check` OK | 0 | PASS |
| 1: docs | `aof-tools changelog check 3.1.0` (ok); context-budget, doc-refs, rename-guard, changelog-on-tag (82/82); changelog, dispatch-completeness, hook-inventory, stack-neutrality, planning-writes, runtime-path-reads, stack-packs, model-profiles (140/140); `rg -n 'objective 82' CHANGELOG.md` shows the intro (19), quick 41's bullet (272) and the subsection heading (521 at cfa364a5, 522 after 7da7485f) | 0 | PASS |
| 2: records | REQUIREMENTS numstat 11/11 (5 boxes, 5 rows, MEF-06); ROADMAP row diff one line; 5 completed + 1 debugger pending; `validate requirements` agrees, `validate health` healthy, `validate consistency` passed, `validate roadmap-coverage` 41/41; records tests 137/137 | 0 | PASS |
| 3: re-validation | full suite 13,773 / 0 fail / 0 cancelled; node:26 gate PASS; 19 guards; fleet 26/0/24; site data timestamp only; prereg OK x2; changelog gates; release plan; versions; `git status` `?? amp` | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (local) | `xargs node --test < files.txt` over npm test's globs minus watcher-shell (469 files): 13,773 tests, 13,746 pass, 0 fail, 27 skipped, 104.5 s | 0 | PASS |
| test (CI-equivalent) | node:26 Docker, non-root: `node --test scripts/ci-unit-gate.test.cjs` (88/88), `node scripts/ci-unit-gate.cjs` (470 files, 13,806 executed, 0 failures, PASS) | 0 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] roadmap-coverage failed on objective 82's own Requirements line**
- **Found during:** Task 2, step 5
- **Issue:** `validate roadmap-coverage` exited 1 with `duplicate: MEF-06 -> objectives 76, 82` (since objective 82 was
  planned). The same line would have made `objective complete 82` tick MEF-06's checkbox and row, which is Partial.
- **Fix:** objective 82's Requirements line reads `none mapped (MEF-06 stays objective 76's; ...)`, the form objective
  81 uses; coverage 41/41.
- **Files modified:** .aoforge/ROADMAP.md
- **Commit:** ae88543b

**2. [Rule 2 - Missing] eden-ui-web changed without its sibling patch bump**
- **Found during:** Task 3 (release preconditions; sibling diff against `v3.0.0`)
- **Issue:** 82-11 changed `plugins/eden-ui-web/skills/frontend-design/SKILL.md` and `references/brand-presets.md`
  with the plugin still at 1.0.1, so installed copies would keep the old text.
- **Fix:** 1.0.2 in plugin.json and the marketplace entry and one CHANGELOG clause (the 72-18 rule 79-06 applied);
  every re-validation check re-ran at the new commit.
- **Files modified:** plugins/eden-ui-web/.claude-plugin/plugin.json, .claude-plugin/marketplace.json, CHANGELOG.md
- **Commit:** 7da7485f

**3. [Rule 1 - Bug] stale facts in documents the TRD edits**
- USER-GUIDE's model table showed the verifier and job-checker at Haiku on budget (model-profiles.json: Sonnet since
  76-06); CLAUDE.md still said executors read tdd.md for a TDD TRD (E-2 removed it) and that the pre-rename runtime
  home exists on this machine (it does not). Corrected in cfa364a5.

### Other deviations

- **Dispatch additions:** the score test fix (Task 0), the P1 revisit todo, and model-profiles.md's d17 caveat.
- **Web pack CHANGELOG:** no bullet; objective 82 changed no file of `aoforge-stack-web`.
- **Site data:** `gen-docs-data` changed only `generatedAt`, so the file was restored, as 79-08 did.
- **TRD frontmatter `requirements: [SC-3, SC-5, MEF-06]`:** `requirements mark-complete` was not run for MEF-06
  (Partial by design); SC-3 and SC-5 are success criteria, not REQUIREMENTS.md IDs.
- **No 82-VERIFICATION.md** is written here; the SC table above is this TRD's evidence for marking objective 82
  complete.

## Issues Encountered

- 79-09 stays blocked by the org cutover freeze recorded in STATE.md; the addendum names it.

## Discovered commands

None. The commands come from the TRD and 79-08.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 6/6 (CHANGELOG subsection and `changelog check`; 77 records; MEF-06 from evidence; the debugger
  todo cited; five todos with Resolution and moved; validators clean and the addendum with the new VALIDATED_SHA)
- Gate failures: None
- Not done here: no push, tag, PR, release or deploy; no live API run; nothing written to the real `~/.claude`; `amp`
  untouched; no port opened.

## Self-Check: PASSED

- FOUND: CHANGELOG.md `### 3.1.0 follow-ups (objective 82)`; the two new pending todos; five completed tier todos;
  79-REVALIDATION.md `validated_sha: 7da7485fdb2137ae60422da82b85b5b8ef47e608`.
- FOUND commits: c4855638, cfa364a5, ae88543b, 7da7485f, 402b4e48.
- `git diff --name-only 7da7485f HEAD` lists `.aoforge/` paths only.
