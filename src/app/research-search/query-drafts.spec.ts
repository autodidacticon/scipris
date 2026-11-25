import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideCoreApi } from '../core/api';
import { ResearchSearch } from './research-search';

const endpoint = '/api/nlp/translate';
const ambiguous = {
  options: [
    { label: 'Both subjects are lightweight', expression: '(lightweight AND (drones OR robots))' },
    { label: 'Only drones are lightweight', expression: '((lightweight AND drones) OR robots)' },
  ],
  clarification: '', unapplied: [],
};

describe('Natural-language drafting in ResearchSearch', () => {
  let fixture: ComponentFixture<ResearchSearch>;
  let http: HttpTestingController;
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideCoreApi()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResearchSearch);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function available(debounceMs?: number) {
    http.expectOne({ url: '/api/nlp/status', method: 'GET' }).flush({ enabled: true, debounceMs });
    fixture.detectChanges();
  }

  const query = () => root.querySelector<HTMLInputElement>('input[type=search]')!;
  const prompt = () => root.querySelector('textarea')!;
  const search = () => root.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const toggle = () => root.querySelector<HTMLInputElement>('input[role=switch]')!;

  function input(field: HTMLInputElement | HTMLTextAreaElement, value: string, event = new Event('input')) {
    field.value = value;
    field.dispatchEvent(event);
    fixture.detectChanges();
  }

  function switchMode() {
    toggle().click();
    fixture.detectChanges();
  }

  function request(text: string) {
    const req = http.expectOne({ method: 'POST', url: endpoint });
    expect(req.request.body).toEqual({ description: text });
    return req;
  }

  function translate(text: string) {
    input(prompt(), text);
    vi.advanceTimersByTime(1000);
    return request(text);
  }

  function choose(index: number) {
    const select = root.querySelector<HTMLSelectElement>('form select')!;
    select.value = String(index);
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('shows an editable limit after parsing and resets the draft filters for a new description', () => {
    available();
    const limiter = () => root.querySelector<HTMLInputElement>('input[name=limit]');
    const ranges = () => Array.from(root.querySelectorAll<HTMLInputElement>('input[type=date]'));
    input(limiter()!, '18');
    const filters = root.querySelector('details')!;
    switchMode();
    expect(filters.hidden).toBe(true);
    expect(limiter()).toBeNull();
    translate('5 papers on lightweight drones or robots, 3 per page, from 2020 to 2022').flush({
      ...ambiguous, filters: { limit: 5, pageSize: 3, publishedFrom: '2020-01-01', publishedTo: '2022-12-31' },
    });
    fixture.detectChanges();
    expect(search().disabled).toBe(true);
    expect(filters.hidden).toBe(false);
    expect(limiter()?.value).toBe('5');
    input(limiter()!, '7');
    expect(ranges().map(field => field.value)).toEqual(['2020-01-01', '2022-12-31']);
    input(ranges()[0], '2021-01-01');
    filters.open = false;
    choose(0);
    choose(1);
    expect(filters.open).toBe(false);
    expect(limiter()?.value).toBe('7');
    expect(ranges()[0].value).toBe('2021-01-01');
    input(query(), 'drone||robot');
    http.expectNone(() => true);
    search().click();
    const page = http.expectOne(req => req.method === 'GET');
    const q = '(drone OR robot) AND yearPublished>=2021 AND yearPublished<=2022';
    const params = new URL(page.request.urlWithParams, 'https://example.test').searchParams;
    expect(params.get('limit')).toBe('3');
    expect(params.get('q')).toBe(q);
    page.flush({ totalHits: 8, results: [] });
    const aggregate = http.expectOne('/api/core/search/works/aggregate');
    expect(aggregate.request.body.q).toBe(q);
    aggregate.flush({ aggregations: { yearPublished: { '2021': 8 } } });
    const next = translate('drones');
    expect(limiter()).toBeNull();
    next.flush({
      options: [{ label: 'Drones', expression: 'drones' }], unapplied: [], clarification: '',
      filters: { limit: null, publishedFrom: null, publishedTo: null },
    });
    fixture.detectChanges();
    expect(limiter()?.value).toBe('100');
    expect(root.querySelector<HTMLInputElement>('input[name=pageSize]')?.value).toBe('10');
    expect(filters.open).toBe(false);
    input(limiter()!, '10001');
    search().click();
    fixture.detectChanges();
    expect(limiter()?.getAttribute('aria-invalid')).toBe('true');
    expect(filters.open).toBe(true);
    http.expectNone(() => true);
    expect(ranges().map(field => field.value)).toEqual(['', '']);
    switchMode();
    expect(limiter()?.value).toBe('18');
  });

  it('opens a single draft directly in the highlighted inline editor', () => {
    available();
    expect(query().compareDocumentPosition(toggle()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle().labels?.[0].textContent?.trim()).toBe('Natural language search (NLP)');
    expect(toggle().checked).toBe(false);
    expect(prompt()).toBeNull();
    switchMode();
    expect(query()).toBeNull();
    expect(root.querySelector<HTMLSelectElement>('form select')).toBeNull();
    expect(root.querySelector('.translate')).toBeNull();
    expect(search().disabled).toBe(true);
    const help = root.querySelector('.draft-help')!;
    expect(prompt().getAttribute('aria-describedby')).toBe(help.id);
    expect(help.textContent).toContain('Find papers from the last decade correlating depression and cardiovascular exercise, group by publication year and publisher');
    expect(help.textContent).toContain('If several interpretations fit, choose one.');
    expect(help.textContent).not.toContain('OpenRouter');

    translate('Peer-reviewed studies of drones excluding GPS').flush({
      options: [{ label: 'Drones excluding GPS', expression: '(drones AND NOT GPS)' }],
      unapplied: ['Peer-review status'], clarification: '',
    });
    fixture.detectChanges();
    expect(root.querySelector<HTMLSelectElement>('form select')).toBeNull();
    expect(root.textContent).not.toContain('Drones excluding GPS');
    expect(query().labels?.[0].textContent).toBe('Edit Boolean query');
    expect(query().value).toBe('(drones AND NOT GPS)');
    expect(root.querySelectorAll('.query-highlights .operator')).toHaveLength(2);
    expect(root.querySelector('.draft-note')?.textContent).toContain('Peer-review status');
    expect(search().disabled).toBe(false);
    input(query(), 'drone delivery AND NOT GPS');
    switchMode();
    expect(root.querySelector('.draft-help')).toBeNull();
    expect(query().value).toBe('drone delivery AND NOT GPS');
    expect(root.querySelector('.draft-note')?.textContent).toContain('Peer-review status');
    http.expectNone(() => true);
  });

  it('waits one second after the latest keystroke and cancels an in-flight parse immediately on new input', () => {
    available();
    switchMode();
    input(prompt(), 'dro');
    vi.advanceTimersByTime(990);
    input(prompt(), 'drones');
    vi.advanceTimersByTime(999);
    http.expectNone(endpoint);
    vi.advanceTimersByTime(1);
    const old = request('drones');
    input(prompt(), 'robots');
    expect(old.cancelled).toBe(true);
    vi.advanceTimersByTime(1000);
    const latest = request('robots');
    switchMode();
    expect(latest.cancelled).toBe(true);
  });

  it('honors the configured delay and cancels timers on blank input, mode changes and destruction', () => {
    available(250);
    switchMode();
    input(prompt(), 'wind');
    vi.advanceTimersByTime(249);
    http.expectNone(endpoint);
    vi.advanceTimersByTime(1);
    const old = request('wind');
    input(prompt(), '   ');
    expect(old.cancelled).toBe(true);
    vi.advanceTimersByTime(1000);
    http.expectNone(endpoint);
    input(prompt(), 'solar');
    switchMode();
    vi.advanceTimersByTime(1000);
    http.expectNone(endpoint);
    switchMode();
    vi.advanceTimersByTime(1000);
    http.expectNone(endpoint);
    input(prompt(), 'waves');
    fixture.destroy();
    vi.advanceTimersByTime(1000);
    http.expectNone(endpoint);
  });

  it('waits for a composed phrase to be committed', () => {
    available();
    switchMode();
    input(prompt(), '太', new InputEvent('input', { isComposing: true }));
    vi.advanceTimersByTime(2000);
    http.expectNone(endpoint);
    input(prompt(), '太陽', new Event('compositionend'));
    vi.advanceTimersByTime(1000);
    request('太陽').flush({ options: [], unapplied: [], clarification: 'Which topic?' });
  });

  it('keeps edits per option and submits only the selected, edited expression to both CORE requests', () => {
    available();
    input(query(), 'manual');
    switchMode();
    translate('Lightweight drones or robots grouped by publication year').flush({
      ...ambiguous, filters: { aggregations: ['yearPublished'] },
    });
    fixture.detectChanges();
    expect(query()).toBeNull();
    const choices = root.querySelector<HTMLSelectElement>('form select')!;
    expect(choices.value).toBe('');
    expect(Array.from(choices.options, option => option.textContent)).toEqual([
      'Choose an interpretation', ...ambiguous.options.map(option => option.label),
    ]);
    expect(search().disabled).toBe(true);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    choose(0);
    input(query(), 'drones&&robots');
    choose(1);
    expect(query().value).toBe(ambiguous.options[1].expression);
    input(query(), 'solar');
    choose(0);
    expect(query().value).toBe('drones&&robots');
    vi.advanceTimersByTime(2000);
    http.expectNone(() => true);
    root.querySelector<HTMLInputElement>('.aggregate-picker [value=authors]')!.click();
    search().click();
    const page = http.expectOne((req) => req.url === '/api/core/search/works/');
    expect(new URL(page.request.urlWithParams, 'https://example.test').searchParams.get('q')).toBe('drones AND robots');
    page.flush({ totalHits: 1, results: [] });
    const years = http.expectOne('/api/core/search/works/aggregate');
    expect(years.request.body).toEqual({ q: 'drones AND robots', aggregations: ['yearPublished', 'authors'] });
    years.flush({ aggregations: { yearPublished: { '2024': 1 } } });

    input(prompt(), 'different topic');
    expect(root.querySelector<HTMLSelectElement>('form select')).toBeNull();
    expect(query()).toBeNull();
    expect(search().disabled).toBe(true);
    switchMode();
    expect(query().value).toBe('drones&&robots');
  });

  it('keeps the global switch off when an NLP draft requests aggregations', () => {
    available();
    root.querySelector<HTMLButtonElement>('.analytics-switch')!.click();
    switchMode();
    translate('Solar papers grouped by language').flush({
      options: [{ label: 'Solar', expression: 'solar' }], unapplied: [], clarification: '',
      filters: { aggregations: ['language'] },
    });
    fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('[value=language]')?.checked).toBe(true);
    expect(root.querySelector<HTMLFieldSetElement>('.aggregate-picker fieldset')?.disabled).toBe(true);
    search().click();
    http.expectOne(req => req.url === '/api/core/search/works/').flush({ totalHits: 0, results: [] });
    http.expectNone('/api/core/search/works/aggregate');
  });

  it('keeps the manual query available through clarification and failures and retries after editing', () => {
    available();
    input(query(), 'original');
    switchMode();
    translate('interesting papers').flush({ options: [], unapplied: [], clarification: 'Which research topic?' });
    fixture.detectChanges();
    expect(root.querySelector('.draft-status')?.textContent).toContain('Which research topic?');
    expect(query()).toBeNull();
    expect(root.querySelector<HTMLSelectElement>('form select')).toBeNull();
    expect(root.querySelector('input[name=limit]')).toBeNull();
    for (const [status, message] of [[429, 'limit'], [504, 'timed out'], [502, 'Could not translate']] as const) {
      translate('robotics').flush({}, { status, statusText: 'Unavailable' });
      fixture.detectChanges();
      const warning = root.querySelector<HTMLElement>('[role=alert]')!;
      expect(warning.textContent).toContain(message);
      expect(query().getAttribute('aria-describedby')?.split(' ')).toContain(warning.id);
      expect(prompt().value).toBe('robotics');
      expect(query().value).toBe('original');
      expect(search().disabled).toBe(false);
    }
    switchMode();
    expect(query().value).toBe('original');
    switchMode();
    translate('underwater robotics').flush({ options: [{ label: 'Robotics', expression: 'robotics' }], unapplied: [], clarification: '' });
    fixture.detectChanges();
    expect(query().value).toBe('robotics');
    expect(root.querySelector('[role=alert]')).toBeNull();
  });

  it('opens a blank Boolean editor on the first failed parse and submits a manual query with its filters', () => {
    available();
    switchMode();
    translate('Find solar papers').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(toggle().checked).toBe(true);
    expect(query().value).toBe('');
    expect(root.querySelector('[role=alert]')?.textContent).toContain('Boolean query');
    search().click();
    fixture.detectChanges();
    expect(query().getAttribute('aria-invalid')).toBe('true');
    http.expectNone(() => true);

    input(query(), 'solar and wind');
    input(root.querySelector<HTMLInputElement>('input[name=limit]')!, '3');
    expect(root.querySelector('.query-highlights .operator')?.textContent).toBe('and');
    search().click();
    const page = http.expectOne(req => req.url === '/api/core/search/works/');
    const params = new URL(page.request.urlWithParams, 'https://example.test').searchParams;
    expect(params.get('q')).toBe('solar AND wind');
    expect(params.get('limit')).toBe('3');
    page.flush({ totalHits: 0, results: [] });
    const analytics = http.expectOne('/api/core/search/works/aggregate');
    expect(analytics.request.body.q).toBe('solar AND wind');
    analytics.flush({ aggregations: {} });
    http.expectNone(endpoint);
  });
});
