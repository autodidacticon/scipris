import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import yearBuckets from '../../../../docs/api/fixtures/works-aggregate-years.json';
import emptyPage from '../../../../docs/api/fixtures/works-empty.json';
import queryFailure from '../../../../docs/api/fixtures/works-error.json';
import firstPage from '../../../../docs/api/fixtures/works-first-page.json';
import lastPage from '../../../../docs/api/fixtures/works-last-page.json';
import { CoreApiClient, CoreApiError, provideCoreApi } from './index';

const q = '(drone AND (package OR delivery))';
const searchUrl = '/api/core/search/works/';
const aggregateUrl = '/api/core/search/works/aggregate';

function queryParams(url: string): URLSearchParams {
  return new URL(url, 'https://app.example').searchParams;
}

describe('CORE API HTTP client', () => {
  let api: CoreApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideCoreApi()],
    });
    api = TestBed.inject(CoreApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('encodes the complete Boolean value once and sends display parameters', async () => {
    const query = '(drone AND (title:"package + delivery" OR "C++ & café %20 #5 = α"))';
    const result = firstValueFrom(api.searchWorks({ q: query, limit: 2, offset: 0 }));
    const req = http.expectOne(({ url, method }) => url === searchUrl && method === 'GET');

    expect(req.request.urlWithParams).toContain(`?q=${encodeURIComponent(query)}&`);
    expect(Object.fromEntries(queryParams(req.request.urlWithParams))).toEqual({
      q: query,
      limit: '2',
      offset: '0',
      exclude: 'fullText',
    });
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.responseType).toBe('json');
    req.flush(firstPage);
    await expect(result).resolves.toEqual(firstPage);
  });

  it('returns the next offset page with its original wire values', async () => {
    const result = firstValueFrom(api.searchWorks({ q, limit: 2, offset: 2 }));
    const req = http.expectOne(({ url }) => url === searchUrl);
    expect(queryParams(req.request.urlWithParams).get('offset')).toBe('2');
    req.flush(lastPage);
    await expect(result).resolves.toMatchObject({
      totalHits: 3,
      results: [{ id: 103, yearPublished: 2023 }],
      limit: '2',
      scrollId: null,
    });
  });

  it('starts a scroll and sends the opaque continuation with the same query and page size', async () => {
    const first = firstValueFrom(api.searchWorks({ q, limit: 2, scroll: true }));
    const start = http.expectOne(({ url }) => url === searchUrl);
    expect(Object.fromEntries(queryParams(start.request.urlWithParams))).toEqual({
      q,
      limit: '2',
      scroll: 'true',
      exclude: 'fullText',
    });
    const cursor = 'opaque+A/= %';
    start.flush({ ...firstPage, scrollId: cursor });
    const { scrollId } = await first;
    expect(scrollId).toBe(cursor);

    const next = firstValueFrom(api.searchWorks({ q, limit: 2, scrollId: scrollId! }));
    const continuation = http.expectOne(({ url }) => url === searchUrl);
    expect(Object.fromEntries(queryParams(continuation.request.urlWithParams))).toEqual({
      q,
      limit: '2',
      scrollId: cursor,
      exclude: 'fullText',
    });
    continuation.flush(lastPage);
    await expect(next).resolves.toEqual(lastPage);
  });

  it.each([{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 9991 }])(
    'rejects an invalid page without making a request (%j)',
    async (page) => {
      await expect(firstValueFrom(api.searchWorks({ q, ...page }))).rejects.toBeInstanceOf(
        RangeError,
      );
    },
  );

  it('accepts a successful empty page', async () => {
    const result = firstValueFrom(api.searchWorks({ q }));
    const req = http.expectOne(({ url }) => url === searchUrl);
    expect(Object.fromEntries(queryParams(req.request.urlWithParams))).toEqual({
      q,
      exclude: 'fullText',
    });
    req.flush(emptyPage);
    await expect(result).resolves.toMatchObject({ totalHits: 0, results: [] });
  });

  it('requests year buckets for the whole query with a JSON body', async () => {
    const body = { q, aggregations: ['yearPublished'] };
    const result = firstValueFrom(api.aggregateWorks(body));
    const req = http.expectOne({ url: aggregateUrl, method: 'POST' });
    expect(req.request.headers.get('Content-Type')).toBe('application/json');
    expect(req.request.body).toEqual(body);
    req.flush(yearBuckets);
    const response = await result;
    expect(response.aggregations['yearPublished']).toEqual({ '2023': 1, '2024': 1 });
  });

  it('preserves CORE retry guidance for an aggregation quota failure', async () => {
    const result = firstValueFrom(api.aggregateWorks({ q, aggregations: ['yearPublished'] }));
    const req = http.expectOne(aggregateUrl);
    const retryAfter = '2026-11-22T23:12:00Z';
    req.flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': retryAfter, 'Retry-After': '30' },
    });
    await expect(result).rejects.toBeInstanceOf(CoreApiError);
    await expect(result).rejects.toMatchObject({ status: 429, retryAfter });
  });

  it('propagates the documented search failure with the upstream message', async () => {
    const result = firstValueFrom(api.searchWorks({ q: '(' }));
    http.expectOne(({ url }) => url === searchUrl).flush(queryFailure, {
      status: 500,
      statusText: 'Internal Server Error',
    });
    await expect(result).rejects.toMatchObject({
      status: 500,
      upstreamMessage: queryFailure.message,
      retryAfter: null,
    });
  });

  it('propagates other HTTP errors with an unknown body format', async () => {
    const result = firstValueFrom(api.searchWorks({ q }));
    http.expectOne(({ url }) => url === searchUrl).flush('Bad gateway', {
      status: 502,
      statusText: 'Bad Gateway',
    });
    await expect(result).rejects.toMatchObject({ status: 502, upstreamMessage: undefined });
  });

  it('propagates network and browser CORS failures as status zero', async () => {
    const result = firstValueFrom(api.searchWorks({ q }));
    http.expectOne(({ url }) => url === searchUrl).error(new ProgressEvent('error'));
    await expect(result).rejects.toMatchObject({ status: 0, retryAfter: null });
  });
});

describe('CORE API JSON transport and configuration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses wire JSON and sends a configured bearer header to the configured base URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify(lastPage), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const bearerToken = vi.fn(() => 'fixture-key');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideCoreApi({ baseUrl: 'https://core.example/v3/', bearerToken }),
      ],
    });

    const result = await firstValueFrom(TestBed.inject(CoreApiClient).searchWorks({ q }));
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe('/v3/search/works/');
    expect(String(url)).toMatch(/^https:\/\/core\.example\/v3\//);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-key');
    expect(bearerToken).toHaveBeenCalledOnce();
    expect(result).toEqual(lastPage);
  });

  it('propagates invalid JSON as a decoding failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideCoreApi()],
    });

    await expect(
      firstValueFrom(TestBed.inject(CoreApiClient).searchWorks({ q })),
    ).rejects.toMatchObject({ status: 200, message: 'Could not decode the CORE API response.' });
  });
});
