---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "14"
subsystem: testing
tags: [eval, live, batch-a, verifier, haiku, sonnet, ledger, post-hoc]

requires:
  - objective: 81-haiku-eval-and-model-efficiency-measurement (TRD 81-13)
    provides: "frozen harness and manifest, pinned trees, ledger at $0, batch A dry run"
provides:
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.json: batch A scored (verifier, haiku and sonnet, 18/18 each) with the spend block that rebuilds the ledger"
  - ".aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.md and results/A-spotcheck.md (6/6 agree)"
  - "Post-hoc 1: init-tools check relaxed for CLI 2.1.302 naming (Agent=Task, Grep/Glob through Bash, Edit with Write)"
  - "Post-hoc 2: batch caps A 10, B 10, D 5, E 55 (C remainder >= $20); C decisions frozen (fleet backup moved out of R, project-researcher, negated claims exempt from the path check)"
affects: [81-15, 81-16, 81-17, 81-18, 81-19]

tech-stack:
  added: []
  patterns:
    - "Pilot through a shim batch dir that only reorders the frozen module's descriptors (no run-id selection in the runner)"
    - "Cap sizing by replaying the planned order from the real ledger through ledger.cjs under multiples of the pilot cost"

key-files:
  created:
    - scripts/eval81/lib/runner-tools.test.cjs
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.json
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/A-spotcheck.md
  modified:
    - scripts/eval81/lib/runner.cjs
    - scripts/eval81/lib/ledger.cjs
    - scripts/eval81/lib/ledger.test.cjs
    - scripts/eval81/score/C.cjs
    - scripts/eval81/score/C.test.cjs
    - scripts/eval81/run.test.cjs
    - scripts/eval81/README.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-18-live-batch-c-mapper-researcher-TRD.md
    - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json

key-decisions:
  - "The init-tools check accepts CLI 2.1.302's naming (Agent=Task, Grep/Glob served by Bash, Edit allowed with Write); any other mismatch still exits 6 (post-hoc 1, user: relax, re-run)"
  - "The stopped first run was re-keyed to A-A1-haiku-r1@attempt1 (spend kept) and re-run as attempt 2"
  - "Batch caps resized from the pilot: A 10, B 10, D 5, E 55, C remainder; A estimate 3 (post-hoc 2)"
  - "C decisions frozen: R/fleet and R/d-capture moved to scratchpad/eval81-private-backup; research dimensions use project-researcher; the mechanical path check exempts negated claims"
  - "Batch A: haiku and sonnet both at the ceiling (detection 9/9, false pass 0/9, false fail 0/9); haiku costs 1/14 of sonnet"

patterns-established:
  - "A frozen-file change after the first live run: test-first, prereg --write with the recorded command, 81-PREREG section 9 entry quoting the user, token scan, commit, prereg --check"

requirements-completed: []

verification:
  gates_defined: 3
  gates_passed: 3
  auto_fix_cycles: 0
  tdd_evidence: true
  test_pairing: true

duration: 29min
completed: 2026-10-17
tokens_input: 30025781
tokens_output: 119171
tokens_cache_read: 29364045
tokens_cache_write: 661476
token_model: "claude-opus-5-5"
tokens_source: "live"
---

# Objective 81 TRD 14: Live batch A (verifier) Summary

**Batch A ran live: 36 of 36 verifier runs ok for $2.69. Haiku 5.5 matched Sonnet 5.5 at the ceiling (9/9
detection, 0/9 false passes, 0/9 false fails each) at 1/14 of the cost. Two post-hoc harness amendments, both
user-approved and re-frozen, got it there.**

## Progress
- [x] Task 1: Confirm spend for batch A — fed02550
- [x] Task 2: Run batch A live — 66e12f62 (with post-hoc 1 in 14963158 and post-hoc 2 in 7c10fdab)
- [x] Task 3: Score, spot-check and commit batch A — fa8a8d21

## Performance

- **Duration:** 29 min (18:17:00Z to 18:46:04Z), including two pauses for user decisions.
- **Batch A wall time:** 18:17:18Z to 18:44:21Z. Summed run wall time: haiku 440 s, sonnet 341 s.
- **Tasks:** 3 of 3.
- **Spend:** $2.691417 of $100 (batch A cap $10).

## User gate decisions (2026-10-17)

