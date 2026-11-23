# Spec Delta

## Purpose

Show the publication-year distribution of papers matching a submitted search and make its coverage clear.

## ADDED Requirements

### Requirement: Chart follows the submitted query
The application SHALL chart publication-year counts for the submitted query independently of the paper display limit. It SHALL leave the chart blank before the first search and provide each displayed count as text.

#### Scenario: No query has been submitted
- **WHEN** the user opens the app before submitting a search
- **THEN** no publication-year chart is rendered

#### Scenario: Only the display limit changes
- **WHEN** the user changes the result limit and resubmits the same query
- **THEN** the paper list updates and the publication-year counts stay unchanged
- **AND** the application sends no additional aggregation request for that limit change

### Requirement: Reconcile publication-year coverage
The application SHALL compare CORE's year bucket counts with its reported match count. If the buckets cannot be reconciled and the result fits the supported offset window, the application SHALL attempt an independent count of distinct papers. It SHALL count enumerated papers with no usable year as Unknown year.

#### Scenario: Enumeration accounts for missing years
- **WHEN** an independent traversal returns all 50 reported distinct papers and 8 lack a usable year
- **THEN** the chart accounts for all 50 reported papers, including 8 under Unknown year

### Requirement: Show incomplete or unavailable coverage
The application SHALL label usable counts as partial when it cannot reconcile coverage and explain the limitation. It SHALL show an unavailable state if aggregation fails, with the paper results remaining usable.

#### Scenario: Reported matches exceed the offset window
- **WHEN** CORE reports 71,213 matches and its year buckets account for 68,719
- **AND** the query exceeds the supported offset window
- **THEN** the chart labels the 68,719 counts as partial and shows them against the reported 71,213 matches

#### Scenario: Aggregation fails after the paper list loads
- **WHEN** the independent aggregation request fails
- **THEN** the chart reports that year counts are unavailable
- **AND** the paper list remains usable
