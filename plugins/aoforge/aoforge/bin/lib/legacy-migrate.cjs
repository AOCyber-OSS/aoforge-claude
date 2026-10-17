'use strict';

// legacy-migrate.cjs — the adopt migrator: bring a pre-rename project onto the 3.1 layout (objective 80, TRD 80-01).
//
// AOForge 3.1 reads only `.aoforge/` and the "aoforge" config stamp key, and refuses a CLAUDE.md block under the
// pre-rename markers. Migrations 0012 (planning directory), 0013 (stamp key) and 0014 (CLAUDE.md block) did that
// conversion in 3.0.x; 3.1 retired their ids (upgrade.RETIRED_MIGRATIONS) and moved the work here, where `adopt`
// runs it once, on its own branch. The logic is theirs (read from the deleted files, not restored); no migration
// id is registered. Every legacy token is built from LEGACY in legacy-names.cjs, never spelled.
//
// This module never commits and stages nothing beyond what `git mv` stages. Three phases, each safe to repeat:
//
//   planMigration(root, { env })              read-only: what would change, or why nothing can
//   moveTrees(root, moves, { env })           the moves from the plan; a second call is a no-op
//   convertResidue(root, { env, roots })      the stamp key, CLAUDE.md block, ignore lines; a second call is a no-op
//
// Plan shape (`dir` is a component directory relative to the root, '' for the root; every path is posix and
// relative to the root; stamp, block and config paths are the POST-move paths):
//
//   { root, applies, roots: ['', 'api'],
//     moves:     [{ dir, from, to, tracked, files }]      files: tracked files (tracked) or files on disk
//     conflicts: [{ dir, message, fix }]                  both planning directories at one dir: no move there
//     skipped:   [{ path, dir, reason }]                  a legacy-named directory not moved, and why
//     stamps:    [{ file, action: 'rename'|'merge'|null, error? }]
//     blocks:    [{ file, markers: 'pre-v1'|'versioned' }]
//     malformed: [{ file, message, fix }]                 a pre-rename block that cannot be converted
//     ignores:   [{ file, changes: [{ line, action: 'rewrite'|'drop', from, to }] }]
//     exclude:   { file, added: [lines] } }               .git/info/exclude twins (added, never removed)
//
// `applies` is true when a tree moves or a stamp, block or tracked ignore line changes (the exclude file alone
// does not count). refusalFor(plan) turns conflicts and malformed blocks into the reason adopt stops on. The
// discovery walk goes at most 8 directories deep, skips node_modules, build output, dot-directories, nested
// repositories and symlinks, and reports (but never moves) a legacy-named directory inside vendor/ or third_party/.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY } = require('./legacy-names.cjs');
const { PLANNING_MARKERS, legacyPlanningIssue } = require('./planning-layout.cjs');
const { escapeRegExp } = require('./text-escape.cjs');

// Destructured so a dotted access never spells the legacy names (the rename guard reads source text).
const { planningDir: NEW_DIR, configKey: NEW_KEY, blockTag: NEW_TAG, product: PRODUCT } = NAMES;
const { planningDir: OLD_DIR, configKey: OLD_KEY, blockTag: OLD_TAG } = LEGACY;

const MAX_DEPTH = 8;
/** Walked only to report a legacy-named directory inside (never moved). */
const FOREIGN = new Set(['vendor', 'third_party']);
/** On top of repo-state's EXCLUDE. */
const NEVER_EXTRA = ['Pods'];
/** A planning directory without a marker file still counts when it holds one of these. */
const PLANNING_SUBDIRS = Object.freeze(['objectives', 'quick', 'codebase', 'debug', 'todos', 'decisions', 'research', 'milestones']);

const GIT_REDIRECT_VARS = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_PREFIX', 'GIT_NAMESPACE',
];

// ─── small helpers ───────────────────────────────────────────────────────────

/** Join posix path parts, dropping empty ones ('' is the root). */
const rel = (...parts) => parts.filter(Boolean).join('/');
const absPath = (root, relPath) => path.join(root, ...relPath.split('/').filter(Boolean));

