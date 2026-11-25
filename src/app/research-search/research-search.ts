import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender,
  computed, inject, input, linkedSignal, signal, viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  map,
  of,
  startWith,
  switchMap,
  type Observable,
} from 'rxjs';
import { MatPaginator } from '@angular/material/paginator';
import { CORE_SEARCH_LIMIT, TOTAL_RESULTS } from '../../../shared/search-filters.mjs';
import { toPaperResult, type PaperResult, type YearOrder } from './paper-result';
import { PaperRow } from './paper-row';
import { QueryHighlight } from './query-highlight';
import { normalizeQuery } from './query-syntax';
import { QueryDrafts } from './query-drafts';
import { WorkDistribution } from './work-distribution';
import { PublicationDateRange } from './publication-date-range';
import { needsDayCheck, publicationYearBounds, restrictPublicationYears, type PublicationRange } from './publication-range';
import { ResearchSearchData, apiErrorMessage } from './research-search-data';
import { aggregateFields, aggregateLabels, type AggregateField, type Distribution } from './work-analytics';

interface SearchSession {
  query: string;
  range: PublicationRange;
  fields: BehaviorSubject<AggregateField[] | null>;
  pages: BehaviorSubject<PageRequest>;
}

interface PageRequest {
  limit: number;
  pageSize: number;
  index: number;
  order: YearOrder;
}

interface ResultPage {
  status: 'ready';
  page: PageRequest;
  papers: PaperResult[];
  total: number;
  available: number;
  start: number;
  dateNotice?: string;
  moreDatePages?: boolean;
  loadingIndex?: number;
  pageError?: string;
}

type ResultsState =
  | { status: 'loading' }
  | ResultPage
  | { status: 'error'; message: string };

type AnalyticsState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'ready'; groups: Distribution[] }
  | { status: 'error'; message: string };

