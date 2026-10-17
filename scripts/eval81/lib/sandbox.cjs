'use strict';
/**
 * Per-run sandboxes, the runtime pre-mirror, the two plugin trees and the transcript copy (TRD 81-08).
 *
 * Layout under the eval root R (README "Root layout"):
 *   R/runs/<batch>/<id>/home/            the run's HOME; home/.claude is its CLAUDE_CONFIG_DIR (the production layout:
 *                                        the runtime mirror lands in home/.claude/aoforge/)
 *   R/runs/<batch>/<id>/tmp/             its TMPDIR
 *   R/runs/<batch>/<id>/work/            the session cwd (a fresh materialised fixture copy)
 *   R/trees/v<version>/                  detached git worktrees of this repo, one per plugin version
 *   R/trees.json                         {"<version>": {ref, sha, path}} with absolute paths
 * Post-hoc 3 (TRD 81-17): with a sandbox root S, home/tmp/work live in S/runs/<batch>/<id>/ and the plugin trees are
 * plain copies in S/trees/ (exportTrees, recorded in S/trees.json); only the record dir stays under R.
 * A run dir is never reused and never deleted: an existing one (a dry run, a rate-limited attempt, an attempt that
 * died) is renamed to `<id>.prev-<n>` before a new sandbox is made. Scorers read `R/runs/<batch>/<id>/record.json`
 * only, never `*.prev-*`.
 *
 * mirrorRuntime runs the plugin's own SessionStart hook (`<plugin>/hooks/sync-runtime.js`) once before the session
 * with HOME = the sandbox home and CLAUDE_PLUGIN_ROOT = the plugin dir, so the runtime the agent reads is the tree's
 * and the session's own SessionStart copy takes its fast path. The child env is PATH, HOME and CLAUDE_PLUGIN_ROOT only
 * (the hook reads nothing else); AOFORGE_SKIP_GLOBAL_UPGRADE is NOT set, so the sandbox CLAUDE.md gets the managed
 * block production users get.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const { ID_RE, BATCHES } = require('./contract.cjs');

function assertAbsolute(p, what) {
  if (typeof p !== 'string' || !path.isAbsolute(p)) throw new TypeError(`${what} must be an absolute path (got ${JSON.stringify(p)})`);
}

/** Rename an existing dir to `<dir>.prev-<n>` (smallest free n). Returns the new path, or null when absent. */
function moveAside(dir) {
  if (!fs.existsSync(dir)) return null;
  let n = 1;
  while (fs.existsSync(`${dir}.prev-${n}`)) n += 1;
  fs.renameSync(dir, `${dir}.prev-${n}`);
  return `${dir}.prev-${n}`;
}

/**
 * A fresh sandbox for one run. Any existing run dir for the id is moved aside first (`previous` names it).
 * With `sandboxRoot` (post-hoc 3, TRD 81-17): what the run sees (home, its .claude config dir, tmp, work; the runner
 * adds settings.json) lives in `<sandboxRoot>/runs/<batch>/<id>/` (`sandboxDir`, moved aside the same way,
 * `previousSandbox`), while the record dir `runDir` (record, stream, stderr, argv, transcripts, outputs) stays under
 * the eval root. Without it, sandboxDir is runDir (the original layout).
 * @returns {{runDir, sandboxDir, home, configDir, tmp, work, previous: string|null, previousSandbox: string|null}}
 */
function makeSandbox({ root, batch, id, sandboxRoot = null }) {
  assertAbsolute(root, 'makeSandbox: root');
  if (sandboxRoot !== null) assertAbsolute(sandboxRoot, 'makeSandbox: sandboxRoot');
  if (!BATCHES.includes(batch)) throw new TypeError(`makeSandbox: unknown batch ${batch}`);
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new TypeError(`makeSandbox: id must match [A-Za-z0-9._-]+ (got ${JSON.stringify(id)})`);
  const runDir = path.join(root, 'runs', batch, id);
  fs.mkdirSync(path.dirname(runDir), { recursive: true });
  const previous = moveAside(runDir);
  let sandboxDir = runDir;
  let previousSandbox = null;
  if (sandboxRoot !== null) {
    sandboxDir = path.join(sandboxRoot, 'runs', batch, id);
    fs.mkdirSync(path.dirname(sandboxDir), { recursive: true });
    previousSandbox = moveAside(sandboxDir);
  }
  const home = path.join(sandboxDir, 'home');
  const configDir = path.join(home, '.claude');
  const tmp = path.join(sandboxDir, 'tmp');
  const work = path.join(sandboxDir, 'work');
  for (const d of [runDir, sandboxDir, home, configDir, tmp, work]) fs.mkdirSync(d, { recursive: true });
  return { runDir, sandboxDir, home, configDir, tmp, work, previous, previousSandbox };
}

