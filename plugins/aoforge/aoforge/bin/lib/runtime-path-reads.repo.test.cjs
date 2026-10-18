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
//                  shell word, `$(`, `|`, `&&` or a `NAME=` assignment (the shell expands `~`); also a `Bash(<command>)`
//                  permission rule whose command text does (Claude Code matches it against the command as typed)
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
//  17. trd-spec.md's TRD skeleton (the planner copies it into every TRD) names `<runtime>/workflows/execute-trd.md`
//      and `<runtime>/templates/summary.md` in its <execution_context>, with no `@~/` line (TRD 82-11)
//  18a. unit: spawn extraction (literal, variable, template, YAML form) and the runtime line's position
//  18. every AOForge or pack agent spawn in a SPAWN_SCOPES file carries `AOForge runtime: {runtime_root}` as the
//      first or second line of its prompt (SPAWN_EXEMPT names a sketch with a reason)
//  19. every SPAWN_SCOPES file that spawns such an agent or names `{runtime_root}` runs an init whose JSON has
//      runtime_root, or defines `RUNTIME_ROOT=$(echo ~/.claude/aoforge)`

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
const ENFORCED = ['core_agents', 'core_references', 'pack_agent_material', 'core_workflows'];
const PENDING = ['core_skills', 'core_templates', 'pack_skills_workflows'];

// A human-facing statement of where a user file lives (never an instruction to read one). At most 12 entries; an
// agent-read instruction is never allowlisted. TRD 82-11 fills this from the references and workflows it keeps.
const ALLOW = [
  {
    file: 'plugins/aoforge/aoforge/references/defaults-table.md',
    needle: 'then edit `~/.claude/aoforge/defaults-table.md`',
    reason: 'tells a human where to edit the org-wide defaults table (a user file); not a read instruction',
  },
  {
    file: 'plugins/aoforge/aoforge/references/testing-strategy.md',
    needle: 'override goes in `~/.claude/aoforge/stacks/<id>.md`',
    reason: 'tells a human where a user or org stack-profile override file goes; not a read instruction',
  },
];
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

  // shell: a `Bash(<command>)` permission rule (settings.json allow/deny), matched against the command as typed
  const rule = line.lastIndexOf('Bash(', column);
  if (rule !== -1 && !line.slice(rule, column).includes(')') && looksShell(line.slice(rule + 'Bash('.length, column))) return 'shell';

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

// ─── spawn prompts (TRD 82-11) ────────────────────────────────────────────────

// Every spawn of an AOForge or pack agent hands the agent its absolute runtime path on this line, inside the
// prompt, right after the prompt's opening line; the pinned <runtime_paths> block takes `<runtime>` from it.
const RUNTIME_LINE = 'AOForge runtime: {runtime_root}';
// A file with no `aof-tools init` call defines this once; `{runtime_root}` then means the path it holds.
const RUNTIME_FALLBACK = 'RUNTIME_ROOT=$(echo ~/.claude/aoforge)';
// The compound inits whose JSON carries runtime_root (82-02; runtime-root.test.cjs runs each one).
const INITS_WITH_RUNTIME_ROOT = [
  'execute-objective', 'plan-objective', 'new-project', 'new-milestone', 'quick', 'resume', 'verify-work',
  'objective-op', 'todos', 'milestone-op', 'map-codebase', 'security-audit', 'progress',
];

// Scopes whose spawns test 18 checks and whose `{runtime_root}` sources test 19 checks
// (82-11 Task 2: workflows; Task 3: skills and the packs' skills and workflows).
const SPAWN_SCOPES = ['core_workflows'];

// A spawn-shaped block that sketches another spawn rather than spelling out a prompt.
const SPAWN_EXEMPT = [
  {
    file: 'plugins/aoforge/aoforge/workflows/execute-objective.md',
    needle: 'prompt="...",',
    reason: 'the background-execution sketch of the executor spawn above it; its prompt is that spawn\'s prompt',
  },
];

// A spawn whose `prompt=<variable>` is filled from a template file rather than from a block in its own file.
const PROMPT_TEMPLATES = {
  'plugins/aoforge/aoforge/workflows/diagnose-issues.md': {
    filled_debug_subagent_prompt: 'plugins/aoforge/aoforge/templates/debug-subagent-prompt.md',
  },
};

