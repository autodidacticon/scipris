## Context

The live Works endpoint accepts a subset of the fields in the reference. It also rejects day-level publication-date comparisons. The earlier chart tried to reconcile year counts against the paper search.

## Decisions

- Offer the fields accepted together by CORE. Send one aggregate POST for each submitted query and selection. Enable all fields by default. NLP proposals can narrow the selection. The global switch gates aggregation in both modes.
- Start analytics independently of the results request. Pagination and tab navigation reuse the submitted data. Both paths cancel obsolete requests.
- Keep the sortable paper table in Results. In Analytics, default to a year chart and to tables for other dimensions. Allow a local switch between chart and table. Treat empty bucket maps and empty arrays as empty distributions.
- Exact-day checks belong to the paper list. Use the submitted CORE year clauses for aggregates, labeling any difference in date precision.
- The direct aggregate policy supersedes all earlier requirements to compare endpoints, backfill missing counts, or certify coverage. Continue grouping returned implausible years under Unknown year.
