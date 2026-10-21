'use strict';
/**
 * Batch C of objective 82 (TRD 82-06; SC-3): the follow-up measurement for proposals P4 and P5 (budget-profile
 * architecture and pitfalls research). The project-researcher runs on two new topics drawn from real AOCyber products,
 * at haiku and sonnet, and a fixed blind Sonnet grader scores each document against a checklist committed before any
 * run (fixtures/C/checklists-82.json). Objective 81's topic is the third, already measured; it is reported beside the
 * new ones as recorded context (score/C.cjs), never re-run.
 *
 * Researcher runs (16): {gateway, hub} x {architecture, pitfalls} x {haiku, sonnet} x 2 repeats,
 *   id `C82-res-<topic>-<dim>-<h|s>-<k>`, agent aoforge:project-researcher, plugin 3.1.0, caps haiku $0.3 / sonnet
 *   $0.6, timeout 25 minutes, objective 81's agent env flags (edit gate and background work skipped), ledger role
 *   project-researcher. Repeat 1 of every topic x dimension runs before repeat 2; the two models alternate within a
 *   pair the way objective 81's batch C alternates them.
 * Prompt: the `Task(prompt="...")` text of new-project.md READ FROM THE TREE UNDER TEST (`trees['3.1.0'].path`, the
 *   tree the runner exported), extracted and filled with objective 81's own extractResearcherTemplate and
 *   fillResearcherPrompt (the topic's [domain] and summary, `greenfield`). The runtime line 82-11 adds to every spawn,
 *   `AOForge runtime: {runtime_root}`, is handled first:
 *     EVAL82_SANDBOX_ROOT=<S> set (the live command): every `{runtime_root}` becomes the run's own runtime,
 *       `<S>/runs/C/<id>/home/.claude/aoforge` (S resolved exactly as batch D resolves it: absolute, realpath'd,
 *       holding trees.json); fixture.runtime_line 'filled';
 *     unset (tests, dry runs): the line is removed and any other `{runtime_root}` becomes production's own fallback
 *       `~/.claude/aoforge`; fixture.runtime_line 'removed';
 *     no placeholder in the template (82-11 not landed): nothing changes; fixture.runtime_line 'absent'.
 *   A live run without the variable is therefore visible in every record (`removed`).
 *
 * Grader runs (one per researcher run whose record is ok, ran its requested model and collected a non-empty document;
 *   listed by runs() from the next runner invocation on): id `C82-grade-<researcher id>`, kind prompt, model sonnet,
 *   plugin none, tools [] (`--tools ""`), jsonSchema = objective 81's grader-schema.json, cap $0.25, timeout 5
 *   minutes, ledger role grader. Prompt: objective 81's grader-prompt.md with {{TASK}} (what the document is, with the
 *   topic's domain), {{CHECKLIST}} (the topic x dimension items: id, statement, accept_any, and the item's source shown
 *   as `basis`, the field 81's grader prompt names) and {{DOCUMENT}} (bounded at 81's MAX_DOC_CHARS). It names neither
 *   the model nor the run id.
 *
 * materialize: a researcher gets the greenfield project of its topic (objective 81's minimalAoforge: `.aoforge/` with
 *   PROJECT.md = `# <title>` + summary); a grader gets an empty work dir. collect delegates to objective 81's batch C
 *   collect (the published `.aoforge/research/<DIM>.md`, else the newest draft; a grader's structured answer), and
 *   adds the topic.
 */

const fs = require('node:fs');
const path = require('node:path');

const C81 = require('../../eval81/batches/C.cjs');
const synthetic = require('../../eval81/fixtures/C/synthetic.cjs');
const { validateDescriptor } = require('../../eval81/lib/contract.cjs');
const { sandboxRootFrom, SANDBOX_ENV } = require('./D.cjs');

const BATCH = 'C';
const PLUGIN = '3.1.0';
const FIXTURES = path.join(__dirname, '..', 'fixtures', 'C');
const C81_FIXTURES = path.join(__dirname, '..', '..', 'eval81', 'fixtures', 'C');
const WORKFLOW_REL = path.join('plugins', 'aoforge', 'aoforge', 'workflows', 'new-project.md');

