import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { translate, validateTranslation } from './openrouter.mjs';
import { createDraftHandler } from './server.mjs';

const env = { NLP_ENABLED: 'true', OPENROUTER_API_KEY: 'fixture-only', OPENROUTER_MODEL: 'fixture/model' };
const emptyFilters = { limit: null, publishedFrom: null, publishedTo: null };
const one = (tree, label = 'Drone research') => ({ options: [{ label, tree }], unapplied: [], clarification: '', filters: emptyFilters });
const completion = (result) => Response.json({
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }],
});

async function service(t, settings) {
  const server = createServer(createDraftHandler(settings));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/nlp/';
  return {
    status: () => fetch(base + 'status').then((res) => res.json()),
    post: (description) => fetch(base + 'translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }),
    }),
  };
}

test('translates through OpenRouter with strict structured output and protects the scope of modifiers', async (t) => {
  const result = {
    clarification: '', unapplied: ['Peer-review status'], filters: { limit: 5, publishedFrom: '2020-02-29', publishedTo: null },
    options: [
      { label: 'Both subjects are lightweight', tree: { and: ['lightweight', { or: ['drones', 'robots'] }] } },
      { label: 'Only drones are lightweight', tree: { or: [{ and: ['lightweight', 'drones'] }, 'robots'] } },
    ],
  };
  const prompt = 'Find five peer-reviewed papers about lightweight drones or robots published since February 29, 2020';
  const api = await service(t, { env, fetchImpl: async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer fixture-only');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.messages.at(-1), { role: 'user', content: prompt });
    assert.equal(body.model, env.OPENROUTER_MODEL);
    assert.equal(body.response_format.json_schema.strict, true);
    const branches = body.response_format.json_schema.schema.$defs.node.anyOf;
    for (const op of ['and', 'or']) {
      const operands = branches.find((branch) => branch.properties?.[op]).properties[op];
      assert.equal(operands.minItems, 2);
      assert.equal(operands.maxItems, 12);
    }
    assert.equal(body.provider.require_parameters, true);
    return completion(result);
  } });
  assert.deepEqual(await api.status(), { enabled: true, debounceMs: 1000 });
  assert.deepEqual(await (await api.post(prompt)).json(), {
    clarification: '', unapplied: result.unapplied, filters: result.filters,
    options: [
      { label: result.options[0].label, expression: '(lightweight AND (drones OR robots))' },
      { label: result.options[1].label, expression: '((lightweight AND drones) OR robots)' },
    ],
  });
});

test('quotes phrases and reserved syntax as literals and renders exclusions', () => {
  const terms = ['drone delivery', 'or', 'C++', 'title:"robots"', 'x\\y', { not: 'GPS' }];
  const [option] = validateTranslation(one({ and: terms })).options;
  assert.equal(option.expression, '("drone delivery" AND "or" AND "C++" AND "title:\\"robots\\"" AND "x\\\\y" AND NOT GPS)');
  const question = { options: [], unapplied: [], clarification: 'What topic are you researching?', filters: emptyFilters };
  assert.deepEqual(validateTranslation(question), question);
});

test('requires valid publication days, ordered bounds and an in-range display limit', () => {
  for (const invalid of [
    { limit: 0 }, { limit: 101 }, { limit: 1.5 }, { publishedFrom: '2023-02-29' },
    { publishedTo: '2024-02-30' }, { publishedTo: '0000-01-01' },
    { publishedFrom: '2025-01-01', publishedTo: '2024-12-31' },
  ]) {
    const result = validateTranslation({ ...one('drones'), filters: { ...emptyFilters, ...invalid } });
    assert.deepEqual(result.options, []);
    assert.deepEqual(result.filters, emptyFilters);
    assert.match(result.clarification, /How many papers|Which publication dates/);
  }
  const filters = { limit: 100, publishedFrom: null, publishedTo: '2024-02-29' };
  assert.deepEqual(validateTranslation({ ...one('drones'), filters }).filters, filters);
});

