---
objective: quick-40
trd: 01
type: standard
wave: 1
depends_on: []
files_modified:
  - plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs
  - plugins/aoforge/aoforge/bin/lib/init.cjs
  - plugins/aoforge/aoforge/bin/lib/trd-pre-check.cjs
  - plugins/aoforge/aoforge/references/model-profiles.json
  - plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs
  - plugins/aoforge/aoforge/references/model-profiles.md
  - plugins/aoforge/aoforge/references/escalation-policy.md
  - plugins/aoforge/aoforge/templates/codebase/structure.md
  - docs/USER-GUIDE.md
  - site/content/docs/configuration/model-profiles.md
  - plugins/aoforge/hooks/verify-completion.test.js
  - CHANGELOG.md
autonomous: true
must_haves:
  truths:
    - "`aof-tools resolve-model df-planner` (and `df-<agent>` for every agent on disk) behaves like any unknown name: exit 0, JSON `{model: 'sonnet', unknown_agent: true, requested: 'df-<agent>'}`, and the stderr line `unknown agent \"df-<agent>\"`. Bare names resolve exactly as at BASE"
    - "An `agent_models` or `model_overrides` key spelled `df-<agent>` no longer binds: `resolve-model <agent>` reports `tier_source: 'table'`. Bare keys bind as at BASE"
    - "All nine compound init commands (execute-objective, plan-objective, quick, verify-work, new-project, new-milestone, map-codebase, security-audit, progress) resolve bare agent names. With a bare-key `model_overrides` sentinel for every agent, every `*_model` field and every value of every `*_models` map equals the sentinel. `rg -n 'df-' plugins/aoforge/aoforge/bin/lib/init.cjs` prints nothing"
    - "rename-guard test 2 fails on a `df-<agent>` or `df-<skill>` name, with the names read from plugins/aoforge/agents/*.md and plugins/aoforge/skills/*/, in agents, skills, workflows, references, templates, stack-profiles, live docs, site/content, README.md and CLAUDE.md. It was proven RED on the unreworded tree (27 findings on 22 lines in 5 files). `.df-worktrees`, `df/ws-`, `df/exec-`, mkdtemp-style `df-x-` prefixes, `df-*` globs, tests, fixtures, CHANGELOG, docs history and the planning tree never fail it"
    - "No user-facing doc names a df- agent or skill, or says the prefix is accepted: references/model-profiles.md (and .json `_comment`), references/escalation-policy.md, templates/codebase/structure.md, the USER-GUIDE per-agent table and site/content/docs/configuration/model-profiles.md"
    - "verify-completion.test.js `returns ok:false on filesystem error (unwritable path)` carries the same root skip as todo-sync.test.js test 11. As a non-root user it still runs and passes, and with getuid faked to 0 it reports as skipped"
    - "`npm test` with a scratch HOME shows no new failures against BASE. Nothing is pushed, tagged or released, and the diff adds no port 8080"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/init.cjs
      provides: "bare-name-only agent resolution: no prefix strip, no `df-${key}` lookups in MODEL_PROFILES, agent_models or model_overrides, and 22 bare call sites"
    - path: plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs
      provides: "prefixed name is unknown; prefixed config keys do not bind; init-wide sentinel regression"
    - path: plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs
      provides: "scoped `installName` token built from LEGACY.installPrefix plus the tree's agent and skill names; test 10 sensitivity and scope cases"
    - path: plugins/aoforge/hooks/verify-completion.test.js
      provides: "root skip on the unwritable-path test"
  key_links:
    - from: "init.cjs compound init commands (resolveModelInternal call sites)"
      to: "references/model-profiles.json `agents{}` bare keys"
      via: "resolveAgentModel → agentTierMap / overrideFor with the bare key, no alias"
    - from: "rename-guard.repo.test.cjs TOKENS `installName`"
      to: "plugins/aoforge/agents/*.md and plugins/aoforge/skills/*/"
      via: "lazy readdir of REPO_ROOT, so a mirror install never reads the tree"
