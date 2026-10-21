'use strict';

// legacy-layout-adopt-path.legacy.test.cjs (objective 80, TRD 80-04, SC-3). Every place AOForge 3.1 reports a
// pre-rename project names `/aoforge:adopt` as the 3.1 path, ahead of AOForge 3.0.x and the manual `git mv`. The
// text has one source (planning-layout.cjs, plus the retired-migration line in upgrade.cjs); this file proves, from
// the outside, that each surface that prints it carries the adopt path.
//
// Test list (outermost first; numbers are the TRD 80-04 test list):
//   1. CLI guard: `aof-tools state load` in a legacy-only project exits 1; stderr holds /aoforge:adopt, the adopt
//      branch, 3.0.x, `git mv` and the guide name; no `.aoforge/` appears.
//   2. validate health --raw: status broken, one W066 whose fix names /aoforge:adopt before 3.0.x (index order).
//   3. SessionStart notice: upgrade-project.js started at the project root queues a global notice that names
//      /aoforge:adopt.
//   4. doctor: `doctor --raw` prints the note naming /aoforge:adopt; check 27 run on the root names /aoforge:adopt,
//      3.0.x and `git mv`.
//   5. W067 (an `.aoforge/` project with the pre-rename stamp key): the fix names /aoforge:adopt, with the key
//      alone and with both keys, through validate health and through the library.
//   6. W069: the project CLAUDE.md fix names /aoforge:adopt (validate health and the library);
//      legacyBlockMessage('~/.claude/CLAUDE.md').fix does not (adopt never touches the global file).
//   7. Retired ids: `upgrade --apply --only 0012|0013|0014` in an `.aoforge/` project: exit 1, one line naming
//      retired, /aoforge:adopt, 3.0.x and the guide.
//   8. Unit: legacyLayoutMessage(root) = problem + '. ' + fix + '.'; the adopt clause precedes the 3.0.x clause; the
//      text equals one built from NAMES/LEGACY, so it spells nothing the name map does not.
//
// Fixtures: legacy-layout-fixtures.planningProject (hand-built trees, fake HOME, hermetic env),
// legacy-doctor-fixtures (the doctor context) and upgrade-fixtures (a stamped `.aoforge/` project).

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY, SHIM_REMOVAL, SHIM_RELEASE } = require('./legacy-names.cjs');
const layout = require('./planning-layout.cjs');
const notices = require('./notices.cjs');
const check27 = require('./doctor-checks/27-legacy-planning-layout.cjs');
const F = require('./__fixtures__/legacy-doctor-fixtures.cjs');
const { planningProject } = require('./__fixtures__/legacy-layout-fixtures.cjs');
const { makeStampedProject, makeFakeHome, gitEnv, snapshot, diffSnapshots } = require('./__fixtures__/upgrade-fixtures.cjs');

const { legacyLayoutMessage, legacyPlanningIssue, legacyConfigKeyIssue, legacyClaudeMdIssue, legacyBlockMessage, MIGRATION_GUIDE } = layout;

const AOF_TOOLS = path.join(__dirname, '..', 'aof-tools.cjs');
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');
const HOOK = path.join(PLUGIN_ROOT, 'hooks', 'upgrade-project.js');
const NEW = NAMES.planningDir;
const OLD = LEGACY.planningDir;
const ADOPT = `${NAMES.commandNs}adopt`;

const created = [];
const track = (dir) => { created.push(dir); return dir; };
after(() => { for (const dir of created) fs.rmSync(dir, { recursive: true, force: true }); });

/** Parse a command's JSON stdout, following an `@file:` redirect for large output. */
function parseJson(stdout) {
  let text = String(stdout || '').trim();
  if (text.startsWith('@file:')) text = fs.readFileSync(text.slice('@file:'.length), 'utf-8');
  return JSON.parse(text);
}

/** Every directory named `.aoforge` under `dir` (`.git` skipped). */
function newDirsUnder(dir) {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === '.git') continue;
      const abs = path.join(d, e.name);
      if (e.name === NEW) found.push(abs);
      walk(abs);
    }
  };
  walk(dir);
  return found;
}

