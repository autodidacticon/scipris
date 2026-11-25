import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideCoreApi } from './core/api';

describe('Application shell', () => {
  it('renders the standalone header and the labelled research area', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideCoreApi()],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const shell: HTMLElement = fixture.nativeElement;
    expect(shell.querySelector('header')?.textContent?.trim()).toBe('Scipris');

    const main = shell.querySelector('main[aria-labelledby="research-title"]');
    expect(main?.querySelector('h1#research-title')?.textContent?.trim()).toBe('CORE search');
    expect(main?.querySelector('p')?.textContent?.trim()).toBe('Explore scientific papers from CORE.');
    expect(main?.querySelector('app-research-search form[role="search"]')).not.toBeNull();
  });
});
