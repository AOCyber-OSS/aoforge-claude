'use strict';

// Hand-written reference solutions for test E (TRD 81-12), used only by proofs.test.cjs to show the hidden checks in
// acceptance.cjs pass on a correct solution (and fail on the base project). Never copied into a run's project.
//
//   applyQuick(dir)  the quick change: `notekit list --json` prints the notes as a JSON array of {id, text}, with a test
//   applyBuild(dir)  objective 1: `notekit tag <id> <tag>` persists a tag and `notekit list --tag <tag>` lists only the
//                    matching notes, with tests
//
// Each overlay writes whole files over a freshly built project (fixtures/E/build.cjs); it does not commit. The two
// overlays are independent: each starts from the base project, as the runs do.

const fs = require('fs');
const path = require('path');

const js = (strings, ...values) => String.raw({ raw: strings.raw }, ...values);

function write(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return Object.keys(files);
}

const QUICK_CLI = js`#!/usr/bin/env node
'use strict';

const { loadNotes, addNote } = require('./store.js');

const USAGE = 'usage: notekit <add <text>|list [--json]>\n';

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
    case 'list': {
      const notes = loadNotes();
      if (rest.includes('--json')) {
        process.stdout.write(JSON.stringify(notes.map((note) => ({ id: note.id, text: note.text }))) + '\n');
        return 0;
      }
      for (const note of notes) {
        process.stdout.write(note.id + '. ' + note.text + '\n');
      }
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
`;

const QUICK_TEST = js`'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notekit-json-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('list --json prints the notes as a JSON array of {id, text}', () => {
  const file = path.join(dir, 'notes.json');
  fs.writeFileSync(file, JSON.stringify([{ id: 1, text: 'a "quoted" note' }, { id: 4, text: 'b' }]));
  const result = spawnSync(process.execPath, [CLI, 'list', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, NOTEKIT_FILE: file },
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), [{ id: 1, text: 'a "quoted" note' }, { id: 4, text: 'b' }]);
});

test('list --json with no notes prints an empty array', () => {
  const result = spawnSync(process.execPath, [CLI, 'list', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, NOTEKIT_FILE: path.join(dir, 'none.json') },
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), []);
});
`;

const BUILD_STORE = js`'use strict';

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

// Adds a tag to the note with this id (once) and saves; returns the note, or null when there is no such note.
function tagNote(id, tag, file = notesFile()) {
  const notes = loadNotes(file);
  const note = notes.find((n) => n.id === id);
  if (!note) return null;
  const tags = Array.isArray(note.tags) ? note.tags : [];
  if (!tags.includes(tag)) tags.push(tag);
  note.tags = tags;
  saveNotes(notes, file);
  return note;
}

// The notes that carry the tag; notes written before tags existed have none.
function notesWithTag(tag, file = notesFile()) {
  return loadNotes(file).filter((n) => Array.isArray(n.tags) && n.tags.includes(tag));
}

module.exports = { notesFile, loadNotes, saveNotes, addNote, tagNote, notesWithTag };
`;

const BUILD_CLI = js`#!/usr/bin/env node
'use strict';

const { loadNotes, addNote, tagNote, notesWithTag } = require('./store.js');

const USAGE = 'usage: notekit <add <text>|list [--tag <tag>]|tag <id> <tag>>\n';

function print(notes) {
  for (const note of notes) {
    process.stdout.write(note.id + '. ' + note.text + '\n');
  }
}

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
    case 'list': {
      const at = rest.indexOf('--tag');
      if (at === -1) {
        print(loadNotes());
        return 0;
      }
      const tag = rest[at + 1];
      if (!tag) {
        process.stderr.write(USAGE);
        return 1;
      }
      print(notesWithTag(tag));
      return 0;
    }
    case 'tag': {
      const [idText, tag] = rest;
      const id = Number(idText);
      if (!Number.isInteger(id) || !tag) {
        process.stderr.write(USAGE);
        return 1;
      }
      if (!tagNote(id, tag)) {
        process.stderr.write('no note ' + idText + '\n');
        return 1;
      }
      process.stdout.write('tagged ' + id + ' ' + tag + '\n');
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
`;

const BUILD_TEST = js`'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { tagNote, notesWithTag, loadNotes } = require('../src/store.js');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');
const dirs = [];
after(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

function seeded() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notekit-tags-'));
  dirs.push(dir);
  const file = path.join(dir, 'notes.json');
  fs.writeFileSync(file, JSON.stringify([{ id: 1, text: 'one' }, { id: 2, text: 'two' }]));
  return file;
}

function run(file, ...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, NOTEKIT_FILE: file } });
}

test('tagNote saves the tag once and returns the note', () => {
  const file = seeded();
  assert.deepEqual(tagNote(2, 'home', file).tags, ['home']);
  assert.deepEqual(tagNote(2, 'home', file).tags, ['home']);
  assert.deepEqual(loadNotes(file)[1], { id: 2, text: 'two', tags: ['home'] });
  assert.equal(tagNote(9, 'home', file), null);
});

test('notesWithTag skips notes without tags', () => {
  const file = seeded();
  tagNote(1, 'work', file);
  assert.deepEqual(notesWithTag('work', file).map((n) => n.id), [1]);
  assert.deepEqual(notesWithTag('home', file), []);
});

test('tag persists and list --tag prints only the matching notes', () => {
  const file = seeded();
  assert.equal(run(file, 'tag', '2', 'home').status, 0);
  const result = run(file, 'list', '--tag', 'home');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '2. two\n');
});

test('tag on a missing note exits 1', () => {
  const result = run(seeded(), 'tag', '9', 'home');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no note 9/);
});
`;

/** applyQuick(dir) -> the paths written: the --json flag and its test. */
function applyQuick(dir) {
  return write(dir, { 'src/cli.js': QUICK_CLI, 'test/list-json.test.js': QUICK_TEST });
}

/** applyBuild(dir) -> the paths written: tag and list --tag, with tests. */
function applyBuild(dir) {
  return write(dir, { 'src/store.js': BUILD_STORE, 'src/cli.js': BUILD_CLI, 'test/tags.test.js': BUILD_TEST });
}

module.exports = { applyQuick, applyBuild };
