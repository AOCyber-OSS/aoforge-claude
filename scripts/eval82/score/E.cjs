'use strict';
/**
 * Scorer for objective 82's batch E (TRD 82-05; SC-1, SC-2): the re-run build cell beside objective 81's recorded
 * build runs.
 *
 *   score({root, outDir, rates?, e81Path?, homeParent?, realHome?, now?}) -> the result, with
 *     extra_files {'82-MEASUREMENT.md': renderMeasurement(result)}
 *   renderResults(saved) -> results/E.md
 *
 * Inputs, read only:
 *   - `<root>/runs/E/<id>/record.json` for b82-r1, b82-r2 and, when recorded, the control b30c-r1 (no record, or a
 *     dry_run / skipped_budget record, is "not run"); collect outputs from record.outputs, else outputs/outputs.json;
 *     transcripts through objective 81's lib/roles.cjs rolesForRun (per spawn, the same rule 81's E scorer used, so
 *     the columns compare);
 *   - objective 81's results/E.json (default: this repository's committed copy): its `per_role[v].build` cells for
 *     3.0.0 and 3.1.0 and its build rows of `runs[]`; 81's Claude Code version from E.json `claude_version`, else the
 *     sibling prereg-manifest.json;
 *   - per run, lib/guessed-paths.cjs scanGuessedPaths over the transcripts (never record.access alone) beside the
 *     runner's recorded `real`, `guessed_nonexistent` and `tilde_denied` counts.
 *
 * Columns: 3.0.0 and 3.1.0 are objective 81's recorded cells; 3.1.0-82 the new runs; 3.0.0-82 the control when it
 * ran. Deltas are new (3.1.0-82) minus each recorded column, of the medians and the means; the percentage is of the
 * recorded median. Role cells count only runs that ended ok (per spawn; n is spawns).
 *
 * Guessed runtime paths: `guessed_home` (an absolute path the agent built under the home's parent) is the defect
 * signal. `tilde` counts `~` inputs for the record: the Read tool expands `~`, so a `~` Read is not a failure. A run
 * with no transcripts is "not scanned", never a zero; the section says "none" only when every run was scanned and all
 * five counts (tilde, guessed_home, real, guessed_nonexistent, tilde_denied) are 0 (a run with no recorded access is
 * not a known zero).
 *
 * Nothing here writes, spawns or touches ~/.claude; `now` and the scan's home are parameters so a test is exact.
 */

const fs = require('fs');
const path = require('path');

const { rolesForRun, ORCHESTRATOR } = require('../../eval81/lib/roles.cjs');
const { stats } = require('../../eval81/score/E.cjs');
const { BUILD_PROMPT, describeFixture } = require('../../eval81/fixtures/E/build.cjs');
const E82 = require('../batches/E.cjs');
const { scanRun, defaultHomeParent, defaultRealHome } = require('../lib/guessed-paths.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const REPO_E81 = path.join(REPO_ROOT, '.aoforge', 'objectives', '81-haiku-eval-and-model-efficiency-measurement', 'results', 'E.json');
const REPORT_NAME = '82-MEASUREMENT.md';
const RECORDED = ['3.0.0', '3.1.0'];
const NEW_COL = '3.1.0-82';
const CONTROL_COL = '3.0.0-82';
const ROLE_ORDER = ['orchestrator', 'planner', 'job-checker', 'executor', 'verifier'];
const METRICS = ['first_turn_input', 'total_tokens', 'cache_writes', 'cost_usd', 'wall_s'];
const METRIC_NAMES = {
  first_turn_input: 'first-turn input', total_tokens: 'total tokens', cache_writes: 'cache writes', cost_usd: 'cost (USD)', wall_s: 'wall (s)',
};
const NOT_RUN = ['dry_run', 'skipped_budget'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v) => (isNum(v) ? v : null);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const round2 = (x) => Math.round(x * 100) / 100;

function readJsonIf(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`score E: ${file} is not valid JSON: ${err.message}`);
  }
}

function readOutputs(runDir, record) {
  if (isObj(record.outputs) && 'acceptance' in record.outputs) return record.outputs;
  const v = readJsonIf(path.join(runDir, 'outputs', 'outputs.json'));
  return isObj(v) && 'acceptance' in v ? v : null;
}

