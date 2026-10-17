'use strict';
// Tests for scripts/eval81/batches/E.cjs (TRD 81-12, test list 4-5). runs() is checked against the gotchas of the
// TRD; materialize and collect run on projects built into an mkdtemp dir, with the hand-written reference solutions
// standing in for a session's work. No network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { validateDescriptor } = require('../lib/contract.cjs');
const { capForWorkflow } = require('../lib/caps.cjs');
const { makeCalibration } = require('../__fixtures__/calibration.cjs');
const { buildFixture, QUICK_TEXT } = require('../fixtures/E/build.cjs');
const { applyQuick, applyBuild } = require('../fixtures/E/reference.cjs');

const load = () => require('./E.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-batchE-'));

const ORDER = ['q31-r1', 'q30-r1', 'b31-r1', 'b30-r1', 'q30-r2', 'q31-r2', 'q31-r3', 'q30-r3', 'b30-r2', 'b31-r2'];
const ENV = {
  AOFORGE_SKIP_AWARENESS_POPULATE: '1',
  AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
  AOFORGE_SKIP_PRUNE: '1',
};
const NO_MODEL_ENV = {}; // runs() reads the session-model switch from this object, not the test's own environment

describe('runs', () => {
  test('4. ten valid descriptors in the pilot-first order with the fixed workload, caps, timeouts and roles', () => {
    const E = load();
    const list = E.runs({ root: tmp(), trees: null, calibration: null, env: NO_MODEL_ENV });
    assert.equal(E.batch, 'E');
    assert.deepEqual(list.map((d) => d.id), ORDER);
    const quickCap = capForWorkflow('quick');
    const buildCap = capForWorkflow('build');
    list.forEach((d, i) => {
      const v = validateDescriptor(d);
      assert.ok(v.ok, `${d.id}: ${v.errors.join('; ')}`);
      const quick = d.id.startsWith('q');
      assert.equal(d.batch, 'E');
      assert.equal(d.kind, 'workflow');
      assert.equal(d.agent, null);
      assert.equal(d.model, 'opus');
      assert.equal(d.plugin, d.id.slice(1, 3) === '31' ? '3.1.0' : '3.0.0');
      assert.equal(d.prompt, quick ? `/aoforge:quick ${QUICK_TEXT}` : '/aoforge:build 1 --skip-research --auto');
      assert.equal(d.tools, null);
      assert.equal(d.jsonSchema, null);
      assert.deepEqual(d.env, ENV);
      assert.equal(d.capUsd, quick ? quickCap.cap : buildCap.cap);
      assert.equal(d.capBasis, quick ? quickCap.basis : buildCap.basis);
      assert.equal(d.timeoutMs, quick ? 30 * 60 * 1000 : 90 * 60 * 1000);
      assert.equal(d.role, quick ? 'workflow:quick' : 'workflow:build');
      assert.equal(d.order, i);
      assert.equal(d.fixture.workflow, quick ? 'quick' : 'build');
      assert.equal(d.fixture.version, d.plugin);
      assert.equal(d.fixture.rep, Number(d.id.slice(-1)));
      assert.equal(d.fixture.session_model, 'opus');
      assert.equal(d.fixture.profile, 'balanced');
      assert.equal(d.fixture.project, 'notekit');
    });
    assert.equal(new Set(list.map((d) => d.id)).size, 10);
    // With today's fallback p90s both workflows clamp to their ceilings (81-01): quick 6, build 15.
    assert.equal(quickCap.cap, 6);
    assert.equal(buildCap.cap, 15);
  });

  test('4. the pilot pairs come first and each workflow is ABBA-balanced by version', () => {
    const E = load();
    const list = E.runs({ root: tmp(), trees: null, calibration: null, env: NO_MODEL_ENV });
    assert.deepEqual(list.slice(0, 4).map((d) => [d.fixture.workflow, d.plugin]),
      [['quick', '3.1.0'], ['quick', '3.0.0'], ['build', '3.1.0'], ['build', '3.0.0']]);
    const versions = (wf) => list.filter((d) => d.fixture.workflow === wf).map((d) => d.plugin);
    assert.deepEqual(versions('quick'), ['3.1.0', '3.0.0', '3.0.0', '3.1.0', '3.1.0', '3.0.0']);
    assert.deepEqual(versions('build'), ['3.1.0', '3.0.0', '3.0.0', '3.1.0']);
    for (const v of ['3.0.0', '3.1.0']) {
      assert.equal(list.filter((d) => d.plugin === v && d.fixture.workflow === 'quick').length, 3);
      assert.equal(list.filter((d) => d.plugin === v && d.fixture.workflow === 'build').length, 2);
    }
    assert.deepEqual(list.filter((d) => d.fixture.pilot).map((d) => d.id), ['q31-r1', 'q30-r1', 'b31-r1', 'b30-r1']);
    // Versions differ in the plugin tree only (the id, order and pilot flag are bookkeeping, not session input).
    const strip = (d) => ({ ...d, id: null, order: null, plugin: null, fixture: { ...d.fixture, version: null, rep: null, pilot: null } });
    for (const wf of ['quick', 'build']) {
      const same = list.filter((d) => d.fixture.workflow === wf).map(strip);
      for (const d of same) assert.deepEqual(d, same[0]);
    }
  });

  test('4. a calibration object sizes the caps through capForWorkflow', () => {
    const E = load();
    const cal = makeCalibration({ agentOverhead: { planner: 0.4, 'job-checker': 0.3, verifier: 0.3 }, trdLevelP90: 0.5 });
    const list = E.runs({ root: tmp(), trees: null, calibration: cal, env: NO_MODEL_ENV });
    const quick = capForWorkflow({ workflow: 'quick', calibration: cal });
    const build = capForWorkflow({ workflow: 'build', calibration: cal });
    assert.ok(quick.cap < 6 && build.cap < 15, 'small p90s stay under the ceilings');
    for (const d of list) {
      const want = d.fixture.workflow === 'quick' ? quick : build;
      assert.equal(d.capUsd, want.cap);
      assert.equal(d.capBasis, want.basis);
    }
  });

  test('4. EVAL81_E_SESSION_MODEL switches every run to sonnet; anything but sonnet or opus throws', () => {
    const E = load();
    assert.equal(E.SESSION_MODEL, 'opus');
    const sonnet = E.runs({ root: tmp(), trees: null, calibration: null, env: { EVAL81_E_SESSION_MODEL: 'sonnet' } });
    assert.deepEqual([...new Set(sonnet.map((d) => d.model))], ['sonnet']);
    assert.deepEqual([...new Set(sonnet.map((d) => d.fixture.session_model))], ['sonnet']);
    const opus = E.runs({ root: tmp(), trees: null, calibration: null, env: { EVAL81_E_SESSION_MODEL: 'opus' } });
    assert.deepEqual([...new Set(opus.map((d) => d.model))], ['opus']);
    for (const bad of ['haiku', 'Sonnet', 'gpt-5', ' ']) {
      assert.throws(() => E.runs({ root: tmp(), trees: null, calibration: null, env: { EVAL81_E_SESSION_MODEL: bad } }),
        /EVAL81_E_SESSION_MODEL must be sonnet or opus/);
    }
    assert.equal(E.sessionModel({}), 'opus');
    assert.equal(E.sessionModel({ EVAL81_E_SESSION_MODEL: '' }), 'opus');
  });
});

