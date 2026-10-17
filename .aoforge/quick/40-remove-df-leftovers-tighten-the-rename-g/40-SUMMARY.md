---
objective: quick-40
trd: 01
subsystem: model-resolution, rename-guard, docs
tags: [rename, df-prefix, resolve-model, rename-guard, tests]
requires: []
provides:
  - bare-name-only agent model resolution (resolve-model and every compound init command)
  - scoped installName token in the rename guard
  - root skip for the verify-completion unwritable-path test
affects: [resolve-model, init, rename-guard.repo.test.cjs, references/model-profiles.md]
tech-stack:
  added: []
  patterns: [scoped guard token with lazy tree read, init-wide sentinel override regression]
key-files:
  created: []
  modified:
    - plugins/aoforge/aoforge/bin/lib/init.cjs
    - plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs
    - plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs
    - plugins/aoforge/aoforge/bin/lib/trd-pre-check.cjs
    - plugins/aoforge/aoforge/references/model-profiles.json
    - plugins/aoforge/aoforge/references/model-profiles.md
    - plugins/aoforge/aoforge/references/escalation-policy.md
    - plugins/aoforge/aoforge/templates/codebase/structure.md
    - docs/USER-GUIDE.md
    - site/content/docs/configuration/model-profiles.md
    - plugins/aoforge/hooks/verify-completion.test.js
    - CHANGELOG.md
decisions:
  - "Model resolution reads bare agent names only; a df- prefixed name takes the existing unknown-agent path (stderr warning, sonnet fallback), with no special case"
  - "The rename guard's installName token is scoped to the user-facing set and builds its name list lazily from plugins/aoforge/agents and plugins/aoforge/skills, prefix from LEGACY.installPrefix"
metrics:
  completed: 2026-10-17
  tasks: 3
  commits: 7
  files: 12
status: complete
---

# Quick 40: Remove df- leftovers, tighten the rename guard Summary

Model resolution now reads bare agent names only (23 init call sites made bare first, then the `df-` alias removed),
the rename guard fails on `df-<agent>`/`df-<skill>` in user-facing files (proven RED on 27 findings, then the five
docs reworded), and the verify-completion unwritable-path test skips under root.

## Progress
- [x] Task 1: Model resolution reads bare agent names only (callers first) — a3d45d0f (RED), 25927b5e (callers), cc56fce0 (GREEN)
- [x] Task 2: Rename guard fails on df-agent and df-skill names in user-facing files, then reword them — 774101e3 (RED), c50c4ed4 (GREEN)
- [x] Task 3: Root skip in verify-completion test, changelog, full-suite gate — 556f8518 (root skip), 9ff86db7 (changelog)

## BASE and totals

- BASE: `5fccd65def45f23622cd24295bd4a9b7483c41b3` (branch `integrate/3.1.0`)
- Full suite, scratch HOME `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/home-q40`,
  the `npm test` globs minus `plugins/aoforge/aoforge/bin/lib/watcher-shell.test.cjs` (411 files):

| Run | tests | suites | pass | fail | skipped |
|---|---|---|---|---|---|
| BASE | 12862 | 2124 | 12833 | 2 | 27 |
| End (9ff86db7) | 12869 | 2125 | 12840 | 2 | 27 |

The +7 tests are the new ones (model-profiles +2, rename-guard +5); `skipped` is unchanged for a non-root run.
The 2 failures are pre-existing at BASE and unchanged: `requirements-agreement.repo.test.cjs` test 11 and
`validate-requirements.test.cjs` test 9 (objectives 76/77 VERIFICATION mark MEF-02..05, PCK-01..04 and STK-01
satisfied, but no SUMMARY of those objectives lists them in `requirements-completed`). Not touched.

Scoped set (scratch HOME), per file:

| File | BASE | After T1 RED | After callers | After T1 GREEN | After T2 RED | End |
|---|---|---|---|---|---|---|
| model-profiles.test.cjs | 32/32 | 34: 31 pass, 3 fail | 34: 31 pass, 3 fail | 34/34 | 34/34 | 34/34 |
| model-profile-binding.test.cjs | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| init.test.cjs | 41/41 | 41/41 | 41/41 | 41/41 | 41/41 | 41/41 |
| config.test.cjs | 33/33 | 33/33 | 33/33 | 33/33 | 33/33 | 33/33 |
| trd-pre-check.test.cjs | 50/50 | 50/50 | 50/50 | 50/50 | 50/50 | 50/50 |
| rename-guard.repo.test.cjs | 20/20 | 20/20 | 20/20 | 20/20 | 25: 24 pass, 1 fail | 25/25 |
| doc-refs.repo.test.cjs | 17/17 | 17/17 | 17/17 | 17/17 | 17/17 | 17/17 |
| legacy-names.legacy.test.cjs | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| verify-completion.test.js | 42/42 | 42/42 | 42/42 | 42/42 | 42/42 | 42/42 |
| planning-writes.repo.test.cjs | 11/11 | | | | | 11/11 |
| builtin-sweep.repo.test.cjs | 17/17 | | | | | 17/17 |