function pluginVersion(pluginDir) {
  return JSON.parse(fs.readFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf-8')).version;
}

/**
 * Pre-mirror the plugin's runtime into a sandbox HOME by running its sync-runtime hook. Throws (naming the plugin dir
 * and the hook's stderr tail) when the hook is missing, fails, or leaves no `.plugin-version` equal to plugin.json's.
 * @returns {{version: string, stderr: string}}
 */
function mirrorRuntime({ pluginDir, home }) {
  assertAbsolute(pluginDir, 'mirrorRuntime: pluginDir');
  assertAbsolute(home, 'mirrorRuntime: home');
  const hook = path.join(pluginDir, 'hooks', 'sync-runtime.js');
  if (!fs.existsSync(hook)) throw new Error(`mirrorRuntime: no hooks/sync-runtime.js in plugin dir ${pluginDir}`);
  const env = { HOME: home, CLAUDE_PLUGIN_ROOT: pluginDir };
  if (typeof process.env.PATH === 'string') env.PATH = process.env.PATH;
  const res = spawnSync(process.execPath, [hook], { cwd: home, env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 120000 });
  const stderr = String(res.stderr || '');
  const tail = stderr.trim().split('\n').slice(-3).join(' | ');
  if (res.error) throw new Error(`mirrorRuntime: ${hook} did not run (${res.error.code || res.error.message})`);
  if (res.status !== 0) throw new Error(`mirrorRuntime: ${hook} exited ${res.status}: ${tail}`);
  const marker = path.join(home, '.claude', 'aoforge', '.plugin-version');
  let written;
  try {
    written = fs.readFileSync(marker, 'utf-8').trim();
  } catch {
    throw new Error(`mirrorRuntime: ${pluginDir} left no ${marker} (${tail || 'no stderr'})`);
  }
  let expected;
  try {
    expected = pluginVersion(pluginDir);
  } catch (err) {
    throw new Error(`mirrorRuntime: cannot read ${pluginDir}/.claude-plugin/plugin.json: ${err.message}`);
  }
  if (written !== expected) throw new Error(`mirrorRuntime: ${marker} says ${written}, plugin ${pluginDir} is ${expected}`);
  return { version: written, stderr };
}

const git = (args) => execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * Make sure `<root>/trees/v<version>` is a detached worktree of `repo` at each ref, whose
 * plugins/aoforge/.claude-plugin/plugin.json version equals its key, and record `<root>/trees.json`. An existing tree
 * must already sit at the ref's commit (else it throws rather than move it). trees.json is rewritten only when its
 * content changes, so a second call is a no-op.
 * @param {{repo: string, root: string, refs: Object<string, string>}} opts  refs: {"3.0.0": "v3.0.0", "3.1.0": "<sha>"}
 * @returns {{trees: object, added: string[]}}
 */
function ensureTrees({ repo, root, refs }) {
  assertAbsolute(repo, 'ensureTrees: repo');
  assertAbsolute(root, 'ensureTrees: root');
  if (refs === null || typeof refs !== 'object' || Object.keys(refs).length === 0) throw new TypeError('ensureTrees: refs must map version -> ref');
  const file = path.join(root, 'trees.json');
  let current = {};
  if (fs.existsSync(file)) current = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const trees = { ...current };
  const added = [];
  for (const [version, ref] of Object.entries(refs)) {
    const dest = path.join(root, 'trees', `v${version}`);
    const sha = git(['-C', repo, 'rev-parse', '--verify', `${ref}^{commit}`]);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      git(['-C', repo, 'worktree', 'add', '--detach', dest, sha]);
      added.push(version);
    }
    const head = git(['-C', dest, 'rev-parse', 'HEAD']);
    if (head !== sha) throw new Error(`ensureTrees: ${dest} is at ${head}, not ${ref} (${sha}); inspect it before reusing`);
    let found;
    try {
      found = pluginVersion(path.join(dest, 'plugins', 'aoforge'));
    } catch (err) {
      throw new Error(`ensureTrees: ${dest} has no readable plugins/aoforge/.claude-plugin/plugin.json (${err.message})`);
    }
    if (found !== version) throw new Error(`ensureTrees: ${dest} (${ref}) carries plugin version ${found}, not ${version}`);
    trees[version] = { ref, sha, path: dest };
  }
  const text = `${JSON.stringify(trees, null, 2)}\n`;
  let old = null;
  try {
    old = fs.readFileSync(file, 'utf-8');
  } catch {}
  if (old !== text) {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(file, text);
  }
  return { trees, added };
}

