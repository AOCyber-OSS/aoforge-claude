'use strict';

// Hand-written canned outputs for the objective-81 test C batch module and scorer (TRD 81-11). Nothing here is
// generated: the documents, the grader verdicts and the evidence quotes are literals chosen so every rate and count
// in the tests can be checked by hand.
//
//   Synthetic tech case (checklists-synthetic.json, focus tech, 11 items): STACK.md + INTEGRATIONS.md.
//     verdicts: found 8 (tech-01 02 03 05 06 07 09 11), wrong 1 (tech-04), missing 2 (tech-08 tech-10);
//     the grader lists 1 fabrication (a Redis cache); the documents also back-tick one path that does not exist in
//     the build (internal/missing/x.go), one that does (go.mod and others) and prose the path check must ignore.
//     -> recall 8/11, error 1/11, missing 2/11, fabrications 1 grader + 1 mechanical = 2.
//   Researcher stack case (checklists-researcher.json, dimension stack, 10 items): STACK.md.
//     verdicts: found 7, wrong 2 (stack-03 stack-10), missing 1 (stack-08), 1 fabrication
//     -> recall 0.7, error 0.2, missing 0.1, fabrications 1 (the spec example of test list 7).
//   Researcher pitfalls case (11 items): found 5 (01 02 03 05 07), wrong 1 (08), missing 5, no fabrications.
//
// cRoot(root, plan) writes the run directories the runner would leave under <root>/runs/C/<id>/, so the batch module
// and the scorer are tested against the same layout without a runner. fakeFleet(base) writes a stand-in for the
// private fleet checklist (made-up items, a marker string in every statement), its commitment and a temp source
// repository with planning artefacts to strip; the real fleet source and checklist are never touched by tests.
//
// The fixture builds the collect() output shape itself (agentOutputs, graderOutputs) so it does not depend on
// batches/C.cjs; the batch test proves collect() produces the same shape from the raw files cRoot writes.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { LEGACY } = require('../../../plugins/aoforge/aoforge/bin/lib/legacy-names.cjs');

const C_FIXTURES = path.join(__dirname, '..', 'fixtures', 'C');
const SYNTHETIC = JSON.parse(fs.readFileSync(path.join(C_FIXTURES, 'checklists-synthetic.json'), 'utf8'));
const RESEARCHER = JSON.parse(fs.readFileSync(path.join(C_FIXTURES, 'checklists-researcher.json'), 'utf8'));

/** The documents each focus / dimension owns, in their fixed order. */
const DOC_ORDER = { ...SYNTHETIC.focus_documents };
const RESEARCH_DOC = { ...RESEARCHER.dimension_documents };

/** Marker in every made-up fleet statement: tests assert it never reaches a result written under --out. */
const FLEET_MARKER = 'ZZ-PRIVATE-STATEMENT';

// --- Synthetic tech documents ---------------------------------------------------------------------------------

const SYNTHETIC_STACK = `# Technology Stack

## Languages and runtime
- Go 1.23: \`go.mod\` declares module \`example.com/linkcheck\` and the \`go 1.23\` directive.
- Standard library only. There is no third-party dependency and no \`require\` block.

## Frameworks
- HTTP is served by \`net/http\` with an \`http.NewServeMux\` and Go 1.22 method patterns such as \`GET /checks/{id}\`.
- Logging is \`log/slog\` with a JSON handler on stdout; \`-debug\` lowers the level.

## Configuration
- \`LINKCHECK_ADDR\` sets the listen address, default \`:9090\`.
- \`LINKCHECK_DATA\` sets the data directory, default \`/var/lib/linkcheck\`.

## Build
- The \`Makefile\` provides \`make build\`, \`make test\` and \`make lint\` (\`go vet ./...\`).
- The multi-stage \`Dockerfile\` builds with \`golang:1.23\` and \`CGO_ENABLED=0\`; the final stage is
  \`gcr.io/distroless/static-debian12\` and exposes port 9090.

## Entry point
- \`cmd/linkcheck/main.go\` wires the config, the store, the worker pool and the server; it imports
  \`example.com/linkcheck/internal/api\` and \`encoding/json\`.
`;

