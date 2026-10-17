'use strict';
/**
 * The objective-81 batch runner (TRD 81-08): one batch's runs, one at a time, each a headless `claude -p` in its own
 * sandbox, under the $100 ledger. Tested through scripts/eval81/run.test.cjs with a fake claude; README.md is the
 * operator's guide.
 *
 * runBatch(opts, deps) -> Promise<{code, message, report}>. Exit codes (EXIT): 0 complete (or nothing pending, or
 * --stop-after reached), 2 usage / order / ledger / deny-root refusal, 3 budget stop, 4 paused on a rate or usage
 * limit, 5 tripwire or isolation breach, 6 harness error. The library never calls process.exit; run.cjs sets the code.
 *
 * Order of work for a live batch:
 *   ledger (load; create only with --init-ledger, refused once any results/<X>.json exists) -> batch status (a
 *   stopped batch runs again only with --reopen --reason) -> order (A, B, D, E, C) -> batch module and descriptors
 *   (validated) -> plugin dirs from R/trees.json -> deny roots (refuse when R, a tree or a plugin dir lies under one)
 *   -> token -> tripwire snapshot -> per pending run: canStart (refuse = skipped_budget, exit 3) -> fresh sandbox ->
 *   runtime pre-mirror -> materialize -> settings.json + argv.json -> spawn (stdin /dev/null, allowlisted env, timeout
 *   SIGTERM then SIGKILL) -> parse stream -> copy transcripts -> transcriptCost -> isolation proof -> permission
 *   denials -> tools check -> collect -> charge max(reported, transcript) -> record.json -> secret scan -> tripwire
 *   compare; any breach stops the batch.
 * A dry run does everything up to argv.json (materialising per --materialize), never reads the token (stat only),
 * never spawns, never charges and never changes a batch status.
 *
 * Every line written to the log, stderr, record.json or argv.json goes through secret.redact.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { BATCHES, validateDescriptor, round6 } = require('./contract.cjs');
const ledgerLib = require('./ledger.cjs');
const { parseStream, transcriptCost } = require('./result.cjs');
const { readToken, childEnv, redact, scanForSecret } = require('./secret.cjs');
const { basePromptUsd } = require('./caps.cjs');
const { makeSandbox, mirrorRuntime, copyTranscripts, moveAside } = require('./sandbox.cjs');
const { buildArgv, buildSettings, denyRoots, underDenyRoot } = require('./command.cjs');
const tripwire = require('./tripwire.cjs');
const { loadRates } = require('../../../plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs');

const EXIT = Object.freeze({ OK: 0, USAGE: 2, BUDGET: 3, PAUSED: 4, BREACH: 5, HARNESS: 6 });
// Waits in-process only while the reset is within 15 minutes: 60 s, 120 s, 240 s, 480 s or until reset + 30 s,
// whichever is later, at most 4 waits and 15 minutes in all; otherwise exit 4 with resume_after.
const RATE_LIMIT = Object.freeze({ maxWaits: 4, maxTotalMs: 15 * 60 * 1000, backoffMs: [60000, 120000, 240000, 480000], afterResetMs: 30000 });
const KILL_GRACE_MS = 10000;
// Core tools an agent must NOT see unless it declares them (MCP wildcards are ignored).
const CORE_OPTIONAL_TOOLS = ['Edit', 'Write', 'WebFetch', 'WebSearch', 'NotebookEdit'];
const RESULT_BATCHES = ['A', 'B', 'D', 'E', 'C'];
const LOCK_FILE = '.runner.lock';
const DRY_TOKEN = 'dry-run-token-never-read';
const OBJECTIVE_RESULTS = path.join('.aoforge', 'objectives', '81-haiku-eval-and-model-efficiency-measurement', 'results');

class RunnerExit extends Error {
  constructor(code, message) {
    super(message);
    this.exitCode = code;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const iso = (ms) => new Date(ms).toISOString();

function forms(p) {
  const out = [path.resolve(p)];
  try {
    const real = fs.realpathSync(p);
    if (!out.includes(real)) out.push(real);
  } catch {}
  return out;
}

function insideAny(p, dirs) {
  const targets = forms(p);
  for (const d of dirs) {
    if (!d) continue;
    for (const dir of forms(d)) {
      if (targets.some((t) => t === dir || t.startsWith(`${dir}${path.sep}`))) return true;
    }
  }
  return false;
}

function writeJson(file, value, token = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${redact(JSON.stringify(value, null, 2), token)}\n`);
}

function readJsonOrExit(file, what, code = EXIT.USAGE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    throw new RunnerExit(code, `cannot read ${what} ${file}: ${err.code || err.message}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Context, log and lock
// ---------------------------------------------------------------------------------------------------------------

function context(opts, deps) {
  const root = path.resolve(opts.root);
  return {
    opts,
    root,
    ledgerPath: path.join(root, 'ledger.json'),
    realHome: opts.realHome ? path.resolve(opts.realHome) : os.userInfo().homedir,
    sleep: deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    now: deps.now || (() => Date.now()),
    killGraceMs: Number.isFinite(deps.killGraceMs) ? deps.killGraceMs : KILL_GRACE_MS,
    parentEnv: deps.parentEnv || process.env,
    stderrFn: deps.stderr || ((s) => process.stderr.write(s)),
    token: '',
    logFile: null,
    roots: [],
    report: {},
  };
}

function log(ctx, msg) {
  const line = redact(msg, ctx.token);
  if (ctx.logFile) {
    fs.mkdirSync(path.dirname(ctx.logFile), { recursive: true });
    fs.appendFileSync(ctx.logFile, `[${iso(ctx.now())}] ${line}\n`);
  }
  ctx.stderrFn(`${line}\n`);
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** One runner per eval root: the ledger and the rate limit both assume runs happen one at a time. */
function acquireLock(root, what) {
  const file = path.join(root, LOCK_FILE);
  const body = JSON.stringify({ pid: process.pid, batch: what, started_at: new Date().toISOString() });
  for (let i = 0; i < 2; i += 1) {
    try {
      fs.writeFileSync(file, body, { flag: 'wx' });
      return { file, body };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let held = null;
      try {
        held = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {}
      if (held && Number.isInteger(held.pid) && pidAlive(held.pid)) {
        throw new RunnerExit(EXIT.USAGE, `another runner (pid ${held.pid}, batch ${held.batch}) holds ${file}; runs are sequential: wait for it, and remove the lock only if that process is gone`);
      }
      fs.rmSync(file, { force: true });
    }
  }
  throw new RunnerExit(EXIT.USAGE, `cannot take the runner lock ${file}`);
}

function releaseLock(lock) {
  try {
    if (fs.readFileSync(lock.file, 'utf-8') === lock.body) fs.rmSync(lock.file, { force: true });
  } catch {}
}

// ---------------------------------------------------------------------------------------------------------------
// Ledger, queue, trees, batch module
// ---------------------------------------------------------------------------------------------------------------

function loadLedgerOrExit(file, create) {
  try {
    return ledgerLib.loadLedger(file, { create });
  } catch (err) {
    throw new RunnerExit(EXIT.USAGE, err.message);
  }
}

function existingResults(dir) {
  return RESULT_BATCHES.map((b) => path.join(dir, `${b}.json`)).filter((f) => fs.existsSync(f));
}

function ledgerSummary(ctx, l, batch) {
  const b = batch ? l.batches[batch] : null;
  return {
    path: ctx.ledgerPath,
    total_usd: ledgerLib.totalUsd(l),
    cap_usd: l.cap_usd,
    batch_status: b ? b.status : null,
    batch_spent_usd: b ? b.spent_usd : null,
    batch_cap_usd: b ? b.cap_usd : null,
    batch_estimate_usd: b ? b.estimate_usd : null,
  };
}

function stopBatch(ctx, l, batch, reason) {
  ledgerLib.setBatchStatus(l, batch, 'stopped');
  l.batches[batch].stop_reason = reason;
  l.batches[batch].stopped_at = iso(ctx.now());
  ledgerLib.saveLedger(ctx.ledgerPath, l);
}

function queuePath(ctx, batch) {
  return path.join(ctx.root, 'queue', `${batch}.json`);
}

function readQueue(ctx, batch) {
  const file = queuePath(ctx, batch);
  const q = fs.existsSync(file) ? readJsonOrExit(file, 'queue file') : {};
  return {
    batch,
    done: Array.isArray(q.done) ? q.done : [],
    attempts: isPlainObject(q.attempts) ? q.attempts : {},
    resume_after: isPlainObject(q.resume_after) ? q.resume_after : null,
    updated_at: q.updated_at || null,
  };
}

function saveQueue(ctx, queue) {
  queue.updated_at = iso(ctx.now());
  writeJson(queuePath(ctx, queue.batch), queue, ctx.token);
}

function readTrees(root) {
  const file = path.join(root, 'trees.json');
  if (!fs.existsSync(file)) return {};
  const trees = readJsonOrExit(file, 'trees file');
  if (!isPlainObject(trees)) throw new RunnerExit(EXIT.USAGE, `trees file ${file} must be an object of {version: {ref, sha, path}}`);
  return trees;
}

function pluginDirFor(trees, plugin) {
  const t = trees[plugin];
  if (!isPlainObject(t) || typeof t.path !== 'string' || !path.isAbsolute(t.path)) {
    throw new RunnerExit(EXIT.USAGE, `trees.json has no "${plugin}" tree with an absolute path; create the trees with sandbox.ensureTrees (TRD 81-13) or copy trees.json from another root`);
  }
  const dir = path.join(t.path, 'plugins', 'aoforge');
  if (!fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json'))) {
    throw new RunnerExit(EXIT.USAGE, `plugin dir ${dir} (tree "${plugin}") has no .claude-plugin/plugin.json`);
  }
  return dir;
}

const agentName = (agent) => (agent.includes(':') ? agent.slice(agent.indexOf(':') + 1) : agent);

/** The agent's declared non-MCP tools, or null when its file declares none (an agent with no `tools:` gets all). */
function agentDeclaredTools(pluginDir, agent) {
  const text = fs.readFileSync(path.join(pluginDir, 'agents', `${agentName(agent)}.md`), 'utf-8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const line = fm && /^tools:\s*(.*)$/m.exec(fm[1]);
  if (!line) return null;
  return line[1].split(',').map((t) => t.trim()).filter((t) => t && !t.startsWith('mcp__'));
}

function readCalibration(file) {
  if (!fs.existsSync(file)) return null;
  return readJsonOrExit(file, 'calibration (read only)');
}

function loadBatchModule(batchDir, batch) {
  const dir = path.resolve(batchDir || path.join(__dirname, '..', 'batches'));
  const file = path.join(dir, `${batch}.cjs`);
  if (!fs.existsSync(file)) throw new RunnerExit(EXIT.HARNESS, `batch module not found: ${file} (TRDs 81-09..81-12)`);
  let mod;
  try {
    mod = require(file);
  } catch (err) {
    throw new RunnerExit(EXIT.HARNESS, `cannot load batch module ${file}: ${err.message}`);
  }
  if (!isPlainObject(mod) || mod.batch !== batch) throw new RunnerExit(EXIT.HARNESS, `batch module ${file} must export batch: '${batch}'`);
  for (const fn of ['runs', 'materialize', 'collect']) {
    if (typeof mod[fn] !== 'function') throw new RunnerExit(EXIT.HARNESS, `batch module ${file} must export ${fn}()`);
  }
  return mod;
}

async function planRuns(mod, batch, args) {
  let descs;
  try {
    descs = await mod.runs(args);
  } catch (err) {
    throw new RunnerExit(EXIT.HARNESS, `batch ${batch} runs() threw: ${err.message}`);
  }
  if (!Array.isArray(descs)) throw new RunnerExit(EXIT.HARNESS, `batch ${batch} runs() must return an array of RunDescriptors`);
  const errors = [];
  const ids = new Set();
  descs.forEach((d, i) => {
    const v = validateDescriptor(d);
    if (!v.ok) errors.push(`run ${i} (${d && d.id}): ${v.errors.join('; ')}`);
    else if (d.batch !== batch) errors.push(`run ${d.id}: batch ${d.batch} in batch ${batch}`);
    else if (ids.has(d.id)) errors.push(`run ${d.id}: duplicate id`);
    else ids.add(d.id);
  });
  if (errors.length) throw new RunnerExit(EXIT.HARNESS, `batch ${batch} returned invalid descriptors: ${errors.slice(0, 5).join(' | ')}`);
  return descs.map((d, i) => ({ d, i })).sort((a, b) => a.d.order - b.d.order || a.i - b.i).map((x) => x.d);
}

function watchedRepos(mod, root) {
  if (typeof mod.needsWatchedRepos !== 'function') return [];
  const list = mod.needsWatchedRepos(root);
  if (!Array.isArray(list) || !list.every((w) => isPlainObject(w) && typeof w.label === 'string' && w.label && typeof w.path === 'string' && path.isAbsolute(w.path))) {
    throw new RunnerExit(EXIT.HARNESS, `batch ${mod.batch} needsWatchedRepos() must return [{label, path}] with absolute paths`);
  }
  return list;
}

/** Ids already finished for this batch: the queue's done list plus the ledger's charged final runs. */
function doneIds(l, batch, queue) {
  const done = new Set(queue.done);
  for (const e of l.entries) {
    if (e.batch === batch && !String(e.id).includes('@') && !['rate_limited', 'lost_root'].includes(e.status)) done.add(e.id);
  }
  return done;
}

// ---------------------------------------------------------------------------------------------------------------
// Per-run pieces
// ---------------------------------------------------------------------------------------------------------------

function resolveBin(bin) {
  if (bin.startsWith('node:')) return { cmd: process.execPath, pre: [path.resolve(bin.slice('node:'.length))] };
  if (bin.includes('/') || bin.includes(path.sep)) return { cmd: path.resolve(bin), pre: [] };
  return { cmd: bin, pre: [] };
}

/** Spawn one run. stdin is /dev/null ('ignore'), stdout and stderr go straight to files. Never rejects. */
function spawnRun({ bin, args, cwd, env, streamPath, stderrPath, timeoutMs, killGraceMs }) {
  return new Promise((resolve) => {
    const { cmd, pre } = resolveBin(bin);
    const outFd = fs.openSync(streamPath, 'w');
    const errFd = fs.openSync(stderrPath, 'w');
    let child;
    try {
      child = spawn(cmd, [...pre, ...args], { cwd, env, stdio: ['ignore', outFd, errFd] });
    } catch (err) {
      fs.closeSync(outFd);
      fs.closeSync(errFd);
      resolve({ error: err });
      return;
    }
    fs.closeSync(outFd);
    fs.closeSync(errFd);
    let settled = false;
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {}
      }, killGraceMs);
    }, timeoutMs);
    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve(value);
    };
    child.on('error', (err) => settle({ error: err }));
    child.on('close', (code, signal) => settle({ code, signal, timedOut }));
  });
}

