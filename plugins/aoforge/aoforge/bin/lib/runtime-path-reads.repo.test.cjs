'use strict';

// runtime-path-reads.repo.test.cjs: no agent is told to Read a `~/.claude/aoforge/...` path, and none is left to
// guess a home directory.
//
// Objective 81's sandbox runs showed agents guessing an absolute home path (/Users/<guess>/.claude/aoforge/...)
// when a prompt said "Read ~/.claude/aoforge/references/tdd.md": the 3.1.0 executor guessed the real home (denied)
// and /Users/aocyber (absent). The fix (TRD 82-02) is to hand every agent the absolute runtime path, never to
// leave a home directory to be typed or guessed:
//   - every compound `aof-tools init <cmd>` prints `runtime_root` (runtime-root.test.cjs);
//   - an agent names a runtime file `<runtime>/<rel>`, and carries the pinned <runtime_paths> block that says
//     where `<runtime>` comes from (the spawn prompt's `AOForge runtime:` line, else `runtime_root`, else
//     `echo ~/.claude/aoforge` in Bash);
//   - this guard fails if a `~/.claude/aoforge` read instruction returns to an enforced scope.
// The Read tool itself expands `~`; the rationale is that a supplied absolute path removes the chance to guess.
//
// Every `~/.claude/aoforge` occurrence in a scanned markdown file is classified, first match wins:
//   shell          inside a fenced block whose info string is empty, bash, sh, shell, zsh or console, or inside an
//                  inline code span (in a fence of any kind), when the text from the start of that code line/span to the occurrence holds a
//                  shell word, `$(`, `|`, `&&` or a `NAME=` assignment (the shell expands `~`)
//   skill_include  in a skills/**/SKILL.md, a line starting with `@~/.claude/aoforge/`, or a mid-line
//                  `@~/.claude/aoforge/<rel>` whose <rel> the same file includes at a line start (Claude Code
//                  expands a skill's @ lines into context)
//   memory_import  in templates/claude-md.md or templates/global-claude-md.md, a line starting with `@~/` (a
//                  CLAUDE.md import expands `~`)
//   allow          an entry of ALLOW {file, needle, reason}: a human-facing statement of where a user file lives
//   offender       everything else
//
// Scopes: ENFORCED scopes must have zero offenders; PENDING scopes are scanned and reported with their offender
// counts but do not fail. TRD 82-11 rewrites them and moves them to ENFORCED.
//
// Test list
//   4. unit: shell classification (fence line, inline span with a shell word, continuation line)
//   5. unit: a bare inline span and a prose `Read ~/...` are offenders
//   6. unit: skill_include (line start, mid-line only when also included at a line start; an agent's @ line is an offender)
//   7. unit: memory_import
//   8. unit: allow, and a stale ALLOW entry is found
//   9. unit: `<runtime>/references/tdd.md` is never an occurrence
//  10. real tree, ENFORCED scopes: zero offenders, `file:line` listed
//  11. every scope is ENFORCED or PENDING; PENDING scopes print their counts and never fail
//  12. every ALLOW entry still matches its file; at most 12 entries
//  13. every core/pack agent naming `<runtime>/` carries the pinned block exactly once; executor, planner and
//      verifier always carry it; a core agent carries it right after </role>
//  14. coverage: more than 60 files scanned, including agents/executor.md and references/trd-spec.md
//  15. no scanned file hard-codes a guessed home (`/Users/<name>/.claude/aoforge`, `/home/<name>/...`)
//  16. no plugin markdown outside every scope mentions the runtime path (except the named UNSCANNED entries)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const PLUGINS = path.join(REPO_ROOT, 'plugins');
const PLUGIN = path.join(PLUGINS, 'aoforge');
const IS_AOFORGE_CHECKOUT = fs.existsSync(path.join(REPO_ROOT, 'CLAUDE.md')) && fs.existsSync(path.join(PLUGIN, 'skills'));
const SKIP_REASON = IS_AOFORGE_CHECKOUT ? false : 'not an AOForge checkout';

const NEEDLE = '~/.claude/aoforge';

// ─── the pinned block ─────────────────────────────────────────────────────────

