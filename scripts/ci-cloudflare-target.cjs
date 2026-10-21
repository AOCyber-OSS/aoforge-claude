#!/usr/bin/env node
'use strict';

/**
 * ci-cloudflare-target: say, in a public CI log, which Cloudflare account a Pages deploy
 * targets (objective 74, TRD 74-02, OPS-03).
 *
 * Background. Every docs deploy from main failed with `Project not found [code: 8000007]`,
 * including for a project that exists. The likeliest cause is that the org secret
 * CLOUDFLARE_ACCOUNT_ID names a different account from the one the Pages project lives in,
 * or that CLOUDFLARE_API_TOKEN cannot see this one. A secret cannot be read back, so this
 * script asks the Cloudflare API instead, with the same two secrets the deploy uses:
 *
 *   GET /client/v4/accounts/{id}                         the configured account's name
 *   GET /client/v4/accounts?per_page=50                  the accounts the token can see
 *   GET /client/v4/accounts/{id}/pages/projects/{name}   the Pages project the deploy targets
 *
 * The project is read directly, never listed: Cloudflare refused the listing
 * `pages/projects?per_page=100` with code 8000024 (run 39595433242, 2026-10-21). An answer
 * of code 8000007 (project not found) is reported as ABSENT.
 *
 * Reach is decided from both reads. A token scoped to Pages alone has no Account Settings:
 * Read, so its account read is refused (code 9109) and its account list is empty, yet it
 * reads the project and the deploy succeeds (the same run). So the account is called out
 * of this token's reach only when the account read AND the project read are both refused;
 * when the account read is refused and the project is not found, the report says it cannot
 * tell those two apart.
 *
 * What it guarantees:
 *
 *   1. IT PRINTS NAMES, NEVER IDS. The repository is public, so its Actions logs are
 *      public. Ids are compared inside the process and never written; the other accounts
 *      the token can see are reported as a COUNT, not by name. Every line, and every error
 *      message the API or the network hands back, passes through `scrub`, which replaces
 *      the account id and token it was given and any 32-hex run (the shape of an account
 *      id) before anything reaches stdout or stderr.
 *
 *   2. IT IS A DIAGNOSTIC, NOT A GATE. Missing secrets (a fork's pull request has none),
 *      an API error and a dead network are each reported and exit 0. The deploy step is
 *      the gate. Only a usage error (no --project) exits 1.
 *
 *   3. IT IS READ-ONLY: three GET requests, no write.
 *
 * Usage:  node scripts/ci-cloudflare-target.cjs --project <pages-project-name>
 * Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from the environment.
 */

const API_BASE = 'https://api.cloudflare.com';
const LINE_PREFIX = 'cloudflare target: ';
const REQUEST_TIMEOUT_MS = 15000;
// Cloudflare Pages' "Project not found" error code (the code wrangler reports too).
const PROJECT_NOT_FOUND = 8000007;
const USAGE = 'usage: node scripts/ci-cloudflare-target.cjs --project <name>';

// ─── scrubbing ───────────────────────────────────────────────────────────────

/**
 * Remove anything that must not reach a public log. Each given secret becomes
 * `<redacted>` (longest first, so one secret containing another leaves no remnant), then
 * every run of 32 hex characters, the shape of a Cloudflare account id, becomes `<id>`.
 * Empty and non-string secrets are ignored.
 */
function scrub(text, secrets = []) {
  let cleaned = String(text);
  const known = secrets
    .filter((s) => typeof s === 'string' && s !== '')
    .sort((a, b) => b.length - a.length);
  for (const secret of known) cleaned = cleaned.split(secret).join('<redacted>');
  return cleaned.replace(/[0-9a-f]{32}/gi, '<id>');
}

// ─── the report (pure) ───────────────────────────────────────────────────────

/** A section that never got an answer: the fetch threw, or the body was not JSON. */
function unreachable(section) {
  return !section || typeof section.error === 'string';
}

function unreachableLine(section) {
  return `Cloudflare API unreachable: ${section && section.error ? section.error : 'no response'}`;
}

/** `code 10000 Authentication error`, for each error in a failed envelope. */
function failureText(envelope) {
  const errors = Array.isArray(envelope.errors) ? envelope.errors : [];
  if (errors.length === 0) return 'code unknown';
  return errors
    .map((e) => [`code ${e && e.code !== undefined ? e.code : 'unknown'}`, e && e.message].filter(Boolean).join(' '))
    .join('; ');
}

/** True when a failed envelope carries the given error code. */
function hasCode(envelope, code) {
  return Array.isArray(envelope.errors) && envelope.errors.some((e) => e && Number(e.code) === code);
}

/** `production branch main, subdomain x.pages.dev`, from the fields the API returned. */
function projectDetails(result) {
  const r = result || {};
  return [r.production_branch && `production branch ${r.production_branch}`, r.subdomain && `subdomain ${r.subdomain}`]
    .filter(Boolean)
    .join(', ');
}

/**
 * Turn the three API answers into the lines to print.
 *
 * Each of `account`, `accounts` and `pagesProject` is a Cloudflare envelope
 * (`{ success, errors, result }`) or `{ error: <message> }` when the call itself failed.
 * `accountVisible` and `projectPresent` are true, false, or null when the answers cannot
 * decide it. Every returned line has been scrubbed.
 */
