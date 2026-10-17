'use strict';
// Tests for lib/opaque.cjs (post-hoc 3, TRD 81-17, user 2026-10-17): no path handed to a run may name the user or the
// checkout, even after fs.realpathSync. The literal tokens the user named are `justin`, `aoforge-claude` and `Users-`;
// forbiddenTokens derives exactly those from this machine's real home and checkout, and opaqueViolations finds them in
// any component of a path's real form (a symlink with a clean name that resolves into a named directory is caught).
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { forbiddenTokens, opaqueViolations } = require('./opaque.cjs');

// Under an opaque base (EVAL81_OPAQUE_TMP, default the real /tmp): os.tmpdir() may be a scratchpad that names the user.
const OPAQUE_BASE = fs.realpathSync(process.env.EVAL81_OPAQUE_TMP || '/tmp');
const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(OPAQUE_BASE, 'e81o-')));
  made.push(d);
  return d;
};

describe('forbiddenTokens', () => {
  test('1. this machine: /Users/justin and /Users/justin/dev/aoforge-claude give justin, aoforge-claude and Users-', () => {
    assert.deepEqual(forbiddenTokens({ realHome: '/Users/justin', repo: '/Users/justin/dev/aoforge-claude' }), ['justin', 'aoforge-claude', 'Users-']);
  });

  test('2. a home directly under / adds no dash token; duplicates and empty names are dropped', () => {
    assert.deepEqual(forbiddenTokens({ realHome: '/root', repo: '/root/root' }), ['root']);
    assert.deepEqual(forbiddenTokens({ realHome: '/home/ann', repo: '/srv/proj' }), ['ann', 'proj', 'home-']);
  });

  test('3. both inputs are required absolute paths', () => {
    assert.throws(() => forbiddenTokens({ realHome: 'justin', repo: '/x/y' }), /absolute/);
    assert.throws(() => forbiddenTokens({ realHome: '/Users/justin' }), /absolute/);
  });
});

describe('opaqueViolations', () => {
  const TOKENS = ['justin', 'aoforge-claude', 'Users-'];

  test('4. an opaque path has no violations; each entry is reported with its real form', () => {
    const base = tmp();
    const dir = path.join(base, 'e81-0f3a', 'runs', 'E', 'q30-r2', 'work');
    fs.mkdirSync(dir, { recursive: true });
    const out = opaqueViolations([{ what: 'cwd', path: dir }], ['zz-not-there']);
    assert.deepEqual(out.violations, []);
    assert.deepEqual(out.checked, [{ what: 'cwd', path: dir, real: fs.realpathSync(dir) }]);
  });

  test('5. the scratchpad-style component names all three tokens', () => {
    const p = '/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/abc/scratchpad/eval81/runs/E/q30-r1/work';
    const out = opaqueViolations([{ what: 'cwd', path: p }], TOKENS);
    assert.deepEqual(out.violations.map((v) => v.token).sort(), ['Users-', 'aoforge-claude', 'justin'].sort());
    assert.ok(out.violations.every((v) => v.what === 'cwd' && v.component === '-Users-justin-dev-aoforge-claude'));
  });

  test('6. a clean symlink that resolves into a named directory is caught after realpath', () => {
    const base = tmp();
    const named = path.join(base, 'justin', 'real-work');
    fs.mkdirSync(named, { recursive: true });
    const clean = path.join(base, 'e81-1b2c');
    fs.mkdirSync(clean);
    const link = path.join(clean, 'work');
    fs.symlinkSync(named, link);
    const out = opaqueViolations([{ what: 'HOME', path: link }], ['justin']);
    assert.equal(out.violations.length, 1);
    assert.equal(out.violations[0].what, 'HOME');
    assert.equal(out.violations[0].real, fs.realpathSync(link));
    assert.equal(out.violations[0].component, 'justin');
  });

  test('7. matching is case-insensitive and covers every component; null entries are skipped', () => {
    const out = opaqueViolations([
      { what: 'a', path: '/x/JUSTIN-files/y' },
      { what: 'b', path: '/x/y/MyAOForge-Claude' },
      { what: 'c', path: null },
    ], TOKENS);
    assert.deepEqual(out.violations.map((v) => `${v.what}:${v.token}`), ['a:justin', 'b:aoforge-claude']);
    assert.equal(out.checked.length, 2);
  });
});
