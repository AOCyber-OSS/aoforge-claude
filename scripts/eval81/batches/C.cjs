'use strict';

/**
 * Batch C of the objective-81 Haiku eval (TRD 81-11): the codebase-mapper and the project-researcher, graded by a
 * fixed blind Sonnet grader against checklists committed before any run (fixtures from TRD 81-06).
 *
 * Interface (TRD 81-08): { batch, runs, materialize, collect, needsWatchedRepos } plus prepareFleet and the helpers
 * the scorer (score/C.cjs) reuses. `makeBatch({repo, privateFile, commitmentFile})` builds a batch bound to other
 * paths (tests); the default export is bound to this checkout.
 *
 * Agent runs (48, all `--agent` runs of the 3.1.0 plugin, ids opaque on purpose: the agent sees its working-directory
 * path, so no id says "synthetic", "fleet" or a model name):
 *   32 mapper runs   = {synthetic codebase, fleet copy} x {tech, arch, quality, concerns} x {haiku, sonnet} x 2,
 *                      agent aoforge:codebase-mapper, the per-focus prompt of map-codebase.md (spawn_agents), copied
 *                      verbatim from the fenced `Focus: <focus>` block
 *   16 researcher runs = {stack, features, architecture, pitfalls} x {haiku, sonnet} x 2, agent
 *                      aoforge:project-researcher, the per-dimension `Task(prompt=...)` text of new-project.md with
 *                      three fills: [domain] and the project summary from fixtures/C/researcher-topic.md, and the
 *                      `[greenfield OR subsequent]` marker set to `greenfield` (the project has no Validated
 *                      requirements). Everything else, including the unused `Subsequent:` line, stays verbatim.
 *   Mapper runs come first, then researcher runs; inside each, the two models alternate within a pair and the
 *   repeats are spread (all first repeats, then all second repeats).
 *   ROADMAP names objective-researcher for C; the four dimensions belong to project-researcher (objective-researcher
 *   has no dimensions), so this batch uses project-researcher. Switching is a one-line change (AGENTS below) if the
 *   user redirects at the batch-C checkpoint.
 *
 * Grader runs (one per agent run that has collected output; listed by runs() from the second invocation on):
 *   id `C-grade-<agent id>`, kind prompt, model sonnet, plugin null, tools [] (`--tools ""`), jsonSchema from
 *   grader-schema.json, ledger role `grader`. The prompt is fixtures/C/grader-prompt.md with {{TASK}} (what the
 *   document is), {{CHECKLIST}} (the committed items: id, statement, accept_any, evidence/basis) and {{DOCUMENT}}
 *   (the collected text, capped at MAX_DOC_CHARS). It names neither the model nor the run id.
 *
 * The private fleet checklist: `.aoforge/objectives/81-.../private/fleet-checklists.json` is gitignored. runs()
 * refuses to proceed unless its sha256 equals fleet-commitment.json ("fleet checklist missing or changed since it was
 * committed"), before any spend. Two recorded reductions let the user drop the fleet runs at the batch-C checkpoint:
 * `EVAL81_C_SKIP_FLEET=1` in the environment (omit them), or the `allowMissingFleet` option (omit them only when the
 * file is not on this machine; a changed file still throws). runs() writes `<root>/cache/C/plan.json`
 * `{include_fleet, reduction}` so the scorer and the report can say which plan ran.
 *
 * Fleet copy: prepareFleet clones the read-only source once (`git --no-optional-locks clone --no-checkout
 * --no-hardlinks`, then `checkout --detach <source_commit>`), removes origin, the legacy planning directory and `.claude/`, adds the
 * minimal 3.1.0 `.aoforge/` of the synthetic codebase (FLEET_PROJECT) and commits that so `git status` is clean, all
 * under `<root>/cache/C/`. The source is never written or locked. needsWatchedRepos exposes its path to the runner's
 * tripwire. Each run gets an fs.cpSync copy of the prepared tree.
 *
 * Collected outputs (what collect() returns; the runner stores them as record.outputs):
 *   agent: { kind: 'mapper'|'researcher', role: 'codebase-mapper:<focus>'|'project-researcher:<dim>',
 *            codebase: 'synthetic'|'fleet'|'greenfield',
 *            document: the documents joined in the fixed order, each under a `===== NAME =====` line ('' if none),
 *            documents: { NAME: { location: 'drafts'|'published', chars } }, missing_documents: [NAME],
 *            location: 'drafts'|'published'|'mixed'|'none', return_text: first 500 characters of the answer }
 *   grader: { kind: 'grader', graded: { items: [{id, verdict, evidence}], fabrications: [{claim, why}] } | null,
 *            source: 'structured_output'|'result_text'|'none' }
 * A mapper's documents are the drafts it wrote under `$TMPDIR/aoforge-drafts/<key>/codebase/` (drafts first), else
 * the published `.aoforge/codebase/`; a researcher's are the published `.aoforge/research/<DIM>.md`, else the draft.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { capFor } = require('../lib/caps.cjs');
const { validateDescriptor } = require('../lib/contract.cjs');
const synthetic = require('../fixtures/C/synthetic.cjs');
const { LEGACY } = require('../../../plugins/aoforge/aoforge/bin/lib/legacy-names.cjs');

const BATCH = 'C';
const PLUGIN = '3.1.0';
const FIXTURES = path.join(__dirname, '..', 'fixtures', 'C');
const DEFAULT_REPO = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_COMMITMENT = path.join(FIXTURES, 'fleet-commitment.json');
const WORKFLOWS_REL = path.join('plugins', 'aoforge', 'aoforge', 'workflows');

const FOCI = ['tech', 'arch', 'quality', 'concerns'];
const DIMENSIONS = ['stack', 'features', 'architecture', 'pitfalls'];
const MODELS = ['haiku', 'sonnet'];
const REPEATS = [1, 2];
const CODEBASES = [{ key: 'synthetic', code: 'a' }, { key: 'fleet', code: 'b' }];
const MODEL_CODE = { haiku: 'h', sonnet: 's' };

const AGENTS = { mapper: 'aoforge:codebase-mapper', researcher: 'aoforge:project-researcher' };
const LEDGER_ROLE = { mapper: 'codebase-mapper', researcher: 'project-researcher' };
const TIMEOUT_MS = { mapper: 20 * 60 * 1000, researcher: 25 * 60 * 1000, grader: 5 * 60 * 1000 };
// Background work with no bearing on what is measured, identical for every arm (81-08), plus the edit gate for agent
// runs: a session started with --agent may carry no agent_type, so the gate would deny writes production allows.
const BACKGROUND_ENV = { AOFORGE_SKIP_AWARENESS_POPULATE: '1', AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1', AOFORGE_SKIP_PRUNE: '1' };
const AGENT_ENV = { AOFORGE_SKIP_EDIT_GATE: '1', ...BACKGROUND_ENV };
const GRADER_ENV = { ...BACKGROUND_ENV };
const MAX_DOC_CHARS = 120000;
const SKIP_FLEET_ENV = 'EVAL81_C_SKIP_FLEET';

const SYNTHETIC_CHECKLISTS = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'checklists-synthetic.json'), 'utf8'));
const RESEARCHER_CHECKLISTS = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'checklists-researcher.json'), 'utf8'));
const GRADER_SCHEMA = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'grader-schema.json'), 'utf8'));
/** Document names each mapper focus / researcher dimension owns, in their fixed order. */
const DOC_ORDER = { ...SYNTHETIC_CHECKLISTS.focus_documents };
const RESEARCH_DOC = { ...RESEARCHER_CHECKLISTS.dimension_documents };