function summarizeTarget({ account, accounts, pagesProject }, { accountId, project, token }) {
  const secrets = [accountId, token];
  const lines = [];
  const add = (line) => lines.push(scrub(line, secrets));

  const accountRead = !unreachable(account) && account.success === true;
  const accountRefused = !unreachable(account) && account.success !== true;
  const projectRead = !unreachable(pagesProject) && pagesProject.success === true;
  const projectNotFound = !unreachable(pagesProject) && !projectRead && hasCode(pagesProject, PROJECT_NOT_FOUND);
  const projectRefused = !unreachable(pagesProject) && !projectRead && !projectNotFound;

  // The configured account, by name. A refused read next to a readable project is a
  // token without Account Settings: Read, not an account out of reach.
  if (unreachable(account)) add(unreachableLine(account));
  else if (accountRead) add(`account: ${(account.result && account.result.name) || '(unnamed)'} (named by CLOUDFLARE_ACCOUNT_ID)`);
  else if (projectRead) {
    add(`account: name not readable (the token lacks Account Settings: Read); Pages project ${project} is reachable in the configured account`);
  } else add(`account: could not be read: ${failureText(account)}`);

  // The other accounts this token can see: counted, never named.
  let listed = false;
  if (unreachable(accounts)) {
    add(unreachableLine(accounts));
  } else if (accounts.success !== true) {
    add(`accounts the token can see could not be listed: ${failureText(accounts)}`);
  } else {
    const list = Array.isArray(accounts.result) ? accounts.result : [];
    listed = list.some((a) => a && a.id === accountId);
    add(`other accounts the token can see: ${list.filter((a) => !(a && a.id === accountId)).length}`);
  }

  // The Pages project the deploy targets, read directly.
  let projectPresent = null;
  if (unreachable(pagesProject)) {
    add(unreachableLine(pagesProject));
  } else if (projectRead) {
    projectPresent = true;
    const name = (pagesProject.result && pagesProject.result.name) || project;
    const details = projectDetails(pagesProject.result);
    add(`Pages project ${name}: present${details ? ` (${details})` : ''}`);
  } else if (projectNotFound) {
    projectPresent = false;
    add(`${project}: ABSENT in this account`);
    add(`to create it: Cloudflare dashboard > Workers & Pages > Create > Pages > Direct upload; project name ${project}, production branch main`);
  } else {
    add(`Pages project ${project} could not be read: ${failureText(pagesProject)}`);
  }

  // Reach: out of it only when both reads were refused.
  let accountVisible = null;
  if (accountRead || projectRead || listed) {
    accountVisible = true;
  } else if (accountRefused && projectRefused) {
    accountVisible = false;
    add(`the token cannot see the configured account: neither its name nor Pages project ${project} could be read, so CLOUDFLARE_ACCOUNT_ID names an account outside this token's reach (or the token has no Pages permission there)`);
  } else if (accountRefused && projectNotFound) {
    add(`the account name could not be read, so this cannot tell a missing ${project} from a CLOUDFLARE_ACCOUNT_ID outside this token's reach`);
  }

  return { lines: [...new Set(lines)], accountVisible, projectPresent };
}

// ─── the API ─────────────────────────────────────────────────────────────────

/** One GET. Resolves to the parsed envelope, or `{ error }`; it never rejects. */
async function get(fetchImpl, pathAndQuery, token) {
  try {
    const res = await fetchImpl(`${API_BASE}${pathAndQuery}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    let body;
    try {
      body = await res.json();
    } catch {
      return { error: `HTTP ${res.status}, response was not JSON` };
    }
    if (body === null || typeof body !== 'object') return { error: `HTTP ${res.status}, unexpected response` };
    return body;
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

/** `--project <name>` or `--project=<name>`; null when absent, empty or mixed with other arguments. */
function parseProject(argv) {
  let project = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project') {
      project = argv[++i];
    } else if (arg.startsWith('--project=')) {
      project = arg.slice('--project='.length);
    } else {
      return null;
    }
  }
  return project ? project : null;
}

/**
 * Run the report. Resolves to the exit code: 0 for every outcome of the check itself, 1
 * for a usage error only. `io` injects `env`, `fetch`, `out` and `err` so a test needs no
 * network, no process environment and no console.
 */
async function main(argv = process.argv.slice(2), io = {}) {
  const env = io.env || process.env;
  const fetchImpl = io.fetch || globalThis.fetch;
  const out = io.out || ((line) => console.log(line));
  const err = io.err || ((line) => console.error(line));

  const project = parseProject(argv);
  if (!project) {
    err(USAGE);
    return 1;
  }

  const token = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const say = (line) => out(`${LINE_PREFIX}${scrub(line, [accountId, token])}`);

  if (!token || !accountId) {
    say('Cloudflare secrets are not available to this run (a fork\'s pull request, or unset): nothing to check');
    return 0;
  }

  say(`checking the deploy target for Pages project ${project}`);
  const account = `/client/v4/accounts/${encodeURIComponent(accountId)}`;
  const [accountAnswer, accountsAnswer, projectAnswer] = await Promise.all([
    get(fetchImpl, account, token),
    get(fetchImpl, '/client/v4/accounts?per_page=50', token),
    get(fetchImpl, `${account}/pages/projects/${encodeURIComponent(project)}`, token),
  ]);

  const report = summarizeTarget(
    { account: accountAnswer, accounts: accountsAnswer, pagesProject: projectAnswer },
    { accountId, project, token }
  );
  for (const line of report.lines) say(line);
  return 0;
}

module.exports = { scrub, summarizeTarget, main };

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      // A diagnostic never fails the job; the deploy step is the gate.
      console.error(`${LINE_PREFIX}${scrub(e && e.message ? e.message : e, [process.env.CLOUDFLARE_ACCOUNT_ID, process.env.CLOUDFLARE_API_TOKEN])}`);
      process.exitCode = 0;
    }
  );
}