/** Core agent names (bare and `aoforge:`-qualified) and pack agents as `<pack>:<agent>`. */
function agentNames() {
  const names = new Set();
  for (const f of walkMd(path.join(PLUGIN, 'agents'), false)) {
    const n = path.basename(f, '.md');
    names.add(n);
    names.add(`aoforge:${n}`);
  }
  for (const p of fs.readdirSync(PLUGINS).filter((n) => n.startsWith('aoforge-stack-'))) {
    for (const f of walkMd(path.join(PLUGINS, p, 'agents'), true)) names.add(`${p}:${path.basename(f, '.md')}`);
  }
  return names;
}

/** Closed fenced blocks: [{ open, close, info }] with 0-based indexes of the fence lines. */
function fencesOf(lines) {
  const out = [];
  let cur = null;
  lines.forEach((l, i) => {
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(l);
    if (!m) return;
    if (!cur) cur = { open: i, ch: m[1][0], len: m[1].length, info: (m[2].trim().split(/\s+/)[0] || '').toLowerCase() };
    else if (m[1][0] === cur.ch && m[1].length >= cur.len && m[2].trim() === '') {
      out.push({ open: cur.open, close: i, info: cur.info });
      cur = null;
    }
  });
  return out;
}

const TASK_CALL_RE = /^\s*(?:[A-Za-z_][\w.]*\s*=\s*)?Task\((?:\s*$|prompt=)/;
const YAML_AGENT_RE = /^\s*subagent_type:\s*"([^"]+)"/;

/** The runtime line is the prompt's first or second line (right after its opening line). */
const leadsWithRuntimeLine = (promptLines) => promptLines.slice(0, 2).some((l) => l.trim() === RUNTIME_LINE);

/**
 * Every spawn in a file: [{ line (1-based), agent, form, ok, why, exempt }]. Forms: a `Task(` call (literal
 * `prompt="..."`/`"""`, or `prompt=<variable>` filled from the nearest ```markdown block above it, or from a
 * PROMPT_TEMPLATES file), and the YAML form (a fence holding `subagent_type: "..."`, the next fence its prompt).
 */
