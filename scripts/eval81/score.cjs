#!/usr/bin/env node
'use strict';

// Scoring CLI for the objective-81 Haiku eval (TRD 81-02).
//
//   node scripts/eval81/score.cjs --batch A|B|C|D|E --root <eval root> --out <objective dir> [--scorer-dir <dir>]
//   node scripts/eval81/score.cjs --report --out <objective dir>
//
// --batch X loads the batch scorer `<scorer-dir or scripts/eval81/score>/X.cjs` (TRDs 81-09..81-12), calls its
// exported `score({root, outDir})` (sync or async), and writes `<out>/results/X.json` (2-space JSON) and
// `<out>/results/X.md`. Before the scorer runs it reads `<root>/ledger.json` (TRD 81-01's ledger, read as plain JSON
// because both TRDs are wave 1): a missing or unparseable ledger exits 1 with nothing written, because results
// without spend are never committed. The saved JSON is the scorer's result plus `scored_at` and a `spend` block,
//   spend: { ledger_version, batch, status, spent_usd, ledger_total_usd, entries }
// = the batch's ledger row and its entries verbatim plus the ledger total at scoring time; 81-01's rebuildLedger
// reads exactly this block back, so losing the scratch eval root never resets spend to $0.
// A scorer may return `extra_files: {"<relative path>": "<text>"}` (batch E returns 81-MEASUREMENT.md): each is
// written under --out; an absolute path or one with a `..` segment is refused before anything is written, and
// `extra_files` is not saved in the JSON.
//
// --report reads `<out>/results/{A,B,C,D}.json` (a missing batch is rendered INSUFFICIENT "batch X not run"), runs
// decide() against this checkout's model-profiles.json and the flutter pack's aoforge-stack.json (read only), and
// writes `<out>/81-HAIKU-EVAL.md`. Batch E is rendered by its own scorer, not here.
//
// The CLI writes only under --out. It makes no API call. `main(argv, deps)` resolves to the exit code.

const fs = require('node:fs');
const path = require('node:path');

const { decide } = require('./lib/decide.cjs');
const { renderEvalReport, renderBatchTable } = require('./lib/report.cjs');
const { round9 } = require('./lib/stats.cjs');

