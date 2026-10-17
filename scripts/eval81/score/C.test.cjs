'use strict';

// Tests for the test C scorer (TRD 81-11, test list 7-10): the join of each agent run with its blind grader run,
// the mechanical check of back-ticked repository paths, the per-role / per-model aggregation in the batch result
// shape of 81-02, and the seeded spot-check sample.
//
// All inputs are hand-written (fixtures/c-outputs.cjs): run directories are written the way the runner leaves them,
// the fleet is a made-up temp repository with made-up checklist items. Nothing reads a home directory or the real
// fleet. Run with a glob on Node 24:  node --test 'scripts/eval81/score/C.test.cjs'

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const S = require('./C.cjs');
const C = require('../batches/C.cjs');
const fx = require('../__fixtures__/c-outputs.cjs');
const metrics = require('../__fixtures__/metrics.cjs');
const synthetic = require('../fixtures/C/synthetic.cjs');
const { decide } = require('../lib/decide.cjs');
const { renderBatchTable } = require('../lib/report.cjs');
const { newLedger } = require('../lib/ledger.cjs');
const scoreCli = require('../score.cjs');
const { LEGACY } = require('../../../plugins/aoforge/aoforge/bin/lib/legacy-names.cjs');

const tempDirs = [];
function tempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(d);
  return d;
}
after(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});

const PLAN = C.plan({ includeFleet: true });
const entryOf = (role, codebase, model, repeat) => PLAN.find((e) => e.role === role
  && (codebase === null || e.codebase === codebase) && e.model === model && e.repeat === repeat);

/** A cRoot plan entry for an agent run of plan entry `e`. */
function agent(e, docs, over = {}) {
  const base = { id: e.id, kind: e.kind, model: e.model, codebase: e.codebase, docs };
  if (e.kind === 'mapper') base.focus = e.focus;
  else base.dimension = e.dimension;
  return { ...base, ...over };
}
/** A cRoot plan entry for the grader run of plan entry `e`. */
function grader(e, graded, over = {}) {
  return { id: `C-grade-${e.id}`, kind: 'grader', model: 'sonnet', graded, cost_usd: 0.1, ...over };
}
/** Every checklist item of a synthetic or researcher role, one verdict each. */
function gradeAll(e, verdict, extra = {}) {
  const items = e.kind === 'researcher' ? C.RESEARCHER_CHECKLISTS.checklists[e.dimension] : C.SYNTHETIC_CHECKLISTS.checklists[e.focus];
  return { items: items.map((i) => ({ id: i.id, verdict, evidence: '' })), fabrications: [], ...extra };
}

const TECH_DOCS = { 'STACK.md': fx.SYNTHETIC_STACK, 'INTEGRATIONS.md': fx.SYNTHETIC_INTEGRATIONS };

function setup() {
  const base = tempDir('c-score-');
  const fleet = fx.fakeFleet(path.join(base, 'fleet'));
  const root = path.join(base, 'R');
  const outDir = path.join(base, 'out');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const opts = { root, outDir, repo: REPO, privateFile: fleet.privateFile, commitmentFile: fleet.commitmentFile };
  return { base, fleet, root, outDir, opts, score: (over = {}) => S.score({ ...opts, ...over }) };
}

