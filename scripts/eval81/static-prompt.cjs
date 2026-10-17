#!/usr/bin/env node
'use strict';
/**
 * static-prompt.cjs - TRD 81-07: the static resident-prompt comparison between two release trees.
 *
 * For every agent a plugin ships, and every agent a workflow, skill or fragment spawns, this reports what a
 * spawn carries before any work happens:
 *
 *   body_bytes        the agent definition without its frontmatter (the subagent's system prompt)
 *   agent_bytes       the whole agent file (what `git show <ref>:<path> | wc -c` prints)
 *   max_spawn_bytes   the largest spawn-prompt template that names the agent, as written, placeholders unfilled
 *   named_at          the `@~/.claude/aoforge/...` paths either one names, with their bytes. REPORTED APART:
 *                     objective 76's audit found an `@` path does not cross the Task boundary, so it is not resident
 *   resident_bytes    body_bytes + max_spawn_bytes; resident_tokens = resident_bytes / CHARS_PER_TOKEN (4)
 *
 * Both trees are read through `git ls-tree` and `git show`: nothing is checked out, no worktree is added, nothing
 * is written except the files named by --json and --md. No model call, no network.
 *
 * Usage: node static-prompt.cjs --from <ref> --to <ref> [--repo <dir>] [--json <file>] [--md <file>]
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { CHARS_PER_TOKEN } = require('../../plugins/aoforge/aoforge/bin/lib/context-audit.cjs');

const HOME_PREFIX = '~/.claude/aoforge/';

// ---------------------------------------------------------------------------------------------------------
// git, read-only
// ---------------------------------------------------------------------------------------------------------

function gitBuf(repo, args) {
  return execFileSync('git', ['--no-optional-locks', '-C', repo, ...args], {
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
}

function resolveSha(repo, ref) {
  try {
    return gitBuf(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).toString('utf8').trim();
  } catch {
    throw new Error(`unknown ref: ${ref} (in ${repo})`);
  }
}

function listPluginFiles(repo, ref, sha) {
  try {
    return gitBuf(repo, ['ls-tree', '-r', '-z', '--name-only', sha, '--', 'plugins'])
      .toString('utf8')
      .split('\0')
      .filter(Boolean);
  } catch (e) {
    throw new Error(`git ls-tree failed for ${ref} (${sha}): ${e.message}`);
  }
}

function showFile(repo, ref, sha, file) {
  try {
    return gitBuf(repo, ['show', `${sha}:${file}`]);
  } catch (e) {
    throw new Error(`git show failed for ${ref}:${file} (${sha}): ${e.message}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------------------------------------

const byteLen = (s) => Buffer.byteLength(s, 'utf8');

/** The agent file without its YAML frontmatter; the whole text when there is none. */
function bodyOf(text) {
  const m = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? text.slice(m[0].length) : text;
}

/** Fenced code blocks, CommonMark style: a closing fence is the same character, at least as long, with no info. */
function parseFences(lines) {
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(lines[i]);
    if (!m) continue;
    if (!cur) {
      cur = { open: i, close: lines.length, ch: m[2][0], len: m[2].length, info: m[3].trim() };
    } else if (m[2][0] === cur.ch && m[2].length >= cur.len && m[3].trim() === '') {
      cur.close = i;
      blocks.push(cur);
      cur = null;
    }
  }
  if (cur) blocks.push(cur);
  for (const b of blocks) b.content = lines.slice(b.open + 1, b.close).join('\n');
  return blocks;
}

// ---------------------------------------------------------------------------------------------------------
// spawn-prompt extraction
// ---------------------------------------------------------------------------------------------------------

/** `aoforge-stack-flutter:ui-evaluator` -> `ui-evaluator`. */
const agentName = (subagentType) => String(subagentType).split(':').pop();

