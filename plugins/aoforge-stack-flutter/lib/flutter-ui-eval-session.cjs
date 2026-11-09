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

/** Read the answers: a directory of <batch_id>.json files, or one such file. */
function loadAnswers(responsesPath) {
  const files = [];
  const stat = fs.existsSync(responsesPath) ? fs.statSync(responsesPath) : null;
  if (!stat) return { answers: [], errors: [`no responses at ${responsesPath}`] };
  if (stat.isDirectory()) {
    for (const f of fs.readdirSync(responsesPath).filter((n) => n.endsWith('.json')).sort()) {
      files.push(path.join(responsesPath, f));
    }
  } else {
    files.push(responsesPath);
  }
  const answers = [];
  const errors = [];
  for (const f of files) {
    const batchId = path.basename(f, '.json');
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(f, 'utf-8')); }
    catch (e) { errors.push(`batch ${batchId}: answer file is not JSON (${e.message})`); continue; }
    const list = Array.isArray(parsed) ? parsed
      : (parsed && Array.isArray(parsed.responses)) ? parsed.responses
        : [parsed];
    for (const a of list) answers.push({ batchId, file: f, answer: a });
  }
  return { answers, errors };
}

/** One answer -> a single-sample Shape-C JudgeResult, or the reason it cannot count. NO coercion. */
function judgeSample(req, answer, currentSha) {
  if (answer.nonce !== req.nonce) return { error: `${req.request_id}: nonce does not match the request` };
  if (answer.cannot_judge === true) {
    return { error: `${req.request_id}: the judge could not judge it: ${answer.reason || '(no reason given)'}` };
  }
  if (answer.screenshot_sha256 !== req.screenshot_sha256) {
    return { error: `${req.request_id}: screenshot_sha256 does not match the request (answer is bound to another file)` };
  }
  if (currentSha !== req.screenshot_sha256) {
    return { error: `${req.request_id}: the screenshot changed since prepare (${currentSha ? 'different sha256' : 'file missing'})` };
  }
  const ev = require('./flutter-ui-eval.cjs');
  const result = {
    state_id: req.state_id,
    is_broken: answer.is_broken,
    defects: answer.defects,
    matches_expected: answer.matches_expected,
    confidence: answer.confidence,
    evidence: 'vision',
    samples: 1,
    votes: answer.is_broken === true ? { broken: 1, ok: 0 } : { broken: 0, ok: 1 },
  };
  const v = ev.validateJudgeResult(result);
  if (!v.valid) return { error: `${req.request_id}: ${v.errors.join('; ')}` };
  return { result };
}