/** Assert that `text` names the adopt path (the slash command and its branch) before the 3.0.x path. */
function assertAdoptFirst(text, what) {
  const adopt = text.indexOf(ADOPT);
  const release = text.indexOf(SHIM_RELEASE);
  assert.ok(adopt >= 0, `${what} lacks ${ADOPT}: ${text}`);
  assert.ok(release >= 0, `${what} lacks ${SHIM_RELEASE}: ${text}`);
  assert.ok(adopt < release, `${what} names ${SHIM_RELEASE} before ${ADOPT}: ${text}`);
}

// ─── 1. the CLI guard ─────────────────────────────────────────────────────────

describe('1. the aof-tools CLI guard names the adopt path', () => {
  test('1. state load in a legacy-only project: exit 1, stderr names adopt, 3.0.x, git mv and the guide', () => {
    const p = planningProject({ layout: 'legacy', git: true });
    try {
      const r = p.run(['state', 'load']);
      assert.equal(r.status, 1, r.out);
      for (const part of [ADOPT, NAMES.adoptBranch, SHIM_RELEASE, `git mv ${OLD} ${NEW}`, MIGRATION_GUIDE]) {
        assert.ok(r.stderr.includes(part), `stderr lacks ${part}:\n${r.out}`);
      }
      assertAdoptFirst(r.stderr, 'stderr');
      assert.deepEqual(newDirsUnder(p.root), [], `no ${NEW}/ appears`);
    } finally {
      p.cleanup();
    }
  });
});

// ─── 2. validate health: W066 ─────────────────────────────────────────────────

describe('2. validate health W066 names the adopt path', () => {
  test('2. status broken, one W066 whose fix names adopt before 3.0.x', () => {
    const p = planningProject({ layout: 'legacy', git: true });
    try {
      const r = p.run(['validate', 'health', '--raw']);
      assert.equal(r.status, 0, r.out);
      const j = parseJson(r.stdout);
      assert.equal(j.status, 'broken');
      const w066 = j.errors.filter((i) => i.code === 'W066');
      assert.equal(w066.length, 1, JSON.stringify(j.errors));
      assertAdoptFirst(w066[0].fix, 'W066 fix');
      for (const part of [NAMES.adoptBranch, `git mv ${OLD} ${NEW}`, MIGRATION_GUIDE]) {
        assert.ok(w066[0].fix.includes(part), `W066 fix lacks ${part}: ${w066[0].fix}`);
      }
    } finally {
      p.cleanup();
    }
  });
});

// ─── 3. the SessionStart notice ───────────────────────────────────────────────

describe('3. the upgrade-project SessionStart notice names the adopt path', () => {
  test('3. the queued global notice names adopt before 3.0.x', () => {
    const p = planningProject({ layout: 'legacy', git: true });
    try {
      const env = {
        ...p.env,
        CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
        [`${NAMES.envPrefix}SKIP_PRUNE`]: '1',
        [`${NAMES.envPrefix}SKIP_TRANSCRIPT_EXPORT`]: '1',
      };
      const r = spawnSync(process.execPath, [HOOK], { cwd: p.root, env, encoding: 'utf-8', input: '{}', timeout: 60000 });
      assert.equal(r.status, 0, `hook must exit 0 (stderr: ${r.stderr})`);
      const key = `legacy-layout:${fs.realpathSync(p.root)}`;
      const queued = notices.readNotices(notices.globalNoticesPath(p.home)).filter((n) => n.key === key);
      assert.equal(queued.length, 1, JSON.stringify(queued));
      assertAdoptFirst(queued[0].message, 'notice');
      assert.ok(queued[0].message.includes(NAMES.adoptBranch), queued[0].message);
      assert.deepEqual(newDirsUnder(p.root), [], `no ${NEW}/ appears`);
    } finally {
      p.cleanup();
    }
  });
});

// ─── 4. doctor ────────────────────────────────────────────────────────────────

