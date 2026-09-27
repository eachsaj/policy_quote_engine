import { type ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

/**
 * App-wide providers: zoneless change detection (signals drive rendering, no zone.js), HttpClient for the
 * quote request, and a listener that reports uncaught browser errors.
 */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideZonelessChangeDetection(), provideHttpClient()],
};
