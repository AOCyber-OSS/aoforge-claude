'use strict';
/**
 * Objective 82's pre-registered rules as code (TRD 82-06). 82-CHECK-RULES.md is the text; where the two disagree the
 * text wins and this module is fixed test-first as a post-hoc amendment.
 *
 *   p1Verdict(dResult)                   section 1: P1 (UI judge starts at haiku), from results/D.json (score/D.cjs)
 *   researcherVerdict(cResult, dim)      section 2: P4 (architecture) / P5 (pitfalls), from results/C.json (score/C.cjs)
 *   fixListAsApplied(diagnosisText)      section 3: 82-DIAGNOSIS.md's Fix list rows, `## Fix applied` taken into account
 *   mechanismChecks(perRun, fixRows)     section 3: every FIX row's category count per new E run, plus the outcomes
 *   attributionForRun(runDir, {id, outcome})  one perRun entry from lib/attribution.cjs (planner and executor spawns)
 *   guessedPathVerdict(rows)             section 4: SC-2 over per-run scan rows (lib/guessed-paths.cjs) and recorded classes
 *   renderTierChecks({d, c})             82-TIER-CHECKS.md (P1, P4, P5, objective 81's topic as context, SC-2 for C)
 *
 * Every function is pure over its inputs except attributionForRun (reads transcripts). Verdicts never read a Wilson
 * interval: the intervals are printed beside the numbers and decide nothing.
 */

const path = require('node:path');

const { wilson } = require('../eval81/lib/stats.cjs');
const attribution = require('./lib/attribution.cjs');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const frac = (w) => (w && isNum(w.k) && isNum(w.n) ? (w.n > 0 ? `${w.k}/${w.n} (${pct(w.k / w.n)}, ${pct(w.low)}-${pct(w.high)})` : `${w.k}/${w.n}`) : 'n/a');
const usd = (x) => (isNum(x) ? `$${x.toFixed(4)}` : 'n/a');
const verdictLabel = (v) => (v.inconclusive ? 'REVERT (inconclusive)' : v.verdict);

// ─── Section 1: P1 ──────────────────────────────────────────────────────────────────────────────────────────────

/** p1Verdict(d) -> {proposal, verdict, inconclusive, clauses, failing, deciding, incomplete, numbers}. */
function p1Verdict(d) {
  const base = { proposal: 'P1', verdict: 'REVERT', inconclusive: true, clauses: [], failing: [], incomplete: [], numbers: null };
  if (!isObj(d) || !isObj(d.arms) || !isObj(d.cost)) {
    return { ...base, deciding: 'inconclusive: results/D.json is missing or has no arms and cost, so P1 reverts (section 1)' };
  }
  const { haiku_start: hs, haiku: h, sonnet: s } = d.arms;
  const incomplete = [];
  for (const [label, arm] of [['haiku start', hs], ['haiku', h], ['sonnet', s]]) {
    if (!isObj(arm) || !isObj(arm.accuracy)) incomplete.push(`${label} arm missing`);
    else for (const id of arm.incomplete || []) incomplete.push(`${id} (${label})`);
  }
  const hCost = d.cost.haiku_start && d.cost.haiku_start.total_usd;
  const sCost = d.cost.sonnet_start && d.cost.sonnet_start.total_usd;
  if (!isNum(hCost) || !isNum(sCost)) incomplete.push('a cost total is missing');
  if (incomplete.length) {
    return { ...base, incomplete, deciding: `inconclusive: incomplete ${incomplete.join(', ')}; an incomplete batch D reverts P1 (section 1)` };
  }
  const missed = hs.broken_missed;
  const accH = hs.accuracy;
  const accS = s.accuracy;
  const clauses = [
    {
      id: 'broken_missed',
      rule: 'broken_missed(Haiku start, final) = 0',
      numbers: `${frac(missed)} broken states ended ok`,
      holds: missed.k === 0,
      text: `broken_missed(Haiku start, final) = ${missed.k} of ${missed.n} broken states, needs 0`,
    },
    {
      id: 'accuracy',
      rule: 'accuracy(Haiku start) >= accuracy(Sonnet start)',
      numbers: `${frac(accH)} vs ${frac(accS)}`,
      holds: accH.k * accS.n >= accS.k * accH.n,
      text: `accuracy(Haiku start) ${accH.k}/${accH.n} < ${accS.k}/${accS.n} accuracy(Sonnet start)`,
    },
    {
      id: 'cost',
      rule: 'cost(Haiku start) < cost(Sonnet start)',
      numbers: `${usd(hCost)} vs ${usd(sCost)}`,
      holds: hCost < sCost,
      text: `cost(Haiku start) ${usd(hCost)} is not below ${usd(sCost)} cost(Sonnet start)`,
    },
  ];
  const failing = clauses.filter((c) => !c.holds).map((c) => c.id);
  const deciding = failing.length
    ? clauses.filter((c) => !c.holds).map((c) => c.text).join('; ')
    : `all three conditions hold: broken_missed 0 of ${missed.n}, accuracy ${accH.k}/${accH.n} >= ${accS.k}/${accS.n}, cost ${usd(hCost)} < ${usd(sCost)}`;
  return {
    proposal: 'P1',
    verdict: failing.length ? 'REVERT' : 'KEEP',
    inconclusive: false,
    clauses,
    failing,
    deciding,
    incomplete: [],
    numbers: {
      broken_missed: missed,
      accuracy_haiku_start: accH,
      accuracy_sonnet_start: accS,
      cost_haiku_start_usd: hCost,
      cost_sonnet_start_usd: sCost,
      escalation_rate_haiku: h.escalation_rate || null,
      split_rate_haiku: h.split_rate || null,
      escalation_rate_sonnet: s.escalation_rate || null,
      escalated_agreement: d.escalated_agreement || null,
      false_fail_haiku_start: hs.false_fail || null,
      false_fail_sonnet_start: s.false_fail || null,
    },
  };
}

