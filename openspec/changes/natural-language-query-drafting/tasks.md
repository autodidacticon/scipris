# Tasks

## 1. Translation service

- [x] 1.1 Implement the bounded OpenRouter adapter, routes and rollout configuration. Verify contract, rendering, disabled mode and failure limits with Node tests and document server setup.

## 2. Search menu

- [x] 2.1 Implement opt-in drafting, clarification, dropdown selection, per-option editing and request cancellation. Verify with Angular interaction tests and document the workflow.
- [x] 2.2 Expose the NLP switch in all availability states and show drafting help on opt-in. Verify switch labeling, help visibility and manual search in the UI.
- [x] 2.3 Replace manual entry on opt-in, debounce asynchronous parsing with a configurable 1000 ms default, and verify cancellation, the interpretation dropdown, inline edits, and explicit submission.
- [x] 2.4 Open a single draft directly in the editor and show the interpretation dropdown only when there are multiple choices. Verify both paths and the visibility of unapplied constraints.
- [x] 2.5 Extract and validate requested result limits and inclusive publication dates separately from the Boolean query.
- [x] 2.6 Provide an editable publication date range. Apply dates to papers and full-query counts and verify coverage, mode switching, and submission.
- [x] 2.7 Show the editable NLP limiter after interpretation and verify overrides, resets and manual-mode retention.
- [x] 2.8 Resolve rolling publication windows against the request date. Check both picker bounds, previous calendar years, leap days and study-population wording.
- [x] 2.9 Group the result limit and publication dates below the query in a collapsible section. Verify keyboard operation, responsive layout, retained values and validation in both modes.
- [x] 2.10 Resolve equivalent rolling-period wording and verify that the correlation query opens with both publication bounds.
- [x] 2.11 On a parsing service failure, show the Boolean editor and a warning. Verify manual submission and recovery.

## 3. Integration

- [x] 3.1 Run the project verification script and strict OpenSpec validation, and exercise the browser flow through the development server.
- [x] 3.2 Verify local startup with the configured secrets file, an explicit disable override, and a live translation through the running Angular app.

Live verification on 2026-11-23 used the translation endpoint and OpenRouter's
`openai/gpt-4o-mini`. Battery recycling excluding lithium produced one draft
with `NOT lithium`. Lightweight drones or robots produced both modifier scopes.
A request without a topic returned a clarification question. With publication filters enabled,
a request for two papers about graphene nanoribbon transistors in 2020 returned two of
three matches. Narrowing the picker to one day produced a matching paper and chart.
“Last year” resolved to 2025. Asking for 200 papers prompted for a count from 1 to 100.
