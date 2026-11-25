import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ResearchSearch } from './research-search/research-search';
import { SiteHeader } from './site-header';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ResearchSearch, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-header />
    <main class="page-width" aria-labelledby="research-title">
      <h1 id="research-title">CORE search</h1>
      <p>Explore scientific papers from CORE.</p>
      <app-research-search />
    </main>
  `,
  styles: `
    main {
      padding-block: clamp(2rem, 5vw, 4rem);
    }

    h1 {
      margin: 0;
      font-size: clamp(2.25rem, 5vw, 3.75rem);
      line-height: 1.15;
      letter-spacing: -0.045em;
    }

    p {
      margin: 0.625rem 0 1.75rem;
      color: #505a70;
      font-size: 1.0625rem;
    }
  `,
})
export class App {}
