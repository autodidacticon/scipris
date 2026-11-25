# Spec Delta

## Purpose

Let a researcher set how many matching papers to browse and how many to read on each page.

## ADDED Requirements

### Requirement: Independent search parameters
The collapsible Search parameters section SHALL contain editable Total results (1–10,000, default 100) and Results per page (1–100, default 10). Manual entry and interpreted NLP drafts SHALL apply both values on submission. Invalid values SHALL reveal and focus the invalid field.

#### Scenario: Browse with the defaults
- **WHEN** a researcher submits a manual or interpreted search with default counts and no publication dates, and CORE has at least 100 matches
- **THEN** the first request retrieves 10 papers, and pages two through ten are fetched as the researcher visits them

#### Scenario: Interpret two counts
- **WHEN** a description requests 25 papers, 10 per page
- **THEN** the draft sets Total results to 25 and Results per page to 10, and both can be edited before submission

### Requirement: Browse the submitted result set
The app SHALL provide accessible page navigation below the results, bounded by both the submitted cap and available matches. It SHALL show the visible range and the query match count. Submitting changed parameters SHALL start at page one. Page changes SHALL preserve the submitted query’s aggregate response.

#### Scenario: Short final page
- **WHEN** the search matches 1,201 papers and the researcher browses 25 results at 10 per page
- **THEN** the pages show 1–10, 11–20, and 21–25, and Next is disabled on the third page
- **AND** the year chart uses the same returned distribution throughout

#### Scenario: Interrupted navigation
- **WHEN** a subsequent page request fails
- **THEN** the last successful page stays visible and the researcher can retry the failed page

#### Scenario: Exact publication dates
- **WHEN** the app is checking individual publication dates
- **THEN** each candidate request is bounded by the number of matches still needed for the requested page, and fetching pauses when the page or browsing cap is filled
- **AND** Next resumes from the saved candidate offset while candidates may remain. Back reuses verified matches. Exhausting candidates on Next keeps the last nonempty page and finalizes the count
