---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "13"
type: standard
wave: 3
depends_on: ["81-08", "81-09", "81-10", "81-11", "81-12"]
files_modified:
  - scripts/eval81/prereg.cjs
  - scripts/eval81/prereg.test.cjs
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json
autonomous: true
requirements: [SC-1, SC-2]
must_haves:
  truths:
    - "The two plugin trees exist as detached worktrees under the eval root (3.0.0 = v3.0.0 b4a9d870, 3.1.0 = this branch's HEAD, whose plugins/ is unchanged since the objective started) and trees.json pins both SHAs"
    - "A dry run of every batch (A, B, D, E, C) completes with zero API calls, materialises the first run of each batch (runtime mirrored into a sandbox HOME for both trees, fixtures built, D's work-dir path and C's prepared fleet copy checked), and prints the projected spend against the $100 ledger"
    - "A fake-claude rehearsal in a separate rehearsal root drives every batch through runner, collect, score CLI and both report renderers end to end"
    - "81-PREREG.md and results/prereg-manifest.json record the sha256 of every frozen file (fixtures, answer keys, checklists including the private one's commitment, grader prompt and schema, decision rule, batch modules, scorers, harness), the tree SHAs, `claude --version`, the calibration file's sha256 and the projection; `prereg.cjs --check` verifies the manifest and every live TRD runs it first"
    - "The full test suite passes"
  artifacts:
    - path: scripts/eval81/prereg.cjs
      provides: "prereg --write / --check"
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md
      provides: "the pre-registration record, committed before the first live run"
  key_links:
    - from: scripts/eval81/prereg.cjs
      to: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json
      via: "sha256 per frozen file"
      pattern: "prereg-manifest.json"
---

# TRD 81-13: Rehearsal and pre-registration freeze

<objective>
Prove the whole pipeline works without spending anything, then freeze it: create the two plugin trees, initialise
the ledger, dry-run every batch, rehearse every batch end to end with the fake claude, record a hash manifest of
everything the live runs and scoring depend on, and commit it before the first live run.

Purpose: SC-1 (dry run with no API call) and SC-2 (fixtures and answer keys committed before the first live run,
now pinned by hash). After this TRD the remaining work is the five spending batches and the report.
Output: trees, ledger and dry-run records in the eval root; `prereg.cjs`; `81-PREREG.md`; the manifest. No live call.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Runner CLI (81-08): `node scripts/eval81/run.cjs --batch <X> --root <R> --token-file <T> [--dry-run]
[--materialize none|first|all] [--init-ledger] [--claude-bin <path>] [--stop-after N] [--raw]`; exit codes 0, 2, 3,
4, 5, 6. Score CLI (81-02): `node scripts/eval81/score.cjs --batch <X> --root <R> --out <objective dir>` and
`--report`. Batch modules 81-09..81-12 under `scripts/eval81/batches/`.

Paths:
- `R` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81`
- `T` = `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval-auth/oauth-token`
- rehearsal root `R2` = `.../scratchpad/eval81-rehearsal`
- objective dir `O` = `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement`
</codebase_examples>

<anti_patterns>
- Never run the real `claude` binary in this TRD: every live-mode invocation passes `--claude-bin
  scripts/eval81/__fixtures__/fake-claude.cjs` and uses `R2`, never `R`.
- Never read or print the token: presence is `test -s <T>` (exit status only).
- The 3.1.0 tree must be the plugin as it stood when objective 81 began: if `git diff 10f9365f HEAD --
  plugins/` is not empty, stop and report (a plugin change would mean the measured 3.1.0 is not the released tree).
- One plain command per Bash call. Never port 8080.
</anti_patterns>

<error_recovery>
- `git worktree add` fails because the path exists: inspect it; if it is a stale worktree from an earlier attempt,
  `git worktree prune` and retry; never delete a directory you did not create in this TRD.
- A dry run exits non-zero: the message names the batch and the step; fix the owning module with a test first (the
  owning TRD's file), commit as a deviation, re-run.
- The rehearsal's fake outputs are not real agent outputs, so most rehearsal scores are abstain/excluded: that is
  expected; the rehearsal proves the plumbing, not the metrics.
</error_recovery>

</embedded_context>

<context>
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-08-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-09-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-10-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-11-SUMMARY.md
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-12-SUMMARY.md
@scripts/eval81/README.md
</context>

<gotchas>
- The dry run is allowed out of order (81-08 test 3); it never changes batch statuses in the ledger.
- `--materialize first` writes one materialised run dir per batch under `R/runs/<X>/`; those ids stay pending for the
  live run (dry_run is never done), and the runner moves an existing dir aside before a live attempt.
- Worst-case spend (sum of all caps) exceeds $100 by design; the ledger, not the caps sum, keeps the total under
  $100. The projection reports both and the per-batch estimates (A 5, B 4, D 2, E 44, C 28 = 83).
- The manifest includes the private fleet checklist only as its sha256 (equal to fleet-commitment.json); it never
  copies its contents.
</gotchas>

## Test list (prereg.cjs)

1. `--write --out <dir>` hashes every file under the given include globs (sorted, relative paths) plus extra named
   files, and writes `prereg-manifest.json` `{created_at, head, trees, claude_version, calibration_sha256, files:
   {path: sha256}}`.
2. `--check` exits 0 on an unchanged tree and 1 naming each changed, added or missing file.
3. Binary files (PNGs) hash by bytes; a one-byte change is reported.
4. A path outside the repo is refused unless listed as an extra named file (the private checklist and the
   calibration file).

<tasks>

<task type="auto">
  <name>Task 1: Trees, ledger and dry run of every batch</name>
  <files>(eval root only; no repo files)</files>
  <action>
Steps, one plain command each:
1. `git diff --stat 10f9365f HEAD -- plugins/` must be empty (else stop, report).
2. Create the trees through the harness: `node -e "require('./scripts/eval81/lib/sandbox.cjs').ensureTrees({repo:
   process.cwd(), root: '<R>', refs: {'3.0.0': 'v3.0.0', '3.1.0': '<HEAD sha>'}})"`; confirm `R/trees.json` and that
   each tree's `plugins/aoforge/.claude-plugin/plugin.json` version is 3.0.0 / 3.1.0.
