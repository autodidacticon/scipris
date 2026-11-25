import { EnvironmentProviders } from '@angular/core';
import { provideApi } from './generated/provide-api';

export interface CoreApiOptions {
  baseUrl?: string;
  /** For trusted server-side callers. A browser should get access through its proxy. */
  bearerToken?: () => string | undefined;
}

export function provideCoreApi(options: CoreApiOptions = {}): EnvironmentProviders {
  return provideApi({
    basePath: (options.baseUrl ?? '/api/core').replace(/\/+$/, ''),
    credentials: options.bearerToken ? { coreBearer: options.bearerToken } : undefined,
  });
}
