import { Injectable, inject } from '@angular/core';
import { EMPTY, TimeoutError, catchError, defer, expand, map, of, timeout } from 'rxjs';
import {
  CORE_OFFSET_WINDOW,
  CORE_SEARCH_LIMIT,
  CoreApiClient,
  CoreApiError,
} from '../core/api';
import { toPaperResult, type PaperResult, type YearOrder } from './paper-result';
import { publishedInRange, type PublicationRange } from './publication-range';
import { distributions, type AggregateField } from './work-analytics';

const CORE_REQUEST_TIMEOUT_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class ResearchSearchData {
  private readonly core = inject(CoreApiClient);

  findPapers(query: string, limit: number, offset: number, order: YearOrder) {
    return this.core.searchWorks({ q: query, limit, offset, sort: `yearPublished:${order},id:asc` });
  }

  aggregate(query: string, fields: AggregateField[]) {
    if (!fields.length) return of([]);
    return this.core.aggregateWorks({ q: query, aggregations: fields }).pipe(
      timeout(CORE_REQUEST_TIMEOUT_MS),
      map(response => distributions(fields, response)),
    );
  }

  // One reader belongs to one submitted query, date range and CORE sort order.
  datedPages(query: string, range: PublicationRange, order: YearOrder) {
    const papers: PaperResult[] = [];
    const seen = new Set<number>();
    let total: number | undefined;
    let offset = 0;

    return (target: number) => {
      const remaining = () => Math.min(total ?? Infinity, CORE_OFFSET_WINDOW) - offset;
      const snapshot = (error?: string) => ({
        papers, checked: offset, candidates: total, more: remaining() > 0,
        pending: !error && papers.length < target && remaining() > 0, error,
      });
      const fetch = () => {
        const limit = Math.min(target - papers.length, remaining(), CORE_SEARCH_LIMIT.max);
        return this.findPapers(query, limit, offset, order).pipe(timeout(CORE_REQUEST_TIMEOUT_MS), map(page => {
          if (!Number.isSafeInteger(page.totalHits) || page.totalHits < 0 ||
              (total !== undefined && page.totalHits !== total)) {
            throw new DateScanError('CORE’s reported match count changed while checking papers.');
          }
          if ((!page.results.length && offset < page.totalHits) || page.results.length > limit ||
              offset + page.results.length > page.totalHits || (page.offset !== undefined && page.offset !== offset)) {
            throw new DateScanError('CORE returned an incomplete or inconsistent page while checking papers.');
          }
          const ids = new Set(page.results.map(work => work.id));
          if (ids.size !== page.results.length || [...ids].some(id => !Number.isSafeInteger(id) || seen.has(id))) {
            throw new DateScanError('CORE did not return distinct paper IDs across the search pages.');
          }
          const verified = page.results.filter(work => publishedInRange(work, range)).map(toPaperResult);
          for (const id of ids) seen.add(id);
          papers.push(...verified);
          offset += page.results.length;
          total = page.totalHits;
          return snapshot();
        }));
      };
      return defer(() => snapshot().pending ? fetch() : of(snapshot())).pipe(
        expand(state => state.pending ? fetch() : EMPTY, 1),
        catchError((error: unknown) => of(snapshot(error instanceof DateScanError ? error.message : apiErrorMessage(error)))),
      );
    };
  }
}

class DateScanError extends Error {}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof TimeoutError) return 'CORE did not respond in time. Submit the search again to retry.';
  return error instanceof CoreApiError ? error.message : 'An unexpected error occurred while reading from CORE.';
}
