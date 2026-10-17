'use strict';

/*
 * Proofs for the test B (job-checker) fixtures, TRD 81-04.
 *
 * Each planted flaw is shown real by a structural predicate that is true on the planted set and false on its base; each
 * planted set is shown to differ from its base only in the TRD files the spec names; and the mechanical pre-check
 * (`verify trd-pre 2`) is run on every set so the answer key records what code already catches.
 *
 * Every subprocess runs with cwd = a materialised project under os.tmpdir() and HOME = a separate temp dir. Nothing is
 * written outside temp dirs. By hand: TMPDIR=<session scratchpad>/eval81-test-tmp node --test scripts/eval81/fixtures/B/proofs.test.cjs
 */

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { FIXTURES, buildFixture, describeFixture } = require('./build.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const AOF = path.join(ROOT, 'plugins', 'aoforge', 'aoforge', 'bin', 'aof-tools.cjs');
const { extractFrontmatter } = require(path.join(ROOT, 'plugins', 'aoforge', 'aoforge', 'bin', 'lib', 'frontmatter.cjs'));
const KEY = require('./answer-key.json');

// ─── Temp dirs, builds and subprocesses ──────────────────────────────────────────────────────────────────────────

const tmpDirs = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const FAKE_HOME = mkTmp('home-');
const BUILT = {};
for (const id of FIXTURES) BUILT[id] = buildFixture(id, mkTmp('tk-'));

function aof(id, args) {
  const r = spawnSync('node', [AOF, ...args], {
    cwd: BUILT[id].dir,
    env: { PATH: process.env.PATH, HOME: FAKE_HOME, LANG: 'C' },
    encoding: 'utf8',
  });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (e) {
    json = null;
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function gitOut(dir, args) {
  const r = spawnSync('git', ['--no-optional-locks', ...args], {
    cwd: dir,
    env: { PATH: process.env.PATH, HOME: FAKE_HOME, LANG: 'C', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, 'git ' + args.join(' ') + ' failed: ' + r.stderr);
  return r.stdout;
}

function snapshot(dir) {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(r);
      else out[r] = fs.readFileSync(path.join(dir, r), 'utf8');
    }
  };
  walk('');
  return out;
}

// ─── Reading the planned objective ───────────────────────────────────────────────────────────────────────────────

const taskBlocks = (text) => [...text.matchAll(/<task\b[^>]*>([\s\S]*?)<\/task>/g)].map((m) => m[1]);

function readTrds(id) {
  const dir = path.join(BUILT[id].dir, '.aoforge', 'objectives', describeFixture(id).objectiveDir);
  const out = {};
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('-TRD.md')).sort()) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const fm = extractFrontmatter(text);
    out[f.match(/^(\d+-\d+)-/)[1]] = {
      file: f,
      bytes: Buffer.byteLength(text),
      text,
      wave: parseInt(fm.wave, 10),
      deps: fm.depends_on || [],
      files: fm.files_modified || [],
      requirements: fm.requirements || [],
      truths: (fm.must_haves && fm.must_haves.truths) || [],
      tasks: taskBlocks(text),
    };
  }
  return out;
}

function roadmapObjective2(id) {
  const text = fs.readFileSync(path.join(BUILT[id].dir, '.aoforge', 'ROADMAP.md'), 'utf8');
  const m = /### Objective 2:[\s\S]*?(?=\n## )/.exec(text);
  assert.ok(m, 'ROADMAP has an Objective 2 section in ' + id);
  return m[0];
}

// ─── Structural predicates ───────────────────────────────────────────────────────────────────────────────────────

// Pairs of TRDs in one wave with no dependency between them whose files_modified share a path.
function sameWaveSharedFiles(trds) {
  const ids = Object.keys(trds);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = trds[ids[i]];
      const b = trds[ids[j]];
      if (a.wave !== b.wave) continue;
      if (a.deps.includes(ids[j]) || b.deps.includes(ids[i])) continue;
      const shared = a.files.filter((f) => b.files.includes(f));
      if (shared.length > 0) pairs.push({ trds: [ids[i], ids[j]], files: shared });
    }
  }
  return pairs;
}

