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
