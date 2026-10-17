'use strict';

// Tests for the test C batch module (TRD 81-11): 32 codebase-mapper runs, 16 project-researcher runs, the blind
// Sonnet grader runs listed once outputs exist, the hash-checked private fleet checklist, materialize and collect.
//
// Every fixture is a temp directory under os.tmpdir(); the fleet is a made-up temp repository (fakeFleet), never
// the real fleet source, and nothing here reads or writes a home directory. Run with a glob on Node 24:
//   node --test 'scripts/eval81/batches/C.test.cjs'

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const C = require('./C.cjs');
const fx = require('../__fixtures__/c-outputs.cjs');
const { validateDescriptor } = require('../lib/contract.cjs');
const { capFor } = require('../lib/caps.cjs');
const synthetic = require('../fixtures/C/synthetic.cjs');
const { LEGACY } = require('../../../plugins/aoforge/aoforge/bin/lib/legacy-names.cjs');

const FIXTURES_C = path.join(__dirname, '..', 'fixtures', 'C');
const WORKFLOWS = path.join(REPO, 'plugins', 'aoforge', 'aoforge', 'workflows');
const OBJECTIVE_PRIVATE = path.join(REPO, '.aoforge', 'objectives', '81-haiku-eval-and-model-efficiency-measurement', 'private', 'fleet-checklists.json');

const tempDirs = [];
function tempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(d);
  return d;
}
after(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});

const GIT_ENV = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LANG: 'C',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};
function git(dir, args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: GIT_ENV });
}
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** A batch bound to a made-up fleet in a temp dir, and an empty eval root. */
function setup() {
  const base = tempDir('c-batch-');
  const fleet = fx.fakeFleet(path.join(base, 'fleet'));
  const root = path.join(base, 'R');
  fs.mkdirSync(root, { recursive: true });
  const batch = C.makeBatch({ repo: REPO, privateFile: fleet.privateFile, commitmentFile: fleet.commitmentFile });
  return { base, fleet, root, batch };
}

const runsOf = (s, extra = {}) => s.batch.runs({ root: s.root, trees: null, calibration: null, ...extra });
const isAgent = (d) => d.kind === 'agent';
const isGrader = (d) => d.kind === 'prompt';
const findRun = (list, role, codebase, model, repeat) => list.find((d) => isAgent(d) && d.fixture.role === role
  && (codebase === null || d.fixture.codebase === codebase) && d.model === model && d.fixture.repeat === repeat);

// --- Independent extraction of the production prompts (test 3) ---------------------------------------------------

function mapperBlock(focus) {
  const lines = fs.readFileSync(path.join(WORKFLOWS, 'map-codebase.md'), 'utf8').split('\n');
  const start = lines.findIndex((l, i) => l === `Focus: ${focus}` && lines[i - 1] === '```');
  assert.ok(start > 0, `no fenced block for Focus: ${focus}`);
  const end = lines.indexOf('```', start);
  return lines.slice(start, end).join('\n');
}

function researcherTemplate(dimension) {
  const text = fs.readFileSync(path.join(WORKFLOWS, 'new-project.md'), 'utf8');
  const tail = `", subagent_type="project-researcher", model="{researcher_models.${dimension}}"`;
  const end = text.indexOf(tail);
  assert.ok(end > 0, `no project-researcher Task for ${dimension}`);
  const open = 'Task(prompt="';
  const start = text.lastIndexOf(open, end) + open.length;
  return text.slice(start, end);
}

function topicSections() {
  const text = fs.readFileSync(path.join(FIXTURES_C, 'researcher-topic.md'), 'utf8');
  const section = (name) => {
    const m = text.match(new RegExp(`^## ${name}\\n+([\\s\\S]*?)(?=\\n## |$)`, 'm'));
    assert.ok(m, `topic section ${name}`);
    return m[1].trim();
  };
  return { domain: section('Domain'), title: section('Project title'), summary: section('Project summary') };
}

