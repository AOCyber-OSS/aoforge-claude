'use strict';

/**
 * legacy-adopt-fixtures.cjs (objective 80, TRD 80-01) — hand-built, fleet-shaped pre-rename repositories in every
 * state `adopt` has to handle.
 *
 *   const repo = legacyFleetRepo({ nested: true, decoys: true });   // a 2.x repo: root tree + api/ + web/ trees
 *   repo.run(['adopt', 'preflight']);     // spawn this checkout's aof-tools with --cwd <root>, hermetic env
 *   repo.git(['status', '--porcelain']);  // run git in the repo (throws on a non-zero exit); gitTry() does not throw
 *   repo.snapshot();                      // every file below the root (not .git) + git status + info/exclude
 *   repo.cleanup();
 *
 * The shapes come from the read-only fleet survey of 2026-10-17 (the AO fleet's repositories were looked at, never
 * copied or written; no real repository's content is reproduced here):
 *   - a root planning tree beside nested component trees (`api/`), one of them holding only `objectives/` (`web/`);
 *   - repositories with nested trees and no root tree at all (`rootTree: false`);
 *   - a repository that already has a root `.aoforge/` and still nested pre-rename trees;
 *   - a vendored library with a legacy-named directory of its own (the decoy) and an unrelated directory that
 *     happens to carry the legacy name;
 *   - `config.json` stamped under the pre-rename key (2.x) or the AOForge key (3.0-era);
 *   - a CLAUDE.md managed block under the pre-v1 marker (no version), the versioned marker, the AOFORGE marker or a
 *     malformed one, with hand-written text naming the old product above and below it;
 *   - ignore lines naming the legacy directory in `.gitignore`, `api/.gitignore` and `.git/info/exclude`.
 *
 * Options (the defaults give the 2.x root tree and nothing else):
 *   era           '2.x' (stamp under the pre-rename key, pre-v1 CLAUDE.md block) | '3.0' (stamp under the AOForge key,
 *                 AOFORGE block, still inside the legacy directory) | 'none' (no stamp, no CLAUDE.md block)
 *   stamp         'legacy' | 'aoforge' | 'both' | null   overrides the era's stamp
 *   claudeMd      'pre-v1' | 'versioned' | 'aoforge' | 'malformed' (START, no END) | 'duplicate' (two pre-rename
 *                 blocks) | 'mixed' (a pre-rename block beside an AOFORGE block) | null   overrides the era's block
 *   nested        true: `api/` (config with the stamp, STATE, ROADMAP; its own .gitignore) and `web/` (objectives only)
 *   decoys        true: `vendor/example.com/lib/<legacy dir>/notes.txt` and `docs/<legacy dir>/readme.txt`
 *   untrackedTree true: `.gitignore` ignores the legacy directory everywhere; nothing under it is tracked
 *   rootTree      false: no root planning tree, only the nested ones (implies nested)
 *   commitDocs    false: the root config sets planning.commit_docs false while the tree stays tracked
 *   adoptReport   true: the root tree carries an earlier ADOPT-REPORT.md
 *   state         one of FLEET_STATES (default 'clean')
 *   blank         true: a repository with no legacy anything (code, a plain .gitignore, one commit); every other
 *                 option is ignored
 *
 * Hermetic like legacy-layout-fixtures: a fresh HOME and TMPDIR inside the fixture, git with no system or global
 * config, a local identity, signing off, and none of the product env prefixes from the caller.
 *
 * Legacy names may be spelled here (`__fixtures__/legacy-*` is on the rename guard's ALLOW list), but every token
 * still comes from legacy-names.cjs, so the fixture follows the map. Every file is a hand-written literal.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY } = require('../legacy-names.cjs');

const AOF_TOOLS = path.join(__dirname, '..', '..', 'aof-tools.cjs');

const { planningDir: NEW_DIR, configKey: NEW_KEY, blockTag: NEW_TAG, commandNs: NEW_NS, cli: NEW_CLI, runtimeDir: NEW_RT, product: NEW_PRODUCT } = NAMES;
const { planningDir: OLD_DIR, configKey: OLD_KEY, blockTag: OLD_TAG, commandNs: OLD_NS, cli: OLD_CLI, runtimeDir: OLD_RT, product: OLD_PRODUCT } = LEGACY;

const FLEET_STATES = Object.freeze([
  'clean', 'dirty', 'untracked', 'merge', 'rebase', 'detached', 'both', 'nested-both', 'adopted-on-aoforge',
]);
const ERAS = Object.freeze(['2.x', '3.0', 'none']);
const STAMPS = Object.freeze(['legacy', 'aoforge', 'both']);
const CLAUDE_MD_KINDS = Object.freeze(['pre-v1', 'versioned', 'aoforge', 'malformed', 'duplicate', 'mixed']);

const GIT_REDIRECT_VARS = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_PREFIX', 'GIT_NAMESPACE',
];

const doc = (lines) => `${lines.join('\n')}\n`;

// ─── stamps ───────────────────────────────────────────────────────────────────

/** What a 2.x install recorded under the pre-rename key. */
const LEGACY_STAMP = Object.freeze({
  version: '2.13.1',
  migrations_applied: ['0001', '0004', '0008'],
  upgraded_at: '2026-10-06T13:40:23.250Z',
});

