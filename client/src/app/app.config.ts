import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  MAT_RIPPLE_GLOBAL_OPTIONS,
  RippleGlobalOptions,
} from '@angular/material/core';
import { provideAngularMaterialTheme } from '@mucsi96/angular-material-theme';
import { routes } from './app.routes';
import { errorInterceptor } from './utils/error.interceptor';
import { authInterceptor } from './utils/auth.interceptor';
import { timezoneInterceptor } from './utils/timezone.interceptor';
import { AuthService } from './auth.service';
import {
  EnvironmentConfig,
  ENVIRONMENT_CONFIG,
} from './environment/environment.config';

const globalRippleConfig: RippleGlobalOptions = {
  disabled: true,
};

export function getAppConfig(environment: EnvironmentConfig): ApplicationConfig {
  return {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(
        withInterceptors([
          errorInterceptor,
          authInterceptor,
          timezoneInterceptor,
        ])
      ),
      { provide: MAT_RIPPLE_GLOBAL_OPTIONS, useValue: globalRippleConfig },
      provideAngularMaterialTheme(),
      { provide: ENVIRONMENT_CONFIG, useValue: environment },
      provideAppInitializer(() => inject(AuthService).init()),
    ],
  };
}
