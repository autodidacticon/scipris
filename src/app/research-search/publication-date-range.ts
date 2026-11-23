import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, signal, viewChild } from '@angular/core';
import { isCalendarDate } from '../../../shared/search-filters.mjs';
import type { PublicationRange } from './publication-range';

@Component({
  selector: 'app-publication-date-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset>
      <legend>Publication date</legend>
      <div class="dates">
        <label>From
          <input #from type="date" [value]="range().from" min="0001-01-01" max="9999-12-31"
                 [attr.aria-describedby]="error() ? errorId() : null"
                 [attr.aria-invalid]="error() && invalidField() === 'from' || null"
                 (input)="edit('from', from.value)" />
        </label>
        <label>Through
          <input #to type="date" [value]="range().to" [min]="range().from || '0001-01-01'" max="9999-12-31"
                 [attr.aria-describedby]="error() ? errorId() : null"
                 [attr.aria-invalid]="error() && invalidField() === 'to' || null"
                 (input)="edit('to', to.value)" />
        </label>
      </div>
      @if (error()) { <p role="alert" [id]="errorId()">{{ error() }}</p> }
    </fieldset>`,
  styles: `
    :host { display: block; margin-top: 1rem; }
    fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
    legend { padding: 0; font-size: .875rem; font-weight: 700; }
    .dates { display: flex; flex-wrap: wrap; gap: .5rem 1rem; margin-top: .375rem; }
    label { display: grid; gap: .25rem; font-size: .8125rem; color: var(--muted); }
    input { box-sizing: border-box; min-height: 2.875rem; min-width: 0; max-width: 100%; padding: .5rem .65rem;
            font: inherit; font-size: 1rem; color: var(--ink); background: #fcfcfe;
            border: 1px solid #858fa6; border-radius: .5rem; }
    input:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
    p { margin: .5rem 0 0; font-size: .875rem; color: #8f2232; }
  `,
})
export class PublicationDateRange {
  readonly idPrefix = input.required<string>();
  readonly range = model.required<PublicationRange>();
  protected readonly errorId = computed(() => this.idPrefix() + '-date-error');
  protected readonly error = signal('');
  protected readonly invalidField = signal<'from' | 'to'>('to');
  private readonly from = viewChild.required<ElementRef<HTMLInputElement>>('from');
  private readonly to = viewChild.required<ElementRef<HTMLInputElement>>('to');

  protected edit(field: keyof PublicationRange, value: string) {
    this.error.set('');
    this.range.update(range => ({ ...range, [field]: value }));
  }

  validate(): boolean {
    for (const key of ['from', 'to'] as const) {
      const field = this[key]().nativeElement;
      const value = this.range()[key];
      const reversed = key === 'to' && value && this.range().from > value;
      if (!field.validity.valid || (value && !isCalendarDate(value)) || reversed) {
        this.invalidField.set(key);
        this.error.set(reversed ? 'The end date must be on or after the start date.' : 'Enter a valid publication date.');
        field.focus();
        return false;
      }
    }
    this.error.set('');
    return true;
  }
}
