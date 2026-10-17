'use strict';
/**
 * Per-role metrics of one eval run, read from its copied Claude Code transcripts (TRD 81-12, test E / 76-08).
 *
 * A run dir holds `transcripts/` (the runner copies the session's `$CLAUDE_CONFIG_DIR/projects/<key>/` there). Every
 * `*.jsonl` below it is one spawn:
 *   - a file outside any `subagents/` directory is a main session: role `orchestrator`;
 *   - `.../subagents/agent-<id>.jsonl` is a subagent; its role comes from the sibling `agent-<id>.meta.json`
 *     `agentType`: `aoforge:<name>` -> `<name>` (e.g. `aoforge:job-checker` -> `job-checker`), any other type keeps
 *     its name (`general-purpose`), and a missing or unparseable meta, or one with no agentType, gives `unknown`.
 *
 * Per spawn: totals from token-usage.cjs `sumUsage(file)` (assistant rows deduped by message id, `<synthetic>`
 * skipped), `firstTurnInput(file)` = input + cache_creation + cache_read of the first deduped assistant message (the
 * prompt the spawn started with, system prompt and spawn prompt included), cache writes = cache_creation, total tokens
 * = input + cache_creation + cache_read + output, wall seconds = first-to-last row timestamp (the rule of
 * agent-overhead.cjs transcriptSpanMinutes, copied rather than reached into; fewer than two timestamps gives null),
 * and the model with the most output (`pickModel`).
 *
 * Cost: each deduped message priced with calibration-inputs.cjs `rateFor` over a `loadRates()` object
 * (references/model-rates.json; `rateFor` takes that object directly, no calibration-shaped wrapper is needed): cache
 * writes at the 5-minute rate unless the usage carries the `cache_creation.ephemeral_1h_input_tokens` split, then
 * split; result.cjs's LONG_PROMPT multiplier applies above its threshold (Haiku 5.5). This is the rule of result.cjs
 * `transcriptCost`, the figure the ledger charges, so the rows sum to it (a test holds them equal). A message whose
 * model has no rate is counted in `unpriced_messages` and the row is `partial`, never priced at $0 silently.
 *
 * A transcript that cannot be read, or holds no JSON row, gives a row with `readable: false` and null metrics (its role
 * still comes from the meta); the run's `unreadable` lists those files. A missing or empty transcripts dir gives
 * `readable: false` with no rows and a reason.
 *
 * Read only: nothing here writes, spawns, reads process.env or touches ~/.claude.
 */

const fs = require('fs');
const path = require('path');
const { sumUsage, pickModel } = require('../../../plugins/aoforge/aoforge/bin/lib/token-usage.cjs');
const { loadRates, rateFor } = require('../../../plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs');
const { LONG_PROMPT } = require('./result.cjs');

const OWN_PREFIX = 'aoforge:';
const SYNTHETIC_MODEL = '<synthetic>';
const ORCHESTRATOR = 'orchestrator';
const UNKNOWN = 'unknown';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const promptTokens = (u) => count(u.input_tokens) + count(u.cache_creation_input_tokens) + count(u.cache_read_input_tokens);

/** Parsed JSON object rows of a file, or null when the file cannot be read. */
function readRows(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (isPlainObject(row)) rows.push(row);
    } catch {
      // an unparseable line is skipped, as forEachRecord does
    }
  }
  return rows;
}

/**
 * Deduped assistant API messages in first-seen order: [{model, usage}]. The rule of token-usage.cjs sumUsage: only
 * `type:'assistant'` rows with an object `message.usage` and a model other than `<synthetic>`; key `message.id`, else
 * the row's `uuid`; per key the record with the largest output_tokens wins (the first on a tie).
 */
