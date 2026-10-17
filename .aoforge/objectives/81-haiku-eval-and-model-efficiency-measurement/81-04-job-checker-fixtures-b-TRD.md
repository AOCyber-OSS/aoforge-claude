---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "04"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval81/fixtures/B/build.cjs
  - scripts/eval81/fixtures/B/answer-key.json
  - scripts/eval81/fixtures/B/proofs.test.cjs
autonomous: true
requirements: [SC-2]
must_haves:
  truths:
    - "buildFixture(id, dir) materialises six AOForge 3.1.0 projects (B1..B6), each with a completed objective 1 and a planned, unexecuted objective 2 (TRDs only), deterministically"
    - "B1 and B2 are clean TRD sets; B3..B6 each differ from their base in exactly one planted defect: two same-wave TRDs modifying the same file, a task with no verify element, a wave-1 TRD depending on a wave-2 TRD, and a ROADMAP success criterion that no TRD addresses"
    - "A proof test shows each defect is real by a structural predicate that is true on the planted set and false on its base, and shows the planted set differs from its base only in the declared files"
    - "The proof test records what `verify trd-pre 2` reports for every set (precheck_flags) and asserts it, so the scorer can separate defects code already catches from judgment-only defects"
    - "answer-key.json gives, per set, the expected checker verdict and the planted defect's TRDs, kind, match tokens and precheck_flags"
  artifacts:
    - path: scripts/eval81/fixtures/B/build.cjs
      provides: "FIXTURES, buildFixture(id, dir), describeFixture(id)"
    - path: scripts/eval81/fixtures/B/answer-key.json
      provides: "test B answer key"
    - path: scripts/eval81/fixtures/B/proofs.test.cjs
      provides: "planted-defect, base-diff and trd-pre proofs"
  key_links:
    - from: scripts/eval81/fixtures/B/proofs.test.cjs
      to: "aof-tools verify trd-pre / verify job-structure"
      via: "spawned with cwd = the materialised fixture"
      pattern: "trd-pre"
---

# TRD 81-04: Test B fixtures, answer key and planted-defect proofs (job-checker)

<objective>
Build the six TRD sets test B runs the job-checker against: two clean planned objectives and four single-defect
mutations of them. Write the answer key and a proof test that shows each defect is real, that each mutation is the
only difference from its base, and what the mechanical pre-check (`verify trd-pre`) already catches.

Purpose: SC-2 for test B. Since objective 76, production runs `verify trd-pre` before the checker and skips the
spawn for its blockers; recording which planted defects the pre-check flags lets the report separate "the model
found it" from "the pre-check told it".
Output: a fixture builder, the answer key, and its proof test. No live call.
</objective>

<file_tree>
scripts/eval81/fixtures/B/
├── build.cjs          ← CREATE
├── answer-key.json    ← CREATE
└── proofs.test.cjs    ← CREATE
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
The production checker prompt (`plugins/aoforge/aoforge/workflows/plan-objective.md` ~lines 640-660; the 81-09 spec
fills it), so each fixture must supply a ROADMAP goal, TRD paths, requirement IDs and REQUIREMENTS.md content:

```
<verification_context>
**Objective:** {objective_number}
**Objective Goal:** {goal from ROADMAP}
**Plans to verify (read each):** {plan_paths}
**Mechanical pre-check (verify trd-pre):** {precheck}
**Objective requirement IDs (MUST ALL be covered):** {objective_req_ids}
**Requirements:** {requirements_content}
...
</verification_context>
```

`verify trd-pre <objective> --raw` keys (run against objective 80 in this repo): `{objective, passed,
needs_agent, checks: {requirement_coverage: {passed, missing, note}, task_completeness: {passed, incomplete},
dependency_correctness: {passed, cycles, orphan_refs}, scope_sanity: {passed, oversized_trds, warning_trds,
total_trds}, trd_budget: {passed, trds, over, warn, severity}}, summary, elapsed_ms}`. It does NOT check same-wave
file overlap or wave order of dependencies; it does check missing verify elements (task_completeness) and
requirement IDs (not success criteria).

Job-checker dimensions (`plugins/aoforge/agents/job-checker.md`): requirement_coverage, task_completeness,
dependency_correctness, key_links_planned, scope_sanity, verification_derivation, context_compliance,
trd_size. Its return is `## VERIFICATION PASSED` or `## ISSUES FOUND` with blockers, warnings and a YAML
`issues` list (`trd`, `dimension`, `severity`, `description`, `fix_hint`).

TRD shape to copy (frontmatter objective/trd/type/wave/depends_on/files_modified/autonomous/requirements/
must_haves; tasks with name, files, action, verify, done): any `.aoforge/objectives/80-*/80-0N-*-TRD.md`, cut down
to two tasks per TRD.
</codebase_examples>

<anti_patterns>
- No revealing word in any materialised file, path or commit message ("planted", "defect", "broken", "clean",
  "fixture", "eval", "overlap", "missing"). Ids B1..B6 live only in the builder and the key.
