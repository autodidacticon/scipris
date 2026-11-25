# Design

## Context

Both the development proxy and standalone service use the same Node handler. The browser already submits descriptions, cancels obsolete drafts and renders validated interpretations.

## Goals / Non-Goals

Provider selection belongs to the developer running the service. Browser requests contain only the research description.

## Decisions

- Use the official noninteractive CLI under the developer's login. The service can check login status without handling stored tokens.
- Keep one prompt, set of examples and result validator across transports so publication dates, limits and Boolean expressions retain their semantics.
- Pass the description on standard input. Run a fixed executable with server-selected arguments in a temporary working directory. Restrict CLI tools, session persistence and the child environment.
- Limit CLI requests to loopback clients and origins. Apply the existing deadline, cancellation and rolling request budget.

## Risks / Trade-offs

CLI startup and authentication add latency. Check availability on status requests and surface provider failures through the existing error state. Document the tested CLI versions and an optional model override for local deployments.