const columnOf = (id) => (id === E82.CONTROL[0] ? CONTROL_COL : NEW_COL);
const roleRank = (role) => (ROLE_ORDER.includes(role) ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length);
const sortRoles = (roles) => [...roles].sort((a, b) => roleRank(a) - roleRank(b) || (a < b ? -1 : a > b ? 1 : 0));

function runRow(id, record, outputs, roles) {
  const readable = roles.rows.filter((r) => r.readable);
  const orch = readable.find((r) => r.role === ORCHESTRATOR && !r.agent_id) || null;
  const tests = outputs && isObj(outputs.tests) ? outputs.tests : null;
  let wall = null;
  if (isNum(record.wall_ms)) wall = record.wall_ms / 1000;
  else if (isNum(record.duration_ms)) wall = record.duration_ms / 1000;
  else if (orch) wall = orch.wall_s;
  const subjects = outputs && Array.isArray(outputs.git_log_subjects) ? outputs.git_log_subjects : null;
  const row = {
    id,
    column: columnOf(id),
    source_81: E82.sourceId(id),
    status: record.status,
    session_model: typeof record.model === 'string' ? record.model : null,
    claude_version: typeof record.claude_version === 'string' ? record.claude_version : null,
    cost_usd: numOrNull(record.cost_usd),
    priced_cost_usd: roles.cost_usd,
    charged_usd: numOrNull(record.charged_usd),
    first_turn_input: orch ? orch.first_turn_input : numOrNull(record.first_turn_input),
    total_tokens: readable.length ? readable.reduce((s, r) => s + r.total_tokens, 0) : null,
    cache_writes: readable.length ? readable.reduce((s, r) => s + r.cache_writes, 0) : null,
    wall_s: wall === null ? null : round6(wall),
    spawns: roles.spawns,
    acceptance: outputs && isObj(outputs.acceptance) && typeof outputs.acceptance.pass === 'boolean' ? outputs.acceptance.pass : null,
    tests_ok: tests && typeof tests.ok === 'boolean' ? tests.ok : null,
    tests_pass: tests ? numOrNull(tests.pass) : null,
    tests_fail: tests ? numOrNull(tests.fail) : null,
    verification_status: outputs && typeof outputs.verification_status === 'string' ? outputs.verification_status : null,
    trd_count: outputs ? numOrNull(outputs.trd_count) : null,
    summaries: outputs ? numOrNull(outputs.summaries) : null,
    upgrade_commit: subjects ? subjects.some((s) => E82.UPGRADE_SUBJECT.test(s)) : null,
    flags: [],
  };
  if (row.status !== 'ok') row.flags.push(`status ${row.status}: per run only, not in the role cells`);
  if (!roles.readable) row.flags.push(`transcripts unreadable (${roles.reason})`);
  if (roles.partial) row.flags.push(`${roles.unpriced_messages} transcript message(s) with no rate`);
  if (!outputs) row.flags.push('no collect outputs');
  return row;
}

function pickCell(cell) {
  if (!isObj(cell)) return null;
  const out = { spawns: numOrNull(cell.spawns), runs: numOrNull(cell.runs) };
  for (const m of METRICS) {
    const s = isObj(cell[m]) ? cell[m] : {};
    out[m] = { n: numOrNull(s.n), median: numOrNull(s.median), mean: numOrNull(s.mean), min: numOrNull(s.min), max: numOrNull(s.max) };
  }
  return out;
}

function delta(from, to) {
  if (!from || !to || !isNum(from.median) || !isNum(to.median)) return { median: null, mean: null, median_pct: null };
  return {
    median: round6(to.median - from.median),
    mean: isNum(from.mean) && isNum(to.mean) ? round6(to.mean - from.mean) : null,
    median_pct: from.median !== 0 ? round2(((to.median - from.median) / from.median) * 100) : null,
  };
}

function claudeVersion81(e81, e81Path) {
  if (e81 && typeof e81.claude_version === 'string') return e81.claude_version;
  const manifest = e81Path ? readJsonIf(path.join(path.dirname(e81Path), 'prereg-manifest.json')) : null;
  return manifest && typeof manifest.claude_version === 'string' ? manifest.claude_version : null;
}

