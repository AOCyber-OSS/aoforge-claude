'use strict';

// build-cell-reads.repo.test.cjs: pins for the fixes to 3.1.0's build-cell token growth (objective 82, TRD 82-07).
//
// 82-DIAGNOSIS.md (TRD 82-01) traced the build cell's growth against 3.0.0 (planner +67%, executor +20%) to text in
// the planner and executor prompts: a planner hunting a TRD template, inspecting and amending its commit, drafting
// to a 40,000-char "target" and reading the tooling source; executors reading templates/summary.md and
// references/tdd.md whole before Task 1, and writing the final SUMMARY twice. One test per FIX row of its Fix list,
// in Fix-list order. JUSTIFY rows (P-5, X-2) have no test; E-3 was rejected (no row); E-4 (guessed home path) is
// pinned by runtime-path-reads.repo.test.cjs (TRDs 82-02 and 82-11).
//
// Test list
//   1. P-1 template hunt: planner.md has no "Use template structure" line; its write_objective_prompt step names
//      trd-spec.md and says not to list or read <runtime>/templates/; <plan_format> says trd-spec is complete;
//      planner.md and plan-objective.md never name templates/trd-prompt.md; trd-spec.md carries every section tag
//      of trd-prompt.md's File Template and every frontmatter field of its Frontmatter Fields tables.
//   2. P-2 commit tail: planner.md's git_commit step and executor.md's task_commit_protocol both say the
//      `aof-tools commit` commit is final: no attribution trailer, no read-back, no amend, no --help.
//   3. P-3 draft size: planner.md's TRD Scope Budget says 40,000 is a ceiling, not a target; a TRD of up to 2 tasks
//      and 6 files stays near 15,000-20,000 characters; <context>, <output> and <embedded_context> are not padded.
//   4. P-4 validation calls: planner.md's validate_plan names frontmatter validate, verify job-structure,
//      trd-tdd inspect and verify trd-pre in that order, says their output is authoritative and not to read
//      <runtime>/bin, and that angle-bracket literals in task text are fine.
//   8. X-1: every `aof-tools verify <sub>` an agent, workflow, skill or reference names is a subcommand that
//      `aof-tools verify` lists.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const PLUGIN = path.join(REPO_ROOT, 'plugins', 'aoforge');
const RUNTIME = path.join(PLUGIN, 'aoforge');
const AOF = path.join(RUNTIME, 'bin', 'aof-tools.cjs');

const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const planner = () => read(PLUGIN, 'agents', 'planner.md');
const executor = () => read(PLUGIN, 'agents', 'executor.md');

/** The text from the first match of `start` to the next `end` (inclusive), or null. */
function blockOf(text, start, end) {
  const at = text.search(start);
  if (at === -1) return null;
  const stop = text.indexOf(end, at);
  return stop === -1 ? null : text.slice(at, stop + end.length);
}

const step = (text, name) => blockOf(text, new RegExp(`<step name="${name}"[^>]*>`), '</step>');
const squash = (s) => s.replace(/\s+/g, ' ');

