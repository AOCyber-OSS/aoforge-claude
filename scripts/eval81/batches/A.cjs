'use strict';

// Batch A of the objective-81 eval (TRD 81-09): the verifier on six fixture projects (scripts/eval81/fixtures/A),
// Haiku 5.5 against Sonnet 5.5, three repeats each, 36 runs.
//
// Batch module interface (TRD 81-08's runner loads this file by batch id):
//   runs({root, trees, calibration})            -> RunDescriptor[] (81-01 contract), sorted by `order`
//   materialize(desc, workDir, {root, trees, home}) -> builds a fresh copy of the fixture repository in workDir
//   collect(desc, workDir, {root, home, record, tmp?}) -> {verification_md, published, source, result_text,
//                                                         contaminated}
//
// Each run is `claude -p --agent aoforge:verifier` on the 3.1.0 tree. The prompt is execute-objective.md's verifier
// spawn prompt (VERIFIER_TEMPLATE, asserted equal to the workflow file by A.test.cjs) with the placeholders filled the
// way the orchestrator fills them: objective number 1, the objective dir, the goal and the requirement IDs read from
// the fixture's ROADMAP.md. Nothing else reaches the model: the run id (which names the fixture and the model), the
// answer key and the planted kind stay harness-side. The fixture repository text was written by TRD 81-03 to carry
// none of the revealing words.
//
// Order: for repeat r in 1..3, for each fixture in answer-key order, both models back to back, haiku first on odd
// fixtures (A1, A3, A5) and sonnet first on even ones, so neither model systematically runs on a warmer prompt cache.
//
// runs() caches the ROADMAP facts per fixture in <root>/cache/A/<id>/facts.json (the fixture is built once into
// <root>/cache/A/<id>/repo/ to read them), so repeated runs() calls give byte-identical prompts.
//
// collect() reads the VERIFICATION.md the verifier published with `verification post 1`
// (<work>/.aoforge/objectives/01-<slug>/01-VERIFICATION.md). When it was drafted but never published, it falls back
// to the newest `aoforge-drafts/**/01-VERIFICATION.md` under the run's TMPDIR (<run dir>/tmp, the runner's sandbox
// layout; `opts.tmp` overrides) and reports `published: false`. `contaminated` is true when a tool input in the run's
// stream.jsonl mentions an answer key or scripts/eval81 (81-DECISION-RULE.md, Contamination); the scorer repeats the
// scan over the copied transcripts.

const fs = require('fs');
const path = require('path');

const { buildFixture, describeFixture } = require('../fixtures/A/build.cjs');
const KEY = require('../fixtures/A/answer-key.json');
const { capFor } = require('../lib/caps.cjs');
const { toolInputsMentioning } = require('../lib/result.cjs');

const BATCH = 'A';
const AGENT = 'aoforge:verifier';
const ROLE = 'verifier';
const PLUGIN = '3.1.0';
const MODELS = ['haiku', 'sonnet'];
const REPEATS = 3;
const TIMEOUT_MS = 15 * 60 * 1000;
// Per-run env (TRD 81-08 gotchas): the edit gate would deny a --agent session's writes (no agent_type), and the
// three background jobs have no bearing on the measured tokens.
const RUN_ENV = Object.freeze({
  AOFORGE_SKIP_EDIT_GATE: '1',
  AOFORGE_SKIP_AWARENESS_POPULATE: '1',
  AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
  AOFORGE_SKIP_PRUNE: '1',
});
const FIXTURE_IDS = KEY.fixtures.map((f) => f.id);
const RUN_ID = /^A-(A\d+)-(haiku|sonnet|opus)-r(\d+)$/;
// Tool inputs that mean the run looked at the answer (81-DECISION-RULE.md, Contamination).
const CONTAMINATION_PATTERNS = [/answer[-_]key/i, /scripts\/eval81/];

// plugins/aoforge/aoforge/workflows/execute-objective.md, the verifier Task( prompt="..." ), verbatim.
const VERIFIER_TEMPLATE = [
  'Verify objective {objective_number} goal achievement.',
  'Objective directory: {objective_dir}',
  'Objective goal: {goal from ROADMAP.md}',
  'Objective requirement IDs: {objective_req_ids}',
  'Check must_haves against actual codebase.',
  'Cross-reference requirement IDs from TRD/JOB frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.',
  'Draft VERIFICATION.md from `planning draft` and publish it with `node ~/.claude/aoforge/bin/aof-tools.cjs verification post {objective_number} --from <draft path>`.',
  'The VERIFICATION frontmatter must carry `status: passed|gaps_found|human_needed` (optional `score:`); `verification post` reads it.',
].join('\n');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const toPosix = (p) => p.split(path.sep).join('/');

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Every regular file below dir (symlinks skipped), absolute paths; [] when dir is absent. */
function walkFiles(dir) {
  const out = [];
  const walk = (abs) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const child = path.join(abs, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) walk(child);
      else if (ent.isFile()) out.push(child);
    }
  };
  walk(dir);
  return out.sort();
}

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