function guessedVerdict(rows) {
  const anyFound = rows.some((g) => g.tilde > 0 || g.guessed_home > 0
    || (isObj(g.recorded) && (g.recorded.real > 0 || g.recorded.guessed_nonexistent > 0 || g.recorded.tilde_denied > 0)));
  if (anyFound) return 'found';
  if (rows.length === 0 || rows.some((g) => !g.scanned || !isObj(g.recorded))) return 'incomplete';
  return 'none';
}

/** score(...) -> the batch E result (see the module comment). */
function score({ root, outDir, rates, e81Path = REPO_E81, homeParent = defaultHomeParent(), realHome = defaultRealHome(), now = () => new Date() } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score E: root is required');
  const runs = [];
  const excluded = [];
  const cells = { [NEW_COL]: {}, [CONTROL_COL]: {} };
  const guessed = [];

  for (const id of E82.ALL_IDS) {
    const runDir = path.join(root, 'runs', 'E', id);
    const record = readJsonIf(path.join(runDir, 'record.json'));
    if (!isObj(record)) {
      if (id !== E82.CONTROL[0]) excluded.push({ id, reason: 'not run (no record)' });
      continue;
    }
    if (NOT_RUN.includes(record.status)) {
      excluded.push({ id, reason: `not run (${record.status})` });
      continue;
    }
    const roles = rolesForRun(runDir, rates ? { rates } : {});
    const row = runRow(id, record, readOutputs(runDir, record), roles);
    runs.push(row);
    const scan = scanRun(runDir, { homeParent, realHome });
    guessed.push({
      id,
      scanned: scan.files_scanned > 0,
      files_scanned: scan.files_scanned,
      tool_uses_scanned: scan.tool_uses_scanned,
      tilde: scan.tilde,
      guessed_home: scan.guessed_home,
      recorded: scan.recorded,
      entries: scan.entries.map(({ class: cls, tool, field, path: p, denied, file }) => ({ class: cls, tool, field, path: p, denied, file })),
    });
    if (row.status !== 'ok') {
      excluded.push({ id, reason: `status ${row.status}: per run only, not in the role cells` });
      continue;
    }
    const grid = cells[row.column];
    for (const r of roles.rows) {
      if (!r.readable) continue;
      const cell = grid[r.role] || (grid[r.role] = { rows: [], runs: new Set() });
      cell.rows.push(r);
      cell.runs.add(id);
    }
  }

  const e81 = readJsonIf(e81Path);
  const perRole = {};
  for (const v of RECORDED) {
    perRole[v] = {};
    const build = e81 && isObj(e81.per_role) && isObj(e81.per_role[v]) && isObj(e81.per_role[v].build) ? e81.per_role[v].build : {};
    for (const role of sortRoles(Object.keys(build))) {
      const c = pickCell(build[role]);
      if (c) perRole[v][role] = c;
    }
  }
  for (const col of [NEW_COL, CONTROL_COL]) {
    perRole[col] = {};
    for (const role of sortRoles(Object.keys(cells[col]))) {
      const c = cells[col][role];
      const entry = { spawns: c.rows.length, runs: c.runs.size };
      for (const m of METRICS) entry[m] = stats(c.rows.map((r) => r[m]));
      entry.models = [...new Set(c.rows.map((r) => r.model).filter(Boolean))].sort();
      perRole[col][role] = entry;
    }
  }
  const columns = [...RECORDED, NEW_COL, ...(Object.keys(perRole[CONTROL_COL]).length || runs.some((r) => r.column === CONTROL_COL) ? [CONTROL_COL] : [])];
  if (!columns.includes(CONTROL_COL)) delete perRole[CONTROL_COL];

  const deltas = {};
  const allRoles = sortRoles(new Set(columns.flatMap((c) => Object.keys(perRole[c] || {}))));
  for (const role of allRoles) {
    deltas[role] = {};
    for (const m of METRICS) {
      const to = perRole[NEW_COL][role] ? perRole[NEW_COL][role][m] : null;
      deltas[role][m] = Object.fromEntries(RECORDED.map((v) => [`vs_${v}`, delta(perRole[v][role] ? perRole[v][role][m] : null, to)]));
    }
  }

  const recordedRuns = (e81 && Array.isArray(e81.runs) ? e81.runs : []).filter((r) => isObj(r) && r.workflow === 'build').map((r) => ({
    id: r.id,
    version: r.version,
    status: r.status,
    acceptance: typeof r.acceptance === 'boolean' ? r.acceptance : null,
    tests_ok: typeof r.tests_ok === 'boolean' ? r.tests_ok : null,
    verification_status: typeof r.verification_status === 'string' ? r.verification_status : null,
    trd_count: numOrNull(r.trd_count),
    summaries: numOrNull(r.summaries),
    cost_usd: numOrNull(r.cost_usd),
    charged_usd: numOrNull(r.charged_usd),
    first_turn_input: numOrNull(r.first_turn_input),
    total_tokens: numOrNull(r.total_tokens),
    wall_s: numOrNull(r.wall_s),
  }));

  const sum = (k) => guessed.reduce((s, g) => s + g[k], 0);
  const guessedPaths = {
    runs: guessed,
    tilde_total: sum('tilde'),
    guessed_home_total: sum('guessed_home'),
    verdict: guessedVerdict(guessed),
    home_parent: homeParent,
  };

  const flagged = runs.filter((r) => r.flags.length).map((r) => ({ id: r.id, flags: r.flags }));
  const result = {
    batch: 'E',
    objective: 82,
    workload: { project: describeFixture().name, build_prompt: BUILD_PROMPT, ids: E82.ALL_IDS.filter((id) => runs.some((r) => r.id === id) || id !== E82.CONTROL[0]) },
    columns,
    recorded_81: {
      source: e81Path ? (e81Path.startsWith(REPO_ROOT + path.sep) ? path.relative(REPO_ROOT, e81Path) : path.basename(e81Path)) : null,
      found: Boolean(e81),
      build_runs: recordedRuns.map((r) => r.id),
    },
    claude_versions: { 81: claudeVersion81(e81, e81Path), 82: [...new Set(runs.map((r) => r.claude_version).filter(Boolean))].sort() },
    runs,
    recorded_runs: recordedRuns,
    per_role: perRole,
    deltas,
    guessed_paths: guessedPaths,
    flagged,
    excluded,
    notes: [
      'Role cells count only runs that ended ok, per spawn; n is spawns (runs).',
      `Deltas are ${NEW_COL} minus each recorded column (objective 81's results/E.json build cells).`,
      'Guessed runtime paths come from the transcripts (lib/guessed-paths.cjs), beside the runner\'s recorded access classes.',
    ],
  };
  result.extra_files = { [REPORT_NAME]: renderMeasurement(result, { generatedAt: now().toISOString() }) };
  return result;
}

