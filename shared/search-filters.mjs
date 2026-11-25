export const CORE_SEARCH_LIMIT = Object.freeze({ min: 1, max: 100, default: 10 });

export const TOTAL_RESULTS = Object.freeze({ min: 1, max: 10_000, default: 100 });

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value + 'T');
}

export const aggregateLabels = {
  yearPublished: 'Publication year',
  documentType: 'Document type',
  authors: 'Authors',
  contributors: 'Contributors',
  publisher: 'Publisher',
  language: 'Language',
  fieldsOfStudy: 'Fields of study',
};
export const aggregateFields = Object.freeze(Object.keys(aggregateLabels));
