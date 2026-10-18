'use strict';
/**
 * Scorer for objective 82's batch C (TRD 82-06; SC-3 for P4 and P5, SC-2 for the researcher runs).
 *
 *   score({root, outDir, c81Path?, homeParent?, realHome?}) -> the batch C result
 *   renderResults(saved) -> results/C.md
 *
 * Reads every planned researcher run `<root>/runs/C/C82-res-<topic>-<dim>-<h|s>-<k>/record.json` and its grader run
 * `C82-grade-<id>`. A researcher run is GRADED only when its record is ok, its model ran as requested, no tool input
 * mentions an answer key or the harness (contamination), it collected a document, its grader run is ok and the grade
 * holds exactly one valid verdict for every checklist item (objective 81's rule). Anything else is `excluded` with its
 * reason (a planned run with no record is `not_run`) and is in no rate.
 *
 * Reported (test list 6):
 *   cells[topic][dim][model]   graded runs, found / items with a Wilson 95% interval (objective 81's lib/stats.cjs),
 *                              grader-reported fabrications (total and per graded run), the graded run ids
 *   pooled[dim][model]         the same over the two new topics (the P4/P5 rule's pooled recall and fabrications)
 *   item_matrix[topic][dim]    per checklist item, in how many graded runs Sonnet found it and Haiku found it
 *   runs                       per researcher run: verdict, counts, fabrications, researcher and grader cost
 *   cost                       charged totals (the ledger charges the larger of reported and transcript cost)
 *   guessed_paths              per researcher run with a record: objective 82's transcript scan
 *                              (lib/guessed-paths.cjs scanGuessedPaths: `tilde`, `guessed_home`, files and tool uses
 *                              scanned) beside the runner's recorded classes (recordedAccess: `real`,
 *                              `guessed_nonexistent`, `tilde_denied`, or 'not_recorded'). Never record.access alone:
 *                              an allowed `~` Read is not recorded by the runner. `tilde` is counted for the record
 *                              (the Read tool expands `~`); `guessed_home` is the defect signal. A run whose
 *                              transcripts hold nothing is `scanned: false`, never a clean zero. `recorded_entries`
 *                              lists the runner's recorded accesses (class, tool, redacted path) for the SC-2 verdict.
 *   recorded_81                objective 81's own topic, carried from its results/C.json (architecture and pitfalls
 *                              roles and runs) without recomputation. 81's C.json holds no item-level verdicts, so
 *                              its topic is aggregate only and says so.
 */

const fs = require('node:fs');
const path = require('node:path');