// ─── Rendering ──────────────────────────────────────────────────────────────────────────────────────────────

const NA = 'n/a';

function int(n) {
  if (!isNum(n)) return NA;
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return r < 0 ? `-${s}` : s;
}
const money = (n) => (isNum(n) ? n.toFixed(4) : NA);
const fmt = (metric, n) => (metric === 'cost_usd' ? money(n) : int(n));
const signed = (metric, n) => (isNum(n) && n > 0 ? `+${fmt(metric, n)}` : fmt(metric, n));
const pct = (n) => (isNum(n) ? `${n > 0 ? '+' : ''}${n.toFixed(2)}%` : NA);
const yesNo = (b) => (b === true ? 'yes' : b === false ? 'no' : NA);
const deltaCell = (metric, d) => (d && isNum(d.median) ? `${signed(metric, d.median)} (${pct(d.median_pct)})` : NA);
const meanDeltaCell = (metric, d) => (d && isNum(d.mean) ? signed(metric, d.mean) : NA);

function roleTable(result, stat) {
  const cols = result.columns;
  const head = `| Role | Metric | ${cols.map((c) => `${c} ${stat}`).join(' | ')} | new - 3.0.0 | new - 3.1.0 |`;
  const lines = [head, `|---|---|${cols.map(() => '---:|').join('')}---:|---:|`];
  for (const role of Object.keys(result.deltas)) {
    for (const m of METRICS) {
      const vals = cols.map((c) => {
        const cell = result.per_role[c] && result.per_role[c][role];
        return cell ? fmt(m, cell[m][stat]) : NA;
      });
      const d = result.deltas[role][m];
      const cell = stat === 'median' ? deltaCell : meanDeltaCell;
      lines.push(`| ${role} | ${METRIC_NAMES[m]} | ${vals.join(' | ')} | ${cell(m, d['vs_3.0.0'])} | ${cell(m, d['vs_3.1.0'])} |`);
    }
  }
  return lines;
}

