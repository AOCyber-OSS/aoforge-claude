'use strict';

// model-placeholders.repo.test.cjs — every spawn `model` placeholder names a source its own file supplies.
//
// Objective 76's retroactive verification (76-VERIFICATION SC1) found execute-objective spawning the
// gap-closure planner with `model="{planner_model}"`, which `init execute-objective` never prints, and the
// autonomous checkpoint verifier with `model="{resolved_verifier_model}"`, a name defined nowhere. TRD 76-01
// had fixed the same class in build.md. An unsupplied placeholder reaches the Task call as literal text or
// as nothing, so the agent runs on whatever model the harness defaults to and the profile never binds.
//
// A placeholder is supplied by exactly one of three sources (quick 42, decision 1):
//   (a) a top-level key of the JSON that the file's own `aof-tools.cjs init <cmd>` prints. The command is
//       RUN in a fixture project with a fixture HOME; init.cjs is never parsed, so a refactor of it cannot
//       break the guard;
//   (b) a line `NAME=$(node … resolve-model …)` in the same file;
//   (c) `<!-- model-source: NAME from SRC -->` in the same file, where SRC's root (the text before its first
//       `.`) is itself supplied by (a) or (b).
// Names compare case-insensitively (`DEBUGGER_MODEL=$(…)` supplies `{debugger_model}`). Only identifier
// placeholders are scanned (`{x}`, `{x.y}`, `{x.<focus>}`) in a `model="{…}"` or `model: "{…}"` position.
// Prose placeholders with spaces (`{model from the result}`) name an escalation result in the same
// paragraph and are out of scope by design.
//
// Scan set: plugins/aoforge/aoforge/workflows/**/*.md, plugins/aoforge/skills/**/*.md, and every
// plugins/aoforge-stack-*/ pack's skills/, workflows/ and fragments/ .md files. __fixtures__/ is skipped.
//
// Test list
//  1. real tree: every identifier placeholder in the scan set has a source (RED at quick 42's BASE with
//     exactly 8 findings); the message lists `file:line {name}`
//  2. real tree: no stale `model-source` annotation (its NAME is used as a placeholder in its file)
//  3. behavioural init lookup: each `init <cmd>` named in the scan set runs in the fixture project, exits 0
//     and prints JSON (a command that cannot run fails the test by name); the union of model keys includes
//     the ten profile-driven keys
//  4. unit (the 76 defect): `init execute-objective` + `model="{planner_model}"` is 1 finding; adding a
//     `PLANNER_MODEL=$(… resolve-model planner …)` line makes it 0
//  5. unit: `{resolved_verifier_model}` under `init execute-objective` is 1; `{verifier_model}` is 0
//  6. unit: an annotation from a supplied SRC supplies its NAME; from an unsupplied SRC it does not; an
//     annotation whose NAME is never used is a stale finding
//  7. unit: `{mapper_models.<focus>}` and the YAML form resolve by root under `init map-codebase`; prose
//     placeholders are not scanned; `FOO_MODEL=$(echo sonnet)` supplies nothing (no resolve-model)
//  8. coverage: more than 60 files scanned, including the four named files

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const PLUGINS = path.join(REPO_ROOT, 'plugins');
const PLUGIN = path.join(PLUGINS, 'aoforge');
const IS_AOFORGE_CHECKOUT = fs.existsSync(path.join(REPO_ROOT, 'CLAUDE.md')) && fs.existsSync(path.join(PLUGIN, 'skills'));
const AOF = path.join(__dirname, '..', 'aof-tools.cjs');

const PLACEHOLDER_RE = /\bmodel\s*[=:]\s*"\{([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z0-9_<>]+)*)\}"/g;
const INIT_RE = /aof-tools\.cjs init ([a-z][a-z-]*)/g;
const ASSIGN_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)=\$\([^\n]*\bresolve-model\b/gm;
const ANNOT_RE = /<!--\s*model-source:\s*([A-Za-z_][A-Za-z0-9_]*)\s+from\s+([A-Za-z_][A-Za-z0-9_]*)\S*\s*-->/g;

// Arguments an init command needs to print its JSON in the fixture project.
const ARGS = {
  'execute-objective': ['1'],
  'plan-objective': ['1'],
  'verify-work': ['1'],
  'objective-op': ['1'],
  quick: ['x'],
};

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// Pure: the findings for one file's text. `initKeysOf(cmd)` returns the lowercased top-level keys `init cmd`
// prints.
function checkText(text, initKeysOf) {
  const supplied = new Set();
  for (const m of text.matchAll(INIT_RE)) for (const k of initKeysOf(m[1])) supplied.add(k);
  for (const m of text.matchAll(ASSIGN_RE)) supplied.add(m[1].toLowerCase());
  const annots = [...text.matchAll(ANNOT_RE)].map((m) => ({
    name: m[1], key: m[1].toLowerCase(), src: m[2].toLowerCase(), line: lineOf(text, m.index),
  }));
  const annotated = new Set(annots.filter((a) => supplied.has(a.src)).map((a) => a.key));
  const used = new Set();
  const unsupplied = [];
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const key = m[1].toLowerCase();
    used.add(key);
    if (!supplied.has(key) && !annotated.has(key)) unsupplied.push({ name: m[1] + m[2], line: lineOf(text, m.index) });
  }
  const stale = annots.filter((a) => !used.has(a.key)).map((a) => ({ name: a.name, line: a.line }));
  return { unsupplied, stale };
}

