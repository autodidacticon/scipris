import type { WorksAggregationResponse } from '../core/api';
import { publicationYear } from './publication-range';

import type { AggregateField } from '../../../shared/search-filters.mjs';
export { aggregateFields, aggregateLabels, type AggregateField } from '../../../shared/search-filters.mjs';

export interface YearBucket { year: number | null; count: number }
interface ValueBucket { value: string; count: number }

export type Distribution =
  | { field: 'yearPublished'; buckets: YearBucket[] }
  | { field: Exclude<AggregateField, 'yearPublished'>; buckets: ValueBucket[] };

export function distributions(fields: AggregateField[], response: WorksAggregationResponse): Distribution[] {
  return fields.map(field => {
    const raw = response.aggregations[field];
    const values: ValueBucket[] = [];
    for (const [value, count] of Object.entries(raw ?? {})) {
      if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) values.push({ value, count });
    }
    if (field === 'yearPublished') {
      const counts = new Map<number | null, number>();
      for (const { value, count } of values) {
        const year = publicationYear(Number(value));
        counts.set(year, (counts.get(year) ?? 0) + count);
      }
      const buckets = Array.from(counts, ([year, count]) => ({ year, count }))
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      return { field, buckets };
    }
    return { field, buckets: values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)) };
  });
}
