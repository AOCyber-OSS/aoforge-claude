'use strict';
// flutter-ui-eval-session.test.cjs — `verify flutter-ui-eval --judge session` (the judge runs
// through the Claude Code session's own subagents, no API key).
//
// Outside-in: every case drives the real CLI (aof-flutter.cjs) over a hand-built temp manifest
// (stub PNGs copied from __fixtures__/flutter-ui-eval). Judge answers are built from the prepared
// request by makeSessionResponse — never LLM-generated. Zero network.
//
// Test list (written before the code):
//   prepare
//     SP1 one request per state x sample: request_id, state_id, sample, absolute screenshot_path,
//         sha256 of the PNG, expected, nonce, the live prompt text, a response schema that requires
//         the binding fields; stdout summary is not a gate (gate:'pending'), exit 0
//     SP2 every nonce is unique
//     SP3 batches cover every request exactly once and never hold the same state twice
//     SP4 a state whose screenshot is missing gets no request and is named in unjudgeable[]
//     SP5 the request prompt is byte-for-byte the live (buildVisionRequest) prompt
//   score
//     SS1 valid answers for every request -> gate:'binding', judge:'session', per-state evidence
//         'vision', judged_by names the batch and model, rollup reports the model
//     SS2 a missing answer -> that state is unjudged (never pass), run pass-with-reviews
//     SS3 nonce mismatch -> unjudged
//     SS4 sha256 mismatch in the answer -> unjudged
//     SS5 screenshot changed on disk after prepare -> unjudged
//     SS6 malformed answers (no is_broken / defect outside the taxonomy / non-JSON file) -> unjudged
//     SS7 an answer filed under a batch that does not hold that request -> rejected -> unjudged
//     SS8 two answers to one request -> unjudged (not independent)
//     SS9 an explicit cannot_judge answer -> unjudged, with its reason
//   voting / flake
//     SV1 2 broken(high) / 1 ok -> fail, exit 1
//     SV2 1 broken / 2 ok -> review, flake:true, tier_escalation requested
//   gate standing
//     SG1 labels stays advisory; prepare never claims binding; only session score is binding
//   CLI usage errors (exit 1, stderr)
//     SU1 --judge session with neither --prepare nor --score
//     SU2 both --prepare and --score
//     SU3 --score without --responses
//     SU4 --prepare / --score / --responses without --judge session
//     SU5 --score with no requests file
//     SU6 a requests file prepared for a different manifest
//     SU7 an unknown --judge value names session among the accepted values
//   live unchanged
//     SL1 --judge live with no credential -> judge 'live-vision', binding, network:true, each state
//         a review carrying the credential error (the pre-existing behaviour)

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const {
  makeSessionManifestDir,
  makeSessionResponse,
  writeBatchResponses,
  answerAllBatches,
} = require('./flutter-ui-eval-fixtures.cjs');
const { buildVisionRequest } = require('./flutter-ui-eval.cjs');

const DF_TOOLS = path.join(__dirname, '..', 'bin', 'aof-flutter.cjs');

function envWithoutCredentials() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function run(argv) {
  const r = spawnSync(process.execPath, [DF_TOOLS, ...argv], { encoding: 'utf-8', env: envWithoutCredentials() });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_) { /* usage errors print to stderr */ }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function prepare(fx, extra = []) {
  const r = run(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'session', '--prepare', ...extra, '--raw']);
  assert.strictEqual(r.status, 0, `prepare exits 0: ${r.stderr}`);
  const doc = JSON.parse(fs.readFileSync(r.json.requests_path, 'utf-8'));
  return { out: r.json, doc };
}

function score(fx, responsesDir, extra = []) {
  return run(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'session', '--score', '--responses', responsesDir, ...extra, '--raw']);
}

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ──────────────────────────────────────────────────────────────────────────────
// prepare
// ──────────────────────────────────────────────────────────────────────────────

