'use strict';
/**
 * The tripwire and the per-run isolation proof (TRD 81-08, isolation layers 3 and 4).
 *
 * snapshot() records, read only: each watched repo's HEAD and `git status --porcelain=v1 -uall` (through
 * `git --no-optional-locks`, so even the index refresh is skipped), size / mtimeMs / sha256 of each named file
 * (missing = null), and the names under `<realHome>/.claude/projects/` that start with the project key of a root.
 * The runner snapshots this checkout, every watched fleet source, the real ~/.claude settings.json and CLAUDE.md,
 * the real ~/.claude/aoforge/.plugin-version and calibration.json, and the real projects entries under the eval
 * root's key, before and after a batch; any difference is exit 5.
 *
 * isolationCheck() is the per-run proof that HOME / CLAUDE_CONFIG_DIR isolation held: the session's project dir
 * exists under the sandbox config dir, no real projects entry exists for the run's work dir, and the real projects
 * entries under the eval root are listed. Keys follow the CLI's rule: every character outside [A-Za-z0-9] becomes
 * `-` (this checkout's key is `-Users-justin-dev-aoforge-claude`); the given and the realpath form are both checked
 * because the CLI may key a session by its resolved cwd.
 *
 * Nothing here writes anything.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

/** The CLI's project key for a path. */
function projectKey(p) {
  return String(p).replace(/[^A-Za-z0-9]/g, '-');
}

function forms(p) {
  const out = [path.resolve(p)];
  try {
    const real = fs.realpathSync(p);
    if (!out.includes(real)) out.push(real);
  } catch {}
  return out;
}

function keysFor(p) {
  return [...new Set(forms(p).map(projectKey))];
}

/** Sorted names under `<realHome>/.claude/projects/` starting with the key of any root (given and realpath forms). */
function realProjectsEntries({ realHome, roots = [] }) {
  const dir = path.join(realHome, '.claude', 'projects');
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const keys = roots.flatMap(keysFor);
  return names.filter((n) => keys.some((k) => n.startsWith(k))).sort();
}

/**
 * Did this run stay in its sandbox? All three fields are reported; the runner decides what is a breach.
 * @returns {{sandbox_project: boolean, real_project: boolean, real_entries_under_root: string[]}}
 */
function isolationCheck({ realHome, configDir, workDir, root }) {
  const keys = keysFor(workDir);
  const exists = (p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  };
  return {
    sandbox_project: keys.some((k) => exists(path.join(configDir, 'projects', k))),
    real_project: keys.some((k) => exists(path.join(realHome, '.claude', 'projects', k))),
    // `root` may be an array (post-hoc 3: the eval root and the opaque sandbox root).
    real_entries_under_root: realProjectsEntries({ realHome, roots: Array.isArray(root) ? root : [root] }),
  };
}

function gitRead(repo, args) {
  return execFileSync('git', ['--no-optional-locks', '-C', repo, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function repoState(repo) {
  try {
    return {
      path: repo,
      head: gitRead(repo, ['rev-parse', 'HEAD']).trim(),
      porcelain: gitRead(repo, ['status', '--porcelain=v1', '-uall']),
    };
  } catch (err) {
    const msg = String(err.stderr || err.message || '').trim().split('\n')[0];
    return { path: repo, head: null, porcelain: null, error: msg || 'git failed' };
  }
}

function fileState(file) {
  let st;
  try {
    st = fs.statSync(file);
  } catch {
    return null;
  }
  if (!st.isFile()) return { size: st.size, mtimeMs: st.mtimeMs, sha256: null, type: st.isDirectory() ? 'dir' : 'other' };
  return { size: st.size, mtimeMs: st.mtimeMs, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
}

/**
 * @param {{repos?: Array<{label, path}>, files?: string[], projects?: {realHome, roots}|null}} spec
 * @returns {{taken_at, repos: Object<label, {path, head, porcelain, error?}>, files: Object<path, object|null>,
 *   projects: string[]|null}}
 */
function snapshot({ repos = [], files = [], projects = null } = {}) {
  const out = { taken_at: new Date().toISOString(), repos: {}, files: {}, projects: null };
  for (const { label, path: p } of repos) out.repos[label] = repoState(p);
  for (const f of files) out.files[f] = fileState(f);
  if (projects) out.projects = realProjectsEntries(projects);
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The differences between two snapshots: [{what: head|porcelain|repo|file|projects, label, before, after}]. */
function diffSnapshots(a, b) {
  const diffs = [];
  const labels = [...new Set([...Object.keys(a.repos || {}), ...Object.keys(b.repos || {})])];
  for (const label of labels) {
    const x = (a.repos || {})[label];
    const y = (b.repos || {})[label];
    if (!x || !y) {
      diffs.push({ what: 'repo', label, before: x || null, after: y || null });
      continue;
    }
    if (x.head !== y.head) diffs.push({ what: 'head', label, before: x.head, after: y.head });
    if (x.porcelain !== y.porcelain) diffs.push({ what: 'porcelain', label, before: x.porcelain, after: y.porcelain });
  }
  const paths = [...new Set([...Object.keys(a.files || {}), ...Object.keys(b.files || {})])];
  for (const p of paths) {
    const x = (a.files || {})[p] === undefined ? null : a.files[p];
    const y = (b.files || {})[p] === undefined ? null : b.files[p];
    if (!same(x, y)) diffs.push({ what: 'file', label: p, before: x, after: y });
  }
  if (!same(a.projects, b.projects)) {
    diffs.push({ what: 'projects', label: 'real projects entries', before: a.projects, after: b.projects });
  }
  return diffs;
}

module.exports = { projectKey, realProjectsEntries, isolationCheck, snapshot, diffSnapshots };
