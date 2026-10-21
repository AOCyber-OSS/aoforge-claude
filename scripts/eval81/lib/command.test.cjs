'use strict';
// Tests for scripts/eval81/lib/command.cjs (TRD 81-08, test list 14). Pure: no spawn, no file system beyond mkdtemp.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const load = () => require('./command.cjs');

function desc(over = {}) {
  return {
    id: 'A-1',
    batch: 'A',
    kind: 'agent',
    agent: 'aoforge:verifier',
    model: 'haiku',
    plugin: '3.1.0',
    prompt: 'Verify objective 2.',
    tools: null,
    jsonSchema: null,
    capUsd: 0.5,
    timeoutMs: 60000,
    env: {},
    fixture: null,
    order: 0,
    role: 'verifier',
    ...over,
  };
}

const flagValues = (argv, flag) => argv.flatMap((a, i) => (a === flag ? [argv[i + 1]] : []));

describe('buildArgv', () => {
  test('14. the print-mode flags, the cap as a decimal string, --agent only for kind agent, one --plugin-dir per dir', () => {
    const { buildArgv } = load();
    const argv = buildArgv(desc(), { pluginDirs: ['/t/v3.1.0/plugins/aoforge', '/t/extra'], settingsPath: '/r/settings.json' });
    assert.equal(argv[0], '-p');
    assert.deepEqual(argv.slice(-2), ['--', 'Verify objective 2.'], 'the prompt is last, after --');
    assert.deepEqual(flagValues(argv, '--output-format'), ['stream-json']);
    assert.ok(argv.includes('--verbose'));
    assert.deepEqual(flagValues(argv, '--model'), ['haiku']);
    assert.deepEqual(flagValues(argv, '--max-budget-usd'), ['0.5']);
    assert.deepEqual(flagValues(argv, '--permission-mode'), ['bypassPermissions']);
    assert.deepEqual(flagValues(argv, '--settings'), ['/r/settings.json']);
    assert.deepEqual(flagValues(argv, '--plugin-dir'), ['/t/v3.1.0/plugins/aoforge', '/t/extra']);
    assert.deepEqual(flagValues(argv, '--agent'), ['aoforge:verifier']);
    assert.equal(argv.includes('--tools'), false, 'tools: null omits the flag');
    assert.equal(argv.includes('--json-schema'), false);

    const prompt = buildArgv(desc({ kind: 'prompt', agent: null, plugin: null }), { pluginDirs: [] });
    assert.equal(prompt.includes('--agent'), false);
    assert.equal(prompt.includes('--plugin-dir'), false);
    assert.equal(prompt.includes('--settings'), false, 'no settingsPath, no --settings');
  });

  test('14. --tools joined with commas ("" for []), --json-schema as JSON, caps formatted without exponent or float noise', () => {
    const { buildArgv } = load();
    assert.deepEqual(flagValues(buildArgv(desc({ tools: ['Read', 'Bash'] })), '--tools'), ['Read,Bash']);
    assert.deepEqual(flagValues(buildArgv(desc({ kind: 'prompt', agent: null, tools: [] })), '--tools'), ['']);
    const schema = { type: 'object', properties: { verdict: { type: 'string' } } };
    assert.deepEqual(flagValues(buildArgv(desc({ jsonSchema: schema })), '--json-schema'), [JSON.stringify(schema)]);
    assert.deepEqual(flagValues(buildArgv(desc({ capUsd: 15 })), '--max-budget-usd'), ['15']);
    assert.deepEqual(flagValues(buildArgv(desc({ capUsd: 0.1 + 0.2 })), '--max-budget-usd'), ['0.3']);
    assert.deepEqual(flagValues(buildArgv(desc({ capUsd: 0.000123 })), '--max-budget-usd'), ['0.000123']);
  });

  test('14. never carries the token: the argv is built from the descriptor alone', () => {
    const { buildArgv } = load();
    const token = 'fake-token-81-08-abcdef';
    const argv = buildArgv(desc({ env: { AOFORGE_SKIP_PRUNE: '1' } }), { pluginDirs: [] });
    assert.equal(argv.some((a) => a.includes(token)), false);
    assert.equal(argv.some((a) => /OAUTH|AOFORGE_SKIP/.test(a)), false, 'env never goes into argv');
  });

  test('refuses an agent run with no agent and an invalid cap', () => {
    const { buildArgv } = load();
    assert.throws(() => buildArgv(desc({ agent: null })), /agent/);
    assert.throws(() => buildArgv(desc({ capUsd: 0 })), /capUsd/);
  });
});

describe('denyRoots and buildSettings', () => {
  test('14. denyRoots: dirname(repo), <realHome>/.claude and every watched repo, absolute and deduped; a relative path throws', () => {
    const { denyRoots } = load();
    const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-cmd-')));
    const repo = path.join(base, 'dev', 'repo');
    const home = path.join(base, 'home');
    const fleet = path.join(base, 'fleet', 'src');
    assert.deepEqual(denyRoots({ repo, realHome: home, watched: [fleet, { label: 'fleet', path: fleet }, `${path.join(base, 'dev')}/`] }), [
      path.join(base, 'dev'),
      path.join(home, '.claude'),
      fleet,
    ]);
    assert.throws(() => denyRoots({ repo: 'dev/repo', realHome: home }), /absolute/);
    assert.throws(() => denyRoots({ repo, realHome: home, watched: ['rel/fleet'] }), /absolute/);
  });

  test('14. buildSettings: exactly {permissions: {deny}} with Read, Edit and Write per root in //abs/** form', () => {
    const { buildSettings } = load();
    assert.deepEqual(buildSettings(['/u/dev', '/u/.claude']), {
      permissions: {
        deny: [
          'Read(//u/dev/**)', 'Edit(//u/dev/**)', 'Write(//u/dev/**)',
          'Read(//u/.claude/**)', 'Edit(//u/.claude/**)', 'Write(//u/.claude/**)',
        ],
      },
    });
    assert.throws(() => buildSettings(['relative']), /absolute/);
  });

  test('underDenyRoot reports the root a path lies under (itself included), else null', () => {
    const { underDenyRoot } = load();
    assert.equal(underDenyRoot('/u/dev/repo/x', ['/u/.claude', '/u/dev']), '/u/dev');
    assert.equal(underDenyRoot('/u/dev', ['/u/dev']), '/u/dev');
    assert.equal(underDenyRoot('/u/development', ['/u/dev']), null, 'a sibling with the same prefix is not under it');
    assert.equal(underDenyRoot('/tmp/eval', ['/u/dev']), null);
  });
});
