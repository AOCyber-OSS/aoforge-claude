'use strict';
// Tests for lib/access.cjs (post-hoc 4, TRD 81-18, user 2026-10-17, "Reclassify + re-run impaired"):
//   (a) a denial of a path the agent addressed with `~` (the CLI checks it against the real home) and an access to a
//       non-existent guessed path are non-escapes, recorded by class with the username redacted;
//   (b) any attempt, allowed or denied, on an EXISTING real path outside the sandbox (the real home, its parent, a deny
//       root, the eval root, or anything whose real path names the user or the checkout) other than via `~` is a real
//       escape;
//   (c) a run whose denial blocked its own runtime files (`~/.claude/...`) is impaired.
// Bash commands are read with shell-words.parseCommand: heredoc bodies, echo/printf arguments, grep patterns and
// interpreter scripts are data, never accesses.
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { bashPathWords, toolPaths, classifyPath, scanAccess, redactPath } = require('./access.cjs');

const OPAQUE_BASE = fs.realpathSync(process.env.EVAL81_OPAQUE_TMP || '/tmp');
const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

/** A world: <base>/Users/justin (the stand-in real home, with a real runtime file), <base>/Users/justin/dev/aoforge-claude
 * (the checkout), <base>/eval (R), and an opaque sandbox <opaque>/runs/C/id. */
function world() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-acc-')));
  const sbase = fs.realpathSync(fs.mkdtempSync(path.join(OPAQUE_BASE, 'e81a-')));
  made.push(base, sbase);
  const realHome = path.join(base, 'Users', 'justin');
  const repo = path.join(realHome, 'dev', 'aoforge-claude');
  fs.mkdirSync(path.join(realHome, '.claude', 'aoforge', 'references'), { recursive: true });
  fs.writeFileSync(path.join(realHome, '.claude', 'aoforge', 'references', 'tdd.md'), 'real\n');
  fs.mkdirSync(repo, { recursive: true });
  const evalRoot = path.join(base, 'eval');
  fs.mkdirSync(evalRoot);
  const sandboxDir = path.join(sbase, 'runs', 'C', 'C-map-arch-b-s-1');
  fs.mkdirSync(path.join(sandboxDir, 'work'), { recursive: true });
  fs.mkdirSync(path.join(sandboxDir, 'home', '.claude', 'aoforge', 'templates'), { recursive: true });
  const ctx = {
    realHome,
    insideDirs: [sandboxDir],
    protectedRoots: [path.join(realHome, 'dev'), path.join(realHome, '.claude'), evalRoot],
    protectedExact: [path.dirname(realHome), path.dirname(sbase)],
    tokens: ['justin', 'aoforge-claude', 'Users-'],
  };
  return { base, sbase, realHome, repo, evalRoot, sandboxDir, ctx };
}