const VERDICTS = ['found', 'wrong', 'missing'];
const DIM_LABEL = { stack: 'technology stack', features: 'features', architecture: 'architecture', pitfalls: 'pitfalls' };
const MAPPER_TASK = {
  tech: 'the technology stack and external integrations of a software repository (STACK.md and INTEGRATIONS.md, joined under one heading per file)',
  arch: 'the architecture and directory structure of a software repository (ARCHITECTURE.md and STRUCTURE.md, joined under one heading per file)',
  quality: 'the coding conventions, testing patterns and representative code examples of a software repository (CONVENTIONS.md, TESTING.md and PATTERNS.md, joined under one heading per file)',
  concerns: 'the technical debt, known issues and areas of concern of a software repository (CONCERNS.md)',
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function readJsonOrNull(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// --- git (deterministic, never reads the user's git config) -----------------------------------------------------

function gitRun(cwd, args, extraEnv = {}) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: 'C',
      TZ: 'UTC',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      ...extraEnv,
    },
  });
  if (r.error) throw new Error(`git ${args[0]} could not start: ${r.error.message}`);
  return r;
}

function gitOk(cwd, args, extraEnv) {
  const r = gitRun(cwd, args, extraEnv);
  if (r.status !== 0) throw new Error(`git ${args.find((a) => !a.startsWith('-')) || args[0]} failed (exit ${r.status}): ${String(r.stderr).trim()}`);
  return r.stdout;
}

