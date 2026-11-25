## Context

The app builds static Angular assets and already has a Node request handler for OpenRouter drafting. Development uses an Angular proxy; production needs an HTTP server. The user authorized Railway hosting at scipris.intrepidata.io with Cloudflare Access for cypris.ai and richard.moorhead@gmail.com.

## Goals / Non-Goals

Goals: deploy the current workspace, verify email identities, protect every app/API route, and keep upstream credentials server-side.

Non-goals: custom account management, database storage, or hosted local CLI drafting.

## Decisions

- Use Railpack to build Angular and run a single Node server on PORT. Reuse the existing drafting handler with OpenRouter.
- Configure a reusable Cloudflare Allow policy with email domain and exact email alternatives, requiring the existing one-time PIN identity provider.
- Validate RS256 signature, issuer, audience, expiry, and required claims through jose and Cloudflare's rotating JWKS. Recheck the explicit email allowlist at the origin. Missing configuration prevents startup.
- Protect static assets and both API groups; only GET/HEAD /healthz returns an unauthenticated constant health response for Railway.
- Proxy only the two documented CORE operations, retaining upstream errors and retry headers. Do not forward browser credentials upstream.
- Disable shared caching of protected responses. Reject cross-origin writes. Exclude local settings and secrets from uploaded source.

## Risks / Trade-offs

Email delivery is required for login. JWKS availability is required when keys are first loaded or rotated. The deployment uses a source snapshot; later changes require another deployment. Railway health checks confirm server readiness without exercising paid upstream APIs.

## Migration Plan

Test access rejection/acceptance and proxy contracts locally; build the app; create a scoped Access application and Railway service; set runtime variables; deploy; add proxied DNS; verify the login redirect and direct-origin rejection. Roll back by redeploying a prior Railway release while retaining Access restrictions.
