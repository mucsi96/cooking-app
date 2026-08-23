import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { RecipeImageComponent } from '../recipe-image/recipe-image.component';
import {
  CATEGORY_ORDER,
  RecipeListItem,
  RecipeService,
} from '../recipe.service';

interface CategoryGroup {
  category: string;
  recipes: RecipeListItem[];
}

@Component({
  selector: 'app-recipes',
  imports: [
    BarLoaderComponent,
    MatButtonModule,
    MatCardModule,
    RouterLink,
    RecipeImageComponent,
  ],
  templateUrl: './recipes.component.html',
  styleUrl: './recipes.component.css',
})
export class RecipesComponent {
  private readonly recipeService = inject(RecipeService);

  readonly recipes = this.recipeService.recipes;

  readonly categories = computed<CategoryGroup[]>(() => {
    const recipes = this.recipes.value() ?? [];
    const known = CATEGORY_ORDER.filter((category) =>
      recipes.some((recipe) => recipe.category === category)
    );
    const unknown = [
      ...new Set(
        recipes
          .map((recipe) => recipe.category)
          .filter((category) => !CATEGORY_ORDER.includes(category))
      ),
    ].sort((a, b) => a.localeCompare(b, 'hu'));

    return [...known, ...unknown].map((category) => ({
      category,
      recipes: recipes
        .filter((recipe) => recipe.category === category)
        .sort((a, b) => a.title.localeCompare(b.title, 'hu')),
    }));
  });

  constructor() {
    this.recipes.reload();
  }
}
