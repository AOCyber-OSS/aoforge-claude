'use strict';
// Hand-built run records, ledger entries and transcript rows for the objective-82 harness tests (TRD 82-05).
// Every value is written out by hand; nothing is generated. Transcripts reuse objective 81's builders
// (scripts/eval81/__fixtures__/transcripts.cjs) for the role-metric layout, and add tool_use rows for the
// guessed-path scan. The recorded real-shape extracts live beside this file in runs-81/ (copied, never built here).

const fs = require('fs');
const path = require('path');
const { writeSpawns, PROJECT_KEY, SESSION } = require('../../eval81/__fixtures__/transcripts.cjs');

/**
 * A RunRecord with the fields the objective-82 scorers and the ledger read. Fields left undefined are omitted, so a
 * record without `access` is the pre-access shape (81's E runs b30/b31).
 */
function runRecord({
  id, batch, model = 'sonnet', status = 'ok', role = null, charged = 0, cost = null, cap = null,
  structured, access, permission_denials = [], outputs, finished_at = '2026-10-18T10:00:00.000Z', claude_version,
} = {}) {
  const r = {
    id,
    batch,
    role,
    model,
    status,
    cost_usd: cost,
    charged_usd: charged,
    cost_source: 'reported',
    cap_usd: cap,
    permission_denials,
    finished_at,
  };
  if (structured !== undefined) r.structured_output = structured;
  if (access !== undefined) r.access = access;
  if (outputs !== undefined) r.outputs = outputs;
  if (claude_version !== undefined) r.claude_version = claude_version;
  return r;
}

/**
 * writeRunDir(root, batch, id, {record, spawns, lines, key}) -> `<root>/runs/<batch>/<id>`.
 *   record  written as record.json when given
 *   spawns  objective 81's spawn specs (writeSpawns: `<key>/<session>.jsonl` + subagents/)
 *   lines   {<path relative to transcripts/>: row[]} written verbatim as JSONL (hand-built tool_use rows)
 */
function writeRunDir(root, batch, id, { record, spawns, lines, key = PROJECT_KEY } = {}) {
  const runDir = path.join(root, 'runs', batch, id);
  fs.mkdirSync(runDir, { recursive: true });
  if (record !== undefined) fs.writeFileSync(path.join(runDir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);
  const tdir = path.join(runDir, 'transcripts');
  if (Array.isArray(spawns)) writeSpawns(tdir, spawns, { key });
  if (lines) {
    for (const [rel, rows] of Object.entries(lines)) {
      const file = path.join(tdir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, rows.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n');
    }
  }
  return runDir;
}

/** One assistant transcript row carrying the given tool_use blocks ([{id, name, input}]). */
function toolUseRow(blocks, { agentId = null, msgId = 'msg_hand_1', at = '2026-10-18T10:00:00.000Z' } = {}) {
  const row = {
    type: 'assistant',
    timestamp: at,
    sessionId: SESSION,
    uuid: `${msgId}-row`,
    message: {
      id: msgId,
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      content: blocks.map((b) => ({ type: 'tool_use', id: b.id, name: b.name, input: b.input })),
    },
  };
  if (agentId) {
    row.isSidechain = true;
    row.agentId = agentId;
  }
  return row;
}

/** The api-request-blob row the CLI writes, repeating earlier tool_use blocks (a scan must not count them twice). */
function apiBlobRow(blocks) {
  return {
    type: 'api-request-blob',
    sessionId: SESSION,
    hash: 'hand-built-blob',
    message: { role: 'assistant', content: blocks.map((b) => ({ type: 'tool_use', id: b.id, name: b.name, input: b.input })) },
  };
}

/** The user row answering a tool_use. */
function toolResultRow(id, content) {
  return {
    type: 'user',
    timestamp: '2026-10-18T10:00:01.000Z',
    sessionId: SESSION,
    uuid: `${id}-result`,
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] },
  };
}

/** A LedgerEntry (the frozen ledger's shape) for hand-built spend. */
function ledgerEntry({ id, batch, role = null, status = 'ok', cap = null, charged, overshoot = 0, reported = null }) {
  return {
    id,
    batch,
    role,
    status,
    cap_usd: cap,
    reserve_usd: cap === null ? null : Math.round(cap * 1.25 * 1e6) / 1e6,
    reported_usd: reported === null ? charged : reported,
    transcript_usd: null,
    charged_usd: charged,
    cost_source: 'reported',
    overshoot_usd: overshoot,
    at: '2026-10-18T10:00:00.000Z',
  };
}

