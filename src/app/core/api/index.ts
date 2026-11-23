export { CoreApiClient } from './core-api-client';
export { CoreApiError } from './core-api-error';
export { provideCoreApi, type CoreApiOptions } from './core-api.config';
export type { SearchWorksRequestParams } from './generated/api/works.service';
export type {
  Author,
  Work,
  WorkLink,
  WorksAggregationRequest,
  WorksAggregationResponse,
  WorksSearchResponse,
} from './generated/model/models';
