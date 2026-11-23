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
papers to show (1–100, default 10), and submit. To apply a new display limit,
edit the number and submit again. The paper cards link to CORE and show a
full-text link when available.

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

## Build and test

```bash
npm run build
npm test
```

The production build writes static files to `dist/scipris/browser/`. The test
command runs the Vitest suite once using jsdom. When hosting the static files,
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
