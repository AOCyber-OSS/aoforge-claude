'use strict';
/**
 * OAuth token handling for the objective-81 eval harness (TRD 81-01).
 *
 * The token reaches a child `claude -p` only through the env variable CLAUDE_CODE_OAUTH_TOKEN, read from a token file
 * whose path is an argument (never hard-coded). It is never put in argv (visible in `ps`), never in a run record, a
 * log line or a thrown error: errors name the token FILE path only.
 *
 * No function here logs or prints. Callers decide what to print, always through redact().
 *
 * The child env is built from an allowlist, never inherited wholesale: a nested `claude` that saw the parent
 * session's CLAUDECODE / CLAUDE_CODE_* variables, ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL or
 * the user's AOFORGE_* settings would measure the wrong thing or authenticate the wrong way.
 */

const fs = require('fs');
const path = require('path');
const { ENV_ALLOW } = require('./contract.cjs');

// Taken from the parent when set; everything else is dropped.
const PARENT_ALLOW = ['PATH', 'LANG', 'LC_ALL', 'TERM', 'USER', 'LOGNAME', 'SHELL'];
const REDACTED = '<redacted>';

/** The token file's trimmed contents. Throws naming the path (and an error code), never the contents. */
function readToken(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`token file not found: ${file}`);
    throw new Error(`cannot read token file ${file} (${err.code || 'read error'})`);
  }
  const token = raw.trim();
  if (token === '') throw new Error(`token file is empty: ${file}`);
  return token;
}

/**
 * The child process environment.
 * @param {object} opts
 * @param {string} opts.home       the run's sandbox HOME
 * @param {string} opts.configDir  its CLAUDE_CONFIG_DIR
 * @param {string} opts.tmpdir     its TMPDIR
 * @param {string} opts.token      the OAuth token (from readToken)
 * @param {Object<string,string>} [opts.extra]  descriptor env: only AOFORGE_SKIP_* = "1" (contract ENV_ALLOW)
 * @param {Object<string,string>} [opts.parentEnv]  defaults to process.env; only PARENT_ALLOW is read from it
 */
function childEnv({ home, configDir, tmpdir, token, extra = {}, parentEnv = process.env } = {}) {
  const required = { home, configDir, tmpdir, token };
  for (const [name, value] of Object.entries(required)) {
    if (typeof value !== 'string' || value === '') throw new TypeError(`childEnv: ${name} must be a non-empty string`);
  }
  const env = {};
  for (const key of PARENT_ALLOW) {
    if (parentEnv && typeof parentEnv[key] === 'string') env[key] = parentEnv[key];
  }
  env.HOME = home;
  env.CLAUDE_CONFIG_DIR = configDir;
  env.TMPDIR = tmpdir;
  env.CLAUDE_CODE_OAUTH_TOKEN = token;
  for (const [key, value] of Object.entries(extra || {})) {
    if (!ENV_ALLOW.test(key)) throw new TypeError(`childEnv: extra env ${key} is not allowlisted (only AOFORGE_SKIP_*)`);
    if (value !== '1') throw new TypeError(`childEnv: extra env ${key} must be the string "1"`);
    env[key] = value;
  }
  return env;
}

/**
 * Replace every occurrence of the token (matched literally) with `<redacted>`. A non-string is JSON-serialised first.
 * An empty token leaves the text unchanged.
 */
function redact(str, token) {
  const text = typeof str === 'string' ? str : JSON.stringify(str);
  if (typeof token !== 'string' || token === '' || typeof text !== 'string') return text;
  return text.split(token).join(REDACTED);
}

function holdsToken(file, needle) {
  return fs.readFileSync(file).indexOf(needle) !== -1;
}

/**
 * Which files hold the token? A file gives `[basename]` or `[]`; a directory is walked (symlinks skipped) and gives
 * the sorted posix-relative paths of every file holding it, text or binary. Throws naming a target that is missing.
 */
function scanForSecret(target, token) {
  if (typeof token !== 'string' || token === '') throw new TypeError('scanForSecret: token must be a non-empty string');
  const needle = Buffer.from(token);
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (err) {
    throw new Error(`scanForSecret: cannot stat ${target} (${err.code || 'stat error'})`);
  }
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return holdsToken(target, needle) ? [path.basename(target)] : [];
  if (!stat.isDirectory()) return [];
  const hits = [];
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const childAbs = path.join(abs, ent.name);
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) walk(childAbs, childRel);
      else if (ent.isFile() && holdsToken(childAbs, needle)) hits.push(childRel);
    }
  };
  walk(target, '');
  return hits.sort();
}

module.exports = { PARENT_ALLOW, REDACTED, readToken, childEnv, redact, scanForSecret };
