# Tasks

## 1. Browse results

- [x] 1.1 Implement independent search parameters, NLP extraction and Material pagination. Test final pages, retries, cancellation, exact-date progress and query-wide counts.
- [x] 1.2 Display a single results table with linked titles, independently expandable abstracts and a sortable Year published column. Verify both directions across pages and exact-date matches.

## 2. Explore publication trends

- [x] 2.1 Render the interactive ECharts trend and accessible counts. Test ordering, Unknown year, partial coverage and staging date bounds.
- [x] 2.2 Verify the integrated flow in a browser, run the test suite and production build, and validate all OpenSpec changes strictly.
- [x] 2.3 Remove the duplicate year selectors and Use years button from both aggregate views and verify date entry in Search parameters.

## 3. Lazy publication-date pagination

- [x] 3.1 Fetch partial-year candidates on demand, cache verified pages by sort order and test exhaustion, retry and request bounds.
