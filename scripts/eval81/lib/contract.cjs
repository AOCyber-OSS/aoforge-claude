'use strict';
/**
 * The objective-81 eval harness contract (TRD 81-01). The runner (81-08), the scorer (81-02) and the batch specs
 * (81-09..81-12) import these names and code against these shapes; change them only with every consumer.
 *
 * RunDescriptor  (one planned headless `claude -p` run; batch modules return these, the runner executes them)
 *   { id            [A-Za-z0-9._-]+, unique within the batch
 *     batch         one of BATCHES
 *     kind          one of KINDS: agent (`--agent <agent>`), prompt (a bare prompt), workflow (a slash command)
 *     agent         the agent name for kind agent (e.g. 'aoforge:verifier'), else null
 *     model         one of MODELS (a tier; the pinned id comes from model-profiles.json `models`)
 *     plugin        one of PLUGINS: the plugin tree to load, or null for none
 *     prompt        the prompt text
 *     tools         string[] | null       (optional; `--tools`)
 *     jsonSchema    object | null         (optional; `--json-schema`)
 *     capUsd        > 0, the run's `--max-budget-usd`
 *     capBasis      string                (optional; caps.cjs derivation)
 *     timeoutMs     positive integer
 *     env           { AOFORGE_SKIP_*: "1" } only (ENV_ALLOW); every other variable is built by secret.childEnv
 *     fixture       { ... } opaque to the runner (the batch module's own data), or null
 *     order         non-negative integer, the run's position in the batch
 *     role          string                (optional; the ledger's reserve key with batch, e.g. 'verifier',
 *                                          'workflow:build'; null/absent is its own key) }
 *
 * RunRecord  (what one run produced; result.parseStream fills the stream fields, the runner the rest)
 *   { id, batch, role, model, requested_model_id, plugin, agent, status (one of STATUSES),
 *     cost_usd (reported total_cost_usd, or null), transcript_cost_usd, transcript_unpriced (optional, messages
 *     transcriptCost could not price), charged_usd, cost_source (one of COST_SOURCES), cap_usd, reserve_usd,
 *     overshoot_usd,
 *     usage{input, cache_creation, cache_read, output}, first_turn_input, model_usage{}, model_ran, side_models[],
 *     duration_ms, wall_ms, num_turns, session_id, init_tools[], permission_denials[], isolation{},
 *     structured_output, result_text, reset_epoch, claude_version, started_at, finished_at, outputs{}, error }
 *   A record needs cost_usd (a number) or cost_source, except a dry_run or skipped_budget record, which spent nothing.
 *
 * LedgerEntry  (one charged run in ledger.json `entries`)
 *   { id, batch, role, status (one of ENTRY_STATUSES), cap_usd, reserve_usd, reported_usd, transcript_usd,
 *     charged_usd, cost_source, overshoot_usd, at }
 *   status 'lost_root' is a chargeLost entry (the scratch eval root was lost mid-batch), never a run status.
 *
 * SpendBlock  (results/<X>.json `spend`, written by score.cjs (81-02); read back by ledger.rebuildLedger)
 *   { ledger_version, batch, status (one of BATCH_STATUSES), spent_usd, ledger_total_usd, entries: LedgerEntry[] }
 *   spent_usd equals the sum of the entries' charged_usd to 1e-6.
 *
 * Every validator returns {ok, errors[]}; each error string starts with the field it names (`capUsd: ...`).
 */

const BATCHES = ['A', 'B', 'C', 'D', 'E'];
const ORDER = ['A', 'B', 'D', 'E', 'C'];
const MODELS = ['haiku', 'sonnet', 'opus'];
const PLUGINS = ['3.0.0', '3.1.0', null];
const KINDS = ['agent', 'prompt', 'workflow'];
const STATUSES = ['ok', 'error', 'cap_hit', 'rate_limited', 'no_result', 'timeout', 'harness_error', 'skipped_budget', 'dry_run'];
const COST_SOURCES = ['reported', 'transcript_sum', 'reserve_charged', 'lost_root_charged'];
const BATCH_STATUSES = ['pending', 'running', 'complete', 'stopped'];
const ENTRY_STATUSES = [...STATUSES, 'lost_root'];
// Statuses with no spend: the run was never spawned.
const UNSPENT_STATUSES = ['dry_run', 'skipped_budget'];
const ENV_ALLOW = /^AOFORGE_SKIP_[A-Z_]+$/;
const ID_RE = /^[A-Za-z0-9._-]+$/;
const SPEND_TOLERANCE = 1e-6;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isMoney = (v) => isFiniteNumber(v) && v >= 0;
const isMoneyOrNull = (v) => v === null || isMoney(v);
const round6 = (x) => Math.round(x * 1e6) / 1e6;

