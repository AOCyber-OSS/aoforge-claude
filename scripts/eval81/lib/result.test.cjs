'use strict';
// Tests for scripts/eval81/lib/result.cjs (TRD 81-01, test list 5-12b). Every stream and transcript is a hand-built
// literal from __fixtures__/stream-json.cjs written into an mkdtemp directory; no network, no claude binary,
// no ~/.claude. Model pins come from the repo's model-profiles.json unless a test passes its own file.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sj = require('../__fixtures__/stream-json.cjs');

const load = () => require('./result.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval81-result-'));

const RATES_FILE = path.join(__dirname, '..', '..', '..', 'plugins', 'aoforge', 'aoforge', 'references', 'model-rates.json');

// A hand-built rates object with today's numbers ($ per million tokens).
const RATES = {
  models: {
    'claude-sonnet-5-5': { input: 2, output: 10, cache_read: 0.1, cache_write_5m: 2.5, cache_write_1h: 4 },
    'claude-haiku-5-5': { input: 0.1, output: 0.5, cache_read: 0.01, cache_write_5m: 0.125, cache_write_1h: 0.2 },
  },
  aliases: {},
};

describe('parseStream', () => {
  test('5. a happy stream gives cost, usage split, turns, session, duration, init tools and status ok', () => {
    const { parseStream } = load();
    const rec = parseStream(sj.toLines(sj.happyStream()), { requestedModel: 'haiku' });
    assert.equal(rec.status, 'ok');
    assert.equal(rec.cost_usd, sj.HAPPY.cost);
    assert.deepEqual(rec.usage, { input: 8, cache_creation: 1200, cache_read: 71000, output: 100 });
    assert.equal(rec.usage_source, 'result');
    assert.equal(rec.num_turns, 2);
    assert.equal(rec.session_id, sj.SESSION);
    assert.equal(rec.duration_ms, 4200);
    assert.deepEqual(rec.init_tools, ['Bash', 'Read', 'Grep', 'Glob']);
    assert.equal(rec.result_text, 'VERDICT: pass');
    assert.equal(rec.parse_skipped, 0);
    assert.deepEqual(rec.permission_denials, []);

    // The optional stream fields can be absent: the parser does not depend on them.
    const bare = parseStream(
      sj.toLines(sj.happyStream({ omit: ['subtype', 'is_error', 'num_turns', 'duration_ms', 'result', 'permission_denials'] })),
      { requestedModel: 'haiku' },
    );
    assert.equal(bare.status, 'ok');
    assert.equal(bare.num_turns, null);
    assert.equal(bare.duration_ms, null);
    assert.equal(bare.result_text, null);
    assert.deepEqual(bare.permission_denials, []);
    assert.equal(bare.cost_usd, sj.HAPPY.cost);
  });

  test('unparseable lines are skipped and counted; permission_denials are copied from the result event', () => {
    const { parseStream } = load();
    const denials = [{ tool_name: 'Write', tool_use_id: 'toolu-9', tool_input: { file_path: '/etc/x' } }];
    const events = sj.happyStream();
    events[events.length - 1].permission_denials = denials;
    const text = `not json\n${sj.toLines(events)}{"truncated":\n`;
    const rec = parseStream(text, { requestedModel: 'haiku' });
    assert.equal(rec.parse_skipped, 2);
    assert.deepEqual(rec.permission_denials, denials);
    assert.equal(rec.status, 'ok');
  });

  test('6. first-turn input is the first message id counted once when repeated per content block', () => {
    const { parseStream, firstTurnInput } = load();
    const rec = parseStream(sj.toLines(sj.happyStream()), { requestedModel: 'haiku' });
    assert.equal(rec.first_turn_input, 3 + 1000 + 35000);
    assert.equal(rec.assistant_messages, 2);
    // A subagent's message (parent_tool_use_id set) seen first does not count as the session's first turn.
    const events = [
      sj.initEvent(),
      sj.assistantMsg({ id: 'sub-1', parent_tool_use_id: 'toolu-1', usage: sj.usage({ input: 999999 }) }),
      sj.assistantMsg({ id: 'main-1', usage: sj.usage({ input: 7, cache_read: 100 }), repeat: true,
        content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }),
    ];
    assert.equal(firstTurnInput(sj.toLines(events)), 107);
  });

  test('7. model_ran needs >= 90% of output on the requested pin; side models are listed', () => {
    const { parseStream, modelRan } = load();
    const ok = parseStream(sj.toLines(sj.sideModelStream()), { requestedModel: 'sonnet' });
    assert.equal(ok.requested_model_id, 'claude-sonnet-5-5');
    assert.equal(ok.model_ran, true);
    assert.deepEqual(ok.side_models, ['claude-haiku-5-5']);

    const wrong = parseStream(
      sj.toLines(sj.sideModelStream({ main: 'claude-haiku-5-5', side: 'claude-sonnet-5-5' })),
      { requestedModel: 'sonnet' },
    );
    assert.equal(wrong.model_ran, false);
    assert.deepEqual(wrong.side_models, ['claude-haiku-5-5']);

    // The pin is read from the profiles file, never hard-coded.
    const dir = tmp();
    const profiles = path.join(dir, 'model-profiles.json');
    fs.writeFileSync(profiles, JSON.stringify({ models: { haiku: 'claude-haiku-9-9', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' } }));
    const usage = { 'claude-haiku-9-9': { outputTokens: 10 } };
    assert.equal(modelRan(usage, 'haiku', profiles).model_ran, true);
    assert.equal(modelRan(usage, 'haiku').model_ran, false);
    // A date or [1m] suffix on the usage key still matches the pin.
    assert.equal(modelRan({ 'claude-sonnet-5-5[1m]': { outputTokens: 5 } }, 'sonnet').model_ran, true);
  });

  test('8. a budget stop is cap_hit with the reported cost', () => {
    const { parseStream } = load();
    const hit = parseStream(sj.toLines(sj.capHitStream()), { requestedModel: 'sonnet' });
    assert.equal(hit.status, 'cap_hit');
    assert.equal(hit.cost_usd, 0.62);
    const textual = parseStream(
      sj.toLines(sj.capHitStream({ subtype: 'error_during_execution', result: 'Exceeded the max budget of $0.50' })),
      { requestedModel: 'sonnet' },
    );
    assert.equal(textual.status, 'cap_hit');
    // A successful answer that merely discusses budgets is not a cap hit.
    const events = sj.happyStream();
    events[events.length - 1].result = 'The budget section looks fine.';
    assert.equal(parseStream(sj.toLines(events), { requestedModel: 'haiku' }).status, 'ok');
  });

  test('9. a usage limit is rate_limited with its reset epoch; a bare 429 has none', () => {
    const { parseStream, isRateLimit } = load();
    const limited = parseStream(sj.toLines(sj.usageLimitStream(1760000000)), { requestedModel: 'haiku' });
    assert.equal(limited.status, 'rate_limited');
    assert.equal(limited.reset_epoch, 1760000000);
    const http = parseStream(sj.toLines(sj.http429Stream()), { requestedModel: 'haiku' });
    assert.equal(http.status, 'rate_limited');
    assert.equal(http.reset_epoch, null);
    assert.deepEqual(isRateLimit(sj.resultEvent({ is_error: true, result: 'rate_limit_error: slow down' })), { limited: true, reset_epoch: null });
    assert.deepEqual(isRateLimit(sj.resultEvent({ result: 'ok' })), { limited: false, reset_epoch: null });
    assert.deepEqual(isRateLimit(null), { limited: false, reset_epoch: null });
    // A successful answer that mentions HTTP 429 is not a rate limit.
    assert.equal(isRateLimit(sj.resultEvent({ result: 'The client retries on 429.' })).limited, false);
  });

  test('10. no result event is no_result with a null cost and usage summed from the stream', () => {
    const { parseStream } = load();
    const rec = parseStream(sj.toLines(sj.noResultStream()), { requestedModel: 'haiku' });
    assert.equal(rec.status, 'no_result');
    assert.equal(rec.cost_usd, null);
    assert.equal(rec.usage_source, 'stream');
    assert.deepEqual(rec.usage, { input: 10, cache_creation: 500, cache_read: 72100, output: 100 });
    assert.equal(rec.model_ran, true);
    assert.equal(rec.session_id, sj.SESSION);
    assert.equal(parseStream('', { requestedModel: 'haiku' }).status, 'no_result');
  });

  test('11. structured_output is copied when present and null when absent', () => {
    const { parseStream } = load();
    const so = { verdict: 'gaps_found', gaps: ['G1'] };
    assert.deepEqual(parseStream(sj.toLines(sj.happyStream({ structured_output: so })), { requestedModel: 'haiku' }).structured_output, so);
    assert.equal(parseStream(sj.toLines(sj.happyStream()), { requestedModel: 'haiku' }).structured_output, null);
  });

  test('12. toolInputsMentioning returns the tool_use ids whose input mentions a pattern', () => {
    const { toolInputsMentioning } = load();
    const patterns = [/answer-key/, /scripts\/eval81/];
    const dirty = [
      sj.initEvent(),
      sj.assistantMsg({ id: 'm1', content: [sj.toolUse('toolu-a', 'Read', { file_path: '/fx/answer-key.json' })] }),
      sj.assistantMsg({ id: 'm2', content: [sj.toolUse('toolu-b', 'Bash', { command: 'ls /work' })] }),
      sj.assistantMsg({ id: 'm3', repeat: true, content: [{ type: 'text', text: 'x' }, sj.toolUse('toolu-c', 'Grep', { path: '/repo/scripts/eval81' })] }),
    ];
    assert.deepEqual(toolInputsMentioning(sj.toLines(dirty), patterns), ['toolu-a', 'toolu-c']);
    assert.deepEqual(toolInputsMentioning(sj.toLines(sj.happyStream()), patterns), []);
    assert.deepEqual(toolInputsMentioning(sj.toLines(dirty), ['ls /work']), ['toolu-b']);
  });
});

describe('transcriptCost', () => {
  function writeTranscripts(dir) {
    const main = [
      // msg-a: sonnet, repeated for two content blocks, 5m cache write.
      sj.assistantMsg({ id: 'msg-a', model: 'claude-sonnet-5-5', repeat: true,
        usage: sj.usage({ input: 1000, cache_creation: 2000, cache_read: 10000, output: 500, cc5m: 2000, cc1h: 0 }),
        content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }),
      // msg-b: sonnet, a 1h cache write.
      sj.assistantMsg({ id: 'msg-b', model: 'claude-sonnet-5-5',
        usage: sj.usage({ input: 10, cache_creation: 1000, output: 100, cc5m: 0, cc1h: 1000 }) }),
      // A synthetic row never counts.
      sj.assistantMsg({ id: 'msg-syn', model: '<synthetic>', usage: sj.usage({ input: 100000, output: 100000 }) }),
      { type: 'user', message: { role: 'user', content: 'hi' } },
    ];
    const sub = [
      // msg-c: haiku under 100K prompt; no cache split so cache_creation would be 5m (none here).
      sj.assistantMsg({ id: 'msg-c', model: 'claude-haiku-5-5', usage: sj.usage({ input: 100, cache_read: 5000, output: 200 }) }),
      // msg-d: haiku with a 120K prompt, priced at 5x.
      sj.assistantMsg({ id: 'msg-d', model: 'claude-haiku-5-5', usage: sj.usage({ input: 20000, cache_read: 100000, output: 1000 }) }),
    ];
    fs.writeFileSync(path.join(dir, 'sess-1.jsonl'), sj.toLines(main));
    fs.mkdirSync(path.join(dir, 'sess-1', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sess-1', 'subagents', 'agent-1.jsonl'), sj.toLines(sub));
  }

  test('12b. prices main and subagent transcripts, deduped, with 1h writes and the Haiku long-prompt rate', () => {
    const { transcriptCost } = load();
    const dir = tmp();
    writeTranscripts(dir);
    const res = transcriptCost(dir, { rates: RATES });
    // msg-a 1000*2 + 2000*2.5 + 10000*0.1 + 500*10 = 13000; msg-b 10*2 + 1000*4 + 100*10 = 5020.
    const main = (13000 + 5020) / 1e6;
    // msg-c 100*0.1 + 5000*0.01 + 200*0.5 = 160; msg-d at 5x: 20000*0.5 + 100000*0.05 + 1000*2.5 = 17500.
    const subagent = (160 + 17500) / 1e6;
    assert.equal(res.main_usd, 0.01802);
    assert.equal(res.subagent_usd, 0.01766);
    assert.equal(res.cost_usd, 0.03568);
    assert.ok(Math.abs(res.cost_usd - (main + subagent)) < 1e-9);
    assert.equal(res.by_model['claude-sonnet-5-5'].cost_usd, 0.01802);
    assert.equal(res.by_model['claude-sonnet-5-5'].messages, 2);
    assert.equal(res.by_model['claude-haiku-5-5'].cost_usd, 0.01766);
    assert.equal(res.by_model['<synthetic>'], undefined);
    assert.deepEqual(res.files, ['sess-1.jsonl', 'sess-1/subagents/agent-1.jsonl']);
    assert.deepEqual(res.unpriced, { messages: 0, models: [] });
    assert.equal(res.partial, false);
  });

  test('a cache write with no split is priced at the 5m rate', () => {
    const { transcriptCost } = load();
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 's.jsonl'), sj.toLines(sj.assistantMsg({ id: 'm', model: 'claude-sonnet-5-5', usage: sj.usage({ cache_creation: 1000 }) })));
    assert.equal(transcriptCost(dir, { rates: RATES }).cost_usd, 0.0025);
  });

  test('an unknown model is counted as unpriced and flags the result, never priced at $0 silently', () => {
    const { transcriptCost } = load();
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 's.jsonl'), sj.toLines([
      sj.assistantMsg({ id: 'm1', model: 'claude-mystery-1', usage: sj.usage({ input: 1000, output: 1000 }) }),
      sj.assistantMsg({ id: 'm2', model: 'claude-sonnet-5-5', usage: sj.usage({ output: 100 }) }),
    ]));
    const res = transcriptCost(dir, { rates: RATES });
    assert.deepEqual(res.unpriced, { messages: 1, models: ['claude-mystery-1'] });
    assert.equal(res.partial, true);
    assert.equal(res.cost_usd, 0.001);
  });

  test('an empty or missing dir has a null cost', () => {
    const { transcriptCost } = load();
    const dir = tmp();
    assert.equal(transcriptCost(dir, { rates: RATES }).cost_usd, null);
    assert.equal(transcriptCost(path.join(dir, 'nope'), { rates: RATES }).cost_usd, null);
    assert.deepEqual(transcriptCost(path.join(dir, 'nope'), { rates: RATES }).files, []);
  });

  test('the Haiku long-prompt rule still matches the rates file note (0.50 input over 100K)', () => {
    const { LONG_PROMPT } = load();
    const raw = JSON.parse(fs.readFileSync(RATES_FILE, 'utf-8'));
    const haiku = raw.models['claude-haiku-5-5'];
    assert.match(haiku.note, /Over 100K: input 0\.50/);
    assert.match(haiku.note, /output 2\.50/);
    const rule = LONG_PROMPT['claude-haiku-5-5'];
    assert.equal(rule.threshold, 100000);
    assert.equal(rule.multiplier * haiku.input, 0.5);
    assert.equal(rule.multiplier * haiku.output, 2.5);
  });
});