describe('4. doctor names the adopt path', () => {
  test('4. doctor --raw: the note carries the adopt path, ahead of 3.0.x', () => {
    const p = planningProject({ layout: 'legacy', git: true });
    try {
      const r = p.run(['doctor', '--raw']);
      assert.equal(r.status, 0, r.out);
      assert.ok(r.stdout.includes(ADOPT), r.out);
      assertAdoptFirst(r.stdout, 'doctor output');
    } finally {
      p.cleanup();
    }
  });

  test('4. check 27 on a legacy-only root: the finding names adopt, 3.0.x and git mv', () => {
    const p = F.leftoverProject({ layout: 'legacy', configKey: 'legacy' });
    try {
      const r = check27.run(F.doctorCtx({ home: p.home, env: p.env, projectRoot: p.root }));
      assert.equal(r.severity, 'warn', r.finding);
      assert.ok(r.finding.includes(ADOPT), r.finding);
      assert.ok(r.finding.includes(SHIM_RELEASE), r.finding);
      assert.ok(r.finding.includes(`git mv ${OLD} ${NEW}`), r.finding);
      assertAdoptFirst(r.finding, 'check 27 finding');
    } finally {
      p.cleanup();
    }
  });
});

// ─── 5. W067 ──────────────────────────────────────────────────────────────────

describe('5. W067 names the adopt path', () => {
  for (const configKey of ['legacy', 'both']) {
    test(`5. config key "${configKey}": the library fix and validate health's fix name adopt`, () => {
      const p = planningProject({ layout: 'aoforge', configKey, git: false });
      try {
        const issue = legacyConfigKeyIssue(p.root);
        assert.ok(issue, 'W067 is reported');
        assert.ok(issue.fix.includes(ADOPT), issue.fix);
        const r = p.run(['validate', 'health', '--raw']);
        const j = parseJson(r.stdout);
        const w067 = [...j.errors, ...j.warnings].filter((i) => i.code === 'W067');
        assert.equal(w067.length, 1, r.out);
        assert.ok(w067[0].fix.includes(ADOPT), w067[0].fix);
      } finally {
        p.cleanup();
      }
    });
  }

  test('5. the old behaviour stays: the key alone still names the rename and 3.0.x, both keys the deletion', () => {
    const alone = planningProject({ layout: 'aoforge', configKey: 'legacy', git: false });
    const both = planningProject({ layout: 'aoforge', configKey: 'both', git: false });
    try {
      const a = legacyConfigKeyIssue(alone.root);
      assert.ok(a.fix.includes(`rename the key to "${NAMES.configKey}"`) && a.fix.includes(SHIM_RELEASE), a.fix);
      const b = legacyConfigKeyIssue(both.root);
      assert.ok(b.fix.includes('delete the pre-rename key'), b.fix);
    } finally {
      alone.cleanup();
      both.cleanup();
    }
  });
});

// ─── 6. W069 ──────────────────────────────────────────────────────────────────

describe('6. W069 names the adopt path in a project and not in the global file', () => {
  test('6. the project CLAUDE.md fix names adopt (library and validate health)', () => {
    const p = planningProject({ layout: 'aoforge', claudeMd: 'legacy-block', git: false });
    try {
      const issue = legacyClaudeMdIssue(p.root);
      assert.ok(issue, 'W069 is reported');
      assert.ok(issue.fix.includes(ADOPT), issue.fix);
      assert.ok(issue.fix.includes(SHIM_RELEASE), 'the 3.0.x path stays');
      const r = p.run(['validate', 'health', '--raw']);
      const j = parseJson(r.stdout);
      const w069 = [...j.errors, ...j.warnings].filter((i) => i.code === 'W069');
      assert.equal(w069.length, 1, r.out);
      assert.ok(w069[0].fix.includes(ADOPT), w069[0].fix);
    } finally {
      p.cleanup();
    }
  });

  test('6. legacyBlockMessage: the project label names adopt, the global label does not', () => {
    assert.ok(legacyBlockMessage('CLAUDE.md').fix.includes(ADOPT));
    const global = legacyBlockMessage('~/.claude/CLAUDE.md');
    assert.equal(global.fix.includes(ADOPT), false, global.fix);
    assert.equal(global.message.includes(ADOPT), false, global.message);
    assert.ok(global.fix.includes(SHIM_RELEASE), 'the 3.0.x path stays');
  });
});

