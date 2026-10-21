'use strict';
// Tests for scripts/eval81/lib/secret.cjs (TRD 81-01, test list 13-16). The token is a fake literal written into an
// mkdtemp directory; no real token file is read, no network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const load = () => require('./secret.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-secret-'));

const TOKEN = 'fake-token-81-01-0123456789abcdef';

describe('readToken', () => {
  test('13. returns the trimmed contents; a missing or empty file throws naming the path only', () => {
    const { readToken } = load();
    const dir = tmp();
    const file = path.join(dir, 'token');
    fs.writeFileSync(file, `  ${TOKEN}\n`);
    assert.equal(readToken(file), TOKEN);

    const missing = path.join(dir, 'nope');
    assert.throws(() => readToken(missing), (err) => err.message.includes(missing));

    const empty = path.join(dir, 'empty');
    fs.writeFileSync(empty, ' \n\t\n');
    assert.throws(() => readToken(empty), (err) => err.message.includes(empty) && /empty/.test(err.message));

    // A read failure other than ENOENT names the path and the code, never contents.
    assert.throws(() => readToken(dir), (err) => err.message.includes(dir) && !err.message.includes(TOKEN));
  });
});

describe('childEnv', () => {
  test('14. builds the child env from the allowlist and drops the parent session variables', () => {
    const { childEnv } = load();
    const parentEnv = {
      PATH: '/usr/bin:/bin',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      TERM: 'xterm-256color',
      USER: 'u',
      LOGNAME: 'u',
      SHELL: '/bin/zsh',
      HOME: '/real/home',
      TMPDIR: '/real/tmp',
      CLAUDE_CONFIG_DIR: '/real/cfg',
      ANTHROPIC_API_KEY: 'key',
      ANTHROPIC_AUTH_TOKEN: 'auth',
      ANTHROPIC_BASE_URL: 'https://example.invalid',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
      CLAUDE_CODE_OAUTH_TOKEN: 'parent-token',
      AOFORGE_MODEL_PROFILE: 'quality',
      AOFORGE_SKIP_PRUNE: '1',
      NODE_OPTIONS: '--inspect',
    };
    const env = childEnv({
      home: '/sbx/home',
      configDir: '/sbx/home/.claude',
      tmpdir: '/sbx/tmp',
      token: TOKEN,
      extra: { AOFORGE_SKIP_EDIT_GATE: '1' },
      parentEnv,
    });
    assert.deepEqual(env, {
      PATH: '/usr/bin:/bin',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      TERM: 'xterm-256color',
      USER: 'u',
      LOGNAME: 'u',
      SHELL: '/bin/zsh',
      HOME: '/sbx/home',
      CLAUDE_CONFIG_DIR: '/sbx/home/.claude',
      TMPDIR: '/sbx/tmp',
      CLAUDE_CODE_OAUTH_TOKEN: TOKEN,
      AOFORGE_SKIP_EDIT_GATE: '1',
    });
    // A parent missing an allowlisted variable leaves it out rather than setting undefined.
    const sparse = childEnv({ home: '/h', configDir: '/c', tmpdir: '/t', token: TOKEN, parentEnv: { PATH: '/bin' } });
    assert.deepEqual(Object.keys(sparse).sort(), ['CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR', 'HOME', 'PATH', 'TMPDIR']);
  });

  test('a non-allowlisted extra or a missing setting throws without the token in the message', () => {
    const { childEnv } = load();
    const base = { home: '/h', configDir: '/c', tmpdir: '/t', token: TOKEN, parentEnv: {} };
    assert.throws(() => childEnv({ ...base, extra: { ANTHROPIC_API_KEY: 'x' } }), /ANTHROPIC_API_KEY/);
    assert.throws(() => childEnv({ ...base, extra: { AOFORGE_SKIP_EDIT_GATE: '0' } }), /AOFORGE_SKIP_EDIT_GATE/);
    assert.throws(() => childEnv({ ...base, home: '' }), (err) => /home/.test(err.message) && !err.message.includes(TOKEN));
    assert.throws(() => childEnv({ ...base, token: '' }), /token/);
  });
});

describe('redact and scanForSecret', () => {
  test('15. redact replaces every occurrence, in a string and in a serialised env', () => {
    const { redact, childEnv } = load();
    assert.equal(redact(`a ${TOKEN} b ${TOKEN}c`, TOKEN), 'a <redacted> b <redacted>c');
    const env = childEnv({ home: '/h', configDir: '/c', tmpdir: '/t', token: TOKEN, parentEnv: {} });
    const out = redact(JSON.stringify(env), TOKEN);
    assert.equal(out.includes(TOKEN), false);
    assert.ok(out.includes('"CLAUDE_CODE_OAUTH_TOKEN":"<redacted>"'));
    // A token with regex metacharacters is matched literally.
    assert.equal(redact('x a.b+c y', 'a.b+c'), 'x <redacted> y');
    assert.equal(redact('axb', 'a.b'), 'axb');
  });

  test('16. scanForSecret lists each file holding the token, text and binary; a single file gives its basename', () => {
    const { scanForSecret } = load();
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'a.txt'), `token=${TOKEN}\n`);
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'b.bin'), Buffer.concat([Buffer.from([0, 255, 1]), Buffer.from(TOKEN), Buffer.from([0, 0])]));
    fs.writeFileSync(path.join(dir, 'c.txt'), 'clean\n');
    fs.symlinkSync(path.join(dir, 'a.txt'), path.join(dir, 'link.txt'));
    assert.deepEqual(scanForSecret(dir, TOKEN), ['a.txt', 'sub/b.bin']);

    const clean = tmp();
    fs.writeFileSync(path.join(clean, 'x.json'), '{}');
    assert.deepEqual(scanForSecret(clean, TOKEN), []);

    assert.deepEqual(scanForSecret(path.join(dir, 'a.txt'), TOKEN), ['a.txt']);
    assert.deepEqual(scanForSecret(path.join(dir, 'c.txt'), TOKEN), []);
    assert.throws(() => scanForSecret(dir, ''), /token/);
  });

  test('secret.cjs never logs', () => {
    const src = fs.readFileSync(path.join(__dirname, 'secret.cjs'), 'utf-8');
    assert.equal(/console\./.test(src), false);
    assert.equal(/process\.(stdout|stderr)/.test(src), false);
  });
});
