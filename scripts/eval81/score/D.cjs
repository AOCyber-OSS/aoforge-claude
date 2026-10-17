'use strict';
/**
 * Scorer for batch D (TRD 81-10): the UI judge, Haiku 5.5 vs Sonnet 5.5. `score({root, outDir})` reads the 24 planned
 * sessions' records under `<root>/runs/D/<id>/`, gathers each state's samples per model (one per repeat), aggregates
 * them with the engine's own `aggregateVotes` and `scoreState` (plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs,
 * the rules `--judge live` applies to its samples), compares the majority with the answer key and returns the 81-02 batch
 * result for role `ui-evaluator` (the CLI, score.cjs, adds scored_at and the spend block and writes it).
 *
 * Metrics per model (81-DECISION-RULE.md section 3, D; `n` is states judged unless noted):
 *   accuracy            states whose majority is_broken equals the label            (primary)
 *   broken_missed       broken-labelled states with an ok majority
 *   split_rate          states with split votes (how often the judge would escalate)
 *   engine_escalations  ok-labelled states with split votes (the pre-registered reading of judgeEscalation)
 *   engine_reviews      ok-labelled states the engine's scoreState would put in review (split with no broken majority)
 *   false_fail          ok-labelled states with a broken majority
 *   sample_accuracy     samples (n = samples) whose is_broken equals the label
 *   accuracy_by_defect_type / accuracy_by_severity   accuracy over broken-labelled states by the label's defect type and
 *                       severity; `none` is the ok-labelled states
 * A state with fewer than 3 samples is aggregated on what exists and flagged `samples < 3`; a state with none is
 * unjudged and in no n. `n_scored` counts samples (decide.cjs compares it with `planned`, also in samples: 20 x 3 = 60).
 *
 * This is the only module of the batch that opens the answer key. Nothing here calls a model.
 */

const fs = require('node:fs');
const path = require('node:path');

const ENGINE = require('../../../plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs');
const batchD = require('../batches/D.cjs');

const ROLE = batchD.ROLE;
const MODELS = batchD.MODELS;
const REPEATS = batchD.REPEATS.length;
const SEVERITY_ORDER = ['high', 'medium', 'low'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const km = (k, n) => ({ k, n });
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (xs) => (xs.length === 0 ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length));

/** loadLabels() -> {<state id>: label entry} from the answer key beside the shown states. */
function loadLabels() {
  const file = path.join(batchD.FIXTURE_DIR, 'labels.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.fromEntries(parsed.states.map((s) => [s.id, s]));
}

/**
 * judgeState({id, key, samples}) -> one state's detail. `key` is the state's answer-key entry ({label, defect_type,
 * severity}), `samples` its valid results (is_broken boolean), one per repeat that produced one.
 */
function judgeState({ id, key, samples }) {
  const base = {
    id,
    label: key.label,
    defect_type: key.defect_type === undefined ? null : key.defect_type,
    severity: key.severity === undefined ? null : key.severity,
    n_samples: samples.length,
  };
  if (samples.length === 0) {
    return { ...base, unjudged: true, flagged: null, votes: null, majority: null, split: false, tie: false, correct: null,
      verdict: null, known_broken: false, broken_missed: false, false_fail: false, escalation: false, review: false,
      samples_correct: 0 };
  }
  const truth = key.label === 'broken';
  const agg = ENGINE.aggregateVotes(samples);
  const engine = ENGINE.scoreState({ samples });
  return {
    ...base,
    unjudged: false,
    flagged: samples.length < REPEATS ? `samples < ${REPEATS}` : null,
    votes: agg.votes,
    majority: agg.is_broken ? 'broken' : 'ok',
    split: agg.split,
    tie: agg.tie,
    correct: agg.is_broken === truth,
    verdict: engine.verdict,
    known_broken: engine.known_broken === true,
    broken_missed: truth && !agg.is_broken,
    false_fail: !truth && agg.is_broken,
    escalation: !truth && agg.split,
    review: !truth && engine.verdict === 'review',
    samples_correct: samples.filter((s) => s.is_broken === truth).length,
  };
}

/** The collected outputs of a run: record.outputs, else outputs/outputs.json, else collect() run over the record. */
function outputsOf(desc, runDir, record, root) {
  let out = isObj(record.outputs) ? record.outputs : null;
  if (!out) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(runDir, 'outputs', 'outputs.json'), 'utf8'));
      if (isObj(parsed)) out = parsed;
    } catch {
      out = null;
    }
  }
  if (!out) out = batchD.collect(desc, path.join(runDir, 'work'), { root, record });
  if (!Array.isArray(out.results) || out.results.length === 0) {
    const reparsed = batchD.parseResults(record);
    if (reparsed.results.length > 0) return { ...out, results: reparsed.results, parse_error: undefined };
    return { ...out, results: [], parse_error: out.parse_error || reparsed.parse_error };
  }
  return out;
}