function spawnsIn(fileRel, lines, { readText = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8') } = {}) {
  const fences = fencesOf(lines);
  const out = [];
  const starts = [];
  for (const f of fences) {
    for (let i = f.open + 1; i < f.close; i++) if (TASK_CALL_RE.test(lines[i])) starts.push({ at: i, fence: f });
  }
  starts.forEach(({ at, fence }, k) => {
    const next = starts[k + 1];
    const end = next && next.fence === fence ? next.at : fence.close;
    const text = lines.slice(at, end).join('\n');
    const agentM = /subagent_type\s*=\s*"([^"]+)"/.exec(text);
    const spawn = { line: at + 1, agent: agentM ? agentM[1] : null, form: 'task', ok: false, why: '', exempt: null };
    spawn.exempt = SPAWN_EXEMPT.find((e) => e.file === fileRel && text.includes(e.needle)) || null;
    const lit = /prompt\s*=\s*("""|")/.exec(text);
    const vari = /prompt\s*=\s*([A-Za-z_]\w*)/.exec(text);
    if (lit) {
      spawn.ok = leadsWithRuntimeLine(text.slice(lit.index + lit[0].length).split('\n'));
      spawn.why = spawn.ok ? '' : `the prompt's first two lines lack "${RUNTIME_LINE}"`;
    } else if (vari) {
      const tpl = (PROMPT_TEMPLATES[fileRel] || {})[vari[1]];
      let body = null;
      if (tpl) {
        const tLines = readText(tpl).split('\n');
        const mf = fencesOf(tLines).find((f) => f.info === 'markdown');
        if (mf) body = tLines.slice(mf.open + 1, mf.close);
      } else {
        const before = fences.filter((f) => f.close < fence.open && f.info === 'markdown').pop();
        const between = before ? starts.some((s) => s.at > before.close && s.at < at) : true;
        if (before && !between) body = lines.slice(before.open + 1, before.close);
      }
      spawn.form = 'task-variable';
      spawn.ok = body ? leadsWithRuntimeLine(body) : false;
      spawn.why = body ? (spawn.ok ? '' : `the ${vari[1]} block's first two lines lack "${RUNTIME_LINE}"`)
        : `no \`\`\`markdown block above defines ${vari[1]} (or name its template in PROMPT_TEMPLATES)`;
    } else {
      spawn.why = 'no prompt= argument';
    }
    out.push(spawn);
  });
  fences.forEach((f, k) => {
    for (let i = f.open + 1; i < f.close; i++) {
      const m = YAML_AGENT_RE.exec(lines[i]);
      if (!m) continue;
      const promptFence = fences[k + 1];
      const body = promptFence ? lines.slice(promptFence.open + 1, promptFence.close) : [];
      const ok = leadsWithRuntimeLine(body);
      out.push({ line: i + 1, agent: m[1], form: 'yaml', ok, why: ok ? '' : `the Prompt block's first two lines lack "${RUNTIME_LINE}"`, exempt: null });
    }
  });
  return out.sort((a, b) => a.line - b.line);
}

/** AOForge and pack agent spawns in the files of the given scopes, with any problem. */
function aoforgeSpawns(scopes) {
  const names = agentNames();
  const out = [];
  for (const f of [...new Set(scopes.flatMap(scopeFiles))]) {
    for (const s of spawnsIn(f, readLines(f))) if (s.agent && names.has(s.agent)) out.push({ file: f, ...s });
  }
  return out;
}

/** How a file supplies `{runtime_root}`: the init it runs, the fallback line, or null. */
function runtimeRootSource(text) {
  for (const m of text.matchAll(/aof-tools\.cjs init ([a-z][a-z-]*)/g)) {
    if (INITS_WITH_RUNTIME_ROOT.includes(m[1])) return `init ${m[1]}`;
  }
  return text.includes(RUNTIME_FALLBACK) ? 'fallback' : null;
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
  assert.equal(
    classifyIn('plugins/aoforge/aoforge/references/x.md', '```json\n  "Bash(node ~/.claude/aoforge/bin/aof-tools.cjs *)",\n```'),
    'shell',
    'a Bash(...) permission rule is matched against the command as typed (82-11)',
  );
  assert.equal(
    classifyIn('plugins/aoforge/aoforge/references/x.md', 'Bash(x) then Read ~/.claude/aoforge/references/tdd.md'),
    'offender',
    'a closed Bash(...) rule earlier on the line does not cover a later read',
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

test('17. trd-spec.md\'s TRD skeleton names <runtime>/ files in <execution_context>, with no @~/ line', { skip: SKIP_REASON }, () => {
  const text = fs.readFileSync(path.join(PLUGIN, 'aoforge', 'references', 'trd-spec.md'), 'utf8');
  const m = /<execution_context>\n([\s\S]*?)\n<\/execution_context>/.exec(text);
  assert.ok(m, 'trd-spec.md has an <execution_context> block in its TRD skeleton');
  const lines = m[1].split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(lines.includes('<runtime>/workflows/execute-trd.md'), `the skeleton names <runtime>/workflows/execute-trd.md:\n${m[1]}`);
  assert.ok(lines.includes('<runtime>/templates/summary.md'), `the skeleton names <runtime>/templates/summary.md:\n${m[1]}`);
  assert.deepEqual(lines.filter((l) => l.startsWith('@~/')), [], 'no @~/ line: the planner copies the skeleton into every TRD an agent reads');
});

test('18a. unit: spawn extraction (literal, variable, template, YAML) and the runtime-line position', () => {
  const lit = (body) => ['```', 'Task(', '  subagent_type="executor",', '  prompt="', ...body, '  ",', ')', '```'];
  const one = (lines, file = 'plugins/aoforge/aoforge/workflows/x.md', opts) => spawnsIn(file, lines, opts);
  assert.equal(one(lit([`    ${RUNTIME_LINE}`, '', '    <objective>', '    x', '    </objective>']))[0].ok, true);
  assert.equal(one(lit(['    <objective>', '    x', `    ${RUNTIME_LINE}`]))[0].ok, false, 'the line comes right after the opening line');
  assert.equal(one(lit(['    <objective>', '    x']))[0].ok, false);
  const opener = ['```', `Task(prompt="<research_type>`, RUNTIME_LINE, 'R.', '</research_type>', '", subagent_type="project-researcher", model="{m}")', '```'];
  assert.deepEqual(one(opener).map((s) => [s.agent, s.ok]), [['project-researcher', true]], 'content on the opening line: the next line');
  const variable = ['Checker prompt:', '```markdown', '<ctx>', RUNTIME_LINE, '</ctx>', '```', '', '```', 'Task(', '  prompt=checker_prompt,', '  subagent_type="job-checker"', ')', '```'];
  assert.deepEqual(one(variable).map((s) => [s.form, s.ok]), [['task-variable', true]]);
  assert.equal(one(variable.filter((l) => l !== RUNTIME_LINE))[0].ok, false);
  const templated = ['```', 'Task(', '  prompt=filled_debug_subagent_prompt,', '  subagent_type="debugger"', ')', '```'];
  const readText = () => ['# T', '```markdown', '<objective>', RUNTIME_LINE, '```'].join('\n');
  assert.equal(one(templated, 'plugins/aoforge/aoforge/workflows/diagnose-issues.md', { readText })[0].ok, true, 'a PROMPT_TEMPLATES entry');
  assert.equal(one(templated, 'plugins/aoforge/aoforge/workflows/other.md', { readText })[0].ok, false, 'no markdown block above, no template');
  const yaml = ['```', 'subagent_type: "codebase-mapper"', 'model: "{m}"', '```', 'Prompt:', '```', 'Focus: tech', RUNTIME_LINE, '', 'Go.', '```'];
  assert.deepEqual(one(yaml).map((s) => [s.form, s.agent, s.ok]), [['yaml', 'codebase-mapper', true]]);
  assert.equal(one(yaml.filter((l) => l !== RUNTIME_LINE))[0].ok, false);
  const two = ['```', 'Task(prompt="a', RUNTIME_LINE, '", subagent_type="verifier")', '', 'Task(prompt="b', 'x', '", subagent_type="planner")', '```'];
  assert.deepEqual(one(two).map((s) => [s.agent, s.ok]), [['verifier', true], ['planner', false]], 'two calls in one fence are two spawns');
  assert.deepEqual(one(['Use `Task(...)` here, or Task() calls.']), [], 'a prose mention is not a spawn');
  assert.ok(agentNames().has('executor') && agentNames().has('aoforge-stack-flutter:ui-evaluator'));
  assert.equal(runtimeRootSource('INIT=$(node ~/.claude/aoforge/bin/aof-tools.cjs init quick "$D")'), 'init quick');
  assert.equal(runtimeRootSource(`${RUNTIME_FALLBACK} && echo "$RUNTIME_ROOT"`), 'fallback');
  assert.equal(runtimeRootSource('node ~/.claude/aoforge/bin/aof-tools.cjs init nonesuch'), null);
});

test('18. every AOForge or pack agent spawn carries the runtime line right after its prompt\'s opening line', { skip: SKIP_REASON }, (t) => {
  const spawns = aoforgeSpawns(SPAWN_SCOPES);
  const exempt = spawns.filter((s) => s.exempt);
  const bad = spawns.filter((s) => !s.exempt && !s.ok);
  t.diagnostic(`${spawns.length - exempt.length} AOForge spawns checked in ${SPAWN_SCOPES.join(', ')}; ${exempt.length} exempt`);
  for (const e of SPAWN_EXEMPT) {
    assert.ok(spawns.some((s) => s.exempt === e), `SPAWN_EXEMPT entry no longer matches a spawn: ${e.file} ${JSON.stringify(e.needle)}`);
  }
  assert.ok(spawns.length > 10, `only ${spawns.length} AOForge spawns found: the extractor lost them`);
  assert.deepEqual(bad.map((s) => `${s.file}:${s.line} ${s.agent}: ${s.why}`), [],
    `a spawn must hand its agent the absolute runtime path: add the line "${RUNTIME_LINE}" right after the prompt's opening line`);
});

test('19. every file in a spawn scope that spawns an AOForge agent or names {runtime_root} supplies it', { skip: SKIP_REASON }, () => {
  const initList = fs.readFileSync(path.join(__dirname, 'runtime-root.test.cjs'), 'utf8');
  const block = /const INIT_COMMANDS = \[([\s\S]*?)\n\];/.exec(initList);
  assert.ok(block, 'runtime-root.test.cjs keeps its INIT_COMMANDS list');
  assert.deepEqual([...block[1].matchAll(/\[\s*'([a-z-]+)'/g)].map((m) => m[1]).sort(), [...INITS_WITH_RUNTIME_ROOT].sort(),
    'INITS_WITH_RUNTIME_ROOT is the list runtime-root.test.cjs proves prints runtime_root');
  const spawning = new Set(aoforgeSpawns(SPAWN_SCOPES).filter((s) => !s.exempt).map((s) => s.file));
  const missing = [];
  for (const f of [...new Set(SPAWN_SCOPES.flatMap(scopeFiles))]) {
    const text = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    if (!spawning.has(f) && !text.includes('{runtime_root}')) continue;
    if (!runtimeRootSource(text)) missing.push(`${f}${spawning.has(f) ? ' (spawns an AOForge agent)' : ''}`);
  }
  assert.deepEqual(missing, [],
    `run an \`aof-tools.cjs init <cmd>\` whose JSON has runtime_root, or define the fallback once: ${RUNTIME_FALLBACK}`);
});
