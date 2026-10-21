'use strict';

// Test A (verifier) fixture builder, TRD 81-03.
//
// Six small AOForge 3.1.0 projects, A1..A6, materialised on demand into a directory the caller owns:
// three domains, each as a complete project and as a twin that carries exactly one planted gap.
//
//   A1 textkit   complete             A4 textkit   slugify returns one hard-coded value (kind: stub)
//   A2 tempconv  complete             A6 tempconv  the k command is never wired into the CLI (kind: unwired)
//   A3 notes     complete             A5 notes     the SUMMARY claims a file that does not exist (kind: missing_file)
//
// Why a builder and not real files: npm test globs scripts/**/*.test.cjs and a nested .aoforge/ tree inside this
// repository confuses tools that walk nested planning roots. Every file body below is a hand-written string
// literal; buildFixture writes them into a temp directory and commits them with a fixed author, fixed dates and
// fixed messages, so two builds of one id give the same tree and the same commit hashes.
//
// Nothing the verifier can read may reveal the plant: the repository text (file bodies, paths, commit messages,
// author) never uses the words that name it. The proof test scans for them (REVEALING in proofs.test.cjs).
// This header and describeFixture live outside the materialised repository, so they are free to use the words.
//
// Runtime model: buildFixture(id, dir) spawns `git` with cwd = dir and a fixed, minimal environment (no user git
// config, no hooks, no signing). It writes only below dir and reads nothing from the real HOME.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FIXTURES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];

// id -> domain and variant. `twin` names the other member of the matched pair.
const META = {
  A1: { domain: 'textkit', variant: 'clean', planted: null, twin: 'A4' },
  A2: { domain: 'tempconv', variant: 'clean', planted: null, twin: 'A6' },
  A3: { domain: 'notes', variant: 'clean', planted: null, twin: 'A5' },
  A4: { domain: 'textkit', variant: 'stub', planted: 'stub', twin: 'A1' },
  A5: { domain: 'notes', variant: 'missing_file', planted: 'missing_file', twin: 'A3' },
  A6: { domain: 'tempconv', variant: 'unwired', planted: 'unwired', twin: 'A2' },
};

// The git identity and clock of every fixture commit. "Project Author" on purpose: the repository must not
// carry a word that says what it is for.
const AUTHOR = { name: 'Project Author', email: 'author@example.invalid' };
const COMMIT_DATES = [
  '2026-10-01T10:00:00Z',
  '2026-10-01T10:10:00Z',
  '2026-10-01T10:20:00Z',
  '2026-10-01T10:30:00Z',
  '2026-10-01T10:40:00Z',
];
const STAMP_DATE = '2026-10-01T09:00:00.000Z';
const DAY = '2026-10-01';

// ─── String helpers ─────────────────────────────────────────────────────────────────────────────────────────
// `js` keeps backslashes as written (regex escapes, \n inside string literals). `md` does the same and turns
// the broken bar into a backtick, so markdown code spans need no escaping inside a template literal.
const raw = (strings, ...values) => String.raw({ raw: strings.raw }, ...values);
const js = raw;
const md = (strings, ...values) => raw(strings, ...values).replace(/¦/g, '`');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const bullets = (items, indent = '') => items.map((item) => `${indent}- ${item}`).join('\n');
const numbered = (items) => items.map((item, i) => `  ${i + 1}. ${item}`).join('\n');
const bt = (s) => s.replace(/¦/g, '`');

// ─── Domain data (what each project is about) ───────────────────────────────────────────────────────────────

