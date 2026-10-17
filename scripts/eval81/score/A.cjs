'use strict';

// Scorer for batch A, the verifier (TRD 81-09). Loaded by scripts/eval81/score.cjs (`--batch A`).
//
//   score({root, outDir}) -> the batch result object of the 81-02 contract (see lib/decide.cjs):
//     { batch: 'A', planned: {haiku: 18, sonnet: 18},
//       roles: { verifier: { primary: 'detection', models: { haiku|sonnet: { n_scored, planned, metrics,
//                 cost_usd, mean_cost_usd, mean_wall_ms, mean_first_turn_input } } } },
//       runs: [ {id, model, fixture, repeat, role, verdict, outcome, named, published, report, contaminated,
//                cost_usd, wall_ms, first_turn_input} ],
//       excluded: [ {id, reason, model, role, fixture} ], notes: [] }
//
// It reads <root>/runs/A/<id>/ for every id of the form A-<fixture>-<model>-r<n> (other names, such as the
// `<id>.prev-<n>` dirs the runner moves a superseded attempt to, are ignored and noted): record.json, the collected
// outputs (record.outputs and outputs/outputs.json), stream.jsonl and transcripts/. It never calls a model and writes
// nothing (score.cjs writes the results).
//
// Metrics (81-DECISION-RULE.md section 3, A), per model over its scored runs:
//   detection         planted runs with verdict gaps_found and the planted gap named / planted runs
//   false_pass        planted runs with verdict passed / planted runs
//   detected_unnamed  planted runs with gaps_found whose gaps do not name the plant / planted runs (reported)
//   false_fail        clean runs with verdict gaps_found / clean runs
//   abstain           runs with verdict human_needed or no verdict / all scored runs
//   detection_split   detection on fixtures whose gap `verify objective-evidence` reports (evidence_flags, A5 and
//                     A6) and on judgment-only fixtures (A4); also written as a note
// The verdict is the `status` of the VERIFICATION.md frontmatter; any other value, or no report, is `none` and scores
// as an abstention.
//
// "Gap named": every must_mention token and at least one any_of token of the fixture's answer key, matched
// case-insensitively as substrings, within (a) one gap entry of the frontmatter `gaps:` list, or (b) the gaps section
// taken as a whole: the frontmatter `gaps:` block, or a body section whose heading contains "gap" (the verifier
// template's "### Gaps Summary"). That is this scorer's reading of the rule's "one gap entry, or the gaps section".
// A frontmatter yaml-lite cannot parse falls back to the raw text (status by regex, entries split on list items) and
// is counted in a note.
//
// Exclusions (not in any n, listed with their reason): record status other than ok (`status:<s>`), `model_ran:
// false`, and contamination (`contaminated`: the record or outputs say so, or a tool input in stream.jsonl or a
// transcript mentions an answer key or scripts/eval81). A run dir with no record.json is not scored and is noted.
//
// Money and time per model come from the scored runs' records: cost_usd is the total charged (charged_usd, else the
// reported cost_usd), with mean_cost_usd, mean_wall_ms (wall_ms, else duration_ms) and mean_first_turn_input beside it.

const fs = require('fs');
const path = require('path');

const { parseYamlLite } = require('../../../plugins/aoforge/aoforge/bin/lib/yaml-lite.cjs');
const batchA = require('../batches/A.cjs');
const { describeFixture } = require('../fixtures/A/build.cjs');
const KEY = require('../fixtures/A/answer-key.json');

const BATCH = 'A';
const ROLE = 'verifier';
const MODELS = ['haiku', 'sonnet'];
const STATUSES = ['passed', 'gaps_found', 'human_needed'];
const PLANNED = KEY.fixtures.length * batchA.REPEATS;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const kn = (k, n) => ({ k, n });

// ─── Shared run-dir reading (also used by score/B.cjs) ─────────────────────────────────────────────────────