/** One run's first valid result per expected state; the rest are stray (unknown, repeated or malformed). */
function pickResults(stateIds, results) {
  const picked = new Map();
  let stray = 0;
  for (const r of results) {
    if (isObj(r) && stateIds.includes(r.state_id) && typeof r.is_broken === 'boolean' && !picked.has(r.state_id)) {
      picked.set(r.state_id, r);
    } else {
      stray += 1;
    }
  }
  return { picked, stray };
}

/** Accuracy over judged states grouped by `keyOf(state)`, one {k, n} per group key (in `keys` order). */
function accuracyBy(judged, keys, keyOf) {
  return Object.fromEntries(keys.map((k) => {
    const group = judged.filter((d) => keyOf(d) === k);
    return [k, km(group.filter((d) => d.correct).length, group.length)];
  }));
}

function metricsFor(details, labels) {
  const judged = details.filter((d) => !d.unjudged);
  const broken = judged.filter((d) => d.label === 'broken');
  const ok = judged.filter((d) => d.label === 'ok');
  const types = [...new Set(Object.values(labels).filter((l) => l.label === 'broken').map((l) => l.defect_type))].sort();
  const severities = SEVERITY_ORDER.filter((s) => Object.values(labels).some((l) => l.severity === s));
  const samples = judged.reduce((a, d) => a + d.n_samples, 0);
  return {
    accuracy: km(judged.filter((d) => d.correct).length, judged.length),
    broken_missed: km(broken.filter((d) => d.broken_missed).length, broken.length),
    false_fail: km(ok.filter((d) => d.false_fail).length, ok.length),
    split_rate: km(judged.filter((d) => d.split).length, judged.length),
    engine_escalations: km(ok.filter((d) => d.escalation).length, ok.length),
    engine_reviews: km(ok.filter((d) => d.review).length, ok.length),
    sample_accuracy: km(judged.reduce((a, d) => a + d.samples_correct, 0), samples),
    accuracy_by_defect_type: accuracyBy(judged, [...types, 'none'], (d) => d.defect_type || 'none'),
    accuracy_by_severity: accuracyBy(judged, [...severities, 'none'], (d) => d.severity || 'none'),
  };
}