// Placed right after `</role>` in every agent that names `<runtime>/<rel>`. The guard compares it byte for byte;
// TRD 82-11's spawn-line tests and this file's test 13 read it from here.
const RUNTIME_BLOCK = [
  '<runtime_paths>',
  '`<runtime>` in this prompt is the absolute path of the AOForge runtime directory. Take it from the `AOForge runtime:` line of your spawn prompt; else from `runtime_root` in the JSON of an `aof-tools init` command you already ran; else run `echo ~/.claude/aoforge` once in Bash and use the path it prints. Read runtime files at that absolute path (`<runtime>/<rel>`), exactly as supplied: never type or guess a home directory yourself. Shell commands (`node ~/.claude/aoforge/bin/aof-tools.cjs ...`) keep `~`, because the shell expands it.',
  '</runtime_paths>',
].join('\n');

// ─── scopes ───────────────────────────────────────────────────────────────────

// Directories are relative to plugins/; a `*` in the first segment matches any plugin directory name.
const SCOPES = {
  core_agents: [{ dir: 'aoforge/agents', recursive: false }],
  core_references: [{ dir: 'aoforge/aoforge/references' }],
  pack_agent_material: ['agents', 'fragments', 'profiles', 'references'].map((s) => ({ dir: `aoforge-stack-*/${s}` })),
  core_workflows: [{ dir: 'aoforge/aoforge/workflows' }],
  core_skills: [{ dir: 'aoforge/skills' }],
  core_templates: [{ dir: 'aoforge/aoforge/templates' }],
  // The stack packs' skills and workflows, and the eden-ui design plugins (their skills @-include aoforge references).
  pack_skills_workflows: [
    ...['skills', 'workflows'].map((s) => ({ dir: `aoforge-stack-*/${s}` })),
    { dir: 'eden-ui-*' },
  ],
};

// 82-11 moves these to ENFORCED (Task 1: core_references, pack_agent_material; Task 2: core_workflows; Task 3: the rest).
const ENFORCED = ['core_agents'];
const PENDING = ['core_references', 'pack_agent_material', 'core_workflows', 'core_skills', 'core_templates', 'pack_skills_workflows'];

// A human-facing statement of where a user file lives (never an instruction to read one). At most 12 entries; an
// agent-read instruction is never allowlisted. TRD 82-11 fills this from the references and workflows it keeps.
const ALLOW = [];
const ALLOW_MAX = 12;

// Plugin markdown outside every scope that mentions the runtime path; each is a statement for a human, not a read.
const UNSCANNED = [
  {
    file: 'plugins/aoforge/aoforge/bin/lib/doctor-checks/README.md',
    reason: 'the contributor guide to doctor checks: it says where doctor looks and moves user files, and no agent reads it',
  },
  {
    file: 'plugins/aoforge-stack-flutter/CHANGELOG.md',
    reason: 'release history of the Flutter pack: a record of a past change, read by no agent',
  },
  {
    file: 'plugins/aoforge/aoforge/stack-profiles/go.md',
    reason: 'a statement of where an org or user profile override lives, in a profile the CLI prints, not a file an agent reads',
  },
];

// ─── file scanning ────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '__fixtures__', '.git']);

