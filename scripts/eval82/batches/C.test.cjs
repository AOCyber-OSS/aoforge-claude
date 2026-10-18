'use strict';
// TRD 82-06 test list 3-5: objective 82's batch C, the project-researcher (architecture and pitfalls) at haiku and
// sonnet on two new topics, 2 repeats, with a Sonnet grader run for each finished researcher run. The prompt comes
// from the new-project.md of the tree under test (a hand-built fixture tree here). No network, no claude binary,
// no ~/.claude.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const C82 = require('./C.cjs');
const C81 = require('../../eval81/batches/C.cjs');
const { validateDescriptor } = require('../../eval81/lib/contract.cjs');
const { runRecord } = require('../__fixtures__/records.cjs');

const dirs = [];
const tmp = (prefix = 'e82-batchC-') => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
};
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

const C81_FIXTURES = path.join(__dirname, '..', '..', 'eval81', 'fixtures', 'C');
const CHECKLISTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'C', 'checklists-82.json'), 'utf8'));
const GRADER_SCHEMA = JSON.parse(fs.readFileSync(path.join(C81_FIXTURES, 'grader-schema.json'), 'utf8'));
const GRADER_TEMPLATE = fs.readFileSync(path.join(C81_FIXTURES, 'grader-prompt.md'), 'utf8');

// A minimal new-project.md: the architecture Task carries 82-11's runtime line and two more `{runtime_root}` paths
// (82-11's `Use template: {runtime_root}/...` among them), the pitfalls Task carries none (the shape before 82-11).
const ARCH_TASK = [
  'Task(prompt="<research_type>',
  'Project Research — Architecture dimension for [domain].',
  '</research_type>',
  '',
  'AOForge runtime: {runtime_root}',
  '',
  '<milestone_context>',
  '[greenfield OR subsequent]',
  '',
  'Greenfield: How are [domain] systems typically structured?',
  '</milestone_context>',
  '',
  '<project_context>',
  '[PROJECT.md summary]',
  '</project_context>',
  '',
  '<output>',
  'Draft path: `node {runtime_root}/bin/aof-tools.cjs planning draft research/ARCHITECTURE.md`',
  'Use template: {runtime_root}/templates/research-project/ARCHITECTURE.md',
  '</output>',
  '", subagent_type="project-researcher", model="{researcher_models.architecture}", description="Architecture research")',
].join('\n');
const PITFALLS_TASK = [
  'Task(prompt="<research_type>',
  'Project Research — Pitfalls dimension for [domain].',
  '</research_type>',
  '',
  '<milestone_context>',
  '[greenfield OR subsequent]',
  '</milestone_context>',
  '',
  '<project_context>',
  '[PROJECT.md summary]',
  '</project_context>',
  '", subagent_type="project-researcher", model="{researcher_models.pitfalls}", description="Pitfalls research")',
].join('\n');
const NEW_PROJECT = `# new-project (fixture)\n\n\`\`\`\n${ARCH_TASK}\n\n${PITFALLS_TASK}\n\`\`\`\n`;

