'use strict';
/**
 * Per-call token attribution over Claude Code transcripts (TRD 82-01; reused by 82-09's mechanism checks).
 *
 * Objective 81 measured one number per spawn. This module opens the spawn: it turns one transcript into API calls,
 * the tool calls each call issued, a category per tool call, and per category a count, the tokens of the calls that
 * issued it, and the tokens it carried into later calls. Comparing two runs then says WHICH calls grew a role's total,
 * not just that it grew.
 *
 * Counting rules (the same as objective 81's roles.cjs, so the totals agree with 81-MEASUREMENT.md):
 *   - One API call is one `message.id`. A call's content blocks are spread over several rows that repeat the id and
 *     the usage, so rows are deduped by id; the row with the largest output_tokens carries the usage (the first on a
 *     tie); rows with no usage object, and the `<synthetic>` model, are not calls.
 *   - context = input_tokens + cache_creation_input_tokens + cache_read_input_tokens (the prompt the call ran on);
 *     a call's total = context + output_tokens; a spawn's total is the sum of its calls' totals. Cache reads are not
 *     free here, exactly as in the measurement.
 *
 * Attribution:
 *   - issuing tokens: the total of the call that issued a tool call; a call issuing k tools gives each 1/k; a call
 *     that issued none is `(final)`. The categories partition the spawn total, so the deltas between two runs sum to
 *     the delta of the totals (to rounding).
 *   - carry: the tool result's size in tokens (chars / 4, rounded) times the calls that came after the one that issued
 *     it (the result rides in every later call's context). Removing a tool call would save about issuing + carry.
 *     The size is what is in the context: a persisted-output pointer carries only its preview, so the persisted
 *     file's size is reported beside it (`persisted_chars`) and not used for carry.
 *   - decomposition of a difference: dtotal = dcalls x meanContext(a) + calls(b) x dMeanContext + doutput. An image
 *     block in a result counts 6000 chars (about 1500 tokens, the figure `aof-tools context` uses).
 *
 * Read only. Nothing here writes, spawns a process or reads process.env; `~` in a transcript is data.
 */

const fs = require('fs');
const path = require('path');
const { roleOf, ORCHESTRATOR, UNKNOWN } = require('../../eval81/lib/roles.cjs');

const SYNTHETIC_MODEL = '<synthetic>';
const DETAIL_MAX = 120;
const IMAGE_CHARS = 6000;
const FINAL = '(final)';
const NO_TOOL = '(none)';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const round3 = (x) => Math.round(x * 1000) / 1000;
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const tokensOf = (chars) => Math.round(chars / 4);
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const head = (s) => squash(s).slice(0, DETAIL_MAX);
const tail = (s) => {
  const t = String(s);
  return t.length > DETAIL_MAX ? t.slice(t.length - DETAIL_MAX) : t;
};
/** `/private/tmp` and `/tmp` (and `/private/var`, `/var`) name the same place on macOS. */
const normPath = (p) => String(p).replace(/^\/private(?=\/(?:tmp|var)\/)/, '').replace(/\/+$/, '');

// ─── roleSpawns / listRuns ────────────────────────────────────────────────────────────────────────────────────────

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

/** The earliest row timestamp of a transcript (ISO string), or '' when it has none: the spawn order key. */
function firstTimestamp(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  let min = Infinity;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isPlainObject(row) || typeof row.timestamp !== 'string') continue;
    const t = Date.parse(row.timestamp);
    if (Number.isFinite(t) && t < min) min = t;
  }
  return Number.isFinite(min) ? new Date(min).toISOString() : '';
}

/**
 * listRuns(parentDir) -> sorted names of the run dirs below a parent (`E/`), never a `*.prev-*` leftover of an
 * earlier attempt (objective 81 kept those beside the live run).
 */
