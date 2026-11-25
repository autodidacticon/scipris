# Scipris

Angular search for scientific papers from CORE. [Project brief](docs/project.md)

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

Serve `dist/scipris/browser/` on the app origin. Proxy `/api/core/search/works/` and `/api/core/search/works/aggregate` to the corresponding `https://api.core.ac.uk/v3/` routes. Set `Authorization: Bearer <CORE_API_KEY>` on upstream requests. [CORE API client guide](docs/api-client.md)

For hosted drafting, set `OPENROUTER_API_KEY` in the service environment and start the service.

```bash
NLP_ENABLED=true NLP_PROVIDER=openrouter npm run nlp:serve
```

Proxy `GET /api/nlp/status` and `POST /api/nlp/translate` to `127.0.0.1:4318`. Set `NLP_PORT` to override the port. The standalone service reads its configuration from the environment.
