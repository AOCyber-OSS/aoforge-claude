---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "13"
subsystem: testing
tags: [eval, rehearsal, dry-run, preregistration, manifest, sha256, ledger]
---

# Objective 81 TRD 13: Rehearsal and pre-registration freeze Summary

## Progress
- [x] Task 1: Trees, ledger and dry run of every batch — 3da9790a
- [x] Task 2: Fake-claude end-to-end rehearsal — (this commit)
- [ ] Task 3: Pre-registration manifest, record and full suite — next step: GREEN `node --test scripts/eval81/prereg.test.cjs` against the new scripts/eval81/prereg.cjs (RED already observed: MODULE_NOT_FOUND), then `prereg.cjs --write --out <O>/results --extra <O>/private/fleet-checklists.json --calibration ~/.claude/aoforge/calibration.json --trees R/trees.json --claude-version '2.1.302 (Claude Code)' --projection R/projection-manifest.json`, write 81-PREREG.md via `doc put`, run the full suite

## Task 1 notes (eval root only)

- `git diff --stat 10f9365f HEAD -- plugins/` empty.
- Trees: 3.0.0 = v3.0.0 b4a9d87030fbbdfe707514cedbd06601598e4041, 3.1.0 = 99950509d10a9905ff2d845e09df9d6b2e55e455, both detached worktrees under R/trees/, plugin.json versions checked by ensureTrees.
- Dry runs A, B, D, E, C: all exit 0; ledger total $0, every batch pending; E also dry-run with `--materialize all` (both trees mirrored).
- claude --version: 2.1.302 (Claude Code).
- Projection: R/projection.json.

## Task 2 notes (rehearsal root only)

- R2 = scratchpad/eval81-rehearsal, trees.json copied from R, random dummy token in R2/dummy-token; every runner call passed `--claude-bin scripts/eval81/__fixtures__/fake-claude.cjs` and `--results-dir R2/out/results`.
- A 36/36 ok ($4.42296), B 36/36 ok ($4.05), D 24/24 ok ($1.02768), E 10/10 ok ($19.20: opus transcripts price at 2x the fake's TEST_RATES, so the charge is the transcript sum), C 48/48 agents ok ($7.41976); all exit 0, tripwire diffs 0, no escape attempts.
- C second invocation listed 0 graders (the fake writes no document). After seeding stand-in documents into 3 rehearsal records (synthetic mapper, fleet mapper, researcher), the third invocation ran 3 graders (`--tools ""`, `--json-schema`, no plugin, sonnet cap 0.6008): batch went complete -> running -> complete; C total $7.60.
- score.cjs for A, B, D, E, C and `--report`: results/*.json each carry a spend block; 81-HAIKU-EVAL.md (every role INSUFFICIENT, as expected on fakes) and 81-MEASUREMENT.md render.
- Rebuild: `--rebuild-ledger --root R3 --results-dir R2/out/results` gives total $36.30064 = R2's, per-batch spent and status equal, 157 entries with the same ids.
- `--init-ledger` against R2/out/results: exit 2, refused.
- scanForSecret over R2: only `dummy-token`; R3: none.
