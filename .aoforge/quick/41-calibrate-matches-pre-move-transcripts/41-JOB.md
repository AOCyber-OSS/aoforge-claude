---
objective: quick-41
trd: 01
type: standard
wave: 1
depends_on: []
files_modified:
  - plugins/aoforge/aoforge/bin/lib/token-usage.cjs
  - plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs
  - plugins/aoforge/aoforge/bin/lib/agent-overhead.cjs
  - plugins/aoforge/aoforge/bin/lib/agent-overhead.test.cjs
  - plugins/aoforge/aoforge/bin/lib/legacy-names.cjs
  - plugins/aoforge/aoforge/bin/lib/calibrator.cjs
  - plugins/aoforge/aoforge/bin/lib/calibrator.test.cjs
  - plugins/aoforge/aoforge/bin/lib/calibrate-cli.cjs
  - plugins/aoforge/aoforge/bin/lib/calibrate-cli.test.cjs
  - plugins/aoforge/aoforge/bin/lib/help.cjs
  - plugins/aoforge/aoforge/bin/aof-tools.cjs
  - docs/USER-GUIDE.md
  - docs/AOF-TOOLS-REFERENCE.md
  - CHANGELOG.md
autonomous: true
must_haves:
  truths:
    - "`aof-tools calibrate --also-root <dir>` (repeatable; relative paths resolve against cwd) makes the agent-overhead scan claim spawns recorded under that former checkout root and label them as the one project. A spawn is claimed when it has a REPO_ROOT line naming the root, a first-record cwd inside it or inside `<dirname(root)>/.df-worktrees/<basename(root)>/`, or a prompt path under `<root>/.aoforge/` or `<root>/<LEGACY.planningDir>/`. The root does not have to exist on disk"
    - "The project root itself still matches only `.aoforge/` paths. No legacy planning directory is added for it, and `PLANNING_DIR_NAMES` is unchanged. Executor-transcript indexing (`tokens trd|stamp|backfill|coverage`) behaves exactly as at BASE"
    - "Without `--also-root` the calibration is byte-identical to BASE. In unit tests, `method` has exactly the keys `minutes`, `window_objectives` and `through_objective`, and `alsoRoots: []` gives the same bytes. On real data, the BASE tree and HEAD write identical files (`cmp`) for `--window 10 --minutes trd_level --through 66`"
    - "With `--also-root`, `method.also_roots` holds the sorted, de-duplicated absolute roots. It is therefore part of `inputs_digest`, a note names it, and a rerun on unchanged inputs is byte-identical (`changed: false`)"
    - "Usage errors exit 1 and write nothing: `--also-root` with no value, with `--no-overhead`, with more than one project under `--paths`, and a root that contains the project root. A root equal to the project root is dropped silently"
    - "The live ~/.claude/aoforge/calibration.json is rebuilt with the frozen method (trd_level, window 10, through 66) plus `--also-root /Users/justin/dev/devflow-claude`. The dry run, before any write, shows overhead `matched` >= 127 and every agent at or above its 2026-10-08 count (planner 36, job-checker 32, verifier 41, objective-researcher 11, integration-checker 5, roadmapper 2), with 75 TRDs, 177 tasks and 72 with tokens. The prior file is backed up to the scratchpad and its sha256 recorded"
    - "`npm test` with a scratch HOME shows no new failures against BASE. Nothing is pushed, tagged or released, and the diff adds no port 8080"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/token-usage.cjs
      provides: "`repoMatcher(repoRoot, { alsoRoots })`: former roots join isRepo, contains, inWorktree and planningPrefixes (current and legacy planning dir for aliases only)"
    - path: plugins/aoforge/aoforge/bin/lib/agent-overhead.cjs
      provides: "`indexOverheadTranscripts` / `collectOverhead` accept `projects[i].alsoRoots`"
    - path: plugins/aoforge/aoforge/bin/lib/calibrator.cjs
      provides: "`buildCalibration({ alsoRoots })`: normalise, validate, pass to the overhead scan, record `method.also_roots` only when non-empty"
    - path: plugins/aoforge/aoforge/bin/lib/calibrate-cli.cjs
      provides: "repeatable `--also-root <dir>` flag, usage errors, ` · also roots ...` in the --raw line"
  key_links:
    - from: "calibrate-cli.cjs parseArgs `--also-root` (list)"
      to: "calibrator.buildCalibration `alsoRoots`"
      via: "runCalibrate resolves each against cwd and passes the array"
    - from: "calibrator.buildCalibration"
      to: "agent-overhead.collectOverhead `projects[0].alsoRoots`"
      via: "the normalised list, only for the single discovered project"
    - from: "agent-overhead.indexOverheadTranscripts"
      to: "token-usage.repoMatcher(root, { alsoRoots })"
      via: "repoMatch(prompt, rec.cwd, repo) unchanged; the matcher widens"
    - from: "calibrator method block"
      to: "inputs_digest"
      via: "payload.method = method (the existing rule), so also_roots is hashed only when present"
