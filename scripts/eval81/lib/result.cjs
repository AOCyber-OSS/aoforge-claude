'use strict';
/**
 * Turn a headless `claude -p --output-format stream-json --verbose` log into RunRecord fields (TRD 81-01), and price
 * a run's copied transcripts.
 *
 * Usage dedupe (the rule of plugins/aoforge/aoforge/bin/lib/token-usage.cjs `sumUsage`, re-implemented because a
 * stream log also carries `system/init` and `type:"result"` events that module ignores): only `type:'assistant'` rows
 * with an object `message.usage` and a model other than `<synthetic>` count; the key is `message.id`, else the row's
 * `uuid`; per key the record with the largest `output_tokens` wins. Stream-json repeats one API message once per
 * content block with the same usage, so without the dedupe first-turn input and totals double-count.
 *
 * Statuses (contract STATUSES): `no_result` when the stream has no result event (killed, timed out); `rate_limited`
 * for a subscription usage limit (`Claude AI usage limit reached|<epoch>`) or an API 429 / `rate_limit_error`;
 * `cap_hit` for a `--max-budget-usd` stop (a subtype or terminal reason naming the budget, or an error result whose
 * text does); `error` for any other error result; else `ok`.
 *
 * Nothing here spawns `claude`, reads the network or reads ~/.claude.
 */

const fs = require('fs');
const path = require('path');
const { rateFor } = require('../../../plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs');

const PROFILES_PATH = path.join(__dirname, '..', '..', '..', 'plugins', 'aoforge', 'aoforge', 'references', 'model-profiles.json');
const SYNTHETIC_MODEL = '<synthetic>';
// model_ran: the requested pin must carry at least this share of output tokens.
const MODEL_RAN_SHARE = 0.9;
// Long-prompt pricing (references/model-rates.json `note` on claude-haiku-5-5: "Over 100K: input 0.50, cache writes
// 0.625 (5m) and 1 (1h), cache hits 0.05, output 2.50", i.e. every rate x5). A message whose prompt (input +
// cache_creation + cache_read) exceeds the threshold is priced at multiplier x each rate. result.test.cjs asserts the
// note still says so, so a rate-file change fails loudly instead of mispricing.
const LONG_PROMPT = {
  'claude-haiku-5-5': { threshold: 100000, multiplier: 5 },
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round6 = (x) => Math.round(x * 1e6) / 1e6;

/** Parse JSONL text; unparseable or non-object lines are counted, never thrown. */
function parseLines(text) {
  const events = [];
  let skipped = 0;
  for (const line of String(text || '').split('\n')) {
    if (line.trim() === '') continue;
    try {
      const ev = JSON.parse(line);
      if (isPlainObject(ev)) events.push(ev);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { events, skipped };
}

/**
 * Deduped assistant API messages, in first-seen order: [{key, model, usage, mainThread}].
 * `mainThread` is false for a subagent's message relayed into the stream (parent_tool_use_id set).
 */
function dedupeAssistant(events) {
  const byKey = new Map();
  let anonymous = 0;
  for (const row of events) {
    if (!row || row.type !== 'assistant') continue;
    const msg = row.message;
    if (!isPlainObject(msg) || !isPlainObject(msg.usage)) continue;
    const model = typeof msg.model === 'string' && msg.model ? msg.model : 'unknown';
    if (model === SYNTHETIC_MODEL) continue;
    let key;
    if (typeof msg.id === 'string' && msg.id) key = `id:${msg.id}`;
    else if (typeof row.uuid === 'string' && row.uuid) key = `uuid:${row.uuid}`;
    else key = `row:${anonymous++}`;
    const prev = byKey.get(key);
    const mainThread = !row.parent_tool_use_id;
    if (!prev) byKey.set(key, { key, model, usage: msg.usage, mainThread });
    else if (count(msg.usage.output_tokens) > count(prev.usage.output_tokens)) {
      byKey.set(key, { ...prev, model, usage: msg.usage });
    }
  }
  return [...byKey.values()];
}

function usageSplit(u) {
  return {
    input: count(u && u.input_tokens),
    cache_creation: count(u && u.cache_creation_input_tokens),
    cache_read: count(u && u.cache_read_input_tokens),
    output: count(u && u.output_tokens),
  };
}

const promptTokens = (u) => count(u.input_tokens) + count(u.cache_creation_input_tokens) + count(u.cache_read_input_tokens);

/** Input + cache_creation + cache_read of the session's first API message (deduped; subagent rows skipped). */
function firstTurnInput(textOrEvents) {
  const events = Array.isArray(textOrEvents) ? textOrEvents : parseLines(textOrEvents).events;
  const first = dedupeAssistant(events).find((m) => m.mainThread);
  return first ? promptTokens(first.usage) : null;
}

function loadPins(profilesPath = PROFILES_PATH) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
  } catch (err) {
    throw new Error(`cannot read model profiles ${profilesPath}: ${err.message}`);
  }
  if (!isPlainObject(raw) || !isPlainObject(raw.models)) throw new Error(`model profiles ${profilesPath}: "models" must be an object`);
  return raw.models;
}

/** The pinned API id for a tier (`haiku`), or the id itself when one is passed. */
function pinnedId(requestedModel, profilesPath = PROFILES_PATH) {
  if (typeof requestedModel !== 'string' || requestedModel === '') return null;
  const pins = loadPins(profilesPath);
  if (Object.prototype.hasOwnProperty.call(pins, requestedModel)) return pins[requestedModel];
  return requestedModel;
}

/** Strip a `[1m]`-style suffix and a trailing `-YYYYMMDD` so a usage key compares with a pin. */
function normalizeId(id) {
  return String(id).trim().replace(/\[[^\]]*\]$/, '').trim().replace(/-\d{8}$/, '');
}

