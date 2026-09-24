import { Component, DestroyRef, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { CandidateImage, Recipe } from '../recipe.model';
import { RecipeImageComponent } from '../recipe-image/recipe-image.component';
import { RecipeService } from '../recipe.service';

interface RecipeImageDialogData {
  readonly recipeId: string;
  readonly imageId: Recipe['imageId'];
  readonly onSelected: () => void;
}

@Component({
  selector: 'app-recipe-image-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, BarLoaderComponent, RecipeImageComponent],
  templateUrl: './recipe-image-dialog.component.html',
  styleUrl: './recipe-image-dialog.component.css',
})
export class RecipeImageDialogComponent {
  private readonly data = inject<RecipeImageDialogData>(MAT_DIALOG_DATA);
  private readonly recipeService = inject(RecipeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedImageId = signal(this.data.imageId);
  readonly generating = signal(false);
  readonly selecting = signal(false);
  readonly error = signal<string | null>(null);
  readonly candidates = httpResource<readonly CandidateImage[]>(
    () => `/api/recipes/${this.data.recipeId}/images`
  );

  constructor() {
    const pollHandle = setInterval(() => {
      if (this.candidates.hasValue() &&
          this.candidates.value().some((candidate) => candidate.status === 'PENDING') &&
          !this.candidates.isLoading()) {
        this.candidates.reload();
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(pollHandle));
  }

  async selectImage(imageId: string): Promise<void> {
    this.selecting.set(true);
    this.error.set(null);
    try {
      await this.recipeService.selectImage(this.data.recipeId, imageId);
      this.selectedImageId.set(imageId);
      this.data.onSelected();
    } catch {
      this.error.set('A borítókép kiválasztása nem sikerült. Próbáld újra.');
    } finally {
      this.selecting.set(false);
    }
  }

  async generateImages(): Promise<void> {
    this.generating.set(true);
    this.error.set(null);
    try {
      await this.recipeService.generateCandidateImages(this.data.recipeId);
      this.candidates.reload();
    } catch {
      this.error.set('A képek generálásának indítása nem sikerült. Próbáld újra.');
    } finally {
      this.generating.set(false);
    }
  }
}