// ─── Section 2: P4 / P5 ─────────────────────────────────────────────────────────────────────────────────────────

const PROPOSAL_OF = { architecture: 'P4', pitfalls: 'P5' };
const TOPICS = ['gateway', 'hub'];
const MODELS = ['haiku', 'sonnet'];

/** researcherVerdict(c, dim) -> {proposal, dimension, verdict, inconclusive, clauses, failing, deciding, lost_items, short_cells, numbers}. */
function researcherVerdict(c, dimension) {
  const proposal = PROPOSAL_OF[dimension];
  if (!proposal) throw new Error(`researcherVerdict: unknown dimension ${dimension}`);
  const base = { proposal, dimension, verdict: 'REVERT', inconclusive: true, clauses: [], failing: [], lost_items: [], short_cells: [], numbers: null };
  if (!isObj(c) || !isObj(c.cells) || !isObj(c.pooled) || !isObj(c.item_matrix)) {
    return { ...base, deciding: `inconclusive: results/C.json is missing or incomplete, so ${proposal} reverts (section 2)` };
  }
  const short = [];
  for (const t of TOPICS) {
    for (const m of MODELS) {
      const cell = c.cells[t] && c.cells[t][dimension] && c.cells[t][dimension][m];
      const runs = cell && isNum(cell.graded_runs) ? cell.graded_runs : 0;
      if (runs < 2) short.push({ topic: t, model: m, graded_runs: runs });
    }
  }
  const pooled = c.pooled[dimension];
  if (short.length || !isObj(pooled) || !isObj(pooled.haiku) || !isObj(pooled.sonnet)) {
    const text = short.map((x) => `${x.topic} ${x.model}: ${x.graded_runs} graded run${x.graded_runs === 1 ? '' : 's'}`).join(', ');
    return { ...base, short_cells: short, deciding: `inconclusive: fewer than 2 graded runs (${text || 'no pooled numbers'}), so ${proposal} reverts (section 2)` };
  }

  const lost = [];
  for (const t of TOPICS) {
    for (const item of (c.item_matrix[t] && c.item_matrix[t][dimension]) || []) {
      if (item.sonnet_graded === 2 && item.sonnet_found === 2 && item.haiku_graded === 2 && item.haiku_found === 0) lost.push({ topic: t, id: item.id });
    }
  }
  const rh = pooled.haiku.recall;
  const rs = pooled.sonnet.recall;
  // found_h / items_h < found_s / items_s - 0.10, in integers: 10*kh*ns < 10*ks*nh - ns*nh.
  const recallFails = rh.n > 0 && rs.n > 0 ? 10 * rh.k * rs.n < 10 * rs.k * rh.n - rs.n * rh.n : true;
  const fh = pooled.haiku.fabrications_total;
  const fs = pooled.sonnet.fabrications_total;
  const nh = pooled.haiku.graded_runs;
  const ns = pooled.sonnet.graded_runs;
  // fh/nh > fs/ns + 0.5, in integers: 2*fh*ns > 2*fs*nh + nh*ns.
  const fabFails = 2 * fh * ns > 2 * fs * nh + nh * ns;
  const gapPts = rh.n > 0 && rs.n > 0 ? ((rs.k / rs.n - rh.k / rh.n) * 100).toFixed(1) : 'n/a';
  const fpr = (f, n) => (n ? Math.round((f / n) * 1e6) / 1e6 : null);
  const clauses = [
    {
      id: 'item_lost',
      rule: 'no item found by Sonnet in both runs and by Haiku in neither, on a topic',
      numbers: lost.length ? lost.map((x) => `${x.topic} ${x.id}`).join(', ') : 'none',
      holds: lost.length === 0,
      text: `item lost: ${lost.map((x) => `${x.topic} ${x.id}`).join(', ')} (Sonnet 2 of 2 runs, Haiku 0 of 2)`,
    },
    {
      id: 'recall',
      rule: 'pooled Haiku recall not more than 10 points below pooled Sonnet recall',
      numbers: `pooled Haiku recall ${frac(rh)} vs Sonnet ${frac(rs)}; Haiku ${gapPts} points below`,
      holds: !recallFails,
      text: `pooled Haiku recall ${rh.k}/${rh.n} is more than 10 points below Sonnet's ${rs.k}/${rs.n} (${gapPts} points)`,
    },
    {
      id: 'fabrications',
      rule: 'Haiku fabrications per graded run not more than Sonnet\'s + 0.5',
      numbers: `Haiku ${fh} over ${nh} run(s) (${fpr(fh, nh)} per run) vs Sonnet ${fs} over ${ns} (${fpr(fs, ns)} per run)`,
      holds: !fabFails,
      text: `Haiku fabrications ${fpr(fh, nh)} per run exceed Sonnet's ${fpr(fs, ns)} + 0.5`,
    },
  ];
  const failing = clauses.filter((x) => !x.holds).map((x) => x.id);
  return {
    proposal,
    dimension,
    verdict: failing.length ? 'REVERT' : 'KEEP',
    inconclusive: false,
    clauses,
    failing,
    deciding: failing.length
      ? clauses.filter((x) => !x.holds).map((x) => x.text).join('; ')
      : `no item lost, pooled recall ${rh.k}/${rh.n} vs ${rs.k}/${rs.n} (${gapPts} points), fabrications ${fpr(fh, nh)} vs ${fpr(fs, ns)} per run`,
    lost_items: lost,
    short_cells: [],
    numbers: { pooled_haiku: pooled.haiku, pooled_sonnet: pooled.sonnet },
  };
}