/**
 * Did the requested tier's pinned model do the work? True when it carries >= 90% of output tokens (with no output at
 * all, when it is the only model present). Every other id is listed in side_models, never dropped.
 * @param {Object<string, {outputTokens?: number, canonicalModel?: string}>} modelUsage  the result event's modelUsage
 * @returns {{model_ran: boolean|null, requested_model_id: string|null, share: number|null, side_models: string[]}}
 */
function modelRan(modelUsage, requestedModel, profilesPath = PROFILES_PATH) {
  const requested = pinnedId(requestedModel, profilesPath);
  const rows = isPlainObject(modelUsage) ? Object.entries(modelUsage) : [];
  const out = new Map();
  for (const [key, row] of rows) {
    const id = normalizeId(isPlainObject(row) && typeof row.canonicalModel === 'string' && row.canonicalModel ? row.canonicalModel : key);
    out.set(id, (out.get(id) || 0) + count(isPlainObject(row) ? row.outputTokens : 0));
  }
  const want = requested === null ? null : normalizeId(requested);
  const side_models = [...out.keys()].filter((id) => id !== want).sort();
  if (want === null) return { model_ran: null, requested_model_id: null, share: null, side_models };
  const total = [...out.values()].reduce((a, b) => a + b, 0);
  if (total === 0) {
    return { model_ran: out.has(want) && side_models.length === 0, requested_model_id: requested, share: null, side_models };
  }
  const share = (out.get(want) || 0) / total;
  return { model_ran: share >= MODEL_RAN_SHARE, requested_model_id: requested, share: round6(share), side_models };
}

/** Is a result event a subscription usage limit or an API rate limit? Parses the reset epoch when it is given. */
function isRateLimit(resultEvent) {
  const none = { limited: false, reset_epoch: null };
  if (!isPlainObject(resultEvent)) return none;
  const text = typeof resultEvent.result === 'string' ? resultEvent.result : '';
  const usage = /usage limit reached(?:\|(\d{9,11}))?/i.exec(text);
  if (usage) return { limited: true, reset_epoch: usage[1] ? Number(usage[1]) : null };
  const errored = resultEvent.is_error === true || (typeof resultEvent.subtype === 'string' && resultEvent.subtype.startsWith('error'));
  if (resultEvent.api_error_status === 429) return { limited: true, reset_epoch: null };
  if (errored && (/rate_limit_error/.test(text) || /\b429\b/.test(text) || /rate limit/i.test(text))) {
    return { limited: true, reset_epoch: null };
  }
  return none;
}

function isBudgetStop(resultEvent) {
  const subtype = typeof resultEvent.subtype === 'string' ? resultEvent.subtype : '';
  const terminal = typeof resultEvent.terminal_reason === 'string' ? resultEvent.terminal_reason : '';
  if (/budget/i.test(subtype) || /budget/i.test(terminal)) return true;
  const errored = resultEvent.is_error === true || subtype.startsWith('error');
  return errored && typeof resultEvent.result === 'string' && /budget/i.test(resultEvent.result);
}

function isErrorResult(resultEvent) {
  return resultEvent.is_error === true || (typeof resultEvent.subtype === 'string' && resultEvent.subtype.startsWith('error'));
}