3. `test -s <T>` (presence only).
4. `node scripts/eval81/run.cjs --batch A --root <R> --token-file <T> --dry-run --init-ledger --materialize first --raw`;
   then the same without `--init-ledger` for B, D, E, C in that order. Keep each JSON.
5. For the materialised first runs check: A/B/C/E sandbox homes have `.claude/aoforge/.plugin-version` equal to their
   tree; D's work dir equals the path baked into its prompt; C's `R/cache/C/fleet-prepared` has no `.planning/` or
   `.claude/`; E's fixture builds. Record `claude --version`.
Write the projection (per batch: runs, sum of caps, estimate; overall estimate 83 vs the $100 cap) into the scratch
file `R/projection.json` for Task 3.
  </action>
  <verify>All five dry runs exit 0; `R/ledger.json` total is 0 and every batch is `pending`; `git worktree list` shows the two trees under R.</verify>
  <done>Trees pinned, ledger initialised at $0, every batch dry-run with its first run materialised and checked.</done>
  <recovery>If mirrorRuntime fails for the 3.0.0 tree (an older sync-runtime contract), read that tree's hook, adapt mirrorRuntime with a test in 81-08's file (deviation), and re-run.</recovery>
</task>

<task type="auto">
  <name>Task 2: Fake-claude end-to-end rehearsal</name>
  <files>(rehearsal root only)</files>
  <action>
In `R2` (fresh): copy `R/trees.json` (it holds absolute worktree paths, so R2 reuses the same trees). For each batch in order A, B, D, E, C: `node scripts/eval81/run.cjs --batch <X> --root <R2> --token-file
<a scratch dummy token file with a random value> --claude-bin scripts/eval81/__fixtures__/fake-claude.cjs
--raw` (add `--init-ledger` on A only). Fake runs take seconds, so each batch runs to completion and the order rule
holds naturally; run them in the background if the whole set exceeds a few minutes. Run C twice (agents, then
graders). Then `node
scripts/eval81/score.cjs --batch <X> --root <R2> --out <R2>/out` for each batch and `--report --out <R2>/out`; confirm
`<R2>/out/81-HAIKU-EVAL.md`, `<R2>/out/81-MEASUREMENT.md` and `results/*.json` exist. Scan R2 for the dummy token with
scanForSecret: only the dummy token file itself may contain it.
  </action>
  <verify>Each batch's rehearsal exits 0 (or 3 only if a cap was deliberately tiny); both reports render; the secret scan finds no run dir hit.</verify>
  <done>The full pipeline ran end to end on fakes for all five batches; any defect found was fixed test-first in its owning file and listed as a deviation.</done>
  <recovery>If a batch's collect cannot handle a fake run with no real outputs, make it return an empty output with a reason (never throw), with a test, in the owning file.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Pre-registration manifest, record and full suite</name>
  <files>scripts/eval81/prereg.cjs, scripts/eval81/prereg.test.cjs, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json</files>
  <action>
RED first per test list 1-4 for `prereg.cjs` (`--write --out <O>/results [--extra <file>...]` and `--check
--manifest <file>`; include globs `scripts/eval81/**` minus tests and `__fixtures__/fake-claude.cjs`,
`<O>/81-DECISION-RULE.md`; extras: the private fleet checklist and `~/.claude/aoforge/calibration.json`, hashed
read-only). Then run `--write` with `trees` from `R/trees.json` and `claude_version` from Task 1. Write `81-PREREG.md`:
what is frozen and why, the head SHA, tree SHAs, claude version, calibration sha256, the projection table, the
rehearsal outcome, the dry-run run counts (A 36, B 36, D 24, E 10, C 48 + 48 graders), and the rule that each live
TRD starts with `prereg.cjs --check` and that any later change to a frozen file is a recorded post-hoc deviation.
Run the full suite (`npm test` globs from `git ls-files` minus `watcher-shell.test.cjs`). Commit with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "test(81-13): freeze objective 81 pre-registration manifest" --files scripts/eval81/prereg.cjs scripts/eval81/prereg.test.cjs <O>/81-PREREG.md <O>/results/prereg-manifest.json`.
  </action>
  <verify>`node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json` exits 0 after the commit; the full suite passes.</verify>
  <done>Manifest and record committed; check passes; suite green.</done>
  <recovery>If the full suite has failures outside scripts/eval81, compare with the base commit 10f9365f (run the same failing file there in a `git archive` copy under the scratchpad); pre-existing failures are recorded, new ones are fixed before committing.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/</test>
<test>npm test (git ls-files globs minus watcher-shell.test.cjs on this machine)</test>
</validation_gates>

<verification>
- `R/ledger.json` total 0.00, all batches pending; `R/trees.json` pins b4a9d870... and the HEAD SHA.
- No real `claude` process ran in this TRD (every live-mode command named the fake binary).
- `git log --oneline -1 -- .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-PREREG.md` is the last commit before any live TRD.
</verification>

<success_criteria>
Everything the live batches and the scoring depend on exists, has been exercised end to end at zero cost, and is
pinned by a committed hash manifest that every live TRD checks first.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-13-SUMMARY.md`
</output>
