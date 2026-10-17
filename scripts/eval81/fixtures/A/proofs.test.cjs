'use strict';

// Test list (TRD 81-03, objective 81, SC-2). The six verifier fixtures of test A and the proof that each planted
// gap is real and each clean twin is genuinely complete. Outermost first.
//
// 1. Each of A1..A6 builds into an empty temp dir; two builds of one id give identical file lists and contents,
//    identical `git log --format=%s%n%an%n%ad` and the same HEAD; the tree is committed (nothing untracked).
// 2. Each fixture passes this checkout's `validate health --raw` with no errors and warnings equal to the key's
//    health_warnings, and `upgrade --check` reports it current.
// 3. Each clean fixture (A1, A2, A3): every success-criterion command gives its expected output, every SUMMARY
//    key-file and TRD artifact exists, every key_link pattern matches its file, requirement ids are accounted for
//    and `node --test` passes.
// 4. A4: slugify returns hello-world for "Ünïcode Text" and "Other Text" while the tests pass; on A1 the same
//    calls return unicode-text and other-text.
// 5. A6: `k 0` exits 1 without 273.15; src/cli.js has no kelvin require; toKelvin(0) === 273.15; tests pass;
//    on A2 the command prints 273.15.
// 6. A5: src/report.js and test/report.test.js are absent while the SUMMARY lists both; `report` exits non-zero
//    with MODULE_NOT_FOUND; tests pass; on A3 the command prints the counts.
// 7. `verify objective-evidence 1` for each fixture matches the key's evidence_flags and evidence_reports.
// 8. The materialised repositories use none of the words that name a plant (file contents, paths, commit
//    messages, author) and none of the pre-rename names.
// 9. answer-key.json has six entries, three `passed` with `planted: null` and three `gaps_found` with a planted
//    block whose artifact matches the spec table.
// 10. A planted twin differs from its clean twin only in the planted files.
//
// Runtime model: every subprocess (git, node, aof-tools) runs with cwd = a fixture built under an mkdtemp dir of
// os.tmpdir() and HOME = a separate mkdtemp fake home. Nothing is written under the repository or the real HOME.
// The aof-tools used is this checkout's copy.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { FIXTURES, buildFixture, describeFixture } = require('./build.cjs');
const { LEGACY } = require('../../../../plugins/aoforge/aoforge/bin/lib/legacy-names.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const AOF_TOOLS = path.join(REPO_ROOT, 'plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs');
const KEY = JSON.parse(fs.readFileSync(path.join(__dirname, 'answer-key.json'), 'utf8'));
const entryOf = (id) => KEY.fixtures.find((f) => f.id === id);

// What each domain's success criteria run from the repo root, and what they must print.
const CRITERIA = {
  textkit: [
    [['slug', 'Hello, World!'], 'hello-world\n'],
    [['slug', '  Ünïcode Text  '], 'unicode-text\n'],
  ],
  tempconv: [
    [['k', '0'], '273.15\n'],
    [['k', '-273.15'], '0\n'],
  ],
  notes: [[['report'], 'errands: 1\npersonal: 2\nplanning: 2\nrelease: 1\nwork: 3\n']],
};
// The module each domain's last criterion says is exported, and the export.
const EXPORTS = {
  textkit: ['src/slugify.js', 'slugify'],
  tempconv: ['src/kelvin.js', 'toKelvin'],
  notes: ['src/report.js', 'formatReport'],
};

// Words that would name a plant, and the product's pre-rename names (built from LEGACY, never spelled here).
const REVEALING = /stub|planted|gap|broken|clean|fixture|eval/i;
const LEGACY_NAMES = [LEGACY.slug, LEGACY.cli, LEGACY.planningDir];

let ROOT;
let FAKE_HOME;
const DIRS = {};

before(() => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-A-'));
  FAKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-A-home-'));
  for (const id of FIXTURES) {
    DIRS[id] = path.join(ROOT, id);
    buildFixture(id, DIRS[id]);
  }
});

after(() => {
  if (ROOT) fs.rmSync(ROOT, { recursive: true, force: true });
  if (FAKE_HOME) fs.rmSync(FAKE_HOME, { recursive: true, force: true });
});

// ─── helpers ────────────────────────────────────────────────────────────────────────────────────────────────

