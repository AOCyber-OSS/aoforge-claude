'use strict';

// Test E (76-08: AOForge 3.0.0 vs 3.1.0 on one fixed workload) project builder, TRD 81-12.
//
// One small Node CLI project, `notekit`, materialised on demand into a directory the caller owns. Both plugin versions
// run the same workload on the same bytes:
//
//   /aoforge:quick <QUICK_TEXT>                  x3 per version, a one-change task on the base project
//   /aoforge:build 1 --skip-research --auto      x2 per version, the unplanned two-feature objective 1 ("Tags")
//
// The project: CommonJS, no dependencies, `src/cli.js` with `add <text>` and `list`, `src/store.js` over `notes.json`
// (an array of {id, text}; NOTEKIT_FILE names another file), tests under `test/` run by `node --test`. The planning
// tree (`.aoforge/`) is valid for both versions: PROJECT.md (kind cli, default_work feature), REQUIREMENTS.md (TAG-01,
// TAG-02), ROADMAP.md with Objective 1 "Tags" and no TRDs yet, OBJECTIVE.md (work feature), STATE.md, state.json and
// config.json (model_profile balanced, mode yolo, workflow.auto_advance true, workflow.research false).
//
// Version stamp: `aoforge.version` is 3.0.0 with every migration id v3.0.0 ships (0001..0014, read by hand once with
// `git ls-tree --name-only v3.0.0 plugins/aoforge/aoforge/bin/lib/migrations/` on 2026-10-17 and fixed here), so the
// 3.0.0 plugin sees a current project and the 3.1.0 plugin's SessionStart upgrade hook stamps it to 3.1.0 in place
// and commits that (real upgrade behaviour; code only, zero tokens). The config body is the v3.0.0 template, which is
// byte-identical to the 3.1.0 template.
//
// Why a builder and not files on disk: npm test globs scripts/**/*.test.cjs and a nested .aoforge/ tree inside this
// repository would confuse tools that walk planning roots. Every file body below is a hand-written literal; the
// builder writes them into an empty directory and commits them with a fixed author, fixed dates and fixed messages, so
// two builds give the same tree and the same commit hashes. The repository text names nothing about how its runs are
// judged: the judging code lives in sibling modules that this builder never reads or copies.
//
// Runtime model: buildFixture(dir) spawns `git` with cwd = dir and a fixed, minimal environment (no user git config,
// no hooks, no signing). It writes only below dir and reads nothing from the real HOME.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// The fixed workload. These strings are the prompts of every E run (batches/E.cjs); never edit one between versions.
const QUICK_TEXT = 'Add a --json flag to `notekit list` that prints the notes as a JSON array of {id, text} objects, with a test.';
const BUILD_ARGS = '1 --skip-research --auto';
const QUICK_PROMPT = `/aoforge:quick ${QUICK_TEXT}`;
const BUILD_PROMPT = `/aoforge:build ${BUILD_ARGS}`;

// v3.0.0's migration ids (0001..0014), from `git ls-tree --name-only v3.0.0 plugins/aoforge/aoforge/bin/lib/migrations/`.
const V300_MIGRATIONS = ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009', '0010', '0011', '0012', '0013', '0014'];
const STAMP_VERSION = '3.0.0';

// The git identity and clock of every commit. "Project Author" on purpose: nothing in the repository says what it is for.
const AUTHOR = { name: 'Project Author', email: 'author@example.invalid' };
const COMMIT_DATES = ['2026-10-01T10:00:00Z', '2026-10-01T10:10:00Z', '2026-10-01T10:20:00Z'];
const STAMP_DATE = '2026-10-01T10:20:00.000Z';
const DAY = '2026-10-01';

const OBJECTIVE_SLUG = 'tags';
const OBJECTIVE_DIR = `.aoforge/objectives/01-${OBJECTIVE_SLUG}`;
const REQUIREMENTS = [
  ['TAG-01', '¦notekit tag <id> <tag>¦ adds a tag to a note and saves it'],
  ['TAG-02', '¦notekit list --tag <tag>¦ lists only the notes that carry the tag'],
];
const CRITERIA = [
  '¦notekit tag <id> <tag>¦ persists a tag on the note',
  '¦notekit list --tag <tag>¦ lists only the matching notes',
  'Tests cover both (¦node --test¦ passes)',
];
const GOAL = 'Notes can be tagged and listed by tag';
const CORE_VALUE = 'Jotting a note down and finding it again takes one command.';
const ONE_LINE = 'A small command line tool for short notes kept in one JSON file.';

const MESSAGES = [
  'chore: scaffold notekit with add and list',
  'test: cover the store and the add and list commands',
  'docs: plan the tags milestone',
];