---

## Objective

`aof-tools calibrate` measures agent overhead (planner, job-checker, verifier, researcher, integration checker,
roadmapper) from subagent transcripts, which a repository claims through `token-usage.repoMatch`. TRD 72-26 moved
the checkout from `~/dev/devflow-claude` to `~/dev/aoforge-claude`. Every spawn recorded before the move names the old
path, so the overhead scan now treats it as foreign. On 2026-10-08 the scan matched 127 spawns. Today it matches 22
(planner 8, job-checker 7, verifier 7, as measured at planning time; the orchestrator saw 16 earlier), and
integration-checker, objective-researcher and roadmapper have no samples at all.

Fix (user decision): add `calibrate --also-root <path>`, repeatable. It names former checkout roots whose spawns
still belong to the project. This is historical-data matching only: core matching for the project root does not
change. Then rebuild the live calibration with the frozen method and report old and new overhead counts and dollars.
Sonnet 5.5 cache reads are now priced at 0.05x input (cd6bbbc5, already in `references/model-rates.json`).

Quick mode: one JOB, three tasks, tests first. `<repo>` is `/Users/justin/dev/aoforge-claude` on `integrate/3.1.0`
(unless the orchestrator names a worktree). Planning mode is `local`.

**Sequencing:** quick 40 is committing on this branch and also edits `CHANGELOG.md` and `docs/USER-GUIDE.md`. Start
only after quick 40's last commit, and re-read both files before you edit them.

## Locked decisions

1. **Flag shape.** `--also-root <dir>` is repeatable and resolves relative paths against cwd. It affects only the
   agent-overhead scan. Do not add it to `tokens` (that is a follow-up; see output).
2. **Alias matching rule.** An alias root gets the same tests as the project root: REPO_ROOT equality, cwd inside it,
   cwd inside its `.df-worktrees/<basename>` base, and planning-path prefixes. The prefixes use both the current
   planning directory and `LEGACY.planningDir`. **The project root keeps `PLANNING_DIR_NAMES` only.** Do not touch
   `compat.cjs`.
3. **One project.** A non-empty alias list with more than one discovered project is an error, because the aliases
   could not say which project they belong to. Zero projects falls through to the CLI's existing "no AOForge project"
   refusal.
4. **Safety.** An alias equal to the project root (after resolve/realpath) is dropped. An alias that contains the
   project root (an ancestor, such as `~/dev`) is an error, because it would claim every checkout under it. Aliases
   without a transcripts root (`--no-overhead`) are an error.
5. **Method block and digest.** `method.also_roots` is the sorted (by code unit), de-duplicated list of resolved
   absolute roots. It is present **only when non-empty**, so a build without the flag keeps today's bytes and
   digest. Because it sits in `method`, the existing `payload.method = method` puts it in `inputs_digest`, so an
   aliased build's digest depends on the path. That is accepted: an alias is a machine path by nature. Do not bump
   `CALIBRATION_VERSION`. Readers pass `method` through and read only `minutes`, `window_objectives` and
   `through_objective`. When it is non-empty, add one note: `Agent overhead also counts spawns recorded under the
   former checkout roots in method.also_roots (REPO_ROOT line, cwd or worktree there, or a path under their current
   or legacy planning directory).`
6. **Recalibration** uses the repo CLI (it is the only CLI with the flag) and the real HOME, with every input passed
   explicitly. Write the live file only after the dry run meets the acceptance floors in must_haves truth 6.

## Test list

Task 1, in `token-usage.test.cjs` and `agent-overhead.test.cjs`. OLD is a former root that does **not** exist on
disk, like the real one, for example `path.join(path.dirname(repo), 'former-' + path.basename(repo))`, never created.

1. `repoMatcher(repo, { alsoRoots: [OLD] })` + `repoMatch`: a prompt whose REPO_ROOT names OLD → `'repo_root'`. The
   same prompt with no alsoRoots → `null`. A REPO_ROOT naming a third path still → `null`, even when cwd is in OLD.
2. With no REPO_ROOT: cwd `OLD/sub` → `'cwd'`. Cwd `<dirname(OLD)>/.df-worktrees/<basename(OLD)>/42-12` → `'worktree'`.
   Cwd `OLD + '-other'` → `null` (prefix boundary).
