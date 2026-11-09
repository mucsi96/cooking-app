import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'beallitasok',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
    title: 'Beállítások',
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./recipes/recipes.component').then((m) => m.RecipesComponent),
    title: 'Receptek',
  },
  {
    path: 'recept/:id',
    loadComponent: () =>
      import('./recipe-detail/recipe-detail.component').then(
        (m) => m.RecipeDetailComponent
      ),
    title: 'Recept',
  },
  {
    path: 'importalas',
    loadComponent: () =>
      import('./import/import.component').then((m) => m.ImportComponent),
    title: 'Recept importálása',
  },
];