// ─── Section 3: the Fix list and the mechanism checks ───────────────────────────────────────────────────────────

/** The `## <name>` section of a markdown text (to the next `## ` heading), or null. */
function section(text, name) {
  const lines = String(text).split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${name}`);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end);
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/**
 * fixListAsApplied(diagnosisText) -> [{id, cause, disposition, category, target, listed, applied}] in table order.
 * `listed` is the Fix list's disposition, `applied` the one `## Fix applied` gives on the line beginning with the row id
 * (the first of the words FIX / JUSTIFY on it; null when there is no such line or word), `disposition` the final one.
 */
function fixListAsApplied(text) {
  const list = section(text, 'Fix list');
  if (!list) throw new Error('82-DIAGNOSIS.md has no "## Fix list" section');
  const rows = [];
  for (const line of list) {
    if (!line.trim().startsWith('|')) continue;
    const c = cells(line);
    if (c.length < 7 || c[0] === 'id' || /^-+$/.test(c[0])) continue;
    rows.push({ id: c[0], cause: c[1], disposition: c[2], category: c[5], target: c[6], listed: c[2], applied: null });
  }
  const applied = section(text, 'Fix applied');
  if (applied) {
    for (const row of rows) {
      const esc = row.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const head = new RegExp(`^\\s*(?:\\|\\s*|[-*]\\s+|#{3,4}\\s+)(?:\\*\\*)?${esc}(?:\\*\\*)?(?![\\w-])`);
      const line = applied.find((l) => head.test(l));
      if (!line) continue;
      const m = /\b(FIX|JUSTIFY)\b/.exec(line.replace(head, ''));
      if (!m) continue;
      row.applied = m[1];
      row.disposition = m[1];
    }
  }
  return rows;
}

// Tool calls of a spawn list, or null when a spawn has no per-call listing.
function toolsOf(spawns) {
  const out = [];
  for (const s of spawns) {
    if (!Array.isArray(s.call_list)) return null;
    for (const call of s.call_list) for (const t of call.tools || []) out.push(t);
  }
  return out;
}
const touches = (t, cat) => (Array.isArray(t.also) ? t.also : [t.category]).includes(cat);
const detailOf = (t) => String(t.detail || '');
const mentionsSum = (spawns, cat) => spawns.reduce((s, x) => s + ((x.mentions && x.mentions[cat]) || 0), 0);
const isCommitInvestigation = (t) => touches(t, 'tool_investigation') && /commit/i.test(detailOf(t));
const notMeasurable = (why) => ({ measurable: false, reason: `not measurable: ${why}` });

function needSpawns(run, role) {
  const list = run.roles && Array.isArray(run.roles[role]) ? run.roles[role] : [];
  return list.length ? list : null;
}

/**
 * The pre-registered machine check of each FIX row (82-CHECK-RULES.md section 3). category_cell and target_cell are
 * the Fix list's cells verbatim; a row whose cells differ fails ("changed after pre-registration").
 * measure(run) -> {measurable: true, count, pass, text} | {measurable: false, reason}
 */
const MECHANISM_SPECS = {
  'P-1': {
    roles: ['planner'],
    category_cell: '`runtime_lookup` (templates) and `runtime_read:templates/trd-prompt.md` mentions on planner spawns',
    target_cell: '0',
    measure(run) {
      const sp = needSpawns(run, 'planner');
      if (!sp) return notMeasurable('no planner spawn');
      const tools = toolsOf(sp);
      if (!tools) return notMeasurable('a planner spawn has no per-call listing');
      const count = tools.filter((t) => touches(t, 'runtime_read:templates/trd-prompt.md') || (touches(t, 'runtime_lookup') && /templates/.test(detailOf(t)))).length;
      return { measurable: true, count, pass: count === 0, text: `${count} template lookup(s)/read(s), target 0` };
    },
  },
  'P-2': {
    roles: ['planner', 'executor'],
    category_cell: '`commit_inspect`, `raw_commit`, `tool_investigation` (commit) mentions',
    target_cell: '0 on the planner; executors not above 3.0.0\'s (3 and 1)',
    executor_bounds: { commit_inspect: 3, tool_investigation_commit: 1 },
    measure(run) {
      const sp = needSpawns(run, 'planner');
      if (!sp) return notMeasurable('no planner spawn');
      const ex = needSpawns(run, 'executor');
      if (!ex) return notMeasurable('no executor spawn');
      const pt = toolsOf(sp);
      const et = toolsOf(ex);
      if (!pt || !et) return notMeasurable('a spawn has no per-call listing');
      const planner = pt.filter((t) => touches(t, 'commit_inspect') || touches(t, 'raw_commit') || isCommitInvestigation(t)).length;
      const inspect = mentionsSum(ex, 'commit_inspect');
      const invest = et.filter(isCommitInvestigation).length;
      const b = MECHANISM_SPECS['P-2'].executor_bounds;
      const pass = planner === 0 && inspect <= b.commit_inspect && invest <= b.tool_investigation_commit;
      return {
        measurable: true,
        count: { planner, executor_commit_inspect: inspect, executor_tool_investigation_commit: invest },
        pass,
        text: `planner ${planner} (target 0); executor commit_inspect ${inspect} (<= 3), commit tool_investigation ${invest} (<= 1)`,
      };
    },
  },
  'P-3': {
    roles: ['planner'],
    category_cell: '`draft_write` (`written` chars per TRD)',
    target_cell: 'at most 22,000 chars per TRD on the notekit build',
    limit: 22000,
    measure(run) {
      const sp = needSpawns(run, 'planner');
      if (!sp) return notMeasurable('no planner spawn');
      const tools = toolsOf(sp);
      if (!tools) return notMeasurable('a planner spawn has no per-call listing');
      const perTrd = new Map();
      for (const t of tools) {
        if (!touches(t, 'draft_write') || !/TRD\.md$/.test(detailOf(t))) continue;
        const chars = isNum(t.input_chars) ? t.input_chars : 0;
        perTrd.set(detailOf(t), Math.max(perTrd.get(detailOf(t)) || 0, chars));
      }
      if (perTrd.size === 0) return notMeasurable('no TRD draft write seen on the planner');
      const max = Math.max(...perTrd.values());
      const count = Object.fromEntries([...perTrd.entries()].map(([k, v]) => [path.posix.basename(k), v]));
      return { measurable: true, count, pass: max <= 22000, text: `largest TRD write ${max} chars over ${perTrd.size} TRD(s), at most 22,000` };
    },
  },
  'P-4': {
    roles: ['planner'],
    category_cell: '`tool_investigation` (non-commit) mentions',
    target_cell: '0',
    measure(run) {
      const sp = needSpawns(run, 'planner');
      if (!sp) return notMeasurable('no planner spawn');
      const tools = toolsOf(sp);
      if (!tools) return notMeasurable('a planner spawn has no per-call listing');
      const count = tools.filter((t) => touches(t, 'tool_investigation') && !isCommitInvestigation(t)).length;
      return { measurable: true, count, pass: count === 0, text: `${count} non-commit tool investigation(s), target 0` };
    },
  },
  'E-1': mentionSpec('`runtime_read:templates/summary.md` mentions on executor spawns', 'runtime_read:templates/summary.md'),
  'E-2': mentionSpec('`runtime_read:references/tdd.md` mentions on executor spawns', 'runtime_read:references/tdd.md'),
  'E-4': mentionSpec('`guessed_runtime_path` mentions', 'guessed_runtime_path'),
  'E-5': {
    roles: ['executor'],
    category_cell: '`draft_write` tool errors (`is_error`) and `draft_write` count',
    target_cell: '0 errors, at most 2 writes per executor',
    measure(run) {
      const ex = needSpawns(run, 'executor');
      if (!ex) return notMeasurable('no executor spawn');
      let maxWrites = 0;
      let errors = 0;
      for (const s of ex) {
        const tools = toolsOf([s]);
        if (!tools) return notMeasurable('an executor spawn has no per-call listing');
        const writes = tools.filter((t) => touches(t, 'draft_write'));
        maxWrites = Math.max(maxWrites, writes.length);
        errors += writes.filter((t) => t.is_error === true).length;
      }
      return {
        measurable: true,
        count: { errors, max_writes_per_executor: maxWrites },
        pass: errors === 0 && maxWrites <= 2,
        text: `${errors} draft_write error(s) (target 0), at most ${maxWrites} write(s) per executor (<= 2)`,
      };
    },
  },
  'X-1': {
    roles: ['planner'],
    category_cell: '`validate_publish` tool errors (`is_error`)',
    target_cell: '0',
    measure(run) {
      const sp = needSpawns(run, 'planner');
      if (!sp) return notMeasurable('no planner spawn');
      const tools = toolsOf(sp);
      if (!tools) return notMeasurable('a planner spawn has no per-call listing');
      const count = tools.filter((t) => touches(t, 'validate_publish') && t.is_error === true).length;
      return { measurable: true, count, pass: count === 0, text: `${count} validate_publish error(s), target 0` };
    },
  },
};

function mentionSpec(categoryCell, category) {
  return {
    roles: ['executor'],
    category_cell: categoryCell,
    target_cell: '0',
    measure(run) {
      const ex = needSpawns(run, 'executor');
      if (!ex) return notMeasurable('no executor spawn');
      const count = mentionsSum(ex, category);
      return { measurable: true, count, pass: count === 0, text: `${count} \`${category}\` mention(s) on executor spawns, target 0` };
    },
  };
}

function outcomeOf(run) {
  const o = isObj(run.outcome) ? run.outcome : {};
  const pass = o.acceptance === true && o.tests_ok === true && o.verification_status === 'passed';
  return {
    run: run.id,
    acceptance: o.acceptance === undefined ? null : o.acceptance,
    tests_ok: o.tests_ok === undefined ? null : o.tests_ok,
    verification_status: o.verification_status === undefined ? null : o.verification_status,
    pass,
  };
}

/**
 * mechanismChecks(perRun, fixRows) -> {verdict, effect_shown, outcomes_hold, checks, outcomes, failures, rows_checked,
 * rows_skipped}. perRun: [{id, outcome: {acceptance, tests_ok, verification_status}, roles: {planner: [spawn],
 * executor: [spawn]}}] (attributionForRun); fixRows: fixListAsApplied(...) (or rows of the same shape).
 */
function mechanismChecks(perRun, fixRows) {
  const runs = Array.isArray(perRun) ? perRun : [];
  const rows = Array.isArray(fixRows) ? fixRows : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const checked = [];
  const skipped = [];
  for (const r of rows) {
    if (r.disposition === 'FIX') checked.push(r.id);
    else skipped.push({ id: r.id, reason: r.applied === 'JUSTIFY' ? 'JUSTIFY in ## Fix applied' : `${r.disposition} in the Fix list` });
  }
  const absent = Object.keys(MECHANISM_SPECS).filter((id) => !byId.has(id));
  const order = [...checked, ...absent];

  const checks = [];
  for (const id of order) {
    const spec = MECHANISM_SPECS[id];
    const row = byId.get(id);
    for (const run of runs) {
      const base = { row: id, run: run.id, category: row ? row.category : spec.category_cell, target: row ? row.target : spec.target_cell };
      if (!row) {
        checks.push({ ...base, count: null, pass: false, reason: `row ${id} is absent from the Fix list (pre-registered as FIX)` });
        continue;
      }
      if (!spec) {
        checks.push({ ...base, count: null, pass: false, reason: `no pre-registered machine check for FIX row ${id} (a post-hoc amendment is needed)` });
        continue;
      }
      if (squash(row.category) !== squash(spec.category_cell) || squash(row.target) !== squash(spec.target_cell)) {
        checks.push({ ...base, count: null, pass: false, reason: `row ${id} changed after pre-registration (category or target cell differs)` });
        continue;
      }
      const m = spec.measure(run);
      if (!m.measurable) checks.push({ ...base, count: null, pass: false, reason: m.reason });
      else checks.push({ ...base, count: m.count, pass: m.pass, reason: m.text });
    }
  }
  const outcomes = runs.map(outcomeOf);
  const outcomesHold = runs.length > 0 && outcomes.every((o) => o.pass);
  const failures = [
    ...checks.filter((c) => !c.pass).map((c) => `${c.row} on ${c.run}: ${c.reason}`),
    ...outcomes.filter((o) => !o.pass).map((o) => `outcome on ${o.run}: acceptance ${o.acceptance}, tests_ok ${o.tests_ok}, verification ${o.verification_status}`),
  ];
  if (runs.length === 0) failures.push('no new E run to check');

  let verdict;
  let effect = null;
  if (order.length === 0) {
    verdict = `no FIX row to check: outcomes ${outcomesHold ? 'hold' : 'do not hold'}; totals reported only`;
  } else {
    effect = runs.length > 0 && failures.length === 0;
    verdict = effect ? 'effect shown' : 'effect not shown';
  }
  return { verdict, effect_shown: effect, outcomes_hold: outcomesHold, checks, outcomes, failures, rows_checked: checked, rows_skipped: skipped };
}

/** attributionForRun(runDir, {id, outcome}) -> a mechanismChecks perRun entry (planner and executor, with call lists). */
function attributionForRun(runDir, { id = path.basename(runDir), outcome = null } = {}) {
  const roles = {};
  for (const role of ['planner', 'executor']) roles[role] = attribution.summarizeRole(runDir, role, { calls: true }).spawns;
  return { id, outcome, roles };
}

// ─── Section 4: guessed runtime paths ───────────────────────────────────────────────────────────────────────────

const RECORDED_FAIL = ['real', 'guessed_nonexistent'];

/**
 * guessedPathVerdict(rows) -> {verdict: PASS|FAIL|INCONCLUSIVE, runs, failures, unscanned, not_recorded, counts,
 * informational, sentence}. A row: {id, files_scanned, tool_uses_scanned, tilde, guessed_home, entries,
 * recorded: {real, guessed_nonexistent, tilde_denied} | 'not_recorded', recorded_entries?: [{class, path}]}.
 * FAIL on a scanned guessed_home input or a recorded real / guessed_nonexistent access; INCONCLUSIVE when nothing
 * fails and a run is unscanned (or there is no run); PASS otherwise. `tilde` and `tilde_denied` are reported only.
 */
function guessedPathVerdict(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const failures = [];
  const unscanned = [];
  const notRecorded = [];
  const informational = [];
  const counts = { tilde: 0, guessed_home: 0, real: 0, guessed_nonexistent: 0, tilde_denied: 0 };
  for (const r of list) {
    const scanned = (r.files_scanned || 0) >= 1 && (r.tool_uses_scanned || 0) >= 1;
    if (!scanned) unscanned.push(r.id);
    const rec = isObj(r.recorded) ? r.recorded : { real: 0, guessed_nonexistent: 0, tilde_denied: 0 };
    if (!isObj(r.recorded)) notRecorded.push(r.id);
    counts.tilde += r.tilde || 0;
    counts.guessed_home += r.guessed_home || 0;
    for (const k of ['real', 'guessed_nonexistent', 'tilde_denied']) counts[k] += rec[k] || 0;
    for (const e of (r.entries || []).filter((x) => x.class === 'guessed_home')) {
      failures.push({ run: r.id, class: 'guessed_home', tool: e.tool || null, path: e.path, source: 'transcript' });
    }
    if ((r.guessed_home || 0) > 0 && !(r.entries || []).some((x) => x.class === 'guessed_home')) {
      failures.push({ run: r.id, class: 'guessed_home', tool: null, path: `not in the row (scan count ${r.guessed_home})`, source: 'transcript' });
    }
    for (const cls of RECORDED_FAIL) {
      if (!(rec[cls] > 0)) continue;
      const named = (r.recorded_entries || []).filter((e) => e.class === cls);
      if (named.length) for (const e of named) failures.push({ run: r.id, class: cls, tool: e.tool || null, path: e.path, source: 'record.access' });
      else failures.push({ run: r.id, class: cls, tool: null, path: `not in the row (record.access count ${rec[cls]})`, source: 'record.access' });
    }
    if ((r.tilde || 0) > 0) informational.push({ run: r.id, class: 'tilde', count: r.tilde });
    if ((rec.tilde_denied || 0) > 0) informational.push({ run: r.id, class: 'tilde_denied', count: rec.tilde_denied });
  }
  let verdict;
  let sentence;
  const five = `tilde ${counts.tilde}, guessed_home ${counts.guessed_home}, real ${counts.real}, guessed_nonexistent ${counts.guessed_nonexistent}, tilde_denied ${counts.tilde_denied}`;
  if (failures.length) {
    verdict = 'FAIL';
    sentence = `FAIL: ${failures.map((f) => `${f.run} ${f.class} \`${f.path}\``).join('; ')} (${list.length} run(s); ${five}).`;
  } else if (list.length === 0 || unscanned.length) {
    verdict = 'INCONCLUSIVE';
    sentence = list.length === 0
      ? 'INCONCLUSIVE: no run to check, so SC-2 is not shown.'
      : `INCONCLUSIVE: no guessed path found, but ${unscanned.length} of ${list.length} run(s) could not be scanned (${unscanned.join(', ')}), so SC-2 is not shown (${five}).`;
  } else {
    verdict = 'PASS';
    sentence = `PASS: ${list.length} run(s) scanned, no guessed absolute home path and no recorded escape (${five}).`;
  }
  return { verdict, runs: list.length, failures, unscanned, not_recorded: notRecorded, counts, informational, sentence };
}

// ─── 82-TIER-CHECKS.md ──────────────────────────────────────────────────────────────────────────────────────────

function clauseTable(v) {
  const lines = ['| Condition | Numbers | Holds |', '|---|---|---|'];
  for (const c of v.clauses) lines.push(`| ${c.rule} | ${c.numbers} | ${c.holds ? 'yes' : 'no'} |`);
  return lines;
}

function p1Section(v, d) {
  const lines = ['## P1: the UI judge starts at haiku and escalates (batch D)', '', `**Verdict: ${verdictLabel(v)}.** ${v.deciding}.`, ''];
  if (v.inconclusive) {
    lines.push('Rule (82-CHECK-RULES.md section 1): any incomplete state, in either arm, reverts P1.');
    return lines;
  }
  lines.push('Rule (82-CHECK-RULES.md section 1): KEEP only when all three hold.', '', ...clauseTable(v), '');
  const n = v.numbers;
  const c = d.cost;
  lines.push(
    `Cost detail: Haiku start ${usd(c.haiku_start.samples_usd)} samples + ${usd(c.haiku_start.escalation_usd)} escalations; Sonnet start ${usd(c.sonnet_start.samples_usd)} samples + ${usd(c.sonnet_start.escalation_estimate_usd)} (${c.sonnet_start.escalation_basis}).`,
    '',
    'Context, deciding nothing: '
      + `escalation rate (haiku) ${frac(n.escalation_rate_haiku)}, split rate (haiku) ${frac(n.split_rate_haiku)}, `
      + `escalation rate (sonnet) ${frac(n.escalation_rate_sonnet)}, escalated-verdict agreement with the Sonnet start ${frac(n.escalated_agreement)}, `
      + `false_fail Haiku start ${frac(n.false_fail_haiku_start)} vs Sonnet start ${frac(n.false_fail_sonnet_start)}.`,
  );
  return lines;
}

function researcherSection(v, c, dim) {
  const title = `## ${v.proposal}: researcher ${dim} at haiku on budget (batch C)`;
  const lines = [title, '', `**Verdict: ${verdictLabel(v)}.** ${v.deciding}.`, ''];
  if (v.inconclusive) lines.push('Rule (82-CHECK-RULES.md section 2): fewer than 2 graded runs in any topic x model reverts.');
  else lines.push('Rule (82-CHECK-RULES.md section 2): REVERT when any condition fails; KEEP otherwise.', '', ...clauseTable(v));
  if (isObj(c) && isObj(c.cells)) {
    lines.push('', '**Per topic** (graded runs, recall with Wilson 95%, fabrications per run):', '', '| Topic | Model | Graded runs | Recall | Fabrications per run |', '|---|---|---:|---|---:|');
    for (const t of TOPICS) {
      for (const m of MODELS) {
        const cell = c.cells[t] && c.cells[t][dim] && c.cells[t][dim][m];
        if (!cell) continue;
        lines.push(`| ${t} | ${m} | ${cell.graded_runs} | ${frac(cell.recall)} | ${cell.fabrications_per_run === null || cell.fabrications_per_run === undefined ? 'n/a' : cell.fabrications_per_run} |`);
      }
    }
    const matrix = [];
    for (const t of TOPICS) {
      for (const item of (c.item_matrix && c.item_matrix[t] && c.item_matrix[t][dim]) || []) {
        if (item.sonnet_found !== item.haiku_found) matrix.push(`${t} ${item.id} Sonnet ${item.sonnet_found}/${item.sonnet_graded}, Haiku ${item.haiku_found}/${item.haiku_graded}`);
      }
    }
    lines.push('', `Items where the models differ: ${matrix.length ? matrix.join('; ') : 'none'}.`);
  }
  lines.push('', `### Recorded context: objective 81's topic (${dim}, not voting)`, '');
  const rec = isObj(c) ? c.recorded_81 : null;
  if (!rec || !isObj(rec.roles)) {
    lines.push(rec && rec.note ? `${rec.note}.` : 'Not available: results/C.json is missing.');
    return lines;
  }
  lines.push(`${rec.note} (source \`${rec.source}\`).`, '', '| Dimension | Model | Scored runs | Recall | Fabrications |', '|---|---|---:|---|---|');
  for (const m of MODELS) {
    const x = rec.roles[dim] && rec.roles[dim][m];
    if (!x) {
      lines.push(`| ${dim} | ${m} | n/a | n/a | n/a |`);
      continue;
    }
    const r = x.recall ? frac(wilson(x.recall.k, x.recall.n)) : 'n/a';
    const f = x.fabrications ? `${x.fabrications.total} over ${x.fabrications.runs} run(s)` : 'n/a';
    lines.push(`| ${dim} | ${m} | ${x.n_scored} | ${r} | ${f} |`);
  }
  return lines;
}

