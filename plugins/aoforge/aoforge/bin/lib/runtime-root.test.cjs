'use strict';
/**
 * runtime-root.test.cjs: TRD 82-02 Task 1.
 *
 * Every compound `aof-tools init <cmd>` prints `runtime_root`, the absolute AOForge runtime directory
 * (compat.runtimeHome(os.homedir())). An agent that must Read a runtime file takes the path from it instead of
 * typing a home directory itself. The tests run the real CLI (outermost) with HOME pointed at a fixture home.
 *
 * The 13 compound inits, in the order aof-tools.cjs dispatches them.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const AOF = path.join(__dirname, '..', 'aof-tools.cjs');

const INIT_COMMANDS = [
  ['execute-objective', '1'],
  ['plan-objective', '1'],
  ['new-project'],
  ['new-milestone'],
  ['quick', 'fix', 'the', 'thing'],
  ['resume'],
  ['verify-work', '1'],
  ['objective-op', '1'],
  ['todos'],
  ['milestone-op'],
  ['map-codebase'],
  ['security-audit'],
  ['progress'],
];

/** A temp project with the files every init needs, plus a temp HOME that has no runtime directory. */
function makeProject({ home } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-root-'));
  const cwd = path.join(root, 'project');
  const fixtureHome = home || path.join(root, 'home');
  fs.mkdirSync(fixtureHome, { recursive: true });
  const planning = path.join(cwd, '.aoforge');
  fs.mkdirSync(path.join(planning, 'objectives', '01-demo'), { recursive: true });
  fs.writeFileSync(path.join(planning, 'config.json'), '{}');
  fs.writeFileSync(path.join(planning, 'PROJECT.md'), '# Demo\n\nA demo project.\n');
  fs.writeFileSync(
    path.join(planning, 'ROADMAP.md'),
    '# Roadmap\n\n## Objective 1: Demo\n\n**Goal:** a demo\n**Depends on:** nothing\n',
  );
  fs.writeFileSync(
    path.join(planning, 'STATE.md'),
    '# State\n\n## Current Position\n\nObjective: 1 of 1\nStatus: Ready\n',
  );
  fs.writeFileSync(
    path.join(planning, 'objectives', '01-demo', 'OBJECTIVE.md'),
    '---\nwork: feature\n---\n# Demo objective\n',
  );
  return {
    cwd,
    home: fixtureHome,
    cleanup: () => { try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } },
  };
}

function runAof(args, { cwd, home }) {
  const env = { ...process.env, HOME: home, AOFORGE_AWARENESS_DIR: path.join(home, 'awareness') };
  delete env.USERPROFILE;
  return spawnSync(process.execPath, [AOF, ...args], { cwd, env, encoding: 'utf-8' });
}

function runInit(initArgs, ctx) {
  const r = runAof(['init', ...initArgs], ctx);
  assert.strictEqual(r.status, 0, `init ${initArgs.join(' ')} exited ${r.status}: ${r.stderr}`);
  let stdout = r.stdout.trim();
  // A payload over 50KB is written to a file and its path printed as `@file:<path>`.
  if (stdout.startsWith('@file:')) stdout = fs.readFileSync(stdout.slice('@file:'.length), 'utf-8');
  return JSON.parse(stdout);
}

test('1. each of the 13 init commands prints runtime_root = <HOME>/.claude/aoforge', () => {
  const p = makeProject();
  try {
    const expected = path.join(p.home, '.claude', 'aoforge');
    for (const initArgs of INIT_COMMANDS) {
      const json = runInit(initArgs, p);
      assert.strictEqual(
        json.runtime_root,
        expected,
        `init ${initArgs[0]} must print runtime_root ${expected}, got ${JSON.stringify(json.runtime_root)}`,
      );
    }
  } finally { p.cleanup(); }
});

test('2. runtime_root is absolute, has no ~, is the same from two cwds, and init never creates the runtime dir', () => {
  const p = makeProject();
  const other = makeProject({ home: p.home });
  try {
    assert.ok(!fs.existsSync(path.join(p.home, '.claude')), 'fixture home starts without a runtime directory');
    const a = runInit(['progress'], p);
    const b = runInit(['progress'], other);
    assert.strictEqual(typeof a.runtime_root, 'string', 'runtime_root is printed when the runtime dir does not exist');
    assert.ok(path.isAbsolute(a.runtime_root), `runtime_root is absolute: ${a.runtime_root}`);
    assert.ok(!a.runtime_root.includes('~'), `runtime_root has no ~: ${a.runtime_root}`);
    assert.strictEqual(a.runtime_root, b.runtime_root, 'the same from two different cwds');
    assert.ok(!fs.existsSync(a.runtime_root), 'init must not create the runtime directory');
  } finally { p.cleanup(); other.cleanup(); }
});

test('3. --raw output is unchanged: an init still prints its JSON, resolve-model --raw still prints one field', () => {
  const p = makeProject();
  try {
    // No compound init prints a single field under --raw (they pass no raw value); --raw leaves their JSON as it was.
    const plain = runAof(['init', 'progress'], p);
    const raw = runAof(['init', 'progress', '--raw'], p);
    assert.strictEqual(plain.status, 0, plain.stderr);
    assert.strictEqual(raw.status, 0, raw.stderr);
    assert.deepStrictEqual(JSON.parse(raw.stdout), JSON.parse(plain.stdout));
    // The one init-family command whose --raw prints a single value is resolve-model: it must stay a bare model name.
    const model = runAof(['resolve-model', 'executor', '--raw'], p);
    assert.strictEqual(model.status, 0, model.stderr);
    assert.match(model.stdout, /^[a-z0-9._-]+$/i, `resolve-model --raw prints the model only: ${JSON.stringify(model.stdout)}`);
    assert.ok(!model.stdout.includes('runtime_root'), 'resolve-model output does not grow a runtime_root');
  } finally { p.cleanup(); }
});