/** modelUsage rebuilt from the deduped stream messages, for a stream with no result event. */
function modelUsageFromMessages(messages) {
  const out = {};
  for (const { model, usage } of messages) {
    const row = out[model] || (out[model] = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });
    row.inputTokens += count(usage.input_tokens);
    row.outputTokens += count(usage.output_tokens);
    row.cacheReadInputTokens += count(usage.cache_read_input_tokens);
    row.cacheCreationInputTokens += count(usage.cache_creation_input_tokens);
  }
  return out;
}

/**
 * Parse a stream log into RunRecord fields (the runner adds id, batch, role, plugin, agent, the ledger money fields,
 * wall time, isolation and outputs).
 * @param {string} text  the stream-json log
 * @param {{requestedModel?: string, profilesPath?: string}} [opts]  requestedModel is a tier or a model id
 */
function parseStream(text, { requestedModel, profilesPath = PROFILES_PATH } = {}) {
  const { events, skipped } = parseLines(text);
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') || null;
  const results = events.filter((e) => e.type === 'result');
  const resultEv = results.length ? results[results.length - 1] : null;
  const messages = dedupeAssistant(events);

  let usage;
  let usage_source;
  if (resultEv && isPlainObject(resultEv.usage)) {
    usage = usageSplit(resultEv.usage);
    usage_source = 'result';
  } else {
    usage = { input: 0, cache_creation: 0, cache_read: 0, output: 0 };
    for (const m of messages) {
      const s = usageSplit(m.usage);
      for (const k of Object.keys(usage)) usage[k] += s[k];
    }
    usage_source = 'stream';
  }
  const model_usage = resultEv && isPlainObject(resultEv.modelUsage) ? resultEv.modelUsage : modelUsageFromMessages(messages);
  const ran = modelRan(model_usage, requestedModel, profilesPath);

  let status;
  let reset_epoch = null;
  if (!resultEv) status = 'no_result';
  else {
    const rl = isRateLimit(resultEv);
    if (rl.limited) {
      status = 'rate_limited';
      reset_epoch = rl.reset_epoch;
    } else if (isBudgetStop(resultEv)) status = 'cap_hit';
    else if (isErrorResult(resultEv)) status = 'error';
    else status = 'ok';
  }

  const first = messages.find((m) => m.mainThread);
  const pick = (key) => (resultEv && resultEv[key] !== undefined ? resultEv[key] : null);
  return {
    status,
    subtype: typeof pick('subtype') === 'string' ? pick('subtype') : null,
    is_error: typeof pick('is_error') === 'boolean' ? pick('is_error') : null,
    cost_usd: resultEv ? numOrNull(resultEv.total_cost_usd) : null,
    usage,
    usage_source,
    first_turn_input: first ? promptTokens(first.usage) : null,
    assistant_messages: messages.length,
    model_usage,
    requested_model_id: ran.requested_model_id,
    model_ran: ran.model_ran,
    model_share: ran.share,
    side_models: ran.side_models,
    duration_ms: numOrNull(pick('duration_ms')),
    duration_api_ms: numOrNull(pick('duration_api_ms')),
    num_turns: numOrNull(pick('num_turns')),
    session_id: (resultEv && typeof resultEv.session_id === 'string' && resultEv.session_id)
      || (init && typeof init.session_id === 'string' ? init.session_id : null),
    init_tools: init && Array.isArray(init.tools) ? [...init.tools] : [],
    init_model: init && typeof init.model === 'string' ? init.model : null,
    claude_version: init && typeof init.claude_code_version === 'string' ? init.claude_code_version : null,
    permission_denials: resultEv && Array.isArray(resultEv.permission_denials) ? resultEv.permission_denials : [],
    structured_output: resultEv && resultEv.structured_output !== undefined ? resultEv.structured_output : null,
    result_text: typeof pick('result') === 'string' ? pick('result') : null,
    terminal_reason: typeof pick('terminal_reason') === 'string' ? pick('terminal_reason') : null,
    subagent_stats: isPlainObject(pick('subagent_stats')) ? pick('subagent_stats') : null,
    reset_epoch,
    parse_skipped: skipped,
  };
}

/** The parsed result event of a stream, or null. */
function parseResultEvent(text) {
  const results = parseLines(text).events.filter((e) => e.type === 'result');
  return results.length ? results[results.length - 1] : null;
}

/**
 * The tool_use ids whose JSON input mentions any pattern (the contamination scan the scorers use), in stream order.
 * @param {string} text  the stream-json log
 * @param {Array<RegExp|string>} patterns  a string matches as a substring
 */
