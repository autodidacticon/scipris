import { Injectable, inject } from '@angular/core';
import { EMPTY, catchError, defer, expand, last, map, of, switchMap, throwError } from 'rxjs';
import {
  CORE_OFFSET_WINDOW,
  CORE_SEARCH_LIMIT,
  CoreApiClient,
  CoreApiError,
  type Work,
} from '../core/api';

import { publishedInRange, type PublicationRange } from './publication-range';

interface YearBucket {
  year: number | null;
  count: number;
}

export interface PublicationYears {
  buckets: YearBucket[];
  counted: number;
  total: number;
  partialReason?: string;
}

@Injectable({ providedIn: 'root' })
export class ResearchSearchData {
  private readonly core = inject(CoreApiClient);

  findPapers(query: string, limit: number) {
    return this.core.searchWorks({ q: query, limit, offset: 0 });
  }

  publicationYears(query: string, total: number) {
    if (total === 0) return of(summarizeYears(new Map(), 0));

    return this.core.aggregateWorks({ q: query, aggregations: ['yearPublished'] }).pipe(
      switchMap((response) => {
        const counts = new Map<number | null, number>();
        const entries = Object.entries(response.aggregations?.yearPublished ?? {});
        let unrecognizedBucket = false;
        for (const [key, count] of entries) {
          const year = Number(key);
          if (
            String(year) === key && isPublicationYear(year) &&
            typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
          ) {
            if (count > 0) counts.set(year, count);
          } else if (count !== 0) {
            unrecognizedBucket = true;
          }
        }

        const aggregate = summarizeYears(counts, total);
        if (aggregate.counted === total && !unrecognizedBucket) return of(aggregate);

        // If the breakdown contradicts the total, withhold the buckets until the fallback can verify them.
        const partial = aggregate.counted < total ? aggregate : summarizeYears(new Map(), total);
        if (total > CORE_OFFSET_WINDOW) {
          return of({
            ...partial,
            partialReason: 'The returned year buckets could not be reconciled with the match count. This query exceeds CORE’s 10,000-work offset window for checking individual papers.',
          });
        }

        return this.enumerateYears(query, total).pipe(
          catchError((error: unknown) => of({
            ...partial,
            partialReason: error instanceof CoverageError
              ? error.message
              : `Checking individual papers stopped. ${apiErrorMessage(error)}`,
          })),
        );
      }),
    );
  }

  datedMatches(query: string, range: PublicationRange) {
    return defer(() => {
      const papers: Work[] = [];
      const counts = new Map<number | null, number>();
      let checked = 0;
      let candidates = 0;
      let matches = 0;
      const snapshot = (notice: string) => ({ papers: [...papers], years: summarizeYears(counts, matches), notice });

      return this.pages(query).pipe(
        map(page => {
          candidates = page.totalHits;
          checked += page.results.length;
          for (const work of page.results) {
            if (!publishedInRange(work, range)) continue;
            if (papers.length < CORE_SEARCH_LIMIT.max) papers.push(work);
            const year = publicationYear(work);
            counts.set(year, (counts.get(year) ?? 0) + 1);
            matches++;
          }
          return snapshot(checked === candidates ? '' : `Checking publication dates (${checked} of ${candidates} candidates).`);
        }),
        catchError((error: unknown) => {
          if (!checked) return throwError(() => error);
          const reason = error instanceof CoverageError ? error.message : apiErrorMessage(error);
          return of(snapshot(`Partial coverage. Checked ${checked} of ${candidates} candidate papers. ${reason}`));
        }),
      );
    });
  }

  private enumerateYears(query: string, total: number) {
    return defer(() => {
      const counts = new Map<number | null, number>();
      return this.pages(query, total).pipe(
        map(page => {
          for (const work of page.results) {
            const year = publicationYear(work);
            counts.set(year, (counts.get(year) ?? 0) + 1);
          }
        }),
        last(),
        map(() => summarizeYears(counts, total)),
      );
    });
  }

  private pages(query: string, expectedTotal?: number) {
    return defer(() => {
      let total = expectedTotal;
      let offset = 0;
      const seen = new Set<number>();
      const fetchPage = () => {
        const limit = Math.min(CORE_SEARCH_LIMIT.max, (total ?? Infinity) - offset, CORE_OFFSET_WINDOW - offset);
        return this.core.searchWorks({ q: query, limit, offset }).pipe(map(page => {
          total ??= page.totalHits;
          if (!Number.isSafeInteger(total) || total < 0 || page.totalHits !== total) {
            throw new CoverageError('CORE’s reported match count changed while checking papers.');
          }
          if ((!page.results.length && offset < total) || page.results.length > limit ||
              offset + page.results.length > total || (page.offset !== undefined && page.offset !== offset)) {
            throw new CoverageError('CORE returned an incomplete or inconsistent page while checking papers.');
          }
          for (const work of page.results) {
            if (!Number.isSafeInteger(work.id) || seen.has(work.id)) {
              throw new CoverageError('CORE did not return distinct paper IDs across the search pages.');
            }
            seen.add(work.id);
          }
          offset += page.results.length;
          return page;
        }));
      };
      return fetchPage().pipe(expand(() => {
        if (offset === total) return EMPTY;
        if (offset >= CORE_OFFSET_WINDOW) throw new CoverageError('CORE’s 10,000-work paging limit was reached.');
        return fetchPage();
      }, 1));
    });
  }
}

class CoverageError extends Error {}

export function apiErrorMessage(error: unknown): string {
  return error instanceof CoreApiError ? error.message : 'An unexpected error occurred while reading from CORE.';
}

export function publicationYear(work: Work): number | null {
  return isPublicationYear(work.yearPublished) ? work.yearPublished : null;
}

function isPublicationYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function summarizeYears(counts: Map<number | null, number>, total: number): PublicationYears {
  const buckets = Array.from(counts, ([year, count]) => ({ year, count }));
  buckets.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  return { buckets, counted: buckets.reduce((sum, bucket) => sum + bucket.count, 0), total };
}
