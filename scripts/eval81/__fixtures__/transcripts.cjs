'use strict';
// Hand-built Claude Code session transcripts for the test-E role metrics (TRD 81-12): a main session file
// `<session>.jsonl` (the orchestrator) and subagent files `<session>/subagents/agent-<id>.jsonl`, each with a sibling
// `agent-<id>.meta.json` carrying `agentType` (the layout `$CLAUDE_CONFIG_DIR/projects/<key>/` has and the runner
// copies into `<run dir>/transcripts/`).
//
// Row shapes follow real transcripts: every row has `type`, `timestamp`, `sessionId` and `uuid`; one API message is
// written once per content block, every copy repeating the same `message.id` and `message.usage` (the reader must
// dedupe); subagent rows carry `isSidechain: true` and `agentId`. No generated data: every number below is written out
// by hand, and EXPECTED_STANDARD holds the hand-computed metrics for STANDARD_RUN at the hand-built RATES.

const fs = require('fs');
const path = require('path');

const SESSION = 'aaaaaaaa-1111-2222-3333-444444444444';
const PROJECT_KEY = '-sandbox-work';

// Test rates ($ per million tokens), hand-built; the module under test must price with these, not the rates file.
const RATES = {
  models: {
    'claude-opus-5-5': { input: 5, output: 25, cache_read: 0.5, cache_write_5m: 6.25, cache_write_1h: 10 },
    'claude-sonnet-5-5': { input: 2, output: 10, cache_read: 0.1, cache_write_5m: 2.5, cache_write_1h: 4 },
  },
  aliases: {},
};

/** An API usage block in the CLI's spelling; cc1h, when given, is the 1h part of cache_creation. */
function usage({ input = 0, cc = 0, cr = 0, out = 0, cc1h } = {}) {
  const u = {
    input_tokens: input,
    cache_creation_input_tokens: cc,
    cache_read_input_tokens: cr,
    output_tokens: out,
  };
  if (cc1h !== undefined) u.cache_creation = { ephemeral_5m_input_tokens: cc - cc1h, ephemeral_1h_input_tokens: cc1h };
  return u;
}

/** One API message as transcript rows: one row per content block (`blocks`, default 1), same id and usage. */
function assistantRows({ id, model, at, input, cc, cr, out, cc1h, blocks = 1, session = SESSION, agentId = null }) {
  const rows = [];
  for (let n = 0; n < blocks; n += 1) {
    const row = {
      type: 'assistant',
      timestamp: at,
      sessionId: session,
      uuid: `${id}-row-${n}`,
      message: {
        id,
        type: 'message',
        role: 'assistant',
        model,
        content: [n === 0 ? { type: 'text', text: 'working' } : { type: 'tool_use', id: `${id}-tool-${n}`, name: 'Bash', input: { command: 'node --test' } }],
        stop_reason: null,
        usage: usage({ input, cc, cr, out, cc1h }),
      },
    };
    if (agentId) {
      row.isSidechain = true;
      row.agentId = agentId;
    }
    rows.push(row);
  }
  return rows;
}

function userRow({ at, text, uuid, session = SESSION, agentId = null }) {
  const row = { type: 'user', timestamp: at, sessionId: session, uuid, message: { role: 'user', content: text } };
  if (agentId) {
    row.isSidechain = true;
    row.agentId = agentId;
  }
  return row;
}

/**
 * Rows of one spawn: a user row at `start`, the messages in order (each `{id, at, input, cc, cr, out, cc1h?, blocks?}`),
 * a tool-result user row at `end`, plus any `extra` rows (written after the messages, before the end row).
 */
function spawnRows(spec, session = SESSION) {
  const agentId = spec.agent || null;
  const rows = [userRow({ at: spec.start, text: spec.prompt || 'go', uuid: `${spec.agent || 'main'}-start`, session, agentId })];
  for (const m of spec.messages) rows.push(...assistantRows({ ...m, model: m.model || spec.model, session, agentId }));
  for (const extra of spec.extra || []) rows.push(extra);
  rows.push(userRow({ at: spec.end, text: 'tool result', uuid: `${spec.agent || 'main'}-end`, session, agentId }));
  return rows;
}