/** score({root, outDir}) -> the batch D result (score.cjs adds scored_at and spend). */
function score({ root } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score D: root is required');
  const rootAbs = path.resolve(root);
  const shown = batchD.loadStates();
  const labels = loadLabels();
  for (const st of shown.states) {
    if (!labels[st.id]) throw new Error(`score D: the answer key has no entry for state ${st.id}`);
  }
  const planned = batchD.runs({ root: rootAbs, trees: null, calibration: null });

  const samples = {};
  const cost = {};
  const wall = {};
  const firstTurn = {};
  const sessions = {};
  const plannedSamples = {};
  for (const m of MODELS) {
    samples[m] = Object.fromEntries(shown.states.map((s) => [s.id, []]));
    cost[m] = 0;
    wall[m] = [];
    firstTurn[m] = [];
    sessions[m] = { planned: 0, scored: 0 };
    plannedSamples[m] = 0;
  }
  const runs = [];
  const excluded = [];
  const notes = [];
  let notRun = 0;

  for (const desc of planned) {
    const m = desc.model;
    const { surface, repeat, state_ids: stateIds } = desc.fixture;
    sessions[m].planned += 1;
    plannedSamples[m] += stateIds.length;
    const runDir = path.join(rootAbs, 'runs', 'D', desc.id);
    const recordPath = path.join(runDir, 'record.json');
    if (!fs.existsSync(recordPath)) {
      notRun += 1;
      continue;
    }
    const entry = { id: desc.id, model: m, role: ROLE, fixture: surface, repeat };
    const exclude = (reason) => {
      excluded.push({ id: desc.id, reason, model: m, role: ROLE });
    };

    let record;
    try {
      record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
      if (!isObj(record)) throw new Error('record is not an object');
    } catch (err) {
      runs.push({ ...entry, status: null, outcome: 'excluded', contaminated: false, samples: 0 });
      exclude('record:unreadable');
      notes.push(`${desc.id}: record.json unreadable (${err.message})`);
      continue;
    }

    const spent = Number.isFinite(record.charged_usd) ? record.charged_usd : (Number.isFinite(record.cost_usd) ? record.cost_usd : 0);
    cost[m] += spent;

    const out = outputsOf(desc, runDir, record, rootAbs);
    const contaminated = out.contaminated === true;
    let reason = null;
    if (record.status !== 'ok') reason = `status:${record.status}`;
    else if (record.model_ran === false) reason = 'model_ran:false';
    else if (contaminated) reason = 'contaminated';
    else if (out.results.length === 0) reason = 'unparsed';

    if (reason) {
      runs.push({ ...entry, status: record.status, outcome: 'excluded', contaminated, samples: 0 });
      exclude(reason);
      if (reason === 'unparsed') notes.push(`${desc.id}: unparsed (${out.parse_error || 'no results'}); every state of the run has a missing sample`);
      continue;
    }

    const { picked, stray } = pickResults(stateIds, out.results);
    const missing = stateIds.filter((id) => !picked.has(id)).sort();
    for (const [id, result] of picked) samples[m][id].push({ repeat, result });
    sessions[m].scored += 1;
    const wallMs = Number.isFinite(record.wall_ms) ? record.wall_ms : record.duration_ms;
    if (Number.isFinite(wallMs)) wall[m].push(wallMs);
    if (Number.isFinite(record.first_turn_input)) firstTurn[m].push(record.first_turn_input);
    runs.push({ ...entry, status: record.status, outcome: 'scored', contaminated, samples: picked.size });
    if (missing.length > 0) notes.push(`${desc.id}: no result for ${missing.join(', ')}`);
    if (stray > 0) notes.push(`${desc.id}: ${stray} stray result${stray === 1 ? '' : 's'} ignored (unknown, repeated or malformed state_id or is_broken)`);
  }

  const states = {};
  const models = {};
  for (const m of MODELS) {
    states[m] = shown.states.map((st) => judgeState({
      id: st.id,
      key: labels[st.id],
      samples: samples[m][st.id].sort((a, b) => a.repeat - b.repeat).map((x) => x.result),
    }));
    const unjudged = states[m].filter((d) => d.unjudged).length;
    if (unjudged > 0) notes.push(`${m}: ${unjudged} of ${shown.states.length} states have no sample (unjudged, not in n)`);
    if (states[m].some((d) => d.tie)) notes.push(`${m}: a tie (two samples, one each way) has no confident majority; the engine counts it ok`);
    models[m] = {
      n_scored: states[m].reduce((a, d) => a + d.n_samples, 0),
      planned: plannedSamples[m],
      sessions_scored: sessions[m].scored,
      sessions_planned: sessions[m].planned,
      metrics: metricsFor(states[m], labels),
      cost_usd: round6(cost[m]),
      mean_wall_ms: mean(wall[m]),
      mean_first_turn_input: mean(firstTurn[m]),
    };
  }
  if (notRun > 0) notes.push(`${notRun} of ${planned.length} planned runs have no record (not run)`);
  notes.push(
    'One session judges every state of a surface (about five), so the judge can compare states; the engine judges each state in its own call. '
      + 'Mitigations: the state order is shuffled per repeat (seed = repeat x 1000 + surface index), each state is judged against its own expected text, and the prompt says to judge each screenshot on its own.',
    'engine_escalations is the pre-registered rule (ok-labelled states with split votes); engine_reviews counts the ok-labelled states the engine\'s scoreState would put in review. '
      + 'accuracy_by_defect_type and accuracy_by_severity group broken-labelled states by the key\'s primary defect type and severity; none is the ok-labelled states.',
  );

  return {
    batch: 'D',
    planned: Object.fromEntries(MODELS.map((m) => [m, plannedSamples[m]])),
    roles: { [ROLE]: { primary: 'accuracy', models } },
    runs,
    excluded,
    notes,
    states,
  };
}

module.exports = { score, judgeState, loadLabels };
