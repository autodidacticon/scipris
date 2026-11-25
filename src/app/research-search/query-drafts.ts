import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { CORE_SEARCH_LIMIT, TOTAL_RESULTS, type AggregateField } from '../../../shared/search-filters.mjs';
import type { PublicationRange } from './publication-range';

interface DraftSettings {
  enabled: boolean;
  debounceMs?: number;
}

interface Translation {
  filters?: { aggregations?: AggregateField[] | null; pageSize?: number | null; limit: number | null; publishedFrom: string | null; publishedTo: string | null };
  options: { label: string; expression: string }[];
  clarification: string;
  unapplied: string[];
}

@Injectable()
export class QueryDrafts {
  private readonly http = inject(HttpClient);
  private readonly settings = toSignal(this.http.get<DraftSettings>('/api/nlp/status').pipe(
    catchError(() => of<DraftSettings>({ enabled: false })),
  ));
  readonly available = computed(() => {
    const settings = this.settings();
    return settings === undefined ? undefined : settings?.enabled === true;
  });
  readonly enabled = signal(false);
  readonly description = signal('');
  readonly query = signal('');
  readonly range = signal<PublicationRange>({ from: '', to: '' });
  readonly result = signal<Translation | undefined>(undefined);
  readonly draftLimit = linkedSignal(() => String(this.result()?.filters?.limit ?? TOTAL_RESULTS.default));
  readonly draftPageSize = linkedSignal(() => String(this.result()?.filters?.pageSize ?? CORE_SEARCH_LIMIT.default));
  readonly selected = signal<number | null>(null);
  readonly appliedNotes = signal<string[]>([]);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly showEditor = computed(() => !this.enabled() || this.selected() !== null || !!this.error());
  readonly showFilters = computed(() => this.showEditor() || !!this.result()?.options.length);
  private request?: Subscription;
  private edits = new Map<number, string>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  toggle(enabled: boolean) {
    this.cancel();
    this.enabled.set(enabled);
  }

  setDescription(text: string, event: Event) {
    this.cancel();
    this.description.set(text);
    this.result.set(undefined);
    this.selected.set(null);
    this.edits.clear();
    this.error.set('');
    const composing = event.type === 'compositionstart' || (event instanceof InputEvent && event.isComposing);
    const description = text.trim();
    if (!composing && description && this.enabled() && this.available()) this.scheduleTranslation(description);
  }

  editQuery(text: string) {
    this.query.set(text);
    const selected = this.selected();
    if (selected !== null) this.edits.set(selected, text);
  }

  choose(index: number) {
    const result = this.result();
    const option = result?.options[index];
    if (!result || !option) return;
    this.selected.set(index);
    this.query.set(this.edits.get(index) ?? option.expression);
    this.appliedNotes.set(result.unapplied);
  }

  private scheduleTranslation(description: string) {
    this.request = timer(this.settings()?.debounceMs ?? 1000).pipe(
      switchMap(() => {
        this.pending.set(true);
        return this.http.post<Translation>('/api/nlp/translate', { description });
      }),
    ).subscribe({
      next: (result) => {
        this.pending.set(false);
        this.result.set(result);
        if (result.options.length) {
          this.range.set({ from: result.filters?.publishedFrom ?? '', to: result.filters?.publishedTo ?? '' });
        }
        if (result.options.length === 1) this.choose(0);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        const message = error.status === 429 ? 'Translation limit reached. Try drafting again in a minute.'
          : error.status === 504 ? 'Translation timed out.'
          : 'Could not translate this description.';
        this.appliedNotes.set([]);
        this.error.set(message);
      },
    });
  }

  private cancel() {
    this.request?.unsubscribe();
    this.request = undefined;
    this.pending.set(false);
  }
}