const toLines = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/**
 * writeSpawns(transcriptsDir, spawns, {session, key}) -> written file paths.
 * Layout `<transcriptsDir>/<key>/<session>.jsonl` and `<key>/<session>/subagents/agent-<id>.jsonl` (+ .meta.json).
 * Pass key '' for a flat layout. A spawn with `agent: null` is the main session. `meta` is an object (written as
 * JSON), null (no meta file) or the string 'corrupt' (an unparseable file). `body: 'corrupt'` writes no JSON rows.
 */
function writeSpawns(transcriptsDir, spawns, { session = SESSION, key = PROJECT_KEY } = {}) {
  const base = key ? path.join(transcriptsDir, key) : transcriptsDir;
  const written = [];
  for (const spec of spawns) {
    let file;
    if (!spec.agent) {
      file = path.join(base, `${session}.jsonl`);
    } else {
      const dir = path.join(base, session, 'subagents');
      fs.mkdirSync(dir, { recursive: true });
      file = path.join(dir, `agent-${spec.agent}.jsonl`);
      const metaFile = path.join(dir, `agent-${spec.agent}.meta.json`);
      if (spec.meta === 'corrupt') fs.writeFileSync(metaFile, '{not json');
      else if (spec.meta) fs.writeFileSync(metaFile, JSON.stringify(spec.meta));
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, spec.body === 'corrupt' ? 'not a transcript\n' : toLines(spawnRows(spec, session)));
    written.push(file);
  }
  return written;
}

// ─── The standard run (test list 6-7): main session, planner, executor x2, verifier ────────────────────────────

const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';

const STANDARD_RUN = [
  {
    agent: null,
    model: OPUS,
    start: '2026-10-17T10:00:00.000Z',
    end: '2026-10-17T10:10:00.000Z',
    messages: [
      { id: 'm1', at: '2026-10-17T10:00:05.000Z', input: 3, cc: 20000, cr: 16000, out: 400, blocks: 2 },
      { id: 'm2', at: '2026-10-17T10:04:00.000Z', input: 2, cc: 1000, cr: 36000, out: 300 },
      { id: 'm3', at: '2026-10-17T10:09:40.000Z', input: 1, cc: 500, cr: 37000, out: 200, cc1h: 500 },
    ],
    // A synthetic row never counts.
    extra: assistantRows({ id: 'syn', model: '<synthetic>', at: '2026-10-17T10:09:50.000Z', input: 100000, cc: 0, cr: 0, out: 100000 }),
  },
  {
    agent: 'p1',
    meta: { agentType: 'aoforge:planner', description: 'Plan objective 1' },
    model: OPUS,
    start: '2026-10-17T10:00:10.000Z',
    end: '2026-10-17T10:02:10.000Z',
    messages: [
      { id: 'p1a', at: '2026-10-17T10:00:20.000Z', input: 5, cc: 30000, cr: 0, out: 2000, blocks: 3 },
      { id: 'p1b', at: '2026-10-17T10:02:00.000Z', input: 4, cc: 2000, cr: 30000, out: 1500 },
    ],
  },
  {
    agent: 'e1',
    meta: { agentType: 'aoforge:executor', description: 'Execute 01-01' },
    model: SONNET,
    start: '2026-10-17T10:02:30.000Z',
    end: '2026-10-17T10:05:30.000Z',
    messages: [
      { id: 'e1a', at: '2026-10-17T10:02:40.000Z', input: 10, cc: 25000, cr: 0, out: 1000 },
      { id: 'e1b', at: '2026-10-17T10:05:20.000Z', input: 6, cc: 3000, cr: 25000, out: 2500, blocks: 2 },
    ],
  },
  {
    agent: 'e2',
    meta: { agentType: 'aoforge:executor', description: 'Execute 01-02' },
    model: SONNET,
    start: '2026-10-17T10:05:40.000Z',
    end: '2026-10-17T10:07:40.000Z',
    messages: [
      { id: 'e2a', at: '2026-10-17T10:05:50.000Z', input: 8, cc: 26000, cr: 0, out: 800 },
      { id: 'e2b', at: '2026-10-17T10:07:30.000Z', input: 4, cc: 1000, cr: 26000, out: 1200 },
    ],
  },
  {
    agent: 'v1',
    meta: { agentType: 'aoforge:verifier', description: 'Verify objective 1' },
    model: SONNET,
    start: '2026-10-17T10:07:50.000Z',
    end: '2026-10-17T10:09:20.000Z',
    messages: [
      { id: 'v1a', at: '2026-10-17T10:08:00.000Z', input: 7, cc: 18000, cr: 0, out: 600 },
      { id: 'v1b', at: '2026-10-17T10:09:10.000Z', input: 3, cc: 500, cr: 18000, out: 900 },
    ],
  },
];

