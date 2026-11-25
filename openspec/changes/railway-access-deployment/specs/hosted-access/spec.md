## ADDED Requirements

### Requirement: Verified email access
The hosted application SHALL allow authenticated users whose email domain is exactly cypris.ai or whose email is exactly richard.moorhead@gmail.com. Cloudflare Access SHALL require email one-time PIN verification.

#### Scenario: Cypris reviewer signs in
- **WHEN** a visitor verifies an address at cypris.ai
- **THEN** the visitor can access the application and its APIs

#### Scenario: Richard signs in
- **WHEN** a visitor verifies richard.moorhead@gmail.com
- **THEN** the visitor can access the application and its APIs

#### Scenario: Other address is denied
- **WHEN** a visitor uses an unrelated email, a cypris.ai subdomain, or a domain that only ends with the characters cypris.ai
- **THEN** the origin denies access

### Requirement: Origin authentication
The production server MUST verify Access token signatures, issuer, audience, and expiration before serving application assets or API responses. Missing configuration MUST prevent startup.

#### Scenario: Direct origin request
- **WHEN** a request reaches the Railway origin without a valid Access token, including a forged identity header
- **THEN** the origin returns 403 without serving application data or contacting upstream services

#### Scenario: Invalid token
- **WHEN** a token is expired, forged, missing expiration, or issued for another application or issuer
- **THEN** the origin returns 403

#### Scenario: Platform health probe
- **WHEN** Railway sends GET or HEAD to /healthz without a token
- **THEN** the server returns only a minimal healthy response with no application data or credentials

### Requirement: Hosted application services
The production service SHALL serve the Angular build, proxy the documented CORE search and aggregation routes, and provide OpenRouter drafting on the same origin. API keys SHALL remain server-side.

#### Scenario: Search and aggregate
- **WHEN** an authorized user searches or requests grouped counts
- **THEN** the service forwards the documented method, query, and JSON body to CORE with its server-held credential and preserves upstream status and retry guidance

#### Scenario: Hosted drafting
- **WHEN** an authorized user requests natural-language drafting with OpenRouter configured
- **THEN** the existing drafting handler processes the request without exposing its API key

#### Scenario: Unapproved proxy route
- **WHEN** an authorized user requests an unsupported API route or method
- **THEN** the server rejects the request without forwarding it upstream

#### Scenario: Cross-origin write
- **WHEN** a write request identifies an origin other than the configured public origin
- **THEN** the server returns 403