/**
 * Post-hoc 3 (TRD 81-17): plain copies of each ref's `plugins/` under `<root>/trees/v<version>/` (git archive | tar,
 * so there is no .git file naming the checkout), each checked for its plugin.json version, recorded in
 * `<root>/trees.json` as {ref, sha, path}. `root` is the opaque sandbox root. An existing tree is reused only when
 * trees.json already records it at the same sha; otherwise it throws rather than touch it.
 * @param {{repo: string, root: string, refs: Object<string, string>}} opts
 * @returns {{trees: object, added: string[]}}
 */
function exportTrees({ repo, root, refs }) {
  assertAbsolute(repo, 'exportTrees: repo');
  assertAbsolute(root, 'exportTrees: root');
  if (refs === null || typeof refs !== 'object' || Object.keys(refs).length === 0) throw new TypeError('exportTrees: refs must map version -> ref');
  const file = path.join(root, 'trees.json');
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
  const trees = { ...current };
  const added = [];
  for (const [version, ref] of Object.entries(refs)) {
    const sha = git(['-C', repo, 'rev-parse', '--verify', `${ref}^{commit}`]);
    const dest = path.join(root, 'trees', `v${version}`);
    if (fs.existsSync(dest)) {
      if (!current[version] || current[version].sha !== sha || current[version].path !== dest) {
        throw new Error(`exportTrees: ${dest} exists but trees.json does not record it at ${ref} (${sha}); inspect it before reusing`);
      }
    } else {
      const tar = execFileSync('git', ['-C', repo, 'archive', '--format=tar', sha, 'plugins'], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 1024 });
      fs.mkdirSync(dest, { recursive: true });
      execFileSync('tar', ['-x', '-f', '-', '-C', dest], { input: tar, stdio: ['pipe', 'pipe', 'pipe'] });
      added.push(version);
    }
    let found;
    try {
      found = pluginVersion(path.join(dest, 'plugins', 'aoforge'));
    } catch (err) {
      throw new Error(`exportTrees: ${dest} has no readable plugins/aoforge/.claude-plugin/plugin.json (${err.message})`);
    }
    if (found !== version) {
      if (added.includes(version)) fs.rmSync(dest, { recursive: true, force: true });
      throw new Error(`exportTrees: ${ref} carries plugin version ${found}, not ${version}`);
    }
    trees[version] = { ref, sha, path: dest };
  }
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(trees, null, 2)}\n`);
  return { trees, added };
}

function listFiles(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(abs, ent.name), childRel);
      else out.push(childRel);
    }
  };
  walk(dir, '');
  return out.sort();
}

/**
 * Copy the sandbox's session transcripts (`<configDir>/projects/**`) into `dest` after the child exited. dest is
 * always created; a missing projects dir copies nothing. Symlinks are copied as links, never followed.
 * @returns {{files: string[]}}  posix-relative paths under dest
 */
function copyTranscripts(configDir, dest) {
  assertAbsolute(dest, 'copyTranscripts: dest');
  fs.mkdirSync(dest, { recursive: true });
  const src = path.join(configDir, 'projects');
  if (!fs.existsSync(src)) return { files: [] };
  fs.cpSync(src, dest, { recursive: true, dereference: false, verbatimSymlinks: true });
  return { files: listFiles(dest) };
}

module.exports = { makeSandbox, mirrorRuntime, ensureTrees, exportTrees, copyTranscripts, moveAside, pluginVersion };