function spawnsText(spawns) {
  return sortRoles(Object.keys(spawns || {})).map((r) => `${r} ${spawns[r]}`).join(', ') || NA;
}

function recordedCells(g) {
  if (!isObj(g.recorded)) return ['not recorded', 'not recorded', 'not recorded'];
  return [g.recorded.real, g.recorded.guessed_nonexistent, g.recorded.tilde_denied].map(String);
}

function guessedSection(result) {
  const g = result.guessed_paths;
  const lines = [];
  if (g.verdict === 'none') {
    lines.push('Guessed runtime paths: none (every run scanned; tilde, guessed_home, real, guessed_nonexistent and tilde_denied all 0).', '');
  } else if (g.verdict === 'incomplete') {
    lines.push('Guessed runtime paths: no counts above zero, but not every run is a known zero (a run not scanned or with no recorded access).', '');
  } else {
    lines.push(`Guessed runtime paths: ${g.guessed_home_total} guessed-home input(s) and ${g.tilde_total} \`~\` input(s) across the scanned runs.`, '');
  }
  lines.push(
    '`guessed_home` is the defect signal: an absolute path under the home\'s parent the agent built itself instead of '
      + 'using `~` or a path it was handed. `tilde` counts `~` inputs for the record; the Read tool expands `~`, so a `~` '
      + 'Read is not a failure. The recorded columns are the runner\'s `record.access` classes, which miss an allowed `~` '
      + 'Read by design; the scan columns come from the transcripts.',
    '',
    '| Run | Scan | tilde | guessed_home | real (recorded) | guessed_nonexistent (recorded) | tilde_denied (recorded) |',
    '|---|---|---:|---:|---:|---:|---:|',
  );
  for (const r of g.runs) {
    const scan = r.scanned ? ['scanned', String(r.tilde), String(r.guessed_home)] : ['not scanned', NA, NA];
    lines.push(`| ${r.id} | ${scan.join(' | ')} | ${recordedCells(r).join(' | ')} |`);
  }
  const offending = g.runs.flatMap((r) => r.entries.map((e) => ({ id: r.id, ...e })));
  if (offending.length) {
    lines.push('', 'Inputs (redacted):', '');
    for (const e of offending) lines.push(`- ${e.id}: ${e.class} ${e.tool} \`${e.path}\`${e.denied ? ' (denied)' : ''}${e.file ? ` in ${e.file}` : ' (from the permission denials)'}`);
  }
  return lines;
}

