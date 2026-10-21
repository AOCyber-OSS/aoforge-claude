'use strict';
/**
 * Opaque run paths (post-hoc 3, TRD 81-17, user 2026-10-17). Batch E's build pilot b31-r1 had an executor resolve
 * `~/.claude/...` to the real home, because the session cwd sat under a scratchpad whose name encodes it
 * (`-Users-justin-dev-aoforge-claude`). The deny list refused the read; this module makes the inference impossible:
 * no path handed to a run (cwd, HOME, CLAUDE_CONFIG_DIR, TMPDIR, --plugin-dir, --settings, the fixture copy) may name
 * the user or the checkout in any component of its real path. A symlink does not help, because getcwd() resolves it,
 * so every path is checked after fs.realpathSync.
 *
 * forbiddenTokens({realHome, repo}) -> [basename(realHome), basename(repo), basename(dirname(realHome)) + '-']
 *   On this machine: ['justin', 'aoforge-claude', 'Users-']. The last one catches Claude Code's path encoding of
 *   the home (`-Users-justin-...`). Empty names are dropped, and so is the dash token for a home directly under /.
 * opaqueViolations(entries, tokens) -> {checked: [{what, path, real}], violations: [{what, path, real, component,
 *   token}]}. Case-insensitive substring match per component of the real path; an entry with no path is skipped; a
 *   path that does not exist yet is checked as path.resolve() gives it.
 */

const fs = require('fs');
const path = require('path');

function forbiddenTokens({ realHome, repo } = {}) {
  for (const [what, p] of [['realHome', realHome], ['repo', repo]]) {
    if (typeof p !== 'string' || !path.isAbsolute(p)) throw new TypeError(`forbiddenTokens: ${what} must be an absolute path`);
  }
  const parent = path.basename(path.dirname(realHome));
  const out = [];
  for (const t of [path.basename(realHome), path.basename(repo), parent ? `${parent}-` : '']) {
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function realOf(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function opaqueViolations(entries, tokens) {
  const checked = [];
  const violations = [];
  const lowered = tokens.map((t) => [t, t.toLowerCase()]);
  for (const e of entries) {
    if (!e || typeof e.path !== 'string' || e.path === '') continue;
    const real = realOf(e.path);
    checked.push({ what: e.what, path: e.path, real });
    for (const component of real.split(path.sep)) {
      const c = component.toLowerCase();
      for (const [token, low] of lowered) {
        if (c.includes(low)) violations.push({ what: e.what, path: e.path, real, component, token });
      }
    }
  }
  return { checked, violations };
}

module.exports = { forbiddenTokens, opaqueViolations };