function statOf(p) {
  try {
    return fs.statSync(p, { throwIfNoEntry: false }) || null;
  } catch {
    return null;
  }
}
const isDir = (p) => Boolean(statOf(p) && statOf(p).isDirectory());
const isFile = (p) => Boolean(statOf(p) && statOf(p).isFile());

function lstatOf(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const stripCR = (s) => s.replace(/\r$/, '');
const rootFirst = (a, b) => (a === b ? 0 : a === '' ? -1 : b === '' ? 1 : a < b ? -1 : 1);

function gitEnv(env) {
  const out = { ...(env || process.env) };
  for (const key of GIT_REDIRECT_VARS) delete out[key];
  return out;
}

/** Runs `git <args>` in `root` with no shell; -> { status, out, err }. */
function git(root, env, args) {
  const r = spawnSync('git', args, {
    cwd: root,
    env: gitEnv(env),
    input: '',
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status: r.status, out: r.stdout || '', err: (r.stderr || '').trim() };
}

function isWorkTree(root, env) {
  const r = git(root, env, ['rev-parse', '--is-inside-work-tree']);
  return r.status === 0 && r.out.trim() === 'true';
}

/** Paths git tracks under `pathspecs` (relative to `root`), from `ls-files -z`. */
function trackedPaths(root, env, pathspecs) {
  const r = git(root, env, ['ls-files', '-z', '--', ...pathspecs]);
  if (r.status !== 0) throw new Error(`git ls-files failed: ${r.err || r.status}`);
  return [...new Set(r.out.split('\0').filter(Boolean))];
}

function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n += 1;
  }
  return n;
}

// ─── discovery ───────────────────────────────────────────────────────────────

function qualifies(dirAbs) {
  return PLANNING_MARKERS.some((name) => isFile(path.join(dirAbs, name)))
    || PLANNING_SUBDIRS.some((name) => isDir(path.join(dirAbs, name)));
}

/** Names the walk never enters: repo-state's EXCLUDE (build output, node_modules, .git) plus a few more. */
function neverNames() {
  return new Set([...require('./repo-state.cjs').EXCLUDE, ...NEVER_EXTRA]);
}

/**
 * -> { found: [{ dir, kind: 'legacy'|'current' }], skipped: [{ path, dir, reason }] }
 * `dir` is the component directory holding the planning directory. Reads only.
 */
function discover(root) {
  const never = neverNames();
  const found = [];
  const skipped = [];

  const walk = (relDir, depth, foreign) => {
    const dirAbs = absPath(root, relDir);
    let entries;
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const relPath = rel(relDir, e.name);
      if (e.name === OLD_DIR || e.name === NEW_DIR) {
        const legacy = e.name === OLD_DIR;
        if (e.isSymbolicLink()) {
          if (legacy) skipped.push({ path: relPath, dir: relDir, reason: 'symlink' });
          continue;
        }
        if (!e.isDirectory()) continue;
        if (foreign) {
          if (legacy) skipped.push({ path: relPath, dir: relDir, reason: `inside ${foreign}/` });
          continue;
        }
        if (qualifies(path.join(dirAbs, e.name))) found.push({ dir: relDir, kind: legacy ? 'legacy' : 'current' });
        else if (legacy) skipped.push({ path: relPath, dir: relDir, reason: 'no planning files' });
        continue;
      }
      if (!e.isDirectory() || e.name.startsWith('.') || never.has(e.name)) continue;
      if (depth >= MAX_DEPTH) continue;
      if (fs.existsSync(path.join(dirAbs, e.name, '.git'))) continue; // a nested repository or a submodule
      walk(relPath, depth + 1, foreign || (FOREIGN.has(e.name) ? e.name : null));
    }
  };
  walk('', 0, null);
  skipped.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { found, skipped };
}

