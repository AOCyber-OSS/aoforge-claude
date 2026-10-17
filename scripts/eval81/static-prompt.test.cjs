'use strict';
// TRD 81-07: static resident-prompt comparison. Hand-written workflow snippets plus a temp git repo with two
// tags; no generated data, no network, no model call.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const sp = require('./static-prompt.cjs');

const SCRIPT = path.join(__dirname, 'static-prompt.cjs');
const FENCE = '```';
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const doc = (...ls) => ls.join('\n') + '\n';

// ---------------------------------------------------------------------------------------------------------
// A temp repo with two tagged trees (test 1).
// ---------------------------------------------------------------------------------------------------------

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
};

function git(cwd, ...args) {
  return cp.execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], {
    cwd,
    env: GIT_ENV,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

const VERIFIER_V1 = doc('---', 'name: verifier', 'description: checks', '---', '', 'Verify the goal. '.repeat(20));
const VERIFIER_V2 = doc('---', 'name: verifier', 'description: checks', '---', '', 'Verify the goal. '.repeat(10));
const PLANNER_V1 = doc('---', 'name: planner', '---', '', 'Plan it. '.repeat(30));
const WEB_V2 = doc('---', 'name: web-ui-verifier', '---', '', 'Check the web ui.');
const WORKFLOW_V1 = doc(
  '# execute-objective',
  '',
  FENCE,
  'Task(',
  '  prompt="Verify objective {n}. Read @~/.claude/aoforge/references/goal.md",',
  '  subagent_type="verifier",',
  '  model="{m}"',
  ')',
  FENCE,
);
const WORKFLOW_V2 = doc(
  '# execute-objective',
  '',
  FENCE,
  'Task(',
  '  prompt="Verify.",',
  '  subagent_type="verifier",',
  '  model="{m}"',
  ')',
  FENCE,
);

function buildRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sp81-repo-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'plugins/aoforge/agents/verifier.md', VERIFIER_V1);
  write(root, 'plugins/aoforge/agents/planner.md', PLANNER_V1);
  write(root, 'plugins/aoforge/aoforge/workflows/execute-objective.md', WORKFLOW_V1);
  write(root, 'plugins/aoforge/aoforge/references/goal.md', 'goal-backward\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'one');
  git(root, 'tag', 't1');
  write(root, 'plugins/aoforge/agents/verifier.md', VERIFIER_V2);
  fs.rmSync(path.join(root, 'plugins/aoforge/agents/planner.md'));
  write(root, 'plugins/aoforge-stack-web/agents/web-ui-verifier.md', WEB_V2);
  write(root, 'plugins/aoforge/aoforge/workflows/execute-objective.md', WORKFLOW_V2);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'two');
  git(root, 'tag', 't2');
  return root;
}

// ---------------------------------------------------------------------------------------------------------
// 1. CLI
// ---------------------------------------------------------------------------------------------------------

test('1. CLI writes one JSON row per agent present in either tree and exits 0; unknown ref exits 1 naming it', () => {
  const repo = buildRepo();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sp81-out-'));
  const jsonFile = path.join(out, 'sp.json');
  const mdFile = path.join(out, 'sp.md');

  const ok = cp.spawnSync(
    process.execPath,
    [SCRIPT, '--from', 't1', '--to', 't2', '--repo', repo, '--json', jsonFile, '--md', mdFile],
    { encoding: 'utf8', env: GIT_ENV },
  );
  assert.equal(ok.status, 0, ok.stderr);

  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  assert.deepEqual(data.agents.map((a) => a.name).sort(), ['planner', 'verifier', 'web-ui-verifier']);
  assert.equal(data.from.ref, 't1');
  assert.equal(data.to.ref, 't2');
  assert.match(data.from.sha, /^[0-9a-f]{40}$/);

  const verifier = data.agents.find((a) => a.name === 'verifier');
  assert.equal(verifier.agent_bytes.from, bytes(VERIFIER_V1));
  assert.equal(verifier.agent_bytes.to, bytes(VERIFIER_V2));
  assert.equal(verifier.agent_bytes.delta_bytes, bytes(VERIFIER_V2) - bytes(VERIFIER_V1));
  const planner = data.agents.find((a) => a.name === 'planner');
  assert.equal(planner.agent_bytes.to, null, 'planner is absent in t2');
  const web = data.agents.find((a) => a.name === 'web-ui-verifier');
  assert.equal(web.pack.to, true);
  assert.equal(web.agent_bytes.from, null, 'web-ui-verifier is absent in t1');

  assert.ok(fs.existsSync(mdFile));
  assert.match(fs.readFileSync(mdFile, 'utf8'), /verifier/);

  // Nothing was checked out or added: the repo is clean and has one worktree.
  assert.equal(git(repo, 'status', '--porcelain').trim(), '');
  assert.equal(git(repo, 'worktree', 'list').trim().split('\n').length, 1);
  assert.deepEqual(fs.readdirSync(out).sort(), ['sp.json', 'sp.md']);

  const bad = cp.spawnSync(process.execPath, [SCRIPT, '--from', 't1', '--to', 'no-such-ref', '--repo', repo], {
    encoding: 'utf8',
    env: GIT_ENV,
  });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /no-such-ref/);
});