Gotcha baseline confirmed: model-profiles + rename-guard.repo + verify-completion + model-profile-binding = 100 tests,
100 pass at BASE.

## Task 1 RED failures (a3d45d0f)

- `a df- prefixed agent name is an unknown agent`: `df-codebase-mapper: expected unknown_agent, got {"model": "haiku", ... "agent": "codebase-mapper", "tier_source": "table"}`
- `7. a df- prefixed agent_models key does not bind: the table tier applies`: `tier_source` was `'agent_models'`, expected `'table'`
- `7b. a df- prefixed model_overrides key does not bind`: `tier_source` was `'model_overrides'`, expected `'table'`
- `9. every compound init command resolves bare agent names (sentinel override)`: green at BASE, after the callers
  commit and after GREEN, as required.

Extra proof (not committed): with only `normalizeAgentKey` and `overrideFor` stripped of the alias and the callers
still prefixed, test 9 failed on all 33 sentinel values across the nine init commands (`init execute-objective
executor_model="sonnet"` ... `init progress planner_model="sonnet"`). That is the regression the callers-first
order guards against. The probe was reverted with `git checkout` before the callers commit.

After GREEN: `resolve-model df-planner` prints `aof-tools resolve-model: unknown agent "df-planner" — no entry in
references/model-profiles.json. Falling back to 'sonnet'; ...` on stderr and `"unknown_agent": true`,
`"requested": "df-planner"`. `resolve-model planner --raw` prints `inherit`, as at BASE. `rg -n "df-" init.cjs`
prints nothing.

## Task 2 RED failure message (774101e3)

```
27 legacy name(s) in the tree (rename them, or, only for a file that must spell the
old name, add a justified ALLOW entry):
  docs/USER-GUIDE.md:818  df-planner
  docs/USER-GUIDE.md:819  df-roadmapper
  docs/USER-GUIDE.md:820  df-executor
  docs/USER-GUIDE.md:821  df-objective-researcher
  docs/USER-GUIDE.md:822  df-project-researcher
  docs/USER-GUIDE.md:823  df-research-synthesizer
  docs/USER-GUIDE.md:824  df-debugger
  docs/USER-GUIDE.md:825  df-codebase-mapper
  docs/USER-GUIDE.md:826  df-verifier
  docs/USER-GUIDE.md:827  df-job-checker
  docs/USER-GUIDE.md:828  df-integration-checker
  docs/USER-GUIDE.md:829  df-security-auditor
  plugins/aoforge/aoforge/references/escalation-policy.md:25  df-verifier
  plugins/aoforge/aoforge/references/model-profiles.md:136  df-planner
  plugins/aoforge/aoforge/references/model-profiles.md:194  df-executor
  plugins/aoforge/aoforge/references/model-profiles.md:195  df-planner
  plugins/aoforge/aoforge/references/model-profiles.md:201  df-planner
  plugins/aoforge/aoforge/references/model-profiles.md:204  df-executor
  plugins/aoforge/aoforge/references/model-profiles.md:210  df-codebase-mapper
  plugins/aoforge/aoforge/templates/codebase/structure.md:129  df-plan-objective/
  plugins/aoforge/aoforge/templates/codebase/structure.md:129  df-debug/
  plugins/aoforge/aoforge/templates/codebase/structure.md:151  df-new-project/SKILL.md
  plugins/aoforge/aoforge/templates/codebase/structure.md:151  df-plan-objective/SKILL.md
  plugins/aoforge/aoforge/templates/codebase/structure.md:151  df-execute-objective/SKILL.md
  plugins/aoforge/aoforge/templates/codebase/structure.md:152  df-plan-objective/
  plugins/aoforge/aoforge/templates/codebase/structure.md:152  df-debug/
  site/content/docs/configuration/model-profiles.md:43  df-planner
```

The findings, files and line numbers are exactly the ones the JOB listed: 27 findings in 5 files. They fall on 23
distinct lines, not 22. The JOB's own list adds up to 23 (12 USER-GUIDE rows + 1 + 6 + 3 + 1), so its "22" is a
miscount. No unexpected hit, so the token was not narrowed. After the rewording, `rg -n "df-"` on the six files shows
only live conventions and history: USER-GUIDE:23 (inside an ignore region), :123 (doctor check id
`legacy-df-install`) and :404 (`~/.claude/skills/df-*` glob). None of them matches the token.