3. With no REPO_ROOT and cwd elsewhere: a prompt naming `OLD/.aoforge/objectives/x` → `'path'`, and one naming
   `` `${OLD}/${LEGACY.planningDir}/objectives/x` `` → `'path'`. A prompt naming
   `` `${repo}/${LEGACY.planningDir}/objectives/x` `` → `null`, because the project root gets no legacy planning
   directory.
4. `repoMatcher(repo)` and `repoMatcher(repo, { alsoRoots: [] })` deep-equal on `planningPrefixes`, and every existing
   token-usage test stays green unchanged.
5. `alsoRoots` that is not an array, or holds a relative path, a non-string or an empty string, throws a TypeError
   whose message names `alsoRoots`.
6. `indexOverheadTranscripts({ root, projects: [{ root: R, label: 'repo-r', alsoRoots: [OLD] }] })` matches a planner
   spawn with cwd OLD and a job-checker spawn with cwd in OLD's worktree base, both with `project: 'repo-r'`. Without
   `alsoRoots` both count as `foreign`. In both runs `spawns === matched + foreign + quick + unreadable`.
7. `collectOverhead` with `alsoRoots` twice → deep-equal.

Task 2, in `calibrator.test.cjs` (library) and then `calibrate-cli.test.cjs` (end to end, fake HOME, `--root` a
fixture projects root):

8. `buildCalibration` without `alsoRoots` and with `alsoRoots: []` → identical `stableStringify` output, and
   `Object.keys(cal.method).sort()` deep-equals `['minutes', 'through_objective', 'window_objectives']`.
9. A fixture with one planner spawn under the project and one verifier spawn with cwd OLD (OLD not created):
   `alsoRoots: [OLD]` → `agent_overhead.verifier.samples` goes from 0 to 1, `agent_overhead_sources.matched` rises by
   1 and `foreign` falls by 1. `method.also_roots` deep-equals `[OLD]`, a note contains `method.also_roots`, and
   `inputs_digest` differs from the build without aliases. Building it twice gives identical bytes.
10. Normalisation: `[OLD, OLD + '/', OLD]` → `[OLD]`. `[B, A]` and `[A, B]` → identical bytes with `[A, B]`
    recorded. An alias equal to the project root, alone → no `also_roots` key, and the bytes match the no-alias
    build.
11. Errors (each `assert.throws` with a message naming the cause): aliases with `transcriptsRoot` null; aliases with
    two projects under `paths`; an alias that is an ancestor of the project root.
12. CLI: `--also-root <OLD>` given twice, once relative to cwd. The JSON `result.method.also_roots` is `[OLD]`, the
    verifier is counted in `result.overhead.agents`, and the `--raw` line contains ` · also roots `. The same
    command again gives `changed: false` and an identical file.
13. CLI usage errors exit 1, print the usage line and leave `--out` absent: `--also-root` with no value (`needs a
    value`); `--also-root x --no-overhead`; two projects under `--paths` with `--also-root` (the library message);
    an ancestor alias.
14. `calibrate --help` usage contains `--also-root`.

## Embedded context

<embedded_context>
<codebase_examples>
`token-usage.cjs` today (lines ~229-271). The alias change goes here:

```js
function within(p, base) { return p === base || p.startsWith(base + path.sep); }

function repoMatcher(repoRoot) {
  const given = path.resolve(repoRoot);
  const real = realOrResolved(given);
  const cache = new Map();
  const canon = (p) => { if (!cache.has(p)) cache.set(p, realOrResolved(p)); return cache.get(p); };
  // exec-context provisions every executor worktree at <dirname(repo)>/.df-worktrees/<basename(repo)>/<id>.
  const worktreeBases = [...new Set([given, real])].map((r) => path.join(path.dirname(r), '.df-worktrees', path.basename(r)));
  return {
    isRepo: (p) => canon(p) === real,
    contains: (p) => within(canon(p), real),
    inWorktree: (p) => { const c = canon(p); return worktreeBases.some((b) => c.startsWith(b + path.sep)); },
    planningPrefixes: [...new Set([given, real])].flatMap((r) => PLANNING_DIR_NAMES.map((dir) => `${r}/${dir}/`)),
  };
}

function repoMatch(prompt, cwd, repo) {           // unchanged by this JOB
  const declared = trdIdentify.repoRootOf(prompt);
  if (declared) return repo.isRepo(declared) ? 'repo_root' : null;
  if (typeof cwd === 'string' && path.isAbsolute(cwd)) {
    if (repo.contains(cwd)) return 'cwd';
    if (repo.inWorktree(cwd)) return 'worktree';
  }
  if (repo.planningPrefixes.some((p) => prompt.includes(p))) return 'path';
  return null;
}
```

