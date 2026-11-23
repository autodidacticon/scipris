import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('Application shell', () => {
  it('renders the standalone header and the labelled research area', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const shell: HTMLElement = fixture.nativeElement;
    expect(shell.querySelector('header')?.textContent?.trim()).toBe('Mini Cypris');

    const main = shell.querySelector('main[aria-labelledby="research-title"]');
    expect(main?.querySelector('h1#research-title')?.textContent?.trim()).toBe('Research search');
    expect(main?.querySelector('p')?.textContent?.trim()).toBe('Explore scientific papers from CORE.');
  });
});