function fixtureTree(text = NEW_PROJECT) {
  const tree = tmp('e82-tree-');
  const file = path.join(tree, 'plugins', 'aoforge', 'aoforge', 'workflows', 'new-project.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return { '3.1.0': { ref: 'HEAD', sha: '0'.repeat(40), path: tree } };
}

function sandboxWithTrees() {
  const s = tmp('e82-sbx-');
  fs.writeFileSync(path.join(s, 'trees.json'), '{}\n');
  return s;
}

const GATEWAY = {
  domain: 'An LLM gateway service, written in Go, that sits between internal applications and several hosted model providers',
  title: 'modelgate',
};
const HUB = {
  domain: 'A macOS desktop application, written in Flutter, that controls a local developer-platform daemon',
  title: 'devhub',
};

const EXPECTED_IDS = [
  'C82-res-gateway-architecture-s-1', 'C82-res-gateway-architecture-h-1',
  'C82-res-gateway-pitfalls-h-1', 'C82-res-gateway-pitfalls-s-1',
  'C82-res-hub-architecture-s-1', 'C82-res-hub-architecture-h-1',
  'C82-res-hub-pitfalls-h-1', 'C82-res-hub-pitfalls-s-1',
  'C82-res-gateway-architecture-h-2', 'C82-res-gateway-architecture-s-2',
  'C82-res-gateway-pitfalls-s-2', 'C82-res-gateway-pitfalls-h-2',
  'C82-res-hub-architecture-h-2', 'C82-res-hub-architecture-s-2',
  'C82-res-hub-pitfalls-s-2', 'C82-res-hub-pitfalls-h-2',
];

const writeRecord = (root, id, record) => {
  const dir = path.join(root, 'runs', 'C', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);
};

test('3a: 16 researcher runs, repeat 1 before repeat 2, models alternating within a pair, caps and env as the TRD says', () => {
  const root = tmp();
  const list = C82.runs({ root, trees: fixtureTree(), env: {} });
  assert.equal(C82.batch, 'C');
  assert.deepEqual(list.map((d) => d.id), EXPECTED_IDS);
  assert.deepEqual(list.map((d) => d.order), list.map((_, i) => i));
  for (const d of list) {
    assert.ok(validateDescriptor(d).ok, d.id);
    const [, topic, dim, code, k] = /^C82-res-(gateway|hub)-(architecture|pitfalls)-([hs])-([12])$/.exec(d.id);
    const model = code === 'h' ? 'haiku' : 'sonnet';
    assert.equal(d.batch, 'C');
    assert.equal(d.kind, 'agent');
    assert.equal(d.agent, 'aoforge:project-researcher');
    assert.equal(d.model, model);
    assert.equal(d.plugin, '3.1.0');
    assert.equal(d.tools, null);
    assert.equal(d.jsonSchema, null);
    assert.equal(d.capUsd, model === 'haiku' ? 0.3 : 0.6);
    assert.match(d.capBasis, /objective 82/);
    assert.equal(d.timeoutMs, 25 * 60 * 1000);
    assert.equal(d.role, 'project-researcher');
    assert.deepEqual(d.env, {
      AOFORGE_SKIP_EDIT_GATE: '1', AOFORGE_SKIP_AWARENESS_POPULATE: '1', AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1', AOFORGE_SKIP_PRUNE: '1',
    });
    assert.deepEqual(d.fixture, {
      kind: 'researcher', role: `project-researcher:${dim}`, codebase: 'greenfield', topic, dimension: dim,
      repeat: Number(k), runtime_line: dim === 'architecture' ? 'removed' : 'absent',
    });
  }
});

test('3b: without EVAL82_SANDBOX_ROOT the prompt is the tree\'s template filled with the topic, the runtime line removed', () => {
  const root = tmp();
  const trees = fixtureTree();
  const list = C82.runs({ root, trees, env: {} });
  const byId = new Map(list.map((d) => [d.id, d]));
  const gw = C82.loadTopic('gateway');
  const hub = C82.loadTopic('hub');
  assert.equal(gw.domain, GATEWAY.domain);
  assert.equal(gw.title, GATEWAY.title);
  assert.equal(hub.domain, HUB.domain);
  assert.equal(hub.title, HUB.title);

  // pitfalls has no runtime line: exactly 81's extraction and fill, with this topic.
  const pit = byId.get('C82-res-hub-pitfalls-h-1').prompt;
  assert.equal(pit, C81.fillResearcherPrompt(C81.extractResearcherTemplate(NEW_PROJECT, 'pitfalls'), hub));

  // architecture: the runtime line is dropped, any other {runtime_root} becomes production's fallback ~/.claude/aoforge.
  const arch = byId.get('C82-res-gateway-architecture-s-1').prompt;
  const handled = C81.extractResearcherTemplate(NEW_PROJECT, 'architecture')
    .split('\n').filter((l) => l !== 'AOForge runtime: {runtime_root}').join('\n')
    .split('{runtime_root}').join('~/.claude/aoforge');
  assert.equal(arch, C81.fillResearcherPrompt(handled, gw));
  assert.ok(!arch.includes('AOForge runtime'));
  assert.ok(!arch.includes('{runtime_root}'));
  assert.ok(arch.includes('node ~/.claude/aoforge/bin/aof-tools.cjs planning draft research/ARCHITECTURE.md'));
  assert.ok(arch.includes('\nUse template: ~/.claude/aoforge/templates/research-project/ARCHITECTURE.md\n'));
  assert.ok(arch.includes(`Project Research — Architecture dimension for ${GATEWAY.domain}.`));
  assert.ok(arch.includes(gw.summary));
  assert.ok(arch.includes('\ngreenfield\n'));
  // Both repeats and both models of a pair get the same prompt.
  assert.equal(byId.get('C82-res-gateway-architecture-h-2').prompt, arch);
});

test('3c: with EVAL82_SANDBOX_ROOT every {runtime_root} is the run\'s sandbox runtime, realpath\'d like the runner', () => {
  const root = tmp();
  const s = sandboxWithTrees();
  const real = fs.realpathSync(s);
  const list = C82.runs({ root, trees: fixtureTree(), env: { EVAL82_SANDBOX_ROOT: s } });
  for (const d of list) {
    const runtime = path.join(real, 'runs', 'C', d.id, 'home', '.claude', 'aoforge');
    if (d.fixture.dimension === 'architecture') {
      assert.equal(d.fixture.runtime_line, 'filled');
      assert.ok(d.prompt.includes(`\nAOForge runtime: ${runtime}\n`), d.id);
      assert.ok(d.prompt.includes(`node ${runtime}/bin/aof-tools.cjs planning draft`), d.id);
      assert.ok(d.prompt.includes(`\nUse template: ${runtime}/templates/research-project/ARCHITECTURE.md\n`), d.id);
      assert.ok(!d.prompt.includes('{runtime_root}'), d.id);
    } else {
      assert.equal(d.fixture.runtime_line, 'absent');
      assert.ok(!d.prompt.includes('AOForge runtime'), d.id);
    }
  }
  assert.equal(C82.runtimeRootFor(real, 'C82-res-hub-architecture-h-1'), path.join(real, 'runs', 'C', 'C82-res-hub-architecture-h-1', 'home', '.claude', 'aoforge'));
  assert.throws(() => C82.runs({ root, trees: fixtureTree(), env: { EVAL82_SANDBOX_ROOT: 'relative/dir' } }), /absolute/);
  assert.throws(() => C82.runs({ root, trees: fixtureTree(), env: { EVAL82_SANDBOX_ROOT: tmp() } }), /trees\.json/);
});

test('3d: the prompt is read from the tree under test, and a missing tree is refused', () => {
  const root = tmp();
  const changed = NEW_PROJECT.replace('Project Research — Pitfalls dimension', 'Project Research (changed) — Pitfalls dimension');
  const list = C82.runs({ root, trees: fixtureTree(changed), env: {} });
  assert.ok(list.find((d) => d.id === 'C82-res-gateway-pitfalls-h-1').prompt.startsWith('<research_type>\nProject Research (changed)'));
  assert.throws(() => C82.runs({ root, trees: {}, env: {} }), /3\.1\.0/);
  assert.throws(() => C82.runs({ root, env: {} }), /3\.1\.0/);
});

test('4: a grader run appears only for a researcher record that is ok, ran its model and has a document', () => {
  const root = tmp();
  const doc = '===== ARCHITECTURE.md =====\n\nmodelgate streams each chunk and flushes it.\n';
  writeRecord(root, 'C82-res-gateway-architecture-h-1', runRecord({
    id: 'C82-res-gateway-architecture-h-1', batch: 'C', model: 'haiku', outputs: { kind: 'researcher', document: doc },
  }));
  writeRecord(root, 'C82-res-gateway-architecture-s-1', runRecord({
    id: 'C82-res-gateway-architecture-s-1', batch: 'C', model: 'sonnet', outputs: { kind: 'researcher', document: '' },
  }));
  writeRecord(root, 'C82-res-hub-pitfalls-h-1', runRecord({
    id: 'C82-res-hub-pitfalls-h-1', batch: 'C', model: 'haiku', status: 'error', outputs: { kind: 'researcher', document: doc },
  }));
  writeRecord(root, 'C82-res-hub-pitfalls-s-1', { ...runRecord({
    id: 'C82-res-hub-pitfalls-s-1', batch: 'C', model: 'sonnet', outputs: { kind: 'researcher', document: doc },
  }), model_ran: false });

  const list = C82.runs({ root, trees: fixtureTree(), env: {} });
  assert.equal(list.length, 17);
  const graders = list.filter((d) => d.fixture.kind === 'grader');
  assert.deepEqual(graders.map((d) => d.id), ['C82-grade-C82-res-gateway-architecture-h-1']);
  const g = graders[0];
  assert.ok(validateDescriptor(g).ok);
  assert.equal(g.kind, 'prompt');
  assert.equal(g.agent, null);
  assert.equal(g.model, 'sonnet');
  assert.equal(g.plugin, null);
  assert.deepEqual(g.tools, []);
  assert.deepEqual(g.jsonSchema, GRADER_SCHEMA);
  assert.equal(g.capUsd, 0.25);
  assert.equal(g.timeoutMs, 5 * 60 * 1000);
  assert.equal(g.role, 'grader');
  assert.equal(g.order, 16 + 1);
  assert.deepEqual(g.env, { AOFORGE_SKIP_AWARENESS_POPULATE: '1', AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1', AOFORGE_SKIP_PRUNE: '1' });
  assert.deepEqual(g.fixture, {
    kind: 'grader', of: 'C82-res-gateway-architecture-h-1', topic: 'gateway', dimension: 'architecture',
    role: 'project-researcher:architecture', codebase: 'greenfield', document_truncated: false,
  });
  const items = CHECKLISTS.topics.gateway.architecture.map((i) => ({ id: i.id, statement: i.statement, accept_any: i.accept_any, basis: i.source }));
  const expected = GRADER_TEMPLATE
    .replace('{{TASK}}', `The document below is the architecture research document (ARCHITECTURE.md) written for a new software project (${GATEWAY.domain}). Grade it against the checklist.`)
    .replace('{{CHECKLIST}}', JSON.stringify(items, null, 2))
    .replace('{{DOCUMENT}}', doc);
  assert.equal(g.prompt, expected);
  assert.ok(!/haiku|sonnet|C82-res/.test(g.prompt));

  // A document over the bound is cut and marked.
  const big = 'x'.repeat(C81.MAX_DOC_CHARS + 10);
  writeRecord(root, 'C82-res-gateway-architecture-s-1', runRecord({
    id: 'C82-res-gateway-architecture-s-1', batch: 'C', model: 'sonnet', outputs: { kind: 'researcher', document: big },
  }));
  const g2 = C82.runs({ root, trees: fixtureTree(), env: {} }).find((d) => d.id === 'C82-grade-C82-res-gateway-architecture-s-1');
  assert.equal(g2.fixture.document_truncated, true);
  assert.ok(g2.prompt.includes(`[document truncated at ${C81.MAX_DOC_CHARS} characters]`));
});

test('5: materialize writes the topic\'s greenfield project; collect returns the dimension\'s document or its absence', () => {
  const root = tmp();
  const list = C82.runs({ root, trees: fixtureTree(), env: {} });
  const gw = list.find((d) => d.id === 'C82-res-gateway-architecture-h-1');
  const hub = list.find((d) => d.id === 'C82-res-hub-pitfalls-s-1');

  const work = path.join(tmp(), 'work');
  C82.materialize(gw, work, { root });
  const project = fs.readFileSync(path.join(work, '.aoforge', 'PROJECT.md'), 'utf8');
  assert.ok(project.includes('\n# modelgate\n'));
  assert.ok(project.includes(C82.loadTopic('gateway').summary));
  assert.ok(fs.existsSync(path.join(work, '.aoforge', 'config.json')));
  assert.ok(!fs.existsSync(path.join(work, '.aoforge', 'research')));

  const hubWork = path.join(tmp(), 'work');
  C82.materialize(hub, hubWork, { root });
  assert.ok(fs.readFileSync(path.join(hubWork, '.aoforge', 'PROJECT.md'), 'utf8').includes('\n# devhub\n'));

  // Absence is recorded.
  const runTmp = tmp('e82-runtmp-');
  const none = C82.collect(gw, work, { root, tmp: runTmp, record: { result_text: 'done' } });
  assert.equal(none.document, '');
  assert.deepEqual(none.missing_documents, ['ARCHITECTURE.md']);
  assert.equal(none.location, 'none');
  assert.equal(none.topic, 'gateway');
  assert.equal(none.role, 'project-researcher:architecture');

  // A draft counts; the published document wins over a draft.
  fs.mkdirSync(path.join(runTmp, 'aoforge-drafts', 'k', 'research'), { recursive: true });
  fs.writeFileSync(path.join(runTmp, 'aoforge-drafts', 'k', 'research', 'ARCHITECTURE.md'), '# draft architecture\n');
  const draft = C82.collect(gw, work, { root, tmp: runTmp, record: {} });
  assert.equal(draft.document, '===== ARCHITECTURE.md =====\n\n# draft architecture\n');
  assert.equal(draft.location, 'drafts');
  fs.mkdirSync(path.join(work, '.aoforge', 'research'), { recursive: true });
  fs.writeFileSync(path.join(work, '.aoforge', 'research', 'ARCHITECTURE.md'), '# published architecture\n');
  const pub = C82.collect(gw, work, { root, tmp: runTmp, record: {} });
  assert.equal(pub.document, '===== ARCHITECTURE.md =====\n\n# published architecture\n');
  assert.deepEqual(pub.missing_documents, []);
  assert.equal(pub.location, 'published');

  // A grader's answer.
  const graderDesc = { id: 'C82-grade-x', fixture: { kind: 'grader' } };
  const graded = C82.collect(graderDesc, work, { root, record: { structured_output: { items: [{ id: 'GA-A01', verdict: 'found', evidence: 'flushes' }], fabrications: [] } } });
  assert.deepEqual(graded, { kind: 'grader', graded: { items: [{ id: 'GA-A01', verdict: 'found', evidence: 'flushes' }], fabrications: [] }, source: 'structured_output' });
});
