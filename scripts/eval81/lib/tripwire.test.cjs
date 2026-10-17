'use strict';
// Tests for scripts/eval81/lib/tripwire.cjs (TRD 81-08, test list 15 and 15b). Every repo, file and "real home" is a
// temp stand-in; the real ~/.claude is never read.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const load = () => require('./tripwire.cjs');
const tmp = (p = 'eval81-tripwire-') => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), p)));
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
  '-c', 'commit.gpgsign=false', '-C', cwd, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });

function tempRepo() {
  const repo = tmp('eval81-tripwire-repo-');
  git(repo, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'one');
  return repo;
}

describe('snapshot and diffSnapshots', () => {
  test('15. identical snapshots diff to []; HEAD, porcelain, file size/mtime/sha256 and projects list changes are each reported', () => {
    const { snapshot, diffSnapshots } = load();
    const repo = tempRepo();
    const home = tmp('eval81-tripwire-home-');
    const root = tmp('eval81-tripwire-root-');
    const settings = path.join(home, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, '{}\n');
    const missing = path.join(home, '.claude', 'CLAUDE.md');
    const spec = { repos: [{ label: 'repo', path: repo }], files: [settings, missing], projects: { realHome: home, roots: [root] } };

    const a = snapshot(spec);
    assert.equal(a.repos.repo.head, git(repo, 'rev-parse', 'HEAD').trim());
    assert.equal(a.repos.repo.porcelain, '');
    assert.equal(a.files[missing], null, 'a missing file snapshots as null');
    assert.equal(a.files[settings].size, 3);
    assert.match(a.files[settings].sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(a.projects, []);
    assert.deepEqual(diffSnapshots(a, snapshot(spec)), []);

    // Porcelain: an untracked file.
    fs.writeFileSync(path.join(repo, 'new.txt'), 'n\n');
    let d = diffSnapshots(a, snapshot(spec));
    assert.deepEqual(d.map((x) => [x.what, x.label]), [['porcelain', 'repo']]);
    assert.match(d[0].after, /new\.txt/);

    // HEAD: a commit (porcelain back to clean).
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'two');
    d = diffSnapshots(a, snapshot(spec));
    assert.deepEqual(d.map((x) => [x.what, x.label]), [['head', 'repo']]);

    // File: same size, new content and mtime.
    const b = snapshot(spec);
    fs.writeFileSync(settings, '[]\n');
    fs.utimesSync(settings, new Date(2001, 0, 1), new Date(2001, 0, 1));
    d = diffSnapshots(b, snapshot(spec));
    assert.deepEqual(d.map((x) => [x.what, x.label]), [['file', settings]]);
    assert.notEqual(d[0].before.sha256, d[0].after.sha256);

    // File created where there was none.
    fs.writeFileSync(missing, 'x');
    d = diffSnapshots(b, snapshot(spec));
    assert.deepEqual(d.map((x) => [x.what, x.label]).sort(), [['file', missing], ['file', settings]].sort());
    assert.equal(d.find((x) => x.label === missing).before, null);

    // Projects: a real projects entry under the root's key.
    const c = snapshot(spec);
    const { projectKey } = load();
    fs.mkdirSync(path.join(home, '.claude', 'projects', `${projectKey(root)}-runs-A-1-work`), { recursive: true });
    d = diffSnapshots(c, snapshot(spec));
    assert.deepEqual(d.map((x) => x.what), ['projects']);
    assert.deepEqual(d[0].after, [`${projectKey(root)}-runs-A-1-work`]);
  });

  test('a repo path that is not a git repo snapshots with an error, and a later fix is reported', () => {
    const { snapshot, diffSnapshots } = load();
    const notRepo = tmp();
    const a = snapshot({ repos: [{ label: 'x', path: notRepo }], files: [], projects: null });
    assert.equal(a.repos.x.head, null);
    assert.ok(a.repos.x.error);
    assert.deepEqual(diffSnapshots(a, snapshot({ repos: [{ label: 'x', path: notRepo }], files: [], projects: null })), []);
  });
});

describe('projectKey, realProjectsEntries, isolationCheck', () => {
  test('15b. projectKey replaces every character outside [A-Za-z0-9] with -', () => {
    const { projectKey } = load();
    assert.equal(projectKey('/private/tmp/a_b/c.d'), '-private-tmp-a-b-c-d');
    assert.equal(projectKey('/Users/justin/dev/aoforge-claude'), '-Users-justin-dev-aoforge-claude');
  });

  test('15b. realProjectsEntries lists names under <realHome>/.claude/projects that start with a root key (given and realpath forms)', () => {
    const { realProjectsEntries, projectKey } = load();
    const home = tmp('eval81-tripwire-home-');
    const real = tmp('eval81-tripwire-real-');
    const link = path.join(tmp(), 'link');
    fs.symlinkSync(real, link);
    const projects = path.join(home, '.claude', 'projects');
    for (const name of [`${projectKey(real)}-runs-A`, `${projectKey(link)}`, '-Users-justin-dev-aoforge-claude', 'other']) {
      fs.mkdirSync(path.join(projects, name), { recursive: true });
    }
    assert.deepEqual(realProjectsEntries({ realHome: home, roots: [link] }), [projectKey(link), `${projectKey(real)}-runs-A`].sort());
    assert.deepEqual(realProjectsEntries({ realHome: tmp(), roots: [link] }), [], 'no projects dir: []');
  });

  test('15b. isolationCheck reports the sandbox project, a real project for the work dir and real entries under the root', () => {
    const { isolationCheck, projectKey } = load();
    const home = tmp('eval81-tripwire-home-');
    const root = tmp('eval81-tripwire-root-');
    const work = path.join(root, 'runs', 'A', 'A-1', 'work');
    const configDir = path.join(root, 'runs', 'A', 'A-1', 'home', '.claude');
    fs.mkdirSync(work, { recursive: true });
    fs.mkdirSync(path.join(configDir, 'projects', projectKey(work)), { recursive: true });
    assert.deepEqual(isolationCheck({ realHome: home, configDir, workDir: work, root }), {
      sandbox_project: true, real_project: false, real_entries_under_root: [],
    });
    fs.mkdirSync(path.join(home, '.claude', 'projects', projectKey(work)), { recursive: true });
    assert.deepEqual(isolationCheck({ realHome: home, configDir, workDir: work, root }), {
      sandbox_project: true, real_project: true, real_entries_under_root: [projectKey(work)],
    });
    fs.rmSync(path.join(configDir, 'projects'), { recursive: true });
    assert.equal(isolationCheck({ realHome: home, configDir, workDir: work, root }).sandbox_project, false);
  });
});