@Component({
  selector: 'app-research-search',
  imports: [DecimalPipe, MatPaginator, PaperRow, PublicationDateRange, WorkDistribution, QueryHighlight],
  providers: [QueryDrafts],
  templateUrl: './research-search.html',
  styleUrl: './research-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResearchSearch {
  /** Set a unique HTML ID prefix for each instance when embedding more than one. */
  readonly idPrefix = input('research-search');

  protected readonly tab = signal<'results' | 'analytics'>('results');
  protected readonly aggregateFields = aggregateFields;
  protected readonly aggregateLabels = aggregateLabels;
  protected readonly drafts = inject(QueryDrafts);
  protected readonly analyticsEnabled = signal(true);
  private readonly manualFields = signal<AggregateField[]>([...aggregateFields]);
  private readonly draftFields = linkedSignal(() => {
    const requested = this.drafts.result()?.filters?.aggregations;
    return requested ? aggregateFields.filter(field => requested.includes(field)) : this.manualFields();
  });
  protected readonly selectedFields = computed(() => this.drafts.enabled() ? this.draftFields() : this.manualFields());
  private readonly submittedBlank = signal(false);
  protected readonly queryError = computed(() => this.submittedBlank() && !this.drafts.query().trim());
  protected readonly limitBounds = TOTAL_RESULTS;
  protected readonly pageBounds = CORE_SEARCH_LIMIT;
  private readonly manualPageSize = signal(String(CORE_SEARCH_LIMIT.default));
  protected readonly pageSizeValue = computed(() => this.drafts.enabled() ? this.drafts.draftPageSize() : this.manualPageSize());
  private readonly pageSizeInput = viewChild<ElementRef<HTMLInputElement>>('pageSizeInput');
  protected readonly pageSizeError = linkedSignal({ source: this.pageSizeInput, computation: () => false });
  private readonly manualLimit = signal(String(TOTAL_RESULTS.default));
  protected readonly limitValue = computed(() => this.drafts.enabled() ? this.drafts.draftLimit() : this.manualLimit());
  private readonly limitInput = viewChild<ElementRef<HTMLInputElement>>('limitInput');
  protected readonly limitError = linkedSignal({ source: this.limitInput, computation: () => false });
  private readonly dateRange = viewChild(PublicationDateRange);
  private readonly filters = viewChild.required<ElementRef<HTMLDetailsElement>>('filters');
  private readonly injector = inject(Injector);
  private readonly queryInput = viewChild<ElementRef<HTMLInputElement>>('queryInput');
  private readonly descriptionInput = viewChild<ElementRef<HTMLTextAreaElement>>('description');
  protected readonly queryScroll = linkedSignal({ source: this.queryInput, computation: () => 0 });

  private readonly data = inject(ResearchSearchData);
  private readonly sessions = new Subject<SearchSession>();
  private session?: SearchSession;

  protected readonly state = toSignal(this.sessions.pipe(
    switchMap(session => {
      const { query, range, fields } = session;
      const apiQuery = restrictPublicationYears(normalizeQuery(query), range);
      const bounds = needsDayCheck(range) ? publicationYearBounds(range) : undefined;
      const analytics = fields.pipe(switchMap(selected => selected === null
        ? of<AnalyticsState>({ status: 'disabled' })
        : this.data.aggregate(apiQuery, selected).pipe(
        map((groups): AnalyticsState => ({ status: 'ready', groups })),
        startWith({ status: 'loading' } as const),
        catchError((error: unknown) => of<AnalyticsState>({ status: 'error', message: apiErrorMessage(error) })),
      )));
      return combineLatest({ results: this.paperResults(apiQuery, session), analytics })
        .pipe(map(view => ({ ...view, query, bounds })));
    }),
  ));

  private paperResults(query: string, { range, pages }: SearchSession): Observable<ResultsState> {
    if (needsDayCheck(range)) {
      const readers = {
        asc: this.data.datedPages(query, range, 'asc'),
        desc: this.data.datedPages(query, range, 'desc'),
      };
      let last: ResultPage | undefined;
      return pages.pipe(switchMap(page => {
        const previous = last;
        const target = Math.min((page.index + 1) * page.pageSize, page.limit);
        return readers[page.order](target).pipe(
          map(scan => {
            const count = scan.papers.length;
            const index = Math.min(page.index, Math.max(0, Math.ceil(count / page.pageSize) - 1));
            const start = index * page.pageSize;
            const end = Math.min(start + page.pageSize, page.limit);
            const progress = scan.candidates === undefined ? '' : `Checked ${scan.checked} of ${scan.candidates} candidate papers.`;
            let dateNotice = '';
            if (scan.error) dateNotice = 'Partial coverage. ' + progress;
            else if (scan.pending) dateNotice = 'Checking publication dates. ' + progress;
            else if (scan.more) dateNotice = progress;
            else if (scan.checked < (scan.candidates ?? 0)) dateNotice = 'Partial coverage. CORE’s paging limit was reached. ' + progress;
            if (scan.error && !scan.checked && previous?.papers.length) {
              return { ...previous, loadingIndex: undefined, pageError: scan.error };
            }
            last = {
              ...resultPage({ ...page, index }, scan.papers.slice(start, end), count),
              dateNotice, moreDatePages: end < page.limit && (count > end || (count === end && scan.more)),
              loadingIndex: scan.pending ? page.index : undefined, pageError: scan.error,
            };
            return last;
          }),
          startWith(last ? { ...last, loadingIndex: page.index, pageError: undefined } : { status: 'loading' } as const),
        );
      }));
    }
    let last: ResultPage | undefined;
    return pages.pipe(
      switchMap(page => {
        const offset = page.index * page.pageSize;
        const size = Math.min(page.pageSize, page.limit - offset);
        const previous = last?.page.limit === page.limit && last.page.pageSize === page.pageSize ? last : undefined;
        return this.data.findPapers(query, size, offset, page.order).pipe(
          map(response => {
            if (previous && offset > 0 && !response.results.length) {
              return { ...previous, pageError: 'This page is no longer available. Refresh the search or retry.' };
            }
            last = resultPage(page, response.results.slice(0, size).map(toPaperResult), response.totalHits);
            return last;
          }),
          catchError((error: unknown) => of<ResultsState>(previous
            ? { ...previous, pageError: apiErrorMessage(error) }
            : { status: 'error', message: apiErrorMessage(error) })),
          startWith(previous ? { ...previous, loadingIndex: page.index } : { status: 'loading' } as const),
        );
      }),
    );
  }

  protected toggleAnalytics() {
    this.analyticsEnabled.update(enabled => !enabled);
    if (!this.analyticsEnabled()) this.session?.fields.next(null);
  }

  protected chooseField(field: AggregateField, checked: boolean) {
    (this.drafts.enabled() ? this.draftFields : this.manualFields).update(selected => aggregateFields.filter(key => key === field ? checked : selected.includes(key)));
  }

  protected tabKey(event: KeyboardEvent, results: HTMLButtonElement, analytics: HTMLButtonElement) {
    let target: 'results' | 'analytics';
    switch (event.key) {
      case 'Home': target = 'results'; break;
      case 'End': target = 'analytics'; break;
      case 'ArrowLeft':
      case 'ArrowRight': target = this.tab() === 'results' ? 'analytics' : 'results'; break;
      default: return;
    }
    event.preventDefault();
    this.tab.set(target);
    (target === 'results' ? results : analytics).focus();
  }

  protected updateQueryHighlight(queryInput: HTMLInputElement) {
    this.submittedBlank.set(false);
    this.drafts.editQuery(queryInput.value);
    this.queryScroll.set(queryInput.scrollLeft);
  }

  protected editLimit(value: string) {
    const limit = this.drafts.enabled() ? this.drafts.draftLimit : this.manualLimit;
    limit.set(value);
    this.limitError.set(false);
  }

  protected editPageSize(value: string) {
    (this.drafts.enabled() ? this.drafts.draftPageSize : this.manualPageSize).set(value);
    this.pageSizeError.set(false);
  }

  protected goToPage(page: PageRequest, index: number) {
    this.session?.pages.next({ ...page, index });
  }

  protected toggleYearOrder(page: PageRequest) {
    this.session?.pages.next({ ...page, index: 0, order: page.order === 'desc' ? 'asc' : 'desc' });
  }

  protected retryPage() {
    const pages = this.session?.pages;
    if (pages) pages.next(pages.value);
  }

  protected setPublicationRange(range: PublicationRange) {
    this.drafts.range.set(range);
    this.filters().nativeElement.open = true;
  }

  protected toggleNlp(enabled: boolean) {
    this.drafts.toggle(enabled);
    this.limitError.set(false);
    this.submittedBlank.set(false);
    afterNextRender(() => {
      const field = this.drafts.enabled() ? this.descriptionInput() : this.queryInput();
      field?.nativeElement.focus();
    }, { injector: this.injector });
  }

  protected submit(event: SubmitEvent) {
    event.preventDefault();
    const queryInput = this.queryInput()?.nativeElement;
    const limitInput = this.limitInput()?.nativeElement;
    const pageSizeInput = this.pageSizeInput()?.nativeElement;
    if (!this.drafts.showEditor() || !queryInput || !limitInput || !pageSizeInput) return;
    const query = queryInput.value.trim();
    const limit = limitInput.valueAsNumber;
    const invalidLimit = !Number.isInteger(limit) || limit < this.limitBounds.min || limit > this.limitBounds.max;

    const pageSize = pageSizeInput.valueAsNumber;
    const invalidPageSize = !Number.isInteger(pageSize) || pageSize < this.pageBounds.min || pageSize > this.pageBounds.max;
    this.pageSizeError.set(invalidPageSize);
    this.submittedBlank.set(!query);
    this.limitError.set(invalidLimit);
    if (!query) {
      queryInput.focus();
      return;
    }
    const invalidFilter = invalidLimit ? limitInput : invalidPageSize ? pageSizeInput : this.dateRange()?.validate();
    if (invalidFilter) {
      this.filters().nativeElement.open = true;
      invalidFilter.focus();
      return;
    }

    const range = this.drafts.range();
    const page: PageRequest = { limit, pageSize, index: 0, order: 'desc' };
    const fields = this.analyticsEnabled() ? this.selectedFields() : null;
    const session = this.session;
    if (session?.query === query && session.range.from === range.from && session.range.to === range.to) {
      const previous = session.pages.value;
      page.order = previous.order;
      const fieldsChanged = session.fields.value?.join() !== fields?.join();
      const pagingChanged = previous.limit !== limit || previous.pageSize !== pageSize;
      if (fieldsChanged) session.fields.next(fields);
      if (pagingChanged || (!fieldsChanged && previous.index !== 0)) {
        session.pages.next(page);
        return;
      }
      if (fieldsChanged) return;
    }
    this.session = { query, range, fields: new BehaviorSubject<AggregateField[] | null>(fields), pages: new BehaviorSubject(page) };
    this.sessions.next(this.session);
  }
}

function resultPage(page: PageRequest, papers: PaperResult[], total: number): ResultPage {
  return { status: 'ready', page, papers, total, start: page.index * page.pageSize, available: Math.min(total, page.limit) };
}