/** renderMeasurement(result, {generatedAt}) -> 82-MEASUREMENT.md. */
function renderMeasurement(result, { generatedAt = null } = {}) {
  const n81 = (v) => result.recorded_runs.filter((r) => r.version === v).length;
  const nNew = result.runs.filter((r) => r.column === NEW_COL).length;
  const cv = result.claude_versions;
  const lines = [
    '# Objective 82: build-cell re-measurement (3.1.0)',
    '',
    `Generated ${generatedAt || NA} by scripts/eval82/score.cjs --batch E.`,
    '',
    '## Method',
    '',
    `Objective 81's build cell (\`/aoforge:build\` on the notekit fixture, ${E82.PROFILE} profile) re-run on the 3.1.0 tree `
      + 'through objective 81\'s frozen runner with scripts/eval82/batches/E.cjs: the same descriptors as 81\'s b31-r1 and '
      + `b31-r2 but for id, order and a $${E82.E_RUN_CAP_USD} cap (a test proves the rest identical). Columns 3.0.0 and 3.1.0 `
      + `are objective 81's recorded build cells (${result.recorded_81.source || NA}); ${NEW_COL} is this objective's runs`
      + `${result.columns.includes(CONTROL_COL) ? `; ${CONTROL_COL} is the 3.0.0 control on today's Claude Code` : ''}. `
      + 'Per-role figures are per spawn from the copied transcripts (objective 81\'s lib/roles.cjs); deltas are new minus each '
      + 'recorded column.',
    '',
    '## Outcomes',
    '',
    '| Run | Column | Status | Acceptance | Tests | Verification | TRDs | Summaries | Cost (reported) | Charged |',
    '|---|---|---|---|---|---|---:|---:|---:|---:|',
  ];
  for (const r of result.recorded_runs) {
    lines.push(`| ${r.id} | ${r.version} (81) | ${r.status} | ${yesNo(r.acceptance)} | ${yesNo(r.tests_ok)} | ${r.verification_status || NA} | ${int(r.trd_count)} | ${int(r.summaries)} | ${money(r.cost_usd)} | ${money(r.charged_usd)} |`);
  }
  for (const r of result.runs) {
    lines.push(`| ${r.id} | ${r.column} | ${r.status} | ${yesNo(r.acceptance)} | ${yesNo(r.tests_ok)} | ${r.verification_status || NA} | ${int(r.trd_count)} | ${int(r.summaries)} | ${money(r.cost_usd)} | ${money(r.charged_usd)} |`);
  }
  if (result.excluded.length) {
    lines.push('', 'Not in the table:', '');
    for (const e of result.excluded) lines.push(`- ${e.id}: ${e.reason}`);
  }
  lines.push('', '## Per role', '', 'Medians:', '', ...roleTable(result, 'median'), '', 'Means:', '', ...roleTable(result, 'mean'), '');
  lines.push('## Per run', '', '| Run | Column | First-turn input | Total tokens | Cache writes | Priced cost | Wall (s) | Spawns | Claude Code |', '|---|---|---:|---:|---:|---:|---:|---|---|');
  for (const r of result.runs) {
    lines.push(`| ${r.id} | ${r.column} | ${int(r.first_turn_input)} | ${int(r.total_tokens)} | ${int(r.cache_writes)} | ${money(r.priced_cost_usd)} | ${int(r.wall_s)} | ${spawnsText(r.spawns)} | ${r.claude_version || NA} |`);
  }
  for (const f of result.flagged) lines.push('', `- ${f.id}: ${f.flags.join('; ')}`);
  lines.push('', '## Guessed runtime paths', '', ...guessedSection(result), '');
  lines.push('## Mechanism checks', '', '_Filled by TRD 82-09._', '');
  lines.push(
    '## Limits',
    '',
    `- n=${nNew} vs n=${n81('3.1.0')} (and n=${n81('3.0.0')} for 3.0.0): enough to see a large per-role shift, not to `
      + 'estimate a small one.',
    `- Claude Code version: objective 81 ran ${cv[81] || 'n/a (not recorded)'}; these runs ${cv[82].length ? cv[82].join(', ') : 'n/a'}. `
      + 'A difference between them is a confound the per-role deltas cannot separate from the plugin change.',
    '- The planner decides the TRD count, so a run with a different TRD count is a different workload.',
    '',
  );
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

/** renderResults(saved) -> results/E.md: the per-run outcomes, the guessed-path table and the spend line. */
function renderResults(saved) {
  const lines = [`# Batch E (objective 82) results`, '', `Scored at ${saved.scored_at || NA}. Full report: ${REPORT_NAME}.`, ''];
  lines.push('| Run | Column | Status | Acceptance | Verification | Priced cost | Charged |', '|---|---|---|---|---|---:|---:|');
  for (const r of saved.runs) lines.push(`| ${r.id} | ${r.column} | ${r.status} | ${yesNo(r.acceptance)} | ${r.verification_status || NA} | ${money(r.priced_cost_usd)} | ${money(r.charged_usd)} |`);
  lines.push('', ...guessedSection(saved), '');
  if (saved.spend) lines.push(`Spend: batch E ${money(saved.spend.spent_usd)} USD (${saved.spend.status}); ledger total ${money(saved.spend.ledger_total_usd)} USD.`, '');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

module.exports = { score, renderMeasurement, renderResults, REPORT_NAME, REPO_E81, NEW_COL, CONTROL_COL };
