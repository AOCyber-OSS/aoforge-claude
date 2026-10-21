'use strict';

// Scorer for batch B, the job-checker (TRD 81-09). Loaded by scripts/eval81/score.cjs (`--batch B`).
//
//   score({root, outDir}) -> the batch result object of the 81-02 contract (see lib/decide.cjs):
//     { batch: 'B', planned: {haiku: 18, sonnet: 18},
//       roles: { 'job-checker': { primary: 'detection', models: { haiku|sonnet: { n_scored, planned, metrics,
//                 cost_usd, mean_cost_usd, mean_wall_ms, mean_first_turn_input } } } },
//       runs: [ {id, model, fixture, repeat, role, verdict, outcome, blockers, warnings, unrelated_blockers, yaml,
//                contaminated, cost_usd, wall_ms, first_turn_input} ],
//       excluded: [ {id, reason, model, role, fixture} ], notes: [] }
//
// It reads <root>/runs/B/<id>/ for ids B-<set>-<model>-r<n> with score/A.cjs's run-dir helpers (same exclusions:
// `status:<s>`, `model_ran:false`, `contaminated`; same money fields). The checker's return text is the collected
// result_text (outputs/outputs.json or record.outputs), else the record's result_text, else the stream's result
// event.
//
// Parsing the return (plugins/aoforge/agents/job-checker.md <structured_returns>):
//   verdict   the first `## VERIFICATION PASSED` (passed) or `## ISSUES FOUND` (issues) heading; neither is `none`
//   issues    the numbered items of `### Blockers` (severity blocker) and `### Warnings` (severity warning), each item
//             being its `**N. [dimension] description**` line with the bullets under it; plus the entries of a fenced
//             YAML block carrying `severity:` (an `issues:` list, a bare list, or `- issue:` items). An entry whose
//             description matches a Markdown item (case, quotes, emphasis and spacing ignored) is merged into it and
//             keeps the Markdown severity; others are added with their YAML severity. A YAML block yaml-lite cannot
//             parse is ignored (the Markdown sections stand) and counted in a note.
//
// Outcomes (81-DECISION-RULE.md section 3, B). An issue matches when its text holds every must_mention token and at
// least one any_of token of the set's answer key (case-insensitive substrings; B6's empty must_mention needs only an
// any_of phrase).
//   planted set   verdict issues with a matching blocker or warning -> detected; issues without one -> missed;
//                 verdict passed -> missed_as_pass; verdict none -> abstain
//   clean set     at least one blocker -> false_alarm; otherwise correct_pass; verdict none -> abstain
// Info-severity issues neither detect nor alarm (the rule names blockers and warnings).
//
// Metrics per model over its scored runs: detection and missed_as_pass (planted n), false_alarm (clean n),
// unrelated_blockers {total, runs} (blockers on planted runs that do not match the plant), abstain (all runs) and
// detection_split {precheck_flagged, judgment_only} by the key's precheck_flags (also written as a note).

const fs = require('fs');
const path = require('path');

const { parseYamlLite } = require('../../../plugins/aoforge/aoforge/bin/lib/yaml-lite.cjs');
const { parseResultEvent } = require('../lib/result.cjs');
const batchB = require('../batches/B.cjs');
const { REPEATS } = require('../batches/A.cjs');
const A = require('./A.cjs');
const KEY = require('../fixtures/B/answer-key.json');

