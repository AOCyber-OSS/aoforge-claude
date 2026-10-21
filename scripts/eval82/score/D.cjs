'use strict';
/**
 * Scorer for objective 82's batch D (TRD 82-05; SC-3): the P1 escalation check.
 *
 *   score({root, outDir, labels?, labelsPath?, rates?, opusModel?}) -> the batch D result
 *   renderResults(saved) -> results/D.md
 *
 * Reads every record under `<root>/runs/D/` (never `*.prev-*`) named `D-<state>-<h|s|esc>-<k>` and the answer key
 * (objective 81's fixtures/D/labels.json, `label` broken <-> is_broken; this is the only objective-82 module that
 * opens it). A sample is batches/D.cjs sampleOf(record): an `ok` record with a parsable result; a record whose collect
 * outputs say `contaminated` gives no sample and is listed.
 *
 * Per state and arm (haiku: the `-h-` samples, sonnet: the `-s-` samples): with three samples the arm is complete and
 * gets the engine's aggregateVotes majority, scoreState outcome (every state treated as expect:pass) and split; the
 * engine's escalation set (scoreState review + split -> judgeEscalation) is computed per arm from its own samples
 * (batches/D.cjs escalatedStates). A state with fewer than three samples in an arm is `incomplete`, left out of that
 * arm's rates and listed.
 *
 * Arms reported:
 *   haiku_start  the P1 policy: the haiku majority, replaced by the escalation triple's majority for the states haiku
 *                escalated (incomplete while that triple has fewer than three samples)
 *   haiku        the raw haiku majority (what haiku alone would say)
 *   sonnet       the raw sonnet majority (the Sonnet start; its own escalations would go to opus and are not run)
 * Metrics, each a Wilson 95% interval {k, n, rate, low, high} (objective 81's lib/stats.cjs):
 *   accuracy (final == label over complete states), broken_missed (broken-labelled with an ok final), false_fail
 *   (ok-labelled with a broken final); for haiku and sonnet also split_rate, escalation_rate (over complete states)
 *   and escalation_rate_ok (over ok-labelled complete states); escalated_agreement: for the states haiku escalated,
 *   the Haiku-start final equals the Sonnet-start majority.
 * Cost: Haiku start = charged haiku records + charged escalation records; Sonnet start = charged sonnet records + an
 * ESTIMATE of opus escalations for the sonnet arm's own escalation set (those states' sonnet session tokens, record
 * `usage`, priced at the opus rate of references/model-rates.json).
 */

const fs = require('node:fs');
const path = require('node:path');