describe('bashPathWords', () => {
  const paths = (cmd) => bashPathWords(cmd).map((w) => w.path);

  test('1. cd and cat with a ~ path: the ~ word is a tilde path; relative words are not candidates', () => {
    const words = bashPathWords('cd ~/.claude/aoforge/templates/codebase && cat conventions.md testing.md');
    assert.deepEqual(words, [{ path: '~/.claude/aoforge/templates/codebase', tilde: true, command: 'cd' }]);
  });

  test('2. data, not accesses: grep patterns, echo/printf arguments, heredoc bodies, interpreter scripts, commit messages', () => {
    assert.deepEqual(paths('grep -n "/Users/x/dev/lib" go.mod'), []);
    assert.deepEqual(paths('rg -e /Users/x/dev/lib -n .'), []);
    assert.deepEqual(paths('echo "replace => /Users/x/dev/lib" > out.md'), []);
    assert.deepEqual(paths("printf '%s\\n' /Users/x/dev/lib"), []);
    assert.deepEqual(paths("cat > STACK.md <<'EOF'\nreplace => /Users/x/dev/lib\nEOF"), []);
    assert.deepEqual(paths('node -e "require(\'/Users/x/y\')"'), []);
    assert.deepEqual(paths("sed -n 's#/Users/x#y#p' go.mod"), []);
    assert.deepEqual(paths('git commit -m "see /Users/x/dev"'), []);
  });

  test('3. accesses: file arguments, cd, git -C, redirection targets, --opt=/path, quoted paths', () => {
    assert.deepEqual(paths('sed -n 1,20p /Users/x/dev/lib/go.mod'), ['/Users/x/dev/lib/go.mod']);
    assert.deepEqual(paths('ls /Users/unknown 2>&1 | head'), ['/Users/unknown']);
    assert.deepEqual(paths('git -C /Users/x/dev/fleet log --oneline'), ['/Users/x/dev/fleet']);
    assert.deepEqual(paths('cat a.txt > /Users/x/out.txt'), ['/Users/x/out.txt']);
    assert.deepEqual(paths('cat a.txt >/Users/x/out2.txt'), ['/Users/x/out2.txt']);
    assert.deepEqual(paths('tool --config=/Users/x/c.json'), ['/Users/x/c.json']);
    assert.deepEqual(paths('cat "/Users/x/a b.txt"'), ['/Users/x/a b.txt']);
    assert.deepEqual(paths('grep -rn foo /Users/x/dev'), ['/Users/x/dev']);
    assert.deepEqual(paths('sed -n 1,5p ~/.claude/aoforge/references/tdd.md'), ['~/.claude/aoforge/references/tdd.md']);
  });
});

describe('toolPaths', () => {
  test('4. path fields of file tools; Bash through bashPathWords; other tools name nothing', () => {
    assert.deepEqual(toolPaths('Read', { file_path: '/a/b' }), [{ path: '/a/b', tilde: false, command: 'Read' }]);
    assert.deepEqual(toolPaths('Grep', { pattern: '/Users/x', path: '/c' }), [{ path: '/c', tilde: false, command: 'Grep' }]);
    assert.deepEqual(toolPaths('Glob', { pattern: '/d/**/*.md' }), [{ path: '/d/**/*.md', tilde: false, command: 'Glob' }]);
    assert.deepEqual(toolPaths('Write', { file_path: '~/x.md', content: '/Users/x' }), [{ path: '~/x.md', tilde: true, command: 'Write' }]);
    assert.deepEqual(toolPaths('Task', { prompt: 'read /Users/x' }), []);
    assert.deepEqual(toolPaths('Bash', { command: 'cat /e/f' }), [{ path: '/e/f', tilde: false, command: 'cat' }]);
  });
});

describe('classifyPath', () => {
  test('5. inside the sandbox (also through ..), tilde, guessed and non-existent, real, and system', () => {
    const w = world();
    const c = (p, tilde = false) => classifyPath({ path: p, tilde }, w.ctx);
    assert.equal(c(path.join(w.sandboxDir, 'work', 'go.mod')), 'inside');
    assert.equal(c(`${w.sandboxDir}/work/../work/x`), 'inside');
    assert.equal(c('~/.claude/aoforge/templates', true), 'tilde');
    assert.equal(c(path.join(w.base, 'Users', 'unknown', '.claude', 'x.md')), 'guessed_nonexistent');
    assert.equal(c(path.join(w.realHome, '.claude', 'aoforge', 'references', 'tdd.md')), 'real');
    assert.equal(c(path.join(w.base, 'Users')), 'real');
    assert.equal(c(w.evalRoot), 'real');
    assert.equal(c(path.dirname(w.sbase)), 'real');
    assert.equal(c('/dev/null'), 'system');
    assert.equal(c(path.join(OPAQUE_BASE, 'e81-no-such-dir-xyz')), 'nonexistent');
  });
});

function transcriptDir(uses) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-acc-tr-')));
  made.push(d);
  const sub = path.join(d, 'proj', 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  const line = (u, i) => JSON.stringify({ type: 'assistant', message: { id: `m${i}`, role: 'assistant', content: [{ type: 'tool_use', id: u.id, name: u.name, input: u.input }] } });
  fs.writeFileSync(path.join(sub, 'agent-a1.jsonl'), `${uses.map(line).join('\n')}\n`);
  return d;
}