// ── behavioural init lookup ──────────────────────────────────────────────────────────────────────────────

let fixtureDir = null;
const initCache = new Map();

function fixture() {
  if (fixtureDir) return fixtureDir;
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mph-q42-'));
  const plan = path.join(dir, '.aoforge');
  fs.mkdirSync(path.join(plan, 'objectives', '01-demo'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'home'));
  fs.writeFileSync(path.join(plan, 'config.json'), '{}\n');
  fs.writeFileSync(path.join(plan, 'PROJECT.md'), '---\nkind: cli\ndefault_work: feature\n---\n\n# Demo\n');
  fs.writeFileSync(path.join(plan, 'ROADMAP.md'), '# Roadmap\n\n### Objective 1: Demo\n\n**Goal:** demo\n');
  fs.writeFileSync(path.join(plan, 'STATE.md'), '# State\n\n## Current Position\n\nObjective: 1\n');
  fs.writeFileSync(path.join(plan, 'objectives', '01-demo', 'OBJECTIVE.md'), '---\nwork: feature\n---\n\n# Demo\n');
  fixtureDir = dir;
  return dir;
}

function runInit(cmd) {
  const dir = fixture();
  const env = { ...process.env, HOME: path.join(dir, 'home') };
  delete env.AOFORGE_STACKS_DIR;
  const r = spawnSync(process.execPath, [AOF, 'init', cmd, ...(ARGS[cmd] || [])], { cwd: dir, encoding: 'utf8', env });
  if (r.status !== 0) return { error: `exit ${r.status}: ${(r.stderr || '').trim().slice(0, 300)}` };
  try {
    const json = JSON.parse(r.stdout);
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: 'printed JSON that is not an object' };
    return { keys: new Set(Object.keys(json).map((k) => k.toLowerCase())) };
  } catch (e) {
    return { error: `did not print JSON: ${(r.stdout || '').trim().slice(0, 200)}` };
  }
}

function initKeysOf(cmd) {
  if (!initCache.has(cmd)) initCache.set(cmd, runInit(cmd));
  const r = initCache.get(cmd);
  if (r.error) throw new Error(`aof-tools init ${cmd} ${(ARGS[cmd] || []).join(' ')}: ${r.error}`);
  return r.keys;
}

after(() => {
  if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
});

// ── scan set ─────────────────────────────────────────────────────────────────────────────────────────────

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__fixtures__' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
}

function scanFiles() {
  const out = [];
  walk(path.join(PLUGIN, 'aoforge', 'workflows'), out);
  walk(path.join(PLUGIN, 'skills'), out);
  for (const d of fs.readdirSync(PLUGINS).sort()) {
    if (!d.startsWith('aoforge-stack-')) continue;
    for (const sub of ['skills', 'workflows', 'fragments']) walk(path.join(PLUGINS, d, sub), out);
  }
  return out.sort();
}

const rel = (p) => path.relative(REPO_ROOT, p);

