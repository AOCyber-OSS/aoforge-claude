'use strict';
// TRD 82-05 test list 3-5: objective 82's batch E, the build cell of objective 81 re-run on the 3.1.0 tree. The
// fairness proof compares every descriptor with objective 81's own (frozen) batch module. No network, no claude
// binary, no ~/.claude: materialize and collect run in mkdtemp dirs.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const E82 = require('./E.cjs');
const E81 = require('../../eval81/batches/E.cjs');
const { validateDescriptor } = require('../../eval81/lib/contract.cjs');
const ledger82 = require('../ledger82.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'e82-batchE-'));
const NO_ENV = {};

function strip(d) {
  const { id, order, capUsd, capBasis, ...rest } = d;
  return rest;
}

const source81 = (id) => E81.runs({ calibration: null, env: NO_ENV }).find((d) => d.id === id);

test('3: runs() returns b82-r1 and b82-r2, identical to 81\'s b31-r1/b31-r2 but for id, order and the $6.5 cap', () => {
  const list = E82.runs({ root: tmp(), trees: null, calibration: null, env: NO_ENV });
  assert.equal(E82.batch, 'E');
  assert.deepEqual(list.map((d) => d.id), ['b82-r1', 'b82-r2']);
  assert.deepEqual(list.map((d) => d.order), [0, 1]);
  assert.deepEqual(strip(list[0]), strip(source81('b31-r1')));
  assert.deepEqual(strip(list[1]), strip(source81('b31-r2')));
  for (const d of list) {
    assert.ok(validateDescriptor(d).ok);
    assert.equal(d.capUsd, 6.5);
    assert.equal(d.plugin, '3.1.0');
    assert.equal(d.role, 'workflow:build');
    assert.equal(d.kind, 'workflow');
    assert.match(d.capBasis, /objective 82: \$6\.5 per build/);
  }
  // The ledger's fit report prices builds at the same cap.
  assert.equal(E82.E_RUN_CAP_USD, 6.5);
  assert.equal(ledger82.E_RUN_CAP_USD, E82.E_RUN_CAP_USD);
});

test('3: the session-model switch of 81 passes through unchanged', () => {
  const list = E82.runs({ calibration: null, env: { EVAL81_E_SESSION_MODEL: 'sonnet' } });
  assert.deepEqual(list.map((d) => d.model), ['sonnet', 'sonnet']);
  assert.deepEqual(strip(list[0]), strip(E81.runs({ calibration: null, env: { EVAL81_E_SESSION_MODEL: 'sonnet' } }).find((d) => d.id === 'b31-r1')));
});

test('4: EVAL82_E_CONTROL=1 adds the 3.0.0 control b30c-r1; any other value throws', () => {
  const list = E82.runs({ calibration: null, env: { EVAL82_E_CONTROL: '1' } });
  assert.deepEqual(list.map((d) => d.id), ['b82-r1', 'b82-r2', 'b30c-r1']);
  const control = list[2];
  assert.equal(control.order, 2);
  assert.equal(control.plugin, '3.0.0');
  assert.equal(control.capUsd, 6.5);
  assert.deepEqual(strip(control), strip(source81('b30-r1')));
  assert.deepEqual(E82.runs({ calibration: null, env: { EVAL82_E_CONTROL: '' } }).map((d) => d.id), ['b82-r1', 'b82-r2']);
  for (const bad of ['0', 'yes', 'true', ' 1']) {
    assert.throws(() => E82.runs({ calibration: null, env: { EVAL82_E_CONTROL: bad } }), /EVAL82_E_CONTROL/);
  }
});

test('5: materialize builds the same project as 81\'s for the same kind of run', () => {
  const head = (dir) => spawnSync('git', ['--no-optional-locks', '-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const home = tmp();
  const [b82] = E82.runs({ calibration: null, env: NO_ENV });
  const w82 = path.join(tmp(), 'work');
  E82.materialize(b82, w82, { root: tmp(), trees: null, home });
  const w81 = path.join(tmp(), 'work');
  E81.materialize(source81('b31-r1'), w81, { root: tmp(), trees: null, home });
  assert.ok(head(w82).length === 40);
  assert.equal(head(w82), head(w81));
});

test('5: collect delegates to 81\'s collect under the source run id', () => {
  const home = tmp();
  const list = E82.runs({ calibration: null, env: { EVAL82_E_CONTROL: '1' } });
  const gone = path.join(tmp(), 'never-built');
  for (const d of list) {
    const src = E82.sourceId(d.id);
    assert.deepEqual(E82.collect(d, gone, { root: tmp(), home, record: null }), E81.collect(source81(src), gone, { root: tmp(), home, record: null }));
  }
  // A materialized but unbuilt project: the same acceptance verdict as 81's collect on the same tree.
  const work = path.join(tmp(), 'work');
  E82.materialize(list[0], work, { root: tmp(), trees: null, home });
  const got = E82.collect(list[0], work, { root: tmp(), home, record: null });
  const want = E81.collect(source81('b31-r1'), work, { root: tmp(), home, record: null });
  assert.deepEqual(got, want);
  assert.equal(got.acceptance.pass, false);
  assert.throws(() => E82.sourceId('q31-r1'), /not a batch E run of objective 82/);
});