test('1b. measureRef reads the tree through git and reports spawn sites and named @ bytes', () => {
  const repo = buildRepo();
  const m = sp.measureRef(repo, 't1');
  assert.equal(m.ref, 't1');
  assert.match(m.sha, /^[0-9a-f]{40}$/);
  const v = m.agents.verifier;
  assert.equal(v.path, 'plugins/aoforge/agents/verifier.md');
  assert.equal(v.agent_bytes, bytes(VERIFIER_V1));
  assert.equal(v.body_bytes, bytes('\n' + 'Verify the goal. '.repeat(20) + '\n'), 'body starts after the closing --- line');
  assert.equal(v.pack, false);
  assert.equal(v.spawn_sites.length, 1);
  assert.equal(v.spawn_sites[0].file, 'plugins/aoforge/aoforge/workflows/execute-objective.md');
  assert.equal(v.spawn_sites[0].line, 4);
  assert.equal(v.max_spawn_bytes, v.spawn_sites[0].prompt_bytes);
  assert.deepEqual(v.named_at.paths, ['~/.claude/aoforge/references/goal.md']);
  assert.equal(v.named_at.bytes, bytes('goal-backward\n'));
  assert.deepEqual(v.named_at.missing, []);
  assert.equal(v.resident_bytes, v.body_bytes + v.max_spawn_bytes, 'named @ bytes are not resident');
  assert.equal(v.resident_tokens, Math.round(v.resident_bytes / sp.CHARS_PER_TOKEN));
  assert.equal(m.agents.planner.max_spawn_bytes, null, 'planner has no spawn template in this tree');
  assert.equal(m.agents.planner.spawn_sites.length, 0);
});

// ---------------------------------------------------------------------------------------------------------
// 2. Task( blocks
// ---------------------------------------------------------------------------------------------------------