function listRuns(parentDir) {
  let ents;
  try {
    ents = fs.readdirSync(parentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return ents
    .filter((e) => e.isDirectory() && !/\.prev-/.test(e.name))
    .map((e) => e.name)
    .sort();
}

/**
 * roleSpawns(runDir) -> {transcripts, reason, spawns}. One spawn per transcript file below `<runDir>/transcripts`
 * (and only there: a `*.prev-*` sibling of the run dir is another directory and is never walked):
 *   {role, agent_type, agent_id, description, file (absolute), rel, tool_results_dir, home, started_at}
 * A file outside `subagents/` is the main session (role `orchestrator`); a subagent's role comes from the sibling
 * `agent-<id>.meta.json` agentType by objective 81's roleOf (`aoforge:planner` -> `planner`), `unknown` without one.
 * Order: main sessions first, then subagents by start time and agent id.
 */
function roleSpawns(runDir) {
  const dir = path.join(runDir, 'transcripts');
  const out = { transcripts: dir, reason: null, spawns: [] };
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
  for (const rel of files) {
    const file = path.join(dir, rel);
    const parts = rel.split('/');
    const isSub = parts.includes('subagents');
    let role = ORCHESTRATOR;
    let agentType = null;
    let agentId = null;
    let description = null;
    let sessionDir;
    if (isSub) {
      const base = path.basename(rel, '.jsonl');
      agentId = base.startsWith('agent-') ? base.slice('agent-'.length) : base;
      const meta = readMeta(path.join(path.dirname(file), `${base}.meta.json`));
      role = roleOf(meta);
      agentType = role === UNKNOWN ? null : meta.agentType.trim();
      description = meta && typeof meta.description === 'string' ? meta.description : null;
      sessionDir = path.dirname(path.dirname(file));
    } else {
      sessionDir = path.join(path.dirname(file), path.basename(rel, '.jsonl'));
    }
    out.spawns.push({
      role,
      agent_type: agentType,
      agent_id: agentId,
      description,
      file,
      rel,
      tool_results_dir: path.join(sessionDir, 'tool-results'),
      home: path.join(runDir, 'home'),
      started_at: firstTimestamp(file),
    });
  }
  const key = (s) => [s.agent_id ? 1 : 0, s.started_at || '￿', s.agent_id || '', s.rel];
  out.spawns.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
  return out;
}

/** The spawns of one role in a run: `aoforge:planner` and `planner` both name the planner. */
function spawnsOfRole(runDir, role) {
  const wanted = roleOf({ agentType: String(role) });
  const all = roleSpawns(runDir);
  return { ...all, spawns: all.spawns.filter((s) => s.role === wanted), role: wanted };
}

// ─── apiCalls ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Size in chars of one tool_result `content` (string, or an array of blocks). */
function resultChars(content) {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  let n = 0;
  for (const block of content) {
    if (typeof block === 'string') n += block.length;
    else if (isPlainObject(block) && block.type === 'text' && typeof block.text === 'string') n += block.text.length;
    else if (isPlainObject(block) && block.type === 'image') n += IMAGE_CHARS;
    else if (isPlainObject(block)) n += JSON.stringify(block).length;
  }
  return n;
}

/** The whole text of a tool_result content (for the persisted-output pointer lookup). */
function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((b) => (typeof b === 'string' ? b : isPlainObject(b) && typeof b.text === 'string' ? b.text : '')).join('\n');
}

/** persisted-output pointer -> chars of the file it names, found by file name in toolResultsDir; null when none. */
function persistedChars(text, toolResultsDir) {
  const m = /Full output saved to:\s*(\S+)/.exec(text);
  if (!m || !toolResultsDir) return null;
  try {
    return fs.readFileSync(path.join(toolResultsDir, path.basename(m[1])), 'utf8').length;
  } catch {
    return null;
  }
}

/** The homes a transcript names itself: the directory above `.claude/CLAUDE.md` in its User instructions attachment. */
function inferHomes(rows) {
  const homes = new Set();
  for (const row of rows) {
    if (row.type !== 'attachment' || !isPlainObject(row.attachment) || row.attachment.type !== 'instructions') continue;
    for (const f of Array.isArray(row.attachment.files) ? row.attachment.files : []) {
      if (isPlainObject(f) && f.type === 'User' && typeof f.path === 'string' && f.path.endsWith('/.claude/CLAUDE.md')) {
        homes.add(f.path.slice(0, -'/.claude/CLAUDE.md'.length));
      }
    }
  }
  return [...homes].sort();
}

/**
 * apiCalls(lines, {toolResultsDir}) -> {calls, skipped_lines, homes}.
 * @param {string|Array<string|object>} lines  the transcript text, or its lines (a line may already be a parsed row)
 * Each call: {index (1-based), id, model, input_tokens, cache_creation, cache_read, context, output_tokens, total,
 *   tools: [{id, name, input, result_chars, persisted_chars, is_error, result_missing}]} in transcript order.
 * A line that is not JSON (or not an object) is skipped and counted in skipped_lines; a blank line is ignored.
 */
function apiCalls(lines, { toolResultsDir = null } = {}) {
  const list = typeof lines === 'string' ? lines.split('\n') : Array.isArray(lines) ? lines : [];
  const rows = [];
  let skipped = 0;
  for (const line of list) {
    if (typeof line === 'string') {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (isPlainObject(row)) rows.push(row);
        else skipped += 1;
      } catch {
        skipped += 1;
      }
    } else if (isPlainObject(line)) {
      rows.push(line);
    } else {
      skipped += 1;
    }
  }

  const byKey = new Map();
  const results = new Map();
  let anonymous = 0;
  for (const row of rows) {
    if (row.type === 'assistant') {
      const msg = row.message;
      if (!isPlainObject(msg) || !isPlainObject(msg.usage)) continue;
      const model = typeof msg.model === 'string' && msg.model ? msg.model : 'unknown';
      if (model === SYNTHETIC_MODEL) continue;
      let key;
      if (typeof msg.id === 'string' && msg.id) key = `id:${msg.id}`;
      else if (typeof row.uuid === 'string' && row.uuid) key = `uuid:${row.uuid}`;
      else key = `row:${anonymous++}`;
      let call = byKey.get(key);
      if (!call) {
        call = { id: typeof msg.id === 'string' ? msg.id : key, model, usage: msg.usage, tools: new Map() };
        byKey.set(key, call);
      } else if (count(msg.usage.output_tokens) > count(call.usage.output_tokens)) {
        call.usage = msg.usage;
        call.model = model;
      }
      for (const block of Array.isArray(msg.content) ? msg.content : []) {
        if (isPlainObject(block) && block.type === 'tool_use' && typeof block.id === 'string' && !call.tools.has(block.id)) {
          call.tools.set(block.id, { id: block.id, name: typeof block.name === 'string' ? block.name : 'unknown', input: isPlainObject(block.input) ? block.input : {} });
        }
      }
    } else if (row.type === 'user' && isPlainObject(row.message) && Array.isArray(row.message.content)) {
      for (const block of row.message.content) {
        if (!isPlainObject(block) || block.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
        if (results.has(block.tool_use_id)) continue;
        results.set(block.tool_use_id, {
          chars: resultChars(block.content),
          persisted: persistedChars(resultText(block.content), toolResultsDir),
          is_error: block.is_error === true,
        });
      }
    }
  }

  const calls = [...byKey.values()].map((c, i) => {
    const input = count(c.usage.input_tokens);
    const cc = count(c.usage.cache_creation_input_tokens);
    const cr = count(c.usage.cache_read_input_tokens);
    const out = count(c.usage.output_tokens);
    return {
      index: i + 1,
      id: c.id,
      model: c.model,
      input_tokens: input,
      cache_creation: cc,
      cache_read: cr,
      context: input + cc + cr,
      output_tokens: out,
      total: input + cc + cr + out,
      tools: [...c.tools.values()].map((t) => {
        const r = results.get(t.id);
        return {
          id: t.id,
          name: t.name,
          input: t.input,
          result_chars: r ? r.chars : 0,
          persisted_chars: r ? r.persisted : null,
          is_error: r ? r.is_error : false,
          result_missing: !r,
        };
      }),
    };
  });
  return { calls, skipped_lines: skipped, homes: inferHomes(rows) };
}

// ─── categorize ───────────────────────────────────────────────────────────────────────────────────────────────────

const RUNTIME_PATH = /(?:^|\/)\.claude\/aoforge\/(.+)$/;
const BIN_PATH = /(?:^|\/)\.claude\/aoforge\/bin(?:\/|$)/;
const READERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'bat', 'nl']);
const GREPPERS = new Set(['grep', 'rg', 'egrep', 'fgrep', 'ag']);
const INVESTIGATORS = new Set(['cat', 'head', 'tail', 'less', 'more', 'bat', 'nl', 'sed', 'awk', 'grep', 'rg', 'egrep', 'fgrep', 'ls', 'find', 'wc', 'file', 'stat', 'tree']);

