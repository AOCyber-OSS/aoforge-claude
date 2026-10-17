'use strict';
/**
 * Scorer for batch E (TRD 81-12; 76-08): AOForge 3.0.0 vs 3.1.0 on one fixed workload, per role and per run.
 *
 *   score({root, outDir}) -> the batch result, plus extra_files {'81-MEASUREMENT.md': renderMeasurement(...)}
 *
 * score.cjs (81-02) calls it for `--batch E`, writes results/E.json (with the ledger's spend block) and results/E.md,
 * and writes 81-MEASUREMENT.md under --out.
 *
 * Inputs, read only: `<root>/runs/E/<id>/record.json` for every id of batches/E.cjs RUN_ORDER (no record, or a
 * dry_run / skipped_budget record, is "not run"); the run's collect outputs (record.outputs, else
 * `outputs/outputs.json` or `outputs/collect.json`, else per-key `outputs/<key>.json` files, else any `outputs/*.json`
 * holding `acceptance`); the run's transcripts through lib/roles.cjs rolesForRun; and the 81-07 static resident bytes
 * from `<outDir>/results/static-prompt.json`, else the fallback (default: this repository's committed copy under the
 * objective's results/, because the rehearsal's out dir has none; the source is recorded), else n/a.
 *
 * Interpretive choices (stated in the report's method):
 *   - Role cells count only runs whose status is `ok`, and only their readable transcript rows. Every recorded run is
 *     in the per-run table whatever its status; a run that did not end ok is flagged and listed as excluded.
 *   - Role statistics are per spawn (a build's two executor spawns are two values); n is spawns (runs).
 *   - Per run: first-turn input is the orchestrator's (the main session's first API message); total tokens and cache
 *     writes are the sum over every readable transcript (main session plus subagents). With no readable transcript,
 *     the CLI-reported figures (record.first_turn_input, record.usage) count instead and the run is flagged.
 *   - Cost: the CLI's reported `total_cost_usd` (record.cost_usd) is kept as reported, beside the transcript cost
 *     priced from references/model-rates.json (rolesForRun, the same rule as the ledger's transcriptCost) and the
 *     ledger's charged figure. A priced cost more than 10% from the reported one flags the run (cache-tier pricing or
 *     a side model, or a reported cost that leaves out subagents); neither figure is overwritten.
 *   - Wall time per run is the runner's wall_ms (else duration_ms, else the main session's transcript span); per
 *     spawn it is the transcript's first-to-last timestamp.
 *   - Deltas are 3.1.0 minus 3.0.0, of the medians and of the means; the percentage is of the 3.0.0 median.
 *   - `model_ran` is not used: a workflow's subagents run on their profile tiers by design.
 * The report measures; it proposes no model tier.
 *
 * Nothing here writes, spawns, reads process.env or touches ~/.claude.
 */

const fs = require('fs');
const path = require('path');

const { rolesForRun, ORCHESTRATOR } = require('../lib/roles.cjs');
const E = require('../batches/E.cjs');
const { describeFixture, QUICK_PROMPT, BUILD_PROMPT } = require('../fixtures/E/build.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const REPO_STATIC = path.join(REPO_ROOT, '.aoforge', 'objectives', '81-haiku-eval-and-model-efficiency-measurement', 'results', 'static-prompt.json');
const REPORT_NAME = '81-MEASUREMENT.md';
const VERSIONS = ['3.0.0', '3.1.0'];
const WORKFLOWS = ['quick', 'build'];
const METRICS = ['first_turn_input', 'total_tokens', 'cache_writes', 'cost_usd', 'wall_s'];
const NOT_RUN = ['dry_run', 'skipped_budget'];
const COST_TOLERANCE = 0.1;
const ROLE_ORDER = ['orchestrator', 'planner', 'job-checker', 'executor', 'verifier'];
const OUTPUT_KEYS = ['acceptance', 'tests', 'verification_status', 'trd_count', 'summaries', 'git_log_subjects'];
const BASE_COMMITS = describeFixture().commits.length;
const NOT_A_SPAWN = 'n/a (not a spawn)';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v) => (isNum(v) ? v : null);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const round2 = (x) => Math.round(x * 100) / 100;

function readJsonIf(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`score E: ${file} is not valid JSON: ${err.message}`);
  }
}

