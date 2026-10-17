'use strict';
// Hand-built `claude -p --output-format stream-json --verbose` events for the objective-81 harness tests (TRD 81-01).
//
// Field names follow a real `claude -p --output-format json` result object captured on 2026-10-17 (subscription
// token, Haiku 5.5): total_cost_usd, usage{input_tokens, cache_creation_input_tokens, cache_read_input_tokens,
// output_tokens, cache_creation{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}}, modelUsage{<id>:{inputTokens,
// outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD, canonicalModel, costBasis}}, duration_ms,
// duration_api_ms, num_turns, session_id, subtype, is_error, result, terminal_reason, permission_denials. No generated
// data: every number below is written out by hand so a test can recompute it.

const SESSION = '11111111-2222-3333-4444-555555555555';

/** An API usage block in the CLI's own spelling. cc5m/cc1h, when given, become the cache_creation split. */
function usage({ input = 0, cache_creation = 0, cache_read = 0, output = 0, cc5m, cc1h } = {}) {
  const u = {
    input_tokens: input,
    cache_creation_input_tokens: cache_creation,
    cache_read_input_tokens: cache_read,
    output_tokens: output,
  };
  if (cc5m !== undefined || cc1h !== undefined) {
    u.cache_creation = { ephemeral_5m_input_tokens: cc5m || 0, ephemeral_1h_input_tokens: cc1h || 0 };
  }
  return u;
}

/** The `system/init` event the CLI writes first. */
function initEvent({
  model = 'claude-haiku-5-5',
  tools = ['Bash', 'Read', 'Grep', 'Glob'],
  plugins = [],
  agents = [],
  permissionMode = 'default',
  session_id = SESSION,
  claude_code_version,
} = {}) {
  const ev = {
    type: 'system',
    subtype: 'init',
    cwd: '/work',
    session_id,
    tools,
    mcp_servers: [],
    model,
    permissionMode,
    agents,
    plugins,
    uuid: 'init-uuid-1',
  };
  if (claude_code_version !== undefined) ev.claude_code_version = claude_code_version;
  return ev;
}

/**
 * One assistant API message. With `repeat: true` it is written once per content block, every copy carrying the same
 * message id and usage (what stream-json does); otherwise one event carries all the blocks. Always an array.
 */
function assistantMsg({
  id,
  model = 'claude-haiku-5-5',
  usage: u = usage(),
  content = [{ type: 'text', text: 'ok' }],
  repeat = false,
  parent_tool_use_id = null,
  session_id = SESSION,
  uuid,
} = {}) {
  const event = (blocks, n) => ({
    type: 'assistant',
    message: { id, type: 'message', role: 'assistant', model, content: blocks, stop_reason: null, usage: u },
    parent_tool_use_id,
    session_id,
    uuid: uuid ? `${uuid}${n ? `-${n}` : ''}` : `${id}-row-${n}`,
  });
  if (repeat) return content.map((block, n) => event([block], n));
  return [event(content, 0)];
}

/** A tool_use content block. */
function toolUse(id, name, input) {
  return { type: 'tool_use', id, name, input };
}

/**
 * The final `type:"result"` event. Every field is optional: pass `omit: ['num_turns', ...]` to drop one that has a
 * default, so the parser is tested with and without it.
 */
function resultEvent({
  subtype = 'success',
  is_error = false,
  total_cost_usd = 0,
  usage: u = usage(),
  modelUsage = {},
  duration_ms = 1000,
  duration_api_ms = 800,
  num_turns = 1,
  session_id = SESSION,
  result = 'ok',
  structured_output,
  permission_denials = [],
  terminal_reason = 'completed',
  api_error_status,
  omit = [],
} = {}) {
  const ev = {
    type: 'result',
    subtype,
    is_error,
    total_cost_usd,
    usage: u,
    modelUsage,
    duration_ms,
    duration_api_ms,
    num_turns,
    session_id,
    result,
    permission_denials,
    terminal_reason,
    uuid: 'result-uuid-1',
  };
  if (structured_output !== undefined) ev.structured_output = structured_output;
  if (api_error_status !== undefined) ev.api_error_status = api_error_status;
  for (const key of omit) delete ev[key];
  return ev;
}

/** A modelUsage row in the CLI's camelCase spelling. */
function modelUsageRow({ input = 0, output = 0, cache_read = 0, cache_creation = 0, cost = 0, id }) {
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadInputTokens: cache_read,
    cacheCreationInputTokens: cache_creation,
    costUSD: cost,
    canonicalModel: id,
    costBasis: 'list',
  };
}

/** JSONL text of a (possibly nested) event list, one event per line, trailing newline. */
function toLines(events) {
  return `${events.flat(Infinity).map((e) => JSON.stringify(e)).join('\n')}\n`;
}

// ---- canned streams --------------------------------------------------------------------------------------------