function walkMd(dir, recursive) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive && !SKIP_DIRS.has(e.name)) out.push(...walkMd(full, true));
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function expandDir(rel) {
  const [first, ...rest] = rel.split('/');
  if (!first.includes('*')) return [path.join(PLUGINS, rel)];
  const re = new RegExp('^' + first.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  let names = [];
  try { names = fs.readdirSync(PLUGINS); } catch { /* none */ }
  return names.filter((n) => re.test(n)).map((n) => path.join(PLUGINS, n, ...rest));
}

/** Repo-relative, posix, sorted markdown files of one scope. */
function scopeFiles(scope) {
  const files = new Set();
  for (const spec of SCOPES[scope]) {
    for (const dir of expandDir(spec.dir)) {
      for (const f of walkMd(dir, spec.recursive !== false)) files.add(path.relative(REPO_ROOT, f).split(path.sep).join('/'));
    }
  }
  return [...files].sort();
}

function readLines(fileRel) {
  return fs.readFileSync(path.join(REPO_ROOT, fileRel), 'utf8').split('\n');
}

// ─── classification ───────────────────────────────────────────────────────────

const SHELL_FENCES = new Set(['', 'bash', 'sh', 'shell', 'zsh', 'console']);
const SHELL_WORDS = [
  'node', 'cat', 'ls', 'rg', 'grep', 'sed', 'awk', 'head', 'tail', 'test', 'wc', 'find', 'mkdir', 'cp', 'mv', 'rm',
  'echo', 'jq', 'cd', 'diff', 'cmp', 'git', 'bash', 'sh', 'xargs', 'env', 'printf', 'tee', 'touch', 'stat', 'du',
  'realpath',
];
const SHELL_WORD_RE = new RegExp('\\b(?:' + SHELL_WORDS.join('|') + ')\\b');
const SHELL_SYNTAX_RE = /\$\(|\||&&|(?:^|[\s;(])[A-Za-z_][A-Za-z0-9_]*=/;

function looksShell(prefix) {
  return SHELL_WORD_RE.test(prefix) || SHELL_SYNTAX_RE.test(prefix);
}

/** The fence state at the start of `lineIndex`: { open, info } with `open` false outside a fenced block. */
function fenceAt(lines, lineIndex) {
  let open = null; // { ch, len, info }
  for (let i = 0; i < lineIndex; i++) {
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(lines[i]);
    if (!m) continue;
    const ch = m[1][0];
    const len = m[1].length;
    if (!open) {
      open = { ch, len, info: (m[2].trim().split(/\s+/)[0] || '').toLowerCase() };
    } else if (ch === open.ch && len >= open.len && m[2].trim() === '') {
      open = null;
    }
  }
  return open;
}

/** Inline code spans of one line as [{ start, end }] over the content between the backtick runs. */
function inlineSpans(line) {
  const spans = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') { i++; continue; }
    let n = 0;
    while (line[i + n] === '`') n++;
    const open = i + n;
    let j = open;
    let close = -1;
    while (j < line.length) {
      if (line[j] !== '`') { j++; continue; }
      let m = 0;
      while (line[j + m] === '`') m++;
      if (m === n) { close = j; break; }
      j += m;
    }
    if (close === -1) { i = open; continue; }
    spans.push({ start: open, end: close });
    i = close + n;
  }
  return spans;
}

const isSkillFile = (fileRel) => /(^|\/)skills\/(.+\/)?SKILL\.md$/.test(fileRel);
const isMemoryTemplate = (fileRel) => /(^|\/)templates\/(global-)?claude-md\.md$/.test(fileRel);

/** `<rel>` of an `@~/.claude/aoforge/<rel>` include starting at `at` in `line`. */
function includeRel(line, at) {
  const m = /^@~\/\.claude\/aoforge\/([^\s`'")\]>,;]+)/.exec(line.slice(at));
  return m ? m[1].replace(/[.:]+$/, '') : null;
}

function allowMatches(entry, fileRel, line, column) {
  if (entry.file !== fileRel) return false;
  let from = 0;
  for (;;) {
    const at = line.indexOf(entry.needle, from);
    if (at === -1) return false;
    if (column >= at && column < at + entry.needle.length) return true;
    from = at + 1;
  }
}

/**
 * Class of the `~/.claude/aoforge` occurrence at `lines[lineIndex]`, 0-based `column` (the `~`):
 * 'shell' | 'skill_include' | 'memory_import' | 'allow' | 'offender'.
 */
function classifyOccurrence(fileRel, lines, lineIndex, column, allow = ALLOW) {
  const line = lines[lineIndex];

  // shell: a line of a fenced shell block, else an inline code span (also inside a non-shell fence: a markdown
  // template in a ```markdown fence still holds inline spans)
  const fence = fenceAt(lines, lineIndex);
  if (fence && SHELL_FENCES.has(fence.info)) {
    let prefix = line.slice(0, column);
    if (looksShell(prefix)) return 'shell';
    // a continuation line (`node ... \` above) belongs to the command that started on an earlier line
    for (let i = lineIndex - 1; i >= 0 && /\\\s*$/.test(lines[i]) && !/^\s*(`{3,}|~{3,})/.test(lines[i]); i--) {
      prefix = lines[i] + '\n' + prefix;
      if (looksShell(prefix)) return 'shell';
    }
  } else {
    for (const span of inlineSpans(line)) {
      if (column >= span.start && column < span.end) {
        if (looksShell(line.slice(span.start, column))) return 'shell';
        break;
      }
    }
  }

  // skill_include
  if (isSkillFile(fileRel) && line[column - 1] === '@') {
    if (column === 1) return 'skill_include';
    const rel = includeRel(line, column - 1);
    if (rel) {
      const atLineStart = lines.some((l) => l.startsWith('@' + NEEDLE + '/') && includeRel(l, 0) === rel);
      if (atLineStart) return 'skill_include';
    }
  }

  // memory_import
  if (isMemoryTemplate(fileRel) && column === 1 && line[0] === '@') return 'memory_import';

  // allow
  if (allow.some((e) => allowMatches(e, fileRel, line, column))) return 'allow';

  return 'offender';
}

/** Every occurrence in a file: [{ line (1-based), column, cls, text }]. */
function scanLines(fileRel, lines, allow = ALLOW) {
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    let from = 0;
    for (;;) {
      const at = lines[i].indexOf(NEEDLE, from);
      if (at === -1) break;
      found.push({ line: i + 1, column: at, cls: classifyOccurrence(fileRel, lines, i, at, allow), text: lines[i].trim().slice(0, 140) });
      from = at + NEEDLE.length;
    }
  }
  return found;
}

const _scanCache = new Map();
function scanFile(fileRel) {
  if (!_scanCache.has(fileRel)) _scanCache.set(fileRel, scanLines(fileRel, readLines(fileRel)));
  return _scanCache.get(fileRel);
}

function offendersOf(scope) {
  const out = [];
  for (const f of scopeFiles(scope)) {
    for (const o of scanFile(f)) if (o.cls === 'offender') out.push({ file: f, ...o });
  }
  return out;
}

// ─── guessed-home detection ───────────────────────────────────────────────────

// A hard-coded home in front of the runtime directory: the very thing an agent is not to type or guess.
const GUESSED_HOME_RE = /(?:\/Users|\/home)\/[A-Za-z0-9_.-]+\/\.claude\/aoforge\b/;

function guessedHomes(fileRel, lines) {
  const out = [];
  lines.forEach((l, i) => { if (GUESSED_HOME_RE.test(l)) out.push(`${fileRel}:${i + 1}: ${l.trim().slice(0, 140)}`); });
  return out;
}

// ─── ALLOW checks ─────────────────────────────────────────────────────────────

/** ALLOW entries whose needle is no longer in their file, or no longer sits on an occurrence of the runtime path. */
function staleAllowEntries(allow, linesOf) {
  const stale = [];
  for (const e of allow) {
    let lines;
    try { lines = linesOf(e.file); } catch { stale.push(`${e.file}: file not found`); continue; }
    const hit = lines.some((l, i) => {
      let from = 0;
      for (;;) {
        const at = l.indexOf(NEEDLE, from);
        if (at === -1) return false;
        if (allowMatches(e, e.file, l, at)) return true;
        from = at + 1;
      }
    });
    if (!hit) stale.push(`${e.file}: needle ${JSON.stringify(e.needle)} no longer matches (${e.reason})`);
  }
  return stale;
}

// ─── unit helpers ─────────────────────────────────────────────────────────────

/** Class of the n-th occurrence in `text`, as the file `fileRel`. */
function classifyIn(fileRel, text, n = 0, allow = ALLOW) {
  const found = scanLines(fileRel, text.split('\n'), allow);
  assert.ok(found.length > n, `no occurrence #${n} in ${JSON.stringify(text)}`);
  return found[n].cls;
}

// ─── unit tests 4-9 ───────────────────────────────────────────────────────────

test('4. shell: a bash fence line, an inline span with a shell word, a continuation line', () => {
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', '```bash\nnode ~/.claude/aoforge/bin/aof-tools.cjs init x\n```'), 'shell');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', '```\nnode ~/.claude/aoforge/bin/aof-tools.cjs state load\n```'), 'shell');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', 'Run `cat ~/.claude/aoforge/x.md` first.'), 'shell');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', 'Run `node ~/.claude/aoforge/bin/aof-tools.cjs state load`.'), 'shell');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', '```bash\nFOO=$(cat ~/.claude/aoforge/x)\n```'), 'shell');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', '```sh\nLOG=1 ~/.claude/aoforge/bin/tool\n```'), 'shell');
  assert.equal(
    classifyIn('plugins/aoforge/agents/x.md', '```markdown\n{verbatim output of `node ~/.claude/aoforge/bin/aof-tools.cjs state digest`}\n```'),
    'shell',
    'an inline span inside a markdown template fence is still a span',
  );
  assert.equal(
    classifyIn('plugins/aoforge/agents/x.md', '```bash\nnode a.cjs \\\n  --out ~/.claude/aoforge/y.json\n```'),
    'shell',
    'a continuation line belongs to the command above it',
  );
});

