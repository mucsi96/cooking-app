import {
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  input,
  signal,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { CandidateImage, Recipe } from '../recipe.model';
import { RecipeImageComponent } from '../recipe-image/recipe-image.component';
import { RecipeService } from '../recipe.service';
import { formatAmount, scaleAmount } from '../utils/formatAmount';

const CANDIDATE_POLL_INTERVAL_MS = 1000;

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
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();
  readonly recipe = httpResource<Recipe>(() => `/api/recipes/${this.id()}`);
  readonly candidates = httpResource<readonly CandidateImage[]>(
    () => `/api/recipes/${this.id()}/images`
  );

  readonly servings = linkedSignal(() => this.recipe.hasValue() ? this.recipe.value().servings : 1);
  readonly generating = signal(false);

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

  constructor() {
    const pollHandle = setInterval(() => {
      if (
        this.candidates.hasValue() &&
        this.candidates.value().some((c) => c.status === 'PENDING') &&
        !this.candidates.isLoading()
      ) {
        this.candidates.reload();
      }
    }, CANDIDATE_POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(pollHandle));
  }

  decreaseServings(): void {
    this.servings.update((servings) => Math.max(1, servings - 1));
  }

  increaseServings(): void {
    this.servings.update((servings) => servings + 1);
  }

  printRecipe(): void {
    window.print();
  }

  async selectImage(imageId: string): Promise<void> {
    await this.recipeService.selectImage(this.id(), imageId);
    this.recipe.reload();
    this.recipeService.recipes.reload();
  }

  async generateImages(): Promise<void> {
    this.generating.set(true);
    try {
      await this.recipeService.generateCandidateImages(this.id());
      this.candidates.reload();
    } finally {
      this.generating.set(false);
    }
  }
}