test('2. extractSpawnPrompts finds a Task(prompt="...", subagent_type="verifier") block: bytes, file and line', () => {
  const prompt = 'Verify objective {n} — goal.\nCheck the code.';
  const text = doc('# wf', '', FENCE, 'Task(', `  prompt="${prompt}",`, '  subagent_type="verifier",', '  model="{m}"', ')', FENCE);
  const sites = sp.extractSpawnPrompts(text, 'wf.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].file, 'wf.md');
  assert.equal(sites[0].line, 4);
  assert.equal(sites[0].agent, 'verifier');
  assert.equal(sites[0].prompt_bytes, bytes(prompt), 'multi-byte characters count as bytes');
  assert.equal(sites[0].reason, null);
});

test('2b. a prompt that is the last argument and holds inner double quotes ends at the closing quote before )', () => {
  const prompt = '\n  <objective>Run "aof-tools" (see "x").</objective>\n  ';
  const text = doc(FENCE, 'Task(', '  subagent_type="executor",', '  model="{m}",', `  prompt="${prompt}"`, ')', FENCE, 'after the fence: "stray")');
  const sites = sp.extractSpawnPrompts(text, 'wf.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].agent, 'executor');
  assert.equal(sites[0].prompt_bytes, bytes(prompt));
});

test('2c. a prompt followed by `", subagent_type=...` on the same line keeps its inner "quoted" text', () => {
  const prompt = '<output>\nPublish: doc put x --from "$DRAFT" (do not commit)\n</output>\n';
  const text = doc(FENCE, `Task(prompt="${prompt}", subagent_type="project-researcher", model="{m}", description="Stack research")`, FENCE);
  const sites = sp.extractSpawnPrompts(text, 'np.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].agent, 'project-researcher');
  assert.equal(sites[0].prompt_bytes, bytes(prompt));
});

test('2d. a namespaced subagent_type is attributed to the bare agent name', () => {
  const text = doc(FENCE, 'Task(', '  subagent_type="aoforge-stack-flutter:ui-evaluator",', '  prompt="Manifest: {p}.",', '  description="UI visual eval"', ')', FENCE);
  const sites = sp.extractSpawnPrompts(text, 'ui.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].agent, 'ui-evaluator');
  assert.equal(sites[0].subagent_type, 'aoforge-stack-flutter:ui-evaluator');
  assert.equal(sites[0].prompt_bytes, bytes('Manifest: {p}.'));
});

// ---------------------------------------------------------------------------------------------------------
// 3. map-codebase style
// ---------------------------------------------------------------------------------------------------------

test('3. a parameter block plus a following fenced Prompt: block is one site per focus', () => {
  const p1 = 'Focus: tech\n\nAnalyze the stack.';
  const p2 = 'Focus: arch\n\nAnalyze the layers and the data flow.';
  const text = doc(
    '**Agent 1: Tech Focus**',
    '',
    'Task tool parameters:',
    FENCE,
    'subagent_type: "codebase-mapper"',
    'model: "{m}"',
    FENCE,
    '',
    'Prompt:',
    FENCE,
    p1,
    FENCE,
    '',
    '**Agent 2: Architecture Focus**',
    '',
    'Task tool parameters:',
    FENCE,
    'subagent_type: "codebase-mapper"',
    'model: "{m}"',
    FENCE,
    '',
    'Prompt:',
    FENCE,
    p2,
    FENCE,
  );
  const sites = sp.extractSpawnPrompts(text, 'map.md');
  assert.equal(sites.length, 2);
  assert.deepEqual(sites.map((s) => s.agent), ['codebase-mapper', 'codebase-mapper']);
  assert.deepEqual(sites.map((s) => s.prompt_bytes), [bytes(p1), bytes(p2)]);
  assert.deepEqual(sites.map((s) => s.line), [5, 20]);
  assert.ok(sites.every((s) => s.reason === null));
});

test('3b. prose that merely mentions subagent_type is not a site', () => {
  const text = doc('Use Task tool with `subagent_type="codebase-mapper"` and `run_in_background=true`.', '', 'No parameter block here.');
  assert.deepEqual(sp.extractSpawnPrompts(text, 'map.md'), []);
});

// ---------------------------------------------------------------------------------------------------------
// 4. prompt=<variable> resolved to a labelled fenced block
// ---------------------------------------------------------------------------------------------------------

test('4. prompt=checker_prompt resolves to the nearest preceding fenced block labelled "Checker prompt:"', () => {
  const checker = '<verification_context>\n**Objective:** {n}\n</verification_context>';
  const revision = '<revision_context>\nMake targeted updates.\n</revision_context>';
  const text = doc(
    'Checker prompt:',
    '',
    FENCE + 'markdown',
    checker,
    FENCE,
    '',
    'Revision prompt:',
    '',
    FENCE + 'markdown',
    revision,
    FENCE,
    '',
    FENCE,
    'Task(',
    '  prompt=checker_prompt,',
    '  subagent_type="job-checker",',
    '  model="{m}"',
    ')',
    FENCE,
  );
  const sites = sp.extractSpawnPrompts(text, 'po.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].agent, 'job-checker');
  assert.equal(sites[0].prompt_bytes, bytes(checker), 'the label wins over a nearer block with another label');
  assert.equal(sites[0].prompt_line, 3, 'prompt_line is the line of the fenced block the number comes from');
  assert.equal(sites[0].form, 'variable:label');
});

test('4b. a variable with no block of its own name falls back to the nearest preceding "... prompt:" block', () => {
  const planner = '<planning_context>\n**Objective:** {n}\n</planning_context>';
  const text = doc('Planner prompt:', '', FENCE + 'markdown', planner, FENCE, '', FENCE, 'Task(', '  prompt=filled_prompt,', '  subagent_type="planner"', ')', FENCE);
  const sites = sp.extractSpawnPrompts(text, 'po.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].prompt_bytes, bytes(planner));
  assert.equal(sites[0].form, 'variable:nearest-labelled');
});

// ---------------------------------------------------------------------------------------------------------
// 5. not found: null with a reason, never a guess
// ---------------------------------------------------------------------------------------------------------

test('5. a site whose prompt cannot be found is returned with prompt_bytes null and a reason', () => {
  const text = doc(FENCE, 'Task(', '  prompt=mystery_prompt,', '  subagent_type="debugger",', '  description="Debug"', ')', FENCE);
  const sites = sp.extractSpawnPrompts(text, 'diag.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].agent, 'debugger');
  assert.equal(sites[0].prompt_bytes, null);
  assert.match(sites[0].reason, /mystery_prompt/);
});

test('5b. an elided prompt ("...") is null with a reason, not three bytes', () => {
  const text = doc(FENCE, 'Task(', '  subagent_type="executor",', '  prompt="...",', '  run_in_background=true', ')', FENCE);
  const sites = sp.extractSpawnPrompts(text, 'eo.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].prompt_bytes, null);
  assert.match(sites[0].reason, /elided/);
});

test('5c. a map-codebase parameter block with no Prompt: block after it is null with a reason', () => {
  const text = doc('Task tool parameters:', FENCE, 'subagent_type: "security-auditor"', FENCE, '', 'Nothing else follows.');
  const sites = sp.extractSpawnPrompts(text, 'sec.md');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].prompt_bytes, null);
  assert.ok(sites[0].reason.length > 0);
});

// ---------------------------------------------------------------------------------------------------------
// 6. named @ paths
// ---------------------------------------------------------------------------------------------------------

test('6. namedAtPaths lists @~/.claude/aoforge paths, maps them into the ref and sums the ones that exist', () => {
  const text = doc(
    'See @~/.claude/aoforge/references/a.md and (also @~/.claude/aoforge/templates/b.md).',
    'Again @~/.claude/aoforge/references/a.md.',
    'Project file @.aoforge/STATE.md is not a plugin file.',
    'On demand, not an @ reference: ~/.claude/aoforge/references/c.md',
    'Pack file @~/.claude/aoforge/stacks/flutter/workflows/ui-eval.md',
  );
  const asked = [];
  const sizeOf = (repoPath) => {
    asked.push(repoPath);
    if (repoPath === 'plugins/aoforge/aoforge/references/a.md') return 100;
    if (repoPath === 'plugins/aoforge-stack-flutter/workflows/ui-eval.md') return 40;
    return null;
  };
  const r = sp.namedAtPaths(text, sizeOf);
  assert.deepEqual(r.paths, [
    '~/.claude/aoforge/references/a.md',
    '~/.claude/aoforge/templates/b.md',
    '~/.claude/aoforge/stacks/flutter/workflows/ui-eval.md',
  ]);
  assert.equal(r.bytes, 140);
  assert.deepEqual(r.missing, ['~/.claude/aoforge/templates/b.md']);
  assert.equal(r.resolved['~/.claude/aoforge/references/a.md'], 'plugins/aoforge/aoforge/references/a.md');
  assert.ok(asked.includes('plugins/aoforge/aoforge/templates/b.md'));
  assert.ok(!asked.some((p) => p.includes('c.md')), 'a path without @ is not named');
});

test('6b. namedAtPaths without a reader only lists the paths', () => {
  const r = sp.namedAtPaths('x @~/.claude/aoforge/references/a.md y');
  assert.deepEqual(r.paths, ['~/.claude/aoforge/references/a.md']);
  assert.equal(r.bytes, 0);
});

// ---------------------------------------------------------------------------------------------------------
// 7. compare
// ---------------------------------------------------------------------------------------------------------

function row(over) {
  const base = {
    path: 'plugins/aoforge/agents/x.md',
    pack: false,
    defined: true,
    agent_bytes: 100,
    body_bytes: 90,
    spawn_sites: [],
    max_spawn_bytes: 40,
    named_at: { paths: [], bytes: 0, missing: [] },
    resident_bytes: 130,
    resident_tokens: 33,
  };
  return { ...base, ...over };
}

test('7. compare gives from/to/delta per agent for agent, spawn and resident bytes, and marks pack agents', () => {
  const a = {
    ref: 'v1',
    sha: 'a'.repeat(40),
    agents: {
      verifier: row({ agent_bytes: 400, body_bytes: 380, max_spawn_bytes: 100, resident_bytes: 480, resident_tokens: 120 }),
      'ui-evaluator': row({ agent_bytes: 200, body_bytes: 190, max_spawn_bytes: null, resident_bytes: 190, resident_tokens: 48 }),
      planner: row({ agent_bytes: 50, body_bytes: 40, max_spawn_bytes: 10, resident_bytes: 50, resident_tokens: 13 }),
    },
  };
  const b = {
    ref: 'v2',
    sha: 'b'.repeat(40),
    agents: {
      verifier: row({ agent_bytes: 300, body_bytes: 280, max_spawn_bytes: 100, resident_bytes: 380, resident_tokens: 95 }),
      'ui-evaluator': row({ pack: true, agent_bytes: 200, body_bytes: 190, max_spawn_bytes: 30, resident_bytes: 220, resident_tokens: 55 }),
      'web-ui-verifier': row({ pack: true, agent_bytes: 60, body_bytes: 50, max_spawn_bytes: 20, resident_bytes: 70, resident_tokens: 18 }),
    },
  };
  const c = sp.compare(a, b);
  assert.equal(c.from.ref, 'v1');
  assert.equal(c.to.ref, 'v2');
  const by = Object.fromEntries(c.agents.map((r) => [r.name, r]));
  assert.deepEqual(Object.keys(by).sort(), ['planner', 'ui-evaluator', 'verifier', 'web-ui-verifier']);

  assert.deepEqual(by.verifier.agent_bytes, { from: 400, to: 300, delta_bytes: -100, delta_pct: -25 });
  assert.deepEqual(by.verifier.max_spawn_bytes, { from: 100, to: 100, delta_bytes: 0, delta_pct: 0 });
  assert.deepEqual(by.verifier.resident_bytes, { from: 480, to: 380, delta_bytes: -100, delta_pct: -20.83 });
  assert.equal(by.verifier.resident_tokens.delta_bytes, -25);
  assert.deepEqual(by.verifier.pack, { from: false, to: false });

  assert.deepEqual(by['ui-evaluator'].pack, { from: false, to: true }, 'a core agent that became a pack agent');
  assert.deepEqual(by['ui-evaluator'].max_spawn_bytes, { from: null, to: 30, delta_bytes: null, delta_pct: null });
  assert.deepEqual(by['web-ui-verifier'].pack, { from: null, to: true });
  assert.deepEqual(by['web-ui-verifier'].resident_bytes, { from: null, to: 70, delta_bytes: null, delta_pct: null });
  assert.deepEqual(by.planner.resident_bytes, { from: 50, to: null, delta_bytes: null, delta_pct: null });

  // Pack agents are counted apart from core agents, on each side by that side's own classification.
  assert.equal(c.totals.core.from.count, 3);
  assert.equal(c.totals.core.from.resident_bytes, 720);
  assert.equal(c.totals.core.to.count, 1);
  assert.equal(c.totals.core.to.resident_bytes, 380);
  assert.equal(c.totals.pack.from.count, 0);
  assert.equal(c.totals.pack.to.count, 2);
  assert.equal(c.totals.pack.to.resident_bytes, 290);

  // Sorted by resident delta: the largest reduction first, agents without a delta last (by name).
  assert.deepEqual(c.agents.map((r) => r.name), ['verifier', 'ui-evaluator', 'planner', 'web-ui-verifier']);
});