const C82 = require('../batches/C.cjs');
const C81 = require('../../eval81/batches/C.cjs');
const { wilson } = require('../../eval81/lib/stats.cjs');
const { toolInputsMentioning } = require('../../eval81/lib/result.cjs');
const { scanGuessedPaths, recordedAccess, defaultHomeParent, defaultRealHome } = require('../lib/guessed-paths.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_C81 = path.join(REPO_ROOT, '.aoforge', 'objectives', '81-haiku-eval-and-model-efficiency-measurement', 'results', 'C.json');
const VERDICTS = ['found', 'wrong', 'missing'];
// A tool input that mentions one of these means the run looked at an answer key or the harness.
const CONTAMINATION = [/scripts[\\/]eval8[12]/, /answer[-_ ]?key/i, /checklists-(?:82|researcher|synthetic)/, /82-CHECK-RULES/, /81-DECISION-RULE/];
const UNSPENT = ['dry_run', 'skipped_budget'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const costOf = (r) => (isNum(r.cost_usd) ? r.cost_usd : isNum(r.charged_usd) ? r.charged_usd : 0);
const chargedOf = (r) => (isNum(r.charged_usd) ? r.charged_usd : 0);

function readJsonOrNull(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The grade of a grader record: its collected `graded` object, else the structured output, else null. */
function gradeOf(found) {
  if (!found) return null;
  const outputs = found.outputs;
  if (isObj(outputs) && isObj(outputs.graded) && Array.isArray(outputs.graded.items)) return outputs.graded;
  const so = found.record.structured_output;
  if (isObj(so) && Array.isArray(so.items)) return { items: so.items, fabrications: Array.isArray(so.fabrications) ? so.fabrications : [] };
  return null;
}

/** One verdict per checklist item, or the reason the grade cannot be used (objective 81's resolveVerdicts rule). */
function resolveVerdicts(graded, checklist) {
  const ids = new Set(checklist.map((i) => i.id));
  const verdicts = new Map();
  for (const item of graded.items) {
    if (!isObj(item) || !ids.has(item.id)) continue;
    if (!VERDICTS.includes(item.verdict)) return { ok: false, reason: `ungraded: the grader gave no valid verdict for ${item.id}` };
    if (verdicts.has(item.id)) return { ok: false, reason: `ungraded: the grader gave two verdicts for ${item.id}` };
    verdicts.set(item.id, item.verdict);
  }
  const left = checklist.filter((i) => !verdicts.has(i.id)).length;
  if (left > 0) return { ok: false, reason: `ungraded: the grader left ${left} of ${checklist.length} items without a verdict` };
  return { ok: true, verdicts };
}

function isContaminated(found) {
  if (found.record.contaminated === true || (isObj(found.outputs) && found.outputs.contaminated === true)) return true;
  let stream;
  try {
    stream = fs.readFileSync(path.join(found.dir, 'stream.jsonl'), 'utf8');
  } catch {
    return false;
  }
  return toolInputsMentioning(stream, CONTAMINATION).length > 0;
}

/** Judge one planned researcher run: {verdict, reason, verdicts?, fabrications?, record, grader}. */
function judge(entry, root) {
  const found = C81.readRunRecord(root, entry.id);
  const gFound = C81.readRunRecord(root, C82.graderId(entry.id));
  const base = { found, gFound };
  if (!found) return { ...base, verdict: 'not_run', reason: 'no record' };
  const r = found.record;
  if (UNSPENT.includes(r.status)) return { ...base, verdict: 'not_run', reason: `status ${r.status}` };
  if (r.status !== 'ok') return { ...base, verdict: 'excluded', reason: `status ${r.status}` };
  if (r.model_ran === false) return { ...base, verdict: 'excluded', reason: 'model_ran false: the run did not use the requested model' };
  if (isContaminated(found)) return { ...base, verdict: 'excluded', reason: 'contaminated: a tool input mentions an answer key or the harness' };
  if (!isObj(found.outputs) || typeof found.outputs.document !== 'string' || found.outputs.document.trim() === '') {
    return { ...base, verdict: 'excluded', reason: 'no document (recorded absence)' };
  }
  if (!gFound) return { ...base, verdict: 'excluded', reason: 'ungraded: no grader run' };
  if (gFound.record.status !== 'ok') return { ...base, verdict: 'excluded', reason: `ungraded: grader status ${gFound.record.status}` };
  const graded = gradeOf(gFound);
  if (!graded) return { ...base, verdict: 'excluded', reason: 'ungraded: the grader returned no valid grade' };
  const resolved = resolveVerdicts(graded, C82.checklistFor(entry.topic, entry.dimension));
  if (!resolved.ok) return { ...base, verdict: 'excluded', reason: resolved.reason };
  const fabrications = Array.isArray(graded.fabrications) ? graded.fabrications.length : 0;
  return { ...base, verdict: 'graded', reason: null, verdicts: resolved.verdicts, fabrications };
}

function emptyCell() {
  return { graded_runs: 0, found: 0, items: 0, fabrications_total: 0, runs: [] };
}

function finishCell(c, planned) {
  return {
    planned,
    graded_runs: c.graded_runs,
    recall: wilson(c.found, c.items),
    fabrications_total: c.fabrications_total,
    fabrications_per_run: c.graded_runs ? round6(c.fabrications_total / c.graded_runs) : null,
    runs: c.runs,
  };
}

/** Objective 81's topic: its architecture and pitfalls researcher roles and runs, carried without recomputation. */
function recorded81(c81Path) {
  const rel = path.relative(REPO_ROOT, c81Path).split(path.sep).join('/');
  const j = readJsonOrNull(c81Path);
  if (!isObj(j) || !isObj(j.roles)) {
    return { source: rel, item_level: false, roles: null, runs: [], note: `objective 81's C.json not found or unreadable at ${rel}: the 81 topic is not reported` };
  }
  const roles = {};
  for (const dim of C82.DIMENSIONS) {
    const role = j.roles[`project-researcher:${dim}`];
    roles[dim] = {};
    for (const model of C82.MODELS) {
      const m = role && isObj(role.models) ? role.models[model] : null;
      roles[dim][model] = m ? {
        n_scored: m.n_scored,
        recall: m.metrics && m.metrics.recall ? { k: m.metrics.recall.k, n: m.metrics.recall.n } : null,
        fabrications: m.metrics && m.metrics.fabrications ? { total: m.metrics.fabrications.total, runs: m.metrics.fabrications.runs } : null,
        cost_usd: isNum(m.cost_usd) ? m.cost_usd : null,
        grader_cost_usd: isNum(m.grader_cost_usd) ? m.grader_cost_usd : null,
      } : null;
    }
  }
  const runs = (Array.isArray(j.runs) ? j.runs : [])
    .filter((r) => isObj(r) && /^project-researcher:(architecture|pitfalls)$/.test(r.role))
    .map((r) => ({
      id: r.id,
      model: r.model,
      dimension: r.role.split(':')[1],
      verdict: r.verdict,
      found: r.found,
      wrong: r.wrong,
      missing: r.missing,
      items: r.items,
      grader_fabrications: r.grader_fabrications,
    }));
  const itemLevel = runs.length > 0 && (Array.isArray(j.items) || (Array.isArray(j.runs) && j.runs.some((r) => isObj(r) && Array.isArray(r.item_verdicts))));
  return {
    source: rel,
    item_level: itemLevel,
    roles,
    runs,
    note: itemLevel
      ? 'objective 81\'s topic: recorded context, not voting (82-CHECK-RULES.md section 2)'
      : 'objective 81\'s topic: recorded context, not voting; its C.json holds no item-level verdicts, so it is aggregate only (recall, fabrications, cost)',
  };
}

/** The runner's recorded accesses as [{class, tool, path}] (paths as the runner redacted them), for the SC-2 verdict. */
function recordedEntries(record) {
  const a = isObj(record) && isObj(record.access) ? record.access : null;
  if (!a) return [];
  const pick = (e) => ({ class: e.class, tool: typeof e.tool === 'string' ? e.tool : null, path: typeof e.path === 'string' ? e.path : null });
  return [...(Array.isArray(a.real) ? a.real : []), ...(Array.isArray(a.non_escape) ? a.non_escape : [])].filter(isObj).map(pick);
}

/** score(...) -> the batch C result (see the module comment). */
function score({ root, c81Path = DEFAULT_C81, homeParent = defaultHomeParent(), realHome = defaultRealHome() } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score C: root is required');
  const entries = C82.plan();
  const cells = {};
  for (const t of C82.TOPICS) {
    cells[t] = {};
    for (const d of C82.DIMENSIONS) cells[t][d] = Object.fromEntries(C82.MODELS.map((m) => [m, emptyCell()]));
  }
  const pooled = Object.fromEntries(C82.DIMENSIONS.map((d) => [d, Object.fromEntries(C82.MODELS.map((m) => [m, emptyCell()]))]));
  const matrix = {};
  for (const t of C82.TOPICS) {
    matrix[t] = {};
    for (const d of C82.DIMENSIONS) {
      matrix[t][d] = C82.checklistFor(t, d).map((i) => ({ id: i.id, sonnet_found: 0, sonnet_graded: 0, haiku_found: 0, haiku_graded: 0 }));
    }
  }

  const runs = [];
  const guessed = [];
  const charged = { haiku: 0, sonnet: 0 };
  let graderCharged = 0;
  for (const entry of entries) {
    const j = judge(entry, root);
    const r = j.found ? j.found.record : null;
    const g = j.gFound ? j.gFound.record : null;
    const row = {
      id: entry.id,
      topic: entry.topic,
      dimension: entry.dimension,
      model: entry.model,
      repeat: entry.repeat,
      status: r ? r.status || null : 'not_run',
      verdict: j.verdict,
      reason: j.reason,
      found: null,
      wrong: null,
      missing: null,
      items: null,
      fabrications: null,
      grader_id: C82.graderId(entry.id),
      grader_status: g ? g.status || null : null,
      cost_usd: r ? round6(costOf(r)) : null,
      charged_usd: r ? round6(chargedOf(r)) : null,
      grader_cost_usd: g ? round6(costOf(g)) : null,
      grader_charged_usd: g ? round6(chargedOf(g)) : null,
    };
    if (r) charged[entry.model] += chargedOf(r);
    if (g) graderCharged += chargedOf(g);
    if (j.verdict === 'graded') {
      const counts = { found: 0, wrong: 0, missing: 0 };
      for (const v of j.verdicts.values()) counts[v] += 1;
      Object.assign(row, counts, { items: j.verdicts.size, fabrications: j.fabrications });
      for (const c of [cells[entry.topic][entry.dimension][entry.model], pooled[entry.dimension][entry.model]]) {
        c.graded_runs += 1;
        c.found += counts.found;
        c.items += j.verdicts.size;
        c.fabrications_total += j.fabrications;
        c.runs.push(entry.id);
      }
      for (const item of matrix[entry.topic][entry.dimension]) {
        item[`${entry.model}_graded`] += 1;
        if (j.verdicts.get(item.id) === 'found') item[`${entry.model}_found`] += 1;
      }
    }
    runs.push(row);

    if (r && !UNSPENT.includes(r.status)) {
      const scan = scanGuessedPaths({
        transcriptsDir: path.join(j.found.dir, 'transcripts'),
        denials: Array.isArray(r.permission_denials) ? r.permission_denials : [],
        homeParent,
        realHome,
      });
      const recorded = recordedAccess(r);
      guessed.push({
        id: entry.id,
        status: r.status || null,
        files_scanned: scan.files_scanned,
        tool_uses_scanned: scan.tool_uses_scanned,
        scanned: scan.files_scanned >= 1 && scan.tool_uses_scanned >= 1,
        tilde: scan.tilde,
        guessed_home: scan.guessed_home,
        recorded: recorded === null ? 'not_recorded' : recorded,
        entries: scan.entries,
        recorded_entries: recordedEntries(r),
      });
    }
  }

  const finishedCells = {};
  for (const t of C82.TOPICS) {
    finishedCells[t] = {};
    for (const d of C82.DIMENSIONS) finishedCells[t][d] = Object.fromEntries(C82.MODELS.map((m) => [m, finishCell(cells[t][d][m], C82.TOPICS.length)]));
  }
  const finishedPooled = Object.fromEntries(C82.DIMENSIONS.map((d) => [d, Object.fromEntries(C82.MODELS.map((m) => [m, finishCell(pooled[d][m], C82.TOPICS.length * 2)]))]));
  const rec = (g, k) => (isObj(g.recorded) ? g.recorded[k] : 0);
  const totals = {
    runs: guessed.length,
    scanned: guessed.filter((g) => g.scanned).length,
    unscanned: guessed.filter((g) => !g.scanned).length,
    tilde: guessed.reduce((s, g) => s + g.tilde, 0),
    guessed_home: guessed.reduce((s, g) => s + g.guessed_home, 0),
    real: guessed.reduce((s, g) => s + rec(g, 'real'), 0),
    guessed_nonexistent: guessed.reduce((s, g) => s + rec(g, 'guessed_nonexistent'), 0),
    tilde_denied: guessed.reduce((s, g) => s + rec(g, 'tilde_denied'), 0),
    not_recorded: guessed.filter((g) => g.recorded === 'not_recorded').length,
  };
  const researcherCharged = { haiku: round6(charged.haiku), sonnet: round6(charged.sonnet) };
  return {
    batch: 'C',
    objective: 82,
    topics: [...C82.TOPICS],
    dimensions: [...C82.DIMENSIONS],
    models: [...C82.MODELS],
    planned: { researcher: entries.length, per_cell: 2 },
    cells: finishedCells,
    pooled: finishedPooled,
    item_matrix: matrix,
    runs,
    cost: {
      researcher_charged_usd: researcherCharged,
      grader_charged_usd: round6(graderCharged),
      total_charged_usd: round6(charged.haiku + charged.sonnet + graderCharged),
    },
    guessed_paths: { runs: guessed, totals, home_parent: homeParent },
    recorded_81: recorded81(c81Path),
    notes: [
      'Graded runs only enter recall and fabrications; a run excluded or not run is listed with its reason.',
      'Guessed paths are scanned from each researcher run\'s transcripts; `tilde` is counted for the record (the Read tool expands `~`), `guessed_home` is the defect signal, and the runner\'s recorded classes stand beside them.',
      'Objective 81\'s topic is recorded context, not voting (82-CHECK-RULES.md section 2).',
    ],
  };
}

// ─── Rendering ──────────────────────────────────────────────────────────────────────────────────────────────────

const NA = 'n/a';
const pctShort = (x) => `${(x * 100).toFixed(1)}%`;
const wcell = (w) => (w && w.rate !== null ? `${w.k}/${w.n} (${pctShort(w.rate)}, ${pctShort(w.low)}-${pctShort(w.high)})` : w ? `${w.k}/${w.n}` : NA);
const usd = (x) => (isNum(x) ? `$${x.toFixed(4)}` : NA);
const num = (x) => (x === null || x === undefined ? NA : String(x));

function recordedText(r) {
  return r === 'not_recorded' ? 'not recorded' : `real ${r.real}, guessed_nonexistent ${r.guessed_nonexistent}, tilde_denied ${r.tilde_denied}`;
}

/** renderResults(saved) -> results/C.md. */
function renderResults(saved) {
  const lines = [
    '# Batch C (objective 82) results',
    '',
    `Scored ${saved.scored_at || NA}. The project-researcher (architecture and pitfalls) at haiku and sonnet on two new topics (${saved.topics.join(', ')}), 2 runs per topic, dimension and model, each graded blind by Sonnet against fixtures/C/checklists-82.json. Recall is found / checklist items over the graded runs, with a Wilson 95% interval (objective 81's lib/stats.cjs).`,
    '',
    '## Recall per topic',
    '',
    '| Topic | Dimension | Model | Graded runs | Recall (Wilson 95%) | Fabrications | Per run |',
    '|---|---|---|---:|---|---:|---:|',
  ];
  for (const t of saved.topics) {
    for (const d of saved.dimensions) {
      for (const m of saved.models) {
        const c = saved.cells[t][d][m];
        lines.push(`| ${t} | ${d} | ${m} | ${c.graded_runs} | ${wcell(c.recall)} | ${c.fabrications_total} | ${num(c.fabrications_per_run)} |`);
      }
    }
  }
  lines.push('', '## Pooled over the new topics', '', '| Dimension | Model | Graded runs | Recall (Wilson 95%) | Fabrications per run |', '|---|---|---:|---|---:|');
  for (const d of saved.dimensions) {
    for (const m of saved.models) {
      const c = saved.pooled[d][m];
      lines.push(`| ${d} | ${m} | ${c.graded_runs} | ${wcell(c.recall)} | ${num(c.fabrications_per_run)} |`);
    }
  }
  lines.push('', '## Item matrix', '', 'Per checklist item: graded runs that found it, Sonnet and Haiku (found/graded).', '');
  for (const t of saved.topics) {
    for (const d of saved.dimensions) {
      lines.push(`### ${t} / ${d}`, '', '| Item | Sonnet | Haiku |', '|---|---|---|');
      for (const row of saved.item_matrix[t][d]) lines.push(`| ${row.id} | ${row.sonnet_found}/${row.sonnet_graded} | ${row.haiku_found}/${row.haiku_graded} |`);
      lines.push('');
    }
  }
  lines.push('## Per run', '', '| Run | Status | Verdict | Found | Wrong | Missing | Items | Fabrications | Cost | Charged | Grader charged | Reason |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of saved.runs) {
    lines.push(`| ${r.id} | ${r.status || NA} | ${r.verdict} | ${num(r.found)} | ${num(r.wrong)} | ${num(r.missing)} | ${num(r.items)} | ${num(r.fabrications)} | ${usd(r.cost_usd)} | ${usd(r.charged_usd)} | ${usd(r.grader_charged_usd)} | ${r.reason || ''} |`);
  }
  const c = saved.cost;
  lines.push('', '## Cost', '', `Charged: researcher haiku ${usd(c.researcher_charged_usd.haiku)}, researcher sonnet ${usd(c.researcher_charged_usd.sonnet)}, graders ${usd(c.grader_charged_usd)}; total ${usd(c.total_charged_usd)}.`);
  if (isObj(saved.spend)) lines.push(`Ledger: batch C ${saved.spend.status}, spent ${usd(saved.spend.spent_usd)}; ledger total ${usd(saved.spend.ledger_total_usd)}.`);

  const g = saved.guessed_paths;
  lines.push(
    '',
    '## Guessed runtime paths',
    '',
    'From each researcher run\'s transcripts (Read, Glob, Grep inputs; scripts/eval82/lib/guessed-paths.cjs) beside the runner\'s recorded classes. `guessed_home` (an absolute path the agent built under the home\'s parent) is the defect; `tilde` is counted for the record (the Read tool expands `~`). A run with no transcripts or no tool use is "not scanned", never zero. 82-CHECK-RULES.md section 4 decides what these numbers mean.',
    '',
    '| Run | Scan | tilde | guessed_home | Recorded (runner) |',
    '|---|---|---:|---:|---|',
  );
  for (const r of g.runs) {
    const scan = r.scanned ? `${r.files_scanned} file(s), ${r.tool_uses_scanned} tool use(s)` : `not scanned (${r.files_scanned} file(s), ${r.tool_uses_scanned} tool use(s))`;
    lines.push(`| ${r.id} | ${scan} | ${r.tilde} | ${r.guessed_home} | ${recordedText(r.recorded)} |`);
    for (const e of r.entries) lines.push(`|  | ${e.class} ${e.tool}.${e.field}${e.denied ? ' (denied)' : ''} \`${e.path}\` | | | |`);
  }
  const t = g.totals;
  lines.push('', `Totals: ${t.runs} run(s), ${t.scanned} scanned, ${t.unscanned} not scanned; tilde ${t.tilde}, guessed_home ${t.guessed_home}; recorded real ${t.real}, guessed_nonexistent ${t.guessed_nonexistent}, tilde_denied ${t.tilde_denied}; access not recorded on ${t.not_recorded}.`);

  const rec = saved.recorded_81;
  lines.push('', '## Objective 81 topic (recorded context)', '', `${rec.note} (source \`${rec.source}\`).`, '');
  if (rec.roles) {
    lines.push('| Dimension | Model | Scored runs | Recall | Fabrications | Cost | Grader cost |', '|---|---|---:|---|---|---:|---:|');
    for (const d of saved.dimensions) {
      for (const m of saved.models) {
        const x = rec.roles[d][m];
        if (!x) {
          lines.push(`| ${d} | ${m} | ${NA} | ${NA} | ${NA} | ${NA} | ${NA} |`);
          continue;
        }
        const rcell = x.recall ? wcell(wilson(x.recall.k, x.recall.n)) : NA;
        const fab = x.fabrications ? `${x.fabrications.total} over ${x.fabrications.runs} run(s)` : NA;
        lines.push(`| ${d} | ${m} | ${num(x.n_scored)} | ${rcell} | ${fab} | ${usd(x.cost_usd)} | ${usd(x.grader_cost_usd)} |`);
      }
    }
  }
  lines.push('', '## Notes', '');
  for (const n of saved.notes) lines.push(`- ${n}`);
  return `${lines.join('\n')}\n`;
}

module.exports = { score, renderResults, resolveVerdicts, recorded81, DEFAULT_C81, CONTAMINATION };
