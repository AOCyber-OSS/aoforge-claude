'use strict';

// The pre-registered decision rule of objective 81 (TRD 81-02), as code. The rule, its metrics and every
// interpretive choice live in .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-DECISION-RULE.md;
// where that file and this module disagree, the file wins and this module is fixed (with a test quoting the line).
//
// decide({results: {A, B, C, D}, profiles, packModels}) applies the rule per role and returns
//   { roles: { <role>: { role, batch, primary, outcome, reasons[], haiku, sonnet, diff_points, fab_diff,
//                        proposal, note } },
//     gate: { status: 'passed'|'failed'|'unestablished', a_false_pass: {k, n}|null, reason } }
// Batch E (76-08) is a measurement and is ignored.
//
// Inputs are batch result objects (the contract with scripts/eval81/score/<X>.cjs, TRDs 81-09..81-12):
//   { batch, scored_at, planned: {haiku, sonnet},
//     roles: { <role>: { primary?, planned?: {haiku, sonnet},
//       models: { haiku|sonnet: { n_scored, planned?, metrics: { <name>: {k, n} | {total, runs} | {<sub>: {k, n}} },
//                                 cost_usd, mean_wall_ms } } } },
//     runs: [ { id, model, fixture, verdict, outcome, contaminated, role? } ],
//     excluded: [ { id, reason, model?, role? } ], notes: [] }
// `profiles` is model-profiles.json (agents, focus, verdict_floor); `packModels` is the flutter pack's
// aoforge-stack.json `models`. Both are read only: proposals are text for the user, never applied.
//
// Pure: no I/O, inputs are never mutated.

const { wilson, pointsDiff, round9, formatPct } = require('./stats.cjs');

const OUTCOMES = ['REFUSE', 'WEAK_ENDORSE', 'INSUFFICIENT'];
const MARGIN = 0.10;
const MIN_SCORED_SHARE = 2 / 3;
const SONNET_FLOOR = 0.5;
const FAB_MARGIN = 0.5;
const MODELS = ['haiku', 'sonnet'];
const PROFILE_ORDER = ['quality', 'balanced', 'budget'];
const DECIDED_BATCHES = ['A', 'B', 'D', 'C'];

const MAPPER_FOCI = ['tech', 'arch', 'quality', 'concerns'];
const RESEARCH_DIMENSIONS = ['stack', 'features', 'architecture', 'pitfalls'];

/** Role -> primary metric (81-DECISION-RULE.md section 3). Key order is the report order. */
const ROLE_PRIMARY = {
  verifier: 'detection',
  'job-checker': 'detection',
  'ui-evaluator': 'accuracy',
  ...Object.fromEntries(MAPPER_FOCI.map((f) => [`codebase-mapper:${f}`, 'recall'])),
  ...Object.fromEntries(RESEARCH_DIMENSIONS.map((d) => [`project-researcher:${d}`, 'recall'])),
};

/** Role -> batch. */
const ROLE_BATCH = Object.fromEntries(Object.keys(ROLE_PRIMARY).map((role) => {
  if (role === 'verifier') return [role, 'A'];
  if (role === 'job-checker') return [role, 'B'];
  if (role === 'ui-evaluator') return [role, 'D'];
  return [role, 'C'];
}));

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isKn = (v) => isObj(v) && Number.isFinite(v.k) && Number.isFinite(v.n) && v.k >= 0 && v.k <= v.n;
const isFab = (v) => isObj(v) && Number.isFinite(v.total) && Number.isFinite(v.runs) && v.total >= 0 && v.runs >= 0;
const isCRole = (role) => ROLE_BATCH[role] === 'C';
const pts = (diff) => (Math.abs(diff) * 100).toFixed(1);
const kn = (w) => `${w.k}/${w.n} (${formatPct(w.rate)})`;

/** viewMetric(value) -> a Wilson interval for {k, n}, per-run fabrications for {total, runs}, else recursion/as is. */
function viewMetric(value) {
  if (isKn(value)) return wilson(value.k, value.n);
  if (isFab(value)) return { total: value.total, runs: value.runs, per_run: value.runs > 0 ? round9(value.total / value.runs) : null };
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, viewMetric(v)]));
  return value;
}

/** plannedFor(batchResult, roleEntry, model): model-level, then role-level, then batch-level `planned`. */
function plannedFor(result, entry, model) {
  const m = entry && entry.models && entry.models[model];
  if (m && Number.isFinite(m.planned)) return m.planned;
  if (entry && isObj(entry.planned) && Number.isFinite(entry.planned[model])) return entry.planned[model];
  if (result && isObj(result.planned) && Number.isFinite(result.planned[model])) return result.planned[model];
  return null;
}

