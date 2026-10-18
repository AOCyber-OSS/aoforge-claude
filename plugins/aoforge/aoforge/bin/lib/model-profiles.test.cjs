'use strict';

/**
 * model-profiles.test.cjs — TRD 28-02
 *
 * Asserts the model profile table actually BINDS. The 2026-08-18 audit found it
 * did not: profile keys carried a `df-` prefix, the three skills that call
 * `aof-tools resolve-model` passed un-prefixed names, and the miss fell through
 * to a hard-coded 'sonnet' — silently, for every agent, regardless of profile.
 * Nothing failed loudly, so the whole table looked like it was working.
 *
 * These tests are the mechanical guard against that class of drift:
 *   - agent files and profile entries stay in one-to-one correspondence
 *   - a prefixed spelling is an unknown agent (quick 40 removed the pre-plugin df- alias)
 *   - every tier names a real model id
 *   - resolution is auditable (tier + concrete id, not just an alias)
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..', '..', '..', '..');
const PROFILES_PATH = path.join(__dirname, '..', '..', 'references', 'model-profiles.json');
const AGENTS_DIR = path.join(__dirname, '..', '..', '..', 'agents');
const DF_TOOLS = path.join(__dirname, '..', 'aof-tools.cjs');

const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
const agentFiles = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
const agentNames = agentFiles.map(f => f.replace(/\.md$/, '')).sort();
const profileKeys = Object.keys(profiles.agents).sort();

function resolveModel(agentKey) {
  const r = spawnSync(process.execPath, [DF_TOOLS, 'resolve-model', agentKey], {
    cwd: REPO, encoding: 'utf8',
  });
  try { return JSON.parse(r.stdout); } catch { return { _raw: r.stdout, _err: r.stderr }; }
}

describe('TRD 28-02 — the model profile table binds', () => {
  test('every agent on disk has a profile entry', () => {
    const missing = agentNames.filter(a => !profileKeys.includes(a));
    assert.deepEqual(missing, [], `agents with no profile entry: ${missing.join(', ')}`);
  });

  test('every profile entry corresponds to an agent on disk (no orphans)', () => {
    const orphans = profileKeys.filter(k => !agentNames.includes(k));
    assert.deepEqual(orphans, [], `profile entries with no agent file: ${orphans.join(', ')}`);
  });

  test('profile keys are canonical — no df- prefix in the table', () => {
    const prefixed = profileKeys.filter(k => k.startsWith('df-'));
    assert.deepEqual(prefixed, [], `df- prefixed keys must be canonicalised: ${prefixed.join(', ')}`);
  });

  test('every tier referenced by an agent exists in models{}', () => {
    const tiers = new Set();
    for (const entry of Object.values(profiles.agents)) {
      for (const tier of Object.values(entry)) tiers.add(tier);
    }
    const unknown = [...tiers].filter(t => !profiles.models[t]);
    assert.deepEqual(unknown, [], `tiers with no model id: ${unknown.join(', ')}`);
  });

  test('model ids carry no deprecated date suffix', () => {
    for (const [tier, id] of Object.entries(profiles.models)) {
      assert.ok(
        !/-\d{8}$/.test(id),
        `models.${tier} = "${id}" has a date suffix; use the undated id`
      );
    }
  });

  test('every agent declares all three profile tiers', () => {
    for (const [agent, entry] of Object.entries(profiles.agents)) {
      for (const profile of ['quality', 'balanced', 'budget']) {
        assert.ok(entry[profile], `agents.${agent} is missing the "${profile}" tier`);
      }
    }
  });
});

describe('TRD 28-02 — resolve-model resolution is correct and auditable', () => {
  // quick 40: the pre-plugin `df-` alias is gone. A prefixed name is an unknown agent like any other: exit 0, a
  // stderr warning and the `sonnet` fallback, the same shape as `resolve-model no-such-agent`.
  test('a df- prefixed agent name is an unknown agent', () => {
    for (const agent of agentNames) {
      const name = `df-${agent}`;
      const r = spawnSync(process.execPath, [DF_TOOLS, 'resolve-model', name], { cwd: REPO, encoding: 'utf8' });
      assert.equal(r.status, 0, `${name}: exit ${r.status}: ${r.stderr}`);
      const out = JSON.parse(r.stdout);
      assert.equal(out.unknown_agent, true, `${name}: expected unknown_agent, got ${r.stdout}`);
      assert.equal(out.model, 'sonnet', `${name}: expected the sonnet fallback`);
      assert.equal(out.requested, name);
      assert.ok(r.stderr.includes(`unknown agent "${name}"`), `${name}: no unknown-agent warning on stderr: ${r.stderr}`);
    }
  });

  test('no known agent falls through to the unknown-agent default', () => {
    const fellThrough = agentNames.filter(a => resolveModel(a).unknown_agent === true);
    assert.deepEqual(fellThrough, [],
      `these resolved via the silent 'sonnet' fallback: ${fellThrough.join(', ')}`);
  });

  test('resolution reports tier and concrete model id, not just the alias', () => {
    const r = resolveModel('planner');
    assert.equal(r.agent, 'planner');
    assert.ok(r.tier, 'expected a tier in the result');
    assert.ok(r.model_id, 'expected a concrete model_id in the result');
    assert.equal(r.model_id, profiles.models[r.tier]);
  });

  test('opus tier maps to the inherit alias (agent keeps the session model)', () => {
    const r = resolveModel('planner'); // opus at the balanced profile
    assert.equal(r.tier, 'opus');
    assert.equal(r.model, 'inherit');
  });

  test('an unknown agent is flagged, not silently defaulted', () => {
    const r = resolveModel('definitely-not-an-agent');
    assert.equal(r.unknown_agent, true);
    assert.equal(r.model, 'sonnet');
    assert.equal(r.requested, 'definitely-not-an-agent');
  });
});

describe('TRD 28-02 — agent frontmatter is consistent with the tier table', () => {
  // Haiku 4.5 REJECTS the `effort` parameter (it is supported from Opus 4.5 /
  // Sonnet 5 upward). An agent that can resolve to the haiku tier must not
  // declare effort in frontmatter, or that run 400s.
  test('no agent that can resolve to haiku declares an effort in frontmatter', () => {
    const offenders = [];
    for (const agent of agentNames) {
      const entry = profiles.agents[agent] || {};
      const canBeHaiku = Object.values(entry).includes('haiku');
      if (!canBeHaiku) continue;
      const fm = fs.readFileSync(path.join(AGENTS_DIR, `${agent}.md`), 'utf8').split('---')[1] || '';
      if (/^effort:/m.test(fm)) offenders.push(agent);
    }
    assert.deepEqual(offenders, [],
      `these can resolve to haiku but declare effort (Haiku 4.5 rejects it): ${offenders.join(', ')}`);
  });

  test('any declared effort is a valid level', () => {
    const VALID = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
    for (const agent of agentNames) {
      const fm = fs.readFileSync(path.join(AGENTS_DIR, `${agent}.md`), 'utf8').split('---')[1] || '';
      const m = /^effort:\s*(\S+)/m.exec(fm);
      if (!m) continue;
      assert.ok(VALID.has(m[1]), `${agent}: effort "${m[1]}" is not a valid level`);
    }
  });
});

// ---------------------------------------------------------------------------
// TRD 41-07 — the reference's effort column is pinned to agent frontmatter.
//
// 28-03 added `effort: xhigh` to planner.md and `effort: high` to
// ui-evaluator.md. The PR #68 merge (b657033) dropped both lines and reverted
// ui-evaluator.md's body to the obsolete `df-ui-evaluator` key. CI stayed green
// because nothing tied references/model-profiles.md to the frontmatter.
//
// model-profiles.json deliberately does NOT carry effort (Task() takes no
// effort argument), and no generator writes the .md — so the .md table is the
// canonical effort source and these tests compare it against the agent files.
// ---------------------------------------------------------------------------

const PROFILES_MD_PATH = path.join(__dirname, '..', '..', 'references', 'model-profiles.md');
const SKILLS_DIR = path.join(__dirname, '..', '..', '..', 'skills');
const WORKFLOWS_DIR = path.join(__dirname, '..', '..', 'workflows');

// Parse the "## Profile Definitions" table only. The same file also has a
// "Tier → model id" table whose rows (`opus`, `sonnet`, `haiku`) match the
// same row shape, so the scan stops at the next `## ` heading.
function readEffortTable() {
  const lines = fs.readFileSync(PROFILES_MD_PATH, 'utf8').split('\n');
  const start = lines.findIndex(l => /^##\s+Profile Definitions\b/.test(l));
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    if (!/^\|\s*`([a-z-]+)`\s*\|/.test(line)) continue;
    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    const agent = cells[0].replace(/`/g, '');
    const raw = cells[cells.length - 1];
    const effort = (raw === '—' || raw === '-') ? null : raw;
    rows.push({ agent, effort, line: i + 1 });
  }
  return rows;
}

function frontmatterEffort(agent) {
  const file = path.join(AGENTS_DIR, `${agent}.md`);
  if (!fs.existsSync(file)) return undefined;
  const fm = fs.readFileSync(file, 'utf8').split('---')[1] || '';
  const m = /^effort:\s*(\S+)/m.exec(fm);
  return m ? m[1] : null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('TRD 41-07 — reference effort column matches agent frontmatter', () => {
  const rows = readEffortTable();

  test('every profile key has exactly one row in the Profile Definitions table', () => {
    const counts = new Map();
    for (const r of rows) counts.set(r.agent, (counts.get(r.agent) || 0) + 1);
    const missing = profileKeys.filter(k => !counts.has(k));
    const duplicated = profileKeys.filter(k => (counts.get(k) || 0) > 1);
    assert.deepEqual(missing, [],
      `model-profiles.json agents with no row in references/model-profiles.md: ${missing.join(', ')} ` +
      `(parsed ${rows.length} rows)`);
    assert.deepEqual(duplicated, [],
      `agents with more than one row in references/model-profiles.md: ${duplicated.join(', ')}`);
  });

  test('documented effort equals frontmatter effort for every row (— means none)', () => {
    assert.ok(rows.length >= profileKeys.length,
      `parsed only ${rows.length} table rows; expected at least ${profileKeys.length} — the row regex is too strict`);
    const mismatches = [];
    for (const { agent, effort } of rows) {
      const fm = frontmatterEffort(agent);
      if (fm === undefined) {
        mismatches.push(`${agent}: documented ${effort || 'none'}, no agent file`);
        continue;
      }
      if ((effort || null) !== (fm || null)) {
        mismatches.push(`${agent}: documented ${effort || 'none'}, frontmatter ${fm || 'none'}`);
      }
    }
    assert.deepEqual(mismatches, [],
      `agent frontmatter effort drifted from references/model-profiles.md:\n  ${mismatches.join('\n  ')}`);
  });

  test('no agent, skill or workflow prompt names a profile key with the obsolete df- prefix', () => {
    const keys = Object.keys(profiles.agents).map(escapeRe);
    const re = new RegExp('`df-(' + keys.join('|') + ')`');

    const files = [];
    for (const f of fs.readdirSync(AGENTS_DIR)) {
      if (f.endsWith('.md')) files.push(path.join(AGENTS_DIR, f));
    }
    for (const f of fs.readdirSync(SKILLS_DIR, { recursive: true })) {
      if (path.basename(f) === 'SKILL.md') files.push(path.join(SKILLS_DIR, f));
    }
    for (const f of fs.readdirSync(WORKFLOWS_DIR, { recursive: true })) {
      if (String(f).endsWith('.md')) files.push(path.join(WORKFLOWS_DIR, f));
    }

    const hits = [];
    for (const file of files.sort()) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const m = re.exec(line);
        if (m) hits.push(`${path.relative(REPO, file)}:${i + 1} (\`df-${m[1]}\`)`);
      });
    }
    assert.deepEqual(hits, [],
      `obsolete df- profile keys (canonical keys have no prefix):\n  ${hits.join('\n  ')}`);
  });
});

describe('TRD 76-06 — per-focus tiers and the verdict floor', () => {
  const os = require('os');
  function project(config) {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mp-7606-'));
    fs.mkdirSync(path.join(dir, '.aoforge'));
    fs.writeFileSync(path.join(dir, '.aoforge', 'config.json'), JSON.stringify(config));
    return dir;
  }
  function resolveIn(dir, ...args) {
    const r = spawnSync(process.execPath, [DF_TOOLS, 'resolve-model', ...args], { cwd: dir, encoding: 'utf8' });
    return JSON.parse(r.stdout);
  }

  test('every focus entry names a known agent and known tiers', () => {
    for (const [agent, foci] of Object.entries(profiles.focus || {})) {
      assert.ok(profiles.agents[agent], `focus.${agent} names no agent`);
      for (const [focus, entry] of Object.entries(foci)) {
        for (const tier of Object.values(entry)) assert.ok(profiles.models[tier], `focus.${agent}.${focus}: unknown tier ${tier}`);
      }
    }
  });

  test('focus entries only raise a tier (a lower one needs a recorded eval first)', () => {
    const rank = { haiku: 0, sonnet: 1, opus: 2 };
    for (const [agent, foci] of Object.entries(profiles.focus || {})) {
      for (const [focus, entry] of Object.entries(foci)) {
        for (const [p, tier] of Object.entries(entry)) {
          assert.ok(rank[tier] >= rank[profiles.agents[agent][p]], `focus.${agent}.${focus}.${p} lowers ${profiles.agents[agent][p]} to ${tier}`);
        }
      }
    }
  });

  test('--focus applies the focus tiers; an unknown focus changes nothing', () => {
    const dir = project({ model_profile: 'balanced' });
    try {
      assert.equal(resolveIn(dir, 'codebase-mapper').tier, profiles.agents['codebase-mapper'].balanced);
      const concerns = resolveIn(dir, 'codebase-mapper', '--focus', 'concerns');
      assert.equal(concerns.tier, profiles.focus['codebase-mapper'].concerns.balanced);
      assert.equal(concerns.focus, 'concerns');
      assert.equal(resolveIn(dir, 'codebase-mapper', '--focus', 'nope').tier, profiles.agents['codebase-mapper'].balanced);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('verdict agents resolve at or above the floor on every profile, agent_models included', () => {
    const rank = { haiku: 0, sonnet: 1, opus: 2 };
    const floor = profiles.verdict_floor.tier;
    for (const agent of profiles.verdict_floor.agents) {
      for (const p of ['quality', 'balanced', 'budget']) {
        assert.ok(rank[profiles.agents[agent][p]] >= rank[floor], `agents.${agent}.${p} is below the verdict floor`);
      }
    }
    // quick 35: the planner entry proves the project's agent_models is read at all. Before, loadConfig dropped the
    // key, so the verifier assertion passed on the table row alone and said nothing about the floor.
    const dir = project({ model_profile: 'budget', agent_models: { verifier: { budget: 'haiku' }, planner: { budget: 'haiku' } } });
    try {
      const verifier = resolveIn(dir, 'verifier');
      assert.equal(verifier.tier, floor, 'a project agent_models entry cannot drop a verdict below the floor');
      assert.equal(verifier.tier_source, 'verdict_floor');
      assert.equal(resolveIn(dir, 'job-checker').tier, floor);
      const planner = resolveIn(dir, 'planner');
      assert.equal(planner.tier, 'haiku', 'a non-verdict agent_models entry changes its tier');
      assert.equal(planner.tier_source, 'agent_models');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('init map-codebase and new-project emit one model per focus', () => {
    const dir = project({ model_profile: 'balanced' });
    try {
      const run = (wf) => JSON.parse(spawnSync(process.execPath, [DF_TOOLS, 'init', wf], { cwd: dir, encoding: 'utf8' }).stdout);
      assert.deepEqual(Object.keys(run('map-codebase').mapper_models), ['tech', 'arch', 'quality', 'concerns']);
      assert.deepEqual(Object.keys(run('new-project').researcher_models), ['stack', 'features', 'architecture', 'pitfalls']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('TRD 76-07 — escalation re-spawns one rung up', () => {
  function esc(from) {
    const r = spawnSync(process.execPath, [DF_TOOLS, 'resolve-model', 'debugger', '--escalate-from', from], { cwd: REPO, encoding: 'utf8' });
    return { status: r.status, out: r.status === 0 ? JSON.parse(r.stdout) : null, stderr: r.stderr };
  }

  test('each rung escalates to the next; opus (or inherit, or its id) is the ceiling', () => {
    assert.deepEqual([esc('haiku').out.tier, esc('haiku').out.ceiling], ['sonnet', false]);
    assert.deepEqual([esc('sonnet').out.tier, esc('sonnet').out.model], ['opus', 'inherit']);
    for (const top of ['opus', 'inherit', profiles.models.opus]) {
      const r = esc(top).out;
      assert.equal(r.ceiling, true, top);
      assert.equal(r.escalated_from, 'opus', top);
    }
    assert.equal(esc(profiles.models.haiku).out.tier, 'sonnet');
  });

  test('an unrecognised rung is refused, not guessed', () => {
    const r = esc('gpt-9');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--escalate-from/);
  });

  test('the orchestrators act on ESCALATION REQUESTED instead of failing it', () => {
    const PLUGIN = path.join(__dirname, '..', '..', '..');
    const read = (rel) => fs.readFileSync(path.join(PLUGIN, rel), 'utf8');
    for (const rel of ['aoforge/workflows/execute-objective.md', 'skills/debug/SKILL.md', 'aoforge/workflows/diagnose-issues.md']) {
      assert.match(read(rel), /ESCALATION REQUESTED[\s\S]*--escalate-from/, `${rel} must re-spawn one rung up`);
    }
    assert.match(read('agents/debugger.md'), /## ESCALATION REQUESTED/);
  });
});

// quick 35: loadConfig dropped `agent_models` and `model_overrides`, so neither ever reached a spawn, and
// cmdResolveModel never read `model_overrides` at all. Precedence, highest first: --escalate-from,
// model_overrides (unfloored), the project agent_models tier, the focus tier, the package table row; the verdict
// floor applies to the last three. One resolver serves resolve-model and every init command.
describe('quick 35 — project model settings bind', () => {
  const os = require('os');
  function project(config, { objectiveDir } = {}) {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mp-q35-'));
    fs.mkdirSync(path.join(dir, '.aoforge'));
    fs.mkdirSync(path.join(dir, 'home'));
    fs.writeFileSync(path.join(dir, '.aoforge', 'config.json'), JSON.stringify(config));
    if (objectiveDir) fs.mkdirSync(path.join(dir, '.aoforge', 'objectives', objectiveDir), { recursive: true });
    return dir;
  }
  function aof(dir, args) {
    const env = { ...process.env, HOME: path.join(dir, 'home') };
    delete env.AOFORGE_STACKS_DIR;
    const r = spawnSync(process.execPath, [DF_TOOLS, ...args], { cwd: dir, encoding: 'utf8', env });
    assert.equal(r.status, 0, `aof-tools ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  }
  const resolveIn = (dir, ...args) => JSON.parse(aof(dir, ['resolve-model', ...args]));
  const rawIn = (dir, ...args) => aof(dir, ['resolve-model', ...args, '--raw']);
  const done = (dir) => fs.rmSync(dir, { recursive: true, force: true });

  test('1. agent_models binds: resolve-model planner gives the project tier, --raw prints it', () => {
    const dir = project({ model_profile: 'quality', agent_models: { planner: { quality: 'haiku' } } });
    try {
      const r = resolveIn(dir, 'planner');
      assert.equal(r.tier, 'haiku');
      assert.equal(r.tier_source, 'agent_models');
      assert.equal(r.model_id, profiles.models.haiku);
      assert.equal(rawIn(dir, 'planner'), 'haiku');
    } finally { done(dir); }
  });

  test('2. model_overrides binds in resolve-model', () => {
    const dir = project({ model_overrides: { debugger: 'haiku' } });
    try {
      assert.equal(rawIn(dir, 'debugger'), 'haiku');
      const r = resolveIn(dir, 'debugger');
      assert.equal(r.tier, 'haiku');
      assert.equal(r.tier_source, 'model_overrides');
    } finally { done(dir); }
  });

  test('3. init execute-objective and init quick agree with resolve-model', () => {
    const dir = project({ model_profile: 'quality', model_overrides: { executor: 'haiku' } }, { objectiveDir: '01-x' });
    try {
      const cli = rawIn(dir, 'executor');
      assert.equal(cli, 'haiku');
      assert.equal(JSON.parse(aof(dir, ['init', 'execute-objective', '1'])).executor_model, cli);
      assert.equal(JSON.parse(aof(dir, ['init', 'quick', 'x'])).executor_model, cli);
    } finally { done(dir); }
  });

  test('4. model_overrides is not floored: a verdict agent can be pinned below the floor', () => {
    const dir = project({ model_profile: 'budget', model_overrides: { verifier: 'haiku' } });
    try {
      const r = resolveIn(dir, 'verifier');
      assert.equal(r.tier, 'haiku');
      assert.equal(r.tier_source, 'model_overrides');
    } finally { done(dir); }
  });

  test('6. agent_models beats the focus tier', () => {
    const dir = project({ model_profile: 'balanced', agent_models: { 'codebase-mapper': { balanced: 'haiku' } } });
    try {
      const r = resolveIn(dir, 'codebase-mapper', '--focus', 'concerns');
      assert.equal(r.tier, 'haiku');
      assert.equal(r.tier_source, 'agent_models');
      assert.equal(r.focus, 'concerns');
    } finally { done(dir); }
  });

  // quick 40: only the bare key binds. A `df-` spelled key names an agent that does not exist, so the table applies.
  test('7. a df- prefixed agent_models key does not bind: the table tier applies', () => {
    const dir = project({ model_profile: 'quality', agent_models: { 'df-planner': { quality: 'haiku' } } });
    try {
      const r = resolveIn(dir, 'planner');
      assert.equal(r.tier_source, 'table');
      assert.equal(r.tier, profiles.agents.planner.quality);
    } finally { done(dir); }
  });

  test('7b. a df- prefixed model_overrides key does not bind', () => {
    const dir = project({ model_overrides: { 'df-debugger': 'haiku' } });
    try {
      const r = resolveIn(dir, 'debugger');
      assert.equal(r.tier_source, 'table');
      assert.equal(r.tier, profiles.agents.debugger.balanced);
    } finally { done(dir); }
  });

  test('8. --escalate-from beats an override: one rung above the model the attempt ran on', () => {
    const dir = project({ model_overrides: { planner: 'haiku' } });
    try {
      const r = resolveIn(dir, 'planner', '--escalate-from', 'haiku');
      assert.equal(r.tier, 'sonnet');
      assert.equal(r.tier_source, 'escalation');
      assert.equal(r.escalated_from, 'haiku');
    } finally { done(dir); }
  });

  // quick 40: every compound init command resolves the bare agent name. A bare-key model_overrides sentinel for
  // every agent reaches every `*_model` field and every value of every `*_models` map; a caller that passed any
  // other spelling would fall back to the table or to `sonnet` and miss the sentinel.
  test('9. every compound init command resolves bare agent names (sentinel override)', () => {
    const SENTINEL = 'claude-sentinel-1';
    const overrides = Object.fromEntries(Object.keys(profiles.agents).map((a) => [a, SENTINEL]));
    const dir = project({ model_profile: 'quality', model_overrides: overrides }, { objectiveDir: '01-x' });
    try {
      const commands = [
        ['execute-objective', '1'], ['plan-objective', '1'], ['quick', 'x'], ['verify-work', '1'],
        ['new-project'], ['new-milestone'], ['map-codebase'], ['security-audit'], ['progress'],
      ];
      const seen = new Set();
      const wrong = [];
      for (const args of commands) {
        const out = JSON.parse(aof(dir, ['init', ...args]));
        for (const [k, v] of Object.entries(out)) {
          if (k.endsWith('_model')) {
            seen.add(k);
            if (v !== SENTINEL) wrong.push(`init ${args[0]} ${k}=${JSON.stringify(v)}`);
          } else if (k.endsWith('_models')) {
            seen.add(k);
            for (const [f, m] of Object.entries(v || {})) {
              if (m !== SENTINEL) wrong.push(`init ${args[0]} ${k}.${f}=${JSON.stringify(m)}`);
            }
          }
        }
      }
      assert.deepEqual(wrong, [], `init fields that missed the bare-key override:\n  ${wrong.join('\n  ')}`);
      const expected = [
        'executor_model', 'verifier_model', 'researcher_model', 'planner_model', 'checker_model', 'researcher_models',
        'synthesizer_model', 'roadmapper_model', 'mapper_model', 'mapper_models', 'auditor_model',
      ];
      const missing = expected.filter((k) => !seen.has(k));
      assert.deepEqual(missing, [], `model fields no init command emitted: ${missing.join(', ')}`);
    } finally { done(dir); }
  });

  test('table and focus tiers report their source', () => {
    const dir = project({ model_profile: 'balanced' });
    try {
      assert.equal(resolveIn(dir, 'planner').tier_source, 'table');
      assert.equal(resolveIn(dir, 'codebase-mapper', '--focus', 'concerns').tier_source, 'focus');
    } finally { done(dir); }
  });
});

// Objective 82 (TRD 82-03): the five tier proposals objective 81 put to the user, approved 2026-10-17 as
// "P3, P2-arch-only, P1, P4, P5" (81-HAIKU-EVAL.md, Decision). P1 lives in the Flutter pack manifest and is pinned in
// flutter-ui-eval.test.cjs; P2-P5 are the `focus` block here. P2 raises the architecture mapper alone: the shared
// agents.codebase-mapper row (tech and quality) and the quality profile's mapper tier are not part of the approval.
// P4 and P5 lower a budget focus to the project-researcher row's own tier, so the "only raise" test above still holds.
describe('objective 82: approved tier proposals (81 P2-P5)', () => {
  const os = require('os');
  const PROFILES = ['quality', 'balanced', 'budget'];
  const dirs = [];
  function project(profile) {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mp-8203-'));
    dirs.push(dir);
    fs.mkdirSync(path.join(dir, '.aoforge'));
    fs.writeFileSync(path.join(dir, '.aoforge', 'config.json'), JSON.stringify({ model_profile: profile }));
    return dir;
  }
  function run(dir, ...args) {
    const r = spawnSync(process.execPath, [DF_TOOLS, ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
    return JSON.parse(r.stdout);
  }
  test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

  test('init map-codebase: arch and concerns resolve to sonnet, tech and quality to haiku, on balanced and budget', () => {
    for (const profile of ['balanced', 'budget']) {
      const m = run(project(profile), 'init', 'map-codebase').mapper_models;
      assert.deepEqual(m, { tech: 'haiku', arch: 'sonnet', quality: 'haiku', concerns: 'sonnet' }, profile);
    }
  });

  // TRD 82-08 measured P4 and P5 live (82-CHECK-RULES.md section 2): P4 reverted (item lost: hub HU-A01, Sonnet 2 of 2
  // runs, Haiku 0 of 2), so architecture is opus/sonnet/sonnet again; P5 kept, so pitfalls stays opus/sonnet/haiku.
  test('init new-project and new-milestone: researcher architecture opus/sonnet/sonnet (P4 reverted), pitfalls opus/sonnet/haiku (P5 kept)', () => {
    const wantArch = { quality: 'inherit', balanced: 'sonnet', budget: 'sonnet' };
    const wantPit = { quality: 'inherit', balanced: 'sonnet', budget: 'haiku' };
    for (const profile of PROFILES) {
      const dir = project(profile);
      for (const wf of ['new-project', 'new-milestone']) {
        const r = run(dir, 'init', wf).researcher_models;
        assert.equal(r.architecture, wantArch[profile], `${wf} ${profile} architecture`);
        assert.equal(r.pitfalls, wantPit[profile], `${wf} ${profile} pitfalls`);
      }
    }
  });

  test('resolve-model codebase-mapper --focus arch is sonnet from the focus table on every profile', () => {
    for (const profile of PROFILES) {
      const r = run(project(profile), 'resolve-model', 'codebase-mapper', '--focus', 'arch');
      assert.equal(r.tier, 'sonnet', profile);
      assert.equal(r.tier_source, 'focus', profile);
      assert.equal(r.focus, 'arch', profile);
    }
  });

  test('table pins: P2 arch, P3 concerns, P4 architecture (reverted by 82-08), P5 pitfalls', () => {
    assert.deepEqual(profiles.focus['codebase-mapper'].arch, { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet' });
    assert.deepEqual(profiles.focus['codebase-mapper'].concerns, { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet' });
    assert.deepEqual(profiles.focus['project-researcher'].architecture, { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' });
    assert.deepEqual(profiles.focus['project-researcher'].pitfalls, { quality: 'opus', balanced: 'sonnet', budget: 'haiku' });
  });

  test('the shared mapper row is untouched and tech and quality get no focus entry (P2 is arch only)', () => {
    assert.deepEqual(profiles.agents['codebase-mapper'], { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' });
    assert.deepEqual(Object.keys(profiles.focus['codebase-mapper']).sort(), ['arch', 'concerns']);
  });
});
