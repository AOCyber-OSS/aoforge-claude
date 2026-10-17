'use strict';
/**
 * Per-run `--max-budget-usd` caps for the objective-81 eval harness (TRD 81-01), sized from calibration p90.
 *
 *   cap = max(FLOOR, p90(role) x TIER_FACTOR[model]) + basePromptUsd({model, kind}), clamped to CEILING[batch]
 *
 * p90 is `agent_overhead.<role>.cost_usd.p90` from a calibration object (`aof-tools calibrate`; the runner loads
 * ~/.claude/aoforge/calibration.json read-only and passes it in, tests pass a builder object). The executor has no
 * agent_overhead row; its p90 is the per-TRD cost `trd_level.cost_usd.p90`. A role with neither uses FALLBACK_P90,
 * named in the basis. The measured p90 is treated as sonnet-equivalent, hence TIER_FACTOR sonnet 1.
 *
 * Haiku's tier factor is 0.25 of sonnet, not the 0.05 list-price ratio: Haiku 5.5 is priced 5x above 100K prompt
 * tokens (model-rates.json note) and a cap must cover a long run.
 *
 * The base allowance covers the cached base prompt a bare headless `claude -p` session reads before doing anything:
 * BASE_PROMPT_TOKENS written once at the 5m cache-write rate plus read back once per turn (BASE_TURNS[kind]). It is a
 * cap-sizing input only: the first live run's recorded `first_turn_input` shows the real figure (81-14 reports it).
 *
 * The cap bounds a run's turns, not its spend: `--max-budget-usd` is checked between turns. ledger.cjs reserves more
 * than the cap before each run for that reason.
 */

const fs = require('fs');
const path = require('path');
const { loadRates, rateFor } = require('../../../plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs');
const { pinnedId, PROFILES_PATH } = require('./result.cjs');

