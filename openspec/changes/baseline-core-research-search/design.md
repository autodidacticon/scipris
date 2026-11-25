# Design

## Context

The shipped app uses standalone Angular 21 components, a project-maintained CORE v3 OpenAPI subset, and a generated Angular client.

## Goals / Non-Goals

**Goals:** Preserve the separation between form state, API transport, and server-side credentials.

**Non-Goals:** Change the UI, hosting configuration, or chart coverage as part of this baseline.

## Decisions

- Generate the typed client from the checked-in OpenAPI contract to make regeneration reproducible. Keep configuration and error handling in a handwritten adapter.
- Route browser requests through the local development proxy. A production host can supply the same routes and inject its own credential.
- Model form submissions as query sessions and replace superseded requests. The app can retain the current query while fetching a different number of paper cards.

## Risks / Trade-offs

- Static hosting requires a separate same-origin proxy. Setup instructions describe the routes and where to keep the key.
- The official machine-readable API specification could not be fetched during development. The checked-in subset identifies its sources and assumptions.
