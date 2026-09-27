import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Starts the standalone app: no NgModule, no zone.js (see app.config.ts).
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
