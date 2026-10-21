'use strict';
/**
 * A stub batch module for the objective-81 runner tests (TRD 81-08). It implements the batch module interface the
 * real batches (81-09..81-12, `scripts/eval81/batches/<X>.cjs`) implement:
 *
 *   { batch, runs({root, trees, calibration}) -> RunDescriptor[], materialize(desc, workDir, {root, trees, home}),
 *     collect(desc, workDir, {root, home, record}) -> outputs, needsWatchedRepos?(root) -> [{label, path}] }
 *
 * The default export is batch A. The runner loads `<batch dir>/<X>.cjs`, so a test makes a batch dir of one-line shims:
 *   module.exports = require('<this file>').makeStubBatch('B');
 *
 * Three descriptors by default (kind agent, agent aoforge:verifier, role verifier, models haiku/sonnet/haiku, cap 0.5,
 * plugin 3.1.0). A test tunes them with `<root>/stub-batch.json` (optional):
 *   { count, scenario, plugin, capUsd, timeoutMs, marker, realHome, denyTarget,
 *     watched: [{label, path}],                       // needsWatchedRepos
 *     overrides: { "<id>": { scenario, model, plugin, capUsd, timeoutMs, role, tools, agent } } }
 * materialize writes the fake's control files (.fake-scenario, .fake-marker, .fake-real-home, .fake-deny-target,
 * .fake-state-dir) into the work dir; collect returns `{echo: true}`.
 *
 * stubSpendBlock(batch, entries) builds a results/<X>.json body carrying a valid 81-01 spend block (test 18).
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'stub-batch.json';
const MODEL_CYCLE = ['haiku', 'sonnet', 'haiku'];
const SKIP_ENV = {
  AOFORGE_SKIP_EDIT_GATE: '1',
  AOFORGE_SKIP_AWARENESS_POPULATE: '1',
  AOFORGE_SKIP_TRANSCRIPT_EXPORT: '1',
  AOFORGE_SKIP_PRUNE: '1',
};
const has = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const pick = (key, ...sources) => {
  for (const s of sources) if (has(s, key)) return s[key];
  return undefined;
};

function readConfig(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILE), 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`stub batch: cannot read ${path.join(root, CONFIG_FILE)}: ${err.message}`);
  }
}

function makeStubBatch(batch = 'A') {
  return {
    batch,
    runs({ root }) {
      const cfg = readConfig(root);
      const count = Number.isInteger(cfg.count) ? cfg.count : 3;
      const runs = [];
      for (let i = 1; i <= count; i += 1) {
        const id = `${batch}-stub-${i}`;
        const o = (cfg.overrides && cfg.overrides[id]) || {};
        const plugin = pick('plugin', o, cfg);
        runs.push({
          id,
          batch,
          kind: 'agent',
          agent: pick('agent', o) || 'aoforge:verifier',
          model: pick('model', o) || MODEL_CYCLE[(i - 1) % MODEL_CYCLE.length],
          plugin: plugin === undefined ? '3.1.0' : plugin,
          prompt: `Stub run ${id}: verify the fixture in the current directory.`,
          tools: pick('tools', o) === undefined ? null : o.tools,
          jsonSchema: null,
          capUsd: pick('capUsd', o, cfg) || 0.5,
          capBasis: 'stub batch: fixed cap',
          timeoutMs: pick('timeoutMs', o, cfg) || 60000,
          env: { ...SKIP_ENV },
          fixture: {
            scenario: pick('scenario', o, cfg) || 'happy',
            marker: cfg.marker || null,
            realHome: cfg.realHome || null,
            denyTarget: cfg.denyTarget || null,
            stateDir: path.join(root, 'fake-state', id),
          },
          order: i,
          role: pick('role', o) || 'verifier',
        });
      }
      return runs;
    },
    materialize(desc, workDir) {
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(path.join(workDir, 'README.md'), `# Stub fixture for ${desc.id}\n`);
      const f = desc.fixture || {};
      fs.writeFileSync(path.join(workDir, '.fake-scenario'), `${f.scenario || 'happy'}\n`);
      if (f.marker) fs.writeFileSync(path.join(workDir, '.fake-marker'), `${f.marker}\n`);
      if (f.realHome) fs.writeFileSync(path.join(workDir, '.fake-real-home'), `${f.realHome}\n`);
      if (f.denyTarget) fs.writeFileSync(path.join(workDir, '.fake-deny-target'), `${f.denyTarget}\n`);
      if (f.stateDir) fs.writeFileSync(path.join(workDir, '.fake-state-dir'), `${f.stateDir}\n`);
    },
    collect() {
      return { echo: true };
    },
    needsWatchedRepos(root) {
      const watched = readConfig(root).watched;
      return Array.isArray(watched) ? watched : [];
    },
  };
}

/**
 * A results/<X>.json body with a spend block in the 81-01 SpendBlock shape. `entries` are partial LedgerEntries
 * (`{id, charged_usd}` at least); the rest is filled in. spent_usd is their sum.
 */
function stubSpendBlock(batch, entries, { status = 'complete', ledgerTotalUsd } = {}) {
  const full = entries.map((e) => ({
    id: e.id,
    batch,
    role: has(e, 'role') ? e.role : 'verifier',
    status: e.status || 'ok',
    cap_usd: has(e, 'cap_usd') ? e.cap_usd : 0.5,
    reserve_usd: has(e, 'reserve_usd') ? e.reserve_usd : 0.625,
    reported_usd: has(e, 'reported_usd') ? e.reported_usd : e.charged_usd,
    transcript_usd: has(e, 'transcript_usd') ? e.transcript_usd : e.charged_usd,
    charged_usd: e.charged_usd,
    cost_source: e.cost_source || 'reported',
    overshoot_usd: e.overshoot_usd || 0,
    at: e.at || '2026-10-17T12:00:00.000Z',
  }));
  const spent = Math.round(full.reduce((s, e) => s + e.charged_usd, 0) * 1e6) / 1e6;
  return {
    batch,
    scored_at: '2026-10-17T12:30:00.000Z',
    spend: {
      ledger_version: 1,
      batch,
      status,
      spent_usd: spent,
      ledger_total_usd: ledgerTotalUsd === undefined ? spent : ledgerTotalUsd,
      entries: full,
    },
  };
}

module.exports = { ...makeStubBatch('A'), makeStubBatch, stubSpendBlock, readConfig, CONFIG_FILE, SKIP_ENV };
