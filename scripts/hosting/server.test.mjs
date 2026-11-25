import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { createAccessVerifier } from './access.mjs';
import { createAppHandler } from './server.mjs';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const keySet = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }] });
const env = {
  CF_ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com', CF_ACCESS_AUD: 'scipris-test',
  CF_ACCESS_ALLOWED_EMAIL_DOMAINS: 'reviewers.example', CF_ACCESS_ALLOWED_EMAILS: 'operator@example.org',
  PUBLIC_ORIGIN: 'https://scipris.intrepidata.io', CORE_API_KEY: 'test-core-secret',
};
async function token(email = 'reviewer@reviewers.example', overrides = {}, signingKey = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email, iss: 'https://example.cloudflareaccess.com', aud: ['scipris-test'], iat: now, exp: now + 300, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(signingKey);
}

test('Access accepts only the explicit identities with valid signed claims', async () => {
  const verify = createAccessVerifier(env, { keySet });
  for (const email of ['reviewer@reviewers.example', 'Reviewer@REVIEWERS.EXAMPLE', 'operator@example.org']) assert.equal(await verify(await token(email)), true, email);
  for (const email of ['other@example.org', 'reviewer@evilreviewers.example', 'reviewer@sub.reviewers.example', 'reviewer@reviewers.example.evil.com', '@reviewers.example', 'a@b@reviewers.example']) assert.equal(await verify(await token(email)), false, email);
  for (const changes of [{ exp: 1 }, { exp: undefined }, { iat: undefined }, { email: undefined }, { nbf: Math.floor(Date.now() / 1000) + 300 }, { aud: 'another-app' }, { iss: 'https://attacker.cloudflareaccess.com' }]) assert.equal(await verify(await token(undefined, changes)), false, JSON.stringify(changes));
  const foreign = await generateKeyPair('RS256');
  assert.equal(await verify(await token(undefined, {}, foreign.privateKey)), false);
  assert.equal(await verify('forged'), false);
  assert.equal(await verify(undefined), false);
  assert.throws(() => createAccessVerifier({}), /Configure/);
});

async function setup(t, { fetchImpl, overrides } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'scipris-hosting-'));
  await writeFile(join(dir, 'index.html'), '<html>Scipris test</html>');
  await writeFile(join(dir, 'main.js'), 'window.scipris = true;');
  const calls = [];
  const server = createServer(createAppHandler({ env: { ...env, ...overrides }, staticRoot: dir, keySet,
    fetchImpl: fetchImpl ?? (async (...args) => { calls.push(args); return new Response('{"results":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }); }),
  }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const jwt = await token();
  return { calls, request: (path, options = {}) => fetch(base + path, { ...options, headers: { 'Cf-Access-Jwt-Assertion': jwt, ...options.headers } }) };
}

test('UI, assets, CORE, and drafting reject missing or forged tokens without calling upstream', async (t) => {
  const { request, calls } = await setup(t);
  for (const path of ['/', '/main.js', '/api/core/search/works/?q=test', '/api/core/search/works/aggregate', '/api/nlp/status', '/api/nlp/translate']) {
    for (const credential of ['', 'fake']) {
      const response = await request(path, { headers: { 'Cf-Access-Jwt-Assertion': credential, 'Cf-Access-Authenticated-User-Email': 'reviewer@reviewers.example' } });
      assert.equal(response.status, 403, path);
    }
  }
  assert.equal(calls.length, 0);
  const health = await request('/healthz', { headers: { 'Cf-Access-Jwt-Assertion': '' } });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
});

test('authenticated static serving supports app routes but not private files or missing assets', async (t) => {
  const { request } = await setup(t);
  for (const path of ['/', '/research']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<html>Scipris test</html>');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.match((await request('/main.js')).headers.get('content-type'), /javascript/);
  assert.equal(await (await request('/main.js', { method: 'HEAD' })).text(), '');
  for (const path of ['/.env.local', '/%2eenv', '/missing.js', '/api/unknown', '/%2e%2e%2fpackage.json']) assert.equal((await request(path)).status, 404, path);
});

test('CORE proxy preserves query, JSON, status, and retry headers while replacing caller credentials', async (t) => {
  const calls = [];
  const { request } = await setup(t, { fetchImpl: async (...args) => { calls.push(args); return new Response('{"error":"quota"}', { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30', 'X-RateLimit-Retry-After': '1234' } }); } });
  const search = await request('/api/core/search/works/?q=drone%20AND%20delivery&limit=10', { headers: { Authorization: 'Bearer attacker', Cookie: 'private=secret' } });
  assert.equal(search.status, 429);
  assert.equal(search.headers.get('retry-after'), '30');
  assert.equal(search.headers.get('x-ratelimit-retry-after'), '1234');
  assert.deepEqual(await search.json(), { error: 'quota' });
  assert.equal(String(calls[0][0]), 'https://api.core.ac.uk/v3/search/works/?q=drone%20AND%20delivery&limit=10');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-core-secret');
  assert.equal(calls[0][1].headers.Cookie, undefined);
  assert.equal(calls[0][1].headers['Cf-Access-Jwt-Assertion'], undefined);
  const body = JSON.stringify({ q: 'drone', aggregations: ['yearPublished'] });
  assert.equal((await request('/api/core/search/works/aggregate', { method: 'POST', body, headers: { 'Content-Type': 'application/json', Origin: env.PUBLIC_ORIGIN } })).status, 429);
  assert.equal(calls[1][1].body.toString(), body);
  assert.equal(calls[1][1].method, 'POST');
});

test('unsupported methods, cross-origin writes, and oversized bodies do not reach CORE', async (t) => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/api/core/search/works/aggregate')).status, 405);
  assert.equal((await request('/api/core/search/works/aggregate', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await request('/api/core/search/works/aggregate', { method: 'POST', body: '{}', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await request('/api/core/search/works/aggregate', { method: 'POST', body: 'x'.repeat(65_537), headers: { 'Content-Type': 'application/json' } })).status, 413);
  assert.equal(calls.length, 0);
});

test('drafting status is protected and hosted configuration rejects local CLI providers', async (t) => {
  const { request } = await setup(t, { overrides: { NLP_ENABLED: 'true', NLP_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-openrouter-secret' } });
  assert.equal((await (await request('/api/nlp/status')).json()).enabled, true);
  assert.throws(() => createAppHandler({ env: { ...env, NLP_ENABLED: 'true', NLP_PROVIDER: 'codex' }, keySet }), /openrouter/);
  assert.throws(() => createAppHandler({ env: { ...env, CORE_API_KEY: '' }, keySet }), /CORE_API_KEY/);
});
