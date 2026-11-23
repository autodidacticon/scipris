import { isCalendarDate } from '../../../shared/search-filters.mjs';
import type { Work } from '../core/api';

export interface PublicationRange {
  from: string;
  to: string;
}

export function restrictPublicationYears(query: string, { from, to }: PublicationRange): string {
  if (!from && !to) return query;
  const clauses = ['(' + query + ')'];
  if (from) clauses.push('yearPublished>=' + Number(from.slice(0, 4)));
  if (to) clauses.push('yearPublished<=' + Number(to.slice(0, 4)));
  return clauses.join(' AND ');
}

export function needsDayCheck({ from, to }: PublicationRange): boolean {
  return (!!from && !from.endsWith('-01-01')) || (!!to && !to.endsWith('-12-31'));
}

export function publishedInRange(work: Work, { from, to }: PublicationRange): boolean {
  const day = work.publishedDate?.split('T')[0];
  if (isCalendarDate(day)) return (!from || day >= from) && (!to || day <= to);
  // A year-only record is conclusive when the range contains the whole year.
  if (!work.yearPublished) return false;
  const year = String(work.yearPublished).padStart(4, '0');
  return (!from || year + '-01-01' >= from) && (!to || year + '-12-31' <= to);
}