// Hand-computed at RATES. first_turn_input = input + cache_creation + cache_read of the first message; cost per
// message = (input x in + 5m write x w5 + 1h write x w1h + read x r + output x out) / 1e6.
//   orchestrator m1 15 + 125000 + 8000 + 10000 = 143015; m2 10 + 6250 + 18000 + 7500 = 31760;
//                m3 (500 at 1h) 5 + 5000 + 18500 + 5000 = 28505; total 203280 -> 0.20328
//   planner      p1a 25 + 187500 + 0 + 50000 = 237525; p1b 20 + 12500 + 15000 + 37500 = 65020 -> 0.302545
//   executor e1  e1a 20 + 62500 + 0 + 10000 = 72520; e1b 12 + 7500 + 2500 + 25000 = 35012 -> 0.107532
//   executor e2  e2a 16 + 65000 + 0 + 8000 = 73016; e2b 8 + 2500 + 2600 + 12000 = 17108 -> 0.090124
//   verifier v1  v1a 14 + 45000 + 0 + 6000 = 51014; v1b 6 + 1250 + 1800 + 9000 = 12056 -> 0.06307
const EXPECTED_STANDARD = [
  { role: 'orchestrator', agent_type: null, agent_id: null, model: OPUS, first_turn_input: 36003, messages: 3,
    input: 6, cache_creation: 21500, cache_read: 89000, output: 900, total_tokens: 111406, cache_writes: 21500,
    cost_usd: 0.20328, wall_s: 600 },
  { role: 'planner', agent_type: 'aoforge:planner', agent_id: 'p1', model: OPUS, first_turn_input: 30005, messages: 2,
    input: 9, cache_creation: 32000, cache_read: 30000, output: 3500, total_tokens: 65509, cache_writes: 32000,
    cost_usd: 0.302545, wall_s: 120 },
  { role: 'executor', agent_type: 'aoforge:executor', agent_id: 'e1', model: SONNET, first_turn_input: 25010, messages: 2,
    input: 16, cache_creation: 28000, cache_read: 25000, output: 3500, total_tokens: 56516, cache_writes: 28000,
    cost_usd: 0.107532, wall_s: 180 },
  { role: 'executor', agent_type: 'aoforge:executor', agent_id: 'e2', model: SONNET, first_turn_input: 26008, messages: 2,
    input: 12, cache_creation: 27000, cache_read: 26000, output: 2000, total_tokens: 55012, cache_writes: 27000,
    cost_usd: 0.090124, wall_s: 120 },
  { role: 'verifier', agent_type: 'aoforge:verifier', agent_id: 'v1', model: SONNET, first_turn_input: 18007, messages: 2,
    input: 10, cache_creation: 18500, cache_read: 18000, output: 1500, total_tokens: 38010, cache_writes: 18500,
    cost_usd: 0.06307, wall_s: 90 },
];
const EXPECTED_STANDARD_COST = 0.766551;

// ─── Scorer runs (test list 9-10): one-message spawns, two quick runs per version ──────────────────────────────
// Each spawn has one message with no fresh input and no cache read, so first-turn input = cache_creation, total
// tokens = cache_creation + output and cost = cc x w5 + out x out at RATES. q31-r2 has two executor spawns.

function oneMessageSpawn(agent, agentType, model, cc, out, start, end) {
  return {
    agent,
    meta: agent ? { agentType, description: agentType } : undefined,
    model,
    start,
    end,
    messages: [{ id: `${agent || 'main'}-${start}`, at: start, input: 0, cc, cr: 0, out }],
  };
}

const T = (hms) => `2026-10-17T${hms}.000Z`;