// ─── 7. retired migration ids ─────────────────────────────────────────────────

describe('7. upgrade --only <retired id> names the adopt path', () => {
  for (const id of ['0012', '0013', '0014']) {
    test(`7. --apply --only ${id}: exit 1, one line naming retired, adopt, 3.0.x and the guide; nothing written`, () => {
      const root = track(makeStampedProject('3.0.0', { migrations_applied: ['0001'] }));
      const home = track(makeFakeHome());
      const before = snapshot(root);
      const env = gitEnv(home);
      for (const key of Object.keys(env)) {
        if (key.startsWith(NAMES.envPrefix) || key.startsWith(LEGACY.envPrefix)) delete env[key];
      }
      const r = spawnSync(process.execPath, [AOF_TOOLS, '--cwd', root, 'upgrade', '--apply', '--only', id, '--raw'], {
        cwd: home, env, encoding: 'utf-8', timeout: 60000,
      });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      assert.equal(r.status, 1, out);
      const lines = String(r.stdout).trim().split('\n');
      assert.equal(lines.length, 1, out);
      for (const part of ['retired', ADOPT, SHIM_RELEASE, MIGRATION_GUIDE]) {
        assert.ok(lines[0].includes(part), `${part}: ${out}`);
      }
      // "retired after AOForge 3.0.x" opens the line, so the order that matters is adopt, then running it with 3.0.x.
      const runWith = lines[0].indexOf(`run it with ${NAMES.product} ${SHIM_RELEASE}`);
      assert.ok(runWith > lines[0].indexOf(ADOPT) && lines[0].indexOf(ADOPT) >= 0, lines[0]);
      assert.deepEqual(diffSnapshots(before, snapshot(root)), []);
    });
  }
});

// ─── 8. the text itself ───────────────────────────────────────────────────────

describe('8. legacyLayoutMessage', () => {
  test('8. is problem + ". " + fix + "." and equals the text built from NAMES and LEGACY', () => {
    const root = '/work/proj';
    const problem = `${root} still uses the pre-rename planning directory ${OLD}/, which ${NAMES.product} no longer reads`;
    const fix = `Run \`${ADOPT}\` there (${NAMES.product} ${SHIM_REMOVAL} moves it to ${NEW}/ as one recorded change on `
      + `${NAMES.adoptBranch}), or move it with ${NAMES.product} ${SHIM_RELEASE} (\`${NAMES.cli} upgrade --apply\`) or by hand: `
      + `\`git mv ${OLD} ${NEW}\`, then rename a "${LEGACY.configKey}" key in ${NEW}/config.json to "${NAMES.configKey}" `
      + `(see ${MIGRATION_GUIDE}, "Upgrading from 2.x")`;
    assert.equal(legacyLayoutMessage(root), `${problem}. ${fix}.`);
  });

  test('8. the adopt clause precedes the 3.0.x clause, which precedes the manual step', () => {
    const text = legacyLayoutMessage('/work/proj');
    const adopt = text.indexOf(ADOPT);
    const release = text.indexOf(SHIM_RELEASE);
    const manual = text.indexOf('git mv');
    assert.ok(adopt >= 0 && adopt < release && release < manual, `${adopt} < ${release} < ${manual}: ${text}`);
  });

  test('8. W066 (legacy) message + fix are the same text split in two', () => {
    const p = planningProject({ layout: 'legacy', git: false });
    try {
      const issue = legacyPlanningIssue(p.root);
      assert.equal(`${legacyLayoutMessage(p.root)}`.endsWith(`${issue.fix}.`), true);
      assertAdoptFirst(issue.fix, 'W066 fix');
    } finally {
      p.cleanup();
    }
  });
});