test('5. offender: a bare inline span, prose "Read ~/...", a non-shell fence', () => {
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', 'The file `~/.claude/aoforge/x.md` holds it.'), 'offender');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', 'Read ~/.claude/aoforge/references/tdd.md before you start.'), 'offender');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', 'Templates live under `~/.claude/aoforge/templates/codebase/`.'), 'offender');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', '```markdown\nRead ~/.claude/aoforge/references/tdd.md\n```'), 'offender');
  assert.equal(classifyIn('plugins/aoforge/agents/x.md', '```\nSee ~/.claude/aoforge/references/tdd.md\n```'), 'offender', 'a bare fence of prose is not a command');
  assert.equal(
    classifyIn('plugins/aoforge/agents/x.md', '````markdown\n```bash\nls\n```\nRead ~/.claude/aoforge/x.md\n````'),
    'offender',
    'an inner fence does not close an outer fence of more backticks',
  );
});

test('6. skill_include: a line-start @ include in a SKILL.md; the same line in an agent is an offender', () => {
  const inc = '@~/.claude/aoforge/workflows/quick.md';
  assert.equal(classifyIn('plugins/aoforge/skills/quick/SKILL.md', inc), 'skill_include');
  assert.equal(classifyIn('plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md', inc), 'skill_include');
  assert.equal(classifyIn('plugins/aoforge/agents/executor.md', inc), 'offender');
  assert.equal(classifyIn('plugins/aoforge/aoforge/workflows/quick.md', inc), 'offender');
  const mid = 'Follow @~/.claude/aoforge/references/x.md end to end.';
  assert.equal(classifyIn('plugins/aoforge/skills/q/SKILL.md', mid), 'offender', 'a mid-line include alone is not already in context');
  assert.equal(
    classifyIn('plugins/aoforge/skills/q/SKILL.md', `@~/.claude/aoforge/references/x.md\n${mid}`, 1),
    'skill_include',
    'a mid-line include of a file also included at a line start is already in context',
  );
  assert.equal(
    classifyIn('plugins/aoforge/skills/q/SKILL.md', `@~/.claude/aoforge/references/y.md\n${mid}`, 1),
    'offender',
    'a different file at a line start does not cover it',
  );
  assert.equal(classifyIn('plugins/aoforge/skills/q/SKILL.md', 'Read ~/.claude/aoforge/references/x.md'), 'offender', 'a non-@ prose read in a skill');
});

