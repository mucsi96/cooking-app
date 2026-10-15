import { InjectionToken } from '@angular/core';

export interface EnvironmentConfig {
  clientLogUrl: string;
  clientAppName: string;
}

export const ENVIRONMENT_CONFIG = new InjectionToken<EnvironmentConfig>('ENVIRONMENT_CONFIG');
