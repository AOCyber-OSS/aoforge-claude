#!/usr/bin/env node
'use strict';
/**
 * A fake `claude` binary for the objective-81 runner tests and the 81-13 rehearsal (TRD 81-08). It never touches the
 * network and never execs anything. It reads the flags the runner passes (`-p`, `--model`, `--agent`,
 * `--max-budget-usd`, `--plugin-dir`, `--tools`, ...), a scenario from `./.fake-scenario` in its cwd (no file: `happy`),
 * and writes:
 *   - stream-json lines on stdout (built with __fixtures__/stream-json.cjs, the 81-01 builders);
 *   - a session transcript under `$CLAUDE_CONFIG_DIR/projects/<projectKey(cwd)>/<session>.jsonl` plus one subagent
 *     transcript `<session>/subagents/agent-<id>.jsonl` and its `.meta.json`. With no CLAUDE_CONFIG_DIR it writes no
 *     transcript at all (it never falls back to $HOME/.claude).
 * At TEST_RATES every transcript prices to exactly the reported `total_cost_usd`, except in `subagent_cost`.
 *
 * Optional files in cwd (written by a batch module's materialize, e.g. __fixtures__/stub-batch.cjs):
 *   .fake-marker      a path; one JSON line per invocation is appended there (proves a spawn happened)
 *   .fake-real-home   the stand-in real home for `touch_real_projects`
 *   .fake-deny-target the path `deny_outside` names in its permission denial
 *   .fake-state-dir   where the call counter lives (else cwd); kept outside the work dir so it survives the fresh
 *                     sandbox the runner makes for a retry
 *
 * Scenarios (`name[:arg]`, split at the first colon):
 *   happy                 reported cost = 10% of --max-budget-usd (0.5 when absent), 2 main + 1 subagent message
 *   usage_limit:<s>       first call only: a usage-limit result resetting in <s> seconds, cost 0; later calls happy
 *   slow:<ms>[:silent]    writes one message (stdout + transcript, $0.02) then sleeps <ms> before finishing; with
 *                         `silent` it writes the init event only and no transcript
 *   wrong_model           the other tier's model does the work (requested haiku -> sonnet, else haiku)
 *   wrong_tools           the init event lists tools the agent does not declare
 *   leak_token            writes its whole environment, values included (like `env > leak.txt`), into ./leak.txt,
 *                         so the token the runner passed lands in the work dir
 *   touch_watched:<path>  a directory gets a new file `.fake-touched`; a file gets one byte appended
 *   env_dump              writes ./.fake-env.json: env NAMES (never values), HOME, and what stdin delivered
 *   overshoot:<usd>       reported cost = --max-budget-usd + usd, a budget-stop result
 *   subagent_cost:<usd>   reports 0.10; the subagent transcript carries usd more at TEST_RATES
 *   touch_real_projects   creates <real home>/.claude/projects/<projectKey(cwd)>/x.jsonl
 *   deny_inside           a permission denial naming ./secret.txt (inside the run dir)
 *   deny_outside          a permission denial naming the path in ./.fake-deny-target
 *
 * In `happy` (and every scenario but wrong_tools), with `--agent <plugin>:<name>` and a `--plugin-dir` holding
 * `agents/<name>.md`, the init event lists that agent's declared non-MCP tools, so real batch modules pass the
 * runner's tools check; `--tools` (when given) wins.
 *
 * Invoke it directly (shebang; the file is mode 755) or as `node fake-claude.cjs ...`; the runner also accepts
 * `--claude-bin node:<path>` for a CI without an executable bit.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('./stream-json.cjs');

// Every model at $10 per million output tokens and $0 for everything else: 1e5 output tokens = $1, so a cost with
// at most 5 decimals maps to a whole number of tokens and prices back exactly.
const TEST_RATE_OUTPUT = 10;
const TOKENS_PER_USD = 1e6 / TEST_RATE_OUTPUT;
const PINS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const testRateRow = () => ({
  input: 0,
  output: TEST_RATE_OUTPUT,
  cache_read: 0,
  cache_write_5m: 0,
  cache_write_1h: 0,
  source: 'https://example.invalid/eval81-test-rates',
  as_of: '2026-10-17',
});
/** The raw rates file (loadRates() format) the runner tests pass with `--rates <file>`. */
const TEST_RATES = {
  currency: 'USD',
  unit: 'per_million_tokens',
  models: Object.fromEntries(Object.values(PINS).map((id) => [id, testRateRow()])),
  aliases: {},
};
const HAPPY_SHARE = 0.1;
const SLOW_PARTIAL_USD = 0.02;
const SUBAGENT_REPORTED_USD = 0.1;
const DEFAULT_TOOLS = ['Bash', 'Read', 'Grep', 'Glob', 'Edit', 'Write'];
const WRONG_TOOLS = ['Edit', 'WebSearch', 'NotebookEdit'];

