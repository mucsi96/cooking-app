import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { RecipeImageComponent } from '../recipe-image/recipe-image.component';
import { RecipeService } from '../recipe.service';
import { groupRecipes } from '../recipe.model';

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

  readonly categories = computed(() =>
    groupRecipes(this.recipes.hasValue() ? this.recipes.value() : [])
  );

  constructor() {
    this.recipes.reload();
  }
}