const TOPICS = ['gateway', 'hub'];
const DIMENSIONS = ['architecture', 'pitfalls'];
const MODELS = ['haiku', 'sonnet'];
const REPEATS = [1, 2];
const MODEL_CODE = { haiku: 'h', sonnet: 's' };
const AGENT = 'aoforge:project-researcher';
const LEDGER_ROLE = 'project-researcher';
const GRADER_ROLE = 'grader';
const CAPS = { haiku: 0.3, sonnet: 0.6, grader: 0.25 };
const CAP_BASIS = {
  haiku: 'objective 82: $0.3 per haiku researcher run (objective 81: about $0.04-0.045)',
  sonnet: 'objective 82: $0.6 per sonnet researcher run (objective 81: about $0.14-0.19)',
  grader: 'objective 82: $0.25 per Sonnet grader run (objective 81: about $0.064)',
};
const TIMEOUT_MS = { researcher: 25 * 60 * 1000, grader: 5 * 60 * 1000 };
// Objective 81's batch C env: background work with no bearing on what is measured, identical for every arm, plus the
// edit gate for agent runs (a session started with --agent may carry no agent_type).
const BACKGROUND_ENV = { AOFORGE_SKIP_AWARENESS_POPULATE: '1', AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1', AOFORGE_SKIP_PRUNE: '1' };
const AGENT_ENV = { AOFORGE_SKIP_EDIT_GATE: '1', ...BACKGROUND_ENV };
const GRADER_ENV = { ...BACKGROUND_ENV };

const RUNTIME_PLACEHOLDER = '{runtime_root}';
const RUNTIME_LINE = `AOForge runtime: ${RUNTIME_PLACEHOLDER}`;
const RUNTIME_FALLBACK = '~/.claude/aoforge';

const CHECKLISTS = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'checklists-82.json'), 'utf8'));
const GRADER_SCHEMA = JSON.parse(fs.readFileSync(path.join(C81_FIXTURES, 'grader-schema.json'), 'utf8'));
const GRADER_TEMPLATE_FILE = path.join(C81_FIXTURES, 'grader-prompt.md');
const RESEARCH_DOC = { architecture: C81.RESEARCH_DOC.architecture, pitfalls: C81.RESEARCH_DOC.pitfalls };
const DIM_LABEL = { architecture: 'architecture', pitfalls: 'pitfalls' };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// --- topics -----------------------------------------------------------------------------------------------------

/** parseTopic(text) -> {domain, title, summary}: the three sections objective 81's loadTopic reads, by heading. */
function parseTopic(text, label = 'topic') {
  const section = (name) => {
    const m = String(text).match(new RegExp(`^## ${name}\\n+([\\s\\S]*?)(?=\\n## |$)`, 'm'));
    if (!m || m[1].trim() === '') throw new Error(`${label} has no "## ${name}" section`);
    return m[1].trim();
  };
  return { domain: section('Domain'), title: section('Project title'), summary: section('Project summary') };
}

/** loadTopic('gateway'|'hub') -> the topic of fixtures/C/topic-<key>.md. */
function loadTopic(key) {
  if (!TOPICS.includes(key)) throw new Error(`batch C: unknown topic ${key}`);
  const file = path.join(FIXTURES, `topic-${key}.md`);
  return parseTopic(fs.readFileSync(file, 'utf8'), `topic-${key}.md`);
}

/** The checklist items of one topic and dimension. */
function checklistFor(topic, dimension) {
  const items = CHECKLISTS.topics[topic] && CHECKLISTS.topics[topic][dimension];
  if (!Array.isArray(items)) throw new Error(`batch C: no checklist for ${topic}/${dimension}`);
  return items;
}

// --- prompts ----------------------------------------------------------------------------------------------------

/** runtimeRootFor(sandboxRoot, id) -> the run's own runtime home under the sandbox root. */
function runtimeRootFor(sandboxRoot, id) {
  return path.join(sandboxRoot, 'runs', BATCH, id, 'home', '.claude', 'aoforge');
}

/**
 * applyRuntime(template, runtimeRoot|null) -> {text, runtime_line}: fill every `{runtime_root}` with the run's
 * sandbox runtime, or (no sandbox root) drop the runtime line and put production's fallback in any other occurrence.
 */
