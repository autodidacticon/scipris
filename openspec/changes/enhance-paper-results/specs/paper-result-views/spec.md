# Spec Delta

## Purpose

Let researchers browse papers by publication year and read abstracts directly in the results table.

## ADDED Requirements

### Requirement: Paper results table
Results SHALL display a single table with Title, Authors and Year published columns. Each title SHALL link to its CORE work. Missing metadata SHALL have readable fallbacks.

#### Scenario: Read an abstract
- **WHEN** the results load
- **THEN** each abstract is collapsed
- **WHEN** the researcher expands a row by pointer or keyboard
- **THEN** it shows the full abstract or the missing-abstract message and any available full-text link
- **AND** the row can be collapsed independently of other rows, and activating a title follows its link

### Requirement: Sort by year published
The Year published header SHALL toggle between descending and ascending order and expose the current direction to assistive technology. A new search SHALL start newest first. Sorting SHALL apply before pagination and changing direction SHALL return to the first page.

#### Scenario: Reverse the order on a later page
- **WHEN** the researcher activates Year published on page two
- **THEN** page one shows the opposite order, subsequent pages use that order, and Analytics reuses its existing response

#### Scenario: Sort exact-date matches
- **WHEN** the researcher changes direction while individual dates are being checked
- **THEN** CORE supplies candidates in the requested year order from the start of that ordering, reusing candidates already verified for that direction