const ENGINE = require('../../../plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs');
const D81 = require('../../eval81/batches/D.cjs');
const { wilson, formatPct } = require('../../eval81/lib/stats.cjs');
const { loadRates, rateFor } = require('../../../plugins/aoforge/aoforge/bin/lib/calibration-inputs.cjs');
const D82 = require('../batches/D.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LABELS_FILE = path.join(D81.FIXTURE_DIR, 'labels.json');
const PROFILES_FILE = path.join(REPO_ROOT, 'plugins', 'aoforge', 'aoforge', 'references', 'model-profiles.json');
const ID_RE = /^D-(.+)-(h|s|esc)-(\d+)$/;
const ARM_OF = { h: 'haiku', s: 'sonnet', esc: 'escalation' };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const verdictOf = (isBroken) => (isBroken ? 'broken' : 'ok');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadKey(labels, labelsPath) {
  const parsed = labels || readJson(labelsPath);
  if (!isObj(parsed) || !Array.isArray(parsed.states)) throw new Error('score D: the answer key has no states array');
  return parsed.states.map((s) => ({ id: s.id, label: s.label, defect_type: s.defect_type || null, severity: s.severity || null }));
}

function opusModelId() {
  const profiles = readJson(PROFILES_FILE);
  return isObj(profiles.models) && profiles.models.opus ? profiles.models.opus : 'claude-opus-5-5';
}

/** Every record under <root>/runs/D/, by state and arm: {<state>: {haiku: [rec|null x3], sonnet, escalation}}. */
function readRecords(root) {
  const dir = path.join(root, 'runs', 'D');
  const byState = {};
  const contaminated = [];
  let names = [];
  try {
    names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    names = [];
  }
  for (const name of names.sort()) {
    if (/\.prev-\d+$/.test(name)) continue;
    const m = ID_RE.exec(name);
    if (!m) continue;
    let record;
    try {
      record = readJson(path.join(dir, name, 'record.json'));
    } catch {
      continue;
    }
    const [, state, armKey, kText] = m;
    const k = Number(kText);
    const arm = ARM_OF[armKey];
    const slot = byState[state] || (byState[state] = { haiku: [], sonnet: [], escalation: [] });
    if (isObj(record.outputs) && record.outputs.contaminated === true) contaminated.push(name);
    slot[arm].push({ k, id: name, record });
  }
  return { byState, contaminated };
}

function armView(entries, state, contaminatedIds) {
  const samples = [];
  for (const k of D82.SAMPLES) {
    const e = entries.find((x) => x.k === k);
    if (!e || contaminatedIds.includes(e.id)) continue;
    const s = D82.sampleOf(e.record, state);
    if (s) samples.push(s);
  }
  const view = { n_samples: samples.length, complete: samples.length === D82.SAMPLES.length, votes: null, majority: null, outcome: null, split: null, escalated: false };
  if (view.complete) {
    const agg = ENGINE.aggregateVotes(samples);
    view.votes = agg.votes;
    view.majority = verdictOf(agg.is_broken);
    view.outcome = ENGINE.scoreState({ samples }).verdict;
    view.split = agg.split;
  }
  return { view, samples };
}

function armMetrics(states, pick, { withEscalation }) {
  const done = states.filter((s) => pick(s).final !== null);
  const correct = done.filter((s) => pick(s).final === s.label);
  const broken = done.filter((s) => s.label === 'broken');
  const ok = done.filter((s) => s.label === 'ok');
  const out = {
    accuracy: wilson(correct.length, done.length),
    broken_missed: wilson(broken.filter((s) => pick(s).final === 'ok').length, broken.length),
    false_fail: wilson(ok.filter((s) => pick(s).final === 'broken').length, ok.length),
    incomplete: states.filter((s) => pick(s).final === null).map((s) => s.id),
  };
  if (withEscalation) {
    out.split_rate = wilson(done.filter((s) => pick(s).split).length, done.length);
    out.escalation_rate = wilson(done.filter((s) => pick(s).escalated).length, done.length);
    out.escalation_rate_ok = wilson(ok.filter((s) => pick(s).escalated).length, ok.length);
    out.escalated = done.filter((s) => pick(s).escalated).map((s) => s.id);
  }
  return out;
}

function chargedSum(entries) {
  return round6(entries.reduce((sum, e) => sum + (isNum(e.record.charged_usd) ? e.record.charged_usd : 0), 0));
}

function priceAt(usage, rate) {
  const n = (v) => (isNum(v) && v > 0 ? v : 0);
  if (!isObj(usage)) return 0;
  return (n(usage.input) * rate.input + n(usage.cache_creation) * rate.cache_write_5m + n(usage.cache_read) * rate.cache_read + n(usage.output) * rate.output) / 1e6;
}

/** score(...) -> the batch D result (see the module comment). */
function score({ root, labels, labelsPath = LABELS_FILE, rates, opusModel } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score D: root is required');
  const key = loadKey(labels, labelsPath);
  const { byState, contaminated } = readRecords(root);
  const empty = { haiku: [], sonnet: [], escalation: [] };

  const states = [];
  const haikuSamples = new Map();
  const sonnetSamples = new Map();
  for (const k of key) {
    const slot = byState[k.id] || empty;
    const h = armView(slot.haiku, k.id, contaminated);
    const s = armView(slot.sonnet, k.id, contaminated);
    const e = armView(slot.escalation, k.id, contaminated);
    if (h.view.complete) haikuSamples.set(k.id, h.samples);
    if (s.view.complete) sonnetSamples.set(k.id, s.samples);
    states.push({ ...k, haiku: h.view, sonnet: s.view, escalation: e.view });
  }
  const hEsc = D82.escalatedStates(haikuSamples, 'haiku');
  const sEsc = D82.escalatedStates(sonnetSamples, 'sonnet');
  for (const st of states) {
    st.haiku.escalated = hEsc.includes(st.id);
    st.sonnet.escalated = sEsc.includes(st.id);
    st.haiku.final = st.haiku.majority;
    st.sonnet.final = st.sonnet.majority;
    let final = null;
    let source = null;
    if (st.haiku.complete && !st.haiku.escalated) {
      final = st.haiku.majority;
      source = 'haiku';
    } else if (st.haiku.complete && st.escalation.complete) {
      final = st.escalation.majority;
      source = 'escalation';
    }
    st.haiku_start = { final, source };
  }

  const arms = {
    haiku_start: armMetrics(states, (s) => ({ final: s.haiku_start.final }), { withEscalation: false }),
    haiku: armMetrics(states, (s) => s.haiku, { withEscalation: true }),
    sonnet: armMetrics(states, (s) => s.sonnet, { withEscalation: true }),
  };
  const agreeStates = states.filter((s) => s.haiku.escalated && s.haiku_start.final !== null && s.sonnet.complete);
  const agree = agreeStates.filter((s) => s.haiku_start.final === s.sonnet.majority).length;

  const all = (arm) => Object.values(byState).flatMap((slot) => slot[arm]);
  const loaded = rates || (() => {
    const r = loadRates();
    if (!r.ok) throw new Error(`score D: ${r.error}`);
    return r;
  })();
  const opus = opusModel || opusModelId();
  const rate = rateFor(loaded, opus);
  if (!rate) throw new Error(`score D: no rate for ${opus} in the model rates`);
  const sEscRecords = sEsc.flatMap((id) => (byState[id] ? byState[id].sonnet : []));
  const estimate = round6(sEscRecords.reduce((sum, e) => sum + priceAt(e.record.usage, rate), 0));
  const hSamples = chargedSum(all('haiku'));
  const hEscUsd = chargedSum(all('escalation'));
  const sSamples = chargedSum(all('sonnet'));
  const cost = {
    haiku_start: { samples_usd: hSamples, escalation_usd: hEscUsd, total_usd: round6(hSamples + hEscUsd), records: all('haiku').length + all('escalation').length },
    sonnet_start: {
      samples_usd: sSamples,
      escalation_estimate_usd: estimate,
      escalation_basis: sEsc.length
        ? `estimate: the sonnet sessions of ${sEsc.join(', ')} (${sEscRecords.length}) priced at ${opus} rates`
        : 'estimate: the sonnet arm escalated no state',
      total_usd: round6(sSamples + estimate),
      records: all('sonnet').length,
    },
  };

  const notes = [
    'Each state is judged in its own session (the engine\'s one-state call); every state is treated as expect:pass for the escalation rules.',
    'The Sonnet start\'s escalations (to opus) are not run: their cost is an estimate from the sonnet sessions\' tokens at opus rates.',
  ];
  if (contaminated.length) notes.push(`Contaminated sessions (no sample): ${contaminated.join(', ')}.`);
  return {
    batch: 'D',
    objective: 82,
    role: D82.ROLE,
    planned: { start: key.length * D82.SAMPLES.length * 2, escalation: hEsc.length * D82.SAMPLES.length },
    states_total: key.length,
    states,
    arms,
    escalated_agreement: { ...wilson(agree, agreeStates.length), states: agreeStates.map((s) => s.id) },
    cost,
    contaminated,
    notes,
  };
}

// ─── Rendering ──────────────────────────────────────────────────────────────────────────────────────────────

const NA = 'n/a';
const pctShort = (x) => `${(x * 100).toFixed(1)}%`;
const wcell = (w) => (w ? `${w.k}/${w.n} (${formatPct(w.rate)}, ${pctShort(w.low)}-${pctShort(w.high)})` : NA);
const usd = (x) => (isNum(x) ? `$${x.toFixed(4)}` : NA);
const plural = (n) => (n === 1 ? 'state' : 'states');
const incompleteText = (list) => `${list.length} ${plural(list.length)}${list.length ? ` (${list.join(', ')})` : ''}`;

/** renderResults(saved) -> results/D.md. */
function renderResults(saved) {
  const a = saved.arms;
  const lines = [
    '# Batch D (objective 82) results',
    '',
    `Scored at ${saved.scored_at || NA}. ${saved.states_total} states; planned ${saved.planned.start} start sessions and ${saved.planned.escalation} escalation sessions.`,
    '',
    '| Metric | Haiku start (P1) | Haiku (raw) | Sonnet start |',
    '|---|---|---|---|',
    `| accuracy | ${wcell(a.haiku_start.accuracy)} | ${wcell(a.haiku.accuracy)} | ${wcell(a.sonnet.accuracy)} |`,
    `| broken_missed | ${wcell(a.haiku_start.broken_missed)} | ${wcell(a.haiku.broken_missed)} | ${wcell(a.sonnet.broken_missed)} |`,
    `| false_fail | ${wcell(a.haiku_start.false_fail)} | ${wcell(a.haiku.false_fail)} | ${wcell(a.sonnet.false_fail)} |`,
    `| split rate | (haiku) | ${wcell(a.haiku.split_rate)} | ${wcell(a.sonnet.split_rate)} |`,
    `| escalation rate | (haiku) | ${wcell(a.haiku.escalation_rate)} | ${wcell(a.sonnet.escalation_rate)} |`,
    `| escalation rate, ok-labelled | (haiku) | ${wcell(a.haiku.escalation_rate_ok)} | ${wcell(a.sonnet.escalation_rate_ok)} |`,
    '',
    `Incomplete: haiku ${incompleteText(a.haiku.incomplete)}, sonnet ${incompleteText(a.sonnet.incomplete)}, haiku start ${incompleteText(a.haiku_start.incomplete)}.`,
    '',
    `Escalated states: haiku ${a.haiku.escalated.join(', ') || 'none'}; sonnet ${a.sonnet.escalated.join(', ') || 'none'}. `
      + `Escalated-verdict agreement with the Sonnet start: ${wcell(saved.escalated_agreement)}.`,
    '',
    `Cost: Haiku start ${usd(saved.cost.haiku_start.total_usd)} (samples ${usd(saved.cost.haiku_start.samples_usd)} + escalations ${usd(saved.cost.haiku_start.escalation_usd)}); `
      + `Sonnet start ${usd(saved.cost.sonnet_start.total_usd)} (samples ${usd(saved.cost.sonnet_start.samples_usd)} + ${usd(saved.cost.sonnet_start.escalation_estimate_usd)}, ${saved.cost.sonnet_start.escalation_basis}).`,
    '',
    '| State | Label | Haiku votes | Haiku outcome | Escalated | Escalation votes | Haiku-start final | Sonnet votes | Sonnet outcome |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  const votes = (v) => (v.votes ? `${v.votes.ok} ok / ${v.votes.broken} broken` : `${v.n_samples} of 3`);
  for (const s of saved.states) {
    lines.push(`| ${s.id} | ${s.label} | ${votes(s.haiku)} | ${s.haiku.outcome || NA} | ${s.haiku.escalated ? 'yes' : 'no'} | ${s.haiku.escalated ? votes(s.escalation) : '-'} | ${s.haiku_start.final || NA} | ${votes(s.sonnet)} | ${s.sonnet.outcome || NA} |`);
  }
  lines.push('');
  for (const n of saved.notes || []) lines.push(`- ${n}`);
  if (saved.spend) lines.push('', `Spend: batch D ${usd(saved.spend.spent_usd)} (${saved.spend.status}); ledger total ${usd(saved.spend.ledger_total_usd)}.`);
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

module.exports = { score, renderResults, LABELS_FILE };
