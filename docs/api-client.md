# CORE API client

The [checked-in OpenAPI contract](api/core-v3.openapi.yaml) defines the CORE
operations and wire models used by Scipris. See the [CORE API research](api/core-api.md)
for the evidence behind the contract and the remaining live API checks.

## Generate and verify

```bash
npm ci
npm run api:lint
npm run api:generate
npm run test:api
```

The [generator script](../scripts/generate-core-api.mjs) pins OpenAPI Generator
**7.23.0** and verifies its JAR against a checked-in SHA-256 digest. It requires
Java **11 or newer** on `PATH` and the project's pinned Node.js and npm versions.
The first run downloads the JAR from Maven Central into
`.cache/openapi-generator/`. For offline generation, set
`OPENAPI_GENERATOR_JAR` to a local copy of the same JAR. The script verifies its
digest in either case.

The [generator configuration](../scripts/core-api-generator.json) targets Angular
21.2.25. Its `typescript-angular` client uses Angular dependency injection,
`HttpClient`, and RxJS observables. Named request parameters make optional
pagination fields explicit. Generated models keep wire names, nullability, and
the numeric or string forms of the echoed `limit`. The application uses its
existing Angular and RxJS packages at runtime. Java is used during generation.

Edit the contract, then run generation and include its output in
`src/app/core/api/generated/`. The script replaces that tree with the generated
TypeScript and normalizes trailing whitespace. The provider, public adapter,
and error mapping live alongside the generated directory.

`npm run test:api` runs the client suite without the application shell test or
live API calls. `bash scripts/verify.sh` installs the locked dependencies, lints
the contract, parses the JSON fixtures, compares regenerated files with the
checked-in tree, builds the production app, and runs the full test suite.

## Configure the API origin and credentials

The [browser bootstrap](../src/main.ts) registers `provideHttpClient(withFetch())` and
`provideCoreApi()`. The browser defaults to the same-origin prefix `/api/core`.
Use `provideCoreApi({ baseUrl })` to change the prefix or use an absolute base URL,
such as `https://api.core.ac.uk/v3` for a trusted server-side caller. The configured
base ends at the proxy prefix or CORE's `/v3` prefix.

Use a same-origin server proxy for browser calls. A past CORE GET lacked
`Access-Control-Allow-Origin`, and preflight for aggregation has yet to be
verified. A private API key also requires a server-side boundary. Configure the
proxy to forward `/api/core/search/works/` and `/api/core/search/works/aggregate`
to the corresponding CORE `/v3` paths. Preserve the query string, method, JSON
body, upstream status, and retry guidance. Set a server environment variable
such as `CORE_API_KEY` and have the proxy inject `Authorization: Bearer <key>`
upstream. `npm start` runs the Angular development proxy configured in
[`scripts/core-proxy.mjs`](../scripts/core-proxy.mjs) and reads `CORE_API_KEY`
from the server environment or the local secrets file configured in the
[development setup](../README.md#enable-natural-language-drafting). Configure a proxy separately for a static production
build. A direct browser base URL is
suitable only for operations where anonymous access and CORS work for the
deployed origin. [CORE CORS and auth research](api/core-api.md#authentication-cors-rate-limits-and-errors)

A trusted server-side Angular caller can pass
`provideCoreApi({ baseUrl, bearerToken: () => process.env['CORE_API_KEY'] })`
to send the bearer header directly. Keep private keys in the server's
environment or secret store. Browser bundle configuration should contain only
the base URL.

## Use the client

Inject `CoreApiClient` from `src/app/core/api` in an Angular injection context.
The public entry point also exports types for search parameters, works, and
aggregation requests and responses.

```ts
const core = inject(CoreApiClient);
const q = '(drone AND (package OR delivery))';
const firstPage$ = core.searchWorks({ q, limit: 10, offset: 0 });
const nextPage$ = core.searchWorks({ q, limit: 10, offset: 10 });
const years$ = core.aggregateWorks({ q, aggregations: ['yearPublished'] });
```

Pass the raw query to both operations. The generated GET serializer encodes it
once as a single parameter, and aggregation sends it as a JSON string. Search
requests exclude `fullText` by default. The search adapter accepts integer
limits from 1 to 100 and offset requests within the 10,000-work window. Invalid
page bounds emit a `RangeError`. Use `totalHits` to track the reported total,
which can exceed the offset window. For cursor pagination, start with
`scroll: true` and continue with the returned `scrollId` and the same query and
page size. Omit `offset` and `scroll` on continuation.

Read year counts from `response.aggregations.yearPublished`. The aggregation
call takes no display limit or offset. Verify bucket coverage and missing years
as described in the [aggregation research](api/core-api.md#complete-query-aggregation)
before labeling it a complete distribution. If necessary, the typed search
operations support a separate paginated tally of distinct Work IDs.

HTTP or JSON decoding failures reach the subscription's error handler as
`CoreApiError`. Read `status` for quota failures (`429`), network or browser
failures (`0`), and other HTTP failures. `retryAfter` preserves the raw
`X-RateLimit-Retry-After` header, falling back to `Retry-After` when present.
`upstreamMessage` carries a JSON message when CORE supplies one. A successful
empty search returns `results: []`.