function modelView(result, entry, model, primary) {
  const m = entry.models && entry.models[model];
  if (!isObj(m)) return null;
  const metrics = viewMetric(isObj(m.metrics) ? m.metrics : {});
  return {
    n_scored: Number.isFinite(m.n_scored) ? m.n_scored : null,
    planned: plannedFor(result, entry, model),
    primary: isKn(m.metrics && m.metrics[primary]) ? metrics[primary] : null,
    metrics,
    cost_usd: m.cost_usd === undefined ? null : m.cost_usd,
    mean_wall_ms: m.mean_wall_ms === undefined ? null : m.mean_wall_ms,
  };
}

/** scoredShareShort(n_scored, planned) -> true when below 2/3 (compared after rounding to 1e-9). */
function scoredShareShort(nScored, planned) {
  return round9(nScored / planned) < round9(MIN_SCORED_SHARE);
}

/** The A gate (81-DECISION-RULE.md section 5, steps 4 and 6). */
function gateFromA(A) {
  const unestablished = (reason, aFalsePass = null) => ({ status: 'unestablished', a_false_pass: aFalsePass, reason });
  if (!isObj(A)) return unestablished('batch A not run');
  const entry = A.roles && A.roles.verifier;
  const h = entry && entry.models && entry.models.haiku;
  if (!isObj(h)) return unestablished('batch A has no Haiku verifier results');
  const fp = h.metrics && h.metrics.false_pass;
  if (!isKn(fp)) return unestablished('Haiku false_pass not reported in A');
  const aFalsePass = { k: fp.k, n: fp.n };
  if (fp.k > 0) {
    return { status: 'failed', a_false_pass: aFalsePass,
      reason: `Haiku passed ${fp.k} of ${fp.n} planted A runs` };
  }
  const planned = plannedFor(A, entry, 'haiku');
  if (!Number.isFinite(h.n_scored) || !planned) return unestablished('Haiku A run counts not reported', aFalsePass);
  if (scoredShareShort(h.n_scored, planned)) {
    return unestablished(`Haiku scored ${h.n_scored} of ${planned} planned A runs (below 2/3)`, aFalsePass);
  }
  if (fp.n === 0) return unestablished('no planted A run scored for Haiku', aFalsePass);
  return { status: 'passed', a_false_pass: aFalsePass, reason: `zero Haiku false passes in A (0/${fp.n})` };
}

/** attributed(list, role, batchRoles): entries whose `role` is this role, or which carry no role at all. */
function attributed(list, role) {
  return (Array.isArray(list) ? list : []).filter((e) => isObj(e) && (e.role === undefined || e.role === null || e.role === role));
}

/** currentTiers(role, profiles, packModels) -> {tiers, subject, target, agent, shared} | null. */
function currentTiers(role, profiles, packModels) {
  if (role === 'ui-evaluator') {
    const tiers = isObj(packModels) && isObj(packModels['ui-evaluator']) ? packModels['ui-evaluator'] : null;
    return tiers && { tiers, subject: 'ui-evaluator', target: 'aoforge-stack.json models.ui-evaluator',
      agent: 'ui-evaluator', shared: false };
  }
  if (!isObj(profiles)) return null;
  const [agent, focus] = role.split(':');
  const focusRow = focus && isObj(profiles.focus) && isObj(profiles.focus[agent]) ? profiles.focus[agent][focus] : null;
  if (isObj(focusRow)) {
    return { tiers: focusRow, subject: `${agent} focus ${focus}`, target: `model-profiles.json focus.${agent}.${focus}`,
      agent, shared: false };
  }
  const row = isObj(profiles.agents) ? profiles.agents[agent] : null;
  if (!isObj(row)) return null;
  return { tiers: row, subject: agent, target: `model-profiles.json agents.${agent}`, agent, shared: Boolean(focus) };
}

/**
 * proposalsFor(outcome, role, profiles, packModels, haikuView?) -> {proposal: {text, target, profiles, to}|null,
 * note: string|null}. The mapping is 81-DECISION-RULE.md section 7; the result is text, nothing is written.
 */