function toolInputsMentioning(text, patterns) {
  const ids = [];
  const seen = new Set();
  const matches = (s) => patterns.some((p) => {
    if (p instanceof RegExp) {
      p.lastIndex = 0;
      return p.test(s);
    }
    return s.includes(String(p));
  });
  for (const row of parseLines(text).events) {
    if (row.type !== 'assistant' || !isPlainObject(row.message) || !Array.isArray(row.message.content)) continue;
    for (const block of row.message.content) {
      if (!isPlainObject(block) || block.type !== 'tool_use' || seen.has(block.id)) continue;
      if (matches(JSON.stringify(block.input === undefined ? null : block.input))) {
        seen.add(block.id);
        ids.push(block.id);
      }
    }
  }
  return ids;
}

/** Every *.jsonl under dir (symlinks skipped), as sorted posix-relative paths. */
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

/** USD for one message's usage at a rate row (cache writes split 5m/1h when the split is present, else 5m). */
function priceMessage(usage, rate) {
  const long = LONG_PROMPT[rate.id];
  const m = long && promptTokens(usage) > long.threshold ? long.multiplier : 1;
  const cc = count(usage.cache_creation_input_tokens);
  let cc5m = cc;
  let cc1h = 0;
  if (isPlainObject(usage.cache_creation)) {
    const split5 = count(usage.cache_creation.ephemeral_5m_input_tokens);
    cc1h = count(usage.cache_creation.ephemeral_1h_input_tokens);
    // Any part of the total the split does not name is priced at 5m, the CLI default.
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

/**
 * Price a run's copied transcripts: the main session file(s) and every `<session>/subagents/agent-*.jsonl`, each file
 * deduped by message id. A reported cost that leaves out subagent spend is caught by comparing the two.
 * @param {string} dir  the run's transcripts directory
 * @param {{rates: object}} opts  `loadRates()` from calibration-inputs.cjs (tests pass a hand-built object)
 * @returns {{cost_usd: number|null, main_usd: number|null, subagent_usd: number|null,
 *   by_model: Object<string, {messages, input, cache_creation, cache_read, output, cost_usd}>, files: string[],
 *   unpriced: {messages: number, models: string[]}, partial: boolean}}
 *   cost_usd is null when the dir is missing or holds no transcript. partial is true when a message's model has no
 *   rate (counted in unpriced, never priced at $0 silently).
 */
function transcriptCost(dir, { rates } = {}) {
  if (!rates || !isPlainObject(rates.models)) throw new TypeError('transcriptCost: opts.rates must be a loaded rates object (loadRates())');
  const empty = { cost_usd: null, main_usd: null, subagent_usd: null, by_model: {}, files: [], unpriced: { messages: 0, models: [] }, partial: false };
  let stat;
  try {
    stat = fs.statSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return empty;
    throw new Error(`transcriptCost: cannot read ${dir}: ${err.code || err.message}`);
  }
  if (!stat.isDirectory()) throw new Error(`transcriptCost: ${dir} is not a directory`);
  const files = listJsonl(dir);
  if (files.length === 0) return empty;

  let main = 0;
  let sub = 0;
  const by_model = {};
  const unpricedModels = new Set();
  let unpricedMessages = 0;
  for (const rel of files) {
    const isSub = rel.split('/').includes('subagents');
    const { events } = parseLines(fs.readFileSync(path.join(dir, rel), 'utf-8'));
    for (const { model, usage } of dedupeAssistant(events)) {
      const rate = rateFor(rates, model);
      const row = by_model[model] || (by_model[model] = { messages: 0, input: 0, cache_creation: 0, cache_read: 0, output: 0, cost_usd: 0 });
      const s = usageSplit(usage);
      row.messages += 1;
      for (const k of ['input', 'cache_creation', 'cache_read', 'output']) row[k] += s[k];
      if (!rate) {
        unpricedMessages += 1;
        unpricedModels.add(model);
        row.cost_usd = null;
        continue;
      }
      const usd = priceMessage(usage, rate);
      if (row.cost_usd !== null) row.cost_usd += usd;
      if (isSub) sub += usd;
      else main += usd;
    }
  }
  for (const row of Object.values(by_model)) if (row.cost_usd !== null) row.cost_usd = round6(row.cost_usd);
  return {
    cost_usd: round6(main + sub),
    main_usd: round6(main),
    subagent_usd: round6(sub),
    by_model,
    files,
    unpriced: { messages: unpricedMessages, models: [...unpricedModels].sort() },
    partial: unpricedMessages > 0,
  };
}

module.exports = {
  PROFILES_PATH,
  MODEL_RAN_SHARE,
  LONG_PROMPT,
  parseStream,
  parseResultEvent,
  firstTurnInput,
  modelRan,
  pinnedId,
  isRateLimit,
  toolInputsMentioning,
  transcriptCost,
};