const DOMAINS = {
  textkit: {
    pkg: 'textkit',
    oneLine: 'A small command line tool that turns text into URL slugs.',
    coreValue: 'Any text becomes a predictable, URL-safe slug in one command.',
    reqCategory: 'Slugs',
    reqs: [
      ['SLUG-01', '¦textkit slug <text>¦ prints a URL slug of any text'],
      ['SLUG-02', '¦slugify¦ is exported from ¦src/slugify.js¦ and covered by tests'],
    ],
    objName: 'Slug command',
    objSlug: 'slug-command',
    goal: '¦textkit slug <text>¦ prints a URL slug of any text',
    criteria: [
      '¦node src/cli.js slug "Hello, World!"¦ prints ¦hello-world¦',
      '¦node src/cli.js slug "  Ünïcode Text  "¦ prints ¦unicode-text¦',
      '¦slugify¦ is exported from ¦src/slugify.js¦ and covered by tests (¦node --test¦ passes)',
    ],
    trdBlurb: 'slugify and the slug command, with tests',
    truths: [
      '¦textkit slug <text>¦ prints a lowercase, dash-separated slug of the text it is given',
      'Accented letters become their ASCII base letters and leading or trailing whitespace is dropped',
      'Runs of punctuation collapse into a single dash with none at either end',
    ],
    artifacts: [
      { path: 'src/slugify.js', provides: 'slugify(text)', exports: 'slugify' },
      { path: 'test/slugify.test.js', provides: 'slugify and slug command tests' },
    ],
    keyLinks: [
      { from: 'src/cli.js', to: 'src/slugify.js', via: 'the slug command calls slugify', pattern: 'require\\(.\\./slugify' },
    ],
    filesModified: ['src/slugify.js', 'src/cli.js', 'test/slugify.test.js'],
    tasks: [
      {
        name: 'Task 1: slugify and the slug command',
        files: 'src/slugify.js, src/cli.js',
        action: 'Add ¦slugify(text)¦: normalise to NFKD, drop combining marks, lowercase, turn each run of non-alphanumerics into one dash and trim dashes at both ends. Route ¦textkit slug <text>¦ to it in ¦src/cli.js¦.',
        verify: 'node src/cli.js slug "Hello, World!"',
        done: 'The command prints hello-world.',
      },
      {
        name: 'Task 2: tests',
        files: 'test/slugify.test.js',
        action: 'Cover ¦slugify¦ and the slug command with ¦node:test¦.',
        verify: 'node --test',
        done: 'All tests pass.',
      },
    ],
    summary: {
      oneLiner: '¦textkit slug¦ turns any text into a URL slug: accents fold to ASCII, punctuation collapses to single dashes and both ends are trimmed.',
      provides: ['slugify(text) in src/slugify.js', 'the textkit slug command'],
      created: ['src/slugify.js', 'src/cli.js', 'test/slugify.test.js'],
      modified: [],
      accomplishments: [
        '¦slugify¦ lowercases, folds accents to ASCII, collapses punctuation into single dashes and trims the ends',
        '¦textkit slug <text>¦ prints the slug of its arguments',
        'Tests cover the module and the command, including accented input',
      ],
      evidence: [
        ['1: slugify and the slug command', 'node src/cli.js slug "Hello, World!"'],
        ['2: tests', 'node --test'],
      ],
      commits: [
        ['1: slugify and the slug command', 'feat(01-01): add slugify and the slug command'],
        ['2: tests', 'test(01-01): add slugify tests'],
      ],
      decisions: ['Accents are folded with NFKD plus a combining-mark filter rather than a lookup table'],
    },
    messages: [
      'chore(01-01): scaffold the project',
      'docs(01-01): plan the slug command',
      'feat(01-01): add slugify and the slug command',
      'test(01-01): add slugify tests',
      'docs(01-01): complete the slug command',
    ],
  },

  tempconv: {
    pkg: 'tempconv',
    oneLine: 'A small command line tool that converts temperatures between scales.',
    coreValue: 'A temperature in one scale becomes the right number in another with one command.',
    reqCategory: 'Kelvin',
    reqs: [
      ['KELV-01', '¦tempconv k <celsius>¦ prints the Kelvin value'],
      ['KELV-02', '¦toKelvin¦ is exported from ¦src/kelvin.js¦ and covered by tests'],
    ],
    objName: 'Kelvin command',
    objSlug: 'kelvin-command',
    goal: '¦tempconv k <celsius>¦ prints the Kelvin value',
    criteria: [
      '¦node src/cli.js k 0¦ prints ¦273.15¦',
      '¦node src/cli.js k -273.15¦ prints ¦0¦',
      '¦toKelvin¦ is exported from ¦src/kelvin.js¦ and covered by tests (¦node --test¦ passes)',
    ],
    trdBlurb: 'toKelvin and the k command, with tests',
    truths: [
      '¦tempconv k <celsius>¦ prints the Kelvin value of a Celsius temperature',
      'Absolute zero (-273.15) prints 0',
      '¦toKelvin¦ rejects temperatures below absolute zero',
    ],
    artifacts: [
      { path: 'src/kelvin.js', provides: 'toKelvin(celsius)', exports: 'toKelvin' },
      { path: 'test/kelvin.test.js', provides: 'toKelvin tests' },
    ],
    keyLinks: [
      { from: 'src/cli.js', to: 'src/kelvin.js', via: 'the k command calls toKelvin', pattern: 'require\\(.\\./kelvin' },
    ],
    filesModified: ['src/kelvin.js', 'src/cli.js', 'test/kelvin.test.js'],
    tasks: [
      {
        name: 'Task 1: toKelvin and the k command',
        files: 'src/kelvin.js, src/cli.js',
        action: 'Add ¦toKelvin(celsius)¦ (Celsius plus 273.15, RangeError below absolute zero, TypeError for a non-number) and route ¦tempconv k <celsius>¦ to it in ¦src/cli.js¦, next to ¦f¦ and ¦c¦.',
        verify: 'node src/cli.js k 0',
        done: 'The command prints 273.15.',
      },
      {
        name: 'Task 2: tests',
        files: 'test/kelvin.test.js',
        action: 'Cover ¦toKelvin¦ with ¦node:test¦: ordinary values, absolute zero and both rejections.',
        verify: 'node --test',
        done: 'All tests pass.',
      },
    ],
    summary: {
      oneLiner: '¦tempconv k¦ prints the Kelvin value of a Celsius temperature, with absolute zero printing 0 and anything colder rejected.',
      provides: ['toKelvin(celsius) in src/kelvin.js', 'the tempconv k command'],
      created: ['src/kelvin.js', 'test/kelvin.test.js'],
      modified: ['src/cli.js'],
      accomplishments: [
        '¦toKelvin¦ adds 273.15 and rejects temperatures below absolute zero',
        '¦tempconv k <celsius>¦ prints the Kelvin value beside ¦f¦ and ¦c¦',
        'Tests cover ordinary values, absolute zero and both rejections',
      ],
      evidence: [
        ['1: toKelvin and the k command', 'node src/cli.js k 0'],
        ['2: tests', 'node --test'],
      ],
      commits: [
        ['1: toKelvin and the k command', 'feat(01-01): add toKelvin and the k command'],
        ['2: tests', 'test(01-01): add toKelvin tests'],
      ],
      decisions: ['Output is rounded to two decimals in the CLI only; toKelvin returns the exact sum'],
    },
    messages: [
      'chore(01-01): scaffold the project',
      'docs(01-01): plan the Kelvin command',
      'feat(01-01): add toKelvin and the k command',
      'test(01-01): add toKelvin tests',
      'docs(01-01): complete the Kelvin command',
    ],
  },

  notes: {
    pkg: 'notes',
    oneLine: 'A small command line tool for notes kept in one JSON file.',
    coreValue: 'Notes stay in one plain file and the tool can summarise them.',
    reqCategory: 'Reports',
    reqs: [
      ['REPT-01', '¦notes report¦ prints a per-tag count of ¦notes.json¦'],
      ['REPT-02', '¦formatReport¦ is exported from ¦src/report.js¦ and covered by tests'],
    ],
    objName: 'Tag report',
    objSlug: 'tag-report',
    goal: '¦notes report¦ prints a per-tag count of ¦notes.json¦',
    criteria: [
      '¦node src/cli.js report¦ prints one ¦tag: count¦ line per tag, sorted by tag',
      '¦formatReport¦ is exported from ¦src/report.js¦ and covered by tests (¦node --test¦ passes)',
    ],
    trdBlurb: 'formatReport and the report command, with tests',
    truths: [
      '¦notes report¦ prints one ¦tag: count¦ line for every tag found in ¦notes.json¦',
      'The lines are sorted by tag',
      'A note with several tags is counted once under each of its tags',
    ],
    artifacts: [
      { path: 'src/report.js', provides: 'formatReport(notes)', exports: 'formatReport' },
      { path: 'test/report.test.js', provides: 'formatReport and report command tests' },
    ],
    keyLinks: [
      { from: 'src/cli.js', to: 'src/report.js', via: 'the report command calls formatReport', pattern: 'require\\(.\\./report' },
    ],
    filesModified: ['src/report.js', 'src/cli.js', 'test/report.test.js', 'test/store.test.js'],
    tasks: [
      {
        name: 'Task 1: formatReport and the report command',
        files: 'src/report.js, src/cli.js',
        action: 'Add ¦formatReport(notes)¦: count the notes per tag and return one ¦tag: count¦ line per tag, sorted by tag. Route ¦notes report¦ to it in ¦src/cli.js¦.',
        verify: 'node src/cli.js report',
        done: 'The command prints one line per tag, sorted.',
      },
      {
        name: 'Task 2: tests',
        files: 'test/report.test.js, test/store.test.js',
        action: 'Cover ¦formatReport¦, the report command and ¦loadNotes¦ with ¦node:test¦.',
        verify: 'node --test',
        done: 'All tests pass.',
      },
    ],
    summary: {
      oneLiner: '¦notes report¦ prints how many notes carry each tag, one ¦tag: count¦ line per tag in sorted order.',
      provides: ['formatReport(notes) in src/report.js', 'the notes report command'],
      created: ['src/report.js', 'test/report.test.js', 'test/store.test.js'],
      modified: ['src/cli.js'],
      accomplishments: [
        '¦formatReport¦ counts notes per tag and sorts the lines by tag',
        '¦notes report¦ prints the report for ¦notes.json¦',
        'Tests cover the report, the command and the notes loader',
      ],
      evidence: [
        ['1: formatReport and the report command', 'node src/cli.js report'],
        ['2: tests', 'node --test'],
      ],
      commits: [
        ['1: formatReport and the report command', 'feat(01-01): add formatReport and the report command'],
        ['2: tests', 'test(01-01): add report and store tests'],
      ],
      decisions: ['A note with several tags counts once under each tag; untagged notes are not reported'],
    },
    messages: [
      'chore(01-01): scaffold the project',
      'docs(01-01): plan the tag report',
      'feat(01-01): add formatReport and the report command',
      'test(01-01): add report and store tests',
      'docs(01-01): complete the tag report',
    ],
  },
};

