'use strict';
// TRD 82-05 test list 17-20: the transcript scan for `~` and guessed-home inputs. runs-81/ holds trimmed real lines
// from objective 81's recorded runs (the real username replaced by `realuser`); every other case is hand-built.
//
// The Read tool expands `~` (C-res-architecture-h-2's two `~` Reads returned the files), so a `~` input is counted
// for the record, not as a failure. The defect signal is `guessed_home`: an absolute path under the home's parent
// that the agent built itself instead of using `~` or a path it was handed.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { scanGuessedPaths, recordedAccess, scanRun } = require('./guessed-paths.cjs');
const { writeRunDir, toolUseRow, apiBlobRow, toolResultRow, runRecord } = require('../__fixtures__/records.cjs');

const RUNS81 = path.join(__dirname, '..', '__fixtures__', 'runs-81');
const HOME_PARENT = '/Users';
const REAL_HOME = '/Users/realuser';
const CLI = path.join(__dirname, 'guessed-paths.cjs');

const readRecord = (id) => JSON.parse(fs.readFileSync(path.join(RUNS81, id, 'record.json'), 'utf-8'));
const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gp82-'));

test('17: on 81 run C-res-architecture-h-2 the scan finds 2 `~` Reads where record.access recorded none', () => {
  const rec = readRecord('C-res-architecture-h-2');
  const scan = scanGuessedPaths({
    transcriptsDir: path.join(RUNS81, 'C-res-architecture-h-2', 'transcripts'),
    denials: rec.permission_denials,
    homeParent: HOME_PARENT,
    realHome: REAL_HOME,
  });
  assert.equal(scan.files_scanned, 1);
  assert.ok(scan.tool_uses_scanned >= 2, `tool_uses_scanned ${scan.tool_uses_scanned}`);
  assert.equal(scan.tilde, 2);
  assert.equal(scan.guessed_home, 0);
  assert.deepEqual(scan.entries.map((e) => [e.class, e.tool, e.path, e.denied]), [
    ['tilde', 'Read', '~/.claude/aoforge/templates/research-project/ARCHITECTURE.md', false],
    ['tilde', 'Read', '~/.claude/aoforge/references/research-tooling.md', false],
  ]);
  assert.deepEqual(scan.entries.map((e) => e.id), ['toolu_01NQahkEbCyDpsuBvTZ9FLSS', 'toolu_01KRddTMiGy3K9QNAorNAg7A']);

  // The same run counted from record.access alone: zero entries of any class.
  const recorded = recordedAccess(rec);
  assert.deepEqual(recorded, { real: 0, guessed_nonexistent: 0, tilde_denied: 0 });
  const recordedTotal = recorded.real + recorded.guessed_nonexistent + recorded.tilde_denied;
  assert.deepEqual([scan.tilde, recordedTotal], [2, 0]);
});

test('18: on 81 runs b31-r2 and b31-r1 the scan finds the guessed and the denied real-home Read', () => {
  const r2 = readRecord('b31-r2');
  const s2 = scanGuessedPaths({
    transcriptsDir: path.join(RUNS81, 'b31-r2', 'transcripts'),
    denials: r2.permission_denials,
    homeParent: HOME_PARENT,
    realHome: REAL_HOME,
  });
  assert.equal(s2.guessed_home, 1);
  assert.equal(s2.tilde, 0);
  const [g2] = s2.entries;
  assert.equal(g2.class, 'guessed_home');
  assert.equal(g2.path, '/Users/aocyber/.claude/aoforge/references/tdd.md');
  assert.equal(g2.denied, false);
  assert.match(g2.file, /\/subagents\/agent-a90723f46bd8738db\.jsonl$/);
  assert.equal(recordedAccess(r2), null);

  const r1 = readRecord('b31-r1');
  const s1 = scanGuessedPaths({
    transcriptsDir: path.join(RUNS81, 'b31-r1', 'transcripts'),
    denials: r1.permission_denials,
    homeParent: HOME_PARENT,
    realHome: REAL_HOME,
  });
  assert.equal(s1.guessed_home, 1);
  // The blob line's Bash `node ~/.claude/...` is a shell word, not a Read input: not counted.
  assert.equal(s1.tilde, 0);
  const [g1] = s1.entries;
  assert.equal(g1.denied, true);
  assert.equal(g1.path, '<home>/.claude/aoforge/references/tdd.md');
  assert.equal(recordedAccess(r1), null);
});

