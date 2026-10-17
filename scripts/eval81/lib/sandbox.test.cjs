'use strict';
// Tests for scripts/eval81/lib/sandbox.cjs (TRD 81-08, test list 12-13 plus makeSandbox / copyTranscripts). Every
// directory is an mkdtemp under TMPDIR; the git repo is a temp repo built here, never this checkout; no claude binary.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const load = () => require('./sandbox.cjs');
const tmp = (p = 'eval81-sandbox-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
const CHECKOUT = path.resolve(__dirname, '..', '..', '..');
const PLUGIN_DIR = path.join(CHECKOUT, 'plugins', 'aoforge');

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-C', cwd, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });

function writePluginVersion(repo, version) {
  const dir = path.join(repo, 'plugins', 'aoforge', '.claude-plugin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), `${JSON.stringify({ name: 'aoforge', version })}\n`);
}

describe('makeSandbox', () => {
  test('creates a fresh run dir with home, config dir, tmp and work; an existing dir moves to <id>.prev-<n>', () => {
    const { makeSandbox } = load();
    const root = tmp();
    const sb = makeSandbox({ root, batch: 'A', id: 'A-1' });
    assert.equal(sb.runDir, path.join(root, 'runs', 'A', 'A-1'));
    assert.equal(sb.home, path.join(sb.runDir, 'home'));
    assert.equal(sb.configDir, path.join(sb.home, '.claude'));
    assert.equal(sb.tmp, path.join(sb.runDir, 'tmp'));
    assert.equal(sb.work, path.join(sb.runDir, 'work'));
    for (const d of [sb.runDir, sb.home, sb.configDir, sb.tmp, sb.work]) assert.ok(fs.statSync(d).isDirectory(), d);

    fs.writeFileSync(path.join(sb.work, 'first.txt'), '1');
    const sb2 = makeSandbox({ root, batch: 'A', id: 'A-1' });
    assert.deepEqual(fs.readdirSync(sb2.work), []);
    assert.ok(fs.existsSync(path.join(root, 'runs', 'A', 'A-1.prev-1', 'work', 'first.txt')));
    assert.equal(sb2.previous, path.join(root, 'runs', 'A', 'A-1.prev-1'));

    makeSandbox({ root, batch: 'A', id: 'A-1' });
    assert.ok(fs.existsSync(path.join(root, 'runs', 'A', 'A-1.prev-2')));
    assert.deepEqual(fs.readdirSync(path.join(root, 'runs', 'A')).sort(), ['A-1', 'A-1.prev-1', 'A-1.prev-2']);
  });

  test('refuses an id outside [A-Za-z0-9._-] and a relative root', () => {
    const { makeSandbox } = load();
    assert.throws(() => makeSandbox({ root: tmp(), batch: 'A', id: '../x' }), /id/);
    assert.throws(() => makeSandbox({ root: 'rel/root', batch: 'A', id: 'A-1' }), /absolute/);
  });
});

describe('copyTranscripts', () => {
  test('copies <configDir>/projects into dest (main and subagent files); a missing projects dir gives an empty dest', () => {
    const { copyTranscripts } = load();
    const cfg = tmp();
    const sub = path.join(cfg, 'projects', '-k', 's1', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(cfg, 'projects', '-k', 's1.jsonl'), '{}\n');
    fs.writeFileSync(path.join(sub, 'agent-a.jsonl'), '{}\n');
    fs.writeFileSync(path.join(sub, 'agent-a.meta.json'), '{}\n');
    const dest = path.join(tmp(), 'transcripts');
    const res = copyTranscripts(cfg, dest);
    assert.deepEqual(res.files, ['-k/s1.jsonl', '-k/s1/subagents/agent-a.jsonl', '-k/s1/subagents/agent-a.meta.json']);
    assert.ok(fs.existsSync(path.join(dest, '-k', 's1', 'subagents', 'agent-a.jsonl')));

    const empty = path.join(tmp(), 'transcripts');
    assert.deepEqual(copyTranscripts(tmp(), empty).files, []);
    assert.ok(fs.statSync(empty).isDirectory());
  });
});

describe('mirrorRuntime', () => {
  test('12. mirrors this checkout\'s plugin runtime into a temp HOME; the test\'s own HOME is neither read nor written', () => {
    const { mirrorRuntime } = load();
    const sentinel = tmp('eval81-sentinel-home-');
    const savedHome = process.env.HOME;
    process.env.HOME = sentinel;
    try {
      const home = tmp('eval81-mirror-home-');
      const version = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), 'utf-8')).version;
      const res = mirrorRuntime({ pluginDir: PLUGIN_DIR, home });
      const marker = path.join(home, '.claude', 'aoforge', '.plugin-version');
      assert.equal(fs.readFileSync(marker, 'utf-8').trim(), version);
      assert.equal(res.version, version);
      assert.ok(fs.existsSync(path.join(home, '.claude', 'aoforge', 'bin', 'aof-tools.cjs')));
      assert.deepEqual(fs.readdirSync(sentinel), [], 'the sentinel HOME stays empty');
    } finally {
      process.env.HOME = savedHome;
    }
  });

  test('throws naming the plugin dir when the hook is missing or writes no .plugin-version', () => {
    const { mirrorRuntime } = load();
    const plugin = tmp();
    assert.throws(() => mirrorRuntime({ pluginDir: plugin, home: tmp() }), (err) => err.message.includes(plugin));
    fs.mkdirSync(path.join(plugin, 'hooks'));
    fs.mkdirSync(path.join(plugin, '.claude-plugin'));
    fs.writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{"version":"9.9.9"}\n');
    fs.writeFileSync(path.join(plugin, 'hooks', 'sync-runtime.js'), 'process.exit(0);\n');
    assert.throws(() => mirrorRuntime({ pluginDir: plugin, home: tmp() }), /plugin-version/);
  });
});