test.describe('session judge — prepare', () => {
  test('SP1 — one request per state x sample, each bound to its PNG by sha256 and a nonce', () => {
    const fx = makeSessionManifestDir({ samples: 3 });
    try {
      const { out, doc } = prepare(fx);
      assert.strictEqual(out.ok, true);
      assert.strictEqual(out.step, 'prepare');
      assert.strictEqual(out.judge, 'session');
      assert.strictEqual(out.gate, 'pending', 'prepare judged nothing, so it claims no standing');
      assert.strictEqual(out.network, false);
      assert.strictEqual(out.request_count, 6);
      assert.ok(path.isAbsolute(out.requests_path));

      assert.strictEqual(doc.kind, 'ui-eval-judge-requests');
      assert.strictEqual(doc.schema_version, 1);
      assert.strictEqual(doc.manifest_path, fx.manifest);
      assert.strictEqual(doc.samples, 3);
      assert.match(doc.judge_tier, /^(haiku|sonnet|opus)$/);
      assert.strictEqual(doc.requests.length, 6);

      const r = doc.requests.find((x) => x.state_id === 'broken-overflow' && x.sample === 1);
      assert.ok(r, 'broken-overflow sample 1 requested');
      assert.strictEqual(r.request_id, 'broken-overflow#1');
      assert.strictEqual(r.screenshot_path, path.join(fx.dir, 'broken-overflow.png'));
      assert.strictEqual(r.screenshot_sha256, sha256(r.screenshot_path));
      assert.match(r.expected, /broken-overflow/);
      assert.match(r.nonce, /^[0-9a-f]{32}$/);
      assert.match(r.prompt, /strict UI-defect detector/);
      for (const k of ['request_id', 'nonce', 'screenshot_sha256', 'is_broken', 'defects', 'matches_expected', 'confidence']) {
        assert.ok(r.response_schema.required.includes(k), `response schema requires ${k}`);
      }
      assert.strictEqual(r.response_schema.additionalProperties, false);
    } finally { fx.cleanup(); }
  });

  test('SP2 — every nonce is unique', () => {
    const fx = makeSessionManifestDir({ samples: 3 });
    try {
      const { doc } = prepare(fx);
      const nonces = doc.requests.map((r) => r.nonce);
      assert.strictEqual(new Set(nonces).size, nonces.length);
    } finally { fx.cleanup(); }
  });

  test('SP3 — batches cover every request once and never hold one state twice', () => {
    const states = Array.from({ length: 9 }, (_, i) => ({ state_id: `s${i}`, png: i % 2 ? 'broken' : 'good' }));
    const fx = makeSessionManifestDir({ states, samples: 3 });
    try {
      const { doc } = prepare(fx);
      const seen = [];
      for (const b of doc.batches) {
        assert.match(b.batch_id, /^[a-z0-9-]+$/);
        const stateIds = b.request_ids.map((id) => doc.requests.find((r) => r.request_id === id).state_id);
        assert.strictEqual(new Set(stateIds).size, stateIds.length, `batch ${b.batch_id} holds a state twice`);
        assert.ok(b.request_ids.length <= doc.batch_size, `batch ${b.batch_id} over batch_size`);
        seen.push(...b.request_ids);
      }
      assert.deepStrictEqual([...seen].sort(), doc.requests.map((r) => r.request_id).sort());
    } finally { fx.cleanup(); }
  });

  test('SP4 — a state with no screenshot gets no request and is named in unjudgeable[]', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }, { state_id: 'never-captured', png: null }] });
    try {
      const { out, doc } = prepare(fx);
      assert.ok(!doc.requests.some((r) => r.state_id === 'never-captured'));
      assert.deepStrictEqual(doc.unjudgeable.map((u) => u.state_id), ['never-captured']);
      assert.deepStrictEqual(out.unjudgeable, ['never-captured']);
    } finally { fx.cleanup(); }
  });

  test('SP5 — the request prompt is the live prompt, byte for byte', () => {
    const fx = makeSessionManifestDir({ samples: 1 });
    try {
      const { doc } = prepare(fx);
      const r = doc.requests[0];
      const { body } = buildVisionRequest({ state_id: r.state_id, screenshot_path: r.screenshot_path, expected: r.expected });
      assert.strictEqual(r.prompt, body.messages[0].content[1].text);
    } finally { fx.cleanup(); }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// score
// ──────────────────────────────────────────────────────────────────────────────

// good-dashboard is answered not-broken, broken-overflow broken/high, unless a case says otherwise.
const truthful = (r) => (r.state_id === 'broken-overflow' ? { broken: true } : {});

function stateOf(rollup, id) {
  const s = rollup.states.find((x) => x.state_id === id);
  assert.ok(s, `state ${id} in the rollup`);
  return s;
}

test.describe('session judge — score', () => {
  test('SS1 — valid bound answers for every request -> a binding, judged rollup', () => {
    const fx = makeSessionManifestDir({ samples: 3 });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses, truthful);
      const r = score(fx, responses);
      assert.strictEqual(r.status, 1, 'a HIGH defect fails the run, so the exit is 1');
      const rollup = r.json;
      assert.strictEqual(rollup.gate, 'binding');
      assert.strictEqual(rollup.judge, 'session');
      assert.strictEqual(rollup.network, false, 'the engine itself made no network call');
      assert.strictEqual(rollup.model, 'claude-sonnet-test-fixture');
      assert.strictEqual(rollup.judge_tier, doc.judge_tier);
      assert.strictEqual(rollup.samples, 3);
      assert.strictEqual(rollup.verdict, 'fail');
      assert.deepStrictEqual(rollup.fails, ['broken-overflow']);
      assert.deepStrictEqual(rollup.unjudged, []);
      const good = stateOf(rollup, 'good-dashboard');
      assert.strictEqual(good.verdict, 'pass');
      assert.strictEqual(good.evidence, 'vision');
      assert.deepStrictEqual(good.votes, { broken: 0, ok: 3 });
      assert.deepStrictEqual(good.judged_by.map((j) => j.batch_id).sort(), ['s0-b0', 's1-b0', 's2-b0']);
      assert.ok(good.judged_by.every((j) => j.model === 'claude-sonnet-test-fixture'));
      assert.strictEqual(stateOf(rollup, 'broken-overflow').verdict, 'fail');
    } finally { fx.cleanup(); }
  });

  test('SS1b — a clean run scores pass, exit 0, and still binding', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses);
      const r = score(fx, responses);
      assert.strictEqual(r.status, 0);
      assert.strictEqual(r.json.verdict, 'pass');
      assert.strictEqual(r.json.gate, 'binding');
    } finally { fx.cleanup(); }
  });

  test('SS2 — a missing answer makes that state unjudged, never a pass', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }, { state_id: 'other', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses, (r) => (r.request_id === 'other#2' ? null : {}));
      const r = score(fx, responses);
      assert.strictEqual(r.status, 0);
      assert.deepStrictEqual(r.json.unjudged, ['other']);
      assert.strictEqual(r.json.verdict, 'pass-with-reviews');
      const other = stateOf(r.json, 'other');
      assert.strictEqual(other.unjudged, true);
      assert.notStrictEqual(other.verdict, 'pass');
      assert.ok(other.errors.some((e) => /other#2/.test(e) && /no answer/.test(e)), other.errors.join('; '));
      assert.strictEqual(stateOf(r.json, 'good-dashboard').verdict, 'pass');
    } finally { fx.cleanup(); }
  });

  function oneBadAnswer(t, mutate, errorPattern) {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses, (r) => (r.sample === 1 ? mutate(r) : {}));
      const r = score(fx, responses);
      assert.deepStrictEqual(r.json.unjudged, ['good-dashboard']);
      const s = stateOf(r.json, 'good-dashboard');
      assert.strictEqual(s.unjudged, true);
      assert.ok(s.errors.some((e) => errorPattern.test(e)), `errors: ${s.errors.join('; ')}`);
      assert.strictEqual(r.json.verdict, 'pass-with-reviews');
      return r;
    } finally { fx.cleanup(); }
  }

  test('SS3 — a nonce mismatch is unjudged', (t) => {
    oneBadAnswer(t, () => ({ nonce: '0'.repeat(32) }), /nonce/);
  });

  test('SS4 — a sha256 mismatch in the answer is unjudged', (t) => {
    oneBadAnswer(t, () => ({ screenshot_sha256: 'f'.repeat(64) }), /sha256/);
  });

  test('SS6a — an answer without is_broken is unjudged (never coerced to false)', (t) => {
    oneBadAnswer(t, () => ({ is_broken: undefined }), /is_broken/);
  });

  test('SS6b — a defect outside the taxonomy is unjudged', (t) => {
    oneBadAnswer(t, () => ({ broken: true, defects: [{ type: 'ugly', severity: 'high', region: 'x', rationale: 'y' }] }), /taxonomy/);
  });

  test('SS9 — an explicit cannot_judge answer is unjudged with its reason', (t) => {
    oneBadAnswer(t, (r) => ({ is_broken: undefined, matches_expected: undefined, confidence: undefined, defects: undefined, screenshot_sha256: undefined, cannot_judge: true, reason: 'image did not load' }), /image did not load/);
  });

  test('SS5 — a screenshot changed on disk after prepare is unjudged', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses);
      fs.appendFileSync(path.join(fx.dir, 'good-dashboard.png'), Buffer.from([0]));
      const r = score(fx, responses);
      assert.deepStrictEqual(r.json.unjudged, ['good-dashboard']);
      assert.ok(stateOf(r.json, 'good-dashboard').errors.some((e) => /changed since prepare/.test(e)));
    } finally { fx.cleanup(); }
  });

  test('SS6c — a non-JSON batch file is named and its requests are unjudged', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses);
      writeBatchResponses(responses, 's0-b0', 'Here is my verdict: looks fine!');
      const r = score(fx, responses);
      assert.deepStrictEqual(r.json.unjudged, ['good-dashboard']);
      assert.ok(r.json.response_errors.some((e) => /s0-b0/.test(e) && /JSON/.test(e)), r.json.response_errors.join('; '));
    } finally { fx.cleanup(); }
  });

  test('SS7 — an answer filed under a batch that does not hold its request is rejected', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses);
      // batch s0-b0 also answers sample 1: one subagent casting two of a state's votes
      const r1 = doc.requests.find((r) => r.request_id === 'good-dashboard#1');
      const r0 = doc.requests.find((r) => r.request_id === 'good-dashboard#0');
      writeBatchResponses(responses, 's0-b0', [makeSessionResponse(r0), makeSessionResponse(r1)]);
      fs.rmSync(path.join(responses, 's1-b0.json'));
      const r = score(fx, responses);
      assert.deepStrictEqual(r.json.unjudged, ['good-dashboard']);
      assert.ok(r.json.response_errors.some((e) => /good-dashboard#1/.test(e) && /not in batch s0-b0/.test(e)), r.json.response_errors.join('; '));
    } finally { fx.cleanup(); }
  });

  test('SS8 — two answers to one request are unjudged', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses);
      const r0 = doc.requests.find((r) => r.request_id === 'good-dashboard#0');
      writeBatchResponses(responses, 's0-b0', [makeSessionResponse(r0), makeSessionResponse(r0, { broken: true })]);
      const r = score(fx, responses);
      assert.deepStrictEqual(r.json.unjudged, ['good-dashboard']);
      assert.ok(stateOf(r.json, 'good-dashboard').errors.some((e) => /more than one answer/.test(e)));
    } finally { fx.cleanup(); }
  });

  test('SS10 — a single responses FILE (array of answers) is accepted as well as a directory', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }], samples: 1 });
    try {
      const { doc } = prepare(fx);
      const file = writeBatchResponses(path.join(fx.dir, 'responses'), 's0-b0', [makeSessionResponse(doc.requests[0])]);
      const r = score(fx, file);
      assert.strictEqual(r.json.verdict, 'pass');
      assert.deepStrictEqual(stateOf(r.json, 'good-dashboard').judged_by.map((j) => j.batch_id), ['s0-b0']);
    } finally { fx.cleanup(); }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// voting / flake — the same aggregateVotes/scoreState the live path uses
