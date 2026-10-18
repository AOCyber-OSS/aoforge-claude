'use strict';
// Tests for scripts/eval82/lib/attribution.cjs (TRD 82-01): per-call token attribution over Claude Code transcripts.
// Every transcript is hand-built JSONL from __fixtures__/attribution-transcripts.cjs written into an mkdtemp
// directory; the hand-computed totals live in that file. No network, no claude binary, no ~/.claude.
//
// Test list (outermost first)
//  1. CLI: --run <dir> --role <r> --json prints one JSON object per spawn of that role (calls, total_tokens,
//     mean_context, output_tokens, categories); --compare <A> <B> --role <r> prints the per-category deltas and the
//     decomposition; a missing flag exits 1 with a usage line.
//  2. roleSpawns(runDir) finds the main session and each subagent by meta agentType; no meta is role `unknown`;
//     `*.prev-*` siblings are never read.
//  3. apiCalls(lines) dedupes assistant records by message.id: a call over three lines counts once, its usage once;
//     calls keep transcript order; a line that is not JSON is skipped and counted.
//  4. A call's context is input + cache_creation + cache_read; a spawn total is the sum of context + output and
//     equals the hand-computed number (and objective 81's per-role number).
//  5. Tool results join their tool_use by id; result size is measured for string content, array content and a
//     persisted tool-results pointer.
//  6. categorize(tool) maps each rule of the ordered list (one case each).
//  7. attribute(calls) gives per category the count, issuing tokens and carry.
//  8. compare(a, b): per-category deltas of count, issuing tokens and carry; the decomposition
//     dtotal = dcalls x meanContext(a) + calls(b) x dMeanContext + doutput holds.
//  9. Deterministic: the same input gives byte-identical JSON.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const fx = require('../__fixtures__/attribution-transcripts.cjs');
const tx81 = require('../../eval81/__fixtures__/transcripts.cjs');

