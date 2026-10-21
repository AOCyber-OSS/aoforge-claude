#!/usr/bin/env node
'use strict';
/**
 * The transcript scan for `~` and guessed-home inputs (TRD 82-05; SC-2 of objective 82).
 *
 * Why its own scan: the frozen runner's `record.access` (scripts/eval81/lib/access.cjs scanAccess) keeps only real
 * escapes, `guessed_nonexistent` paths and DENIED `~` paths. An allowed `~` Read is not recorded at all, an allowed
 * guessed path that happens to exist is classed elsewhere, and objective 81's E records predate the field. Counting
 * `record.access` alone is therefore vacuous; this module reads the transcripts themselves.
 *
 * What it counts, per run: every Read `file_path`, Glob `path` or `pattern` and Grep `path` input of a tool_use in any
 * `*.jsonl` under the run's transcripts (subagents included), deduplicated by tool_use id (the CLI repeats a block on
 * its assistant line and again in an `api-request-blob` line), plus each permission denial whose tool_use id is absent
 * from the transcripts. Two classes:
 *   tilde         the input starts with `~`. The Read tool expands `~` (objective 81's C-res-architecture-h-2 read
 *                 both `~` files it asked for), so this is a count kept for the record, not a failure.
 *   guessed_home  the input is absolute and starts with `<home parent>/` (`/Users/` here): the agent built a home
 *                 path itself instead of using `~` or a path it was handed. This is the defect signal. A sandbox root
 *                 is never under the home parent (the runner refuses roots that name the user), so no legitimate
 *                 input of a sandboxed run starts there; a detour such as `/Users/../private/tmp/...` still counts.
 * Bash commands are not scanned: the shell expands `~` itself.
 *
 *   scanGuessedPaths({transcriptsDir, denials, homeParent, realHome}) ->
 *     {files_scanned, tool_uses_scanned, tilde, guessed_home, entries: [{id, class, tool, field, path, denied, file}]}
 *     `files_scanned: 0` means NOT SCANNED (no transcripts), never a clean zero; callers must say so.
 *   recordedAccess(record) -> {real, guessed_nonexistent, tilde_denied} counts from record.access, or null (absent)
 *   scanRun(runDir, opts) -> one CLI row: {id, ...scan counts, entries, recorded: counts | 'not_recorded'}
 *
 * Paths are redacted with the frozen redactPath (the real home becomes `<home>`, the username `<user>`).
 * The home parent defaults to the dirname of the passwd home (os.userInfo().homedir), not $HOME, so a scratch HOME
 * does not move it.
 *
 * CLI: node scripts/eval82/lib/guessed-paths.cjs --root <R> --batch <X> [--raw] [--home-parent P] [--real-home H]
 *   one row per run dir under <R>/runs/<X>/ (never *.prev-*); exit 1 with a usage line on a missing flag.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { redactPath } = require('../../eval81/lib/access.cjs');

const FIELDS = { Read: ['file_path'], Glob: ['path', 'pattern'], Grep: ['path'] };
const USAGE = 'usage: node scripts/eval82/lib/guessed-paths.cjs --root <eval root> --batch <A-E> [--raw] [--home-parent <dir>] [--real-home <dir>]';

const defaultRealHome = () => os.userInfo().homedir;
const defaultHomeParent = () => path.dirname(defaultRealHome());

function listJsonl(dir) {
  const out = [];
  const walk = (d) => {
    let ents = [];
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

function toolUses(transcriptsDir) {
  const files = transcriptsDir ? listJsonl(transcriptsDir) : [];
  const uses = [];
  const seen = new Set();
  for (const file of files) {
    const rel = path.relative(transcriptsDir, file).split(path.sep).join('/');
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
      if (!line.includes('tool_use')) continue;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      const content = ev && ev.message && Array.isArray(ev.message.content) ? ev.message.content : [];
      for (const c of content) {
        if (!c || c.type !== 'tool_use' || typeof c.id !== 'string' || seen.has(c.id)) continue;
        seen.add(c.id);
        uses.push({ id: c.id, name: c.name, input: c.input && typeof c.input === 'object' ? c.input : {}, file: rel });
      }
    }
  }
  return { files: files.length, uses };
}

function classify(value, homeParent) {
  if (typeof value !== 'string' || value === '') return null;
  if (value.startsWith('~')) return 'tilde';
  if (path.isAbsolute(value) && value.startsWith(`${homeParent}/`)) return 'guessed_home';
  return null;
}

function scanGuessedPaths({ transcriptsDir, denials = [], homeParent = defaultHomeParent(), realHome = defaultRealHome() } = {}) {
  const { files, uses } = toolUses(transcriptsDir);
  const ids = new Set(uses.map((u) => u.id));
  const denied = new Set();
  let n = 0;
  for (const d of Array.isArray(denials) ? denials : []) {
    if (!d || typeof d !== 'object') continue;
    const id = typeof d.tool_use_id === 'string' && d.tool_use_id ? d.tool_use_id : `denial-${(n += 1)}`;
    denied.add(id);
    if (!ids.has(id)) {
      ids.add(id);
      uses.push({ id, name: d.tool_name, input: d.tool_input && typeof d.tool_input === 'object' ? d.tool_input : {}, file: null });
    }
  }
  const user = realHome ? path.basename(realHome) : '';
  const tokens = user.length >= 3 ? [user] : [];
  const entries = [];
  for (const u of uses) {
    for (const field of FIELDS[u.name] || []) {
      const cls = classify(u.input[field], homeParent);
      if (!cls) continue;
      entries.push({
        id: u.id,
        class: cls,
        tool: u.name,
        field,
        path: redactPath(u.input[field], { realHome, tokens }),
        denied: denied.has(u.id),
        file: u.file,
      });
    }
  }
  return {
    files_scanned: files,
    tool_uses_scanned: uses.length,
    tilde: entries.filter((e) => e.class === 'tilde').length,
    guessed_home: entries.filter((e) => e.class === 'guessed_home').length,
    entries,
  };
}

function recordedAccess(record) {
  const a = record && typeof record === 'object' ? record.access : undefined;
  if (!a || typeof a !== 'object') return null;
  const nonEscape = Array.isArray(a.non_escape) ? a.non_escape : [];
  return {
    real: Array.isArray(a.real) ? a.real.length : 0,
    guessed_nonexistent: nonEscape.filter((e) => e && e.class === 'guessed_nonexistent').length,
    tilde_denied: nonEscape.filter((e) => e && e.class === 'tilde_denied').length,
  };
}

function readRecord(runDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(runDir, 'record.json'), 'utf-8'));
  } catch {
    return null;
  }
}

function scanRun(runDir, { homeParent = defaultHomeParent(), realHome = defaultRealHome() } = {}) {
  const record = readRecord(runDir);
  const scan = scanGuessedPaths({
    transcriptsDir: path.join(runDir, 'transcripts'),
    denials: record && Array.isArray(record.permission_denials) ? record.permission_denials : [],
    homeParent,
    realHome,
  });
  const recorded = recordedAccess(record);
  return {
    id: record && typeof record.id === 'string' ? record.id : path.basename(runDir),
    status: record ? record.status || null : null,
    files_scanned: scan.files_scanned,
    tool_uses_scanned: scan.tool_uses_scanned,
    tilde: scan.tilde,
    guessed_home: scan.guessed_home,
    recorded: recorded === null ? 'not_recorded' : recorded,
    entries: scan.entries,
  };
}

/** Run dirs of a batch under <root>/runs/<batch>/, sorted, never `*.prev-*`. */
function runDirs(root, batch) {
  const dir = path.join(root, 'runs', batch);
  let names = [];
  try {
    names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  return names.filter((n) => !/\.prev-\d+$/.test(n)).sort().map((n) => path.join(dir, n));
}

function parseArgs(argv) {
  const opts = { raw: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--raw') opts.raw = true;
    else if (['--root', '--batch', '--home-parent', '--real-home'].includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { error: `${a} needs a value` };
      opts[a.slice(2).replace('-', '_')] = v;
      i += 1;
    } else return { error: `unknown argument ${a}` };
  }
  if (!opts.root) return { error: 'missing --root' };
  if (!opts.batch) return { error: 'missing --batch' };
  if (!/^[A-E]$/.test(opts.batch)) return { error: '--batch must be one of A-E' };
  return { opts };
}

function fmtRecorded(r) {
  return r === 'not_recorded' ? 'not recorded' : `real ${r.real}, guessed_nonexistent ${r.guessed_nonexistent}, tilde_denied ${r.tilde_denied}`;
}

function main(argv) {
  const { opts, error } = parseArgs(argv);
  if (error) {
    process.stderr.write(`${error}\n${USAGE}\n`);
    return 1;
  }
  const root = path.resolve(opts.root);
  const homeParent = opts.home_parent || defaultHomeParent();
  const realHome = opts.real_home || defaultRealHome();
  const rows = runDirs(root, opts.batch).map((d) => scanRun(d, { homeParent, realHome }));
  if (opts.raw) {
    process.stdout.write(`${JSON.stringify({ batch: opts.batch, home_parent: homeParent, runs: rows }, null, 2)}\n`);
    return 0;
  }
  const lines = [`batch ${opts.batch}: ${rows.length} run(s); home parent ${homeParent}`];
  for (const r of rows) {
    const scan = r.files_scanned === 0
      ? 'not scanned (no transcripts)'
      : `tilde ${r.tilde}, guessed_home ${r.guessed_home} (${r.files_scanned} file(s), ${r.tool_uses_scanned} tool_use(s))`;
    lines.push(`${r.id} ${scan}; record.access: ${fmtRecorded(r.recorded)}`);
    for (const e of r.entries) lines.push(`  ${e.class} ${e.tool}.${e.field}${e.denied ? ' denied' : ''} ${e.path}`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { scanGuessedPaths, recordedAccess, scanRun, runDirs, defaultHomeParent, defaultRealHome, FIELDS };
