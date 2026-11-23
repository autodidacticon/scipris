# Spec Delta

## Purpose

Connect the browser app to CORE Works through its own origin while keeping API credentials on the server.

## ADDED Requirements

### Requirement: Same-origin requests with server-side credentials
The browser SHALL send Works searches and aggregation requests through a same-origin proxy. The proxy SHALL supply the configured CORE credential in the upstream authorization header. Browser requests and built assets MUST be free of that credential.

#### Scenario: A configured proxy sends a request to CORE
- **WHEN** the browser makes a Works request and the proxy has a configured CORE key
- **THEN** the proxy forwards it to CORE v3 with the key in the upstream authorization header
- **AND** the browser sends no CORE credential

### Requirement: Distinguish API errors from empty responses
The CORE client SHALL report HTTP, network, and response decoding failures as errors distinguishable from a successful response with no papers. It SHALL preserve upstream retry guidance when provided.

#### Scenario: CORE imposes a rate limit
- **WHEN** CORE returns an HTTP 429 response with retry guidance
- **THEN** the client reports the rate limit as an error and preserves the retry guidance

#### Scenario: CORE returns invalid JSON
- **WHEN** a CORE response cannot be decoded as JSON
- **THEN** the client reports a decoding failure
