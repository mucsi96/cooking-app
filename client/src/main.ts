import { bootstrapApplication } from '@angular/platform-browser';
import { getAppConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { EnvironmentConfig } from './app/environment/environment.config';
import { initFaro } from './app/utils/faro';

loadEnvironmentConfig().then(environment => {
  initFaro(environment.clientLogUrl, environment.clientAppName);
  console.info(
    '[boot] Faro initialized, starting Angular bootstrap',
    JSON.stringify({
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
  const query = new URLSearchParams({ returnTo: window.location.pathname + window.location.search + window.location.hash });
  const response = await fetch(`/api/environment?${query}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status}`);
  }
  const result: EnvironmentConfig | { redirectTo: string } = await response.json();
  if ('redirectTo' in result) {
    window.location.replace(result.redirectTo);
    return new Promise<EnvironmentConfig>(() => {});
  }
  return result;
}