// ──────────────────────────────────────────────────────────────────────────────

test.describe('session judge — voting and flake', () => {
  test('SV1 — 2 broken (high) / 1 ok -> fail, exit 1', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses, (r) => (r.sample < 2 ? { broken: true } : {}));
      const r = score(fx, responses);
      assert.strictEqual(r.status, 1);
      const s = stateOf(r.json, 'good-dashboard');
      assert.strictEqual(s.verdict, 'fail');
      assert.deepStrictEqual(s.votes, { broken: 2, ok: 1 });
      assert.strictEqual(s.flake, true);
    } finally { fx.cleanup(); }
  });

  test('SV2 — 1 broken / 2 ok -> review, flake, and a split-vote escalation request', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { doc } = prepare(fx);
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses, (r) => (r.sample === 0 ? { broken: true } : {}));
      const r = score(fx, responses);
      assert.strictEqual(r.status, 0);
      const s = stateOf(r.json, 'good-dashboard');
      assert.strictEqual(s.verdict, 'review');
      assert.strictEqual(s.flake, true);
      assert.deepStrictEqual(r.json.reviews, ['good-dashboard']);
      assert.strictEqual(r.json.tier_escalation.requested, true);
      assert.strictEqual(r.json.tier_escalation.from_tier, doc.judge_tier);
    } finally { fx.cleanup(); }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// gate standing
