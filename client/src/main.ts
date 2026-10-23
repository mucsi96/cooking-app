import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import type { RuntimeConfig } from './app/runtime-config';
import { initFaro } from './app/utils/faro';

const config: RuntimeConfig | undefined = window.__APP_CONFIG__;
if (!config || typeof config.clientLogUrl !== 'string' || typeof config.clientAppName !== 'string') {
  throw new Error('Missing frontend runtime configuration in index.html');
}

initFaro(config.clientLogUrl, config.clientAppName);
bootstrapApplication(AppComponent, appConfig)
  .catch(error => console.error('[boot] Angular bootstrap failed', error));