function hasInitEvent(text) {
  return String(text).split('\n').some((line) => {
    if (!line.includes('"init"')) return false;
    try {
      const e = JSON.parse(line);
      return e.type === 'system' && e.subtype === 'init';
    } catch {
      return false;
    }
  });
}

/**
 * The first-run tools check for agent runs: every tool the agent declares (or `--tools` names) is in the init event,
 * and none of Edit, Write, WebFetch, WebSearch, NotebookEdit appears unless declared.
 */
function checkTools(desc, initTools, pluginDir) {
  let expected;
  let source;
  if (Array.isArray(desc.tools)) {
    expected = desc.tools;
    source = '--tools';
  } else {
    if (!pluginDir) return { ok: true, skipped: 'no plugin dir' };
    expected = agentDeclaredTools(pluginDir, desc.agent);
    source = path.join(pluginDir, 'agents', `${agentName(desc.agent)}.md`);
    if (expected === null) return { ok: true, skipped: 'the agent declares no tools list', source };
  }
  const missing = expected.filter((t) => !initTools.includes(t));
  const unexpected = CORE_OPTIONAL_TOOLS.filter((t) => !expected.includes(t) && initTools.includes(t));
  return { ok: missing.length === 0 && unexpected.length === 0, expected, missing, unexpected, source };
}