describe('batch C: runs()', () => {
  test('1. with no outputs, runs() lists 48 valid agent descriptors, mapper before researcher', () => {
    const s = setup();
    const all = runsOf(s);
    assert.equal(all.length, 48);
    for (const d of all) assert.deepEqual(validateDescriptor(d), { ok: true, errors: [] }, d.id);
    assert.equal(new Set(all.map((d) => d.id)).size, 48);
    assert.ok(all.every((d) => d.batch === 'C' && d.kind === 'agent' && d.plugin === '3.1.0' && d.jsonSchema === null));
    assert.ok(all.every((d) => ['haiku', 'sonnet'].includes(d.model)));

    const mappers = all.filter((d) => d.agent === 'aoforge:codebase-mapper');
    const researchers = all.filter((d) => d.agent === 'aoforge:project-researcher');
    assert.equal(mappers.length, 32);
    assert.equal(researchers.length, 16);
    assert.equal(mappers.filter((d) => d.fixture.codebase === 'synthetic').length, 16);
    assert.equal(mappers.filter((d) => d.fixture.codebase === 'fleet').length, 16);
    assert.deepEqual(all.map((d) => d.order), [...Array(48).keys()]);
    assert.ok(Math.max(...mappers.map((d) => d.order)) < Math.min(...researchers.map((d) => d.order)));

    // 4 foci x 2 codebases x 2 models x 2 repeats; 4 dimensions x 2 models x 2 repeats.
    for (const focus of ['tech', 'arch', 'quality', 'concerns']) {
      for (const codebase of ['synthetic', 'fleet']) {
        for (const model of ['haiku', 'sonnet']) {
          for (const repeat of [1, 2]) {
            assert.ok(findRun(all, `codebase-mapper:${focus}`, codebase, model, repeat), `${focus} ${codebase} ${model} ${repeat}`);
          }
        }
      }
    }
    for (const dim of ['stack', 'features', 'architecture', 'pitfalls']) {
      for (const model of ['haiku', 'sonnet']) {
        for (const repeat of [1, 2]) assert.ok(findRun(all, `project-researcher:${dim}`, null, model, repeat), `${dim} ${model} ${repeat}`);
      }
    }
  });

  test('1b. caps, bases, env, timeouts and ledger role per descriptor', () => {
    const { batch, root } = setup();
    const all = batch.runs({ root, trees: null, calibration: null });
    for (const d of all) {
      const role = d.agent === 'aoforge:codebase-mapper' ? 'codebase-mapper' : 'project-researcher';
      const cap = capFor({ role, model: d.model, batch: 'C', calibration: null });
      assert.equal(d.capUsd, cap.cap, d.id);
      assert.equal(d.capBasis, cap.basis, d.id);
      assert.equal(d.role, role, d.id);
      assert.deepEqual(d.env, {
        AOFORGE_SKIP_EDIT_GATE: '1',
        AOFORGE_SKIP_AWARENESS_POPULATE: '1',
        AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
        AOFORGE_SKIP_PRUNE: '1',
      });
      assert.equal(d.timeoutMs, role === 'codebase-mapper' ? 20 * 60 * 1000 : 25 * 60 * 1000, d.id);
      assert.equal(d.tools, null);
    }
  });

  test('1c. models alternate inside each pair, and the list is deterministic', () => {
    const s = setup();
    const a = runsOf(s);
    assert.deepEqual(a, runsOf(s));
    for (let i = 0; i < 48; i += 2) {
      assert.equal(a[i].fixture.role, a[i + 1].fixture.role);
      assert.equal(a[i].fixture.codebase, a[i + 1].fixture.codebase);
      assert.equal(a[i].fixture.repeat, a[i + 1].fixture.repeat);
      assert.notEqual(a[i].model, a[i + 1].model, `pair at ${i}`);
    }
  });

  test('1d. ids do not reveal the fixture or the model; the fleet source never enters a descriptor', () => {
    const s = setup();
    const all = runsOf(s);
    for (const d of all) assert.ok(!/synthetic|fleet|haiku|sonnet|opus/i.test(d.id), d.id);
    assert.ok(!JSON.stringify(all).includes(s.fleet.sourceDir));
    assert.ok(!JSON.stringify(all).includes('fleet-checklists'));
  });

  test('2. with outputs for 3 agent runs, runs() adds exactly 3 blind grader descriptors', () => {
    const s = setup();
    const agents = runsOf(s);
    const m1 = findRun(agents, 'codebase-mapper:tech', 'synthetic', 'haiku', 1);
    const m2 = findRun(agents, 'codebase-mapper:quality', 'fleet', 'sonnet', 1);
    const r1 = findRun(agents, 'project-researcher:stack', null, 'haiku', 1);
    // No grader for: a capped run, a run with no document, a run whose model did not run as requested.
    const capped = findRun(agents, 'codebase-mapper:arch', 'synthetic', 'haiku', 1);
    const empty = findRun(agents, 'codebase-mapper:arch', 'synthetic', 'sonnet', 1);
    const wrongModel = findRun(agents, 'codebase-mapper:concerns', 'synthetic', 'haiku', 1);
    fx.cRoot(s.root, [
      { id: m1.id, kind: 'mapper', model: 'haiku', focus: 'tech', codebase: 'synthetic', docs: { 'STACK.md': fx.SYNTHETIC_STACK, 'INTEGRATIONS.md': fx.SYNTHETIC_INTEGRATIONS } },
      { id: m2.id, kind: 'mapper', model: 'sonnet', focus: 'quality', codebase: 'fleet', docs: { 'CONVENTIONS.md': fx.fakeFleetDocument('quality') } },
      { id: r1.id, kind: 'researcher', model: 'haiku', dimension: 'stack', codebase: 'greenfield', docs: { 'STACK.md': fx.RESEARCH_STACK }, location: 'published' },
      { id: capped.id, kind: 'mapper', model: 'haiku', focus: 'arch', codebase: 'synthetic', docs: { 'ARCHITECTURE.md': '# a\n' }, status: 'cap_hit' },
      { id: empty.id, kind: 'mapper', model: 'sonnet', focus: 'arch', codebase: 'synthetic', docs: {} },
      { id: wrongModel.id, kind: 'mapper', model: 'haiku', focus: 'concerns', codebase: 'synthetic', docs: { 'CONCERNS.md': '# c\n' }, model_ran: false },
    ]);

    const all = runsOf(s);
    assert.equal(all.length, 51);
    assert.deepEqual(all.filter(isAgent), agents);
    const graders = all.filter(isGrader);
    assert.equal(graders.length, 3);
    assert.deepEqual(graders.map((g) => g.id).sort(), [m1.id, m2.id, r1.id].map((id) => `C-grade-${id}`).sort());

    const template = fs.readFileSync(path.join(FIXTURES_C, 'grader-prompt.md'), 'utf8');
    const schema = readJson(path.join(FIXTURES_C, 'grader-schema.json'));
    const synthTech = readJson(path.join(FIXTURES_C, 'checklists-synthetic.json')).checklists.tech;
    const researchStack = readJson(path.join(FIXTURES_C, 'checklists-researcher.json')).checklists.stack;
    const strip = (items) => items.map((i) => {
      const out = { id: i.id, statement: i.statement, accept_any: i.accept_any };
      if (i.evidence !== undefined) out.evidence = i.evidence;
      if (i.basis !== undefined) out.basis = i.basis;
      return out;
    });
    const cases = [
      { id: m1.id, items: strip(synthTech), doc: fx.joinDocuments(['STACK.md', 'INTEGRATIONS.md'], { 'STACK.md': fx.SYNTHETIC_STACK, 'INTEGRATIONS.md': fx.SYNTHETIC_INTEGRATIONS }) },
      { id: m2.id, items: strip(s.fleet.checklists.quality), doc: fx.joinDocuments(['CONVENTIONS.md'], { 'CONVENTIONS.md': fx.fakeFleetDocument('quality') }) },
      { id: r1.id, items: strip(researchStack), doc: fx.joinDocuments(['STACK.md'], { 'STACK.md': fx.RESEARCH_STACK }) },
    ];
    for (const c of cases) {
      const g = graders.find((x) => x.id === `C-grade-${c.id}`);
      assert.deepEqual(validateDescriptor(g), { ok: true, errors: [] }, g.id);
      assert.equal(g.model, 'sonnet');
      assert.equal(g.kind, 'prompt');
      assert.equal(g.agent, null);
      assert.equal(g.plugin, null);
      assert.deepEqual(g.tools, []);
      assert.deepEqual(g.jsonSchema, schema);
      assert.equal(g.role, 'grader');
      assert.equal(g.timeoutMs, 5 * 60 * 1000);
      assert.equal(g.capUsd, capFor({ role: 'grader', model: 'sonnet', batch: 'C', calibration: null }).cap);
      assert.equal(g.fixture.of, c.id);
      assert.ok(g.order >= 48);
      assert.ok(!('AOFORGE_SKIP_EDIT_GATE' in g.env));

      // The prompt is grader-prompt.md with the three placeholders filled, nothing else touched.
      const task = g.prompt.match(/<task>\n([\s\S]*?)\n<\/task>/)[1];
      const expected = template.replace(/\{\{(TASK|CHECKLIST|DOCUMENT)\}\}/g, (_, name) => ({
        TASK: task,
        CHECKLIST: JSON.stringify(c.items, null, 2),
        DOCUMENT: c.doc,
      })[name]);
      assert.equal(g.prompt, expected, g.id);
      assert.ok(task.length > 20 && task.length < 600);
      // Blind: no model name, no run id, no grader id.
      assert.ok(!/haiku|sonnet|opus/i.test(g.prompt), g.id);
      assert.ok(!g.prompt.includes(c.id) && !g.prompt.includes(g.id), g.id);
    }
    // The researcher's task line names the topic; the mapper's names the documents.
    const topic = topicSections();
    assert.ok(graders.find((x) => x.fixture.of === r1.id).prompt.includes(topic.domain));
    assert.ok(graders.find((x) => x.fixture.of === m1.id).prompt.includes('STACK.md and INTEGRATIONS.md'));
  });

  test('2c. replacement patterns in a document stay literal; an oversized document is cut with a marker', () => {
    const s = setup();
    const m1 = findRun(runsOf(s), 'codebase-mapper:concerns', 'synthetic', 'sonnet', 1);
    const tricky = '# Concerns\n\ncost is $& per $1 and $$ plus {{TASK}} and {{CHECKLIST}} here\n';
    fx.cRoot(s.root, [{ id: m1.id, kind: 'mapper', model: 'sonnet', focus: 'concerns', codebase: 'synthetic', docs: { 'CONCERNS.md': tricky } }]);
    let grader = runsOf(s).find(isGrader);
    assert.ok(grader.prompt.includes('cost is $& per $1 and $$ plus {{TASK}} and {{CHECKLIST}} here'));
    assert.equal(grader.fixture.document_truncated, false);
    assert.equal(grader.prompt.match(/<task>\n/g).length, 1, 'placeholders inside the document are not filled again');

    fx.cRoot(s.root, [{ id: m1.id, kind: 'mapper', model: 'sonnet', focus: 'concerns', codebase: 'synthetic', docs: { 'CONCERNS.md': `# Concerns\n${'x'.repeat(C.MAX_DOC_CHARS + 500)}\n` } }]);
    grader = runsOf(s).find(isGrader);
    assert.equal(grader.fixture.document_truncated, true);
    assert.ok(grader.prompt.includes(`[document truncated at ${C.MAX_DOC_CHARS} characters]`));
    assert.ok(grader.prompt.length < C.MAX_DOC_CHARS + 20000);
  });

  test('2b. a stray run directory outside the plan gets no grader; a record without outputs is ignored', () => {
    const s = setup();
    const agents = runsOf(s);
    const m1 = findRun(agents, 'codebase-mapper:tech', 'synthetic', 'haiku', 1);
    fx.cRoot(s.root, [
      { id: 'C-stray', kind: 'mapper', model: 'haiku', focus: 'tech', codebase: 'synthetic', docs: { 'STACK.md': fx.SYNTHETIC_STACK } },
      { id: m1.id, kind: 'mapper', model: 'haiku', focus: 'tech', codebase: 'synthetic', docs: { 'STACK.md': fx.SYNTHETIC_STACK }, collected: false },
    ]);
    // A planned run whose record.json is half-written (the runner was killed) is skipped, not fatal.
    const broken = path.join(s.root, 'runs', 'C', agents[3].id);
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, 'record.json'), '{ not json');
    assert.equal(runsOf(s).length, 48);
  });

  test('3. each mapper prompt equals the fenced block of map-codebase.md; each researcher prompt is the new-project template filled from the topic', () => {
    const s = setup();
    const all = runsOf(s);
    for (const focus of ['tech', 'arch', 'quality', 'concerns']) {
      const expected = mapperBlock(focus);
      assert.ok(expected.startsWith(`Focus: ${focus}\n`));
      assert.ok(expected.endsWith('Return confirmation only.'));
      const mine = all.filter((d) => d.fixture.role === `codebase-mapper:${focus}`);
      assert.equal(mine.length, 8);
      for (const d of mine) assert.equal(d.prompt, expected, d.id);
    }
    const topic = topicSections();
    for (const dim of ['stack', 'features', 'architecture', 'pitfalls']) {
      const template = researcherTemplate(dim);
      assert.ok(template.includes('[domain]') && template.includes('[PROJECT.md summary'));
      // Exactly three fills: [domain], the greenfield marker, and the project summary line.
      const expected = template
        .split('[domain]').join(topic.domain)
        .split('[greenfield OR subsequent]').join('greenfield')
        .split("[PROJECT.md summary - core value, constraints, what they're building]").join(topic.summary)
        .split('[PROJECT.md summary]').join(topic.summary)
        .trimEnd();
      const mine = all.filter((d) => d.fixture.role === `project-researcher:${dim}`);
      assert.equal(mine.length, 4);
      for (const d of mine) {
        assert.equal(d.prompt, expected, d.id);
        assert.ok(!d.prompt.includes('[domain]') && !d.prompt.includes('[PROJECT.md summary'));
        assert.ok(d.prompt.includes('[target features]'), 'the unused Subsequent line stays verbatim');
        assert.ok(d.prompt.includes(`planning draft research/${dim.toUpperCase()}.md`));
      }
    }
  });

  test('4. the private checklist hash gates runs(): changed throws, matching proceeds, missing throws unless allowed', () => {
    const base = tempDir('c-batch-hash-');
    const root = path.join(base, 'R');
    fs.mkdirSync(root, { recursive: true });

    const changed = fx.fakeFleet(path.join(base, 'changed'), { mutate: (t) => t.replace('made-up fact', 'edited fact') });
    const bChanged = C.makeBatch({ repo: REPO, privateFile: changed.privateFile, commitmentFile: changed.commitmentFile });
    assert.throws(() => bChanged.runs({ root, trees: null, calibration: null }), /fleet checklist missing or changed since it was committed/);

    const wrongCounts = fx.fakeFleet(path.join(base, 'counts'));
    const commitment = readJson(wrongCounts.commitmentFile);
    commitment.items_per_focus.tech = 4;
    fs.writeFileSync(wrongCounts.commitmentFile, JSON.stringify(commitment));
    const bCounts = C.makeBatch({ repo: REPO, privateFile: wrongCounts.privateFile, commitmentFile: wrongCounts.commitmentFile });
    assert.throws(() => bCounts.runs({ root, trees: null, calibration: null }), /items/);

    const ok = fx.fakeFleet(path.join(base, 'ok'));
    const bOk = C.makeBatch({ repo: REPO, privateFile: ok.privateFile, commitmentFile: ok.commitmentFile });
    assert.equal(bOk.runs({ root, trees: null, calibration: null }).length, 48);
    assert.equal(readJson(path.join(root, 'cache', 'C', 'plan.json')).include_fleet, true);

    const missing = C.makeBatch({ repo: REPO, privateFile: path.join(base, 'nowhere', 'fleet-checklists.json'), commitmentFile: ok.commitmentFile });
    assert.throws(() => missing.runs({ root, trees: null, calibration: null }), /fleet checklist missing or changed since it was committed/);
    assert.throws(() => missing.needsWatchedRepos(root), /./, 'no fleet source can be named without the file');
  });

  test('4b. allowMissingFleet omits fleet runs with a recorded reason, but a changed file still throws', () => {
    const base = tempDir('c-batch-allow-');
    const root = path.join(base, 'R');
    fs.mkdirSync(root, { recursive: true });
    const ok = fx.fakeFleet(path.join(base, 'ok'));
    const missing = C.makeBatch({ repo: REPO, privateFile: path.join(base, 'nowhere.json'), commitmentFile: ok.commitmentFile });
    const reduced = missing.runs({ root, trees: null, calibration: null, allowMissingFleet: true });
    assert.equal(reduced.length, 32);
    assert.ok(reduced.every((d) => d.fixture.codebase !== 'fleet'));
    assert.deepEqual(reduced.map((d) => d.order), [...Array(32).keys()]);
    const plan = readJson(path.join(root, 'cache', 'C', 'plan.json'));
    assert.equal(plan.include_fleet, false);
    assert.match(plan.reduction, /not present/);
    assert.deepEqual(missing.needsWatchedRepos(root).length, 0);

    const changed = fx.fakeFleet(path.join(base, 'changed'), { mutate: (t) => `${t}\n` });
    const bChanged = C.makeBatch({ repo: REPO, privateFile: changed.privateFile, commitmentFile: changed.commitmentFile });
    assert.throws(() => bChanged.runs({ root, trees: null, calibration: null, allowMissingFleet: true }), /changed since it was committed/);
  });

  test('4c. EVAL81_C_SKIP_FLEET=1 omits fleet runs even with a valid private file', () => {
    const s = setup();
    const before = process.env.EVAL81_C_SKIP_FLEET;
    process.env.EVAL81_C_SKIP_FLEET = '1';
    try {
      const reduced = runsOf(s);
      assert.equal(reduced.length, 32);
      assert.ok(reduced.every((d) => d.fixture.codebase !== 'fleet'));
      const plan = readJson(path.join(s.root, 'cache', 'C', 'plan.json'));
      assert.equal(plan.include_fleet, false);
      assert.match(plan.reduction, /EVAL81_C_SKIP_FLEET/);
      assert.deepEqual(s.batch.needsWatchedRepos(s.root), []);
    } finally {
      if (before === undefined) delete process.env.EVAL81_C_SKIP_FLEET;
      else process.env.EVAL81_C_SKIP_FLEET = before;
    }
    assert.equal(runsOf(s).length, 48);
    assert.equal(readJson(path.join(s.root, 'cache', 'C', 'plan.json')).include_fleet, true);
  });

  test('4d. needsWatchedRepos names the fleet source for the runner tripwire', () => {
    const s = setup();
    assert.deepEqual(s.batch.needsWatchedRepos(s.root), [{ label: 'fleet-source', path: s.fleet.sourceDir }]);
  });

  test('1e. the default export lists 48 runs with the real private checklist when this machine has it', (t) => {
    if (!fs.existsSync(OBJECTIVE_PRIVATE)) {
      t.skip('private fleet checklist not present on this machine');
      return;
    }
    const root = tempDir('c-batch-real-');
    const all = C.runs({ root, trees: null, calibration: null, repo: REPO });
    assert.equal(all.length, 48);
    assert.equal(C.batch, 'C');
    assert.ok(!JSON.stringify(all).includes('fleet-checklists'));
  });
});