describe('materialize and collect', () => {
  function workDirs() {
    const run = tmp();
    const work = path.join(run, 'work');
    const home = path.join(run, 'home');
    fs.mkdirSync(home);
    return { run, work, home };
  }
  const descFor = (id) => load().runs({ root: tmp(), trees: null, calibration: null, env: NO_MODEL_ENV }).find((d) => d.id === id);
  const gitEnv = (home) => ({ PATH: process.env.PATH, HOME: home, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@example.invalid', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@example.invalid' });

  test('5. materialize builds the same project the builder does', () => {
    const E = load();
    const { work, home } = workDirs();
    E.materialize(descFor('q31-r1'), work, { root: tmp(), trees: null, home });
    const direct = path.join(tmp(), 'direct');
    const head = buildFixture(direct).head;
    const r = spawnSync('git', ['--no-optional-locks', '-C', work, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    assert.equal(r.stdout.trim(), head);
  });

  test('5. collect runs the hidden quick check in the work dir with HOME = the sandbox home', () => {
    const E = load();
    const { work, home } = workDirs();
    const desc = descFor('q31-r1');
    E.materialize(desc, work, { root: tmp(), trees: null, home });
    applyQuick(work);
    // A project test that passes only when the checks run with HOME = the run's sandbox home.
    fs.writeFileSync(path.join(work, 'test', 'home.test.js'),
      `'use strict';\nconst { test } = require('node:test');\nconst assert = require('node:assert/strict');\n`
      + `test('home', () => { assert.equal(process.env.HOME, ${JSON.stringify(home)}); });\n`);
    fs.mkdirSync(path.join(work, '.aoforge', 'quick', '1-json-flag'), { recursive: true });
    fs.writeFileSync(path.join(work, '.aoforge', 'quick', '1-json-flag', '1-JOB.md'), '# job\n');
    fs.writeFileSync(path.join(work, '.aoforge', 'quick', '1-json-flag', '1-SUMMARY.md'), '# summary\n');
    const out = E.collect(desc, work, { root: tmp(), home, record: { id: 'q31-r1', status: 'ok' } });
    assert.deepEqual(Object.keys(out).sort(), ['acceptance', 'git_log_subjects', 'summaries', 'tests', 'trd_count', 'verification_status']);
    assert.equal(out.acceptance.pass, true, JSON.stringify(out.acceptance));
    assert.equal(out.tests.ok, true);
    assert.equal(out.tests.pass, 9, 'six base tests, two from the solution and the HOME test');
    assert.equal(out.trd_count, 1);
    assert.equal(out.summaries, 1);
    assert.equal(out.verification_status, null);
    assert.deepEqual(out.git_log_subjects, [
      'chore: scaffold notekit with add and list',
      'test: cover the store and the add and list commands',
      'docs: plan the tags milestone',
    ]);
    // Another HOME makes the project's HOME test fail: the env really is the one collect was given.
    const other = path.join(tmp(), 'elsewhere');
    fs.mkdirSync(other);
    assert.equal(E.collect(desc, work, { root: tmp(), home: other, record: null }).tests.ok, false);
  });

  test('5. collect on a build counts TRDs and SUMMARYs, reads the verification status and every commit subject', () => {
    const E = load();
    const { work, home } = workDirs();
    const desc = descFor('b31-r1');
    E.materialize(desc, work, { root: tmp(), trees: null, home });
    applyBuild(work);
    const obj = path.join(work, '.aoforge', 'objectives', '01-tags');
    for (const f of ['01-01-tag-command-TRD.md', '01-02-list-by-tag-TRD.md', '01-01-SUMMARY.md', '01-02-SUMMARY.md']) {
      fs.writeFileSync(path.join(obj, f), `# ${f}\n`);
    }
    fs.writeFileSync(path.join(obj, '01-VERIFICATION.md'), '---\nobjective: 01-tags\nstatus: passed\n---\n');
    const env = gitEnv(home);
    for (const args of [['add', '-A'], ['commit', '-q', '--no-verify', '-m', 'chore(aoforge): upgrade project to v3.1.0']]) {
      const r = spawnSync('git', ['-C', work, ...args], { encoding: 'utf8', env });
      assert.equal(r.status, 0, r.stderr);
    }
    const out = E.collect(desc, work, { root: tmp(), home, record: null });
    assert.equal(out.acceptance.pass, true, JSON.stringify(out.acceptance));
    assert.equal(out.tests.ok, true);
    assert.equal(out.trd_count, 2);
    assert.equal(out.summaries, 2);
    assert.equal(out.verification_status, 'passed');
    assert.equal(out.git_log_subjects.length, 4);
    assert.equal(out.git_log_subjects[3], 'chore(aoforge): upgrade project to v3.1.0');
  });

  test('5. collect never throws on a broken work dir: the checks fail and the counts are what is there', () => {
    const E = load();
    const { work, home } = workDirs();
    const desc = descFor('b30-r1');
    E.materialize(desc, work, { root: tmp(), trees: null, home });
    fs.rmSync(path.join(work, 'src', 'cli.js'));
    const out = E.collect(desc, work, { root: tmp(), home, record: null });
    assert.equal(out.acceptance.pass, false);
    assert.equal(out.trd_count, 0);
    assert.equal(out.summaries, 0);
    assert.equal(out.verification_status, null);
    const gone = path.join(tmp(), 'never-built');
    const none = E.collect(desc, gone, { root: tmp(), home, record: null });
    assert.equal(none.acceptance.pass, false);
    assert.equal(none.git_log_subjects, null);
  });
});