/** The same object with one key only the old stamp holds, so a merge of the two keys shows the shallow merge. */
const LEGACY_STAMP_EXTRA = Object.freeze({ ...LEGACY_STAMP, declined: ['0006'] });

/** What a 3.0.x install recorded under the AOForge key. */
const AOFORGE_STAMP = Object.freeze({
  version: '3.0.0',
  migrations_applied: ['0001', '0004', '0008', '0012', '0013'],
  upgraded_at: '2026-10-09T09:12:44.100Z',
});

/** config.json entries for the stamp(s) `kind` asks for: [[key, value], ...]. */
function stampEntries(kind) {
  if (kind === 'legacy') return [[OLD_KEY, LEGACY_STAMP]];
  if (kind === 'aoforge') return [[NEW_KEY, AOFORGE_STAMP]];
  if (kind === 'both') return [[OLD_KEY, LEGACY_STAMP_EXTRA], [NEW_KEY, AOFORGE_STAMP]];
  return [];
}

/** config.json text: `base` keys in order with the stamp entries inserted at index `at` (default: the end). */
function configText(base, kind, at = Object.keys(base).length) {
  const entries = Object.entries(base);
  entries.splice(at, 0, ...stampEntries(kind));
  return `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`;
}

// ─── CLAUDE.md ────────────────────────────────────────────────────────────────

const CLAUDE_INTRO =
  '# Fleet Demo\n\n' +
  `This service was set up with ${OLD_PRODUCT} in 2025; the notes between the markers are generated.\n\n`;

const CLAUDE_OUTRO =
  '\n\n## Release notes\n\n' +
  `Ask the ${OLD_PRODUCT} maintainers before changing the release flow. Run \`go test ./...\` before every push.\n`;

/** The block body a 2.x install generated: the old product, slash namespace, CLI, runtime path and planning dir. */
const LEGACY_BODY =
  '## Codebase map\n\n' +
  `This project uses ${OLD_PRODUCT}. Refresh the map with \`${OLD_NS}map-codebase\`; it writes \`${OLD_DIR}/codebase/\`.\n\n` +
  `- State lives in \`${OLD_DIR}/STATE.md\`; read it with \`node ~/.claude/${OLD_RT}/bin/${OLD_CLI}.cjs state load\`.\n` +
  `- Small fixes go through \`${OLD_NS}quick\`.`;

/** The same body in its AOForge forms (what the conversion has to produce). */
const CURRENT_BODY =
  '## Codebase map\n\n' +
  `This project uses ${NEW_PRODUCT}. Refresh the map with \`${NEW_NS}map-codebase\`; it writes \`${NEW_DIR}/codebase/\`.\n\n` +
  `- State lives in \`${NEW_DIR}/STATE.md\`; read it with \`node ~/.claude/${NEW_RT}/bin/${NEW_CLI}.cjs state load\`.\n` +
  `- Small fixes go through \`${NEW_NS}quick\`.`;

const startMarker = (tag, kind) => (kind === 'pre-v1'
  ? `<!-- ${tag}:START - Auto-generated by ${tag === OLD_TAG ? OLD_NS : NEW_NS}map-codebase. Edit between these markers will be overwritten. -->`
  : `<!-- ${tag}:START v=2 src=claude-md -->`);