// ─── Batch E (test list 12-14): two new build runs and a minimal objective-81 E.json ───────────────────────────
// Each spawn has one message with no fresh input and no cache read, so at objective 81's hand-built RATES
// (scripts/eval81/__fixtures__/transcripts.cjs: opus 5m write 6.25, output 25; sonnet 2.5 and 10 per million):
// first-turn input = cache writes = cc, total tokens = cc + out, cost = (cc x write + out x output) / 1e6, and wall
// seconds = end - start.

const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const T = (hms) => `2026-10-18T${hms}.000Z`;

function buildSpawn(agent, agentType, model, cc, out, start, end, extra) {
  const spec = {
    agent,
    model,
    start: T(start),
    end: T(end),
    messages: [{ id: `${agent || 'main'}-${start}`, at: T(start), input: 0, cc, cr: 0, out }],
  };
  if (agent) spec.meta = { agentType, description: agentType };
  if (extra) spec.extra = extra;
  return spec;
}

//   b82-r1  orchestrator 40000/1000 1200 s $0.275 | planner 50000/2000 240 s $0.3625 | job-checker 20000/500 60 s $0.055
//           executor 30000/3000 300 s $0.105 and 26000/2000 240 s $0.085 | verifier 18000/600 120 s $0.051
//           total tokens 193100, priced $0.9335
//   b82-r2  orchestrator 44000/1000 900 s $0.3 | planner 54000/2000 180 s $0.3875 | job-checker 22000/500 40 s $0.06
//           executor 34000/3000 300 s $0.115 | verifier 20000/600 120 s $0.056; total tokens 181100, priced $0.9185
const E82_SPAWNS = {
  'b82-r1': [
    buildSpawn(null, null, OPUS, 40000, 1000, '10:00:00', '10:20:00'),
    buildSpawn('p1', 'aoforge:planner', OPUS, 50000, 2000, '10:00:10', '10:04:10'),
    buildSpawn('j1', 'aoforge:job-checker', SONNET, 20000, 500, '10:04:20', '10:05:20'),
    buildSpawn('x1', 'aoforge:executor', SONNET, 30000, 3000, '10:05:30', '10:10:30'),
    buildSpawn('x2', 'aoforge:executor', SONNET, 26000, 2000, '10:10:40', '10:14:40'),
    buildSpawn('v1', 'aoforge:verifier', SONNET, 18000, 600, '10:15:00', '10:17:00'),
  ],
  'b82-r2': [
    buildSpawn(null, null, OPUS, 44000, 1000, '11:00:00', '11:15:00'),
    buildSpawn('q1', 'aoforge:planner', OPUS, 54000, 2000, '11:00:10', '11:03:10'),
    buildSpawn('k1', 'aoforge:job-checker', SONNET, 22000, 500, '11:03:20', '11:04:00'),
    buildSpawn('y1', 'aoforge:executor', SONNET, 34000, 3000, '11:04:10', '11:09:10'),
    buildSpawn('w1', 'aoforge:verifier', SONNET, 20000, 600, '11:09:20', '11:11:20'),
  ],
};

/** A collect output (81's E collect shape). */
function buildOutputs({ pass = true, testsPass = 27, verification = 'passed', trds = 2, summaries = 2 } = {}) {
  return {
    acceptance: { pass, checks: [] },
    tests: { ok: pass, exit: pass ? 0 : 1, tests: testsPass, pass: testsPass, fail: 0, timed_out: false },
    verification_status: verification,
    trd_count: trds,
    summaries,
    git_log_subjects: ['chore: scaffold notekit with add and list', 'test: cover the store and the add and list commands', 'docs: plan the tags milestone', 'chore(aoforge): upgrade project to v3.1.0'],
  };
}

const m = (n, median, mean) => ({ n, median, mean, min: median, max: median });

/** A per-role build cell of objective 81's E.json (the fields the 82 scorer reads). */
function roleCell({ spawns = 2, runs = 2, fti, total, cw, cost, wall }) {
  return {
    spawns,
    runs,
    unreadable: 0,
    first_turn_input: m(spawns, fti, fti),
    total_tokens: m(spawns, total, total),
    cache_writes: m(spawns, cw, cw),
    cost_usd: m(spawns, cost, cost),
    wall_s: m(spawns, wall, wall),
    models: [],
  };
}