// --- prompts ----------------------------------------------------------------------------------------------------

/** The fenced `Focus: <focus>` block of map-codebase.md (fence lines excluded). */
function extractMapperPrompt(workflowText, focus) {
  const lines = workflowText.split('\n');
  const start = lines.findIndex((line, i) => line === `Focus: ${focus}` && lines[i - 1] === '```');
  if (start < 1) throw new Error(`map-codebase.md has no fenced Prompt block for Focus: ${focus}`);
  const end = lines.indexOf('```', start);
  if (end < 0) throw new Error(`map-codebase.md: the Focus: ${focus} block is not closed`);
  return lines.slice(start, end).join('\n');
}

/** The `Task(prompt="...")` text of new-project.md for one project-researcher dimension, unfilled. */
function extractResearcherTemplate(workflowText, dimension) {
  const open = 'Task(prompt="';
  const tail = `", subagent_type="project-researcher", model="{researcher_models.${dimension}}"`;
  const end = workflowText.indexOf(tail);
  if (end < 0) throw new Error(`new-project.md has no project-researcher Task for ${dimension}`);
  const start = workflowText.lastIndexOf(open, end);
  if (start < 0) throw new Error(`new-project.md: the ${dimension} Task has no prompt opening`);
  return workflowText.slice(start + open.length, end);
}

/** The Domain, Project title and Project summary sections of researcher-topic.md. */
function loadTopic() {
  const text = fs.readFileSync(path.join(FIXTURES, 'researcher-topic.md'), 'utf8');
  const section = (name) => {
    const m = text.match(new RegExp(`^## ${name}\\n+([\\s\\S]*?)(?=\\n## |$)`, 'm'));
    if (!m || m[1].trim() === '') throw new Error(`researcher-topic.md has no "## ${name}" section`);
    return m[1].trim();
  };
  return { domain: section('Domain'), title: section('Project title'), summary: section('Project summary') };
}

/** The three fills of the researcher template; throws when a placeholder survives (the workflow changed shape). */
function fillResearcherPrompt(template, topic) {
  const filled = template
    .split('[domain]').join(topic.domain)
    .split('[greenfield OR subsequent]').join('greenfield')
    .replace(/\[PROJECT\.md summary[^\]]*\]/g, () => topic.summary)
    .trimEnd();
  for (const left of ['[domain]', '[greenfield OR subsequent]', '[PROJECT.md summary']) {
    if (filled.includes(left)) throw new Error(`researcher prompt still contains ${left}`);
  }
  return filled;
}

function loadPrompts(repo) {
  const dir = path.join(repo, WORKFLOWS_REL);
  const mapText = fs.readFileSync(path.join(dir, 'map-codebase.md'), 'utf8');
  const projectText = fs.readFileSync(path.join(dir, 'new-project.md'), 'utf8');
  const topic = loadTopic();
  return {
    topic,
    mapper: Object.fromEntries(FOCI.map((f) => [f, extractMapperPrompt(mapText, f)])),
    researcher: Object.fromEntries(DIMENSIONS.map((d) => [d, fillResearcherPrompt(extractResearcherTemplate(projectText, d), topic)])),
  };
}

// --- plan -------------------------------------------------------------------------------------------------------

/**
 * The agent runs in order: [{id, order, kind, role, ledgerRole, codebase, focus|dimension, model, repeat}].
 * The models alternate inside a (focus, codebase) or dimension pair; repeat 1 of everything runs before repeat 2.
 */
function plan({ includeFleet = true } = {}) {
  const out = [];
  const codebases = includeFleet ? CODEBASES : CODEBASES.filter((c) => c.key === 'synthetic');
  for (const repeat of REPEATS) {
    FOCI.forEach((focus, fi) => {
      codebases.forEach((cb, ci) => {
        const models = (fi + ci + repeat) % 2 === 1 ? [...MODELS].reverse() : MODELS;
        for (const model of models) {
          out.push({
            kind: 'mapper', role: `codebase-mapper:${focus}`, ledgerRole: LEDGER_ROLE.mapper, codebase: cb.key, focus, model, repeat,
            id: `C-map-${focus}-${cb.code}-${MODEL_CODE[model]}-${repeat}`,
          });
        }
      });
    });
  }
  for (const repeat of REPEATS) {
    DIMENSIONS.forEach((dimension, di) => {
      const models = (di + repeat) % 2 === 1 ? [...MODELS].reverse() : MODELS;
      for (const model of models) {
        out.push({
          kind: 'researcher', role: `project-researcher:${dimension}`, ledgerRole: LEDGER_ROLE.researcher, codebase: 'greenfield', dimension, model, repeat,
          id: `C-res-${dimension}-${MODEL_CODE[model]}-${repeat}`,
        });
      }
    });
  }
  out.forEach((entry, i) => { entry.order = i; });
  return out;
}