describe('model-placeholders.repo.test.cjs', { skip: IS_AOFORGE_CHECKOUT ? false : 'not an AOForge source checkout' }, () => {
  test('1. every identifier model placeholder in the scan set has a source', () => {
    const findings = [];
    for (const f of scanFiles()) {
      for (const u of checkText(fs.readFileSync(f, 'utf8'), initKeysOf).unsupplied) {
        findings.push(`${rel(f)}:${u.line} {${u.name}}`);
      }
    }
    assert.deepEqual(findings, [], `model placeholders with no source (an init key, a resolve-model assignment or a model-source annotation):\n  ${findings.join('\n  ')}`);
  });

  test('2. no stale model-source annotation', () => {
    const findings = [];
    for (const f of scanFiles()) {
      for (const s of checkText(fs.readFileSync(f, 'utf8'), initKeysOf).stale) {
        findings.push(`${rel(f)}:${s.line} model-source ${s.name} (never used as a placeholder)`);
      }
    }
    assert.deepEqual(findings, [], findings.join('\n'));
  });

  test('3. each init command named in the scan set runs in the fixture and prints JSON', () => {
    const cmds = new Set();
    for (const f of scanFiles()) for (const m of fs.readFileSync(f, 'utf8').matchAll(INIT_RE)) cmds.add(m[1]);
    assert.ok(cmds.size >= 10, `expected at least 10 init commands, found ${[...cmds].join(', ')}`);
    const failures = [];
    const modelKeys = new Set();
    for (const cmd of [...cmds].sort()) {
      if (!initCache.has(cmd)) initCache.set(cmd, runInit(cmd));
      const r = initCache.get(cmd);
      if (r.error) { failures.push(`init ${cmd}: ${r.error}`); continue; }
      for (const k of r.keys) if (/_models?$/.test(k)) modelKeys.add(k);
    }
    assert.deepEqual(failures, [], `init commands that could not run in the fixture:\n  ${failures.join('\n  ')}`);
    for (const k of ['executor_model', 'verifier_model', 'planner_model', 'checker_model', 'researcher_model',
      'researcher_models', 'synthesizer_model', 'roadmapper_model', 'mapper_models', 'auditor_model']) {
      assert.ok(modelKeys.has(k), `no init command printed ${k}; saw ${[...modelKeys].sort().join(', ')}`);
    }
  });

  test('4. unit: the 76 defect — {planner_model} under init execute-objective, then resolved', () => {
    const base = 'INIT=$(node ~/.claude/aoforge/bin/aof-tools.cjs init execute-objective "${OBJECTIVE}")\n\nTask(\n  subagent_type="planner",\n  model="{planner_model}",\n)\n';
    const r1 = checkText(base, initKeysOf);
    assert.equal(r1.unsupplied.length, 1);
    assert.equal(r1.unsupplied[0].name, 'planner_model');
    assert.equal(r1.unsupplied[0].line, 5);
    const fixed = 'PLANNER_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model planner --objective "${OBJECTIVE_NUMBER}" --raw)\n' + base;
    assert.equal(checkText(fixed, initKeysOf).unsupplied.length, 0);
  });

  test('5. unit: {resolved_verifier_model} is unsupplied, {verifier_model} is an init key', () => {
    const init = 'node ~/.claude/aoforge/bin/aof-tools.cjs init execute-objective 1\n';
    assert.equal(checkText(init + 'model="{resolved_verifier_model}"\n', initKeysOf).unsupplied.length, 1);
    assert.equal(checkText(init + 'model="{verifier_model}"\n', initKeysOf).unsupplied.length, 0);
  });

  test('6. unit: model-source annotations supply, fail to supply, or go stale', () => {
    const init = 'node ~/.claude/aoforge/bin/aof-tools.cjs init execute-objective 1\n';
    const use = 'Task(model="{resolved_executor_model}")\n';
    const good = checkText(init + '<!-- model-source: resolved_executor_model from executor_model -->\n' + use, initKeysOf);
    assert.deepEqual(good, { unsupplied: [], stale: [] });
    const bad = checkText(init + '<!-- model-source: resolved_executor_model from planner_model -->\n' + use, initKeysOf);
    assert.equal(bad.unsupplied.length + bad.stale.length, 1);
    assert.equal(bad.unsupplied.length, 1);
    const stale = checkText(init + '<!-- model-source: orphan_model from executor_model -->\n', initKeysOf);
    assert.deepEqual(stale, { unsupplied: [], stale: [{ name: 'orphan_model', line: 2 }] });
  });

  test('7. unit: dotted roots, the YAML form, prose placeholders and a non-resolving assignment', () => {
    const init = 'node ~/.claude/aoforge/bin/aof-tools.cjs init map-codebase\n';
    const dotted = checkText(init + 'Task with `model="{mapper_models.<focus>}"`\nmodel: "{mapper_models.tech}"\n', initKeysOf);
    assert.deepEqual(dotted, { unsupplied: [], stale: [] });
    assert.deepEqual(checkText('with `model="{model from the result}"`\n', initKeysOf), { unsupplied: [], stale: [] });
    const echo = checkText('FOO_MODEL=$(echo sonnet)\nTask(model="{FOO_MODEL}")\n', initKeysOf);
    assert.equal(echo.unsupplied.length, 1);
    assert.equal(echo.unsupplied[0].name, 'FOO_MODEL');
  });

  test('8. coverage: the scan set spans core workflows, core skills and the packs', () => {
    const files = scanFiles().map(rel);
    assert.ok(files.length > 60, `expected more than 60 scanned files, got ${files.length}`);
    for (const f of ['plugins/aoforge/aoforge/workflows/execute-objective.md', 'plugins/aoforge/aoforge/workflows/build.md',
      'plugins/aoforge/skills/debug/SKILL.md', 'plugins/aoforge-stack-flutter/skills/ui-eval/SKILL.md']) {
      assert.ok(files.includes(f), `${f} is not scanned`);
    }
  });
});