/** The both-directories text for component `dir`; the root's is planning-layout's own. */
function bothText(root, dir) {
  if (dir === '') {
    const issue = legacyPlanningIssue(root);
    if (issue && issue.layout === 'both') return { message: issue.message, fix: issue.fix };
  }
  const p = dir ? `${dir}/` : '';
  return {
    message: `legacy-planning-dir: ${p}${NEW_DIR}/ and ${p}${OLD_DIR}/ both exist; the legacy one is ignored (${PRODUCT} reads ${NEW_DIR}/ only)`,
    fix: `Move anything you still need from ${p}${OLD_DIR}/ into ${p}${NEW_DIR}/, then remove the legacy directory ${p}${OLD_DIR}/`,
  };
}

// ─── stamp key ───────────────────────────────────────────────────────────────

/** `config` with the pre-rename stamp key folded into the new one (0013): same position, new values win. */
function renameStampKey(config) {
  const hasNew = has(config, NEW_KEY);
  const value = !hasNew
    ? config[OLD_KEY]
    : isPlainObject(config[NEW_KEY]) && isPlainObject(config[OLD_KEY])
      ? { ...config[OLD_KEY], ...config[NEW_KEY] }
      : config[NEW_KEY];
  const out = {};
  for (const key of Object.keys(config)) {
    if (key === OLD_KEY) {
      if (!hasNew) out[NEW_KEY] = value;
      continue;
    }
    out[key] = key === NEW_KEY ? value : config[key];
  }
  return out;
}

function detectIndent(text) {
  const m = /^([ \t]+)\S/m.exec(text);
  if (!m) return 2;
  return m[1].includes('\t') ? '\t' : m[1].length;
}

/** `obj` serialised the way `original` was written: its indent, line endings and trailing newline. */
function serialiseLike(obj, original) {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  let out = JSON.stringify(obj, null, detectIndent(original));
  if (eol === '\r\n') out = out.replace(/\n/g, '\r\n');
  return /\n$/.test(original) ? out + eol : out;
}

/**
 * renameStampKeyText(text) -> { text, action: 'rename'|'merge'|null, error? }
 *
 * Only the pre-rename key: the key token is renamed in place, so no other byte changes (a nested key of the same
 * name is never the one renamed: a candidate counts only if it parses to renameStampKey's result). Both keys: one
 * object under the new key, re-serialised with the file's indent and trailing newline. Neither key: unchanged.
 * Text that is not a JSON object is returned unchanged with an `error`.
 */
function renameStampKeyText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { text, action: null, error: `not valid JSON (${String(e.message).split('\n')[0]})` };
  }
  if (!isPlainObject(parsed)) return { text, action: null, error: 'not a JSON object' };
  if (!has(parsed, OLD_KEY)) return { text, action: null };

  const want = renameStampKey(parsed);
  if (has(parsed, NEW_KEY)) return { text: serialiseLike(want, text), action: 'merge' };

  const wantJson = JSON.stringify(want);
  const re = new RegExp(`"${escapeRegExp(OLD_KEY)}"(?=\\s*:)`, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const candidate = `${text.slice(0, m.index)}"${NEW_KEY}"${text.slice(m.index + m[0].length)}`;
    try {
      if (JSON.stringify(JSON.parse(candidate)) === wantJson) return { text: candidate, action: 'rename' };
    } catch {
      // not this occurrence
    }
  }
  return { text: serialiseLike(want, text), action: 'rename' };
}

// ─── CLAUDE.md block ─────────────────────────────────────────────────────────

const LEGACY_START_PREFIX = `<!--\\s*${escapeRegExp(OLD_TAG)}:START\\b`;
const LEGACY_START_FULL = `${LEGACY_START_PREFIX}([^>]*?)\\s*-->`;
const LEGACY_END = `<!--\\s*${escapeRegExp(OLD_TAG)}:END\\s*-->`;
const NEW_START_PREFIX = new RegExp(`<!--\\s*${escapeRegExp(NEW_TAG)}:START\\b`);
const BLOCK_ERROR = 'ELEGACYMALFORMED';