const endMarker = (tag) => `<!-- ${tag}:END -->`;

/** One managed block: START, body, END (END omitted when `end` is false). */
function block(tag, kind, body, end = true) {
  return `${startMarker(tag, kind)}\n${body}${end ? `\n${endMarker(tag)}` : ''}`;
}

/** A project CLAUDE.md of `kind` (see the `claudeMd` option), or null for no file. */
function claudeMdText(kind) {
  if (kind === null || kind === undefined) return null;
  if (!CLAUDE_MD_KINDS.includes(kind)) throw new Error(`claudeMdText: unknown kind ${JSON.stringify(kind)}`);
  let blocks;
  if (kind === 'pre-v1') blocks = block(OLD_TAG, 'pre-v1', LEGACY_BODY);
  else if (kind === 'versioned') blocks = block(OLD_TAG, 'versioned', LEGACY_BODY);
  else if (kind === 'aoforge') blocks = block(NEW_TAG, 'versioned', CURRENT_BODY);
  else if (kind === 'malformed') blocks = block(OLD_TAG, 'pre-v1', LEGACY_BODY, false);
  else if (kind === 'duplicate') {
    blocks = `${block(OLD_TAG, 'pre-v1', LEGACY_BODY)}\n\nA second generated section:\n\n${block(OLD_TAG, 'versioned', LEGACY_BODY)}`;
  } else blocks = `${block(OLD_TAG, 'versioned', LEGACY_BODY)}\n\n${block(NEW_TAG, 'versioned', CURRENT_BODY)}`;
  return `${CLAUDE_INTRO}${blocks}${CLAUDE_OUTRO}`;
}

/** What converting `kind` ('pre-v1' or 'versioned') must produce: the same file with the AOFORGE block and names. */
function convertedClaudeMdText(kind) {
  if (kind !== 'pre-v1' && kind !== 'versioned') throw new Error(`convertedClaudeMdText: cannot convert ${kind}`);
  return `${CLAUDE_INTRO}${block(NEW_TAG, kind, CURRENT_BODY)}${CLAUDE_OUTRO}`;
}

// ─── planning trees ───────────────────────────────────────────────────────────

const PROJECT_MD = doc([
  '---',
  'kind: app',
  'default_work: feature',
  '---',
  '',
  '# Fleet Demo',
  '',
  '## What This Is',
  '',
  `A small service planned with ${OLD_PRODUCT}; the fixture for a project that predates the rename.`,
  '',
  '## Core Value',
  '',
  'Orders are accepted and the customer is told what happened.',
  '',
  '## Requirements',
  '',
  '- [x] FD-01: The service starts and answers a health check',
  '- [ ] FD-02: Orders are validated before they are stored',
]);

const ROADMAP_MD = doc([
  '# Roadmap: Fleet Demo',
  '',
  '## Milestones',
  '',
  '- 🚧 **v1.0 First release** - Objectives 1-2 (in progress)',
  '',
  '## Objectives',
  '',
  '- [x] **Objective 1: Foundation** - The service starts',
  '- [ ] **Objective 2: Next** - Orders are validated',
  '',
  '## Objective Details',
  '',
  '### Objective 1: Foundation',
  '**Goal**: The service starts and answers a health check',
  '**Depends on**: Nothing (first objective)',
  '**Requirements**: FD-01',
  '**Success Criteria** (what must be TRUE):',
  '  1. The health check answers 200',
  '**Plans**: 1 TRD',
  '',
  'TRDs:',
  '- [x] 01-01: Scaffold the service',
  '',
  '### Objective 2: Next',
  '**Goal**: Orders are validated before they are stored',
  '**Depends on**: Objective 1',
  '**Requirements**: FD-02',
  '**Success Criteria** (what must be TRUE):',
  '  1. A malformed order is refused with a reason',
  '**Plans**: 1 TRD',
  '',
  'TRDs:',
  '- [ ] 02-01: Validate orders',
  '',
  '## Progress',
  '',
  '| Objective | TRDs Complete | Status | Completed |',
  '|-----------|---------------|--------|-----------|',
  '| 1. Foundation | 1/1 | Complete | 2026-10-01 |',
  '| 2. Next | 0/1 | Not started | - |',
]);