function result(errors) {
  return { ok: errors.length === 0, errors };
}

/** Is `env` a valid descriptor/childEnv extra map? Returns the error strings. */
function envErrors(env, field = 'env') {
  if (!isPlainObject(env)) return [`${field}: must be an object of AOFORGE_SKIP_*: "1" entries`];
  const errors = [];
  for (const [key, value] of Object.entries(env)) {
    if (!ENV_ALLOW.test(key)) errors.push(`${field}.${key}: not allowlisted (only AOFORGE_SKIP_*)`);
    else if (value !== '1') errors.push(`${field}.${key}: value must be the string "1"`);
  }
  return errors;
}

/** Validate a RunDescriptor. */
function validateDescriptor(d) {
  if (!isPlainObject(d)) return result(['descriptor: must be an object']);
  const errors = [];
  if (typeof d.id !== 'string' || !ID_RE.test(d.id)) errors.push('id: must match [A-Za-z0-9._-]+');
  if (!BATCHES.includes(d.batch)) errors.push(`batch: must be one of ${BATCHES.join(', ')}`);
  if (!KINDS.includes(d.kind)) errors.push(`kind: must be one of ${KINDS.join(', ')}`);
  if (d.kind === 'agent') {
    if (!isNonEmptyString(d.agent)) errors.push('agent: required for kind agent');
  } else if (d.agent !== undefined && d.agent !== null && !isNonEmptyString(d.agent)) {
    errors.push('agent: must be a string or null');
  }
  if (!MODELS.includes(d.model)) errors.push(`model: must be one of ${MODELS.join(', ')}`);
  if (!PLUGINS.includes(d.plugin)) errors.push(`plugin: must be one of ${PLUGINS.map(String).join(', ')}`);
  if (!isNonEmptyString(d.prompt)) errors.push('prompt: must be a non-empty string');
  if (d.tools !== undefined && d.tools !== null
    && !(Array.isArray(d.tools) && d.tools.every((t) => typeof t === 'string'))) {
    errors.push('tools: must be a string array or null');
  }
  if (d.jsonSchema !== undefined && d.jsonSchema !== null && !isPlainObject(d.jsonSchema)) {
    errors.push('jsonSchema: must be an object or null');
  }
  if (!isFiniteNumber(d.capUsd) || d.capUsd <= 0) errors.push('capUsd: must be a positive finite number');
  if (d.capBasis !== undefined && d.capBasis !== null && typeof d.capBasis !== 'string') {
    errors.push('capBasis: must be a string');
  }
  if (!Number.isInteger(d.timeoutMs) || d.timeoutMs <= 0) errors.push('timeoutMs: must be a positive integer');
  errors.push(...envErrors(d.env));
  if (d.fixture !== null && !isPlainObject(d.fixture)) errors.push('fixture: must be an object or null');
  if (!Number.isInteger(d.order) || d.order < 0) errors.push('order: must be a non-negative integer');
  if (d.role !== undefined && d.role !== null && !isNonEmptyString(d.role)) errors.push('role: must be a string or null');
  return result(errors);
}

/** Validate a RunRecord (the fields every consumer relies on; the rest are free-form). */
function validateRecord(r) {
  if (!isPlainObject(r)) return result(['record: must be an object']);
  const errors = [];
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) errors.push('id: must match [A-Za-z0-9._-]+');
  if (!BATCHES.includes(r.batch)) errors.push(`batch: must be one of ${BATCHES.join(', ')}`);
  if (!STATUSES.includes(r.status)) errors.push(`status: must be one of ${STATUSES.join(', ')}`);
  const hasSource = r.cost_source !== undefined && r.cost_source !== null;
  if (hasSource && !COST_SOURCES.includes(r.cost_source)) {
    errors.push(`cost_source: must be one of ${COST_SOURCES.join(', ')}`);
  }
  if (r.cost_usd !== undefined && !isMoneyOrNull(r.cost_usd)) errors.push('cost_usd: must be a number >= 0 or null');
  if (!UNSPENT_STATUSES.includes(r.status) && !isMoney(r.cost_usd) && !hasSource) {
    errors.push('cost_usd: a record needs a reported cost_usd or a cost_source');
  }
  for (const key of ['transcript_cost_usd', 'charged_usd', 'cap_usd', 'reserve_usd', 'overshoot_usd']) {
    if (r[key] !== undefined && !isMoneyOrNull(r[key])) errors.push(`${key}: must be a number >= 0 or null`);
  }
  if (r.reset_epoch !== undefined && r.reset_epoch !== null && !Number.isInteger(r.reset_epoch)) {
    errors.push('reset_epoch: must be an integer epoch (seconds) or null');
  }
  return result(errors);
}

