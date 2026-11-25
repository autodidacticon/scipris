import { isCalendarDate } from '../../../shared/search-filters.mjs';
import type { Work } from '../core/api';

export interface PublicationRange {
  from: string;
  to: string;
}

// Allow forthcoming issues dated in the next calendar year.
function latestPublicationYear(): number {
  return new Date().getUTCFullYear() + 1;
}

export function publicationYear(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 &&
    value <= latestPublicationYear() ? value : null;
}

export function publicationYearBounds({ from, to }: PublicationRange) {
  const latest = latestPublicationYear();
  return {
    first: from ? Number(from.slice(0, 4)) : 1,
    last: to ? Math.min(Number(to.slice(0, 4)), latest) : latest,
  };
}

export function restrictPublicationYears(query: string, range: PublicationRange): string {
  if (!range.from && !range.to) return query;
  const { first, last } = publicationYearBounds(range);
  return `(${query}) AND yearPublished>=${first} AND yearPublished<=${last}`;
}

export function needsDayCheck({ from, to }: PublicationRange): boolean {
  return (!!from && !from.endsWith('-01-01')) || (!!to && !to.endsWith('-12-31'));
}

export function publishedInRange(work: Work, { from, to }: PublicationRange): boolean {
  const day = work.publishedDate?.split('T')[0];
  if (isCalendarDate(day) && publicationYear(Number(day.slice(0, 4))) !== null) {
    return (!from || day >= from) && (!to || day <= to);
  }
  // A year-only record is conclusive when the range contains the whole year.
  const usableYear = publicationYear(work.yearPublished);
  if (usableYear === null) return false;
  const year = String(usableYear).padStart(4, '0');
  return (!from || year + '-01-01' >= from) && (!to || year + '-12-31' <= to);
}
