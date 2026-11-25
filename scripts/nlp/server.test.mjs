import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { translate, validateTranslation } from './translation.mjs';
import { createDraftHandler } from './server.mjs';

const env = { NLP_ENABLED: 'true', OPENROUTER_API_KEY: 'fixture-only', OPENROUTER_MODEL: 'fixture/model' };
const emptyFilters = { aggregations: null, limit: null, pageSize: null, publishedFrom: null, publishedTo: null };
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
    base,
    status: (headers) => fetch(base + 'status', { headers }).then((res) => res.json()),
    post: (description, headers, signal) => fetch(base + 'translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ description }), signal,
    }),
  };
}

test('translates through OpenRouter with strict structured output and protects the scope of modifiers', async (t) => {
  const result = {
    clarification: '', unapplied: ['Peer-review status'], filters: { aggregations: null, limit: 5, pageSize: null, publishedFrom: '2020-02-29', publishedTo: null },
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
    { limit: 0 }, { limit: 10001 }, { pageSize: 101 }, { pageSize: 0 }, { limit: 1.5 }, { publishedFrom: '2023-02-29' },
    { publishedTo: '2024-02-30' }, { publishedTo: '0000-01-01' },
    { publishedFrom: '2025-01-01', publishedTo: '2024-12-31' },
  ]) {
    const result = validateTranslation({ ...one('drones'), filters: { ...emptyFilters, ...invalid } });
    assert.deepEqual(result.options, []);
    assert.deepEqual(result.filters, emptyFilters);
    assert.match(result.clarification, /How many papers|Which publication dates/);
  }
  const filters = { aggregations: null, limit: 250, pageSize: 10, publishedFrom: null, publishedTo: '2024-02-29' };
  assert.deepEqual(validateTranslation({ ...one('drones'), filters }).filters, filters);
});

test('resolves relative publication bounds against the UTC date of the request', () => {
  const now = new Date('2024-03-01T00:01:00Z');
  for (const [period, start, end] of [
    ['last_year', '2023-01-01', '2023-12-31'],
    ['last_month', '2024-02-01', '2024-02-29'],
    ['yesterday', '2024-02-29', '2024-02-29'],
  ]) {
    const filters = { aggregations: null, limit: 3, pageSize: null, publishedFrom: period, publishedTo: period };
    assert.deepEqual(validateTranslation({ ...one('drones'), filters }, now).filters,
      { aggregations: null, limit: 3, pageSize: null, publishedFrom: start, publishedTo: end });
  }
});

test('resolves rolling publication windows through the UTC request day and leaves topic windows alone', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-23T23:59:00Z') });
  async function filtersFor(description, from, to = null) {
    const draft = one('exercise');
    draft.filters = { ...draft.filters, publishedFrom: from, publishedTo: to };
    return (await translate(description, async () => draft)).filters;
  }
  const report = 'Find papers within the last year that correlate cardiovascular exercise and depression.';
  const rolling = { aggregations: null, limit: null, pageSize: null, publishedFrom: '2025-11-23', publishedTo: '2026-11-23' };
  assert.deepEqual(await filtersFor(report, 'within the last year'), rolling);
  assert.deepEqual(await filtersFor('Studies from the past twelve months on exercise.', 'from the past twelve months'), rolling);
  assert.deepEqual(await filtersFor('Studies on people who exercised within the last year.', null), emptyFilters);
  assert.deepEqual(await filtersFor(report, null, 'within the last year'), rolling);
  assert.deepEqual(await filtersFor(report, 'within the last year', '2026-09-30'),
    { ...rolling, publishedTo: '2026-09-30' });
  t.mock.timers.setTime(new Date('2024-02-29T12:00:00Z').getTime());
  assert.deepEqual(await filtersFor(report, 'within the last year'),
    { aggregations: null, limit: null, pageSize: null, publishedFrom: '2023-02-28', publishedTo: '2024-02-29' });
});

test('keeps a correlation draft when the provider paraphrases its rolling publication window', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T18:00:00Z') });
  const prompt = 'Find research papers from the last year that correlate depression and cardiovascular exercise';
  const draft = one({ and: ['depression', 'cardiovascular exercise'] }, 'Depression and cardiovascular exercise');
  const parse = (period) => translate(prompt, async () => ({
    ...draft, filters: { ...emptyFilters, publishedFrom: period, publishedTo: period },
  }));
  for (const period of ['within the last year', 'rolling_12_months', 'over the past twelve months']) {
    const result = await parse(period);
    assert.deepEqual(result.options, [{ label: draft.options[0].label, expression: '(depression AND "cardiovascular exercise")' }]);
    assert.equal(result.clarification, '');
    assert.equal(result.filters.publishedFrom, '2025-11-24');
    assert.equal(result.filters.publishedTo, '2026-11-24');
  }
  for (const period of ['within the past two years', 'past 2 years', 'rolling_24_months', 'within the last year before 2000']) {
    assert.match((await parse(period)).clarification, /Which publication dates/);
  }
});