function dedupedMessages(rows) {
  const byKey = new Map();
  let anonymous = 0;
  for (const row of rows) {
    if (row.type !== 'assistant') continue;
    const msg = row.message;
    if (!isPlainObject(msg) || !isPlainObject(msg.usage)) continue;
    const model = typeof msg.model === 'string' && msg.model ? msg.model : 'unknown';
    if (model === SYNTHETIC_MODEL) continue;
    let key;
    if (typeof msg.id === 'string' && msg.id) key = `id:${msg.id}`;
    else if (typeof row.uuid === 'string' && row.uuid) key = `uuid:${row.uuid}`;
    else key = `row:${anonymous++}`;
    const prev = byKey.get(key);
    if (!prev || count(msg.usage.output_tokens) > count(prev.usage.output_tokens)) byKey.set(key, { model, usage: msg.usage });
  }
  return [...byKey.values()];
}

/** firstTurnInput(file) -> input + cache_creation + cache_read of the first deduped assistant message, or null. */
function firstTurnInput(file) {
  const rows = readRows(file);
  if (!rows) return null;
  const first = dedupedMessages(rows)[0];
  return first ? promptTokens(first.usage) : null;
}

/** USD for one message's usage at a rate row (result.cjs priceMessage's rule). */
function priceMessage(usage, rate) {
  const long = LONG_PROMPT[rate.id];
  const m = long && promptTokens(usage) > long.threshold ? long.multiplier : 1;
  const cc = count(usage.cache_creation_input_tokens);
  let cc5m = cc;
  let cc1h = 0;
  if (isPlainObject(usage.cache_creation)) {
    const split5 = count(usage.cache_creation.ephemeral_5m_input_tokens);
    cc1h = count(usage.cache_creation.ephemeral_1h_input_tokens);
    cc5m = split5 + Math.max(0, cc - split5 - cc1h);
  }
  return (
    count(usage.input_tokens) * rate.input * m
    + cc5m * rate.cache_write_5m * m
    + cc1h * rate.cache_write_1h * m
    + count(usage.cache_read_input_tokens) * rate.cache_read * m
    + count(usage.output_tokens) * rate.output * m
  ) / 1e6;
}

/** First and last row timestamp: {start, end, wall_s}; wall_s null with fewer than two timestamps. */
function span(rows) {
  let min = Infinity;
  let max = -Infinity;
  let seen = 0;
  for (const row of rows) {
    if (typeof row.timestamp !== 'string') continue;
    const t = Date.parse(row.timestamp);
    if (!Number.isFinite(t)) continue;
    seen += 1;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (seen === 0) return { start: null, end: null, wall_s: null };
  return {
    start: new Date(min).toISOString(),
    end: new Date(max).toISOString(),
    wall_s: seen < 2 ? null : (max - min) / 1000,
  };
}

/** roleOf(meta) -> the role name of a subagent meta object (see the module comment). */
function roleOf(meta) {
  if (!isPlainObject(meta) || typeof meta.agentType !== 'string' || meta.agentType.trim() === '') return UNKNOWN;
  const type = meta.agentType.trim();
  return type.startsWith(OWN_PREFIX) && type.length > OWN_PREFIX.length ? type.slice(OWN_PREFIX.length) : type;
}

function readMeta(file) {
  try {
    const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isPlainObject(meta) ? meta : null;
  } catch {
    return null;
  }
}

/** Every *.jsonl below dir (symlinks skipped), as sorted posix-relative paths. */
function listJsonl(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) walk(path.join(abs, ent.name), childRel);
      else if (ent.isFile() && ent.name.endsWith('.jsonl')) out.push(childRel);
    }
  };
  walk(dir, '');
  return out.sort();
}