/** Drop heredoc bodies: the lines after `<<EOF` up to the delimiter line are data, not commands. */
function stripHeredocs(command) {
  const lines = String(command).split('\n');
  const out = [];
  let end = null;
  for (const line of lines) {
    if (end !== null) {
      if (line.trim() === end) end = null;
      continue;
    }
    out.push(line);
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(line);
    if (m) end = m[2];
  }
  return out.join('\n');
}

/** Split a shell line into simple commands at unquoted `;`, `&&`, `||`, `|`, `&` and newlines. */
function splitSimple(command) {
  const parts = [];
  let cur = '';
  let quote = null;
  const s = stripHeredocs(command);
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && quote === '"' && i + 1 < s.length) {
        i += 1;
        cur += s[i];
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '\\' && i + 1 < s.length) {
      cur += ch + s[i + 1];
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === ';' || ch === '\n' || ch === '|') {
      parts.push(cur);
      cur = '';
      if (ch === '|' && s[i + 1] === '|') i += 1;
      continue;
    }
    if (ch === '&') {
      // `2>&1`, `&>file` and `>&2` are redirections, not separators
      if (s[i - 1] === '>' || s[i - 1] === '<' || s[i + 1] === '>') {
        cur += ch;
        continue;
      }
      parts.push(cur);
      cur = '';
      if (s[i + 1] === '&') i += 1;
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Whitespace-split words with quotes removed. */
function words(simple) {
  const out = [];
  let cur = '';
  let quote = null;
  let any = false;
  for (let i = 0; i < simple.length; i += 1) {
    const ch = simple[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < simple.length) {
        i += 1;
        cur += simple[i];
      } else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      any = true;
      continue;
    }
    if (ch === '\\' && i + 1 < simple.length) {
      i += 1;
      cur += simple[i];
      any = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (any || cur) out.push(cur);
      cur = '';
      any = false;
      continue;
    }
    cur += ch;
    any = true;
  }
  if (any || cur) out.push(cur);
  return out;
}