// ─── Planning documents (shared shape, per-domain data) ─────────────────────────────────────────────────────

const reqIds = (d) => d.reqs.map(([id]) => id);

function projectMd(d) {
  return md`---
kind: cli
default_work: feature
---

# ${d.pkg}

## What This Is

${d.oneLine}

## Core Value

${d.coreValue}

## Requirements

### Active

${bullets(d.reqs.map(([id, text]) => `${id}: ${text}`))}

## Constraints

- Node.js CommonJS, no dependencies
- Tests run with ¦node --test¦
`;
}

function requirementsMd(d, done) {
  const box = done ? 'x' : ' ';
  const status = done ? 'Complete' : 'Pending';
  return md`# Requirements: ${d.pkg}

**Defined:** ${DAY}
**Core Value:** ${d.coreValue}

## v1 Requirements

### ${d.reqCategory}

${d.reqs.map(([id, text]) => `- [${box}] **${id}**: ${text}`).join('\n')}

## v2 Requirements

None yet.

## Out of Scope

| Feature | Reason |
|---------|--------|
| A configuration file | Not needed for the first release |

## Traceability

| Requirement | Objective | Status |
|-------------|-----------|--------|
${d.reqs.map(([id]) => `| ${id} | Objective 1 | ${status} |`).join('\n')}
`;
}

