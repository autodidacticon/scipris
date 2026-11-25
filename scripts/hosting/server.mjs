import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createAccessVerifier } from './access.mjs';
import { createDraftHandler } from '../nlp/server.mjs';

const defaultRoot = fileURLToPath(new URL('../../dist/scipris/browser/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8' };

function reply(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: message }));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 65_536) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createAppHandler({ env = process.env, staticRoot = defaultRoot, fetchImpl = fetch, keySet } = {}) {
  const verify = createAccessVerifier(env, { keySet });
  if (!env.CORE_API_KEY?.trim()) throw new Error('CORE_API_KEY is required.');
  const origin = new URL(env.PUBLIC_ORIGIN).origin;
  if (!origin.startsWith('https://')) throw new Error('PUBLIC_ORIGIN must use HTTPS.');
  if (env.NLP_ENABLED === 'true' && env.NLP_PROVIDER && env.NLP_PROVIDER !== 'openrouter') {
    throw new Error('Hosted drafting requires the openrouter provider.');
  }
  const draft = createDraftHandler({ env: { ...env, NLP_PROVIDER: 'openrouter' }, fetchImpl });
  const root = resolve(staticRoot);

  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const url = new URL(req.url, origin);
      // Railway probes this minimal endpoint without a user session.
      if (url.pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
      }
      if (!await verify(req.headers['cf-access-jwt-assertion'])) return reply(res, 403, 'Access denied.');
      if (!['GET', 'HEAD'].includes(req.method) &&
          ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site')) {
        return reply(res, 403, 'Cross-origin request denied.');
      }
      if (url.pathname === '/api/nlp/status' || url.pathname === '/api/nlp/translate') return await draft(req, res);

      const coreMethod = { '/api/core/search/works/': 'GET', '/api/core/search/works/aggregate': 'POST' }[url.pathname];
      if (coreMethod) {
        if (req.method !== coreMethod) {
          res.setHeader('Allow', coreMethod);
          return reply(res, 405, 'Method not allowed.');
        }
        if (coreMethod === 'POST' && req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
          return reply(res, 415, 'Send JSON.');
        }
        const upstream = new URL(url.pathname.replace('/api/core/', '/v3/') + url.search, 'https://api.core.ac.uk');
        const response = await fetchImpl(upstream, {
          method: coreMethod,
          headers: { Authorization: `Bearer ${env.CORE_API_KEY.trim()}`, Accept: 'application/json', ...(coreMethod === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
          ...(coreMethod === 'POST' ? { body: await readBody(req) } : {}),
          signal: AbortSignal.timeout(60_000), redirect: 'error',
        });
        for (const name of ['content-type', 'retry-after', 'x-ratelimit-retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining']) {
          if (response.headers.has(name)) res.setHeader(name, response.headers.get(name));
        }
        res.writeHead(response.status);
        if (response.body) await pipeline(Readable.fromWeb(response.body), res);
        else res.end();
        return;
      }
      if (url.pathname.startsWith('/api/')) return reply(res, 404, 'Not found.');
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, 'Method not allowed.');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\0') || pathname.split('/').some((part) => part.startsWith('.'))) return reply(res, 404, 'Not found.');
      let file = resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + sep)) return reply(res, 404, 'Not found.');
      try {
        if (!(await stat(file)).isFile()) file = resolve(root, 'index.html');
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
        if (extname(pathname)) return reply(res, 404, 'Not found.');
        file = resolve(root, 'index.html');
      }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      req.resume();
      if (res.headersSent) return res.destroy();
      reply(res, error.status ?? (error.name === 'TimeoutError' ? 504 : 502), error.status ? error.message : 'Request could not be completed.');
    }
  };
}

if (import.meta.main) {
  await stat(resolve(defaultRoot, 'index.html'));
  const server = createServer({ requestTimeout: 30_000 }, createAppHandler());
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.info(`Scipris listening on port ${server.address().port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