describe('batch C: materialize()', () => {
  test('5a. synthetic: a copy of the deterministic build, planning tree included', () => {
    const s = setup();
    const desc = findRun(runsOf(s), 'codebase-mapper:tech', 'synthetic', 'haiku', 1);
    const work = path.join(s.root, 'runs', 'C', desc.id, 'work');
    fs.mkdirSync(work, { recursive: true });
    s.batch.materialize(desc, work, { root: s.root, trees: null, home: path.join(s.root, 'home') });

    for (const rel of Object.keys(synthetic.syntheticFiles())) assert.ok(fs.existsSync(path.join(work, rel)), rel);
    const reference = tempDir('c-batch-ref-');
    const built = synthetic.buildSynthetic(path.join(reference, 'b'));
    assert.equal(git(work, ['rev-parse', 'HEAD']).stdout.trim(), built.head);
    assert.equal(git(work, ['status', '--porcelain']).stdout, '');
    assert.ok(fs.existsSync(path.join(s.root, 'cache', 'C', 'synthetic', '.git')));

    // A second run copies the cached build into a fresh directory.
    const work2 = path.join(s.root, 'runs', 'C', 'second', 'work');
    s.batch.materialize(desc, work2, { root: s.root, trees: null, home: path.join(s.root, 'home') });
    assert.equal(git(work2, ['rev-parse', 'HEAD']).stdout.trim(), built.head);
  });

  test('5b. fleet: the source is cloned once, stripped of planning artefacts and copied per run; the source is untouched', () => {
    const s = setup();
    const descs = runsOf(s).filter((d) => d.fixture.codebase === 'fleet');
    const index = path.join(s.fleet.sourceDir, '.git', 'index');
    const before = {
      head: git(s.fleet.sourceDir, ['rev-parse', 'HEAD']).stdout,
      porcelain: git(s.fleet.sourceDir, ['status', '--porcelain']).stdout,
      index: sha256(fs.readFileSync(index)),
    };

    const work = path.join(s.root, 'runs', 'C', descs[0].id, 'work');
    fs.mkdirSync(work, { recursive: true });
    s.batch.materialize(descs[0], work, { root: s.root, trees: null, home: path.join(s.root, 'home') });
    assert.ok(fs.existsSync(path.join(work, 'go.mod')));
    assert.ok(fs.existsSync(path.join(work, 'internal', 'store', 'store.go')));
    assert.ok(!fs.existsSync(path.join(work, LEGACY.planningDir)));
    assert.ok(!fs.existsSync(path.join(work, '.claude')));
    assert.ok(fs.existsSync(path.join(work, '.aoforge', 'PROJECT.md')));
    assert.match(fs.readFileSync(path.join(work, '.aoforge', 'PROJECT.md'), 'utf8'), /kind: api/);
    assert.equal(readJson(path.join(work, '.aoforge', 'config.json')).aoforge.version, '3.1.0');
    assert.ok(fs.existsSync(path.join(work, '.git')));
    assert.equal(git(work, ['remote']).stdout, '', 'origin removed');
    assert.equal(git(work, ['status', '--porcelain']).stdout, '', 'the prepared tree is committed and clean');
    assert.ok(!fs.existsSync(path.join(work, '.git', 'objects', 'info', 'alternates')));

    // The source stayed byte-identical and was never locked.
    assert.equal(git(s.fleet.sourceDir, ['rev-parse', 'HEAD']).stdout, before.head);
    assert.equal(git(s.fleet.sourceDir, ['status', '--porcelain']).stdout, before.porcelain);
    assert.equal(sha256(fs.readFileSync(index)), before.index);
    assert.ok(!fs.existsSync(path.join(s.fleet.sourceDir, '.git', 'index.lock')));
    assert.ok(fs.existsSync(path.join(s.fleet.sourceDir, LEGACY.planningDir, 'NOTES.md')), 'the source still has its planning directory');

    // Prepared once: the second run reuses the cache.
    const marker = path.join(s.root, 'cache', 'C', 'fleet-ready.json');
    const stamp = fs.readFileSync(marker, 'utf8');
    const work2 = path.join(s.root, 'runs', 'C', descs[1].id, 'work');
    s.batch.materialize(descs[1], work2, { root: s.root, trees: null, home: path.join(s.root, 'home') });
    assert.equal(fs.readFileSync(marker, 'utf8'), stamp);
    assert.equal(git(work2, ['rev-parse', 'HEAD']).stdout, git(work, ['rev-parse', 'HEAD']).stdout);
    const again = s.batch.prepareFleet(s.root, readJson(s.fleet.privateFile));
    assert.equal(again.reused, true);
  });

  test('5c. researcher: a greenfield project holding only the planning tree built from the topic', () => {
    const s = setup();
    const desc = findRun(runsOf(s), 'project-researcher:stack', null, 'haiku', 1);
    const work = path.join(s.root, 'runs', 'C', desc.id, 'work');
    fs.mkdirSync(work, { recursive: true });
    s.batch.materialize(desc, work, { root: s.root, trees: null, home: path.join(s.root, 'home') });
    const topic = topicSections();
    assert.deepEqual(fs.readdirSync(work).sort(), ['.aoforge']);
    assert.deepEqual(fs.readdirSync(path.join(work, '.aoforge')).sort(), ['PROJECT.md', 'config.json']);
    const project = fs.readFileSync(path.join(work, '.aoforge', 'PROJECT.md'), 'utf8');
    assert.ok(project.includes(`# ${topic.title}`));
    assert.ok(project.includes(topic.summary));
    assert.match(project, /kind: api/);
    assert.equal(readJson(path.join(work, '.aoforge', 'config.json')).aoforge.version, '3.1.0');
  });

  test('5d. grader runs get an empty work directory', () => {
    const s = setup();
    const agents = runsOf(s);
    const m1 = findRun(agents, 'codebase-mapper:tech', 'synthetic', 'haiku', 1);
    fx.cRoot(s.root, [{ id: m1.id, kind: 'mapper', model: 'haiku', focus: 'tech', codebase: 'synthetic', docs: { 'STACK.md': fx.SYNTHETIC_STACK } }]);
    const grader = runsOf(s).find(isGrader);
    const work = path.join(s.root, 'runs', 'C', grader.id, 'work');
    s.batch.materialize(grader, work, { root: s.root, trees: null, home: path.join(s.root, 'home') });
    assert.deepEqual(fs.readdirSync(work), []);
  });
});