const AOF_TOOLS = /(?:^|\/)aof-tools(?:\.cjs)?$/;

/** aof-tools arguments after the global `--cwd <dir>` flag. */
function aofArgs(w) {
  const idx = w.findIndex((x) => AOF_TOOLS.test(x));
  if (idx < 0) return null;
  const args = w.slice(idx + 1);
  while (args[0] === '--cwd') args.splice(0, 2);
  return args;
}

// aof-tools verb tables: category -> {verb: [subcommands] | null (any)}. Order matters only for `commit`, which is first.
const AOF_CATEGORIES = [
  ['commit', { commit: null }],
  ['context_load', { init: null, state: ['digest'], intent: ['resolve'], stack: ['context', 'resolve', 'command'], 'history-digest': null }],
  ['validate_publish', { frontmatter: ['validate'], verify: null, 'trd-tdd': null, plan: ['put-trd', 'push'], summary: ['checkpoint', 'post'], tokens: ['stamp'] }],
  ['draft_setup', { planning: ['draft'] }],
  ['state_record', {
    state: ['advance-job', 'update-progress', 'record-metric', 'add-decision', 'record-session', 'add-blocker', 'patch', 'update'],
    roadmap: ['update-job-progress'],
    requirements: ['mark-complete'],
    trd: ['finalize'],
  }],
  ['exec_context', { 'exec-context': null }],
];

function aofCategory(args) {
  const [verb, sub] = args;
  for (const [category, table] of AOF_CATEGORIES) {
    if (!Object.prototype.hasOwnProperty.call(table, verb)) continue;
    const subs = table[verb];
    if (subs === null || subs.includes(sub)) return category;
  }
  return null;
}

const GIT_READ = new Set(['status', 'diff', 'log', 'show', 'ls-files', 'rev-parse', 'branch', 'remote', 'blame', 'shortlog', 'describe']);
const SHELL_KEYWORDS = new Set(['do', 'then', 'else', '{', '(', '!']);

/**
 * Category of one simple shell command, or null when no rule matches. `state.inBin` is true after a `cd` into the
 * aoforge bin directory earlier in the same command line: a read or listing there is tool investigation too.
 */
function classifySimple(simple, state) {
  let w = words(simple);
  while (w.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]) || SHELL_KEYWORDS.has(w[0]))) w = w.slice(1);
  if (w.length === 0) return null;
  const cmd = path.basename(w[0]);
  if (cmd === 'cd') {
    state.inBin = BIN_PATH.test(w[1] || '');
    return null;
  }

  if (cmd === 'git') {
    const rest = w.slice(1);
    let i = 0;
    while (i < rest.length && rest[i].startsWith('-')) i += rest[i] === '-C' || rest[i] === '-c' ? 2 : 1;
    const sub = rest[i];
    if (sub === 'commit') return { category: 'raw_commit', detail: head(simple) };
    if ((sub === 'log' || sub === 'show') && /%[Bb]|--pretty=full/.test(simple)) return { category: 'commit_inspect', detail: head(simple) };
    if (GIT_READ.has(sub)) return { category: 'git_inspect', detail: head(simple) };
  }

  if (w.includes('--help')) return { category: 'tool_investigation', detail: head(simple) };
  if (INVESTIGATORS.has(cmd) && (state.inBin || w.slice(1).some((x) => BIN_PATH.test(x)))) return { category: 'tool_investigation', detail: head(simple) };

  const args = aofArgs(w);
  if (args) {
    const category = aofCategory(args);
    if (category) return { category, detail: head(simple) };
  }

  const runtime = w.slice(1).map((x) => RUNTIME_PATH.exec(x)).find(Boolean);
  if (runtime) {
    const rel = runtime[1];
    if (READERS.has(cmd) || (cmd === 'sed' && w.includes('-n'))) return { category: `runtime_read:${rel}`, detail: rel };
    if (GREPPERS.has(cmd)) return { category: `runtime_grep:${rel}`, detail: rel };
    if (cmd === 'ls' || cmd === 'find' || cmd === 'tree') return { category: 'runtime_lookup', detail: head(simple) };
  }
  if (cmd === 'echo' && w.slice(1).some((x) => x === '$HOME' || x === '~')) return { category: 'runtime_lookup', detail: head(simple) };
  if (cmd === 'printenv' && w[1] === 'HOME') return { category: 'runtime_lookup', detail: head(simple) };

  if (cmd === 'cp' && w.slice(1).some((x) => /^-[A-Za-z]*[Rra][A-Za-z]*$/.test(x))) return { category: 'scratch_copy', detail: head(simple) };

  if (cmd === 'node' && w.includes('--test')) return { category: 'test_run', detail: head(simple) };
  if (['npm', 'pnpm', 'yarn'].includes(cmd) && (w[1] === 'test' || (w[1] === 'run' && w[2] === 'test'))) return { category: 'test_run', detail: head(simple) };
  return null;
}

