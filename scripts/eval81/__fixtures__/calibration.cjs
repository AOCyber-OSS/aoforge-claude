'use strict';
// Hand-built calibration.json objects for the objective-81 harness tests (TRD 81-01). The shape mirrors
// `~/.claude/aoforge/calibration.json` (`aof-tools calibrate`, version 3): `agent_overhead.<agent>.cost_usd.{p50,
// p90, max, n}` and `trd_level.cost_usd.p90`. Tests never read the real file.

const fs = require('fs');
const path = require('path');

// Today's agent_overhead p90 cost (2026-10-17), the default for a builder call with no arguments.
const DEFAULT_P90 = {
  verifier: 1.7634,
  'job-checker': 1.5977,
  'objective-researcher': 3.2655,
  planner: 15.2542,
};

/**
 * @param {object} [opts]
 * @param {Object<string, number>} [opts.agentOverhead]  agent -> cost p90 in USD
 * @param {number|null} [opts.trdLevelP90]  the per-TRD executor cost p90, or null to leave trd_level out
 */
function makeCalibration({ agentOverhead = DEFAULT_P90, trdLevelP90 = null } = {}) {
  const agent_overhead = {};
  for (const [agent, p90] of Object.entries(agentOverhead)) {
    agent_overhead[agent] = { cost_usd: { p50: p90 / 4, p90, max: p90 * 1.5, n: 10 } };
  }
  const cal = { version: 3, data_as_of: '2026-10-17', agent_overhead };
  if (trdLevelP90 !== null) cal.trd_level = { cost_usd: { p50: trdLevelP90 / 2, p90: trdLevelP90, n: 10 } };
  return cal;
}

/** Write `obj` as `<dir>/calibration.json` and return its path. */
function writeCalibration(dir, obj) {
  const file = path.join(dir, 'calibration.json');
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
  return file;
}

module.exports = { DEFAULT_P90, makeCalibration, writeCalibration };