/** stats(values) -> {n, median, mean, min, max} over the finite numbers (nulls when there are none). */
function stats(values) {
  const v = values.filter(isNum).sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, median: null, mean: null, min: null, max: null };
  const n = v.length;
  const median = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  return { n, median: round6(median), mean: round6(v.reduce((s, x) => s + x, 0) / n), min: round6(v[0]), max: round6(v[n - 1]) };
}

/** The run's collect outputs and where they came from. */
function readOutputs(runDir, record) {
  if (isObj(record) && isObj(record.outputs) && 'acceptance' in record.outputs) return record.outputs;
  const dir = path.join(runDir, 'outputs');
  if (!fs.existsSync(dir)) return null;
  for (const name of ['outputs.json', 'collect.json']) {
    const v = readJsonIf(path.join(dir, name));
    if (isObj(v) && 'acceptance' in v) return v;
  }
  if (fs.existsSync(path.join(dir, 'acceptance.json'))) {
    const out = {};
    for (const key of OUTPUT_KEYS) {
      const file = path.join(dir, `${key}.json`);
      out[key] = fs.existsSync(file) ? readJsonIf(file) : null;
    }
    return out;
  }
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const v = readJsonIf(path.join(dir, name));
    if (isObj(v) && 'acceptance' in v) return v;
  }
  return null;
}

const usd4 = (x) => `$${x.toFixed(4)}`;

/** One per-run row (see the module comment). */
function runRow(id, record, outputs, roles) {
  const { workflow, version, rep } = E.parseId(id);
  const readable = roles.rows.filter((r) => r.readable);
  const orch = readable.find((r) => r.role === ORCHESTRATOR && !r.agent_id) || null;
  const usage = isObj(record.usage) ? record.usage : null;
  const reportedTotal = usage
    ? ['input', 'cache_creation', 'cache_read', 'output'].reduce((s, k) => s + (isNum(usage[k]) ? usage[k] : 0), 0)
    : null;
  const subjects = outputs && Array.isArray(outputs.git_log_subjects) ? outputs.git_log_subjects : null;
  const tests = outputs && isObj(outputs.tests) ? outputs.tests : null;
  let wall = null;
  if (isNum(record.wall_ms)) wall = record.wall_ms / 1000;
  else if (isNum(record.duration_ms)) wall = record.duration_ms / 1000;
  else if (orch) wall = orch.wall_s;

  const row = {
    id,
    version,
    workflow,
    rep,
    order: E.RUN_ORDER.indexOf(id),
    status: record.status,
    session_model: typeof record.model === 'string' ? record.model : null,
    requested_model_id: typeof record.requested_model_id === 'string' ? record.requested_model_id : null,
    cost_usd: numOrNull(record.cost_usd),
    transcript_cost_usd: numOrNull(record.transcript_cost_usd),
    priced_cost_usd: roles.cost_usd,
    charged_usd: numOrNull(record.charged_usd),
    cost_source: typeof record.cost_source === 'string' ? record.cost_source : null,
    first_turn_input: orch ? orch.first_turn_input : numOrNull(record.first_turn_input),
    first_turn_source: orch ? 'transcript' : (isNum(record.first_turn_input) ? 'reported' : null),
    total_tokens: readable.length ? readable.reduce((s, r) => s + r.total_tokens, 0) : reportedTotal,
    cache_writes: readable.length ? readable.reduce((s, r) => s + r.cache_writes, 0) : (usage ? numOrNull(usage.cache_creation) : null),
    tokens_source: readable.length ? 'transcripts' : (usage ? 'reported' : null),
    wall_s: wall === null ? null : round6(wall),
    spawns: roles.spawns,
    transcripts: roles.readable ? (roles.unreadable.length ? 'partly unreadable' : 'readable') : 'unreadable',
    acceptance: outputs && isObj(outputs.acceptance) && typeof outputs.acceptance.pass === 'boolean' ? outputs.acceptance.pass : null,
    tests_ok: tests && typeof tests.ok === 'boolean' ? tests.ok : null,
    tests_pass: tests ? numOrNull(tests.pass) : null,
    tests_fail: tests ? numOrNull(tests.fail) : null,
    verification_status: outputs && typeof outputs.verification_status === 'string' ? outputs.verification_status : null,
    trd_count: outputs ? numOrNull(outputs.trd_count) : null,
    summaries: outputs ? numOrNull(outputs.summaries) : null,
    upgrade_commit: subjects ? subjects.some((s) => E.UPGRADE_SUBJECT.test(s)) : null,
    new_commits: subjects ? subjects.length - BASE_COMMITS : null,
    flags: [],
  };

  if (row.status !== 'ok') row.flags.push(`status ${row.status}: reported per run, left out of the role cells`);
  if (row.cost_usd === null) {
    row.flags.push('no reported cost (the ledger charged the transcript cost or the reserve)');
  } else if (row.priced_cost_usd !== null && row.cost_usd > 0) {
    const rel = (row.priced_cost_usd - row.cost_usd) / row.cost_usd;
    if (Math.abs(rel) > COST_TOLERANCE) {
      row.flags.push(`priced transcript cost ${usd4(row.priced_cost_usd)} is ${(Math.abs(rel) * 100).toFixed(1)}% `
        + `${rel > 0 ? 'above' : 'below'} the reported ${usd4(row.cost_usd)} (cache-tier pricing, a side model, or a `
        + 'reported cost without subagents); both kept');
    }
  }
  if (!roles.readable) row.flags.push(`transcripts unreadable (${roles.reason}): CLI-reported totals used`);
  else if (roles.unreadable.length) row.flags.push(`transcripts partly unreadable: ${roles.unreadable.join(', ')}`);
  if (roles.partial) row.flags.push(`${roles.unpriced_messages} transcript message(s) with no rate in model-rates.json`);
  if (!outputs) row.flags.push('no collect outputs');
  return row;
}