function roadmapMd(d, done) {
  const box = done ? 'x' : ' ';
  const doneNote = done ? ` (completed ${DAY})` : '';
  return md`# Roadmap: ${d.pkg}

## Milestones

- **v1.0** (current): ${d.oneLine}

## Objectives

- [${box}] **Objective 1: ${d.objName}** - ${d.goal}${doneNote}

## Objective Details

### Objective 1: ${d.objName}

**Goal**: ${d.goal}
**Requirements**: ${reqIds(d).join(', ')}
**Depends on**: Nothing (first objective)
**Success Criteria** (what must be TRUE):
${numbered(d.criteria.map(bt))}
**TRDs**: 1 plan

TRDs:
- [${box}] 01-01-${d.objSlug}-TRD.md — (W1) ${d.trdBlurb}

## Progress

| Objective | Milestone | Plans | Status | Completed |
|---|---|---|---|---|
| 1. ${d.objName} | v1.0 | ${done ? '1/1' : '0/1'} | ${done ? 'Complete' : 'Planned'} | ${done ? DAY : '-'} |
`;
}

function stateMd(d, done) {
  const position = done
    ? `Status: Executed, awaiting verification
Last activity: ${DAY} — Completed 01-01-${d.objSlug}-TRD.md

Progress: [██████████] 100%`
    : `Status: Ready to execute
Last activity: ${DAY} — Planned 01-01-${d.objSlug}-TRD.md

Progress: [░░░░░░░░░░] 0%`;
  const stopped = done ? `Completed 01-01-${d.objSlug}-TRD.md` : `Planned 01-01-${d.objSlug}-TRD.md`;
  return md`# Project State

## Project Reference

See: .aoforge/PROJECT.md (updated ${DAY})

**Core value:** ${d.coreValue}
**Current focus:** Objective 1: ${d.objName}

## Current Position

Objective: 1 of 1 (${d.objName})
Job: 1 of 1 in current objective
${position}

## Accumulated Context

> Decisions and performance metrics are logged in STATE_ARCHIVE.md.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: ${DAY} ${done ? '10:40' : '10:10'}
Stopped at: ${stopped}
Resume file: None
`;
}

function objectiveMd(d) {
  return md`---
work: feature
---

# ${d.objName}

## Goal

${d.goal}

## Requirements

${bullets(d.reqs.map(([id, text]) => `${id}: ${text}`))}
`;
}

function configJson() {
  return json({
    mode: 'yolo',
    depth: 'standard',
    job_checker_enabled: true,
    workflow: { research: false, job_check: true, verifier: true, auto_advance: true },
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
    aoforge: {
      version: '3.1.0',
      migrations_applied: ['0001', '0004', '0007', '0009', '0012', '0013'],
      upgraded_at: STAMP_DATE,
    },
  });
}

// The machine-readable sidecar of STATE.md, hand-written so no migration has to seed it.
function stateJson(done) {
  return json({
    current_objective: '1',
    current_job: done ? 1 : 0,
    total_jobs: 1,
    progress_pct: done ? 100 : 0,
    status: done ? 'ready_for_verification' : 'ready_to_execute',
    last_activity: DAY,
    metrics: { jobs_completed: done ? 1 : 0, jobs_failed: 0, sessions: 1 },
    decisions: [],
    blockers: [],
    session_log: [],
  });
}

