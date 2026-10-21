'use strict';
// Tests for the opaque sandbox root (post-hoc 3, TRD 81-17, user 2026-10-17): makeSandbox({sandboxRoot}) puts what a
// run sees (home, its .claude config dir, tmp, work) under the sandbox root and keeps the run's record dir under the
// eval root; exportTrees writes plain (non-git) copies of each tree's plugins/ under the sandbox root, so a
// --plugin-dir never points into a worktree whose .git file names the checkout.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { makeSandbox, exportTrees } = require('./sandbox.cjs');

const tmp = (p = 'eval81-sbx-') => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), p)));
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
  '-c', 'commit.gpgsign=false', '-C', cwd, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function pluginRepo(base, version) {
  const repo = path.join(base, 'repo');
  fs.mkdirSync(path.join(repo, 'plugins', 'aoforge', '.claude-plugin'), { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'plugins', 'aoforge', '.claude-plugin', 'plugin.json'), `{"name":"aoforge","version":"${version}"}\n`);
  fs.mkdirSync(path.join(repo, 'plugins', 'aoforge', 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'plugins', 'aoforge', 'hooks', 'sync-runtime.js'), '// stub\n');
  fs.writeFileSync(path.join(repo, 'README.md'), 'outside plugins\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  return { repo, sha: git(repo, 'rev-parse', 'HEAD') };
}

describe('makeSandbox with a sandbox root', () => {
  test('1. the record dir stays under the eval root; home, config, tmp and work go under the sandbox root as siblings', () => {
    const root = tmp();
    const sroot = tmp('e81s-');
    const sb = makeSandbox({ root, batch: 'E', id: 'q30-r2', sandboxRoot: sroot });
    assert.equal(sb.runDir, path.join(root, 'runs', 'E', 'q30-r2'));
    assert.equal(sb.sandboxDir, path.join(sroot, 'runs', 'E', 'q30-r2'));
    assert.equal(sb.home, path.join(sb.sandboxDir, 'home'));
    assert.equal(sb.configDir, path.join(sb.sandboxDir, 'home', '.claude'));
    assert.equal(sb.tmp, path.join(sb.sandboxDir, 'tmp'));
    assert.equal(sb.work, path.join(sb.sandboxDir, 'work'));
    for (const d of [sb.runDir, sb.home, sb.configDir, sb.tmp, sb.work]) assert.ok(fs.statSync(d).isDirectory(), d);
    assert.ok(!fs.existsSync(path.join(sb.runDir, 'home')));
  });

  test('2. without a sandbox root the layout is unchanged (sandboxDir is the run dir)', () => {
    const root = tmp();
    const sb = makeSandbox({ root, batch: 'A', id: 'A-A1-haiku-r1' });
    assert.equal(sb.sandboxDir, sb.runDir);
    assert.equal(sb.work, path.join(root, 'runs', 'A', 'A-A1-haiku-r1', 'work'));
  });

  test('3. a second attempt moves both the record dir and the sandbox dir aside', () => {
    const root = tmp();
    const sroot = tmp('e81s-');
    const first = makeSandbox({ root, batch: 'C', id: 'C-map-tech-a-h-1', sandboxRoot: sroot });
    fs.writeFileSync(path.join(first.work, 'x'), '1');
    fs.writeFileSync(path.join(first.runDir, 'record.json'), '{}');
    const second = makeSandbox({ root, batch: 'C', id: 'C-map-tech-a-h-1', sandboxRoot: sroot });
    assert.equal(second.previous, `${first.runDir}.prev-1`);
    assert.equal(second.previousSandbox, `${first.sandboxDir}.prev-1`);
    assert.ok(fs.existsSync(path.join(`${first.sandboxDir}.prev-1`, 'work', 'x')));
    assert.deepEqual(fs.readdirSync(second.work), []);
  });

  test('4. a relative sandbox root is refused', () => {
    assert.throws(() => makeSandbox({ root: tmp(), batch: 'E', id: 'q30-r2', sandboxRoot: 'rel/dir' }), /absolute/);
  });
});

describe('exportTrees', () => {
  test('5. writes plain copies of plugins/ at each sha, with no .git, and records <sandbox root>/trees.json', () => {
    const base = tmp();
    const { repo, sha } = pluginRepo(base, '3.1.0');
    const sroot = tmp('e81s-');
    const { trees } = exportTrees({ repo, root: sroot, refs: { '3.1.0': sha } });
    const dest = path.join(sroot, 'trees', 'v3.1.0');
    assert.deepEqual(trees, { '3.1.0': { ref: sha, sha, path: dest } });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(sroot, 'trees.json'), 'utf8')), trees);
    assert.ok(fs.existsSync(path.join(dest, 'plugins', 'aoforge', '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(dest, 'plugins', 'aoforge', 'hooks', 'sync-runtime.js')));
    assert.ok(!fs.existsSync(path.join(dest, '.git')));
    assert.ok(!fs.existsSync(path.join(dest, 'README.md')));
  });

  test('6. a tree whose plugin.json version differs from its key is refused; an existing tree is never overwritten', () => {
    const base = tmp();
    const { repo, sha } = pluginRepo(base, '3.1.0');
    assert.throws(() => exportTrees({ repo, root: tmp('e81s-'), refs: { '3.0.0': sha } }), /version 3\.1\.0, not 3\.0\.0/);
    const sroot = tmp('e81s-');
    exportTrees({ repo, root: sroot, refs: { '3.1.0': sha } });
    fs.writeFileSync(path.join(sroot, 'trees', 'v3.1.0', 'keep'), 'x');
    exportTrees({ repo, root: sroot, refs: { '3.1.0': sha } });
    assert.ok(fs.existsSync(path.join(sroot, 'trees', 'v3.1.0', 'keep')));
  });
});
