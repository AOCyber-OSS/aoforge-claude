---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "03"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval81/fixtures/A/build.cjs
  - scripts/eval81/fixtures/A/answer-key.json
  - scripts/eval81/fixtures/A/proofs.test.cjs
autonomous: true
requirements: [SC-2]
must_haves:
  truths:
    - "buildFixture(id, dir) materialises each of six AOForge 3.1.0 projects (A1..A6) as a git repo with fixed author, dates and messages, so two builds of the same id give the same tree and the same commit messages"
    - "Three fixtures are clean (every success criterion command gives its expected output, every SUMMARY key-file and must_haves artifact exists, `node --test` passes) and three carry exactly one planted gap: a stub returning a hard-coded value, a feature never wired into the CLI, and a SUMMARY claiming a file that does not exist"
    - "A proof test shows each planted gap is real (the stub returns the same value for different input; the CLI does not route the unwired command; the claimed file is absent and the command that needs it fails) while the project's own tests still pass, and shows the same predicate is false on the clean twin"
    - "Every fixture passes this checkout's `validate health` with no errors and `upgrade --check` reports it current, so a verifier is not distracted by broken scaffolding"
    - "answer-key.json gives, per fixture, the expected verdict, the planted gap's kind, artifact, must_mention and any_of tokens, and what `verify objective-evidence` reports for it (recorded by the proof run)"
  artifacts:
    - path: scripts/eval81/fixtures/A/build.cjs
      provides: "FIXTURES, buildFixture(id, dir), describeFixture(id)"
    - path: scripts/eval81/fixtures/A/answer-key.json
      provides: "test A answer key"
    - path: scripts/eval81/fixtures/A/proofs.test.cjs
      provides: "planted-defect and clean-twin proofs"
  key_links:
    - from: scripts/eval81/fixtures/A/proofs.test.cjs
      to: scripts/eval81/fixtures/A/answer-key.json
      via: "every key entry is checked against a built fixture"
      pattern: "answer-key.json"
---

# TRD 81-03: Test A fixtures, answer key and planted-defect proofs (verifier)

<objective>
Build the six fixture projects test A runs the verifier against: three domains, each as a clean project and a
twin with one planted gap. Write the answer key and a proof test that shows every planted gap is real and every
clean twin is genuinely complete.

Purpose: SC-2 (fixtures and answer keys committed before any live run, with a test proving each planted defect).
Matched clean/planted pairs per domain keep domain difficulty out of the false-pass and false-fail rates.
Output: a fixture builder, the answer key and its proof test. No live call.
</objective>

<file_tree>
scripts/eval81/fixtures/A/
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
What the verifier is told in production (`plugins/aoforge/aoforge/workflows/execute-objective.md` ~line 1250; the
batch spec in 81-09 reuses this text), so the fixture must contain everything it names:

```
Verify objective {objective_number} goal achievement.
Objective directory: {objective_dir}
Objective goal: {goal from ROADMAP.md}
Objective requirement IDs: {objective_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from TRD/JOB frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.
Draft VERIFICATION.md from `planning draft` and publish it with `node ~/.claude/aoforge/bin/aof-tools.cjs verification post {objective_number} --from <draft path>`.
The VERIFICATION frontmatter must carry `status: passed|gaps_found|human_needed` (optional `score:`); `verification post` reads it.
```

A 3.1.0 config stamp (this repo's own): `"aoforge": {"version": "3.1.0", "migrations_applied": ["0001", "0004",
"0007", "0009", "0012", "0013"], "upgraded_at": "<fixed ISO date>"}`. Use the fixed date 2026-10-01T09:00:00.000Z.
PROJECT.md frontmatter shape: `kind: cli`, `default_work: feature`. OBJECTIVE.md frontmatter: `work: feature`.

TRD/SUMMARY shapes to copy: any `.aoforge/objectives/80-adopt-migrates-legacy-projects/80-0N-*-TRD.md` and its
`80-0N-SUMMARY.md` (frontmatter `key-files.created/modified`, `requirements-completed`, a `## Self-Check: PASSED`
section). Keep fixture TRDs small: one TRD per objective, two tasks.
</codebase_examples>

<anti_patterns>
- No word in any fixture file, path, package name or commit message that reveals the plant: no "stub", "planted",
  "gap", "broken", "clean", "fixture" or "eval" inside the materialised repo. Fixture ids (A1..A6) live only in the
  builder and the key, never in the repo.
- Do not store the fixture repos as real files under `scripts/`: npm test globs `scripts/**/*.test.cjs`, and a
  nested `.aoforge/` tree inside this repository confuses tools that walk nested planning roots. File contents
  live as string literals in build.cjs and are materialised into a temp dir.
- Fixture tests inside the materialised repos are named `test/*.test.js`, never `.test.cjs`.
- No generated content (`no_llm_test_data`): write every file by hand.
- No pre-rename product name anywhere (the rename guard scans the tree).
</anti_patterns>

<error_recovery>
- `validate health` reports an error on a fixture: fix the fixture template (missing STATE.md section, ROADMAP
  shape), not the check. Warnings are allowed but must be identical across each clean/planted pair and are recorded
  in the key as `health_warnings`.