/**
 * categorize({name, input}, {homes}) -> {category, detail}. The ordered rule list (first match wins):
 *   Read  *-TRD.md                               trd_read
 *   Read  <home>/.claude/aoforge/<rel>           runtime_read:<rel>      (`~`, a known home, or any home when none given)
 *   Read  /elsewhere/.claude/aoforge/<rel>       guessed_runtime_path    (an absolute path outside every known home)
 *   Write/Edit under aoforge-drafts              draft_write | draft_edit
 *   Bash, per simple command in order, the first that matches:
 *     git commit                                 raw_commit              (any flags, --amend included)
 *     git log|show with %B                       commit_inspect
 *     --help, or reading/listing .claude/aoforge/bin   tool_investigation
 *     aof-tools commit                           commit
 *     aof-tools init|state digest|intent resolve|stack context|stack resolve|stack command|history-digest   context_load
 *     aof-tools frontmatter validate|verify *|trd-tdd|plan put-trd|plan push|summary checkpoint|summary post|tokens stamp   validate_publish
 *     aof-tools planning draft                   draft_setup
 *     aof-tools state advance-job|update-progress|record-metric|add-decision|record-session|..., roadmap update-job-progress,
 *       requirements mark-complete, trd finalize state_record
 *     aof-tools exec-context                     exec_context
 *     git status|diff|log|show|ls-files|...      git_inspect             (after commit_inspect)
 *     cp -R|-r|-a                                scratch_copy
 *     cat|head|tail|sed -n of .claude/aoforge/<rel>   runtime_read:<rel>
 *     grep|rg of .claude/aoforge/<rel>           runtime_grep:<rel>
 *     ls|find of .claude/aoforge/..., echo $HOME runtime_lookup
 *     node --test | npm test                     test_run
 *   anything else                                other
 * `homes` are the run's own home directories. detail: the runtime-relative path, or the command head (120 chars).
 */
function categorize(tool, { homes = [] } = {}) {
  const name = tool && tool.name;
  const input = (tool && isPlainObject(tool.input) ? tool.input : {}) || {};
  if (name === 'Read') {
    const p = String(input.file_path || input.path || '');
    if (/-(?:TRD|JOB)\.md$/.test(p)) return { category: 'trd_read', detail: tail(p) };
    const m = RUNTIME_PATH.exec(p);
    if (m) {
      const own = p.startsWith('~') || p.startsWith('$HOME') || homes.length === 0 || homes.some((h) => normPath(p).startsWith(`${normPath(h)}/`));
      return own ? { category: `runtime_read:${m[1]}`, detail: m[1] } : { category: 'guessed_runtime_path', detail: tail(p) };
    }
    return { category: 'other', detail: tail(p) };
  }
  if (name === 'Write' || name === 'Edit' || name === 'MultiEdit' || name === 'NotebookEdit') {
    const p = String(input.file_path || input.notebook_path || '');
    if (p.includes('aoforge-drafts')) return { category: name === 'Write' ? 'draft_write' : 'draft_edit', detail: tail(p) };
    return { category: 'other', detail: tail(p) };
  }
  if (name === 'Bash') {
    const command = String(input.command || '');
    const state = { inBin: false };
    for (const simple of splitSimple(command)) {
      const hit = classifySimple(simple, state);
      if (hit) return hit;
    }
    return { category: 'other', detail: head(command) };
  }
  return { category: 'other', detail: head(JSON.stringify(input) || '') };
}

// ─── attribute / summarize ────────────────────────────────────────────────────────────────────────────────────────

function bump(map, key, issuing, carry) {
  let row = map.get(key);
  if (!row) {
    row = { count: 0, issuing: 0, carry: 0 };
    map.set(key, row);
  }
  row.count += 1;
  row.issuing += issuing;
  row.carry += carry;
}

function sortedObject(map) {
  const out = {};
  for (const key of [...map.keys()].sort()) {
    const r = map.get(key);
    out[key] = { count: r.count, issuing: Math.round(r.issuing), carry: Math.round(r.carry) };
  }
  return out;
}

/**
 * attribute(calls, {homes}) -> {categories, by_tool}. Annotates each tool of `calls` with `category` and `detail`
 * (it mutates the tool objects), and per category gives {count, issuing, carry} as described in the module comment.
 * `by_tool` is the same table keyed by tool name (`(none)` for the calls that issued no tool).
 */
