import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SiteHeader } from './site-header';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-header />
    <main class="page-width" aria-labelledby="research-title">
      <h1 id="research-title">Research search</h1>
      <p>Explore scientific papers from CORE.</p>
    </main>
  `,
  styles: `
    main {
      padding-block: 3rem;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 5vw, 3rem);
      line-height: 1.15;
    }

    p {
      margin: 0.75rem 0 0;
      color: #4b5868;
    }
  `,
})
export class App {}