function trdMd(d) {
  const artifacts = d.artifacts
    .map((a) => `    - path: ${a.path}\n      provides: "${a.provides}"${a.exports ? `\n      exports: [${a.exports}]` : ''}`)
    .join('\n');
  const keyLinks = d.keyLinks
    .map((k) => `    - from: ${k.from}\n      to: ${k.to}\n      via: "${k.via}"\n      pattern: '${k.pattern}'`)
    .join('\n');
  const tasks = d.tasks
    .map(
      (t) => `<task type="auto">
  <name>${t.name}</name>
  <files>${t.files}</files>
  <action>${bt(t.action)}</action>
  <verify>${t.verify}</verify>
  <done>${t.done}</done>
</task>`,
    )
    .join('\n\n');
  return md`---
objective: 01-${d.objSlug}
trd: "01"
type: standard
wave: 1
depends_on: []
files_modified:
${d.filesModified.map((f) => `  - ${f}`).join('\n')}
autonomous: true
requirements: [${reqIds(d).join(', ')}]
must_haves:
  truths:
${d.truths.map((t) => `    - "${bt(t)}"`).join('\n')}
  artifacts:
${artifacts}
  key_links:
${keyLinks}
---

# TRD 01-01: ${d.objName}

<objective>
${bt(d.goal)}.

Purpose: ${d.coreValue}
Output: ${d.filesModified.join(', ')}
</objective>

<context>
@.aoforge/PROJECT.md
@.aoforge/ROADMAP.md
</context>

<tasks>

${tasks}

</tasks>

<verification>
${d.criteria.map((c) => `- ${bt(c)}`).join('\n')}
</verification>

<success_criteria>
${bt(d.goal)}, with ${reqIds(d).join(' and ')} met.
</success_criteria>

<output>
After completion, create ¦.aoforge/objectives/01-${d.objSlug}/01-01-SUMMARY.md¦
</output>
`;
}

function summaryMd(d) {
  const s = d.summary;
  return md`---
objective: 01-${d.objSlug}
trd: "01"
subsystem: cli
tags: [cli, node]

requires: []
provides:
${bullets(s.provides.map((p) => `"${p}"`), '  ')}
affects: []

tech-stack:
  added: []
  patterns:
    - "node:test with spawnSync for command-level checks"

key-files:
  created:
${s.created.map((f) => `    - ${f}`).join('\n')}
  modified:${s.modified.length ? '\n' + s.modified.map((f) => `    - ${f}`).join('\n') : ' []'}

key-decisions:
${bullets(s.decisions.map((x) => `"${x}"`), '  ')}

requirements-completed: [${reqIds(d).join(', ')}]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 0
  tdd_evidence: false
  test_pairing: true

duration: 40min
completed: ${DAY}
---

# Objective 1 TRD 01: ${d.objName} Summary

**${bt(s.oneLiner)}**

## Performance

- **Duration:** 40 min
- **Started:** ${COMMIT_DATES[0]}
- **Completed:** ${COMMIT_DATES[4]}
- **Tasks:** 2
- **Files modified:** ${s.created.length + s.modified.length}

## Accomplishments
${bullets(s.accomplishments.map(bt))}

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
${s.evidence.map(([task, cmd]) => `| ${task} | ¦${cmd}¦ | 0 | PASS |`).join('\n')}

## Task Commits

${s.commits.map(([task, msg], i) => `${i + 1}. **Task ${task}** - ¦${msg}¦`).join('\n')}

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test | ¦node --test¦ | 0 | PASS |

## Deviations from Plan

None - TRD executed exactly as written.

## Post-TRD Verification

- Auto-fix cycles used: 0
- Must-haves verified: ${d.truths.length}/${d.truths.length}
- Gate failures: None

## Self-Check: PASSED

${s.created.map((f) => `- FOUND: ${f}`).join('\n')}
${s.commits.map(([, msg]) => `- FOUND commit: ${msg}`).join('\n')}
`;
}

// ─── Project files (what the code looks like, stage by stage) ───────────────────────────────────────────────

const GITIGNORE = 'node_modules/\n';

function packageJson(name) {
  return json({ name, version: '1.0.0', private: true, scripts: { test: 'node --test' } });
}

function readme(name, line, usage) {
  return `# ${name}\n\n${line}\n\n    ${usage}\n`;
}

// Each domain returns the files its commits add, in order: scaffold, impl, tests. A later stage replaces a path
// an earlier one defined (cli.js), it never deletes one. The variant overlay is applied on top of these.
function domainStages(domain) {
  if (domain === 'textkit') return textkitStages();
  if (domain === 'tempconv') return tempconvStages();
  if (domain === 'notes') return notesStages();
  throw new Error(`unknown domain ${domain}`);
}