function attribute(calls, opts = {}) {
  const n = calls.length;
  const categories = new Map();
  const tools = new Map();
  calls.forEach((call, i) => {
    const later = n - 1 - i;
    if (call.tools.length === 0) {
      bump(categories, FINAL, call.total, 0);
      bump(tools, NO_TOOL, call.total, 0);
      return;
    }
    const share = call.total / call.tools.length;
    for (const t of call.tools) {
      const { category, detail } = categorize(t, opts);
      t.category = category;
      t.detail = detail;
      const carry = tokensOf(t.result_chars) * later;
      bump(categories, category, share, carry);
      bump(tools, t.name, share, carry);
    }
  });
  return { categories: sortedObject(categories), by_tool: sortedObject(tools) };
}

/** The per-call listing used as evidence: no tool inputs, details capped. */
function callList(calls) {
  return calls.map((c) => ({
    index: c.index,
    id: c.id,
    context: c.context,
    output: c.output_tokens,
    tools: c.tools.map((t) => ({ name: t.name, category: t.category, detail: t.detail, result_chars: t.result_chars, persisted_chars: t.persisted_chars, is_error: t.is_error })),
  }));
}

/**
 * summarizeSpawn(spawn, {calls: false, homes}) -> one spawn's summary:
 *   {role, agent_type, agent_id, description, file, calls, first_context, last_context, context_tokens,
 *    output_tokens, total_tokens, mean_context, skipped_lines, categories, by_tool [, call_list]}
 * `spawn` is an entry of roleSpawns().spawns. `calls: true` adds the per-call listing.
 */
function summarizeSpawn(spawn, { calls: withCalls = false, homes } = {}) {
  let text = '';
  let readable = true;
  try {
    text = fs.readFileSync(spawn.file, 'utf8');
  } catch {
    readable = false;
  }
  const parsed = apiCalls(text, { toolResultsDir: spawn.tool_results_dir || null });
  const knownHomes = [...new Set([...(homes || []), ...parsed.homes, ...(spawn.home ? [spawn.home] : [])])];
  const attr = attribute(parsed.calls, { homes: knownHomes });
  const n = parsed.calls.length;
  const context = parsed.calls.reduce((s, c) => s + c.context, 0);
  const output = parsed.calls.reduce((s, c) => s + c.output_tokens, 0);
  const out = {
    role: spawn.role,
    agent_type: spawn.agent_type || null,
    agent_id: spawn.agent_id || null,
    description: spawn.description || null,
    file: spawn.rel || spawn.file,
    readable,
    calls: n,
    first_context: n ? parsed.calls[0].context : 0,
    last_context: n ? parsed.calls[n - 1].context : 0,
    context_tokens: context,
    output_tokens: output,
    total_tokens: context + output,
    mean_context: n ? round3(context / n) : 0,
    skipped_lines: parsed.skipped_lines,
    categories: attr.categories,
    by_tool: attr.by_tool,
  };
  if (withCalls) out.call_list = callList(parsed.calls);
  return out;
}

function mergeTable(tables) {
  const merged = new Map();
  for (const table of tables) {
    for (const [key, r] of Object.entries(table || {})) {
      const m = merged.get(key) || { count: 0, issuing: 0, carry: 0 };
      m.count += r.count;
      m.issuing += r.issuing;
      m.carry += r.carry;
      merged.set(key, m);
    }
  }
  const out = {};
  for (const key of [...merged.keys()].sort()) out[key] = merged.get(key);
  return out;
}

/** mergeSummaries([summary]) -> the summary of the spawns taken together (counts and tokens summed, mean recomputed). */
function mergeSummaries(list) {
  const calls = list.reduce((s, x) => s + x.calls, 0);
  const context = list.reduce((s, x) => s + x.context_tokens, 0);
  const output = list.reduce((s, x) => s + x.output_tokens, 0);
  return {
    role: list.length ? list[0].role : null,
    spawns: list.length,
    calls,
    first_context: list.length ? Math.round(list.reduce((s, x) => s + x.first_context, 0) / list.length) : 0,
    context_tokens: context,
    output_tokens: output,
    total_tokens: context + output,
    mean_context: calls ? round3(context / calls) : 0,
    skipped_lines: list.reduce((s, x) => s + (x.skipped_lines || 0), 0),
    categories: mergeTable(list.map((x) => x.categories)),
    by_tool: mergeTable(list.map((x) => x.by_tool)),
  };
}

/** summarizeRole(runDir, role, opts) -> {role, reason, spawns: [summary]} for every spawn of the role in a run. */
function summarizeRole(runDir, role, opts = {}) {
  const found = spawnsOfRole(runDir, role);
  return { role: found.role, reason: found.reason, spawns: found.spawns.map((s) => summarizeSpawn(s, opts)) };
}

// ─── compare ──────────────────────────────────────────────────────────────────────────────────────────────────────

