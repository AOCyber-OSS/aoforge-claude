'use strict';

// Hidden acceptance checks for test E (TRD 81-12). They decide each E run's outcome and are never copied into the
// project a session works on: build.cjs never reads this module, and the proof test scans the built tree for it.
//
//   checkQuick(dir, env)  the /aoforge:quick change: `node src/cli.js list --json` on a seeded notes file prints a JSON
//                         array of exactly the seeded {id, text} objects, and `node --test` passes in dir.
//   checkBuild(dir, env)  the /aoforge:build objective: `tag 1 work` then `list --tag work` on a seeded notes file
//                         prints note 1 and no other note, `node --test` passes, and the objective's VERIFICATION.md,
//                         when one exists, has `status: passed`.
//
// The seeded notes file lives in a fresh temp directory that is also the CLI's cwd and is named by NOTEKIT_FILE, so a
// solution that keeps notes (or a tag sidecar) next to the file or in the cwd is judged the same way, and the work
// dir's own notes.json is never touched. The seeds differ from the project's notes.json (other ids and texts, a gap in
// the ids, quotes and an ampersand) so output copied from the project, or rebuilt ids, cannot pass.
//
// Runtime model: pure node. Every child is `process.execPath` with cwd and env given explicitly (env is the caller's
// object plus NOTEKIT_FILE for the CLI calls; NODE_TEST_CONTEXT is always dropped so a check run from inside a
// `node --test` process still gets the TAP reporter). Nothing here reads the real HOME or the network.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const QUICK_SEED = [
  { id: 1, text: 'Water the ferns' },
  { id: 2, text: 'Email "Dana" about the 3:30 slot' },
  { id: 7, text: 'Pack the tent, stove & mugs' },
];
const BUILD_SEED = [
  { id: 1, text: 'Draft the budget' },
  { id: 2, text: 'Walk the dog' },
  { id: 3, text: 'File the expense report' },
];
const BUILD_TAG = 'work';
const OBJECTIVES_DIR = path.join('.aoforge', 'objectives');
const CLI_TIMEOUT_MS = 30000;
const TEST_TIMEOUT_MS = 300000;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function childEnv(env, extra = {}) {
  const base = isPlainObject(env) ? { ...env } : { PATH: process.env.PATH, LC_ALL: 'C' };
  delete base.NODE_TEST_CONTEXT;
  delete base.NOTEKIT_FILE;
  return { ...base, ...extra };
}

function tmpRoot(env) {
  return isPlainObject(env) && env.TMPDIR ? env.TMPDIR : os.tmpdir();
}

/** A fresh temp dir holding notes.json = seed; returns {dir, file}. */
function seedNotes(env, seed) {
  const dir = fs.mkdtempSync(path.join(tmpRoot(env), 'notekit-check-'));
  const file = path.join(dir, 'notes.json');
  fs.writeFileSync(file, JSON.stringify(seed, null, 2) + '\n');
  return { dir, file };
}

function cli(dir, seeded, env, args) {
  const r = spawnSync(process.execPath, [path.join(dir, 'src', 'cli.js'), ...args], {
    cwd: seeded.dir,
    env: childEnv(env, { NOTEKIT_FILE: seeded.file }),
    encoding: 'utf8',
    timeout: CLI_TIMEOUT_MS,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error ? r.error.message : null };
}

const tail = (s, n = 300) => (s.length > n ? `...${s.slice(-n)}` : s);
const check = (name, pass, detail) => ({ name, pass: !!pass, detail });

/** runTests(dir, env) -> {ok, exit, tests, pass, fail, timed_out}: `node --test --test-reporter=tap` in dir. */
function runTests(dir, env) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], {
    cwd: dir,
    env: childEnv(env),
    encoding: 'utf8',
    timeout: TEST_TIMEOUT_MS,
  });
  const out = r.stdout || '';
  const num = (key) => {
    const m = new RegExp(`^# ${key} (\\d+)$`, 'm').exec(out);
    return m ? Number(m[1]) : null;
  };
  const tests = num('tests');
  const pass = num('pass');
  const fail = num('fail');
  const timedOut = !!(r.error && r.error.code === 'ETIMEDOUT');
  return {
    ok: r.status === 0 && fail === 0 && pass !== null && pass >= 1,
    exit: r.status,
    tests,
    pass,
    fail,
    timed_out: timedOut,
  };
}

/** The objective-1 directories (`.aoforge/objectives/01-*`) of a project, sorted. */
function objectiveOneDirs(dir) {
  const root = path.join(dir, OBJECTIVES_DIR);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^0*1-/.test(e.name))
    .map((e) => path.join(root, e.name))
    .sort();
}

