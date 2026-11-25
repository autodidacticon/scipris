import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { highlightQuery } from './query-syntax';

@Component({
  selector: '[appQueryHighlight]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (part of parts(); track $index) {
      <span [class.group]="part.depth > 0" [class]="part.depth ? groupTones[(part.depth - 1) % groupTones.length] : ''"
            [class.operator]="part.kind === 'operator'"
            [class.parenthesis]="part.kind === 'parenthesis'">{{ part.text }}</span>
    }
  `,
  styles: `
    .mint, .parenthesis {
      --group-color: #d3eee3;
    }
    .peach {
      --group-color: #f6dfc1;
    }
    .blue {
      --group-color: #d1e5f4;
    }
    .group, .parenthesis {
      background-color: var(--group-color);
    }
    .operator {
      background-color: #dfd8ff;
      border-radius: 0.2em;
    }
    .group.operator {
      border-radius: 0;
      box-shadow: inset 0 -0.16em var(--group-color);
    }
  `,
})
export class QueryHighlight {
  readonly appQueryHighlight = input.required<string>();
  protected readonly groupTones = ['mint', 'peach', 'blue'] as const;
  protected readonly parts = computed(() => highlightQuery(this.appQueryHighlight()));
}
