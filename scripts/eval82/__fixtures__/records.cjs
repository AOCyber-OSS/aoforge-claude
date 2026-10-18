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
function toolUseRow(blocks, { agentId = null, msgId = 'msg_hand_1' } = {}) {
  const row = {
    type: 'assistant',
    timestamp: '2026-10-18T10:00:00.000Z',
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

module.exports = { runRecord, writeRunDir, toolUseRow, apiBlobRow, toolResultRow, ledgerEntry, SESSION, PROJECT_KEY };