function proposalsFor(outcome, role, profiles, packModels, haikuView = null) {
  if (outcome === 'INSUFFICIENT') return { proposal: null, note: null };
  const cur = currentTiers(role, profiles, packModels);
  if (!cur) return { proposal: null, note: `current tiers not available for ${role}; no proposal` };
  const { tiers, subject, target, agent, shared } = cur;
  const haikuProfiles = PROFILE_ORDER.filter((p) => tiers[p] === 'haiku');

  if (outcome === 'REFUSE') {
    if (haikuProfiles.length === 0) {
      return { proposal: null, note: `no profile runs haiku for ${role}; the refusal confirms the current tiers` };
    }
    return {
      proposal: { text: `raise ${subject} ${haikuProfiles.join(', ')} to sonnet`, target, profiles: haikuProfiles,
        to: 'sonnet' },
      note: shared ? `the ${agent} row is shared by every ${agent} focus without an override` : null,
    };
  }

  // WEAK_ENDORSE
  const floor = isObj(profiles) && isObj(profiles.verdict_floor) ? profiles.verdict_floor : null;
  if (floor && Array.isArray(floor.agents) && floor.agents.includes(agent)) {
    return { proposal: null, note: `verdict_floor keeps ${floor.tier}; evidence weakly supports haiku` };
  }
  if (role === 'ui-evaluator') {
    const lower = ['budget', 'balanced'].filter((p) => tiers[p] && tiers[p] !== 'haiku');
    if (lower.length === 0) {
      return { proposal: null, note: 'ui-evaluator already starts at haiku on budget/balanced; the evidence weakly supports it' };
    }
    const split = haikuView && haikuView.metrics && haikuView.metrics.split_rate;
    const splitText = split && split.rate !== undefined ? formatPct(split.rate) : 'not reported';
    return {
      proposal: { text: `start ui-evaluator at haiku on ${lower.join('/')}, escalate on split votes (split rate ${splitText})`,
        target, profiles: lower, to: 'haiku' },
      note: null,
    };
  }
  if (tiers.budget !== 'haiku') {
    return {
      proposal: { text: `lower ${subject} budget to haiku (weak endorsement; quality and balanced unchanged)`, target,
        profiles: ['budget'], to: 'haiku' },
      note: shared ? `the ${agent} row is shared by every ${agent} focus without an override` : null,
    };
  }
  return { proposal: null, note: `${subject} already runs haiku on ${haikuProfiles.join(', ')}; the evidence weakly supports it` };
}