/** The session project key: every character outside [A-Za-z0-9] becomes `-` (tripwire.projectKey is the tested copy). */
const projectKey = (p) => String(p).replace(/[^A-Za-z0-9]/g, '-');
const tokensFor = (usd) => Math.max(0, Math.round(usd * TOKENS_PER_USD));
const usdFor = (tokens) => tokens / TOKENS_PER_USD;

function parseArgs(argv) {
  const o = { pluginDirs: [], tools: null, prompt: null, model: null, agent: null, budget: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--') {
      o.prompt = argv.slice(i + 1).join(' ');
      break;
    }
    switch (a) {
      case '-p':
      case '--print':
      case '--verbose':
        break;
      case '--model': o.model = argv[++i]; break;
      case '--agent': o.agent = argv[++i]; break;
      case '--max-budget-usd': o.budget = Number(argv[++i]); break;
      case '--plugin-dir': o.pluginDirs.push(argv[++i]); break;
      case '--tools': o.tools = argv[++i]; break;
      case '--settings':
      case '--json-schema':
      case '--output-format':
      case '--permission-mode':
        i += 1;
        break;
      default:
        if (!a.startsWith('-') && o.prompt === null) o.prompt = a;
    }
  }
  return o;
}

function readOpt(name) {
  try {
    const v = fs.readFileSync(path.join(process.cwd(), name), 'utf-8').trim();
    return v === '' ? null : v;
  } catch {
    return null;
  }
}

/** The agent's declared tools from `<plugin-dir>/agents/<name>.md` frontmatter, MCP wildcards dropped. */
function agentTools(args) {
  if (!args.agent) return null;
  const name = args.agent.includes(':') ? args.agent.slice(args.agent.indexOf(':') + 1) : args.agent;
  for (const dir of args.pluginDirs) {
    let text;
    try {
      text = fs.readFileSync(path.join(dir, 'agents', `${name}.md`), 'utf-8');
    } catch {
      continue;
    }
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    const line = fm && /^tools:\s*(.*)$/m.exec(fm[1]);
    if (!line) return [];
    return line[1].split(',').map((t) => t.trim()).filter((t) => t && !t.startsWith('mcp__'));
  }
  return null;
}

function initTools(args, scenario) {
  if (scenario === 'wrong_tools') return [...WRONG_TOOLS];
  if (args.tools !== null) return args.tools.split(',').map((t) => t.trim()).filter(Boolean);
  return agentTools(args) || [...DEFAULT_TOOLS];
}

function nextCall() {
  const dir = readOpt('.fake-state-dir') || process.cwd();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '.fake-calls');
  let n = 0;
  try {
    n = Number(fs.readFileSync(file, 'utf-8').trim()) || 0;
  } catch {}
  fs.writeFileSync(file, String(n + 1));
  return n;
}

function writeMarker(args, scenario) {
  const marker = readOpt('.fake-marker');
  if (!marker) return;
  fs.appendFileSync(marker, `${JSON.stringify({ pid: process.pid, scenario, model: args.model, agent: args.agent, cwd: process.cwd() })}\n`);
}