const SYNTHETIC_INTEGRATIONS = `# External Integrations

## Storage
- JSON files on local disk, one \`<id>.json\` file per check in the data directory, written by
  \`internal/store/file.go\`. There is no database.

## Caching
- Check results are cached in Redis, configured in \`internal/missing/x.go\`.

## Other
- No authentication provider and no webhooks.
`;

/** [id, verdict, verbatim quote or ''] for the 11 synthetic tech items. */
const SYNTHETIC_TECH_VERDICTS = [
  ['tech-01', 'found', 'Go 1.23: `go.mod` declares module `example.com/linkcheck`'],
  ['tech-02', 'found', 'Standard library only. There is no third-party dependency'],
  ['tech-03', 'found', '`LINKCHECK_ADDR` sets the listen address, default `:9090`.'],
  ['tech-04', 'wrong', 'default `/var/lib/linkcheck`'],
  ['tech-05', 'found', '`net/http` with an `http.NewServeMux`'],
  ['tech-06', 'found', '`log/slog` with a JSON handler on stdout'],
  ['tech-07', 'found', 'JSON files on local disk, one `<id>.json` file per check'],
  ['tech-08', 'missing', ''],
  ['tech-09', 'found', 'The `Makefile` provides `make build`, `make test` and `make lint`'],
  ['tech-10', 'missing', ''],
  ['tech-11', 'found', 'The multi-stage `Dockerfile` builds with `golang:1.23` and `CGO_ENABLED=0`'],
];

const SYNTHETIC_TECH_GRADE = {
  items: SYNTHETIC_TECH_VERDICTS.map(([id, verdict, evidence]) => ({ id, verdict, evidence })),
  fabrications: [{ claim: 'Check results are cached in Redis', why: 'No Redis dependency exists; the module has no require block.' }],
};

// --- Researcher documents -------------------------------------------------------------------------------------

const RESEARCH_STACK = `# Stack Research: notesearch

## Recommended stack
- Language: the current stable Go release; a supported Go release only, because older toolchains lose security fixes.
- Search: SQLite with the FTS5 extension. Bleve is the alternative when no SQL layer is wanted; FTS5 wins on index
  size and query speed at tens of thousands of notes.
- SQLite driver: \`mattn/go-sqlite3\`, which needs no cgo, so cross-compiling works with a plain go build.
- File watching: \`fsnotify\` for change notifications.
- Markdown: \`goldmark\`, a CommonMark compliant parser, to extract text.
- Front matter: \`goldmark-meta\` parses YAML front matter.
- CLI: \`cobra\` for the index, watch and search subcommands, chosen for completion support and wide use.
- Release: GoReleaser cross-compiles one static binary per platform with GOOS and GOARCH.

## What not to use
- Elasticsearch is the recommended search server for large note folders.
`;

/** [id, verdict, verbatim quote or ''] for the 10 researcher stack items: 7 found, 2 wrong, 1 missing. */
const RESEARCH_STACK_VERDICTS = [
  ['stack-01', 'found', 'the current stable Go release'],
  ['stack-02', 'found', 'SQLite with the FTS5 extension'],
  ['stack-03', 'wrong', '`mattn/go-sqlite3`, which needs no cgo'],
  ['stack-04', 'found', '`fsnotify` for change notifications'],
  ['stack-05', 'found', '`goldmark`, a CommonMark compliant parser'],
  ['stack-06', 'found', '`goldmark-meta` parses YAML front matter'],
  ['stack-07', 'found', '`cobra` for the index, watch and search subcommands'],
  ['stack-08', 'missing', ''],
  ['stack-09', 'found', 'GoReleaser cross-compiles one static binary per platform'],
  ['stack-10', 'wrong', 'Elasticsearch is the recommended search server'],
];

const RESEARCH_STACK_GRADE = {
  items: RESEARCH_STACK_VERDICTS.map(([id, verdict, evidence]) => ({ id, verdict, evidence })),
  fabrications: [{ claim: 'notesearch needs the Go 1.31 range-over-func iterators', why: 'No such release exists and nothing in the topic needs it.' }],
};