const BATCHES = ['A', 'B', 'C', 'D', 'E'];
const REPORT_BATCHES = ['A', 'B', 'C', 'D'];
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROFILES_PATH = path.join(REPO_ROOT, 'plugins', 'aoforge', 'aoforge', 'references', 'model-profiles.json');
const PACK_PATH = path.join(REPO_ROOT, 'plugins', 'aoforge-stack-flutter', 'aoforge-stack.json');
const REPORT_NAME = '81-HAIKU-EVAL.md';
const USAGE = [
  'usage: node scripts/eval81/score.cjs --batch A|B|C|D|E --root <eval root> --out <objective dir> [--scorer-dir <dir>]',
  '       node scripts/eval81/score.cjs --report --out <objective dir>',
].join('\n');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { batch: null, report: false, root: null, out: null, scorerDir: null };
  const takes = { '--batch': 'batch', '--root': 'root', '--out': 'out', '--scorer-dir': 'scorerDir' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report') {
      opts.report = true;
    } else if (takes[arg]) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`);
      opts[takes[arg]] = value;
      i += 1;
    } else {
      throw new UsageError(`unknown argument ${arg}`);
    }
  }
  if (opts.report && opts.batch) throw new UsageError('--batch and --report cannot be combined');
  if (!opts.report && !opts.batch) throw new UsageError('one of --batch or --report is required');
  return opts;
}

/** scorerPath(batch, scorerDir?) -> the scorer module path (default scripts/eval81/score/<batch>.cjs). */
function scorerPath(batch, scorerDir) {
  return path.join(scorerDir || path.join(__dirname, 'score'), `${batch}.cjs`);
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`${what} not found: ${file} (${err.code || err.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${what} is not valid JSON: ${file}: ${err.message}`);
  }
}

/** spendBlock(ledger, batch, ledgerPath) -> the SpendBlock of TRD 81-01's contract for this batch. */
function spendBlock(ledger, batch, ledgerPath) {
  if (!isObj(ledger) || !isObj(ledger.batches) || !Array.isArray(ledger.entries)) {
    throw new Error(`ledger has no batches or entries: ${ledgerPath}`);
  }
  const row = ledger.batches[batch];
  if (!isObj(row)) throw new Error(`ledger has no batch ${batch} row: ${ledgerPath}`);
  const total = ledger.entries.reduce((sum, e) => sum + (isObj(e) && Number.isFinite(e.charged_usd) ? e.charged_usd : 0), 0);
  return {
    ledger_version: ledger.version,
    batch,
    status: row.status,
    spent_usd: row.spent_usd,
    ledger_total_usd: round9(total),
    entries: ledger.entries.filter((e) => isObj(e) && e.batch === batch),
  };
}

/** checkExtraFiles(extra, out, reserved) -> [[absolute path, text]]; throws before anything is written. */
function checkExtraFiles(extra, out, reserved) {
  if (extra === undefined || extra === null) return [];
  if (!isObj(extra)) throw new Error('extra_files must be an object of {"<relative path>": "<text>"}');
  const root = path.resolve(out);
  return Object.entries(extra).map(([rel, text]) => {
    if (rel.length === 0) throw new Error('extra_files: an empty path is refused');
    if (path.isAbsolute(rel) || path.win32.isAbsolute(rel)) throw new Error(`extra_files: absolute path refused: ${rel}`);
    if (rel.split(/[\\/]/).includes('..')) throw new Error(`extra_files: a path containing .. is refused: ${rel}`);
    if (typeof text !== 'string') throw new Error(`extra_files: ${rel} is not text`);
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) throw new Error(`extra_files: ${rel} resolves outside --out`);
    if (reserved.includes(abs)) throw new Error(`extra_files: ${rel} would overwrite a file this CLI writes`);
    return [abs, text];
  });
}

async function runBatch(opts, { stdout, now }) {
  const batch = opts.batch;
  if (!BATCHES.includes(batch)) throw new UsageError(`unknown batch ${batch}; valid batches: ${BATCHES.join(', ')}`);
  const scorer = scorerPath(batch, opts.scorerDir);
  if (!fs.existsSync(scorer)) throw new Error(`scorer for batch ${batch} not installed (TRD 81-09..81-12): ${scorer}`);
  if (!opts.root || !opts.out) throw new UsageError('--batch needs --root and --out');
  const root = path.resolve(opts.root);
  const out = path.resolve(opts.out);

  // The ledger first: results without spend are never written.
  const ledgerPath = path.join(root, 'ledger.json');
  let ledger;
  try {
    ledger = readJson(ledgerPath, 'ledger');
  } catch (err) {
    throw new Error(`${err.message}; nothing written (results without spend are never committed)`);
  }
  const spend = spendBlock(ledger, batch, ledgerPath);

  const mod = require(scorer);
  if (!mod || typeof mod.score !== 'function') throw new Error(`scorer ${scorer} does not export score({root, outDir})`);
  const result = await mod.score({ root, outDir: out });
  if (!isObj(result)) throw new Error(`scorer for batch ${batch} returned no result object`);
  if (result.batch !== undefined && result.batch !== batch) {
    throw new Error(`scorer for batch ${batch} returned batch ${result.batch}`);
  }

  const resultsDir = path.join(out, 'results');
  const jsonPath = path.join(resultsDir, `${batch}.json`);
  const mdPath = path.join(resultsDir, `${batch}.md`);
  const { extra_files: extraFiles, ...rest } = result;
  const extras = checkExtraFiles(extraFiles, out, [jsonPath, mdPath]);

  const saved = { ...(rest.batch === undefined ? { batch } : {}), ...rest, scored_at: now().toISOString(), spend };
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(saved, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderBatchTable(saved));
  for (const [abs, text] of extras) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  stdout(`${JSON.stringify({ batch, json: jsonPath, md: mdPath, extra_files: extras.map(([abs]) => abs),
    spent_usd: spend.spent_usd, ledger_total_usd: spend.ledger_total_usd })}\n`);
  return 0;
}

function runReport(opts, { stdout, now }) {
  if (!opts.out) throw new UsageError('--report needs --out');
  const out = path.resolve(opts.out);
  const results = {};
  for (const batch of REPORT_BATCHES) {
    const file = path.join(out, 'results', `${batch}.json`);
    if (fs.existsSync(file)) results[batch] = readJson(file, `results for batch ${batch}`);
  }
  const profiles = readJson(PROFILES_PATH, 'model profiles');
  const pack = readJson(PACK_PATH, 'flutter pack manifest');
  const decisions = decide({ results, profiles, packModels: isObj(pack) ? pack.models : null });
  const reportPath = path.join(out, REPORT_NAME);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(reportPath, renderEvalReport({ decisions, results, generatedAt: now().toISOString() }));
  const outcomes = Object.fromEntries(Object.entries(decisions.roles).map(([role, d]) => [role, d.outcome]));
  stdout(`${JSON.stringify({ report: reportPath, batches: Object.keys(results), outcomes })}\n`);
  return 0;
}

/** main(argv, deps?) -> Promise<exit code>. deps: {stdout(s), stderr(s), now() -> Date} for tests. */
async function main(argv, deps = {}) {
  const stdout = deps.stdout || ((s) => process.stdout.write(s));
  const stderr = deps.stderr || ((s) => process.stderr.write(s));
  const now = deps.now || (() => new Date());
  try {
    const opts = parseArgs(argv);
    return opts.report ? runReport(opts, { stdout, now }) : await runBatch(opts, { stdout, now });
  } catch (err) {
    stderr(`score: ${err.message}\n${err instanceof UsageError ? `${USAGE}\n` : ''}`);
    return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { main, scorerPath, spendBlock, BATCHES, PROFILES_PATH, PACK_PATH };