---

## Objective

3.1.0 dropped the pre-rename compatibility shims, but three `df-` leftovers survived, and the guard that should
have caught them could not:

1. **Model resolution still accepts the pre-plugin `df-` agent prefix.** `init.cjs` strips `^df-` in
   `normalizeAgentKey`, falls back to `MODEL_PROFILES['df-'+key]` and to `agent_models` / `model_overrides` keys
   spelled `df-<agent>`, and its own compound init commands still pass `'df-planner'` and the like at 22 call
   sites. Make the callers pass bare names first, then remove the alias. After that a `df-planner` is an unknown
   agent like any other: a stderr warning and a `sonnet` fallback, which is what `resolve-model` already does today.
2. **User-facing docs still name `df-` agents and skills**, and two of them say the prefix is accepted.
3. **The rename guard does not see it.** Its tokens are the legacy product word, `LEGACY.cli`, the banner and the
   planning directory. `df-planner` matches none of them, so nothing gated these. Add a scoped `installName` token
   that fails on `df-<agent>` and `df-<skill>` in user-facing files, and prove it RED on the unreworded tree first.
4. **`verify-completion.test.js` fails as root.** Root can create `/nonexistent-root-dir/`, so the "unwritable
   path" write succeeds. Skip it under root the way `todo-sync.test.js` test 11 does.

Quick mode: one JOB with three tasks, test first. `<repo>` is the checkout the orchestrator gave you
(`/Users/justin/dev/aoforge-claude` on `integrate/3.1.0` unless it names a worktree). Planning mode is `local`.

## Locked decisions

1. **Bare names only.** No `df-` spelling is read anywhere in `resolveAgentModel`, `agentTierMap`, `overrideFor` or
   `tierLayer`. Keep `normalizeAgentKey` as a plain `String(agentType || '')` coercion so its two call sites stay
   put. Do not add a deprecation warning or a special case for `df-`: the existing unknown-agent path is the
   behaviour.
2. **Callers first.** Change the 22 `resolveModelInternal(cwd, 'df-…')` call sites to bare names in their own
   commit, before you remove the alias. The init-wide sentinel test (Test list 5) must stay green across both
   commits.