const planNotePath = (root) => path.join(root, 'cache', 'C', 'plan.json');

/** What runs() recorded about the plan that ran: {include_fleet, reduction, agent_runs} or null. */
function readPlanNote(root) {
  return readJsonOrNull(planNotePath(root));
}

// --- the private fleet checklist --------------------------------------------------------------------------------

/**
 * Read the private fleet checklist and check its sha256 against the commitment, before anything else uses it.
 * @returns {{ok: true, file, sha256, info, commitment} | {ok: false, reason: string}}  (ok:false only when the file
 *   is absent and allowMissing is set)
 */
function loadPrivateFrom(cfg, { repo, allowMissing = false } = {}) {
  const commitment = JSON.parse(fs.readFileSync(cfg.commitmentFile, 'utf8'));
  const file = cfg.privateFile || path.join(repo || cfg.repo, commitment.private_file);
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    if (allowMissing) return { ok: false, reason: 'the private fleet checklist is not present on this machine' };
    throw new Error(`fleet checklist missing or changed since it was committed: ${commitment.private_file} not found`);
  }
  const actual = sha256(bytes);
  if (actual !== commitment.sha256) {
    throw new Error(`fleet checklist missing or changed since it was committed: ${commitment.private_file} has sha256 ${actual.slice(0, 12)}, the commitment says ${String(commitment.sha256).slice(0, 12)}`);
  }
  let info;
  try {
    info = JSON.parse(bytes.toString('utf8'));
  } catch (err) {
    throw new Error(`fleet checklist is not valid JSON: ${err.message}`);
  }
  if (!isObj(info) || typeof info.source_path !== 'string' || !/^[0-9a-f]{40}$/.test(String(info.source_commit)) || !isObj(info.checklists)) {
    throw new Error('fleet checklist is malformed: it needs source_path, a 40-character source_commit and checklists');
  }
  for (const focus of FOCI) {
    const items = info.checklists[focus];
    if (!Array.isArray(items) || items.length === 0 || !items.every((i) => isObj(i) && typeof i.id === 'string' && typeof i.statement === 'string')) {
      throw new Error(`fleet checklist is malformed: no valid items for ${focus}`);
    }
    const expected = commitment.items_per_focus && commitment.items_per_focus[focus];
    if (Number.isInteger(expected) && expected !== items.length) {
      throw new Error(`fleet checklist has ${items.length} items for ${focus}, the commitment says ${expected}`);
    }
  }
  return { ok: true, file, sha256: actual, info, commitment };
}

// --- copying and preparing the codebases ------------------------------------------------------------------------

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true, verbatimSymlinks: true, preserveTimestamps: true });
}

const cacheDir = (root) => path.join(root, 'cache', 'C');

