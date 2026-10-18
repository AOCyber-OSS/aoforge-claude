'use strict';
// Hand-built Claude Code transcripts for scripts/eval82/lib/attribution.cjs (TRD 82-01).
//
// Row shapes follow real transcripts (see objective 81's recorded runs): one API call is written once per content
// block, every row repeating the same `message.id` and `message.usage`; a tool result is a `user` row whose content
// holds a `tool_result` block joined to its `tool_use` by `tool_use_id`; a subagent sits at
// `<session>/subagents/agent-<id>.jsonl` beside `agent-<id>.meta.json` with its `agentType`; a large result may be
// persisted to `<session>/tool-results/<name>.txt` and the result text then points at it.
//
// No generated data: every number is written out or computed from the arguments. The usage helper and the session and
// project key come from objective 81's fixtures (imported, never edited).

const fs = require('fs');
const path = require('path');
const tx = require('../../eval81/__fixtures__/transcripts.cjs');

const { SESSION, PROJECT_KEY, usage: usageBlock } = tx;
const OPUS = 'claude-opus-5-5';
const BASE_TIME = Date.parse('2026-10-17T10:00:00.000Z');

const stamp = (n) => new Date(BASE_TIME + n * 1000).toISOString();
const toLines = (rows) => rows.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n';

/** `{input, cc, cr, out}` (the 81 shorthand) -> the CLI's usage block; a full usage block passes through. */
function asUsage(u) {
  if (u && u.input_tokens !== undefined) return u;
  return usageBlock(u);
}

/**
 * assistantCall({id, usage, tools: [{id, name, input}], text?, splitInto = 1, model, at}) -> rows.
 * One API call spread over `splitInto` rows that share the message id. `usage` is one shorthand object (every row
 * repeats it) or an array of `splitInto` objects (rows that stream a growing output_tokens). The content blocks
 * (optional text, then one tool_use per tool) go to the rows round robin; a row with no block gets an empty text.
 */
