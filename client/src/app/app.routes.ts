import { Routes } from '@angular/router';
import { authGuard } from './utils/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./recipes/recipes.component').then((m) => m.RecipesComponent),
    canActivate: [authGuard],
    title: 'Receptek',
  },
  {
    path: 'recept/:id',
    loadComponent: () =>
      import('./recipe-detail/recipe-detail.component').then(
        (m) => m.RecipeDetailComponent
      ),
    canActivate: [authGuard],
    title: 'Recept',
  },
  {
    path: 'importalas',
    loadComponent: () =>
      import('./import/import.component').then((m) => m.ImportComponent),
    canActivate: [authGuard],
    title: 'Recept importálása',
  },
];