/** The deterministic synthetic build, built once per eval root; returns its directory. */
function ensureSynthetic(root) {
  const dest = path.join(cacheDir(root), 'synthetic');
  if (fs.existsSync(path.join(dest, '.git'))) return dest;
  fs.mkdirSync(cacheDir(root), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(dest, { recursive: true, force: true });
  synthetic.buildSynthetic(tmp);
  fs.renameSync(tmp, dest);
  return dest;
}

/**
 * Prepare the fleet copy once per eval root (idempotent): clone the read-only source at the committed commit into
 * <root>/cache/C/fleet-src (origin removed), copy it to fleet-prepared without the legacy planning directory and `.claude/`, add the
 * minimal `.aoforge/` and commit that. `privateInfo` is the parsed private checklist (source_path, source_commit).
 * @returns {{prepared: string, src: string, reused: boolean, head: string}}
 */
function prepareFleet(root, privateInfo) {
  const dir = cacheDir(root);
  const src = path.join(dir, 'fleet-src');
  const prepared = path.join(dir, 'fleet-prepared');
  const marker = path.join(dir, 'fleet-ready.json');
  const want = privateInfo.source_commit;
  const ready = readJsonOrNull(marker);
  if (ready && ready.source_commit === want && fs.existsSync(path.join(prepared, '.git'))) {
    return { prepared, src, reused: true, head: ready.head };
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const p of [marker, src, prepared]) fs.rmSync(p, { recursive: true, force: true });

  gitOk(dir, ['--no-optional-locks', 'clone', '--quiet', '--no-checkout', '--no-hardlinks', privateInfo.source_path, src]);
  gitOk(src, ['remote', 'remove', 'origin']);
  gitOk(src, ['checkout', '--quiet', '--detach', want]);
  const date = gitOk(src, ['log', '-1', '--format=%cI', want]).trim();

  copyTree(src, prepared);
  const steps = [];
  for (const name of [LEGACY.planningDir, '.claude']) {
    if (fs.existsSync(path.join(prepared, name))) {
      fs.rmSync(path.join(prepared, name), { recursive: true, force: true });
      steps.push(`removed ${name}/`);
    } else {
      steps.push(`${name}/ not present`);
    }
  }
  const files = synthetic.minimalAoforge(synthetic.FLEET_PROJECT);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(prepared, rel)), { recursive: true });
    fs.writeFileSync(path.join(prepared, rel), text);
  }
  steps.push('added .aoforge/');
  gitOk(prepared, ['add', '-A']);
  const staged = gitRun(prepared, ['diff', '--cached', '--quiet']);
  if (staged.status === 1) {
    const id = {
      GIT_AUTHOR_NAME: synthetic.AUTHOR.name,
      GIT_AUTHOR_EMAIL: synthetic.AUTHOR.email,
      GIT_COMMITTER_NAME: synthetic.AUTHOR.name,
      GIT_COMMITTER_EMAIL: synthetic.AUTHOR.email,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    };
    gitOk(prepared, ['-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', 'chore: add project planning config'], id);
    steps.push('committed the preparation');
  }
  const head = gitOk(prepared, ['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(marker, `${JSON.stringify({ source_commit: want, head, steps, prepared_at: new Date().toISOString() }, null, 2)}\n`);
  return { prepared, src, reused: false, head };
}

// --- collect ----------------------------------------------------------------------------------------------------

/** Directories named `sub` anywhere (depth <= 5) under <tmp>/aoforge-drafts. */
function draftDirs(tmpDir, sub) {
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = path.join(dir, entry.name);
      if (entry.name === sub) found.push(child);
      else if (depth < 5) walk(child, depth + 1);
    }
  };
  walk(path.join(tmpDir, 'aoforge-drafts'), 1);
  return found;
}

/** The newest non-empty file `name` across dirs, or null. */
function newestDoc(dirs, name) {
  let best = null;
  for (const dir of dirs) {
    const file = path.join(dir, name);
    let stat;
    let text;
    try {
      stat = fs.statSync(file);
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (text.trim() === '') continue;
    if (!best || stat.mtimeMs > best.mtimeMs) best = { text, mtimeMs: stat.mtimeMs };
  }
  return best ? best.text : null;
}

/** The documents joined in their fixed order, each under a `===== NAME =====` line. */
function joinDocuments(names, texts) {
  return names
    .filter((name) => typeof texts[name] === 'string' && texts[name].trim() !== '')
    .map((name) => `===== ${name} =====\n\n${texts[name].trimEnd()}\n`)
    .join('\n');
}

function runDirOf(desc, workDir, ctx) {
  if (ctx.root) {
    const dir = path.join(ctx.root, 'runs', BATCH, desc.id);
    if (fs.existsSync(dir)) return dir;
  }
  return path.dirname(workDir);
}

function collectAgent(desc, workDir, ctx) {
  const fx = desc.fixture;
  const mapper = fx.kind === 'mapper';
  const key = mapper ? fx.focus : fx.dimension;
  const sub = mapper ? 'codebase' : 'research';
  const names = mapper ? DOC_ORDER[key] : [RESEARCH_DOC[key]];
  // Post-hoc 3 (TRD 81-17): with an opaque sandbox root the run's TMPDIR is not under <root>/runs/C/<id>; the runner
  // passes it as ctx.tmp.
  const tmpDir = typeof ctx.tmp === 'string' && ctx.tmp !== '' ? ctx.tmp : path.join(runDirOf(desc, workDir, ctx), 'tmp');
  const drafts = draftDirs(tmpDir, sub);
  const published = [path.join(workDir, '.aoforge', sub)];
  const order = mapper ? [['drafts', drafts], ['published', published]] : [['published', published], ['drafts', drafts]];

  const texts = {};
  const documents = {};
  for (const name of names) {
    for (const [location, dirs] of order) {
      const text = newestDoc(dirs, name);
      if (text !== null) {
        texts[name] = text;
        documents[name] = { location, chars: text.length };
        break;
      }
    }
  }
  const locations = new Set(Object.values(documents).map((d) => d.location));
  const record = ctx.record || {};
  return {
    kind: fx.kind,
    role: fx.role,
    codebase: fx.codebase,
    document: joinDocuments(names, texts),
    documents,
    missing_documents: names.filter((n) => !documents[n]),
    location: locations.size === 0 ? 'none' : locations.size === 1 ? [...locations][0] : 'mixed',
    return_text: typeof record.result_text === 'string' ? record.result_text.slice(0, 500) : null,
  };
}

/** A grader answer in the schema's shape, normalised, or null when it is not one. */
function validGrade(value) {
  if (!isObj(value) || !Array.isArray(value.items)) return null;
  const items = [];
  for (const item of value.items) {
    if (!isObj(item) || typeof item.id !== 'string' || !VERDICTS.includes(item.verdict)) return null;
    items.push({ id: item.id, verdict: item.verdict, evidence: typeof item.evidence === 'string' ? item.evidence : '' });
  }
  const fabrications = [];
  for (const fab of Array.isArray(value.fabrications) ? value.fabrications : []) {
    if (!isObj(fab) || typeof fab.claim !== 'string') return null;
    fabrications.push({ claim: fab.claim, why: typeof fab.why === 'string' ? fab.why : '' });
  }
  return { items, fabrications };
}

/** JSON from a model's answer text: bare, fenced, or the outermost braces. */
function parseJsonText(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenced) candidates.push(fenced[1]);
  const open = trimmed.indexOf('{');
  const close = trimmed.lastIndexOf('}');
  if (open >= 0 && close > open) candidates.push(trimmed.slice(open, close + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next form
    }
  }
  return null;
}