// Tasks (across all TRDs) with no verify element, as [trdId, taskIndex].
function tasksWithoutVerify(trds) {
  const out = [];
  for (const [id, t] of Object.entries(trds)) {
    t.tasks.forEach((body, i) => {
      if (!/<verify\b/.test(body)) out.push([id, i]);
    });
  }
  return out;
}

// [trdId, depId] where the dependency sits in a later wave than the dependent.
function laterWaveDeps(trds) {
  const out = [];
  for (const [id, t] of Object.entries(trds)) {
    for (const d of t.deps) if (trds[d] && trds[d].wave > t.wave) out.push([id, d]);
  }
  return out;
}

function orphanRefs(trds) {
  const out = [];
  for (const [id, t] of Object.entries(trds)) for (const d of t.deps) if (!trds[d]) out.push([id, d]);
  return out;
}

function hasCycle(trds) {
  const color = {};
  const visit = (id) => {
    color[id] = 1;
    for (const d of trds[id].deps) {
      if (!trds[d]) continue;
      if (color[d] === 1) return true;
      if (!color[d] && visit(d)) return true;
    }
    color[id] = 2;
    return false;
  };
  return Object.keys(trds).some((id) => !color[id] && visit(id));
}

// "unknown format" in a task or in a must_haves truth.
const mentionsUnknownFormat = (t) => t.tasks.some((b) => /unknown format/i.test(b)) || t.truths.some((s) => /unknown format/i.test(s));

// What `verify trd-pre` reports as a blocker, flattened to strings. Scope and budget are judgment calls, so they are
// not blockers (plan-objective sends them to the checker).
function blockersOf(pre) {
  const c = pre.checks;
  return [
    ...c.requirement_coverage.missing.map((id) => 'requirement_coverage:' + id),
    ...c.task_completeness.incomplete.map((i) => 'task_completeness:' + i.trd + ':' + i.missing.join('+')),
    ...c.dependency_correctness.cycles.map((cy) => 'dependency_correctness:cycle:' + cy.join('>')),
    ...c.dependency_correctness.orphan_refs.map((o) => 'dependency_correctness:orphan:' + o.trd + '>' + o.missing),
  ];
}

const PRE = {};
for (const id of FIXTURES) PRE[id] = aof(id, ['verify', 'trd-pre', '2']).json;

const keyEntry = (id) => KEY.sets.find((s) => s.id === id);

// ─── 1. Deterministic builds ─────────────────────────────────────────────────────────────────────────────────────

test('each of B1..B6 builds deterministically: same files, contents and commit history across two builds', () => {
  for (const id of FIXTURES) {
    const again = buildFixture(id, mkTmp('tk-'));
    assert.equal(again.head, BUILT[id].head, id + ': same HEAD commit id');
    assert.deepEqual(snapshot(again.dir), snapshot(BUILT[id].dir), id + ': same files and contents');
    const log = (dir) => gitOut(dir, ['log', '--format=%H|%an|%ae|%ad|%s', '--date=iso-strict']);
    assert.equal(log(again.dir), log(BUILT[id].dir), id + ': same commits, authors, dates and subjects');
  }
});