function applyRuntime(template, runtimeRoot) {
  if (!template.includes(RUNTIME_PLACEHOLDER)) return { text: template, runtime_line: 'absent' };
  if (runtimeRoot) return { text: template.split(RUNTIME_PLACEHOLDER).join(runtimeRoot), runtime_line: 'filled' };
  const text = template.split('\n').filter((line) => line !== RUNTIME_LINE).join('\n').split(RUNTIME_PLACEHOLDER).join(RUNTIME_FALLBACK);
  return { text, runtime_line: 'removed' };
}

/** researcherPrompt(workflowText, dimension, topic, runtimeRoot) -> {prompt, runtime_line}. */
function researcherPrompt(workflowText, dimension, topic, runtimeRoot) {
  const handled = applyRuntime(C81.extractResearcherTemplate(workflowText, dimension), runtimeRoot);
  return { prompt: C81.fillResearcherPrompt(handled.text, topic), runtime_line: handled.runtime_line };
}

/** The new-project.md of the 3.1.0 tree the runner exported (the tree under test). */
function treeWorkflow(trees) {
  const t = isObj(trees) ? trees[PLUGIN] : null;
  if (!isObj(t) || typeof t.path !== 'string' || !path.isAbsolute(t.path)) {
    throw new Error(`batch C: trees has no "${PLUGIN}" tree with an absolute path; the researcher prompt is read from the tree under test`);
  }
  return fs.readFileSync(path.join(t.path, WORKFLOW_REL), 'utf8');
}

function taskLine(dimension, topic) {
  return `The document below is the ${DIM_LABEL[dimension]} research document (${RESEARCH_DOC[dimension]}) written for a new software project (${topic.domain}). Grade it against the checklist.`;
}

function fillGraderPrompt(template, { task, checklist, document }) {
  const parts = { TASK: task, CHECKLIST: checklist, DOCUMENT: document };
  return template.replace(/\{\{(TASK|CHECKLIST|DOCUMENT)\}\}/g, (_, name) => parts[name]);
}

function boundedDocument(text) {
  if (text.length <= C81.MAX_DOC_CHARS) return text;
  return `${text.slice(0, C81.MAX_DOC_CHARS)}\n\n[document truncated at ${C81.MAX_DOC_CHARS} characters]`;
}

/** The checklist as the grader sees it: objective 81's graderItems, the item's source shown as its basis. */
function graderChecklist(topic, dimension) {
  return C81.graderItems(checklistFor(topic, dimension).map((i) => ({ id: i.id, statement: i.statement, accept_any: i.accept_any, basis: i.source })));
}

// --- plan -------------------------------------------------------------------------------------------------------

/** plan() -> [{id, order, topic, dimension, model, repeat}] in run order (see the module comment). */
function plan() {
  const out = [];
  for (const repeat of REPEATS) {
    let pair = 0;
    for (const topic of TOPICS) {
      for (const dimension of DIMENSIONS) {
        const models = (pair + repeat) % 2 === 1 ? [...MODELS].reverse() : MODELS;
        for (const model of models) {
          out.push({ id: `C82-res-${topic}-${dimension}-${MODEL_CODE[model]}-${repeat}`, topic, dimension, model, repeat });
        }
        pair += 1;
      }
    }
  }
  out.forEach((entry, i) => { entry.order = i; });
  return out;
}

const graderId = (researcherId) => `C82-grade-${researcherId}`;

function researcherDescriptor(entry, { workflowText, topics, sandboxRoot }) {
  const runtimeRoot = sandboxRoot ? runtimeRootFor(sandboxRoot, entry.id) : null;
  const { prompt, runtime_line: runtimeLine } = researcherPrompt(workflowText, entry.dimension, topics[entry.topic], runtimeRoot);
  return {
    id: entry.id,
    batch: BATCH,
    kind: 'agent',
    agent: AGENT,
    model: entry.model,
    plugin: PLUGIN,
    prompt,
    tools: null,
    jsonSchema: null,
    capUsd: CAPS[entry.model],
    capBasis: CAP_BASIS[entry.model],
    timeoutMs: TIMEOUT_MS.researcher,
    env: { ...AGENT_ENV },
    fixture: {
      kind: 'researcher',
      role: `project-researcher:${entry.dimension}`,
      codebase: 'greenfield',
      topic: entry.topic,
      dimension: entry.dimension,
      repeat: entry.repeat,
      runtime_line: runtimeLine,
    },
    order: entry.order,
    role: LEDGER_ROLE,
  };
}