describe('score C: one run', () => {
  test('7. 7 found, 2 wrong, 1 missing of 10 items and 1 fabrication -> recall 0.7, error 0.2, fabrications 1', () => {
    const s = setup();
    const e = entryOf('project-researcher:stack', null, 'haiku', 1);
    fx.cRoot(s.root, [
      agent(e, { 'STACK.md': fx.RESEARCH_STACK }, { location: 'published' }),
      grader(e, fx.RESEARCH_STACK_GRADE),
    ]);
    const result = s.score();
    const haiku = result.roles['project-researcher:stack'].models.haiku;
    assert.equal(haiku.n_scored, 1);
    assert.equal(haiku.planned, 2);
    assert.deepEqual(haiku.metrics.recall, { k: 7, n: 10 });
    assert.deepEqual(haiku.metrics.error, { k: 2, n: 10 });
    assert.deepEqual(haiku.metrics.missing, { k: 1, n: 10 });
    assert.deepEqual(haiku.metrics.fabrications, { total: 1, runs: 1 });
    assert.equal(haiku.metrics.recall.k / haiku.metrics.recall.n, 0.7);
    assert.equal(haiku.metrics.error.k / haiku.metrics.error.n, 0.2);
    assert.equal(result.roles['project-researcher:stack'].primary, 'recall');
    // The run is listed with its counts only.
    const run = result.runs.find((r) => r.id === e.id);
    assert.deepEqual(
      { found: run.found, wrong: run.wrong, missing: run.missing, items: run.items, grader_fabrications: run.grader_fabrications, path_fabrications: run.path_fabrications, contaminated: run.contaminated },
      { found: 7, wrong: 2, missing: 1, items: 10, grader_fabrications: 1, path_fabrications: 0, contaminated: false },
    );
    assert.equal(run.outcome, 'found 7, wrong 2, missing 1 of 10');
    assert.equal(result.batch, 'C');
    assert.deepEqual(result.planned, { haiku: 24, sonnet: 24 });
  });

  test('7b. a mapper run adds its mechanical path fabrication to the grader count', () => {
    const s = setup();
    const e = entryOf('codebase-mapper:tech', 'synthetic', 'haiku', 1);
    fx.cRoot(s.root, [agent(e, TECH_DOCS), grader(e, fx.SYNTHETIC_TECH_GRADE)]);
    const haiku = s.score().roles['codebase-mapper:tech'].models.haiku;
    assert.deepEqual(haiku.metrics.recall, { k: 8, n: 11 });
    assert.deepEqual(haiku.metrics.error, { k: 1, n: 11 });
    assert.deepEqual(haiku.metrics.missing, { k: 2, n: 11 });
    assert.deepEqual(haiku.metrics.fabrications, { total: 2, runs: 1 });
    assert.equal(haiku.planned, 4);
  });
});