`agent-overhead.cjs` builds one matcher per project (line ~155):

```js
const repos = [...projects]
  .sort((a, b) => byCodeUnit(a.root, b.root))
  .map((p) => ({ label: p.label, repo: repoMatcher(p.root) }));   // → repoMatcher(p.root, { alsoRoots: p.alsoRoots || [] })
```

`calibrator.cjs` buildCalibration (lines ~448-525): `method` is built at :455 and the overhead scan at :496-502:

```js
const method = { minutes: effectiveMinutes, window_objectives: effectiveWindow, through_objective: effectiveThrough };
...
const projectRoots = ci.discoverProjects(paths);
...
const scanned = typeof transcriptsRoot === 'string' && transcriptsRoot !== '';
const overhead = scanned
  ? collectOverhead({ root: transcriptsRoot, projects: projectRoots.map((root, i) => ({ root, label: projectList[i].label })) })
  : { samples: [], counts: { ...NO_OVERHEAD_COUNTS } };
...
inputs_digest: inputsDigest(projectList, rates, sources, scanned ? normalizedOverhead(...) : null, windowBlock, method),
```

`calibrate-cli.cjs` parseArgs keeps one value per flag (`flags[name] = value`). `--also-root` needs a list.
`VALUE_FLAGS`/`BOOL_FLAGS` drive the loop, and `--root` with `--no-overhead` is the exclusivity precedent (:92). The
`--raw` line is built by `methodText(method)` (:178).

Fixtures: `__fixtures__/transcript-fixtures.cjs` has `writeOverheadTranscript(projectsRoot, { projectKey, session,
agentId, spawn, cwd, prompt })`, `PLANNER_SPAWN`, `VERIFIER_SPAWN`, `makeProjectsRoot()` and `projectKeyFor(cwd)`.
`calibrate-cli.test.cjs` `overheadRoot(repo)` (:418) and `calibrator.test.cjs` "58-03 agent_overhead" (:619) show
the pattern. Token-usage test 5b (:141) is the worktree-base precedent.

Pseudocode for the alias part of `repoMatcher(repoRoot, { alsoRoots = [] } = {})`:

```
validate alsoRoots: Array, each a non-empty absolute string, else TypeError('repoMatcher: alsoRoots must be absolute paths')
aliases     = alsoRoots.map(path.resolve);  aliasReals = aliases.map(realOrResolved)
reals       = unique([real, ...aliasReals])                 # isRepo: reals.includes(canon(p)); contains: reals.some(r => within(canon(p), r))
bases       = unique([given, real]) ++ unique([...aliases, ...aliasReals])  → each mapped to its .df-worktrees base
prefixes    = unique([given, real]) × PLANNING_DIR_NAMES     # first, same order as today
           ++ unique([...aliases, ...aliasReals]) × [...PLANNING_DIR_NAMES, LEGACY.planningDir]
# CRITICAL: with alsoRoots [] every field equals today's output (Test list 4)
```

Pseudocode for calibrator `alsoRoots`:

```
roots = normalise(alsoRoots ?? [])         # validate as above, path.resolve, unique, sort by code unit
if roots non-empty:
  if !scanned             → throw Error('alsoRoots (calibrate --also-root) needs the agent-overhead scan; it cannot be combined with --no-overhead')
  if projectRoots.length > 1 → throw Error(`alsoRoots (calibrate --also-root) needs exactly one project; found ${n}`)
  if projectRoots.length === 1:
    drop r where realOrResolved(r) === realOrResolved(projectRoots[0])
    if any r is an ancestor of projectRoots[0] (within(project, r)) → throw Error(`--also-root ${r} contains the project ${project}: it would claim every checkout under it`)
if roots non-empty: method.also_roots = roots; notes.push(ALSO_ROOTS_NOTE)
collectOverhead projects: [{ root, label, alsoRoots: roots }]
```
</codebase_examples>

<anti_patterns>
- Do not add `LEGACY.planningDir` to `PLANNING_DIR_NAMES` or to the project root's prefixes. That is the compat shim
  objective 78 removed, and Test list 3's last case pins it.
- Do not spell the old product, repo or planning-directory names in code, tests or docs. The rename guard
  (`rename-guard.repo.test.cjs`) fails on them outside `legacy-names.cjs`. Build them from `LEGACY`
  (`LEGACY.planningDir`, `LEGACY.repo`), or use neutral fixture names like `former-<x>`. In docs write "a former
  checkout path" and use `~/dev/old-checkout` as the example.
