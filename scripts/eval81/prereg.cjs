#!/usr/bin/env node
'use strict';

// Objective-81 pre-registration manifest (TRD 81-13).
//
//   node scripts/eval81/prereg.cjs --write --out <dir> [--extra <file>]... [--calibration <file>] [--trees <file>]
//        [--claude-version <text>] [--projection <file>] [--include <glob>]... [--exclude <glob>]... [--keep <glob>]...
//        [--repo <checkout>]
//   node scripts/eval81/prereg.cjs --check --manifest <file> [--repo <checkout>] [--raw]
//
// --write hashes (sha256 of the bytes) every file the include globs select, sorted by repo-relative posix path, plus
// each extra named file, and writes `<out>/prereg-manifest.json`:
//   {version, created_at, head, trees, claude_version, calibration_sha256, projection, command, argv,
//    includes, excludes, keep, extras, files: {path: sha256}}
// A file is selected when it matches an include and either matches no exclude or matches a keep glob. The defaults
// freeze the harness (`scripts/eval81/**`), the decision rule and the committed static-prompt results E's scorer
// falls back to; they leave out unit tests (`**/*.test.cjs`) and the fake claude binary, but keep the five fixture
// proofs (`scripts/eval81/fixtures/*/proofs.test.cjs`), which are the evidence that each answer key is right.
// `--include` replaces the default includes (likewise `--exclude`, `--keep`); the effective lists are recorded so
// --check re-walks exactly the same set.
//
// Include globs must stay inside the repo (an absolute glob or one with a `..` segment is refused, exit 2). A file
// outside the repo can only be named as an extra (`--extra`, `--calibration`): the private fleet checklist and the
// real calibration.json. Extras are read, never written. Only their sha256 enters the manifest, never their
// contents. An extra is recorded by its repo-relative path, else as `~/<path>` under the home, else absolute.
// `--trees` reads an eval root's trees.json and keeps {ref, sha} per version (the scratch paths are dropped).
// `--projection` embeds a JSON file verbatim. `command` is the exact argv, shell-quoted, so a pre-run amendment can
// regenerate the manifest by re-running it from the repo root.
//
// --check re-walks the recorded globs and re-hashes the recorded extras. It exits 0 when nothing changed, and exits 1
// with one `changed: <path>`, `added: <path>` or `missing: <path>` line per difference. A missing or malformed
// manifest is exit 2. Walks skip `.git` directories and `.DS_Store` files. Nothing here makes a network or API call.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const OBJ = '.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement';
const DEFAULT_INCLUDES = ['scripts/eval81/**', `${OBJ}/81-DECISION-RULE.md`, `${OBJ}/results/static-prompt.json`];
const DEFAULT_EXCLUDES = ['**/*.test.cjs', 'scripts/eval81/__fixtures__/fake-claude.cjs'];
const DEFAULT_KEEP = ['scripts/eval81/fixtures/*/proofs.test.cjs'];
const MANIFEST_NAME = 'prereg-manifest.json';
const MANIFEST_VERSION = 1;
const SCRIPT_REL = 'scripts/eval81/prereg.cjs';
const SKIP_DIRS = new Set(['.git']);
const SKIP_FILES = new Set(['.DS_Store']);
const USAGE = [
  'usage: node scripts/eval81/prereg.cjs --write --out <dir> [--extra <file>]... [--calibration <file>] [--trees <file>]',
  '         [--claude-version <text>] [--projection <file>] [--include <glob>]... [--exclude <glob>]... [--keep <glob>]...',
  '         [--repo <checkout>]',
  '       node scripts/eval81/prereg.cjs --check --manifest <file> [--repo <checkout>] [--raw]',
].join('\n');

class UsageError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const toPosix = (p) => p.split(path.sep).join('/');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------------------------------------------------------
// Globs
// ---------------------------------------------------------------------------------------------------------------

/** A posix glob as an anchored RegExp: `**` spans any number of segments (including none), `*` and `?` stay inside one. */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const slashAfter = glob[i + 2] === '/';
      re += slashAfter ? '(?:.*/)?' : '.*';
      i += slashAfter ? 2 : 1;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/** The directory part of a glob before its first wildcard segment ('' for the repo root). */