function textkitStages() {
  const scaffold = {
    'package.json': packageJson('textkit'),
    'README.md': readme('textkit', 'Turn text into URL slugs.', 'node src/cli.js slug "Hello, World!"'),
    '.gitignore': GITIGNORE,
  };
  const impl = {
    'src/slugify.js': js`'use strict';

// Turns any text into a URL slug: lowercase ASCII letters and digits joined by single dashes.
function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { slugify };
`,
    'src/cli.js': js`#!/usr/bin/env node
'use strict';

const { slugify } = require('./slugify.js');

const USAGE = 'usage: textkit slug <text>\n';

function main(argv) {
  const [command, ...words] = argv;
  if (command !== 'slug' || words.length === 0) {
    process.stderr.write(USAGE);
    return 1;
  }
  process.stdout.write(slugify(words.join(' ')) + '\n');
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main };
`,
  };
  const tests = {
    'test/slugify.test.js': js`'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { slugify } = require('../src/slugify.js');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');

function run(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

test('lowercases text and joins the words with a dash', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
});

test('folds accents to ASCII and drops surrounding whitespace', () => {
  assert.equal(slugify('  Ünïcode Text  '), 'unicode-text');
});

test('collapses runs of punctuation into one dash', () => {
  assert.equal(slugify('a -- b __ c'), 'a-b-c');
});

test('returns an empty string when nothing alphanumeric is left', () => {
  assert.equal(slugify('!!!'), '');
});

test('the slug command prints the slug', () => {
  const result = run('slug', 'Hello, World!');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'hello-world\n');
});

test('the slug command folds accents', () => {
  const result = run('slug', '  Ünïcode Text  ');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'unicode-text\n');
});

test('the slug command without text prints usage and exits 1', () => {
  const result = run('slug');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: textkit slug/);
});
`,
  };
  return { scaffold, impl, tests };
}

function tempconvStages() {
  const scaffold = {
    'package.json': packageJson('tempconv'),
    'README.md': readme('tempconv', 'Convert temperatures between scales.', 'node src/cli.js f 100'),
    '.gitignore': GITIGNORE,
    'src/convert.js': js`'use strict';

function toFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

function toCelsius(fahrenheit) {
  return ((fahrenheit - 32) * 5) / 9;
}

module.exports = { toFahrenheit, toCelsius };
`,
    'src/cli.js': js`#!/usr/bin/env node
'use strict';

const { toFahrenheit, toCelsius } = require('./convert.js');

const USAGE = 'usage: tempconv <f|c> <value>\n';

function format(number) {
  return String(Math.round(number * 100) / 100);
}

function main(argv) {
  const [command, input] = argv;
  const value = Number(input);
  if (input === undefined || Number.isNaN(value)) {
    process.stderr.write(USAGE);
    return 1;
  }
  switch (command) {
    case 'f':
      process.stdout.write(format(toFahrenheit(value)) + '\n');
      return 0;
    case 'c':
      process.stdout.write(format(toCelsius(value)) + '\n');
      return 0;
    default:
      process.stderr.write(USAGE);
      return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, format };
`,
    'test/convert.test.js': js`'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toFahrenheit, toCelsius } = require('../src/convert.js');

test('converts Celsius to Fahrenheit', () => {
  assert.equal(toFahrenheit(100), 212);
  assert.equal(toFahrenheit(0), 32);
});

test('converts Fahrenheit to Celsius', () => {
  assert.equal(toCelsius(212), 100);
  assert.equal(toCelsius(32), 0);
});
`,
    'test/cli.test.js': js`'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');

function run(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

test('f converts Celsius to Fahrenheit', () => {
  const result = run('f', '100');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '212\n');
});

test('c converts Fahrenheit to Celsius', () => {
  const result = run('c', '212');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '100\n');
});

test('a missing value prints usage and exits 1', () => {
  const result = run('f');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: tempconv/);
});
`,
  };
  const impl = {
    'src/kelvin.js': js`'use strict';

const OFFSET = 273.15;

// Converts a Celsius temperature to Kelvin.
function toKelvin(celsius) {
  if (typeof celsius !== 'number' || Number.isNaN(celsius)) {
    throw new TypeError('celsius must be a number');
  }
  if (celsius < -OFFSET) {
    throw new RangeError('temperature is below absolute zero');
  }
  return celsius + OFFSET;
}

module.exports = { toKelvin, OFFSET };
`,
    'src/cli.js': js`#!/usr/bin/env node
'use strict';

const { toFahrenheit, toCelsius } = require('./convert.js');
const { toKelvin } = require('./kelvin.js');

const USAGE = 'usage: tempconv <f|c|k> <value>\n';

function format(number) {
  return String(Math.round(number * 100) / 100);
}

function main(argv) {
  const [command, input] = argv;
  const value = Number(input);
  if (input === undefined || Number.isNaN(value)) {
    process.stderr.write(USAGE);
    return 1;
  }
  switch (command) {
    case 'f':
      process.stdout.write(format(toFahrenheit(value)) + '\n');
      return 0;
    case 'c':
      process.stdout.write(format(toCelsius(value)) + '\n');
      return 0;
    case 'k':
      process.stdout.write(format(toKelvin(value)) + '\n');
      return 0;
    default:
      process.stderr.write(USAGE);
      return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, format };
`,
  };
  const tests = {
    'test/kelvin.test.js': js`'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toKelvin } = require('../src/kelvin.js');

test('converts 0 C to 273.15 K', () => {
  assert.equal(toKelvin(0), 273.15);
});

test('converts absolute zero to 0 K', () => {
  assert.equal(toKelvin(-273.15), 0);
});

test('converts 100 C to 373.15 K', () => {
  assert.ok(Math.abs(toKelvin(100) - 373.15) < 1e-9);
});

test('rejects temperatures below absolute zero', () => {
  assert.throws(() => toKelvin(-300), RangeError);
});

test('rejects values that are not numbers', () => {
  assert.throws(() => toKelvin('warm'), TypeError);
  assert.throws(() => toKelvin(NaN), TypeError);
});
`,
  };
  return { scaffold, impl, tests };
}