const REQUIREMENTS_MD = doc([
  '# Requirements: Fleet Demo',
  '',
  '## v1 Requirements',
  '',
  '- [x] **FD-01**: The service starts and answers a health check',
  '- [ ] **FD-02**: Orders are validated before they are stored',
  '',
  '## Traceability',
  '',
  '| Requirement | Objective | Status |',
  '|-------------|-----------|--------|',
  '| FD-01 | Objective 1 | Complete |',
  '| FD-02 | Objective 2 | Pending |',
]);

const STATE_MD = doc([
  '# Project State',
  '',
  '## Current Position',
  '',
  '**Current Objective:** 2',
  '**Current Objective Name:** Next',
  '**Current TRD:** 1',
  '**Total TRDs in Objective:** 1',
  '**Status:** Ready to execute',
  '**Last Activity:** 2026-10-01',
  '**Last Activity Description:** Objective 2 planned',
  '',
  'Progress: [█████░░░░░] 50%',
  '',
  '## Session',
  '',
  `Resume with \`${OLD_NS}execute-objective 2\` (the ${OLD_PRODUCT} session notes stay as written).`,
  '',
  '## Blockers',
  '',
  'None.',
]);

const STATE_ARCHIVE_MD = doc([
  '# State Archive',
  '',
  '## Decisions',
  '',
  '- [Objective 1] Keep the service a single binary',
  '',
  '## Performance Metrics',
  '',
  '| Objective | TRD | Duration | Tasks | Files |',
  '|-----------|-----|----------|-------|-------|',
  '| 1 | 01 | 12min | 1 | 3 |',
]);

const STATE_JSON = `${JSON.stringify({
  current_objective: '2',
  current_job: 1,
  total_jobs: 1,
  progress_pct: 50,
  status: 'planning',
  last_activity: '2026-10-01',
  metrics: { jobs_completed: 1, jobs_failed: 0, sessions: 2 },
  decisions: [],
}, null, 2)}\n`;

const OBJECTIVE_1_MD = doc([
  '---',
  'objective: 01-foundation',
  'work: feature',
  '---',
  '',
  '# Objective 1: Foundation',
  '',
  '## Goal',
  '',
  'The service starts and answers a health check.',
]);

const TRD_01_01 = doc([
  '---',
  'objective: 01-foundation',
  'trd: "01"',
  'type: standard',
  'wave: 1',
  'depends_on: []',
  'autonomous: true',
  'requirements: [FD-01]',
  '---',
  '',
  '# TRD 01-01: Scaffold the service',
  '',
  '<task type="auto">',
  '  <name>Task 1: write src/index.js</name>',
  '  <verify>test -f src/index.js</verify>',
  '</task>',
]);

const SUMMARY_01_01 = doc([
  '---',
  'objective: 01-foundation',
  'trd: "01"',
  'subsystem: service',
  'tags: [scaffold]',
  'requires: []',
  'provides:',
  '  - "a service that answers a health check"',
  'key-files:',
  '  created:',
  '    - src/index.js',
  'completed: 2026-10-01',
  '---',
  '',
  '# Objective 1 TRD 01: Scaffold the service Summary',
  '',
  'A single-file service with a health check.',
  '',
  '## Self-Check: PASSED',
]);

const TRD_02_01 = doc([
  '---',
  'objective: 02-next',
  'trd: "01"',
  'type: standard',
  'wave: 1',
  'depends_on: []',
  'autonomous: true',
  'requirements: [FD-02]',
  '---',
  '',
  '# TRD 02-01: Validate orders',
  '',
  '<task type="auto">',
  '  <name>Task 1: validate an order</name>',
  '  <verify>node --test</verify>',
  '</task>',
]);

const QUICK_PLAN_MD = doc([
  '---',
  'quick: 1',
  'description: Fix a typo in the health message',
  '---',
  '',
  '# Quick 1: fix a typo',
  '',
  '<task type="auto">',
  '  <name>Task 1: fix the typo</name>',
  '  <verify>grep -q ok src/index.js</verify>',
  '</task>',
]);