describe('score C: the mechanical path check', () => {
  const index = S.indexFromFiles(Object.keys(synthetic.syntheticFiles()));

  test('8. a back-ticked path missing from the build is a fabrication; go.mod and plain words are not', () => {
    const doc = 'The `go.mod` file and the words store and check are fine, but `internal/missing/x.go` is invented.';
    assert.deepEqual(S.pathFabrications(doc, index), ['internal/missing/x.go']);
    assert.deepEqual(S.pathFabrications(fx.SYNTHETIC_INTEGRATIONS, index), ['internal/missing/x.go']);
    assert.deepEqual(S.pathFabrications(fx.SYNTHETIC_STACK, index), []);
  });

  test('8b. what the check ignores', () => {
    const ignored = [
      '`example.com/linkcheck/internal/api`', '`net/http`', '`log/slog`', '`encoding/json`', '`os/signal`',
      '`GET /checks/{id}`', '`/var/lib/linkcheck`', '`/healthz`', '`go vet ./...`', '`https://example.com/x.go`',
      '`internal/*/x.go`', '`internal/<pkg>/x.go`', '`./...`', '`I/O`', '`CI/CD`', '`GET/POST`', '`24/7`',
      '`application/json`', '`LINKCHECK_ADDR`', '`http.Get`', '`check.Run`', '`-debug`', '`~/.config/x.json`', '`$HOME/x.go`',
      '`golang.org/x/net/context`', '`github.com/fsnotify/fsnotify`', '`internal/check/check.go()`',
      '```\ninternal/ghost/g.go in a fence `internal/ghost/g.go`\n```',
    ].join('\n');
    assert.deepEqual(S.pathFabrications(ignored, index), []);
  });

  test('8c. what the check accepts as existing', () => {
    const existing = [
      '`cmd/linkcheck/main.go:42`', '`cmd/linkcheck/main.go#L10-L20`', '`main.go`', '`linkcheck/main.go`', '`./Makefile`',
      '`internal/check/`', '`internal/check`', '`internal`', '`.github/workflows/ci.yml`', '`ci.yml`', '`Dockerfile`',
      '`.gitignore`', '`.git`', '`.aoforge/config.json`', '`check/worker.go,`',
    ].join('\n');
    assert.deepEqual(S.pathFabrications(existing, index), []);
  });

  test('8d. what the check flags, once each', () => {
    const flagged = '`internal/ghost/g.go`, `docs/missing.md`, `go.sum`, `config.yaml`, `internal/missing`, `internal/ghost/g.go` again, `cmd/linkcheck/other.go:7`';
    assert.deepEqual(S.pathFabrications(flagged, index).sort(), [
      'cmd/linkcheck/other.go', 'config.yaml', 'docs/missing.md', 'go.sum', 'internal/ghost/g.go', 'internal/missing',
    ]);
  });

  // 81-DECISION-RULE.md post-hoc 2 (2026-10-17): "the mapper fabrication check exempts negated claims (e.g. 'there
  // is no go.sum')". A back-ticked path the document only names to say it is absent is not a fabrication.
  test('8g. a path the document says is absent is exempt (negated claim)', () => {
    const negated = [
      'There is no `go.sum` because the module has no dependencies.',
      '`config.yaml` does not exist; settings come from the environment.',
      'No `docs/missing.md` or `internal/ghost/g.go` is checked in.',
      'The repo has no lock file (`yarn.lock`).',
      'Missing: `CHANGELOG.md`',
      'It ships without a `Jenkinsfile`.',
      '`internal/nope` is absent.',
      '`deploy/k8s.yaml` (missing)',
      '`build/out.txt` is not checked in.',
      '`tools/gen.go` doesn\'t exist yet.',
    ].join('\n');
    assert.deepEqual(S.pathFabrications(negated, index), []);
    const check = S.pathCheck(negated, index);
    assert.deepEqual(check.flagged, []);
    assert.deepEqual(check.exempt.map((e) => e.path).sort(), [
      'CHANGELOG.md', 'Jenkinsfile', 'build/out.txt', 'config.yaml', 'deploy/k8s.yaml', 'docs/missing.md', 'go.sum',
      'internal/ghost/g.go', 'internal/nope', 'tools/gen.go', 'yarn.lock',
    ]);
  });

  test('8h. a negation about something else, or a path asserted elsewhere, is still a fabrication', () => {
    const asserted = [
      'No changes to `internal/ghost/g.go` were needed.',
      '`internal/nope/x.go` is not tested.',
      'It never calls `pkg/ghost.go` directly.',
      'Both `docs/missing.md` and `go.sum` are listed.',
    ].join('\n');
    assert.deepEqual(S.pathFabrications(asserted, index).sort(), ['docs/missing.md', 'go.sum', 'internal/ghost/g.go', 'internal/nope/x.go', 'pkg/ghost.go']);
    const mixed = 'There is no `config.yaml` at the root.\nThe loader reads `config.yaml` on start.';
    assert.deepEqual(S.pathFabrications(mixed, index), ['config.yaml']);
    assert.deepEqual(S.pathCheck(mixed, index).exempt, []);
  });

  test('8e. a stdlib-looking first segment is a path when the codebase has that directory', () => {
    const withNet = S.indexFromFiles(['net/server.go', 'main.go']);
    assert.deepEqual(S.pathFabrications('`net/http`', withNet), ['net/http']);
    assert.deepEqual(S.pathFabrications('`net/http`', index), []);
  });

  test('8f. a fleet run is checked against the prepared tree, so its own paths count as existing', () => {
    const s = setup();
    C.makeBatch({ repo: REPO, privateFile: s.fleet.privateFile, commitmentFile: s.fleet.commitmentFile }).prepareFleet(s.root, JSON.parse(fs.readFileSync(s.fleet.privateFile, 'utf8')));
    const e = entryOf('codebase-mapper:arch', 'fleet', 'haiku', 1);
    const doc = `${fx.fakeFleetDocument('arch')}\nEntry \`main.go\`, store \`internal/store/store.go\`, planning \`${LEGACY.planningDir}/NOTES.md\`, bogus \`internal/nope/x.go\`.\n`;
    fx.cRoot(s.root, [agent(e, { 'ARCHITECTURE.md': doc }), grader(e, fx.fakeFleetGrade('arch', ['found', 'found', 'found']))]);
    const run = s.score().runs.find((r) => r.id === e.id);
    // The stripped planning directory does not exist in the prepared tree, so it counts with the invented path.
    assert.equal(run.path_fabrications, 2);
  });
});