3. **Guard scope (the user-facing set).** `plugins/aoforge/agents/**`, `plugins/aoforge/skills/**`,
   `plugins/aoforge/aoforge/{workflows,references,templates,stack-profiles}/**`, `docs/**` (the scan set already
   drops docs history through the codemod's SKIP, so only the live docs remain), `site/content/**`, `README.md`
   and `CLAUDE.md`. `*.test.*` files and `__fixtures__/` are excluded inside that set. Code under `bin/` and
   `hooks/` stays outside it, per the brief.
4. **The name list comes from the tree, the prefix from LEGACY.** Read the names as the basenames of
   `plugins/aoforge/agents/*.md` plus the directory names under `plugins/aoforge/skills/`, and take the prefix
   from `LEGACY.installPrefix`. The guard source spells no `df-<name>` literal.
5. **Boundaries.** Match `(?<![A-Za-z0-9_])` + prefix + `(?:names, longest first)` + `(?![A-Za-z0-9_-])`. The
   trailing `-` exclusion keeps mkdtemp prefixes such as `df-objective-` and `df-quick-` out. `.df-worktrees`,
   `df/ws-` and `df/exec-` never match, because `worktrees` is not a name and the other two have no `df-`.
6. **Out of scope:** `benchmark.cjs:353` (`r.agentType === 'df-executor'`, a dead comparison), the history readers
   (`agent-overhead`, `session-audit`), the install-prefix detectors (`global-upgrade`, doctor check 15), mkdtemp
   prefixes in tests, `config.test.cjs:156` (a `loadConfig` pass-through that does not interpret keys), CHANGELOG
   history and `.aoforge/`. Do not touch them. Mention benchmark.cjs:353 in the SUMMARY as a follow-up candidate.
7. Do not change tier values in any table. This is a rename of labels only.

## Test list

Outer to inner. Task 1:

1. `resolve-model df-<agent>` for every agent on disk: exit 0, `unknown_agent: true`, `model: 'sonnet'`,
   `requested: 'df-<agent>'`, and stderr contains `unknown agent "df-<agent>"`. It is the same shape as
   `resolve-model no-such-agent`. **RED at BASE** (today it returns the table model with no warning). This replaces
   "both key spellings resolve identically".
2. Unchanged: no known bare agent falls through to the unknown-agent default (the existing test stays).
3. `agent_models: { 'df-planner': { quality: 'haiku' } }` on profile `quality`: `resolve-model planner` reports
   `tier_source: 'table'` and the table's quality tier for planner. **RED at BASE.** This replaces test 7 ("a df-
   prefixed agent_models key (the documented spelling) binds").
4. `model_overrides: { 'df-debugger': 'haiku' }`: `resolve-model debugger` has `tier_source: 'table'`, not
   `model_overrides`. **RED at BASE.**
5. Regression, **green at BASE and after every commit**. A temp project with `model_profile: quality`, an
   `.aoforge/objectives/01-x/` directory, and `model_overrides` mapping every agent in model-profiles.json
   `agents{}` (bare keys) to the sentinel id `claude-sentinel-1`. For each of `init execute-objective 1`,
   `init plan-objective 1`, `init quick x`, `init verify-work 1`, `init new-project`, `init new-milestone`,
   `init map-codebase`, `init security-audit` and `init progress`, every top-level key ending `_model` equals the
   sentinel and every value of every key ending `_models` equals the sentinel. Also assert that the union of keys
   seen covers `executor_model, verifier_model, researcher_model, planner_model, checker_model, researcher_models,
   synthesizer_model, roadmapper_model, mapper_model, mapper_models, auditor_model`. The planner probed this at
   a589d306: all nine commands exit 0 in that fixture and emit 33 sentinel values.

Task 2 (rename guard, new `describe('10: …')`; `P = LEGACY.installPrefix`):

6. In-scope sample (`plugins/aoforge/aoforge/references/x.md`): the lines `${P}planner`, `` `${P}verifier` `` and
   `${P}plan-objective/SKILL.md` give 3 findings, on lines 1, 2 and 3.
7. The live conventions and look-alikes in the same in-scope path give 0 findings: `.df-worktrees/<repo>/<id>`,
   `df/ws-auth`, `df/exec-79-07-claude-md`, `${P}quick-abc` (mkdtemp style), `${P}*` and `legacy-${P}install`.
8. Scope: `${P}planner` under `plugins/aoforge/aoforge/bin/lib/x.test.cjs` and under
   `plugins/aoforge/skills/x/__fixtures__/y.md` gives 0. Inside an ignore region of a `docs/USER-GUIDE.md` sample
   it gives 0, and outside the region it gives 1.
9. `scanRepo` on a scratch git repo (same pattern as 5c) with tracked `CHANGELOG.md`, `docs/x.md`, `.aoforge/x.md`,
   `plugins/aoforge/aoforge/bin/lib/a.test.cjs`, `plugins/aoforge/aoforge/references/a.md` and `site/content/a.md`,
   each holding `A ${P}planner note.`, finds exactly `plugins/aoforge/aoforge/references/a.md:1` and
   `site/content/a.md:1` (call it with `allow: []`).
10. The name list includes every `plugins/aoforge/agents/*.md` basename and every `plugins/aoforge/skills/*/`
    directory, has 40 or more entries, and includes `planner`, `job-checker`, `plan-objective` and `objective`. The
    token's regex source begins with the escaped `LEGACY.installPrefix` after the lookbehind.
11. The guard source holds no match of the installName regex (extend test 6).
12. Test 2 on the real tree: **RED before the rewording**, with 27 findings on 22 lines in 5 files (list under
    Task 2), then GREEN.

Task 3:

13. The verify-completion unwritable-path test is skipped when `process.getuid() === 0` and runs otherwise.

<embedded_context>
<codebase_examples>
The alias to remove (`plugins/aoforge/aoforge/bin/lib/init.cjs` at a589d306):

```js
function normalizeAgentKey(agentType) {
  return String(agentType || '').replace(/^df-/, '');            // :278
}
// agentTierMap
  let base = MODEL_PROFILES[key] || MODEL_PROFILES[`df-${key}`] || null;                    // :290
    config.agent_models?.[key] || config.agent_models?.[`df-${key}`] || {}                 // :304
// overrideFor
  for (const k of [key, `df-${key}`]) {                                                      // :409
// tierLayer
  const project = config.agent_models?.[key] || config.agent_models?.[`df-${key}`] || {};  // :423
```

The prefixed call sites are lines 386, 602-603, 727-729, 878, 881-882, 919, 921-922, 963-966, 1033-1034, 1249,
1252, 1280 and 1394-1395 (`rg -n "resolveModelInternal\(cwd, 'df-" <repo>/plugins/aoforge/aoforge/bin/lib/init.cjs`).
The comment blocks at 266-276 and 437 describe the two spellings and need rewriting. No skill, workflow, agent or
hook passes a `df-` name to `resolve-model`. The only other mention is the site doc at
`site/content/docs/configuration/model-profiles.md:43`.

Unknown-agent behaviour to rely on (`cmdResolveModel`, init.cjs ~:507):

```js
  if (result.unknown_agent) {
    process.stderr.write(`aof-tools resolve-model: unknown agent "${agentType}" — no entry in ` + ...);
  }
```

The quick 35 test harness in `model-profiles.test.cjs` (~:375-395) is the one to reuse. `project(config,
{ objectiveDir })` makes a temp project with a `home/` dir, `aof(dir, args)` runs with `HOME` set to that dir and
asserts exit 0, and `resolveIn` / `rawIn` parse the result. Test 3 there already runs `init execute-objective 1`
and `init quick x`. Use `spawnSync` directly when you need stderr.

The guard's token loop (`rename-guard.repo.test.cjs` ~:153-200):

```js
const TOKENS = [
  { id: 'product', re: new RegExp(esc(LEGACY.slug), 'gi') },
  ...
  { id: 'planningDir', re: new RegExp(`${esc(LEGACY.planningDir)}(?![A-Za-z0-9_])`, 'g'), directoryOnly: true },
];
function scanText(text, rel = '') {
  const lines = maskPreserved(text, rel).split('\n');
  const ignored = ignoredLines(lines);
  ...
    for (const t of TOKENS) {
      for (const m of lines[i].matchAll(t.re)) {
        if (t.directoryOnly && !DIRECTORY_KINDS.has(codemod().occurrenceKind(lines[i], m.index))) continue;
```

Approach for the new token. Keep it lazy, because a mirror install loads this module with no `plugins/` tree:

```js
// ─── pre-plugin install-prefixed agent and skill names (quick 40) ───
const INSTALL_NAME_SCOPE = [ /* decision 3 globs */ ].map(globToRegExp);
function inInstallNameScope(rel) {
  return INSTALL_NAME_SCOPE.some((re) => re.test(rel)) && !/\.test\.[^/]*$/.test(rel) && !/(^|\/)__fixtures__\//.test(rel);
}
let _installName = null;
function agentAndSkillNames() { /* readdir REPO_ROOT/plugins/aoforge/agents (*.md → basename) + skills (dirs); sort by length desc */ }
function installNameRe() { /* cache; `(?<![A-Za-z0-9_])${esc(LEGACY.installPrefix)}(?:${names.map(esc).join('|')})(?![A-Za-z0-9_-])`, 'g' */ }
// TOKENS entry:
{ id: 'installName', get re() { return installNameRe(); }, scope: inInstallNameScope },
// scanText, before matchAll:
if (t.scope && !t.scope(rel)) continue;
```

`globToRegExp` comes from `doc-refs.cjs`: `**` at the end means `.*` and `**/` means `(?:.*/)?`. `scanPath`
reuses `scanText(rel, rel)`, so a `df-<name>` path in scope is caught as well.

Root skip to copy (`plugins/aoforge/hooks/todo-sync.test.js:283`):

```js
test('11: …', { skip: typeof process.getuid === 'function' && process.getuid() === 0 }, () => {
```
</codebase_examples>

<anti_patterns>
- Do not widen the guard's TOKENS globally. Test 2 scans tests and fixtures too, and dozens of them use `df-`
  mkdtemp prefixes and legacy inputs on purpose. The new token must carry `scope`.
- Do not spell `df-planner` or any other `df-<name>` literal in the guard source. Build every sample from
  `LEGACY.installPrefix`.
- Do not "fix" the history readers, install-prefix detectors, `benchmark.cjs` or test tmpdir prefixes (decision 6).
- Do not rewrite whole files. Use targeted Edits; the docs need one to six line changes each.
- Do not touch tier values in the tables you relabel.
- Do not compute the name list at module load (mirror installs; see gotchas).
</anti_patterns>

<error_recovery>
- If test 2's RED list differs from the 22 lines below, record the actual list in the SUMMARY. Reword any extra
  in-scope hit too, unless it is a live convention. In that case narrow the token, add a Test list 7 case for it,
  and explain.
- If an existing suite (doc-refs, planning-writes, builtin-sweep, legacy-names.legacy) goes red after a doc edit,
  the edit broke a pinned string. Restore it and reword around the pin.
- If the sentinel test (5) fails after the callers commit, a call site still passes a prefixed name, or the fixture
  lacks something that command needs. Fix the call site. Never weaken the assertion.
</error_recovery>
</embedded_context>

<gotchas>
- **Scratch HOME for every test run:** `HOME=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/home-q40`
  (make it once). Never a `mktemp -d` HOME under `/var/folders`, which breaks three tests on macOS. Leave TMPDIR
  alone.
- **One plain command per Bash call** (the worktree isolation guard refuses compound commands). The shell is zsh,
  so an unquoted `$var` holding `init quick x` does not word-split. Spell each command out.
- **Commits** go through `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs commit "<msg>" --files <paths>`,
  because raw commits are gated.
- **Mirror safety:** `IS_AOFORGE_CHECKOUT` skips the guard's `describe` on a mirror install, but module-level code
  still runs there. Read `plugins/aoforge/agents` and `skills` lazily, inside scanText's first in-scope call.
- The `planningDir` token and test 5a ("three findings" on a README.md sample) must keep their counts. The 5a
  sample has no `df-<name>`.
- `model-profiles.test.cjs:234` already blocks backticked `` `df-<profile key>` `` in agents, skills and workflows.
  Leave it in place; the guard now covers the wider set.
- The baseline at a589d306 with a scratch HOME: model-profiles + rename-guard.repo + verify-completion +
  model-profile-binding = 100 tests, 100 pass.
- Port 8080 is off limits. No push, tag or release.
</gotchas>

<validation_gates>
- task: `npm test` (`aof-tools stack command test` → `npm test`; `gates.task: [test]`). There is no lint, format or
  build gate.
- Scoped set after each commit (from `<repo>`, scratch HOME):
  `node --test plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs plugins/aoforge/aoforge/bin/lib/model-profile-binding.test.cjs plugins/aoforge/aoforge/bin/lib/init.test.cjs plugins/aoforge/aoforge/bin/lib/config.test.cjs plugins/aoforge/aoforge/bin/lib/trd-pre-check.test.cjs plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs plugins/aoforge/aoforge/bin/lib/doc-refs.repo.test.cjs plugins/aoforge/aoforge/bin/lib/legacy-names.legacy.test.cjs plugins/aoforge/hooks/verify-completion.test.js`
</validation_gates>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Model resolution reads bare agent names only (callers first)</name>
  <files>plugins/aoforge/aoforge/bin/lib/model-profiles.test.cjs, plugins/aoforge/aoforge/bin/lib/init.cjs, plugins/aoforge/aoforge/bin/lib/trd-pre-check.cjs, plugins/aoforge/aoforge/references/model-profiles.json</files>
  <action>
Step 0. Record `BASE=$(git -C <repo> rev-parse HEAD)`. Run the full `npm test` once from `<repo>` with the scratch
HOME and save the totals and any failing test names to the scratchpad. Then run the scoped set and save the
per-file counts.

Step 1 (RED). In `model-profiles.test.cjs`:
- Replace "both key spellings resolve identically" with Test list 1. Spawn `resolve-model df-${agent}` with
  `spawnSync` from `REPO`, capturing stdout and stderr, for every name in `agentNames`.
- Replace quick-35 test 7 with Test list 3, and add Test list 4 beside it.
- Add Test list 5 to the quick-35 describe, reusing `project()` / `aof()`. Build the overrides from
  `Object.keys(profiles.agents)`.
- Update the header comment ("both key spellings resolve identically" becomes "a prefixed spelling is an unknown
  agent").
Run the scoped set. Tests 1, 3 and 4 fail and test 5 passes. Commit:
`test(quick-40): a df- prefixed agent name is an unknown agent (RED)`.

Step 2 (callers). In `init.cjs`, change all 22 `resolveModelInternal(cwd, 'df-<agent>'…)` call sites to the bare
name, keeping their other arguments. Run the scoped set: tests 1, 3 and 4 are still RED and test 5 is green.
Commit: `refactor(quick-40): compound init commands pass bare agent names`.

Step 3 (GREEN). In `init.cjs`:
- `normalizeAgentKey` returns `String(agentType || '')`. Rewrite its comment: the table and every caller use
  bare names; TRD 28-02 made the table bind, and quick 40 removed the pre-plugin prefixed alias, so a prefixed
  name is an unknown agent.
- Drop the `df-${key}` fallbacks in `agentTierMap` (:290, :304), `overrideFor` (:409; loop over `[key]` only or
  read `overrides[key]`, and fix its doc comment "either spelling (bare wins)") and `tierLayer` (:423).
- Remove "(bare key wins over `df-`)" from the precedence comment at :437.
In `trd-pre-check.cjs:497`, change the comment "spawn df-job-checker" to "spawn the job-checker agent". In
`model-profiles.json` `_comment`, replace "Keys are canonical without the df- prefix; resolve-model accepts /
either form (TRD 28-02)." with one sentence saying keys are the bare agent names and the only spelling
resolve-model reads. Keep the array valid JSON.
Run the scoped set: everything is green. Then run `rg -n "df-" <repo>/plugins/aoforge/aoforge/bin/lib/init.cjs`,
which prints nothing. Commit: `fix(quick-40): drop the df- agent alias from model resolution (GREEN)`.

# CRITICAL: Step 2 lands before Step 3. Test 5 is the proof that no caller depended on the alias.
# GOTCHA: `researcherModels()` (:386) and the map-codebase focus map (:1252) pass a focus; keep it.
  </action>
  <verify>
Scoped set green. `node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs resolve-model df-planner` (with the
scratch HOME, from `<repo>`) prints the unknown-agent stderr line and `"unknown_agent": true`.
`resolve-model planner --raw` prints the same value as at BASE. `rg -n "df-" init.cjs` prints nothing.
  </verify>
  <done>The three commits (RED, callers, GREEN) exist in that order, Test list 1-5 pass, and no `df-` spelling is
read anywhere in model resolution.</done>
  <recovery>If an unrelated suite asserts a `df-` spelling resolves (none was found at a589d306 besides
model-profiles.test.cjs), update that assertion to the bare name and list it in the SUMMARY.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rename guard fails on df-agent and df-skill names in user-facing files, then reword them</name>
  <files>plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs, plugins/aoforge/aoforge/references/model-profiles.md, plugins/aoforge/aoforge/references/escalation-policy.md, plugins/aoforge/aoforge/templates/codebase/structure.md, docs/USER-GUIDE.md, site/content/docs/configuration/model-profiles.md</files>
  <action>
Step 1 (RED). Add the scoped `installName` token as in codebase_examples (decisions 3-5), with the `scope` check
in `scanText`. Add `describe('10: pre-plugin install-prefixed agent and skill names (quick 40)')` with Test list
6-10, and extend test 6 with Test list 11. Add a "10." item to the header Test list comment and add the token to
item 2's token list. Run the guard alone. Tests 6-11 pass, and test 2 FAILS with exactly these findings (27 on
22 lines):
- `docs/USER-GUIDE.md:818-829` (12, the Per-Agent Breakdown table)
- `plugins/aoforge/aoforge/references/escalation-policy.md:25`
- `plugins/aoforge/aoforge/references/model-profiles.md:136,194,195,201,204,210`
- `plugins/aoforge/aoforge/templates/codebase/structure.md:129` (2), `:151` (3), `:152` (2)
- `site/content/docs/configuration/model-profiles.md:43`
Save the failure message for the SUMMARY. Commit:
`test(rename-guard): fail on df- prefixed agent and skill names in user-facing files (RED)`.

Step 2 (GREEN). Make targeted rewordings with bare names and no tier changes:
- USER-GUIDE 818-829: `df-planner` becomes `planner`, and so on for all 12 rows.
- escalation-policy.md:25: `` `df-verifier` `` becomes `` `verifier` ``.
- model-profiles.md:24-26: say the agent keys are the bare names (`planner`, `executor`), and that
  `resolve-model` and every compound `init` command read only that spelling. Any other name is an unknown agent:
  a stderr warning and a `sonnet` fallback. Note that TRD 28-02 made the table bind and quick 40 removed the
  prefixed alias. Line 24 is not a guard finding, but Task 1 made it false.
- model-profiles.md:136: "Keys are the bare agent names, the only spelling read." Keep the rest of the paragraph
  from "An `agent_models` tier beats…".
- model-profiles.md:194, 195, 201, 204 and 210 become `executor`, `planner`, `planner`, `executor` and
  `codebase-mapper`.
- structure.md:129: `│   └── <skill>/       # AOForge skills (plan-objective/, debug/, etc.)`, keeping the
  tree's column alignment. :151 becomes `new-project/SKILL.md, plan-objective/SKILL.md,
  execute-objective/SKILL.md`, and :152 becomes `(plan-objective/, debug/, etc.)`.
- site model-profiles.md:43: delete the `df-planner` line. Under the code block, add one sentence: an
  unrecognised name warns on stderr and falls back to `sonnet`.
Run the guard and the scoped set: all green. `rg -n "df-" <the six files>` shows only the live conventions, if any.
Commit: `docs(quick-40): bare agent and skill names in references, templates and guides (GREEN)`.

# PATTERN: samples are template literals built from LEGACY, as in tests 3a, 5a and 8b.
# GOTCHA: test 9 uses the real tree's name list (REPO_ROOT), not the scratch repo's.
  </action>
  <verify>
`node --test <repo>/plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs` (scratch HOME): the RED run
lists exactly the 22 lines above. The final run is all green, and the test count grows by the new test 10 cases.
doc-refs.repo, planning-writes.repo, builtin-sweep.repo and legacy-names.legacy match their BASE counts.
  </verify>
  <done>The RED and GREEN commits exist. The guard catches `df-<agent>`/`df-<skill>` in user-facing files, ignores the
live conventions and the out-of-scope set, and the tree is clean.</done>
  <recovery>If the RED list holds an unexpected live convention, see error_recovery. Do not add an ALLOW entry for a
user-facing doc. Reword it instead.</recovery>
</task>

<task type="auto">
  <name>Task 3: Root skip in verify-completion test, changelog, full-suite gate</name>
  <files>plugins/aoforge/hooks/verify-completion.test.js, CHANGELOG.md</files>
  <action>
Step 1. In `plugins/aoforge/hooks/verify-completion.test.js:114`, give
`test('returns ok:false on filesystem error (unwritable path)', …)` the options object
`{ skip: typeof process.getuid === 'function' && process.getuid() === 0 }`, byte-identical to todo-sync.test.js
:283. Add a one-line comment: root can create `/nonexistent-root-dir/`, so the write succeeds. Prove both
branches:
- `node --test plugins/aoforge/hooks/verify-completion.test.js` (scratch HOME): the test runs and passes.
- Write `<scratchpad>/fake-root.cjs` containing `process.getuid = () => 0;`, then run
  `node --require <scratchpad>/fake-root.cjs plugins/aoforge/hooks/verify-completion.test.js`. That test shows
  `# SKIP` (run the file directly, not under `--test`, so the preload applies in-process).
Commit: `test(hooks): skip the unwritable-path audit-log test under root`.

Step 2. Under `## [Unreleased]` in CHANGELOG.md, add:
- `### Removed`: `resolve-model` and the compound `init` commands no longer read the pre-plugin `df-` agent
  prefix. A prefixed name such as `df-planner` is an unknown agent (stderr warning, `sonnet` fallback), and an
  `agent_models` or `model_overrides` key spelled `df-<agent>` no longer binds. Use the bare agent name.
  (quick 40)
- `### Changed`: the rename guard (`rename-guard.repo.test.cjs`) fails on a `df-<agent>` or `df-<skill>` name in
  agents, skills, workflows, references, templates, live docs and the docs site. `.df-worktrees`, `df/ws-` and
  `df/exec-` stay allowed. (quick 40)
Commit: `docs(quick-40): changelog`.

Step 3. Run the full `npm test` with the scratch HOME and compare it with BASE.
  </action>
  <verify>`npm test`: no new failures against BASE, and the total grows only by the new tests. `git diff BASE --stat`
lists only `files_modified`. `git diff BASE | rg -n '8080'` prints nothing.</verify>
  <done>The test is skipped under root and runs otherwise. The changelog entry exists, and the full suite shows no
regression.</done>
  <recovery>If a full-suite failure also fails at BASE, it is pre-existing: list it in the SUMMARY and do not fix it.
If it is new, bisect it to the commit that caused it and fix it there with a follow-up commit.</recovery>
</task>

</tasks>

<verification>
- `npm test` (scratch HOME): no new failures against BASE, and `skipped` is unchanged for non-root runs.
- `git log --oneline BASE..HEAD` shows, in order: the Task 1 RED, callers and GREEN commits, the Task 2 RED and
  GREEN commits, and the Task 3 test and changelog commits, all made through `aof-tools commit`.
- `rg -n "df-" <repo>/plugins/aoforge/aoforge/bin/lib/init.cjs` prints nothing. `resolve-model df-planner` warns
  and reports `unknown_agent: true`.
- `git diff BASE | rg -n '8080'` prints nothing. There is no push, tag or release.
</verification>

<success_criteria>
- Model resolution reads bare agent names only, and no AOForge caller passes anything else.
- No user-facing file names a `df-` agent or skill, and the rename guard keeps it that way, scoped so that live
  `df` conventions, tests and history are untouched.
- The suite passes as root.
</success_criteria>

<output>
Write the SUMMARY into the draft
`/var/folders/j2/r369kq256wd5qg5yn51x376m0000gn/T/aoforge-drafts/aoforge-claude-df646fc2/quick/40-remove-df-leftovers-tighten-the-rename-g/40-SUMMARY.md`.
Publish it with
`node <repo>/plugins/aoforge/aoforge/bin/aof-tools.cjs --cwd <repo> quick summary 40 --from <that draft> --raw`.
Do not commit the SUMMARY; the orchestrator does that. Include:
- BASE, the npm test totals at BASE and at the end, and the scoped per-file counts before and after;
- the Task 1 RED failures and the Task 2 RED failure message (the 22-line list);
- every commit hash;
- the fake-root skip proof output line;
- any file edited on a recovery path, and why;
- follow-up candidate: `benchmark.cjs:353` compares `r.agentType === 'df-executor'`, which never matches an
  AOForge transcript, so `executor_calls` is always 0.
</output>
