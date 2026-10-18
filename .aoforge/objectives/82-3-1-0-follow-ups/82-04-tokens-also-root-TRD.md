---
objective: 82-3-1-0-follow-ups
trd: "04"
type: standard
wave: 1
depends_on: []
files_modified:
  - plugins/aoforge/aoforge/bin/lib/token-usage.cjs
  - plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs
  - plugins/aoforge/aoforge/bin/lib/token-backfill.cjs
  - plugins/aoforge/aoforge/bin/lib/token-backfill.test.cjs
  - plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs
  - plugins/aoforge/aoforge/bin/lib/tokens-cli.test.cjs
  - plugins/aoforge/aoforge/bin/lib/help.cjs
  - plugins/aoforge/aoforge/bin/aof-tools.cjs
  - docs/AOF-TOOLS-REFERENCE.md
autonomous: true
requirements: [SC-4]
must_haves:
  truths:
    - "`tokens trd`, `tokens coverage` and `tokens backfill` accept `--also-root <dir>` (repeatable, resolved against cwd) and match transcripts recorded under those former checkout roots with the same matcher as `calibrate --also-root` (token-usage.repoMatcher alsoRoots)"
    - "Without the flag every tokens subcommand's output is byte-identical to before; `tokens stamp --also-root` is a usage error (exit 1, nothing written)"
    - "Tests were written first: a hand-built transcripts root with an executor transcript under a former root is found only when that root is named, for trd, coverage (missing reason) and backfill (dry run)"
    - "Coverage over v1.6 is reported with and without `--also-root /Users/justin/dev/devflow-claude` (read-only), and the backfill dry run likewise, numbers in the SUMMARY"
  artifacts:
    - path: plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs
      provides: "--also-root for trd, coverage, backfill"
  key_links:
    - from: plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs
      to: plugins/aoforge/aoforge/bin/lib/token-usage.cjs
      via: "indexExecutorTranscripts({root, repoRoot, alsoRoots}) -> repoMatcher(repoRoot, {alsoRoots})"
      pattern: "alsoRoots"
---

# TRD 82-04: `tokens` gains `--also-root`, like `calibrate`

<objective>
Quick 41 taught `calibrate --also-root <dir>` to count agent spawns recorded before the checkout moved
(`/Users/justin/dev/devflow-claude` → `/Users/justin/dev/aoforge-claude`), through `token-usage.repoMatcher(root,
{alsoRoots})`. `tokens trd|coverage|backfill` still call `indexExecutorTranscripts({root, repoRoot})` without it, so a
moved checkout's executor transcripts are invisible to them. Thread the same matcher through, test-first, and report
v1.6 coverage with and without it.

Purpose: SC-4.
Output: the flag on three subcommands, tests, help and reference text, and the coverage numbers.
</objective>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<context>
@.aoforge/quick/41-calibrate-matches-pre-move-transcripts/41-SUMMARY.md

Repository `/Users/justin/dev/aoforge-claude`, branch `integrate/3.1.0`; `AOF` = `node plugins/aoforge/aoforge/bin/aof-tools.cjs`.
Never push or tag; never port 8080; never WRITE the real `~/.claude` (reading `~/.claude/projects` transcripts in
Task 3 is read-only and allowed; never pass `--write` to backfill there). Tests:
`SP=/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad`,
`env HOME=$SP/home-82-04 TMPDIR=$SP/tmp-82-04 node --test <files>`.

Code facts (HEAD):
- `token-usage.cjs:258` `repoMatcher(repoRoot, { alsoRoots = [] } = {})` (quick 41) validates alsoRoots
  (`checkAlsoRoots`: array of non-empty absolute strings, else TypeError).
- `token-usage.cjs:326` `indexExecutorTranscripts({ root, repoRoot })` builds `repoMatcher(repoRoot)` with no aliases.
- Call sites: `token-backfill.cjs:95` (`tu.indexExecutorTranscripts({ root: transcriptsRoot, repoRoot })`),
  `tokens-cli.cjs:298` (coverage `indexFactory`), `tokens-cli.cjs:354` (trd).
- `tokens-cli.cjs` `parseArgs`: `VALUE_FLAGS` per subcommand (`trd: [objective-dir, repo, root]`, `stamp: [draft, ...]`,
  `backfill: [repo, root]`, `coverage: [milestone, objective, repo, root]`), single-valued; unknown flags are usage
  errors. `flag-spec.cjs` marks `tokens` as `ownParser` (no edit needed there).
- Calibrate's normalisation (`calibrator.cjs` `normalizeAlsoRoots`, `ERR_CALIBRATE_ALSO_ROOTS`): resolve, de-duplicate,
  sort by code unit; an alias equal to the project root is dropped; an alias that contains the project is refused.
  `calibrate-cli.cjs` resolves each `--also-root` against cwd and maps the library error code to a usage error.