function collectGrader(record) {
  const structured = validGrade(record.structured_output);
  if (structured) return { kind: 'grader', graded: structured, source: 'structured_output' };
  const fromText = validGrade(parseJsonText(record.result_text));
  if (fromText) return { kind: 'grader', graded: fromText, source: 'result_text' };
  return { kind: 'grader', graded: null, source: 'none' };
}

// --- recorded outputs, for runs() and the scorer ----------------------------------------------------------------

/** Unwrap the layouts a runner may store the collected outputs in. */
function unwrapOutputs(value) {
  let cur = value;
  for (let i = 0; i < 3 && isObj(cur) && cur.document === undefined && cur.graded === undefined; i += 1) {
    const next = ['collected', 'outputs', 'value'].map((k) => cur[k]).find(isObj);
    if (!next) break;
    cur = next;
  }
  return isObj(cur) ? cur : null;
}

/**
 * <root>/runs/C/<id>/record.json and its collected outputs (record.outputs, else outputs/outputs.json).
 * @returns {{record: object, outputs: object|null, dir: string} | null}  null when there is no readable record
 */
function readRunRecord(root, id) {
  const dir = path.join(root, 'runs', BATCH, id);
  const record = readJsonOrNull(path.join(dir, 'record.json'));
  if (!isObj(record)) return null;
  let outputs = isObj(record.outputs) && Object.keys(record.outputs).length > 0 ? unwrapOutputs(record.outputs) : null;
  if (!outputs) outputs = unwrapOutputs(readJsonOrNull(path.join(dir, 'outputs', 'outputs.json')));
  return { record, outputs, dir };
}

// --- grader prompts ---------------------------------------------------------------------------------------------

function checklistFor(entry, priv) {
  if (entry.kind === 'researcher') return RESEARCHER_CHECKLISTS.checklists[entry.dimension];
  if (entry.codebase === 'synthetic') return SYNTHETIC_CHECKLISTS.checklists[entry.focus];
  if (!priv) throw new Error(`no fleet checklist is loaded for ${entry.id}`);
  return priv.info.checklists[entry.focus];
}

/** The checklist as the grader sees it: id, statement, accept_any, and evidence / basis when the item has one. */
function graderItems(items) {
  return items.map((item) => {
    const out = { id: item.id, statement: item.statement, accept_any: item.accept_any || [] };
    if (item.evidence !== undefined) out.evidence = item.evidence;
    if (item.basis !== undefined) out.basis = item.basis;
    return out;
  });
}

function taskLine(entry, topic) {
  if (entry.kind === 'mapper') return `The document below is a codebase map written to describe ${MAPPER_TASK[entry.focus]}. Grade it against the checklist.`;
  const name = RESEARCH_DOC[entry.dimension];
  return `The document below is the ${DIM_LABEL[entry.dimension]} research document (${name}) written for a new software project (${topic.domain}). Grade it against the checklist.`;
}

