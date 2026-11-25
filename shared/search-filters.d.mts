export const CORE_SEARCH_LIMIT: Readonly<{ min: 1; max: 100; default: 10 }>;
export const TOTAL_RESULTS: Readonly<{ min: 1; max: 10000; default: 100 }>;
export function isCalendarDate(value: unknown): value is string;

export type AggregateField = 'yearPublished' | 'documentType' | 'authors' | 'contributors' | 'publisher' | 'language' | 'fieldsOfStudy';
export const aggregateLabels: Readonly<Record<AggregateField, string>>;
export const aggregateFields: readonly AggregateField[];