function emptyGrid(make) {
  const out = {};
  for (const v of VERSIONS) {
    out[v] = {};
    for (const w of WORKFLOWS) out[v][w] = make(v, w);
  }
  return out;
}

const roleRank = (role) => {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
};
const sortRoles = (roles) => [...roles].sort((a, b) => roleRank(a) - roleRank(b) || (a < b ? -1 : a > b ? 1 : 0));

function loadStatic(outDir, fallback) {
  const own = outDir ? path.join(outDir, 'results', 'static-prompt.json') : null;
  for (const [source, file] of [['out', own], ['fallback', fallback]]) {
    if (!file || !fs.existsSync(file)) continue;
    return { source, path: file, data: readJsonIf(file) };
  }
  return { source: null, path: null, data: null };
}

function staticFor(role, loaded) {
  if (role === ORCHESTRATOR) return { na: NOT_A_SPAWN };
  if (!loaded.data) return { na: 'n/a (static-prompt.json not found)' };
  const agents = Array.isArray(loaded.data.agents) ? loaded.data.agents : [];
  const a = agents.find((x) => isObj(x) && x.name === role);
  if (!a || !isObj(a.resident_bytes)) return { na: 'n/a (no static row)' };
  const b = a.resident_bytes;
  const t = isObj(a.resident_tokens) ? a.resident_tokens : {};
  return {
    from_bytes: numOrNull(b.from),
    to_bytes: numOrNull(b.to),
    delta_bytes: numOrNull(b.delta_bytes),
    delta_pct: numOrNull(b.delta_pct),
    from_tokens: numOrNull(t.from),
    to_tokens: numOrNull(t.to),
    delta_tokens: numOrNull(t.delta_tokens),
  };
}

function delta(from, to) {
  if (!isNum(from.median) || !isNum(to.median)) return { median: null, mean: null, median_pct: null };
  return {
    median: round6(to.median - from.median),
    mean: isNum(from.mean) && isNum(to.mean) ? round6(to.mean - from.mean) : null,
    median_pct: from.median !== 0 ? round2(((to.median - from.median) / from.median) * 100) : null,
  };
}

/**
 * score({root, outDir, rates?, staticFallback?, now?}) -> the batch E result with extra_files.
 * rates: a loadRates() object (default: loadRates() inside rolesForRun); staticFallback: a static-prompt.json path
 * used when the out dir has none (default this repository's committed copy; null for none); now() -> Date.
 */