function readJsonOrNull(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Sorted names of the directories directly under dir; [] when dir is absent. */
function listRunDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

/** The collected outputs of a run: record.outputs, overlaid by outputs/outputs.json when present. */
function readOutputs(runDir, record) {
  const fromRecord = isObj(record) && isObj(record.outputs) ? record.outputs : {};
  const fromFile = readJsonOrNull(path.join(runDir, 'outputs', 'outputs.json'));
  return { ...fromRecord, ...(isObj(fromFile) ? fromFile : {}) };
}

/** Why a run is left out of every n, or null: `status:<s>`, `model_ran:false`, `contaminated`, in that order. */
function exclusionReason(record, contaminated) {
  if (record.status !== 'ok') return `status:${record.status}`;
  if (record.model_ran === false) return 'model_ran:false';
  if (contaminated) return 'contaminated';
  return null;
}

/** Is the run contaminated? The record or outputs flag, or a tool-input scan of the run dir. */
function isContaminated(runDir, record, outputs) {
  return record.contaminated === true || outputs.contaminated === true || batchA.contamination(runDir).contaminated;
}

/** {cost_usd, wall_ms, first_turn_input} of one record (null where the record has no number). */
function moneyOf(record) {
  let cost = null;
  if (isNum(record.charged_usd)) cost = record.charged_usd;
  else if (isNum(record.cost_usd)) cost = record.cost_usd;
  let wall = null;
  if (isNum(record.wall_ms)) wall = record.wall_ms;
  else if (isNum(record.duration_ms)) wall = record.duration_ms;
  return { cost_usd: cost, wall_ms: wall, first_turn_input: isNum(record.first_turn_input) ? record.first_turn_input : null };
}

/** Total and mean cost, mean wall time and mean first-turn input over runs (each mean over the runs that have it). */
function costSummary(runs) {
  const nums = (key) => runs.map((r) => r[key]).filter(isNum);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  const costs = nums('cost_usd');
  const walls = nums('wall_ms');
  const ftis = nums('first_turn_input');
  return {
    cost_usd: costs.length ? round6(sum(costs)) : null,
    mean_cost_usd: costs.length ? round6(sum(costs) / costs.length) : null,
    mean_wall_ms: walls.length ? Math.round(sum(walls) / walls.length) : null,
    mean_first_turn_input: ftis.length ? Math.round(sum(ftis) / ftis.length) : null,
  };
}

/**
 * tokenMatch(text, {must_mention, any_of}) -> true when the text contains every must_mention token and at least one
 * any_of token (an empty any_of list is satisfied), case-insensitively, as substrings.
 */
function tokenMatch(text, { must_mention = [], any_of = [] } = {}) {
  if (typeof text !== 'string' || text === '') return false;
  const t = text.toLowerCase();
  const has = (tok) => t.includes(String(tok).toLowerCase());
  return must_mention.every(has) && (any_of.length === 0 || any_of.some(has));
}

/** Markdown sections whose heading matches re, each from its heading to the next heading of the same or higher level. */
function headingSections(body, re) {
  const lines = String(body).split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!h || !re.test(h[2])) continue;
    const level = h[1].length;
    const section = [lines[i]];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = /^(#{1,6})\s/.exec(lines[j]);
      if (next && next[1].length <= level) break;
      section.push(lines[j]);
    }
    out.push(section.join('\n'));
  }
  return out;
}

// ─── VERIFICATION.md ───────────────────────────────────────────────────────────────────────────────────────