describe('batch C: collect()', () => {
  function descFor(s, role, codebase = null, model = 'haiku') {
    return findRun(runsOf(s), role, codebase, model, 1);
  }
  const workOf = (s, d) => path.join(s.root, 'runs', 'C', d.id, 'work');

  test('6a. mapper drafts are concatenated per focus in the fixed document order', () => {
    const s = setup();
    const d = descFor(s, 'codebase-mapper:tech', 'synthetic');
    // Written in the reverse of the fixed order on purpose.
    fx.cRoot(s.root, [{ id: d.id, kind: 'mapper', model: 'haiku', focus: 'tech', codebase: 'synthetic', collected: false, returnText: '## Mapping Complete',
      docs: { 'INTEGRATIONS.md': fx.SYNTHETIC_INTEGRATIONS, 'STACK.md': fx.SYNTHETIC_STACK } }]);
    const out = s.batch.collect(d, workOf(s, d), { root: s.root, home: path.join(s.root, 'runs', 'C', d.id, 'home'), record: { result_text: '## Mapping Complete' } });
    assert.deepEqual(out, fx.agentOutputs({ kind: 'mapper', focus: 'tech', codebase: 'synthetic', location: 'drafts', returnText: '## Mapping Complete',
      docs: { 'STACK.md': fx.SYNTHETIC_STACK, 'INTEGRATIONS.md': fx.SYNTHETIC_INTEGRATIONS } }));
    assert.ok(out.document.indexOf('===== STACK.md =====') < out.document.indexOf('===== INTEGRATIONS.md ====='));
    assert.equal(out.location, 'drafts');
    assert.deepEqual(out.missing_documents, []);
  });

  test('6b. published documents are read when there is no draft; drafts win when both exist; the location is recorded', () => {
    const s = setup();
    const d = descFor(s, 'codebase-mapper:tech', 'synthetic');
    fx.cRoot(s.root, [{ id: d.id, kind: 'mapper', model: 'haiku', focus: 'tech', codebase: 'synthetic', collected: false, location: 'published',
      docs: { 'STACK.md': fx.SYNTHETIC_STACK } }]);
    const run = path.join(s.root, 'runs', 'C', d.id);
    let out = s.batch.collect(d, workOf(s, d), { root: s.root, home: path.join(run, 'home'), record: {} });
    assert.equal(out.location, 'published');
    assert.deepEqual(out.documents, { 'STACK.md': { location: 'published', chars: fx.SYNTHETIC_STACK.length } });
    assert.deepEqual(out.missing_documents, ['INTEGRATIONS.md']);

    // INTEGRATIONS.md as a draft, STACK.md both places: the draft text wins, the location is mixed.
    const drafts = path.join(run, 'tmp', 'aoforge-drafts', 'repo-key', 'codebase');
    fs.mkdirSync(drafts, { recursive: true });
    fs.writeFileSync(path.join(drafts, 'INTEGRATIONS.md'), fx.SYNTHETIC_INTEGRATIONS);
    fs.writeFileSync(path.join(drafts, 'STACK.md'), '# Draft stack\nGo 1.23\n');
    out = s.batch.collect(d, workOf(s, d), { root: s.root, home: path.join(run, 'home'), record: {} });
    assert.equal(out.location, 'drafts');
    assert.ok(out.document.includes('# Draft stack'));
    assert.ok(!out.document.includes('# Technology Stack'));

    // Only the published copy of INTEGRATIONS.md remains: one draft, one published.
    fs.rmSync(path.join(drafts, 'INTEGRATIONS.md'));
    fs.mkdirSync(path.join(run, 'work', '.aoforge', 'codebase'), { recursive: true });
    fs.writeFileSync(path.join(run, 'work', '.aoforge', 'codebase', 'INTEGRATIONS.md'), fx.SYNTHETIC_INTEGRATIONS);
    out = s.batch.collect(d, workOf(s, d), { root: s.root, home: path.join(run, 'home'), record: {} });
    assert.equal(out.location, 'mixed');
    assert.equal(out.documents['STACK.md'].location, 'drafts');
    assert.equal(out.documents['INTEGRATIONS.md'].location, 'published');
  });

  test('6c. a mapper that wrote nothing yields an empty document and location none', () => {
    const s = setup();
    const d = descFor(s, 'codebase-mapper:concerns', 'fleet');
    fx.cRoot(s.root, [{ id: d.id, kind: 'mapper', model: 'haiku', focus: 'concerns', codebase: 'fleet', collected: false, docs: {} }]);
    const out = s.batch.collect(d, workOf(s, d), { root: s.root, home: path.join(s.root, 'h'), record: {} });
    assert.equal(out.document, '');
    assert.equal(out.location, 'none');
    assert.deepEqual(out.missing_documents, ['CONCERNS.md']);
    assert.deepEqual(out.documents, {});
  });

  test('6d. researcher: .aoforge/research/<DIM>.md first, the draft as a fallback', () => {
    const s = setup();
    const d = descFor(s, 'project-researcher:pitfalls');
    fx.cRoot(s.root, [{ id: d.id, kind: 'researcher', model: 'haiku', dimension: 'pitfalls', codebase: 'greenfield', collected: false, location: 'published',
      docs: { 'PITFALLS.md': fx.RESEARCH_PITFALLS } }]);
    const run = path.join(s.root, 'runs', 'C', d.id);
    let out = s.batch.collect(d, workOf(s, d), { root: s.root, home: path.join(run, 'home'), record: {} });
    assert.deepEqual(out, fx.agentOutputs({ kind: 'researcher', dimension: 'pitfalls', codebase: 'greenfield', location: 'published', docs: { 'PITFALLS.md': fx.RESEARCH_PITFALLS } }));

    fs.rmSync(path.join(run, 'work', '.aoforge', 'research', 'PITFALLS.md'));
    const drafts = path.join(run, 'tmp', 'aoforge-drafts', 'k', 'research');
    fs.mkdirSync(drafts, { recursive: true });
    fs.writeFileSync(path.join(drafts, 'PITFALLS.md'), fx.RESEARCH_PITFALLS);
    out = s.batch.collect(d, workOf(s, d), { root: s.root, home: path.join(run, 'home'), record: {} });
    assert.equal(out.location, 'drafts');
    assert.ok(out.document.includes('database is locked'));
  });

  test('6e. grader: structured_output, a JSON result_text (fenced or bare), or nothing', () => {
    const s = setup();
    const d = { id: 'C-grade-x', fixture: { kind: 'grader' }, batch: 'C' };
    const graded = fx.RESEARCH_STACK_GRADE;
    const work = path.join(s.root, 'w');
    const call = (record) => s.batch.collect(d, work, { root: s.root, home: path.join(s.root, 'h'), record });
    assert.deepEqual(call({ structured_output: graded }), fx.graderOutputs(graded, 'structured_output'));
    assert.deepEqual(call({ structured_output: null, result_text: JSON.stringify(graded) }), fx.graderOutputs(graded, 'result_text'));
    assert.deepEqual(call({ result_text: `\`\`\`json\n${JSON.stringify(graded)}\n\`\`\`` }), fx.graderOutputs(graded, 'result_text'));
    assert.deepEqual(call({ result_text: 'I could not grade this.' }), fx.graderOutputs(null));
    assert.deepEqual(call({ structured_output: { items: 'nope' }, result_text: null }), fx.graderOutputs(null));
    assert.deepEqual(call({}), fx.graderOutputs(null));
  });
});