const TIER_FACTOR = { haiku: 0.25, sonnet: 1, opus: 2 };
const FLOOR = 0.25;
const CEILING = { A: 2, B: 2, C: 3, D: 0.75, E_quick: 6, E_build: 15 };
// Used when the calibration has no sample for a role (or no calibration is passed: the batch modules' runs() takes
// `calibration: null`). codebase-mapper and project-researcher have no samples today. verifier, job-checker, planner
// (agent_overhead p90) and executor (trd_level p90) are today's calibration values, 2026-10-17.
const FALLBACK_P90 = {
  'codebase-mapper': 2,
  'project-researcher': 3,
  'objective-researcher': 3.27,
  judge: 0.5,
  grader: 0.5,
  verifier: 1.7634,
  'job-checker': 1.5977,
  planner: 15.2542,
  executor: 4.0386,
};
// Measured by the orchestrator's 2026-10-17 smoke test: a bare headless session's cached base prompt.
const BASE_PROMPT_TOKENS = 36000;
const BASE_TURNS = { agent: 40, prompt: 3, workflow: 60 };
// Roles each workflow spawns (one entry per spawn); the opus orchestrator and one base allowance are added on top.
const WORKFLOW_ROLES = {
  quick: ['planner', 'executor'],
  build: ['planner', 'job-checker', 'executor', 'executor', 'verifier'],
};
const PROMPT_ROLES = ['judge', 'grader'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const fmtFactor = (f) => (Number.isInteger(f) ? f.toFixed(1) : String(f));

function ratesOrLoad(rates) {
  if (rates) return rates;
  const loaded = loadRates();
  if (!loaded.ok) throw new Error(`caps: ${loaded.error}`);
  return loaded;
}

function assertModel(model, fn) {
  if (!Object.prototype.hasOwnProperty.call(TIER_FACTOR, model)) {
    throw new TypeError(`${fn}: model must be one of ${Object.keys(TIER_FACTOR).join(', ')}`);
  }
}

/** USD for the cached base prompt of one run: tokens x (5m write + read x turns) / 1e6, at the tier's pinned rate. */
function basePromptUsd({ model, kind = 'agent', rates, profilesPath = PROFILES_PATH } = {}) {
  assertModel(model, 'basePromptUsd');
  if (!Object.prototype.hasOwnProperty.call(BASE_TURNS, kind)) throw new TypeError(`basePromptUsd: kind must be one of ${Object.keys(BASE_TURNS).join(', ')}`);
  const id = pinnedId(model, profilesPath);
  const rate = rateFor(ratesOrLoad(rates), id);
  if (!rate) throw new Error(`basePromptUsd: no rate for ${id} (${model})`);
  return round6((BASE_PROMPT_TOKENS * (rate.cache_write_5m + rate.cache_read * BASE_TURNS[kind])) / 1e6);
}

/** p90 cost for a role: calibration agent_overhead, then (executor) trd_level, then FALLBACK_P90. */
function p90For(role, calibration) {
  const cal = isPlainObject(calibration) ? calibration : {};
  const row = isPlainObject(cal.agent_overhead) ? cal.agent_overhead[role] : null;
  const p90 = row && isPlainObject(row.cost_usd) ? row.cost_usd.p90 : null;
  if (typeof p90 === 'number' && Number.isFinite(p90) && p90 > 0) return { p90, label: `p90(${role})=${p90}` };
  if (role === 'executor' && isPlainObject(cal.trd_level) && isPlainObject(cal.trd_level.cost_usd)) {
    const t = cal.trd_level.cost_usd.p90;
    if (typeof t === 'number' && Number.isFinite(t) && t > 0) return { p90: t, label: `p90(executor, trd_level)=${t}` };
  }
  if (Object.prototype.hasOwnProperty.call(FALLBACK_P90, role)) {
    return { p90: FALLBACK_P90[role], label: `fallback p90(${role})=${FALLBACK_P90[role]}` };
  }
  throw new Error(`caps: no calibration sample and no FALLBACK_P90 for role ${role}`);
}

/** One role's scaled, floored p90 term with its derivation. */
function roleTerm(role, model, calibration) {
  const { p90, label } = p90For(role, calibration);
  const factor = TIER_FACTOR[model];
  const scaled = round6(p90 * factor);
  let text = `${label} x ${model} ${fmtFactor(factor)}${factor === 1 ? '' : `=${scaled}`}`;
  let usd = scaled;
  if (scaled < FLOOR) {
    usd = FLOOR;
    text += ` -> floor ${FLOOR}`;
  }
  return { usd, text };
}

function clamp(cap, ceilingKey, basis) {
  const ceiling = CEILING[ceilingKey];
  if (cap > ceiling) return { cap: ceiling, basis: `${basis} -> clamped to ceiling ${ceilingKey} ${ceiling}`, clamped: true };
  return { cap, basis, clamped: false };
}

/**
 * The cap for one run of batch A, B, C or D.
 * @param {object} opts
 * @param {string} opts.role         the agent role (calibration key), e.g. 'verifier', 'judge'
 * @param {string} opts.model        haiku | sonnet | opus
 * @param {string} [opts.kind]       agent | prompt | workflow; defaults to prompt for judge/grader, else agent
 * @param {string} opts.batch        A | B | C | D (batch E uses capForWorkflow)
 * @param {object|null} [opts.calibration]  a calibration object, or null for FALLBACK_P90
 * @param {object} [opts.rates]      loadRates() result; defaults to loadRates()
 * @returns {{cap: number, basis: string, base_usd: number, clamped: boolean}}
 */
function capFor({ role, model, kind, batch, calibration = null, rates, profilesPath = PROFILES_PATH } = {}) {
  if (typeof role !== 'string' || role === '') throw new TypeError('capFor: role must be a non-empty string');
  assertModel(model, 'capFor');
  if (batch === 'E') throw new TypeError('capFor: batch E runs are workflows; use capForWorkflow');
  if (!['A', 'B', 'C', 'D'].includes(batch)) throw new TypeError('capFor: batch must be one of A, B, C, D');
  const k = kind || (PROMPT_ROLES.includes(role) ? 'prompt' : 'agent');
  const term = roleTerm(role, model, calibration);
  const base = basePromptUsd({ model, kind: k, rates, profilesPath });
  const basis = `${term.text} + base ${BASE_PROMPT_TOKENS / 1000}K x ${BASE_TURNS[k]} turns=${base}`;
  const out = clamp(round6(term.usd + base), batch, basis);
  return { ...out, base_usd: base };
}

function balancedTier(role, profilesPath) {
  let profiles;
  try {
    profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
  } catch (err) {
    throw new Error(`cannot read model profiles ${profilesPath}: ${err.message}`);
  }
  const row = isPlainObject(profiles.agents) ? profiles.agents[role] : null;
  const tier = row && row.balanced;
  if (Object.prototype.hasOwnProperty.call(TIER_FACTOR, tier)) return { tier, note: '' };
  return { tier: 'sonnet', note: ` (no balanced tier for ${role}: sonnet)` };
}

/**
 * The cap for one batch-E workflow run (`/aoforge:quick` or `/aoforge:build`): every spawned role's p90 at its
 * balanced tier (model-profiles.json), plus an opus orchestrator costed as the planner's p90 share (planner p90 x
 * opus), plus one base allowance for the opus top-level session, clamped to E_quick 6 or E_build 15.
 * Accepts `capForWorkflow('quick')` as well as `capForWorkflow({workflow, calibration, rates})`.
 * @returns {{cap: number, basis: string, base_usd: number, clamped: boolean}}
 */
function capForWorkflow(arg) {
  const opts = typeof arg === 'string' ? { workflow: arg } : (arg || {});
  const { workflow, calibration = null, rates, profilesPath = PROFILES_PATH } = opts;
  const roles = WORKFLOW_ROLES[workflow];
  if (!roles) throw new TypeError(`capForWorkflow: unknown workflow ${workflow} (one of ${Object.keys(WORKFLOW_ROLES).join(', ')})`);

  const parts = [];
  let sum = 0;
  const counted = new Map();
  for (const role of roles) counted.set(role, (counted.get(role) || 0) + 1);
  for (const [role, n] of counted) {
    const { tier, note } = balancedTier(role, profilesPath);
    const term = roleTerm(role, tier, calibration);
    sum += term.usd * n;
    parts.push(`${term.text}${note}${n > 1 ? ` x${n}` : ''}`);
  }
  const orchestrator = roleTerm('planner', 'opus', calibration);
  sum += orchestrator.usd;
  parts.push(`orchestrator (opus, planner share) ${orchestrator.text}`);
  const base = basePromptUsd({ model: 'opus', kind: 'workflow', rates, profilesPath });
  sum += base;
  parts.push(`base ${BASE_PROMPT_TOKENS / 1000}K x ${BASE_TURNS.workflow} turns (opus)=${base}`);
  const total = round6(sum);
  const out = clamp(total, workflow === 'build' ? 'E_build' : 'E_quick', `${workflow}: ${parts.join(' + ')} = ${total}`);
  return { ...out, base_usd: base };
}

module.exports = {
  TIER_FACTOR,
  FLOOR,
  CEILING,
  FALLBACK_P90,
  BASE_PROMPT_TOKENS,
  BASE_TURNS,
  WORKFLOW_ROLES,
  basePromptUsd,
  capFor,
  capForWorkflow,
};