test('19: hand-built: what counts and what does not', () => {
  const root = tmpRoot();
  const blocks = [
    { id: 'tu_bash', name: 'Bash', input: { command: 'cat ~/.claude/aoforge/x.md' } },
    { id: 'tu_glob', name: 'Glob', input: { pattern: '~/.claude/aoforge/**/*.md' } },
    { id: 'tu_grep', name: 'Grep', input: { pattern: 'model', path: '/Users/someone/.claude/aoforge' } },
    { id: 'tu_inside', name: 'Read', input: { file_path: '/private/tmp/claude-501/e82-0123456789abcdef/runs/E/x/home/.claude/aoforge/a.md' } },
  ];
  const runDir = writeRunDir(root, 'E', 'x', {
    lines: {
      'k/s.jsonl': [toolUseRow(blocks), toolResultRow('tu_glob', 'a.md'), apiBlobRow(blocks)],
    },
  });
  const denials = [
    { tool_name: 'Read', tool_use_id: 'tu_gone', tool_input: { file_path: '/Users/guess/.claude/aoforge/b.md' } },
    { tool_name: 'Glob', tool_use_id: 'tu_glob', tool_input: { pattern: '~/.claude/aoforge/**/*.md' } },
  ];
  const scan = scanGuessedPaths({ transcriptsDir: path.join(runDir, 'transcripts'), denials, homeParent: HOME_PARENT, realHome: REAL_HOME });
  assert.equal(scan.files_scanned, 1);
  assert.equal(scan.tool_uses_scanned, 5);
  assert.equal(scan.tilde, 1);
  assert.equal(scan.guessed_home, 2);
  assert.deepEqual(scan.entries.map((e) => [e.id, e.class, e.tool, e.denied]), [
    ['tu_glob', 'tilde', 'Glob', true],
    ['tu_grep', 'guessed_home', 'Grep', false],
    ['tu_gone', 'guessed_home', 'Read', true],
  ]);
  assert.equal(scan.entries[2].file, null);

  // No transcripts: not scanned (0 files), never a clean zero.
  const empty = writeRunDir(root, 'E', 'empty', { record: runRecord({ id: 'empty', batch: 'E' }) });
  const none = scanGuessedPaths({ transcriptsDir: path.join(empty, 'transcripts'), homeParent: HOME_PARENT, realHome: REAL_HOME });
  assert.equal(none.files_scanned, 0);
  assert.equal(none.tilde, 0);
  assert.equal(none.guessed_home, 0);
});

test('19: an absolute path under the home parent is guessed even when it detours back into the sandbox', () => {
  const root = tmpRoot();
  const runDir = writeRunDir(root, 'E', 'detour', {
    lines: {
      'k/s.jsonl': [toolUseRow([{ id: 'tu_d', name: 'Read', input: { file_path: '/Users/../private/tmp/claude-501/e81-0123456789abcdef/runs/E/b30-r2/home/.claude/aoforge/a.md' } }])],
    },
  });
  const scan = scanGuessedPaths({ transcriptsDir: path.join(runDir, 'transcripts'), homeParent: HOME_PARENT, realHome: REAL_HOME });
  assert.equal(scan.guessed_home, 1);
});

test('scanRun reads the record denials and access beside the transcripts', () => {
  const runDir = path.join(RUNS81, 'b31-r1');
  const row = scanRun(runDir, { homeParent: HOME_PARENT, realHome: REAL_HOME });
  assert.equal(row.id, 'b31-r1');
  assert.equal(row.guessed_home, 1);
  assert.equal(row.recorded, 'not_recorded');
  const c = scanRun(path.join(RUNS81, 'C-res-architecture-h-2'), { homeParent: HOME_PARENT, realHome: REAL_HOME });
  assert.deepEqual(c.recorded, { real: 0, guessed_nonexistent: 0, tilde_denied: 0 });
});

test('20: the CLI prints one row per run dir (never *.prev-*) and exits 1 on a missing flag', () => {
  const root = tmpRoot();
  writeRunDir(root, 'C', 'r1', {
    record: runRecord({ id: 'r1', batch: 'C', access: { real: [], non_escape: [{ class: 'tilde_denied', tool: 'Read', denied: true, path: '~/.claude/x' }], impaired: true, impaired_by: ['~/.claude/x'] } }),
    lines: { 'k/s.jsonl': [toolUseRow([{ id: 'tu_1', name: 'Read', input: { file_path: '~/.claude/aoforge/a.md' } }])] },
  });
  writeRunDir(root, 'C', 'r2', { record: runRecord({ id: 'r2', batch: 'C', access: { real: [], non_escape: [], impaired: false, impaired_by: [] } }) });
  writeRunDir(root, 'C', 'r1.prev-1', {
    record: runRecord({ id: 'r1', batch: 'C' }),
    lines: { 'k/s.jsonl': [toolUseRow([{ id: 'tu_p', name: 'Read', input: { file_path: '/Users/x/a.md' } }])] },
  });
  const r = spawnSync(process.execPath, [CLI, '--root', root, '--batch', 'C', '--home-parent', HOME_PARENT, '--real-home', REAL_HOME, '--raw'], { encoding: 'utf-8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.batch, 'C');
  assert.deepEqual(out.runs.map((x) => x.id), ['r1', 'r2']);
  assert.deepEqual(pickCounts(out.runs[0]), { files_scanned: 1, tilde: 1, guessed_home: 0, recorded: { real: 0, guessed_nonexistent: 0, tilde_denied: 1 } });
  assert.deepEqual(pickCounts(out.runs[1]), { files_scanned: 0, tilde: 0, guessed_home: 0, recorded: { real: 0, guessed_nonexistent: 0, tilde_denied: 0 } });

  const table = spawnSync(process.execPath, [CLI, '--root', root, '--batch', 'C', '--home-parent', HOME_PARENT, '--real-home', REAL_HOME], { encoding: 'utf-8' });
  assert.equal(table.status, 0, table.stderr);
  assert.match(table.stdout, /r2 .*not scanned/);

  const bad = spawnSync(process.execPath, [CLI, '--root', root], { encoding: 'utf-8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /usage:/);
});

test('20: a record with no access field reports not_recorded', () => {
  const root = tmpRoot();
  const rec = runRecord({ id: 'b1', batch: 'E' });
  writeRunDir(root, 'E', 'b1', { record: rec });
  const r = spawnSync(process.execPath, [CLI, '--root', root, '--batch', 'E', '--home-parent', HOME_PARENT, '--real-home', REAL_HOME, '--raw'], { encoding: 'utf-8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).runs[0].recorded, 'not_recorded');
});

function pickCounts(row) {
  return { files_scanned: row.files_scanned, tilde: row.tilde, guessed_home: row.guessed_home, recorded: row.recorded };
}