// Two assistant messages on Haiku. msg-1 is repeated for two content blocks (text + tool_use) with one usage.
const HAPPY = {
  msg1: usage({ input: 3, cache_creation: 1000, cache_read: 35000, output: 40 }),
  msg2: usage({ input: 5, cache_creation: 200, cache_read: 36000, output: 60 }),
  total: usage({ input: 8, cache_creation: 1200, cache_read: 71000, output: 100, cc5m: 1200, cc1h: 0 }),
  cost: 0.0123,
};

function happyStream({ model = 'claude-haiku-5-5', omit = [], structured_output } = {}) {
  return [
    initEvent({ model, tools: ['Bash', 'Read', 'Grep', 'Glob'] }),
    assistantMsg({
      id: 'msg-1',
      model,
      usage: HAPPY.msg1,
      repeat: true,
      content: [{ type: 'text', text: 'Looking.' }, toolUse('toolu-1', 'Read', { file_path: '/work/README.md' })],
    }),
    assistantMsg({ id: 'msg-2', model, usage: HAPPY.msg2, content: [{ type: 'text', text: 'VERDICT: pass' }] }),
    resultEvent({
      total_cost_usd: HAPPY.cost,
      usage: HAPPY.total,
      modelUsage: { [model]: modelUsageRow({ id: model, input: 8, output: 100, cache_read: 71000, cache_creation: 1200, cost: HAPPY.cost }) },
      duration_ms: 4200,
      duration_api_ms: 3900,
      num_turns: 2,
      result: 'VERDICT: pass',
      structured_output,
      omit,
    }),
  ];
}

/** The run stopped on `--max-budget-usd`: the reported cost is past the cap (the check is between turns). */
function capHitStream({ subtype = 'error_max_budget_usd', result = 'Reached maximum budget', cost = 0.62 } = {}) {
  const model = 'claude-sonnet-5-5';
  return [
    initEvent({ model }),
    assistantMsg({ id: 'msg-1', model, usage: usage({ input: 10, cache_read: 36000, output: 500 }) }),
    resultEvent({
      subtype,
      is_error: true,
      total_cost_usd: cost,
      usage: usage({ input: 10, cache_read: 36000, output: 500 }),
      modelUsage: { [model]: modelUsageRow({ id: model, input: 10, output: 500, cache_read: 36000, cost }) },
      num_turns: 7,
      result,
      terminal_reason: 'budget',
    }),
  ];
}

/** A subscription usage limit: the epoch after the bar is when it resets. */
function usageLimitStream(epoch = 1760000000) {
  return [
    initEvent(),
    resultEvent({
      subtype: 'success',
      is_error: true,
      total_cost_usd: 0,
      num_turns: 1,
      result: `Claude AI usage limit reached|${epoch}`,
    }),
  ];
}

/** An API 429 with no reset time. */
function http429Stream() {
  return [
    initEvent(),
    resultEvent({
      subtype: 'success',
      is_error: true,
      total_cost_usd: 0,
      api_error_status: 429,
      result: 'API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"Number of requests has exceeded your rate limit"}}',
    }),
  ];
}

/** Killed or timed out: messages but no result event. */
function noResultStream() {
  return [
    initEvent(),
    assistantMsg({ id: 'msg-1', usage: usage({ input: 4, cache_read: 36000, output: 30 }) }),
    assistantMsg({ id: 'msg-2', usage: usage({ input: 6, cache_creation: 500, cache_read: 36100, output: 70 }) }),
  ];
}

/**
 * Sonnet carries the output; a small Haiku side call (a title or command-prefix call) carries 2% of it.
 * Swap `main` and `side` to model a run where the wrong model did the work.
 */
function sideModelStream({ main = 'claude-sonnet-5-5', side = 'claude-haiku-5-5', mainOut = 980, sideOut = 20 } = {}) {
  return [
    initEvent({ model: main }),
    assistantMsg({ id: 'msg-side', model: side, usage: usage({ input: 50, output: sideOut }) }),
    assistantMsg({ id: 'msg-1', model: main, usage: usage({ input: 9, cache_read: 36000, output: mainOut }) }),
    resultEvent({
      total_cost_usd: 0.05,
      usage: usage({ input: 59, cache_read: 36000, output: mainOut + sideOut }),
      modelUsage: {
        [side]: modelUsageRow({ id: side, input: 50, output: sideOut, cost: 0.00002 }),
        [main]: modelUsageRow({ id: main, input: 9, output: mainOut, cache_read: 36000, cost: 0.04998 }),
      },
      num_turns: 1,
    }),
  ];
}

module.exports = {
  SESSION,
  HAPPY,
  usage,
  initEvent,
  assistantMsg,
  toolUse,
  resultEvent,
  modelUsageRow,
  toLines,
  happyStream,
  capHitStream,
  usageLimitStream,
  http429Stream,
  noResultStream,
  sideModelStream,
};