function fillGraderPrompt(template, { task, checklist, document }) {
  const parts = { TASK: task, CHECKLIST: checklist, DOCUMENT: document };
  return template.replace(/\{\{(TASK|CHECKLIST|DOCUMENT)\}\}/g, (_, name) => parts[name]);
}

function boundedDocument(text) {
  if (text.length <= MAX_DOC_CHARS) return text;
  return `${text.slice(0, MAX_DOC_CHARS)}\n\n[document truncated at ${MAX_DOC_CHARS} characters]`;
}

// --- the batch --------------------------------------------------------------------------------------------------

/** makeBatch({repo, privateFile, commitmentFile}): the batch module bound to a checkout and a private file. */
function makeBatch(options = {}) {
  const cfg = { repo: DEFAULT_REPO, privateFile: null, commitmentFile: DEFAULT_COMMITMENT };
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== null) cfg[key] = value;

  const loadPrivate = (opts) => loadPrivateFrom(cfg, opts);

  /** Decide whether the fleet runs are in: the hash gate, the env reduction and allowMissingFleet. */
  function fleetGate({ repo, allowMissing }) {
    if (process.env[SKIP_FLEET_ENV] === '1') {
      return { includeFleet: false, priv: null, reduction: `${SKIP_FLEET_ENV}=1: the fleet codebase runs are omitted (a recorded reduction)` };
    }
    const priv = loadPrivate({ repo, allowMissing });
    if (!priv.ok) {
      return { includeFleet: false, priv: null, reduction: 'the private fleet checklist is not present on this machine and allowMissingFleet is set: the fleet codebase runs are omitted (a recorded reduction)' };
    }
    return { includeFleet: true, priv, reduction: null };
  }

  function agentDescriptor(entry, prompts, capOf) {
    const mapper = entry.kind === 'mapper';
    const cap = capOf(entry.ledgerRole, entry.model);
    const fixture = { kind: entry.kind, role: entry.role, codebase: entry.codebase, repeat: entry.repeat };
    if (mapper) fixture.focus = entry.focus;
    else fixture.dimension = entry.dimension;
    return {
      id: entry.id,
      batch: BATCH,
      kind: 'agent',
      agent: AGENTS[entry.kind],
      model: entry.model,
      plugin: PLUGIN,
      prompt: mapper ? prompts.mapper[entry.focus] : prompts.researcher[entry.dimension],
      tools: null,
      jsonSchema: null,
      capUsd: cap.cap,
      capBasis: cap.basis,
      timeoutMs: TIMEOUT_MS[entry.kind],
      env: { ...AGENT_ENV },
      fixture,
      order: entry.order,
      role: entry.ledgerRole,
    };
  }

  function graderDescriptor(entry, outputs, ctx) {
    const items = graderItems(checklistFor(entry, ctx.priv));
    const prompt = fillGraderPrompt(ctx.template, {
      task: taskLine(entry, ctx.topic),
      checklist: JSON.stringify(items, null, 2),
      document: boundedDocument(outputs.document),
    });
    const cap = ctx.capOf('grader', 'sonnet');
    return {
      id: `C-grade-${entry.id}`,
      batch: BATCH,
      kind: 'prompt',
      agent: null,
      model: 'sonnet',
      plugin: null,
      prompt,
      tools: [],
      jsonSchema: GRADER_SCHEMA,
      capUsd: cap.cap,
      capBasis: cap.basis,
      timeoutMs: TIMEOUT_MS.grader,
      env: { ...GRADER_ENV },
      fixture: {
        kind: 'grader',
        of: entry.id,
        role: entry.role,
        codebase: entry.codebase,
        document_truncated: outputs.document.length > MAX_DOC_CHARS,
      },
      order: ctx.agentCount + entry.order,
      role: 'grader',
    };
  }

  /**
   * The run descriptors of batch C, sorted by order: the agent runs, then a grader run for every agent run whose
   * record is ok, ran its requested model and has a non-empty collected document.
   * @param {object} opts
   * @param {string} opts.root                the eval root
   * @param {object|null} [opts.trees]        unused (the runner resolves the plugin tree from the descriptor's plugin)
   * @param {object|null} [opts.calibration]  a calibration object or null (FALLBACK_P90)
   * @param {string} [opts.repo]              the checkout holding the workflows and the private file
   * @param {boolean} [opts.allowMissingFleet] omit the fleet runs when the private file is absent
   */
  function runs({ root, calibration = null, repo, allowMissingFleet = false } = {}) {
    if (typeof root !== 'string' || root === '') throw new TypeError('C.runs: root is required');
    const repoDir = repo || cfg.repo;
    const gate = fleetGate({ repo: repoDir, allowMissing: allowMissingFleet });
    const entries = plan({ includeFleet: gate.includeFleet });
    fs.mkdirSync(cacheDir(root), { recursive: true });
    fs.writeFileSync(planNotePath(root), `${JSON.stringify({ include_fleet: gate.includeFleet, reduction: gate.reduction, agent_runs: entries.length }, null, 2)}\n`);

    const prompts = loadPrompts(repoDir);
    const memo = new Map();
    const capOf = (role, model) => {
      const key = `${role}/${model}`;
      if (!memo.has(key)) memo.set(key, capFor({ role, model, batch: BATCH, calibration }));
      return memo.get(key);
    };
    const all = entries.map((entry) => agentDescriptor(entry, prompts, capOf));

    const template = fs.readFileSync(path.join(FIXTURES, 'grader-prompt.md'), 'utf8');
    const ctx = { priv: gate.priv, template, topic: prompts.topic, capOf, agentCount: entries.length };
    for (const entry of entries) {
      const found = readRunRecord(root, entry.id);
      if (!found || found.record.status !== 'ok' || found.record.model_ran === false) continue;
      if (!found.outputs || typeof found.outputs.document !== 'string' || found.outputs.document.trim() === '') continue;
      all.push(graderDescriptor(entry, found.outputs, ctx));
    }

    all.sort((a, b) => a.order - b.order);
    for (const d of all) {
      const v = validateDescriptor(d);
      if (!v.ok) throw new Error(`C.runs: invalid descriptor ${d.id}: ${v.errors.join('; ')}`);
    }
    return all;
  }

  /** Fresh copy of the run's fixture into workDir: the synthetic build, the prepared fleet tree, a greenfield project or nothing. */
  function materialize(desc, workDir, ctx = {}) {
    if (!ctx.root) throw new TypeError('C.materialize: ctx.root is required');
    fs.mkdirSync(workDir, { recursive: true });
    const fx = desc.fixture || {};
    if (fx.kind === 'grader') return;
    if (fx.kind === 'researcher') {
      const topic = loadTopic();
      const files = synthetic.minimalAoforge({ title: topic.title, paragraph: topic.summary });
      for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(workDir, rel)), { recursive: true });
        fs.writeFileSync(path.join(workDir, rel), text);
      }
      return;
    }
    if (fx.codebase === 'synthetic') {
      copyTree(ensureSynthetic(ctx.root), workDir);
      return;
    }
    if (fx.codebase === 'fleet') {
      const priv = loadPrivate({ repo: cfg.repo });
      copyTree(prepareFleet(ctx.root, priv.info).prepared, workDir);
      return;
    }
    throw new Error(`C.materialize: unknown fixture for ${desc.id}`);
  }

  /** The run's collected outputs (see the module comment). */
  function collect(desc, workDir, ctx = {}) {
    const fx = desc.fixture || {};
    if (fx.kind === 'grader') return collectGrader(ctx.record || {});
    return collectAgent(desc, workDir, ctx);
  }

  /** The fleet source repository for the runner's tripwire; none when the fleet runs are omitted. */
  function needsWatchedRepos(root) {
    if (process.env[SKIP_FLEET_ENV] === '1') return [];
    const note = readPlanNote(root);
    if (note && note.include_fleet === false) return [];
    return [{ label: 'fleet-source', path: loadPrivate({ repo: cfg.repo }).info.source_path }];
  }

  return {
    batch: BATCH,
    runs,
    materialize,
    collect,
    needsWatchedRepos,
    prepareFleet,
    loadPrivate,
  };
}

module.exports = {
  ...makeBatch(),
  makeBatch,
  plan,
  readPlanNote,
  readRunRecord,
  checklistFor,
  graderItems,
  joinDocuments,
  extractMapperPrompt,
  extractResearcherTemplate,
  fillResearcherPrompt,
  loadTopic,
  ensureSynthetic,
  FOCI,
  DIMENSIONS,
  MODELS,
  CODEBASES,
  DOC_ORDER,
  RESEARCH_DOC,
  SYNTHETIC_CHECKLISTS,
  RESEARCHER_CHECKLISTS,
  MAX_DOC_CHARS,
  SKIP_FLEET_ENV,
};
