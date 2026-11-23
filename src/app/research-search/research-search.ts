import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
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
import {
  ResearchSearchData,
  apiErrorMessage,
  publicationYear,
  type PublicationYears,
} from './research-search-data';

interface SearchSession {
  query: string;
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

@Component({
  selector: 'app-research-search',
  imports: [DecimalPipe],
  templateUrl: './research-search.html',
  styleUrl: './research-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResearchSearch {
  /** Set a unique HTML ID prefix for each instance when embedding more than one. */
  readonly idPrefix = input('research-search');

  protected readonly queryError = signal(false);
  protected readonly limitError = signal(false);
  protected readonly limitBounds = CORE_SEARCH_LIMIT;

  private readonly data = inject(ResearchSearchData);
  private readonly sessions = new Subject<SearchSession>();
  private session?: SearchSession;

  protected readonly state = toSignal(this.sessions.pipe(
    switchMap(({ query, limits }) => {
      const results = limits.pipe(
        switchMap((limit) => this.data.findPapers(query, limit).pipe(
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
        switchMap(({ total }) => this.data.publicationYears(query, total).pipe(
          map((coverage): YearsState => ({
            status: 'ready',
            coverage,
            maxCount: Math.max(1, ...coverage.buckets.map(({ count }) => count)),
          })),
          catchError((error: unknown) => of<YearsState>({ status: 'error', message: apiErrorMessage(error) })),
          startWith({ status: 'loading' } satisfies YearsState),
        )),
        startWith({ status: 'waiting' } satisfies YearsState),
      );

      return combineLatest({ results, years }).pipe(map((view) => ({ ...view, query })));
    }),
  ));

  protected submit(event: SubmitEvent, queryInput: HTMLInputElement, limitInput: HTMLInputElement) {
    event.preventDefault();
    const query = queryInput.value.trim();
    const limit = limitInput.valueAsNumber;
    const invalidLimit = !Number.isInteger(limit) || limit < this.limitBounds.min || limit > this.limitBounds.max;

    this.queryError.set(!query);
    this.limitError.set(invalidLimit);
    if (!query || invalidLimit) {
      (query ? limitInput : queryInput).focus();
      return;
    }

    if (this.session?.query === query && this.session.limits.value !== limit) {
      this.session.limits.next(limit);
    } else {
      this.session = { query, limits: new BehaviorSubject(limit) };
      this.sessions.next(this.session);
    }
  }
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
