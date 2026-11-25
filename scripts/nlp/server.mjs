import { createServer } from 'node:http';
import { localProvider } from './local-cli.mjs';
import { openRouterCompletion } from './openrouter.mjs';
import { translate } from './translation.mjs';

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readDescription(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Send a JSON description.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 8192) throw new RequestError(413, 'Description is too long.');
    chunks.push(chunk);
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Invalid JSON.');
  }
  if (typeof data?.description !== 'string' || !data.description.trim() || Object.keys(data).length !== 1) {
    throw new RequestError(400, 'Enter a research topic.');
  }
  if (data.description.length > 1000) throw new RequestError(413, 'Description is too long.');
  return data.description.trim();
}

function reply(res, status, body) {
  if (res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function loopbackRequest(req) {
  const host = req.headers.host;
  const origin = req.headers.origin;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host ?? '') &&
    (origin === undefined || origin === 'http://' + host || origin === 'https://' + host);
}

export function createDraftHandler({ env = process.env, fetchImpl = fetch, timeoutMs = 30_000 } = {}) {
  const provider = env.NLP_PROVIDER?.trim() || 'openrouter';
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const local = ['codex', 'claude'].includes(provider) ? localProvider(provider, env) : undefined;
  const enabled = env.NLP_ENABLED === 'true' && (Boolean(local) || provider === 'openrouter' && Boolean(apiKey));
  const delay = Number(env.NLP_DEBOUNCE_MS?.trim() || NaN);
  const debounceMs = Number.isInteger(delay) && delay >= 0 && delay <= 2_147_483_647 ? delay : 1000;
  const model = env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini';
  const complete = local?.complete ?? ((messages, schema, signal) =>
    openRouterCompletion(messages, schema, signal, { apiKey, model, fetchImpl }));
  let recentRequests = [];

  return async (req, res) => {
    const path = req.url.split('?')[0];
    const allowed = enabled && (!local || loopbackRequest(req));
    if (path === '/api/nlp/status' && req.method === 'GET') {
      return reply(res, 200, { enabled: allowed && (!local || await local.available()), debounceMs });
    }
    if (!allowed || path !== '/api/nlp/translate') return reply(res, 404, { error: 'Unavailable.' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(res, 405, { error: 'Use POST to translate.' });
    }
    const disconnected = new AbortController();
    res.once('close', () => disconnected.abort());
    const deadline = AbortSignal.timeout(timeoutMs);
    try {
      const description = await readDescription(req);
      const now = Date.now();
      recentRequests = recentRequests.filter((start) => start > now - 60_000);
      if (recentRequests.length >= 10) {
        res.setHeader('Retry-After', String(Math.ceil((recentRequests[0] + 60_000 - now) / 1000)));
        throw new RequestError(429, 'Translation limit reached.');
      }
      recentRequests.push(now);
      const result = await translate(description, complete, AbortSignal.any([disconnected.signal, deadline]));
      reply(res, 200, result);
    } catch (error) {
      req.resume();
      if (error instanceof RequestError) return reply(res, error.status, { error: error.message });
      reply(res, deadline.aborted ? 504 : 502, { error: 'Translation could not be completed.' });
    }
  };
}

if (import.meta.main) {
  const server = createServer({ requestTimeout: 30_000 }, createDraftHandler());
  server.listen(Number(process.env.NLP_PORT || 4318), '127.0.0.1', () => {
    console.info('Query drafting service listening on 127.0.0.1:' + server.address().port);
  });
}
