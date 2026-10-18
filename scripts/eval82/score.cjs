#!/usr/bin/env node
'use strict';

// Scoring CLI for objective 82's batches (TRD 82-05).
//
//   node scripts/eval82/score.cjs --batch D|E|C --root <eval root> --out <objective dir>
//        [--e81 <81 results/E.json>] [--home-parent <dir>] [--real-home <dir>]
//
// Loads `scripts/eval82/score/<X>.cjs` (C arrives with TRD 82-06), reads `<root>/ledger.json` with objective 81's
// frozen loader first (results without spend are never written; a missing ledger exits 1 with nothing written), calls
// the scorer's `score({root, outDir, now, ...})` and writes under --out:
//   results/<X>.json  the result + `scored_at` + the spend block (objective 81's score.cjs spendBlock, so 81's
//                     rebuildLedger can read it back)
//   results/<X>.md    the scorer's renderResults(saved), else objective 81's generic renderBatchTable
//   extra_files       e.g. 82-MEASUREMENT.md for E; an absolute path or a `..` segment is refused before any write
// Deterministic for the same inputs and clock (`main(argv, {now})`). No API call; writes only under --out.

const fs = require('node:fs');
const path = require('node:path');

const ledgerLib = require('../eval81/lib/ledger.cjs');
const { spendBlock } = require('../eval81/score.cjs');
const { renderBatchTable } = require('../eval81/lib/report.cjs');

const BATCHES = ['C', 'D', 'E'];
const USAGE = 'usage: node scripts/eval82/score.cjs --batch D|E|C --root <eval root> --out <objective dir> [--e81 <E.json>] [--home-parent <dir>] [--real-home <dir>]';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

class UsageError extends Error {}

function parseArgs(argv) {
  const takes = { '--batch': 'batch', '--root': 'root', '--out': 'out', '--e81': 'e81Path', '--home-parent': 'homeParent', '--real-home': 'realHome' };
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!takes[arg]) throw new UsageError(`unknown argument ${arg}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`);
    opts[takes[arg]] = value;
    i += 1;
  }
  if (!opts.batch || !opts.root || !opts.out) throw new UsageError('--batch, --root and --out are required');
  if (!BATCHES.includes(opts.batch)) throw new UsageError(`unknown batch ${opts.batch}; objective 82 batches: ${BATCHES.join(', ')}`);
  return opts;
}

function checkExtraFiles(extra, out, reserved) {
  if (extra === undefined || extra === null) return [];
  if (!isObj(extra)) throw new Error('extra_files must be an object of {"<relative path>": "<text>"}');
  const root = path.resolve(out);
  return Object.entries(extra).map(([rel, text]) => {
    if (rel.length === 0 || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error(`extra_files: refused path ${JSON.stringify(rel)}`);
    if (typeof text !== 'string') throw new Error(`extra_files: ${rel} is not text`);
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep) || reserved.includes(abs)) throw new Error(`extra_files: ${rel} is outside --out or overwrites a file this CLI writes`);
    return [abs, text];
  });
}

async function runBatch(opts, { stdout, now, scorerOpts }) {
  const { batch } = opts;
  const scorer = path.join(__dirname, 'score', `${batch}.cjs`);
  if (!fs.existsSync(scorer)) throw new Error(`scorer for batch ${batch} not installed: ${scorer}`);
  const root = path.resolve(opts.root);
  const out = path.resolve(opts.out);
  const ledgerPath = path.join(root, 'ledger.json');
  let ledger;
  try {
    if (!fs.existsSync(ledgerPath)) throw new Error(`ledger not found: ${ledgerPath} (objective 82 creates it with node scripts/eval82/ledger82.cjs --init --root <R>)`);
    ledger = ledgerLib.loadLedger(ledgerPath);
  } catch (err) {
    throw new Error(`${err.message}; nothing written (results without spend are never committed)`);
  }
  const spend = spendBlock(ledger, batch, ledgerPath);

  const mod = require(scorer);
  const flagOpts = {};
  for (const k of ['e81Path', 'homeParent', 'realHome']) if (opts[k]) flagOpts[k] = k === 'e81Path' ? path.resolve(opts[k]) : opts[k];
  const result = await mod.score({ root, outDir: out, now, ...flagOpts, ...scorerOpts });
  if (!isObj(result) || result.batch !== batch) throw new Error(`scorer for batch ${batch} returned no batch ${batch} result`);

  const resultsDir = path.join(out, 'results');
  const jsonPath = path.join(resultsDir, `${batch}.json`);
  const mdPath = path.join(resultsDir, `${batch}.md`);
  const { extra_files: extraFiles, ...rest } = result;
  const extras = checkExtraFiles(extraFiles, out, [jsonPath, mdPath]);
  const saved = { ...rest, scored_at: now().toISOString(), spend };
  const md = typeof mod.renderResults === 'function' ? mod.renderResults(saved) : renderBatchTable(saved);

  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(saved, null, 2)}\n`);
  fs.writeFileSync(mdPath, md);
  for (const [abs, text] of extras) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  stdout(`${JSON.stringify({ batch, json: jsonPath, md: mdPath, extra_files: extras.map(([abs]) => abs), spent_usd: spend.spent_usd, ledger_total_usd: spend.ledger_total_usd })}\n`);
  return 0;
}

/** main(argv, deps?) -> Promise<exit code>. deps: {stdout, stderr, now, scorerOpts} (tests). */
async function main(argv, deps = {}) {
  const stdout = deps.stdout || ((s) => process.stdout.write(s));
  const stderr = deps.stderr || ((s) => process.stderr.write(s));
  const now = deps.now || (() => new Date());
  try {
    return await runBatch(parseArgs(argv), { stdout, now, scorerOpts: deps.scorerOpts || {} });
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

module.exports = { main, BATCHES };