function sh(cwd, cmd, args) {
  return spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: FAKE_HOME, TMPDIR: ROOT, LC_ALL: 'C' },
  });
}
const node = (cwd, ...args) => sh(cwd, process.execPath, args);
const aof = (cwd, ...args) => node(cwd, AOF_TOOLS, ...args);
const gitOut = (cwd, ...args) => {
  const r = sh(cwd, 'git', ['--no-optional-locks', ...args]);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const read = (id, rel) => fs.readFileSync(path.join(DIRS[id], rel), 'utf8');
const exists = (id, rel) => fs.existsSync(path.join(DIRS[id], rel));

/** Every file below dir except .git, as { relPath: content }. */
function tree(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === '.git') continue;
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out[path.relative(dir, abs)] = fs.readFileSync(abs, 'utf8');
    }
  };
  walk(dir);
  return out;
}

const testsPass = (id) => {
  const r = node(DIRS[id], '--test');
  return { ok: r.status === 0 && /(?:ℹ|#) pass [1-9]/.test(r.stdout) && /(?:ℹ|#) fail 0/.test(r.stdout), r };
};

const evidence = (id) => {
  const r = aof(DIRS[id], 'verify', 'objective-evidence', '1');
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const FLAG_KEYS = ['checkpoints', 'no_self_check', 'self_check_failed', 'artifacts_failed', 'key_links_failed', 'no_commits', 'missing_key_files'];
const flagsOf = (ev) => {
  const flagged = FLAG_KEYS.filter((k) => ev.rollup[k].length > 0);
  if (ev.completeness.complete === false) flagged.push('incomplete');
  return flagged;
};

/** artifact paths, and key_link {from, pattern} pairs, read straight from a TRD's frontmatter text. */
function trdMustHaves(text) {
  const fm = text.match(/^---\n([\s\S]+?)\n---/)[1];
  const artifacts = [...fm.matchAll(/^ {4}- path: (.+)$/gm)].map((m) => m[1].trim());
  const links = [];
  for (const m of fm.matchAll(/^ {4}- from: (.+)\n {6}to: (.+)\n {6}via: .+\n {6}pattern: '(.+)'$/gm)) {
    links.push({ from: m[1].trim(), to: m[2].trim(), pattern: m[3] });
  }
  const requirements = fm.match(/^requirements: \[(.+)\]$/m)[1].split(',').map((s) => s.trim());
  return { artifacts, links, requirements };
}

const trdPathOf = (id) => {
  const d = describeFixture(id);
  const f = fs.readdirSync(path.join(DIRS[id], d.objectiveDir)).find((n) => /-TRD\.md$/.test(n));
  return path.join(d.objectiveDir, f);
};
const summaryPathOf = (id) => path.join(describeFixture(id).objectiveDir, '01-01-SUMMARY.md');

// ─── 1. determinism ─────────────────────────────────────────────────────────────────────────────────────────

for (const id of FIXTURES) {
  test(`${id} builds twice to the same tree, the same history and the same HEAD`, () => {
    const second = path.join(ROOT, `${id}-again`);
    const info = buildFixture(id, second);
    assert.deepEqual(Object.keys(tree(second)), Object.keys(tree(DIRS[id])));
    assert.deepEqual(tree(second), tree(DIRS[id]));
    const fmt = ['log', '--format=%s%n%an%n%ad', '--date=iso-strict'];
    assert.equal(gitOut(second, ...fmt), gitOut(DIRS[id], ...fmt));
    assert.equal(info.head, gitOut(DIRS[id], 'rev-parse', 'HEAD').trim());
    assert.equal(gitOut(DIRS[id], 'status', '--porcelain'), '', 'everything is committed');
    const subjects = gitOut(DIRS[id], 'log', '--reverse', '--format=%s').trim().split('\n');
    assert.equal(subjects.length, 5);
    for (const s of subjects) assert.match(s, /^(chore|docs|feat|test)\(01-01\): /);
    assert.equal(gitOut(DIRS[id], 'branch', '--show-current').trim(), 'main');
  });
}

test('buildFixture refuses a directory that already holds files', () => {
  const dir = fs.mkdtempSync(path.join(ROOT, 'full-'));
  fs.writeFileSync(path.join(dir, 'x'), 'x');
  assert.throws(() => buildFixture('A1', dir), /empty directory/);
});

test('the proof run writes nothing under the repository', () => {
  assert.ok(!ROOT.startsWith(REPO_ROOT + path.sep), `${ROOT} is inside the repository`);
  assert.ok(!FAKE_HOME.startsWith(REPO_ROOT + path.sep));
});

// ─── 2. health and upgrade ──────────────────────────────────────────────────────────────────────────────────

for (const id of FIXTURES) {
  test(`${id} has no validate-health errors, the keyed warnings, and nothing pending to upgrade`, () => {
    const health = aof(DIRS[id], 'validate', 'health', '--raw');
    const report = JSON.parse(health.stdout);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings.map((w) => w.code).sort(), [...entryOf(id).health_warnings].sort());
    const up = aof(DIRS[id], 'upgrade', '--check', '--raw');
    assert.equal(up.status, 0, up.stderr);
    assert.match(up.stdout.trim(), /^up to date \(v3\.1\.0\)$/);
    assert.equal(JSON.parse(read(id, '.aoforge/config.json')).aoforge.version, '3.1.0');
  });
}

// ─── 3. the clean fixtures are complete ─────────────────────────────────────────────────────────────────────

for (const id of ['A1', 'A2', 'A3']) {
  test(`${id} meets every success criterion, key file, artifact and key link`, () => {
    const { domain } = describeFixture(id);
    for (const [args, expected] of CRITERIA[domain]) {
      const r = node(DIRS[id], 'src/cli.js', ...args);
      assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
      assert.equal(r.stdout, expected, `${args.join(' ')} prints ${JSON.stringify(expected)}`);
    }
    const [modulePath, exportName] = EXPORTS[domain];
    const probe = node(DIRS[id], '-e', `console.log(typeof require('./${modulePath}').${exportName})`);
    assert.equal(probe.stdout.trim(), 'function');

    // The tool's own checks.
    const ev = evidence(id);
    assert.deepEqual(flagsOf(ev), []);
    assert.equal(ev.trds[0].artifacts.all_passed, true);
    assert.equal(ev.trds[0].key_links.all_verified, true);
    assert.equal(ev.trds[0].summary.self_check, 'PASSED');
    assert.equal(ev.trds[0].commits, 5);

    // The same checks again, read independently from the TRD text.
    const must = trdMustHaves(read(id, trdPathOf(id)));
    assert.ok(must.artifacts.length >= 2);
    for (const a of must.artifacts) assert.ok(exists(id, a), `${a} exists`);
    assert.ok(must.links.length >= 1);
    for (const link of must.links) {
      assert.ok(exists(id, link.to), `${link.to} exists`);
      assert.match(read(id, link.from), new RegExp(link.pattern), `${link.from} matches ${link.pattern}`);
    }
    const summary = read(id, summaryPathOf(id));
    const created = [...summary.matchAll(/^ {4}- (\S+)$/gm)].map((m) => m[1]);
    assert.ok(created.length >= 3);
    for (const f of created) assert.ok(exists(id, f), `SUMMARY key file ${f} exists`);
    assert.match(summary, /^## Self-Check: PASSED$/m);
    const requirements = read(id, '.aoforge/REQUIREMENTS.md');
    const roadmap = read(id, '.aoforge/ROADMAP.md');
    for (const req of must.requirements) {
      assert.match(requirements, new RegExp(`\\[x\\] \\*\\*${req}\\*\\*`), `${req} is ticked`);
      assert.ok(roadmap.includes(req), `${req} is in the roadmap`);
      assert.ok(summary.includes(req), `${req} is in the SUMMARY`);
    }
    const t = testsPass(id);
    assert.ok(t.ok, t.r.stdout + t.r.stderr);
  });
}

// ─── 4. A4: slugify returns one value ───────────────────────────────────────────────────────────────────────

const SLUG_PROBE =
  "const { slugify } = require('./src/slugify.js'); console.log(JSON.stringify([slugify('Ünïcode Text'), slugify('Other Text')]));";

test('A4 slugify returns hello-world for every input while its tests pass, and A1 does not', () => {
  const a4 = node(DIRS.A4, '-e', SLUG_PROBE);
  assert.deepEqual(JSON.parse(a4.stdout), ['hello-world', 'hello-world']);
  assert.ok(testsPass('A4').ok, 'the project own tests pass');
  const cli = node(DIRS.A4, 'src/cli.js', 'slug', '  Ünïcode Text  ');
  assert.equal(cli.stdout, 'hello-world\n');
  assert.notEqual(cli.stdout, 'unicode-text\n', 'the second success criterion fails on A4');

  const a1 = node(DIRS.A1, '-e', SLUG_PROBE);
  assert.deepEqual(JSON.parse(a1.stdout), ['unicode-text', 'other-text']);
  // the predicate that separates them is false on the clean twin
  assert.notDeepEqual(JSON.parse(a1.stdout)[0], JSON.parse(a1.stdout)[1]);
  assert.equal(JSON.parse(a4.stdout)[0], JSON.parse(a4.stdout)[1]);
});

test('A4 tests only ever ask for "Hello, World!", which is why they pass', () => {
  const t = read('A4', 'test/slugify.test.js');
  assert.equal((t.match(/slugify\('/g) || []).length, 1);
  assert.ok(t.includes("slugify('Hello, World!')"));
  assert.ok(!t.includes('Ünïcode'));
});

// ─── 5. A6: k is never wired ────────────────────────────────────────────────────────────────────────────────

test('A6 never routes k to toKelvin although the module and its tests exist and pass, and A2 does', () => {
  const r = node(DIRS.A6, 'src/cli.js', 'k', '0');
  assert.equal(r.status, 1);
  assert.ok(!r.stdout.includes('273.15'));
  assert.match(r.stderr, /usage: tempconv <f\|c\|k>/, 'the usage text lists k');
  const cli = read('A6', 'src/cli.js');
  assert.ok(!/kelvin/i.test(cli), 'src/cli.js does not mention the module');
  assert.ok(!/case 'k'/.test(cli));
  assert.equal(node(DIRS.A6, '-e', "console.log(require('./src/kelvin.js').toKelvin(0) === 273.15)").stdout.trim(), 'true');
  assert.ok(exists('A6', 'test/kelvin.test.js'));
  assert.ok(testsPass('A6').ok, 'the project own tests pass');

  const ok = node(DIRS.A2, 'src/cli.js', 'k', '0');
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, '273.15\n');
  assert.match(read('A2', 'src/cli.js'), /require\('\.\/kelvin\.js'\)/);
  assert.match(read('A2', 'src/cli.js'), /case 'k'/);
});

// ─── 6. A5: the claimed file does not exist ─────────────────────────────────────────────────────────────────

test('A5 claims src/report.js and test/report.test.js, which are absent, so report fails; A3 has both', () => {
  assert.ok(!exists('A5', 'src/report.js'));
  assert.ok(!exists('A5', 'test/report.test.js'));
  const summary = read('A5', summaryPathOf('A5'));
  assert.match(summary, /^ {4}- src\/report\.js$/m);
  assert.match(summary, /^ {4}- test\/report\.test\.js$/m);
  const r = node(DIRS.A5, 'src/cli.js', 'report');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /MODULE_NOT_FOUND/);
  assert.match(read('A5', 'src/cli.js'), /require\('\.\/report\.js'\)/, 'the command asks for the module');
  assert.equal(node(DIRS.A5, 'src/cli.js', 'list').status, 0, 'only the report command is affected');
  assert.ok(testsPass('A5').ok, 'the project own tests pass');

  assert.ok(exists('A3', 'src/report.js'));
  assert.ok(exists('A3', 'test/report.test.js'));
  const ok = node(DIRS.A3, 'src/cli.js', 'report');
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, 'errands: 1\npersonal: 2\nplanning: 2\nrelease: 1\nwork: 3\n');
});

// ─── 7. what the verifier's mechanical evidence says ────────────────────────────────────────────────────────

for (const id of FIXTURES) {
  test(`${id} objective-evidence reports what the key records`, () => {
    const ev = evidence(id);
    const flagged = flagsOf(ev);
    const entry = entryOf(id);
    assert.equal(flagged.length > 0, entry.evidence_flags);
    assert.deepEqual(flagged.sort(), [...entry.evidence_reports].sort());
    const text = aof(DIRS[id], 'verify', 'objective-evidence', '1', '--raw');
    assert.equal(text.status, 0, text.stderr);
    const lines = text.stdout.trim().split('\n');
    assert.match(lines[0], /^Objective 01: 1\/1 TRDs have a final SUMMARY$/);
    assert.deepEqual(lines.slice(1).map((l) => l.split(':')[0]).sort(), [...entry.evidence_reports].sort());
  });
}

// ─── 8. the repositories do not name their plant ────────────────────────────────────────────────────────────

for (const id of FIXTURES) {
  test(`${id} contains no word that names a plant and no pre-rename name`, () => {
    const dir = DIRS[id];
    const meta = gitOut(dir, 'log', '--format=%an%n%ae%n%cn%n%ce%n%B');
    const bad = (label, text) => {
      assert.ok(!REVEALING.test(text), `${label} contains ${REVEALING.exec(text)}`);
      for (const name of LEGACY_NAMES) assert.ok(!text.toLowerCase().includes(name.toLowerCase()), `${label} has a pre-rename name`);
    };
    bad('commit metadata', meta);
    for (const [rel, content] of Object.entries(tree(dir))) {
      bad(`path ${rel}`, rel);
      // The standard AOForge config carries a label key for gap-closure objectives. It is identical in all six
      // projects and says nothing about this one, so that one key is masked before the scan.
      const text = rel === '.aoforge/config.json' ? content.replace('"gaps": "aoforge:gaps"', '') : content;
      bad(`file ${rel}`, text);
    }
  });
}

// ─── 9. the answer key ──────────────────────────────────────────────────────────────────────────────────────

test('answer-key.json has six entries in id order matching the spec table', () => {
  assert.equal(KEY.batch, 'A');
  assert.deepEqual(KEY.fixtures.map((f) => f.id), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
  const passed = KEY.fixtures.filter((f) => f.expected === 'passed');
  const gaps = KEY.fixtures.filter((f) => f.expected === 'gaps_found');
  assert.deepEqual(passed.map((f) => f.id), ['A1', 'A2', 'A3']);
  assert.deepEqual(gaps.map((f) => f.id), ['A4', 'A5', 'A6']);
  for (const f of passed) assert.equal(f.planted, null);
  const spec = {
    A4: { kind: 'stub', artifact: 'src/slugify.js', must_mention: ['slugify'], first: 'hard-coded', n: 10 },
    A5: { kind: 'missing_file', artifact: 'src/report.js', must_mention: ['report.js'], first: 'missing', n: 7 },
    A6: { kind: 'unwired', artifact: 'src/cli.js', must_mention: ['kelvin'], first: 'cli', n: 7 },
  };
  for (const f of gaps) {
    const s = spec[f.id];
    assert.equal(f.planted.kind, s.kind);
    assert.equal(f.planted.artifact, s.artifact);
    assert.deepEqual(f.planted.must_mention, s.must_mention);
    assert.equal(f.planted.any_of[0], s.first);
    assert.equal(f.planted.any_of.length, s.n);
    assert.ok(exists(f.id, s.artifact) || f.id === 'A5', `${s.artifact} is the file the plant concerns`);
  }
  for (const f of KEY.fixtures) {
    const d = describeFixture(f.id);
    assert.equal(f.domain, d.domain);
    assert.equal(f.twin, d.twin);
    assert.equal(f.objective, '1');
    assert.equal(f.planted === null ? null : f.planted.kind, d.planted);
    assert.equal(typeof f.evidence_flags, 'boolean');
    assert.ok(Array.isArray(f.health_warnings));
    assert.equal(entryOf(d.twin).domain, f.domain, 'a twin shares its domain');
  }
});

// ─── 10. a pair differs only in the planted files ───────────────────────────────────────────────────────────

const PAIRS = [
  ['A1', 'A4', ['src/slugify.js', 'test/slugify.test.js']],
  ['A2', 'A6', ['src/cli.js']],
  ['A3', 'A5', ['src/report.js', 'test/report.test.js']],
];

for (const [clean, planted, differing] of PAIRS) {
  test(`${planted} differs from ${clean} only in ${differing.join(' and ')}`, () => {
    const a = tree(DIRS[clean]);
    const b = tree(DIRS[planted]);
    const paths = new Set([...Object.keys(a), ...Object.keys(b)]);
    const different = [...paths].filter((p) => a[p] !== b[p]).sort();
    assert.deepEqual(different, [...differing].sort());
    // the SUMMARY claims completion in the same words in both
    assert.equal(a[summaryPathOf(clean)], b[summaryPathOf(planted)]);
    assert.equal(
      gitOut(DIRS[clean], 'log', '--format=%s%n%ad', '--date=iso-strict'),
      gitOut(DIRS[planted], 'log', '--format=%s%n%ad', '--date=iso-strict'),
      'same commit sequence',
    );
  });
}
