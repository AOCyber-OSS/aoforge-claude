'use strict';

/**
 * Tests for the Cloudflare deploy-target report (objective 74, TRD 74-02).
 *
 * The script exists so that a public CI log can say which Cloudflare account a deploy
 * targets, by name, without ever printing an account id or a token. The property that
 * matters most is therefore the negative one (cases 7 and 10): no id, no token, no 32-hex
 * string may reach stdout or stderr. No case touches the network: `fetch` is injected and
 * built from the fixture module.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { scrub, summarizeTarget, main } = require('./ci-cloudflare-target.cjs');
const fx = require('./__fixtures__/cloudflare-api-fixtures.cjs');

const PREFIX = 'cloudflare target: ';
const ACCOUNT_PATH = `/client/v4/accounts/${fx.ACCOUNT_ID}`;
const ACCOUNTS_PATH = '/client/v4/accounts';
// The one Pages project the deploy targets, read directly: Cloudflare refused the project
// listing with `per_page=100` (code 8000024, run 39595433242), so the script never lists.
const PROJECT_PATH = `/client/v4/accounts/${fx.ACCOUNT_ID}/pages/projects/aoforge-docs`;
const LIST_PATH = `/client/v4/accounts/${fx.ACCOUNT_ID}/pages/projects`;

const SECRETS = { CLOUDFLARE_API_TOKEN: fx.TOKEN, CLOUDFLARE_ACCOUNT_ID: fx.ACCOUNT_ID };

// A token scoped to Pages only (no Account Settings: Read), as in run 39595433242: the
// account read is refused with 9109 and the account list comes back empty, yet the token
// reaches the Pages project and the deploy succeeds.
const NO_ACCOUNT_READ = fx.errorResponse(9109, 'Unauthorized to access requested resource');
const OUT_OF_REACH = /out(side)? of (this token's )?reach|cannot see the configured account/;

/** Run `main` with an injected fetch; collect what it printed and which calls it made. */
async function run(argv, { env = SECRETS, routes = {} } = {}) {
  const fetch = fx.fakeFetch(routes);
  const out = [];
  const err = [];
  const code = await main(argv, {
    env,
    fetch,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { code, out, err, calls: fetch.calls, text: [...out, ...err].join('\n') };
}

/** Routes for an account the token can see; the Pages project exists unless `present` is false. */
function healthyRoutes({ present = true } = {}) {
  return {
    [ACCOUNT_PATH]: fx.accountResponse('Example Account'),
    [ACCOUNTS_PATH]: fx.accountsResponse([
      { id: fx.ACCOUNT_ID, name: 'Example Account' },
      { id: fx.OTHER_ACCOUNT_ID, name: 'Other Account' },
    ]),
    [PROJECT_PATH]: present ? fx.projectResponse('aoforge-docs') : fx.projectNotFoundResponse(),
  };
}

const ARGV = ['--project', 'aoforge-docs'];

describe('ci-cloudflare-target main', () => {
  test('1a. no CLOUDFLARE_API_TOKEN: says the secrets are not available, exits 0, never calls the API', async () => {
    const r = await run(ARGV, { env: { CLOUDFLARE_ACCOUNT_ID: fx.ACCOUNT_ID } });
    assert.equal(r.code, 0);
    assert.equal(r.calls.length, 0);
    assert.match(
      r.text,
      /Cloudflare secrets are not available to this run \(a fork's pull request, or unset\): nothing to check/
    );
  });

  test('1b. no CLOUDFLARE_ACCOUNT_ID, or empty secrets: same, exit 0, no fetch', async () => {
    for (const env of [{ CLOUDFLARE_API_TOKEN: fx.TOKEN }, { CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '' }, {}]) {
      const r = await run(ARGV, { env });
      assert.equal(r.code, 0);
      assert.equal(r.calls.length, 0);
      assert.match(r.text, /not available to this run/);
    }
  });

  test('2. account visible, project present: names the account, the count of others, and the project with its production branch and subdomain', async () => {
    const r = await run(ARGV, { routes: healthyRoutes() });
    assert.equal(r.code, 0);
    assert.match(r.text, /account: Example Account/);
    assert.match(r.text, /other accounts the token can see: 1\b/);
    assert.match(
      r.text,
      /Pages project aoforge-docs: present \(production branch main, subdomain aoforge-docs\.pages\.dev\)/
    );
    assert.doesNotMatch(r.text, /ABSENT/);
    assert.doesNotMatch(r.text, OUT_OF_REACH);
    // Only a count of the other accounts is printed, never the name of one.
    assert.doesNotMatch(r.text, /Other Account/);
  });

  test('2c. the project line names what the API answered, not only what was asked', async () => {
    const routes = {
      ...healthyRoutes(),
      [PROJECT_PATH]: fx.projectResponse('aoforge-docs', { productionBranch: 'release', subdomain: 'aoforge-docs-x1.pages.dev' }),
    };
    const r = await run(ARGV, { routes });
    assert.match(
      r.text,
      /Pages project aoforge-docs: present \(production branch release, subdomain aoforge-docs-x1\.pages\.dev\)/
    );
  });

  test('2b. every printed line carries the "cloudflare target: " prefix so a run log can be grepped', async () => {
    const r = await run(ARGV, { routes: healthyRoutes() });
    assert.ok(r.out.length > 0);
    for (const line of r.out) assert.ok(line.startsWith(PREFIX), `unprefixed line: ${line}`);
  });

  test('3. project not found (code 8000007): says ABSENT in this account and how to create it', async () => {
    const r = await run(ARGV, { routes: healthyRoutes({ present: false }) });
    assert.equal(r.code, 0);
    assert.match(r.text, /aoforge-docs: ABSENT in this account/);
    assert.match(r.text, /Pages/);
    assert.match(r.text, /Create/);
    assert.match(r.text, /Direct upload/);
    assert.match(r.text, /production branch main/);
    assert.doesNotMatch(r.text, /aoforge-docs: present/);
    assert.doesNotMatch(r.text, OUT_OF_REACH);
  });

  test('4. account read refused (9109) and the project read refused too: says the account is out of reach, with both codes', async () => {
    const routes = {
      [ACCOUNT_PATH]: NO_ACCOUNT_READ,
      [ACCOUNTS_PATH]: fx.accountsResponse([{ id: fx.OTHER_ACCOUNT_ID, name: 'Other Account' }]),
      [PROJECT_PATH]: fx.errorResponse(10000, 'Authentication error'),
    };
    const r = await run(ARGV, { routes });
    assert.equal(r.code, 0);
    assert.match(r.text, /account: could not be read: code 9109/);
    assert.match(r.text, /Pages project aoforge-docs could not be read: code 10000 Authentication error/);
    assert.match(r.text, /the token cannot see the configured account/);
    assert.match(r.text, /outside this token's reach/);
    assert.doesNotMatch(r.text, /aoforge-docs: present/);
    assert.doesNotMatch(r.text, /ABSENT/);
    assert.doesNotMatch(r.text, /Other Account/);
  });

  test('4b. account read refused (9109) but the project reachable (a Pages-only token, run 39595433242): says so, and never claims the account is out of reach', async () => {
    const routes = {
      [ACCOUNT_PATH]: NO_ACCOUNT_READ,
      [ACCOUNTS_PATH]: fx.accountsResponse([]),
      [PROJECT_PATH]: fx.projectResponse('aoforge-docs'),
    };
    const r = await run(ARGV, { routes });
    assert.equal(r.code, 0);
    assert.match(
      r.text,
      /account: name not readable \(the token lacks Account Settings: Read\); Pages project aoforge-docs is reachable in the configured account/
    );
    assert.match(
      r.text,
      /Pages project aoforge-docs: present \(production branch main, subdomain aoforge-docs\.pages\.dev\)/
    );
    assert.doesNotMatch(r.text, OUT_OF_REACH);
    assert.doesNotMatch(r.text, /account: could not be read/);
    assert.doesNotMatch(r.text, /ABSENT/);
  });

  test('4c. account read refused (9109) and the project not found: says ABSENT, but does not claim the account is out of reach', async () => {
    const routes = {
      [ACCOUNT_PATH]: NO_ACCOUNT_READ,
      [ACCOUNTS_PATH]: fx.accountsResponse([]),
      [PROJECT_PATH]: fx.projectNotFoundResponse(),
    };
    const r = await run(ARGV, { routes });
    assert.equal(r.code, 0);
    assert.match(r.text, /account: could not be read: code 9109/);
    assert.match(r.text, /aoforge-docs: ABSENT in this account/);
    // Either the project is missing or the id names another account; the log must not pick one.
    assert.match(r.text, /cannot tell/);
    assert.doesNotMatch(r.text, /the token cannot see the configured account/);
    assert.doesNotMatch(r.text, /aoforge-docs: present/);
  });

  test('5. project read refused with the account readable: reports the code and message, no ABSENT, no out-of-reach claim, exits 0', async () => {
    const routes = { ...healthyRoutes(), [PROJECT_PATH]: fx.errorResponse(10000, 'Authentication error') };
    const r = await run(ARGV, { routes });
    assert.equal(r.code, 0);
    assert.match(r.text, /Pages project aoforge-docs could not be read: code 10000 Authentication error/);
    assert.doesNotMatch(r.text, /aoforge-docs: present/);
    assert.doesNotMatch(r.text, /ABSENT/);
    assert.doesNotMatch(r.text, OUT_OF_REACH);
  });

  test('6. fetch throws (network down): reports "Cloudflare API unreachable: <message>" once, exits 0', async () => {
    const down = new Error('getaddrinfo ENOTFOUND api.cloudflare.com');
    const routes = { [ACCOUNT_PATH]: down, [ACCOUNTS_PATH]: down, [PROJECT_PATH]: down };
    const r = await run(ARGV, { routes });
    assert.equal(r.code, 0);
    assert.match(r.text, /Cloudflare API unreachable: getaddrinfo ENOTFOUND api\.cloudflare\.com/);
    assert.equal(r.out.filter((l) => l.includes('unreachable')).length, 1);
  });

  test('6b. an unreadable (non-JSON) response is reported, not thrown', async () => {
    const fetch = async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } });
    const out = [];
    const code = await main(ARGV, { env: SECRETS, fetch, out: (l) => out.push(l), err: () => {} });
    assert.equal(code, 0);
    assert.match(out.join('\n'), /Cloudflare API unreachable: HTTP 502, response was not JSON/);
  });

  test('7. no case prints the account id, the other account id, the token or any 32-hex run', async () => {
    // An error message that echoes the request URL and the token, as an API or proxy can.
    const echo = fx.errorResponse(
      7003,
      `Could not route to /client/v4/accounts/${fx.ACCOUNT_ID}/pages/projects/aoforge-docs (token ${fx.TOKEN})`
    );
    const scenarios = [
      { routes: healthyRoutes() },
      { routes: healthyRoutes({ present: false }) },
      {
        routes: {
          [ACCOUNT_PATH]: echo,
          [ACCOUNTS_PATH]: fx.accountsResponse([{ id: fx.OTHER_ACCOUNT_ID, name: 'Other Account' }]),
          [PROJECT_PATH]: echo,
        },
      },
      {
        routes: {
          [ACCOUNT_PATH]: echo,
          [ACCOUNTS_PATH]: fx.accountsResponse([]),
          [PROJECT_PATH]: fx.projectResponse('aoforge-docs'),
        },
      },
      { routes: { ...healthyRoutes(), [PROJECT_PATH]: fx.errorResponse(10000, 'Authentication error') } },
      {
        // An id the run was never given (so only the 32-hex rule can catch it).
        routes: {
          ...healthyRoutes(),
          [PROJECT_PATH]: fx.errorResponse(7003, `No route for /client/v4/accounts/${fx.OTHER_ACCOUNT_ID}/pages/projects/aoforge-docs`),
        },
      },
      {
        routes: {
          [ACCOUNT_PATH]: new Error(`request to https://api.cloudflare.com${ACCOUNT_PATH} failed, token ${fx.TOKEN}`),
          [ACCOUNTS_PATH]: new Error('socket hang up'),
          [PROJECT_PATH]: new Error('socket hang up'),
        },
      },
      { routes: {}, env: {} },
      { routes: {}, env: { CLOUDFLARE_API_TOKEN: fx.TOKEN } },
    ];
    for (const scenario of scenarios) {
      const r = await run(ARGV, scenario);
      assert.equal(r.code, 0);
      assert.ok(r.text.length > 0);
      assert.ok(!r.text.includes(fx.ACCOUNT_ID), `account id leaked:\n${r.text}`);
      assert.ok(!r.text.includes(fx.OTHER_ACCOUNT_ID), `other account id leaked:\n${r.text}`);
      assert.ok(!r.text.includes(fx.TOKEN), `token leaked:\n${r.text}`);
      assert.doesNotMatch(r.text, /[0-9a-f]{32}/i, `a 32-hex string leaked:\n${r.text}`);
    }
  });

  test('8. missing --project: usage on stderr, exit 1, nothing fetched', async () => {
    for (const argv of [[], ['--project'], ['--project', '']]) {
      const r = await run(argv, { routes: healthyRoutes() });
      assert.equal(r.code, 1);
      assert.equal(r.calls.length, 0);
      assert.equal(r.out.length, 0);
      assert.match(r.err.join('\n'), /usage: .*--project <name>/i);
    }
  });

  test('8b. --project=<name> is accepted', async () => {
    const r = await run(['--project=aoforge-docs'], { routes: healthyRoutes() });
    assert.equal(r.code, 0);
    assert.match(r.text, /aoforge-docs: present/);
  });

  test('9. three GET requests, each with the bearer token, to the three documented endpoints', async () => {
    const r = await run(ARGV, { routes: healthyRoutes() });
    assert.equal(r.calls.length, 3);
    for (const call of r.calls) {
      assert.equal(call.method, 'GET');
      assert.equal(call.headers.Authorization, `Bearer ${fx.TOKEN}`);
      assert.ok(call.url.startsWith('https://api.cloudflare.com/client/v4/'), call.url);
    }
    assert.deepEqual(r.calls.map((c) => c.path).sort(), [ACCOUNT_PATH, ACCOUNTS_PATH, PROJECT_PATH].sort());
    const accountsCall = r.calls.find((c) => c.path === ACCOUNTS_PATH);
    assert.equal(new URL(accountsCall.url).searchParams.get('per_page'), '50');
    // The project is read directly, with no pagination parameter for Cloudflare to refuse.
    const projectCall = r.calls.find((c) => c.path === PROJECT_PATH);
    assert.equal(new URL(projectCall.url).search, '');
  });

  test('9b. the project name is one encoded path segment', async () => {
    const r = await run(['--project', 'docs/../x y'], { routes: healthyRoutes() });
    assert.equal(r.code, 0);
    assert.ok(
      r.calls.some((c) => c.url === `https://api.cloudflare.com${LIST_PATH}/docs%2F..%2Fx%20y`),
      r.calls.map((c) => c.url).join('\n')
    );
  });

  test('11. the Pages project list is never requested (Cloudflare refused it with code 8000024 on per_page=100)', async () => {
    const r = await run(ARGV, { routes: healthyRoutes() });
    assert.ok(r.calls.every((c) => c.path !== LIST_PATH), r.calls.map((c) => c.url).join('\n'));
    assert.ok(r.calls.every((c) => new URL(c.url).searchParams.get('per_page') !== '100'));
    assert.doesNotMatch(r.text, /could not be listed: code 8000024/);
  });
});

describe('ci-cloudflare-target summarizeTarget', () => {
  const ids = { accountId: fx.ACCOUNT_ID, token: fx.TOKEN, project: 'aoforge-docs' };

  test('12. reports accountVisible and projectPresent alongside the lines', () => {
    const present = summarizeTarget(
      {
        account: fx.accountResponse(),
        accounts: fx.accountsResponse([{ id: fx.ACCOUNT_ID, name: 'Example Account' }]),
        pagesProject: fx.projectResponse('aoforge-docs'),
      },
      ids
    );
    assert.equal(present.accountVisible, true);
    assert.equal(present.projectPresent, true);
    assert.ok(Array.isArray(present.lines) && present.lines.length > 0);

    const absent = summarizeTarget(
      {
        account: fx.accountResponse(),
        accounts: fx.accountsResponse([{ id: fx.ACCOUNT_ID, name: 'Example Account' }]),
        pagesProject: fx.projectNotFoundResponse(),
      },
      ids
    );
    assert.equal(absent.accountVisible, true);
    assert.equal(absent.projectPresent, false);
  });

  test('12c. a Pages-only token: the project read alone proves the account is reachable', () => {
    const r = summarizeTarget(
      { account: NO_ACCOUNT_READ, accounts: fx.accountsResponse([]), pagesProject: fx.projectResponse('aoforge-docs') },
      ids
    );
    assert.equal(r.accountVisible, true);
    assert.equal(r.projectPresent, true);
  });

  test('12d. both reads refused: the account is out of reach; refused then not found: undecided', () => {
    const refused = summarizeTarget(
      {
        account: NO_ACCOUNT_READ,
        accounts: fx.accountsResponse([{ id: fx.OTHER_ACCOUNT_ID, name: 'Other Account' }]),
        pagesProject: fx.errorResponse(10000, 'Authentication error'),
      },
      ids
    );
    assert.equal(refused.accountVisible, false);
    assert.equal(refused.projectPresent, null);

    const notFound = summarizeTarget(
      { account: NO_ACCOUNT_READ, accounts: fx.accountsResponse([]), pagesProject: fx.projectNotFoundResponse() },
      ids
    );
    assert.equal(notFound.accountVisible, null);
    assert.equal(notFound.projectPresent, false);
  });

  test('12b. a failed section reports an error with no account id even when the message echoes one', () => {
    const r = summarizeTarget(
      {
        account: { error: `connect ECONNREFUSED ${fx.ACCOUNT_ID}` },
        accounts: { error: 'x' },
        pagesProject: { error: 'x' },
      },
      ids
    );
    assert.ok(r.lines.length > 0);
    assert.ok(r.lines.every((l) => !l.includes(fx.ACCOUNT_ID)));
  });
});

describe('ci-cloudflare-target scrub', () => {
  test('10. replaces every 32-hex run with <id> and every given secret with <redacted>', () => {
    const hex = '0123456789abcdef0123456789abcdef';
    const text = `GET /accounts/${hex}/pages failed for ${hex} with cf-test-token-not-real, again cf-test-token-not-real`;
    const cleaned = scrub(text, ['cf-test-token-not-real']);
    assert.equal(cleaned, 'GET /accounts/<id>/pages failed for <id> with <redacted>, again <redacted>');
  });

  test('10b. scrubs a Cloudflare error message that echoes the URL, and ignores empty secrets', () => {
    const msg = `Could not route to /client/v4/accounts/${fx.ACCOUNT_ID}/pages/projects`;
    assert.equal(scrub(msg, ['', undefined, null]), 'Could not route to /client/v4/accounts/<id>/pages/projects');
    assert.equal(scrub('nothing to hide'), 'nothing to hide');
  });

  test('10c. a secret that is itself 32 hex characters is redacted, not left as an id marker', () => {
    assert.equal(scrub(`id ${fx.ACCOUNT_ID}`, [fx.ACCOUNT_ID]), 'id <redacted>');
  });
});