function literalPrefix(glob) {
  const segs = glob.split('/');
  const out = [];
  for (const s of segs) {
    if (/[*?[]/.test(s)) break;
    out.push(s);
  }
  return out.join('/');
}

/** Refuse a glob that could select anything outside the repo. */
function assertInsideRepo(glob) {
  if (typeof glob !== 'string' || glob === '') throw new UsageError('an include glob must be a non-empty string');
  if (path.isAbsolute(glob) || glob.split(/[\\/]/).includes('..')) {
    throw new UsageError(`include ${glob} lies outside the repo; a file outside the repo can only be named with --extra or --calibration`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Walking and hashing
// ---------------------------------------------------------------------------------------------------------------

function hashFile(abs) {
  const st = fs.lstatSync(abs);
  if (st.isSymbolicLink()) return sha256(Buffer.from(`symlink:${fs.readlinkSync(abs)}`));
  return sha256(fs.readFileSync(abs));
}

function walkDir(repo, relDir, out) {
  const abs = path.join(repo, relDir);
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walkDir(repo, rel, out);
    } else if (!SKIP_FILES.has(ent.name)) {
      out.add(rel);
    }
  }
}

/**
 * The repo files the globs select: match an include, and match no exclude unless a keep glob matches.
 * @returns {Object<string, string>}  repo-relative posix path -> sha256, keys sorted
 */
function selectFiles(repo, { includes, excludes, keep }) {
  for (const g of includes) assertInsideRepo(g);
  const inc = includes.map(globToRegExp);
  const exc = excludes.map(globToRegExp);
  const kp = keep.map(globToRegExp);
  const candidates = new Set();
  for (const g of includes) {
    const prefix = literalPrefix(g);
    const abs = path.join(repo, prefix);
    const rel = path.relative(repo, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new UsageError(`include ${g} lies outside the repo`);
    let st = null;
    try {
      st = fs.statSync(abs);
    } catch {}
    if (!st) continue;
    if (st.isDirectory()) walkDir(repo, toPosix(rel), candidates);
    else candidates.add(toPosix(rel));
  }
  const files = {};
  for (const rel of [...candidates].sort()) {
    if (!inc.some((re) => re.test(rel))) continue;
    if (exc.some((re) => re.test(rel)) && !kp.some((re) => re.test(rel))) continue;
    files[rel] = hashFile(path.join(repo, rel));
  }
  return files;
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** How an extra is recorded: repo-relative, else ~/ under the home, else absolute. */
function extraLabel(abs, repo, home) {
  if (isInside(repo, abs)) return toPosix(path.relative(repo, abs));
  if (home && isInside(home, abs)) return `~/${toPosix(path.relative(home, abs))}`;
  return abs;
}

/** The absolute path a recorded extra label names. */
function extraPath(label, repo, home) {
  if (label.startsWith('~/')) return path.join(home, label.slice(2));
  if (path.isAbsolute(label)) return label;
  return path.join(repo, label);
}

function hashExtra(abs, flag) {
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw new UsageError(`${flag} ${abs} does not exist; an extra must be a readable file (it is hashed, never copied)`);
  }
  if (!st.isFile()) throw new UsageError(`${flag} ${abs} is not a file`);
  return sha256(fs.readFileSync(abs));
}

// ---------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------

const VALUE_FLAGS = {
  '--out': 'out',
  '--manifest': 'manifest',
  '--trees': 'trees',
  '--claude-version': 'claudeVersion',
  '--projection': 'projection',
  '--repo': 'repo',
};
const LIST_FLAGS = { '--include': 'include', '--exclude': 'exclude', '--keep': 'keep' };

function parseArgs(argv) {
  const o = { write: false, check: false, raw: false, include: [], exclude: [], keep: [], extras: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--write') o.write = true;
    else if (a === '--check') o.check = true;
    else if (a === '--raw') o.raw = true;
    else if (a === '--extra') o.extras.push({ flag: '--extra', file: value() });
    else if (a === '--calibration') {
      if (o.calibration !== undefined) throw new UsageError('--calibration is given twice');
      o.calibration = value();
      o.extras.push({ flag: '--calibration', file: o.calibration });
    } else if (VALUE_FLAGS[a]) o[VALUE_FLAGS[a]] = value();
    else if (LIST_FLAGS[a]) o[LIST_FLAGS[a]].push(value());
    else throw new UsageError(`unknown argument ${a}`);
  }
  if (o.write === o.check) throw new UsageError('give exactly one of --write or --check');
  if (o.write && !o.out) throw new UsageError('--write needs --out <dir>');
  if (o.check && !o.manifest) throw new UsageError('--check needs --manifest <file>');
  return o;
}

function shellQuote(s) {
  return /^[A-Za-z0-9_\-.,/:=@%+]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`;
}

function repoRoot(opts, cwd) {
  if (opts.repo) return path.resolve(cwd, opts.repo);
  try {
    return cp.execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return cwd;
  }
}

function gitHead(repo) {
  try {
    return cp.execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function readJson(abs, what) {
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    throw new UsageError(`${what} ${abs} does not exist`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new UsageError(`${what} ${abs} is not valid JSON (${err.message})`);
  }
}

function readTrees(abs) {
  const t = readJson(abs, '--trees');
  if (!isObj(t)) throw new UsageError(`--trees ${abs} must map version -> {ref, sha}`);
  const out = {};
  for (const version of Object.keys(t).sort()) {
    const row = t[version];
    if (!isObj(row) || typeof row.sha !== 'string') throw new UsageError(`--trees ${abs}: ${version} has no sha`);
    out[version] = { ref: typeof row.ref === 'string' ? row.ref : null, sha: row.sha };
  }
  return out;
}

function doWrite(opts, argv, { cwd, home, now, stdout }) {
  const repo = repoRoot(opts, cwd);
  const includes = opts.include.length ? opts.include : [...DEFAULT_INCLUDES];
  const excludes = opts.exclude.length ? opts.exclude : [...DEFAULT_EXCLUDES];
  const keep = opts.keep.length ? opts.keep : [...DEFAULT_KEEP];
  const files = selectFiles(repo, { includes, excludes, keep });

  const extras = [];
  let calibrationSha = null;
  for (const { flag, file } of opts.extras) {
    const abs = path.resolve(cwd, file);
    const digest = hashExtra(abs, flag);
    const label = extraLabel(abs, repo, home);
    if (!extras.includes(label)) extras.push(label);
    files[label] = digest;
    if (flag === '--calibration') calibrationSha = digest;
  }
  const trees = opts.trees ? readTrees(path.resolve(cwd, opts.trees)) : null;
  const projection = opts.projection ? readJson(path.resolve(cwd, opts.projection), '--projection') : null;

  const sorted = {};
  for (const k of Object.keys(files).sort()) sorted[k] = files[k];
  const manifest = {
    version: MANIFEST_VERSION,
    created_at: now().toISOString(),
    head: gitHead(repo),
    trees,
    claude_version: opts.claudeVersion === undefined ? null : opts.claudeVersion,
    calibration_sha256: calibrationSha,
    projection,
    command: ['node', SCRIPT_REL, ...argv].map(shellQuote).join(' '),
    argv: [...argv],
    includes,
    excludes,
    keep,
    extras,
    files: sorted,
  };
  const outDir = path.resolve(cwd, opts.out);
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, MANIFEST_NAME);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(target, text);
  stdout.write(`prereg write: ${Object.keys(sorted).length} files (${extras.length} extra) -> ${toPosix(path.relative(cwd, target)) || target}, manifest sha256 ${sha256(Buffer.from(text))}\n`);
  return 0;
}

function doCheck(opts, { cwd, home, stdout }) {
  const repo = repoRoot(opts, cwd);
  const manifestAbs = path.resolve(cwd, opts.manifest);
  const m = readJson(manifestAbs, '--manifest');
  if (!isObj(m) || !isObj(m.files) || !Array.isArray(m.includes) || !Array.isArray(m.excludes) || !Array.isArray(m.keep) || !Array.isArray(m.extras)) {
    throw new UsageError(`--manifest ${manifestAbs} is not a prereg manifest (needs files, includes, excludes, keep, extras)`);
  }
  const current = selectFiles(repo, { includes: m.includes, excludes: m.excludes, keep: m.keep });
  const extras = new Set(m.extras);
  const changed = [];
  const added = [];
  const missing = [];
  for (const [p, digest] of Object.entries(m.files)) {
    if (extras.has(p)) continue;
    if (!(p in current)) missing.push(p);
    else if (current[p] !== digest) changed.push(p);
  }
  for (const p of Object.keys(current)) if (!(p in m.files) && !extras.has(p)) added.push(p);
  for (const label of m.extras) {
    const abs = extraPath(label, repo, home);
    let digest = null;
    try {
      if (fs.statSync(abs).isFile()) digest = sha256(fs.readFileSync(abs));
    } catch {}
    if (digest === null) missing.push(label);
    else if (digest !== m.files[label]) changed.push(label);
  }
  const ok = changed.length + added.length + missing.length === 0;
  const manifestSha = sha256(fs.readFileSync(manifestAbs));
  if (opts.raw) {
    stdout.write(`${JSON.stringify({ ok, manifest_sha256: manifestSha, files: Object.keys(m.files).length, changed, added, missing }, null, 2)}\n`);
  } else {
    for (const p of changed) stdout.write(`changed: ${p}\n`);
    for (const p of added) stdout.write(`added: ${p}\n`);
    for (const p of missing) stdout.write(`missing: ${p}\n`);
    stdout.write(ok
      ? `prereg check: OK, ${Object.keys(m.files).length} files match the manifest (sha256 ${manifestSha})\n`
      : `prereg check: FAILED, ${changed.length} changed, ${added.length} added, ${missing.length} missing against the manifest (sha256 ${manifestSha})\n`);
  }
  return ok ? 0 : 1;
}

/**
 * Run the CLI.
 * @param {string[]} argv
 * @param {{cwd?: string, home?: string, stdout?, stderr?, now?: () => Date}} [deps]
 * @returns {Promise<number>} 0 ok, 1 check found differences, 2 usage or refusal
 */
async function main(argv, deps = {}) {
  const ctx = {
    cwd: deps.cwd || process.cwd(),
    home: deps.home || os.homedir(),
    stdout: deps.stdout || process.stdout,
    stderr: deps.stderr || process.stderr,
    now: deps.now || (() => new Date()),
  };
  try {
    const opts = parseArgs(argv);
    return opts.write ? doWrite(opts, argv, ctx) : doCheck(opts, ctx);
  } catch (err) {
    if (err instanceof UsageError) {
      ctx.stderr.write(`prereg: ${err.message}\n${USAGE}\n`);
      return 2;
    }
    ctx.stderr.write(`prereg: ${err.stack || err.message}\n`);
    return 2;
  }
}

module.exports = {
  DEFAULT_INCLUDES,
  DEFAULT_EXCLUDES,
  DEFAULT_KEEP,
  MANIFEST_NAME,
  globToRegExp,
  literalPrefix,
  selectFiles,
  main,
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