/** `status:` from a markdown file's YAML frontmatter, unquoted; null when there is none. */
function frontmatterStatus(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) return null;
  const m = /^status:\s*["']?([^"'\s#]+)["']?\s*(?:#.*)?$/m.exec(fm[1]);
  return m ? m[1] : null;
}

/**
 * verificationOf(dir) -> {status, file}: the objective-1 VERIFICATION.md (the last by name when there are several)
 * and its frontmatter status; {status: null, file: null} when none exists.
 */
function verificationOf(dir) {
  const files = [];
  for (const d of objectiveOneDirs(dir)) {
    for (const name of fs.readdirSync(d).sort()) if (/VERIFICATION\.md$/.test(name)) files.push(path.join(d, name));
  }
  if (files.length === 0) return { status: null, file: null };
  const file = files[files.length - 1];
  return { status: frontmatterStatus(fs.readFileSync(file, 'utf8')), file: path.relative(dir, file) };
}

/** checkQuick(dir, env) -> {workflow, pass, checks[], tests}. */
function checkQuick(dir, env) {
  const seeded = seedNotes(env, QUICK_SEED);
  const checks = [];
  try {
    const r = cli(dir, seeded, env, ['list', '--json']);
    checks.push(check('list --json exits 0', r.status === 0, r.status === 0 ? null : `exit ${r.status}: ${tail(r.stderr)}`));
    let parsed;
    let parseError = null;
    try {
      parsed = JSON.parse(r.stdout);
    } catch (err) {
      parseError = err.message;
    }
    const exact = Array.isArray(parsed)
      && parsed.length === QUICK_SEED.length
      && parsed.every((o, i) => isPlainObject(o)
        && Object.keys(o).sort().join(',') === 'id,text'
        && o.id === QUICK_SEED[i].id
        && o.text === QUICK_SEED[i].text);
    checks.push(check('list --json prints the notes as a JSON array of {id, text}', exact,
      exact ? null : (parseError ? `not JSON: ${parseError}; stdout ${JSON.stringify(tail(r.stdout))}` : `got ${tail(JSON.stringify(parsed))}`)));
  } finally {
    fs.rmSync(seeded.dir, { recursive: true, force: true });
  }
  const tests = runTests(dir, env);
  checks.push(check('node --test passes', tests.ok, tests.ok ? null : `exit ${tests.exit}, pass ${tests.pass}, fail ${tests.fail}`));
  return { workflow: 'quick', pass: checks.every((c) => c.pass), checks, tests };
}

/** checkBuild(dir, env) -> {workflow, pass, checks[], tests, verification_status, verification_file}. */
function checkBuild(dir, env) {
  const seeded = seedNotes(env, BUILD_SEED);
  const checks = [];
  try {
    const tag = cli(dir, seeded, env, ['tag', '1', BUILD_TAG]);
    checks.push(check(`tag 1 ${BUILD_TAG} exits 0`, tag.status === 0, tag.status === 0 ? null : `exit ${tag.status}: ${tail(tag.stderr)}`));
    const list = cli(dir, seeded, env, ['list', '--tag', BUILD_TAG]);
    checks.push(check(`list --tag ${BUILD_TAG} exits 0`, list.status === 0, list.status === 0 ? null : `exit ${list.status}: ${tail(list.stderr)}`));
    const others = BUILD_SEED.slice(1).filter((n) => list.stdout.includes(n.text)).map((n) => n.id);
    const only = list.stdout.includes(BUILD_SEED[0].text) && others.length === 0;
    checks.push(check(`list --tag ${BUILD_TAG} prints note 1 and no other note`, only,
      only ? null : `stdout ${JSON.stringify(tail(list.stdout))}${others.length ? `; also notes ${others.join(', ')}` : ''}`));
  } finally {
    fs.rmSync(seeded.dir, { recursive: true, force: true });
  }
  const tests = runTests(dir, env);
  checks.push(check('node --test passes', tests.ok, tests.ok ? null : `exit ${tests.exit}, pass ${tests.pass}, fail ${tests.fail}`));
  const v = verificationOf(dir);
  const vOk = v.file === null || v.status === 'passed';
  checks.push(check('VERIFICATION.md, when present, has status: passed', vOk, vOk ? null : `${v.file}: status ${v.status}`));
  return {
    workflow: 'build',
    pass: checks.every((c) => c.pass),
    checks,
    tests,
    verification_status: v.status,
    verification_file: v.file,
  };
}

module.exports = {
  QUICK_SEED,
  BUILD_SEED,
  BUILD_TAG,
  checkQuick,
  checkBuild,
  runTests,
  verificationOf,
  frontmatterStatus,
  objectiveOneDirs,
};