/** One spawn's row (see the module comment for every field). */
function spawnRow(dir, rel, rates) {
  const file = path.join(dir, rel);
  const parts = rel.split('/');
  const isSub = parts.includes('subagents');
  let role = ORCHESTRATOR;
  let agentType = null;
  let agentId = null;
  if (isSub) {
    const base = path.basename(rel, '.jsonl');
    agentId = base.startsWith('agent-') ? base.slice('agent-'.length) : base;
    const meta = readMeta(path.join(path.dirname(file), `${base}.meta.json`));
    role = roleOf(meta);
    agentType = role === UNKNOWN ? null : meta.agentType.trim();
  }
  const row = {
    role,
    agent_type: agentType,
    agent_id: agentId,
    file: rel,
    readable: false,
    model: null,
    models: [],
    first_turn_input: null,
    messages: null,
    input: null,
    cache_creation: null,
    cache_read: null,
    output: null,
    total_tokens: null,
    cache_writes: null,
    cost_usd: null,
    unpriced_messages: 0,
    partial: false,
    wall_s: null,
    started_at: null,
    ended_at: null,
  };
  const rows = readRows(file);
  if (!rows || rows.length === 0) return row;
  const sum = sumUsage(file);
  if (!sum.readable) return row;

  const messages = dedupedMessages(rows);
  let usd = 0;
  let unpriced = 0;
  for (const { model, usage } of messages) {
    const rate = rateFor(rates, model);
    if (!rate) {
      unpriced += 1;
      continue;
    }
    usd += priceMessage(usage, rate);
  }
  const s = span(rows);
  Object.assign(row, {
    readable: true,
    model: pickModel(sum.by_model),
    models: Object.keys(sum.by_model).sort(),
    first_turn_input: messages.length ? promptTokens(messages[0].usage) : null,
    messages: sum.messages,
    input: sum.input,
    cache_creation: sum.cache_creation,
    cache_read: sum.cache_read,
    output: sum.output,
    total_tokens: sum.input + sum.cache_creation + sum.cache_read + sum.output,
    cache_writes: sum.cache_creation,
    cost_usd: messages.length - unpriced > 0 || messages.length === 0 ? round6(usd) : null,
    unpriced_messages: unpriced,
    partial: unpriced > 0,
    wall_s: s.wall_s,
    started_at: s.start,
    ended_at: s.end,
  });
  return row;
}

function ratesOrLoad(rates) {
  if (rates) return rates;
  const loaded = loadRates();
  if (!loaded.ok) throw new Error(`roles: ${loaded.error}`);
  return loaded;
}

/**
 * rolesForRun(runDir, {rates}) -> per-spawn metrics of one run.
 * @param {string} runDir  a run dir holding `transcripts/`
 * @param {{rates?: object}} [opts]  a loadRates() object (tests pass a hand-built one); default loadRates()
 * @returns {{transcripts: string, readable: boolean, reason: string|null, rows: object[], unreadable: string[],
 *   spawns: Object<string, number>, cost_usd: number|null, unpriced_messages: number, partial: boolean}}
 *   rows: main sessions first (by file name), then subagents by start time (then agent id).
 */
function rolesForRun(runDir, { rates } = {}) {
  const r = ratesOrLoad(rates);
  const dir = path.join(runDir, 'transcripts');
  const out = { transcripts: dir, readable: false, reason: null, rows: [], unreadable: [], spawns: {}, cost_usd: null, unpriced_messages: 0, partial: false };
  let stat = null;
  try {
    stat = fs.statSync(dir);
  } catch {
    stat = null;
  }
  if (!stat || !stat.isDirectory()) {
    out.reason = `no transcripts dir at ${dir}`;
    return out;
  }
  const files = listJsonl(dir);
  if (files.length === 0) {
    out.reason = `no transcript files under ${dir}`;
    return out;
  }
  const rows = files.map((rel) => spawnRow(dir, rel, r));
  const key = (row) => [row.role === ORCHESTRATOR && !row.agent_id ? 0 : 1, row.started_at || '￿', row.agent_id || '', row.file];
  rows.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
  let usd = 0;
  let priced = 0;
  for (const row of rows) {
    out.spawns[row.role] = (out.spawns[row.role] || 0) + 1;
    if (!row.readable) {
      out.unreadable.push(row.file);
      continue;
    }
    out.unpriced_messages += row.unpriced_messages;
    if (row.cost_usd !== null) {
      usd += row.cost_usd;
      priced += 1;
    }
  }
  out.rows = rows;
  out.readable = rows.some((row) => row.readable);
  if (!out.readable) out.reason = 'no readable transcript';
  out.cost_usd = priced > 0 ? round6(usd) : null;
  out.partial = out.unpriced_messages > 0;
  return out;
}

module.exports = { rolesForRun, firstTurnInput, roleOf, ORCHESTRATOR, UNKNOWN };