test('validates grouping dimensions independently of the keyword tree', () => {
  for (const aggregations of [null, [], ['yearPublished', 'language']]) {
    const result = validateTranslation({ ...one('solar'), filters: { ...emptyFilters, aggregations } });
    assert.deepEqual(result.filters.aggregations, aggregations);
    assert.equal(result.options[0].expression, 'solar');
  }
  for (const aggregations of [['title'], ['authors', 'authors'], 'language']) {
    assert.throws(() => validateTranslation({ ...one('solar'), filters: { ...emptyFilters, aggregations } }));
  }
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
  for (const settings of [{ ...env, NLP_ENABLED: 'false' }, { NLP_ENABLED: 'true' }, { ...env, NLP_PROVIDER: 'unknown' }]) {
    const api = await service(t, { env: settings, fetchImpl: () => assert.fail('unexpected provider call') });
    assert.deepEqual(await api.status(), { enabled: false, debounceMs: 1000 });
    assert.equal((await api.post('drones')).status, 404);
  }
});

async function fixtureCli(t, provider) {
  const bin = await mkdtemp(join(tmpdir(), 'scipris-test-bin-'));
  t.after(() => rm(bin, { recursive: true, force: true }));
  const script = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (['login', 'auth'].includes(args[0])) {
  const loggedIn = !fs.existsSync(process.env.HOME + '/signed-out');
  console.log(JSON.stringify({ loggedIn }));
  process.exit(loggedIn ? 0 : 1);
}
const { description } = JSON.parse(fs.readFileSync(0, 'utf8'));
fs.writeFileSync(process.env.HOME + '/call.json', JSON.stringify({
  args, description, cwd: process.cwd(), inheritedKey: process.env.OPENROUTER_API_KEY, pid: process.pid
}));
if (description === 'invalid') console.log('{}');
else if (description === 'oversized') console.log('x'.repeat(33000));
else if (description === 'slow') setInterval(() => {}, 1000);
else console.log(${JSON.stringify(JSON.stringify(one({ and: ['solar', { not: 'lithium' }] })))});
`;
  await writeFile(join(bin, provider), script, { mode: 0o700 });
  return { NLP_ENABLED: 'true', NLP_PROVIDER: provider, NLP_MODEL: 'local/model', HOME: bin, PATH: bin };
}

for (const provider of ['codex', 'claude']) {
  test(provider + ' drafts locally with an existing login and validates the result', async (t) => {
    const settings = await fixtureCli(t, provider);
    if (provider === 'claude') settings.OPENROUTER_API_KEY = 'unused-fixture';
    const api = await service(t, { env: settings, fetchImpl: () => assert.fail('unexpected OpenRouter request') });
    assert.equal((await api.status()).enabled, true);
    const description = 'Solar papers without lithium; echo "research"';
    const response = await api.post(description);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).options[0].expression, '(solar AND NOT lithium)');
    const call = JSON.parse(await readFile(join(settings.HOME, 'call.json'), 'utf8'));
    assert.equal(call.description, description);
    assert.equal(call.args.includes(description), false);
    assert.ok(call.args.includes('local/model'));
    assert.ok(call.args.includes(provider === 'codex' ? '--ephemeral' : '--no-session-persistence'));
    assert.equal(call.inheritedKey, undefined);
    await assert.rejects(readFile(join(call.cwd, 'response-schema.json')), { code: 'ENOENT' });
    for (const invalid of ['invalid', 'oversized']) assert.equal((await api.post(invalid)).status, 502);
    await writeFile(join(settings.HOME, 'signed-out'), '');
    assert.equal((await api.status()).enabled, false);
  });
}

test('CLI selection fails closed on missing binaries and on remote requests', async (t) => {
  const settings = await fixtureCli(t, 'claude');
  const missing = await service(t, { env: { ...settings, NLP_PROVIDER: 'codex', OPENROUTER_API_KEY: 'fixture' } });
  assert.equal((await missing.status()).enabled, false);
  const local = await service(t, { env: settings });
  const foreignOrigin = { Origin: 'https://remote.example' };
  assert.equal((await local.status(foreignOrigin)).enabled, false);
  assert.equal((await local.post('drones', foreignOrigin)).status, 404);
  // fetch supplies its own Host. Use node:http to exercise the actual Host header.
  const [response] = await once(get(local.base + 'status', { headers: { Host: 'remote.example' } }), 'response');
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  assert.equal(JSON.parse(Buffer.concat(chunks)).enabled, false);
  await assert.rejects(readFile(join(settings.HOME, 'call.json')), { code: 'ENOENT' });
});

test('terminates a stalled CLI at the drafting deadline', async (t) => {
  const settings = await fixtureCli(t, 'codex');
  const api = await service(t, { env: settings, timeoutMs: 500 });
  assert.equal((await api.post('slow')).status, 504);
  const { pid } = JSON.parse(await readFile(join(settings.HOME, 'call.json'), 'utf8'));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('cancels a CLI draft when the browser disconnects', async (t) => {
  const settings = await fixtureCli(t, 'claude');
  const api = await service(t, { env: settings });
  const client = new AbortController();
  const request = api.post('slow', {}, client.signal);
  const deadline = AbortSignal.timeout(3000);
  let pid;
  try {
    while (!pid) {
      await delay(10, undefined, { signal: deadline });
      try { pid = JSON.parse(await readFile(join(settings.HOME, 'call.json'), 'utf8')).pid; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } finally {
    client.abort();
    await assert.rejects(request, { name: 'AbortError' });
  }
  while (true) {
    try { process.kill(pid, 0); }
    catch (error) { assert.equal(error.code, 'ESRCH'); break; }
    await delay(10, undefined, { signal: deadline });
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
