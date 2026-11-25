# Proposal

## Why

The original project brief asks for an app in Angular 20 or later that searches CORE, presents papers, and lets users choose how many results to retrieve. Capture the shipped implementation of steps 1–5 so future changes preserve the search experience and integration contract.

## What Changes

- Record the existing paper search, Boolean query, result limit, and loading, empty, and error behavior.
- Record the existing same-origin CORE integration and server-side handling of credentials.
- Treat this change as a retrospective of the initial search implementation. Publication-year aggregation has its own baseline.

## Capabilities

### New Capabilities

- `research-search`: Search and display research papers from CORE with an adjustable result limit.
- `core-api-integration`: Send search requests to CORE through a same-origin proxy and preserve upstream outcomes.

### Modified Capabilities

None.

## Impact

The Angular app, CORE client and contract, and setup instructions are already present. The checked tasks identify the shipped evidence for this baseline.
