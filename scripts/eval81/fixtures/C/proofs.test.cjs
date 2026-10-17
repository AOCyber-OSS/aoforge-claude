'use strict';

// Proofs for the test C fixtures (TRD 81-06): the synthetic codebase builder, the reference checklists, the hash
// commitment for the private fleet checklists, the research topic and checklists, and the blind grader prompt and
// schema. These proofs are the tests for test infrastructure (TDD exception recorded in the TRD).
//
// Every build goes into fs.mkdtempSync(os.tmpdir()), and every subprocess that could read a home directory runs
// with a separate temp HOME. Two cases skip with a message instead of failing: the Go build when Go is not on PATH,
// and the fleet commitment check when the private checklist is not on this machine (CI, another clone).

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const AOF = path.join(REPO, 'plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs');
const PLUGIN_JSON = path.join(REPO, 'plugins', 'aoforge', '.claude-plugin', 'plugin.json');
const OBJECTIVE_DIR = path.join('.aoforge', 'objectives', '81-haiku-eval-and-model-efficiency-measurement');
const PRIVATE_DIR = path.join(OBJECTIVE_DIR, 'private');
const PRIVATE_FILE = path.join(PRIVATE_DIR, 'fleet-checklists.json');

const synthetic = require('./synthetic.cjs');
const { NAMES, LEGACY } = require(path.join(REPO, 'plugins', 'aoforge', 'aoforge', 'bin', 'lib', 'legacy-names.cjs'));

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(HERE, name), 'utf8'));
const readText = (name) => fs.readFileSync(path.join(HERE, name), 'utf8');

const tempDirs = [];
function tempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(d);
  return d;
}
after(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});

/** Every file under dir except .git, as sorted relative paths with forward slashes. */
function walk(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (rel === '' && entry.name === '.git') continue;
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, r));
    else out.push(r);
  }
  return out.sort();
}

/** git in a build, never reading the user's git config. */
function git(dir, args) {
  const r = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', LANG: 'C' },
  });
  return r;
}

/** Check one evidence block against a tree: a file's text, or a directory's entry names; absent inverts. */
function evidenceHolds(root, evidence) {
  const abs = path.join(root, evidence.path);
  if (!fs.existsSync(abs)) return { ok: false, why: `${evidence.path} does not exist` };
  const re = new RegExp(evidence.pattern, 'm');
  const matched = fs.statSync(abs).isDirectory()
    ? fs.readdirSync(abs).some((name) => re.test(name))
    : re.test(fs.readFileSync(abs, 'utf8'));
  const ok = evidence.absent ? !matched : matched;
  return { ok, why: ok ? '' : `/${evidence.pattern}/ ${evidence.absent ? 'matched but must not' : 'did not match'} in ${evidence.path}` };
}

function checkItemShape(item, groupKey, group) {
  assert.equal(typeof item.id, 'string', `${group}: item without an id`);
  assert.ok(item.id.startsWith(`${group}-`), `${item.id} is not prefixed with ${group}-`);
  assert.equal(item[groupKey], group, `${item.id}: ${groupKey} is ${item[groupKey]}, want ${group}`);
  assert.ok(typeof item.statement === 'string' && item.statement.length > 20, `${item.id}: statement too short`);
  assert.ok(Array.isArray(item.accept_any) && item.accept_any.length > 0, `${item.id}: accept_any is empty`);
  for (const phrase of item.accept_any) assert.ok(typeof phrase === 'string' && phrase.trim(), `${item.id}: blank phrase`);
}

// Words that would tell a reader of the materialised repo what is being measured.
const REVEALING = ['plant', 'concern', 'eval', 'fixture', 'seeded', 'checklist'];

let build;
function sharedBuild() {
  if (!build) {
    const dir = tempDir('c-syn-');
    build = { dir, result: synthetic.buildSynthetic(dir) };
  }
  return build;
}

