import {
  Component,
  computed,
  inject,
  linkedSignal,
  input,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { Recipe } from '../recipe.model';
import { RecipeImageDialogComponent } from './recipe-image-dialog.component';
import { RecipeImageComponent } from '../recipe-image/recipe-image.component';
import { RecipeService } from '../recipe.service';
import { formatAmount, scaleAmount } from '../utils/formatAmount';

@Component({
  selector: 'app-recipe-detail',
  imports: [
    BarLoaderComponent,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    RecipeImageComponent,
  ],
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.css',
})
export class RecipeDetailComponent {
  private readonly recipeService = inject(RecipeService);
  private readonly dialog = inject(MatDialog);

  readonly id = input.required<string>();
  readonly recipe = httpResource<Recipe>(() => `/api/recipes/${this.id()}`);

  readonly servings = linkedSignal(() => this.recipe.hasValue() ? this.recipe.value().servings : 1);

  readonly scaledIngredients = computed(() => {
    const recipe = this.recipe.hasValue() ? this.recipe.value() : undefined;
    if (!recipe) {
      return [];
    }
    return recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      formattedAmount:
        ingredient.amount === null
          ? null
          : formatAmount(
              scaleAmount(ingredient.amount, this.servings(), recipe.servings)
            ),
    }));
  });

  decreaseServings(): void {
    this.servings.update((servings) => Math.max(1, servings - 1));
  }

  increaseServings(): void {
    this.servings.update((servings) => servings + 1);
  }

  printRecipe(): void {
    window.print();
  }

  openImageDialog(): void {
    this.dialog.open(RecipeImageDialogComponent, {
      width: '720px',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-heading',
      data: {
        recipeId: this.id(),
        imageId: this.recipe.value()!.imageId,
        onSelected: () => {
          this.recipe.reload();
          this.recipeService.recipes.reload();
        },
      },
    });
  }
}