/** Transcript writer bound to one session; a no-op without CLAUDE_CONFIG_DIR. */
function transcript(sessionId, prompt) {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  if (!configDir) {
    process.stderr.write('fake-claude: CLAUDE_CONFIG_DIR is not set; no transcript written\n');
    return { main() {}, sub() {} };
  }
  const projDir = path.join(configDir, 'projects', projectKey(process.cwd()));
  const mainFile = path.join(projDir, `${sessionId}.jsonl`);
  const line = (row) => `${JSON.stringify({ ...row, sessionId, cwd: process.cwd(), timestamp: new Date().toISOString() })}\n`;
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    fs.mkdirSync(projDir, { recursive: true });
    fs.appendFileSync(mainFile, line({ type: 'user', uuid: crypto.randomUUID(), message: { role: 'user', content: prompt || '' } }));
  };
  const assistant = (msg) => line({ type: 'assistant', uuid: crypto.randomUUID(), message: { type: 'message', role: 'assistant', ...msg } });
  return {
    main(msg) {
      start();
      if (msg) fs.appendFileSync(mainFile, assistant(msg));
    },
    sub(msg) {
      start();
      const agentId = 'a1b2c3';
      const subDir = path.join(projDir, sessionId, 'subagents');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, `agent-${agentId}.meta.json`), `${JSON.stringify({ agentType: 'Explore' })}\n`);
      fs.appendFileSync(path.join(subDir, `agent-${agentId}.jsonl`), assistant(msg));
    },
  };
}

const out = (events) => process.stdout.write(S.toLines(events));

function message(id, model, outputTokens, content) {
  return { id, model, content, usage: S.usage({ output: outputTokens }) };
}

