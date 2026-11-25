## Why

Deploy the current app at scipris.intrepidata.io for authorized reviewers, protecting the UI and upstream API credentials with verified email access.

## What Changes

- Add a Railway production server for Angular assets, the CORE proxy, and OpenRouter drafting.
- Require Cloudflare Access authentication for all application and API requests, using the configured email domains and individual addresses.
- Validate signed Access tokens at the origin and expose only a minimal unauthenticated health endpoint.
- Configure deployment, DNS, and a scoped Cloudflare Access policy with email one-time PIN login.
- Enable automatic Railway deployments from the GitHub repository's main branch.

## Capabilities

### New Capabilities
- `hosted-access`: Production hosting with verified email restrictions and protected API proxying.

### Modified Capabilities

None.

## Impact

Adds a Node hosting entry point, jose JWT verification dependency, Railway configuration, and hosted service variables. Existing local development remains available through npm start.