const QUICK_SUMMARY_MD = doc([
  '---',
  'quick: 1',
  'completed: 2026-10-02',
  '---',
  '',
  '# Quick 1: fix a typo Summary',
  '',
  'The health message now reads "ok".',
]);

const DEBUG_MD = doc([
  '---',
  'status: resolved',
  'trigger: login redirects forever',
  'created: 2026-10-03',
  'updated: 2026-10-03',
  '---',
  '',
  '# Debug: login loop',
  '',
  '## Resolution',
  '',
  'The redirect compared a trailing slash. Fixed in the router.',
]);

const DECISION_MD = doc([
  '---',
  'id: DECISION-001',
  'status: accepted',
  'date: 2026-10-01',
  '---',
  '',
  '# DECISION-001: Keep the service a single binary',
  '',
  'One binary is easier to ship than two services.',
]);

const TODO_MD = doc([
  '---',
  'created: 2026-10-01',
  'title: Tidy the route table',
  'area: api',
  '---',
  '',
  '## Problem',
  '',
  'The route table has two names for one handler.',
]);

const ADOPT_REPORT_MD = doc([
  '# Adopt Report',
  '',
  'An earlier adopt run recorded this report (hand-written for the fixture).',
  '',
  '## Result',
  '',
  'Adopted on branch aoforge/adopt.',
]);

const API_STATE_MD = doc([
  '# Project State',
  '',
  '## Current Position',
  '',
  '**Current Objective:** 1',
  '**Current Objective Name:** API',
  '**Status:** In progress',
  '**Last Activity:** 2026-09-20',
]);

const API_ROADMAP_MD = doc([
  '# Roadmap: API',
  '',
  '## Objectives',
  '',
  '- [ ] **Objective 1: API** - The API answers orders',
  '',
  '## Progress',
  '',
  '| Objective | TRDs Complete | Status | Completed |',
  '|-----------|---------------|--------|-----------|',
  '| 1. API | 0/1 | Not started | - |',
]);

const WEB_TRD_MD = doc([
  '---',
  'objective: 01-web',
  'trd: "01"',
  'type: standard',
  'wave: 1',
  'depends_on: []',
  'autonomous: true',
  '---',
  '',
  '# TRD 01-01: Web shell',
  '',
  '<task type="auto">',
  '  <name>Task 1: render the shell</name>',
  '  <verify>test -f web/src/main.js</verify>',
  '</task>',
]);

/** The root tree, relative to its planning directory. */
function rootTreeFiles({ stamp, commitDocs, adoptReport }) {
  const base = {
    mode: 'yolo',
    depth: 'standard',
    workflow: { research: true, job_check: true, verifier: true, auto_advance: true },
    planning: { commit_docs: commitDocs, search_gitignored: false },
    parallelization: { enabled: true, job_level: true, max_concurrent_agents: 3 },
    gates: { confirm_project: true, confirm_objectives: true, editGate: 'strict' },
    safety: { always_confirm_destructive: true },
    github: { enabled: false, store: false },
  };
  return {
    'PROJECT.md': PROJECT_MD,
    'ROADMAP.md': ROADMAP_MD,
    'STATE.md': STATE_MD,
    'REQUIREMENTS.md': REQUIREMENTS_MD,
    'state.json': STATE_JSON,
    'STATE_ARCHIVE.md': STATE_ARCHIVE_MD,
    'config.json': configText(base, stamp),
    'objectives/01-foundation/OBJECTIVE.md': OBJECTIVE_1_MD,
    'objectives/01-foundation/01-01-TRD.md': TRD_01_01,
    'objectives/01-foundation/01-01-SUMMARY.md': SUMMARY_01_01,
    'objectives/02-next/02-01-TRD.md': TRD_02_01,
    'quick/1-fix-typo/1-PLAN.md': QUICK_PLAN_MD,
    'quick/1-fix-typo/1-SUMMARY.md': QUICK_SUMMARY_MD,
    'debug/resolved/login-loop.md': DEBUG_MD,
    'decisions/accepted/DECISION-001.md': DECISION_MD,
    'todos/pending/2026-10-01-tidy.md': TODO_MD,
    ...(adoptReport ? { 'ADOPT-REPORT.md': ADOPT_REPORT_MD } : {}),
  };
}

