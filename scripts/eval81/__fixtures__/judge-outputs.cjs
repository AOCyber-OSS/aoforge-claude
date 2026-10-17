'use strict';
// Hand-written UI-judge outputs for the batch D tests (TRD 81-10). A batch D run is one headless session that judges
// every state of one surface and returns {results: [one engine-shaped perceptual result per state]}. Nothing here is
// generated: each builder only lays out the literal a test passes in, in the shape the real run produces.
//
//   judgeResult({state_id, is_broken, defects, ...})   one engine-shaped result (visionPerceptualSchema + state_id)
//   defect(type, severity, region, rationale)          one defects[] entry
//   runOutput(results, {as})                           the record fields a run leaves for those results:
//                                                        as 'structured' -> structured_output holds {results}
//                                                        as 'fenced'     -> result_text ends in a ```json block
//                                                        as 'garbage'    -> neither parses
//   dRoot(root, plan)                                  writes <root>/runs/D/<id>/record.json (and outputs/) the way
//                                                      the runner (81-08) does, for the scorer tests

const fs = require('node:fs');
const path = require('node:path');

/** defect(type, severity, region?, rationale?) -> one entry of a result's defects[]. */
function defect(type, severity, region = 'main content', rationale = 'Differs from the expected appearance.') {
  return { type, severity, region, rationale };
}

/**
 * judgeResult({state_id, is_broken, defects, matches_expected, confidence}) -> one result in the engine's perceptual
 * shape plus state_id. matches_expected defaults to the opposite of is_broken; confidence to 0.9.
 */
function judgeResult({ state_id, is_broken, defects = [], matches_expected, confidence = 0.9 }) {
  return {
    state_id,
    is_broken,
    matches_expected: matches_expected === undefined ? !is_broken : matches_expected,
    confidence,
    defects,
  };
}

/** okResult(state_id) / brokenResult(state_id, [defect]) -> the two results most tests need. */
function okResult(state_id) {
  return judgeResult({ state_id, is_broken: false });
}

function brokenResult(state_id, defects = [defect('overflow', 'high')]) {
  return judgeResult({ state_id, is_broken: true, defects });
}

/**
 * runOutput(results, {as}) -> {structured_output, result_text} as parseStream leaves them on a run record.
 * `results` is the results array; the three shapes are the three ways the runner can end up holding it.
 */
function runOutput(results, { as = 'structured' } = {}) {
  if (as === 'structured') {
    return { structured_output: { results }, result_text: `Judged ${results.length} states.` };
  }
  if (as === 'fenced') {
    const block = JSON.stringify({ results }, null, 2);
    return {
      structured_output: null,
      result_text: `Here are my results for the ${results.length} states.\n\n\`\`\`json\n${block}\n\`\`\`\n`,
    };
  }
  if (as === 'garbage') {
    return { structured_output: null, result_text: 'I was unable to open the screenshots, sorry.' };
  }
  throw new Error(`runOutput: unknown shape ${as}`);
}

/** The model id a record names for a tier (the pins in model-profiles.json). */
const MODEL_IDS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5' };

/** What collect() leaves in record.outputs for each shape, written out by hand. */
function collected(results, as) {
  if (as === 'structured') return { results, source: 'structured_output', contaminated: false, contamination_ids: [] };
  if (as === 'fenced') return { results, source: 'fenced', contaminated: false, contamination_ids: [] };
  return { results: [], source: 'none', parse_error: 'no fenced json block in the result text', contaminated: false,
    contamination_ids: [] };
}

/**
 * dRoot(root, plan) -> the list of run dirs written. Each plan item:
 *   { id, model, results, as = 'structured', status = 'ok', model_ran = true, cost_usd = 0.2, wall_ms = 30000,
 *     first_turn_input = 40000, contaminated = false, outputs = 'record' }
 * `outputs` says where the collected outputs live: 'record' (record.outputs), 'file' (outputs/outputs.json only) or
 * 'none' (neither: the scorer must re-parse structured_output / result_text).
 */
function dRoot(root, plan) {
  const written = [];
  for (const item of plan) {
    const {
      id,
      model,
      results = [],
      as = 'structured',
      status = 'ok',
      model_ran = true,
      cost_usd = 0.2,
      wall_ms = 30000,
      first_turn_input = 40000,
      contaminated = false,
      outputs = 'record',
    } = item;
    const dir = path.join(root, 'runs', 'D', id);
    fs.mkdirSync(path.join(dir, 'outputs'), { recursive: true });
    const out = runOutput(results, { as });
    const col = collected(results, as);
    if (contaminated) {
      col.contaminated = true;
      col.contamination_ids = ['toolu_01'];
    }
    const record = {
      id,
      batch: 'D',
      role: 'ui-evaluator',
      model,
      requested_model_id: MODEL_IDS[model],
      plugin: null,
      agent: null,
      status,
      cost_usd,
      charged_usd: cost_usd,
      cost_source: 'reported',
      model_ran,
      wall_ms,
      first_turn_input,
      structured_output: out.structured_output,
      result_text: out.result_text,
    };
    if (outputs === 'record') record.outputs = col;
    fs.writeFileSync(path.join(dir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);
    if (outputs === 'file') fs.writeFileSync(path.join(dir, 'outputs', 'outputs.json'), `${JSON.stringify(col, null, 2)}\n`);
    written.push(dir);
  }
  return written;
}

module.exports = { defect, judgeResult, okResult, brokenResult, runOutput, dRoot, MODEL_IDS };
