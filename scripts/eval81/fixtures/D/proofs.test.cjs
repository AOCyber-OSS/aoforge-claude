'use strict';
// TRD 81-05 Task 3: proofs for the test D fixtures. Pure file reads: no Chrome, no hugo, no network, so it
// runs in CI. It shows that the screenshots are what the answer key says they are, and that nothing the judge
// is shown reveals a label.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { decodePng, regionDiffShare } = require('./png.cjs');
const { DEFECT_TYPES, SEVERITIES } = require('../../../../plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs');

const DIR = __dirname;
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
const states = readJson('states.json');
const labels = readJson('labels.json');
const recipe = readJson('recipe.json');

const MIN_SHARE_FLOOR = 0.05;
const LABEL_WORDS = /\b(ok|broken|fail\w*|pass\w*|overflow\w*|blank\w*|defect\w*|contrast\w*|misalign\w*|overlap\w*)\b/i;
const ID = /^d\d{2}$/;

const labelById = new Map(labels.states.map((s) => [s.id, s]));
const recipeById = new Map(recipe.states.map((s) => [s.id, s]));
const stateById = new Map(states.states.map((s) => [s.id, s]));
const viewportKey = (v) => `${v.width}x${v.height}`;
const pngOf = (id) => decodePng(fs.readFileSync(path.join(DIR, stateById.get(id).png)));
const brokenStates = labels.states.filter((s) => s.label === 'broken');

// 4. every PNG exists, decodes and has its viewport's size ------------------------------------------------

test('every PNG in states.json exists, decodes and has the viewport width and height', () => {
  assert.ok(states.states.length > 0);
  for (const s of states.states) {
    const file = path.join(DIR, s.png);
    assert.ok(fs.existsSync(file), `${s.id}: ${s.png} is missing`);
    const img = decodePng(fs.readFileSync(file));
    assert.equal(img.width, s.viewport.width, `${s.id} width`);
    assert.equal(img.height, s.viewport.height, `${s.id} height`);
  }
});

test('png/ holds exactly the files states.json lists, and only the two viewports are used', () => {
  const onDisk = fs.readdirSync(path.join(DIR, 'png')).sort();
  assert.deepEqual(onDisk, states.states.map((s) => path.basename(s.png)).sort());
  const viewports = new Set(states.states.map((s) => viewportKey(s.viewport)));
  assert.deepEqual([...viewports].sort(), ['1280x800', '390x844']);
});

// 5. every broken state differs from its baseline where the label says ---------------------------------

test('every broken state differs from its baseline inside its declared region by at least min_share', () => {
  assert.ok(brokenStates.length > 0);
  for (const b of brokenStates) {
    assert.ok(b.min_share >= MIN_SHARE_FLOOR && b.min_share <= 1, `${b.id}: min_share ${b.min_share} out of range`);
    const base = pngOf(b.baseline);
    const img = pngOf(b.id);
    const share = regionDiffShare(base, img, b.region);
    assert.ok(share >= b.min_share, `${b.id}: region share ${share.toFixed(4)} < min_share ${b.min_share}`);
  }
});

test('every broken state differs from its baseline somewhere in the whole image', () => {
  for (const b of brokenStates) {
    const base = pngOf(b.baseline);
    const img = pngOf(b.id);
    const whole = { x: 0, y: 0, w: img.width, h: img.height };
    assert.ok(regionDiffShare(base, img, whole) > 0, `${b.id} is pixel-identical to ${b.baseline}`);
  }
});

test('every baseline is an ok state of the same surface and viewport, and regions lie inside the image', () => {
  for (const b of brokenStates) {
    const base = labelById.get(b.baseline);
    assert.ok(base, `${b.id}: baseline ${b.baseline} has no label`);
    assert.equal(base.label, 'ok', `${b.id}: baseline ${b.baseline} is not an ok state`);
    assert.equal(base.surface, b.surface, `${b.id}: baseline is another surface`);
    assert.deepEqual(base.viewport, b.viewport, `${b.id}: baseline is another viewport`);
    const { x, y, w, h } = b.region;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= b.viewport.width && y + h <= b.viewport.height, `${b.id} region`);
  }
});

test('the comparison is not saturated: at least two broken states are expected medium severity', () => {
  assert.ok(brokenStates.filter((s) => s.severity === 'medium').length >= 2);
  assert.ok(brokenStates.some((s) => s.severity === 'high'));
});

// 6. nothing shown reveals a label ----------------------------------------------------------------------

test('states.json and the PNG file names contain no label words', () => {
  const shown = JSON.stringify(states);
  const hit = shown.match(LABEL_WORDS);
  assert.equal(hit, null, `states.json contains a label word: ${hit && hit[0]}`);
  for (const file of fs.readdirSync(path.join(DIR, 'png'))) {
    assert.ok(/^d\d{2}\.png$/.test(file), `png name ${file} is not neutral`);
    assert.equal(file.match(LABEL_WORDS), null);
  }
});

test('shown states carry only neutral fields, and the id equals the PNG file stem', () => {
  for (const s of states.states) {
    assert.deepEqual(Object.keys(s).sort(), ['id', 'png', 'surface', 'viewport']);
    assert.ok(ID.test(s.id), `${s.id} is not a neutral id`);
    assert.equal(s.png, `png/${s.id}.png`);
  }
});

test('the expected text is one per surface and viewport, so it cannot differ between states of one viewport', () => {
  const used = new Set();
  for (const s of states.states) {
    assert.equal(s.expected, undefined, `${s.id} carries its own expected text`);
    const surface = states.surfaces[s.surface];
    assert.ok(surface, `${s.id}: unknown surface ${s.surface}`);
    const text = surface.expected[viewportKey(s.viewport)];
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 40, `${s.id}: expected text is too short`);
    used.add(`${s.surface}|${viewportKey(s.viewport)}`);
  }
  const declared = Object.entries(states.surfaces).flatMap(([name, surface]) => Object.keys(surface.expected).map((k) => `${name}|${k}`));
  assert.deepEqual([...used].sort(), declared.sort(), 'every expected text is used and none is missing');
});