- Do not create cycles or orphan dependency references in B5: the defect is a wave-order violation, which the
  pre-check cannot see; a cycle would turn it into a pre-check blocker and change what is measured.
- File contents are string literals in build.cjs, materialised into temp dirs; nothing under `scripts/` is a real
  `.aoforge/` tree.
- No pre-rename product name; no generated content.
</anti_patterns>

<error_recovery>
- `verify trd-pre` reports a blocker on a clean set (for example requirement_coverage.missing): fix the set's
  frontmatter or ROADMAP so the clean sets pass the pre-check; scope or budget warnings are allowed if identical on
  the base and its mutations.
- `verify job-structure` errors on a clean TRD: fix the TRD (every task needs name, files, action, verify, done).
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@plugins/aoforge/agents/job-checker.md (dimensions 1-6 only)
@plugins/aoforge/aoforge/workflows/plan-objective.md (the checker prompt and the trd-pre skip rule, ~lines 620-670)

Runtime model: subprocesses run with cwd = the materialised fixture in an mkdtemp dir and HOME = an mkdtemp fake
home. When running by hand set `TMPDIR=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81-test-tmp`.
</context>

<gotchas>
- In production a pre-check blocker (B4's missing verify) skips the checker spawn. Test B still spawns the checker
  on B4 with the pre-check JSON in the prompt, as plan-objective would on a non-blocking iteration; the key's
  `precheck_flags: true` makes the scorer report B4 apart from the judgment-only defects.
- Every TRD in the fixtures must itself be plausible and complete (real file paths, real verify commands) so a
  careful checker raises no blocker on B1 and B2.
- Keep each TRD small (two tasks, under 4 KB) so the checker's cost stays near the ~$4 batch estimate.
</gotchas>

## Fixture specification

Both bases are Node CommonJS CLIs (no deps, `node --test`, tests `test/*.test.js`) whose objective 1 is already
done (code, tests, TRD, SUMMARY, ticked in ROADMAP). Objective 2 is planned only: OBJECTIVE.md, TRDs, no SUMMARY.

**B1 (clean) — package `textkit`, objective 2 "Export formats".** Goal: `textkit export --format <csv|json>`
writes the notes in `notes.json` to stdout. Requirements EXP-01 (CSV), EXP-02 (JSON). Success criteria: 1. `--format
csv` prints a header row and one row per note; 2. `--format json` prints a JSON array; 3. an unknown format exits 2
with `unknown format: <name>` on stderr. TRDs: 02-01 (wave 1, `src/export/csv.js` + test, EXP-01); 02-02 (wave 1,
`src/export/json.js` + test, EXP-02); 02-03 (wave 2, depends on 02-01 and 02-02, `src/cli.js` + `test/cli.test.js`:
the `export` command, format dispatch, the unknown-format exit; EXP-01, EXP-02).

**B2 (clean) — package `tempconv`, objective 2 "Batch conversion".** Goal: `tempconv batch <file>` converts a file
of Celsius values to Kelvin. Requirement BAT-01. Success criteria: 1. one value per line in, one Kelvin value per
line out; 2. blank lines are skipped; 3. an invalid line is reported on stderr with its line number and the exit
code is 1. TRDs: 02-01 (wave 1, `src/batch/parse.js` + test); 02-02 (wave 1, `src/batch/format.js` + test);
02-03 (wave 2, depends on 02-01 and 02-02, `src/cli.js` wiring + test); 02-04 (wave 2, depends on 02-01, `README.md`
usage section, docs only).

| Id | Base | Single mutation | Planted TRDs | must_mention | any_of |
|----|------|-----------------|--------------|--------------|--------|
| B3 | B1 | 02-01 and 02-02 (both wave 1, no dependency between them) each add a task registering their format in `src/cli.js` and list it in `files_modified` | 02-01, 02-02 | `cli.js` | overlap, conflict, same wave, parallel, both modify, concurrent, same file |
| B4 | B2 | 02-02's first task has no verify element | 02-02 | `02-02` | verify, verification |
| B5 | B2 | 02-02 (wave 1) gains `depends_on: ["02-04"]` (02-04 is wave 2 and depends only on 02-01; no cycle) | 02-02, 02-04 | `02-04` | wave, depend, later, order, before |
| B6 | B1 | the unknown-format handling (task text, verify, must_haves truth) is removed from 02-03; ROADMAP still lists success criterion 3 | 02-03 | (none) | unknown format, unsupported format, invalid format, exit 2, exit code 2, criterion 3, sc-3, sc 3, sc3 |

Answer key: `{ "batch": "B", "objective": "2", "sets": [ { "id", "base": null | "B1" | "B2", "expected": "PASSED" |
"ISSUES", "planted": null | { "kind": "same_wave_overlap" | "missing_verify" | "later_wave_dependency" |
"uncovered_success_criterion", "trds": [...], "must_mention": [...], "any_of": [...], "dimension_hint": "...",
"precheck_flags": bool }, "precheck": { "passed": bool, "blockers": [...] }, "health_warnings": [...] } ] }`.

## Test list

Outermost first.
1. Each of B1..B6 builds deterministically (same files, contents and commit subjects across two builds).
2. Each fixture passes `validate health` with no errors (warnings equal the key's) and `upgrade --check` is current.
3. `verify job-structure` reports no errors for every TRD of B1, B2, B3, B5, B6; on B4 it warns that 02-02's task
   lacks verify.
4. `verify trd-pre 2 --raw`: B1 and B2 report no blocker (requirement_coverage.missing, task_completeness.incomplete,
   cycles and orphan_refs all empty); B4 lists 02-02 in task_completeness.incomplete; B3, B5 and B6 report no
   blocker. Each set's result equals the key's `precheck`.
5. B3: there are two wave-1 TRDs with no dependency between them whose `files_modified` both contain `src/cli.js`;
   the predicate is false on B1.
6. B4: exactly one task element in 02-02 lacks a verify element; false on B2.
7. B5: 02-02's depends_on names a TRD whose wave is greater than 02-02's; no cycle; false on B2.
8. B6: no TRD of objective 2 mentions `unknown format` in a task or a must_haves truth while the ROADMAP lists it;
   on B1, 02-03 does.
9. Each planted set differs from its base only in the files the spec names (TRD files, and nothing else).
10. No materialised file, path or commit subject contains a revealing word.
11. answer-key.json has six sets: B1, B2 `PASSED` with `planted: null`; B3-B6 `ISSUES` with the table's tokens.

<tasks>

<task type="auto">
  <name>Task 1: Fixture builder for B1..B6</name>
  <files>scripts/eval81/fixtures/B/build.cjs</files>
  <action>
Write `build.cjs` exporting `FIXTURES`, `buildFixture(id, dir)` and `describeFixture(id)`. Build each base as
`{relPath: content}` (code and objective 1 history first, then objective 2 planning), then apply the mutation as a
replacement of whole TRD files for B3..B6. Use a local deterministic `gitCommit` helper (fixed author `Fixture
Author <author@example.invalid>`, dates from 2026-10-02T10:00Z, `GIT_CONFIG_GLOBAL=/dev/null`,
`GIT_CONFIG_NOSYSTEM=1`, `-c commit.gpgsign=false -c init.defaultBranch=main`). Objective 2's planning commit is the
last commit; the working tree is clean after the build. Config stamp as in 81-03 (`aoforge.version` 3.1.0, this
repo's `migrations_applied`, fixed `upgraded_at`).
  </action>
  <verify>node -e "const b=require('./scripts/eval81/fixtures/B/build.cjs');const fs=require('fs'),os=require('os'),p=require('path');for(const id of b.FIXTURES){const d=fs.mkdtempSync(p.join(os.tmpdir(),'b-'));b.buildFixture(id,d);console.log(id,fs.readdirSync(p.join(d,'.aoforge','objectives')).join(','))}" with TMPDIR under the session scratchpad</verify>
  <done>All six build; each lists `01-*` and `02-*` objective dirs; objective 2 has TRDs and no SUMMARY.</done>
  <recovery>If `verify trd-pre` later flags a clean base, fix the base here and rebuild every derived set.</recovery>
</task>

<task type="auto">
  <name>Task 2: Answer key and planted-defect proofs</name>
  <files>scripts/eval81/fixtures/B/answer-key.json, scripts/eval81/fixtures/B/proofs.test.cjs</files>
  <action>
<!-- TDD-EXCEPTION: fixture builders are test infrastructure; these proofs are the tests, each predicate asserted true on the planted set and false on its base. -->
Write the proofs per test list 1-11. Parse TRD frontmatter with a small local YAML-subset reader or this repo's
`plugins/aoforge/aoforge/bin/lib/frontmatter.cjs` (check its export first with `rg -n "module.exports"`). Run
`verify trd-pre 2 --raw` once per set by hand, put the observed `passed` and blocker list into the key's
`precheck`, set `precheck_flags`, then assert them in case 4. Write answer-key.json per the spec.

Commit with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "test(81-04): add test B job-checker fixtures, answer key and proofs" --files scripts/eval81/fixtures/B/build.cjs scripts/eval81/fixtures/B/answer-key.json scripts/eval81/fixtures/B/proofs.test.cjs`.
  </action>
  <verify>node --test scripts/eval81/fixtures/B/proofs.test.cjs (TMPDIR under the session scratchpad)</verify>
  <done>Test list 1-11 pass; B4 is the only set with precheck_flags true unless the observed pre-check says otherwise (then the key records what it says and the SUMMARY explains).</done>
  <recovery>If a mutation leaks into a second file (case 9 fails), move the change back into the one TRD file the spec names.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/fixtures/B/proofs.test.cjs</test>
<test>node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs</test>
</validation_gates>

<verification>
- The proof test passes and writes only to temp dirs.
- `answer-key.json` precheck values match a fresh `verify trd-pre 2 --raw` on each set.
</verification>

<success_criteria>
Two clean and four single-defect TRD sets, each defect proven real and isolated, with the pre-check's view of each
recorded; all committed before any live run.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-04-SUMMARY.md`
</output>