function streamMessage(m, sessionId) {
  return S.assistantMsg({ id: m.id, model: m.model, usage: m.usage, content: m.content, session_id: sessionId });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = readOpt('.fake-scenario') || 'happy';
  const colon = raw.indexOf(':');
  const scenario = colon === -1 ? raw : raw.slice(0, colon);
  const arg = colon === -1 ? null : raw.slice(colon + 1);
  const known = ['happy', 'usage_limit', 'slow', 'wrong_model', 'wrong_tools', 'leak_token', 'touch_watched', 'env_dump',
    'overshoot', 'subagent_cost', 'touch_real_projects', 'deny_inside', 'deny_outside'];
  if (!known.includes(scenario)) {
    process.stderr.write(`fake-claude: unknown scenario ${scenario}\n`);
    process.exitCode = 2;
    return;
  }
  writeMarker(args, scenario);

  const requested = PINS[args.model] || args.model || PINS.haiku;
  const model = scenario === 'wrong_model' ? (requested === PINS.haiku ? PINS.sonnet : PINS.haiku) : requested;
  const budget = Number.isFinite(args.budget) && args.budget > 0 ? args.budget : 0.5;
  const sessionId = crypto.randomUUID();
  const tr = transcript(sessionId, args.prompt);
  const init = S.initEvent({ model, tools: initTools(args, scenario), session_id: sessionId, claude_code_version: '0.0.0-fake' });
  init.cwd = process.cwd();
  init.permissionMode = 'bypassPermissions';

  if (scenario === 'env_dump') {
    let stdinBytes = -1;
    let stdinStat = null;
    try {
      const st = fs.fstatSync(0);
      stdinStat = { char_device: st.isCharacterDevice(), fifo: st.isFIFO(), file: st.isFile() };
      stdinBytes = fs.readSync(0, Buffer.alloc(64), 0, 64, null);
    } catch (err) {
      stdinStat = { error: err.code || err.message };
    }
    fs.writeFileSync(path.join(process.cwd(), '.fake-env.json'), `${JSON.stringify({
      names: Object.keys(process.env).sort(),
      home: process.env.HOME || null,
      stdin_bytes: stdinBytes,
      stdin_is_tty: Boolean(process.stdin.isTTY),
      stdin: stdinStat,
    }, null, 2)}\n`);
  }
  if (scenario === 'leak_token') {
    // What an agent running `env > leak.txt` would leave: every variable with its value, the token among them.
    const dump = Object.entries(process.env).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync(path.join(process.cwd(), 'leak.txt'), `${dump}\n`);
  }
  if (scenario === 'touch_watched' && arg) {
    let st = null;
    try {
      st = fs.statSync(arg);
    } catch {}
    if (st && st.isDirectory()) fs.writeFileSync(path.join(arg, '.fake-touched'), 'touched\n');
    else fs.appendFileSync(arg, '\n');
  }
  if (scenario === 'touch_real_projects') {
    const realHome = readOpt('.fake-real-home');
    if (realHome) {
      const dir = path.join(realHome, '.claude', 'projects', projectKey(process.cwd()));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'x.jsonl'), '{}\n');
    }
  }

  if (scenario === 'usage_limit' && nextCall() === 0) {
    const epoch = Math.floor(Date.now() / 1000) + (Number(arg) || 0);
    tr.main(null);
    out([init, S.resultEvent({ subtype: 'success', is_error: true, total_cost_usd: 0, num_turns: 1, session_id: sessionId,
      result: `Claude AI usage limit reached|${epoch}`, terminal_reason: 'error' })]);
    return;
  }

  // Token split. Main thread: msg-1 and msg-2; subagent: one message. Reported cost = the priced total, except in
  // subagent_cost, where the subagent's usage is left out of the reported figure.
  let mainTokens;
  let subTokens;
  let reported;
  if (scenario === 'subagent_cost') {
    mainTokens = tokensFor(SUBAGENT_REPORTED_USD);
    subTokens = tokensFor(Number(arg) || 0);
    reported = usdFor(mainTokens);
  } else {
    const target = scenario === 'overshoot' ? budget + (Number(arg) || 0) : budget * HAPPY_SHARE;
    const total = tokensFor(target);
    subTokens = Math.floor(total / 5);
    mainTokens = total - subTokens;
    reported = usdFor(total);
  }
  let m1Tokens = Math.floor(mainTokens / 2);
  let m2Tokens = mainTokens - m1Tokens;
  if (scenario === 'slow') {
    // The partial message carries $0.02 of the total so a killed run's transcript has a known price.
    m1Tokens = Math.min(mainTokens, tokensFor(SLOW_PARTIAL_USD));
    m2Tokens = mainTokens - m1Tokens;
  }
  const m1 = message('msg-1', model, m1Tokens, [{ type: 'text', text: 'Looking.' }, S.toolUse('toolu-1', 'Read', { file_path: path.join(process.cwd(), 'README.md') })]);
  const m2 = message('msg-2', model, m2Tokens, [{ type: 'text', text: 'VERDICT: pass' }]);
  const sub = message('msg-sub-1', model, subTokens, [{ type: 'text', text: 'Subagent findings.' }]);

  const finish = () => {
    const denyTarget = readOpt('.fake-deny-target');
    let denials = [];
    if (scenario === 'deny_inside') {
      denials = [{ tool_name: 'Read', tool_use_id: 'toolu-deny-1', tool_input: { file_path: path.join(process.cwd(), 'secret.txt') } }];
    } else if (scenario === 'deny_outside') {
      denials = [{ tool_name: 'Read', tool_use_id: 'toolu-deny-1', tool_input: { file_path: denyTarget || '/nonexistent' } }];
    }
    if (scenario !== 'slow') tr.main(m1);
    tr.main(m2);
    if (subTokens > 0) tr.sub(sub);
    const cost = Math.round(reported * 1e6) / 1e6;
    const budgetStop = scenario === 'overshoot';
    out([
      scenario === 'slow' ? [] : streamMessage(m1, sessionId),
      streamMessage(m2, sessionId),
      S.resultEvent({
        subtype: budgetStop ? 'error_max_budget_usd' : 'success',
        is_error: budgetStop,
        total_cost_usd: cost,
        usage: S.usage({ output: m1Tokens + m2Tokens }),
        modelUsage: { [model]: S.modelUsageRow({ id: model, output: m1Tokens + m2Tokens + subTokens, cost }) },
        num_turns: 2,
        session_id: sessionId,
        result: budgetStop ? 'Reached maximum budget' : 'VERDICT: pass',
        terminal_reason: budgetStop ? 'budget' : 'completed',
        permission_denials: denials,
      }),
    ]);
  };

  if (scenario === 'slow') {
    const parts = String(arg || '').split(':');
    const ms = Number(parts[0]) || 0;
    const silent = parts[1] === 'silent';
    out([init]);
    if (!silent) {
      tr.main(m1);
      out([streamMessage(m1, sessionId)]);
    }
    setTimeout(() => {
      if (silent) {
        tr.main(m1);
        out([streamMessage(m1, sessionId)]);
      }
      finish();
    }, ms);
    return;
  }
  out([init]);
  finish();
}

if (require.main === module) main();

module.exports = { TEST_RATES, TEST_RATE_OUTPUT, TOKENS_PER_USD, HAPPY_SHARE, SLOW_PARTIAL_USD, SUBAGENT_REPORTED_USD, PINS, WRONG_TOOLS, projectKey, parseArgs };
