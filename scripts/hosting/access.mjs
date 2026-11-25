import { createRemoteJWKSet, jwtVerify } from 'jose';

const list = (value) => (value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

export function createAccessVerifier(env, { keySet } = {}) {
  const team = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();
  const domains = list(env.CF_ACCESS_ALLOWED_EMAIL_DOMAINS);
  const emails = list(env.CF_ACCESS_ALLOWED_EMAILS);
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team ?? '') || !audience || (!domains.length && !emails.length)) {
    throw new Error('Configure CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD, and an email allowlist before starting.');
  }
  const issuer = `https://${team}`;
  const keys = keySet ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  return async (token) => {
    if (typeof token !== 'string' || !token) return false;
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'email'],
      });
      if (typeof payload.email !== 'string') return false;
      const email = payload.email.toLowerCase();
      const parts = email.split('@');
      return parts.length === 2 && Boolean(parts[0]) && (emails.includes(email) || domains.includes(parts[1]));
    } catch {
      return false;
    }
  };
}
