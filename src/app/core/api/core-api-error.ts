import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

export class CoreApiError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;
  readonly upstreamMessage?: string;

  constructor(response: HttpErrorResponse) {
    const status = response.status;
    if (status === 0) {
      super('Could not reach the CORE API.');
    } else if (status === 429) {
      super('CORE API rate limit exceeded.');
    } else if (status >= 200 && status < 300) {
      super('Could not decode the CORE API response.');
    } else {
      super(`CORE API request failed (HTTP ${status}).`);
    }

    this.name = 'CoreApiError';
    this.status = status;
    this.retryAfter =
      response.headers.get('X-RateLimit-Retry-After') ?? response.headers.get('Retry-After');

    const body: unknown = response.error;
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      this.upstreamMessage = body.message;
    }
  }
}

export function rethrowCoreApiError(error: unknown): Observable<never> {
  return throwError(() => (error instanceof HttpErrorResponse ? new CoreApiError(error) : error));
}
