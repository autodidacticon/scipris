# Proposal

## Why

A search can match 1,201 papers while showing ten papers. Researchers need to set a browsing limit, move between pages, compare papers, and see when the matching papers were published.

## What Changes

- Put **Total results** and **Results per page** in the collapsible **Search parameters** section beside publication dates. Add page navigation below the results.
- Show papers in a three-column table with linked titles, sortable publication years, and expandable abstracts.
- Make the publication-year chart interactive, with exact counts, an accessible data table and selection of publication dates.

## Capabilities

### New Capabilities

- `result-pagination` — submitted limits, page navigation and progress for exact-date searches.
- `paper-result-views` — linked titles, year sorting and row disclosure.
- `publication-trend-exploration` — interactive year counts and date-range selection.

## Impact

Angular search controls, CORE page retrieval, NLP filter extraction and results presentation. The design uses Angular Material/CDK for controls and Apache ECharts for publication trends.