function guessedSection(g, rows) {
  const lines = [
    '## Guessed runtime paths (SC-2, researcher runs)',
    '',
    `**Verdict: ${g.verdict}.** ${g.sentence}`,
    '',
    'Rule (82-CHECK-RULES.md section 4): a scanned `guessed_home` input or a recorded `real` / `guessed_nonexistent` access fails; an unscanned run makes it inconclusive; `tilde` (the Read tool expands `~`) and `tilde_denied` are counted, not deciding.',
  ];
  if (rows.length) {
    lines.push('', '| Run | Scan | tilde | guessed_home | real | guessed_nonexistent | tilde_denied |', '|---|---|---:|---:|---:|---:|---:|');
    for (const r of rows) {
      const rec = isObj(r.recorded) ? r.recorded : null;
      const scanned = (r.files_scanned || 0) >= 1 && (r.tool_uses_scanned || 0) >= 1;
      const scan = `${scanned ? '' : 'not scanned: '}${r.files_scanned || 0} file(s), ${r.tool_uses_scanned || 0} tool use(s)`;
      const cell = (k) => (rec ? rec[k] : 'not recorded');
      lines.push(`| ${r.id} | ${scan} | ${r.tilde || 0} | ${r.guessed_home || 0} | ${cell('real')} | ${cell('guessed_nonexistent')} | ${cell('tilde_denied')} |`);
    }
  }
  if (g.failures.length) {
    lines.push('', 'Failures:', '');
    for (const f of g.failures) lines.push(`- ${f.run}: ${f.class}${f.tool ? ` (${f.tool})` : ''} \`${f.path}\` (${f.source})`);
  }
  return lines;
}