/** Absolute paths named in permission denials, split into inside the sandbox/trees and under a deny root. */
function classifyDenials(denials, { insideDirs, roots }) {
  const paths = [];
  const collect = (v, depth) => {
    if (depth > 4) return;
    if (typeof v === 'string') {
      if (path.isAbsolute(v)) paths.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => collect(x, depth + 1));
    else if (isPlainObject(v)) Object.values(v).forEach((x) => collect(x, depth + 1));
  };
  for (const d of Array.isArray(denials) ? denials : []) collect(isPlainObject(d) ? d.tool_input : null, 0);
  const inside = [];
  const escape = [];
  for (const p of paths) {
    if (insideAny(p, insideDirs)) inside.push(p);
    else if (underDenyRoot(p, roots)) escape.push(p);
  }
  return { inside, escape };
}

function describeDiff(d) {
  if (d.what === 'file') return `${d.label} changed`;
  if (d.what === 'projects') {
    const added = (d.after || []).filter((n) => !(d.before || []).includes(n));
    return `real projects entries changed (new: ${added.join(', ') || 'none'})`;
  }
  return `${d.what} of watched repo ${d.label} changed`;
}

// The base-prompt share of a cap in the dry-run projection is priced at the real rates (model-rates.json), never the
// test-only --rates, because it projects real money.
let realRates;
function basePromptShare(desc) {
  try {
    if (realRates === undefined) {
      const loaded = loadRates();
      realRates = loaded.ok ? loaded : null;
    }
    if (!realRates) return null;
    return basePromptUsd({ model: desc.model, kind: desc.kind, rates: realRates });
  } catch {
    return null;
  }
}

async function prepare(ctx, plan, desc, sb, pluginDir) {
  if (pluginDir) {
    try {
      mirrorRuntime({ pluginDir, home: sb.home });
    } catch (err) {
      throw new RunnerExit(EXIT.HARNESS, `run ${desc.id}: ${err.message}`);
    }
  }
  try {
    await plan.mod.materialize(desc, sb.work, { root: ctx.root, trees: plan.trees, home: sb.home });
  } catch (err) {
    throw new RunnerExit(EXIT.HARNESS, `run ${desc.id}: materialize threw: ${err.message}`);
  }
}

/** settings.json and the redacted argv.json; returns the argv and the child env. */
function writeCommandFiles(ctx, desc, sb, pluginDir, token) {
  const settingsPath = path.join(sb.runDir, 'settings.json');
  writeJson(settingsPath, buildSettings(ctx.roots), ctx.token);
  const args = buildArgv(desc, { pluginDirs: pluginDir ? [pluginDir] : [], settingsPath });
  const env = childEnv({ home: sb.home, configDir: sb.configDir, tmpdir: sb.tmp, token, extra: desc.env, parentEnv: ctx.parentEnv });
  // The env is shown with the token value redacted (the dry run's placeholder too), so argv.json never holds it.
  writeJson(path.join(sb.runDir, 'argv.json'), {
    bin: ctx.opts.claudeBin,
    args,
    cwd: sb.work,
    stdin: '/dev/null',
    timeout_ms: desc.timeoutMs,
    env: JSON.parse(redact(JSON.stringify(env), token)),
  }, ctx.token);
  return { args, env };
}