describe('test C synthetic codebase', () => {
  test('1. buildSynthetic is deterministic and contains no revealing word', () => {
    const a = tempDir('c-syn-a-');
    const b = tempDir('c-syn-b-');
    const ra = synthetic.buildSynthetic(a);
    const rb = synthetic.buildSynthetic(b);

    const filesA = walk(a);
    assert.deepEqual(filesA, walk(b), 'file lists differ between two builds');
    for (const rel of filesA) {
      assert.equal(fs.readFileSync(path.join(a, rel), 'utf8'), fs.readFileSync(path.join(b, rel), 'utf8'), `${rel} differs`);
    }
    assert.deepEqual(filesA, ra.files, 'the returned file list is not what was written');
    assert.equal(ra.head, rb.head, 'two builds give different commit ids');

    const logFormat = ['log', '--format=%s%n%an <%ae>%n%ad', '--date=iso-strict'];
    const logA = git(a, logFormat);
    assert.equal(logA.status, 0, logA.stderr);
    assert.equal(logA.stdout, git(b, logFormat).stdout, 'commit history differs');
    assert.equal(git(a, ['rev-list', '--count', 'HEAD']).stdout.trim(), String(synthetic.COMMITS.length));

    for (const top of ['cmd', 'internal', 'Makefile', 'Dockerfile', '.github', '.aoforge', '.git', 'go.mod']) {
      assert.ok(fs.existsSync(path.join(a, top)), `build has no ${top}`);
    }

    const messages = git(a, ['log', '--format=%B']).stdout;
    for (const word of REVEALING) {
      assert.ok(!messages.toLowerCase().includes(word), `a commit message contains "${word}"`);
      for (const rel of filesA) {
        assert.ok(!rel.toLowerCase().includes(word), `path ${rel} contains "${word}"`);
        const text = fs.readFileSync(path.join(a, rel), 'utf8').toLowerCase();
        assert.ok(!text.includes(word), `${rel} contains "${word}"`);
      }
    }
  });

  test('1b. the minimal .aoforge/ lets planning draft work and leaves no migration pending', (t) => {
    const { dir } = sharedBuild();
    const env = { PATH: process.env.PATH, HOME: tempDir('c-home-'), TMPDIR: tempDir('c-tmp-') };

    const draft = spawnSync(process.execPath, [AOF, '--cwd', dir, 'planning', 'draft', 'codebase/STACK.md'], {
      encoding: 'utf8',
      env,
    });
    assert.equal(draft.status, 0, `planning draft failed: ${draft.stderr}`);
    assert.ok(draft.stdout.trim().endsWith(path.join('codebase', 'STACK.md')), draft.stdout);
    assert.ok(draft.stdout.trim().startsWith(fs.realpathSync(env.TMPDIR)) || draft.stdout.trim().startsWith(env.TMPDIR));

    const plugin = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')).version;
    if (plugin !== '3.1.0') {
      t.skip(`plugin is ${plugin}; the synthetic planning tree is pinned to the 3.1.0 stamp`);
      return;
    }
    const upgrade = spawnSync(process.execPath, [AOF, '--cwd', dir, 'upgrade', '--check', '--raw'], { encoding: 'utf8', env });
    assert.equal(upgrade.status, 0, upgrade.stderr);
    assert.match(upgrade.stdout, /up to date/, 'a migration is pending: the upgrade hook would rewrite the tree in a run');
  });

  test('2. every synthetic checklist item is proved by its evidence in a fresh build', () => {
    const { dir } = sharedBuild();
    const doc = readJson('checklists-synthetic.json');
    const failures = [];
    for (const items of Object.values(doc.checklists)) {
      for (const item of items) {
        const r = evidenceHolds(dir, item.evidence);
        if (!r.ok) failures.push(`${item.id}: ${r.why}`);
      }
    }
    assert.deepEqual(failures, []);

    const fromFile = {};
    for (const items of Object.values(doc.checklists)) for (const item of items) fromFile[item.id] = item.evidence;
    assert.deepEqual({ ...synthetic.SYNTHETIC_FACTS }, fromFile, 'SYNTHETIC_FACTS does not mirror the checklist file');
  });

  test('3. each focus has 8-12 well-formed items with unique ids, and concerns lists all six real defects', () => {
    const doc = readJson('checklists-synthetic.json');
    assert.deepEqual(Object.keys(doc.checklists).sort(), ['arch', 'concerns', 'quality', 'tech']);
    const ids = new Set();
    for (const [focus, items] of Object.entries(doc.checklists)) {
      assert.ok(items.length >= 8 && items.length <= 12, `${focus} has ${items.length} items`);
      for (const item of items) {
        checkItemShape(item, 'focus', focus);
        assert.ok(item.evidence && item.evidence.path && item.evidence.pattern, `${item.id}: no evidence`);
        assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
        ids.add(item.id);
      }
    }

    // The six defects the specification requires, identified by where they live.
    const six = [
      ['internal/check/check.go', 'http\\.Get'],
      ['internal/store/file.go', 'filepath\\.Join'],
      ['internal/check/worker.go', 'completed\\+\\+'],
      ['internal/store/file.go', 'defer f\\.Close'],
      ['internal/api', '_test\\.go'],
      ['internal/api/handler.go', 'TODO: rate limit'],
    ];
    const seeded = doc.checklists.concerns.filter((i) => i.seeded === true);
    assert.equal(seeded.length, 6, 'concerns must mark exactly six items seeded');
    for (const [p, fragment] of six) {
      const hit = seeded.find((i) => i.evidence.path === p && i.evidence.pattern.includes(fragment));
      assert.ok(hit, `no seeded concern for ${p} ${fragment}`);
    }
  });

  test('4. the build compiles, vets, tests and is gofmt-clean offline', { timeout: 600_000 }, (t) => {
    const go = spawnSync('go', ['version'], { encoding: 'utf8' });
    if (go.error || go.status !== 0) {
      t.skip('go is not on PATH: skipping the Go build check (all other cases still run)');
      return;
    }
    const { dir } = sharedBuild();
    const env = {
      PATH: process.env.PATH,
      HOME: tempDir('c-gohome-'),
      GOPATH: tempDir('c-gopath-'),
      GOCACHE: tempDir('c-gocache-'),
      GOFLAGS: '-mod=mod',
      GOPROXY: 'off',
      GOTOOLCHAIN: 'local',
      GOENV: 'off',
      GOTELEMETRY: 'off',
      CGO_ENABLED: '0',
    };
    for (const args of [['build', './...'], ['vet', './...'], ['test', '-count=1', './...']]) {
      const r = spawnSync('go', args, { cwd: dir, encoding: 'utf8', env });
      assert.equal(r.status, 0, `go ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
    }
    const fmt = spawnSync('gofmt', ['-l', '.'], { cwd: dir, encoding: 'utf8', env });
    assert.equal(fmt.status, 0, fmt.stderr);
    assert.equal(fmt.stdout.trim(), '', `not gofmt-clean: ${fmt.stdout}`);
  });
});

describe('test C fleet commitment', () => {
  test('5. the commitment has the right shape and matches the private checklist when present', (t) => {
    const c = readJson('fleet-commitment.json');
    assert.equal(c.alias, 'fleet-go-service');
    assert.equal(c.language, 'go');
    assert.match(c.source_commit, /^[0-9a-f]{40}$/);
    assert.match(c.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(c.items_per_focus).sort(), ['arch', 'concerns', 'quality', 'tech']);
    for (const [focus, n] of Object.entries(c.items_per_focus)) {
      assert.ok(Number.isInteger(n) && n >= 8 && n <= 12, `${focus}: ${n} items`);
    }

    const privateAbs = path.join(REPO, PRIVATE_FILE);
    if (!fs.existsSync(privateAbs)) {
      t.skip('private fleet checklist not present on this machine');
      return;
    }
    const bytes = fs.readFileSync(privateAbs);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), c.sha256, 'the private checklist changed since it was committed');
    const doc = JSON.parse(bytes.toString('utf8'));
    assert.equal(doc.alias, c.alias);
    assert.equal(doc.source_commit, c.source_commit);
    // The legacy planning directory name comes from LEGACY, the one module allowed to spell it.
    assert.deepEqual(doc.prepared, [`removed ${LEGACY.planningDir}/`, 'removed .claude/', `added ${NAMES.planningDir}/`]);
    const ids = new Set();
    for (const [focus, items] of Object.entries(doc.checklists)) {
      assert.equal(items.length, c.items_per_focus[focus], `${focus} count differs from the commitment`);
      for (const item of items) {
        checkItemShape(item, 'focus', focus);
        assert.ok(item.evidence && item.evidence.path && item.evidence.pattern, `${item.id}: no evidence`);
        assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
        ids.add(item.id);
      }
    }
  });

  test('6. no C fixture file names the fleet repository', () => {
    // Spelled in pieces so this file does not match itself.
    const banned = ['ao' + 'edge', 'aocyber' + 'systems'];
    const hits = [];
    for (const rel of walk(HERE)) {
      const text = fs.readFileSync(path.join(HERE, rel), 'utf8').toLowerCase();
      for (const word of banned) if (rel.toLowerCase().includes(word) || text.includes(word)) hits.push(`${rel}: ${word}`);
    }
    assert.deepEqual(hits, []);
  });
});

describe('test C research topic and grader', () => {
  test('7. the researcher checklists cover four dimensions with 8-12 items each', () => {
    const doc = readJson('checklists-researcher.json');
    assert.deepEqual(Object.keys(doc.checklists).sort(), ['architecture', 'features', 'pitfalls', 'stack']);
    const ids = new Set();
    for (const [dim, items] of Object.entries(doc.checklists)) {
      assert.ok(items.length >= 8 && items.length <= 12, `${dim} has ${items.length} items`);
      for (const item of items) {
        checkItemShape(item, 'dimension', dim);
        assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
        ids.add(item.id);
      }
    }

    const topic = readText('researcher-topic.md');
    for (const heading of ['## Domain', '## Project title', '## Project summary']) {
      assert.ok(topic.includes(`\n${heading}\n`), `researcher-topic.md has no "${heading}" section`);
    }
    const domain = topic.split('\n## Domain\n')[1].split('\n## ')[0].trim();
    assert.equal(
      domain,
      'A command-line tool, written in Go, that keeps a local full-text search index of a folder of Markdown notes and updates it when files change',
    );
  });

  test('8. the grader schema and prompt have the required shape and name no model', () => {
    const schema = readJson('grader-schema.json');
    assert.equal(schema.type, 'object');
    assert.deepEqual([...schema.required].sort(), ['fabrications', 'items']);
    const item = schema.properties.items.items;
    assert.equal(schema.properties.items.type, 'array');
    assert.deepEqual([...item.required].sort(), ['evidence', 'id', 'verdict']);
    assert.deepEqual(item.properties.verdict.enum, ['found', 'wrong', 'missing']);
    const fab = schema.properties.fabrications.items;
    assert.equal(schema.properties.fabrications.type, 'array');
    assert.deepEqual([...fab.required].sort(), ['claim', 'why']);

    const prompt = readText('grader-prompt.md');
    for (const placeholder of ['{{TASK}}', '{{CHECKLIST}}', '{{DOCUMENT}}']) {
      assert.equal(prompt.split(placeholder).length, 2, `${placeholder} must appear exactly once`);
    }
    for (const name of ['haiku', 'sonnet', 'opus', 'claude', 'gpt', 'gemini', 'llama']) {
      assert.ok(!prompt.toLowerCase().includes(name), `the grader prompt names "${name}"`);
    }
  });

  test('9. private/.gitignore ignores the checklist but not itself', () => {
    assert.equal(fs.readFileSync(path.join(REPO, PRIVATE_DIR, '.gitignore'), 'utf8'), '*\n!.gitignore\n');
    const ignored = git(REPO, ['check-ignore', '-q', '--', PRIVATE_FILE]);
    assert.equal(ignored.status, 0, `private/fleet-checklists.json is not ignored: ${ignored.stderr}`);
    const self = git(REPO, ['check-ignore', '-q', '--', path.join(PRIVATE_DIR, '.gitignore')]);
    assert.equal(self.status, 1, 'private/.gitignore is itself ignored, so the rule would not survive a fresh clone');
  });
});