const MODULE = path.join(__dirname, 'attribution.cjs');
const load = () => require('./attribution.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'attr-'));

const E = fx.PLANNER_PAIR_EXPECTED;

/** A run dir with the 3.0.0 ('old') or 3.1.0 ('new') hand-built planner. */
function plannerRun(which) {
  const dir = tmp();
  fx.writePlannerRun(dir, which);
  return dir;
}

/** The summary of the one planner spawn of a run dir. */
function plannerSummary(runDir) {
  const { roleSpawns, summarizeSpawn } = load();
  const spawn = roleSpawns(runDir).spawns.find((s) => s.role === 'planner');
  return summarizeSpawn(spawn);
}

/** Run main() and collect what it printed. */
function runMain(argv) {
  const { main } = load();
  const out = [];
  const err = [];
  const code = main(argv, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, stdout: out.join(''), stderr: err.join('') };
}

const jsonLines = (text) => text.split('\n').filter(Boolean).map((l) => JSON.parse(l));

describe('1. CLI', () => {
  test('1. --run --role --json prints one JSON object per spawn of the role', () => {
    const runDir = plannerRun('old');
    const r = runMain(['--run', runDir, '--role', 'aoforge:planner', '--json']);
    assert.equal(r.code, 0, r.stderr);
    const objs = jsonLines(r.stdout);
    assert.equal(objs.length, 1);
    const o = objs[0];
    assert.equal(o.role, 'planner');
    assert.equal(o.agent_id, 'old-planner');
    assert.equal(o.calls, E.old.calls);
    assert.equal(o.total_tokens, E.old.total_tokens);
    assert.equal(o.mean_context, E.old.mean_context);
    assert.equal(o.output_tokens, E.old.output_tokens);
    assert.deepEqual(Object.keys(o.categories).sort(), Object.keys(E.old.categories).sort());
    assert.deepEqual(o.categories.context_load, E.old.categories.context_load);
  });

  test('1. two spawns of the role give two lines, in spawn order; the bare role name works too', () => {
    const dir = tmp();
    const pair = fx.planner3031Pair();
    fx.writeRun(dir, { main: [fx.promptRow()], subagents: [pair.old, pair.new] });
    const r = runMain(['--run', dir, '--role', 'planner', '--json']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(jsonLines(r.stdout).map((o) => o.agent_id).sort(), ['new-planner', 'old-planner']);
  });

  test('1. --calls adds the per-call listing (index, context, tools with category and detail)', () => {
    const runDir = plannerRun('new');
    const r = runMain(['--run', runDir, '--role', 'planner', '--json', '--calls']);
    assert.equal(r.code, 0, r.stderr);
    const o = jsonLines(r.stdout)[0];
    assert.equal(o.call_list.length, 6);
    assert.equal(o.call_list[1].index, 2);
    assert.equal(o.call_list[1].context, 22002);
    assert.equal(o.call_list[1].tools[0].category, 'runtime_lookup');
    assert.ok(o.call_list[1].tools[0].detail.length <= 120);
  });

  test('1. --compare prints the per-category deltas and the decomposition', () => {
    const a = plannerRun('old');
    const b = plannerRun('new');
    const r = runMain(['--compare', a, b, '--role', 'aoforge:planner', '--json']);
    assert.equal(r.code, 0, r.stderr);
    const o = JSON.parse(r.stdout);
    assert.equal(o.aggregate.decomposition.dtotal, E.decomposition.dtotal);
    assert.equal(o.aggregate.decomposition.calls_term, E.decomposition.calls_term);
    assert.equal(o.pairs.length, 1);
    const row = o.aggregate.categories.find((c) => c.category === 'runtime_lookup');
    assert.equal(row.dcount, 1);
    assert.equal(row.dissuing, 22402);
  });

  test('1. without --json the output is a readable table naming the role and the calls', () => {
    const runDir = plannerRun('new');
    const r = runMain(['--run', runDir, '--role', 'planner']);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /planner/);
    assert.match(r.stdout, /calls/);
    assert.match(r.stdout, /runtime_lookup/);
  });

  test('1. a missing flag exits 1 with a usage line', () => {
    const runDir = plannerRun('old');
    for (const argv of [[], ['--run', runDir], ['--role', 'planner'], ['--compare', runDir, '--role', 'planner'], ['--compare', runDir, runDir]]) {
      const r = runMain(argv);
      assert.equal(r.code, 1, JSON.stringify(argv));
      assert.match(r.stderr, /usage/i);
    }
  });

  test('1. the real CLI process runs with a scratch HOME and prints the same JSON', () => {
    const runDir = plannerRun('old');
    const home = tmp();
    const res = spawnSync(process.execPath, [MODULE, '--run', runDir, '--role', 'aoforge:planner', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, HOME: home, TMPDIR: home },
    });
    assert.equal(res.status, 0, res.stderr);
    const o = jsonLines(res.stdout)[0];
    assert.equal(o.total_tokens, E.old.total_tokens);
    const bad = spawnSync(process.execPath, [MODULE], { encoding: 'utf8', env: { ...process.env, HOME: home, TMPDIR: home } });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /usage/i);
  });
});

describe('2. roleSpawns', () => {
  test('2. finds the main session and each subagent by meta agentType; no meta is `unknown`', () => {
    const { roleSpawns } = load();
    const dir = tmp();
    const pair = fx.planner3031Pair();
    fx.writeRun(dir, {
      main: [fx.promptRow()],
      subagents: [
        pair.old,
        { agentId: 'exec1', agentType: 'aoforge:executor', rows: [fx.promptRow({ agentId: 'exec1' })] },
        { agentId: 'mystery', agentType: null, rows: [fx.promptRow({ agentId: 'mystery' })] },
      ],
    });
    const got = roleSpawns(dir).spawns;
    const byId = Object.fromEntries(got.map((s) => [s.agent_id || 'main', s]));
    assert.equal(got.length, 4);
    assert.equal(byId.main.role, 'orchestrator');
    assert.equal(byId['old-planner'].role, 'planner');
    assert.equal(byId['old-planner'].agent_type, 'aoforge:planner');
    assert.equal(byId.exec1.role, 'executor');
    assert.equal(byId.mystery.role, 'unknown');
    assert.ok(path.isAbsolute(byId['old-planner'].file) && fs.existsSync(byId['old-planner'].file));
  });

  test('2. a `*.prev-*` sibling run dir is never read, and listRuns skips it', () => {
    const { roleSpawns, listRuns } = load();
    const parent = tmp();
    const live = path.join(parent, 'b31-r1');
    const prev = path.join(parent, 'b31-r1.prev-1');
    const other = path.join(parent, 'b30-r1');
    fx.writePlannerRun(live, 'new');
    fx.writePlannerRun(prev, 'old');
    fx.writePlannerRun(other, 'old');
    const ids = roleSpawns(live).spawns.map((s) => s.agent_id);
    assert.ok(ids.includes('new-planner'));
    assert.ok(!ids.includes('old-planner'));
    assert.deepEqual(listRuns(parent), ['b30-r1', 'b31-r1']);
  });

  test('2. a run dir with no transcripts gives no spawns and a reason, never a throw', () => {
    const { roleSpawns } = load();
    const r = roleSpawns(tmp());
    assert.deepEqual(r.spawns, []);
    assert.match(r.reason, /no transcripts/);
  });
});

