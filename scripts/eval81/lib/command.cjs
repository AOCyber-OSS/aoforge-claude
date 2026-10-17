'use strict';
/**
 * The exact headless `claude -p` command for one RunDescriptor, and the per-run `--settings` deny list (TRD 81-08).
 *
 *   claude -p --output-format stream-json --verbose --model <tier> --max-budget-usd <cap>
 *     --permission-mode bypassPermissions [--settings <run dir>/settings.json] [--plugin-dir <dir>]...
 *     [--agent <plugin>:<name>] [--tools <a,b>] [--json-schema <json>] -- <prompt>
 *
 * The prompt goes last, after `--`, so a prompt that starts with `-` (a YAML front matter, a list) is never read as a
 * flag and no variadic flag can swallow it. Nothing here touches the environment: the token travels only in the child
 * env (secret.childEnv), never in argv.
 *
 * Deny list (isolation layer 2): for each deny root `Read(//<root>/**)`, `Edit(//<root>/**)`, `Write(//<root>/**)`,
 * where `//` marks an absolute path in a permission rule (`~/` would resolve to the sandbox HOME, so the real home is
 * always written out). Deny roots are derived at run time, never hard-coded: dirname(repo) (this checkout and its
 * siblings), <real home>/.claude and every watched repo; each also in its realpath form when that differs. Bash is
 * not path-scoped by these rules (they match command text, not the paths a command touches).
 */

const fs = require('fs');
const path = require('path');

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A dollar amount as a plain decimal string: no exponent, no float noise, at most 6 decimals. */
function decimal(usd) {
  return usd.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * The argv (without the binary) for one run.
 * @param {object} desc  a RunDescriptor (contract.cjs)
 * @param {{pluginDirs?: string[], settingsPath?: string|null}} [opts]  pluginDirs is [] when desc.plugin is null
 */
function buildArgv(desc, { pluginDirs = [], settingsPath = null } = {}) {
  if (!isPlainObject(desc)) throw new TypeError('buildArgv: desc must be a RunDescriptor');
  if (typeof desc.prompt !== 'string' || desc.prompt === '') throw new TypeError('buildArgv: prompt must be a non-empty string');
  if (typeof desc.capUsd !== 'number' || !Number.isFinite(desc.capUsd) || desc.capUsd <= 0) {
    throw new TypeError('buildArgv: capUsd must be a positive number');
  }
  if (desc.kind === 'agent' && (typeof desc.agent !== 'string' || desc.agent === '')) {
    throw new TypeError('buildArgv: kind agent needs an agent name');
  }
  const argv = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', desc.model,
    '--max-budget-usd', decimal(desc.capUsd),
    '--permission-mode', 'bypassPermissions',
  ];
  if (settingsPath) argv.push('--settings', settingsPath);
  for (const dir of pluginDirs) argv.push('--plugin-dir', dir);
  if (desc.kind === 'agent') argv.push('--agent', desc.agent);
  if (Array.isArray(desc.tools)) argv.push('--tools', desc.tools.join(','));
  if (isPlainObject(desc.jsonSchema)) argv.push('--json-schema', JSON.stringify(desc.jsonSchema));
  argv.push('--', desc.prompt);
  return argv;
}

function assertAbsolute(p, what) {
  if (typeof p !== 'string' || !path.isAbsolute(p)) throw new TypeError(`${what} must be an absolute path (got ${JSON.stringify(p)})`);
  return path.resolve(p);
}

function realOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * The deny roots: [dirname(repo), <realHome>/.claude, ...watched], absolute, normalised and deduped, each followed by
 * its realpath form when the path exists and resolves elsewhere. `watched` entries are paths or {label, path}.
 */
function denyRoots({ repo, realHome, watched = [] } = {}) {
  const given = [
    path.dirname(assertAbsolute(repo, 'denyRoots: repo')),
    path.join(assertAbsolute(realHome, 'denyRoots: realHome'), '.claude'),
    ...watched.map((w) => assertAbsolute(isPlainObject(w) ? w.path : w, 'denyRoots: watched repo')),
  ];
  const out = [];
  for (const p of given) {
    for (const form of [p, realOrNull(p)]) {
      if (form && !out.includes(form)) out.push(form);
    }
  }
  return out;
}

/** The deny-only settings object for `--settings`. */
function buildSettings(roots) {
  const deny = [];
  for (const r of roots) {
    const abs = assertAbsolute(r, 'buildSettings: deny root');
    for (const tool of ['Read', 'Edit', 'Write']) deny.push(`${tool}(/${abs}/**)`);
  }
  return { permissions: { deny } };
}

/** Is `p` a deny root or inside one? Returns that root, else null. Compares normalised absolute paths. */
function underDenyRoot(p, roots) {
  const target = path.resolve(p);
  for (const r of roots) {
    const root = path.resolve(r);
    if (target === root || target.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)) return r;
  }
  return null;
}

module.exports = { buildArgv, denyRoots, buildSettings, underDenyRoot, decimal };
