'use strict';

/*
 * Test B (job-checker) fixture builder, TRD 81-04.
 *
 * Six AOForge 3.1.0 projects, each with a completed objective 1 and a planned, unexecuted objective 2 (TRDs only):
 *   B1  textkit   consistent planned objective
 *   B2  tempconv  consistent planned objective
 *   B3  = B1 + two same-wave TRDs (02-01, 02-02) that both modify src/cli.js
 *   B4  = B2 + a task with no verify element (02-02, first task)
 *   B5  = B2 + a wave-1 TRD (02-02) that depends on a wave-2 TRD (02-04); no cycle
 *   B6  = B1 + the unknown-format handling removed from 02-03 while the ROADMAP still lists success criterion 3
 *
 * Nothing under scripts/ is a real .aoforge/ tree: every file is a string literal here, materialised into a temp dir
 * by buildFixture(id, dir). The ids B1..B6 and every word that names a flaw live only in this file and in
 * answer-key.json, never in a materialised path, file or commit (the proof test scans for them).
 *
 * Authoring conventions for the literals:
 *   code`...`  String.raw, no interpolation and no backticks inside (generated JavaScript uses concatenation).
 *   md`...`    String.raw where the character U+00A6 stands for a backtick, so markdown can carry inline code.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const FIXTURES = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];

const code = (strings, ...v) => String.raw(strings, ...v);
const md = (strings, ...v) => String.raw(strings, ...v).replace(/¦/g, '`');

// ─── Deterministic git ───────────────────────────────────────────────────────────────────────────────────────────

const AUTHOR = { name: 'Project Author', email: 'author@example.invalid' };
const FIRST_COMMIT_MS = Date.UTC(2026, 9, 2, 10, 0, 0); // 2026-10-02T10:00:00Z, +10 minutes per commit
const COMMIT_STEP_MS = 10 * 60 * 1000;
const CONFIG_STAMP_DATE = '2026-10-01T09:00:00.000Z';

function gitEnv(isoDate) {
  const env = {
    PATH: process.env.PATH,
    HOME: os.tmpdir(),
    LANG: 'C',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
  if (isoDate) {
    Object.assign(env, {
      GIT_AUTHOR_NAME: AUTHOR.name,
      GIT_AUTHOR_EMAIL: AUTHOR.email,
      GIT_COMMITTER_NAME: AUTHOR.name,
      GIT_COMMITTER_EMAIL: AUTHOR.email,
      GIT_AUTHOR_DATE: isoDate,
      GIT_COMMITTER_DATE: isoDate,
    });
  }
  return env;
}

function git(dir, args, isoDate) {
  const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], {
    cwd: dir,
    env: gitEnv(isoDate),
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error('git ' + args.join(' ') + ' failed in ' + dir + ': ' + (r.stderr || r.stdout || r.error));
  }
  return r.stdout;
}

function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, { mode: 0o644 });
  }
}

function gitCommit(dir, files, message, index) {
  writeFiles(dir, files);
  const isoDate = new Date(FIRST_COMMIT_MS + index * COMMIT_STEP_MS).toISOString().replace('.000Z', '+0000');
  git(dir, ['add', '-A'], isoDate);
  git(dir, ['commit', '-q', '-m', message], isoDate);
}

// ─── TRD rendering ───────────────────────────────────────────────────────────────────────────────────────────────

const quote = (s) => '"' + s + '"';

function renderTrd(t) {
  const L = [
    '---',
    'objective: ' + t.objective,
    'trd: ' + quote(t.id.split('-')[1]),
    'type: standard',
    'wave: ' + t.wave,
    'depends_on: [' + t.dependsOn.map(quote).join(', ') + ']',
    'files_modified:',
    ...t.files.map((f) => '  - ' + f),
    'autonomous: true',
    'requirements: [' + t.requirements.join(', ') + ']',
    'must_haves:',
    '  truths:',
    ...t.truths.map((s) => '    - ' + quote(s)),
    '  artifacts:',
  ];
  for (const a of t.artifacts) L.push('    - path: ' + a.path, '      provides: ' + quote(a.provides));
  if (t.keyLinks.length) {
    L.push('  key_links:');
    for (const k of t.keyLinks) {
      L.push('    - from: ' + k.from, '      to: ' + k.to, '      via: ' + quote(k.via), '      pattern: ' + quote(k.pattern));
    }
  }
  L.push('---', '', '# TRD ' + t.id + ': ' + t.title, '', '<objective>', t.objectiveText, '</objective>', '');
  L.push('<context>', ...t.context, '</context>', '', '<tasks>', '');
  for (const k of t.tasks) {
    L.push('<task type="auto">', '  <name>' + k.name + '</name>', '  <files>' + k.files + '</files>');
    L.push('  <action>', k.action, '  </action>');
    if (k.verify !== null) L.push('  <verify>' + k.verify + '</verify>');
    L.push('  <done>' + k.done + '</done>', '</task>', '');
  }
  L.push('</tasks>', '', '<verification>', ...t.verification.map((v) => '- ' + v), '</verification>', '');
  L.push('<success_criteria>', t.success, '</success_criteria>', '');
  L.push('<output>', 'After completion, create ' + md`¦.aoforge/objectives/` + t.dir + '/' + t.id + md`-SUMMARY.md¦`, '</output>', '');
  return L.join('\n');
}

const trdFile = (t) => t.id + '-' + t.slug + '-TRD.md';

// ─── Project: textkit (B1; B3 and B6 derive from it) ────────────────────────────────────────────────────────────

const TEXTKIT_FILES = {
  'package.json':
    JSON.stringify(
      { name: 'textkit', version: '1.0.0', private: true, description: 'Keep short text notes in a JSON file', scripts: { test: 'node --test' } },
      null,
      2
    ) + '\n',
  '.gitignore': 'node_modules/\nnotes.json\n',
  'README.md': md`# textkit

Keep short text notes in ¦notes.json¦.

## Usage

    node src/cli.js add "buy milk"
    node src/cli.js list
`,
  'src/store.js': code`'use strict';

const fs = require('fs');

function loadNotes(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function addNote(file, text) {
  const notes = loadNotes(file);
  notes.push({ id: notes.length + 1, text: text });
  fs.writeFileSync(file, JSON.stringify(notes, null, 2) + '\n');
  return notes.length;
}

module.exports = { loadNotes, addNote };
`,
  'src/cli.js': code`'use strict';

const path = require('path');
const { loadNotes, addNote } = require('./store');

function main(argv, io) {
  const command = argv[0];
  const rest = argv.slice(1);
  if (command === 'add') {
    io.out('added ' + addNote(io.file, rest.join(' ')));
    return 0;
  }
  if (command === 'list') {
    for (const note of loadNotes(io.file)) io.out(note.id + '. ' + note.text);
    return 0;
  }
  io.err('usage: textkit <add|list>');
  return 1;
}

if (require.main === module) {
  const io = {
    file: path.join(process.cwd(), 'notes.json'),
    out: (line) => process.stdout.write(line + '\n'),
    err: (line) => process.stderr.write(line + '\n'),
  };
  process.exitCode = main(process.argv.slice(2), io);
}

module.exports = { main };
`,
  'test/store.test.js': code`'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadNotes, addNote } = require('../src/store');

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'textkit-')), 'notes.json');
}

test('loadNotes returns an empty list when the file is absent', () => {
  assert.deepStrictEqual(loadNotes(tempFile()), []);
});

test('addNote appends a numbered note and returns the count', () => {
  const file = tempFile();
  assert.strictEqual(addNote(file, 'buy milk'), 1);
  assert.strictEqual(addNote(file, 'call Sam'), 2);
  assert.deepStrictEqual(loadNotes(file), [
    { id: 1, text: 'buy milk' },
    { id: 2, text: 'call Sam' },
  ]);
});
`,
  'test/cli.test.js': code`'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { main } = require('../src/cli');

function run(argv, file) {
  const out = [];
  const err = [];
  const code = main(argv, { file: file, out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code: code, out: out, err: err };
}

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'textkit-')), 'notes.json');
}

test('add then list prints the numbered notes', () => {
  const file = tempFile();
  assert.deepStrictEqual(run(['add', 'buy milk'], file).out, ['added 1']);
  assert.deepStrictEqual(run(['list'], file).out, ['1. buy milk']);
});

test('an unrecognised command prints usage and exits 1', () => {
  const r = run(['frobnicate'], tempFile());
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(r.err, ['usage: textkit <add|list>']);
});
`,
};

const TEXTKIT_OBJ2 = '02-export-formats';

function textkitProject() {
  return {
    name: 'textkit',
    description: 'A small command line tool for keeping short text notes in a JSON file.',
    core: 'Capture a note in one command and read it back later.',
    files: TEXTKIT_FILES,
    scaffoldMessage: 'chore: scaffold textkit',
    obj1: {
      num: '1',
      dir: '01-note-storage',
      title: 'Note storage',
      goal: md`¦textkit add <text>¦ appends a note to ¦notes.json¦ and ¦textkit list¦ prints the notes, numbered.`,
      reqs: [
        ['NOTE-01', md`¦textkit add <text>¦ appends a note to ¦notes.json¦`],
        ['NOTE-02', md`¦textkit list¦ prints the notes, numbered`],
      ],
      criteria: [
        md`¦textkit add "buy milk"¦ appends the note and prints ¦added 1¦.`,
        md`¦textkit list¦ prints ¦1. buy milk¦.`,
        'Running with no command prints usage on stderr and exits 1.',
      ],
      trdName: '01-01-note-storage-TRD.md',
      trdLine: '(W1) store module, add and list commands, tests',
      trd: {
        id: '01-01',
        slug: 'note-storage',
        dir: '01-note-storage',
        objective: '01-note-storage',
        title: 'Note storage and the add and list commands',
        wave: 1,
        dependsOn: [],
        files: ['src/store.js', 'src/cli.js', 'test/store.test.js', 'test/cli.test.js'],
        requirements: ['NOTE-01', 'NOTE-02'],
        truths: [
          md`¦textkit add <text>¦ appends a note to ¦notes.json¦ and prints ¦added <count>¦`,
          md`¦textkit list¦ prints each note as ¦<id>. <text>¦`,
        ],
        artifacts: [
          { path: 'src/store.js', provides: 'loadNotes and addNote over a JSON file' },
          { path: 'src/cli.js', provides: 'the add and list commands' },
        ],
        keyLinks: [{ from: 'src/cli.js', to: 'src/store.js', via: 'require of the store', pattern: "require\\('./store'\\)" }],
        objectiveText:
          'Store notes in a JSON file and expose them through the add and list commands.\n\nPurpose: NOTE-01 and NOTE-02.\nOutput: the store module, the CLI entry and their tests.',
        context: [md`@README.md`],
        tasks: [
          {
            name: 'Task 1: Store module',
            files: 'src/store.js, test/store.test.js',
            action: md`Create ¦src/store.js¦ with ¦loadNotes(file)¦ (empty list when the file is absent) and ¦addNote(file, text)¦ (append ¦{ id, text }¦, return the count), plus ¦test/store.test.js¦.`,
            verify: 'node --test test/store.test.js',
            done: 'Both store tests pass.',
          },
          {
            name: 'Task 2: CLI entry',
            files: 'src/cli.js, test/cli.test.js',
            action: md`Create ¦src/cli.js¦ exporting ¦main(argv, io)¦ with the ¦add¦ and ¦list¦ commands and a usage line for anything else (exit 1), plus ¦test/cli.test.js¦.`,
            verify: 'node --test test/cli.test.js',
            done: 'Both CLI tests pass.',
          },
        ],
        verification: [md`¦node --test¦ passes`],
        success: 'Notes can be added and listed from the command line.',
      },
    },
    obj2: {
      num: '2',
      dir: TEXTKIT_OBJ2,
      title: 'Export formats',
      goal: md`¦textkit export --format <csv|json>¦ writes the notes in ¦notes.json¦ to stdout.`,
      reqs: [
        ['EXP-01', md`¦textkit export --format csv¦ writes the notes as CSV`],
        ['EXP-02', md`¦textkit export --format json¦ writes the notes as a JSON array`],
      ],
      criteria: [
        md`¦textkit export --format csv¦ prints a header row and one row per note.`,
        md`¦textkit export --format json¦ prints a JSON array of the notes.`,
        md`An unknown format exits 2 and prints ¦unknown format: <name>¦ on stderr.`,
      ],
      trdLines: [
        ['02-01-csv-renderer-TRD.md', '(W1) CSV renderer and tests'],
        ['02-02-json-renderer-TRD.md', '(W1) JSON renderer and tests'],
        ['02-03-export-command-TRD.md', '(W2) the export command in the CLI'],
      ],
      waves: 2,
    },
    trdSet: textkitTrds,
  };
}

function textkitTrd(base) {
  return Object.assign(
    { dir: TEXTKIT_OBJ2, objective: TEXTKIT_OBJ2, context: [md`@.aoforge/ROADMAP.md (Objective 2 section only)`] },
    base
  );
}

function exportCommandTrd(unknownFormat) {
  const truths = [
    md`¦textkit export --format csv¦ prints a header row and one row per note`,
    md`¦textkit export --format json¦ prints the notes as a JSON array`,
  ];
  if (unknownFormat) truths.push(md`¦textkit export --format xml¦ prints ¦unknown format: xml¦ on stderr and exits 2`);
  const dispatch = unknownFormat
    ? md` When the name is not a key of ¦EXPORTERS¦, print ¦unknown format: ¦ followed by the name on stderr and return 2.`
    : '';
  const checks = unknownFormat
    ? md`¦node src/cli.js export --format csv¦ prints ¦id,text¦ (no ¦notes.json¦ yet), and ¦node src/cli.js export --format xml¦ prints ¦unknown format: xml¦ on stderr and exits 2.`
    : md`¦node src/cli.js export --format csv¦ prints ¦id,text¦ (no ¦notes.json¦ yet), and ¦node src/cli.js export --format json¦ prints ¦[]¦.`;
  return textkitTrd({
    id: '02-03',
    slug: 'export-command',
    title: 'The export command',
    wave: 2,
    dependsOn: ['02-01', '02-02'],
    files: ['src/cli.js', 'test/cli.test.js'],
    requirements: ['EXP-01', 'EXP-02'],
    truths,
    artifacts: [
      { path: 'src/cli.js', provides: 'the export command and format dispatch' },
      { path: 'test/cli.test.js', provides: 'tests for the export command' },
    ],
    keyLinks: [
      { from: 'src/cli.js', to: 'src/export/csv.js', via: 'EXPORTERS table entry', pattern: 'export/csv' },
      { from: 'src/cli.js', to: 'src/export/json.js', via: 'EXPORTERS table entry', pattern: 'export/json' },
    ],
    objectiveText:
      'Add the export command to the CLI: pick the renderer by format name and print the notes with it' +
      (unknownFormat ? ', and exit 2 for a format that does not exist' : '') +
      '.\n\nPurpose: EXP-01 and EXP-02, joining the two renderers.\nOutput: the command in ' +
      md`¦src/cli.js¦` +
      ' and its tests.',
    context: [
      md`@.aoforge/ROADMAP.md (Objective 2 section only)`,
      md`@src/cli.js`,
      md`@src/export/csv.js and @src/export/json.js (from TRDs 02-01 and 02-02)`,
    ],
    tasks: [
      {
        name: 'Task 1: Export command and format dispatch',
        files: 'src/cli.js',
        action:
          md`In ¦src/cli.js¦ add an ¦export¦ command. Build an ¦EXPORTERS¦ table from ¦require('./export/csv').render¦ and ¦require('./export/json').render¦, keyed ¦csv¦ and ¦json¦. Read the name after ¦--format¦; with no ¦--format¦ print ¦usage: textkit export --format <csv|json>¦ on stderr and return 1.` +
          dispatch +
          md` Otherwise print ¦EXPORTERS[name](loadNotes(io.file))¦ with ¦io.out¦ and return 0.`,
        verify: checks,
        done: md`The ¦export¦ command prints notes in both formats` + (unknownFormat ? ' and rejects any other name.' : '.'),
      },
      {
        name: 'Task 2: Export command tests',
        files: 'test/cli.test.js',
        action:
          md`Extend ¦test/cli.test.js¦: after adding two notes, ¦export --format csv¦ prints the header and two rows, and ¦export --format json¦ prints a JSON array of length 2.` +
          (unknownFormat ? md` Also check that ¦export --format xml¦ returns 2 and writes ¦unknown format: xml¦ to stderr.` : ''),
        verify: 'node --test test/cli.test.js',
        done: 'The export tests pass next to the existing CLI tests.',
      },
    ],
    verification: [
      md`¦node --test¦ passes`,
      md`¦node src/cli.js export --format csv¦ prints ¦id,text¦ with no notes present`,
      ...(unknownFormat ? [md`¦node src/cli.js export --format xml¦ exits 2`] : []),
    ],
    success: 'Both formats can be exported from the command line' + (unknownFormat ? ', and an unknown format is refused.' : '.'),
  });
}

function textkitTrds() {
  return {
    '02-01': textkitTrd({
      id: '02-01',
      slug: 'csv-renderer',
      title: 'CSV renderer',
      wave: 1,
      dependsOn: [],
      files: ['src/export/csv.js', 'test/export-csv.test.js'],
      requirements: ['EXP-01'],
      truths: [
        md`¦render(notes)¦ returns the header row ¦id,text¦ followed by one row per note`,
        'A note whose text holds a comma, a double quote or a newline is quoted, with embedded double quotes doubled',
      ],
      artifacts: [
        { path: 'src/export/csv.js', provides: 'CSV renderer for a list of notes' },
        { path: 'test/export-csv.test.js', provides: 'tests for the CSV renderer' },
      ],
      keyLinks: [{ from: 'test/export-csv.test.js', to: 'src/export/csv.js', via: 'require of the renderer', pattern: 'export/csv' }],
      objectiveText:
        'Render a list of notes as CSV.\n\nPurpose: EXP-01. The command that prints this text is wired in TRD 02-03.\nOutput: ' +
        md`¦src/export/csv.js¦` +
        ' and its tests.',
      context: [md`@.aoforge/ROADMAP.md (Objective 2 section only)`, md`@src/store.js (a note is ¦{ id, text }¦)`],
      tasks: [
        {
          name: 'Task 1: CSV renderer',
          files: 'src/export/csv.js',
          action: md`Create ¦src/export/csv.js¦ exporting ¦render(notes)¦. The first line is ¦id,text¦ and each note adds one line with its id, a comma and its text. Quote the text (wrap it in double quotes, doubling any embedded double quote) when it contains a comma, a double quote or a newline. Join the lines with a newline and add no trailing newline.`,
          verify: md`node -e "const {render}=require('./src/export/csv');console.log(render([{id:1,text:'a,b'}]))" prints ¦id,text¦ then ¦1,"a,b"¦`,
          done: 'render returns the header row and one row per note, quoting text that needs it.',
        },
        {
          name: 'Task 2: CSV renderer tests',
          files: 'test/export-csv.test.js',
          action: md`Create ¦test/export-csv.test.js¦ with ¦node:test¦ cases: an empty list gives only the header row; two notes give the header and two rows; text with a comma, a double quote or a newline is quoted with embedded quotes doubled.`,
          verify: 'node --test test/export-csv.test.js',
          done: 'The three cases pass.',
        },
      ],
      verification: [md`¦node --test test/export-csv.test.js¦ passes`, md`¦render([])¦ returns ¦id,text¦`],
      success: 'The CSV renderer exists and is tested; the CLI wiring follows in TRD 02-03.',
    }),
    '02-02': textkitTrd({
      id: '02-02',
      slug: 'json-renderer',
      title: 'JSON renderer',
      wave: 1,
      dependsOn: [],
      files: ['src/export/json.js', 'test/export-json.test.js'],
      requirements: ['EXP-02'],
      truths: [
        md`¦render(notes)¦ returns the notes as a JSON array, pretty-printed with two spaces`,
        md`An empty list renders as ¦[]¦`,
      ],
      artifacts: [
        { path: 'src/export/json.js', provides: 'JSON renderer for a list of notes' },
        { path: 'test/export-json.test.js', provides: 'tests for the JSON renderer' },
      ],
      keyLinks: [{ from: 'test/export-json.test.js', to: 'src/export/json.js', via: 'require of the renderer', pattern: 'export/json' }],
      objectiveText:
        'Render a list of notes as JSON.\n\nPurpose: EXP-02. The command that prints this text is wired in TRD 02-03.\nOutput: ' +
        md`¦src/export/json.js¦` +
        ' and its tests.',
      context: [md`@.aoforge/ROADMAP.md (Objective 2 section only)`, md`@src/store.js (a note is ¦{ id, text }¦)`],
      tasks: [
        {
          name: 'Task 1: JSON renderer',
          files: 'src/export/json.js',
          action: md`Create ¦src/export/json.js¦ exporting ¦render(notes)¦ that returns ¦JSON.stringify(notes, null, 2)¦, so an empty list gives ¦[]¦.`,
          verify: md`node -e "const {render}=require('./src/export/json');console.log(render([{id:1,text:'a'}]))" prints a JSON array holding one object`,
          done: 'render returns a JSON array for any list of notes.',
        },
        {
          name: 'Task 2: JSON renderer tests',
          files: 'test/export-json.test.js',
          action: md`Create ¦test/export-json.test.js¦ with ¦node:test¦ cases: an empty list gives ¦[]¦; two notes parse back to the same two objects.`,
          verify: 'node --test test/export-json.test.js',
          done: 'Both cases pass.',
        },
      ],
      verification: [md`¦node --test test/export-json.test.js¦ passes`],
      success: 'The JSON renderer exists and is tested; the CLI wiring follows in TRD 02-03.',
    }),
    '02-03': exportCommandTrd(true),
  };
}

// ─── Project: tempconv (B2; B4 and B5 derive from it) ───────────────────────────────────────────────────────────

const TEMPCONV_FILES = {
  'package.json':
    JSON.stringify(
      { name: 'tempconv', version: '1.0.0', private: true, description: 'Convert Celsius to Kelvin', scripts: { test: 'node --test' } },
      null,
      2
    ) + '\n',
  '.gitignore': 'node_modules/\n',
  'README.md': md`# tempconv

Convert Celsius to Kelvin.

## Usage

    node src/cli.js k 0
`,
  'src/kelvin.js': code`'use strict';

function toKelvin(celsius) {
  return Math.round((celsius + 273.15) * 100) / 100;
}

module.exports = { toKelvin };
`,
  'src/cli.js': code`'use strict';

const { toKelvin } = require('./kelvin');

function main(argv, io) {
  const command = argv[0];
  const value = argv[1];
  if (command === 'k') {
    const celsius = Number(value);
    if (value === undefined || value === '' || Number.isNaN(celsius)) {
      io.err('not a number: ' + value);
      return 1;
    }
    io.out(String(toKelvin(celsius)));
    return 0;
  }
  io.err('usage: tempconv k <celsius>');
  return 1;
}

if (require.main === module) {
  const io = {
    out: (line) => process.stdout.write(line + '\n'),
    err: (line) => process.stderr.write(line + '\n'),
  };
  process.exitCode = main(process.argv.slice(2), io);
}

module.exports = { main };
`,
  'test/kelvin.test.js': code`'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { toKelvin } = require('../src/kelvin');

test('toKelvin converts freezing point', () => {
  assert.strictEqual(toKelvin(0), 273.15);
});

test('toKelvin converts absolute zero', () => {
  assert.strictEqual(toKelvin(-273.15), 0);
});
`,
  'test/cli.test.js': code`'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { main } = require('../src/cli');

function run(argv) {
  const out = [];
  const err = [];
  const code = main(argv, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code: code, out: out, err: err };
}

test('k prints the Kelvin value', () => {
  assert.deepStrictEqual(run(['k', '0']).out, ['273.15']);
  assert.deepStrictEqual(run(['k', '-273.15']).out, ['0']);
});

test('k rejects a value that is not a number', () => {
  const r = run(['k', 'abc']);
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(r.err, ['not a number: abc']);
});
`,
};

const TEMPCONV_OBJ2 = '02-batch-conversion';

function tempconvProject() {
  return {
    name: 'tempconv',
    description: 'A small command line tool for converting temperatures.',
    core: 'Turn a Celsius reading into Kelvin with one command.',
    files: TEMPCONV_FILES,
    scaffoldMessage: 'chore: scaffold tempconv',
    obj1: {
      num: '1',
      dir: '01-single-conversion',
      title: 'Single conversion',
      goal: md`¦tempconv k <celsius>¦ prints the Kelvin value.`,
      reqs: [['CONV-01', md`¦tempconv k <celsius>¦ prints the Kelvin value`]],
      criteria: [
        md`¦tempconv k 0¦ prints ¦273.15¦.`,
        md`¦tempconv k -273.15¦ prints ¦0¦.`,
        md`¦tempconv k abc¦ prints ¦not a number: abc¦ on stderr and exits 1.`,
      ],
      trdName: '01-01-kelvin-command-TRD.md',
      trdLine: '(W1) toKelvin, the k command, tests',
      trd: {
        id: '01-01',
        slug: 'kelvin-command',
        dir: '01-single-conversion',
        objective: '01-single-conversion',
        title: 'Kelvin conversion and the k command',
        wave: 1,
        dependsOn: [],
        files: ['src/kelvin.js', 'src/cli.js', 'test/kelvin.test.js', 'test/cli.test.js'],
        requirements: ['CONV-01'],
        truths: [
          md`¦tempconv k 0¦ prints ¦273.15¦ and ¦tempconv k -273.15¦ prints ¦0¦`,
          md`¦tempconv k abc¦ prints ¦not a number: abc¦ on stderr and exits 1`,
        ],
        artifacts: [
          { path: 'src/kelvin.js', provides: 'toKelvin' },
          { path: 'src/cli.js', provides: 'the k command' },
        ],
        keyLinks: [{ from: 'src/cli.js', to: 'src/kelvin.js', via: 'require of toKelvin', pattern: "require\\('./kelvin'\\)" }],
        objectiveText:
          'Convert one Celsius value to Kelvin from the command line.\n\nPurpose: CONV-01.\nOutput: the conversion function, the CLI entry and their tests.',
        context: [md`@README.md`],
        tasks: [
          {
            name: 'Task 1: Conversion function',
            files: 'src/kelvin.js, test/kelvin.test.js',
            action: md`Create ¦src/kelvin.js¦ exporting ¦toKelvin(celsius)¦, rounded to two decimals, plus ¦test/kelvin.test.js¦.`,
            verify: 'node --test test/kelvin.test.js',
            done: 'Both conversion tests pass.',
          },
          {
            name: 'Task 2: CLI entry',
            files: 'src/cli.js, test/cli.test.js',
            action: md`Create ¦src/cli.js¦ exporting ¦main(argv, io)¦ with the ¦k¦ command, a ¦not a number¦ error (exit 1) and a usage line, plus ¦test/cli.test.js¦.`,
            verify: 'node --test test/cli.test.js',
            done: 'Both CLI tests pass.',
          },
        ],
        verification: [md`¦node --test¦ passes`],
        success: 'A Celsius value can be converted from the command line.',
      },
    },
    obj2: {
      num: '2',
      dir: TEMPCONV_OBJ2,
      title: 'Batch conversion',
      goal: md`¦tempconv batch <file>¦ converts a file of Celsius values to Kelvin.`,
      reqs: [['BAT-01', md`¦tempconv batch <file>¦ converts a file of Celsius values to Kelvin`]],
      criteria: [
        'One value per line in, one Kelvin value per line out.',
        'Blank lines are skipped.',
        'An invalid line is reported on stderr with its line number and the exit code is 1.',
      ],
      trdLines: [
        ['02-01-batch-parser-TRD.md', '(W1) line parser and tests'],
        ['02-02-batch-formatter-TRD.md', '(W1) result and error formatter and tests'],
        ['02-03-batch-command-TRD.md', '(W2) the batch command in the CLI'],
        ['02-04-batch-readme-TRD.md', '(W2) README section on the batch input format'],
      ],
      waves: 2,
    },
    trdSet: tempconvTrds,
  };
}

function tempconvTrd(base) {
  return Object.assign(
    { dir: TEMPCONV_OBJ2, objective: TEMPCONV_OBJ2, context: [md`@.aoforge/ROADMAP.md (Objective 2 section only)`] },
    base
  );
}

function tempconvTrds() {
  return {
    '02-01': tempconvTrd({
      id: '02-01',
      slug: 'batch-parser',
      title: 'Batch line parser',
      wave: 1,
      dependsOn: [],
      files: ['src/batch/parse.js', 'test/batch-parse.test.js'],
      requirements: ['BAT-01'],
      truths: [
        'Blank lines are skipped and every other line keeps its 1-based line number',
        'A line that is not a finite number is returned as an error with its line number and text',
      ],
      artifacts: [
        { path: 'src/batch/parse.js', provides: 'parseLines over the text of a batch file' },
        { path: 'test/batch-parse.test.js', provides: 'tests for the parser' },
      ],
      keyLinks: [{ from: 'test/batch-parse.test.js', to: 'src/batch/parse.js', via: 'require of the parser', pattern: 'batch/parse' }],
      objectiveText:
        'Parse the text of a batch file into Celsius values and invalid lines.\n\nPurpose: BAT-01. The command that reads the file is wired in TRD 02-03.\nOutput: ' +
        md`¦src/batch/parse.js¦` +
        ' and its tests.',
      context: [md`@.aoforge/ROADMAP.md (Objective 2 section only)`, md`@src/kelvin.js`],
      tasks: [
        {
          name: 'Task 1: Line parser',
          files: 'src/batch/parse.js',
          action: md`Create ¦src/batch/parse.js¦ exporting ¦parseLines(text)¦. Split on ¦\n¦ (accept ¦\r\n¦), number lines from 1, skip lines that are empty after trimming, put numeric lines in ¦values¦ as ¦{ line, celsius }¦ and every other line in ¦errors¦ as ¦{ line, text }¦. Return ¦{ values, errors }¦.`,
          verify: md`node -e "const {parseLines}=require('./src/batch/parse');console.log(JSON.stringify(parseLines('0\n\nabc\n100\n')))" lists values for lines 1 and 4 and one error for line 3`,
          done: 'parseLines separates values from errors and skips blank lines.',
        },
        {
          name: 'Task 2: Parser tests',
          files: 'test/batch-parse.test.js',
          action: md`Create ¦test/batch-parse.test.js¦ with ¦node:test¦ cases for blank lines, line numbers after a blank line, a non-numeric line and ¦\r\n¦ endings.`,
          verify: 'node --test test/batch-parse.test.js',
          done: 'All four cases pass.',
        },
      ],
      verification: [md`¦node --test test/batch-parse.test.js¦ passes`],
      success: 'The parser exists and is tested; the CLI wiring follows in TRD 02-03.',
    }),
    '02-02': tempconvTrd({
      id: '02-02',
      slug: 'batch-formatter',
      title: 'Batch result and error formatter',
      wave: 1,
      dependsOn: [],
      files: ['src/batch/format.js', 'test/batch-format.test.js'],
      requirements: ['BAT-01'],
      truths: [
        'Each parsed value is formatted as its Kelvin value, one per line, in input order',
        md`An invalid line is formatted as ¦line <n>: not a number: <text>¦`,
      ],
      artifacts: [
        { path: 'src/batch/format.js', provides: 'formatValues and formatError' },
        { path: 'test/batch-format.test.js', provides: 'tests for the formatter' },
      ],
      keyLinks: [{ from: 'src/batch/format.js', to: 'src/kelvin.js', via: 'require of toKelvin', pattern: "require\\('../kelvin'\\)" }],
      objectiveText:
        'Turn parsed values and invalid lines into output text.\n\nPurpose: BAT-01. The command that prints this text is wired in TRD 02-03.\nOutput: ' +
        md`¦src/batch/format.js¦` +
        ' and its tests.',
      context: [md`@.aoforge/ROADMAP.md (Objective 2 section only)`, md`@src/kelvin.js`],
      tasks: [
        {
          name: 'Task 1: Formatter',
          files: 'src/batch/format.js',
          action: md`Create ¦src/batch/format.js¦ exporting ¦formatValues(values)¦, which maps each ¦{ line, celsius }¦ to ¦String(toKelvin(celsius))¦ using ¦require('../kelvin')¦, and ¦formatError(error)¦, which returns ¦line <n>: not a number: <text>¦ for an ¦{ line, text }¦ entry.`,
          verify: md`node -e "const f=require('./src/batch/format');console.log(f.formatValues([{line:1,celsius:0}]), f.formatError({line:3,text:'x'}))" prints ¦[ '273.15' ] line 3: not a number: x¦`,
          done: 'formatValues and formatError return the documented text.',
        },
        {
          name: 'Task 2: Formatter tests',
          files: 'test/batch-format.test.js',
          action: md`Create ¦test/batch-format.test.js¦ with ¦node:test¦ cases for input order, a negative Celsius value and the error text.`,
          verify: 'node --test test/batch-format.test.js',
          done: 'All three cases pass.',
        },
      ],
      verification: [md`¦node --test test/batch-format.test.js¦ passes`],
      success: 'The formatter exists and is tested; the CLI wiring follows in TRD 02-03.',
    }),
    '02-03': tempconvTrd({
      id: '02-03',
      slug: 'batch-command',
      title: 'The batch command',
      wave: 2,
      dependsOn: ['02-01', '02-02'],
      files: ['src/cli.js', 'test/cli.test.js'],
      requirements: ['BAT-01'],
      truths: [
        md`¦tempconv batch <file>¦ prints one Kelvin value per input line on stdout and skips blank lines`,
        'Each invalid line is reported on stderr with its line number, and the exit code is 1 when there was any',
      ],
      artifacts: [
        { path: 'src/cli.js', provides: 'the batch command' },
        { path: 'test/cli.test.js', provides: 'tests for the batch command' },
      ],
      keyLinks: [
        { from: 'src/cli.js', to: 'src/batch/parse.js', via: 'parseLines call', pattern: 'batch/parse' },
        { from: 'src/cli.js', to: 'src/batch/format.js', via: 'formatValues and formatError calls', pattern: 'batch/format' },
      ],
      objectiveText:
        'Add the batch command: read the file, parse it, print the results and report invalid lines.\n\nPurpose: BAT-01, joining the parser and the formatter.\nOutput: the command in ' +
        md`¦src/cli.js¦` +
        ' and its tests.',
      context: [
        md`@.aoforge/ROADMAP.md (Objective 2 section only)`,
        md`@src/cli.js`,
        md`@src/batch/parse.js and @src/batch/format.js (from TRDs 02-01 and 02-02)`,
      ],
      tasks: [
        {
          name: 'Task 1: Batch command',
          files: 'src/cli.js',
          action: md`In ¦src/cli.js¦ add a ¦batch¦ command. With no file argument print ¦usage: tempconv batch <file>¦ on stderr and return 1. Otherwise read the file as UTF-8, call ¦parseLines¦, print each ¦formatValues¦ line with ¦io.out¦ and each ¦formatError¦ line with ¦io.err¦, and return 1 if there were any errors, else 0.`,
          verify: md`printf '0\n\nx\n100\n' | node src/cli.js batch /dev/stdin prints ¦273.15¦ and ¦373.15¦, then ¦line 3: not a number: x¦ on stderr, and exits 1`,
          done: 'The batch command converts a file and reports invalid lines.',
        },
        {
          name: 'Task 2: Batch command tests',
          files: 'test/cli.test.js',
          action: md`Extend ¦test/cli.test.js¦ with a temporary input file: a valid file gives one Kelvin line per value and code 0; a file with a blank line skips it; a file with an invalid line returns 1 and reports its line number on stderr.`,
          verify: 'node --test test/cli.test.js',
          done: 'The batch tests pass next to the existing CLI tests.',
        },
      ],
      verification: [md`¦node --test¦ passes`, 'the shell check in Task 1 exits 1 and prints both Kelvin values'],
      success: 'A file of Celsius values can be converted from the command line.',
    }),
    '02-04': tempconvTrd({
      id: '02-04',
      slug: 'batch-readme',
      title: 'README section on the batch input format',
      wave: 2,
      dependsOn: ['02-01'],
      files: ['README.md'],
      requirements: ['BAT-01'],
      truths: [
        'The README states the input rules a batch file follows: one Celsius value per line, blank lines skipped',
        'The README says how an invalid line is reported, by line number',
      ],
      artifacts: [{ path: 'README.md', provides: 'a section describing the batch input format' }],
      keyLinks: [],
      objectiveText: 'Document the input rules the parser enforces.\n\nPurpose: BAT-01, documentation only.\nOutput: a new section in ' + md`¦README.md¦` + '.',
      context: [md`@README.md`, md`@src/batch/parse.js (from TRD 02-01)`],
      tasks: [
        {
          name: 'Task 1: Input format section',
          files: 'README.md',
          action: md`Add a ¦## Batch input¦ section to ¦README.md¦ saying a batch file holds one Celsius value per line and that blank lines are skipped.`,
          verify: md`grep -q "## Batch input" README.md`,
          done: 'README.md has the Batch input section with both rules.',
        },
        {
          name: 'Task 2: Invalid line note',
          files: 'README.md',
          action: md`Under ¦## Batch input¦ add a sentence saying a line that is not a number is reported with its 1-based line number.`,
          verify: md`grep -q "line number" README.md`,
          done: 'README.md says how an invalid line is reported.',
        },
      ],
      verification: [md`¦grep -q "## Batch input" README.md¦ exits 0`],
      success: 'The batch input format is documented.',
    }),
  };
}

// ─── Mutations: each changes only TRD data, and so only TRD files ─────────────────────────────────────────────────

function mutateB3(set) {
  const registration = (id, format) => {
    const t = set[id];
    t.files.push('src/cli.js');
    t.truths.push(md`¦src/cli.js¦ registers ¦` + format + md`¦ in the ¦EXPORTERS¦ table`);
    t.keyLinks.push({ from: 'src/cli.js', to: 'src/export/' + format + '.js', via: 'EXPORTERS table entry', pattern: 'export/' + format });
    t.tasks.push({
      name: 'Task 3: Register ' + format + ' in the CLI',
      files: 'src/cli.js',
      action:
        md`In ¦src/cli.js¦ add ¦EXPORTERS.` +
        format +
        md` = require('./export/` +
        format +
        md`').render;¦, declaring ¦const EXPORTERS = {};¦ above ¦main¦ if the table is not there yet.`,
      verify: md`node -e "console.log(typeof require('./src/cli').main)" prints ¦function¦`,
      done: md`¦src/cli.js¦ registers the ` + format + ' renderer.',
    });
  };
  registration('02-01', 'csv');
  registration('02-02', 'json');
  return set;
}

function mutateB4(set) {
  set['02-02'].tasks[0].verify = null;
  return set;
}

function mutateB5(set) {
  set['02-02'].dependsOn = ['02-04'];
  return set;
}

function mutateB6(set) {
  set['02-03'] = exportCommandTrd(false);
  return set;
}

const SPEC = {
  B1: { project: 'textkit', base: null, planted: null },
  B2: { project: 'tempconv', base: null, planted: null },
  B3: { project: 'textkit', base: 'B1', planted: { kind: 'same_wave_overlap', trds: ['02-01', '02-02'] }, mutate: mutateB3 },
  B4: { project: 'tempconv', base: 'B2', planted: { kind: 'missing_verify', trds: ['02-02'] }, mutate: mutateB4 },
  B5: { project: 'tempconv', base: 'B2', planted: { kind: 'later_wave_dependency', trds: ['02-02', '02-04'] }, mutate: mutateB5 },
  B6: { project: 'textkit', base: 'B1', planted: { kind: 'uncovered_success_criterion', trds: ['02-03'] }, mutate: mutateB6 },
};

const PROJECTS = { textkit: textkitProject, tempconv: tempconvProject };

// ─── Planning tree ───────────────────────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  mode: 'yolo',
  depth: 'standard',
  job_checker_enabled: true,
  workflow: { research: true, job_check: true, verifier: true, auto_advance: true, verifier_checkpoints: false, decision_queue: false },
  planning: { commit_docs: true, search_gitignored: false },
  parallelization: { enabled: true, job_level: true, task_level: false, skip_checkpoints: true, max_concurrent_agents: 3, min_jobs_for_parallel: 2 },
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
    upgraded_at: CONFIG_STAMP_DATE,
  },
};

function projectMd(P) {
  return [
    '---',
    'kind: cli',
    'default_work: feature',
    '---',
    '',
    '# ' + P.name,
    '',
    '## What This Is',
    '',
    P.description,
    '',
    '## Core Value',
    '',
    P.core,
    '',
    '## Requirements',
    '',
    '### Validated',
    '',
    ...P.obj1.reqs.map((r) => '- ' + r[0] + ': ' + r[1]),
    '',
    '### Active',
    '',
    ...P.obj2.reqs.map((r) => '- ' + r[0] + ': ' + r[1]),
    '',
    '## Constraints',
    '',
    md`- Node.js with no dependencies; tests run with ¦node --test¦.`,
    '',
  ].join('\n');
}

function requirementsMd(P, obj1Done) {
  const row = (r, o, done) => '| ' + r[0] + ' | ' + o + ' | ' + (done ? 'Complete' : 'Pending') + ' |';
  const item = (r, done) => '- [' + (done ? 'x' : ' ') + '] **' + r[0] + '**: ' + r[1];
  return [
    '# Requirements: ' + P.name,
    '',
    '## v1 Requirements',
    '',
    '### ' + P.obj1.title,
    '',
    ...P.obj1.reqs.map((r) => item(r, obj1Done)),
    '',
    '### ' + P.obj2.title,
    '',
    ...P.obj2.reqs.map((r) => item(r, false)),
    '',
    '## Traceability',
    '',
    '| Requirement | Objective | Status |',
    '|---|---|---|',
    ...P.obj1.reqs.map((r) => row(r, 1, obj1Done)),
    ...P.obj2.reqs.map((r) => row(r, 2, false)),
    '',
  ].join('\n');
}

function roadmapMd(P, s) {
  const o1 = P.obj1;
  const o2 = P.obj2;
  const L = [
    '# Roadmap: ' + P.name,
    '',
    '## Milestones',
    '',
    '- **v1.0 - ' + o1.title + ' and ' + o2.title.toLowerCase() + '** (current): Objectives 1-2',
    '',
    '## Objectives',
    '',
  ];
  L.push('- [' + (s.obj1Done ? 'x' : ' ') + '] Objective 1: ' + o1.title + ' (' + (s.obj1Done ? '1' : '0') + '/1 plans)');
  L.push('- [ ] Objective 2: ' + o2.title + ' (0/' + (s.obj2Planned ? o2.trdLines.length : 0) + ' plans)', '');
  const section = (o, depends, trdsText) => [
    '### Objective ' + o.num + ': ' + o.title,
    '',
    '**Goal**: ' + o.goal,
    '**Requirements**: ' + o.reqs.map((r) => r[0]).join(', '),
    '**Depends on**: ' + depends,
    '**Success Criteria** (what must be TRUE):',
    ...o.criteria.map((c, i) => '  ' + (i + 1) + '. ' + c),
    ...trdsText,
    '',
  ];
  L.push(
    ...section(o1, 'Nothing', ['**TRDs**: 1 plan (1 wave)', '', 'TRDs:', '- [' + (s.obj1Done ? 'x' : ' ') + '] ' + o1.trdName + ' - ' + o1.trdLine])
  );
  L.push(
    ...section(
      o2,
      'Objective 1',
      s.obj2Planned
        ? ['**TRDs**: ' + o2.trdLines.length + ' plans (' + o2.waves + ' waves)', '', 'TRDs:', ...o2.trdLines.map((t) => '- [ ] ' + t[0] + ' - ' + t[1])]
        : ['**TRDs**: Not yet planned']
    )
  );
  L.push('## Progress', '', '| Objective | Milestone | Plans | Status | Completed |', '|---|---|---|---|---|');
  L.push('| 1. ' + o1.title + ' | v1.0 | ' + (s.obj1Done ? '1/1 | Complete | 2026-10-02' : '0/1 | Not started | -') + ' |');
  L.push('| 2. ' + o2.title + ' | v1.0 | ' + (s.obj2Planned ? '0/' + o2.trdLines.length + ' | Planned' : '0/0 | Not planned') + ' | - |', '');
  return L.join('\n');
}

function stateStatus(s) {
  return s.obj2Planned ? 'Ready to execute' : s.obj1Done ? 'Objective complete' : 'In progress';
}

function stateMd(P, s) {
  const planned = s.obj2Planned;
  const date = '2026-10-02';
  return [
    '# Project State',
    '',
    '## Project Reference',
    '',
    'See: .aoforge/PROJECT.md',
    '',
    '**Core value:** ' + P.core,
    '**Current focus:** ' + (planned ? 'Objective 2: ' + P.obj2.title + ' (planned, not started)' : 'Objective 1: ' + P.obj1.title),
    '',
    '## Current Position',
    '',
    '**Current Objective:** ' + (planned ? '2' : '1'),
    '**Current Job:** 0',
    '**Total Jobs in Objective:** ' + (planned ? P.obj2.trdLines.length : 1),
    '**Status:** ' + stateStatus(s),
    '**Progress:** ' + (s.obj1Done ? '50%' : '0%'),
    '**Last Activity:** ' + date,
    '',
    '## Blockers',
    '',
    'None.',
    '',
    '## Session Log',
    '',
    '- ' + date + ': ' + (planned ? 'Planned objective 2' : s.obj1Done ? 'Completed objective 1' : 'Started objective 1'),
    '',
  ].join('\n');
}

function stateJson(P, s) {
  const planned = s.obj2Planned;
  return (
    JSON.stringify(
      {
        current_objective: planned ? '2' : '1',
        current_job: 0,
        total_jobs: planned ? P.obj2.trdLines.length : 1,
        progress_pct: s.obj1Done ? 50 : 0,
        status: stateStatus(s),
        last_activity: '2026-10-02',
        metrics: { jobs_completed: 0, jobs_failed: 0, sessions: 0 },
        decisions: [],
        blockers: [],
        session_log: [],
      },
      null,
      2
    ) + '\n'
  );
}

function objectiveMd(o) {
  return '---\nwork: feature\n---\n\n# ' + o.title + '\n\n## Goal\n\n' + o.goal + '\n';
}

function summaryMd(P) {
  const o = P.obj1;
  const t = o.trd;
  return [
    '---',
    'objective: ' + o.dir,
    'trd: "01"',
    'subsystem: cli',
    'tags: [node, cli]',
    'requires: []',
    'provides:',
    '  - ' + o.title.toLowerCase() + ' through the command line',
    'key-files:',
    '  created: [' + t.files.join(', ') + ']',
    '  modified: []',
    'requirements-completed: [' + t.requirements.join(', ') + ']',
    'duration: 12min',
    'completed: 2026-10-02',
    '---',
    '',
    '# Objective 1: ' + o.title + ' Summary',
    '',
    '**' + o.goal + '**',
    '',
    '## Task Evidence',
    '',
    '| Task | Verify Command | Exit Code | Status |',
    '|---|---|---|---|',
    ...t.tasks.map((k) => '| ' + k.name + ' | ' + md`¦` + k.verify + md`¦` + ' | 0 | PASS |'),
    '',
    '## Self-Check: PASSED',
    '',
  ].join('\n');
}

function buildFixture(id, dir) {
  const spec = SPEC[id];
  if (!spec) throw new Error('unknown fixture id: ' + id);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) throw new Error('target directory is not empty: ' + dir);
  fs.mkdirSync(dir, { recursive: true });

  const P = PROJECTS[spec.project]();
  const o1 = P.obj1;
  const o2 = P.obj2;
  const trds = spec.mutate ? spec.mutate(P.trdSet()) : P.trdSet();
  const none = { obj1Done: false, obj2Planned: false };
  const done = { obj1Done: true, obj2Planned: false };
  const planned = { obj1Done: true, obj2Planned: true };

  git(dir, ['init', '-q', '--template=']);

  // 1. scaffold: project files and the planning root
  gitCommit(
    dir,
    {
      'package.json': P.files['package.json'],
      '.gitignore': P.files['.gitignore'],
      'README.md': P.files['README.md'],
      '.aoforge/config.json': JSON.stringify(CONFIG, null, 2) + '\n',
      '.aoforge/PROJECT.md': projectMd(P),
      '.aoforge/REQUIREMENTS.md': requirementsMd(P, false),
      '.aoforge/ROADMAP.md': roadmapMd(P, none),
      '.aoforge/STATE.md': stateMd(P, none),
      '.aoforge/state.json': stateJson(P, none),
    },
    P.scaffoldMessage,
    0
  );
  // 2. plan objective 1
  gitCommit(
    dir,
    {
      ['.aoforge/objectives/' + o1.dir + '/OBJECTIVE.md']: objectiveMd(o1),
      ['.aoforge/objectives/' + o1.dir + '/' + o1.trdName]: renderTrd(o1.trd),
    },
    'docs(01): plan ' + o1.title.toLowerCase(),
    1
  );
  // 3. implementation
  gitCommit(
    dir,
    Object.fromEntries(Object.entries(P.files).filter(([rel]) => rel.startsWith('src/'))),
    'feat(01-01): add ' + o1.title.toLowerCase() + ' and the command line entry',
    2
  );
  // 4. tests
  gitCommit(
    dir,
    Object.fromEntries(Object.entries(P.files).filter(([rel]) => rel.startsWith('test/'))),
    'test(01-01): add unit tests',
    3
  );
  // 5. summary, requirements and roadmap ticked
  gitCommit(
    dir,
    {
      ['.aoforge/objectives/' + o1.dir + '/01-01-SUMMARY.md']: summaryMd(P),
      '.aoforge/REQUIREMENTS.md': requirementsMd(P, true),
      '.aoforge/ROADMAP.md': roadmapMd(P, done),
      '.aoforge/STATE.md': stateMd(P, done),
      '.aoforge/state.json': stateJson(P, done),
    },
    'docs(01-01): complete ' + o1.title.toLowerCase(),
    4
  );
  // 6. plan objective 2 (the last commit; the tree is clean afterwards)
  const objective2 = { ['.aoforge/objectives/' + o2.dir + '/OBJECTIVE.md']: objectiveMd(o2) };
  for (const t of Object.values(trds)) objective2['.aoforge/objectives/' + o2.dir + '/' + trdFile(t)] = renderTrd(t);
  Object.assign(objective2, {
    '.aoforge/ROADMAP.md': roadmapMd(P, planned),
    '.aoforge/STATE.md': stateMd(P, planned),
    '.aoforge/state.json': stateJson(P, planned),
  });
  gitCommit(dir, objective2, 'docs(02): plan ' + o2.title.toLowerCase(), 5);

  return { id: id, dir: dir, head: git(dir, ['rev-parse', 'HEAD']).trim() };
}

// Facts the scorer needs; never written into a repository.
function describeFixture(id) {
  const spec = SPEC[id];
  if (!spec) throw new Error('unknown fixture id: ' + id);
  const P = PROJECTS[spec.project]();
  const base = P.trdSet();
  const trds = spec.mutate ? spec.mutate(P.trdSet()) : P.trdSet();
  const rel = (t) => '.aoforge/objectives/' + P.obj2.dir + '/' + trdFile(t);
  return {
    id: id,
    project: P.name,
    base: spec.base,
    objective: P.obj2.num,
    objectiveDir: P.obj2.dir,
    goal: P.obj2.goal,
    requirementIds: P.obj2.reqs.map((r) => r[0]),
    trdIds: Object.keys(trds),
    trdFiles: Object.values(trds).map(trdFile),
    planted: spec.planted,
    // the TRD files whose text differs from the base set: a mutation lives in these and nowhere else
    changedFiles: spec.mutate ? Object.keys(trds).filter((k) => renderTrd(trds[k]) !== renderTrd(base[k])).map((k) => rel(trds[k])) : [],
  };
}

module.exports = { FIXTURES, buildFixture, describeFixture };