test('7. memory_import: a line-start @~/ in the CLAUDE.md templates', () => {
  const imp = '@~/.claude/aoforge/references/tdd.md';
  assert.equal(classifyIn('plugins/aoforge/aoforge/templates/claude-md.md', imp), 'memory_import');
  assert.equal(classifyIn('plugins/aoforge/aoforge/templates/global-claude-md.md', imp), 'memory_import');
  assert.equal(classifyIn('plugins/aoforge/aoforge/templates/claude-md.md', 'See ~/.claude/aoforge/references/tdd.md'), 'offender');
  assert.equal(classifyIn('plugins/aoforge/aoforge/templates/state.md', imp), 'offender');
});

test('8. allow: a matching entry allows, a stale one is found', () => {
  const allow = [{ file: 'plugins/aoforge/aoforge/references/defaults-table.md', needle: 'edit ~/.claude/aoforge/defaults-table.md', reason: 'where a user file lives' }];
  const text = 'To change a default, edit ~/.claude/aoforge/defaults-table.md yourself.';
  assert.equal(classifyIn('plugins/aoforge/aoforge/references/defaults-table.md', text, 0, allow), 'allow');
  assert.equal(classifyIn('plugins/aoforge/aoforge/references/other.md', text, 0, allow), 'offender', 'an entry names one file');
  assert.equal(classifyIn('plugins/aoforge/aoforge/references/defaults-table.md', 'Read ~/.claude/aoforge/references/tdd.md', 0, allow), 'offender', 'only the needle is allowed');
  const files = { 'plugins/aoforge/aoforge/references/defaults-table.md': [text] };
  assert.deepEqual(staleAllowEntries(allow, (f) => files[f]), []);
  const gone = { 'plugins/aoforge/aoforge/references/defaults-table.md': ['The text no longer says that.'] };
  assert.equal(staleAllowEntries(allow, (f) => gone[f]).length, 1, 'a needle absent from its file is stale');
  assert.equal(staleAllowEntries(allow, () => { throw new Error('ENOENT'); }).length, 1, 'a missing file is stale');
});