test('resolves relative publication bounds against the UTC date of the request', () => {
  const now = new Date('2024-03-01T00:01:00Z');
  for (const [period, start, end] of [
    ['last_year', '2023-01-01', '2023-12-31'],
    ['last_month', '2024-02-01', '2024-02-29'],
    ['yesterday', '2024-02-29', '2024-02-29'],
  ]) {
    const filters = { limit: 3, publishedFrom: period, publishedTo: period };
    assert.deepEqual(validateTranslation({ ...one('drones'), filters }, now).filters,
      { limit: 3, publishedFrom: start, publishedTo: end });
  }
});

test('resolves rolling publication windows through the UTC request day and leaves topic windows alone', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-23T23:59:00Z') });
  async function filtersFor(description, from, to = null) {
    const draft = one('exercise');
    draft.filters = { ...draft.filters, publishedFrom: from, publishedTo: to };
    return (await translate(description, { fetchImpl: async () => completion(draft) })).filters;
  }
  const report = 'Find papers within the last year that correlate cardiovascular exercise and depression.';
  const rolling = { limit: null, publishedFrom: '2025-11-23', publishedTo: '2026-11-23' };
  assert.deepEqual(await filtersFor(report, 'within the last year'), rolling);
  assert.deepEqual(await filtersFor('Studies from the past twelve months on exercise.', 'from the past twelve months'), rolling);
  assert.deepEqual(await filtersFor('Studies on people who exercised within the last year.', null), emptyFilters);
  assert.deepEqual(await filtersFor(report, null, 'within the last year'), rolling);
  assert.deepEqual(await filtersFor(report, 'within the last year', '2026-09-30'),
    { ...rolling, publishedTo: '2026-09-30' });
  t.mock.timers.setTime(new Date('2024-02-29T12:00:00Z').getTime());
  assert.deepEqual(await filtersFor(report, 'within the last year'),
    { limit: null, publishedFrom: '2023-02-28', publishedTo: '2024-02-29' });
});

test('rejects malformed or unbounded results as a whole', () => {
  const repeated = { label: 'Other order', tree: { or: ['b', 'a'] } };
  let deep = 'a';
  for (let i = 0; i < 10; i++) deep = { not: deep };
  for (const invalid of [
    {}, one(''), one({ field: 'title' }), one(deep), one({ and: ['a'] }), one({ and: ['a', 'a'] }),
    one({ not: 'a', or: ['x', 'y'] }), { ...one('a'), clarification: 'Which topic?' },
    { ...one('a'), options: [] }, { ...one('a'), unapplied: [''] }, { ...one('a'), options: Array(4).fill(repeated) },
    { ...one('a'), options: [...one({ or: ['a', 'b'] }).options, repeated] },
  ]) assert.throws(() => validateTranslation(invalid));
});

test('disabled flag or missing key prevents any provider call', async (t) => {
  for (const settings of [{ ...env, NLP_ENABLED: 'false' }, { NLP_ENABLED: 'true' }]) {
    const api = await service(t, { env: settings, fetchImpl: () => assert.fail('unexpected provider call') });
    assert.deepEqual(await api.status(), { enabled: false, debounceMs: 1000 });
    assert.equal((await api.post('drones')).status, 404);
  }
});

test('publishes the configured debounce and defaults invalid settings to one second', async (t) => {
  for (const [setting, expected] of [['250', 250], ['0', 0], ['', 1000], ['-1', 1000], ['invalid', 1000], ['2147483648', 1000]]) {
    const api = await service(t, { env: { ...env, NLP_DEBOUNCE_MS: setting } });
    assert.equal((await api.status()).debounceMs, expected);
  }
});

test('rejects oversized input, bad responses and requests over the rolling budget', async (t) => {
  let calls = 0;
  const api = await service(t, { env, fetchImpl: () => {
    calls++;
    return completion(calls === 1 ? {} : one('drones'));
  } });
  assert.equal((await api.post('   ')).status, 400);
  assert.equal((await api.post('a'.repeat(1001))).status, 413);
  assert.equal((await api.post('a'.repeat(9000))).status, 413);
  assert.equal(calls, 0);
  assert.equal((await api.post('drones')).status, 502);
  for (let i = 0; i < 9; i++) assert.equal((await api.post('drones')).status, 200);
  const limited = await api.post('drones');
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal(calls, 10);
});

test('cancels the provider at its deadline and returns a recoverable timeout', async (t) => {
  const api = await service(t, { env, timeoutMs: 50, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.throwIfAborted();
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) });
  assert.equal((await api.post('drones')).status, 504);
});