function score({ cwd, manifestPath, manifest, requestsArg, responsesArg }) {
  const ev = require('./flutter-ui-eval.cjs');
  const requestsPath = requestsPathFor(manifestPath, requestsArg, cwd);
  if (!fs.existsSync(requestsPath)) {
    error(`no judge requests at ${requestsPath} — run --judge session --prepare first`);
    return;
  }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(requestsPath, 'utf-8')); }
  catch (e) { error(`judge requests at ${requestsPath} are not JSON: ${e.message}`); return; }
  if (!doc || doc.kind !== 'ui-eval-judge-requests' || !Array.isArray(doc.requests) || !Array.isArray(doc.batches)) {
    error(`${requestsPath} is not a judge-requests file`);
    return;
  }
  if (path.resolve(doc.manifest_path) !== path.resolve(manifestPath)) {
    error(`judge requests at ${requestsPath} were prepared for ${doc.manifest_path}, not ${manifestPath}`);
    return;
  }

  const manifestDir = path.dirname(manifestPath);
  const responsesPath = path.isAbsolute(responsesArg) ? responsesArg : path.join(cwd, responsesArg);
  const { answers, errors: responseErrors } = loadAnswers(responsesPath);

  const reqById = new Map(doc.requests.map((r) => [r.request_id, r]));
  const batchById = new Map(doc.batches.map((b) => [b.batch_id, new Set(b.request_ids)]));
  const failedBatches = new Set(responseErrors.map((e) => (/^batch (\S+):/.exec(e) || [])[1]).filter(Boolean));

  // Accept an answer only from the batch (subagent) that was handed its request.
  const accepted = new Map(); // request_id -> [{batchId, answer}]
  for (const { batchId, answer } of answers) {
    const rid = answer && typeof answer === 'object' ? answer.request_id : undefined;
    if (typeof rid !== 'string' || !reqById.has(rid)) {
      responseErrors.push(`batch ${batchId}: answer with unknown request_id ${JSON.stringify(rid)} ignored`);
      continue;
    }
    const batch = batchById.get(batchId);
    if (!batch || !batch.has(rid)) {
      responseErrors.push(`${rid} is not in batch ${batchId}${batch ? '' : ' (no such batch)'} — answer ignored`);
      continue;
    }
    if (!accepted.has(rid)) accepted.set(rid, []);
    accepted.get(rid).push({ batchId, answer });
  }

  const currentSha = new Map();
  for (const r of doc.requests) {
    if (!currentSha.has(r.screenshot_path)) {
      currentSha.set(r.screenshot_path, fs.existsSync(r.screenshot_path) ? sha256File(r.screenshot_path) : null);
    }
  }

  const flakeBudget = typeof manifest.flakeBudget === 'number' ? manifest.flakeBudget : 1;
  const unjudgedPolicy = manifest.unjudgedPolicy === 'fail' ? 'fail' : 'review';
  const stateResults = [];
  const stateDetail = [];
  const models = new Set();
  const unjudgeable = new Map((doc.unjudgeable || []).map((u) => [u.state_id, u.reason]));

  const markUnjudged = (stateId, st, idAdvisories, errs) => {
    stateResults.push({ state_id: stateId, verdict: 'review', advisories: [...idAdvisories, ...errs], expect: st.expect, unjudged: true });
    stateDetail.push({ state_id: stateId, verdict: 'review', is_broken: null, defects: [], errors: errs, advisories: [...idAdvisories, ...errs], unjudged: true });
  };

  for (const st of manifest.states) {
    const { stateId, idAdvisories } = ev.resolveStateInput(st, manifestDir);
    const reqs = doc.requests.filter((r) => r.state_id === stateId).sort((a, b) => a.sample - b.sample);
    if (reqs.length === 0) {
      markUnjudged(stateId, st, idAdvisories, [
        `unjudged: ${unjudgeable.get(stateId) || 'no judge request was prepared for this state (manifest changed since prepare?)'}`,
      ]);
      continue;
    }
    const samples = [];
    const judgedBy = [];
    const errs = [];
    for (const req of reqs) {
      const got = accepted.get(req.request_id) || [];
      if (got.length === 0) {
        const b = doc.batches.find((x) => x.request_ids.includes(req.request_id));
        const why = b && failedBatches.has(b.batch_id) ? ` (batch ${b.batch_id} file was unreadable)` : '';
        errs.push(`${req.request_id}: no answer${why}`);
        continue;
      }
      if (got.length > 1) { errs.push(`${req.request_id}: more than one answer — votes are not independent`); continue; }
      const { batchId, answer } = got[0];
      const s = judgeSample(req, answer, currentSha.get(req.screenshot_path));
      if (s.error) { errs.push(s.error); continue; }
      samples.push(s.result);
      const model = typeof answer.model === 'string' && answer.model ? answer.model : null;
      if (model) models.add(model);
      judgedBy.push({ sample: req.sample, batch_id: batchId, model, ...(answer.agent_id ? { agent_id: String(answer.agent_id) } : {}) });
    }
    if (errs.length > 0) {
      // Every vote or none: a state with N-1 good answers was not judged the way the gate says it was.
      markUnjudged(stateId, st, idAdvisories, errs.map((e) => `unjudged: ${e}`));
      continue;
    }
    const agg = ev.aggregateVotes(samples);
    const stateScore = ev.scoreState({ samples });
    stateResults.push({ state_id: stateId, verdict: stateScore.verdict, advisories: [...idAdvisories, ...stateScore.advisories], expect: st.expect, known_broken: stateScore.known_broken === true });
    stateDetail.push({
      state_id: stateId,
      verdict: stateScore.verdict,
      is_broken: agg.is_broken,
      flake: agg.split === true || agg.tie === true,
      votes: agg.votes,
      defects: samples.flatMap((s) => s.defects || []),
      evidence: 'vision',
      judged_by: judgedBy,
      ...(stateScore.known_broken ? { known_broken: true, max_severity: stateScore.max_severity } : {}),
      advisories: [...idAdvisories, ...stateScore.advisories],
    });
  }

  const rollup = ev.scoreRun(stateResults, { flakeBudget, unjudgedPolicy });
  const modelList = [...models].sort();
  ev.outputRollup({
    engine_version: rollup.engine_version,
    schema_version: rollup.schema_version,
    resolution: 'resolved',
    manifest_path: manifestPath,
    requests_path: requestsPath,
    responses_path: responsesPath,
    network: false,          // the engine made no call; the session's subagents did the looking
    judge: 'session',
    gate: 'binding',
    model: modelList.length === 0 ? null : modelList.length === 1 ? modelList[0] : modelList,
    judge_tier: doc.judge_tier,
    samples: doc.samples,
    flakeBudget,
    unjudgedPolicy,
    verdict: rollup.verdict,
    counts: rollup.counts,
    reviews: rollup.reviews,
    fails: rollup.fails,
    known_failing: rollup.known_failing,
    resolved: rollup.resolved,
    unjudged: rollup.unjudged,
    known_broken: rollup.known_broken,
    tier_escalation: ev.judgeEscalation({ live: true, judgeTier: doc.judge_tier, reviews: rollup.reviews, states: stateDetail }),
    response_errors: responseErrors,
    states: stateDetail,
  }, rollup.verdict);
}

module.exports = {
  runSessionStep,
  planBatches,
  sessionResponseSchema,
  DEFAULT_BATCH_SIZE,
  REQUESTS_FILE,
};
