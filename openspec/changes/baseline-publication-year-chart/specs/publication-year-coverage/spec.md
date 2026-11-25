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

### Requirement: Display returned publication years
The application SHALL show CORE’s returned year buckets directly. An aggregation failure SHALL be reported in Analytics while Results remains usable.

#### Scenario: Year buckets omit papers
- **WHEN** the Works endpoint returns year buckets
- **THEN** Analytics displays their counts without requesting a raw search to check them

#### Scenario: Aggregation fails after the paper list loads
- **WHEN** the independent aggregation request fails
- **THEN** the chart reports that year counts are unavailable
- **AND** the paper list remains usable