## Fake-root skip proof (Task 3)

`node --test-reporter=tap --require <scratchpad>/fake-root.cjs plugins/aoforge/hooks/verify-completion.test.js`:

```
ok 3 - returns ok:false on filesystem error (unwritable path) # SKIP
# tests 42  # pass 41  # skipped 1
```

As non-root (`node --test --test-name-pattern=unwritable`), the test runs and passes (`ok 1 - returns ok:false on
filesystem error (unwritable path)`, skipped 0).

## Commits

| Hash | Message |
|---|---|
| a3d45d0f | test(quick-40): a df- prefixed agent name is an unknown agent (RED) |
| 25927b5e | refactor(quick-40): compound init commands pass bare agent names |
| cc56fce0 | fix(quick-40): drop the df- agent alias from model resolution (GREEN) |
| 774101e3 | test(rename-guard): fail on df- prefixed agent and skill names in user-facing files (RED) |
| c50c4ed4 | docs(quick-40): bare agent and skill names in references, templates and guides (GREEN) |
| 556f8518 | test(hooks): skip the unwritable-path audit-log test under root |
| 9ff86db7 | docs(quick-40): changelog |

All made through `aof-tools commit`, in the order the JOB requires. `git diff BASE --stat` lists exactly the 12
`files_modified`. `git diff BASE -G 8080` is empty. Nothing pushed, tagged or released. ROADMAP.md and the untracked
`amp` file are untouched.

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: bare-name resolution | scoped set (run-scoped.cjs); `resolve-model df-planner`; `resolve-model planner --raw`; `rg -n "df-" init.cjs` | 0 / 0 / 0 / 1 (no match) | PASS |
| 2: rename guard + rewording | `node --test rename-guard.repo.test.cjs` (RED exit 1, 27 findings; GREEN exit 0, 25/25); scoped set + planning-writes + builtin-sweep | 0 | PASS |
| 3: root skip, changelog, full suite | `node --test --test-name-pattern=unwritable verify-completion.test.js` (0, runs); fake-root `--require` run (0, `# SKIP`); full suite (2 pre-existing failures, none new) | 0 / 0 / 1 (pre-existing) | PASS |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| T1 RED | `node --test model-profiles.test.cjs` | 1 (3 fail) | FAIL (correct) |
| T1 callers | `node --test model-profiles.test.cjs` | 1 (same 3 fail, sentinel test green) | FAIL (correct) |
| T1 GREEN | `node --test model-profiles.test.cjs` | 0 (34/34) | PASS (correct) |
| T2 RED | `node --test rename-guard.repo.test.cjs` | 1 (test 2, 27 findings) | FAIL (correct) |
| T2 GREEN | `node --test rename-guard.repo.test.cjs` | 0 (25/25) | PASS (correct) |

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | `npm test` globs via `node --test` (watcher-shell excluded, scratch HOME) | 1 | PASS against BASE (the same 2 pre-existing failures, no new failure) |

## Deviations from Plan

- **Call-site count:** the JOB says 22 prefixed `resolveModelInternal` call sites, but its own line list (386,
  602-603, 727-729, 878, 881-882, 919, 921-922, 963-966, 1033-1034, 1249, 1252, 1280, 1394-1395) gives 23, and
  `rg` found 23. All 23 were changed in 25927b5e.
- **RED line count:** 27 findings on 23 lines, not 22 (see above). Same findings as listed.
- **Test numbering in model-profiles.test.cjs:** Test list 4 is `7b.` beside the replaced test 7, and Test list 5 is
  `9.`, placed after the existing test 8.
- No file was edited on a recovery path. No unrelated suite asserted that a `df-` spelling resolves, so none needed an
  update.

## Follow-up candidates

- `plugins/aoforge/aoforge/bin/lib/benchmark.cjs:353` compares `r.agentType === 'df-executor'`. That never matches an
  AOForge transcript, so `executor_calls` is always 0. Left alone as decision 6 requires.
- The two pre-existing planning-state failures (requirements-agreement test 11, validate-requirements test 9) need
  objectives 76/77 SUMMARYs to list MEF-02..05, PCK-01..04 and STK-01 in `requirements-completed`.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: 7/7
- Gate failures: None new (the 2 full-suite failures are pre-existing at BASE)

## Self-Check: PASSED

- All 12 modified files exist and are in `git diff BASE --stat`.
- All 7 commits are present in `git log BASE..HEAD`, in order.