test('9. <runtime>/references/tdd.md is never an occurrence', () => {
  assert.deepEqual(scanLines('plugins/aoforge/agents/x.md', ['Read `<runtime>/references/tdd.md` with the Read tool.']), []);
  assert.deepEqual(scanLines('plugins/aoforge/agents/x.md', ['Read /Users/someone/.claude/aoforge/references/tdd.md']), [], 'an absolute path is not a ~ read (test 15 owns guessed homes)');
});

test('15a. unit: a guessed home in front of the runtime directory is found', () => {
  assert.equal(guessedHomes('f.md', ['Read /Users/aocyber/.claude/aoforge/references/tdd.md']).length, 1);
  assert.equal(guessedHomes('f.md', ['Open /home/dev/.claude/aoforge/x.md']).length, 1);
  assert.equal(guessedHomes('f.md', ['Read `<runtime>/references/tdd.md`', 'node ~/.claude/aoforge/bin/aof-tools.cjs state load']).length, 0);
  assert.equal(guessedHomes('f.md', ['/Users/justin/.claude/CLAUDE.md']).length, 0, 'only the runtime directory is guarded');
});

// ─── real-tree tests 10-16 ────────────────────────────────────────────────────

const fmt = (o) => `${o.file}:${o.line}: ${o.text}`;

test('10. real tree: ENFORCED scopes have no ~ read instruction', { skip: SKIP_REASON }, () => {
  const offenders = ENFORCED.flatMap((scope) => offendersOf(scope).map((o) => ({ scope, ...o })));
  const perFile = {};
  for (const o of offenders) perFile[o.file] = (perFile[o.file] || 0) + 1;
  assert.equal(
    offenders.length,
    0,
    `${offenders.length} ~/.claude/aoforge read instruction(s) in an enforced scope. Name the file <runtime>/<rel> ` +
      `(the absolute runtime path comes from the pinned <runtime_paths> block); a shell command keeps ~.\n` +
      `By file: ${JSON.stringify(perFile)}\n` +
      offenders.map(fmt).join('\n'),
  );
});

test('11. every scope is ENFORCED or PENDING; PENDING scopes report their counts and do not fail', { skip: SKIP_REASON }, (t) => {
  const all = Object.keys(SCOPES).sort();
  assert.deepEqual([...ENFORCED, ...PENDING].sort(), all, 'every scope is in ENFORCED or PENDING, and in only one');
  assert.equal(new Set([...ENFORCED, ...PENDING]).size, ENFORCED.length + PENDING.length, 'no scope is in both lists');
  for (const scope of all) {
    const files = scopeFiles(scope);
    const offenders = offendersOf(scope);
    const tag = ENFORCED.includes(scope) ? 'ENFORCED' : 'PENDING';
    t.diagnostic(`${tag} ${scope}: ${files.length} files, ${offenders.length} offender(s)`);
    assert.ok(files.length > 0, `scope ${scope} matches no files (its directory moved?)`);
  }
});

test('12. every ALLOW entry still matches its file; at most 12 entries', { skip: SKIP_REASON }, () => {
  assert.ok(ALLOW.length <= ALLOW_MAX, `ALLOW has ${ALLOW.length} entries (max ${ALLOW_MAX}): rewrite the reads instead of allowing them`);
  for (const e of ALLOW) {
    assert.ok(e.file && e.needle && e.reason, `ALLOW entry needs file, needle and reason: ${JSON.stringify(e)}`);
  }
  assert.deepEqual(staleAllowEntries(ALLOW, readLines), [], 'a stale ALLOW entry: remove it or fix its needle');
});

