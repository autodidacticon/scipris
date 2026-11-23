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

  function expectPage(q: string, resultLimit: number, offset = 0) {
    const page = http.expectOne(({ method, url }) => method === 'GET' && url === searchUrl);
    const params = new URL(page.request.urlWithParams, 'https://example.test').searchParams;
    expect(Object.fromEntries(params)).toEqual({
      q,
      limit: String(resultLimit),
      offset: String(offset),
      exclude: 'fullText',
    });
    return page;
  }

  function expectYears(q: string) {
    const aggregate = http.expectOne({ method: 'POST', url: aggregateUrl });
    expect(aggregate.request.body).toEqual({ q, aggregations: ['yearPublished'] });
    return aggregate;
  }

  function chartRows() {
    return Array.from(root.querySelectorAll('.bars .bar-row'), (row) => [
      row.querySelector('dt')?.textContent?.trim(),
      row.querySelector('dd')?.textContent?.trim(),
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

  it('validates calendar bounds and applies an open year range to both CORE requests', () => {
    const [, end] = dates('2024-01-01', '2023-12-31');
    submit('solar or wind', '4');
    expect(document.activeElement).toBe(end);
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('[role=alert]')?.textContent).toContain('on or after');
    http.expectNone(() => true);
    dates('2024-01-01', '');
    submit('solar or wind', '4');
    const q = '(solar OR wind) AND yearPublished>=2024';
    expectPage(q, 4).flush({ totalHits: 7, results: [] });
    expectYears(q).flush({ aggregations: { yearPublished: { '2024': 7 } } });
    dates('', '');
    submit('solar or wind', '4');
    expectPage('solar OR wind', 4).flush(emptyPage);
  });

  it('counts exact-day matches across pages and changes the card limit without scanning again', () => {
    dates('2024-02-28', '2024-02-29');
    submit('solar', '1');
    const q = '(solar) AND yearPublished>=2024 AND yearPublished<=2024';
    const work = (id: number, day: string | null) => ({
      id, title: 'Paper ' + id, yearPublished: 2024, publishedDate: day && day + 'T12:30:00+00:00',
    });
    expectPage(q, 100).flush({ totalHits: 5, results: [work(1, '2024-02-01'), work(2, null)] });
    fixture.detectChanges();
    expect(root.querySelector('.results .status')?.textContent).toContain('Checking publication dates');
    expectPage(q, 3, 2).flush({ totalHits: 5, results: [work(3, '2024-02-28'), work(4, '2024-02-29'), work(5, '2024-03-01')] });
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper')).toHaveLength(1);
    expect(root.querySelector('.paper h3')?.textContent).toBe('Paper 3');
    expect(chartRows()).toEqual([['2024', '2']]);
    expect(root.querySelector('.chart .status')?.textContent).toContain('all 2 matches');
    submit('solar', '3');
    expect(root.querySelectorAll('.paper')).toHaveLength(2);
    http.expectNone(() => true);
  });

  it('keeps verified day matches and labels an interrupted scan as partial', () => {
    dates('', '2024-02-29');
    submit('solar', '7');
    const q = '(solar) AND yearPublished<=2024';
    expectPage(q, 100).flush({ totalHits: 3, results: [{ id: 1, yearPublished: 2023 }] });
    expectPage(q, 2, 1).flush({}, { status: 429, statusText: 'Too many requests' });
    fixture.detectChanges();
    expect(root.querySelector('.results .status')?.textContent).toContain('Partial coverage');
    expect(root.querySelector('.chart .status')?.textContent).toContain('1 of 3 candidate papers');
    expect(chartRows()).toEqual([['2023', '1']]);
  });

  it('labels native controls and focuses invalid fields before issuing any request', () => {
    expect(query.labels?.[0].textContent).toBe('Search query');
    expect(limit.labels?.[0].textContent).toBe('Papers to show');
    expect(query.getAttribute('aria-describedby')).toBe('papers-query-help');
    expect(root.querySelector('#papers-query-help')?.textContent).toContain(booleanQuery);
    expect(limit.valueAsNumber).toBe(10);
    expect([limit.min, limit.max, limit.step]).toEqual(['1', '100', '1']);
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

    for (const invalidLimit of ['', '0', '101', '1.5']) {
      submit(booleanQuery, invalidLimit);
      expect(document.activeElement).toBe(limit);
      expect(limit.getAttribute('aria-invalid')).toBe('true');
      expect(limit.getAttribute('aria-describedby')).toBe('papers-limit-error');
      expect(root.querySelector('[role=alert]')?.textContent).toContain('whole number');
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
    expect(root.querySelector('.chart [role=status]')?.textContent).toContain('Counting papers');
    expectYears(booleanQuery).flush(yearBuckets);
    fixture.detectChanges();

    expect(root.querySelectorAll('.paper')).toHaveLength(1);
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);
    expect(root.querySelector('.chart [role=status]')?.textContent).toContain('all 2 matches');
    expect(root.querySelectorAll('.bar-track[aria-hidden=true]')).toHaveLength(2);

    submit(booleanQuery, '100');
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);
    expectPage(booleanQuery, 100).flush({ totalHits: 2, results: [firstPage.results[0], ...lastPage.results] });
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper')).toHaveLength(2);
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

  it('enumerates separate pages to account for missing years and papers outside the display limit', () => {
    submit(booleanQuery, '2');
    expectPage(booleanQuery, 2).flush(firstPage);
    expectYears(booleanQuery).flush(yearBuckets);
    expectPage(booleanQuery, 3).flush(firstPage);
    expectPage(booleanQuery, 1, 2).flush(lastPage);
    fixture.detectChanges();

    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1'], ['Unknown year', '1']]);
    expect(root.querySelector('.chart [role=status]')?.textContent).toContain('all 3 matches');
    expect(root.querySelectorAll('.paper')).toHaveLength(2);
    expect(root.querySelector('.papers')?.textContent).toContain('Authors unavailable');
    expect(root.querySelector('.papers')?.textContent).toContain('Year unavailable');
    expect(root.querySelector('.papers')?.textContent).toContain('No abstract available.');
    expect(root.querySelector('a[href="https://core.ac.uk/works/101"]')?.getAttribute('aria-label'))
      .toBe('View on CORE, Drone routing for package delivery');
    expect(root.querySelector('a[href="https://example.org/papers/101.pdf"]')?.textContent).toBe('Full text');
  });

  it('labels coverage partial when the reported matches exceed the offset window', () => {
    submit(booleanQuery, '2');
    expectPage(booleanQuery, 2).flush({ ...firstPage, totalHits: 10_001 });
    expectYears(booleanQuery).flush(yearBuckets);
    fixture.detectChanges();

    const status = root.querySelector('.chart [role=status]')?.textContent;
    expect(status).toMatch(/Partial coverage\./);
    expect(status).toMatch(/2 of\s+10,001 matches/);
    expect(status).toContain('10,000-work offset window');
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);
  });

  it('keeps the known buckets partial when pages repeat a work', () => {
    submit(booleanQuery, '2');
    expectPage(booleanQuery, 2).flush(firstPage);
    expectYears(booleanQuery).flush(yearBuckets);
    expectPage(booleanQuery, 3).flush(firstPage);
    expectPage(booleanQuery, 1, 2).flush({ totalHits: 3, results: [firstPage.results[0]] });
    fixture.detectChanges();

    const status = root.querySelector('.chart [role=status]')?.textContent;
    expect(status).toContain('Partial coverage.');
    expect(status).toContain('distinct paper IDs');
    expect(chartRows()).toHaveLength(2);
  });

  it('surfaces a rate limit during pagination without inventing an unknown-year count', () => {
    submit(booleanQuery, '2');
    expectPage(booleanQuery, 2).flush(firstPage);
    expectYears(booleanQuery).flush(yearBuckets);
    expectPage(booleanQuery, 3).flush({}, { status: 429, statusText: 'Too many requests' });
    fixture.detectChanges();

    const status = root.querySelector('.chart [role=status]')?.textContent;
    expect(status).toContain('Partial coverage.');
    expect(status).toContain('CORE API rate limit exceeded');
    expect(chartRows()).toEqual([['2024', '1'], ['2023', '1']]);
  });

  it('shows a search error and recovers on retry to an empty result', () => {
    submit(booleanQuery, '10');
    expectPage(booleanQuery, 10).flush({}, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();
    expect(root.querySelector('.results [role=alert]')?.textContent).toContain('HTTP 500');
    expect(root.querySelector('.chart [role=status]')?.textContent).toContain('unavailable');

    submit(booleanQuery, '10');
    expectPage(booleanQuery, 10).flush(emptyPage);
    fixture.detectChanges();
    expect(root.querySelector('.results [role=alert]')).toBeNull();
    expect(root.querySelector('.results [role=status]')?.textContent).toContain('No papers found');
    expect(root.querySelector('.chart [role=status]')?.textContent).toContain('No matching papers to chart');
  });

  it('keeps the results available if the independent chart request fails', () => {
    submit(booleanQuery, '2');
    expectPage(booleanQuery, 2).flush(firstPage);
    expectYears(booleanQuery).flush({}, { status: 429, statusText: 'Too many requests' });
    fixture.detectChanges();
    expect(root.querySelectorAll('.paper')).toHaveLength(2);
    expect(root.querySelector('.chart [role=alert]')?.textContent).toContain('CORE API rate limit exceeded');
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
    fixture.detectChanges();
    expect(root.querySelector('.results [role=status]')?.textContent).toContain('solar energy');
    expect(root.querySelector('.results [role=status]')?.textContent).not.toContain('drone');
    expect(chartRows()).toEqual([]);
  });
});
