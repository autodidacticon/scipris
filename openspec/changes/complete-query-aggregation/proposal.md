# Proposal

## Why

The [original project brief](../../../docs/project.md) asks the chart to include all matching papers. For the example Boolean query, the live CORE search reported 71,213 matches and the native year buckets accounted for 68,719. A scroll request returned no cursor, leaving the gap unresolved.

## What Changes

- Establish whether this CORE account can provide a query-wide count and a reliable way to account for every matching work beyond the offset window.
- Extend publication-year coverage when a verified source supports it. Count missing years only when supported by the evidence.
- Keep the existing partial and unavailable states when the source cannot establish completeness. Track that result as a limitation rather than closing the original requirement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `publication-year-coverage`: Add verified coverage beyond the current offset window. Apply this delta after `baseline-publication-year-chart` is synced or archived into the main specs.

## Impact

May affect the CORE contract, generated client, chart data service, and tests after the investigation. The paper search, display limit, and server-side credential handling remain part of the existing baseline.