function assistantCall({ id, usage, tools = [], text = null, splitInto = 1, model = OPUS, at = stamp(0), session = SESSION, agentId = null }) {
  const blocks = [];
  if (text !== null) blocks.push({ type: 'text', text });
  for (const t of tools) blocks.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input });
  while (blocks.length < splitInto) blocks.push({ type: 'text', text: '' });
  const usages = Array.isArray(usage) ? usage.map(asUsage) : Array.from({ length: splitInto }, () => asUsage(usage));
  const rows = [];
  for (let n = 0; n < splitInto; n += 1) {
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
        content: blocks.filter((_, i) => i % splitInto === n),
        stop_reason: null,
        usage: usages[n],
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

/** The text Claude Code puts in a tool result when it persisted the output to a file (head only, as recorded). */
function persistedOutputText(persistedPath, preview = 'preview of the output') {
  return `<persisted-output>\nOutput too large (39.7KB). Full output saved to: ${persistedPath}\n\nPreview (first 2KB):\n${preview}\n</persisted-output>`;
}

/**
 * toolResult({toolUseId, content, isError, persistedPath, at}) -> one user row. `content` is a string or an array of
 * `{type:'text', text}` blocks; with `persistedPath` the content becomes the persisted-output pointer text.
 */
function toolResult({ toolUseId, content = '', isError = false, persistedPath = null, at = stamp(1), uuid, session = SESSION, agentId = null }) {
  const body = persistedPath ? persistedOutputText(persistedPath, typeof content === 'string' ? content.slice(0, 40) : '') : content;
  const block = { type: 'tool_result', tool_use_id: toolUseId, content: body };
  if (isError) block.is_error = true;
  const row = {
    type: 'user',
    timestamp: at,
    sessionId: session,
    uuid: uuid || `${toolUseId}-result`,
    message: { role: 'user', content: [block] },
  };
  if (agentId) {
    row.isSidechain = true;
    row.agentId = agentId;
  }
  return row;
}

/** The spawn prompt row that opens a subagent. */
const promptRow = ({ text = 'go', agentId = null, session = SESSION, at = stamp(0) } = {}) => tx.userRow({ at, text, uuid: `${agentId || 'main'}-prompt`, session, agentId });

/**
 * writeRun(dir, {main, subagents, toolResults, key, session}) -> {transcripts, mainFile, subagentFiles, toolResultsDir}.
 *   main       rows (objects, or strings written as they are) of the main session
 *   subagents  [{agentId, agentType | null, rows}]  (a null agentType writes no meta file)
 *   toolResults {name: text} files laid under `<session>/tool-results/`
 */
function writeRun(dir, { main = [], subagents = [], toolResults = {}, key = PROJECT_KEY, session = SESSION } = {}) {
  const transcripts = path.join(dir, 'transcripts');
  const base = path.join(transcripts, key);
  fs.mkdirSync(base, { recursive: true });
  const mainFile = path.join(base, `${session}.jsonl`);
  fs.writeFileSync(mainFile, toLines(main));
  const subagentFiles = {};
  const subDir = path.join(base, session, 'subagents');
  for (const sub of subagents) {
    fs.mkdirSync(subDir, { recursive: true });
    const file = path.join(subDir, `agent-${sub.agentId}.jsonl`);
    fs.writeFileSync(file, toLines(sub.rows));
    if (sub.agentType) fs.writeFileSync(path.join(subDir, `agent-${sub.agentId}.meta.json`), JSON.stringify({ agentType: sub.agentType, description: `spawn ${sub.agentId}` }));
    subagentFiles[sub.agentId] = file;
  }
  const toolResultsDir = path.join(base, session, 'tool-results');
  for (const [name, text] of Object.entries(toolResults)) {
    fs.mkdirSync(toolResultsDir, { recursive: true });
    fs.writeFileSync(path.join(toolResultsDir, name), text);
  }
  return { transcripts, mainFile, subagentFiles, toolResultsDir };
}

/** A whole subagent conversation: prompt, then each turn's call rows followed by its tool result rows. */
function conversation(agentId, turns) {
  const rows = [promptRow({ agentId })];
  turns.forEach((turn, i) => {
    rows.push(...assistantCall({ ...turn.call, agentId, at: stamp(2 * i + 1) }));
    (turn.results || []).forEach((r, j) => rows.push(toolResult({ ...r, agentId, at: stamp(2 * i + 2), uuid: `${agentId}-t${i}-r${j}` })));
  });
  return rows;
}

// ─── planner3031Pair: the hand-built "3.0.0" and "3.1.0" planner spawns (test list 7-8) ───────────────────────────
//
// 3.0.0 (agent `old-planner`, 4 calls; context = input + cache_creation + cache_read):
//   call 1  3 + 20000 +     0 = 20003, out 400   Bash  aof-tools init plan-objective      -> context_load       result 4000 chars
//   call 2  2 +  1500 + 20000 = 21502, out 600   Write <tmp>/aoforge-drafts/…/01-01-TRD.md -> draft_write       result 40 chars
//   call 3  2 +   800 + 21500 = 22302, out 300   Bash  aof-tools plan put-trd             -> validate_publish   result 400 chars
//   call 4  1 +   300 + 22300 = 22601, out 200   (final text, no tool)
//   contexts 86408, outputs 1500, total 87908; meanContext 86408 / 4 = 21602
// 3.1.0 (agent `new-planner`, 6 calls):
//   call 1  3 + 20000 +     0 = 20003, out 500   Bash  aof-tools init plan-objective      -> context_load       result 4000 chars
//   call 2  2 +  2000 + 20000 = 22002, out 400   Bash  ls ~/.claude/aoforge/templates/    -> runtime_lookup     result 200 chars
//   call 3  2 +  1000 + 22000 = 23002, out 700   Bash  sed -n 1,80p …/templates/trd-prompt.md -> runtime_read:templates/trd-prompt.md  result 12000 chars (split over 2 rows)
//   call 4  2 +  3200 + 23000 = 26202, out 900   Write …/aoforge-drafts/… (40 chars) AND Bash aof-tools frontmatter validate … (200 chars), one call, two tools
//   call 5  1 +   600 + 26200 = 26801, out 350   Bash  git commit --amend -m …            -> raw_commit         result 80 chars
//   call 6  1 +   200 + 26800 = 27001, out 250   (final text, no tool)
//   contexts 145011, outputs 3100, total 148111; meanContext 145011 / 6 = 24168.5
// Δtotal 60203 = Δcalls x meanContext(old) 2 x 21602 = 43204 + calls(new) x ΔmeanContext 6 x 2566.5 = 15399 + Δoutput 1600.
//
// Issuing tokens (context + output of the issuing call; a call issuing k tools gives each 1/k):
//   old: context_load 20403, draft_write 22102, validate_publish 22602, (final) 22801                       sum 87908
//   new: context_load 20503, runtime_lookup 22402, runtime_read:templates/trd-prompt.md 23702,
//        draft_write 13551, validate_publish 13551, raw_commit 27151, (final) 27251                        sum 148111
// Carry (result chars / 4 rounded, times the calls after the issuing one):
//   old (4 calls): context_load 1000 x 3 = 3000, draft_write 10 x 2 = 20, validate_publish 100 x 1 = 100
//   new (6 calls): context_load 1000 x 5 = 5000, runtime_lookup 50 x 4 = 200, runtime_read:templates/trd-prompt.md 3000 x 3 = 9000,
//                  draft_write 10 x 2 = 20, validate_publish 50 x 2 = 100, raw_commit 20 x 1 = 20
const DRAFT = '/sandbox/tmp/aoforge-drafts/objectives/01-tags/01-01-TRD.md';
const AOF = 'node ~/.claude/aoforge/bin/aof-tools.cjs';

function plannerOldTurns() {
  return [
    { call: { id: 'old1', usage: { input: 3, cc: 20000, cr: 0, out: 400 }, tools: [{ id: 'old1-t', name: 'Bash', input: { command: `${AOF} init plan-objective 1` } }] }, results: [{ toolUseId: 'old1-t', content: 'x'.repeat(4000) }] },
    { call: { id: 'old2', usage: { input: 2, cc: 1500, cr: 20000, out: 600 }, tools: [{ id: 'old2-t', name: 'Write', input: { file_path: DRAFT, content: '# TRD' } }] }, results: [{ toolUseId: 'old2-t', content: 'x'.repeat(40) }] },
    { call: { id: 'old3', usage: { input: 2, cc: 800, cr: 21500, out: 300 }, tools: [{ id: 'old3-t', name: 'Bash', input: { command: `${AOF} plan put-trd 1 --from ${DRAFT}` } }] }, results: [{ toolUseId: 'old3-t', content: 'x'.repeat(400) }] },
    { call: { id: 'old4', usage: { input: 1, cc: 300, cr: 22300, out: 200 }, text: 'done' }, results: [] },
  ];
}

function plannerNewTurns() {
  return [
    { call: { id: 'new1', usage: { input: 3, cc: 20000, cr: 0, out: 500 }, tools: [{ id: 'new1-t', name: 'Bash', input: { command: `${AOF} init plan-objective 1` } }] }, results: [{ toolUseId: 'new1-t', content: 'x'.repeat(4000) }] },
    { call: { id: 'new2', usage: { input: 2, cc: 2000, cr: 20000, out: 400 }, tools: [{ id: 'new2-t', name: 'Bash', input: { command: 'ls ~/.claude/aoforge/templates/' } }] }, results: [{ toolUseId: 'new2-t', content: 'x'.repeat(200) }] },
    { call: { id: 'new3', usage: { input: 2, cc: 1000, cr: 22000, out: 700 }, splitInto: 2, tools: [{ id: 'new3-t', name: 'Bash', input: { command: "sed -n '1,80p' ~/.claude/aoforge/templates/trd-prompt.md" } }] }, results: [{ toolUseId: 'new3-t', content: 'x'.repeat(12000) }] },
    {
      call: {
        id: 'new4',
        usage: { input: 2, cc: 3200, cr: 23000, out: 900 },
        tools: [
          { id: 'new4-a', name: 'Write', input: { file_path: DRAFT, content: '# TRD' } },
          { id: 'new4-b', name: 'Bash', input: { command: `${AOF} frontmatter validate ${DRAFT}` } },
        ],
      },
      results: [{ toolUseId: 'new4-a', content: 'x'.repeat(40) }, { toolUseId: 'new4-b', content: 'x'.repeat(200) }],
    },
    { call: { id: 'new5', usage: { input: 1, cc: 600, cr: 26200, out: 350 }, tools: [{ id: 'new5-t', name: 'Bash', input: { command: 'git commit --amend -m "Co-Authored-By: x"' } }] }, results: [{ toolUseId: 'new5-t', content: 'x'.repeat(80) }] },
    { call: { id: 'new6', usage: { input: 1, cc: 200, cr: 26800, out: 250 }, text: 'done' }, results: [] },
  ];
}

const PLANNER_PAIR_EXPECTED = {
  old: {
    calls: 4,
    context_tokens: 86408,
    output_tokens: 1500,
    total_tokens: 87908,
    mean_context: 21602,
    categories: {
      context_load: { count: 1, issuing: 20403, carry: 3000 },
      draft_write: { count: 1, issuing: 22102, carry: 20 },
      validate_publish: { count: 1, issuing: 22602, carry: 100 },
      '(final)': { count: 1, issuing: 22801, carry: 0 },
    },
  },
  new: {
    calls: 6,
    context_tokens: 145011,
    output_tokens: 3100,
    total_tokens: 148111,
    mean_context: 24168.5,
    categories: {
      context_load: { count: 1, issuing: 20503, carry: 5000 },
      runtime_lookup: { count: 1, issuing: 22402, carry: 200 },
      'runtime_read:templates/trd-prompt.md': { count: 1, issuing: 23702, carry: 9000 },
      draft_write: { count: 1, issuing: 13551, carry: 20 },
      validate_publish: { count: 1, issuing: 13551, carry: 100 },
      raw_commit: { count: 1, issuing: 27151, carry: 20 },
      '(final)': { count: 1, issuing: 27251, carry: 0 },
    },
  },
  decomposition: { dtotal: 60203, calls_term: 43204, context_term: 15399, output_term: 1600 },
};

/**
 * planner3031Pair() -> {old: {agentId, agentType, rows}, new: {...}, expected}. Pass each `.rows` to writeRun's
 * subagents list; `expected` is the hand-computed table above.
 */
function planner3031Pair() {
  return {
    old: { agentId: 'old-planner', agentType: 'aoforge:planner', rows: conversation('old-planner', plannerOldTurns()) },
    new: { agentId: 'new-planner', agentType: 'aoforge:planner', rows: conversation('new-planner', plannerNewTurns()) },
    expected: PLANNER_PAIR_EXPECTED,
  };
}

/** A run dir holding a main session and the one planner of planner3031Pair (`which` is 'old' or 'new'). */
function writePlannerRun(dir, which) {
  const spawn = planner3031Pair()[which];
  return writeRun(dir, { main: [promptRow()], subagents: [spawn] });
}

module.exports = {
  SESSION,
  PROJECT_KEY,
  OPUS,
  DRAFT,
  AOF,
  assistantCall,
  toolResult,
  persistedOutputText,
  promptRow,
  conversation,
  writeRun,
  toLines,
  planner3031Pair,
  writePlannerRun,
  PLANNER_PAIR_EXPECTED,
};