1. "go A" as a pilot: 4 runs, 2 Haiku and 2 Sonnet, on different fixtures, at least one planted fixture per model.
2. Resize the batch caps from the pilot's charged cost, so that A and B complete 36 and D 24, with $100 and the
   reserve rule kept, order A, B, D, E, C. Freeze the C decisions (a), (b) and (c).
3. Run the remaining 32 only if A <= $15 and A+B+D+E projected <= $80.
4. Score A, commit, stop before B.

After the first run's exit 6: **"relax, re-run" (1 + 2a)**.

## Task 1 checks

| Check | Result |
|---|---|
| `prereg.cjs --check` | exit 0, 84 files, 438d80f9... |
| token file | present (`test -s` only) |
| dry run A | exit 0: 36 runs, caps $44.2287, reserves $55.285884, estimate $5, batch cap $7.50, order ok, ledger $0 |

## Pilot

The runner has no run-id selection, and A's first four runs are all clean fixtures. So a shim
(`scratchpad/eval81-pilot-batch/A.cjs`) re-exported the frozen `batches/A.cjs` and moved four ids to the front.
Descriptors were unchanged: the dry run through the shim showed the same caps and reserves.

| Run | Model | Fixture | Verdict | Correct | Reported | Charged | First turn | Tools | Isolation / denials |
|---|---|---|---|---|---|---|---|---|---|
| A-A1-haiku-r1 (attempt 1) | haiku | A1 clean | passed | yes | $0.01111496 | $0.011115 | 25,030 | **mismatch, exit 6** | clean / 0 |
| A-A1-haiku-r1 (attempt 2) | haiku | A1 clean | passed | yes | $0.0058233 | $0.005823 | 25,030 | ok (Grep, Glob via Bash; Agent via Task) | clean / 0 |
| A-A2-sonnet-r1 | sonnet | A2 clean | passed | yes | $0.1527673 | $0.152767 | 25,037 | ok | clean / 0 |
| A-A4-haiku-r1 | haiku | A4 planted (stub) | gaps_found, named | yes | $0.01084129 | $0.010841 | 25,030 | ok | clean / 0 |
| A-A5-sonnet-r1 | sonnet | A5 planted (missing file) | gaps_found, named | yes | $0.1440126 | $0.144013 | 25,034 | ok | clean / 0 |

- **Isolation on every run:** a sandbox project dir, no real `~/.claude/projects` entry, nothing under R's key. No
  escape attempts. Tripwire diff empty.
- **First-turn input:** about 25.0K tokens, below the 36K the caps assume.

## Resized caps and projection (post-hoc 2)

- **Pilot means:** haiku $0.00926 (n 3), sonnet $0.14839 (n 2).
- **New batch caps:** A $10, B $10, D $5, E $55, C the remainder. A's estimate is now $3. Per-run caps and the reserve
  rule are unchanged.
- **Completes all runs up to:** A 3.2x the pilot (it was 2.15x), B 3.0x (was 1.55x), D 1.65x 81-10's upper end (was
  0.9x).
- **Projected at pilot cost:** A $2.85, B $2.84, D $2.88, E $44, C $28, total $80.56. A+B+D+E is $52.56, and its caps
  sum to $80, so C keeps at least $20.
- **Gate met:** A <= $15 and A+B+D+E <= $80. The remaining 32 ran.

## Batch A result (results/A.json)

| Metric | haiku | sonnet |
|---|---|---|
| runs scored / planned | 18/18 | 18/18 |
| detection | 9/9 (Wilson 70.1-100%) | 9/9 (70.1-100%) |
| false_pass | 0/9 (0-29.9%) | 0/9 (0-29.9%) |
| false_fail | 0/9 | 0/9 |
| abstain | 0/18 | 0/18 |
| detected_unnamed | 0/9 | 0/9 |
| evidence-flagged / judgment-only detection | 6/6, 3/3 | 6/6, 3/3 |
| cost | $0.18 (mean $0.009919 per run) | $2.50 (mean $0.138986 per run) |
| mean wall | 24.4 s | 18.9 s |

- **Excluded:** none.
- **Spend block:** `spent_usd` 2.691417 equals the ledger's batch A; status complete; 37 entries, including
  `A-A1-haiku-r1@attempt1`.