function score({ root, outDir, rates, staticFallback = REPO_STATIC, now = () => new Date() } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score E: root is required');
  const runsDir = path.join(root, 'runs', 'E');
  const runs = [];
  const excluded = [];
  const cells = emptyGrid(() => ({}));

  for (const id of E.RUN_ORDER) {
    const runDir = path.join(runsDir, id);
    const record = readJsonIf(path.join(runDir, 'record.json'));
    if (!isObj(record)) {
      excluded.push({ id, reason: 'not run (no record)' });
      continue;
    }
    if (NOT_RUN.includes(record.status)) {
      excluded.push({ id, reason: `not run (${record.status})` });
      continue;
    }
    const roles = rolesForRun(runDir, rates ? { rates } : {});
    const outputs = readOutputs(runDir, record);
    const row = runRow(id, record, outputs, roles);
    runs.push(row);
    if (row.status !== 'ok') {
      excluded.push({ id, reason: `status ${row.status}: per run only, not in the role cells` });
      continue;
    }
    const grid = cells[row.version][row.workflow];
    for (const r of roles.rows) {
      const cell = grid[r.role] || (grid[r.role] = { rows: [], runs: new Set(), unreadable: 0 });
      if (!r.readable) {
        cell.unreadable += 1;
        continue;
      }
      cell.rows.push(r);
      cell.runs.add(id);
    }
  }

  const perRole = emptyGrid(() => ({}));
  for (const v of VERSIONS) {
    for (const w of WORKFLOWS) {
      for (const role of sortRoles(Object.keys(cells[v][w]))) {
        const c = cells[v][w][role];
        if (c.rows.length === 0) continue;
        const entry = { spawns: c.rows.length, runs: c.runs.size, unreadable: c.unreadable };
        for (const m of METRICS) entry[m] = stats(c.rows.map((r) => r[m]));
        entry.models = [...new Set(c.rows.map((r) => r.model).filter(Boolean))].sort();
        perRole[v][w][role] = entry;
      }
    }
  }

  const deltas = {};
  for (const w of WORKFLOWS) {
    deltas[w] = {};
    const roles = sortRoles(new Set([...Object.keys(perRole['3.0.0'][w]), ...Object.keys(perRole['3.1.0'][w])]));
    for (const role of roles) {
      const from = perRole['3.0.0'][w][role];
      const to = perRole['3.1.0'][w][role];
      if (!from || !to) {
        deltas[w][role] = { only: from ? '3.0.0' : '3.1.0' };
        continue;
      }
      deltas[w][role] = {};
      for (const m of METRICS) deltas[w][role][m] = delta(from[m], to[m]);
    }
  }

  const loaded = loadStatic(outDir, staticFallback);
  const seen = new Set(ROLE_ORDER);
  for (const v of VERSIONS) for (const w of WORKFLOWS) for (const role of Object.keys(perRole[v][w])) seen.add(role);
  const staticRoles = {};
  for (const role of sortRoles(seen)) staticRoles[role] = staticFor(role, loaded);
  const staticBlock = {
    source: loaded.source,
    path: loaded.path,
    from: loaded.data && isObj(loaded.data.from) ? { ref: loaded.data.from.ref || null, sha: loaded.data.from.sha || null } : null,
    to: loaded.data && isObj(loaded.data.to) ? { ref: loaded.data.to.ref || null, sha: loaded.data.to.sha || null } : null,
    roles: staticRoles,
  };

  const outcomes = emptyGrid((v, w) => {
    const rows = runs.filter((r) => r.version === v && r.workflow === w);
    return {
      planned: E.RUN_ORDER.filter((id) => {
        const p = E.parseId(id);
        return p.version === v && p.workflow === w;
      }).length,
      recorded: rows.length,
      ok: rows.filter((r) => r.status === 'ok').length,
      acceptance_pass: rows.filter((r) => r.acceptance === true).length,
      acceptance_n: rows.filter((r) => r.acceptance !== null).length,
      tests_ok: rows.filter((r) => r.tests_ok === true).length,
      verification_passed: rows.filter((r) => r.verification_status === 'passed').length,
      verification_present: rows.filter((r) => r.verification_status !== null).length,
      trd_counts: rows.map((r) => r.trd_count).filter(isNum),
      upgrade_commits: rows.filter((r) => r.upgrade_commit === true).length,
      cost_usd: stats(rows.map((r) => r.cost_usd)),
      priced_cost_usd: stats(rows.map((r) => r.priced_cost_usd)),
      first_turn_input: stats(rows.map((r) => r.first_turn_input)),
      total_tokens: stats(rows.map((r) => r.total_tokens)),
      wall_s: stats(rows.map((r) => r.wall_s)),
    };
  });

  const models = [...new Set(runs.map((r) => r.session_model).filter(Boolean))].sort();
  const sessionModel = models.length === 0 ? null : (models.length === 1 ? models[0] : `mixed (${models.join(', ')})`);
  const flagged = runs.filter((r) => r.flags.length).map((r) => ({ id: r.id, flags: r.flags }));
  const upgraded = runs.filter((r) => r.version === '3.1.0');
  const notes = [
    `Session model ${sessionModel || 'n/a (no run recorded)'}, profile ${E.PROFILE}, the same for both versions.`,
    `3.1.0 runs include the SessionStart upgrade hook's commit (chore(aoforge): upgrade project to v3.1.0): `
      + `${upgraded.filter((r) => r.upgrade_commit === true).length} of ${upgraded.length} recorded 3.1.0 runs.`,
    'Role cells count only runs that ended ok, per spawn; n is spawns (runs).',
    'model_ran is not used for E: subagents run on their profile tiers by design.',
  ];
  if (flagged.length) notes.push(`Flagged runs: ${flagged.map((f) => f.id).join(', ')} (see 81-MEASUREMENT.md).`);

  const result = {
    batch: 'E',
    session_model: sessionModel,
    requested_model_ids: [...new Set(runs.map((r) => r.requested_model_id).filter(Boolean))].sort(),
    profile: E.PROFILE,
    workload: {
      project: describeFixture().name,
      quick_prompt: QUICK_PROMPT,
      build_prompt: BUILD_PROMPT,
      order: E.RUN_ORDER.slice(),
      pilots: E.PILOT_IDS.slice(),
    },
    planned: Object.fromEntries(VERSIONS.map((v) => [v, E.RUN_ORDER.filter((id) => E.parseId(id).version === v).length])),
    runs,
    per_role: perRole,
    deltas,
    outcomes,
    static: staticBlock,
    flagged,
    excluded,
    notes,
  };
  result.extra_files = { [REPORT_NAME]: renderMeasurement(result, { generatedAt: now().toISOString() }) };
  return result;
}