test('ids are not assigned ok-first: ok and broken states are interleaved', () => {
  const order = [...labels.states].sort((a, b) => a.id.localeCompare(b.id)).map((s) => s.label);
  const firstBroken = order.indexOf('broken');
  const lastOk = order.lastIndexOf('ok');
  assert.ok(firstBroken >= 0 && lastOk > firstBroken, 'every ok state precedes every broken state');
  assert.equal(order[0], 'broken');
});

// 7. labels and states agree ----------------------------------------------------------------------------

test('labels.json and states.json list the same ids with the same surface and viewport', () => {
  assert.deepEqual([...labelById.keys()].sort(), [...stateById.keys()].sort());
  assert.equal(labelById.size, labels.states.length, 'duplicate label id');
  for (const [id, s] of stateById) {
    const l = labelById.get(id);
    assert.equal(l.surface, s.surface, `${id} surface`);
    assert.deepEqual(l.viewport, s.viewport, `${id} viewport`);
  }
});

test('labels use only the engine DEFECT_TYPES and SEVERITIES, and ok states carry no defect', () => {
  for (const l of labels.states) {
    assert.ok(l.label === 'ok' || l.label === 'broken', `${l.id} label`);
    if (l.label === 'ok') {
      for (const k of ['defect_type', 'severity', 'region', 'baseline', 'min_share']) {
        assert.equal(l[k], null, `${l.id}: ok state has ${k}`);
      }
      continue;
    }
    assert.ok(DEFECT_TYPES.includes(l.defect_type), `${l.id}: ${l.defect_type} is not an engine defect type`);
    for (const extra of l.also_defect_types || []) {
      assert.ok(DEFECT_TYPES.includes(extra), `${l.id}: ${extra} is not an engine defect type`);
    }
    assert.ok(SEVERITIES.includes(l.severity), `${l.id}: ${l.severity} is not an engine severity`);
  }
});

test('labels.json counts match the states', () => {
  const tally = (arr) => arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
  const expected = {
    total: labels.states.length,
    ok: labels.states.filter((s) => s.label === 'ok').length,
    broken: brokenStates.length,
    by_surface: tally(labels.states.map((s) => s.surface)),
    by_defect_type: tally(brokenStates.map((s) => s.defect_type)),
    by_severity: tally(brokenStates.map((s) => s.severity)),
  };
  assert.deepEqual(labels.counts, expected);
  assert.equal(expected.total, 20);
  assert.ok(expected.ok >= 6 && expected.ok <= 8);
  assert.ok(expected.broken >= 12 && expected.broken <= 14);
  assert.equal(Object.keys(expected.by_surface).length, 4);
});

// 8. recipe.json records how every image was made ---------------------------------------------------------

test('recipe.json has an entry per state: url + viewport + css, or a history source', () => {
  assert.deepEqual([...recipeById.keys()].sort(), [...stateById.keys()].sort());
  assert.equal(recipeById.size, recipe.states.length, 'duplicate recipe id');
  for (const [id, r] of recipeById) {
    assert.deepEqual(r.viewport, stateById.get(id).viewport, `${id} viewport`);
    if (r.history !== undefined) {
      assert.match(r.history, /^7a2a07ee:scripts\/__fixtures__\/visual-judge\/[\w-]+\.png$/, `${id} history`);
      assert.equal(r.url, undefined);
      assert.equal(r.css, undefined);
    } else {
      assert.equal(typeof r.url, 'string', `${id} url`);
      assert.equal(r.url, states.surfaces[stateById.get(id).surface].route, `${id} url is not its surface route`);
      assert.equal(typeof r.css, 'string', `${id} css`);
    }
  }
});

test('an ok state has no injection and a broken state has exactly one, on the same route as its baseline', () => {
  for (const l of labels.states) {
    const r = recipeById.get(l.id);
    const injected = (r.css ? 1 : 0) + (r.strip_stylesheets ? 1 : 0);
    if (l.label === 'ok') {
      assert.equal(injected, 0, `${l.id}: ok state has an injection`);
      continue;
    }
    if (r.history !== undefined) {
      assert.ok(recipeById.get(l.baseline).history !== undefined, `${l.id}: a restored state's baseline is restored too`);
      continue;
    }
    assert.equal(injected, 1, `${l.id}: a broken state needs one recorded injection`);
    const base = recipeById.get(l.baseline);
    assert.equal(base.url, r.url, `${l.id}: baseline is another route`);
  }
});

test('the capture recipe names its history commit, and the capture files stay on port 8091 only', () => {
  assert.equal(recipe.port, 8091);
  assert.match(recipe.history_commit, /^7a2a07ee/);
  for (const name of ['capture.cjs', 'recipe.json', 'states.json', 'labels.json']) {
    const text = fs.readFileSync(path.join(DIR, name), 'utf8');
    for (const m of text.matchAll(/(?:127\.0\.0\.1|localhost):(\d+)/g)) {
      assert.equal(m[1], '8091', `${name} refers to port ${m[1]}`);
    }
  }
});

// 9. size -----------------------------------------------------------------------------------------------

test('total PNG bytes stay under 3 MB', () => {
  const total = states.states.reduce((sum, s) => sum + fs.statSync(path.join(DIR, s.png)).size, 0);
  assert.ok(total < 3 * 1024 * 1024, `PNG bytes ${total} >= 3 MB`);
});