/** Validate one LedgerEntry; `field` prefixes each error. */
function ledgerEntryErrors(e, field = 'entry') {
  if (!isPlainObject(e)) return [`${field}: must be an object`];
  const errors = [];
  if (!isNonEmptyString(e.id)) errors.push(`${field}.id: must be a non-empty string`);
  if (!BATCHES.includes(e.batch)) errors.push(`${field}.batch: must be one of ${BATCHES.join(', ')}`);
  if (e.role !== null && !isNonEmptyString(e.role)) errors.push(`${field}.role: must be a string or null`);
  if (!ENTRY_STATUSES.includes(e.status)) errors.push(`${field}.status: must be one of ${ENTRY_STATUSES.join(', ')}`);
  if (!COST_SOURCES.includes(e.cost_source)) errors.push(`${field}.cost_source: must be one of ${COST_SOURCES.join(', ')}`);
  if (!isMoney(e.charged_usd)) errors.push(`${field}.charged_usd: must be a number >= 0`);
  if (!isMoney(e.overshoot_usd)) errors.push(`${field}.overshoot_usd: must be a number >= 0`);
  for (const key of ['cap_usd', 'reserve_usd', 'reported_usd', 'transcript_usd']) {
    if (!isMoneyOrNull(e[key])) errors.push(`${field}.${key}: must be a number >= 0 or null`);
  }
  if (typeof e.at !== 'string') errors.push(`${field}.at: must be an ISO timestamp string`);
  return errors;
}

/** Validate a SpendBlock, including that its entries sum to spent_usd. */
function validateSpendBlock(b) {
  if (!isPlainObject(b)) return result(['spend: must be an object']);
  const errors = [];
  if (b.ledger_version !== 1) errors.push('ledger_version: must be 1');
  if (!BATCHES.includes(b.batch)) errors.push(`batch: must be one of ${BATCHES.join(', ')}`);
  if (!BATCH_STATUSES.includes(b.status)) errors.push(`status: must be one of ${BATCH_STATUSES.join(', ')}`);
  if (!isMoney(b.spent_usd)) errors.push('spent_usd: must be a number >= 0');
  if (!isMoney(b.ledger_total_usd)) errors.push('ledger_total_usd: must be a number >= 0');
  if (!Array.isArray(b.entries)) {
    errors.push('entries: must be an array of LedgerEntry');
    return result(errors);
  }
  const seen = new Set();
  let sum = 0;
  b.entries.forEach((e, i) => {
    const field = `entries[${i}]`;
    errors.push(...ledgerEntryErrors(e, field));
    if (isPlainObject(e)) {
      if (BATCHES.includes(b.batch) && e.batch !== b.batch) errors.push(`${field}.batch: ${e.batch} in the ${b.batch} block`);
      if (seen.has(e.id)) errors.push(`${field}.id: duplicate ${e.id}`);
      seen.add(e.id);
      if (isMoney(e.charged_usd)) sum += e.charged_usd;
    }
  });
  if (isMoney(b.spent_usd) && Math.abs(round6(sum) - b.spent_usd) > SPEND_TOLERANCE) {
    errors.push(`spent_usd: ${b.spent_usd} does not equal the entries' charged sum ${round6(sum)}`);
  }
  return result(errors);
}

module.exports = {
  BATCHES,
  ORDER,
  MODELS,
  PLUGINS,
  KINDS,
  STATUSES,
  COST_SOURCES,
  BATCH_STATUSES,
  ENTRY_STATUSES,
  UNSPENT_STATUSES,
  ENV_ALLOW,
  ID_RE,
  SPEND_TOLERANCE,
  round6,
  envErrors,
  validateDescriptor,
  validateRecord,
  validateSpendBlock,
  ledgerEntryErrors,
};
