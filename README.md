# Scipris

Angular search for scientific papers from CORE.

## Run locally

Use Node.js 22.23.2 and npm 10.9.8. Export `CORE_API_KEY` in the server environment, or point `SCIPRIS_SECRETS_FILE` in `.env.local` to a dotenv file containing the key. [CORE API registration](https://core.ac.uk/services/api)

```bash
npm ci
npm start
```

The development server listens at [localhost:4200](http://localhost:4200). Restart it after changing configuration.

## Enable natural-language drafting

Drafting is off by default. For a new checkout, copy [.env.local.example](.env.local.example) to `.env.local`. To configure an existing checkout, edit the file in place.

```dotenv
NLP_ENABLED=true
NLP_PROVIDER=codex
# SCIPRIS_SECRETS_FILE=/absolute/path/to/.secrets
```

Choose one provider. Codex and Claude Code require a signed-in CLI on the server’s `PATH` and accept loopback requests only.

| `NLP_PROVIDER` | Authentication | Model override |
| --- | --- | --- |
| `codex` | `codex login` | `NLP_MODEL` (CLI default) |
| `claude` | `claude auth login` | `NLP_MODEL` (CLI default) |
| `openrouter` (default) | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`), with strict JSON Schema support |

Set `NLP_DEBOUNCE_MS` to change the drafting delay (default `1000`). Exported NLP settings override `.env.local`. Supply API keys through the environment or the optional secrets file. Exported keys take precedence.

Check provider availability with `curl http://localhost:4200/api/nlp/status`.

## Build and test

```bash
npm run build
npm test
```

For full verification, including CORE client regeneration, run `bash scripts/verify.sh` (Java 11+).

## Hosted deployment

Production: [scipris.intrepidata.io](https://scipris.intrepidata.io). Railway builds Angular and runs `npm run serve:production`, serving the UI, CORE proxy, and OpenRouter drafting on one origin.

Railway follows `main` in `autodidacticon/scipris`. Each push starts a build, and Railway promotes the deployment after its `/healthz` readiness check succeeds. Keep the Railway GitHub App installed with access to this repository. Build, start, and health-check settings are stored on the Railway service; `RAILPACK_NO_SPA=true` retains the Node runtime that enforces authentication.

Cloudflare Access requires an emailed one-time PIN. Configure allowed email domains and individual addresses in the service environment. The server independently validates Cloudflare's signed token and email allowlist on every UI/API request; requests to a direct Railway origin are also protected.

Set the following service environment variables before starting:

```dotenv
PUBLIC_ORIGIN=https://scipris.intrepidata.io
CF_ACCESS_TEAM_DOMAIN=intrepidata.cloudflareaccess.com
CF_ACCESS_AUD=<Access application's audience tag>
CF_ACCESS_ALLOWED_EMAIL_DOMAINS=reviewers.example
CF_ACCESS_ALLOWED_EMAILS=operator@example.org
CORE_API_KEY=<server-side key>
NLP_ENABLED=true
NLP_PROVIDER=openrouter
OPENROUTER_API_KEY=<server-side key>
```

Run `npm run build` followed by `npm run serve:production`. The server listens on `0.0.0.0:$PORT` (default `8080`). Only `GET`/`HEAD /healthz` is unauthenticated, returning a constant readiness response. `.railwayignore` excludes local settings and build caches. Never upload a secrets file or put upstream keys in the Angular build.
