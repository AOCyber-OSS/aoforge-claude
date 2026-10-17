'use strict';
// Tests for scripts/eval81/lib/caps.cjs (TRD 81-01, test list 23-26). Calibration comes from the hand-built builder
// and rates from a hand-built object with today's numbers; no network, no claude binary, no ~/.claude.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { makeCalibration } = require('../__fixtures__/calibration.cjs');

const load = () => require('./caps.cjs');

// $ per million tokens, the model-rates.json numbers as of 2026-10-16.
const RATES = {
  models: {
    'claude-opus-5-5': { input: 4, output: 20, cache_read: 0.2, cache_write_5m: 5, cache_write_1h: 8 },
    'claude-sonnet-5-5': { input: 2, output: 10, cache_read: 0.1, cache_write_5m: 2.5, cache_write_1h: 4 },
    'claude-haiku-5-5': { input: 0.1, output: 0.5, cache_read: 0.01, cache_write_5m: 0.125, cache_write_1h: 0.2 },
  },
  aliases: {},
};

describe('basePromptUsd and capFor', () => {
  test('23. cap = p90 x tier (floored) + the base-prompt allowance', () => {
    const { capFor, basePromptUsd, BASE_PROMPT_TOKENS, BASE_TURNS } = load();
    assert.equal(BASE_PROMPT_TOKENS, 36000);
    assert.deepEqual(BASE_TURNS, { agent: 40, prompt: 3, workflow: 60 });
    assert.equal(basePromptUsd({ model: 'sonnet', kind: 'agent', rates: RATES }), 0.234);
    assert.equal(basePromptUsd({ model: 'haiku', kind: 'agent', rates: RATES }), 0.0189);
    assert.equal(basePromptUsd({ model: 'opus', kind: 'workflow', rates: RATES }), 0.612);
    assert.equal(basePromptUsd({ model: 'sonnet', kind: 'prompt', rates: RATES }), 0.1008);

    const calibration = makeCalibration();
    const sonnet = capFor({ role: 'verifier', model: 'sonnet', kind: 'agent', batch: 'A', calibration, rates: RATES });
    assert.equal(sonnet.cap, 1.9974);
    assert.equal(sonnet.basis, 'p90(verifier)=1.7634 x sonnet 1.0 + base 36K x 40 turns=0.234');

    const haiku = capFor({ role: 'verifier', model: 'haiku', kind: 'agent', batch: 'A', calibration, rates: RATES });
    assert.equal(haiku.cap, 0.45975);
    assert.match(haiku.basis, /^p90\(verifier\)=1\.7634 x haiku 0\.25=0\.44085 \+ base 36K x 40 turns=0\.0189$/);

    // The floor applies to the scaled p90 before the base is added.
    const floored = capFor({ role: 'verifier', model: 'haiku', batch: 'A', calibration: makeCalibration({ agentOverhead: { verifier: 0.4 } }), rates: RATES });
    assert.equal(floored.cap, 0.2689);
    assert.match(floored.basis, /floor 0\.25/);

    // kind defaults from the role: judge and grader are prompts.
    const judge = capFor({ role: 'judge', model: 'sonnet', batch: 'D', calibration: null, rates: RATES });
    assert.equal(judge.cap, 0.6008);
    assert.match(judge.basis, /3 turns/);
  });

  test('24. a role with no calibration sample uses FALLBACK_P90 and names it', () => {
    const { capFor, FALLBACK_P90 } = load();
    const res = capFor({ role: 'codebase-mapper', model: 'haiku', batch: 'C', calibration: makeCalibration(), rates: RATES });
    assert.equal(FALLBACK_P90['codebase-mapper'], 2);
    assert.equal(res.cap, 0.5189);
    assert.match(res.basis, /fallback p90\(codebase-mapper\)=2/);
    // With no calibration at all, the batch modules' `calibration: null` call still sizes a verifier cap.
    assert.match(capFor({ role: 'verifier', model: 'sonnet', batch: 'A', calibration: null, rates: RATES }).basis, /fallback/);
    assert.throws(() => capFor({ role: 'nobody', model: 'sonnet', batch: 'A', calibration: null, rates: RATES }), /nobody/);
  });

  test('25. a cap above the batch ceiling is clamped and says so', () => {
    const { capFor, CEILING } = load();
    const res = capFor({ role: 'planner', model: 'sonnet', batch: 'A', calibration: makeCalibration(), rates: RATES });
    assert.equal(res.cap, CEILING.A);
    assert.match(res.basis, /clamped to ceiling A 2/);
    const opus = capFor({ role: 'verifier', model: 'opus', batch: 'D', calibration: makeCalibration(), rates: RATES });
    assert.equal(opus.cap, 0.75);
    assert.match(opus.basis, /clamped/);
    assert.throws(() => capFor({ role: 'verifier', model: 'sonnet', batch: 'E', calibration: null, rates: RATES }), /capForWorkflow/);
    assert.throws(() => capFor({ role: 'verifier', model: 'fable', batch: 'A', calibration: null, rates: RATES }), /model/);
  });
});

describe('capForWorkflow', () => {
  const small = makeCalibration({ agentOverhead: { planner: 1, 'job-checker': 0.5, verifier: 0.6 }, trdLevelP90: 1.2 });

  test('26. build sums planner, job-checker, executor x2, verifier, the orchestrator and one opus base allowance', () => {
    const { capForWorkflow } = load();
    // planner opus 1 x 2 = 2; job-checker 0.5; executor (trd_level) 1.2 x2 = 2.4; verifier 0.6; orchestrator 2;
    // base 36K x (5 + 0.2 x 60) / 1e6 = 0.612.
    const build = capForWorkflow({ workflow: 'build', calibration: small, rates: RATES });
    assert.equal(build.cap, 8.112);
    assert.match(build.basis, /^build: /);
    assert.match(build.basis, /p90\(executor, trd_level\)=1\.2 x sonnet 1\.0 x2 \+/);
    assert.match(build.basis, /orchestrator/);
    assert.match(build.basis, /base 36K x 60 turns/);

    const quick = capForWorkflow({ workflow: 'quick', calibration: small, rates: RATES });
    assert.equal(quick.cap, 5.812);

    // Today's calibration overflows both ceilings.
    const today = makeCalibration({ trdLevelP90: 4.0386 });
    assert.equal(capForWorkflow({ workflow: 'build', calibration: today, rates: RATES }).cap, 15);
    assert.match(capForWorkflow({ workflow: 'build', calibration: today, rates: RATES }).basis, /clamped to ceiling E_build 15/);
    assert.equal(capForWorkflow({ workflow: 'quick', calibration: today, rates: RATES }).cap, 6);

    // The batch module's bare call works: a workflow name as the only argument.
    assert.equal(typeof capForWorkflow('quick').cap, 'number');
    assert.throws(() => capForWorkflow({ workflow: 'deploy', calibration: small, rates: RATES }), /deploy/);
  });
});