describe('score C: aggregation', () => {
  /** The tech role: haiku 3 scored of 4 planned, sonnet 1 scored. */
  function techRoot() {
    const s = setup();
    C.makeBatch({ repo: REPO, privateFile: s.fleet.privateFile, commitmentFile: s.fleet.commitmentFile }).prepareFleet(s.root, JSON.parse(fs.readFileSync(s.fleet.privateFile, 'utf8')));
    const h1 = entryOf('codebase-mapper:tech', 'synthetic', 'haiku', 1);
    const h2 = entryOf('codebase-mapper:tech', 'synthetic', 'haiku', 2);
    const f1 = entryOf('codebase-mapper:tech', 'fleet', 'haiku', 1);
    const f2 = entryOf('codebase-mapper:tech', 'fleet', 'haiku', 2);
    const s1 = entryOf('codebase-mapper:tech', 'synthetic', 'sonnet', 1);
    fx.cRoot(s.root, [
      agent(h1, TECH_DOCS), grader(h1, fx.SYNTHETIC_TECH_GRADE),
      agent(h2, { 'STACK.md': '# Stack\n\nA Go project.\n' }), grader(h2, gradeAll(h2, 'missing')),
      agent(f1, { 'STACK.md': fx.fakeFleetDocument('tech') }), grader(f1, fx.fakeFleetGrade('tech', ['found', 'found', 'wrong'])),
      agent(f2, { 'STACK.md': fx.fakeFleetDocument('tech') }),
      agent(s1, TECH_DOCS), grader(s1, fx.SYNTHETIC_TECH_GRADE),
    ]);
    return { s, ids: { h1, h2, f1, f2, s1 } };
  }

  test('9. per role and model: k/n of items, per-codebase split, fabrications per run, ungraded runs excluded', () => {
    const { s, ids } = techRoot();
    const result = s.score();
    const tech = result.roles['codebase-mapper:tech'];
    const haiku = tech.models.haiku;
    assert.equal(haiku.n_scored, 3);
    assert.equal(haiku.planned, 4);
    assert.deepEqual(haiku.metrics.recall, { k: 10, n: 25 });
    assert.deepEqual(haiku.metrics.error, { k: 2, n: 25 });
    assert.deepEqual(haiku.metrics.missing, { k: 13, n: 25 });
    assert.deepEqual(haiku.metrics.fabrications, { total: 2, runs: 3 });
    assert.deepEqual(haiku.metrics.recall_by_codebase, { synthetic: { k: 8, n: 22 }, fleet: { k: 2, n: 3 } });
    assert.deepEqual(haiku.metrics.fabrications_by_codebase, { synthetic: { total: 2, runs: 2 }, fleet: { total: 0, runs: 1 } });
    assert.equal(haiku.cost_usd, 1.2);
    assert.equal(haiku.grader_cost_usd, 0.3);
    assert.equal(haiku.mean_wall_ms, 60000);

    const sonnet = tech.models.sonnet;
    assert.equal(sonnet.n_scored, 1);
    assert.equal(sonnet.planned, 4);
    assert.deepEqual(sonnet.metrics.recall, { k: 8, n: 11 });

    // The fleet run whose grader never ran is excluded with its reason; the runs that never happened too.
    const ungraded = result.excluded.find((x) => x.id === ids.f2.id);
    assert.match(ungraded.reason, /ungraded: the grader run has not been done/);
    assert.equal(ungraded.model, 'haiku');
    assert.equal(ungraded.role, 'codebase-mapper:tech');
    assert.match(result.excluded.find((x) => x.id === entryOf('codebase-mapper:tech', 'fleet', 'sonnet', 1).id).reason, /no record/);

    // Every C role is present, in order, with the primary metric; roles with no runs score nothing.
    assert.deepEqual(Object.keys(result.roles), [
      'codebase-mapper:tech', 'codebase-mapper:arch', 'codebase-mapper:quality', 'codebase-mapper:concerns',
      'project-researcher:stack', 'project-researcher:features', 'project-researcher:architecture', 'project-researcher:pitfalls',
    ]);
    const arch = result.roles['codebase-mapper:arch'].models.haiku;
    assert.equal(arch.n_scored, 0);
    assert.deepEqual(arch.metrics.recall, { k: 0, n: 0 });
    assert.deepEqual(arch.metrics.fabrications, { total: 0, runs: 0 });
    assert.equal(result.roles['project-researcher:pitfalls'].models.sonnet.planned, 2);
  });

  test('9b. why a run is excluded', () => {
    const s = setup();
    const e = (role, cb, model, rep = 1) => entryOf(role, cb, model, rep);
    const archH = e('codebase-mapper:arch', 'synthetic', 'haiku');
    const archS = e('codebase-mapper:arch', 'synthetic', 'sonnet');
    const qualH = e('codebase-mapper:quality', 'synthetic', 'haiku');
    const qualS = e('codebase-mapper:quality', 'synthetic', 'sonnet');
    const conH1 = e('codebase-mapper:concerns', 'synthetic', 'haiku', 1);
    const conS1 = e('codebase-mapper:concerns', 'synthetic', 'sonnet', 1);
    const conH2 = e('codebase-mapper:concerns', 'synthetic', 'haiku', 2);
    const featH = e('project-researcher:features', null, 'haiku');
    const archR = e('project-researcher:architecture', null, 'haiku');
    const pitH = e('project-researcher:pitfalls', null, 'haiku');
    const pitS = e('project-researcher:pitfalls', null, 'sonnet');
    const contaminatedStream = `${JSON.stringify({ type: 'assistant', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'cat scripts/eval81/fixtures/C/checklists-synthetic.json' } }] } })}\n`;
    const cleanStream = `${JSON.stringify({ type: 'assistant', message: { id: 'm2', role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'ls' } }] } })}\n`;
    const concernsGrade = gradeAll(conH1, 'found');
    fx.cRoot(s.root, [
      agent(archH, { 'ARCHITECTURE.md': '# a\n' }, { status: 'cap_hit' }), grader(archH, gradeAll(archH, 'found')),
      agent(archS, { 'ARCHITECTURE.md': '# a\n' }, { model_ran: false }), grader(archS, gradeAll(archS, 'found')),
      agent(qualH, { 'CONVENTIONS.md': '# q\n' }, { stream: contaminatedStream }), grader(qualH, gradeAll(qualH, 'found')),
      agent(qualS, { 'CONVENTIONS.md': '# q\n' }, { stream: cleanStream }), grader(qualS, null),
      agent(conH1, { 'CONCERNS.md': '# c\n' }), grader(conH1, { items: concernsGrade.items.slice(0, 5), fabrications: [] }),
      agent(conS1, { 'CONCERNS.md': '# c\n' }), grader(conS1, { items: [...gradeAll(conS1, 'found').items, { id: 'concerns-01', verdict: 'missing', evidence: '' }], fabrications: [] }),
      agent(conH2, { 'CONCERNS.md': '# c\n' }), grader(conH2, { items: [...gradeAll(conH2, 'missing').items, { id: 'concerns-99', verdict: 'found', evidence: '' }], fabrications: [] }),
      agent(featH, { 'FEATURES.md': '# f\n' }), grader(featH, gradeAll(featH, 'found'), { status: 'cap_hit' }),
      agent(archR, {}), grader(archR, gradeAll(archR, 'found')),
      agent(pitH, { 'PITFALLS.md': fx.RESEARCH_PITFALLS }), grader(pitH, fx.RESEARCH_PITFALLS_GRADE),
      agent(pitS, { 'PITFALLS.md': fx.RESEARCH_PITFALLS }),
      grader(pitS, { items: [{ id: 'pitfalls-01', verdict: 'maybe', evidence: '' }], fabrications: [] }, { collected: false }),
    ]);
    const result = s.score();
    const reason = (entry) => (result.excluded.find((x) => x.id === entry.id) || {}).reason;
    assert.match(reason(archH), /status cap_hit/);
    assert.match(reason(archS), /model_ran false/);
    assert.match(reason(qualH), /contaminated/);
    assert.match(reason(qualS), /ungraded: the grader returned no structured output/);
    assert.match(reason(conH1), /ungraded: the grader left 3 of 8 items without a verdict/);
    assert.match(reason(conS1), /ungraded: the grader gave two verdicts for concerns-01/);
    assert.match(reason(featH), /ungraded: grader status cap_hit/);
    assert.match(reason(archR), /no document collected/);
    assert.match(reason(pitS), /ungraded: the grader returned no structured output/);

    // The contaminated run is listed as such in runs; the clean stream is not contamination.
    assert.equal(result.runs.find((r) => r.id === qualH.id).contaminated, true);
    assert.ok(!result.runs.find((r) => r.id === qualS.id));
    // Unknown item ids are ignored and counted, never mapped: concerns-99 does not stop the run being scored.
    const concerns = result.roles['codebase-mapper:concerns'].models.haiku;
    assert.equal(concerns.n_scored, 1);
    assert.deepEqual(concerns.metrics.missing, { k: 8, n: 8 });
    assert.ok(result.notes.some((n) => /unknown item id/.test(n)));
    assert.equal(result.roles['project-researcher:pitfalls'].models.haiku.n_scored, 1);
    assert.deepEqual(result.roles['project-researcher:pitfalls'].models.haiku.metrics.recall, { k: 5, n: 11 });
    // A scored run's verdict evidence is checked against its document; the canned quotes are verbatim.
    assert.ok(result.notes.some((n) => /grader evidence quotes not found verbatim in the document: 0 of /.test(n)));
  });

  test('9c. a plan without the fleet runs plans two mapper runs per model and says so', () => {
    const s = setup();
    const missing = C.makeBatch({ repo: REPO, privateFile: path.join(s.base, 'nowhere.json'), commitmentFile: s.fleet.commitmentFile });
    missing.runs({ root: s.root, trees: null, calibration: null, allowMissingFleet: true });
    const e = entryOf('codebase-mapper:tech', 'synthetic', 'haiku', 1);
    fx.cRoot(s.root, [agent(e, TECH_DOCS), grader(e, fx.SYNTHETIC_TECH_GRADE)]);
    const result = S.score({ root: s.root, outDir: s.outDir, repo: REPO, privateFile: path.join(s.base, 'nowhere.json'), commitmentFile: s.fleet.commitmentFile });
    assert.equal(result.roles['codebase-mapper:tech'].models.haiku.planned, 2);
    assert.deepEqual(result.planned, { haiku: 16, sonnet: 16 });
    assert.deepEqual(Object.keys(result.roles['codebase-mapper:tech'].models.haiku.metrics.recall_by_codebase), ['synthetic']);
    assert.ok(result.notes.some((n) => /fleet codebase runs are omitted/.test(n)));
  });

  test('9d. scoring fleet runs refuses a private checklist that changed since it was committed', () => {
    const base = tempDir('c-score-changed-');
    const changed = fx.fakeFleet(path.join(base, 'f'), { mutate: (t) => t.replace('made-up fact', 'edited fact') });
    const root = path.join(base, 'R');
    fs.mkdirSync(root);
    assert.throws(() => S.score({ root, outDir: path.join(base, 'out'), repo: REPO, privateFile: changed.privateFile, commitmentFile: changed.commitmentFile }), /changed since it was committed/);
  });

  test('9e. the result feeds decide() and the batch table, with no checklist statement text from the fleet', () => {
    const { s } = techRoot();
    const result = s.score();
    const decisions = decide({ results: { C: result }, profiles: metrics.profilesFixture(), packModels: metrics.packModelsFixture() });
    assert.equal(decisions.roles['codebase-mapper:tech'].outcome, 'INSUFFICIENT');
    assert.ok(decisions.roles['codebase-mapper:tech'].haiku);
    const table = renderBatchTable(result);
    assert.match(table, /recall_by_codebase\.synthetic/);
    for (const text of [JSON.stringify(result), table]) {
      assert.ok(!text.includes(fx.FLEET_MARKER), 'no fleet statement text');
      assert.ok(!text.includes(s.fleet.sourceDir), 'no fleet source path');
    }
  });

  test('9f. through the scoring CLI: results land under --out, the spot checks stay in the eval root', async () => {
    const { s } = techRoot();
    fs.writeFileSync(path.join(s.root, 'ledger.json'), JSON.stringify(newLedger()));
    const scorerDir = path.join(s.base, 'scorers');
    fs.mkdirSync(scorerDir);
    const inject = JSON.stringify({ repo: REPO, privateFile: s.fleet.privateFile, commitmentFile: s.fleet.commitmentFile });
    fs.writeFileSync(path.join(scorerDir, 'C.cjs'), `module.exports.score = (a) => require(${JSON.stringify(path.join(__dirname, 'C.cjs'))}).score({ ...a, ...${inject} });\n`);
    const out = [];
    const err = [];
    const code = await scoreCli.main(['--batch', 'C', '--root', s.root, '--out', s.outDir, '--scorer-dir', scorerDir], {
      stdout: (t) => out.push(t), stderr: (t) => err.push(t), now: () => new Date('2026-10-17T20:00:00.000Z'),
    });
    assert.equal(code, 0, err.join(''));
    const json = fs.readFileSync(path.join(s.outDir, 'results', 'C.json'), 'utf8');
    const md = fs.readFileSync(path.join(s.outDir, 'results', 'C.md'), 'utf8');
    const saved = JSON.parse(json);
    assert.equal(saved.batch, 'C');
    assert.ok(saved.spend && saved.spend.batch === 'C');
    for (const text of [json, md]) assert.ok(!text.includes(fx.FLEET_MARKER));
    assert.deepEqual(fs.readdirSync(s.outDir), ['results']);
    assert.ok(fs.existsSync(path.join(s.root, 'spotcheck', 'C.md')));
    assert.ok(fs.existsSync(path.join(s.root, 'spotcheck', 'C-paths.md')));
  });
});