function graderDescriptor(entry, outputs, { template, topics, agentCount }) {
  const prompt = fillGraderPrompt(template, {
    task: taskLine(entry.dimension, topics[entry.topic]),
    checklist: JSON.stringify(graderChecklist(entry.topic, entry.dimension), null, 2),
    document: boundedDocument(outputs.document),
  });
  return {
    id: graderId(entry.id),
    batch: BATCH,
    kind: 'prompt',
    agent: null,
    model: 'sonnet',
    plugin: null,
    prompt,
    tools: [],
    jsonSchema: GRADER_SCHEMA,
    capUsd: CAPS.grader,
    capBasis: CAP_BASIS.grader,
    timeoutMs: TIMEOUT_MS.grader,
    env: { ...GRADER_ENV },
    fixture: {
      kind: 'grader',
      of: entry.id,
      topic: entry.topic,
      dimension: entry.dimension,
      role: `project-researcher:${entry.dimension}`,
      codebase: 'greenfield',
      document_truncated: outputs.document.length > C81.MAX_DOC_CHARS,
    },
    order: agentCount + entry.order,
    role: GRADER_ROLE,
  };
}

/**
 * runs({root, trees, env}) -> the 16 researcher descriptors, then a grader descriptor for every researcher record that
 * is ok, ran its requested model and has a non-empty collected document.
 */
function runs({ root, trees, env = process.env } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('C.runs: root is required');
  const sandboxRoot = sandboxRootFrom(env);
  const workflowText = treeWorkflow(trees);
  const topics = Object.fromEntries(TOPICS.map((t) => [t, loadTopic(t)]));
  const entries = plan();
  const out = entries.map((entry) => researcherDescriptor(entry, { workflowText, topics, sandboxRoot }));

  const template = fs.readFileSync(GRADER_TEMPLATE_FILE, 'utf8');
  for (const entry of entries) {
    const found = C81.readRunRecord(root, entry.id);
    if (!found || found.record.status !== 'ok' || found.record.model_ran === false) continue;
    if (!found.outputs || typeof found.outputs.document !== 'string' || found.outputs.document.trim() === '') continue;
    out.push(graderDescriptor(entry, found.outputs, { template, topics, agentCount: entries.length }));
  }
  out.sort((a, b) => a.order - b.order);
  for (const d of out) {
    const v = validateDescriptor(d);
    if (!v.ok) throw new Error(`batch C: invalid descriptor ${d.id}: ${v.errors.join('; ')}`);
  }
  return out;
}

/** materialize(desc, workDir) -> the topic's greenfield project for a researcher; an empty work dir for a grader. */
function materialize(desc, workDir) {
  fs.mkdirSync(workDir, { recursive: true });
  const fx = desc.fixture || {};
  if (fx.kind === 'grader') return;
  if (fx.kind !== 'researcher') throw new Error(`batch C materialize: unknown fixture for ${desc.id}`);
  const topic = loadTopic(fx.topic);
  const files = synthetic.minimalAoforge({ title: topic.title, paragraph: topic.summary });
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(workDir, rel)), { recursive: true });
    fs.writeFileSync(path.join(workDir, rel), text);
  }
}

/** collect(desc, workDir, ctx) -> objective 81's collected outputs (document or grade), plus the topic. */
function collect(desc, workDir, ctx = {}) {
  const fx = desc.fixture || {};
  const got = C81.collect(desc, workDir, ctx);
  return fx.kind === 'researcher' ? { ...got, topic: fx.topic } : got;
}

module.exports = {
  batch: BATCH,
  runs,
  materialize,
  collect,
  plan,
  parseTopic,
  loadTopic,
  checklistFor,
  graderChecklist,
  graderId,
  applyRuntime,
  researcherPrompt,
  runtimeRootFor,
  TOPICS,
  DIMENSIONS,
  MODELS,
  CAPS,
  RESEARCH_DOC,
  CHECKLISTS,
  SANDBOX_ENV,
  RUNTIME_LINE,
  RUNTIME_FALLBACK,
};