function deltaTable(a, b, dtotal) {
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
  const zero = { count: 0, issuing: 0, carry: 0 };
  const rows = keys.map((category) => {
    const x = (a && a[category]) || zero;
    const y = (b && b[category]) || zero;
    return {
      category,
      count_a: x.count,
      count_b: y.count,
      dcount: y.count - x.count,
      issuing_a: x.issuing,
      issuing_b: y.issuing,
      dissuing: y.issuing - x.issuing,
      carry_a: x.carry,
      carry_b: y.carry,
      dcarry: y.carry - x.carry,
      share: dtotal === 0 ? 0 : round6((y.issuing - x.issuing) / dtotal),
    };
  });
  rows.sort((p, q) => Math.abs(q.dissuing) - Math.abs(p.dissuing) || (p.category < q.category ? -1 : 1));
  return rows;
}

/**
 * compare(a, b) -> {decomposition, categories, tools}. a and b are summaries (a spawn's, or mergeSummaries').
 * decomposition: dtotal = calls_term + context_term + output_term (+ residual from rounding), with
 *   calls_term = dcalls x meanContext(a), context_term = calls(b) x dMeanContext, output_term = doutput.
 * categories / tools: rows with the count, issuing and carry of each side, their deltas, and `share` = dissuing / dtotal
 * (the issuing deltas partition dtotal, so the shares sum to 1); sorted by the size of the delta.
 */
function compare(a, b) {
  const ca = a.calls;
  const cb = b.calls;
  const mca = ca ? a.context_tokens / ca : 0;
  const mcb = cb ? b.context_tokens / cb : 0;
  const dtotal = b.total_tokens - a.total_tokens;
  const callsTerm = Math.round((cb - ca) * mca);
  const contextTerm = Math.round(cb * (mcb - mca));
  const outputTerm = b.output_tokens - a.output_tokens;
  return {
    decomposition: {
      calls_a: ca,
      calls_b: cb,
      dcalls: cb - ca,
      mean_context_a: round3(mca),
      mean_context_b: round3(mcb),
      dmean_context: round3(mcb - mca),
      output_a: a.output_tokens,
      output_b: b.output_tokens,
      doutput: outputTerm,
      total_a: a.total_tokens,
      total_b: b.total_tokens,
      dtotal,
      calls_term: callsTerm,
      context_term: contextTerm,
      output_term: outputTerm,
      residual: dtotal - (callsTerm + contextTerm + outputTerm),
    },
    categories: deltaTable(a.categories, b.categories, dtotal),
    tools: deltaTable(a.by_tool, b.by_tool, dtotal),
  };
}

/** Pair the spawns of two runs: by description when every one has a distinct matching description, else by order. */
function pairSpawns(listA, listB) {
  const descs = (l) => l.map((s) => s.description);
  const unique = (l) => l.every((s) => s.description) && new Set(descs(l)).size === l.length;
  if (unique(listA) && unique(listB) && listA.every((s) => descs(listB).includes(s.description))) {
    return listA.map((a) => [a, listB.find((b) => b.description === a.description)]);
  }
  const n = Math.min(listA.length, listB.length);
  return Array.from({ length: n }, (_, i) => [listA[i], listB[i]]);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const USAGE = [
  'usage: attribution.cjs --run <run dir> --role <role> [--json] [--calls]',
  '       attribution.cjs --compare <run dir A> <run dir B> --role <role> [--json]',
  '  role is an agent type (aoforge:planner) or its short name (planner); --json prints one JSON object per line',
].join('\n');

const fmt = (n) => (Number.isInteger(n) ? n : round3(n)).toLocaleString('en-US');

function table(rows, columns) {
  const widths = columns.map((c) => Math.max(c.title.length, ...rows.map((r) => String(c.get(r)).length)));
  const line = (cells) => cells.map((cell, i) => (columns[i].left ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i]))).join('  ');
  return [line(columns.map((c) => c.title)), ...rows.map((r) => line(columns.map((c) => c.get(r))))].join('\n');
}

function renderSpawn(s) {
  const rows = Object.entries(s.categories).sort((p, q) => q[1].issuing - p[1].issuing || (p[0] < q[0] ? -1 : 1));
  const lines = [
    `${s.role}  agent=${s.agent_id || '-'}${s.description ? `  "${s.description}"` : ''}`,
    `  calls ${fmt(s.calls)}  total ${fmt(s.total_tokens)}  mean_context ${fmt(s.mean_context)}  first_context ${fmt(s.first_context)}  output ${fmt(s.output_tokens)}${s.skipped_lines ? `  skipped_lines ${s.skipped_lines}` : ''}`,
    table(rows, [
      { title: 'category', left: true, get: (r) => r[0] },
      { title: 'count', get: (r) => fmt(r[1].count) },
      { title: 'issuing', get: (r) => fmt(r[1].issuing) },
      { title: 'carry', get: (r) => fmt(r[1].carry) },
    ]),
  ];
  if (s.call_list) {
    lines.push('', table(s.call_list, [
      { title: '#', get: (c) => c.index },
      { title: 'context', get: (c) => fmt(c.context) },
      { title: 'output', get: (c) => fmt(c.output) },
      { title: 'tools', left: true, get: (c) => (c.tools.length ? c.tools.map((t) => `${t.category}:${t.detail.slice(0, 60)}`).join(' | ') : FINAL) },
    ]));
  }
  return lines.join('\n');
}