const RESEARCH_PITFALLS = `# Pitfalls Research: notesearch

## Watching files
- fsnotify is not recursive: every subdirectory must be added, including directories created later.
- Editors save atomically: they write a temporary file and rename it over the note, so handle Rename, Remove and
  Create events, not only Write.
- A save or a git checkout produces bursts of events; debounce them before reindexing.
- Changes made while notesearch is not running are replayed by fsnotify on restart, so no startup scan is needed.

## Storage
- A cgo SQLite driver breaks CGO_ENABLED=0 static builds and cross-compilation; use a pure-Go driver.
- "database is locked" appears with concurrent writers: use a single writer, WAL mode and a busy_timeout.
`;

const RESEARCH_PITFALLS_VERDICTS = [
  ['pitfalls-01', 'found', 'fsnotify is not recursive: every subdirectory must be added'],
  ['pitfalls-02', 'found', 'Editors save atomically: they write a temporary file and rename it over the note'],
  ['pitfalls-03', 'found', 'bursts of events; debounce them before reindexing'],
  ['pitfalls-04', 'missing', ''],
  ['pitfalls-05', 'found', 'A cgo SQLite driver breaks CGO_ENABLED=0 static builds and cross-compilation'],
  ['pitfalls-06', 'missing', ''],
  ['pitfalls-07', 'found', '"database is locked" appears with concurrent writers: use a single writer, WAL mode and a busy_timeout.'],
  ['pitfalls-08', 'wrong', 'replayed by fsnotify on restart, so no startup scan is needed'],
  ['pitfalls-09', 'missing', ''],
  ['pitfalls-10', 'missing', ''],
  ['pitfalls-11', 'missing', ''],
];

const RESEARCH_PITFALLS_GRADE = {
  items: RESEARCH_PITFALLS_VERDICTS.map(([id, verdict, evidence]) => ({ id, verdict, evidence })),
  fabrications: [],
};

// --- Document and output builders -------------------------------------------------------------------------------

/** The concatenated document the way collect() builds it: each present document under a `===== NAME =====` line. */
function joinDocuments(names, docs) {
  return names
    .filter((name) => typeof docs[name] === 'string' && docs[name].trim() !== '')
    .map((name) => `===== ${name} =====\n\n${docs[name].trimEnd()}\n`)
    .join('\n');
}

/** Document names a role's documents come from: a mapper focus or a researcher dimension. */
function namesFor(kind, focusOrDimension) {
  return kind === 'mapper' ? DOC_ORDER[focusOrDimension] : [RESEARCH_DOC[focusOrDimension]];
}

/**
 * The collect() output of an agent run (the shape documented at the top of batches/C.cjs).
 * entry: {kind, focus|dimension, codebase, docs: {NAME: text}, location, returnText}
 */
function agentOutputs(entry) {
  const key = entry.kind === 'mapper' ? entry.focus : entry.dimension;
  const names = namesFor(entry.kind, key);
  const present = names.filter((n) => typeof entry.docs[n] === 'string' && entry.docs[n].trim() !== '');
  const documents = {};
  for (const n of present) documents[n] = { location: entry.location, chars: entry.docs[n].length };
  return {
    kind: entry.kind,
    role: entry.kind === 'mapper' ? `codebase-mapper:${key}` : `project-researcher:${key}`,
    codebase: entry.codebase,
    document: joinDocuments(names, entry.docs),
    documents,
    missing_documents: names.filter((n) => !present.includes(n)),
    location: present.length === 0 ? 'none' : entry.location,
    return_text: typeof entry.returnText === 'string' ? entry.returnText.slice(0, 500) : null,
  };
}

/** The collect() output of a grader run. */
function graderOutputs(graded, source = 'structured_output') {
  return { kind: 'grader', graded: graded || null, source: graded ? source : 'none' };
}

// --- cRoot ------------------------------------------------------------------------------------------------------