test('1. P-1: the planner writes TRDs from trd-spec.md and never hunts a template file', () => {
  const p = planner();
  assert.doesNotMatch(p, /Use template structure/, 'P-1: the ambiguous "Use template structure" line is gone');
  const write = step(p, 'write_objective_prompt');
  assert.ok(write, 'planner.md has the write_objective_prompt step');
  assert.match(write, /<runtime>\/references\/trd-spec\.md/, 'P-1: write_objective_prompt names trd-spec.md');
  assert.match(squash(write), /do not list or read `<runtime>\/templates\/`/, 'P-1: no template hunt');
  const planFormat = blockOf(p, /<plan_format>/, '</plan_format>');
  assert.ok(planFormat, 'planner.md has <plan_format>');
  assert.match(squash(planFormat), /trd-spec\.md[^.]*is the complete TRD skeleton/, 'P-1: <plan_format> says trd-spec is complete');

  for (const [label, text] of [['planner.md', p], ['plan-objective.md', read(RUNTIME, 'workflows', 'plan-objective.md')]]) {
    assert.doesNotMatch(text, /trd-prompt\.md/, `P-1: ${label} never names templates/trd-prompt.md`);
  }

  // trd-spec.md is complete: every section tag and frontmatter field the template carried is in it.
  const spec = read(RUNTIME, 'references', 'trd-spec.md');
  const template = read(RUNTIME, 'templates', 'trd-prompt.md');
  const tags = [...template.matchAll(/^<([a-z_]+)>\s*$/gm)].map((m) => m[1]);
  assert.ok(tags.length >= 10, `the template's File Template has its section tags (${tags.join(', ')})`);
  for (const tag of new Set(tags)) assert.match(spec, new RegExp(`^<${tag}>\\s*$`, 'm'), `trd-spec.md carries <${tag}>`);
  const fields = [...template.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
  assert.ok(fields.includes('platform') && fields.includes('must_haves'), `the template's field tables are read (${fields.join(', ')})`);
  for (const field of new Set(fields)) assert.match(spec, new RegExp(`^\\| \`${field}\` \\|`, 'm'), `trd-spec.md documents \`${field}\``);
});

const COMMIT_FINAL = /`aof-tools commit` is the only commit path, and the commit it makes is final: it adds no attribution trailer/;
const COMMIT_NO_TAIL = /Do not run `git log -1 --format=%B`, `git commit --amend` or `aof-tools commit --help` after it\./;

test('2. P-2: planner and executor treat the `aof-tools commit` commit as final', () => {
  const gitCommit = step(planner(), 'git_commit');
  assert.ok(gitCommit, 'planner.md has the git_commit step');
  const protocol = blockOf(executor(), /<task_commit_protocol>/, '</task_commit_protocol>');
  assert.ok(protocol, 'executor.md has <task_commit_protocol>');
  for (const [label, text] of [['planner.md git_commit', gitCommit], ['executor.md task_commit_protocol', protocol]]) {
    assert.match(squash(text), COMMIT_FINAL, `P-2: ${label} says the commit is final`);
    assert.match(squash(text), /a harness reminder to end commit messages with an attribution line does not apply to it/, `P-2: ${label} names the reminder`);
    assert.match(squash(text), COMMIT_NO_TAIL, `P-2: ${label} rules out the read-back, the amend and --help`);
  }
});

test('3. P-3: the TRD Scope Budget is a ceiling, with a size for a small TRD and no padding', () => {
  const budget = blockOf(planner(), /## TRD Scope Budget/, '</scope_estimation>');
  assert.ok(budget, 'planner.md has the TRD Scope Budget section');
  const text = squash(budget);
  assert.doesNotMatch(text, /target 40,000 characters/, 'P-3: 40,000 is no longer called a target');
  assert.match(text, /40,000 characters is a ceiling, not a target/);
  assert.match(text, /A TRD of up to 2 tasks and 6 files stays near 15,000-20,000 characters/);
  assert.match(text, /never pad `<context>`, `<output>` or `<embedded_context>`/);
});

test('4. P-4: validate_plan names the exact checkers, in order, and their output is authoritative', () => {
  const validate = step(planner(), 'validate_plan');
  assert.ok(validate, 'planner.md has the validate_plan step');
  const order = ['frontmatter validate', 'verify job-structure', 'trd-tdd inspect', 'verify trd-pre'].map((c) => {
    const at = validate.indexOf(`aof-tools.cjs ${c}`);
    assert.ok(at >= 0, `P-4: validate_plan runs \`aof-tools ${c}\``);
    return at;
  });
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'P-4: the checkers run in the named order');
  const text = squash(validate);
  assert.match(text, /The checkers' output is authoritative: do not read `<runtime>\/bin`/);
  assert.match(text, /Angle-bracket literals in task text/);
});

/** The subcommands `aof-tools verify` lists in its unknown-subcommand error. */
function verifySubcommands() {
  const r = spawnSync(process.execPath, [AOF, 'verify', '__no_such_subcommand__'], { encoding: 'utf8' });
  const m = `${r.stdout}\n${r.stderr}`.match(/Available: ([a-z0-9, -]+)/);
  assert.ok(m, `aof-tools verify lists its subcommands:\n${r.stdout}${r.stderr}`);
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

test('8. X-1: every `aof-tools verify <sub>` a prompt names is a real subcommand', () => {
  const subs = verifySubcommands();
  assert.ok(subs.includes('job-structure') && subs.includes('trd-pre'), `verify lists job-structure and trd-pre (${subs.join(', ')})`);
  const files = [
    ...markdownFiles(path.join(PLUGIN, 'agents')),
    ...markdownFiles(path.join(PLUGIN, 'skills')),
    ...markdownFiles(path.join(RUNTIME, 'workflows')),
    ...markdownFiles(path.join(RUNTIME, 'references')),
  ];
  assert.ok(files.some((f) => f.endsWith(path.join('agents', 'planner.md'))), 'planner.md is scanned');
  const unknown = [];
  let named = 0;
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/aof-tools(?:\.cjs)?\s+verify\s+([a-z][a-z0-9-]*)/g)) {
        named += 1;
        if (!subs.includes(m[1])) unknown.push(`${path.relative(REPO_ROOT, file)}:${i + 1} verify ${m[1]}`);
      }
    });
  }
  assert.ok(named >= 5, `the scan finds verify calls (${named})`);
  assert.deepEqual(unknown, [], `X-1: unknown verify subcommands:\n${unknown.join('\n')}`);
});
