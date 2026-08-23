import {
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { map } from 'rxjs';
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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly recipeId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id')!)),
    { initialValue: this.route.snapshot.paramMap.get('id')! }
  );

  readonly recipe = resource({
    params: () => ({ id: this.recipeId() }),
    loader: ({ params }) => this.recipeService.getRecipe(params.id),
  });

  readonly candidates = resource({
    params: () => ({ id: this.recipeId() }),
    loader: ({ params }) => this.recipeService.getCandidateImages(params.id),
  });

  readonly servings = linkedSignal(() => this.recipe.value()?.servings ?? 1);
  readonly generating = signal(false);

  readonly scaledIngredients = computed(() => {
    const recipe = this.recipe.value();
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
        this.candidates.value()?.some((c) => c.status === 'PENDING') &&
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

  async selectImage(imageId: string): Promise<void> {
    await this.recipeService.selectImage(this.recipeId(), imageId);
    this.recipe.reload();
    this.recipeService.recipes.reload();
  }

  async generateImages(): Promise<void> {
    this.generating.set(true);
    try {
      await this.recipeService.generateCandidateImages(this.recipeId());
      this.candidates.reload();
    } finally {
      this.generating.set(false);
    }
  }
}
