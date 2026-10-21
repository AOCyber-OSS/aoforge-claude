'use strict';

// Proofs for objective 82's batch C fixtures (TRD 82-06 test list 1-2): the two research topics and their answer key.
// These are the tests for test infrastructure: they hold the topics and checklists to the shape the batch module and
// the grader read, and to the rules they were written under (10-12 cited items per topic and dimension, no pinned
// versions). Read only; nothing here spawns a process or touches a home directory.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const readText = (name) => fs.readFileSync(path.join(HERE, name), 'utf8');

// The section reader of objective 81's loadTopic (scripts/eval81/batches/C.cjs), applied to a given text.
function sections(text) {
  const section = (name) => {
    const m = text.match(new RegExp(`^## ${name}\\n+([\\s\\S]*?)(?=\\n## |$)`, 'm'));
    return m ? m[1].trim() : null;
  };
  return { domain: section('Domain'), title: section('Project title'), summary: section('Project summary') };
}

const TOPICS = {
  gateway: {
    file: 'topic-gateway.md',
    title: 'modelgate',
    domain: 'An LLM gateway service, written in Go, that sits between internal applications and several hosted model providers',
    summary: 'modelgate is a service, written in Go, that sits between a company\'s internal applications and several hosted '
      + 'large-language-model providers. Applications call one HTTP API; modelgate authenticates each caller with a '
      + 'per-tenant API key, enforces per-tenant rate limits and monthly spend budgets, streams responses back as they '
      + 'arrive, records every request\'s token usage for cost accounting, keeps a searchable request log, and fails over '
      + 'to another provider when one is slow or down. It runs as several stateless instances behind a load balancer.',
  },
  hub: {
    file: 'topic-hub.md',
    title: 'devhub',
    domain: 'A macOS desktop application, written in Flutter, that controls a local developer-platform daemon',
    summary: 'devhub is a macOS desktop application, written in Flutter, that controls a developer-platform daemon running '
      + 'on the same machine. It shows the status of the local services the daemon manages, starts and stops them, '
      + 'streams their logs live, and edits the daemon\'s settings. The daemon exposes a local API; it can be restarted or '
      + 'upgraded while devhub is open, and devhub must keep working through that. devhub ships signed and notarized, '
      + 'starts at login and lives in the menu bar.',
  },
};

const DIMENSIONS = ['architecture', 'pitfalls'];
const ID_PREFIX = { gateway: 'GA', hub: 'HU' };
const DIM_LETTER = { architecture: 'A', pitfalls: 'P' };
const VERSION_RE = /\bv?\d+\.\d+/;

test('1: both topic files parse with the three headings, titles modelgate and devhub, the TRD text verbatim', () => {
  for (const [key, want] of Object.entries(TOPICS)) {
    const text = readText(want.file);
    assert.match(text.split('\n')[0], /^# Test C research topic \(objective 82\): /, `${key}: title line`);
    for (const heading of ['## Domain', '## Project title', '## Project summary']) {
      assert.equal(text.split('\n').filter((l) => l === heading).length, 1, `${key}: exactly one ${heading}`);
    }
    const got = sections(text);
    assert.equal(got.title, want.title, `${key}: title`);
    assert.ok(!/\s/.test(got.title), `${key}: the title is one word`);
    assert.equal(got.domain, want.domain, `${key}: domain`);
    assert.ok(!got.domain.includes('\n'), `${key}: the domain is one line`);
    assert.equal(got.summary, want.summary, `${key}: summary`);
    assert.ok(!got.summary.includes('\n'), `${key}: the summary is one paragraph`);
  }
});

test('2: checklists-82.json holds two topics x two dimensions of 10-12 cited, unique, version-free items', () => {
  const key = JSON.parse(readText('checklists-82.json'));
  assert.match(key.written, /before any batch C run/);
  assert.equal(typeof key.scoring, 'string');
  assert.deepEqual(key.dimension_documents, { architecture: 'ARCHITECTURE.md', pitfalls: 'PITFALLS.md' });
  assert.deepEqual(Object.keys(key.topics).sort(), ['gateway', 'hub']);
  for (const topic of Object.keys(TOPICS)) {
    assert.equal(key.topic_files[topic], `scripts/eval82/fixtures/C/${TOPICS[topic].file}`);
  }
  const ids = new Set();
  for (const [topic, dims] of Object.entries(key.topics)) {
    assert.deepEqual(Object.keys(dims).sort(), DIMENSIONS, `${topic}: dimensions`);
    for (const dim of DIMENSIONS) {
      const items = dims[dim];
      assert.ok(Array.isArray(items), `${topic}/${dim}: a list`);
      assert.ok(items.length >= 10 && items.length <= 12, `${topic}/${dim}: ${items.length} items, not 10-12`);
      items.forEach((item, i) => {
        const where = `${topic}/${dim}/${item.id}`;
        const n = String(i + 1).padStart(2, '0');
        assert.equal(item.id, `${ID_PREFIX[topic]}-${DIM_LETTER[dim]}${n}`, `${where}: id in order`);
        assert.ok(!ids.has(item.id), `${where}: duplicate id`);
        ids.add(item.id);
        assert.deepEqual(Object.keys(item).sort(), ['accept_any', 'id', 'source', 'statement'], `${where}: fields`);
        assert.ok(typeof item.statement === 'string' && item.statement.trim().length > 20, `${where}: statement`);
        assert.ok(typeof item.source === 'string' && item.source.trim().length > 5, `${where}: source`);
        assert.ok(Array.isArray(item.accept_any) && item.accept_any.length >= 2 && item.accept_any.length <= 4, `${where}: 2-4 accept_any`);
        for (const phrase of item.accept_any) assert.ok(typeof phrase === 'string' && phrase.trim() !== '', `${where}: an empty phrasing`);
        for (const text of [item.statement, item.source, ...item.accept_any]) {
          assert.ok(!VERSION_RE.test(text), `${where}: names a version number: ${text}`);
        }
      });
    }
  }
  assert.ok(ids.size >= 40 && ids.size <= 48);
});