function notesStages() {
  const scaffold = {
    'package.json': packageJson('notes'),
    'README.md': readme('notes', 'Keep notes in one JSON file.', 'node src/cli.js list'),
    '.gitignore': GITIGNORE,
    'notes.json': json([
      { id: 1, text: 'Draft the quarterly plan', tags: ['work', 'planning'] },
      { id: 2, text: 'Book the dentist', tags: ['personal'] },
      { id: 3, text: 'Review the release checklist', tags: ['work', 'release'] },
      { id: 4, text: 'Buy groceries', tags: ['personal', 'errands'] },
      { id: 5, text: 'Send the planning notes', tags: ['work', 'planning'] },
    ]),
    'src/store.js': js`'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_FILE = path.join(__dirname, '..', 'notes.json');

function loadNotes(file = DEFAULT_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { loadNotes, DEFAULT_FILE };
`,
    'src/cli.js': js`#!/usr/bin/env node
'use strict';

const { loadNotes } = require('./store.js');

const USAGE = 'usage: notes <list>\n';

function main(argv) {
  const [command] = argv;
  switch (command) {
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
`,
  };
  const impl = {
    'src/report.js': js`'use strict';

// Counts the notes under each tag and renders one "tag: count" line per tag, sorted by tag.
function formatReport(notes) {
  const counts = new Map();
  for (const note of notes) {
    for (const tag of note.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.keys()]
    .sort()
    .map((tag) => tag + ': ' + counts.get(tag) + '\n')
    .join('');
}

module.exports = { formatReport };
`,
    'src/cli.js': js`#!/usr/bin/env node
'use strict';

const { loadNotes } = require('./store.js');

const USAGE = 'usage: notes <list|report>\n';

function main(argv) {
  const [command] = argv;
  switch (command) {
    case 'list':
      for (const note of loadNotes()) {
        process.stdout.write(note.id + '. ' + note.text + '\n');
      }
      return 0;
    case 'report': {
      const { formatReport } = require('./report.js');
      process.stdout.write(formatReport(loadNotes()));
      return 0;
    }
    default:
      process.stderr.write(USAGE);
      return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main };
`,
  };
  const tests = {
    'test/store.test.js': js`'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { loadNotes } = require('../src/store.js');

test('loadNotes reads every note from notes.json', () => {
  const notes = loadNotes();
  assert.equal(notes.length, 5);
  assert.deepEqual(notes[0].tags, ['work', 'planning']);
});

test('every note has an id, a text and at least one tag', () => {
  for (const note of loadNotes()) {
    assert.equal(typeof note.id, 'number');
    assert.equal(typeof note.text, 'string');
    assert.ok(note.tags.length >= 1);
  }
});
`,
    'test/report.test.js': js`'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { formatReport } = require('../src/report.js');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');

test('counts a note once under each of its tags', () => {
  const notes = [
    { id: 1, text: 'a', tags: ['x', 'y'] },
    { id: 2, text: 'b', tags: ['y'] },
  ];
  assert.equal(formatReport(notes), 'x: 1\ny: 2\n');
});

test('sorts the lines by tag', () => {
  const notes = [{ id: 1, text: 'a', tags: ['zeta', 'alpha', 'mid'] }];
  assert.equal(formatReport(notes), 'alpha: 1\nmid: 1\nzeta: 1\n');
});

test('an empty list gives an empty report', () => {
  assert.equal(formatReport([]), '');
});

test('the report command prints the counts for notes.json', () => {
  const result = spawnSync(process.execPath, [CLI, 'report'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'errands: 1\npersonal: 2\nplanning: 2\nrelease: 1\nwork: 3\n');
});
`,
  };
  return { scaffold, impl, tests };
}

// ─── Variant overlays: the only difference between a pair ───────────────────────────────────────────────────
// path -> replacement text, or null to leave the file out. A path must exist in one of the domain's stages.

