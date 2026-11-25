# Spec Delta

## Purpose

Let users find and browse research papers from CORE in Scipris.

## ADDED Requirements

### Requirement: Search page name
The application SHALL use “CORE search” as its page name.

#### Scenario: Open the search page
- **WHEN** the page opens
- **THEN** its main heading and browser tab title both read “CORE search”
- **AND** the site header reads “Scipris”

### Requirement: Boolean paper search
The application SHALL provide a labeled search input and preserve the terms, operators, and grouping in a submitted Boolean query when retrieving CORE papers.

#### Scenario: Submit the example from the brief
- **WHEN** the user submits `(drone AND (package OR delivery))`
- **THEN** the app sends the complete expression as a single query parameter
- **AND** it displays the returned paper results

#### Scenario: Reject a blank query
- **WHEN** the user submits a blank query
- **THEN** the app identifies the invalid field and sends no search request

### Requirement: Adjustable result limit
The application SHALL let the user submit a whole-number total result limit from 1 to 10,000 (default 100) and a whole-number page size from 1 to 100 (default 10), and apply them to paper retrieval and presentation.

#### Scenario: Submit a new limit
- **WHEN** the user changes the limit to 5 and resubmits the current query
- **THEN** the app requests and displays at most 5 papers

#### Scenario: Reject an invalid limit
- **WHEN** the user submits a missing, fractional, or out-of-range limit
- **THEN** the app identifies the invalid field and sends no search request

### Requirement: Paper results and request states
The application SHALL display paper titles, available metadata, and CORE links, with readable fallbacks for missing metadata. It SHALL distinguish a pending request, a successful empty response, and a failed request.

#### Scenario: A paper has incomplete metadata
- **WHEN** CORE returns a paper without an author, publication year, or abstract
- **THEN** the app renders the paper with readable fallbacks and a link to CORE

#### Scenario: A search fails
- **WHEN** the submitted search fails
- **THEN** the app shows a search error and allows the user to try again

#### Scenario: A search finds no papers
- **WHEN** CORE returns a successful empty result
- **THEN** the app reports that no papers were found

### Requirement: Latest search determines the results
The application SHALL prevent a superseded search or limit request from changing the visible results of a newer submission.

#### Scenario: A newer search supersedes a pending request
- **WHEN** the user submits a new query while the previous request is in flight
- **THEN** only the current query's response can update the result list