- Docs: `docs/AOF-TOOLS-REFERENCE.md` line 24 (Estimation data) describes `tokens` and calibrate's `--also-root`;
  `help.cjs` holds the tokens usage and details. CHANGELOG and USER-GUIDE are 82-10's.
</context>

<embedded_context>

<codebase_examples>
Quick 41's CLI shape to mirror (calibrate-cli.cjs):
```js
if (name === 'also-root') {
  if (value === undefined || value.startsWith('--')) return usageError('--also-root needs a value');
  alsoRoots.push(value); i++; continue;
}
// later: const alsoRoots = parsed.alsoRoots.map((p) => path.resolve(base, p));
```
Quick 41's matcher tests (token-usage.test.cjs q41-1..q41-5) build a transcripts root with a REPO_ROOT line, a cwd in a
former root, a former root's worktree base and a former root's `.aoforge/` or legacy planning path: reuse those
builders for the new tests.
</codebase_examples>

<anti_patterns>
- A second matcher or a copy of repoMatcher's rules: pass `alsoRoots` through to the one that exists.
- Changing default output (no flag) by a byte: `--raw` JSON gains `also_roots` only when the list is non-empty.
- Accepting `--also-root` on `stamp` (the live stamp names the running checkout; a former root there is a mistake).
- Running `tokens backfill --write` in Task 3.
</anti_patterns>

