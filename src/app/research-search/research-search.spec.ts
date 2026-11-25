import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import yearBuckets from '../../../docs/api/fixtures/works-aggregate-years.json';
import emptyPage from '../../../docs/api/fixtures/works-empty.json';
import firstPage from '../../../docs/api/fixtures/works-first-page.json';
import lastPage from '../../../docs/api/fixtures/works-last-page.json';
import { provideCoreApi } from '../core/api';
import { ResearchSearch } from './research-search';

const booleanQuery = '(drone AND (package OR delivery))';
const searchUrl = '/api/core/search/works/';
const allDimensions = ['yearPublished', 'documentType', 'authors', 'contributors', 'publisher', 'language', 'fieldsOfStudy'];
const aggregateUrl = '/api/core/search/works/aggregate';

describe('ResearchSearch', () => {
  let fixture: ComponentFixture<ResearchSearch>;
  let http: HttpTestingController;
  let root: HTMLElement;
  let query: HTMLInputElement;
  let limit: HTMLInputElement;
  let button: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideCoreApi()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResearchSearch);
    fixture.componentRef.setInput('idPrefix', 'papers');
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: '/api/nlp/status' }).flush({ enabled: false });
    fixture.detectChanges();
    root = fixture.nativeElement;
    query = root.querySelector('input[type=search]')!;
    limit = root.querySelector('input[type=number]')!;
    button = root.querySelector('button')!;
  });

  afterEach(() => http.verify());

  function submit(q: string, resultLimit: string) {
    query.value = q;
    limit.value = resultLimit;
    // Exercise the native submit action and its Angular event binding.
    button.click();
    fixture.detectChanges();
  }

  function expectPage(q: string, resultLimit: number, offset = 0, order = 'desc') {
    const page = http.expectOne(({ method, url }) => method === 'GET' && url === searchUrl);
    const params = new URL(page.request.urlWithParams, 'https://example.test').searchParams;
    expect(Object.fromEntries(params)).toEqual({
      q,
      limit: String(resultLimit),
      offset: String(offset),
      sort: 'yearPublished:' + order + ',id:asc',
      exclude: 'fullText',
    });
    return page;
  }

  function expectYears(q: string) {
    const aggregate = http.expectOne({ method: 'POST', url: aggregateUrl });
    expect(aggregate.request.body).toEqual({ q, aggregations: allDimensions });
    return aggregate;
  }

  function chartRows() {
    return Array.from(root.querySelectorAll('.year-counts tbody tr'), (row) => [
      row.querySelector('th')?.textContent?.trim(),
      row.querySelector('td')?.textContent?.trim(),
    ]);
  }

  function dates(from: string, through: string) {
    const fields = root.querySelectorAll<HTMLInputElement>('input[type=date]');
    for (const [index, value] of [from, through].entries()) {
      fields[index].value = value;
      fields[index].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }
    return fields;
  }

  it('pages through the submitted cap and retries a failed page without repeating the chart request', () => {
    const page = (offset: number, length: number) => ({
      totalHits: 1201, results: Array.from({ length }, (_, i) => ({ id: offset + i + 1, title: 'Paper ' + (offset + i + 1) })),
    });
    const next = () => root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!;
    submit('solar', '25');
    expectPage('solar', 10).flush(page(0, 10));
    expectYears('solar').flush({ aggregations: { yearPublished: { '2020': 1201 } } });
    fixture.detectChanges();
    next().click();
    fixture.detectChanges();
    expectPage('solar', 10, 10).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(root.querySelector('.paper-title a')?.textContent).toBe('Paper 1');
    root.querySelector<HTMLButtonElement>('.results [role=alert] button')!.click();
    expectPage('solar', 10, 10).flush(page(10, 10));
    fixture.detectChanges();
    expect(root.querySelector('.paper-title a')?.textContent).toBe('Paper 11');
    next().click();
    expectPage('solar', 5, 20).flush(page(20, 5));
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper-row')).toHaveLength(5);
    expect(next().getAttribute('aria-disabled') === 'true' || next().disabled).toBe(true);
    expect(chartRows()).toEqual([['2020', '1,201']]);
  });

  it('shows three columns and independent abstract disclosures with linked titles', () => {
    const abstract = 'A study of solar energy. '.repeat(20).trim();
    submit('solar', '2');
    expectPage('solar', 2).flush({ totalHits: 2, results: [
      { id: 3, title: 'Solar study', abstract, downloadUrl: 'https://example.test/paper' }, { id: 4 },
    ] });
    expectYears('solar').flush(yearBuckets);
    fixture.detectChanges();
    expect(Array.from(root.querySelectorAll('.paper-table thead th'), cell => cell.textContent?.trim()))
      .toEqual(['Title', 'Authors', 'Year published ↓']);
    const [first, second] = Array.from(root.querySelectorAll<HTMLTableSectionElement>('.paper-table tbody'));
    const toggle = first.querySelector('button')!;
    const detail = first.querySelector<HTMLTableRowElement>('.abstract-row')!;
    expect(toggle.getAttribute('aria-controls')).toBe(detail.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(detail.hidden).toBe(true);
    const title = first.querySelector('a')!;
    expect(title.textContent).toBe('Solar study');
    expect(title.getAttribute('href')).toBe('https://core.ac.uk/works/3');
    title.addEventListener('click', event => event.preventDefault(), { once: true });
    title.click();
    fixture.detectChanges();
    expect(detail.hidden).toBe(true);
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(detail.hidden).toBe(false);
    expect(detail.querySelector('p')?.textContent).toBe(abstract);
    expect(detail.querySelector('a')?.getAttribute('href')).toBe('https://example.test/paper');
    second.querySelector('td')!.click();
    fixture.detectChanges();
    expect(second.querySelector('p')?.textContent).toBe('No abstract available.');
    expect(second.querySelector('a')?.textContent).toBe('Untitled paper');
    first.querySelector('td')!.click();
    fixture.detectChanges();
    expect(detail.hidden).toBe(true);
    expect(second.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    http.expectNone(() => true);
  });

  it('sorts across pages, resets the offset and preserves the last successful order on failure', () => {
    root.querySelector<HTMLInputElement>('[name=pageSize]')!.value = '1';
    submit('solar', '3');
    const page = (id: number, yearPublished: number) => ({ totalHits: 9, results: [{ id, yearPublished }] });
    expectPage('solar', 1).flush(page(1, 2025));
    expectYears('solar').flush(yearBuckets);
    fixture.detectChanges();
    const sort = root.querySelector<HTMLButtonElement>('.year-sort')!;
    const header = sort.closest('th')!;
    const next = () => root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expect(header.getAttribute('aria-sort')).toBe('descending');
    next();
    expectPage('solar', 1, 1).flush(page(2, 2024));
    fixture.detectChanges();
    sort.click();
    expectPage('solar', 1, 0, 'asc').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(header.getAttribute('aria-sort')).toBe('descending');
    expect(root.querySelector('.publication-year')?.textContent).toBe('2024');
    root.querySelector<HTMLButtonElement>('.results [role=alert] button')!.click();
    expectPage('solar', 1, 0, 'asc').flush(page(9, 1980));
    fixture.detectChanges();
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expect(root.querySelector('.publication-year')?.textContent).toBe('1980');
    next();
    expectPage('solar', 1, 1, 'asc').flush(page(8, 1990));
    fixture.detectChanges();
    expect(root.querySelector('.publication-year')?.textContent).toBe('1990');
    sort.click();
    expectPage('solar', 1).flush(page(1, 2025));
    fixture.detectChanges();
    expect(header.getAttribute('aria-sort')).toBe('descending');
  });

  it('reads just the requested page in each sort order and reuses verified matches', () => {
    dates('2020-06-01', '2024-06-01');
    root.querySelector<HTMLInputElement>('[name=pageSize]')!.value = '1';
    submit('solar', '2');
    const q = '(solar) AND yearPublished>=2020 AND yearPublished<=2024';
    expectYears(q).flush(yearBuckets);
    expectPage(q, 1).flush({ totalHits: 4, results: [{ id: 9, yearPublished: 2024, publishedDate: '2024-02-01' }] });
    fixture.detectChanges();
    expect(root.querySelector('.publication-year')?.textContent).toBe('2024');
    http.expectNone(req => req.url === searchUrl);
    root.querySelector<HTMLButtonElement>('.year-sort')!.click();
    expectPage(q, 1, 0, 'asc').flush({ totalHits: 4, results: [{ id: 5, yearPublished: 2020, publishedDate: '2020-07-12' }] });
    fixture.detectChanges();
    expect(root.querySelector('.publication-year')?.textContent).toBe('2020');
    root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expectPage(q, 1, 1, 'asc').flush({ totalHits: 4, results: [{ id: 8, yearPublished: 2021 }] });
    fixture.detectChanges();
    expect(root.querySelector('.publication-year')?.textContent).toBe('2021');
    root.querySelector<HTMLButtonElement>('button[aria-label="Previous page"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.publication-year')?.textContent).toBe('2020');
    root.querySelector<HTMLButtonElement>('.year-sort')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.publication-year')?.textContent).toBe('2024');
    http.expectNone(() => true);
  });

  it('browses past the first 100 verified date matches without rerunning the scan', () => {
    dates('2024-02-01', '2024-02-28');
    root.querySelector<HTMLInputElement>('[name=pageSize]')!.value = '100';
    submit('solar', '125');
    const q = '(solar) AND yearPublished>=2024 AND yearPublished<=2024';
    expectYears(q).flush(yearBuckets);
    const dated = (id: number) => ({ id, title: 'Paper ' + id, yearPublished: 2024, publishedDate: '2024-02-12' });
    expectPage(q, 100).flush({ totalHits: 105, results: Array.from({ length: 100 }, (_, i) => dated(i + 1)) });
    fixture.detectChanges();
    expect(root.querySelector('.results .status')?.textContent).toContain('found so far');
    http.expectNone(req => req.url === searchUrl);
    root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expectPage(q, 5, 100).flush({ totalHits: 105, results: Array.from({ length: 5 }, (_, i) => dated(i + 101)) });
    fixture.detectChanges();
    expect(root.querySelector('.paper-title a')?.textContent).toBe('Paper 101');
    expect(root.querySelectorAll('.paper-row')).toHaveLength(5);
  });

  it('keeps the final nonempty page when every remaining candidate misses the date bounds', () => {
    dates('2024-04-08', '2024-04-18');
    root.querySelector<HTMLInputElement>('[name=pageSize]')!.value = '2';
    submit('solar', '10');
    const q = '(solar) AND yearPublished>=2024 AND yearPublished<=2024';
    const paper = (id: number, day: string) => ({ id, title: 'Paper ' + id, publishedDate: '2024-04-' + day });
    expectYears(q).flush(yearBuckets);
    expectPage(q, 2).flush({ totalHits: 4, results: [paper(1, '08'), paper(2, '18')] });
    fixture.detectChanges();
    http.expectNone(req => req.url === searchUrl);
    root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expectPage(q, 2, 2).flush({ totalHits: 4, results: [paper(3, '01'), paper(4, '29')] });
    fixture.detectChanges();
    expect(root.querySelector('.results .status')?.textContent).toContain('1–2 of 2 matches');
    expect(root.querySelector('.results .status')?.textContent).not.toContain('so far');
    expect(root.querySelector('.paper-title a')?.textContent).toBe('Paper 1');
    expect(root.querySelector('button[aria-label="Next page"]')).toBeNull();
  });

  it('shows year counts in Analytics and edits publication dates in Search parameters', () => {
    root.querySelector<HTMLInputElement>('[name=pageSize]')!.value = '1';
    submit('solar', '2');
    expectPage('solar', 1).flush({ totalHits: 3, results: [{ id: 1 }] });
    expectYears('solar').flush({ aggregations: { yearPublished: { '2022': 1, '2020': 1, '2123': 1 } } });
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expectPage('solar', 1, 1).flush({ totalHits: 3, results: [{ id: 2 }] });
    fixture.detectChanges();
    expect(chartRows()).toEqual([['2022', '1'], ['2020', '1'], ['Unknown year', '1']]);
    const analytics = root.querySelector('.analytics')!;
    expect(analytics.querySelector('select, input[type=date]')).toBeNull();
    expect(analytics.textContent).not.toContain('Use years');
    expect(root.querySelectorAll('.search-filters input[type=date]')).toHaveLength(2);
    dates('2020-01-01', '2022-12-31');
    expect(root.querySelector('.results .status')?.textContent).toContain('2–2');
    http.expectNone(() => true);
    button.click();
    const q = '(solar) AND yearPublished>=2020 AND yearPublished<=2022';
    expectPage(q, 1).flush({ totalHits: 2, results: [{ id: 1 }] });
    expectYears(q).flush({ aggregations: { yearPublished: { '2020': 1, '2022': 1 } } });
    fixture.detectChanges();
    expect(root.querySelector('.results .status')?.textContent).toContain('1–1');
  });

  it('validates calendar bounds and applies an open year range to both CORE requests', () => {
    const [, end] = dates('2024-01-01', '2023-12-31');
    const filters = root.querySelector('details')!;
    filters.open = false;
    submit('solar or wind', '4');
    expect(filters.open).toBe(true);
    expect(document.activeElement).toBe(end);
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('[role=alert]')?.textContent).toContain('on or after');
    http.expectNone(() => true);
    dates('2024-01-01', '');
    filters.open = false;
    submit('solar or wind', '4');
    expect(filters.open).toBe(false);
    const q = `(solar OR wind) AND yearPublished>=2024 AND yearPublished<=${new Date().getUTCFullYear() + 1}`;
    expectPage(q, 4).flush({ totalHits: 7, results: [] });
    expectYears(q).flush({ aggregations: { yearPublished: { '2024': 7 } } });
    dates('', '');
    submit('solar or wind', '4');
    expectPage('solar OR wind', 4).flush(emptyPage);
    expectYears('solar OR wind').flush({ aggregations: {} });
  });

  it('resumes from the next candidate when the researcher increases the exact-day result limit', () => {
    dates('2024-02-28', '2024-02-29');
    submit('solar', '1');
    const q = '(solar) AND yearPublished>=2024 AND yearPublished<=2024';
    expectYears(q).flush({ aggregations: { yearPublished: { '2024': 19 } } });
    const work = (id: number, day: string | null) => ({
      id, title: 'Paper ' + id, yearPublished: 2024, publishedDate: day && day + 'T12:30:00+00:00',
    });
    expectPage(q, 1).flush({ totalHits: 5, results: [work(1, '2024-02-01')] });
    expectPage(q, 1, 1).flush({ totalHits: 5, results: [work(2, null)] });
    fixture.detectChanges();
    expect(root.querySelector('.results .status')?.textContent).toContain('Checking publication dates');
    expectPage(q, 1, 2).flush({ totalHits: 5, results: [work(3, '2024-02-28')] });
    http.expectNone(req => req.url === searchUrl);
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper-row')).toHaveLength(1);
    expect(root.querySelector('.paper-title a')?.textContent).toBe('Paper 3');
    expect(chartRows()).toEqual([['2024', '19']]);
    expect(root.querySelector('.analytics .status')?.textContent).toContain('2024–2024');
    submit('solar', '3');
    expectPage(q, 2, 3).flush({ totalHits: 5, results: [work(4, '2024-02-29'), work(5, '2024-03-01')] });
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper-row')).toHaveLength(2);
    http.expectNone(() => true);
  });

  it('keeps verified day matches and labels an interrupted scan as partial', () => {
    dates('', '2024-02-29');
    submit('solar', '7');
    const q = '(solar) AND yearPublished>=1 AND yearPublished<=2024';
    expectYears(q).flush({ aggregations: { yearPublished: { '2023': 8 } } });
    expectPage(q, 7).flush({ totalHits: 3, results: [{ id: 1, yearPublished: 2023 }] });
    expectPage(q, 2, 1).flush({}, { status: 429, statusText: 'Too many requests' });
    fixture.detectChanges();
    expect(root.querySelector('.results .status')?.textContent).toContain('Partial coverage');
    expect(root.querySelector('.results .status')?.textContent).toContain('1 of 3 candidate papers');
    expect(chartRows()).toEqual([['2023', '8']]);
    root.querySelector<HTMLButtonElement>('.results [role=alert] button')!.click();
    expectPage(q, 2, 1).flush({ totalHits: 3, results: [{ id: 2, yearPublished: 2023 }, { id: 3, yearPublished: 2023 }] });
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper-row')).toHaveLength(3);
    expect(root.querySelector('.results [role=alert]')).toBeNull();
  });

  it('labels native controls and focuses invalid fields before issuing any request', () => {
    const filters = root.querySelector('details')!;
    expect(filters.open).toBe(true);
    expect(filters.querySelector('summary')?.textContent).toBe('Search parameters');
    expect(filters.contains(limit)).toBe(true);
    expect(filters.querySelectorAll('input[type=date]')).toHaveLength(2);
    expect(query.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(query.labels?.[0].textContent).toBe('Search query');
    expect(limit.labels?.[0].textContent).toBe('Total results');
    expect(query.getAttribute('aria-describedby')).toBe('papers-query-help');
    expect(root.querySelector('#papers-query-help')?.textContent).toContain(booleanQuery);
    expect(limit.valueAsNumber).toBe(100);
    expect([limit.min, limit.max, limit.step]).toEqual(['1', '10000', '1']);
    expect(root.querySelector('figure')).toBeNull();
    const nlp = root.querySelector<HTMLInputElement>('input[role=switch]')!;
    expect(nlp.disabled).toBe(true);
    expect(nlp.checked).toBe(false);
    expect(nlp.getAttribute('aria-describedby')).toBe('papers-nlp-unavailable');
    expect(root.querySelector('#papers-nlp-unavailable')?.textContent).toContain('unavailable');
    expect(root.querySelector('.draft-help')).toBeNull();

    submit('   ', '10');
    expect(document.activeElement).toBe(query);
    expect(query.getAttribute('aria-invalid')).toBe('true');
    expect(query.getAttribute('aria-describedby')).toContain('papers-query-error');
    expect(root.querySelector('[role=alert]')?.textContent).toContain('Enter a search query');

    for (const invalidLimit of ['', '0', '10001', '1.5']) {
      filters.open = false;
      submit(booleanQuery, invalidLimit);
      expect(filters.open).toBe(true);
      expect(document.activeElement).toBe(limit);
      expect(limit.getAttribute('aria-invalid')).toBe('true');
      expect(limit.getAttribute('aria-describedby')).toBe('papers-limit-error');
      expect(root.querySelector('[role=alert]')?.textContent).toContain('whole number');
    }
    const pageSize = root.querySelector<HTMLInputElement>('[name=pageSize]')!;
    expect(pageSize.labels?.[0].textContent).toBe('Results per page');
    expect([pageSize.value, pageSize.min, pageSize.max]).toEqual(['10', '1', '100']);
    for (const invalidSize of ['', '0', '101', '1.5']) {
      pageSize.value = invalidSize;
      filters.open = false;
      submit(booleanQuery, '10');
      expect(filters.open).toBe(true);
      expect(document.activeElement).toBe(pageSize);
      expect(pageSize.getAttribute('aria-invalid')).toBe('true');
    }
    http.expectNone(() => true);
  });

  it('submits the Boolean expression and changes the display limit while retaining the complete chart', () => {
    submit(`  ${booleanQuery}  `, '1');
    expect(root.querySelector('[role=status]')?.textContent).toContain('Searching CORE');
    const displayRequest = expectPage(booleanQuery, 1);
    expect(displayRequest.request.urlWithParams).toContain(`q=${encodeURIComponent(booleanQuery)}&`);
    displayRequest.flush({ totalHits: 2, results: [firstPage.results[0]] });
    fixture.detectChanges();
    expect(root.querySelector('.analytics [role=status]')?.textContent).toContain('Loading analytics');
    expectYears(booleanQuery).flush(yearBuckets);
    fixture.detectChanges();

    expect(root.querySelectorAll('.paper-row')).toHaveLength(1);
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);
    expect(root.querySelectorAll('.year-counts th[scope=col]')).toHaveLength(2);

    submit(booleanQuery, '100');
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);
    expectPage(booleanQuery, 10).flush({ totalHits: 2, results: [firstPage.results[0], ...lastPage.results] });
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper-row')).toHaveLength(2);
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);
    http.expectNone(aggregateUrl);
  });

  it('highlights mixed-case and symbolic operators and normalizes both CORE requests', () => {
    const expression = '(drone aNd nOt "say (\\"or\\") && !") oR (BAND&&!delivery||AND* \\NOT \\(literal\\) \\!bang year!=2020 Wow!)';
    const canonical = '(drone AND NOT "say (\\"or\\") && !") OR (BAND AND NOT delivery OR AND* \\NOT \\(literal\\) \\!bang year!=2020 Wow!)';
    query.value = expression;
    query.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const mirror = root.querySelector('.query-highlights')!;
    expect(mirror.getAttribute('aria-hidden')).toBe('true');
    expect(mirror.textContent).toBe(expression);
    expect(Array.from(mirror.querySelectorAll('.parenthesis, .operator'), (token) =>
      [token.classList.contains('operator') ? 'operator' : 'parenthesis', token.textContent]))
      .toEqual([
        ['parenthesis', '('], ['operator', 'aNd'], ['operator', 'nOt'], ['parenthesis', ')'],
        ['operator', 'oR'], ['parenthesis', '('], ['operator', '&&'], ['operator', '!'],
        ['operator', '||'], ['parenthesis', ')'],
      ]);

    submit(expression, '10');
    expectPage(canonical, 10).flush({ totalHits: 2, results: [firstPage.results[0]] });
    expectYears(canonical).flush(yearBuckets);
    fixture.detectChanges();
    expect(query.value).toBe(expression);
    expect(root.querySelector('.results [role=status]')?.textContent).toContain(expression);

    query.value = '"unfinished (AND OR ! && ||';
    query.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(mirror.querySelector('.operator, .parenthesis, .group')).toBeNull();
  });

  it('shades the full extent of matched groups and preserves literal and unfinished text', () => {
    const mirror = root.querySelector('.query-highlight-line')!;
    const contents = (selector: string) => Array.from(mirror.querySelectorAll(selector), (span) => span.textContent).join('');
    const group = '(drone OR ("wind ) AND" && rain\\)))';
    const expression = 'air) AND (open ' + group + ' OR (sun) tail';
    query.value = expression;
    query.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(mirror.textContent).toBe(expression);
    expect(contents('.group')).toBe(group + '(sun)');
    expect(contents('.peach')).toBe('("wind ) AND" && rain\\))');
    expect(contents('.group.operator')).toBe('OR&&');
    expect(contents('.parenthesis:not(.group)')).toBe(')(');

    // Completing the outer group immediately extends its scope and shifts the nested tints.
    query.value += ') after';
    query.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(contents('.group')).toBe('(open ' + group + ' OR (sun) tail)');
    expect(contents('.parenthesis:not(.group)')).toBe(')');
  });

  it('cycles group colors by depth and restores them across sibling groups', () => {
    query.value = '(one (two (three (four)))(sibling)) (next)';
    query.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const mirror = root.querySelector('.query-highlight-line')!;
    const contents = (tone: string) => Array.from(mirror.querySelectorAll('.' + tone), (part) => part.textContent).join('');
    expect(contents('mint')).toBe('(one (four))(next)');
    expect(contents('peach')).toBe('(two )(sibling)');
    expect(contents('blue')).toBe('(three )');
  });

  it('renders every search-help example with the same token ranges and classes as the input', () => {
    const samples = root.querySelectorAll('#papers-query-help code');
    const texts = Array.from(samples, (sample) => sample.textContent);
    expect(texts).toEqual(['AND', 'OR', 'NOT', '&&', '||', '!', booleanQuery]);
    const tokens = (element: Element) => Array.from(element.children, (child) => [child.textContent, child.className]);
    for (const sample of samples) {
      query.value = sample.textContent!;
      query.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(tokens(sample)).toEqual(tokens(root.querySelector('.query-highlight-line')!));
      expect(sample.querySelector('.operator')).not.toBeNull();
    }
  });

  it('keeps returned year counts independent of totalHits without any reconciliation request', () => {
    submit('solar', '10');
    expectYears('solar').flush({ aggregations: { yearPublished: { '2017': 1164, '2088': 1, '2123': 2 } } });
    fixture.detectChanges();
    expect(chartRows()).toEqual([['2017', '1,164'], ['Unknown year', '3']]);
    expectPage('solar', 10).flush({ totalHits: 1201, results: firstPage.results });
    fixture.detectChanges();
    expect(chartRows()).toEqual([['2017', '1,164'], ['Unknown year', '3']]);
    expect(root.querySelector('.analytics')?.textContent).not.toContain('1,201');
    http.expectNone(() => true);
  });

  it('retains next-year issues and marks later years unavailable in both the table and the year chart', () => {
    const next = new Date().getUTCFullYear() + 1;
    submit('solar', '2');
    expectPage('solar', 2).flush({ totalHits: 2, results: [{ id: 1, yearPublished: next }, { id: 2, yearPublished: next + 1 }] });
    expectYears('solar').flush({ aggregations: { yearPublished: { [next]: 1, [next + 1]: 1 } } });
    fixture.detectChanges();
    const displayedYears = Array.from(root.querySelectorAll('.paper-row .publication-year'), year => year.textContent);
    expect(displayedYears).toEqual([String(next), 'Year unavailable']);
    expect(chartRows()).toEqual([[String(next), '1'], ['Unknown year', '1']]);
  });

  it('preserves paper metadata and links alongside an incomplete distribution', () => {
    submit(booleanQuery, '2');
    expectPage(booleanQuery, 2).flush(firstPage);
    expectYears(booleanQuery).flush({ aggregations: { yearPublished: { '2024': 1 } } });
    fixture.detectChanges();
    expect(chartRows()).toEqual([['2024', '1']]);
    expect(root.querySelectorAll('.paper-row')).toHaveLength(2);
    expect(root.querySelector('.paper-table')?.textContent).toContain('Authors unavailable');
    expect(root.querySelector('.paper-table')?.textContent).toContain('Year unavailable');
    const disclosures = Array.from(root.querySelectorAll<HTMLButtonElement>('.paper-title button'));
    for (const disclosure of disclosures) disclosure.click();
    fixture.detectChanges();
    expect(root.querySelector('.paper-table')?.textContent).toContain('No abstract available.');
    expect(root.querySelector('a[href="https://core.ac.uk/works/101"]')?.textContent)
      .toBe('Drone routing for package delivery');
    expect(root.querySelector('a[href="https://example.org/papers/101.pdf"]')?.textContent).toBe('Full text');
  });

  it('applies the submitted checkboxes and preserves the current page across keyboard tab changes', () => {
    const picker = root.querySelector<HTMLDetailsElement>('.aggregate-picker')!;
    expect(picker.open).toBe(false);
    picker.querySelector('summary')!.click();
    const choices = [...picker.querySelectorAll('input')];
    expect(choices.filter(c => c.checked).map(c => c.value)).toEqual(allDimensions);
    for (const choice of choices.filter(c => !['authors', 'language'].includes(c.value))) choice.click();
    root.querySelector<HTMLInputElement>('[name=pageSize]')!.value = '1';
    submit('solar', '2');
    const aggregate = http.expectOne({ method: 'POST', url: aggregateUrl });
    expect(aggregate.request.body).toEqual({ q: 'solar', aggregations: ['authors', 'language'] });
    aggregate.flush({ aggregations: { authors: { 'B. Author': 5, 'A. Author': 8 }, language: [], publisher: { Other: 9 } } });
    expectPage('solar', 1).flush(firstPage);
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expectPage('solar', 1, 1).flush({ totalHits: 3, results: [{ id: 42, title: 'Second page' }] });
    fixture.detectChanges();
    const [results, analytics] = [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    expect(results.getAttribute('aria-selected')).toBe('true');
    results.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(analytics);
    expect(root.querySelector<HTMLElement>('.results')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('.analytics')!.hidden).toBe(false);
    expect(Array.from(root.querySelectorAll('.analytics article h3'), el => el.textContent)).toEqual(['Authors', 'Language']);
    expect(root.querySelector('.distribution tbody tr')?.textContent).toBe('A. Author8');
    expect(root.querySelector('.analytics')?.textContent).toContain('no buckets');
    choices[5].click();
    expect(root.querySelectorAll('.analytics article')).toHaveLength(2);
    analytics.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(results);
    expect(root.querySelector('.paper-title a')?.textContent).toBe('Second page');
    choices[2].click();
    submit('solar', '2');
    expect(root.querySelector('.paper-title a')?.textContent).toBe('Second page');
    fixture.detectChanges();
    expect(root.querySelectorAll('.analytics article')).toHaveLength(0);
    expect(root.querySelector('.analytics')?.textContent).toContain('Select an aggregation field');
    http.expectNone(() => true);
  });

  it('cancels pending analytics when disabled and restores selected dimensions on submission', () => {
    const on = root.querySelector<HTMLButtonElement>('.analytics-switch')!;
    submit('solar', '3');
    const pending = expectYears('solar');
    on.click();
    fixture.detectChanges();
    expect(pending.cancelled).toBe(true);
    expect(on.getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector<HTMLFieldSetElement>('.aggregate-picker fieldset')!.disabled).toBe(true);
    expectPage('solar', 3).flush(firstPage);
    submit('wind', '3');
    expectPage('wind', 3).flush(firstPage);
    http.expectNone(aggregateUrl);
    on.click();
    fixture.detectChanges();
    root.querySelector<HTMLInputElement>('.aggregate-picker [value=authors]')!.click();
    submit('wind', '3');
    const aggregate = http.expectOne({ method: 'POST', url: aggregateUrl });
    expect(aggregate.request.body.aggregations).toEqual(allDimensions.filter(field => field !== 'authors'));
    aggregate.flush({ aggregations: {} });
    http.expectNone(() => true);
  });

  it('times out the aggregate request while keeping the loaded papers', () => {
    vi.useFakeTimers();
    try {
      submit(booleanQuery, '2');
      const pending = expectYears(booleanQuery);
      expectPage(booleanQuery, 2).flush(firstPage);
      vi.advanceTimersByTime(30_000);
      fixture.detectChanges();
      expect(pending.cancelled).toBe(true);
      expect(root.querySelector('.analytics [role=alert]')?.textContent).toContain('CORE did not respond in time');
      expect(root.querySelectorAll('.paper-row')).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a search error and recovers on retry to an empty result', () => {
    submit(booleanQuery, '10');
    expectYears(booleanQuery).flush(yearBuckets);
    expectPage(booleanQuery, 10).flush({}, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();
    expect(root.querySelector('.results [role=alert]')?.textContent).toContain('HTTP 500');
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);

    submit(booleanQuery, '10');
    expectPage(booleanQuery, 10).flush(emptyPage);
    expectYears(booleanQuery).flush({ aggregations: { yearPublished: [] } });
    fixture.detectChanges();
    expect(root.querySelector('.results [role=alert]')).toBeNull();
    expect(root.querySelector('.results [role=status]')?.textContent).toContain('No papers found');
    expect(root.querySelector('.chart .status')?.textContent).toContain('no buckets');
  });

  it('keeps the results available if the independent chart request fails', () => {
    submit(booleanQuery, '2');
    expectPage(booleanQuery, 2).flush(firstPage);
    expectYears(booleanQuery).flush({}, { status: 429, statusText: 'Too many requests' });
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper-row')).toHaveLength(2);
    expect(root.querySelector('.analytics [role=alert]')?.textContent).toContain('CORE API rate limit exceeded');
  });

  it('cancels stale list requests for both limit edits and new queries, and cancels the old chart', () => {
    submit(booleanQuery, '1');
    const firstDisplay = expectPage(booleanQuery, 1);
    submit(booleanQuery, '2');
    const updatedDisplay = expectPage(booleanQuery, 2);
    expect(firstDisplay.cancelled).toBe(true);
    updatedDisplay.flush(firstPage);
    const oldChart = expectYears(booleanQuery);

    submit(booleanQuery, '3');
    const oldDisplay = expectPage(booleanQuery, 3);
    expect(oldChart.cancelled).toBe(false);
    submit('solar energy', '3');
    expect(oldDisplay.cancelled).toBe(true);
    expect(oldChart.cancelled).toBe(true);
    expectPage('solar energy', 3).flush(emptyPage);
    expectYears('solar energy').flush({ aggregations: {} });
    fixture.detectChanges();
    expect(root.querySelector('.results [role=status]')?.textContent).toContain('solar energy');
    expect(root.querySelector('.results [role=status]')?.textContent).not.toContain('drone');
    expect(chartRows()).toEqual([]);
  });
});
