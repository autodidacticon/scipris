# Mini Cypris

Mini Cypris is an Angular application for exploring scientific papers from CORE.
The [project brief](docs/project.md) describes the research search experience.

## Setup

Use Node.js **22.23.2** and npm **10.9.8**, as pinned in `.nvmrc` and
`package.json`. If you use nvm, run `nvm install` and `nvm use` from the
repository root. Then install dependencies from `package-lock.json`.

```bash
npm ci
```

## Run locally

Register for a [CORE API key](https://core.ac.uk/services/api) and set
`CORE_API_KEY` in the terminal that runs the development server.

```bash
export CORE_API_KEY='your-core-key'
npm start
```

Open [http://localhost:4200](http://localhost:4200) to view the app. The Angular
development proxy forwards the Works routes to CORE v3 and adds the bearer
header server-side. Without a key, the proxy attempts anonymous access, which
may reject aggregation or withhold paper metadata. Keep the key out of Angular
configuration and source control.

Enter a query such as `(drone AND (package OR delivery))`, choose how many
papers to show (1–100, default 10), and submit. Boolean operators accept any
casing, and `&&`, `||`, and `!` mean AND, OR, and NOT. To apply a new display limit,
edit the number and submit again. Under **Publication date**, set **From**,
**Through**, or both. Both endpoints are inclusive. Clear a field to remove
that bound. The paper cards link to CORE and show a
full-text link when available.

## Enable natural-language drafting

Set `OPENROUTER_API_KEY` in the server environment, then run:

```bash
NLP_ENABLED=true npm start
```

To use an existing dotenv secrets file across local restarts, create a
gitignored `.env.local` in the repository root with the following settings.
Use the absolute path to your file.

```dotenv
NLP_ENABLED=true
SCIPRIS_SECRETS_FILE=/absolute/path/to/.secrets
```

Restart `npm start` after changing proxy settings or routes. The development
proxy reads the OpenRouter and CORE keys from the specified file. Exported
keys and `NLP_ENABLED` take precedence. To check the running server, open
[`/api/nlp/status`](http://localhost:4200/api/nlp/status) and look for
`"enabled": true`. An HTML response means the server is missing the NLP route.

The Angular development server hosts the drafting API as well as the CORE
proxy. The search menu shows the NLP switch even when drafting is unavailable.
The server enables the switch when the flag and key are both present. The model
defaults to `openai/gpt-4o-mini`. Set `OPENROUTER_MODEL` to use another
OpenRouter model that supports strict JSON Schema responses.

Turn on **Natural language search (NLP)** below the search menu to replace manual
entry with a description field. After you pause typing for one second, the app
sends your description to OpenRouter. Set `NLP_DEBOUNCE_MS` in the server
environment or the development `.env.local` and restart the server to change
the delay (for example, `NLP_DEBOUNCE_MS=1500` for 1.5 seconds).
The numeric limiter appears once an interpretation is available. For example, “Show 5 papers about
solar energy published from 2020 through 2022” sets the limit to 5 and fills
both date fields. Without a requested count, the limit is 10. You can edit
the count and dates before submitting. The manual limiter remembers its own value.
“Within the last year” covers the twelve months through today in UTC.
“Published last year” covers the previous January through December.
One interpretation opens directly in the inline Boolean editor. For an ambiguous
request, choose a labeled interpretation from the dropdown. Switching options
restores your edits. Review any unapplied constraints or revise the description
if prompted for clarification. **Search papers** runs the visible Boolean query
for both paper results and year counts.

For production, run `NLP_ENABLED=true npm run nlp:serve` with the key in its
environment. Reverse proxy `GET /api/nlp/status` and `POST /api/nlp/translate`
on the app's origin to this service at `127.0.0.1:4318` (port override:
`NLP_PORT`). Keep the OpenRouter key on the server. Each process allows ten
translations per rolling minute, limits descriptions to 1,000 characters,
and gives the provider 30 seconds. Size a shared budget at the reverse proxy
if deploying multiple replicas. Disable drafting by unsetting `NLP_ENABLED`
and restarting the service.

## Embed the research search

Import `ResearchSearch` from `src/app/research-search/research-search.ts` into a
standalone host component's `imports` and render `<app-research-search />`.
The optional `idPrefix` input defaults to `research-search`. Set a distinct
prefix for each instance on the same page so labels and section names resolve
to the correct instance, for example `<app-research-search idPrefix="papers" />`.
The component has no outputs and owns its form and request state. Register
`provideHttpClient()` and `provideCoreApi()` at bootstrap. The component uses
`ResearchSearchData` for data access, which calls the generated Works client
through `CoreApiClient`.

The publication-year chart shows counts for the submitted query. It requests
CORE's year buckets without a display limit and compares their sum with CORE's
reported match count. If the buckets do not reconcile, it checks separate
pages of distinct papers within the documented 10,000-work offset window and
counts missing years explicitly. If the check cannot establish coverage, the
chart labels the available counts as partial and explains why. If aggregation
fails, the papers stay usable and the chart shows its own error. Counts and
year labels are available as text. Live bucket completeness, match-count
exactness, and scroll availability for this CORE account still need review.
Resubmitting the same query at the same limit refreshes both the papers and the
chart. Changing only the limit refreshes the papers.

Whole-year ranges use CORE’s publication-year filter. For a range that covers
part of a year, the app checks publication dates on successive pages of matching
candidates. The list and chart update as dates are checked. A year-only record
qualifies when its entire year falls inside the range. If CORE interrupts the
scan or its 10,000-work paging window is reached, both views show partial coverage.

## Build and test

```bash
npm run build
npm test
```

The production build writes static files to `dist/scipris/browser/`. The test
command runs the Node drafting service tests and the Angular Vitest suite with
jsdom. The service tests use a fixture provider and ephemeral loopback ports.
When hosting the static files,
configure the hosting server to proxy `/api/core/search/works/` and
`/api/core/search/works/aggregate` to CORE's corresponding `/v3` routes and
inject the key server-side. The Angular development proxy applies to `npm start`.

Run the orchestrator check from the repository root to install from the lockfile,
validate and regenerate the CORE client, build the app, and run tests in CI mode.
The check requires Java 11 or newer for generation.

```bash
bash scripts/verify.sh
```

See the [CORE API client guide](docs/api-client.md) for generation, proxy
configuration, and client usage.
