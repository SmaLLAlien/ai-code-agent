import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    // <mat-icon> uses the Material Symbols font loaded in index.html (default would be Material Icons).
    provideEnvironmentInitializer(() =>
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined'),
    ),
  ]
};
