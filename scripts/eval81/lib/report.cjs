'use strict';

// Markdown renderers for the objective-81 Haiku eval (TRD 81-02).
//
// renderBatchTable(result)                            -> results/<X>.md beside results/<X>.json (score.cjs --batch)
// renderEvalReport({decisions, results, generatedAt}) -> 81-HAIKU-EVAL.md, the 76-06 report (score.cjs --report)
//
// Every proportion is printed as `k/n (rate%, 95% CI lo-hi%)` with the Wilson interval (81-DECISION-RULE.md
// section 4). The report states the outcome and reasons per role, the proposals, and that no tier was changed.
// Pure: no I/O. The tiers files are never touched here; proposals arrive as text inside `decisions`.

const { wilson, formatPct } = require('./stats.cjs');

const DECIDED_BATCHES = ['A', 'B', 'D', 'C'];
const CLOSING = "No tier assignment was changed by objective 81; proposals await the user's decision.";

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isKn = (v) => isObj(v) && Number.isFinite(v.k) && Number.isFinite(v.n) && v.k >= 0 && v.k <= v.n;
const isFab = (v) => isObj(v) && Number.isFinite(v.total) && Number.isFinite(v.runs);
const pct1 = (x) => (x * 100).toFixed(1);
const money = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');

/** formatProportion({k, n}) -> '8/9 (88.9%, 95% CI 56.5-98.0%)'; n = 0 -> '0/0 (n/a)'. */
function formatProportion(v) {
  const w = wilson(v.k, v.n);
  if (w.n === 0) return `${w.k}/${w.n} (n/a)`;
  return `${w.k}/${w.n} (${formatPct(w.rate)}, 95% CI ${pct1(w.low)}-${pct1(w.high)}%)`;
}

function formatFabrications(v) {
  const perRun = v.runs > 0 ? (v.total / v.runs).toFixed(2) : 'n/a';
  return `${v.total} in ${v.runs} runs (${perRun} per run)`;
}

function formatValue(v) {
  if (v === undefined || v === null) return 'n/a';
  if (isKn(v)) return formatProportion(v);
  if (isFab(v)) return formatFabrications(v);
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return String(v).replace(/\|/g, '\\|');
  return JSON.stringify(v).replace(/\|/g, '\\|');
}

/** flatten(metrics) -> [[name, value]]: nested groups of proportions become `parent.child` rows. */
function flatten(metrics, prefix = '') {
  const rows = [];
  for (const [name, value] of Object.entries(isObj(metrics) ? metrics : {})) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (isObj(value) && !isKn(value) && !isFab(value)) rows.push(...flatten(value, key));
    else rows.push([key, value]);
  }
  return rows;
}

/** metricRows(views, models, {primary}) -> table rows: metric name (primary first), then one cell per model. */
function metricRows(views, models, { primary = null } = {}) {
  const order = [];
  const byModel = {};
  for (const m of models) {
    byModel[m] = new Map(flatten(views[m] && views[m].metrics));
    for (const name of byModel[m].keys()) if (!order.includes(name)) order.push(name);
  }
  if (primary && order.includes(primary)) {
    order.splice(order.indexOf(primary), 1);
    order.unshift(primary);
  }
  return order.map((name) => {
    const label = name === primary ? `${name} (primary)` : name;
    return `| ${label} | ${models.map((m) => formatValue(byModel[m].get(name))).join(' | ')} |`;
  });
}

function scoredCell(v) {
  if (!v) return 'n/a';
  const n = Number.isFinite(v.n_scored) ? v.n_scored : '?';
  const p = Number.isFinite(v.planned) ? v.planned : '?';
  return `${n}/${p}`;
}

function wallCell(v) {
  return v && Number.isFinite(v.mean_wall_ms) ? `${(v.mean_wall_ms / 1000).toFixed(1)} s` : 'n/a';
}