function splitFrontmatter(text) {
  const m = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { fm: null, body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}

/** The raw text of a top-level frontmatter key's block (its line and everything up to the next top-level key). */
function topLevelBlock(fm, key) {
  const lines = fm.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (start < 0) return null;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^[A-Za-z_][\w-]*\s*:/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/** Split a raw `key:` block into its list items (at the outermost dash indent). */
function rawItems(block) {
  const lines = block.split('\n').slice(1);
  const dashIndents = lines.map((l) => /^(\s*)-(\s|$)/.exec(l)).filter(Boolean).map((m) => m[1].length);
  if (dashIndents.length === 0) return [];
  const indent = Math.min(...dashIndents);
  const items = [];
  for (const l of lines) {
    const m = /^(\s*)-(\s|$)/.exec(l);
    if (m && m[1].length === indent) items.push([l]);
    else if (items.length) items[items.length - 1].push(l);
  }
  return items.map((it) => it.join('\n'));
}

function flattenStrings(value) {
  if (typeof value === 'string') return [value];
  if (isNum(value) || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (isObj(value)) return Object.values(value).flatMap(flattenStrings);
  return [];
}

/**
 * parseVerification(text) -> {status, gapTexts[], gapsBlock, sections[], parsed, parse_error}.
 * `parsed` is true when yaml-lite read the frontmatter; otherwise status and gap entries come from the raw text.
 */
function parseVerification(text) {
  const none = { status: null, gapTexts: [], gapsBlock: null, sections: [], parsed: false, parse_error: null };
  if (typeof text !== 'string' || text.trim() === '') return none;
  const { fm, body } = splitFrontmatter(text);
  const sections = headingSections(body, /gap/i);
  if (fm === null) return { ...none, sections };
  const gapsBlock = topLevelBlock(fm, 'gaps');
  try {
    const obj = parseYamlLite(fm);
    if (isObj(obj)) {
      const gaps = Array.isArray(obj.gaps) ? obj.gaps : [];
      return {
        status: typeof obj.status === 'string' ? obj.status.trim().toLowerCase() : null,
        gapTexts: gaps.map((g) => flattenStrings(g).join('\n')),
        gapsBlock,
        sections,
        parsed: true,
        parse_error: null,
      };
    }
    throw new Error('frontmatter is not a mapping');
  } catch (err) {
    const s = /^status:\s*["']?([A-Za-z_]+)["']?\s*(?:#.*)?$/m.exec(fm);
    return {
      status: s ? s[1].toLowerCase() : null,
      gapTexts: gapsBlock ? rawItems(gapsBlock) : [],
      gapsBlock,
      sections,
      parsed: false,
      parse_error: err.message,
    };
  }
}

/** Do the gaps name the planted gap (see the module header)? */
function gapNamed(parsed, planted) {
  if (parsed.gapTexts.some((t) => tokenMatch(t, planted))) return true;
  if (parsed.gapsBlock !== null && tokenMatch(parsed.gapsBlock, planted)) return true;
  return parsed.sections.some((s) => tokenMatch(s, planted));
}

/**
 * outcomeFor(fixtureKeyEntry, verificationText) -> {verdict, outcome, named, parsed, parse_error}.
 * Planted: detected | detected_unnamed | false_pass | abstain. Clean: correct_pass | false_fail | abstain.
 */
function outcomeFor(fx, text) {
  const v = parseVerification(text);
  const verdict = STATUSES.includes(v.status) ? v.status : 'none';
  const planted = isObj(fx.planted);
  let named = null;
  let outcome;
  if (verdict === 'human_needed' || verdict === 'none') {
    outcome = 'abstain';
  } else if (planted) {
    if (verdict === 'passed') {
      outcome = 'false_pass';
    } else {
      named = gapNamed(v, fx.planted);
      outcome = named ? 'detected' : 'detected_unnamed';
    }
  } else {
    outcome = verdict === 'passed' ? 'correct_pass' : 'false_fail';
  }
  return { verdict, outcome, named, parsed: v.parsed, parse_error: v.parse_error };
}

// ─── score() ───────────────────────────────────────────────────────────────────────────────────────────────

function modelEntry(runs) {
  const planted = runs.filter((r) => r.planted);
  const clean = runs.filter((r) => !r.planted);
  const count = (arr, outcome) => arr.filter((r) => r.outcome === outcome).length;
  const flagged = planted.filter((r) => r.evidence_flags);
  const judgment = planted.filter((r) => !r.evidence_flags);
  return {
    n_scored: runs.length,
    planned: PLANNED,
    metrics: {
      detection: kn(count(planted, 'detected'), planted.length),
      false_pass: kn(count(planted, 'false_pass'), planted.length),
      false_fail: kn(count(clean, 'false_fail'), clean.length),
      abstain: kn(count(runs, 'abstain'), runs.length),
      detected_unnamed: kn(count(planted, 'detected_unnamed'), planted.length),
      detection_split: {
        evidence_flagged: kn(count(flagged, 'detected'), flagged.length),
        judgment_only: kn(count(judgment, 'detected'), judgment.length),
      },
    },
    ...costSummary(runs),
  };
}

function idList(runs) {
  return runs.map((r) => r.id).join(', ');
}

/** score({root, outDir}) -> the batch A result object (module header). outDir is not written. */
function score({ root } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score A: --root (the eval root) is required');
  const runsDir = path.join(root, 'runs', BATCH);
  const scored = [];
  const excluded = [];
  const ignored = [];
  const noRecord = [];
  for (const name of listRunDirs(runsDir)) {
    const m = batchA.RUN_ID.exec(name);
    const fx = m ? KEY.fixtures.find((f) => f.id === m[1]) : null;
    if (!fx) {
      ignored.push(name);
      continue;
    }
    const dir = path.join(runsDir, name);
    const record = readJsonOrNull(path.join(dir, 'record.json'));
    if (!isObj(record)) {
      noRecord.push(name);
      continue;
    }
    const model = typeof record.model === 'string' ? record.model : m[2];
    if (!MODELS.includes(model)) {
      ignored.push(name);
      continue;
    }
    const outputs = readOutputs(dir, record);
    const reason = exclusionReason(record, isContaminated(dir, record, outputs));
    if (reason) {
      excluded.push({ id: name, reason, model, role: ROLE, fixture: fx.id });
      continue;
    }
    let found;
    if (typeof outputs.verification_md === 'string') {
      found = { text: outputs.verification_md, published: outputs.published !== false };
    } else {
      found = batchA.findVerification({
        workDir: path.join(dir, 'work'),
        tmpDir: path.join(dir, 'tmp'),
        objectiveDir: describeFixture(fx.id).objectiveDir,
        objective: fx.objective,
      });
    }
    const o = outcomeFor(fx, found.text);
    let report = 'none';
    if (found.text !== null) report = found.published ? 'published' : 'draft';
    scored.push({
      id: name,
      model,
      fixture: fx.id,
      repeat: Number(m[3]),
      role: ROLE,
      verdict: o.verdict,
      outcome: o.outcome,
      named: o.named,
      published: report === 'published',
      report,
      contaminated: false,
      parsed: o.parsed,
      planted: isObj(fx.planted),
      evidence_flags: fx.evidence_flags === true,
      ...moneyOf(record),
    });
  }

  const models = Object.fromEntries(MODELS.map((model) => [model, modelEntry(scored.filter((r) => r.model === model))]));
  const notes = [];
  const drafts = scored.filter((r) => r.report === 'draft');
  notes.push(`unpublished verdicts: ${drafts.length} of ${scored.length} scored runs`
    + `${drafts.length ? ` (${idList(drafts)}); scored from the newest planning draft because verification post never ran` : ''}`);
  const flaggedIds = KEY.fixtures.filter((f) => isObj(f.planted) && f.evidence_flags === true).map((f) => f.id);
  const judgmentIds = KEY.fixtures.filter((f) => isObj(f.planted) && f.evidence_flags !== true).map((f) => f.id);
  const split = MODELS.map((model) => {
    const s = models[model].metrics.detection_split;
    return `${model} ${s.evidence_flagged.k}/${s.evidence_flagged.n} evidence-flagged, `
      + `${s.judgment_only.k}/${s.judgment_only.n} judgment-only`;
  }).join('; ');
  notes.push(`evidence_flags split of detection (verify objective-evidence reports the gap on ${flaggedIds.join(', ')}; `
    + `judgment only on ${judgmentIds.join(', ')}): ${split}`);
  const noReport = scored.filter((r) => r.report === 'none');
  if (noReport.length) notes.push(`no VERIFICATION.md found, scored as abstain: ${noReport.length} (${idList(noReport)})`);
  const unparsed = scored.filter((r) => r.report !== 'none' && !r.parsed);
  if (unparsed.length) {
    notes.push(`frontmatter not parseable by yaml-lite, read from the raw text: ${unparsed.length} (${idList(unparsed)})`);
  }
  if (noRecord.length) notes.push(`no record.json (not scored): ${noRecord.join(', ')}`);
  if (ignored.length) notes.push(`ignored run dirs: ${ignored.join(', ')}`);

  // The scorer-internal fields (parsed, planted, evidence_flags) stay out of the saved runs list.
  const publicRun = (r) => {
    const out = { ...r };
    delete out.parsed;
    delete out.planted;
    delete out.evidence_flags;
    return out;
  };
  return {
    batch: BATCH,
    planned: { haiku: PLANNED, sonnet: PLANNED },
    roles: { [ROLE]: { primary: 'detection', models } },
    runs: scored.map(publicRun),
    excluded,
    notes,
  };
}

module.exports = {
  score,
  outcomeFor,
  parseVerification,
  tokenMatch,
  // shared with score/B.cjs
  readJsonOrNull,
  listRunDirs,
  readOutputs,
  exclusionReason,
  isContaminated,
  moneyOf,
  costSummary,
  headingSections,
  kn,
  round6,
};
