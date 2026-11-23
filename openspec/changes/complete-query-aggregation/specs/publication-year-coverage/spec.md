# Spec Delta

## ADDED Requirements

### Requirement: Verify coverage beyond the offset window
For a query beyond the supported offset window, the application SHALL use a verified query-wide source when available and count every matching work once by publication year, including works with unknown years. It MUST label counts as complete only when the source accounts for every match of the submitted query. The paper display limit MUST leave coverage unchanged.

#### Scenario: A verified source covers the entire query
- **WHEN** the query exceeds the offset window and the source accounts for every matching work
- **THEN** the chart publishes the full year distribution, including the Unknown year count when applicable
- **AND** the chart remains the same when only the paper display limit changes

#### Scenario: No verified source covers the entire query
- **WHEN** the native buckets fall short and the API provides no usable way to finish enumeration
- **THEN** the app retains its partial or unavailable state and explains the coverage limit

#### Scenario: A traversal cannot establish completion
- **WHEN** enumeration repeats a page, expires, stops at a quota limit, or yields an inconsistent match set
- **THEN** the app does not present the incomplete traversal as complete
