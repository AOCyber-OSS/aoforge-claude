'use strict';
// Tests for runner.checkTools, the first-run init-tools check (TRD 81-08), as relaxed after batch A's first live run
// (TRD 81-14, post-hoc harness deviation accepted by the user on 2026-10-17: "relax, re-run").
//
// Claude Code 2.1.302 listed the verifier's tools as `Read, Write, Bash, Task, Edit` against the frontmatter's
// `Read, Write, Bash, Grep, Glob, Agent` (run A-A1-haiku-r1). The relaxed check:
//   - Agent and Task satisfy each other;
//   - Grep and Glob count as present when Bash is in the init tools (the CLI serves search through Bash);
//   - Edit is allowed when Write is declared;
//   - any other missing declared tool, or an undeclared Edit/Write/WebFetch/WebSearch/NotebookEdit, still fails.
//
// The agent frontmatter is read from this checkout's plugins/aoforge, whose agents equal the pinned 3.1.0 tree.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { checkTools } = require('./runner.cjs');

const PLUGIN_DIR = path.join(__dirname, '..', '..', '..', 'plugins', 'aoforge');
const agent = (name) => ({ kind: 'agent', agent: `aoforge:${name}`, tools: null });

describe('checkTools, relaxed for CLI 2.1.302 tool naming (81-14 post-hoc)', () => {
  test('1. the verifier listing observed live on A-A1-haiku-r1 passes', () => {
    const r = checkTools(agent('verifier'), ['Read', 'Write', 'Bash', 'Task', 'Edit'], PLUGIN_DIR);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.missing, []);
    assert.deepEqual(r.unexpected, []);
    assert.deepEqual(r.expected, ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Agent']);
    assert.deepEqual(r.satisfied_by, { Grep: 'Bash', Glob: 'Bash', Agent: 'Task' });
  });

  test('2. the verifier still fails when neither Agent nor Task is listed', () => {
    const r = checkTools(agent('verifier'), ['Read', 'Write', 'Bash', 'Edit'], PLUGIN_DIR);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['Agent']);
  });

  test('3. Grep and Glob are missing when Bash is not listed either', () => {
    const r = checkTools(agent('verifier'), ['Read', 'Write', 'Task', 'Edit'], PLUGIN_DIR);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['Bash', 'Grep', 'Glob']);
  });

  test('4. an undeclared WebFetch, WebSearch or NotebookEdit still fails the verifier', () => {
    for (const extra of ['WebFetch', 'WebSearch', 'NotebookEdit']) {
      const r = checkTools(agent('verifier'), ['Read', 'Write', 'Bash', 'Task', 'Edit', extra], PLUGIN_DIR);
      assert.equal(r.ok, false, extra);
      assert.deepEqual(r.unexpected, [extra]);
    }
  });

  test('5. a missing Read still fails', () => {
    const r = checkTools(agent('verifier'), ['Write', 'Bash', 'Task', 'Edit'], PLUGIN_DIR);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['Read']);
  });

  test('6. job-checker (Read, Bash, Glob, Grep; no Write): passes on Read, Bash; Edit or Write is unexpected', () => {
    const ok = checkTools(agent('job-checker'), ['Read', 'Bash'], PLUGIN_DIR);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.deepEqual(ok.satisfied_by, { Glob: 'Bash', Grep: 'Bash' });
    const withEdit = checkTools(agent('job-checker'), ['Read', 'Bash', 'Edit'], PLUGIN_DIR);
    assert.equal(withEdit.ok, false);
    assert.deepEqual(withEdit.unexpected, ['Edit']);
    const withWrite = checkTools(agent('job-checker'), ['Read', 'Bash', 'Write', 'Edit'], PLUGIN_DIR);
    assert.equal(withWrite.ok, false);
    assert.deepEqual(withWrite.unexpected, ['Edit', 'Write']);
    const noBash = checkTools(agent('job-checker'), ['Read'], PLUGIN_DIR);
    assert.equal(noBash.ok, false);
    assert.deepEqual(noBash.missing, ['Bash', 'Glob', 'Grep']);
  });

  test('7. codebase-mapper (Read, Bash, Grep, Glob, Write): passes with Edit beside Write', () => {
    const r = checkTools(agent('codebase-mapper'), ['Read', 'Bash', 'Write', 'Edit'], PLUGIN_DIR);
    assert.equal(r.ok, true, JSON.stringify(r));
    const web = checkTools(agent('codebase-mapper'), ['Read', 'Bash', 'Write', 'Edit', 'WebSearch'], PLUGIN_DIR);
    assert.equal(web.ok, false);
    assert.deepEqual(web.unexpected, ['WebSearch']);
  });

  test('8. project-researcher (Read, Write, Bash, Grep, Glob, WebSearch, WebFetch): WebFetch is still required', () => {
    const ok = checkTools(agent('project-researcher'), ['Read', 'Write', 'Bash', 'Edit', 'WebSearch', 'WebFetch'], PLUGIN_DIR);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    const noFetch = checkTools(agent('project-researcher'), ['Read', 'Write', 'Bash', 'Edit', 'WebSearch'], PLUGIN_DIR);
    assert.equal(noFetch.ok, false);
    assert.deepEqual(noFetch.missing, ['WebFetch']);
    const notebook = checkTools(agent('project-researcher'), ['Read', 'Write', 'Bash', 'Edit', 'WebSearch', 'WebFetch', 'NotebookEdit'], PLUGIN_DIR);
    assert.equal(notebook.ok, false);
    assert.deepEqual(notebook.unexpected, ['NotebookEdit']);
  });

  test('9. --tools lists get the same rules: the C grader (--tools "") passes on none and fails on Edit', () => {
    const none = checkTools({ kind: 'agent', tools: [] }, [], null);
    assert.equal(none.ok, true);
    const edit = checkTools({ kind: 'agent', tools: [] }, ['Edit'], null);
    assert.equal(edit.ok, false);
    assert.deepEqual(edit.unexpected, ['Edit']);
    const named = checkTools({ kind: 'agent', tools: ['Read', 'Write', 'Agent'] }, ['Read', 'Write', 'Edit', 'Task'], null);
    assert.equal(named.ok, true, JSON.stringify(named));
  });

  test('10. the fake claude\'s wrong_tools listing (Edit, WebSearch, NotebookEdit) still fails the verifier', () => {
    const r = checkTools(agent('verifier'), ['Edit', 'WebSearch', 'NotebookEdit'], PLUGIN_DIR);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Agent']);
    assert.deepEqual(r.unexpected, ['WebSearch', 'NotebookEdit']);
  });

  test('11. an exact listing reports no satisfied_by entries', () => {
    const r = checkTools(agent('verifier'), ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Agent'], PLUGIN_DIR);
    assert.equal(r.ok, true);
    assert.deepEqual(r.satisfied_by, {});
  });
});