/**
 * e81Json({runs, perRole, claudeVersion}) -> a minimal objective-81 results/E.json: `runs[]` rows and
 * `per_role[version].build[role]` cells. Default per-role build cells (hand-picked round numbers):
 *   3.0.0  orchestrator 38000/600000/48000/$0.6/900 s, planner 40000/1200000/60000/$0.25/150 s,
 *          job-checker 18000/300000/20000/$0.05/50 s, executor 28000/800000/40000/$0.1/250 s,
 *          verifier 17000/400000/20000/$0.05/100 s
 *   3.1.0  orchestrator 37000, planner 50000, job-checker 21000, executor 29000, verifier 18000 first-turn input;
 *          planner total 2000000, cost $0.4
 */
function e81Json({ runs, perRole, claudeVersion } = {}) {
  const defaults = {
    '3.0.0': {
      orchestrator: roleCell({ fti: 38000, total: 600000, cw: 48000, cost: 0.6, wall: 900 }),
      planner: roleCell({ fti: 40000, total: 1200000, cw: 60000, cost: 0.25, wall: 150 }),
      'job-checker': roleCell({ fti: 18000, total: 300000, cw: 20000, cost: 0.05, wall: 50 }),
      executor: roleCell({ spawns: 3, fti: 28000, total: 800000, cw: 40000, cost: 0.1, wall: 250 }),
      verifier: roleCell({ spawns: 4, fti: 17000, total: 400000, cw: 20000, cost: 0.05, wall: 100 }),
    },
    '3.1.0': {
      orchestrator: roleCell({ fti: 37000, total: 600000, cw: 47000, cost: 0.62, wall: 940 }),
      planner: roleCell({ fti: 50000, total: 2000000, cw: 100000, cost: 0.4, wall: 300 }),
      'job-checker': roleCell({ fti: 21000, total: 350000, cw: 22000, cost: 0.06, wall: 60 }),
      executor: roleCell({ spawns: 3, fti: 29000, total: 900000, cw: 45000, cost: 0.12, wall: 280 }),
      verifier: roleCell({ spawns: 3, fti: 18000, total: 420000, cw: 21000, cost: 0.055, wall: 110 }),
    },
  };
  const pr = perRole || defaults;
  const out = {
    batch: 'E',
    session_model: 'opus',
    profile: 'balanced',
    runs: runs || [
      { id: 'b31-r1', version: '3.1.0', workflow: 'build', status: 'ok', cost_usd: 5.09, charged_usd: 5.09, first_turn_input: 37967, total_tokens: 10856720, wall_s: 1110, acceptance: true, tests_ok: true, verification_status: 'passed', trd_count: 2, summaries: 2 },
      { id: 'b30-r1', version: '3.0.0', workflow: 'build', status: 'ok', cost_usd: 4.9, charged_usd: 4.9, first_turn_input: 39418, total_tokens: 9483357, wall_s: 957, acceptance: true, tests_ok: true, verification_status: 'passed', trd_count: 2, summaries: 2 },
      { id: 'b30-r2', version: '3.0.0', workflow: 'build', status: 'ok', cost_usd: 3.6, charged_usd: 3.6, first_turn_input: 38957, total_tokens: 6695220, wall_s: 613, acceptance: true, tests_ok: true, verification_status: 'passed', trd_count: 1, summaries: 1 },
      { id: 'b31-r2', version: '3.1.0', workflow: 'build', status: 'ok', cost_usd: 4.35, charged_usd: 4.35, first_turn_input: 37590, total_tokens: 7683598, wall_s: 775, acceptance: true, tests_ok: true, verification_status: 'passed', trd_count: 1, summaries: 1 },
      { id: 'q31-r1', version: '3.1.0', workflow: 'quick', status: 'ok', cost_usd: 1.78, charged_usd: 1.78, first_turn_input: 33637, total_tokens: 2388584, wall_s: 345, acceptance: true, tests_ok: true, verification_status: null, trd_count: 1, summaries: 1 },
    ],
    per_role: Object.fromEntries(Object.entries(pr).map(([v, roles]) => [v, { quick: {}, build: roles }])),
  };
  if (claudeVersion !== undefined) out.claude_version = claudeVersion;
  return out;
}

// ─── Batch D (test list 7, 9-11, 14): single-state judge sessions written from a hand-written vote table ─────────
// A vote string has one letter per sample k = 1..3: `o` an ok result (is_broken false, no defects), `b` a broken one
// (one high-severity overflow defect), `-` no sample (no record), `e` a record that ended `error` with no output.

const D_USAGE = { input: 10, cache_creation: 2000, cache_read: 1000, output: 200 };
const D_CHARGED = { h: 0.01, s: 0.04, esc: 0.03 };