- `upgrade --check` reports pending migrations: complete `migrations_applied` to what this checkout's upgrade
  expects for a fresh 3.1.0 project, then re-run.
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md (written by 81-02 in the same wave; if absent, use the field names below)
@plugins/aoforge/agents/verifier.md (what it checks: truths, artifacts levels, key_links, requirements)

Runtime model: every subprocess the proof test starts (git, node, aof-tools) runs with `cwd` = the materialised
fixture under `fs.mkdtempSync(os.tmpdir())` and `HOME` = a separate mkdtemp fake home. Never the real HOME.
When running the test by hand, set `TMPDIR=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81-test-tmp`.
</context>

<gotchas>
- A clean fixture that is not genuinely complete turns a correct verifier verdict into a recorded false fail.
  Every must_haves truth, artifact and key_link of each clean twin must hold, and the proof test checks each one.
- The planted twins differ from their clean twin ONLY in the planted gap (plus the SUMMARY claiming completion).
  Same REQUIREMENTS.md, same ROADMAP shape, same commit sequence.
- The missing-file plant must break a success criterion (the command needs the file), so a verifier that only
  runs the tests does not see it, but a goal-backward verifier does.
- Deterministic git: set GIT_AUTHOR_NAME/EMAIL, GIT_COMMITTER_NAME/EMAIL, GIT_AUTHOR_DATE, GIT_COMMITTER_DATE per
  commit and `-c commit.gpgsign=false -c init.defaultBranch=main`; never read the user's git config
  (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`).
- `verify objective-evidence` may flag the missing file itself. Record what it says per fixture in the key
  (`evidence_flags`); the scorer reports mechanical-assisted detections separately.
</gotchas>

## Fixture specification

Common to all six: Node CommonJS CLI, `package.json` `{ "name": "<domain>", "version": "1.0.0", "private": true,
"scripts": { "test": "node --test" } }`, no dependencies, `src/cli.js` entry, tests in `test/*.test.js`.
Planning tree: `.aoforge/{PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json}` and
`.aoforge/objectives/01-<slug>/{OBJECTIVE.md, 01-01-<slug>-TRD.md, 01-01-SUMMARY.md}`; ROADMAP Objective 1 lists its
TRD ticked. Commits: scaffold, plan, implementation, tests, SUMMARY (five commits, dates 2026-10-01T10:00Z plus 10
minutes each, author `Fixture Author <author@example.invalid>`, messages in the `type(01-01): ...` form).

| Id | Domain (package) | Objective 1 goal | Success criteria (commands from the repo root) | Variant |
|----|------------------|------------------|-----------------------------------------------|---------|
| A1 | textkit | `textkit slug <text>` prints a URL slug of any text | `node src/cli.js slug "Hello, World!"` -> `hello-world`; `node src/cli.js slug "  Ünïcode Text  "` -> `unicode-text`; `slugify` exported from `src/slugify.js` with tests | clean: NFKD, strip marks, lowercase, non-alphanumerics to `-`, trim dashes |
| A4 | textkit | same | same | planted stub: `slugify` returns `'hello-world'` for every input; tests check only `"Hello, World!"` |
| A2 | tempconv | `tempconv k <celsius>` prints the Kelvin value | `node src/cli.js k 0` -> `273.15`; `node src/cli.js k -273.15` -> `0`; `toKelvin` exported from `src/kelvin.js` with tests | clean: cli routes `k` to `toKelvin` |
| A6 | tempconv | same | same | planted never-wired: `src/kelvin.js` and its tests exist and pass; `src/cli.js` has `f` and `c` only (usage text lists `k`), never requires `./kelvin`; `k` prints usage and exits 1 |
| A3 | notes | `notes report` prints a per-tag count of `notes.json` | `node src/cli.js report` -> lines `tag: count` sorted by tag; `formatReport` exported from `src/report.js` with tests | clean: report.js present and used |
| A5 | notes | same | same | planted missing file: SUMMARY lists `src/report.js` and `test/report.test.js` as created; neither exists; `src/cli.js` requires `./report.js` inside the `report` case, so the command fails with MODULE_NOT_FOUND; the other tests pass |

Answer key entries (`answer-key.json`): `{ "batch": "A", "fixtures": [ { "id", "domain", "objective": "1",
"expected": "passed" | "gaps_found", "planted": null | { "kind": "stub" | "unwired" | "missing_file",
"artifact", "must_mention": [...], "any_of": [...] }, "evidence_flags": bool, "health_warnings": [...] } ] }`.
Tokens (case-insensitive): A4 must_mention `["slugify"]`, any_of `["hard-coded", "hardcoded", "hard coded",
"constant", "stub", "placeholder", "always return", "fixed value", "ignores its input", "same value"]`; A6
must_mention `["kelvin"]`, any_of `["cli", "wired", "import", "require", "route", "command", "usage"]`; A5
must_mention `["report.js"]`, any_of `["missing", "does not exist", "doesn't exist", "absent", "not found",
"MODULE_NOT_FOUND", "no such file"]`.

## Test list

Outermost first.
1. Each of A1..A6 builds into an empty temp dir; two builds of one id give identical file lists and contents and
   identical `git log --format=%s%n%an%n%ad`.
2. For each fixture, `validate health --raw` (this checkout's aof-tools, fake HOME) has no errors; warnings equal
   the key's `health_warnings`; `upgrade --check` reports nothing pending.
3. For each clean fixture (A1, A2, A3): every success-criterion command gives its expected output, every SUMMARY
   key-file and TRD must_haves artifact exists, every key_link pattern matches its file, `node --test` passes.
4. A4: `slugify("Ünïcode Text")` and `slugify("Other Text")` both return `hello-world`; `node --test` passes; on
   A1 the same calls return `unicode-text` and `other-text`.
5. A6: `node src/cli.js k 0` exits 1 without `273.15` in stdout; `src/cli.js` contains no `kelvin` require;
   `require('./src/kelvin.js').toKelvin(0) === 273.15`; `node --test` passes; on A2 the command prints `273.15`.
6. A5: `src/report.js` and `test/report.test.js` are absent while the SUMMARY lists both; `node src/cli.js report`
   exits non-zero with `MODULE_NOT_FOUND` in stderr; `node --test` passes; on A3 the command prints the counts.
7. `verify objective-evidence 1 --raw` output for each fixture matches the key's `evidence_flags`.
8. The materialised repos contain none of the revealing words in file contents, paths or commit messages.
9. answer-key.json has six entries, three `passed` with `planted: null` and three `gaps_found` with a planted
   block whose `artifact` matches the spec table.

<tasks>

<task type="auto">
  <name>Task 1: Fixture builder for A1..A6</name>
  <files>scripts/eval81/fixtures/A/build.cjs</files>
  <action>
Write `build.cjs` exporting `FIXTURES` (the six ids), `buildFixture(id, dir)` and `describeFixture(id)` (domain,
variant; used by the scorer and never written into the repo). Structure: one `domainFiles(domain)` returning the
shared files as a `{relPath: content}` map, a `variant(id)` overlay that replaces only the planted files, the
planning files, and a small local `gitCommit(dir, files, message, isoDate)` helper (spawnSync git with the
deterministic env in the gotchas). This helper is deliberately local to the A builder so the fixture TRDs of this
wave stay independent.

Write each file by hand to the spec table. The clean implementations must be correct for the success criteria;
the planted twin overlays exactly one change. SUMMARYs claim completion in the same words for each twin pair.
  </action>
  <verify>node -e "const b=require('./scripts/eval81/fixtures/A/build.cjs');const fs=require('fs'),os=require('os'),p=require('path');for(const id of b.FIXTURES){const d=fs.mkdtempSync(p.join(os.tmpdir(),'a-'));b.buildFixture(id,d);console.log(id,fs.readdirSync(d).join(','))}" run with TMPDIR set to the session scratchpad</verify>
  <done>All six ids build; each has a `.git`, `.aoforge`, `src`, `test` and `package.json`.</done>
  <recovery>If a domain's clean implementation fails its own success criterion, fix the implementation before writing proofs; never weaken the criterion.</recovery>
</task>

<task type="auto">
  <name>Task 2: Answer key and planted-defect proofs</name>
  <files>scripts/eval81/fixtures/A/answer-key.json, scripts/eval81/fixtures/A/proofs.test.cjs</files>
  <action>
<!-- TDD-EXCEPTION: the fixtures are test infrastructure; these proofs ARE the tests, written against the builder from Task 1. Each planted predicate is also asserted false on its clean twin, which is the red/green pairing for a fixture. -->
Write the proofs per test list 1-9 (one `test(...)` per case, named after the behaviour). Run aof-tools as
`node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs <cmd>` with `cwd` = the fixture and `env` = `{...minimal,
HOME: fakeHome}`. For case 7, run the verb once by hand per fixture, record `evidence_flags` in the key, then
assert it. Write answer-key.json per the spec (pretty JSON, fixtures in id order).

Commit with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "test(81-03): add test A verifier fixtures, answer key and proofs" --files scripts/eval81/fixtures/A/build.cjs scripts/eval81/fixtures/A/answer-key.json scripts/eval81/fixtures/A/proofs.test.cjs`.
  </action>
  <verify>node --test scripts/eval81/fixtures/A/proofs.test.cjs (TMPDIR under the session scratchpad)</verify>
  <done>Test list 1-9 pass; the key has six entries matching the spec table.</done>
  <recovery>If a proof fails because the plant is not real (for example the stub passes case 4 on A1 too), fix the builder, rebuild, and re-run; never edit the proof to match a wrong fixture.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/fixtures/A/proofs.test.cjs</test>
<test>node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs</test>
</validation_gates>

<verification>
- The proof test passes and leaves nothing under the repo (all output in temp dirs).
- `git status --porcelain` after the commit shows no stray files from fixture builds.
</verification>

<success_criteria>
Six deterministic fixtures, three clean and three with exactly one real, proven gap; an answer key with match
tokens; all committed before any live run.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-03-SUMMARY.md`
</output>