function tripwireSpec(ctx, watched) {
  const claude = path.join(ctx.realHome, '.claude');
  return {
    repos: [{ label: 'checkout', path: ctx.opts.repo }, ...watched.map((w) => ({ label: w.label, path: w.path }))],
    files: [
      path.join(claude, 'settings.json'),
      path.join(claude, 'CLAUDE.md'),
      path.join(claude, 'aoforge', '.plugin-version'),
      path.join(claude, 'aoforge', 'calibration.json'),
    ],
    projects: { realHome: ctx.realHome, roots: [ctx.root] },
  };
}

function runSummary(rec) {
  return {
    id: rec.id,
    status: rec.status,
    attempt: rec.attempt === undefined ? null : rec.attempt,
    model: rec.model,
    model_ran: rec.model_ran === undefined ? null : rec.model_ran,
    cost_usd: rec.cost_usd === undefined ? null : rec.cost_usd,
    transcript_cost_usd: rec.transcript_cost_usd === undefined ? null : rec.transcript_cost_usd,
    charged_usd: rec.charged_usd === undefined ? null : rec.charged_usd,
    cost_source: rec.cost_source || null,
    cap_usd: rec.cap_usd,
    reserve_usd: rec.reserve_usd,
    overshoot_usd: rec.overshoot_usd === undefined ? null : rec.overshoot_usd,
    escape_attempt: rec.escape_attempt === undefined ? null : rec.escape_attempt,
    isolation: rec.isolation || null,
    reason: rec.reason || null,
    basis: rec.basis || null,
    run_dir: rec.run_dir,
  };
}

/** After the child exited: parse, price, prove isolation, check denials and tools, collect, charge, scan, compare. */
async function finishRun(ctx, plan, desc, sb, pluginDir, start, proc, attempt, startedAt, finishedAt) {
  const { l, batch } = plan;
  const streamText = fs.existsSync(sb.streamPath) ? fs.readFileSync(sb.streamPath, 'utf-8') : '';
  const parsed = parseStream(streamText, { requestedModel: desc.model });
  const transcriptsDir = path.join(sb.runDir, 'transcripts');
  copyTranscripts(sb.configDir, transcriptsDir);
  const tc = transcriptCost(transcriptsDir, { rates: ctx.rates });
  let status = proc.timedOut ? 'timeout' : parsed.status;
  const problems = [];

  const isolation = tripwire.isolationCheck({ realHome: ctx.realHome, configDir: sb.configDir, workDir: sb.work, root: ctx.root });
  const expectSession = ['ok', 'error', 'cap_hit'].includes(parsed.status) || parsed.assistant_messages > 0;
  const newReal = isolation.real_entries_under_root.filter((n) => !(plan.before.projects || []).includes(n));
  const breach = [];
  if (isolation.real_project) breach.push(`a real projects entry exists for the work dir (${tripwire.projectKey(sb.work)})`);
  if (newReal.length) breach.push(`new real projects entries under the eval root: ${newReal.join(', ')}`);
  if (expectSession && !isolation.sandbox_project) breach.push('the session left no project dir under the sandbox CLAUDE_CONFIG_DIR');
  if (breach.length) problems.push({ code: EXIT.BREACH, message: `isolation breach on ${desc.id} (${sb.runDir}): ${breach.join('; ')}` });

  const treeDirs = Object.values(plan.trees).filter((t) => isPlainObject(t) && typeof t.path === 'string').map((t) => t.path);
  const den = classifyDenials(parsed.permission_denials, { insideDirs: [sb.runDir, pluginDir, ...treeDirs], roots: ctx.roots });
  if (den.inside.length) {
    status = 'harness_error';
    problems.push({ code: EXIT.HARNESS, message: `run ${desc.id}: the deny list blocked a path the agent needs (${den.inside.join(', ')}); fix the deny roots before resuming` });
  }

  let toolsCheck = null;
  if (desc.kind === 'agent' && hasInitEvent(streamText)) {
    toolsCheck = checkTools(desc, parsed.init_tools, pluginDir);
    if (!toolsCheck.ok) {
      status = 'harness_error';
      problems.push({ code: EXIT.HARNESS, message: `run ${desc.id}: the init event's tools do not match ${desc.agent} (missing: ${toolsCheck.missing.join(', ') || 'none'}; unexpected: ${toolsCheck.unexpected.join(', ') || 'none'}), so --agent did not take` });
    }
  }

  let outputs = null;
  let collectError = null;
  if (status !== 'rate_limited') {
    try {
      const got = await plan.mod.collect(desc, sb.work, { root: ctx.root, home: sb.home, record: { ...parsed, status } });
      outputs = got === undefined ? null : got;
    } catch (err) {
      collectError = err.message;
    }
    writeJson(path.join(sb.runDir, 'outputs', 'outputs.json'), outputs, ctx.token);
  }

  const record = {
    id: desc.id,
    batch,
    role: desc.role === undefined ? null : desc.role,
    kind: desc.kind,
    agent: desc.agent === undefined ? null : desc.agent,
    model: desc.model,
    plugin: desc.plugin,
    requested_model_id: parsed.requested_model_id,
    status,
    attempt,
    cost_usd: parsed.cost_usd,
    transcript_cost_usd: tc.cost_usd,
    transcript_unpriced: tc.unpriced.messages,
    transcript_files: tc.files,
    cap_usd: desc.capUsd,
    cap_basis: desc.capBasis === undefined ? null : desc.capBasis,
    reserve_usd: start.reserve,
    reserve_basis: start.reserve_basis,
    charged_usd: null,
    cost_source: null,
    overshoot_usd: null,
    ledger_id: status === 'rate_limited' ? `${desc.id}@attempt${attempt}` : desc.id,
    usage: parsed.usage,
    usage_source: parsed.usage_source,
    first_turn_input: parsed.first_turn_input,
    model_usage: parsed.model_usage,
    model_ran: parsed.model_ran,
    model_share: parsed.model_share,
    side_models: parsed.side_models,
    duration_ms: parsed.duration_ms,
    wall_ms: finishedAt - startedAt,
    num_turns: parsed.num_turns,
    session_id: parsed.session_id,
    init_tools: parsed.init_tools,
    tools_check: toolsCheck,
    permission_denials: parsed.permission_denials,
    escape_attempt: den.escape.length > 0,
    escape_paths: den.escape,
    denied_inside: den.inside,
    isolation,
    structured_output: parsed.structured_output,
    result_text: parsed.result_text,
    terminal_reason: parsed.terminal_reason,
    reset_epoch: parsed.reset_epoch,
    claude_version: parsed.claude_version,
    exit_code: proc.code === undefined ? null : proc.code,
    signal: proc.signal || null,
    timed_out: Boolean(proc.timedOut),
    started_at: iso(startedAt),
    finished_at: iso(finishedAt),
    run_dir: sb.runDir,
    outputs,
    collect_error: collectError,
    error: null,
  };
  const charge = { ...record, id: record.ledger_id };
  const money = ledgerLib.chargeFor(l, charge);
  record.charged_usd = money.charged_usd;
  record.cost_source = money.cost_source;
  record.overshoot_usd = money.overshoot_usd;
  writeJson(path.join(sb.runDir, 'record.json'), record, ctx.token);
  ledgerLib.recordRun(l, { ...record, id: record.ledger_id });
  ledgerLib.saveLedger(ctx.ledgerPath, l);
  log(ctx, `run ${desc.id} attempt ${attempt}: ${status}, charged $${record.charged_usd} (${record.cost_source}; reported ${record.cost_usd}, transcript ${record.transcript_cost_usd}), ledger total $${ledgerLib.totalUsd(l)}`);

  const hits = scanForSecret(sb.runDir, ctx.token);
  if (hits.length) {
    problems.push({ code: EXIT.HARNESS, message: `the token was found in ${sb.runDir} (${hits.slice(0, 5).join(', ')}); keep that run dir on this machine and delete or redact it before resuming` });
  }

  const after = tripwire.snapshot(plan.spec);
  writeJson(path.join(ctx.root, 'tripwire', `${batch}-after.json`), after, ctx.token);
  const diffs = tripwire.diffSnapshots(plan.before, after);
  plan.diffs = diffs;
  if (diffs.length) problems.push({ code: EXIT.BREACH, message: `tripwire: ${diffs.map(describeDiff).join('; ')}` });
  return { record, problems };
}

