# Design

## Context

The Angular component already submits one normalized Boolean expression to both CORE consumers. Its development proxy and the production static host are the existing HTTP boundaries. Artisan demonstrates a structured, server-side extraction step. Here, translation ends at the editor.

## Goals / Non-Goals

Provide one deployable translation handler and exercise its public contract independently of a paid model. Manual Boolean syntax, CORE field-specific queries and chart coverage remain the responsibility of the existing search path.

## Decisions

- Expose same-origin availability and translation routes. The Angular development proxy runs the handler locally. Production can reverse proxy the same paths to a loopback Node service. The browser keeps the switch visible and disabled until the availability check succeeds. If the service is unavailable, show its status beside the switch. Show drafting instructions with the description field when the researcher opts in.
- For local restarts, the development proxy accepts an opt-in flag and a dotenv secrets file path in a gitignored `.env.local`. It selects the OpenRouter and CORE keys for their respective integrations. Exported environment values take precedence.
- Use OpenRouter chat completions with a configurable model, strict structured outputs and provider parameter matching. Keep the bearer key in the server environment. The browser sends only the description and receives rendered options, unmet constraints or a question.
- Accept a bounded tree of literals, conjunctions, disjunctions and negation. Quote phrase and reserved literals and render grouping in application code. Reject invalid trees, unusable alternatives or conflicting outcomes as a whole.
- Publish the debounce delay in milliseconds in the availability response. The Angular client schedules one translation after the typing pause and cancels both the timer and the HTTP subscription on newer input, mode exit, or destruction. Wait for IME composition to finish before scheduling.
- Place the switch after the search controls. In NLP mode, a description occupies the manual query's place. Clear obsolete options immediately on description edits. A single draft opens in the highlighted editor. For multiple drafts, show their labels in a dropdown and open the editor when the researcher makes a choice. Enable search once the editor opens. Keep per-option edits for the active result and retain the latest Boolean text when returning to manual mode.

The model returns a nullable display limit and inclusive publication dates separately from the keyword trees. The server resolves named calendar periods such as “last year” against the UTC date of the request. For a rolling publication period, the model selects the phrase from the description and the server supplies both dates. Rolling months and years end today and clamp the start to the last valid day of the target month. These filters apply to the whole request. Once a draft is available, the limiter starts at the interpreted count or 10. Researchers can adjust the count and dates before submission. Switching interpretations preserves edits to shared filters. Each new description replaces its draft filters.

CORE accepts numeric year comparisons but currently rejects comparisons on its timestamp field. For complete calendar years, use the existing query and aggregation path with year bounds. For finer ranges, page through year-filtered candidates and check their publication dates. Count each matching work once, retain the first 100 for display, and report incomplete coverage if enumeration stops early.

## Risks / Trade-offs

- A structurally valid expression can misstate intent. Supply semantic examples to the model, distinguish competing interpretations with plain-language labels, and show unapplied constraints before search.
- A public translation route consumes shared credit. Apply a per-process rolling request budget, cap request and response sizes, set a provider deadline and cancel abandoned requests. Multiple service replicas need a shared deployment-level budget.
- Provider unavailability can interrupt drafting. Recover within the panel and keep manual search usable. Avoid logging descriptions or upstream bodies.

## Migration Plan

Roll out the UI with the service disabled. Configure the OpenRouter key, enable the server flag and route the two endpoints to offer drafting. Switch the flag off and restart the service to roll it back.