function malformedBlock(message, fix) {
  const err = new Error(message);
  err.code = BLOCK_ERROR;
  err.fix = fix;
  return err;
}

const lazyManagedBlock = () => require('./managed-block.cjs');
const lazyRewrite = () => require('./legacy-rewrite.cjs');

/**
 * rewriteBlockText(text) -> null when the text holds no pre-rename START marker, else { text, markers, lines }.
 *
 * The block region (START marker through END marker) goes through legacy-rewrite's rewriteLegacyNames, which maps
 * the markers and every old name in the body; the bytes before and after the region are copied unchanged. The result
 * must read as one block under the new tag at the same place. `markers` is 'pre-v1' (no v= attribute) or
 * 'versioned'; `lines` is how many block lines changed.
 * @throws {Error} code ELEGACYMALFORMED (with `fix`) for a START with no END, two blocks, a pre-rename block beside
 *   a current one, or a START marker that is not closed.
 */
function rewriteBlockText(text) {
  const starts = [...text.matchAll(new RegExp(LEGACY_START_PREFIX, 'g'))];
  if (starts.length === 0) return null;
  if (starts.length > 1) {
    throw malformedBlock(
      `holds ${starts.length} managed blocks under the pre-rename ${OLD_TAG} markers`,
      `remove the duplicate block, or rename both markers of the one you keep to ${NEW_TAG} by hand, then run adopt again`,
    );
  }
  if (NEW_START_PREFIX.test(text)) {
    throw malformedBlock(
      `holds a managed block under the pre-rename ${OLD_TAG} markers beside one under ${NEW_TAG}`,
      `remove the duplicate block (keep one), or rename the ${OLD_TAG} markers to ${NEW_TAG} by hand, then run adopt again`,
    );
  }
  const s = new RegExp(LEGACY_START_FULL).exec(text);
  if (!s) {
    throw malformedBlock(
      `has a pre-rename ${OLD_TAG}:START marker that is not closed with -->`,
      `rename both markers to ${NEW_TAG} by hand (close the START marker first), then run adopt again`,
    );
  }
  const endRe = new RegExp(LEGACY_END, 'g');
  endRe.lastIndex = s.index + s[0].length;
  const e = endRe.exec(text);
  if (!e) {
    throw malformedBlock(
      `has a pre-rename ${OLD_TAG}:START marker with no ${OLD_TAG}:END marker after it`,
      `add the missing END marker, or rename both markers to ${NEW_TAG} by hand, then run adopt again`,
    );
  }

  const start = s.index;
  const end = e.index + e[0].length;
  const region = text.slice(start, end);
  const nextRegion = lazyRewrite().rewriteLegacyNames(region);
  const next = text.slice(0, start) + nextRegion + text.slice(end);

  let check = null;
  try {
    check = lazyManagedBlock().read(next);
  } catch {
    check = null;
  }
  if (!check || check.start !== start) {
    throw malformedBlock(
      `could not be converted: the rewrite did not leave one ${NEW_TAG} block`,
      `rename both markers to ${NEW_TAG} by hand, then run adopt again`,
    );
  }

  const before = region.split('\n');
  const after = nextRegion.split('\n');
  const lines = before.filter((line, i) => line !== after[i]).length;
  return { text: next, markers: /(?:^|\s)v=[^\s>]+/.test(s[1]) ? 'versioned' : 'pre-v1', lines };
}

// ─── ignore files ────────────────────────────────────────────────────────────

// A path segment naming the legacy directory: at the start of the pattern or after a `/`, then `/` or the end.
const LEGACY_SEGMENT = `(^|/)${escapeRegExp(OLD_DIR)}(?=/|$)`;

/** The `.aoforge/` counterpart of an ignore line naming the legacy directory, or null. Comments and blanks: null. */
function counterpart(line) {
  if (!line.trim() || line.trimStart().startsWith('#')) return null;
  const neg = line.startsWith('!') ? '!' : '';
  const body = neg ? line.slice(1) : line;
  if (!new RegExp(LEGACY_SEGMENT).test(body)) return null;
  return neg + body.replace(new RegExp(LEGACY_SEGMENT, 'g'), `$1${NEW_DIR}`);
}