// ─── String helpers ─────────────────────────────────────────────────────────────────────────────────────────
// `js` keeps backslashes as written (\n inside string literals). `md` does the same and turns the broken bar into a
// backtick, so markdown code spans need no escaping inside a template literal.
const raw = (strings, ...values) => String.raw({ raw: strings.raw }, ...values);
const js = raw;
const md = (strings, ...values) => raw(strings, ...values).replace(/¦/g, '`');
const bt = (s) => s.replace(/¦/g, '`');
const json = (value) => JSON.stringify(value, null, 2) + '\n';

// ─── Project files ──────────────────────────────────────────────────────────────────────────────────────────

const PACKAGE_JSON = json({ name: 'notekit', version: '1.0.0', private: true, scripts: { test: 'node --test' } });

const README = md`# notekit

${ONE_LINE}

    node src/cli.js add "Buy coffee beans"
    node src/cli.js list

Notes are kept in ¦notes.json¦ in the current directory; set ¦NOTEKIT_FILE¦ to use another file.
`;

const GITIGNORE = 'node_modules/\n';

const NOTES_JSON = json([
  { id: 1, text: 'Buy coffee beans' },
  { id: 2, text: 'Call the plumber' },
  { id: 3, text: 'Read chapter four' },
]);

const STORE_JS = js`'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Where the notes live: the file named by NOTEKIT_FILE, else notes.json in the current directory.
function notesFile() {
  return process.env.NOTEKIT_FILE || path.join(process.cwd(), 'notes.json');
}

// Every note, oldest first. A missing file means no notes yet.
function loadNotes(file = notesFile()) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveNotes(notes, file = notesFile()) {
  fs.writeFileSync(file, JSON.stringify(notes, null, 2) + '\n');
}

// Appends a note with the next free id and returns it.
function addNote(text, file = notesFile()) {
  const notes = loadNotes(file);
  const id = notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
  const note = { id, text };
  notes.push(note);
  saveNotes(notes, file);
  return note;
}

module.exports = { notesFile, loadNotes, saveNotes, addNote };
`;

const CLI_JS = js`#!/usr/bin/env node
'use strict';

const { loadNotes, addNote } = require('./store.js');

const USAGE = 'usage: notekit <add <text>|list>\n';

function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'add': {
      if (rest.length === 0) {
        process.stderr.write(USAGE);
        return 1;
      }
      const note = addNote(rest.join(' '));
      process.stdout.write('added ' + note.id + '\n');
      return 0;
    }
    case 'list':
      for (const note of loadNotes()) {
        process.stdout.write(note.id + '. ' + note.text + '\n');
      }
      return 0;
    default:
      process.stderr.write(USAGE);
      return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main };
`;

const STORE_TEST_JS = js`'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadNotes, addNote } = require('../src/store.js');

const dirs = [];
after(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notekit-store-'));
  dirs.push(dir);
  return path.join(dir, 'notes.json');
}

test('a missing file reads as no notes', () => {
  assert.deepEqual(loadNotes(tempFile()), []);
});

test('addNote numbers notes from 1 and saves them', () => {
  const file = tempFile();
  assert.deepEqual(addNote('first', file), { id: 1, text: 'first' });
  assert.deepEqual(addNote('second', file), { id: 2, text: 'second' });
  assert.deepEqual(loadNotes(file), [
    { id: 1, text: 'first' },
    { id: 2, text: 'second' },
  ]);
});
`;

const CLI_TEST_JS = js`'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');

const dirs = [];
after(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notekit-cli-'));
  dirs.push(dir);
  return path.join(dir, 'notes.json');
}

function run(file, ...args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NOTEKIT_FILE: file },
  });
}

test('add then list prints each note on its own line', () => {
  const file = tempFile();
  assert.equal(run(file, 'add', 'buy', 'milk').stdout, 'added 1\n');
  assert.equal(run(file, 'add', 'call home').stdout, 'added 2\n');
  const result = run(file, 'list');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '1. buy milk\n2. call home\n');
});

test('list with no notes prints nothing', () => {
  const result = run(tempFile(), 'list');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('add without text prints usage and exits 1', () => {
  const result = run(tempFile(), 'add');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: notekit/);
});

test('an unknown command prints usage and exits 1', () => {
  const result = run(tempFile(), 'remove', '1');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: notekit/);
});
`;

// ─── Planning documents ─────────────────────────────────────────────────────────────────────────────────────

