# Proposal

Historical implementation record. [Selectable Works analytics](../selectable-work-analytics/proposal.md) supersedes the original coverage checks.

## Why

Step 6 of the original project brief requests a chart over every paper matching the query. The shipped app charts publication years and reports the coverage it can establish, including a visible partial state when CORE's response cannot be reconciled.

## What Changes

- Record the existing chart lifecycle, independence from the paper display limit, and accessible year counts.
- Record how the app accounts for unknown years and communicates incomplete or unavailable aggregation.
- Treat this change as a retrospective of the initial chart implementation. Completing aggregation for broad queries is tracked in `complete-query-aggregation`.

## Capabilities

### New Capabilities

- `publication-year-coverage`: Chart counts by publication year and communicate what share of the submitted query is represented.

### Modified Capabilities

None.

## Impact

Captures the shipped chart, data service, fixtures, and tests. The live verification examples are evidence for the baseline, with the sampled counts kept separate from the requirements.