/**
 * fillTemplate(template, values) -> the template with every `{name}` placeholder replaced in one pass, so a value
 * that itself contains braces (the pre-check JSON) is never re-read. A placeholder with no value, or a value with no
 * placeholder, throws: a renamed placeholder in the workflow must fail loudly, not leak `{...}` into a prompt.
 */
function fillTemplate(template, values) {
  const used = new Set();
  const out = template.replace(/\{([^{}\n]+)\}/g, (whole, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`fillTemplate: no value for {${name}}`);
    used.add(name);
    return String(values[name]);
  });
  const unused = Object.keys(values).filter((k) => !used.has(k));
  if (unused.length) throw new Error(`fillTemplate: no placeholder for ${unused.map((k) => `{${k}}`).join(', ')}`);
  return out;
}

/**
 * roadmapObjective(roadmapText, num) -> {goal, reqIds} from the `### Objective <num>:` section: the `**Goal**:` line
 * and the `**Requirements**:` line with brackets removed (execute-objective.md's sed), as written.
 */
function roadmapObjective(text, num) {
  const lines = String(text).split('\n');
  const head = new RegExp(`^#{2,4}\\s+Objective\\s+0*${Number(num)}\\s*:`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) throw new Error(`ROADMAP.md has no "### Objective ${num}:" section`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^#{1,3}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section = lines.slice(start, end);
  const field = (name) => {
    const re = new RegExp(`^\\*\\*${name}(?::\\*\\*|\\*\\*:)\\s*(.*)$`);
    const hit = section.map((l) => re.exec(l)).find(Boolean);
    if (!hit) throw new Error(`ROADMAP.md objective ${num} has no **${name}**: line`);
    return hit[1].trim();
  };
  return { goal: field('Goal'), reqIds: field('Requirements').replace(/[[\]]/g, '') };
}

/**
 * interleave(fixtureIds, repeats) -> [{fixture, model, repeat}] in run order: repeat-major, fixtures in the given
 * order, haiku first on odd positions (1st, 3rd, ...) and sonnet first on even ones.
 */
function interleave(fixtureIds, repeats = REPEATS) {
  const out = [];
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    fixtureIds.forEach((fixture, i) => {
      const models = i % 2 === 0 ? ['haiku', 'sonnet'] : ['sonnet', 'haiku'];
      for (const model of models) out.push({ fixture, model, repeat });
    });
  }
  return out;
}

/** The ROADMAP facts of one fixture, built once into <root>/cache/A/<id>/ and cached in facts.json. */
function fixtureFacts(root, id) {
  const dir = path.join(root, 'cache', BATCH, id);
  const factsFile = path.join(dir, 'facts.json');
  if (isFile(factsFile)) return JSON.parse(fs.readFileSync(factsFile, 'utf8'));
  const repo = path.join(dir, 'repo');
  fs.rmSync(repo, { recursive: true, force: true }); // a half-built cache from an interrupted call
  buildFixture(id, repo);
  const d = describeFixture(id);
  const r = roadmapObjective(fs.readFileSync(path.join(repo, '.aoforge', 'ROADMAP.md'), 'utf8'), d.objective);
  const facts = { id, objective: d.objective, objectiveDir: d.objectiveDir, goal: r.goal, reqIds: r.reqIds };
  writeAtomic(factsFile, `${JSON.stringify(facts, null, 2)}\n`);
  return facts;
}

/** The verifier prompt for one fixture's facts. */
function verifierPrompt(facts) {
  return fillTemplate(VERIFIER_TEMPLATE, {
    objective_number: facts.objective,
    objective_dir: facts.objectiveDir,
    'goal from ROADMAP.md': facts.goal,
    objective_req_ids: facts.reqIds,
  });
}

/**
 * runs({root, trees, calibration}) -> the 36 RunDescriptors of batch A. `root` is required (the fact cache lives
 * there); `trees` is not read (the runner passes the 3.1.0 tree as --plugin-dir); `calibration` sizes the caps
 * (null: caps.cjs FALLBACK_P90).
 */