const PROJECT_MD = md`---
kind: cli
default_work: feature
---

# notekit

## What This Is

${ONE_LINE}

## Core Value

${CORE_VALUE}

## Requirements

### Validated

- ¦notekit add <text>¦ stores a note with the next free id
- ¦notekit list¦ prints every note, one per line

### Active

${REQUIREMENTS.map(([id, text]) => `- ${id}: ${text}`).join('\n')}

## Constraints

- Node.js CommonJS, no dependencies
- Tests run with ¦node --test¦
- Notes live in ¦notes.json¦ in the current directory, or the file named by ¦NOTEKIT_FILE¦; existing notes have no tags
`;

const REQUIREMENTS_MD = md`# Requirements: notekit

**Defined:** ${DAY}
**Core Value:** ${CORE_VALUE}

## v1 Requirements

### Tags

${REQUIREMENTS.map(([id, text]) => `- [ ] **${id}**: ${text}`).join('\n')}

## v2 Requirements

None yet.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Removing a tag | Not needed for the first release |

## Traceability

| Requirement | Objective | Status |
|-------------|-----------|--------|
${REQUIREMENTS.map(([id]) => `| ${id} | Objective 1 | Pending |`).join('\n')}
`;

const ROADMAP_MD = md`# Roadmap: notekit

## Overview

notekit already adds and lists notes. This milestone lets a note carry tags and lists the notes for one tag.

## Milestones

- **v1.0** (current): ${GOAL}

## Objectives

- [ ] **Objective 1: Tags** - ${GOAL}

## Objective Details

### Objective 1: Tags
**Goal**: ${GOAL}
**Depends on**: Nothing (first objective)
**Requirements**: ${REQUIREMENTS.map(([id]) => id).join(', ')}
**Success Criteria** (what must be TRUE):
${CRITERIA.map((c, i) => `  ${i + 1}. ${bt(c)}`).join('\n')}
**Plans**: TBD

## Progress

| Objective | Milestone | Plans | Status | Completed |
|---|---|---|---|---|
| 1. Tags | v1.0 | 0/0 | Not started | - |
`;

const OBJECTIVE_MD = md`---
work: feature
---

# Tags

## Goal

${GOAL}.

## Requirements

${REQUIREMENTS.map(([id, text]) => `- ${id}: ${text}`).join('\n')}

## Success Criteria

${CRITERIA.map((c, i) => `${i + 1}. ${bt(c)}`).join('\n')}
`;

const STATE_MD = md`# Project State

## Project Reference

See: .aoforge/PROJECT.md (updated ${DAY})

**Core value:** ${CORE_VALUE}
**Current focus:** Objective 1: Tags

## Current Position

Objective: 1 of 1 (Tags)
Job: 0 of 0 in current objective
Status: Ready to plan
Last activity: ${DAY} — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

> Decisions and performance metrics are logged in STATE_ARCHIVE.md.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: ${DAY} 10:20
Stopped at: Roadmap created
Resume file: None
`;

// The machine-readable sidecar of STATE.md, hand-written so no migration has to seed it.
const STATE_JSON = json({
  current_objective: '1',
  current_job: 0,
  total_jobs: 0,
  progress_pct: 0,
  status: 'ready_to_plan',
  last_activity: DAY,
  metrics: { jobs_completed: 0, jobs_failed: 0, sessions: 1 },
  decisions: [],
  blockers: [],
  session_log: [],
});

// The v3.0.0 config template (identical in 3.1.0) with the workload's settings and the 3.0.0 stamp.
const CONFIG_JSON = json({
  mode: 'yolo',
  depth: 'standard',
  model_profile: 'balanced',
  job_checker_enabled: true,
  workflow: {
    research: false,
    job_check: true,
    verifier: true,
    auto_advance: true,
    verifier_checkpoints: false,
    decision_queue: false,
  },
  planning: { commit_docs: true, search_gitignored: false },
  parallelization: {
    enabled: true,
    job_level: true,
    task_level: false,
    skip_checkpoints: true,
    max_concurrent_agents: 3,
    min_jobs_for_parallel: 2,
  },
  gates: {
    confirm_project: true,
    confirm_objectives: true,
    confirm_roadmap: true,
    confirm_breakdown: true,
    confirm_job: true,
    execute_next_job: true,
    issues_review: true,
    confirm_transition: true,
    editGate: 'strict',
  },
  safety: { always_confirm_destructive: true, always_confirm_external_services: true },
  workstreams: { worktree_prefix: '../{project}-ws-', branch_prefix: 'df/ws-', merge_strategy: 'squash' },
  github: {
    enabled: false,
    store: false,
    mirror_only: false,
    repo: '',
    milestone_prefix: 'v',
    project_cache_ttl_minutes: 360,
    app_login: '',
    app_id: '',
    checks_workflow: '',
    labels: {
      objective: 'aoforge:objective',
      in_progress: 'aoforge:in-progress',
      gaps: 'aoforge:gaps',
      trd: 'aoforge:trd',
      decision: 'aoforge:decision',
    },
    wiki: { remote: '' },
    pr: { merge_method: 'squash' },
  },
  awareness: {
    cache_ttl_minutes: 10,
    peer_stale_days: 30,
    branch_patterns: ['feature/*', 'df/*', 'fix/*', 'proposal/*'],
    org_project_id: 'PVT_kwDODwqLrc4BRsOP',
    sibling_repos: [],
    eden_libs_path: null,
  },
  daemon: {
    notifications: false,
    notify_on_start: true,
    notify_on_complete: true,
    auto_launch: false,
    multi_project: false,
    cross_shell: [],
    status_line: false,
  },
  aoforge: { version: STAMP_VERSION, migrations_applied: V300_MIGRATIONS, upgraded_at: STAMP_DATE },
});

