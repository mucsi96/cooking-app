import { Routes } from '@angular/router';
import { authGuard } from './utils/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
    title: 'Hello',
  },
];