- Do not write an empty `also_roots` key, and do not add it to `method` before the drop/validate step, or the default
  build's bytes and digest change.
- Do not thread `alsoRoots` into `indexExecutorTranscripts`, `token-backfill` or `tokens-cli`.
- Do not read the real `~/.claude/projects` or `~/.claude/aoforge` from a test. Fixtures use their own projects root.
- Do not write the live calibration before the dry run passes its floors, and never with `--window`, `--minutes` or
  `--through` left to defaults.
</anti_patterns>

<error_recovery>
- If the real dry run falls short of a floor (matched < 127, or any agent below its 2026-10-08 count), do not write.
  Run `node /private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/q41/sim.cjs`.
  It is the planner's read-only simulation over the real transcripts: 164 matched with the alias, all by cwd. Compare
  its numbers with the dry run, find the case your matcher misses, add a Test list case for it, fix it and rerun.
- If the BASE vs HEAD `cmp` differs, diff the two files. A difference confined to `agent_overhead*` and
  `inputs_digest` means an overhead transcript changed between the runs (a concurrent spawn). Rerun both back to back
  once more. Any other difference is a regression in the default path: fix it before the live write.
- If an existing suite (rename-guard, legacy-names.legacy, flag-spec.repo, doc-refs) goes red after an edit, a pinned
  string or a legacy spelling caused it. Reword; never weaken the test.
</error_recovery>
</embedded_context>

<gotchas>
- **Scratch HOME for every test run:** `HOME=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/home-q41`
  (create it once). Leave TMPDIR alone. Never a HOME under `/var/folders`, which breaks three tests on macOS.
  **The real recalibration (Task 3) runs with the real HOME** and passes `--root /Users/justin/.claude/projects` and
  `--out` explicitly.
- **One plain command per Bash call.** The worktree isolation guard refuses compound commands, and zsh does not
  word-split an unquoted `$var`.
- **Commits** go through `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<msg>" --files <paths>`,
  because raw commits are gated.
- `legacy-names.cjs` header lists the LEGACY "history readers" (session-audit, agent-overhead). Add token-usage
  (former checkout roots for `calibrate --also-root`). Edit the comment only.
- `flag-spec.cjs` lists `calibrate` as `ownParser: true`, so it needs no per-flag entry. `flag-spec.repo.test.cjs`
  must stay green.
- `estimate-format.cjs` and `estimate-cli.cjs` read `method.minutes`, `window_objectives` and `through_objective` and
  pass `method` through. An extra key is harmless. Do not touch them.
- The project label is `basename(main root)`. The new live file therefore labels the project `aoforge-claude`, where
  the 2026-10-08 file said `devflow-claude`. Expect it and report it.
- The backup currently at `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/calibration.backup.json`
  (sha256 f4d1ffa9…) equals the live file. `scratchpad/model-rates.old.json` holds the 2026-10-05 rates the backup
  was priced with.
- Port 8080 is off limits. No push, tag or release.
</gotchas>

<validation_gates>
- task: `npm test` (`aof-tools stack command test` → `npm test`; `gates.task: [test]`). There is no lint, format or
  build gate.
- Scoped set after each commit, from `<repo>` with the scratch HOME:
  `node --test plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs plugins/aoforge/aoforge/bin/lib/agent-overhead.test.cjs plugins/aoforge/aoforge/bin/lib/calibrator.test.cjs plugins/aoforge/aoforge/bin/lib/calibrate-cli.test.cjs plugins/aoforge/aoforge/bin/lib/calibration-inputs.test.cjs plugins/aoforge/aoforge/bin/lib/token-backfill.test.cjs plugins/aoforge/aoforge/bin/lib/tokens-cli.test.cjs plugins/aoforge/aoforge/bin/lib/token-coverage.test.cjs plugins/aoforge/aoforge/bin/lib/estimate-cli.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-names.legacy.test.cjs plugins/aoforge/aoforge/bin/lib/flag-spec.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs`
  (drop any file that does not exist and say so in the SUMMARY).
</validation_gates>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The transcript matcher accepts former checkout roots</name>
  <files>plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs, plugins/aoforge/aoforge/bin/lib/agent-overhead.test.cjs, plugins/aoforge/aoforge/bin/lib/token-usage.cjs, plugins/aoforge/aoforge/bin/lib/agent-overhead.cjs, plugins/aoforge/aoforge/bin/lib/legacy-names.cjs</files>
  <action>
