# Spec Delta

## Purpose

Let researchers inspect publication trends and use a range of years as a search filter.

## ADDED Requirements

### Requirement: Inspect yearly counts
The chart SHALL plot known years in chronological order, support zoom and show exact counts on hover. An accessible data table SHALL expose every year and count, including Unknown year when present. The chart and table SHALL be alternative views of the same returned year buckets.

#### Scenario: Inspect returned year buckets
- **WHEN** the returned year buckets include an Unknown year bucket
- **THEN** the table includes Unknown year, and only dated years appear on the time axis
- **AND** zooming the chart changes only its visible years

### Requirement: Select publication years
Search parameters SHALL contain the publication date inputs for keyboard and pointer entry. Selecting two year bars SHALL stage inclusive bounds in those inputs for the next search.

#### Scenario: Inspect the aggregate
- **WHEN** the researcher opens either view of the Publication year aggregate
- **THEN** the aggregate shows its chart or counts table, with no date-entry form, year selectors or Use years button

#### Scenario: Select 2020 through 2022
- **WHEN** the researcher selects the years 2020 through 2022
- **THEN** From shows 2020-01-01 and Through shows 2022-12-31
- **AND** selecting Search papers applies those bounds to both the results and the chart and shows the first page