/**
 * cRoot(root, plan): write <root>/runs/C/<id>/ for each plan entry as the runner would leave it.
 *
 * Common: {id, model, status = 'ok', model_ran = true, cost_usd = 0.4, wall_ms = 60000, stream, record}
 *   record: extra fields merged over record.json (e.g. {status: 'cap_hit'}); stream: text for stream.jsonl.
 * Agent (kind 'mapper' | 'researcher'): {focus | dimension, codebase, docs: {NAME: text}, location = 'drafts',
 *   collected = true, returnText}
 *   location 'drafts': tmp/aoforge-drafts/<key>/codebase|research/NAME.md; 'published': work/.aoforge/<dir>/NAME.md.
 *   collected (default true) puts the agentOutputs() shape in record.json `outputs` and outputs/outputs.json.
 * Grader (kind 'grader'): {graded, source = 'structured_output', collected = true}
 *   The graded object is the record's structured_output (or, for source 'result_text', its result_text JSON).
 */
function cRoot(root, plan) {
  const written = [];
  for (const entry of plan) {
    const dir = path.join(root, 'runs', 'C', entry.id);
    for (const sub of ['home', 'work', 'tmp', 'outputs']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
    const record = {
      id: entry.id,
      batch: 'C',
      model: entry.model,
      status: entry.status || 'ok',
      model_ran: entry.model_ran === undefined ? true : entry.model_ran,
      cost_usd: entry.cost_usd === undefined ? 0.4 : entry.cost_usd,
      charged_usd: entry.cost_usd === undefined ? 0.4 : entry.cost_usd,
      wall_ms: entry.wall_ms === undefined ? 60000 : entry.wall_ms,
      structured_output: null,
      result_text: null,
    };
    let outputs = null;
    if (entry.kind === 'mapper' || entry.kind === 'researcher') {
      const sub = entry.kind === 'mapper' ? 'codebase' : 'research';
      const where = entry.location || 'drafts';
      for (const [name, text] of Object.entries(entry.docs || {})) {
        const file = where === 'published'
          ? path.join(dir, 'work', '.aoforge', sub, name)
          : path.join(dir, 'tmp', 'aoforge-drafts', 'example-repo-1a2b3c4d', sub, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
      }
      record.result_text = entry.returnText === undefined ? null : entry.returnText;
      outputs = agentOutputs({ ...entry, location: where });
    } else if (entry.kind === 'grader') {
      if (entry.graded && (entry.source || 'structured_output') === 'result_text') record.result_text = JSON.stringify(entry.graded);
      else if (entry.graded) record.structured_output = entry.graded;
      outputs = graderOutputs(entry.graded, entry.source || 'structured_output');
    } else {
      throw new Error(`cRoot: unknown kind ${entry.kind}`);
    }
    if (entry.collected !== false) {
      record.outputs = outputs;
      fs.writeFileSync(path.join(dir, 'outputs', 'outputs.json'), `${JSON.stringify(outputs, null, 2)}\n`);
    }
    Object.assign(record, entry.record || {});
    fs.writeFileSync(path.join(dir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);
    if (entry.stream !== undefined) fs.writeFileSync(path.join(dir, 'stream.jsonl'), entry.stream);
    written.push(dir);
  }
  return written;
}

// --- fakeFleet --------------------------------------------------------------------------------------------------

function git(dir, args) {
  const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: 'C',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Fixture Author',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture Author',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      GIT_AUTHOR_DATE: '2026-09-01T09:00:00Z',
      GIT_COMMITTER_DATE: '2026-09-01T09:00:00Z',
    },
  });
  if (r.status !== 0) throw new Error(`fixture git ${args[0]} failed: ${r.stderr}`);
  return r.stdout;
}

const FAKE_FLEET_FOCI = ['tech', 'arch', 'quality', 'concerns'];
const FAKE_FLEET_ITEMS_PER_FOCUS = 3;

/** The made-up checklist items for one focus: ids `fleet-<focus>-01..03`, a marker in each statement. */
function fakeFleetItems(focus) {
  const items = [];
  for (let i = 1; i <= FAKE_FLEET_ITEMS_PER_FOCUS; i += 1) {
    const n = String(i).padStart(2, '0');
    items.push({
      id: `fleet-${focus}-${n}`,
      focus,
      statement: `${FLEET_MARKER}-${focus}-${n}: made-up fact ${n} about the ${focus} focus.`,
      evidence: { path: 'go.mod', pattern: '^module' },
      accept_any: [`made-up ${focus} ${n}`],
    });
  }
  return items;
}