Step 0. Record `BASE` with `git -C <repo> rev-parse HEAD` (after quick 40's last commit). Make the scratch HOME. Run
the full `npm test` once from `<repo>` with it, and save the totals and failing test names to
`<scratchpad>/q41/base-npm.txt`. Run the scoped set and save the per-file counts.

Step 1 (RED). Add Test list 1-5 to `token-usage.test.cjs`, in a new `describe('quick-41 former checkout roots', …)`
next to test 5b. Add 6-7 to `agent-overhead.test.cjs`, in the "58-02 overhead spawns of a repository" describe or
a new one beside it. Build OLD from the realpath'd temp repo and never create it. Take the legacy planning dir from
`require('./legacy-names.cjs').LEGACY.planningDir`. Run the scoped set: 1-3, 5 and 6 fail (4 and 7 may pass). Commit
`test(quick-41): transcripts under a former checkout root match only when named (RED)`.

Step 2 (GREEN). Change `repoMatcher(repoRoot, { alsoRoots = [] } = {})` as in the pseudocode, and require `LEGACY`
from `./legacy-names.cjs` in token-usage. Update the header comment (lines 17-20) and `repoMatch`'s doc comment to
say that former roots passed as `alsoRoots` match the same way and that their planning paths include the legacy
directory name. In `agent-overhead.cjs`, pass `{ alsoRoots: p.alsoRoots || [] }` to `repoMatcher` and update the
`indexOverheadTranscripts` JSDoc (`projects?: Array<{root, label, alsoRoots?: string[]}>`) and the comment at :142.
Add token-usage to the history-reader line in `legacy-names.cjs`'s header. Run the scoped set: everything is
green. Commit `feat(quick-41): transcript matcher accepts former checkout roots`.
  </action>
  <verify>Scoped set green. `git diff BASE -- plugins/aoforge/aoforge/bin/lib/compat.cjs` is empty, and
`rg -n "alsoRoots" plugins/aoforge/aoforge/bin/lib/token-backfill.cjs plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs`
prints nothing.</verify>
  <done>Test list 1-7 pass. Every pre-existing token-usage and agent-overhead test passes unchanged, and the
rename guard and legacy-names tests are green.</done>
  <recovery>If an existing test fails after GREEN, the empty-alias path changed: compare `repoMatcher(repo)` with the BASE
source (`git -C <repo> show BASE:plugins/aoforge/aoforge/bin/lib/token-usage.cjs`) and restore the original order and
contents for `alsoRoots: []`.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: calibrate --also-root records the former roots and feeds the overhead scan</name>
  <files>plugins/aoforge/aoforge/bin/lib/calibrator.test.cjs, plugins/aoforge/aoforge/bin/lib/calibrate-cli.test.cjs, plugins/aoforge/aoforge/bin/lib/calibrator.cjs, plugins/aoforge/aoforge/bin/lib/calibrate-cli.cjs, plugins/aoforge/aoforge/bin/lib/help.cjs, plugins/aoforge/aoforge/bin/aof-tools.cjs</files>
  <action>
Step 1 (RED). Add Test list 8-11 to `calibrator.test.cjs` (a new `describe('quick-41 alsoRoots', …)`) and 12-14 to
`calibrate-cli.test.cjs` (a new describe after the 58-03 block, reusing `overheadRoot`, `run` and `okJson`; write the
OLD-cwd verifier spawn with `fx.writeOverheadTranscript`). Use a fake HOME and a fixture `--root` throughout. Run
the scoped set: 9-14 fail, and 8 may pass. Commit `test(quick-41): calibrate --also-root (RED)`.

Step 2 (GREEN).
- `calibrator.cjs`: `buildCalibration({ …, alsoRoots })` as in the pseudocode. Add `ALSO_ROOTS_NOTE` (Locked
  decision 5), pushed after the minutes note only when non-empty. Set `method.also_roots` before `inputsDigest`
  runs. Pass `alsoRoots` in the single project's `collectOverhead` entry. Extend the JSDoc of `buildCalibration`.
- `calibrate-cli.cjs`: parse `--also-root` as a list (a separate branch before the `VALUE_FLAGS` check, with the same
  "needs a value" rule). Reject `--also-root` together with `--no-overhead` with a message naming both. In
  `runCalibrate`, resolve each against `base` and pass `alsoRoots`; library errors already return `ok:false` through
  the try/catch. Add the result to `methodText`: ` · also roots <a, b>` when `method.also_roots` is present. Update
  `USAGE` to `… [--root <dir> | --no-overhead] [--also-root <dir>]... [--window …` and add an `also-root` paragraph to
  the header comment.
- `help.cjs` `calibrate`: put the same usage string in usage, and add one sentence to details. It counts, for the
  overhead scan only, spawns recorded under a former checkout path (repeatable). It needs exactly one project and
  cannot be combined with --no-overhead. A root containing the project is refused, the roots are recorded in
  `method.also_roots` (and so in inputs_digest), and without it the file is unchanged.
- `aof-tools.cjs`: add `[--also-root dir]...` and `quick-41` to the `case 'calibrate'` comment (:944).

Run the scoped set: everything is green. Commit `feat(quick-41): calibrate --also-root counts a moved checkout's
agent overhead`.
  </action>
  <verify>Scoped set green. `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs calibrate --help` shows
`--also-root`, and `… calibrate --also-root x --no-overhead --dry-run` exits 1 with the usage line.</verify>
  <done>Test list 8-14 pass. A build without the flag has a three-key `method` and the same bytes as with
`alsoRoots: []`, and all pre-existing calibrator and calibrate-cli tests pass unchanged.</done>
  <recovery>If a pre-existing digest or note-count assertion fails, the no-alias path gained a key or note. Move the
`also_roots`/note additions behind the non-empty check. Never edit the existing assertion.</recovery>
</task>

<task type="auto">
  <name>Task 3: Docs and changelog, then recalibrate the live file and report old against new</name>
  <files>docs/USER-GUIDE.md, docs/AOF-TOOLS-REFERENCE.md, CHANGELOG.md</files>
  <action>
Step 1 (docs). Re-read each file first (quick 40 edited USER-GUIDE and CHANGELOG).
- `docs/USER-GUIDE.md` "Estimation data": add `calibrate --also-root <dir>` to the command block (line ~470, comment
  `# also count overhead spawns recorded under a former checkout path`). In "Where it looks and writes" add the rule
  from the help sentence, plus why it exists: a moved or renamed checkout leaves its transcripts under the old
  path. In "calibration.json top-level keys", note that `method` also carries `also_roots` when the flag was given.
  Use `~/dev/old-checkout` as the example path.
- `docs/AOF-TOOLS-REFERENCE.md` Estimation data bullet: add `[--also-root <dir>]...` to the calibrate flags, and
  "`--also-root` for a moved checkout's history" beside `--root`/`--no-overhead`.
- `CHANGELOG.md` `## [Unreleased]`, under `### Fixed` (create it if absent, else append): calibrate's agent-overhead
  scan lost the spawns recorded before a checkout move (quick 41). Give the measured counts from Step 3, current
  root only against with the alias, and the 2026-10-08 figure of 127. Say that `--also-root <dir>` (repeatable) adds
  former roots and is recorded in `method.also_roots`.
Run the scoped set (rename-guard and doc-refs included). Commit
`docs(quick-41): calibrate --also-root in the guide, reference and changelog`. You may amend the numbers after
Step 3 with a follow-up commit `docs(quick-41): changelog figures from the recalibration`.

Step 2 (default path is byte-identical on real data). Real HOME. Use one command per call:
- `git -C <repo> archive --output <scratchpad>/q41/base.tar BASE plugins/aoforge/aoforge`
- `mkdir -p <scratchpad>/q41/base`, then `tar -xf <scratchpad>/q41/base.tar -C <scratchpad>/q41/base`
- `node <scratchpad>/q41/base/plugins/aoforge/aoforge/bin/aof-tools.cjs calibrate --paths /Users/justin/dev/aoforge-claude --root /Users/justin/.claude/projects --window 10 --minutes trd_level --through 66 --out <scratchpad>/q41/cal.base-noalias.json --raw`
- the same with `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs` and `--out <scratchpad>/q41/cal.head-noalias.json`
- `cmp` the two files. They must be identical (see error_recovery).

Step 3 (recalibrate). Real HOME, explicit inputs, repo CLI:
- Back up: `cp /Users/justin/.claude/aoforge/calibration.json <scratchpad>/q41/calibration.pre-q41.json`, then
  `shasum -a 256` both files.
- Dry run: `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs calibrate --paths /Users/justin/dev/aoforge-claude --root /Users/justin/.claude/projects --window 10 --minutes trd_level --through 66 --also-root /Users/justin/dev/devflow-claude --out /Users/justin/.claude/aoforge/calibration.json --dry-run`
  (JSON). Check the floors from must_haves truth 6: `overhead.matched >= 127`; every agent at or above planner 36,
  job-checker 32, verifier 41, objective-researcher 11, integration-checker 5, roadmapper 2; `samples` = 75 TRDs,
  177 tasks, 72 with tokens. At planning time the simulation gave 164 (planner 49, job-checker 44, verifier 53,
  objective-researcher 11, integration-checker 5, roadmapper 2), and later spawns may add a few. If a floor fails,
  stop and follow error_recovery.
- Decomposition (optional but preferred): the same command with `--rates <scratchpad>/model-rates.old.json --out <scratchpad>/q41/cal.alias-oldrates.json`
  and no `--dry-run`. First confirm that the file's `models` deep-equal the backup's `models`. If they do not, take
  the rates from `git -C <repo> show cd6bbbc5^:plugins/aoforge/aoforge/references/model-rates.json`.
- Write: the dry-run command without `--dry-run`. Then run `shasum -a 256` on the live file, then
  `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs estimate task --class code_tdd --raw` (the readers accept
  the file), then the write command again (it must report `unchanged`).
- Build the report with a short `node -e` that reads the backup, the optional decomposition file and the new live
  file. For each of the six agents, give samples, minutes p50, and `cost_usd` p50 and p90. Also give
  `agent_overhead_sources`, `inputs_digest`, `sources[0].project` and `method`. Save the table to
  `<scratchpad>/q41/report.md` for the SUMMARY.
  </action>
  <verify>The `cmp` in Step 2 reports identical files. The dry run meets every floor. The live file's
`method.also_roots` is `["/Users/justin/dev/devflow-claude"]`, `method.minutes` is `trd_level`,
`window_objectives` is 10 and `through_objective` is 66. The second write reports `unchanged`, and
`estimate task --class code_tdd --raw` prints an estimate, not `No estimate`. Full `npm test` (scratch HOME): no new
failures against BASE, and the total grows only by the new tests. `git diff BASE --stat` lists only
`files_modified`, and `git diff BASE | rg -n '8080'` prints nothing.</verify>
  <done>The live calibration counts the pre-move spawns again, with all six agents sampled, and is backed up with
before and after sha256. The report table compares old and new counts and dollars, and the docs and changelog
describe the flag.</done>
  <recovery>If the live write happened and is wrong, restore it with
`cp <scratchpad>/q41/calibration.pre-q41.json /Users/justin/.claude/aoforge/calibration.json` and confirm the sha256
matches f4d1ffa9…. If a full-suite failure also fails at BASE, it is pre-existing: list it and do not fix it.</recovery>
</task>

</tasks>

<verification>
- `npm test` (scratch HOME): no new failures against BASE.
- `git log --oneline BASE..HEAD` shows, in order, the Task 1 RED and GREEN commits, the Task 2 RED and GREEN commits
  and the Task 3 docs commit(s), all made through `aof-tools commit`.
- With no `--also-root`, the BASE and HEAD calibrations of the real history are byte-identical. With it, the live
  file holds the pre-move overhead samples (matched >= 127, all six agents present) under the frozen method.
- No push, tag or release, and no port 8080.
</verification>

<success_criteria>
- A moved checkout's agent-overhead history counts again through one explicit, recorded flag, with no compat path
  added to the project root's matching.
- The default calibration is unchanged byte for byte.
- The user has an old-against-new table of overhead counts and dollars from the rebuilt live calibration.
</success_criteria>

<output>
Write the SUMMARY into the draft
`/var/folders/j2/r369kq256wd5qg5yn51x376m0000gn/T/aoforge-drafts/aoforge-claude-df646fc2/quick/41-calibrate-matches-pre-move-transcripts/41-SUMMARY.md`.
Publish it with
`node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs --cwd <repo> quick summary 41 --from <that draft> --raw`.
Do not commit the SUMMARY; the orchestrator does that. Include:
- BASE, the npm test totals at BASE and at the end, and the scoped per-file counts before and after;
- the RED failure names for Tasks 1 and 2, and every commit hash;
- the Step 2 `cmp` result;
- the old and new sha256 and `inputs_digest` of the live calibration, and the backup path. The scratchpad is
  session-scoped, so the SUMMARY is the durable record of the 2026-10-08 digest;
- the report table: per agent, samples / minutes p50 / cost p50 / cost p90 for the backup (127 spawns, 2026-10-05
  rates), the optional decomposition (alias, old rates) and the new live file (alias, current rates with Sonnet 5.5
  cache read at 0.05x), plus `agent_overhead_sources` and the project label change;
- follow-up candidate: `tokens` has the same blind spot. At planning time `indexExecutorTranscripts` identified 53
  executor transcripts for the current root against 367 for the former root. A `tokens --also-root` would reuse
  this matcher.
</output>