/** `api/`'s tree: config with the stamp between two settings (so a rename keeps its position), STATE, ROADMAP. */
function apiTreeFiles({ stamp }) {
  const base = { mode: 'yolo', depth: 'standard', planning: { commit_docs: true } };
  return {
    'config.json': configText(base, stamp, 2),
    'STATE.md': API_STATE_MD,
    'ROADMAP.md': API_ROADMAP_MD,
  };
}

/** `web/`'s tree: objectives only, no marker file (the shape that needs the subdirectory rule). */
function webTreeFiles() {
  return { 'objectives/01-web/01-01-TRD.md': WEB_TRD_MD };
}

// ─── ignore files ─────────────────────────────────────────────────────────────

const ROOT_GITIGNORE = doc([
  'node_modules/',
  '',
  `# ${OLD_PRODUCT} runtime state (migration 0008)`,
  `${OLD_DIR}/.progress-guard.json`,
  `**/${OLD_DIR}/.skill-active`,
  `${OLD_DIR}/.awareness-cache.json`,
  `${NEW_DIR}/.awareness-cache.json`,
]);

const API_GITIGNORE = doc([
  '*.log',
  `${OLD_DIR}/.progress-guard.json`,
]);

/** The line `.git/info/exclude` carries for the upgrade hook's notices file. */
const LEGACY_EXCLUDE_LINE = `${OLD_DIR}/${LEGACY.notices}`;

// ─── helpers ──────────────────────────────────────────────────────────────────