function runs({ root, calibration = null } = {}) {
  if (typeof root !== 'string' || root === '') {
    throw new TypeError('batch A runs(): an eval root is required (fixture facts are cached under <root>/cache/A)');
  }
  const facts = Object.fromEntries(FIXTURE_IDS.map((id) => [id, fixtureFacts(root, id)]));
  const caps = Object.fromEntries(MODELS.map((model) => [model, capFor({ role: ROLE, model, batch: BATCH, calibration })]));
  return interleave(FIXTURE_IDS, REPEATS).map(({ fixture, model, repeat }, order) => {
    const f = facts[fixture];
    return {
      id: `${BATCH}-${fixture}-${model}-r${repeat}`,
      batch: BATCH,
      kind: 'agent',
      agent: AGENT,
      model,
      plugin: PLUGIN,
      prompt: verifierPrompt(f),
      tools: null,
      jsonSchema: null,
      capUsd: caps[model].cap,
      capBasis: caps[model].basis,
      timeoutMs: TIMEOUT_MS,
      env: { ...RUN_ENV },
      fixture: { id: fixture, objective: f.objective, objectiveDir: f.objectiveDir, repeat },
      order,
      role: ROLE,
    };
  });
}

/** materialize(desc, workDir) -> builds a fresh copy of the fixture repository in workDir (which must be empty). */
function materialize(desc, workDir) {
  buildFixture(desc.fixture.id, workDir);
}

/**
 * findVerification({workDir, tmpDir, objectiveDir, objective}) -> {text, published, source}: the published report,
 * else the newest draft under tmpDir/aoforge-drafts, else {text: null, published: false, source: null}. `source` is
 * relative to the work dir for a published report and to the run dir (tmpDir's parent) for a draft.
 */
function findVerification({ workDir, tmpDir, objectiveDir, objective }) {
  const name = `${String(objective).padStart(2, '0')}-VERIFICATION.md`;
  const published = path.join(workDir, objectiveDir, name);
  if (isFile(published)) {
    return { text: fs.readFileSync(published, 'utf8'), published: true, source: toPosix(path.relative(workDir, published)) };
  }
  const drafts = walkFiles(path.join(tmpDir, 'aoforge-drafts'))
    .filter((f) => path.basename(f) === name)
    .map((f) => ({ f, mtime: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime || a.f.localeCompare(b.f));
  if (drafts.length) {
    const f = drafts[0].f;
    return { text: fs.readFileSync(f, 'utf8'), published: false, source: toPosix(path.relative(path.dirname(tmpDir), f)) };
  }
  return { text: null, published: false, source: null };
}

/**
 * contamination(runDir) -> {contaminated, hits: [{file, tool_use_ids}]}: scans <runDir>/stream.jsonl and every
 * <runDir>/transcripts/**\/*.jsonl for a tool input matching CONTAMINATION_PATTERNS.
 */
function contamination(runDir) {
  const files = [];
  const stream = path.join(runDir, 'stream.jsonl');
  if (isFile(stream)) files.push(stream);
  files.push(...walkFiles(path.join(runDir, 'transcripts')).filter((f) => f.endsWith('.jsonl')));
  const hits = [];
  for (const f of files) {
    const ids = toolInputsMentioning(fs.readFileSync(f, 'utf8'), CONTAMINATION_PATTERNS);
    if (ids.length) hits.push({ file: toPosix(path.relative(runDir, f)), tool_use_ids: ids });
  }
  return { contaminated: hits.length > 0, hits };
}

/** collect(desc, workDir, {record, tmp}) -> the run's outputs (see the module header). */
function collect(desc, workDir, { record = null, tmp } = {}) {
  const runDir = path.dirname(workDir);
  const found = findVerification({
    workDir,
    tmpDir: tmp || path.join(runDir, 'tmp'),
    objectiveDir: desc.fixture.objectiveDir,
    objective: desc.fixture.objective,
  });
  return {
    verification_md: found.text,
    published: found.published,
    source: found.source,
    result_text: isObj(record) && typeof record.result_text === 'string' ? record.result_text : null,
    contaminated: contamination(runDir).contaminated,
  };
}

module.exports = {
  batch: BATCH,
  runs,
  materialize,
  collect,
  // shared with batches/B.cjs and the scorers
  AGENT,
  ROLE,
  PLUGIN,
  MODELS,
  REPEATS,
  TIMEOUT_MS,
  RUN_ENV,
  RUN_ID,
  FIXTURE_IDS,
  CONTAMINATION_PATTERNS,
  VERIFIER_TEMPLATE,
  fillTemplate,
  roadmapObjective,
  interleave,
  verifierPrompt,
  findVerification,
  contamination,
  walkFiles,
  writeAtomic,
  isFile,
};