// ─── Rendering ──────────────────────────────────────────────────────────────────────────────────────────────

const NA = 'n/a';

/** 31000 -> "31,000"; -6000 -> "-6,000"; null -> "n/a". Rounded to an integer. */
function int(n) {
  if (!isNum(n)) return NA;
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return r < 0 ? `-${s}` : s;
}
const signedInt = (n) => (isNum(n) && Math.round(n) > 0 ? `+${int(n)}` : int(n));
const money = (n) => (isNum(n) ? n.toFixed(4) : NA);
const signedMoney = (n) => (isNum(n) && n > 0 ? `+${money(n)}` : money(n));
const pct = (n) => (isNum(n) ? `${n > 0 ? '+' : ''}${n.toFixed(2)}%` : NA);
const yesNo = (b) => (b === true ? 'yes' : b === false ? 'no' : NA);

/** A markdown code span that survives backticks inside the text. */
const code = (text) => (String(text).includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``);
/** A path inside this repository shown relative to its root; any other path as given. */
const shownPath = (p) => (p.startsWith(REPO_ROOT + path.sep) ? path.relative(REPO_ROOT, p) : p);

const fmtFor = (metric) => (metric === 'cost_usd' ? money : int);
const signedFor = (metric) => (metric === 'cost_usd' ? signedMoney : signedInt);

function pair(s, metric) {
  const f = fmtFor(metric);
  return `${f(s.median)} / ${f(s.mean)}`;
}

function deltaCell(d, metric) {
  const f = signedFor(metric);
  if (!d || d.median === null) return NA;
  return `${f(d.median)} (${pct(d.median_pct)}) / ${f(d.mean)}`;
}

function staticCell(s, version) {
  if (!s) return NA;
  if (s.na) return s.na;
  if (version === '3.0.0') return int(s.from_bytes);
  if (version === '3.1.0') return int(s.to_bytes);
  return `${int(s.from_bytes)} -> ${int(s.to_bytes)} (${signedInt(s.delta_bytes)})`;
}

