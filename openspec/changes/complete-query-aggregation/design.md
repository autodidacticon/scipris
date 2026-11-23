# Design

## Context

The app currently reconciles native buckets against CORE's reported count and can enumerate within its offset window. A live broad search returned 100 year buckets with a coverage gap. The tested scroll request succeeded without returning a cursor.

## Goals / Non-Goals

**Goals:** Establish an evidence threshold for query-wide coverage and extend the chart when the upstream source meets it.

**Non-Goals:** Change the search UI or guarantee that CORE supports arbitrary exhaustive queries under the current account.

## Decisions

- Start with a bounded live investigation. Confirm whether native aggregations can supply an exhaustive distribution and a count for missing years. Check scroll eligibility, cursor delivery and continuation, exhaustion, and quota behavior.
- Use native aggregation if the API demonstrates that its distribution covers the entire live query. If the account can reliably traverse the full result set, count distinct Work IDs with the same query in a separate, cancellable chart operation.
- Require reliable completion evidence before declaring full coverage. Compare small controls against independently enumerated works. For broad queries, require a documented completeness or exhaustion signal and consistent match counts. Treat duplicate IDs, inconsistent totals, cursor expiry, and quota stops as incomplete.
- Preserve the existing partial or unavailable state if the investigation finds no verified source. Keep that finding as a blocker to fulfilling the brief.

## Risks / Trade-offs

- Exhaustive traversal may exceed latency and quota constraints. Bound the investigation and measure request volume before considering production use.
- A downloadable snapshot can describe a different set of works from the live search. Its counts cannot establish live query coverage without demonstrated equivalence.

## Migration Plan

Sync or archive the chart baseline first. Ship any verified source through the existing chart pipeline. Disabling the new source restores the current partial-coverage behavior.
