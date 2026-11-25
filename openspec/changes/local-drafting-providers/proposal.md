# Proposal

## Why

A developer with an existing Codex or Claude Code login can use that account to draft paper searches during local development. Today the drafting service requires an OpenRouter key.

## What Changes

- Select `openrouter`, `codex`, or `claude` in server-side deployment settings. Existing deployments default to OpenRouter.
- Use the selected CLI's local login for loopback requests and pass its drafts through the same validation as OpenRouter.

## Capabilities

### New Capabilities

- `local-drafting-providers` covers deployment selection, availability and execution of local drafting providers.

## Impact

The Node drafting handler, Angular development proxy, local configuration examples and service tests change. The browser uses the existing status and translation routes.
