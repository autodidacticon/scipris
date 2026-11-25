import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createDraftHandler } from './nlp/server.mjs';

function readLocalSettings(file) {
  try {
    return parseEnv(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Unable to read development proxy settings:', error.code);
    return {};
  }
}

const local = readLocalSettings(new URL('../.env.local', import.meta.url));
const secrets = local.SCIPRIS_SECRETS_FILE ? readLocalSettings(local.SCIPRIS_SECRETS_FILE) : {};
const token = (process.env.CORE_API_KEY ?? secrets.CORE_API_KEY)?.trim();
const draft = createDraftHandler({ env: {
  ...process.env,
  NLP_ENABLED: process.env.NLP_ENABLED ?? local.NLP_ENABLED,
  NLP_PROVIDER: process.env.NLP_PROVIDER ?? local.NLP_PROVIDER,
  NLP_MODEL: process.env.NLP_MODEL ?? local.NLP_MODEL,
  NLP_DEBOUNCE_MS: process.env.NLP_DEBOUNCE_MS ?? local.NLP_DEBOUNCE_MS,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? secrets.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL ?? local.OPENROUTER_MODEL,
} });

export default {
  '^/api/nlp/(?:status|translate)(?:\\?|$)': {
    // Serve the same handler as production within Angular's Vite development server.
    async bypass(req, res) {
      await draft(req, res);
      return req.url;
    },
  },
  '^/api/core/search/works/(?:aggregate)?(?:\\?|$)': {
    target: 'https://api.core.ac.uk',
    changeOrigin: true,
    pathRewrite: { '^/api/core/': '/v3/' },
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  },
};