describe('scanAccess', () => {
  test('6. the C-map-arch-b-s-1 shape: a denied `cd ~/.claude/...` is a non-escape, impaired; a guessed read is a non-escape', () => {
    const w = world();
    const uses = [
      { id: 't1', name: 'Bash', input: { command: 'cd ~/.claude/aoforge/templates/codebase/ && cat architecture.md structure.md' } },
      { id: 't2', name: 'Read', input: { file_path: `${w.base}/Users/../.claude/aoforge/templates/codebase/architecture.md` } },
      { id: 't3', name: 'Read', input: { file_path: path.join(w.sandboxDir, 'home', '.claude', 'aoforge', 'templates', 'x.md') } },
    ];
    const denials = [{ tool_name: 'Bash', tool_use_id: 't1', tool_input: uses[0].input }];
    const out = scanAccess({ transcriptsDir: transcriptDir(uses), denials, ctx: w.ctx });
    assert.deepEqual(out.real, []);
    assert.equal(out.impaired, true);
    assert.deepEqual(out.impaired_by, ['~/.claude/aoforge/templates/codebase/']);
    assert.deepEqual(out.non_escape.map((e) => [e.class, e.tool, e.denied]), [['tilde_denied', 'Bash', true], ['guessed_nonexistent', 'Read', false]]);
  });

  test('7. a real escape: an allowed read of an existing file in the real home, and a denied one; both redacted', () => {
    const w = world();
    const real = path.join(w.realHome, '.claude', 'aoforge', 'references', 'tdd.md');
    const uses = [
      { id: 't1', name: 'Bash', input: { command: `cat ${real}` } },
      { id: 't2', name: 'Read', input: { file_path: real } },
    ];
    const denials = [{ tool_name: 'Read', tool_use_id: 't2', tool_input: uses[1].input }];
    const out = scanAccess({ transcriptsDir: transcriptDir(uses), denials, ctx: w.ctx });
    assert.equal(out.real.length, 2);
    assert.deepEqual(out.real.map((e) => [e.tool, e.denied]), [['Bash', false], ['Read', true]]);
    for (const e of out.real) {
      assert.ok(!/justin/i.test(JSON.stringify(e)), JSON.stringify(e));
      assert.match(e.path, /^<home>\/\.claude\/aoforge\/references\/tdd\.md$/);
    }
    assert.equal(out.impaired, false);
  });

  test('8. a denial that names no tool use in the transcript is still classified from its own input', () => {
    const w = world();
    const denials = [{ tool_name: 'Bash', tool_use_id: 'gone', tool_input: { command: 'cd ~/.claude/aoforge && ls' } }];
    const out = scanAccess({ transcriptsDir: transcriptDir([]), denials, ctx: w.ctx });
    assert.equal(out.impaired, true);
    assert.deepEqual(out.non_escape.map((e) => e.class), ['tilde_denied']);
  });

  test('9. a denied ~ path outside ~/.claude is a non-escape but does not impair the run', () => {
    const w = world();
    const denials = [{ tool_name: 'Bash', tool_use_id: 'x', tool_input: { command: 'ls ~/dev' } }];
    const out = scanAccess({ transcriptsDir: transcriptDir([]), denials, ctx: w.ctx });
    assert.equal(out.impaired, false);
    assert.deepEqual(out.non_escape.map((e) => e.class), ['tilde_denied']);
  });
});

describe('redactPath', () => {
  test('10. the real home becomes <home>; the user, the home parent and the checkout become <user>, <users>- and <checkout>', () => {
    const opts = { realHome: '/Users/justin', tokens: ['justin', 'aoforge-claude', 'Users-'] };
    assert.equal(redactPath('/Users/justin/dev/eden-libs/go.mod', opts), '<home>/dev/eden-libs/go.mod');
    assert.equal(redactPath('/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/x', opts), '/private/tmp/claude-501/-<users>-<user>-dev-<checkout>/x');
    assert.equal(redactPath('/Users/unknown/.claude/x', opts), '/Users/unknown/.claude/x');
  });
});
