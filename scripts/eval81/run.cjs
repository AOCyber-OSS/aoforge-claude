#!/usr/bin/env node
'use strict';

// Runner CLI for the objective-81 eval (TRD 81-08). scripts/eval81/README.md is the full guide.
//
//   node scripts/eval81/run.cjs --batch X --root <R> --token-file <T> [--claude-bin claude] [--dry-run]
//        [--materialize none|first|all] [--stop-after N] [--init-ledger] [--reopen --reason <text>]
//        [--results-dir <dir>] [--calibration <path>] [--repo <checkout>] [--batch-dir <dir>] [--sandbox-root <dir>] [--raw]
//   node scripts/eval81/run.cjs --rebuild-ledger --root <R> [--results-dir <dir>] [--charge-lost X=<usd>]... [--raw]
//   node scripts/eval81/run.cjs --close-batch X --reason <text> --root <R> [--raw]
//
// Test-only flags (the live TRDs never pass them): --real-home <dir> (a stand-in for the real home, default
// os.userInfo().homedir) and --rates <file> (a model-rates file, default references/model-rates.json).
//
// --sandbox-root <dir> (post-hoc 3, TRD 81-17): put what each run sees (home, config dir, tmp, work, settings) and the
// plugin trees (<dir>/trees.json, sandbox.exportTrees) under an opaque directory; the runner refuses (exit 2) when any
// path handed to a run names the user or the checkout after realpath (lib/opaque.cjs).
//
// Exit codes: 0 complete, 2 usage / order / ledger, 3 budget stop, 4 paused (rate limit), 5 tripwire or isolation
// breach, 6 harness error. A dry run makes zero API calls: it never spawns the claude binary.
// `main(argv, deps)` resolves to the exit code; it never calls process.exit.

const path = require('path');
const { execFileSync } = require('child_process');
const { runBatch, EXIT, OBJECTIVE_RESULTS } = require('./lib/runner.cjs');

const USAGE = [
  'usage: node scripts/eval81/run.cjs --batch A|B|C|D|E --root <eval root> --token-file <file> [--claude-bin <bin|node:path>]',
  '         [--dry-run [--materialize none|first|all]] [--stop-after N] [--init-ledger] [--reopen --reason <text>]',
  '         [--results-dir <dir>] [--calibration <path>] [--repo <checkout>] [--batch-dir <dir>] [--sandbox-root <dir>] [--raw]',
  '       node scripts/eval81/run.cjs --rebuild-ledger --root <eval root> [--results-dir <dir>] [--charge-lost X=<usd>]... [--raw]',
  '       node scripts/eval81/run.cjs --close-batch X --reason <text> --root <eval root> [--raw]',
].join('\n');

class UsageError extends Error {}

const VALUE_FLAGS = {
  '--batch': 'batch',
  '--root': 'root',
  '--token-file': 'tokenFile',
  '--claude-bin': 'claudeBin',
  '--materialize': 'materialize',
  '--close-batch': 'closeBatch',
  '--reason': 'reason',
  '--results-dir': 'resultsDir',
  '--calibration': 'calibration',
  '--repo': 'repo',
  '--batch-dir': 'batchDir',
  '--real-home': 'realHome',
  '--rates': 'rates',
  '--sandbox-root': 'sandboxRoot',
};
const BOOL_FLAGS = {
  '--dry-run': 'dryRun',
  '--init-ledger': 'initLedger',
  '--rebuild-ledger': 'rebuildLedger',
  '--reopen': 'reopen',
  '--raw': 'raw',
};

