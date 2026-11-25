import type { Work } from '../core/api';
import { publicationYear } from './publication-range';

export interface PaperResult {
  id: number;
  title: string;
  authors: string;
  year: number | null;
  abstract: string | undefined;
  fullText: string | undefined;
}

export function toPaperResult(work: Work): PaperResult {
  const authors = (work.authors ?? []).map(({ name }) => name?.trim()).filter(Boolean);
  const downloadLink = work.links?.find(({ type, url }) => type === 'download' && webUrl(url));
  return {
    id: work.id,
    title: work.title?.trim() || 'Untitled paper',
    authors: authors.join(', ') || 'Authors unavailable',
    year: publicationYear(work.yearPublished),
    abstract: work.abstract?.trim() || undefined,
    fullText: webUrl(work.downloadUrl) ?? webUrl(downloadLink?.url),
  };
}

export type YearOrder = 'asc' | 'desc';

function webUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