describe('ensureTrees', () => {
  test('13. adds one detached worktree per ref under <root>/trees, writes trees.json with both SHAs, and is a no-op the second time', () => {
    const { ensureTrees } = load();
    const repo = tmp('eval81-trees-repo-');
    git(repo, 'init', '-q', '-b', 'main');
    writePluginVersion(repo, '1.0.0');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'one');
    git(repo, 'tag', 't1');
    writePluginVersion(repo, '2.0.0');
    git(repo, 'commit', '-q', '-am', 'two');
    git(repo, 'tag', 't2');
    const sha1 = git(repo, 'rev-parse', 't1^{commit}').trim();
    const sha2 = git(repo, 'rev-parse', 't2^{commit}').trim();

    const root = tmp('eval81-trees-root-');
    const res = ensureTrees({ repo, root, refs: { '1.0.0': 't1', '2.0.0': 't2' } });
    const trees = JSON.parse(fs.readFileSync(path.join(root, 'trees.json'), 'utf-8'));
    assert.deepEqual(trees, {
      '1.0.0': { ref: 't1', sha: sha1, path: path.join(root, 'trees', 'v1.0.0') },
      '2.0.0': { ref: 't2', sha: sha2, path: path.join(root, 'trees', 'v2.0.0') },
    });
    assert.deepEqual(res.added.sort(), ['1.0.0', '2.0.0']);
    assert.equal(git(path.join(root, 'trees', 'v1.0.0'), 'rev-parse', 'HEAD').trim(), sha1);
    assert.equal(git(path.join(root, 'trees', 'v2.0.0'), 'rev-parse', 'HEAD').trim(), sha2);
    // Detached: no branch checked out in either tree.
    assert.equal(git(path.join(root, 'trees', 'v1.0.0'), 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'HEAD', 'detached');

    const listBefore = git(repo, 'worktree', 'list', '--porcelain');
    const mtimeBefore = fs.statSync(path.join(root, 'trees.json')).mtimeMs;
    const again = ensureTrees({ repo, root, refs: { '1.0.0': 't1', '2.0.0': 't2' } });
    assert.deepEqual(again.added, []);
    assert.equal(git(repo, 'worktree', 'list', '--porcelain'), listBefore);
    assert.equal(fs.statSync(path.join(root, 'trees.json')).mtimeMs, mtimeBefore);
  });

  test('refuses a tree whose plugin.json version does not equal its key', () => {
    const { ensureTrees } = load();
    const repo = tmp('eval81-trees-repo-');
    git(repo, 'init', '-q', '-b', 'main');
    writePluginVersion(repo, '1.0.0');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'one');
    git(repo, 'tag', 't1');
    const root = tmp('eval81-trees-root-');
    assert.throws(() => ensureTrees({ repo, root, refs: { '3.1.0': 't1' } }), /1\.0\.0.*3\.1\.0|3\.1\.0.*1\.0\.0/);
    assert.equal(fs.existsSync(path.join(root, 'trees.json')), false);
  });
});
