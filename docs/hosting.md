# Hosting operations

## Resources

- App: https://scipris.intrepidata.io
- Railway project: `scipris` (`7a3aa3fd-32df-4bfd-bb29-bca0450e6328`)
- Railway environment: `production` (`45cbe7c4-f0e4-4003-9a5e-f701f4cdf05c`)
- Railway service: `scipris` (`cf3cbfb5-17d8-4771-b3bd-3c0e0fb85c87`)
- Cloudflare Access application: `Scipris` (`03535b7d-9f66-4441-9905-a32fee327942`)
- Cloudflare reusable policy: `Scipris — Cypris and Richard` (`f9cd0666-9f5d-47ec-8c6f-55360dc50700`)
- Access team domain: `intrepidata.cloudflareaccess.com`

## Authentication

The Access application protects the entire hostname and permits `cypris.ai` email addresses or the exact address `richard.moorhead@gmail.com`, using the existing one-time PIN identity provider. Sessions last 24 hours. There are no bypass or service-token policies for this app.

The origin verifies the signed Access JWT using Cloudflare's rotating public keys, checking RS256, issuer, application audience, expiration, and email. The server's allowlist must match the Cloudflare policy. All assets and API endpoints require authentication. The minimal `/healthz` endpoint allows Railway health probes but exposes no app data.

CORE and OpenRouter keys are runtime service variables. They are neither shipped to browsers nor included in source uploads. OpenRouter is the hosted drafting provider; local Codex/Claude CLI providers remain local-only.

## Deploy

The service follows `main` in [autodidacticon/scipris](https://github.com/autodidacticon/scipris). Pushes to `main` automatically build and deploy to production. The source is not pinned to a commit. Railway promotes a deployment after its health check succeeds.

The first GitHub deployment, `7ded0696-7002-4b15-b117-ba5866aca266`, deployed commit `5b1cf45d99a3a4916a8f3432bbb5e8493b8cfba4` successfully. Its Node runtime and health check were verified after connecting the repository.

The first release used a CLI upload. For a manual deployment of the current workspace:

```bash
npm test
npm run build
openspec validate --all --strict
railway up --project 7a3aa3fd-32df-4bfd-bb29-bca0450e6328 \
  --environment 45cbe7c4-f0e4-4003-9a5e-f701f4cdf05c \
  --service cf3cbfb5-17d8-4771-b3bd-3c0e0fb85c87 \
  --detach -m "Deploy Scipris"
```

Railway service settings persist the build command `npm run build`, start command `npm run serve:production`, health path `/healthz` (120-second timeout), and restart policy `ON_FAILURE` (three retries). Set `RAILPACK_NO_SPA=true` so Angular detection cannot select a static Caddy runtime; this app requires Node for authentication and APIs. Set `RAILPACK_NODE_NPM_INSTALL=npm ci --no-audit --no-fund` for reproducible dependency installation. The service uses Node 22.23.2.

These settings live on the Railway service rather than the deprecated `railway.json` format. `.railwayignore` excludes local settings. Review untracked files before uploading; the first deployment used an explicit source-only snapshot containing app code and build configuration.

DNS uses a proxied CNAME to `y4879ikk.up.railway.app` and the Railway ownership TXT record. A Cloudflare configuration rule sets SSL to Full only for `scipris.intrepidata.io`, matching Railway's origin TLS requirements.

To roll back, redeploy a known healthy release in Railway. Retain the Access application and server allowlist. To change authorized identities, update both the scoped Cloudflare policy and `CF_ACCESS_ALLOWED_EMAIL_DOMAINS` / `CF_ACCESS_ALLOWED_EMAILS`, then redeploy.

## Verify

- The public hostname should redirect an unauthenticated visitor to Cloudflare Access.
- Direct-origin requests to `/`, JavaScript assets, `/api/core/search/works/`, and `/api/nlp/status` must return 403 without a valid token, including when a forged email header is supplied.
- Railway `/healthz` must return 200 with only `{"status":"ok"}`.
- An allowed user should complete the emailed PIN flow and try search, aggregation, and drafting. Automated signed-token tests cover identity matching and claim validation; they do not substitute for a human mailbox login.

## Initial deployment verification

Deployment `b35797f7-2e6d-40d5-9638-50a9f5d7b20b` reached SUCCESS on November 24, 2026 (America/Chicago). Runtime logs confirm `node scripts/hosting/server.mjs` listening on port 8080.

- All 74 tests passed (6 hosting, 17 drafting, 51 Angular), the production build passed, and all 9 OpenSpec changes passed strict validation.
- The public homepage, CORE search endpoint, and drafting status endpoint returned 302 to `intrepidata.cloudflareaccess.com`.
- Direct Railway-origin requests with the app Host header and a forged authorized-email header returned 403 for the homepage, JavaScript bundle, CORE search, and drafting status. `/healthz` returned exactly `{"status":"ok"}` with 200.
- Cloudflare policy, identity provider restriction, proxied DNS, and the hostname-specific TLS rule were read back after configuration.
- A human mailbox sign-in was not performed during automated deployment verification.