test('every set is a six-commit history whose last commit plans objective 2 and leaves a clean tree', () => {
  for (const id of FIXTURES) {
    const dir = BUILT[id].dir;
    assert.equal(gitOut(dir, ['status', '--porcelain']), '', id + ': working tree is clean');
    const subjects = gitOut(dir, ['log', '--format=%s']).trim().split('\n');
    assert.equal(subjects.length, 6, id + ': six commits');
    assert.match(subjects[0], /^docs\(02\): plan /, id + ': objective 2 planning is the last commit');
    const lastFiles = gitOut(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n');
    assert.ok(
      lastFiles.some((f) => /^\.aoforge\/objectives\/02-[^/]+\/02-\d\d-.*-TRD\.md$/.test(f)),
      id + ': the last commit adds the objective 2 TRDs'
    );
    const objectives = fs.readdirSync(path.join(dir, '.aoforge', 'objectives')).sort();
    assert.equal(objectives.length, 2, id + ': two objectives');
    assert.match(objectives[0], /^01-/);
    assert.match(objectives[1], /^02-/);
    const obj2 = fs.readdirSync(path.join(dir, '.aoforge', 'objectives', objectives[1]));
    assert.ok(obj2.some((n) => n.endsWith('-TRD.md')), id + ': objective 2 has TRDs');
    assert.ok(!obj2.some((n) => n.endsWith('-SUMMARY.md')), id + ': objective 2 has no SUMMARY');
    const obj1 = fs.readdirSync(path.join(dir, '.aoforge', 'objectives', objectives[0]));
    assert.ok(obj1.includes('01-01-SUMMARY.md'), id + ': objective 1 has its SUMMARY');
  }
});

test('objective 1 of both projects is genuinely done: its own tests pass', () => {
  for (const id of ['B1', 'B2']) {
    const r = spawnSync(process.execPath, ['--test'], {
      cwd: BUILT[id].dir,
      env: { PATH: process.env.PATH, HOME: FAKE_HOME, TMPDIR: os.tmpdir(), LANG: 'C' },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, id + ': node --test failed\n' + r.stdout + r.stderr);
  }
});

// ─── 2. Scaffolding is healthy ───────────────────────────────────────────────────────────────────────────────────

test('every set passes validate health with no errors (warnings equal the key) and upgrade --check is current', () => {
  for (const id of FIXTURES) {
    const h = aof(id, ['validate', 'health']);
    assert.ok(h.json, id + ': validate health printed JSON\n' + h.stdout + h.stderr);
    assert.deepEqual(h.json.errors, [], id + ': no validate health errors');
    assert.deepEqual(
      h.json.warnings.map((w) => w.code),
      keyEntry(id).health_warnings,
      id + ': warnings equal the key'
    );
    const u = aof(id, ['upgrade', '--check']);
    assert.ok(u.json, id + ': upgrade --check printed JSON\n' + u.stdout + u.stderr);
    assert.equal(u.json.up_to_date, true, id + ': upgrade --check is current');
    assert.deepEqual(u.json.pending, [], id + ': nothing pending');
    assert.deepEqual(u.json.pending_confirm, [], id + ': nothing awaiting confirmation');
    assert.deepEqual(u.json.failed, [], id + ': nothing failed');
  }
});

// ─── 3. verify job-structure ─────────────────────────────────────────────────────────────────────────────────────

test('verify job-structure reports no error for any TRD, and no warning except 02-02 of B4', () => {
  for (const id of FIXTURES) {
    const info = describeFixture(id);
    for (const f of info.trdFiles) {
      const r = aof(id, ['verify', 'job-structure', '.aoforge/objectives/' + info.objectiveDir + '/' + f]);
      assert.ok(r.json, id + ' ' + f + ': printed JSON');
      assert.equal(r.json.valid, true, id + ' ' + f + ': valid');
      assert.deepEqual(r.json.errors, [], id + ' ' + f + ': no errors');
      if (id === 'B4' && f.startsWith('02-02-')) continue;
      assert.deepEqual(r.json.warnings, [], id + ' ' + f + ': no warnings');
    }
  }
  const r = aof('B4', ['verify', 'job-structure', '.aoforge/objectives/02-batch-conversion/02-02-batch-formatter-TRD.md']);
  assert.deepEqual(r.json.warnings, ["Task 'Task 1: Formatter' missing <verify>"], 'B4 02-02 warns that its first task lacks verify');
});

// ─── 4. verify trd-pre: what code already catches ────────────────────────────────────────────────────────────────

test('verify trd-pre 2: B1, B2, B3, B5 and B6 report no blocker; B4 lists 02-02 as incomplete', () => {
  for (const id of ['B1', 'B2', 'B3', 'B5', 'B6']) {
    const c = PRE[id].checks;
    assert.equal(PRE[id].passed, true, id + ': pre-check passes');
    assert.deepEqual(c.requirement_coverage.missing, [], id + ': requirement_coverage.missing');
    assert.deepEqual(c.task_completeness.incomplete, [], id + ': task_completeness.incomplete');
    assert.deepEqual(c.dependency_correctness.cycles, [], id + ': dependency_correctness.cycles');
    assert.deepEqual(c.dependency_correctness.orphan_refs, [], id + ': dependency_correctness.orphan_refs');
  }
  const b4 = PRE.B4.checks;
  assert.equal(PRE.B4.passed, false);
  assert.deepEqual(b4.task_completeness.incomplete, [{ trd: '02-02', task: 'Task 1: Formatter', missing: ['verify'] }]);
  assert.deepEqual(b4.requirement_coverage.missing, []);
  assert.deepEqual(b4.dependency_correctness.cycles, []);
  assert.deepEqual(b4.dependency_correctness.orphan_refs, []);
});

test('verify trd-pre 2 raises no scope or budget finding on any set, so a mutation changes nothing but its own dimension', () => {
  for (const id of FIXTURES) {
    const c = PRE[id].checks;
    assert.equal(c.scope_sanity.passed, true, id + ': scope_sanity');
    assert.deepEqual(c.scope_sanity.warning_trds, [], id + ': no TRD over the task warning threshold');
    assert.equal(c.trd_budget.passed, true, id + ': trd_budget');
    assert.deepEqual(c.trd_budget.warn, [], id + ': no TRD over the warn budget');
    assert.deepEqual(
      c.trd_budget.trds.flatMap((t) => t.bulk),
      [],
      id + ': no linked-bulk finding'
    );
    for (const t of Object.values(readTrds(id))) assert.ok(t.bytes < 4096, id + ' ' + t.file + ': under 4 KB (' + t.bytes + ')');
  }
});

test('each set pre-check result equals the answer key, and only B4 is flagged by the pre-check', () => {
  for (const id of FIXTURES) {
    const entry = keyEntry(id);
    assert.deepEqual({ passed: PRE[id].passed, blockers: blockersOf(PRE[id]) }, entry.precheck, id + ': precheck equals the key');
    if (entry.planted) {
      const flagged = blockersOf(PRE[id]).some((b) => entry.planted.trds.some((t) => b.includes(':' + t)));
      assert.equal(entry.planted.precheck_flags, flagged, id + ': precheck_flags equals what the pre-check says about the planted TRDs');
    }
  }
  assert.deepEqual(
    KEY.sets.filter((s) => s.planted && s.planted.precheck_flags).map((s) => s.id),
    ['B4']
  );
});

// ─── 5-8. Each planted flaw is real, and absent from its base ────────────────────────────────────────────────────

test('B3: two wave-1 TRDs with no dependency between them both modify src/cli.js; B1 has no such pair', () => {
  const planted = sameWaveSharedFiles(readTrds('B3'));
  assert.deepEqual(planted, [{ trds: ['02-01', '02-02'], files: ['src/cli.js'] }]);
  const t = readTrds('B3');
  assert.equal(t['02-01'].wave, 1);
  assert.equal(t['02-02'].wave, 1);
  assert.deepEqual(t['02-01'].deps, []);
  assert.deepEqual(t['02-02'].deps, []);
  for (const id of ['02-01', '02-02']) {
    assert.ok(
      t[id].tasks.some((b) => /src\/cli\.js/.test(b) && /EXPORTERS/.test(b)),
      'B3 ' + id + ' has a task that edits src/cli.js'
    );
  }
  assert.deepEqual(sameWaveSharedFiles(readTrds('B1')), []);
  assert.deepEqual(sameWaveSharedFiles(readTrds('B2')), []);
  assert.deepEqual(sameWaveSharedFiles(readTrds('B6')), []);
});

test('B4: exactly one task element in 02-02 lacks a verify element; B2 has none', () => {
  assert.deepEqual(tasksWithoutVerify(readTrds('B4')), [['02-02', 0]]);
  assert.deepEqual(tasksWithoutVerify(readTrds('B2')), []);
  for (const id of ['B1', 'B3', 'B5', 'B6']) assert.deepEqual(tasksWithoutVerify(readTrds(id)), [], id + ': every task has verify');
});

test('B5: 02-02 depends on a later-wave TRD without forming a cycle; B2 has no such dependency', () => {
  const t = readTrds('B5');
  assert.deepEqual(t['02-02'].deps, ['02-04']);
  assert.equal(t['02-02'].wave, 1);
  assert.equal(t['02-04'].wave, 2);
  assert.deepEqual(t['02-04'].deps, ['02-01'], '02-04 depends only on 02-01');
  assert.deepEqual(laterWaveDeps(t), [['02-02', '02-04']]);
  assert.equal(hasCycle(t), false, 'no cycle');
  assert.deepEqual(orphanRefs(t), [], 'no orphan reference');
  const base = readTrds('B2');
  assert.deepEqual(base['02-02'].deps, []);
  assert.deepEqual(laterWaveDeps(base), []);
  assert.equal(hasCycle(base), false);
});

test('B6: no TRD mentions "unknown format" in a task or a must_haves truth while the ROADMAP still lists it; B1 02-03 does', () => {
  const planted = readTrds('B6');
  for (const [id, t] of Object.entries(planted)) assert.equal(mentionsUnknownFormat(t), false, 'B6 ' + id + ' does not mention it');
  assert.match(roadmapObjective2('B6'), /unknown format/i, 'B6 ROADMAP success criterion 3 is still listed');
  const base = readTrds('B1');
  assert.equal(mentionsUnknownFormat(base['02-03']), true, 'B1 02-03 handles it');
  assert.ok(base['02-03'].tasks.some((b) => /<verify>[^<]*unknown format/i.test(b)), 'B1 02-03 verifies it');
  assert.ok(base['02-03'].truths.some((s) => /unknown format/i.test(s)), 'B1 02-03 has a must_haves truth for it');
  assert.match(roadmapObjective2('B1'), /unknown format/i);
});

test('the clean sets are internally consistent: waves follow dependencies, every requirement and success criterion is covered', () => {
  for (const id of ['B1', 'B2']) {
    const t = readTrds(id);
    for (const [tid, trd] of Object.entries(t)) {
      const expectedWave = trd.deps.length === 0 ? 1 : 1 + Math.max(...trd.deps.map((d) => t[d].wave));
      assert.equal(trd.wave, expectedWave, id + ' ' + tid + ': wave = 1 + max(dependency waves)');
      assert.equal(trd.tasks.length, 2, id + ' ' + tid + ': two tasks');
    }
    assert.deepEqual(laterWaveDeps(t), []);
    assert.deepEqual(orphanRefs(t), []);
    assert.equal(hasCycle(t), false);
    assert.deepEqual(sameWaveSharedFiles(t), []);
    const covered = new Set(Object.values(t).flatMap((x) => x.requirements));
    for (const req of describeFixture(id).requirementIds) assert.ok(covered.has(req), id + ': ' + req + ' is covered by a TRD');
  }
  // Each ROADMAP success criterion has a TRD must_haves truth that speaks to it.
  const criteria = {
    B1: [/header row/i, /JSON array/i, /unknown format/i],
    B2: [/one Kelvin value per input line/i, /skips blank lines/i, /line number/i],
  };
  for (const [id, tokens] of Object.entries(criteria)) {
    const truths = Object.values(readTrds(id)).flatMap((x) => x.truths);
    for (const re of tokens) assert.ok(truths.some((s) => re.test(s)), id + ': a truth covers ' + re);
  }
});

// ─── 9. A planted set differs from its base only in the declared TRD files ───────────────────────────────────────

test('each planted set differs from its base only in the TRD files the spec names', () => {
  const expected = {
    B3: ['02-01-csv-renderer-TRD.md', '02-02-json-renderer-TRD.md'],
    B4: ['02-02-batch-formatter-TRD.md'],
    B5: ['02-02-batch-formatter-TRD.md'],
    B6: ['02-03-export-command-TRD.md'],
  };
  for (const [id, files] of Object.entries(expected)) {
    const info = describeFixture(id);
    const planted = snapshot(BUILT[id].dir);
    const base = snapshot(BUILT[info.base].dir);
    assert.deepEqual(Object.keys(planted).sort(), Object.keys(base).sort(), id + ': same set of files');
    const changed = Object.keys(planted).filter((p) => planted[p] !== base[p]).sort();
    const prefix = '.aoforge/objectives/' + info.objectiveDir + '/';
    assert.deepEqual(changed, files.map((f) => prefix + f), id + ': only the named TRD files changed');
    assert.deepEqual(changed, info.changedFiles.slice().sort(), id + ': describeFixture agrees');
    // The first five commits are shared byte for byte; only the planning commit of objective 2 differs.
    assert.equal(gitOut(BUILT[id].dir, ['rev-parse', 'HEAD~1']), gitOut(BUILT[info.base].dir, ['rev-parse', 'HEAD~1']), id + ': history before the last commit is identical');
    assert.notEqual(BUILT[id].head, BUILT[info.base].head);
  }
});

// ─── 10. Nothing reveals the plant ───────────────────────────────────────────────────────────────────────────────

test('no materialised file, path or commit contains a revealing word or a set id', () => {
  const words = ['planted', 'defect', 'broken', 'clean', 'fixture', 'eval', 'overlap', 'missing', 'stub', 'seeded', 'mutation', 'answer key'];
  const hit = (s) => words.find((w) => s.toLowerCase().includes(w)) || (/\bB[1-6]\b/.test(s) ? 'set id' : null);
  for (const id of FIXTURES) {
    for (const [rel, content] of Object.entries(snapshot(BUILT[id].dir))) {
      assert.equal(hit(rel), null, id + ': path ' + rel);
      assert.equal(hit(content), null, id + ': content of ' + rel + ' contains "' + hit(content) + '"');
    }
    const history = gitOut(BUILT[id].dir, ['log', '--format=%an%n%ae%n%cn%n%ce%n%s%n%b']);
    assert.equal(hit(history), null, id + ': commit metadata');
    const tracked = gitOut(BUILT[id].dir, ['ls-files']);
    assert.equal(hit(tracked), null, id + ': tracked paths');
  }
});

// ─── 11. The answer key ──────────────────────────────────────────────────────────────────────────────────────────

test('answer-key.json has six sets: B1 and B2 PASSED with no plant, B3-B6 ISSUES with the spec tokens', () => {
  assert.equal(KEY.batch, 'B');
  assert.equal(KEY.objective, '2');
  assert.deepEqual(KEY.sets.map((s) => s.id), FIXTURES);
  for (const id of ['B1', 'B2']) {
    const s = keyEntry(id);
    assert.equal(s.base, null);
    assert.equal(s.expected, 'PASSED');
    assert.equal(s.planted, null);
  }
  const spec = {
    B3: {
      base: 'B1',
      kind: 'same_wave_overlap',
      trds: ['02-01', '02-02'],
      must_mention: ['cli.js'],
      any_of: ['overlap', 'conflict', 'same wave', 'parallel', 'both modify', 'concurrent', 'same file'],
    },
    B4: { base: 'B2', kind: 'missing_verify', trds: ['02-02'], must_mention: ['02-02'], any_of: ['verify', 'verification'] },
    B5: { base: 'B2', kind: 'later_wave_dependency', trds: ['02-02', '02-04'], must_mention: ['02-04'], any_of: ['wave', 'depend', 'later', 'order', 'before'] },
    B6: {
      base: 'B1',
      kind: 'uncovered_success_criterion',
      trds: ['02-03'],
      must_mention: [],
      any_of: ['unknown format', 'unsupported format', 'invalid format', 'exit 2', 'exit code 2', 'criterion 3', 'sc-3', 'sc 3', 'sc3'],
    },
  };
  for (const [id, want] of Object.entries(spec)) {
    const s = keyEntry(id);
    assert.equal(s.base, want.base, id + ': base');
    assert.equal(s.expected, 'ISSUES', id + ': expected');
    assert.equal(s.planted.kind, want.kind, id + ': kind');
    assert.deepEqual(s.planted.trds, want.trds, id + ': trds');
    assert.deepEqual(s.planted.must_mention, want.must_mention, id + ': must_mention');
    assert.deepEqual(s.planted.any_of, want.any_of, id + ': any_of');
    assert.equal(typeof s.planted.dimension_hint, 'string', id + ': dimension_hint');
    assert.equal(typeof s.planted.precheck_flags, 'boolean', id + ': precheck_flags');
    const info = describeFixture(id);
    assert.equal(info.base, s.base, id + ': builder and key agree on the base');
    assert.equal(info.planted.kind, s.planted.kind, id + ': builder and key agree on the kind');
    assert.deepEqual(info.planted.trds, s.planted.trds, id + ': builder and key agree on the TRDs');
  }
  for (const s of KEY.sets) {
    assert.equal(typeof s.precheck.passed, 'boolean');
    assert.ok(Array.isArray(s.precheck.blockers));
    assert.ok(Array.isArray(s.health_warnings));
  }
});
