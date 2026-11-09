'use strict';

/**
 * flutter-ui-eval-session.cjs — the SESSION judge: `verify flutter-ui-eval <m> --judge session`.
 *
 * The live judge (`--judge live`) calls the Anthropic Messages API itself and needs a key. The
 * session judge asks the same question through the Claude Code session that runs AOForge: the
 * engine never calls a model. It runs in two steps around fresh judge subagents that Read the PNG.
 *
 *   --prepare  writes one request per state x sample (judge-requests.json): the absolute PNG path,
 *              its sha256, the expected anchor, the live prompt text (visionPromptText), the
 *              response JSON schema, and a random per-request nonce. Requests are grouped into
 *              batches; no batch holds the same state twice, so one subagent never casts two of a
 *              state's votes and N-sample voting stays N independent looks.
 *   --score    reads the answers (`--responses <file|dir>`; one file per batch, named
 *              <batch_id>.json), binds each to its request (nonce, sha256, batch), re-hashes the
 *              PNG, validates the verdict with validateJudgeResult, and votes exactly as live does.
 *              A state is judged only when EVERY one of its samples has a valid, bound answer;
 *              anything less is `unjudged` (aodex#485: never a fabricated pass). The rollup carries
 *              gate:'binding', judge:'session', the models the subagents reported, and per state
 *              which batch (subagent) cast each vote.
 *
 * Trust boundary, stated plainly: the nonce and sha256 bind an answer to THIS request and THIS
 * file version (no stale, replayed or cross-state answers, no screenshot swapped after judging).
 * They cannot prove a subagent looked at the pixels, and the orchestrating session could write
 * answers itself. The live path has the same residual trust in whoever runs it; the difference is
 * that here the model call is made by the session, not by this engine. SKILL.md says so.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { output, error, pluginVersion } = require('./core.cjs')('helpers.cjs');

const DEFAULT_BATCH_SIZE = 6;
const REQUESTS_FILE = 'judge-requests.json';

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** The response schema a judge subagent must answer in: the live perceptual schema + the binding fields. */
function sessionResponseSchema() {
  const ev = require('./flutter-ui-eval.cjs');
  const base = ev.visionPerceptualSchema();
  return {
    ...base,
    required: ['request_id', 'nonce', 'screenshot_sha256', 'model', ...base.required],
    properties: {
      request_id: { type: 'string' },
      nonce: { type: 'string' },
      screenshot_sha256: { type: 'string' },
      model: { type: 'string' },
      ...base.properties,
    },
  };
}

/** What a judge subagent is told beyond the live prompt (the image arrives by Read, not inline). */
function sessionInstructions(r) {
  return 'Read the PNG at screenshot_path with the Read tool and look at it before answering; never ' +
    'answer from the file name, the expected text or another answer. Reply with ONE JSON object ' +
    'matching response_schema: echo request_id, nonce and screenshot_sha256 exactly as given, set ' +
    'model to your own model id, and give your verdict. If you cannot read or see the image, reply ' +
    `{"request_id":"${r.request_id}","nonce":"${r.nonce}","cannot_judge":true,"reason":"<why>"} instead.`;
}

/**
 * Batches: sample-major, so batch k only holds sample k of each state, chunked to batchSize.
 * One state therefore never appears twice in a batch, and its N votes come from N batches.
 */
function planBatches(requests, samples, batchSize) {
  const batches = [];
  for (let k = 0; k < samples; k++) {
    const ids = requests.filter((r) => r.sample === k).map((r) => r.request_id);
    for (let i = 0, c = 0; i < ids.length; i += batchSize, c++) {
      batches.push({ batch_id: `s${k}-b${c}`, sample: k, request_ids: ids.slice(i, i + batchSize) });
    }
  }
  return batches;
}

function requestsPathFor(manifestPath, requestsArg, cwd) {
  if (requestsArg) return path.isAbsolute(requestsArg) ? requestsArg : path.join(cwd, requestsArg);
  return path.join(path.dirname(manifestPath), REQUESTS_FILE);
}

function positiveInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function prepare({ cwd, manifestPath, manifest, requestsArg, samplesArg, batchSizeArg, judgeTierArg, raw }) {
  const ev = require('./flutter-ui-eval.cjs');
  const manifestDir = path.dirname(manifestPath);
  const manifestSamples = typeof manifest.samples === 'number' ? manifest.samples : 3;
  const samples = samplesArg !== undefined ? positiveInt(samplesArg, manifestSamples) : manifestSamples;
  const batchSize = positiveInt(batchSizeArg, DEFAULT_BATCH_SIZE);
  const tier = ev.judgeTier(ev.judgeProfile(cwd), judgeTierArg);
  const schema = sessionResponseSchema();

  const requests = [];
  const unjudgeable = [];
  for (const st of manifest.states) {
    const { stateId, screenshot_path } = ev.resolveStateInput(st, manifestDir);
    if (!screenshot_path || !fs.existsSync(screenshot_path)) {
      unjudgeable.push({ state_id: stateId, reason: `no screenshot at ${screenshot_path || '(none declared)'} — capture it before prepare` });
      continue;
    }
    const sha = sha256File(screenshot_path);
    for (let i = 0; i < samples; i++) {
      const r = {
        request_id: `${stateId}#${i}`,
        state_id: stateId,
        sample: i,
        screenshot_path,
        screenshot_sha256: sha,
        expected: st.expected,
        nonce: crypto.randomBytes(16).toString('hex'),
        prompt: ev.visionPromptText({ state_id: stateId, expected: st.expected }),
        response_schema: schema,
      };
      r.instructions = sessionInstructions(r);
      requests.push(r);
    }
  }

  const batches = planBatches(requests, samples, batchSize);
  const requestsPath = requestsPathFor(manifestPath, requestsArg, cwd);
  const doc = {
    kind: 'ui-eval-judge-requests',
    schema_version: 1,
    engine_version: pluginVersion(),
    manifest_path: manifestPath,
    created_at: new Date().toISOString(),
    judge_tier: tier,
    samples,
    batch_size: batchSize,
    requests,
    batches,
    unjudgeable,
  };
  fs.mkdirSync(path.dirname(requestsPath), { recursive: true });
  fs.writeFileSync(requestsPath, JSON.stringify(doc, null, 2), 'utf-8');

  output({
    ok: true,
    step: 'prepare',
    judge: 'session',
    // Nothing has been judged yet: prepare carries no standing. Only --score can be binding.
    gate: 'pending',
    network: false,
    engine_version: doc.engine_version,
    schema_version: 1,
    manifest_path: manifestPath,
    requests_path: requestsPath,
    judge_tier: tier,
    samples,
    batch_size: batchSize,
    request_count: requests.length,
    batches: batches.map((b) => ({ batch_id: b.batch_id, sample: b.sample, request_ids: b.request_ids })),
    unjudgeable: unjudgeable.map((u) => u.state_id),
  }, raw);
}

function runSessionStep(opts) {
  if (opts.step === 'prepare') return prepare(opts);
  return score(opts);
}

function score() {
  error('--judge session --score is not implemented yet');
}

module.exports = {
  runSessionStep,
  planBatches,
  sessionResponseSchema,
  DEFAULT_BATCH_SIZE,
  REQUESTS_FILE,
};
