import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PaperResult } from './paper-result';

@Component({
  selector: 'tbody[appPaperRow]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tr class="paper-row" (click)="toggle()">
      <th scope="row">
        <div class="paper-title">
          <button type="button" [attr.aria-expanded]="expanded()" [attr.aria-controls]="abstractId()"
                  [attr.aria-label]="(expanded() ? 'Hide abstract for ' : 'Show abstract for ') + paper().title"
                  (click)="$event.stopPropagation(); toggle()"><span class="chevron" aria-hidden="true"></span></button>
          <a [href]="'https://core.ac.uk/works/' + paper().id" (click)="$event.stopPropagation()">{{ paper().title }}</a>
        </div>
      </th>
      <td>{{ paper().authors }}</td>
      <td class="publication-year">{{ paper().year ?? 'Year unavailable' }}</td>
    </tr>
    <tr class="abstract-row" [id]="abstractId()" [hidden]="!expanded()">
      <td colspan="3">
        @if (expanded()) {
          <strong>Abstract</strong>
          <p>{{ paper().abstract ?? 'No abstract available.' }}</p>
          @if (paper().fullText; as url) {
            <a [href]="url" [attr.aria-label]="'Full text, ' + paper().title">Full text</a>
          }
        }
      </td>
    </tr>
  `,
  styles: `
    .paper-row { cursor: pointer; }
    .paper-row:hover { background: #f8f8fc; }
    th, td { border-top: 1px solid var(--border); padding: .75rem; text-align: start; vertical-align: top; }
    .publication-year { font-variant-numeric: tabular-nums; }
    .paper-title { display: flex; align-items: baseline; gap: .375rem; }
    a { color: var(--accent); text-underline-offset: .15em; }
    button { flex: none; width: 1.75rem; height: 1.75rem; border: 0; border-radius: .25rem; background: transparent;
             color: var(--accent); cursor: pointer; }
    button:hover { background: #e5e2f4; }
    .chevron { display: inline-block; width: .4rem; height: .4rem; border: solid currentColor; border-width: 0 2px 2px 0;
               transform: rotate(-45deg); }
    button[aria-expanded=true] .chevron { transform: rotate(45deg); }
    :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    .abstract-row td { background: #f8f8fc; padding-inline: 1rem; }
    .abstract-row p { margin: .3rem 0; white-space: pre-line; }
    @media (max-width: 35rem) {
      th, td { padding: .5rem .4rem; }
      .paper-title { gap: .125rem; }
    }
  `,
})
export class PaperRow {
  readonly paper = input.required<PaperResult>();
  readonly idPrefix = input.required<string>();
  protected readonly expanded = signal(false);
  protected readonly abstractId = computed(() => this.idPrefix() + '-abstract-' + this.paper().id);

  protected toggle() {
    this.expanded.update(open => !open);
  }
}