// ──────────────────────────────────────────────────────────────────────────────

test.describe('session judge — gate standing', () => {
  test('SG1 — labels stays advisory, prepare claims nothing, only session score is binding', () => {
    const fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const labels = run(['verify', 'flutter-ui-eval', fx.manifest, '--raw']);
      assert.strictEqual(labels.json.gate, 'advisory');
      const { out, doc } = prepare(fx);
      assert.strictEqual(out.gate, 'pending');
      assert.ok(!('verdict' in out), 'prepare carries no verdict');
      const responses = path.join(fx.dir, 'responses');
      answerAllBatches(doc, responses);
      assert.strictEqual(score(fx, responses).json.gate, 'binding');
    } finally { fx.cleanup(); }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CLI usage errors
// ──────────────────────────────────────────────────────────────────────────────

test.describe('session judge — usage errors', () => {
  const usage = (argv, pattern) => {
    const r = run(argv);
    assert.strictEqual(r.status, 1, `${argv.join(' ')} exits 1 (stdout: ${r.stdout})`);
    assert.match(r.stderr, pattern);
  };
  let fx;
  test.before(() => { fx = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] }); });
  test.after(() => fx.cleanup());

  test('SU1 — --judge session with no step', () => {
    usage(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'session', '--raw'], /exactly one step/);
  });
  test('SU2 — both --prepare and --score', () => {
    usage(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'session', '--prepare', '--score', '--responses', fx.dir, '--raw'], /exactly one step/);
  });
  test('SU3 — --score without --responses', () => {
    usage(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'session', '--score', '--raw'], /--responses/);
  });
  test('SU4 — session step flags without --judge session', () => {
    usage(['verify', 'flutter-ui-eval', fx.manifest, '--prepare', '--raw'], /applies only to --judge session/);
    usage(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'live', '--score', '--responses', fx.dir, '--raw'], /applies only to --judge session/);
  });
  test('SU5 — --score with no requests file', () => {
    usage(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'session', '--score', '--responses', fx.dir, '--requests', path.join(fx.dir, 'nope.json'), '--raw'], /run --judge session --prepare first/);
  });
  test('SU6 — a requests file prepared for a different manifest', () => {
    const other = makeSessionManifestDir({ states: [{ state_id: 'good-dashboard', png: 'good' }] });
    try {
      const { out } = prepare(other);
      usage(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'session', '--score', '--responses', fx.dir, '--requests', out.requests_path, '--raw'], /were prepared for/);
    } finally { other.cleanup(); }
  });
  test('SU7 — an unknown --judge value names session among the accepted values', () => {
    usage(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'sesion', '--raw'], /'session'/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// live unchanged
// ──────────────────────────────────────────────────────────────────────────────

test.describe('session judge — the live path is unchanged', () => {
  test('SL1 — --judge live with no credential: live-vision, binding, network, each state a credential review', () => {
    const fx = makeSessionManifestDir({ samples: 2 });
    try {
      const r = run(['verify', 'flutter-ui-eval', fx.manifest, '--judge', 'live', '--raw']);
      // two credential reviews exceed the default flake budget of 1 -> fail, exit 1 (pre-existing rule)
      assert.strictEqual(r.status, 1);
      assert.strictEqual(r.json.verdict, 'fail');
      assert.deepStrictEqual(r.json.reviews.sort(), ['broken-overflow', 'good-dashboard']);
      assert.strictEqual(r.json.judge, 'live-vision');
      assert.strictEqual(r.json.gate, 'binding');
      assert.strictEqual(r.json.network, true);
      assert.strictEqual(r.json.samples, 2);
      assert.ok(!('judged_by' in r.json.states[0]), 'live states carry no session provenance');
      for (const s of r.json.states) {
        assert.strictEqual(s.verdict, 'review');
        assert.ok(s.errors.some((e) => /no credential/.test(e)), s.errors.join('; '));
      }
    } finally { fx.cleanup(); }
  });
});