<error_recovery>
- Moving `normalizeAlsoRoots` would touch calibrator.cjs (not in this TRD's files): call it from tokens-cli by import
  if exported, else re-export it from token-usage.cjs with calibrator importing it from there only if that is a
  one-line change; record the choice.
- The real v1.6 coverage run takes long or the transcripts root is huge: run it in the background and wait; it is read-only.
</error_recovery>

</embedded_context>

## Test list

Outermost first.
tokens-cli.test.cjs
1. `tokens trd <id> --root <fixture transcripts> --repo <repo> --also-root <former>` finds the executor transcript
   recorded under the former root (REPO_ROOT line names it) and prints its totals; without the flag it reports
   `no_transcript`.
2. `tokens coverage --objective N ... --also-root <former>`: a SUMMARY with no token fields whose executor transcript
   lies under the former root gets reason `stamp_skipped`; without the flag `no_transcript`.
3. `tokens backfill --also-root <former>` (dry run) counts that SUMMARY as recovered; without the flag unrecovered;
   no file changes either way.
4. Repeatable: two `--also-root` values both apply; their order does not change the output; `--raw` JSON carries
   `also_roots` (resolved, sorted) only when given; text output ends ` · also roots <a, b>` like calibrate.
5. A relative `--also-root` resolves against cwd; one equal to `--repo` is dropped; one that contains the repo is a
   usage error (exit 1, usage line).
6. `tokens stamp ... --also-root x` and `--also-root` without a value are usage errors; the draft is unchanged.
7. Byte identity: the default outputs of trd, coverage and backfill on the fixture equal those captured before the change.
token-usage.test.cjs / token-backfill.test.cjs
8. `indexExecutorTranscripts({root, repoRoot, alsoRoots})` passes alsoRoots to repoMatcher (former-root entry matched
   with its `match` kind); omitted or empty → identical index to before.
9. `buildBackfill` (or the function at token-backfill.cjs:95) forwards alsoRoots.
10. help: `AOF tokens --help` and the help table name `--also-root` for trd, coverage and backfill.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The index and backfill take alsoRoots (test list 8-9)</name>
  <files>plugins/aoforge/aoforge/bin/lib/token-usage.cjs, plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs, plugins/aoforge/aoforge/bin/lib/token-backfill.cjs, plugins/aoforge/aoforge/bin/lib/token-backfill.test.cjs</files>
  <action>
Fixture builders first: extend the existing hand-built transcripts helpers in token-usage.test.cjs (quick 41's q41
builders) with `formerRootExecutor({former, trdId})` that writes one executor transcript whose first prompt carries
`REPO_ROOT: <former>` and `PLAN_ID: <trdId>`. RED: tests 8-9 (q82-* names); capture the pre-change default index JSON of
the fixture for test 7's byte check (store it as a literal in the test, computed now). Commit
`AOF commit "test(82-04): transcript index and backfill take former roots (RED)" --files <the two test files>`.
GREEN: `indexExecutorTranscripts({ root, repoRoot, alsoRoots = [] })` → `repoMatcher(repoRoot, { alsoRoots })`;
token-backfill forwards an `alsoRoots` option. Commit
`AOF commit "feat(82-04): transcript index and backfill match former checkout roots" --files <the four files>`.
  </action>
  <verify>`env HOME=$SP/home-82-04 TMPDIR=$SP/tmp-82-04 node --test plugins/aoforge/aoforge/bin/lib/token-usage.test.cjs plugins/aoforge/aoforge/bin/lib/token-backfill.test.cjs plugins/aoforge/aoforge/bin/lib/agent-overhead.test.cjs plugins/aoforge/aoforge/bin/lib/calibrator.test.cjs` pass</verify>
  <done>The library path accepts former roots and is unchanged without them.</done>
  <recovery>If repoMatcher rejects a relative alias (TypeError), resolution belongs in the CLI (Task 2); keep the library strict.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: tokens-cli --also-root on trd, coverage and backfill; help and reference (test list 1-7, 10)</name>
  <files>plugins/aoforge/aoforge/bin/lib/tokens-cli.cjs, plugins/aoforge/aoforge/bin/lib/tokens-cli.test.cjs, plugins/aoforge/aoforge/bin/lib/help.cjs, plugins/aoforge/aoforge/bin/aof-tools.cjs, docs/AOF-TOOLS-REFERENCE.md</files>
  <action>
RED: tests 1-7 and 10 in tokens-cli.test.cjs using the Task 1 builders; commit
`AOF commit "test(82-04): tokens --also-root (RED)" --files plugins/aoforge/aoforge/bin/lib/tokens-cli.test.cjs`.
GREEN: in parseArgs make `also-root` a repeatable list flag for trd, coverage, backfill (a `LIST_FLAGS` map like
calibrate-cli); stamp rejects it with "--also-root applies to tokens trd, coverage and backfill". Resolve values
against cwd, normalise like calibrate (error_recovery), pass `alsoRoots` to every `indexExecutorTranscripts` call
and to backfill; add `also_roots` to `--raw` JSON and the ` · also roots ...` suffix to text output only when
non-empty. Update `USAGE`, help.cjs (usage and one details sentence per subcommand), the aof-tools.cjs header/case
comment for tokens, and AOF-TOOLS-REFERENCE.md's Estimation data line (`tokens trd|coverage|backfill [--also-root <dir>]...`).
Run tokens-cli, help, help-delegation, flag-spec.repo, doc-refs.repo, token-coverage tests. Commit
`AOF commit "feat(82-04): tokens trd, coverage and backfill take --also-root" --files <the five files>`.
  </action>
  <verify>All listed tests pass; `AOF tokens stamp 01-01 --draft x --also-root y` exits 1 with the usage line; `AOF tokens --help` names --also-root</verify>
  <done>The three subcommands see a moved checkout's history when told where it was, and nothing changes otherwise.</done>
  <recovery>If help.cjs has a generated-docs check (help-delegation or gen-docs tests) that fails, regenerate only what that test names and list it.</recovery>
</task>

<task type="auto">
  <name>Task 3: Report v1.6 coverage and backfill with and without the former root</name>
  <files>(none; numbers go to the SUMMARY)</files>
  <action>
Read-only runs from the repo root, each its own Bash call, outputs saved under `$SP/82-04/`:
1. `AOF tokens coverage --raw` and `AOF tokens coverage --also-root /Users/justin/dev/devflow-claude --raw`
   (scope: the current milestone, v1.6). Record the first line of each text form too.
2. `AOF tokens backfill` and `AOF tokens backfill --also-root /Users/justin/dev/devflow-claude` (dry runs: recovered
   and unrecovered counts by reason).
3. One `tokens trd` for a pre-move TRD that was unrecovered without the flag (if any), with and without.
Write a table in the SUMMARY: run, live/counted, missing by reason, recovered/unrecovered, and the difference the
flag makes. `git status --porcelain` must show no change from these runs.
  </action>
  <verify>Both coverage runs and both backfill dry runs exit 0; the SUMMARY table has both rows; `git status --porcelain` lists nothing new besides tracked edits already committed</verify>
  <done>SC-4's "coverage over v1.6 reported with and without it" is evidenced.</done>
  <recovery>If v1.6 has no pre-move transcripts left (retention), the two rows are equal: report that, with the count of transcripts the former root matched (0), as the finding.</recovery>
</task>

</tasks>

<validation_gates>
<test>npm test (scoped per task; the full suite runs in 82-10)</test>
</validation_gates>

<verification>
- Tests 1-10 green; default outputs byte-identical; the coverage table recorded.
</verification>

<success_criteria>
- A moved checkout's executor history counts for tokens trd, coverage and backfill when its former root is named.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/82-3-1-0-follow-ups/82-04-SUMMARY.md` through
`node plugins/aoforge/aoforge/bin/aof-tools.cjs summary post`, with the coverage and backfill table.
</output>