/** evaluateRole(role, results, gate) -> the role's decision (without the proposal). */
function evaluateRole(role, results, gate) {
  const primary = ROLE_PRIMARY[role];
  const batch = ROLE_BATCH[role] || null;
  const out = { role, batch, primary: primary || null, outcome: 'INSUFFICIENT', reasons: [], haiku: null, sonnet: null,
    diff_points: null, fab_diff: null };
  const finish = (outcome, reason, extra = []) => {
    out.outcome = outcome;
    out.reasons = [reason, ...extra, ...out.reasons];
    return out;
  };

  const result = batch ? results[batch] : null;
  if (!isObj(result)) return finish('INSUFFICIENT', `batch ${batch} not run`);
  const entry = result.roles && result.roles[role];
  if (!isObj(entry)) return finish('INSUFFICIENT', `role ${role} not in batch ${batch} results`);

  // Information lines, kept whatever the outcome (appended after the deciding reason).
  const excluded = attributed(result.excluded, role);
  if (excluded.length) {
    out.reasons.push(`excluded (not in n): ${excluded.map((e) => `${e.id} (${e.reason})`).join(', ')}`);
  }
  if (entry.primary && entry.primary !== primary) {
    out.reasons.push(`scorer declared primary ${entry.primary}; the pre-registered primary ${primary} is used`);
  }

  for (const model of MODELS) out[model] = modelView(result, entry, model, primary);
  const h = out.haiku;
  const s = out.sonnet;
  if (h && s && h.primary && s.primary) out.diff_points = pointsDiff(h.primary.rate, s.primary.rate);
  const hFab = h && h.metrics.fabrications;
  const sFab = s && s.metrics.fabrications;
  if (isCRole(role) && hFab && sFab && hFab.per_run !== undefined && sFab.per_run !== undefined) {
    out.fab_diff = pointsDiff(hFab.per_run, sFab.per_run);
  }

  // 1. Missing data (contaminated runs counted in n count as missing: the batch must be re-scored).
  const excludedIds = new Set((Array.isArray(result.excluded) ? result.excluded : []).map((e) => e && e.id));
  const counted = attributed(result.runs, role).filter((r) => r.contaminated === true && !excludedIds.has(r.id));
  if (counted.length) {
    return finish('INSUFFICIENT', `contaminated run counted in n: ${counted.map((r) => r.id).join(', ')} (re-score the batch)`);
  }
  for (const model of MODELS) {
    if (!out[model]) return finish('INSUFFICIENT', `${model} results missing from batch ${batch}`);
  }

  // 2. Scored share, then a usable primary metric (and, for C, fabrication counts).
  for (const model of MODELS) {
    const v = out[model];
    if (v.n_scored === null || !v.planned) {
      return finish('INSUFFICIENT', `${model} has no scored or planned run count`);
    }
    if (scoredShareShort(v.n_scored, v.planned)) {
      return finish('INSUFFICIENT', `${model} scored ${v.n_scored} of ${v.planned} planned runs (below 2/3)`);
    }
  }
  for (const model of MODELS) {
    const p = out[model].primary;
    if (!p) return finish('INSUFFICIENT', `${model} ${primary} not reported`);
    if (p.n === 0) return finish('INSUFFICIENT', `${model} ${primary} has no scored items`);
  }
  if (isCRole(role)) {
    for (const model of MODELS) {
      const fab = out[model].metrics.fabrications;
      if (!fab || fab.per_run === undefined) return finish('INSUFFICIENT', `${model} fabrications not reported`);
      if (fab.per_run === null) return finish('INSUFFICIENT', `${model} fabrications cover no scored run`);
    }
  }

  // 3. Sonnet floor.
  if (round9(s.primary.rate) < SONNET_FLOOR) {
    return finish('INSUFFICIENT', `comparison not informative: Sonnet ${primary} ${kn(s.primary)} is below 50%`);
  }

  // 4. A gate (global).
  if (gate.status === 'failed') {
    return finish('REFUSE', `A false pass: ${gate.reason}, which refuses Haiku for every role (interpretive choice 1)`);
  }

  // 5. Margin, and the C fabrication bound.
  if (out.diff_points < -MARGIN) {
    return finish('REFUSE', `margin: Haiku ${primary} ${kn(h.primary)} is ${pts(out.diff_points)} points below Sonnet `
      + `${kn(s.primary)} (more than 10)`);
  }
  if (isCRole(role) && out.fab_diff > FAB_MARGIN) {
    return finish('REFUSE', `fabrications: Haiku ${hFab.per_run.toFixed(2)} per run vs Sonnet ${sFab.per_run.toFixed(2)} `
      + `(+${out.fab_diff.toFixed(2)}, above +${FAB_MARGIN.toFixed(2)})`);
  }

  // 6. The gate must be established before an endorsement.
  if (gate.status !== 'passed') {
    return finish('INSUFFICIENT', `A gate not established: ${gate.reason}`);
  }

  // 7. Weak endorsement.
  const sign = out.diff_points >= 0 ? '+' : '-';
  const fabPart = isCRole(role) ? `; fabrications ${hFab.per_run.toFixed(2)} vs ${sFab.per_run.toFixed(2)} per run` : '';
  return finish('WEAK_ENDORSE', `within margin: Haiku ${primary} ${kn(h.primary)} vs Sonnet ${kn(s.primary)} `
    + `(${sign}${pts(out.diff_points)} points)${fabPart}; ${gate.reason}; small n: a weak endorsement only`);
}

/** decide({results, profiles, packModels}) -> {roles, gate}. See the header comment. */
function decide({ results = {}, profiles = null, packModels = null } = {}) {
  const res = isObj(results) ? results : {};
  const gate = gateFromA(res.A);
  const roles = Object.keys(ROLE_PRIMARY);
  // Roles a scorer reported that the rule did not pre-register: listed, never decided.
  for (const batch of DECIDED_BATCHES) {
    const r = res[batch];
    if (!isObj(r) || !isObj(r.roles)) continue;
    for (const role of Object.keys(r.roles)) if (!roles.includes(role)) roles.push(role);
  }

  const out = {};
  for (const role of roles) {
    if (!ROLE_PRIMARY[role]) {
      const batch = DECIDED_BATCHES.find((b) => isObj(res[b]) && isObj(res[b].roles) && res[b].roles[role]);
      out[role] = { role, batch, primary: null, outcome: 'INSUFFICIENT',
        reasons: [`role ${role} is not pre-registered (no primary metric in 81-DECISION-RULE.md)`], haiku: null,
        sonnet: null, diff_points: null, fab_diff: null, proposal: null, note: null };
      continue;
    }
    const d = evaluateRole(role, res, gate);
    const { proposal, note } = proposalsFor(d.outcome, role, profiles, packModels, d.haiku);
    out[role] = { ...d, proposal, note };
  }
  return { roles: out, gate };
}

module.exports = {
  decide,
  proposalsFor,
  OUTCOMES,
  ROLE_PRIMARY,
  ROLE_BATCH,
  MARGIN,
  MIN_SCORED_SHARE,
  SONNET_FLOOR,
  FAB_MARGIN,
};
