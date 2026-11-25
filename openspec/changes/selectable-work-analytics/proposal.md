## Why

Researchers want to choose which CORE distributions to inspect alongside a paper search. Checking aggregate buckets against the paper total makes extra requests and can delay usable analytics.

## What Changes

- Add Results and Analytics tabs sharing the submitted search.
- Add a collapsible field picker for available Works aggregations.
- Display the selected distributions directly from CORE. Retire raw-search reconciliation, missing-count inference and fallback enumeration for analytics.

## Capabilities

### New Capabilities

- `work-analytics` — field selection, independent aggregate requests and tabbed results.

### Modified Capabilities

None in the accepted baseline. This change supersedes the coverage checks in the earlier publication-year proposals.

## Impact

Search form, results layout, CORE data service, API notes, OpenSpec and component tests.