/**
 * rewriteIgnoreText(text) -> { text, changes: [{ line, action: 'rewrite'|'drop', from, to }] }
 *
 * Each ignore line naming the legacy directory becomes its counterpart; when the file already has the counterpart
 * the legacy line is dropped. Comments, blank lines and every other line (and each line's `\r`) are untouched.
 * `line` is 1-based in the input.
 */
function rewriteIgnoreText(text) {
  const lines = text.split('\n');
  const have = new Set(lines.map(stripCR));
  const out = [];
  const changes = [];
  lines.forEach((raw, i) => {
    const line = stripCR(raw);
    const twin = counterpart(line);
    if (twin === null) {
      out.push(raw);
      return;
    }
    if (have.has(twin)) {
      changes.push({ line: i + 1, action: 'drop', from: line, to: null });
      return;
    }
    have.add(twin);
    out.push(twin + (raw.endsWith('\r') ? '\r' : ''));
    changes.push({ line: i + 1, action: 'rewrite', from: line, to: twin });
  });
  return { text: out.join('\n'), changes };
}

/**
 * addExcludeCounterparts(text) -> { text, added: [lines] } for .git/info/exclude: each legacy line is followed by
 * its counterpart unless the file has it. The legacy lines are kept: other branches of the clone may still use them.
 */
function addExcludeCounterparts(text) {
  const lines = text.split('\n');
  const have = new Set(lines.map(stripCR));
  const out = [];
  const added = [];
  for (const raw of lines) {
    out.push(raw);
    const twin = counterpart(stripCR(raw));
    if (twin === null || have.has(twin)) continue;
    have.add(twin);
    added.push(twin);
    out.push(twin + (raw.endsWith('\r') ? '\r' : ''));
  }
  return { text: out.join('\n'), added };
}

// ─── the residue plan (reads only) ───────────────────────────────────────────

const dirOf = (p) => (path.posix.dirname(p) === '.' ? '' : path.posix.dirname(p));

/** Tracked `.gitignore` files outside planning directories and vendored or generated trees, root first. */
function trackedGitignores(root, env) {
  const skip = new Set([NEW_DIR, OLD_DIR, ...FOREIGN, ...neverNames()]);
  return trackedPaths(root, env, ['.gitignore', ':(glob)**/.gitignore'])
    .filter((p) => !p.split('/').slice(0, -1).some((seg) => skip.has(seg)))
    .sort((a, b) => rootFirst(dirOf(a), dirOf(b)));
}

/** The info/exclude file of the repository `root` is in: { rel, abs } or null. */
function excludeFile(root, env) {
  const r = git(root, env, ['rev-parse', '--git-path', 'info/exclude']);
  if (r.status !== 0 || !r.out.trim()) return null;
  const abs = path.resolve(root, r.out.trim());
  const relative = path.relative(root, abs).split(path.sep).join('/');
  return { rel: relative.startsWith('..') ? abs : relative, abs };
}

/**
 * The residue of the pre-rename layout at the planning roots `rootDirs`: what each converter would change, and the
 * file edits that make it so. Reads only. -> { stamps, blocks, malformed, ignores, exclude, edits: [{ abs, text }] }
 */