const AGENT_FILES = () => ['core_agents'].flatMap(scopeFiles).concat(
  fs.readdirSync(PLUGINS)
    .filter((n) => n.startsWith('aoforge-stack-'))
    .flatMap((n) => walkMd(path.join(PLUGINS, n, 'agents'), true).map((f) => path.relative(REPO_ROOT, f).split(path.sep).join('/'))),
);

test('13. agents naming <runtime>/ carry the pinned <runtime_paths> block exactly once', { skip: SKIP_REASON }, () => {
  const problems = [];
  const required = ['executor', 'planner', 'verifier'].map((n) => `plugins/aoforge/agents/${n}.md`);
  for (const f of AGENT_FILES()) {
    const text = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const blocks = text.split(RUNTIME_BLOCK).length - 1;
    const tags = (text.match(/<runtime_paths>/g) || []).length;
    const outside = text.split(RUNTIME_BLOCK).join('');
    if (tags !== blocks) problems.push(`${f}: ${tags} <runtime_paths> tag(s) but ${blocks} exact copy(ies) of the pinned block`);
    if (blocks > 1) problems.push(`${f}: the pinned block appears ${blocks} times`);
    if (outside.includes('<runtime>/') && blocks !== 1) problems.push(`${f}: names <runtime>/ but carries the pinned block ${blocks} times`);
    if (required.includes(f) && blocks !== 1) problems.push(`${f}: executor, planner and verifier carry the pinned block (found ${blocks})`);
    if (blocks === 1 && f.startsWith('plugins/aoforge/agents/') && !text.includes('</role>\n\n' + RUNTIME_BLOCK + '\n')) {
      problems.push(`${f}: the pinned block goes right after </role>`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('14. coverage: more than 60 files scanned, including agents/executor.md and references/trd-spec.md', { skip: SKIP_REASON }, () => {
  const files = new Set(Object.keys(SCOPES).flatMap(scopeFiles));
  assert.ok(files.size > 60, `only ${files.size} files scanned`);
  assert.ok(files.has('plugins/aoforge/agents/executor.md'), 'agents/executor.md is scanned');
  assert.ok(files.has('plugins/aoforge/aoforge/references/trd-spec.md'), 'references/trd-spec.md is scanned');
});

test('15. no scanned file hard-codes a guessed home in front of the runtime directory', { skip: SKIP_REASON }, () => {
  const found = [...new Set(Object.keys(SCOPES).flatMap(scopeFiles))].flatMap((f) => guessedHomes(f, readLines(f)));
  assert.deepEqual(found, [], `a guessed absolute home: use <runtime>/<rel> (the path comes from the spawn prompt or runtime_root)\n${found.join('\n')}`);
});

test('16. no plugin markdown outside every scope mentions the runtime path (except the named UNSCANNED entries)', { skip: SKIP_REASON }, () => {
  const scanned = new Set(Object.keys(SCOPES).flatMap(scopeFiles));
  const unscanned = new Set(UNSCANNED.map((u) => u.file));
  const loose = [];
  for (const f of walkMd(PLUGINS, true).map((p) => path.relative(REPO_ROOT, p).split(path.sep).join('/'))) {
    if (scanned.has(f)) continue;
    const hits = readLines(f).map((l, i) => (l.includes(NEEDLE) ? `${f}:${i + 1}` : null)).filter(Boolean);
    if (hits.length && !unscanned.has(f)) loose.push(...hits);
  }
  assert.deepEqual(loose, [], `markdown outside every scope mentions ${NEEDLE}: add its directory to a scope\n${loose.join('\n')}`);
  for (const u of UNSCANNED) {
    assert.ok(readLines(u.file).some((l) => l.includes(NEEDLE)), `UNSCANNED entry ${u.file} no longer mentions the runtime path: remove it`);
    assert.ok(!scanned.has(u.file), `UNSCANNED entry ${u.file} is now inside a scope: remove it`);
  }
});