/** Lowercased label text of the block that opens at `fence.open`: the nearest non-blank line above it. */
function labelAbove(lines, fence) {
  for (let i = fence.open - 1; i >= 0; i--) {
    if (lines[i].trim() === '') continue;
    return lines[i].replace(/[*_`#>]/g, '').replace(/:\s*$/, '').trim().toLowerCase();
  }
  return '';
}

/**
 * Variable prompt: `prompt=checker_prompt`. The block labelled `Checker prompt:` wins; failing that, the nearest
 * block above the call whose label ends in "prompt" and that follows the previous spawn site; failing that, a
 * markdown block directly above the call (blank lines only between). Never a guess: the form is recorded, and a
 * variable with none of these is null with a reason.
 */
function resolveVariable(name, callLine, enclosing, fences, lines, prevSiteLine) {
  const wanted = name.replace(/_/g, ' ').toLowerCase();
  const limit = enclosing ? enclosing.open : callLine;
  const before = fences.filter((f) => f.close < limit && f.open !== (enclosing ? enclosing.open : -1));
  for (let i = before.length - 1; i >= 0; i--) {
    if (labelAbove(lines, before[i]) === wanted) return { block: before[i], form: 'variable:label' };
  }
  for (let i = before.length - 1; i >= 0; i--) {
    const f = before[i];
    if (f.open <= prevSiteLine) break;
    if (/(^|\s)prompt$/.test(labelAbove(lines, f))) return { block: f, form: 'variable:nearest-labelled' };
  }
  // A markdown block with only blank lines between its closing fence and the call: the template filled just above.
  const adj = before[before.length - 1];
  if (adj && adj.open > prevSiteLine && /^(markdown|md)$/i.test(adj.info)) {
    let blank = true;
    for (let i = adj.close + 1; i < limit; i++) if (lines[i].trim() !== '') blank = false;
    if (blank) return { block: adj, form: 'variable:adjacent-block' };
  }
  return null;
}

const KWARG = '(?:subagent_type|model|description|run_in_background|isolation|name|mode|resume)';

/**
 * Find every agent spawn in a markdown file and the size of its prompt template.
 *
 * Shapes handled:
 *   1. `Task(` or `Agent(` at the start of a line (optionally `x = Task(`) with `prompt="..."`, `prompt="""..."""` or
 *      `prompt=<variable>` and `subagent_type="..."` in any order, inside or outside a fence.
 *   2. map-codebase style: a fenced parameter block holding `subagent_type: "x"`, followed by a `Prompt:` label
 *      and a fenced block holding the prompt.
 *
 * Returns [{file, line, prompt_line, agent, subagent_type, form, prompt_bytes, reason, text}], ordered by line.
 * `prompt_bytes` is null (never a guess) when the prompt cannot be found, with `reason` saying why.
 */
function extractSpawnPrompts(text, file) {
  const lines = text.split('\n');
  const lineStart = [];
  let off = 0;
  for (const l of lines) {
    lineStart.push(off);
    off += l.length + 1;
  }
  const lineOf = (idx) => {
    let lo = 0;
    let hi = lineStart.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStart[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const fences = parseFences(lines);
  const enclosingOf = (line) => fences.find((f) => f.open < line && line < f.close) || null;
  const sites = [];

  const mk = (o) => ({
    file,
    line: o.line + 1,
    prompt_line: o.promptLine == null ? null : o.promptLine + 1,
    agent: o.agent,
    subagent_type: o.subagentType,
    form: o.form,
    prompt_bytes: o.text == null ? null : byteLen(o.text),
    reason: o.reason || null,
    text: o.text == null ? null : o.text,
  });

  // Shape 1: Task( ... )
  const callRe = /^[ \t]*(?:[A-Za-z_]\w*[ \t]*=[ \t]*)?(?:Task|Agent)\(/gm;
  const starts = [];
  const openLen = [];
  let cm;
  while ((cm = callRe.exec(text))) {
    const open = /(?:Task|Agent)\($/.exec(cm[0])[0];
    starts.push(cm.index + cm[0].length - open.length);
    openLen.push(open.length);
  }
  let prevSiteLine = -1;
  for (let k = 0; k < starts.length; k++) {
    const callIdx = starts[k];
    const callLine = lineOf(callIdx);
    const enclosing = enclosingOf(callLine);
    let end = k + 1 < starts.length ? starts[k + 1] : text.length;
    if (enclosing && enclosing.close < lines.length) end = Math.min(end, lineStart[enclosing.close]);
    const region = text.slice(callIdx + openLen[k], end);
    const regionOffset = callIdx + openLen[k];

    const pm = /\bprompt\s*=\s*/.exec(region);
    let promptText = null;
    let promptLine = null;
    let form = null;
    let reason = null;
    let spanStart = -1;
    let spanEnd = -1;
    let variable = null;

    if (pm) {
      const valueAt = pm.index + pm[0].length;
      promptLine = lineOf(regionOffset + pm.index);
      const rest = region.slice(valueAt);
      if (rest.startsWith('"""')) {
        const close = rest.indexOf('"""', 3);
        if (close < 0) {
          form = 'literal';
          reason = 'triple-quoted prompt is not terminated within the call';
        } else {
          form = 'literal';
          promptText = rest.slice(3, close);
          spanStart = valueAt;
          spanEnd = valueAt + close + 3;
        }
      } else if (rest.startsWith('"')) {
        form = 'literal';
        const body = rest.slice(1);
        let close = body.search(new RegExp(`"(?=\\s*,\\s*${KWARG}\\s*=)`));
        if (close < 0) {
          const re = /"(?=\s*,?\s*\))/g;
          let last = -1;
          let mm;
          while ((mm = re.exec(body))) last = mm.index;
          close = last;
        }
        if (close < 0) {
          reason = 'prompt string is not terminated within the call';
        } else {
          promptText = body.slice(0, close);
          spanStart = valueAt;
          spanEnd = valueAt + 1 + close + 1;
          if (promptText.trim() === '...' || promptText.trim() === '…') {
            reason = 'prompt is elided ("...") in the workflow; the full prompt is at an earlier site';
            promptText = null;
          }
        }
      } else {
        const idm = /^([A-Za-z_]\w*)/.exec(rest);
        if (idm) variable = idm[1];
        else reason = 'prompt value is neither a string literal nor a variable';
      }
    } else {
      reason = 'call has no prompt= argument';
    }

    const outside = spanStart >= 0 ? region.slice(0, spanStart) + region.slice(spanEnd) : region;
    const sm = /subagent_type\s*=\s*["']([^"']+)["']/.exec(outside);
    if (!sm) continue; // a Task( that names no subagent_type is not an agent spawn we can attribute

    if (variable) {
      const hit = resolveVariable(variable, callLine, enclosing, fences, lines, prevSiteLine);
      if (hit) {
        promptText = hit.block.content;
        promptLine = hit.block.open;
        form = hit.form;
      } else {
        form = 'variable';
        reason = `prompt=${variable}: no fenced block labelled "${variable.replace(/_/g, ' ')}", no "... prompt:" block and no markdown block directly above the call, after the previous spawn site`;
      }
    }
    sites.push(mk({ line: callLine, promptLine, agent: agentName(sm[1]), subagentType: sm[1], form, text: promptText, reason }));
    prevSiteLine = callLine;
  }

  // Shape 2: parameter block + `Prompt:` block
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*subagent_type:\s*["']([^"']+)["']\s*$/.exec(lines[i]);
    if (!m) continue;
    const params = fences.find((f) => f.open < i && i < f.close);
    if (!params) continue;
    let j = params.close + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    let hit = null;
    let reason = null;
    if (j < lines.length && /^\W*prompt\W*$/i.test(lines[j].trim())) {
      let n = j + 1;
      while (n < lines.length && lines[n].trim() === '') n++;
      hit = fences.find((f) => f.open === n) || null;
      if (!hit) reason = 'a Prompt: label follows the parameter block but no fenced block follows the label';
    } else {
      reason = 'no "Prompt:" label and fenced block follows the parameter block';
    }
    sites.push(
      mk({
        line: i,
        promptLine: hit ? hit.open : null,
        agent: agentName(m[1]),
        subagentType: m[1],
        form: 'parameter-block',
        text: hit ? hit.content : null,
        reason,
      }),
    );
  }

  return sites.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------------------------------------
// named @ paths
// ---------------------------------------------------------------------------------------------------------

/** Repo paths an `@~/.claude/aoforge/<rest>` reference can be served from, in order. */
function repoCandidates(rest) {
  const out = [`plugins/aoforge/aoforge/${rest}`];
  const m = /^stacks\/([^/]+)\/(.+)$/.exec(rest);
  if (m) out.push(`plugins/aoforge-stack-${m[1]}/${m[2]}`);
  return out;
}

/**
 * The `@~/.claude/aoforge/<rest>` paths named in `text`, de-duplicated in order of first appearance. Only an `@`
 * reference counts: a bare `~/.claude/aoforge/...` path is read on demand, not named. `sizeOf(repoPath)` returns a
 * byte count or null; without it only the paths are listed.
 * Returns {paths, resolved, bytes, missing}: `resolved` maps a named path to the repo path that supplied its bytes.
 */
function namedAtPaths(text, sizeOf) {
  const re = /@(~\/\.claude\/aoforge\/[^\s`'"<>()[\]{},;|*]+)/g;
  const paths = [];
  let m;
  while ((m = re.exec(text))) {
    const p = m[1].replace(/[.:!?]+$/, '');
    if (!paths.includes(p)) paths.push(p);
  }
  const resolved = {};
  const missing = [];
  let bytes = 0;
  for (const p of paths) {
    const cands = repoCandidates(p.slice(HOME_PREFIX.length));
    resolved[p] = cands[0];
    if (!sizeOf) continue;
    let found = null;
    for (const c of cands) {
      const n = sizeOf(c);
      if (n != null) {
        found = { c, n };
        break;
      }
    }
    if (found) {
      resolved[p] = found.c;
      bytes += found.n;
    } else {
      missing.push(p);
    }
  }
  return { paths, resolved, bytes, missing };
}

// ---------------------------------------------------------------------------------------------------------
// measure one ref
// ---------------------------------------------------------------------------------------------------------

const SCAN_EXCLUDE = /\/(?:agents|references|__fixtures__|node_modules)\//;

/**
 * Measure every agent in the tree at `ref`.
 * Returns {ref, sha, plugins_tree, agents: {<name>: {...}}}; an agent that is spawned but has no definition in the
 * tree (the built-in general-purpose) has `defined: false` and null agent bytes.
 */
function measureRef(repo, ref) {
  const sha = resolveSha(repo, ref);
  const files = listPluginFiles(repo, ref, sha);
  const fileSet = new Set(files);
  const cache = new Map();
  const read = (p) => {
    if (!cache.has(p)) cache.set(p, showFile(repo, ref, sha, p));
    return cache.get(p);
  };
  const sizeOf = (p) => (fileSet.has(p) ? read(p).length : null);
  let pluginsTree = null;
  try {
    pluginsTree = gitBuf(repo, ['rev-parse', `${sha}:plugins`]).toString('utf8').trim();
  } catch {
    pluginsTree = null;
  }

  // spawn sites, by agent
  const sitesByAgent = new Map();
  for (const f of files) {
    if (!f.endsWith('.md') || SCAN_EXCLUDE.test(f) || /(^|\/)CHANGELOG\.md$/.test(f)) continue;
    const text = read(f).toString('utf8');
    if (!text.includes('subagent_type')) continue;
    for (const s of extractSpawnPrompts(text, f)) {
      if (!sitesByAgent.has(s.agent)) sitesByAgent.set(s.agent, []);
      sitesByAgent.get(s.agent).push(s);
    }
  }

  // agent definitions
  const defs = new Map();
  for (const f of files) {
    const m = /^plugins\/([^/]+)\/agents\/([^/]+)\.md$/.exec(f);
    if (m) defs.set(m[2], { path: f, plugin: m[1] });
  }
  const packPlugins = [...new Set(files.map((f) => /^plugins\/([^/]+)\/aoforge-stack\.json$/.exec(f)).filter(Boolean).map((m) => m[1]))];

  const agents = {};
  const names = [...new Set([...defs.keys(), ...sitesByAgent.keys()])].sort();
  for (const name of names) {
    const def = defs.get(name) || null;
    const sites = sitesByAgent.get(name) || [];
    const agentText = def ? read(def.path).toString('utf8') : '';
    const sized = sites.filter((s) => s.prompt_bytes != null).map((s) => s.prompt_bytes);
    const maxSpawn = sized.length ? Math.max(...sized) : null;
    const namedText = [agentText, ...sites.map((s) => s.text || '')].join('\n');
    const namedAt = namedAtPaths(namedText, sizeOf);
    const bodyBytes = def ? byteLen(bodyOf(agentText)) : null;
    const residentBytes = (bodyBytes || 0) + (maxSpawn || 0);
    const fragments = {};
    for (const p of packPlugins) {
      const frag = `plugins/${p}/fragments/${name}.md`;
      if (fileSet.has(frag)) fragments[p.replace(/^aoforge-stack-/, '')] = read(frag).length;
    }
    agents[name] = {
      path: def ? def.path : null,
      plugin: def ? def.plugin : null,
      pack: def ? def.plugin !== 'aoforge' : false,
      defined: Boolean(def),
      agent_bytes: def ? read(def.path).length : null,
      body_bytes: bodyBytes,
      spawn_sites: sites.map(({ text: _text, ...rest }) => rest),
      max_spawn_bytes: maxSpawn,
      named_at: { paths: namedAt.paths, bytes: namedAt.bytes, missing: namedAt.missing },
      pack_fragments: fragments,
      resident_bytes: residentBytes,
      resident_tokens: Math.round(residentBytes / CHARS_PER_TOKEN),
    };
  }
  return { ref, sha, plugins_tree: pluginsTree, agents };
}

// ---------------------------------------------------------------------------------------------------------
// compare two measurements
// ---------------------------------------------------------------------------------------------------------

function metric(from, to, deltaKey = 'delta_bytes') {
  const f = from == null ? null : from;
  const t = to == null ? null : to;
  if (f == null || t == null) return { from: f, to: t, [deltaKey]: null, delta_pct: null };
  const d = t - f;
  return { from: f, to: t, [deltaKey]: d, delta_pct: f === 0 ? null : Math.round((d / f) * 10000) / 100 + 0 };
}

function groupTotals(rows, side, pack) {
  let count = 0;
  let bytes = 0;
  for (const r of rows) {
    const a = r[side];
    if (!a || !a.defined || a.pack !== pack) continue;
    count += 1;
    bytes += a.resident_bytes;
  }
  return { count, resident_bytes: bytes, resident_tokens: Math.round(bytes / CHARS_PER_TOKEN) };
}

/**
 * Per agent {from, to, delta_bytes, delta_pct} for agent bytes, body bytes, largest spawn template, named @ bytes and
 * the resident estimate, with the pack flag on each side, sorted by resident delta (largest cut first; agents
 * present on one side only last). Totals count core and pack agents apart, each side by its own classification.
 */
function compare(a, b) {
  const names = [...new Set([...Object.keys(a.agents), ...Object.keys(b.agents)])].sort();
  const pairs = names.map((name) => ({ name, from: a.agents[name] || null, to: b.agents[name] || null }));
  const agents = pairs.map(({ name, from, to }) => {
    const resident = metric(from && from.resident_bytes, to && to.resident_bytes);
    return {
      name,
      path: { from: from ? from.path : null, to: to ? to.path : null },
      pack: { from: from ? from.pack : null, to: to ? to.pack : null },
      defined: { from: from ? from.defined : null, to: to ? to.defined : null },
      agent_bytes: metric(from && from.agent_bytes, to && to.agent_bytes),
      body_bytes: metric(from && from.body_bytes, to && to.body_bytes),
      max_spawn_bytes: metric(from && from.max_spawn_bytes, to && to.max_spawn_bytes),
      named_at_bytes: metric(from && from.named_at && from.named_at.bytes, to && to.named_at && to.named_at.bytes),
      resident_bytes: resident,
      resident_tokens: metric(from && from.resident_tokens, to && to.resident_tokens, 'delta_tokens'),
      spawn_sites: { from: from ? from.spawn_sites || [] : null, to: to ? to.spawn_sites || [] : null },
      named_at: { from: from ? from.named_at || null : null, to: to ? to.named_at || null : null },
      pack_fragments: { from: from ? from.pack_fragments || {} : null, to: to ? to.pack_fragments || {} : null },
    };
  });
  agents.sort((x, y) => {
    const dx = x.resident_bytes.delta_bytes;
    const dy = y.resident_bytes.delta_bytes;
    if (dx == null && dy == null) return x.name.localeCompare(y.name);
    if (dx == null) return 1;
    if (dy == null) return -1;
    return dx - dy || x.name.localeCompare(y.name);
  });
  const group = (pack) => {
    const f = groupTotals(pairs, 'from', pack);
    const t = groupTotals(pairs, 'to', pack);
    const m = metric(f.resident_bytes, t.resident_bytes);
    return { from: f, to: t, delta_bytes: m.delta_bytes, delta_pct: m.delta_pct };
  };
  return {
    from: { ref: a.ref, sha: a.sha, plugins_tree: a.plugins_tree || null },
    to: { ref: b.ref, sha: b.sha, plugins_tree: b.plugins_tree || null },
    agents,
    totals: { core: group(false), pack: group(true) },
  };
}

// ---------------------------------------------------------------------------------------------------------
// markdown tables for the report
// ---------------------------------------------------------------------------------------------------------

const cell = (v) => (v == null ? '-' : String(v));
const signed = (v) => (v == null ? '-' : v > 0 ? `+${v}` : String(v));
const pct = (v) => (v == null ? '-' : `${v > 0 ? '+' : ''}${v}%`);

function renderMarkdown(cmp) {
  const f = cmp.from.ref;
  const t = cmp.to.ref;
  const out = [];
  out.push(`Refs: \`${f}\` = ${cmp.from.sha} (plugins tree ${cmp.from.plugins_tree}); \`${t}\` = ${cmp.to.sha} (plugins tree ${cmp.to.plugins_tree}).`, '');
  out.push('## Resident bytes per agent, sorted by resident delta', '');
  out.push(`| Agent | Kind ${f} / ${t} | Body ${f} | Body ${t} | Spawn max ${f} | Spawn max ${t} | Resident ${f} | Resident ${t} | Delta bytes | Delta % | Tokens ${f} | Tokens ${t} |`);
  out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const kind = (p) => (p == null ? 'absent' : p ? 'pack' : 'core');
  for (const r of cmp.agents) {
    out.push(
      `| ${r.name} | ${kind(r.pack.from)} / ${kind(r.pack.to)} | ${cell(r.body_bytes.from)} | ${cell(r.body_bytes.to)} | ${cell(r.max_spawn_bytes.from)} | ${cell(r.max_spawn_bytes.to)} | ${cell(r.resident_bytes.from)} | ${cell(r.resident_bytes.to)} | ${signed(r.resident_bytes.delta_bytes)} | ${pct(r.resident_bytes.delta_pct)} | ${cell(r.resident_tokens.from)} | ${cell(r.resident_tokens.to)} |`,
    );
  }
  out.push('', '## Totals (defined agents; core and pack counted apart, each side by its own classification)', '');
  out.push(`| Group | Agents ${f} | Resident bytes ${f} | Agents ${t} | Resident bytes ${t} | Delta bytes | Delta % |`);
  out.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const g of ['core', 'pack']) {
    const x = cmp.totals[g];
    out.push(`| ${g} | ${x.from.count} | ${x.from.resident_bytes} | ${x.to.count} | ${x.to.resident_bytes} | ${signed(x.delta_bytes)} | ${pct(x.delta_pct)} |`);
  }
  out.push('', '## Named `@` paths (reported apart; they do not cross the Task boundary)', '');
  out.push(`| Agent | Paths ${f} | Bytes ${f} | Missing ${f} | Paths ${t} | Bytes ${t} | Missing ${t} |`);
  out.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const r of cmp.agents) {
    const x = r.named_at.from;
    const y = r.named_at.to;
    out.push(
      `| ${r.name} | ${x ? x.paths.length : '-'} | ${x ? x.bytes : '-'} | ${x ? x.missing.length : '-'} | ${y ? y.paths.length : '-'} | ${y ? y.bytes : '-'} | ${y ? y.missing.length : '-'} |`,
    );
  }
  out.push('', '## Spawn sites', '');
  for (const [side, ref] of [['from', f], ['to', t]]) {
    out.push(`### ${ref}`, '', '| Agent | Site | Template at | Form | Bytes | Reason |', '|---|---|---|---|---:|---|');
    for (const r of cmp.agents) {
      for (const s of r.spawn_sites[side] || []) {
        out.push(`| ${r.name} | ${s.file}:${s.line} | ${s.prompt_line == null ? '-' : s.prompt_line} | ${s.form || '-'} | ${cell(s.prompt_bytes)} | ${s.reason || ''} |`);
      }
    }
    out.push('');
  }
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------

const USAGE = 'usage: static-prompt.cjs --from <ref> --to <ref> [--repo <dir>] [--json <file>] [--md <file>]';

function parseArgs(argv) {
  const opts = { repo: process.cwd(), from: null, to: null, json: null, md: null };
  const known = new Set(['--from', '--to', '--repo', '--json', '--md']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!known.has(a)) throw new Error(`unknown argument: ${a}\n${USAGE}`);
    if (i + 1 >= argv.length) throw new Error(`${a} needs a value\n${USAGE}`);
    opts[a.slice(2)] = argv[++i];
  }
  if (!opts.from || !opts.to) throw new Error(`--from and --to are required\n${USAGE}`);
  return opts;
}

const METHOD = {
  resident_bytes: 'body_bytes + max_spawn_bytes; named @ paths excluded (they do not cross the Task boundary)',
  body_bytes: 'agent file without YAML frontmatter, UTF-8 bytes',
  max_spawn_bytes: 'largest spawn-prompt template naming the agent, as written, placeholders unfilled, UTF-8 bytes; null when none was found',
  resident_tokens: `Math.round(resident_bytes / ${CHARS_PER_TOKEN}) (CHARS_PER_TOKEN from lib/context-audit.cjs; UTF-8 bytes >= chars, so slightly high for non-ASCII)`,
  source: 'git ls-tree and git show only; no checkout, no worktree, no model call, no network',
};

function main(argv) {
  const opts = parseArgs(argv);
  const a = measureRef(opts.repo, opts.from);
  const b = measureRef(opts.repo, opts.to);
  const cmp = compare(a, b);
  if (opts.json) {
    fs.mkdirSync(path.dirname(path.resolve(opts.json)), { recursive: true });
    fs.writeFileSync(opts.json, JSON.stringify({ method: METHOD, chars_per_token: CHARS_PER_TOKEN, ...cmp }, null, 2) + '\n');
  }
  if (opts.md) {
    fs.mkdirSync(path.dirname(path.resolve(opts.md)), { recursive: true });
    fs.writeFileSync(opts.md, renderMarkdown(cmp));
  }
  if (!opts.json && !opts.md) process.stdout.write(renderMarkdown(cmp));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`static-prompt: ${e.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CHARS_PER_TOKEN,
  bodyOf,
  parseFences,
  extractSpawnPrompts,
  namedAtPaths,
  measureRef,
  compare,
  renderMarkdown,
  main,
};