describe('score C: the spot-check sample', () => {
  function sampleRoot() {
    const s = setup();
    const h1 = entryOf('codebase-mapper:tech', 'synthetic', 'haiku', 1);
    const s1 = entryOf('codebase-mapper:tech', 'synthetic', 'sonnet', 1);
    const r1 = entryOf('project-researcher:stack', null, 'haiku', 1);
    const p1 = entryOf('project-researcher:pitfalls', null, 'sonnet', 1);
    // One grade whose evidence is not in its document, to see it flagged.
    const bad = { items: fx.RESEARCH_STACK_GRADE.items.map((i) => (i.id === 'stack-02' ? { ...i, evidence: 'text the document never contained' } : i)), fabrications: [] };
    fx.cRoot(s.root, [
      agent(h1, TECH_DOCS), grader(h1, fx.SYNTHETIC_TECH_GRADE),
      agent(s1, TECH_DOCS), grader(s1, fx.SYNTHETIC_TECH_GRADE),
      agent(r1, { 'STACK.md': fx.RESEARCH_STACK }), grader(r1, bad),
      agent(p1, { 'PITFALLS.md': fx.RESEARCH_PITFALLS }), grader(p1, fx.RESEARCH_PITFALLS_GRADE),
    ]);
    return s;
  }

  test('10. seed 81 picks the same 6 (run, item) pairs every time and writes them to the eval root only', () => {
    const s = sampleRoot();
    const a = S.spotCheckSample({ ...s.opts, seed: 81, k: 6 });
    const b = S.spotCheckSample({ ...s.opts, seed: 81, k: 6 });
    assert.equal(a.picks.length, 6);
    assert.deepEqual(a.picks, b.picks);
    assert.equal(new Set(a.picks.map((p) => `${p.run_id}/${p.item_id}`)).size, 6);
    assert.ok(a.candidates > 30);
    // Round-robin over the verdict classes: two of each.
    assert.deepEqual(['found', 'wrong', 'missing'].map((v) => a.picks.filter((p) => p.verdict === v).length), [2, 2, 2]);
    assert.equal(a.file, path.join(s.root, 'spotcheck', 'C.md'));
    const text = fs.readFileSync(a.file, 'utf8');
    assert.equal(text, fs.readFileSync(S.spotCheckSample({ ...s.opts, seed: 81, k: 6 }).file, 'utf8'));
    for (let i = 1; i <= 6; i += 1) assert.ok(text.includes(`## S${i}`));
    assert.ok(text.includes('## Key'));
    assert.deepEqual(fs.readdirSync(s.outDir), [], 'nothing under --out');
    const other = S.spotCheckSample({ ...s.opts, seed: 82, k: 6 });
    assert.notDeepEqual(other.picks, a.picks);
  });

  test('10b. the sample file lets a person check a verdict, and flags a quote the document does not hold', () => {
    const s = sampleRoot();
    const sample = S.spotCheckSample({ ...s.opts, seed: 81, k: 500 });
    const text = fs.readFileSync(sample.file, 'utf8');
    assert.ok(text.includes('QUOTE NOT FOUND'), 'the stack-02 grade quotes text that is not in the document');
    assert.match(text, /Checklist item:/);
    assert.match(text, /Grader verdict: (found|wrong|missing)/);
    assert.match(text, /Document lines mentioning an accepted phrase/);
  });

  test('10c. the sample is never written under --out, even if --out contains the eval root', () => {
    const s = sampleRoot();
    assert.throws(() => S.spotCheckSample({ ...s.opts, outDir: s.base, seed: 81, k: 6 }), /under --out/);
  });
});