// The three commits: [message, date, files-by-path].
function commitPlan() {
  const scaffold = {
    'package.json': PACKAGE_JSON,
    'README.md': README,
    '.gitignore': GITIGNORE,
    'notes.json': NOTES_JSON,
    'src/store.js': STORE_JS,
    'src/cli.js': CLI_JS,
  };
  const tests = {
    'test/store.test.js': STORE_TEST_JS,
    'test/cli.test.js': CLI_TEST_JS,
  };
  const planning = {
    '.aoforge/PROJECT.md': PROJECT_MD,
    '.aoforge/REQUIREMENTS.md': REQUIREMENTS_MD,
    '.aoforge/ROADMAP.md': ROADMAP_MD,
    '.aoforge/STATE.md': STATE_MD,
    '.aoforge/state.json': STATE_JSON,
    '.aoforge/config.json': CONFIG_JSON,
    [`${OBJECTIVE_DIR}/OBJECTIVE.md`]: OBJECTIVE_MD,
  };
  return [scaffold, tests, planning].map((files, i) => ({ message: MESSAGES[i], date: COMMIT_DATES[i], files }));
}

// ─── Git (local to this builder so the wave's other TRDs stay independent) ──────────────────────────────────

function gitEnv(dir, date) {
  const env = {
    PATH: process.env.PATH,
    HOME: dir,
    LC_ALL: 'C',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_COMMITTER_NAME: AUTHOR.name,
    GIT_COMMITTER_EMAIL: AUTHOR.email,
  };
  if (date) {
    env.GIT_AUTHOR_DATE = date;
    env.GIT_COMMITTER_DATE = date;
  }
  return env;
}

function git(dir, args, date) {
  const full = [
    '-c', 'commit.gpgsign=false',
    '-c', 'init.defaultBranch=main',
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'core.autocrlf=false',
    ...args,
  ];
  const r = spawnSync('git', full, { cwd: dir, env: gitEnv(dir, date), encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${dir}: ${(r.stderr || r.stdout || '').trim()}`);
  }
  return r.stdout;
}

function gitCommit(dir, files, message, isoDate) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, { encoding: 'utf8', mode: 0o644 });
  }
  git(dir, ['add', '-A'], isoDate);
  git(dir, ['commit', '-q', '--no-verify', '-m', message], isoDate);
}

// ─── Public API ─────────────────────────────────────────────────────────────────────────────────────────────

/** buildFixture(dir) -> { dir, head }: materialise notekit as a git repository (branch main) in an empty dir. */
function buildFixture(dir) {
  const plan = commitPlan();
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length !== 0) throw new Error(`buildFixture needs an empty directory, got ${dir}`);
  git(dir, ['init', '-q', '--template=', '-b', 'main'], plan[0].date);
  for (const commit of plan) gitCommit(dir, commit.files, commit.message, commit.date);
  const head = git(dir, ['rev-parse', 'HEAD']).trim();
  return { dir, head };
}

/** describeFixture() -> what the project is, for the batch module and the report. Never written into a repository. */
function describeFixture() {
  return {
    name: 'notekit',
    objective: '1',
    objectiveDir: OBJECTIVE_DIR,
    requirements: REQUIREMENTS.map(([id]) => id),
    commits: MESSAGES.slice(),
    stamp: { version: STAMP_VERSION, migrations_applied: V300_MIGRATIONS.slice() },
    profile: 'balanced',
  };
}

module.exports = {
  QUICK_TEXT,
  BUILD_ARGS,
  QUICK_PROMPT,
  BUILD_PROMPT,
  V300_MIGRATIONS,
  STAMP_VERSION,
  AUTHOR,
  COMMIT_DATES,
  OBJECTIVE_DIR,
  buildFixture,
  describeFixture,
};