const SCORE_RUNS = {
  // 3.1.0
  'q31-r1': [
    oneMessageSpawn(null, null, OPUS, 30000, 1000, T('11:00:00'), T('11:05:00')),
    oneMessageSpawn('a1', 'aoforge:planner', OPUS, 20000, 500, T('11:00:10'), T('11:01:10')),
    oneMessageSpawn('a2', 'aoforge:executor', SONNET, 15000, 2000, T('11:01:20'), T('11:03:20')),
  ],
  'q31-r2': [
    oneMessageSpawn(null, null, OPUS, 32000, 1000, T('12:00:00'), T('12:06:00')),
    oneMessageSpawn('b1', 'aoforge:planner', OPUS, 22000, 500, T('12:00:10'), T('12:01:30')),
    oneMessageSpawn('b2', 'aoforge:executor', SONNET, 16000, 2000, T('12:01:40'), T('12:03:20')),
    oneMessageSpawn('b3', 'aoforge:executor', SONNET, 11000, 1000, T('12:03:30'), T('12:04:30')),
  ],
  // 3.0.0
  'q30-r1': [
    oneMessageSpawn(null, null, OPUS, 40000, 1000, T('13:00:00'), T('13:06:40')),
    oneMessageSpawn('c1', 'aoforge:planner', OPUS, 26000, 500, T('13:00:10'), T('13:01:40')),
    oneMessageSpawn('c2', 'aoforge:executor', SONNET, 20000, 2000, T('13:01:50'), T('13:04:20')),
  ],
  'q30-r2': [
    oneMessageSpawn(null, null, OPUS, 42000, 1000, T('14:00:00'), T('14:07:00')),
    oneMessageSpawn('d1', 'aoforge:planner', OPUS, 28000, 500, T('14:00:10'), T('14:01:20')),
    oneMessageSpawn('d2', 'aoforge:executor', SONNET, 21000, 2000, T('14:01:30'), T('14:03:40')),
  ],
};

/** A test static-prompt.json (81-07 shape, the fields the E scorer reads). */
const STATIC_PROMPT = {
  from: { ref: 'v3.0.0', sha: 'f'.repeat(40) },
  to: { ref: 'HEAD', sha: 'e'.repeat(40) },
  chars_per_token: 4,
  agents: [
    { name: 'planner', resident_bytes: { from: 60000, to: 54000, delta_bytes: -6000, delta_pct: -10 },
      resident_tokens: { from: 15000, to: 13500, delta_tokens: -1500, delta_pct: -10 } },
    { name: 'executor', resident_bytes: { from: 64000, to: 52000, delta_bytes: -12000, delta_pct: -18.75 },
      resident_tokens: { from: 16000, to: 13000, delta_tokens: -3000, delta_pct: -18.75 } },
    { name: 'verifier', resident_bytes: { from: 48000, to: 31000, delta_bytes: -17000, delta_pct: -35.42 },
      resident_tokens: { from: 12000, to: 7750, delta_tokens: -4250, delta_pct: -35.42 } },
  ],
};

/**
 * writeRunDir(root, id, {spawns, record, layoutKey}) -> the run dir `<root>/runs/E/<id>`, holding record.json and
 * (when spawns is an array) transcripts/ written with writeSpawns. `record` is written as given.
 */
function writeRunDir(root, id, { spawns, record, layoutKey = PROJECT_KEY } = {}) {
  const runDir = path.join(root, 'runs', 'E', id);
  fs.mkdirSync(runDir, { recursive: true });
  if (record !== undefined) fs.writeFileSync(path.join(runDir, 'record.json'), JSON.stringify(record, null, 2));
  if (Array.isArray(spawns)) writeSpawns(path.join(runDir, 'transcripts'), spawns, { key: layoutKey });
  return runDir;
}

module.exports = {
  SESSION,
  PROJECT_KEY,
  RATES,
  OPUS,
  SONNET,
  usage,
  assistantRows,
  userRow,
  spawnRows,
  toLines,
  writeSpawns,
  STANDARD_RUN,
  EXPECTED_STANDARD,
  EXPECTED_STANDARD_COST,
  SCORE_RUNS,
  STATIC_PROMPT,
  writeRunDir,
};