- **Largest overshoot:** $0.
- **Transcript cost above reported:** only by rounding, at most 4.8e-7.
- **Spot-check:** 6 of 6 agree (seed 81: A6-sonnet-r3, A5-haiku-r2, A5-haiku-r1, A3-haiku-r1, A1-sonnet-r1,
  A2-sonnet-r3).
- **The A gate:** Haiku has 0 false passes, and the gate is established (18/18 scored, 9 planted).
- **Ceiling:** both models are at the ceiling on every A metric, so A does not discriminate between them. 81-19
  should report this beside the metric.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Gate | `prereg.cjs --check` (OK), `test -s <T>` (present), `run.cjs --batch A ... --dry-run --materialize none --raw` | 0 | PASS |
| 2: Batch A live | `run.cjs --batch A --root <R> --token-file <T> --raw`: 32 run, 0 pending, ledger batch A `complete`, `tripwire.diffs` [] | 0 | PASS |
| 3: Score and commit | `score.cjs --batch A --root <R> --out <O>`; A.json spend 2.691417 = ledger; commit scan printed nothing; `prereg --check` OK before and after; `git show --stat HEAD` = the three result files (fa8a8d21) | 0 | PASS |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (eval81) | `TMPDIR=<scratch> node --test 'scripts/eval81/**/*.test.cjs'`: 477/477 after post-hoc 2 (474/474 after post-hoc 1) | 0 | PASS |
| repo guards | `node --test 'plugins/aoforge/**/*.repo.test.cjs' 'scripts/**/*.repo.test.cjs' plugins/aoforge/hooks/planning-writes.audit.test.js`: 372/372 | 0 | PASS |
| prereg | `prereg.cjs --check`: OK, e5cb3963... (84 files) | 0 | PASS |

With the default TMPDIR (`/var/folders`, a symlink), two `prereg.test.cjs` path assertions fail. That is an
environment artefact, and 81-13 avoided it the same way: they pass with TMPDIR in the scratchpad.

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED (post-hoc 1) | `node --test scripts/eval81/lib/runner-tools.test.cjs`: 0/11 | 1 | FAIL (correct) |
| GREEN (post-hoc 1) | same: 11/11 | 0 | PASS (correct) |
| RED (post-hoc 2, caps) | `node --test scripts/eval81/lib/ledger.test.cjs`: 17b fails | 1 | FAIL (correct) |
| GREEN (post-hoc 2, caps) | same: 14/14 | 0 | PASS (correct) |
| RED (post-hoc 2, negation) | `node --test scripts/eval81/score/C.test.cjs`: 8g, 8h fail | 1 | FAIL (correct) |
| GREEN (post-hoc 2, negation) | same: 19/19 | 0 | PASS (correct) |

## Task Commits

1. **Task 1** — `fed02550` (chore): the gate record and the first run's exit 6, as a SUMMARY checkpoint.
2. **Post-hoc 1** — `14963158` (fix): relaxed init-tools check, its tests, README, PREREG 9.1 and the re-frozen
   manifest (be06f165...).
3. **Post-hoc 2** — `7c10fdab` (docs): batch caps, the C negation exemption, DECISION-RULE section 9, PREREG section
   5 and 9.2, README, the 81-18 note and the re-frozen manifest (e5cb3963...).
4. **Task 2** — `66e12f62` (chore): batch A live, as a SUMMARY checkpoint.
5. **Task 3** — `fa8a8d21` (docs): `docs(81-14): batch A verifier results`, exactly the three result files.

## Decisions Made

- The pilot was selected with a shim batch dir rather than a runner change, because the frozen module stays the
  source of every descriptor.
- The relaxed tools check applies one rule set to agent frontmatter and to `--tools` lists, so B's job-checker (no
  Write) still fails on Edit and C's grader (`--tools ""`) still fails on any optional tool.
- Caps were sized at about 3x the pilot for A and B. D is sized on 81-10's upper end because D is unmeasured, and the
  four caps sum to exactly $80. B's projection uses A's per-run costs as its proxy, so it should be re-checked at the
  B checkpoint.
- The quoted user text in DECISION-RULE section 9 replaces the private fleet's name with "[fleet]".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pilot run selection by a shim batch dir**
- **Found during:** Task 2
- **Issue:** The runner has no run-id selection, and A's first four planned runs are all clean, which fails the
  user's "a planted fixture per model".
- **Fix:** A shim batch dir outside the checkout re-exports the frozen `batches/A.cjs` and changes only `order`. It
  was used for the pilot only; the remaining 32 ran from the frozen module.