function residueEdits(root, env, inGit, rootDirs) {
  const edits = [];
  const stamps = [];
  const blocks = [];
  const malformed = [];
  const ignores = [];
  let exclude = { file: null, added: [] };

  for (const dir of rootDirs) {
    const newRel = rel(dir, NEW_DIR, 'config.json');
    const found = [newRel, rel(dir, OLD_DIR, 'config.json')].find((c) => isFile(absPath(root, c)));
    if (!found) continue;
    const r = renameStampKeyText(readText(absPath(root, found)) || '');
    if (r.error) stamps.push({ file: newRel, action: null, error: r.error });
    else if (r.action) {
      stamps.push({ file: newRel, action: r.action });
      edits.push({ abs: absPath(root, found), text: r.text });
    }
  }

  for (const dir of [...new Set(['', ...rootDirs])].sort(rootFirst)) {
    const file = rel(dir, 'CLAUDE.md');
    const text = readText(absPath(root, file));
    if (text === null) continue;
    try {
      const r = rewriteBlockText(text);
      if (r) {
        blocks.push({ file, markers: r.markers });
        edits.push({ abs: absPath(root, file), text: r.text });
      }
    } catch (e) {
      if (e.code !== BLOCK_ERROR) throw e;
      malformed.push({ file, message: `${file} ${e.message}`, fix: e.fix });
    }
  }

  if (inGit) {
    for (const file of trackedGitignores(root, env)) {
      const text = readText(absPath(root, file));
      if (text === null) continue;
      const r = rewriteIgnoreText(text);
      if (r.changes.length === 0) continue;
      ignores.push({ file, changes: r.changes });
      edits.push({ abs: absPath(root, file), text: r.text });
    }
    const ex = excludeFile(root, env);
    if (ex) {
      exclude = { file: ex.rel, added: [] };
      const text = readText(ex.abs);
      if (text !== null) {
        const r = addExcludeCounterparts(text);
        exclude.added = r.added;
        if (r.added.length > 0) edits.push({ abs: ex.abs, text: r.text });
      }
    }
  }
  return { stamps, blocks, malformed, ignores, exclude, edits };
}

// ─── planMigration / refusalFor ──────────────────────────────────────────────

function describeMove(root, env, inGit, dir) {
  const from = rel(dir, OLD_DIR);
  const tracked = inGit ? trackedPaths(root, env, [from]) : [];
  return {
    dir,
    from,
    to: rel(dir, NEW_DIR),
    tracked: tracked.length > 0,
    files: tracked.length > 0 ? tracked.length : countFiles(absPath(root, from)),
  };
}

/**
 * planMigration(root, { env }) -> the plan described in the header. Reads only: no file, no index, no ref.
 */
function planMigration(root, { env } = {}) {
  root = path.resolve(root);
  const inGit = isWorkTree(root, env);
  const { found, skipped } = discover(root);

  const moves = [];
  const conflicts = [];
  for (const f of found.filter((x) => x.kind === 'legacy').sort((a, b) => rootFirst(a.dir, b.dir))) {
    if (isDir(absPath(root, rel(f.dir, NEW_DIR)))) conflicts.push({ dir: f.dir, ...bothText(root, f.dir) });
    else moves.push(describeMove(root, env, inGit, f.dir));
  }
  const conflicted = new Set(conflicts.map((c) => c.dir));
  const roots = [...new Set([
    ...moves.map((mv) => mv.dir),
    ...found.filter((x) => x.kind === 'current').map((x) => x.dir),
  ])].filter((d) => !conflicted.has(d)).sort(rootFirst);

  const residue = residueEdits(root, env, inGit, roots);
  const { stamps, blocks, malformed, ignores, exclude } = residue;
  const applies = moves.length > 0 || stamps.some((s) => s.action) || blocks.length > 0 || ignores.length > 0;
  return { root, applies, roots, moves, conflicts, skipped, stamps, blocks, malformed, ignores, exclude };
}

/**
 * refusalFor(plan) -> null, or { reason, message, next } for what adopt must stop on: 'both-planning-dirs' (a
 * conflict) first, then 'legacy-block-malformed'. `message` names every path; `next` is the fix.
 */
function refusalFor(plan) {
  if (plan.conflicts && plan.conflicts.length > 0) {
    return {
      reason: 'both-planning-dirs',
      message: plan.conflicts.map((c) => c.message).join('; '),
      next: plan.conflicts.map((c) => c.fix).join('; '),
    };
  }
  if (plan.malformed && plan.malformed.length > 0) {
    return {
      reason: 'legacy-block-malformed',
      message: plan.malformed.map((x) => x.message).join('; '),
      next: plan.malformed.map((x) => `${x.file}: ${x.fix}`).join('; '),
    };
  }
  return null;
}

