import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initFaro } from './app/utils/faro';

// Public telemetry settings are compiled into the bundle, independent of hosting.
initFaro(new URL('/_telemetry/collect', window.location.origin).href, 'cooking-client');
bootstrapApplication(AppComponent, appConfig)
  .catch(error => console.error('[boot] Angular bootstrap failed', error));
