## Purpose

Let researchers choose which CORE Works distributions to display for a submitted search.

## ADDED Requirements

### Requirement: Choose aggregate fields
The search pane SHALL contain a collapsible checkbox group for the available Works aggregate fields. Analytics SHALL start enabled with all seven fields selected. Disabling it SHALL cancel pending aggregation and block aggregate requests in both search modes. Search submission SHALL apply the current selection in either input mode.

#### Scenario: Select multiple fields
- **WHEN** a researcher selects authors and publisher and submits a query
- **THEN** the aggregate request includes the selected fields and Analytics shows each returned distribution

#### Scenario: Change only the selected fields
- **WHEN** the researcher resubmits with only the selected fields changed
- **THEN** Analytics updates and Results retains the current page without a new paper request

#### Scenario: Clear the selection
- **WHEN** no fields are selected at submission
- **THEN** Results remains available and Analytics explains how to select fields without issuing an aggregate request

### Requirement: Separate Results and Analytics
The search SHALL offer keyboard-accessible Results and Analytics tabs. Results SHALL open by default and preserve paper pagination and table state when switching tabs. Analytics SHALL retain the interactive year chart when publication year is selected and show labeled values and counts for other fields.

#### Scenario: Browse the same submitted query
- **WHEN** the researcher changes pages or switches tabs
- **THEN** the submitted analytics are reused and the current results page is preserved

### Requirement: Use independent CORE distributions
Analytics SHALL use the aggregate response as its source of counts. It SHALL issue no raw-search requests to reconcile totals, enumerate missing papers or infer missing buckets. Results and Analytics SHALL handle loading, errors and empty responses independently.

#### Scenario: Counts differ or one request fails
- **WHEN** CORE returns fewer or more bucket entries than raw search hits, or raw search fails
- **THEN** Analytics displays the returned counts without a coverage warning or a verification request

#### Scenario: Dates fall within a calendar year
- **WHEN** a submitted date bound falls inside a calendar year
- **THEN** Results verifies exact publication dates and Analytics states the enclosing year bounds used by CORE

#### Scenario: Disable analytics and resume
- **WHEN** the user disables analytics, submits searches, or navigates pages
- **THEN** paper browsing works and CORE receives no aggregate requests while disabled
- **WHEN** the user re-enables analytics and submits
- **THEN** only the selected dimensions are requested

#### Scenario: Switch a dimension’s presentation
- **WHEN** a dimension has buckets
- **THEN** it displays one bar chart or one table at a time, with an accessible table available and no extra request to change the view