/** renderTierChecks({d, c}) -> the text of 82-TIER-CHECKS.md (deterministic for the same results). */
function renderTierChecks({ d = null, c = null } = {}) {
  const p1 = p1Verdict(d);
  const p4 = researcherVerdict(c, 'architecture');
  const p5 = researcherVerdict(c, 'pitfalls');
  const rows = isObj(c) && isObj(c.guessed_paths) && Array.isArray(c.guessed_paths.runs) ? c.guessed_paths.runs : [];
  const g = guessedPathVerdict(rows);
  const stamp = (x, name) => (isObj(x) ? `\`results/${name}.json\` (scored ${x.scored_at || 'n/a'})` : `\`results/${name}.json\` (missing)`);
  const lines = [
    '# Objective 82: tier checks (P1, P4, P5)',
    '',
    `Rendered by \`node scripts/eval82/score.cjs --rules\` from ${stamp(d, 'D')} and ${stamp(c, 'C')} under 82-CHECK-RULES.md sections 1, 2 and 4 (\`scripts/eval82/check-rules.cjs\`). The same results give the same bytes. Wilson 95% intervals are shown beside the numbers and decide nothing.`,
    '',
    '| Proposal | Verdict | Deciding clause |',
    '|---|---|---|',
    `| P1 | ${verdictLabel(p1)} | ${p1.deciding} |`,
    `| P4 | ${verdictLabel(p4)} | ${p4.deciding} |`,
    `| P5 | ${verdictLabel(p5)} | ${p5.deciding} |`,
    `| SC-2 (researcher runs) | ${g.verdict} | ${g.sentence} |`,
    '',
    ...p1Section(p1, d),
    '',
    ...researcherSection(p4, c, 'architecture'),
    '',
    ...researcherSection(p5, c, 'pitfalls'),
    '',
    ...guessedSection(g, rows),
  ];
  return `${lines.join('\n')}\n`;
}

module.exports = {
  p1Verdict,
  researcherVerdict,
  fixListAsApplied,
  mechanismChecks,
  attributionForRun,
  guessedPathVerdict,
  renderTierChecks,
  MECHANISM_SPECS,
};