function variant(id) {
  switch (id) {
    case 'A1':
    case 'A2':
    case 'A3':
      return {};
    case 'A4':
      // slugify ignores its input; the tests only ever ask for "Hello, World!".
      return {
        'src/slugify.js': js`'use strict';

// Turns any text into a URL slug: lowercase ASCII letters and digits joined by single dashes.
function slugify(text) {
  return 'hello-world';
}

module.exports = { slugify };
`,
        'test/slugify.test.js': js`'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { slugify } = require('../src/slugify.js');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');

test('lowercases text and joins the words with a dash', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
});

test('the slug command prints the slug', () => {
  const result = spawnSync(process.execPath, [CLI, 'slug', 'Hello, World!'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'hello-world\n');
});
`,
      };
    case 'A5':
      // The report module and its tests were never written; the CLI still asks for the module.
      return { 'src/report.js': null, 'test/report.test.js': null };
    case 'A6':
      // The usage text lists k, the module and its tests exist, but the CLI never routes k to it.
      return {
        'src/cli.js': js`#!/usr/bin/env node
'use strict';

const { toFahrenheit, toCelsius } = require('./convert.js');

const USAGE = 'usage: tempconv <f|c|k> <value>\n';

function format(number) {
  return String(Math.round(number * 100) / 100);
}

function main(argv) {
  const [command, input] = argv;
  const value = Number(input);
  if (input === undefined || Number.isNaN(value)) {
    process.stderr.write(USAGE);
    return 1;
  }
  switch (command) {
    case 'f':
      process.stdout.write(format(toFahrenheit(value)) + '\n');
      return 0;
    case 'c':
      process.stdout.write(format(toCelsius(value)) + '\n');
      return 0;
    default:
      process.stderr.write(USAGE);
      return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, format };
`,
      };
    default:
      throw new Error(`unknown fixture id ${id}`);
  }
}

// Apply an overlay to the stage that defines each path. Returns new stage maps; throws on an unknown path.
function applyOverlay(stages, overlay) {
  const out = {};
  for (const [name, files] of Object.entries(stages)) out[name] = { ...files };
  for (const [rel, content] of Object.entries(overlay)) {
    // Replace in the last stage that defines the path (the final version of the file).
    const owner = Object.keys(out).reverse().find((name) => rel in out[name]);
    if (!owner) throw new Error(`overlay path ${rel} is defined in no stage`);
    if (content === null) delete out[owner][rel];
    else out[owner][rel] = content;
  }
  return out;
}

// The five commits of one fixture: [message, date, files-by-path].
function commitPlan(id) {
  const meta = META[id];
  if (!meta) throw new Error(`unknown fixture id ${id}`);
  const d = DOMAINS[meta.domain];
  const stages = applyOverlay(domainStages(meta.domain), variant(id));
  const base = '.aoforge';
  const planDir = `${base}/objectives/01-${d.objSlug}`;
  const planned = {
    [`${base}/PROJECT.md`]: projectMd(d),
    [`${base}/REQUIREMENTS.md`]: requirementsMd(d, false),
    [`${base}/ROADMAP.md`]: roadmapMd(d, false),
    [`${base}/STATE.md`]: stateMd(d, false),
    [`${base}/config.json`]: configJson(),
    [`${base}/state.json`]: stateJson(false),
    [`${planDir}/OBJECTIVE.md`]: objectiveMd(d),
    [`${planDir}/01-01-${d.objSlug}-TRD.md`]: trdMd(d),
  };
  const executed = {
    [`${base}/REQUIREMENTS.md`]: requirementsMd(d, true),
    [`${base}/ROADMAP.md`]: roadmapMd(d, true),
    [`${base}/STATE.md`]: stateMd(d, true),
    [`${base}/state.json`]: stateJson(true),
    [`${planDir}/01-01-SUMMARY.md`]: summaryMd(d),
  };
  const groups = [stages.scaffold, planned, stages.impl, stages.tests, executed];
  return groups.map((files, i) => ({ message: d.messages[i], date: COMMIT_DATES[i], files }));
}

// ─── Git (local to this builder so the wave's other fixture TRDs stay independent) ──────────────────────────

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

// gitCommit(dir, files, message, isoDate): write the files, stage everything, commit with the fixed identity.
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

/** buildFixture(id, dir) -> { id, dir, head } : materialise one project as a git repository in an empty dir. */
function buildFixture(id, dir) {
  const plan = commitPlan(id);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length !== 0) throw new Error(`buildFixture needs an empty directory, got ${dir}`);
  git(dir, ['init', '-q', '--template=', '-b', 'main'], plan[0].date);
  for (const commit of plan) {
    if (Object.keys(commit.files).length === 0) throw new Error(`fixture ${id}: commit "${commit.message}" is empty`);
    gitCommit(dir, commit.files, commit.message, commit.date);
  }
  const head = git(dir, ['rev-parse', 'HEAD']).trim();
  return { id, dir, head };
}

/** describeFixture(id) -> { id, domain, variant, planted, twin, objective, commits }. Never written into a repo. */
function describeFixture(id) {
  const meta = META[id];
  if (!meta) throw new Error(`unknown fixture id ${id}`);
  const d = DOMAINS[meta.domain];
  return {
    id,
    domain: meta.domain,
    variant: meta.variant,
    planted: meta.planted,
    twin: meta.twin,
    objective: '1',
    objectiveDir: `.aoforge/objectives/01-${d.objSlug}`,
    requirements: reqIds(d),
    commits: d.messages.slice(),
  };
}

module.exports = { FIXTURES, buildFixture, describeFixture, AUTHOR, COMMIT_DATES };