/** One pending run to a final record (rate-limited attempts are charged and retried or paused). */
async function runOne(ctx, plan, desc) {
  const { l, batch, queue } = plan;
  const pluginDir = desc.plugin ? pluginDirFor(plan.trees, desc.plugin) : null;
  let waits = 0;
  let waitedMs = 0;
  let spawned = false;
  for (;;) {
    const start = ledgerLib.canStart(l, { batch, role: desc.role, capUsd: desc.capUsd });
    if (!start.ok) {
      const limit = start.reason === 'global_cap' ? `$${l.cap_usd}` : `batch ${batch} cap $${l.batches[batch].cap_usd}`;
      const basis = start.reason === 'global_cap'
        ? `total ${start.total} + reserve ${start.reserve} (${start.reserve_basis}) = ${start.projected} > ${limit}`
        : `batch spent ${l.batches[batch].spent_usd} + cap ${start.cap} > ${limit}`;
      const runDir = path.join(ctx.root, 'runs', batch, desc.id);
      moveAside(runDir);
      const record = {
        id: desc.id, batch, role: desc.role === undefined ? null : desc.role, model: desc.model, plugin: desc.plugin,
        status: 'skipped_budget', reason: start.reason, basis, cap_usd: desc.capUsd, reserve_usd: start.reserve,
        reserve_basis: start.reserve_basis, ledger_total_usd: start.total, run_dir: runDir, at: iso(ctx.now()),
      };
      writeJson(path.join(runDir, 'record.json'), record, ctx.token);
      log(ctx, `run ${desc.id}: budget stop (${start.reason}): ${basis}`);
      return {
        code: EXIT.BUDGET,
        spawned,
        record,
        message: `budget stop before ${desc.id} (${start.reason}): ${basis}; nothing spawned. The batch stays ${l.batches[batch].status}; the user decides (re-run the same command after a decision, or --close-batch ${batch} --reason <text>)`,
      };
    }

    const attempt = (Number(queue.attempts[desc.id]) || 0) + 1;
    queue.attempts[desc.id] = attempt;
    saveQueue(ctx, queue);
    const sb = makeSandbox({ root: ctx.root, batch, id: desc.id });
    sb.streamPath = path.join(sb.runDir, 'stream.jsonl');
    await prepare(ctx, plan, desc, sb, pluginDir);
    const { args, env } = writeCommandFiles(ctx, desc, sb, pluginDir, ctx.token);
    log(ctx, `run ${desc.id} attempt ${attempt}: ${desc.model}, cap $${desc.capUsd}, reserve $${start.reserve}, ${sb.runDir}`);
    const startedAt = ctx.now();
    const proc = await spawnRun({
      bin: ctx.opts.claudeBin, args, cwd: sb.work, env, streamPath: sb.streamPath,
      stderrPath: path.join(sb.runDir, 'stderr.txt'), timeoutMs: desc.timeoutMs, killGraceMs: ctx.killGraceMs,
    });
    const finishedAt = ctx.now();
    if (proc.error) {
      queue.attempts[desc.id] = attempt - 1;
      saveQueue(ctx, queue);
      const record = { id: desc.id, batch, status: 'harness_error', error: `spawn failed: ${proc.error.code || proc.error.message}`, charged_usd: 0, run_dir: sb.runDir };
      writeJson(path.join(sb.runDir, 'record.json'), record, ctx.token);
      return { code: EXIT.HARNESS, spawned, record, message: `run ${desc.id}: could not start ${ctx.opts.claudeBin} (${proc.error.code || proc.error.message}); nothing ran and nothing was charged` };
    }
    spawned = true;
    const { record, problems } = await finishRun(ctx, plan, desc, sb, pluginDir, start, proc, attempt, startedAt, finishedAt);
    if (record.status !== 'rate_limited') {
      if (!queue.done.includes(desc.id)) queue.done.push(desc.id);
      saveQueue(ctx, queue);
    }
    if (problems.length) {
      const code = problems.some((p) => p.code === EXIT.BREACH) ? EXIT.BREACH : EXIT.HARNESS;
      const message = problems.map((p) => p.message).join(' | ');
      stopBatch(ctx, l, batch, message.slice(0, 500));
      return { code, spawned, record, message: `${message}. Batch ${batch} is stopped; it resumes only with --reopen --reason <text> on the user's word` };
    }
    if (record.status !== 'rate_limited') return { code: EXIT.OK, spawned, record };

    // Rate or usage limit: wait in-process only within 15 minutes, never in a tight loop.
    const nowMs = ctx.now();
    const resetMs = Number.isInteger(record.reset_epoch) ? record.reset_epoch * 1000 : null;
    const pause = (resumeMs, why) => {
      const ra = { epoch: Math.ceil(resumeMs / 1000), iso: iso(resumeMs), id: desc.id, reason: why };
      queue.resume_after = ra;
      saveQueue(ctx, queue);
      ctx.report.resume_after = ra;
      log(ctx, `batch ${batch} paused until ${ra.iso}: ${why}`);
      return { code: EXIT.PAUSED, spawned, record, message: `batch ${batch} paused: ${why}; run the same command after ${ra.iso} (${desc.id} stays pending)` };
    };
    if (resetMs !== null && resetMs - nowMs > RATE_LIMIT.maxTotalMs) {
      return pause(resetMs + RATE_LIMIT.afterResetMs, `the usage limit resets at ${iso(resetMs)}, more than 15 minutes away`);
    }
    const backoff = RATE_LIMIT.backoffMs[Math.min(waits, RATE_LIMIT.backoffMs.length - 1)];
    const wait = Math.max(backoff, resetMs !== null ? resetMs - nowMs + RATE_LIMIT.afterResetMs : 0);
    if (waits >= RATE_LIMIT.maxWaits || waitedMs + wait > RATE_LIMIT.maxTotalMs) {
      return pause(nowMs + wait, `rate limited ${waits + 1} time(s) on ${desc.id}; waiting in-process would pass 15 minutes`);
    }
    log(ctx, `run ${desc.id}: rate limited on attempt ${attempt}; waiting ${Math.round(wait / 1000)} s before attempt ${attempt + 1}`);
    await ctx.sleep(wait);
    waits += 1;
    waitedMs += wait;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------------------------------------------

async function plan(ctx) {
  const { opts } = ctx;
  const batch = opts.batch;
  const dry = Boolean(opts.dryRun);
  const resultsDir = path.resolve(opts.resultsDir);

  let l;
  if (opts.initLedger) {
    const found = existingResults(resultsDir);
    if (found.length) {
      throw new RunnerExit(EXIT.USAGE, `--init-ledger refused: ${found[0]} exists, so spend was already committed; rebuild the ledger with --rebuild-ledger --root ${ctx.root} --results-dir ${resultsDir} instead`);
    }
    const created = !fs.existsSync(ctx.ledgerPath);
    l = loadLedgerOrExit(ctx.ledgerPath, true);
    if (created) ledgerLib.saveLedger(ctx.ledgerPath, l);
  } else {
    if (!fs.existsSync(ctx.ledgerPath)) {
      throw new RunnerExit(EXIT.USAGE, `ledger not found at ${ctx.ledgerPath}; pass --init-ledger only for the first batch, or --rebuild-ledger --results-dir <dir> if the eval root was lost`);
    }
    l = loadLedgerOrExit(ctx.ledgerPath, false);
  }
  ctx.report.ledger = ledgerSummary(ctx, l, batch);

  const row = l.batches[batch];
  if (row.status === 'stopped' && !dry && !opts.reopen) {
    throw new RunnerExit(EXIT.USAGE, `batch ${batch} is stopped${row.stop_reason ? ` (${row.stop_reason})` : ''}; it runs again only with --reopen --reason <text>, on the user's word`);
  }
  const order = { ok: true, message: null };
  try {
    ledgerLib.assertOrder(l, batch);
  } catch (err) {
    order.ok = false;
    order.message = err.message;
  }
  ctx.report.order = order;
  if (!order.ok && !dry) throw new RunnerExit(EXIT.USAGE, order.message);

  const mod = loadBatchModule(opts.batchDir, batch);
  const trees = readTrees(ctx.root);
  const calibration = readCalibration(opts.calibration ? path.resolve(opts.calibration) : path.join(ctx.realHome, '.claude', 'aoforge', 'calibration.json'));
  const descs = await planRuns(mod, batch, { root: ctx.root, trees, calibration });

  const used = [...new Set(descs.map((d) => d.plugin).filter((p) => p !== null))];
  const pluginDirs = Object.fromEntries(used.map((p) => [p, pluginDirFor(trees, p)]));
  for (const d of descs) {
    if (d.kind !== 'agent' || d.plugin === null) continue;
    const file = path.join(pluginDirs[d.plugin], 'agents', `${agentName(d.agent)}.md`);
    if (!fs.existsSync(file)) throw new RunnerExit(EXIT.HARNESS, `run ${d.id}: agent ${d.agent} not found at ${file}`);
  }

  const watched = watchedRepos(mod, ctx.root);
  ctx.roots = denyRoots({ repo: opts.repo, realHome: ctx.realHome, watched: watched.map((w) => w.path) });
  const inputs = [['eval root', ctx.root]];
  for (const p of used) inputs.push([`tree ${p}`, trees[p].path], [`plugin dir ${p}`, pluginDirs[p]]);
  for (const [what, p] of inputs) {
    for (const form of forms(p)) {
      const r = underDenyRoot(form, ctx.roots);
      if (r) throw new RunnerExit(EXIT.USAGE, `${what} ${p} lies under the deny root ${r}, so the agent could not read its own inputs; move it outside ${r}`);
    }
  }

  const queue = readQueue(ctx, batch);
  const done = doneIds(l, batch, queue);
  const pending = descs.filter((d) => !done.has(d.id));
  return { l, batch, mod, trees, descs, pending, done, queue, watched, pluginDirs };
}

async function dryRun(ctx, p) {
  const { opts } = ctx;
  const { l, batch, pending, descs } = p;
  let tokenPresent = false;
  try {
    const st = fs.statSync(opts.tokenFile);
    tokenPresent = st.isFile() && st.size > 0;
  } catch {}
  const planned = [];
  let worst = 0;
  let caps = 0;
  let base = 0;
  for (const [i, d] of pending.entries()) {
    const start = ledgerLib.canStart(l, { batch, role: d.role, capUsd: d.capUsd });
    const sb = makeSandbox({ root: ctx.root, batch, id: d.id });
    const pluginDir = d.plugin ? p.pluginDirs[d.plugin] : null;
    const materialized = opts.materialize === 'all' || (opts.materialize === 'first' && i === 0);
    if (materialized) await prepare(ctx, p, d, sb, pluginDir);
    writeCommandFiles(ctx, d, sb, pluginDir, DRY_TOKEN);
    const basePrompt = basePromptShare(d);
    const entry = {
      id: d.id,
      order: d.order,
      kind: d.kind,
      agent: d.agent === undefined ? null : d.agent,
      model: d.model,
      plugin: d.plugin,
      role: d.role === undefined ? null : d.role,
      cap_usd: d.capUsd,
      cap_basis: d.capBasis === undefined ? null : d.capBasis,
      reserve_usd: start.reserve,
      reserve_basis: start.reserve_basis,
      base_prompt_usd: basePrompt,
      would_fit: start.ok,
      refusal: start.reason,
      timeout_ms: d.timeoutMs,
      materialized,
      run_dir: sb.runDir,
    };
    writeJson(path.join(sb.runDir, 'record.json'), { ...entry, batch, status: 'dry_run' }, ctx.token);
    planned.push(entry);
    worst += start.reserve;
    caps += d.capUsd;
    if (basePrompt !== null) base += basePrompt;
  }
  const total = ledgerLib.totalUsd(l);
  const row = l.batches[batch];
  Object.assign(ctx.report, {
    token_file: opts.tokenFile,
    token_file_present: tokenPresent,
    materialize: opts.materialize,
    runs_total: descs.length,
    runs_done: descs.length - pending.length,
    planned,
    sum_caps_usd: round6(caps),
    worst_case_usd: round6(worst),
    base_prompt_usd: round6(base),
    estimate_usd: row.estimate_usd,
    worst_case_total_usd: round6(total + worst),
    projected_total_usd: round6(total + row.estimate_usd),
    caps_exceed_batch_cap: row.cap_usd !== null && round6(row.spent_usd + caps) > row.cap_usd,
  });
  return {
    code: EXIT.OK,
    message: `dry run of batch ${batch}: ${planned.length} planned run(s), caps $${round6(caps)}, worst case (sum of reserves) $${round6(worst)}, estimate $${row.estimate_usd}, ledger total $${total}; nothing spawned`,
  };
}

async function live(ctx, p) {
  const { opts } = ctx;
  const { l, batch, queue } = p;
  try {
    ctx.token = readToken(opts.tokenFile);
  } catch (err) {
    throw new RunnerExit(EXIT.USAGE, err.message);
  }
  const rates = opts.rates ? loadRates(path.resolve(opts.rates)) : loadRates();
  if (!rates.ok) throw new RunnerExit(EXIT.USAGE, rates.error);
  ctx.rates = rates;
  ctx.logFile = path.join(ctx.root, 'queue', `${batch}.log`);

  const finishReport = (extra = {}) => {
    const remaining = p.descs.filter((d) => !queue.done.includes(d.id) && !p.done.has(d.id)).map((d) => d.id);
    Object.assign(ctx.report, {
      ledger: ledgerSummary(ctx, l, batch),
      ran: p.ran || [],
      runs: p.runs || [],
      pending: remaining,
      tripwire: { diffs: p.diffs || [] },
      resume_after: queue.resume_after,
      ...extra,
    });
    return remaining;
  };

  if (queue.resume_after) {
    if (ctx.now() < queue.resume_after.epoch * 1000) {
      finishReport();
      throw new RunnerExit(EXIT.PAUSED, `batch ${batch} is paused until ${queue.resume_after.iso} (${queue.resume_after.reason}); run the same command after that time`);
    }
    log(ctx, `batch ${batch}: resume time ${queue.resume_after.iso} passed; resuming`);
    queue.resume_after = null;
    saveQueue(ctx, queue);
  }

  if (p.pending.length === 0) {
    if (l.batches[batch].status !== 'complete') {
      ledgerLib.setBatchStatus(l, batch, 'complete');
      ledgerLib.saveLedger(ctx.ledgerPath, l);
    }
    finishReport({ reopened: false });
    return { code: EXIT.OK, message: `batch ${batch}: nothing pending; status complete` };
  }

  p.spec = tripwireSpec(ctx, p.watched);
  p.before = tripwire.snapshot(p.spec);
  writeJson(path.join(ctx.root, 'tripwire', `${batch}-before.json`), p.before, ctx.token);

  const prev = l.batches[batch].status;
  ctx.report.reopened = prev === 'complete' || prev === 'stopped';
  if (prev === 'stopped') {
    l.batches[batch].reopen_reason = opts.reason;
    l.batches[batch].reopened_at = iso(ctx.now());
  }
  if (prev !== 'running') {
    ledgerLib.setBatchStatus(l, batch, 'running');
    ledgerLib.saveLedger(ctx.ledgerPath, l);
  }
  log(ctx, `batch ${batch}: ${p.pending.length} pending run(s)${ctx.report.reopened ? ` (reopened from ${prev})` : ''}; ledger total $${ledgerLib.totalUsd(l)}`);

  p.ran = [];
  p.runs = [];
  let spawnedRuns = 0;
  for (const d of p.pending) {
    if (opts.stopAfter !== null && opts.stopAfter !== undefined && spawnedRuns >= opts.stopAfter) {
      const remaining = finishReport({ stopped_early: true });
      return { code: EXIT.OK, message: `batch ${batch}: stopped after ${spawnedRuns} run(s) (--stop-after); ${remaining.length} pending, status running` };
    }
    const res = await runOne(ctx, p, d);
    if (res.record) p.runs.push(runSummary(res.record));
    if (res.spawned) spawnedRuns += 1;
    if (res.code === EXIT.OK) p.ran.push(d.id);
    if (res.code !== EXIT.OK) {
      finishReport();
      return { code: res.code, message: res.message };
    }
  }
  const remaining = finishReport();
  if (remaining.length === 0) {
    ledgerLib.setBatchStatus(l, batch, 'complete');
    ledgerLib.saveLedger(ctx.ledgerPath, l);
    ctx.report.ledger = ledgerSummary(ctx, l, batch);
  }
  return {
    code: EXIT.OK,
    message: `batch ${batch}: ${p.ran.length} run(s) finished; batch spent $${l.batches[batch].spent_usd}, ledger total $${ledgerLib.totalUsd(l)}; status ${l.batches[batch].status}`,
  };
}

function rebuild(ctx) {
  const { opts } = ctx;
  const resultsDir = path.resolve(opts.resultsDir);
  ctx.report = { mode: 'rebuild_ledger', root: ctx.root, results_dir: resultsDir };
  if (fs.existsSync(ctx.ledgerPath)) {
    throw new RunnerExit(EXIT.USAGE, `ledger exists at ${ctx.ledgerPath}; --rebuild-ledger never overwrites live spend (use a fresh --root)`);
  }
  const files = existingResults(resultsDir);
  if (files.length === 0) {
    throw new RunnerExit(EXIT.USAGE, `no results/<X>.json in ${resultsDir} to rebuild from; a first batch starts with --init-ledger`);
  }
  const blocks = files.map((f) => {
    const j = readJsonOrExit(f, 'results file');
    if (!isPlainObject(j) || !isPlainObject(j.spend)) throw new RunnerExit(EXIT.USAGE, `${f} has no spend block`);
    return j.spend;
  });
  let l;
  try {
    l = ledgerLib.rebuildLedger(blocks);
    for (const { batch, usd } of opts.chargeLost || []) ledgerLib.chargeLost(l, batch, usd);
  } catch (err) {
    throw new RunnerExit(EXIT.USAGE, err.message);
  }
  ledgerLib.saveLedger(ctx.ledgerPath, l);
  Object.assign(ctx.report, {
    ledger: ctx.ledgerPath,
    rebuilt_from: l.rebuilt_from,
    charged_lost: (opts.chargeLost || []).map(({ batch, usd }) => ({ id: `${batch}-lost-root`, batch, usd })),
    total_usd: ledgerLib.totalUsd(l),
    batches: Object.fromEntries(Object.entries(l.batches).map(([b, r]) => [b, { status: r.status, spent_usd: r.spent_usd }])),
  });
  return { code: EXIT.OK, message: `ledger rebuilt at ${ctx.ledgerPath} from ${l.rebuilt_from.join(', ')}: total $${ledgerLib.totalUsd(l)}` };
}

function closeBatch(ctx) {
  const { opts } = ctx;
  const batch = opts.closeBatch;
  ctx.report = { mode: 'close_batch', batch, root: ctx.root };
  if (!BATCHES.includes(batch)) throw new RunnerExit(EXIT.USAGE, `--close-batch: unknown batch ${batch}`);
  if (typeof opts.reason !== 'string' || opts.reason.trim() === '') throw new RunnerExit(EXIT.USAGE, '--close-batch needs --reason <text>');
  if (!fs.existsSync(ctx.ledgerPath)) throw new RunnerExit(EXIT.USAGE, `ledger not found at ${ctx.ledgerPath}`);
  const l = loadLedgerOrExit(ctx.ledgerPath, false);
  const prev = l.batches[batch].status;
  ctx.report.previous_status = prev;
  if (prev === 'complete') throw new RunnerExit(EXIT.USAGE, `batch ${batch} is complete; there is nothing to close`);
  stopBatch(ctx, l, batch, opts.reason);
  ctx.report.ledger = ledgerSummary(ctx, l, batch);
  ctx.report.reason = opts.reason;
  return { code: EXIT.OK, message: `batch ${batch} stopped (was ${prev}): ${opts.reason}` };
}

function validateOpts(opts) {
  if (!isPlainObject(opts)) throw new RunnerExit(EXIT.USAGE, 'runBatch: opts must be an object');
  if (typeof opts.root !== 'string' || opts.root === '') throw new RunnerExit(EXIT.USAGE, '--root is required');
  if (opts.rebuildLedger) {
    if (typeof opts.resultsDir !== 'string') throw new RunnerExit(EXIT.USAGE, '--rebuild-ledger needs --results-dir');
    return;
  }
  if (opts.chargeLost && opts.chargeLost.length) throw new RunnerExit(EXIT.USAGE, '--charge-lost goes with --rebuild-ledger only');
  if (opts.closeBatch) return;
  if (!BATCHES.includes(opts.batch)) throw new RunnerExit(EXIT.USAGE, `--batch must be one of ${BATCHES.join(', ')}`);
  for (const key of ['tokenFile', 'repo', 'resultsDir', 'claudeBin']) {
    if (typeof opts[key] !== 'string' || opts[key] === '') throw new RunnerExit(EXIT.USAGE, `runBatch: ${key} is required`);
  }
  if (!path.isAbsolute(opts.repo)) throw new RunnerExit(EXIT.USAGE, `--repo must be an absolute path (got ${opts.repo})`);
  if (!['none', 'first', 'all'].includes(opts.materialize)) throw new RunnerExit(EXIT.USAGE, '--materialize must be none, first or all');
  if (opts.reopen && (typeof opts.reason !== 'string' || opts.reason.trim() === '')) {
    throw new RunnerExit(EXIT.USAGE, '--reopen needs --reason <text> (the user\'s word)');
  }
}

/**
 * Run one runner command.
 * @param {object} opts  parsed CLI options (run.cjs parseArgs)
 * @param {{sleep?, now?, killGraceMs?, parentEnv?, stderr?}} [deps]  injectables for tests
 * @returns {Promise<{code: number, message: string, report: object}>}  message and report are redacted
 */
async function runBatch(opts, deps = {}) {
  const merged = { materialize: 'first', claudeBin: 'claude', stopAfter: null, chargeLost: [] };
  for (const [key, value] of Object.entries(isPlainObject(opts) ? opts : {})) if (value !== undefined) merged[key] = value;
  const ctx = context(merged, deps);
  const finish = ({ code, message }) => {
    const report = { ...ctx.report, exit_code: code, message };
    return { code, message: redact(message, ctx.token), report: JSON.parse(redact(JSON.stringify(report), ctx.token)) };
  };
  let lock = null;
  try {
    validateOpts(ctx.opts);
    fs.mkdirSync(ctx.root, { recursive: true });
    lock = acquireLock(ctx.root, ctx.opts.batch || ctx.opts.closeBatch || 'rebuild');
    if (ctx.opts.rebuildLedger) return finish(rebuild(ctx));
    if (ctx.opts.closeBatch) return finish(closeBatch(ctx));
    ctx.report = { mode: ctx.opts.dryRun ? 'dry_run' : 'live', batch: ctx.opts.batch, root: ctx.root };
    const p = await plan(ctx);
    return finish(ctx.opts.dryRun ? await dryRun(ctx, p) : await live(ctx, p));
  } catch (err) {
    if (err instanceof RunnerExit) return finish({ code: err.exitCode, message: err.message });
    return finish({ code: EXIT.HARNESS, message: `harness error: ${err.message}` });
  } finally {
    if (lock) releaseLock(lock);
  }
}

module.exports = {
  EXIT,
  RATE_LIMIT,
  KILL_GRACE_MS,
  CORE_OPTIONAL_TOOLS,
  OBJECTIVE_RESULTS,
  runBatch,
  checkTools,
  classifyDenials,
  resolveBin,
};
