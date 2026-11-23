import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { rethrowCoreApiError } from './core-api-error';
import { WorksService, type SearchWorksRequestParams } from './generated/api/works.service';
import type { WorksAggregationRequest } from './generated/model/works-aggregation-request';
import type { WorksAggregationResponse } from './generated/model/works-aggregation-response';
import type { WorksSearchResponse } from './generated/model/works-search-response';

@Injectable({ providedIn: 'root' })
export class CoreApiClient {
  private readonly works = inject(WorksService);

  searchWorks(request: SearchWorksRequestParams): Observable<WorksSearchResponse> {
    // Use the contract defaults when checking an otherwise omitted page size or offset.
    const { limit = 10, offset = 0 } = request;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return throwError(() => new RangeError('CORE search limit must be an integer from 1 to 100.'));
    }
    if (!Number.isInteger(offset) || offset < 0 || offset + limit > 10_000) {
      return throwError(() => new RangeError('CORE search offset and limit must fit in 10,000 works.'));
    }

    return this.works
      .searchWorks({ exclude: 'fullText', ...request })
      .pipe(catchError(rethrowCoreApiError));
  }

  aggregateWorks(request: WorksAggregationRequest): Observable<WorksAggregationResponse> {
    return this.works
      .aggregateWorks({ worksAggregationRequest: request })
      .pipe(catchError(rethrowCoreApiError));
  }
}
