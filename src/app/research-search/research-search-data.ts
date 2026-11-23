import { Injectable, inject } from '@angular/core';
import { EMPTY, catchError, defer, expand, last, map, of, switchMap } from 'rxjs';
import {
  CORE_OFFSET_WINDOW,
  CORE_SEARCH_LIMIT,
  CoreApiClient,
  CoreApiError,
  type Work,
} from '../core/api';

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

  private enumerateYears(query: string, total: number) {
    return defer(() => {
      const yearsById = new Map<number, number | null>();
      const fetchPage = (offset: number) => {
        const limit = Math.min(CORE_SEARCH_LIMIT.max, total - offset);
        return this.core.searchWorks({ q: query, limit, offset }).pipe(
          map((page) => ({ offset, limit, page })),
        );
      };

      return fetchPage(0).pipe(
        expand(({ offset, limit, page }) => {
          if (page.totalHits !== total) {
            throw new CoverageError('CORE’s reported match count changed while checking papers.');
          }
          if (
            page.results.length === 0 || page.results.length > limit ||
            (page.offset !== undefined && page.offset !== offset)
          ) {
            throw new CoverageError('CORE returned an incomplete or inconsistent page while checking papers.');
          }

          for (const work of page.results) {
            if (!Number.isSafeInteger(work.id) || yearsById.has(work.id)) {
              throw new CoverageError('CORE did not return distinct paper IDs across the search pages.');
            }
            yearsById.set(work.id, publicationYear(work));
          }

          return yearsById.size === total ? EMPTY : fetchPage(offset + page.results.length);
        }, 1),
        last(),
        map(() => {
          const counts = new Map<number | null, number>();
          for (const year of yearsById.values()) counts.set(year, (counts.get(year) ?? 0) + 1);
          return summarizeYears(counts, total);
        }),
      );
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