describe('3. apiCalls', () => {
  test('3. a call spread over three lines counts once and its usage once; calls keep transcript order', () => {
    const { apiCalls } = load();
    const rows = [
      ...fx.assistantCall({
        id: 'm1',
        splitInto: 3,
        usage: [{ input: 2, cc: 100, cr: 0, out: 10 }, { input: 2, cc: 100, cr: 0, out: 300 }, { input: 2, cc: 100, cr: 0, out: 300 }],
        tools: [{ id: 'a', name: 'Bash', input: { command: 'ls' } }, { id: 'b', name: 'Bash', input: { command: 'pwd' } }],
      }),
      fx.toolResult({ toolUseId: 'a', content: 'out-a' }),
      fx.toolResult({ toolUseId: 'b', content: 'out-b' }),
      ...fx.assistantCall({ id: 'm2', usage: { input: 1, cc: 5, cr: 200, out: 7 }, text: 'done' }),
    ];
    const { calls, skipped_lines } = apiCalls(rows.map((r) => JSON.stringify(r)));
    assert.equal(skipped_lines, 0);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((c) => c.id), ['m1', 'm2']);
    assert.deepEqual(calls.map((c) => c.index), [1, 2]);
    assert.equal(calls[0].output_tokens, 300, 'the record with the largest output wins, as objective 81 counts');
    assert.equal(calls[0].context, 2 + 100 + 0);
    assert.deepEqual(calls[0].tools.map((t) => t.id), ['a', 'b']);
    assert.equal(calls[1].tools.length, 0);
  });

  test('3. a synthetic-model row and non-assistant rows are not calls; a line that is not JSON is skipped and counted', () => {
    const { apiCalls } = load();
    const lines = [
      '{not json',
      '',
      JSON.stringify({ type: 'attachment', attachment: { type: 'date' } }),
      ...fx.assistantCall({ id: 'syn', model: '<synthetic>', usage: { input: 9, cc: 9, cr: 9, out: 9 }, text: 'x' }).map((r) => JSON.stringify(r)),
      ...fx.assistantCall({ id: 'm1', usage: { input: 1, cc: 2, cr: 3, out: 4 }, text: 'x' }).map((r) => JSON.stringify(r)),
    ];
    const { calls, skipped_lines } = apiCalls(lines);
    assert.equal(calls.length, 1);
    assert.equal(skipped_lines, 1);
  });

  test('3. a text blob with newlines is accepted as well as an array of lines', () => {
    const { apiCalls } = load();
    const text = fx.toLines(fx.assistantCall({ id: 'm1', usage: { input: 1, cc: 2, cr: 3, out: 4 }, text: 'x' }));
    assert.equal(apiCalls(text).calls.length, 1);
  });
});

describe('4. context and totals', () => {
  test('4. context = input + cache_creation + cache_read; the spawn total is context + output summed', () => {
    const { apiCalls } = load();
    const pair = fx.planner3031Pair();
    const { calls } = apiCalls(pair.old.rows.map((r) => JSON.stringify(r)));
    assert.deepEqual(calls.map((c) => c.context), [20003, 21502, 22302, 22601]);
    assert.deepEqual(calls.map((c) => c.output_tokens), [400, 600, 300, 200]);
    assert.deepEqual(calls.map((c) => c.total), [20403, 22102, 22602, 22801]);
  });

  test('4. summarizeSpawn totals equal the hand-computed numbers for the 3.0.0 and 3.1.0 planners', () => {
    for (const which of ['old', 'new']) {
      const s = plannerSummary(plannerRun(which));
      assert.equal(s.calls, E[which].calls, which);
      assert.equal(s.context_tokens, E[which].context_tokens, which);
      assert.equal(s.output_tokens, E[which].output_tokens, which);
      assert.equal(s.total_tokens, E[which].total_tokens, which);
      assert.equal(s.mean_context, E[which].mean_context, which);
    }
  });

  test('4. the spawn total agrees with objective 81 roles.cjs total_tokens', () => {
    const { rolesForRun } = require('../../eval81/lib/roles.cjs');
    for (const which of ['old', 'new']) {
      const dir = plannerRun(which);
      const row = rolesForRun(dir, { rates: tx81.RATES }).rows.find((r) => r.role === 'planner');
      assert.equal(plannerSummary(dir).total_tokens, row.total_tokens, which);
    }
  });
});