function parseArgs(argv) {
  const o = { chargeLost: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const takeValue = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (Object.prototype.hasOwnProperty.call(VALUE_FLAGS, a)) {
      o[VALUE_FLAGS[a]] = takeValue();
    } else if (Object.prototype.hasOwnProperty.call(BOOL_FLAGS, a)) {
      o[BOOL_FLAGS[a]] = true;
    } else if (a === '--stop-after') {
      const v = takeValue();
      if (!/^\d+$/.test(v)) throw new UsageError(`--stop-after needs a whole number (got ${v})`);
      o.stopAfter = Number(v);
    } else if (a === '--charge-lost') {
      const v = takeValue();
      const m = /^([A-E])=(\d+(?:\.\d+)?)$/.exec(v);
      if (!m || Number(m[2]) <= 0) throw new UsageError(`--charge-lost needs X=<usd> with X in A-E and usd > 0 (got ${v})`);
      o.chargeLost.push({ batch: m[1], usd: Number(m[2]) });
    } else {
      throw new UsageError(`unknown argument ${a}`);
    }
  }
  if (!o.root) throw new UsageError('--root is required');
  const modes = [o.rebuildLedger, Boolean(o.closeBatch), Boolean(o.batch)].filter(Boolean).length;
  if (modes !== 1) throw new UsageError('pass exactly one of --batch X, --rebuild-ledger or --close-batch X');
  if (o.chargeLost.length && !o.rebuildLedger) throw new UsageError('--charge-lost goes with --rebuild-ledger only');
  if (o.batch) {
    if (!o.tokenFile) throw new UsageError('--token-file is required with --batch');
    if (o.materialize !== undefined && !o.dryRun) throw new UsageError('--materialize applies to --dry-run only');
  }
  return o;
}

function gitTopLevel() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new UsageError('cannot find this checkout with git rev-parse --show-toplevel; pass --repo <checkout>');
  }
}

function resolveDefaults(o) {
  const out = { ...o, root: path.resolve(o.root) };
  for (const key of ['tokenFile', 'batchDir', 'calibration', 'realHome', 'rates', 'resultsDir', 'sandboxRoot']) {
    if (out[key] !== undefined) out[key] = path.resolve(out[key]);
  }
  if (out.closeBatch) return out;
  if (out.batch || out.resultsDir === undefined) out.repo = out.repo !== undefined ? path.resolve(out.repo) : gitTopLevel();
  if (out.resultsDir === undefined) out.resultsDir = path.join(out.repo, OBJECTIVE_RESULTS);
  if (out.batch) {
    if (out.claudeBin === undefined) out.claudeBin = 'claude';
    if (out.materialize === undefined) out.materialize = 'first';
  }
  return out;
}

function human(report) {
  const lines = [`mode: ${report.mode || 'unknown'}${report.batch ? `, batch ${report.batch}` : ''}, exit ${report.exit_code}`];
  if (report.ledger && typeof report.ledger === 'object') {
    lines.push(`ledger: total $${report.ledger.total_usd}${report.ledger.batch_status ? `, batch ${report.ledger.batch_status}, spent $${report.ledger.batch_spent_usd}` : ''}`);
  }
  if (Array.isArray(report.planned)) {
    lines.push(`planned: ${report.planned.length} run(s), caps $${report.sum_caps_usd}, worst case $${report.worst_case_usd}, estimate $${report.estimate_usd}, token file present: ${report.token_file_present}`);
  }
  if (Array.isArray(report.ran)) lines.push(`ran: ${report.ran.length}, pending: ${(report.pending || []).length}`);
  if (report.resume_after) lines.push(`resume after: ${report.resume_after.iso}`);
  return `${lines.join('\n')}\n`;
}

/**
 * main(argv, deps?) -> Promise<exit code>.
 * deps (tests): {stdout(s), stderr(s), sleep(ms), now(), killGraceMs, parentEnv}.
 */
async function main(argv, deps = {}) {
  const stdout = deps.stdout || ((s) => process.stdout.write(s));
  const stderr = deps.stderr || ((s) => process.stderr.write(s));
  let opts;
  try {
    opts = resolveDefaults(parseArgs(argv));
  } catch (err) {
    stderr(`run: ${err.message}\n${err instanceof UsageError ? `${USAGE}\n` : ''}`);
    return EXIT.USAGE;
  }
  const res = await runBatch(opts, { ...deps, stderr });
  stdout(opts.raw ? `${JSON.stringify(res.report, null, 2)}\n` : human(res.report));
  stderr(`run: exit ${res.code}: ${res.message}\n`);
  return res.code;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { main, parseArgs, resolveDefaults, USAGE };
