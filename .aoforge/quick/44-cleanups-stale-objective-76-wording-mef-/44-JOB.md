---
objective: quick-44
trd: 01
type: standard
wave: 1
depends_on: []
gap_closure: true
files_modified:
  - scripts/eval81/prereg.test.cjs
  - .aoforge/REQUIREMENTS.md
  - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
  - .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-VERIFICATION.md
  - .aoforge/ROADMAP.md
  - .aoforge/STATE.md
autonomous: true
must_haves:
  truths:
    - "scripts/eval81/prereg.test.cjs passes 12/12 with TMPDIR unset (os.tmpdir() is /tmp, a symlink to /private/tmp), with TMPDIR=/var/folders/j2/r369kq256wd5qg5yn51x376m0000gn/T/ and with the scratch TMPDIR. Every non-test file under scripts/eval81/ is byte-identical to BASE, and `prereg.cjs --check` against the committed manifest prints OK for 86 files with manifest sha256 70f92eca1b291f4296e62c402f37da5e89920f40380bac0666b5625e5b710e81"
    - "76-VERIFICATION.md no longer says 76-06 or 76-08 is open, deferred or awaiting a decision. Its score line, truth rows 5 and 6, Score line, requirements_traceability note, Requirements paragraph, Human Verification, Gaps Summary and closing addendum agree: 76-06 is closed (met); 76-08's measurement is closed and SC6's start-tier half is not met; MEF-05 is SATISFIED and MEF-06 PARTIALLY SATISFIED; P1 is approved as a follow-up todo and not applied. `status: passed` and the deferred[] state fields are unchanged"
    - "76-RETROACTIVE-SUMMARY.md has no 'Still open' section. Its requirements table shows MEF-01 SATISFIED (listed), MEF-05 SATISFIED (listed) and MEF-06 PARTIALLY SATISFIED (not listed). Its prose says five requirements, not four. requirements-completed is still exactly [MEF-01, MEF-02, MEF-03, MEF-04, MEF-05]"
    - "REQUIREMENTS.md: MEF-01..MEF-05 are ticked and the MEF-01..MEF-04 traceability rows say Complete. MEF-05's row text is unchanged. MEF-06 stays unticked, with its Partial row unchanged. No other line changes"
    - "Objective 76 is Complete in ROADMAP.md with the partial named: the checklist line is ticked with '(completed 2026-10-17)'; the Progress row reads `8/8 | Complete (MEF-06 partial) | 2026-10-17`; the 76-07 row no longer says 'pending 76-08'. The ROADMAP diff is exactly these three lines. The STATE.md Milestone line, written by `state update`, says 76 is complete with MEF-06 partial and 81 is complete"
    - "81-VERIFICATION.md's Requirements Coverage no longer claims MEF-05 for objective 81. So `validate requirements` has no findings, `validate health` reports healthy with 0 warnings, and requirements-agreement.repo.test.cjs passes (it fails at BASE). Its three advisory notes (test_portability, stale_wording, stale_checkbox) each carry a `resolved:` line naming quick 44"
    - "The full suite (watcher-shell.test.cjs excluded, scratch HOME/TMPDIR) has 0 failures. `validate consistency` passes and `validate roadmap-coverage` prints 41/41. No tier file changed (model-profiles.json, both aoforge-stack.json). Nothing is pushed, tagged or released, there is no port 8080, and `amp` is untouched"
  artifacts:
    - path: scripts/eval81/prereg.test.cjs
      provides: "world() builds the stand-in repo/home/eval root on the physical temp path, with a comment saying why (prereg.cjs is frozen by the 81 manifest)"
    - path: .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md
      provides: "76 verification wording that agrees with its deferred[] block and objective 81's evidence"
    - path: .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-VERIFICATION.md
      provides: "a coverage row for MEF-05 that names objective 76 as the owner, with no uppercase SATISFIED in any cell"
  key_links:
    - from: "81-VERIFICATION.md Requirements Coverage row MEF-05"
      to: "requirements-agreement.cjs saysSatisfied()"
      via: "case-sensitive /\\bSATISFIED\\b/ over every cell after the ID; the reworded row has none, so W065 clears"
    - from: "REQUIREMENTS.md MEF-01..05 Complete"
      to: "ROADMAP.md objective 76 Complete (MEF-06 partial)"
      via: "the same rule `objective complete` applies (requirements of a complete objective are Complete), minus the requirement that is only partial"
---

## Objective

Close the advisories objective 81's verifier left (`.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-VERIFICATION.md`
frontmatter `notes`), and close objective 76 honestly. Planner-confirmed state at BASE c7ae75f1:

1. **Stale objective-76 wording.** 81-19 updated objective 76's authoritative entries: 76-VERIFICATION's deferred[]
   (76-06 closed/met, 76-08 closed/not_met), its MEF-05/MEF-06 coverage rows, the 76-06/76-08 ROADMAP rows and the
   REQUIREMENTS MEF-05/MEF-06 rows. Older lines still say "stay open":
   - 76-VERIFICATION: frontmatter `score:` and the `requirements_traceability` note; truth rows 5-6 ("eval
     DEFERRED", "start-tier DEFERRED", "76-06 open by design"); the `**Score:**` line; the artifacts row for
     76-RETROACTIVE-SUMMARY ("lists MEF-02..05"); the paragraph under the coverage table ("lists MEF-02..05 only"); Human Verification; the Gaps Summary's last sentence; and the addendum bullet
     "a proposal for the user's decision in TRD 81-19". The user decided it on 2026-10-17.
   - 76-RETROACTIVE-SUMMARY: "lists exactly those four"; requirements table rows MEF-01/05/06; the "If a
     re-verification marks MEF-01..." paragraph; the "## Still open" section, including "awaiting the user's
     decision"; and the Gap closure paragraph's last sentence.
   - ROADMAP: the line-130 checklist ("stay open, as `main` recorded them"); the 76-07 row ("pending 76-08");
     the Progress row ("In Progress").
   - STATE.md Milestone line: "76 open on 76-06/76-08 as `main` recorded it".
2. **MEF-05 checkbox** (REQUIREMENTS.md line 70) is `[ ]` while its row says Complete.
3. **prereg.test.cjs** tests 1 and 2c fail when os.tmpdir() is a symlink. Reproduced by the planner with
   TMPDIR unset: os.tmpdir() is `/tmp`, so `git rev-parse --show-toplevel` gives `/private/tmp/...` but the extra
   resolves to `/tmp/...`. Actual: `extras[0] = '/tmp/prereg-XXXX/repo/.aoforge/.../fleet-checklists.json'`, and
   `missing: /tmp/prereg-XXXX/repo/...`.
4. **Found while planning: `validate health` is degraded at BASE.** It reports W065: "objective 81 (81-VERIFICATION.md)
   marks MEF-05 satisfied, but no SUMMARY in 81-... lists it". `requirements-agreement.repo.test.cjs` test 11
   **fails** at BASE for the same reason, and it is in `npm test`. Keeping health and the agreement tests green
   requires fixing it.

The user runs `doctor --fix` for leftover runtime files separately. That is not part of this job.

## Locked decisions

- **D1. prereg.cjs is not changed; the fix is in the test.** `scripts/eval81/prereg.cjs` is one of the 86 files
  hashed by the objective-81 pre-registration manifest (`results/prereg-manifest.json`, includes
  `scripts/eval81/**`). Any byte change makes `--check` print `changed: scripts/eval81/prereg.cjs` and exit 1.
  Regenerating the manifest after the live runs would void the pre-registration evidence that 81-VERIFICATION
  relies on (keys and rule predate the first charge, "no fixture or key changed after the freeze"). So "realpath
  both sides" is done in the test. `world()` builds on `fs.realpathSync(fs.mkdtempSync(...))`. Then the stand-in
  repo (git's `--show-toplevel` is physical) and every path resolved against `cwd: w.repo` are physical on both
  sides of `extraLabel`'s comparison. In real CLI use `cwd` is `process.cwd()`, which is already physical, so the
  mismatch came from the test injecting a symlinked cwd. The leftover code limit is an absolute `--extra` named
  through a symlink. That is a follow-up for any future harness that cuts a new manifest. Do not fix it here. The
  planner probed this exact change on a scratch copy: 12/12 with TMPDIR unset and 12/12 with the /var/folders
  TMPDIR. This departs from the planning context's "realpath both sides in extraLabel". Say so in the SUMMARY.
- **D2. Objective 76 becomes Complete, with the partial named.** This follows 64's precedent: Progress row
  "Complete (EST-08 not met, accepted)" and checklist "verified 2/3; EST-08 not met, accepted". All 8 TRDs are
  done and 76-VERIFICATION is `passed`. No TRD of 76 remains. The unmet start-tier half is carried by the
  user-approved follow-up todo `2026-10-17-apply-objective-81-tier-proposal-ui-evaluator.md` (P1), and the debugger's
  start tier was not measured. Do **not** write "accepted": the user approved a follow-up, not a waiver. Write
  "MEF-06 partial". 74 stays In Progress because it still has an unexecuted TRD; 76 has none.
- **D3. Never run `aof-tools objective complete 76`.** Its REQUIREMENTS pass ticks the checkbox of every ID on
  the section's `**Requirements**` line, so it would tick MEF-06. It also writes STATE.md and rewrites the
  section's jobs line from disk, and 76 has no TRD files on disk. Do not run `roadmap update-job-progress 76` or
  `state advance-job` either.
- **D4. MEF-01..MEF-05 are all marked Complete with one verb:**
  `requirements mark-complete MEF-01 MEF-02 MEF-03 MEF-04 MEF-05`. 76-VERIFICATION marks MEF-01..04 SATISFIED, and
  a Complete objective's satisfied requirements are Complete, which is what `objective complete` would do. The
  verb ticks MEF-05's box and leaves its row alone (the table regex replaces only `Pending`). Objective 77's
  STK-01/PCK-01..04 are in the same retroactive Pending state. That is out of scope; list it as a follow-up.
- **D5. Fix W065 in 81-VERIFICATION, not in 81-19-SUMMARY.** REQUIREMENTS traceability maps MEF-05 to objective
  76, and ROADMAP objective 81 says "Requirements: none mapped". 76-RETROACTIVE-SUMMARY already lists MEF-05. So
  81's coverage row is reworded to name 76 as the owner. 81-VERIFICATION's `status`, `score` and every other line
  stay as they are, apart from the three `resolved:` lines.
- **D6. 76-VERIFICATION keeps `status: passed` and its 7/7 count.** The count is stated with its carve-out:
  SC6 was counted on its escalation half, and objective 81 closed the deferred half as not met. The deferred[]
  `state`/`criterion_state` fields are not touched; they are already right. Add one footer line saying the records
  were updated by quick 44, wording only, and that no truth was re-verified.
- **D7. Planning writes go through verbs, run from `<repo>`:** `verification post`, `summary post 76-00 --file
  76-RETROACTIVE-SUMMARY.md` (the form quick 42 used), `requirements mark-complete` and `state update`.
  ROADMAP.md has no verb in local mode: `planning-paths.classify` maps it to the store-only `gh pull --all`. The
  convention (planner `update_roadmap`, TRD 81-19) is a bounded Edit on `.aoforge/ROADMAP.md` with a `git diff`
  check. First confirm `aof-tools planning mode` prints `local`. If it prints `store`, stop and report.
- **D8. No tier change.** The P1-P5 todos stay pending; this job applies none of them.

## Test list

Task 1 only (the other tasks are records, checked by validators). The fixtures are the existing hand-built `world()`
stand-ins. Add no new test data, no property-based tests and no `.feature` files.

- RED evidence (before any edit; the tests already exist): `env -u TMPDIR node --test scripts/eval81/prereg.test.cjs`
  gives 10 pass, 2 fail. Test 1 fails `deepEqual m.extras` with an absolute `/tmp/prereg-.../fleet-checklists.json`.
  Test 2c fails `missing: \.aoforge\/...` with `missing: /tmp/prereg-.../...`.
- GREEN, test 1: the extras are `[PRIVATE, '~/.claude/aoforge/calibration.json']` under all three TMPDIRs.
- GREEN, test 2c: `missing: .aoforge/.../private/fleet-checklists.json` (repo-relative) under all three.
- Unchanged-green, test 4: an extra outside the repo and the home keeps its absolute path. The path is now
  physical, so `m.extras.includes(extra)` still holds because `extra` is built from the same `w.base`.
- Unchanged-green: 1b, 1c, 2, 2b, 2d, 2e, 3, 4b and the glob test.

<embedded_context>
<codebase_examples>
The line to change (`scripts/eval81/prereg.test.cjs:49`, inside `world()`):

```js
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'prereg-'));
```

becomes, with a short comment above it:

```js
// git rev-parse --show-toplevel returns the physical path, while os.tmpdir() may be a symlink (macOS /tmp ->
// /private/tmp, /var -> /private/var). prereg.cjs is frozen by the objective-81 manifest, so the stand-in world is
// built on the physical path instead of changing extraLabel (quick 44).
const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'prereg-')));
```

The agreement parser that W065 comes from (`plugins/aoforge/aoforge/bin/lib/requirements-agreement.cjs:95`):

```js
function saysSatisfied(rest) {
  return /\bSATISFIED\b/.test(rest) && !/\b(NOT|PARTIALLY)\s+SATISFIED\b/i.test(rest);
}
```

`rest` is every cell after the ID cell, so the Evidence cell counts too.

The current 81-VERIFICATION coverage row to replace:

```
| MEF-05 (Haiku half) | ROADMAP obj 81 | SATISFIED | 81-HAIKU-EVAL.md; pin stays claude-haiku-5-5 |
```

Replacement (it has no uppercase SATISFIED in any cell):

```
| MEF-05 (Haiku half) | Objective 76 (objective 81 maps no requirement) | Haiku half delivered; the requirement is objective 76's and is closed in its records | 81-HAIKU-EVAL.md; pin stays claude-haiku-5-5; 76-VERIFICATION.md and 76-RETROACTIVE-SUMMARY.md carry MEF-05 |
```

The three ROADMAP lines at BASE, which are the only ROADMAP lines that change:

```
130: - [ ] **Objective 76: Model efficiency and stack-specific content** - The configured tier is the tier that runs, mechanical work runs as aof-tools code, spawns load only what they need (landed on `main` 2026-10-16, ships in 3.1.0; 76-06's Haiku eval and 76-08's measurement stay open, as `main` recorded them)
406: - [x] 76-07-escalation-loop-TRD.md — (W3) `resolve-model --escalate-from`; execute-objective (5e), /aoforge:debug and diagnose-issues re-spawn one rung up once; the debugger gains the return. Starting tiers unchanged pending 76-08
561: | 76. Model efficiency and stack-specific content | v1.6 | 8/8 | In Progress | - |
```

Targets:

```
- [x] **Objective 76: Model efficiency and stack-specific content** - The configured tier is the tier that runs, mechanical work runs as aof-tools code, spawns load only what they need (landed on `main` 2026-10-16, ships in 3.1.0; 76-06 and 76-08 closed by objective 81; MEF-06 partial: starting tiers not lowered, follow-up todo P1) (completed 2026-10-17)
- [x] 76-07-escalation-loop-TRD.md — (W3) `resolve-model --escalate-from`; execute-objective (5e), /aoforge:debug and diagnose-issues re-spawn one rung up once; the debugger gains the return. Starting tiers unchanged (76-08 measured them in objective 81; not lowered)
| 76. Model efficiency and stack-specific content | v1.6 | 8/8 | Complete (MEF-06 partial) | 2026-10-17 |
```

Precedent rows (do not edit): line 109 `- [x] Objective 64: ... — verified 2/3; EST-08 not met, accepted`; Progress row
`| 55–64 (10 objectives) | v1.5 | 81/81 | Complete (EST-08 not met, accepted) | 2026-10-08 |`.

The STATE.md Milestone clause at BASE is `76 open on 76-06/76-08 as \`main\` recorded it;`. Replace the whole field
with `state update Milestone '<value>'`. The value is the current line with these changes: "Objectives 65-73, 75, 77
and 78 complete" becomes "Objectives 65-73, 75, 76, 77 and 78 complete (76 with MEF-06 partial: escalation done,
starting tiers not lowered; 76-06 and 76-08 closed by objective 81)"; the "76 open on ..." clause is dropped; and
"; 81 (Haiku eval and model-efficiency measurement) complete and verified 5/5 2026-10-17" goes after the 80 clause.
Keep everything else byte for byte. The value has no `$`, which matters because `state update` uses
`String.replace` with `$1`.
</codebase_examples>

<anti_patterns>
- Editing `scripts/eval81/prereg.cjs` or any other non-test file under `scripts/eval81/`, or re-running
  `prereg.cjs --write`. Either breaks or replaces the frozen manifest (D1).
- `aof-tools objective complete 76`, `roadmap update-job-progress 76` or `state advance-job` (D3).
- Writing `.aoforge/` files with Write/Edit (except the bounded ROADMAP edit, D7), heredocs, `sed -i` or
  redirection. Edit the draft that `planning draft` prints, then publish it with the verb.
- Any uppercase `SATISFIED` in 81-VERIFICATION's MEF-05 row, Evidence cell included.
- Changing 76-VERIFICATION's `status`, `verified`, the deferred[] `state`/`criterion_state`/`closed`/`evidence`
  fields, or the Requirements Coverage rows MEF-01..06. Those rows are already right.
- Writing "accepted" for MEF-06, or claiming any tier was lowered.
- A raw `git commit` (gate-commits blocks it). Staging `amp`. Pushing, tagging or opening a PR. Port 8080.
- Legacy product names in new text (rename-guard).
</anti_patterns>

<error_recovery>
- `summary post` wrote `76-00-SUMMARY.md` instead of the retroactive file: `--file 76-RETROACTIVE-SUMMARY.md` was
  missing. Remove the stray file, which is new and untracked; check with `git status --porcelain` first. Then re-run
  with `--file`.
- `validate requirements --objective 76` reports a finding after Task 2: compare the SATISFIED rows of
  76-VERIFICATION's coverage table with `frontmatter get <76-RETROACTIVE-SUMMARY.md> --field requirements-completed`.
  They must be MEF-01..05. Fix the draft and re-post.
- The ROADMAP diff shows any line beyond the three: `git restore .aoforge/ROADMAP.md` and redo the three edits.
- `state update` reports `updated: false`: the field name is `Milestone` (the line is `**Milestone:** ...`). Check
  quoting; the value must reach the CLI as one argument.
- `prereg.cjs --check` fails after Task 1: check `git diff BASE --stat -- scripts/eval81`. Only `prereg.test.cjs` may
  appear. Restore anything else with `git restore <path>`.
- The full suite shows a failure outside the files here: re-run that file alone under the same HOME/TMPDIR. If it
  also fails at BASE (check in a `git worktree add <S>/q44/base BASE` checkout, never by stashing), record it as
  pre-existing. Do not fix it here. Remove that worktree afterwards with `git worktree remove`.
</error_recovery>
</embedded_context>

<gotchas>
- `planning draft` puts drafts under `os.tmpdir()`. Run `planning draft` and the publishing verb with the ambient
  TMPDIR, the same one each time. Only test commands get the scratch HOME/TMPDIR. Shell variables do not survive
  between Bash calls, so pass the literal draft path the command printed.
- `verification post 76` finds the existing `76-VERIFICATION.md` by itself; `verification post 81` finds
  `81-VERIFICATION.md`.
- 76-VERIFICATION's frontmatter notes are double-quoted YAML strings. Keep them on one line each, with no inner
  double quotes. Parse them afterwards with `frontmatter get` (see verify).
- Run the repo CLI, not the installed runtime: `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs --cwd <repo> ...`.
- Use one plain command per Bash call (worktree guard). `<repo>` is the checkout you run in (the main checkout
  is `/Users/justin/dev/aoforge-claude`). `<S>` is
  `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`.
- `npm test` includes `scripts/**/*.test.cjs`, so the eval81 suite is part of the full run.
</gotchas>

<validation_gates>
- task gate: `npm test` (`aof-tools stack command test` → `npm test`; `gates.task: [test]`). No lint or build gate.
  On this machine run the full suite by the 80-09 method (Task 3, step 6), because `watcher-shell.test.cjs` hangs
  here under a scratch HOME.
- Task 1 scoped, three runs from `<repo>`:
  `env -u TMPDIR node --test scripts/eval81/prereg.test.cjs`;
  `env TMPDIR=/var/folders/j2/r369kq256wd5qg5yn51x376m0000gn/T/ node --test scripts/eval81/prereg.test.cjs`;
  `env HOME=<S>/q44/home TMPDIR=<S>/q44/tmp node --test scripts/eval81/prereg.test.cjs`. Then the eval81 suite once
  with TMPDIR unset: `env -u TMPDIR node --test 'scripts/eval81/**/*.test.cjs'`. Then
  `node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`.
- Records gates (Tasks 2 and 3): `aof-tools validate requirements --objective 76`, `validate requirements`,
  `validate health --raw`, `validate consistency`, `validate roadmap-coverage`, and
  `env HOME=<S>/q44/home TMPDIR=<S>/q44/tmp node --test plugins/aoforge/aoforge/bin/lib/requirements-agreement.repo.test.cjs plugins/aoforge/aoforge/bin/lib/requirements-agreement.test.cjs plugins/aoforge/aoforge/bin/lib/validate-requirements.test.cjs plugins/aoforge/aoforge/bin/lib/misc-requirements.test.cjs plugins/aoforge/aoforge/bin/lib/roadmap-reconcile.test.cjs plugins/aoforge/aoforge/bin/lib/planning-writes.repo.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs`.
</validation_gates>

<tasks>

<task type="auto">
  <name>Task 1: prereg tests build their world on the physical temp path</name>
  <files>scripts/eval81/prereg.test.cjs</files>
  <action>
<!-- TDD-EXCEPTION: test-harness fix only. The production file prereg.cjs is frozen by the objective-81
pre-registration manifest and is not changed (D1). RED is the two existing failures, reproduced before the edit. -->

Step 0: run `git rev-parse --short HEAD` and record it as BASE (c7ae75f1 expected). Run `git status --porcelain` and
record it; `?? amp` is expected and must stay untouched. Run `aof-tools planning mode` and confirm it prints `local`
(D7). Run `mkdir -p <S>/q44/home <S>/q44/tmp`.

Step 1 (RED evidence, no edit yet): run `env -u TMPDIR node --test scripts/eval81/prereg.test.cjs` from `<repo>` and
record the counts (10 pass, 2 fail) and both failure messages, quoted in the Test list. Also run
`node scripts/eval81/prereg.cjs --check --manifest .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/results/prereg-manifest.json`
and record the OK line. This is the BASE check: it needs the gitignored `private/fleet-checklists.json` and
`~/.claude/aoforge/calibration.json`. If it does not print OK at BASE, record that, keep going, and require the
same output after the edit.

Step 2 (GREEN): in `world()`, wrap the `mkdtempSync` call in `fs.realpathSync(...)` and add the three-line comment
from codebase_examples. Change nothing else in the file.

Step 3: run the three scoped prereg runs from validation_gates; each must be 12/12. Run the eval81 suite with
TMPDIR unset and record the counts. If a file other than prereg.test.cjs fails there, record it as out of scope:
81-VERIFICATION saw only these two. Re-run `--check` and confirm the same OK line and sha.
Run `git diff BASE --stat -- scripts/eval81` and confirm that only `scripts/eval81/prereg.test.cjs` appears.

Step 4: commit with
`aof-tools commit "test(quick-44): prereg tests build their world on the physical temp path" --files scripts/eval81/prereg.test.cjs`.
  </action>
  <verify>The three prereg runs are each 12 pass, 0 fail. `prereg.cjs --check` prints `prereg check: OK, 86 files match the manifest (sha256 70f92eca1b291f4296e62c402f37da5e89920f40380bac0666b5625e5b710e81)`. `git diff BASE --stat -- scripts/eval81` lists only prereg.test.cjs.</verify>
  <done>The symlinked-TMPDIR failures are gone, proven with TMPDIR unset. The frozen harness and its manifest are untouched.</done>
  <recovery>If a run still fails, print `fs.realpathSync(os.tmpdir())` against `git -C <w.repo> rev-parse --show-toplevel` in a scratch script under `<S>/q44/` to find which side still differs. Never touch prereg.cjs.</recovery>
</task>

<task type="auto">
  <name>Task 2: objective 76's records and MEF requirements agree with objective 81's evidence</name>
  <files>.aoforge/REQUIREMENTS.md, .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md, .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md</files>
  <action>
<!-- TDD-EXCEPTION: planning records only; guarded by validate requirements/health and the agreement tests -->

Read first, narrowly: 81-HAIKU-EVAL.md `## Decision (2026-10-17)` and its proposals table (`rg -n` it, then read that
range); 81-19-SUMMARY "Decision" and "The 76 records". Use these exact facts: 76-06 closed (met), pin stays
claude-haiku-5-5; 76-08 measurement closed (10/10 runs, first-turn input -19% executor/verifier), SC6 start-tier half
not met, tiers unchanged; P1 (UI judge Haiku start) approved 2026-10-17 as todo
`2026-10-17-apply-objective-81-tier-proposal-ui-evaluator.md`, not applied, with its escalation rate still to be
measured on real projects; debugger start tier not measured; MEF-05 SATISFIED, MEF-06 PARTIALLY SATISFIED.

**A. REQUIREMENTS.md (D4).** Run `aof-tools requirements mark-complete MEF-01 MEF-02 MEF-03 MEF-04 MEF-05`. Then
`git diff .aoforge/REQUIREMENTS.md` must show exactly 9 changed lines: 5 checkboxes and the 4 rows MEF-01..04
going from Pending to Complete. MEF-05's row and every MEF-06 line are unchanged.

**B. 76-VERIFICATION.md (D6).** Run `aof-tools planning draft objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md`,
then make these targeted edits on the printed draft with the Edit tool:
- frontmatter `score:` becomes `7/7 must-haves verified at re-verification (SC6 counted on its escalation half); the deferred items were closed by objective 81: 76-06 met, 76-08 measured with SC6's start-tier half not met (MEF-06 partial)`
- the 76-08 deferred `note`: append ` The user approved P1 on 2026-10-17 as a follow-up todo; not applied.` inside the
  same quotes.
- the `requirements_traceability` note: replace its text with `MEF-01..05 are SATISFIED and listed in 76-RETROACTIVE-SUMMARY.md requirements-completed; MEF-06 is PARTIALLY SATISFIED and not listed. REQUIREMENTS.md: MEF-01..05 Complete, MEF-06 Partial (quick 44).`
- truth row 5: Status `VERIFIED (76-06 eval recorded by objective 81)`. In Evidence, replace `76-06 open by design.`
  with `76-06 closed 2026-10-17 (81-HAIKU-EVAL.md); the pin stays claude-haiku-5-5.`
- truth row 6: Status `VERIFIED (escalation); start-tier half NOT MET (76-08 measured by objective 81; tiers unchanged)`.
  Leave the evidence text alone.
- `**Score:**` line: `7/7 truths verified, SC6 on its escalation half. Objective 81 closed the deferred items: 76-06 met; 76-08's start-tier half not met.`
- the artifacts-table row for `76-RETROACTIVE-SUMMARY.md` (about line 81): in Evidence, change `lists MEF-02..05`
  to `lists MEF-01..05 (MEF-01 added in f1ae9ca9)`. Keep the rest of the row.
- the paragraph under the coverage table (`76-RETROACTIVE-SUMMARY.md requirements-completed lists MEF-02..05 only...`):
  replace it with `76-RETROACTIVE-SUMMARY.md requirements-completed lists MEF-01..05, the SATISFIED rows. MEF-06 is partial and not listed. REQUIREMENTS.md shows MEF-01..05 Complete and MEF-06 Partial.`
  Uppercase SATISFIED is safe here because this is prose, not a table row. Still, keep it out of any table row
  that is not MEF-01..05.
- Human Verification: `None. Objective 81 ran the deferred measurement items (81-HAIKU-EVAL.md, 81-MEASUREMENT.md). Lowering the UI judge's starting tier is the approved follow-up todo P1, outside objective 76; the debugger's start tier was not measured.`
- Gaps Summary, last sentence: `The Haiku eval (76-06) and the starting-tier measurement (76-08) were deferred at this re-verification; objective 81 closed both (below).`
- addendum bullet `That is a proposal for the user's decision in TRD 81-19.`: replace it with
  `The user approved it on 2026-10-17 as follow-up todo P1 (2026-10-17-apply-objective-81-tier-proposal-ui-evaluator.md); it is not applied.`
- footer: under `_Verifier: Claude (verifier)_`, add `_Records updated: 2026-10-17 (quick 44), wording only; no truth re-verified._`

Publish with `aof-tools verification post 76 --from <draft>`.

**C. 76-RETROACTIVE-SUMMARY.md.** Run `aof-tools planning draft objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md`,
then make these edits:
- "Why this file exists": "marks four requirements SATISFIED" and "This file lists exactly those four and nothing else"
  become five. Say MEF-01 was added after the re-verification that followed quick 42 (cccc22d0, f1ae9ca9), and that
  MEF-05's eval half was recorded by objective 81.
- Requirements table: MEF-01 becomes `SATISFIED (re-verification after quick 42) | yes`. MEF-05 becomes
  `SATISFIED (76-06 eval recorded by objective 81, 2026-10-17) | yes`. MEF-06 becomes
  `PARTIALLY SATISFIED (escalation done in quick 42; start-tier half not met, 81-MEASUREMENT.md) | no`.
- The "Quick 42 closes ... If a re-verification marks MEF-01 or MEF-06 satisfied, add it here ..." paragraph
  becomes past tense. Quick 42 closed the SC1 and SC6 code gaps; the re-verification marked MEF-01 SATISFIED and it
  is listed; MEF-06 stays partial and unlisted.
- Rename `## Still open` to `## Deferred items, closed by objective 81`. Keep its 76-06 and 76-08 bullets. Replace
  "The UI judge's Haiku start is a proposal awaiting the user's decision (TRD 81-19)." with
  "The UI judge's Haiku start was approved on 2026-10-17 as follow-up todo P1 (`.aoforge/todos/pending/2026-10-17-apply-objective-81-tier-proposal-ui-evaluator.md`); it is not applied."
  The last paragraph says the start-tier half of MEF-06 is the only unmet part, carried by that todo outside
  objective 76.
- Gap closure: the last sentence becomes "76-06 (Haiku eval) and 76-08 (measurement, including lowering starting
  tiers) were deferred then; objective 81 closed both on 2026-10-17 (see above)."
- Frontmatter: `requirements-completed`, `completed: 2026-10-16`, `retroactive_note` and `key-files` are unchanged.

Publish with `aof-tools summary post 76-00 --file 76-RETROACTIVE-SUMMARY.md --from <draft>`.

**D. Check.** Run `aof-tools validate requirements --objective 76`, which must say it agrees with 5 checked.
Run `aof-tools frontmatter get .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md --field deferred`
and `--field notes`; both must parse. Run
`rg -n "stay open|open by design|DEFERRED|awaiting|Still open|exactly those four|lists MEF-02..05" .aoforge/objectives/76-model-efficiency-and-stack-specific-content/`.
It must print nothing. If it prints a line that is historical and accurate, such as the `re_verification` block,
leave the line and justify it in the SUMMARY.

Commit with `aof-tools commit "docs(quick-44): objective 76 records and MEF requirements agree with objective 81's evidence" --files .aoforge/REQUIREMENTS.md .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-VERIFICATION.md .aoforge/objectives/76-model-efficiency-and-stack-specific-content/76-RETROACTIVE-SUMMARY.md`.
  </action>
  <verify>`validate requirements --objective 76` agrees (5 checked). The REQUIREMENTS diff is exactly 9 lines. Both frontmatter reads parse. The stale-wording `rg` is empty, or every remaining line is justified. `git diff HEAD~1 --stat` shows exactly the three files.</verify>
  <done>Every objective-76 record says the same thing: 76-06 closed, 76-08 measured with its start-tier half not met, MEF-01..05 Complete, MEF-06 partial and P1 approved but not applied.</done>
  <recovery>If a verb refuses, read its message, which names the fix. A stale draft is reseeded and the replaced one kept at `<draft>.stale`. Redo the edits on the fresh draft. Never write the live file.</recovery>
</task>

<task type="auto">
  <name>Task 3: objective 76 complete with MEF-06 partial, 81 coverage row, STATE, full validation</name>
  <files>.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-VERIFICATION.md, .aoforge/ROADMAP.md, .aoforge/STATE.md</files>
  <action>
<!-- TDD-EXCEPTION: planning records only; requirements-agreement.repo.test.cjs (red at BASE) is the test that turns green -->

1. **81-VERIFICATION (D5).** Run `aof-tools planning draft objectives/81-haiku-eval-and-model-efficiency-measurement/81-VERIFICATION.md`.
   On the draft, replace the MEF-05 coverage row with the replacement in codebase_examples and leave the MEF-06 row
   alone. In frontmatter `notes`, add one `resolved:` line to each of the first three entries, at the same indent
   as `note:`:
   - test_portability: `resolved: "quick 44: prereg.test.cjs builds its world on the physical temp path; prereg.cjs is unchanged because the manifest freezes it"`
   - stale_wording: `resolved: "quick 44: 76-VERIFICATION, 76-RETROACTIVE-SUMMARY, ROADMAP and STATE agree with the closing evidence"`
   - stale_checkbox: `resolved: "quick 44: MEF-01..05 ticked via requirements mark-complete"`
   Change nothing else; `status: passed` and `score: 5/5` stay. Publish with
   `aof-tools verification post 81 --from <draft>`. Then `aof-tools validate requirements` must print no findings,
   and `aof-tools frontmatter get <81-VERIFICATION.md> --field notes` must parse.
2. **ROADMAP.md (D2, D7).** Use the Edit tool on `.aoforge/ROADMAP.md` for exactly the three lines in
   codebase_examples: line 130 (checklist), the 76-07 row in `### Objective 76:` (it ends at `### Objective 77:`) and
   the `| 76. ...` Progress row. Then run `git diff .aoforge/ROADMAP.md | rg -n '^[+-]' | rg -v '^[0-9]+:[+-]{3}'`.
   It must print exactly 3 `-` and 3 `+` lines, all for objective 76. Otherwise follow error_recovery.
3. **STATE.md.** Run `aof-tools state get Milestone`, build the new value as codebase_examples says, and run
   `aof-tools state update Milestone '<value>'`. Confirm with `rg -n '^\*\*Milestone:\*\*' .aoforge/STATE.md` and
   `git diff .aoforge/STATE.md`: one line changed.
4. **Validators.** `validate health --raw` must report status `healthy`, 0 errors and 0 warnings; I001 info lines
   for 79-09/79-10 are fine. `validate consistency` must pass. `validate roadmap-coverage` must print 41/41.
   `validate requirements` must have no findings. Also run the records test files from validation_gates.
5. Commit with `aof-tools commit "docs(quick-44): objective 76 complete with MEF-06 partial; 81 coverage names 76 as MEF-05's owner" --files .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-VERIFICATION.md .aoforge/ROADMAP.md .aoforge/STATE.md`.
6. **Full validation (80-09 method, from `<repo>`).**
   (a) Run `git ls-files -co --exclude-standard -- 'plugins/aoforge/**/*.test.cjs' 'plugins/aoforge-stack-*/**/*.test.cjs' 'plugins/aoforge/**/*.test.js' 'scripts/**/*.test.cjs'`.
   Save the output to `<S>/q44/files-all.txt`.
   (b) Drop `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` and save the rest as `<S>/q44/files.txt`.
   (c) Run `env HOME=<S>/q44/home TMPDIR=<S>/q44/tmp xargs node --test < <S>/q44/files.txt`. Expect 0 fail, 0
   cancelled. Quote the count; for reference, 81-VERIFICATION's npm test had 13,641 tests.
   (d) Run `git diff BASE -- . ':!amp' | rg -n '8080'`. It must print nothing.
   (e) Run `git diff BASE --stat`. It must list exactly the seven files_modified.
   (f) Run `git diff BASE --stat -- plugins/aoforge/aoforge/references/model-profiles.json plugins/aoforge-stack-flutter plugins/aoforge-stack-web`.
   It must be empty.
  </action>
  <verify>`validate requirements` has no findings. `validate health` is healthy with 0 warnings. The agreement repo test passes. The ROADMAP diff is exactly 3 lines in and 3 out. STATE changed one line. The full suite has 0 fail. The BASE diff is exactly the seven files.</verify>
  <done>Objective 76 reads Complete (MEF-06 partial) everywhere, objective 81's verification no longer claims a requirement it does not own, and health and the agreement tests are green again.</done>
  <recovery>If health still shows W065, re-read 81-VERIFICATION's coverage rows for any uppercase SATISFIED. If the ROADMAP diff strays, use `git restore .aoforge/ROADMAP.md` and redo. If `state update` mangles the line, use `git restore .aoforge/STATE.md` and retry with corrected quoting.</recovery>
</task>

</tasks>

<verification>
- prereg: 12/12 under TMPDIR unset, /var/folders and scratch; `--check` OK with 86 files and sha 70f92eca...;
  scripts/eval81 non-test files unchanged.
- Records: `validate requirements` (global and `--objective 76`) has no findings; `validate health` is healthy with
  0 warnings; `validate consistency` passes; roadmap-coverage is 41/41; the stale-wording `rg` over the objective-76
  directory is empty or justified.
- Full suite by the 80-09 method: 0 fail, 0 cancelled.
- `git log --oneline BASE..HEAD`, in order: the Task 1 test commit, the Task 2 records commit and the Task 3
  status commit, all made through `aof-tools commit`.
- No push, tag, release or PR. No 8080. No tier file changed. The `amp` file is untouched and unstaged.
</verification>

<success_criteria>
- Objective 81's three advisory notes are resolved without disturbing the frozen pre-registration evidence.
- Objective 76 is closed honestly: Complete, with MEF-06's unmet start-tier half named and carried by the approved
  P1 todo, following objective 64's not-met precedent without claiming acceptance.
- `validate health` and `requirements-agreement.repo.test.cjs`, both red at BASE, are green.
</success_criteria>

<output>
Write the SUMMARY into the draft that
`node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs planning draft quick/44-cleanups-stale-objective-76-wording-mef-/44-SUMMARY.md`
prints
(`/var/folders/j2/r369kq256wd5qg5yn51x376m0000gn/T/aoforge-drafts/aoforge-claude-df646fc2/quick/44-cleanups-stale-objective-76-wording-mef-/44-SUMMARY.md`
under the ambient TMPDIR). Publish it with `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs --cwd <repo> quick summary 44 --from <that draft> --raw`.
Do not commit the SUMMARY; the orchestrator does that and adds the quick row. Include:
- BASE; the RED counts and failure text for prereg with TMPDIR unset; the three GREEN runs; the `--check` line
  before and after;
- every commit hash;
- a table that maps each planning-context item (1-3, plus the W065 found while planning) to its evidence;
- the D1 departure, stated plainly: the planning context asked for realpath in `extraLabel`, but prereg.cjs is
  frozen by the 81 manifest, so the test realpaths its world. The code limit (an absolute extra named through a
  symlink) stays as a follow-up for a future harness with a new manifest;
- the D2 decision (76 Complete with MEF-06 partial, per 64's precedent) and D4 (MEF-01..04 ticked with MEF-05);
- follow-ups: objective 77's STK-01/PCK-01..04 are still Pending in REQUIREMENTS although 77 is ticked complete;
  the P1-P5 tier todos stay pending.
</output>