describe('5. tool results', () => {
  test('5. a result joins its tool_use by id: string, array of text blocks, persisted pointer, missing, error', () => {
    const { apiCalls } = load();
    const dir = tmp();
    const resultsDir = path.join(dir, 'tool-results');
    fs.mkdirSync(resultsDir);
    fs.writeFileSync(path.join(resultsDir, 'big.txt'), 'z'.repeat(8000));
    const pointerRow = fx.toolResult({ toolUseId: 't3', content: 'preview', persistedPath: '/gone/home/.claude/projects/k/s/tool-results/big.txt' });
    const pointerText = pointerRow.message.content[0].content;
    const rows = [
      ...fx.assistantCall({
        id: 'm1',
        usage: { input: 1, cc: 1, cr: 1, out: 1 },
        tools: ['t1', 't2', 't3', 't4', 't5'].map((id) => ({ id, name: 'Bash', input: { command: 'echo' } })),
      }),
      fx.toolResult({ toolUseId: 't1', content: 'a'.repeat(100) }),
      fx.toolResult({ toolUseId: 't2', content: [{ type: 'text', text: 'b'.repeat(60) }, { type: 'text', text: 'c'.repeat(40) }] }),
      pointerRow,
      fx.toolResult({ toolUseId: 't5', content: 'boom', isError: true }),
    ];
    const { calls } = apiCalls(rows.map((r) => JSON.stringify(r)), { toolResultsDir: resultsDir });
    const t = Object.fromEntries(calls[0].tools.map((x) => [x.id, x]));
    assert.equal(t.t1.result_chars, 100);
    assert.equal(t.t2.result_chars, 100);
    assert.equal(t.t3.result_chars, pointerText.length, 'the text in context is the pointer and its preview');
    assert.equal(t.t3.persisted_chars, 8000, 'the persisted file beside the transcript is measured too');
    assert.equal(t.t4.result_chars, 0);
    assert.equal(t.t4.result_missing, true);
    assert.equal(t.t5.is_error, true);
    assert.equal(t.t1.persisted_chars, null);
  });

  test('5. a pointer whose file is not there gives persisted_chars null, never a throw', () => {
    const { apiCalls } = load();
    const rows = [
      ...fx.assistantCall({ id: 'm1', usage: { input: 1, cc: 1, cr: 1, out: 1 }, tools: [{ id: 't1', name: 'Bash', input: { command: 'echo' } }] }),
      fx.toolResult({ toolUseId: 't1', content: 'p', persistedPath: '/gone/tool-results/none.txt' }),
    ];
    const { calls } = apiCalls(rows.map((r) => JSON.stringify(r)), { toolResultsDir: path.join(tmp(), 'tool-results') });
    assert.equal(calls[0].tools[0].persisted_chars, null);
    assert.ok(calls[0].tools[0].result_chars > 0);
  });

  test('5. roleSpawns hands summarizeSpawn the tool-results dir beside the transcript', () => {
    const { roleSpawns, summarizeSpawn } = load();
    const dir = tmp();
    const resultsDir = 'big.txt';
    const rows = [
      fx.promptRow({ agentId: 'p1' }),
      ...fx.assistantCall({ id: 'm1', agentId: 'p1', usage: { input: 1, cc: 1, cr: 1, out: 1 }, tools: [{ id: 't1', name: 'Bash', input: { command: 'echo' } }] }),
      fx.toolResult({ toolUseId: 't1', agentId: 'p1', content: 'p', persistedPath: '/gone/tool-results/big.txt' }),
    ];
    fx.writeRun(dir, { main: [fx.promptRow()], subagents: [{ agentId: 'p1', agentType: 'aoforge:planner', rows }], toolResults: { [resultsDir]: 'z'.repeat(500) } });
    const spawn = roleSpawns(dir).spawns.find((s) => s.role === 'planner');
    const s = summarizeSpawn(spawn, { calls: true });
    assert.equal(s.call_list[0].tools[0].persisted_chars, 500);
  });
});

