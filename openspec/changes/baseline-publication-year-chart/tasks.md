# Tasks

Historical implementation record. [Selectable Works analytics](../selectable-work-analytics/proposal.md) supersedes the original coverage checks.

Retrospective checklist for the initial implementation.

## 1. Query-wide chart

- [x] 1.1 Render publication-year counts and textual values after query submission. Verify with the browser smoke check and the chart assertions in `research-search.spec.ts`.
- [x] 1.2 Keep chart counts independent of the paper limit. Verify that changing the limit updates the list without a second aggregate call in fixture tests and the live browser check.

## 2. Coverage and failures

- [x] 2.1 Reconcile year buckets and enumerate distinct papers where the offset window permits. Verify the missing-year fallback in fixture tests and compare live year buckets with the independently enumerated 50-work sample.
- [x] 2.2 Explain partial or unavailable coverage and keep the paper list usable. Verify wide-query, duplicate, quota, and chart-error cases in fixture tests. Verify partial coverage against the live broad query in Chrome.