/**
 * fakeFleet(base, {mutate}): under `base` write
 *   source/                 a git repository with go.mod, main.go, a legacy planning directory, .claude/ (never the real fleet source)
 *   private/fleet-checklists.json   made-up private file: {alias, source_path, source_commit, checklists}
 *   fleet-commitment.json   {alias, sha256, private_file, items_per_focus} matching the private file
 * `mutate(text)` rewrites the private file's text after the commitment is computed (a hash-mismatch case).
 * Returns {base, sourceDir, sourceCommit, privateFile, commitmentFile, checklists, sha256}.
 */
function fakeFleet(base, { mutate } = {}) {
  const sourceDir = path.join(base, 'source');
  fs.mkdirSync(sourceDir, { recursive: true });
  git(sourceDir, ['init', '-q']);
  const files = {
    'go.mod': 'module example.invalid/fleetstub\n\ngo 1.23\n',
    'main.go': 'package main\n\nfunc main() {}\n',
    'internal/store/store.go': 'package store\n',
    [`${LEGACY.planningDir}/NOTES.md`]: '# planning notes that must not reach a run\n',
    '.claude/settings.json': '{}\n',
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(sourceDir, rel)), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, rel), text);
  }
  git(sourceDir, ['add', '-A']);
  git(sourceDir, ['commit', '-q', '-m', 'initial']);
  const sourceCommit = git(sourceDir, ['rev-parse', 'HEAD']).trim();

  const checklists = Object.fromEntries(FAKE_FLEET_FOCI.map((f) => [f, fakeFleetItems(f)]));
  const privateObject = {
    alias: 'fleet-fixture',
    source_path: sourceDir,
    source_commit: sourceCommit,
    prepared: [`removed ${LEGACY.planningDir}/`, 'removed .claude/', 'added .aoforge/'],
    checklists,
  };
  const text = `${JSON.stringify(privateObject, null, 2)}\n`;
  const sha256 = crypto.createHash('sha256').update(text).digest('hex');
  const privateFile = path.join(base, 'private', 'fleet-checklists.json');
  fs.mkdirSync(path.dirname(privateFile), { recursive: true });
  fs.writeFileSync(privateFile, typeof mutate === 'function' ? mutate(text) : text);
  const commitmentFile = path.join(base, 'fleet-commitment.json');
  fs.writeFileSync(commitmentFile, `${JSON.stringify({
    alias: 'fleet-fixture',
    sha256,
    private_file: 'private/fleet-checklists.json',
    items_per_focus: Object.fromEntries(FAKE_FLEET_FOCI.map((f) => [f, FAKE_FLEET_ITEMS_PER_FOCUS])),
  }, null, 2)}\n`);
  return { base, sourceDir, sourceCommit, privateFile, commitmentFile, checklists, sha256 };
}

/** A grader output for the made-up fleet focus: every item `found` with a quote taken from `document`. */
function fakeFleetGrade(focus, verdicts, fabrications = []) {
  const items = fakeFleetItems(focus);
  return {
    items: items.map((item, i) => {
      const verdict = verdicts[i] || 'found';
      return { id: item.id, verdict, evidence: verdict === 'missing' ? '' : `made-up ${focus} ${String(i + 1).padStart(2, '0')}` };
    }),
    fabrications,
  };
}

/** A short document that holds every `made-up <focus> NN` quote fakeFleetGrade uses. */
function fakeFleetDocument(focus) {
  return `# Notes on the ${focus} focus\n\n${fakeFleetItems(focus).map((_, i) => `- made-up ${focus} ${String(i + 1).padStart(2, '0')} is covered here.`).join('\n')}\n`;
}

module.exports = {
  DOC_ORDER,
  RESEARCH_DOC,
  FLEET_MARKER,
  SYNTHETIC_STACK,
  SYNTHETIC_INTEGRATIONS,
  SYNTHETIC_TECH_GRADE,
  RESEARCH_STACK,
  RESEARCH_STACK_GRADE,
  RESEARCH_PITFALLS,
  RESEARCH_PITFALLS_GRADE,
  joinDocuments,
  agentOutputs,
  graderOutputs,
  cRoot,
  fakeFleet,
  fakeFleetItems,
  fakeFleetGrade,
  fakeFleetDocument,
};
