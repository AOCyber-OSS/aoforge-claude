---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "13"
subsystem: testing
tags: [eval, rehearsal, dry-run, preregistration, manifest, sha256, ledger]
---

# Objective 81 TRD 13: Rehearsal and pre-registration freeze Summary

## Progress
- [x] Task 1: Trees, ledger and dry run of every batch — (this commit)
- [ ] Task 2: Fake-claude end-to-end rehearsal — next step: create R2 (scratchpad/eval81-rehearsal), copy R/trees.json, write a random dummy token file, then run `node scripts/eval81/run.cjs --batch A --root R2 --token-file <dummy> --claude-bin scripts/eval81/__fixtures__/fake-claude.cjs --results-dir R2/out/results --init-ledger --raw`
- [ ] Task 3: Pre-registration manifest, record and full suite

## Task 1 notes (eval root only)

- `git diff --stat 10f9365f HEAD -- plugins/` empty.
- Trees: 3.0.0 = v3.0.0 b4a9d87030fbbdfe707514cedbd06601598e4041, 3.1.0 = 99950509d10a9905ff2d845e09df9d6b2e55e455, both detached worktrees under R/trees/, plugin.json versions checked by ensureTrees.
- Dry runs A, B, D, E, C: all exit 0; ledger total $0, every batch pending; E also dry-run with `--materialize all` (both trees mirrored).
- claude --version: 2.1.302 (Claude Code).
- Projection: R/projection.json.
