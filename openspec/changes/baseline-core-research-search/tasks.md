# Tasks

Retrospective checklist for the implementation shipped in `5eeaa9b`.

## 1. Angular foundation and CORE integration

- [x] 1.1 Scaffold Angular 20 or later, pin the Node and npm versions, and document the build and run commands. Verify the Angular version in `package.json` and the production build with `bash scripts/verify.sh`.
- [x] 1.2 Derive and validate the CORE API contract, provide representative fixtures, and generate the typed client. Verify OpenAPI validation and regeneration in `bash scripts/verify.sh`.
- [x] 1.3 Document and verify the same-origin proxy and generated transport. Confirm in the API tests that the query survives encoding and that upstream failures stay distinguishable from empty results. Confirm in the live browser smoke check that the browser sends no authorization header.

## 2. Search experience

- [x] 2.1 Render responsive paper results with metadata fallbacks and links. Verify with the fixture-based search tests and the production browser smoke check.
- [x] 2.2 Support Boolean submissions and validate the paper limit. Verify request parameters, visible card count, error states, and superseded requests in `research-search.spec.ts`.
