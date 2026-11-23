import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { provideCoreApi } from './app/core/api';

bootstrapApplication(App, {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient(withFetch()), provideCoreApi()],
}).catch((error: unknown) => console.error(error));
