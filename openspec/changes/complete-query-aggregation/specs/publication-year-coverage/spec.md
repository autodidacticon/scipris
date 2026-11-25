# Spec Delta

## ADDED Requirements

### Requirement: Scrub implausible publication years
The application SHALL accept positive integer publication years through the next UTC calendar year. For searches without a publication date filter, it SHALL retain papers with unusable years, display “Year unavailable” in the results table, and group returned aggregate buckets with unusable years under “Unknown year”. Date filters SHALL use only years within the accepted range.

#### Scenario: Forthcoming and distant future issues
- **WHEN** the current UTC year is 2026 and CORE supplies papers dated 2027, 2088, and 2123
- **THEN** 2027 appears as a year, and the 2088 and 2123 papers contribute to Unknown year when CORE returns buckets for them