function roleTable(result, workflow) {
  const lines = [];
  const roles = sortRoles(new Set([...Object.keys(result.per_role['3.0.0'][workflow]), ...Object.keys(result.per_role['3.1.0'][workflow])]));
  if (roles.length === 0) {
    lines.push(`No ${workflow} run ended ok with readable transcripts.`, '');
    return lines;
  }
  lines.push('| Role | Version | n spawns (runs) | First-turn input median / mean | Total tokens median / mean '
    + '| Cache writes median / mean | Cost USD median / mean | Wall s median / mean | Static resident bytes |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const role of roles) {
    const s = result.static.roles[role] || { na: 'n/a (no static row)' };
    for (const v of VERSIONS) {
      const c = result.per_role[v][workflow][role];
      if (!c) {
        lines.push(`| ${role} | ${v} | 0 (0) | ${NA} | ${NA} | ${NA} | ${NA} | ${NA} | ${staticCell(s, v)} |`);
        continue;
      }
      lines.push(`| ${role} | ${v} | ${c.spawns} (${c.runs}) | ${METRICS.map((m) => pair(c[m], m)).join(' | ')} | ${staticCell(s, v)} |`);
    }
    const d = result.deltas[workflow][role];
    const cellsText = d && !d.only ? METRICS.map((m) => deltaCell(d[m], m)).join(' | ') : METRICS.map(() => NA).join(' | ');
    lines.push(`| ${role} | 3.1.0 - 3.0.0 | | ${cellsText} | ${staticCell(s, 'delta')} |`);
  }
  lines.push('');
  return lines;
}

function outcomesTable(result) {
  const lines = [
    '| Version | Workflow | Planned | Recorded | Ended ok | Acceptance pass | Tests green | Verification passed (present) '
      + '| TRDs per run | Upgrade commit | Reported cost median / mean | Priced cost median / mean | Wall s median / mean |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const w of WORKFLOWS) {
    for (const v of VERSIONS) {
      const o = result.outcomes[v][w];
      lines.push(`| ${v} | ${w} | ${o.planned} | ${o.recorded} | ${o.ok} | ${o.acceptance_pass}/${o.acceptance_n} `
        + `| ${o.tests_ok}/${o.recorded} | ${o.verification_passed} (${o.verification_present}) `
        + `| ${o.trd_counts.length ? o.trd_counts.join(', ') : NA} | ${o.upgrade_commits}/${o.recorded} `
        + `| ${pair(o.cost_usd, 'cost_usd')} | ${pair(o.priced_cost_usd, 'cost_usd')} | ${pair(o.wall_s, 'wall_s')} |`);
    }
  }
  lines.push('');
  return lines;
}

function spawnsText(spawns) {
  const entries = sortRoles(Object.keys(spawns || {})).map((role) => `${role} ${spawns[role]}`);
  return entries.length ? entries.join(', ') : NA;
}

function runTable(result) {
  const lines = [
    '| Run | Version | Workflow | Status | Reported cost | Priced cost | Charged | First-turn input | Total tokens '
      + '| Cache writes | Wall s | Acceptance | Tests | Verification | TRDs | SUMMARYs | Upgrade commit | Spawns |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of result.runs) {
    const tests = r.tests_ok === null ? NA : `${yesNo(r.tests_ok)} (${int(r.tests_pass)} pass, ${int(r.tests_fail)} fail)`;
    const src = (value, source) => (source === 'reported' ? `${value} (reported)` : value);
    lines.push(`| ${r.id} | ${r.version} | ${r.workflow} | ${r.status} | ${money(r.cost_usd)} | ${money(r.priced_cost_usd)} `
      + `| ${money(r.charged_usd)} | ${src(int(r.first_turn_input), r.first_turn_source)} `
      + `| ${src(int(r.total_tokens), r.tokens_source)} | ${src(int(r.cache_writes), r.tokens_source)} | ${int(r.wall_s)} `
      + `| ${yesNo(r.acceptance)} | ${tests} | ${r.verification_status || NA} | ${int(r.trd_count)} | ${int(r.summaries)} `
      + `| ${yesNo(r.upgrade_commit)} | ${spawnsText(r.spawns)} |`);
  }
  lines.push('');
  return lines;
}