/** renderSpendLine(spend) -> 'Spend: spent $1.30 of the batch; ledger total $1.70 (status complete, 2 runs).' */
function renderSpendLine(spend) {
  if (!isObj(spend)) return null;
  const runs = Array.isArray(spend.entries) ? spend.entries.length : 0;
  return `Spend: spent $${money(spend.spent_usd)} of the batch; ledger total $${money(spend.ledger_total_usd)} `
    + `(status ${spend.status}, ${runs} runs).`;
}

function plannedFor(result, entry, model) {
  const m = entry.models[model];
  if (isObj(m) && Number.isFinite(m.planned)) return m.planned;
  if (isObj(entry.planned) && Number.isFinite(entry.planned[model])) return entry.planned[model];
  if (isObj(result.planned) && Number.isFinite(result.planned[model])) return result.planned[model];
  return null;
}

/** renderBatchTable(result) -> Markdown for results/<X>.md: one table per role, exclusions, notes, spend. */
function renderBatchTable(result) {
  const r = isObj(result) ? result : {};
  const lines = [`# Batch ${r.batch || '?'} results`, ''];
  const planned = isObj(r.planned)
    ? ` Planned runs: ${Object.entries(r.planned).map(([m, n]) => `${m} ${n}`).join(', ')}.`
    : '';
  lines.push(`Scored at ${r.scored_at || 'n/a'}.${planned}`, '');

  const roles = isObj(r.roles) ? Object.entries(r.roles).filter(([, e]) => isObj(e) && isObj(e.models)) : [];
  if (roles.length === 0) {
    lines.push('No per-role model metrics in this result; see the batch\'s own report.', '');
  }
  for (const [role, entry] of roles) {
    const models = Object.keys(entry.models);
    const views = {};
    for (const m of models) {
      const v = entry.models[m];
      views[m] = { n_scored: isObj(v) ? v.n_scored : null, planned: plannedFor(r, entry, m),
        metrics: isObj(v) ? v.metrics : {}, cost_usd: isObj(v) ? v.cost_usd : null,
        mean_wall_ms: isObj(v) ? v.mean_wall_ms : null };
    }
    lines.push(`## ${role}`, '');
    if (entry.primary) lines.push(`Primary metric: ${entry.primary}.`, '');
    lines.push(`| Metric | ${models.join(' | ')} |`, `|---|${models.map(() => '---|').join('')}`);
    lines.push(`| runs scored / planned | ${models.map((m) => scoredCell(views[m])).join(' | ')} |`);
    lines.push(...metricRows(views, models));
    lines.push(`| cost (USD) | ${models.map((m) => money(views[m].cost_usd)).join(' | ')} |`);
    lines.push(`| mean wall time | ${models.map((m) => wallCell(views[m])).join(' | ')} |`, '');
  }

  const excluded = Array.isArray(r.excluded) ? r.excluded : [];
  if (excluded.length) {
    lines.push('## Excluded (not in n)', '');
    for (const e of excluded) lines.push(`- ${e.id}: ${e.reason}${e.role ? ` (${e.role})` : ''}`);
    lines.push('');
  }
  const notes = Array.isArray(r.notes) ? r.notes : [];
  if (notes.length) {
    lines.push('## Notes', '');
    for (const n of notes) lines.push(`- ${n}`);
    lines.push('');
  }
  const spend = renderSpendLine(r.spend);
  if (spend) lines.push(spend, '');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function diffCell(d) {
  if (d === null || d === undefined) return 'n/a';
  return `${d >= 0 ? '+' : '-'}${(Math.abs(d) * 100).toFixed(1)}`;
}

/** renderEvalReport({decisions, results, generatedAt}) -> 81-HAIKU-EVAL.md. */
function renderEvalReport({ decisions, results = {}, generatedAt }) {
  const roles = Object.values((decisions && decisions.roles) || {});
  const gate = (decisions && decisions.gate) || { status: 'unestablished', a_false_pass: null, reason: 'not computed' };
  const lines = [
    '# Objective 81: Haiku 5.5 vs Sonnet 5.5 eval (76-06)',
    '',
    `Generated ${generatedAt} by \`node scripts/eval81/score.cjs --report\`, applying the pre-registered rule in `
      + '`81-DECISION-RULE.md` to `results/{A,B,C,D}.json`. Batch E (76-08) is reported in `81-MEASUREMENT.md`.',
    '',
    'Outcomes are REFUSE, WEAK_ENDORSE or INSUFFICIENT. WEAK_ENDORSE is the most this design can give: small n can '
      + 'refuse but only weakly endorse. Proportions are `k/n (rate%, 95% CI lo-hi%)` with the Wilson 95% interval; '
      + 'differences are Haiku minus Sonnet in points on point estimates.',
    '',
    '## A gate',
    '',
  ];
  const fp = gate.a_false_pass;
  lines.push(`Haiku false passes in A: ${fp ? formatProportion(fp) : 'n/a'}: ${gate.status} (${gate.reason}).`, '');

  lines.push('## Summary', '',
    '| Role | Batch | Primary | Haiku | Sonnet | Haiku minus Sonnet (points) | Outcome |',
    '|---|---|---|---|---|---|---|');
  for (const d of roles) {
    const h = d.haiku && d.haiku.primary ? formatProportion(d.haiku.primary) : 'n/a';
    const s = d.sonnet && d.sonnet.primary ? formatProportion(d.sonnet.primary) : 'n/a';
    lines.push(`| ${d.role} | ${d.batch || 'n/a'} | ${d.primary || 'n/a'} | ${h} | ${s} | ${diffCell(d.diff_points)} | ${d.outcome} |`);
  }
  lines.push('', '## Roles', '');

  for (const d of roles) {
    lines.push(`### ${d.role} (batch ${d.batch || 'n/a'}): ${d.outcome}`, '');
    if (d.haiku || d.sonnet) {
      const views = { haiku: d.haiku, sonnet: d.sonnet };
      const models = ['haiku', 'sonnet'];
      lines.push('| Metric | Haiku | Sonnet |', '|---|---|---|');
      lines.push(`| runs scored / planned | ${scoredCell(d.haiku)} | ${scoredCell(d.sonnet)} |`);
      lines.push(...metricRows(views, models, { primary: d.primary }));
      lines.push(`| cost (USD) | ${money(d.haiku && d.haiku.cost_usd)} | ${money(d.sonnet && d.sonnet.cost_usd)} |`);
      lines.push(`| mean wall time | ${wallCell(d.haiku)} | ${wallCell(d.sonnet)} |`, '');
    }
    lines.push('Reasons:', '');
    for (const reason of d.reasons || []) lines.push(`- ${reason}`);
    lines.push('');
  }

  lines.push('## Proposals', '',
    'Proposals are text for the user\'s decision (TRD 81-19). They follow `81-DECISION-RULE.md` section 7.', '');
  for (const d of roles) {
    if (d.proposal) {
      lines.push(`- ${d.role} (${d.outcome}): ${d.proposal.text} (${d.proposal.target}).${d.note ? ` Note: ${d.note}.` : ''}`);
    } else {
      lines.push(`- ${d.role} (${d.outcome}): no proposal.${d.note ? ` ${d.note}.` : ''}`);
    }
  }
  lines.push('');

  lines.push('## Spend', '', '| Batch | Status | Spent (USD) | Runs |', '|---|---|---|---|');
  for (const b of DECIDED_BATCHES) {
    const spend = isObj(results[b]) && isObj(results[b].spend) ? results[b].spend : null;
    if (!spend) lines.push(`| ${b} | not recorded | n/a | n/a |`);
    else lines.push(`| ${b} | ${spend.status} | ${money(spend.spent_usd)} | ${Array.isArray(spend.entries) ? spend.entries.length : 0} |`);
  }
  lines.push('');

  const notes = DECIDED_BATCHES.flatMap((b) => (isObj(results[b]) && Array.isArray(results[b].notes)
    ? results[b].notes.map((n) => `- ${b}: ${n}`) : []));
  if (notes.length) lines.push('## Batch notes', '', ...notes, '');

  lines.push(CLOSING);
  return `${lines.join('\n')}\n`;
}

module.exports = { renderEvalReport, renderBatchTable, renderSpendLine, formatProportion, CLOSING };