const BATCH = 'B';
const ROLE = 'job-checker';
const MODELS = ['haiku', 'sonnet'];
const PLANNED = KEY.sets.length * REPEATS;
const SEVERITIES = ['blocker', 'warning', 'info'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const { kn } = A;

/** Dedupe key of an issue description: lower case, no emphasis or quotes, single spaces, no trailing period. */
function descKey(desc) {
  return String(desc || '')
    .toLowerCase()
    .replace(/[*`"']/g, '')
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim();
}

function flattenStrings(value) {
  if (typeof value === 'string') return [value];
  if (isNum(value) || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (isObj(value)) return Object.values(value).flatMap(flattenStrings);
  return [];
}

const ITEM_START = /^\s{0,3}(?:\*\*)?\s*\d+[.)]\s+/;
const NONE_LINE = /^[-*]?\s*[_*]*\s*(none|n\/a|nothing)\b/i;

/** The items of one Markdown issue section (heading excluded). Numbered items; else top-level bullets. */
function sectionItems(section) {
  const lines = section.split('\n').slice(1);
  const items = [];
  for (const line of lines) {
    if (ITEM_START.test(line)) items.push([line]);
    else if (items.length) items[items.length - 1].push(line);
  }
  if (items.length === 0) {
    for (const line of lines) {
      if (/^[-*]\s+\S/.test(line) && !NONE_LINE.test(line)) items.push([line]);
      else if (items.length && /^\s+\S/.test(line)) items[items.length - 1].push(line);
    }
  }
  return items.map((it) => {
    const text = it.join('\n').replace(/\s+$/, '');
    const first = it[0].replace(/\*\*/g, '').replace(/^\s*(?:\d+[.)]|[-*])\s*/, '');
    const dim = /^\[([^\]]+)\]\s*/.exec(first);
    return {
      dimension: dim ? dim[1].trim() : null,
      description: (dim ? first.slice(dim[0].length) : first).trim(),
      text,
    };
  });
}

/** The issue entries of a parsed YAML value: `issues: [...]`, a bare list, `- issue: {...}` items or one `issue:`. */
function yamlEntries(value) {
  if (Array.isArray(value)) return value.flatMap((x) => (isObj(x) && isObj(x.issue) ? [x.issue] : (isObj(x) ? [x] : [])));
  if (isObj(value)) {
    if (Array.isArray(value.issues)) return yamlEntries(value.issues);
    if (isObj(value.issue)) return [value.issue];
    if (typeof value.severity === 'string') return [value];
  }
  return [];
}

/**
 * parseChecker(text) -> {verdict: 'passed'|'issues'|'none', issues: [{severity, dimension, description, text, from}],
 * yaml: 'ok'|'none'|'error', yaml_error}. `from` is markdown, yaml or both.
 */
function parseChecker(text) {
  if (typeof text !== 'string' || text.trim() === '') return { verdict: 'none', issues: [], yaml: 'none', yaml_error: null };
  const head = /^#{1,3}[ \t]*(VERIFICATION PASSED|ISSUES FOUND)\b/im.exec(text);
  let verdict = 'none';
  if (head) verdict = head[1].toUpperCase() === 'VERIFICATION PASSED' ? 'passed' : 'issues';

  const issues = [];
  const byKey = new Map();
  for (const [re, severity] of [[/^blockers?\b/i, 'blocker'], [/^warnings?\b/i, 'warning']]) {
    for (const section of A.headingSections(text, re)) {
      for (const item of sectionItems(section)) {
        const issue = { severity, dimension: item.dimension, description: item.description, text: item.text, from: 'markdown' };
        issues.push(issue);
        const k = descKey(item.description);
        if (k && !byKey.has(k)) byKey.set(k, issue);
      }
    }
  }

  let yaml = 'none';
  let yamlError = null;
  const fences = [...text.matchAll(/```(?:ya?ml)?[ \t]*\r?\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => /severity\s*:/.test(b));
  for (const block of fences) {
    let value;
    try {
      value = parseYamlLite(block);
    } catch (err) {
      yaml = 'error';
      yamlError = err.message;
      continue;
    }
    if (yaml === 'none') yaml = 'ok';
    for (const entry of yamlEntries(value)) {
      const sev = String(entry.severity || '').trim().toLowerCase();
      const entryText = flattenStrings(entry).join('\n');
      const k = descKey(entry.description);
      const known = k ? byKey.get(k) : null;
      if (known) {
        known.text = `${known.text}\n${entryText}`;
        if (known.from === 'markdown') known.from = 'both';
        continue;
      }
      const issue = {
        severity: SEVERITIES.includes(sev) ? sev : sev || 'unknown',
        dimension: typeof entry.dimension === 'string' ? entry.dimension : null,
        description: typeof entry.description === 'string' ? entry.description : '',
        text: entryText,
        from: 'yaml',
      };
      issues.push(issue);
      if (k) byKey.set(k, issue);
    }
  }
  return { verdict, issues, yaml, yaml_error: yamlError };
}

/**
 * outcomeFor(setKeyEntry, returnText) -> {verdict, outcome, blockers, warnings, unrelated_blockers, yaml}.
 * Planted: detected | missed | missed_as_pass | abstain. Clean: false_alarm | correct_pass | abstain.
 */
function outcomeFor(set, text) {
  const p = parseChecker(text);
  const planted = isObj(set.planted);
  const blockers = p.issues.filter((i) => i.severity === 'blocker');
  const warnings = p.issues.filter((i) => i.severity === 'warning');
  const matches = (issue) => planted && A.tokenMatch(issue.text, set.planted);
  let outcome;
  if (p.verdict === 'none') outcome = 'abstain';
  else if (planted) {
    if (p.verdict === 'passed') outcome = 'missed_as_pass';
    else outcome = [...blockers, ...warnings].some(matches) ? 'detected' : 'missed';
  } else {
    outcome = blockers.length > 0 ? 'false_alarm' : 'correct_pass';
  }
  return {
    verdict: p.verdict,
    outcome,
    blockers: blockers.length,
    warnings: warnings.length,
    unrelated_blockers: blockers.filter((b) => !matches(b)).length,
    yaml: p.yaml,
  };
}

/** The checker's return text of one run (module header). */
function returnText(runDir, record, outputs) {
  if (typeof outputs.result_text === 'string') return outputs.result_text;
  if (typeof record.result_text === 'string') return record.result_text;
  try {
    const ev = parseResultEvent(fs.readFileSync(path.join(runDir, 'stream.jsonl'), 'utf8'));
    return ev && typeof ev.result === 'string' ? ev.result : null;
  } catch {
    return null;
  }
}

function modelEntry(runs) {
  const planted = runs.filter((r) => r.planted);
  const clean = runs.filter((r) => !r.planted);
  const count = (arr, outcome) => arr.filter((r) => r.outcome === outcome).length;
  const flagged = planted.filter((r) => r.precheck_flags);
  const judgment = planted.filter((r) => !r.precheck_flags);
  return {
    n_scored: runs.length,
    planned: PLANNED,
    metrics: {
      detection: kn(count(planted, 'detected'), planted.length),
      false_alarm: kn(count(clean, 'false_alarm'), clean.length),
      missed_as_pass: kn(count(planted, 'missed_as_pass'), planted.length),
      unrelated_blockers: { total: planted.reduce((s, r) => s + r.unrelated_blockers, 0), runs: planted.length },
      abstain: kn(count(runs, 'abstain'), runs.length),
      detection_split: {
        precheck_flagged: kn(count(flagged, 'detected'), flagged.length),
        judgment_only: kn(count(judgment, 'detected'), judgment.length),
      },
    },
    ...A.costSummary(runs),
  };
}

const idList = (runs) => runs.map((r) => r.id).join(', ');

/** score({root, outDir}) -> the batch B result object (module header). outDir is not written. */
function score({ root } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score B: --root (the eval root) is required');
  const runsDir = path.join(root, 'runs', BATCH);
  const scored = [];
  const excluded = [];
  const ignored = [];
  const noRecord = [];
  for (const name of A.listRunDirs(runsDir)) {
    const m = batchB.RUN_ID.exec(name);
    const set = m ? KEY.sets.find((s) => s.id === m[1]) : null;
    if (!set) {
      ignored.push(name);
      continue;
    }
    const dir = path.join(runsDir, name);
    const record = A.readJsonOrNull(path.join(dir, 'record.json'));
    if (!isObj(record)) {
      noRecord.push(name);
      continue;
    }
    const model = typeof record.model === 'string' ? record.model : m[2];
    if (!MODELS.includes(model)) {
      ignored.push(name);
      continue;
    }
    const outputs = A.readOutputs(dir, record);
    const reason = A.exclusionReason(record, A.isContaminated(dir, record, outputs));
    if (reason) {
      excluded.push({ id: name, reason, model, role: ROLE, fixture: set.id });
      continue;
    }
    const o = outcomeFor(set, returnText(dir, record, outputs));
    scored.push({
      id: name,
      model,
      fixture: set.id,
      repeat: Number(m[3]),
      role: ROLE,
      verdict: o.verdict,
      outcome: o.outcome,
      blockers: o.blockers,
      warnings: o.warnings,
      unrelated_blockers: o.unrelated_blockers,
      yaml: o.yaml,
      contaminated: false,
      planted: isObj(set.planted),
      precheck_flags: isObj(set.planted) && set.planted.precheck_flags === true,
      ...A.moneyOf(record),
    });
  }

  const models = Object.fromEntries(MODELS.map((model) => [model, modelEntry(scored.filter((r) => r.model === model))]));
  const notes = [];
  const flaggedIds = KEY.sets.filter((s) => isObj(s.planted) && s.planted.precheck_flags === true).map((s) => s.id);
  const judgmentIds = KEY.sets.filter((s) => isObj(s.planted) && s.planted.precheck_flags !== true).map((s) => s.id);
  const split = MODELS.map((model) => {
    const s = models[model].metrics.detection_split;
    return `${model} ${s.precheck_flagged.k}/${s.precheck_flagged.n} precheck-flagged, `
      + `${s.judgment_only.k}/${s.judgment_only.n} judgment-only`;
  }).join('; ');
  notes.push(`precheck_flags split of detection (verify trd-pre flags ${flaggedIds.join(', ')}; judgment only on `
    + `${judgmentIds.join(', ')}): ${split}`);
  const abstained = scored.filter((r) => r.verdict === 'none');
  if (abstained.length) notes.push(`no verdict heading, scored as abstain: ${abstained.length} (${idList(abstained)})`);
  const badYaml = scored.filter((r) => r.yaml === 'error');
  if (badYaml.length) {
    notes.push(`Structured Issues YAML not parseable, scored from the Markdown sections: ${badYaml.length} (${idList(badYaml)})`);
  }
  if (noRecord.length) notes.push(`no record.json (not scored): ${noRecord.join(', ')}`);
  if (ignored.length) notes.push(`ignored run dirs: ${ignored.join(', ')}`);

  const publicRun = (r) => {
    const out = { ...r };
    delete out.planted;
    delete out.precheck_flags;
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

module.exports = { score, outcomeFor, parseChecker, descKey };
