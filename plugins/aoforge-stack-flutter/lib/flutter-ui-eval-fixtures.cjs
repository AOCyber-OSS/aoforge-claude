'use strict';

/**
 * flutter-ui-eval-fixtures.cjs — Hand-built fixture generators for the UI visual-eval
 * scoring engine tests (UI-VISUAL-EVAL-JUDGE-01).
 *
 * Per the TDD playbook: factory functions with sensible defaults + an overrides param.
 * NO LLM-generated test data, NO network — deterministic hand-built objects only.
 *
 * Exports:
 *   makeCaptureResult(overrides)  — a valid Shape-B CaptureResult (engine INPUT)
 *   makeJudgeResult(overrides)    — a valid Shape-C JudgeResult (engine OUTPUT)
 *   makeFakeVisionJudge(scripted) — an injectable judge fn returning a canned value (no network)
 */

// ─── Deep-merge helper (plain-object recursive merge; arrays replace wholesale) ──

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, overrides) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isPlainObject(overrides)) return overrides === undefined ? out : overrides;
  for (const [key, val] of Object.entries(overrides)) {
    if (isPlainObject(val) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

// ─── Shape-B: CaptureResult (engine INPUT, Phase-1 contract) ─────────────────────

/**
 * @param {object} overrides — deep-merged onto the valid default.
 * @returns {object} a valid Shape-B CaptureResult.
 */
function makeCaptureResult(overrides = {}) {
  const base = {
    state_id: 'dashboard.populated',
    surface: 'web',
    screenshot_path: './fixtures/x.png',
    viewport: { width: 1280, height: 800 },
    captured_at: '2026-06-16T00:00:00.000Z',
    metadata: {
      console_errors: [],
      flutter_view_bbox: { x: 0, y: 0, width: 1280, height: 800 },
      fonts_ready: true,
      expected: 'Dashboard shows a populated revenue chart and a non-empty table.',
    },
  };
  return deepMerge(base, overrides);
}

// ─── Shape-C: JudgeResult (engine OUTPUT) ────────────────────────────────────────

/**
 * @param {object} overrides — deep-merged onto the valid default. Flip is_broken,
 *   inject defects, set severity, or break a field for negative cases.
 * @returns {object} a Shape-C JudgeResult.
 */
function makeJudgeResult(overrides = {}) {
  const base = {
    state_id: 'dashboard.populated',
    is_broken: false,
    defects: [],
    matches_expected: true,
    confidence: 0.9,
    samples: 3,
    votes: { broken: 0, ok: 3 },
  };
  return deepMerge(base, overrides);
}

// ─── Injectable fake vision judge (no network) ───────────────────────────────────

/**
 * Returns a fn matching the injected-judge interface. When called by callVisionJudge
 * it returns `scriptedReturn` verbatim — a canned valid Shape-C object (C1) or a
 * malformed value such as { garbage: true } or a non-object (C2). It does NOT touch
 * the network. The fn records its calls on `.calls` for assertion convenience.
 *
 * @param {*} scriptedReturn — the value the fake judge returns for every invocation.
 * @returns {function & {calls: Array}}
 */
function makeFakeVisionJudge(scriptedReturn) {
  const fn = function fakeVisionJudge(request) {
    fn.calls.push(request);
    return scriptedReturn;
  };
  fn.calls = [];
  return fn;
}

// ─── Session-judge fixtures (--judge session: prepare -> subagents -> score) ──────
//
// Hand-built builders for the session judge tests. The PNGs are the two checked-in stub
// fixtures (copied, never generated); the "judge answers" are built from the prepared request
// itself plus explicit overrides, so every value a test asserts on is chosen by the test.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIXTURE_PNG_DIR = path.join(__dirname, '__fixtures__', 'flutter-ui-eval');
const FIXTURE_PNGS = {
  good: path.join(FIXTURE_PNG_DIR, 'good-dashboard.png'),
  broken: path.join(FIXTURE_PNG_DIR, 'broken-overflow.png'),
};

/**
 * Build a temp manifest dir for the session judge: one PNG per state (copied from the
 * checked-in fixtures) and a manifest.json naming them.
 *
 * @param {object} [opts]
 * @param {Array<{state_id:string, png?:'good'|'broken'|null, expect?:string}>} [opts.states]
 *   png:null writes the state WITHOUT its screenshot (a capture that never happened).
 * @param {number} [opts.samples=3]
 * @returns {{dir:string, manifest:string, cleanup:function}}
 */
function makeSessionManifestDir({ states, samples = 3 } = {}) {
  const list = states || [
    { state_id: 'good-dashboard', png: 'good' },
    { state_id: 'broken-overflow', png: 'broken' },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-eval-session-'));
  const manifestStates = list.map((s) => {
    if (s.png) fs.copyFileSync(FIXTURE_PNGS[s.png], path.join(dir, `${s.state_id}.png`));
    return {
      state_id: s.state_id,
      route: '/dashboard',
      data_state: 'populated',
      viewport: { width: 1280, height: 800 },
      expected: `State ${s.state_id}: a populated revenue chart and a non-empty table; no overflow.`,
      screenshot_path: `./${s.state_id}.png`,
      ...(s.expect ? { expect: s.expect } : {}),
    };
  });
  const manifest = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({
    objective: 'SESSION-JUDGE', samples, flakeBudget: 1, states: manifestStates,
  }, null, 2), 'utf-8');
  return { dir, manifest, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * One judge subagent's answer to one prepared request: echoes the request's binding fields
 * (request_id, nonce, screenshot_sha256) and carries the perceptual verdict. Default is a clean
 * not-broken answer; `broken: true` adds one HIGH overflow defect. `overrides` replace fields
 * wholesale (pass `undefined` to delete one).
 */
function makeSessionResponse(request, { broken = false, severity = 'high', ...overrides } = {}) {
  const base = {
    request_id: request.request_id,
    nonce: request.nonce,
    screenshot_sha256: request.screenshot_sha256,
    model: 'claude-sonnet-test-fixture',
    is_broken: broken,
    matches_expected: !broken,
    confidence: 0.8,
    defects: broken
      ? [{ type: 'overflow', severity, region: 'body', rationale: 'fixture: content clipped on the right edge' }]
      : [],
  };
  const out = { ...base, ...overrides };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/** Write one batch's answers where a judge subagent would: <responsesDir>/<batch_id>.json. */
function writeBatchResponses(responsesDir, batchId, responses) {
  fs.mkdirSync(responsesDir, { recursive: true });
  const p = path.join(responsesDir, `${batchId}.json`);
  fs.writeFileSync(p, typeof responses === 'string' ? responses : JSON.stringify(responses, null, 2), 'utf-8');
  return p;
}

/**
 * Answer every batch of a prepared requests file. `decide(request)` returns the
 * makeSessionResponse options for that request (or null to leave it unanswered).
 */
function answerAllBatches(requestsDoc, responsesDir, decide = () => ({})) {
  const byId = new Map(requestsDoc.requests.map((r) => [r.request_id, r]));
  for (const b of requestsDoc.batches) {
    const answers = [];
    for (const id of b.request_ids) {
      const opts = decide(byId.get(id));
      if (opts !== null) answers.push(makeSessionResponse(byId.get(id), opts));
    }
    writeBatchResponses(responsesDir, b.batch_id, answers);
  }
}

module.exports = {
  makeCaptureResult,
  makeJudgeResult,
  makeFakeVisionJudge,
  makeSessionManifestDir,
  makeSessionResponse,
  writeBatchResponses,
  answerAllBatches,
  FIXTURE_PNGS,
};