describe('6. categorize', () => {
  const cases = [
    // [label, tool, opts, expected category]
    ['Read of <any>/.claude/aoforge/references/tdd.md', { name: 'Read', input: { file_path: '/Users/x/.claude/aoforge/references/tdd.md' } }, {}, 'runtime_read:references/tdd.md'],
    ['Read of ~/.claude/aoforge/templates/summary.md', { name: 'Read', input: { file_path: '~/.claude/aoforge/templates/summary.md' } }, {}, 'runtime_read:templates/summary.md'],
    ['Bash cat of a templates file', { name: 'Bash', input: { command: 'cat ~/.claude/aoforge/templates/trd-prompt.md' } }, {}, 'runtime_read:templates/trd-prompt.md'],
    ['Bash head of a templates file', { name: 'Bash', input: { command: 'head -50 ~/.claude/aoforge/templates/trd-prompt.md' } }, {}, 'runtime_read:templates/trd-prompt.md'],
    ['Bash tail of a templates file', { name: 'Bash', input: { command: 'tail -n 40 /home/run/.claude/aoforge/templates/trd-prompt.md' } }, {}, 'runtime_read:templates/trd-prompt.md'],
    ['Bash sed -n of a templates file', { name: 'Bash', input: { command: "sed -n '1,80p' ~/.claude/aoforge/templates/trd-prompt.md" } }, {}, 'runtime_read:templates/trd-prompt.md'],
    ['Bash cat of a references file', { name: 'Bash', input: { command: 'cat ~/.claude/aoforge/references/testing-strategy.md' } }, {}, 'runtime_read:references/testing-strategy.md'],
    ['Bash grep of a references file', { name: 'Bash', input: { command: 'grep -n "tdd" ~/.claude/aoforge/references/testing-strategy.md' } }, {}, 'runtime_grep:references/testing-strategy.md'],
    ['ls ~/.claude/aoforge/templates/', { name: 'Bash', input: { command: 'ls ~/.claude/aoforge/templates/' } }, {}, 'runtime_lookup'],
    ['ls of a references dir then echo $HOME', { name: 'Bash', input: { command: 'ls ~/.claude/aoforge/references/; echo $HOME' } }, {}, 'runtime_lookup'],
    ['Write under aoforge-drafts', { name: 'Write', input: { file_path: '/tmp/aoforge-drafts/o/01-01-TRD.md', content: 'x' } }, {}, 'draft_write'],
    ['Edit under aoforge-drafts', { name: 'Edit', input: { file_path: '/tmp/aoforge-drafts/o/01-01-TRD.md', old_string: 'a', new_string: 'b' } }, {}, 'draft_edit'],
    ['aof-tools init', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs init plan-objective 1' } }, {}, 'context_load'],
    ['aof-tools state digest', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs state digest --raw 2>&1 | head -40' } }, {}, 'context_load'],
    ['aof-tools intent resolve', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs intent resolve --objective 1' } }, {}, 'context_load'],
    ['aof-tools stack context', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs stack context planner --raw' } }, {}, 'context_load'],
    ['aof-tools stack resolve', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs stack resolve' } }, {}, 'context_load'],
    ['aof-tools history-digest', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs history-digest' } }, {}, 'context_load'],
    ['aof-tools frontmatter validate', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs frontmatter validate /x/01-01-TRD.md' } }, {}, 'validate_publish'],
    ['aof-tools verify trd-pre', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs verify trd-pre /x/01-01-TRD.md' } }, {}, 'validate_publish'],
    ['aof-tools trd-tdd', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs trd-tdd inspect /x/01-01-TRD.md --raw' } }, {}, 'validate_publish'],
    ['aof-tools plan put-trd', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs plan put-trd 1 --from /x/01-01-TRD.md' } }, {}, 'validate_publish'],
    ['aof-tools plan push', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs plan push 1' } }, {}, 'validate_publish'],
    ['aof-tools summary checkpoint', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs summary checkpoint 01-01 --from /x/S.md' } }, {}, 'validate_publish'],
    ['aof-tools summary post', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs summary post 01-01 --from /x/S.md' } }, {}, 'validate_publish'],
    ['aof-tools tokens stamp', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs tokens stamp 01-01 --draft /x/S.md' } }, {}, 'validate_publish'],
    ['aof-tools commit', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs commit "feat: x" --files a.js' } }, {}, 'commit'],
    ['aof-tools --cwd commit', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs --cwd /w commit "feat: x" --files a.js' } }, {}, 'commit'],
    ['cd then aof-tools commit', { name: 'Bash', input: { command: 'cd /w && node ~/.claude/aoforge/bin/aof-tools.cjs commit "feat: x" --files a.js' } }, {}, 'commit'],
    ['git commit', { name: 'Bash', input: { command: 'git commit -m "x"' } }, {}, 'raw_commit'],
    ['git commit --amend', { name: 'Bash', input: { command: 'git commit --amend --no-edit' } }, {}, 'raw_commit'],
    ['git -C commit', { name: 'Bash', input: { command: 'git -C /w commit -m "x"' } }, {}, 'raw_commit'],
    ['git log -1 --format=%B', { name: 'Bash', input: { command: 'git log -1 --format=%B' } }, {}, 'commit_inspect'],
    ['aof-tools commit --help', { name: 'Bash', input: { command: 'node ~/.claude/aoforge/bin/aof-tools.cjs commit --help' } }, {}, 'tool_investigation'],
    ['grep under .claude/aoforge/bin', { name: 'Bash', input: { command: 'grep -rn "amend" ~/.claude/aoforge/bin/lib' } }, {}, 'tool_investigation'],
    ['Read of a *-TRD.md', { name: 'Read', input: { file_path: '/work/.aoforge/objectives/01-tags/01-01-TRD.md' } }, {}, 'trd_read'],
    ['Read of a guessed home path', { name: 'Read', input: { file_path: '/Users/aocyber/.claude/aoforge/references/tdd.md' } }, { homes: ['/sandbox/home'] }, 'guessed_runtime_path'],
    ['Read under the run own home', { name: 'Read', input: { file_path: '/sandbox/home/.claude/aoforge/references/tdd.md' } }, { homes: ['/sandbox/home'] }, 'runtime_read:references/tdd.md'],
    ['Read of ~ with homes known', { name: 'Read', input: { file_path: '~/.claude/aoforge/references/tdd.md' } }, { homes: ['/sandbox/home'] }, 'runtime_read:references/tdd.md'],
    ['node --test', { name: 'Bash', input: { command: 'node --test scripts/x.test.cjs' } }, {}, 'test_run'],
    ['npm test', { name: 'Bash', input: { command: 'npm test' } }, {}, 'test_run'],
    ['anything else (ls src)', { name: 'Bash', input: { command: 'ls src' } }, {}, 'other'],
    ['Read of a project file', { name: 'Read', input: { file_path: '/work/src/store.js' } }, {}, 'other'],
    ['Write of a project file', { name: 'Write', input: { file_path: '/work/src/store.js', content: 'x' } }, {}, 'other'],
    ['Grep', { name: 'Grep', input: { pattern: 'x' } }, {}, 'other'],
    ['a quoted mention is not a command', { name: 'Bash', input: { command: 'echo "git commit --amend"' } }, {}, 'other'],
    ['a heredoc body is not a command', { name: 'Bash', input: { command: "cat > /work/notes.md <<'EOF'\ngit commit --amend\nnode ~/.claude/aoforge/bin/aof-tools.cjs init x\nEOF" } }, {}, 'other'],
  ];
  for (const [label, tool, opts, expected] of cases) {
    test(`6. ${label} -> ${expected}`, () => {
      const { categorize } = load();
      const got = categorize(tool, opts);
      assert.equal(got.category, expected);
      assert.equal(typeof got.detail, 'string');
      assert.ok(got.detail.length <= 120);
    });
  }

  test('6. the detail is the runtime-relative path or the command head, never the full input', () => {
    const { categorize } = load();
    assert.equal(categorize({ name: 'Read', input: { file_path: '/Users/x/.claude/aoforge/references/tdd.md' } }).detail, 'references/tdd.md');
    const long = `git commit -m "${'y'.repeat(400)}"`;
    assert.equal(categorize({ name: 'Bash', input: { command: long } }).detail.length, 120);
  });
});

describe('7. attribute', () => {
  test('7. per category: count, issuing tokens, carry (3.0.0 planner)', () => {
    const s = plannerSummary(plannerRun('old'));
    assert.deepEqual(s.categories, E.old.categories);
  });

  test('7. a call issuing two tools gives each half (3.1.0 planner), and issuing tokens sum to the total', () => {
    const s = plannerSummary(plannerRun('new'));
    assert.deepEqual(s.categories, E.new.categories);
    const sum = Object.values(s.categories).reduce((n, c) => n + c.issuing, 0);
    assert.equal(sum, E.new.total_tokens);
  });

  test('7. attribute(calls) is callable on its own and also counts by tool name', () => {
    const { apiCalls, attribute } = load();
    const pair = fx.planner3031Pair();
    const { calls } = apiCalls(pair.new.rows.map((r) => JSON.stringify(r)));
    const a = attribute(calls);
    assert.deepEqual(a.categories, E.new.categories);
    assert.equal(a.by_tool.Bash.count, 5);
    assert.equal(a.by_tool.Write.count, 1);
    assert.equal(a.by_tool['(none)'].count, 1);
  });
});

describe('8. compare', () => {
  test('8. the decomposition identity holds on the hand-built pair', () => {
    const { compare } = load();
    const a = plannerSummary(plannerRun('old'));
    const b = plannerSummary(plannerRun('new'));
    const c = compare(a, b);
    const d = c.decomposition;
    assert.equal(d.dtotal, E.decomposition.dtotal);
    assert.equal(d.calls_term, E.decomposition.calls_term);
    assert.equal(d.context_term, E.decomposition.context_term);
    assert.equal(d.output_term, E.decomposition.output_term);
    assert.ok(Math.abs(d.dtotal - (d.calls_term + d.context_term + d.output_term)) <= 1);
    assert.equal(d.dcalls, 2);
    assert.equal(d.mean_context_a, 21602);
    assert.equal(d.mean_context_b, 24168.5);
  });

  test('8. per-category deltas of count, issuing tokens and carry, and their shares of the delta', () => {
    const { compare } = load();
    const c = compare(plannerSummary(plannerRun('old')), plannerSummary(plannerRun('new')));
    const by = Object.fromEntries(c.categories.map((r) => [r.category, r]));
    assert.deepEqual(
      { dcount: by.runtime_lookup.dcount, dissuing: by.runtime_lookup.dissuing, dcarry: by.runtime_lookup.dcarry },
      { dcount: 1, dissuing: 22402, dcarry: 200 },
    );
    assert.equal(by.context_load.dissuing, 100);
    assert.equal(by.context_load.dcarry, 2000);
    assert.equal(by.draft_write.dissuing, 13551 - 22102);
    assert.equal(by['runtime_read:templates/trd-prompt.md'].count_a, 0);
    assert.equal(by['runtime_read:templates/trd-prompt.md'].count_b, 1);
    assert.equal(by['runtime_read:templates/trd-prompt.md'].dissuing, 23702);
    const shares = c.categories.reduce((n, r) => n + r.share, 0);
    assert.ok(Math.abs(shares - 1) < 1e-9, `shares sum to ${shares}`);
    assert.equal(c.categories.reduce((n, r) => n + r.dissuing, 0), E.decomposition.dtotal);
    assert.ok(Math.abs(c.categories[0].dissuing) >= Math.abs(c.categories[c.categories.length - 1].dissuing), 'sorted by size of the delta');
  });

  test('8. mergeSummaries sums the spawns of a role and recomputes the mean context', () => {
    const { mergeSummaries } = load();
    const a = plannerSummary(plannerRun('old'));
    const b = plannerSummary(plannerRun('new'));
    const m = mergeSummaries([a, b]);
    assert.equal(m.spawns, 2);
    assert.equal(m.calls, 10);
    assert.equal(m.total_tokens, E.old.total_tokens + E.new.total_tokens);
    assert.equal(m.mean_context, (E.old.context_tokens + E.new.context_tokens) / 10);
    assert.equal(m.categories.context_load.count, 2);
  });
});

describe('9. determinism', () => {
  test('9. the same input gives byte-identical JSON, in the library and in the CLI', () => {
    const dir = plannerRun('new');
    assert.equal(JSON.stringify(plannerSummary(dir)), JSON.stringify(plannerSummary(dir)));
    const argv = ['--run', dir, '--role', 'planner', '--json', '--calls'];
    assert.equal(runMain(argv).stdout, runMain(argv).stdout);
    const a = plannerRun('old');
    const cmp = ['--compare', a, dir, '--role', 'planner', '--json'];
    assert.equal(runMain(cmp).stdout, runMain(cmp).stdout);
  });
});