// ─── the move ────────────────────────────────────────────────────────────────

/**
 * Moves what a half-finished move left in `from` into `to`, entry by entry, never overwriting: a same-named file
 * stays where it is and is listed in `left` (posix paths relative to the root). Removes `from` when it ends empty.
 * -> the number of entries moved.
 */
function moveLeftovers(from, to, relFrom, left) {
  if (!lstatOf(from)) return 0;
  let moved = 0;
  for (const name of fs.readdirSync(from).sort()) {
    const src = path.join(from, name);
    const dest = path.join(to, name);
    const d = lstatOf(dest);
    if (d) {
      const s = lstatOf(src);
      if (s && s.isDirectory() && d.isDirectory()) moved += moveLeftovers(src, dest, `${relFrom}/${name}`, left);
      else left.push(`${relFrom}/${name}`);
      continue;
    }
    fs.renameSync(src, dest);
    moved += 1;
  }
  if (fs.readdirSync(from).length === 0) fs.rmdirSync(from);
  return moved;
}

function moveOne(root, env, inGit, mv) {
  const from = absPath(root, mv.from);
  const to = absPath(root, mv.to);
  const base = { dir: mv.dir, from: mv.from, to: mv.to, tracked: mv.tracked, files: mv.files };

  if (!lstatOf(to)) {
    if (!lstatOf(from)) throw new Error(`neither ${mv.from} nor ${mv.to} exists; nothing to move`);
    // Never create `to` first: git mv would then move the tree INSIDE it.
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (inGit && trackedPaths(root, env, [mv.from]).length > 0) {
      const r = git(root, env, ['mv', '--', mv.from, mv.to]);
      if (r.status !== 0) throw new Error(`git mv ${mv.from} ${mv.to} failed: ${r.err || r.status}`);
      moveLeftovers(from, to, mv.from, []);
      return { ...base, via: 'git mv' };
    }
    fs.renameSync(from, to);
    return { ...base, via: 'rename' };
  }
  if (!lstatOf(from)) return { ...base, via: 'done' };

  const left = [];
  const moved = moveLeftovers(from, to, mv.from, left);
  return moved > 0 || left.length > 0 ? { ...base, via: 'leftovers', left } : { ...base, via: 'done' };
}

/**
 * moveTrees(root, moves, { env }) -> [{ dir, from, to, tracked, files, via, left? }] in the order moved (root first).
 *
 * `git mv` when git tracks files in the tree (history follows; ignored and untracked files inside move with the
 * directory), an fs rename when it tracks none. `via`: 'git mv' | 'rename' | 'done' (already moved) | 'leftovers'
 * (an interrupted move: what the source still held moved into the target; `left` lists same-named files that stayed).
 * A failing `git mv` throws with git's message and nothing after it runs.
 */
function moveTrees(root, moves, { env } = {}) {
  root = path.resolve(root);
  const inGit = isWorkTree(root, env);
  return [...moves].sort((a, b) => rootFirst(a.dir, b.dir)).map((mv) => moveOne(root, env, inGit, mv));
}

/** True when every move's target is a directory and no source is left. */
function movesDone(root, moves) {
  root = path.resolve(root);
  return moves.every((mv) => isDir(absPath(root, mv.to)) && !lstatOf(absPath(root, mv.from)));
}

/** True for a path the migration may write: inside a planning directory, or a .gitignore or CLAUDE.md anywhere. */
function ownsMigratePath(relPath) {
  const parts = String(relPath).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.some((p) => p === NEW_DIR || p === OLD_DIR)) return true;
  const base = parts[parts.length - 1];
  return base === '.gitignore' || base === 'CLAUDE.md';
}

module.exports = {
  planMigration,
  refusalFor,
  moveTrees,
  movesDone,
  ownsMigratePath,
  renameStampKeyText,
  rewriteBlockText,
  rewriteIgnoreText,
  addExcludeCounterparts,
};