function renderCompare(label, c) {
  const d = c.decomposition;
  return [
    label,
    `  calls ${fmt(d.calls_a)} -> ${fmt(d.calls_b)} (${d.dcalls >= 0 ? '+' : ''}${fmt(d.dcalls)})  mean_context ${fmt(d.mean_context_a)} -> ${fmt(d.mean_context_b)}  output ${fmt(d.output_a)} -> ${fmt(d.output_b)}`,
    `  total ${fmt(d.total_a)} -> ${fmt(d.total_b)}  delta ${fmt(d.dtotal)} = calls ${fmt(d.calls_term)} + context ${fmt(d.context_term)} + output ${fmt(d.output_term)} (residual ${d.residual})`,
    table(c.categories, [
      { title: 'category', left: true, get: (r) => r.category },
      { title: 'n_a', get: (r) => r.count_a },
      { title: 'n_b', get: (r) => r.count_b },
      { title: 'd_issuing', get: (r) => fmt(r.dissuing) },
      { title: 'd_carry', get: (r) => fmt(r.dcarry) },
      { title: 'share', get: (r) => `${(r.share * 100).toFixed(1)}%` },
    ]),
  ].join('\n');
}

/**
 * main(argv, {out, err}) -> exit code. Library-callable: `out` and `err` receive the text (default process streams).
 */
function main(argv, io = {}) {
  const out = io.out || ((s) => process.stdout.write(s));
  const err = io.err || ((s) => process.stderr.write(s));
  const fail = (msg) => {
    err(`${msg ? `${msg}\n` : ''}${USAGE}\n`);
    return 1;
  };
  const opts = { run: null, compare: null, role: null, json: false, calls: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--calls') opts.calls = true;
    else if (a === '--role') {
      opts.role = argv[i + 1];
      i += 1;
    } else if (a === '--run') {
      opts.run = argv[i + 1];
      i += 1;
    } else if (a === '--compare') {
      opts.compare = [argv[i + 1], argv[i + 2]];
      i += 2;
    } else return fail(`unknown argument: ${a}`);
  }
  if (!opts.role) return fail('missing --role');
  if (opts.run && opts.compare) return fail('use --run or --compare, not both');
  if (!opts.run && !opts.compare) return fail('missing --run or --compare');

  if (opts.run) {
    const found = summarizeRole(opts.run, opts.role, { calls: opts.calls });
    if (found.spawns.length === 0) {
      err(`no ${found.role} spawn in ${opts.run}${found.reason ? ` (${found.reason})` : ''}\n`);
      return 1;
    }
    for (const s of found.spawns) {
      const row = { run: path.basename(path.resolve(opts.run)), ...s };
      out(opts.json ? `${JSON.stringify(row)}\n` : `${renderSpawn(s)}\n\n`);
    }
    return 0;
  }

  const [runA, runB] = opts.compare;
  if (!runA || !runB || runA.startsWith('--') || runB.startsWith('--')) return fail('--compare needs two run dirs');
  const a = summarizeRole(runA, opts.role, { calls: false });
  const b = summarizeRole(runB, opts.role, { calls: false });
  if (a.spawns.length === 0 || b.spawns.length === 0) {
    err(`no ${a.role} spawn in ${a.spawns.length === 0 ? runA : runB}\n`);
    return 1;
  }
  const aggregate = compare(mergeSummaries(a.spawns), mergeSummaries(b.spawns));
  const pairs = pairSpawns(a.spawns, b.spawns).map(([x, y]) => ({
    a: x.agent_id,
    b: y.agent_id,
    label: x.description === y.description && x.description ? x.description : `${x.agent_id} vs ${y.agent_id}`,
    ...compare(x, y),
  }));
  if (opts.json) {
    const side = (dir, list) => ({ run: path.basename(path.resolve(dir)), ...mergeSummaries(list), agent_ids: list.map((s) => s.agent_id) });
    out(`${JSON.stringify({ role: a.role, a: side(runA, a.spawns), b: side(runB, b.spawns), aggregate, pairs })}\n`);
    return 0;
  }
  out(`${renderCompare(`${a.role}: ${path.basename(path.resolve(runA))} vs ${path.basename(path.resolve(runB))} (all spawns)`, aggregate)}\n\n`);
  for (const p of pairs) out(`${renderCompare(`pair ${p.label}`, p)}\n\n`);
  return 0;
}

module.exports = {
  roleSpawns,
  spawnsOfRole,
  listRuns,
  apiCalls,
  categorize,
  attribute,
  summarizeSpawn,
  summarizeRole,
  mergeSummaries,
  compare,
  pairSpawns,
  main,
  USAGE,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