/** renderMeasurement(result, {generatedAt}) -> the 76-08 report, 81-MEASUREMENT.md. */
function renderMeasurement(result, { generatedAt = null } = {}) {
  const sm = result.session_model || 'n/a (no run recorded)';
  const ids = result.requested_model_ids && result.requested_model_ids.length ? ` (${result.requested_model_ids.join(', ')})` : '';
  const recorded = result.runs.length;
  const planned = E.RUN_ORDER.length;
  const st = result.static;
  const lines = [
    '# 76-08 measurement: AOForge 3.0.0 vs 3.1.0 on one fixed workload',
    '',
    `- Session model: ${sm}${ids}`,
    `- Profile: ${result.profile} (the planner inherits the session model; executor, verifier and job-checker run sonnet; `
      + 'the same in both versions)',
    `- Runs recorded: ${recorded} of ${planned} planned (${VERSIONS.map((v) => `${v}: ${result.planned[v]}`).join(', ')})`,
    `- Scored: ${generatedAt || NA}`,
    '',
    '## Method',
    '',
    `- Workload, fixed for both versions: on the \`${result.workload.project}\` project (one small Node CLI, built `
      + 'byte-identical for every run by scripts/eval81/fixtures/E/build.cjs), per version three runs of '
      + `${code(result.workload.quick_prompt)} and two of ${code(result.workload.build_prompt)}.`,
    '- The two versions differ in the plugin tree only: same project bytes, same prompt, same session model, same env '
      + 'flags, caps and timeouts.',
    `- Order (interleaved, pilots first, ABBA within each workflow): ${result.workload.order.join(', ')}. The pilots are `
      + `${result.workload.pilots.join(', ')}.`,
    '- Outcomes are decided by hidden checks that never enter the project a session sees: quick, `list --json` on a '
      + 'seeded notes file prints exactly the seeded {id, text} array and `node --test` passes; build, `tag 1 work` then '
      + '`list --tag work` prints note 1 only, `node --test` passes, and the objective\'s VERIFICATION.md, when present, '
      + 'has status passed.',
    '- The project is stamped 3.0.0, so the 3.1.0 runs include the SessionStart upgrade hook\'s commit '
      + '(`chore(aoforge): upgrade project to v3.1.0`, code only, no tokens); the 3.0.0 runs have none.',
    '- Roles come from the copied transcripts: the main session is the orchestrator; each subagent is its meta '
      + '`agentType` without the `aoforge:` prefix.',
    '- First-turn input is input + cache creation + cache read of a spawn\'s first API message: the prompt it started '
      + 'with (system prompt, tools and spawn prompt). Total tokens add every later message and the output; cache writes '
      + 'are cache creation tokens.',
    '- Transcript cost is priced per message from references/model-rates.json (5-minute cache-write rate unless the '
      + '1-hour split is present). The CLI\'s reported cost is kept beside it, as reported; a run whose two figures '
      + 'differ by more than 10% is flagged and neither is overwritten. Charged is the ledger\'s figure (the larger).',
    '- Wall time per run is the runner\'s measured wall clock; per spawn it is the transcript\'s first-to-last timestamp.',
    '- Role statistics are per spawn, over the runs that ended ok; n is spawns (runs) and is shown in every cell. '
      + 'Deltas are 3.1.0 minus 3.0.0 of the medians (with the percentage of the 3.0.0 median) and of the means.',
    `- Static resident bytes per role are the 81-07 measurement (agent body + largest spawn prompt), read from `
      + `${st.path ? `${code(shownPath(st.path))} (${st.source === 'out' ? 'the out dir' : 'the fallback copy'})` : 'nowhere: static-prompt.json was not found'}`
      + `${st.from && st.to ? `, ${st.from.ref} ${String(st.from.sha || '').slice(0, 8)} vs ${st.to.ref} ${String(st.to.sha || '').slice(0, 8)}` : ''}. `
      + `The orchestrator is the session itself, so its static cell is "${NOT_A_SPAWN}".`,
    '- This report measures; it does not propose model tiers.',
    '',
  ];

  if (recorded === 0) {
    lines.push('No run has a record yet.', '');
  }

  lines.push('## Outcomes', '', ...outcomesTable(result));

  lines.push('## Per role', '');
  for (const w of WORKFLOWS) lines.push(`### ${w}`, '', ...roleTable(result, w));

  lines.push('## Per run', '');
  if (recorded === 0) lines.push('No run has a record yet.', '');
  else lines.push(...runTable(result));

  lines.push('## Flagged runs', '');
  if (result.flagged.length === 0) lines.push('None.', '');
  else {
    for (const f of result.flagged) for (const flag of f.flags) lines.push(`- ${f.id}: ${flag}`);
    lines.push('');
  }

  const notRun = result.excluded.filter((e) => /^not run/.test(e.reason));
  lines.push('## Not run', '');
  if (notRun.length === 0) lines.push('None.', '');
  else {
    for (const e of notRun) lines.push(`- ${e.id}: ${e.reason}`);
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

module.exports = { score, renderMeasurement, stats, REPORT_NAME, REPO_STATIC };
