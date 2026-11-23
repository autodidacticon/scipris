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
  filter,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import { CORE_SEARCH_LIMIT, type Work } from '../core/api';
import { QueryHighlight } from './query-highlight';
import { normalizeQuery } from './query-syntax';
import { QueryDrafts } from './query-drafts';
import { PublicationDateRange } from './publication-date-range';
import { needsDayCheck, restrictPublicationYears, type PublicationRange } from './publication-range';
import {
  ResearchSearchData,
  apiErrorMessage,
  publicationYear,
  type PublicationYears,
} from './research-search-data';

interface SearchSession {
  query: string;
  range: PublicationRange;
  limits: BehaviorSubject<number>;
}

interface PaperCard {
  id: number;
  title: string;
  authors: string;
  year: number | null;
  abstract: string | undefined;
  fullText: string | undefined;
}

type ResultsState =
  | { status: 'loading' }
  | { status: 'ready'; papers: PaperCard[]; total: number }
  | { status: 'error'; message: string };

type YearsState =
  | { status: 'waiting' }
  | { status: 'loading' }
  | { status: 'ready'; coverage: PublicationYears; maxCount: number }
  | { status: 'error'; message: string };

interface SearchView {
  query: string;
  dateNotice: string;
  results: ResultsState;
  years: YearsState;
}

@Component({
  selector: 'app-research-search',
  imports: [DecimalPipe, PublicationDateRange, QueryHighlight],
  providers: [QueryDrafts],
  templateUrl: './research-search.html',
  styleUrl: './research-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResearchSearch {
  /** Set a unique HTML ID prefix for each instance when embedding more than one. */
  readonly idPrefix = input('research-search');

  protected readonly drafts = inject(QueryDrafts);
  private readonly submittedBlank = signal(false);
  protected readonly queryError = computed(() => this.submittedBlank() && !this.drafts.query().trim());
  protected readonly limitBounds = CORE_SEARCH_LIMIT;
  private readonly manualLimit = signal(String(CORE_SEARCH_LIMIT.default));
  protected readonly limitValue = computed(() => this.drafts.enabled() ? this.drafts.draftLimit() : this.manualLimit());
  private readonly limitInput = viewChild<ElementRef<HTMLInputElement>>('limitInput');
  protected readonly limitError = linkedSignal({ source: this.limitInput, computation: () => false });
  private readonly dateRange = viewChild(PublicationDateRange);
  private readonly injector = inject(Injector);
  private readonly queryInput = viewChild<ElementRef<HTMLInputElement>>('queryInput');
  private readonly descriptionInput = viewChild<ElementRef<HTMLTextAreaElement>>('description');
  protected readonly queryScroll = linkedSignal({ source: this.queryInput, computation: () => 0 });

  private readonly data = inject(ResearchSearchData);
  private readonly sessions = new Subject<SearchSession>();
  private session?: SearchSession;

  protected readonly state = toSignal(this.sessions.pipe(
    switchMap(({ query, range, limits }) => {
      const apiQuery = restrictPublicationYears(normalizeQuery(query), range);
      if (needsDayCheck(range)) {
        return combineLatest({ matches: this.data.datedMatches(apiQuery, range), limit: limits }).pipe(
          map(({ matches, limit }): SearchView => ({
            query, dateNotice: matches.notice,
            results: { status: 'ready', papers: matches.papers.slice(0, limit).map(toPaperCard), total: matches.years.counted },
            years: readyYears(matches.years),
          })),
          startWith({ query, dateNotice: '', results: { status: 'loading' }, years: { status: 'loading' } } satisfies SearchView),
          catchError((error: unknown) => of<SearchView>({
            query, dateNotice: '', results: { status: 'error', message: apiErrorMessage(error) },
            years: { status: 'waiting' },
          })),
        );
      }
      const results = limits.pipe(
        switchMap((limit) => this.data.findPapers(apiQuery, limit).pipe(
          map((response): ResultsState => ({
            status: 'ready',
            papers: response.results.slice(0, limit).map(toPaperCard),
            total: response.totalHits,
          })),
          catchError((error: unknown) => of<ResultsState>({ status: 'error', message: apiErrorMessage(error) })),
          startWith({ status: 'loading' } satisfies ResultsState),
        )),
        shareReplay({ bufferSize: 1, refCount: true }),
      );

      // Use the first successful response as the coverage baseline for the whole query session.
      const years = results.pipe(
        filter((result) => result.status === 'ready'),
        take(1),
        switchMap(({ total }) => this.data.publicationYears(apiQuery, total).pipe(
          map(readyYears),
          catchError((error: unknown) => of<YearsState>({ status: 'error', message: apiErrorMessage(error) })),
          startWith({ status: 'loading' } satisfies YearsState),
        )),
        startWith({ status: 'waiting' } satisfies YearsState),
      );

      return combineLatest({ results, years }).pipe(map((view) => ({ ...view, query, dateNotice: '' })));
    }),
  ));

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
    if (!this.drafts.showEditor() || !queryInput || !limitInput) return;
    const query = queryInput.value.trim();
    const limit = limitInput.valueAsNumber;
    const invalidLimit = !Number.isInteger(limit) || limit < this.limitBounds.min || limit > this.limitBounds.max;

    this.submittedBlank.set(!query);
    this.limitError.set(invalidLimit);
    if (!query || invalidLimit) {
      (query ? limitInput : queryInput)?.focus();
      return;
    }
    if (!this.dateRange()?.validate()) return;

    const range = this.drafts.range();
    if (this.session?.query === query && this.session.range.from === range.from &&
        this.session.range.to === range.to && this.session.limits.value !== limit) {
      this.session.limits.next(limit);
    } else {
      this.session = { query, range, limits: new BehaviorSubject(limit) };
      this.sessions.next(this.session);
    }
  }
}

function readyYears(coverage: PublicationYears): YearsState {
  return { status: 'ready', coverage, maxCount: Math.max(1, ...coverage.buckets.map(({ count }) => count)) };
}

function toPaperCard(work: Work): PaperCard {
  const authors = (work.authors ?? []).map(({ name }) => name?.trim()).filter(Boolean);
  const downloadLink = work.links?.find(({ type, url }) => type === 'download' && webUrl(url));
  return {
    id: work.id,
    title: work.title?.trim() || 'Untitled paper',
    authors: authors.join(', ') || 'Authors unavailable',
    year: publicationYear(work),
    abstract: work.abstract?.trim() || undefined,
    fullText: webUrl(work.downloadUrl) ?? webUrl(downloadLink?.url),
  };
}

function webUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
