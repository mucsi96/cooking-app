import { bootstrapApplication } from '@angular/platform-browser';
import { getAppConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { EnvironmentConfig } from './app/environment/environment.config';
import { initFaro } from './app/utils/faro';

loadEnvironmentConfig().then(environment => {
  initFaro(environment.clientLogUrl, environment.clientAppName);
  const url = new URL(window.location.href);
  console.info(
    '[boot] Faro initialized, starting Angular bootstrap',
    JSON.stringify({
      returnedFromAuthority:
        url.searchParams.has('code') || url.searchParams.has('error'),
      displayMode:
        window.matchMedia?.('(display-mode: standalone)').matches
          ? 'standalone'
          : 'browser',
      visibilityState: document.visibilityState,
    })
  );
  bootstrapApplication(AppComponent, getAppConfig(environment))
    .catch((err) => console.error('[boot] Angular bootstrap failed', err));
});

async function loadEnvironmentConfig(): Promise<EnvironmentConfig> {
  const response = await fetch('/api/environment');
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status}`);
  }
  return await response.json();
}
