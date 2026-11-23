import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-site-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <div class="page-width">Mini Cypris</div>
    </header>
  `,
  styles: `
    header {
      border-bottom: 1px solid #d9dfea;
      background: #fff;
      padding-block: 1rem;
      color: #352887;
      font-weight: 700;
    }
  `,
})
export class SiteHeader {}