- **Files modified:** none in the repo

**2. [Rule 3 - Blocking] `run.test.cjs` asserted the old A estimate**
- **Found during:** post-hoc 2
- **Fix:** It now asserts `ledgerLib.BATCH_ESTIMATES.A`. This is a test, not frozen.
- **Commit:** 7c10fdab

### User-approved post-hoc deviations (frozen files changed after the first live run)

**Post-hoc 1 — init-tools check relaxed** (14963158). The first live run, `A-A1-haiku-r1`, ran correctly as the
verifier. The runner still exited 6, because CLI 2.1.302 lists `Read, Write, Bash, Task, Edit` for a frontmatter of
`Read, Write, Bash, Grep, Glob, Agent`.
- On the user's "relax, re-run", `checkTools` now accepts Agent=Task, Grep and Glob when Bash is listed, and Edit
  when Write is declared. It was written test-first.
- The entry was re-keyed to `@attempt1` with its $0.011115 kept, and batch A reopened with
  `--reopen --reason "relaxed init-tools check (user 2026-10-17)"`.

**Post-hoc 2 — caps and C decisions** (7c10fdab). These are as directed: `BATCH_CAPS`, `BATCH_ESTIMATES.A`, the `score/C.cjs`
negation exemption, and DECISION-RULE section 9. `R/fleet` and `R/d-capture` moved to
`scratchpad/eval81-private-backup/`, and `<R>/ledger.json` rows A, B and D were updated with no entry touched.

---

**Total deviations:** 2 auto-fixed (blocking) and 2 user-approved post-hoc amendments.
**Impact on plan:** Batch A ran as pre-registered, except for the tools check (now more permissive in three named
ways) and the batch cap (A $10, not $7.50). Neither touches how A is scored.

## Findings for the user

1. **A is at the ceiling for both models.** It confirms the gate (0 Haiku false passes) but cannot separate the
   tiers on detection. B, D and C carry the comparison.
2. **Haiku is about 14x cheaper per verifier run** on these fixtures ($0.0099 vs $0.139). Both are far below their
   caps, at 2% and 7%.
3. **The real batch costs** (A $2.69 against a $5 estimate) leave more room for E and C than the 81-13 projection
   assumed.
4. **D is still unmeasured.** Its $5 cap completes at up to 1.65x the 81-10 upper end. Check it on D's first runs.
5. **B's tools check:** the job-checker declares `Read, Bash, Glob, Grep`. If the CLI adds Edit to it as it did for
   the verifier, B's first run will exit 6 again. That would be a real mismatch to report, not one to relax
   silently.

## Post-TRD Verification

- **Auto-fix cycles used:** 0.
- **Must-haves verified:** 5 of 5 truths.
  1. The user's go is recorded, with the gate checks shown.
  2. The amendments followed the ordered procedure and are labelled post-hoc, because they came after the first
     live run.
  3. 36 runs ran under the ledger, isolation and tripwire clean.
  4. A.json and A.md carry n and the spend block; the spot-check is 6/6.
  5. The token scan printed nothing on every commit, and `prereg --check` passes.
- Also verified: 1 of 1 artifact and 1 of 1 key link (ledger spend = A.json `spend.spent_usd`).
- **Gate failures:** none.
- **Real home, fleet and checkout:**
  - nothing was written to `~/.claude` or any fleet repo;
  - the checkout was not edited while a runner was running (the tripwire was clean on every run);
  - `amp` was left untracked;
  - nothing was pushed, tagged or released;
  - no port was opened.
- **Batch B:** not started.

## Next Objective Readiness (81-15)

- Ledger: $2.691417. A is complete. B, D, E and C are pending.
- Caps: B $10, D $5, E $55, C remainder.
- B needs the user's own go.

## Self-Check: PASSED

- FOUND: `results/A.json`, `results/A.md`, `results/A-spotcheck.md`, `scripts/eval81/lib/runner-tools.test.cjs`
  (`git ls-files`).
- FOUND commits: fed02550, 14963158, 7c10fdab, 66e12f62, fa8a8d21.
- FOUND: `R/ledger.json` batch A `complete`, spent $2.691417; `R/tripwire/A-after.json`; the runner exited 0 with
  `tripwire.diffs` [].
- `prereg.cjs --check` exits 0 at HEAD (e5cb3963...).
