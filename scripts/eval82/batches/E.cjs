'use strict';
/**
 * Batch E of objective 82 (TRD 82-05; SC-1): objective 81's build cell re-run on the 3.1.0 tree.
 *
 * Batch module interface (81-08): `runs({root, trees, calibration})`, `materialize(desc, workDir, {root, trees,
 * home})`, `collect(desc, workDir, {root, home, record})`; loaded by the frozen runner with
 * `--batch-dir scripts/eval82/batches`.
 *
 * Runs: objective 81's own descriptors (scripts/eval81/batches/E.cjs, imported, never copied) for b31-r1 and b31-r2,
 * re-id'd b82-r1 and b82-r2, order 0 and 1, capped at E_RUN_CAP_USD ($6.5, so two builds fit the $12 batch cap; 81's
 * capForWorkflow gave $15). Everything else (prompt, session model, plugin, env flags, timeout, role, fixture) is 81's
 * unchanged: a test strips id, order, capUsd and capBasis and finds the rest deep-equal (the fairness proof). 81's
 * EVAL81_E_SESSION_MODEL switch passes through.
 *
 * Opt-in control: EVAL82_E_CONTROL=1 adds b30c-r1 (81's b30-r1, the 3.0.0 tree, on today's Claude Code) at order 2.
 * Unset or empty leaves it out; any other value throws, so a typo never silently drops or adds a paid run.
 *
 * materialize builds the same notekit project 81 builds (identical bytes and HEAD); collect runs 81's hidden
 * acceptance checks under the source run id (81's collect parses the id).
 */

const E81 = require('../../eval81/batches/E.cjs');
const { validateDescriptor } = require('../../eval81/lib/contract.cjs');

const BATCH = 'E';
const E_RUN_CAP_USD = 6.5;
const CAP_BASIS = 'objective 82: $6.5 per build so two fit the $12 batch cap (81\'s capForWorkflow gave $15)';
const CONTROL_ENV = 'EVAL82_E_CONTROL';
// [objective-82 id, objective-81 source id], in run order.
const BUILDS = [['b82-r1', 'b31-r1'], ['b82-r2', 'b31-r2']];
const CONTROL = ['b30c-r1', 'b30-r1'];
const SOURCE = Object.fromEntries([...BUILDS, CONTROL]);
const ALL_IDS = [...BUILDS, CONTROL].map(([id]) => id);

/** controlOn(env) -> true for EVAL82_E_CONTROL=1, false when unset or empty; throws on any other value. */
function controlOn(env = process.env) {
  const v = env ? env[CONTROL_ENV] : undefined;
  if (v === undefined || v === '') return false;
  if (v === '1') return true;
  throw new Error(`${CONTROL_ENV} must be 1 (add the 3.0.0 control build) or unset, got ${JSON.stringify(v)}`);
}

/** sourceId('b82-r1') -> 'b31-r1': the objective-81 run a descriptor was made from. */
function sourceId(id) {
  if (!Object.prototype.hasOwnProperty.call(SOURCE, id)) throw new Error(`batch E: ${id} is not a batch E run of objective 82 (${ALL_IDS.join(', ')})`);
  return SOURCE[id];
}

/** runs({calibration, rates, env}) -> b82-r1, b82-r2 (+ b30c-r1 under EVAL82_E_CONTROL=1). */
function runs({ calibration = null, rates, env = process.env } = {}) {
  const pairs = controlOn(env) ? [...BUILDS, CONTROL] : BUILDS;
  const byId = new Map(E81.runs({ calibration, rates, env }).map((d) => [d.id, d]));
  return pairs.map(([id, src], order) => {
    const from = byId.get(src);
    if (!from) throw new Error(`batch E: objective 81's batch E has no run ${src}`);
    const desc = { ...from, id, order, capUsd: E_RUN_CAP_USD, capBasis: CAP_BASIS };
    const v = validateDescriptor(desc);
    if (!v.ok) throw new Error(`batch E: invalid descriptor ${id}: ${v.errors.join('; ')}`);
    return desc;
  });
}

/** materialize -> 81's materialize (the notekit fixture, identical bytes for every run). */
function materialize(desc, workDir, ctx) {
  return E81.materialize({ ...desc, id: sourceId(desc.id) }, workDir, ctx);
}

/** collect -> 81's collect, called with the source run id (it parses the id for the workflow). */
function collect(desc, workDir, ctx) {
  return E81.collect({ ...desc, id: sourceId(desc.id) }, workDir, ctx);
}

module.exports = {
  batch: BATCH,
  runs,
  materialize,
  collect,
  sourceId,
  controlOn,
  E_RUN_CAP_USD,
  CAP_BASIS,
  CONTROL_ENV,
  BUILDS,
  CONTROL,
  ALL_IDS,
  PROFILE: E81.PROFILE,
  UPGRADE_SUBJECT: E81.UPGRADE_SUBJECT,
};