function writeFiles(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

function hermeticEnv(home, tmp) {
  const env = { ...process.env };
  for (const key of GIT_REDIRECT_VARS) delete env[key];
  for (const key of Object.keys(env)) {
    if (key.startsWith(NAMES.envPrefix) || key.startsWith(LEGACY.envPrefix)) delete env[key];
  }
  env.HOME = home;
  env.XDG_CONFIG_HOME = path.join(home, '.config');
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = path.join(home, '.gitconfig');
  env.TMPDIR = tmp;
  return env;
}

function gitTry(root, env, args) {
  const r = spawnSync('git', ['-C', root, ...args], { env, encoding: 'utf-8' });
  if (r.error) throw new Error(`git ${args.join(' ')}: ${r.error.message}`);
  return { status: r.status, out: r.stdout || '', err: (r.stderr || '').trim() };
}

function git(root, env, args) {
  const r = gitTry(root, env, args);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed (${r.status}): ${r.err}`);
  return r.out;
}

/** Every file below `root` (not the root's .git) as { 'a/b.txt': text, 'dir/': '', 'link': '-> target' }. */
function treeSnapshot(root) {
  const out = {};
  const walk = (dir, rel) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entries) {
      if (rel === '' && e.name === '.git') continue;
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) out[relPath] = `-> ${fs.readlinkSync(abs)}`;
      else if (e.isDirectory()) {
        out[`${relPath}/`] = '';
        walk(abs, relPath);
      } else out[relPath] = fs.readFileSync(abs, 'utf-8');
    }
  };
  walk(root, '');
  return out;
}

// ─── legacyFleetRepo ──────────────────────────────────────────────────────────

/**
 * Build a pre-rename repository (see the header for the options).
 *
 * @returns {{ root: string, home: string, tmp: string, env: object, opts: object,
 *             run: function(string[], object=): {status: number, stdout: string, stderr: string, out: string},
 *             git: function(string[]): string, gitTry: function(string[]): {status: number, out: string, err: string},
 *             snapshot: function(): object, cleanup: function(): void }}
 */
function legacyFleetRepo(options = {}) {
  const {
    era = '2.x', stamp: stampOpt, claudeMd: claudeMdOpt, nested: nestedOpt = false, decoys = false,
    untrackedTree = false, rootTree = true, commitDocs = true, adoptReport = false, state = 'clean', blank = false,
  } = options;
  if (!ERAS.includes(era)) throw new Error(`legacyFleetRepo: unknown era ${JSON.stringify(era)} (expected ${ERAS.join(', ')})`);
  if (!FLEET_STATES.includes(state)) {
    throw new Error(`legacyFleetRepo: unknown state ${JSON.stringify(state)} (expected one of ${FLEET_STATES.join(', ')})`);
  }
  if (stampOpt !== undefined && stampOpt !== null && !STAMPS.includes(stampOpt)) {
    throw new Error(`legacyFleetRepo: unknown stamp ${JSON.stringify(stampOpt)} (expected ${STAMPS.join(', ')} or null)`);
  }
  if (claudeMdOpt !== undefined && claudeMdOpt !== null && !CLAUDE_MD_KINDS.includes(claudeMdOpt)) {
    throw new Error(`legacyFleetRepo: unknown claudeMd ${JSON.stringify(claudeMdOpt)} (expected ${CLAUDE_MD_KINDS.join(', ')} or null)`);
  }

  const adopted = state === 'adopted-on-aoforge';
  const nested = !blank && (nestedOpt || !rootTree || state === 'nested-both');
  const eraStamp = era === '2.x' ? 'legacy' : era === '3.0' ? 'aoforge' : null;
  const eraBlock = era === '2.x' ? 'pre-v1' : era === '3.0' ? 'aoforge' : null;
  const stamp = adopted && stampOpt === undefined ? 'legacy' : stampOpt === undefined ? eraStamp : stampOpt;
  const claudeMd = blank ? null : adopted && claudeMdOpt === undefined ? 'pre-v1' : claudeMdOpt === undefined ? eraBlock : claudeMdOpt;

  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aof-adopt-')));
  const root = path.join(base, 'repo');
  const home = path.join(base, 'home');
  const tmp = path.join(base, 'tmp');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });
  const env = hermeticEnv(home, tmp);

  try {
    // Code, so the repository looks like a project and not a planning tree alone.
    writeFiles(root, {
      'package.json': `${JSON.stringify({ name: 'fleet-demo', version: '1.0.0', private: true }, null, 2)}\n`,
      'src/index.js': "'use strict';\nconsole.log('ok');\n",
    });

    const gitignore = blank ? 'node_modules/\n' : untrackedTree ? `${ROOT_GITIGNORE}${OLD_DIR}/\n` : ROOT_GITIGNORE;
    writeFiles(root, { '.gitignore': gitignore });
    const claudeText = claudeMdText(claudeMd);
    if (claudeText !== null) writeFiles(root, { 'CLAUDE.md': claudeText });

    // The root tree lives in the legacy directory, except in the already-moved state.
    const rootDir = adopted ? NEW_DIR : OLD_DIR;
    if (rootTree && !blank) writeFiles(path.join(root, rootDir), rootTreeFiles({ stamp, commitDocs, adoptReport }));
    if (state === 'both' && !blank) {
      writeFiles(path.join(root, NEW_DIR), { 'config.json': `${JSON.stringify({ mode: 'yolo' }, null, 2)}\n` });
    }

    if (nested) {
      writeFiles(root, {
        'api/src/server.js': "'use strict';\nmodule.exports = () => 'orders';\n",
        'api/.gitignore': API_GITIGNORE,
        'web/src/main.js': "'use strict';\nconsole.log('web');\n",
      });
      writeFiles(path.join(root, 'api', adopted ? NEW_DIR : OLD_DIR), apiTreeFiles({ stamp }));
      writeFiles(path.join(root, 'web', adopted ? NEW_DIR : OLD_DIR), webTreeFiles());
      if (state === 'nested-both') {
        writeFiles(path.join(root, 'api', NEW_DIR), { 'STATE.md': API_STATE_MD });
      }
    }
    if (decoys && !blank) {
      writeFiles(root, {
        [`vendor/example.com/lib/${OLD_DIR}/notes.txt`]: 'Notes that belong to a vendored library, not to this project.\n',
        [`docs/${OLD_DIR}/readme.txt`]: 'A directory that only happens to carry the old planning name.\n',
      });
    }

    git(root, env, ['init', '-q', '-b', 'main']);
    git(root, env, ['config', 'user.name', 'Adopt Fixture']);
    git(root, env, ['config', 'user.email', 'adopt@example.invalid']);
    git(root, env, ['config', 'commit.gpgsign', 'false']);
    git(root, env, ['config', 'tag.gpgsign', 'false']);

    // The runtime marker and the info/exclude line are written before `git add -A`, so the first is ignored and
    // the second is not a file at all.
    const excludePath = path.resolve(root, git(root, env, ['rev-parse', '--git-path', 'info/exclude']).trim());
    fs.mkdirSync(path.dirname(excludePath), { recursive: true });
    const priorExclude = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf-8') : '';
    if (!blank) {
      fs.writeFileSync(excludePath, `${priorExclude}${priorExclude && !priorExclude.endsWith('\n') ? '\n' : ''}${LEGACY_EXCLUDE_LINE}\n`);
    }

    if (rootTree && !adopted && !blank) {
      fs.writeFileSync(path.join(root, OLD_DIR, '.skill-active'), `${JSON.stringify({ skill: 'execute-objective' })}\n`);
    }

    git(root, env, ['add', '-A']);
    git(root, env, ['commit', '-q', '-m', 'init']);

    if (!blank) applyState(root, env, state, rootTree ? [rootDir, 'STATE.md'] : ['api', OLD_DIR, 'STATE.md']);
  } catch (e) {
    fs.rmSync(base, { recursive: true, force: true });
    throw e;
  }

  /** Spawn this checkout's aof-tools with `--cwd <root>` from a neutral directory. */
  const run = (args, { cwd = base, extraEnv = {} } = {}) => {
    const r = spawnSync(process.execPath, [AOF_TOOLS, '--cwd', root, ...args], {
      cwd, env: { ...env, ...extraEnv }, encoding: 'utf-8', timeout: 60000,
    });
    const stdout = r.stdout || '';
    const stderr = r.stderr || '';
    return { status: r.status, stdout, stderr, out: stdout + stderr };
  };

  const snapshot = () => {
    const snap = treeSnapshot(root);
    snap[':git-status'] = gitTry(root, env, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).out;
    const excl = path.resolve(root, gitTry(root, env, ['rev-parse', '--git-path', 'info/exclude']).out.trim());
    snap[':git-exclude'] = fs.existsSync(excl) ? fs.readFileSync(excl, 'utf-8') : '';
    return snap;
  };

  return {
    root,
    home,
    tmp,
    env,
    opts: { era, stamp, claudeMd, nested, decoys, untrackedTree, rootTree, commitDocs, adoptReport, state },
    run,
    git: (args) => git(root, env, args),
    gitTry: (args) => gitTry(root, env, args),
    snapshot,
    cleanup: () => fs.rmSync(base, { recursive: true, force: true }),
  };
}

/** The post-commit part of a FLEET_STATES variant (the layout variants were written before the commit). */
function applyState(root, env, state, dirtyRel) {
  if (state === 'dirty') {
    const stateMd = path.join(root, ...dirtyRel);
    fs.appendFileSync(stateMd, '\nA line the user added and has not committed.\n');
  } else if (state === 'untracked') {
    fs.writeFileSync(path.join(root, 'notes.txt'), 'A scratch note that is neither tracked nor ignored.\n');
  } else if (state === 'merge') {
    const p = path.resolve(root, git(root, env, ['rev-parse', '--git-path', 'MERGE_HEAD']).trim());
    fs.writeFileSync(p, `${git(root, env, ['rev-parse', 'HEAD']).trim()}\n`);
  } else if (state === 'rebase') {
    const p = path.resolve(root, git(root, env, ['rev-parse', '--git-path', 'rebase-merge']).trim());
    fs.mkdirSync(p, { recursive: true });
  } else if (state === 'detached') {
    git(root, env, ['checkout', '-q', '--detach']);
  }
}

module.exports = {
  FLEET_STATES,
  ERAS,
  STAMPS,
  CLAUDE_MD_KINDS,
  LEGACY_STAMP,
  LEGACY_STAMP_EXTRA,
  AOFORGE_STAMP,
  LEGACY_EXCLUDE_LINE,
  ROOT_GITIGNORE,
  API_GITIGNORE,
  CLAUDE_INTRO,
  CLAUDE_OUTRO,
  LEGACY_BODY,
  CURRENT_BODY,
  claudeMdText,
  convertedClaudeMdText,
  legacyFleetRepo,
};