function dResult(state, letter) {
  const broken = letter === 'b';
  return {
    state_id: state,
    is_broken: broken,
    matches_expected: !broken,
    confidence: 0.9,
    defects: broken ? [{ type: 'overflow', severity: 'high', region: 'body', rationale: 'text runs past the edge' }] : [],
  };
}

/** dRecord(state, arm, k, letter) -> the RunRecord of `D-<state>-<arm>-<k>` (arm h | s | esc). */
function dRecord(state, arm, k, letter) {
  const id = `D-${state}-${arm}-${k}`;
  const model = arm === 'h' ? 'haiku' : 'sonnet';
  const r = runRecord({
    id, batch: 'D', model, role: 'ui-evaluator', status: letter === 'e' ? 'error' : 'ok',
    charged: D_CHARGED[arm], cost: D_CHARGED[arm], cap: arm === 'h' ? 0.05 : 0.15,
    structured: letter === 'e' ? null : { results: [dResult(state, letter)] },
  });
  r.usage = { ...D_USAGE };
  return r;
}

/** writeDVotes(root, {<state>: {h: 'oob', s: 'ooo', esc: 'oo-'}}) -> the run dirs written under <root>/runs/D/. */
function writeDVotes(root, table) {
  const dirs = [];
  for (const [state, arms] of Object.entries(table)) {
    for (const [arm, votes] of Object.entries(arms)) {
      if (!votes) continue;
      [...votes].forEach((letter, i) => {
        if (letter === '-') return;
        const rec = dRecord(state, arm, i + 1, letter);
        dirs.push(writeRunDir(root, 'D', rec.id, { record: rec }));
      });
    }
  }
  return dirs;
}

/**
 * The scorer's hand-built key and votes (test list 9-11). Hand-computed:
 *   haiku majority   s1 b  s2 o  s3 o(split)  s4 o(split)  s5 o  s6 b(split)  s7 incomplete (2 samples, one error)
 *   engine escalation from haiku: s3, s4 (review = split with an ok majority); s6 is a broken majority, not review
 *   haiku start      s3 -> esc ooo = o, s4 -> esc bbo = b; accuracy 4/6, broken_missed 1/3 (s5), false_fail 1/3 (s6)
 *   haiku raw        accuracy 3/6, broken_missed 2/3, false_fail 1/3, split 3/6, escalation 2/6, on ok-labelled 1/3
 *   sonnet           all 7 complete and right: accuracy 7/7, split 2/7 (s5 bbo, s6 oob), escalation 1/7 (s6),
 *                    on ok-labelled 1/4
 *   agreement        escalated s3, s4: haiku-start final equals the sonnet majority in both, 2/2
 *   cost             haiku start = 20 haiku records x 0.01 + 6 escalation records x 0.03 = 0.38
 *                    sonnet start = 21 x 0.04 = 0.84 + opus estimate for s6's three sonnet sessions at RATES opus
 *                    (10 x 5 + 2000 x 6.25 + 1000 x 0.5 + 200 x 25) / 1e6 = 0.01805 each, 0.05415 -> 0.89415
 */
const D_KEY = {
  states: [
    { id: 's1', label: 'broken', defect_type: 'overflow', severity: 'high' },
    { id: 's2', label: 'ok', defect_type: null, severity: null },
    { id: 's3', label: 'ok', defect_type: null, severity: null },
    { id: 's4', label: 'broken', defect_type: 'misalignment', severity: 'medium' },
    { id: 's5', label: 'broken', defect_type: 'overflow', severity: 'high' },
    { id: 's6', label: 'ok', defect_type: null, severity: null },
    { id: 's7', label: 'ok', defect_type: null, severity: null },
  ],
};
const D_VOTES = {
  s1: { h: 'bbb', s: 'bbb' },
  s2: { h: 'ooo', s: 'ooo' },
  s3: { h: 'oob', s: 'ooo', esc: 'ooo' },
  s4: { h: 'oob', s: 'bbb', esc: 'bbo' },
  s5: { h: 'ooo', s: 'bbo' },
  s6: { h: 'bbo', s: 'oob' },
  s7: { h: 'o-e', s: 'ooo' },
};

module.exports = {
  runRecord, writeRunDir, toolUseRow, apiBlobRow, toolResultRow, ledgerEntry, SESSION, PROJECT_KEY,
  OPUS, SONNET, T, buildSpawn, E82_SPAWNS, buildOutputs, roleCell, e81Json,
  D_USAGE, D_CHARGED, dResult, dRecord, writeDVotes, D_KEY, D_VOTES,
};
