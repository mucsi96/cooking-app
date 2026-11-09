import { Component, DestroyRef, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
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
  private readonly dialogRef = inject(MatDialogRef<RecipeImageDialogComponent>);

  readonly selectedImageId = signal(this.data.imageId);
  readonly generating = signal(false);
  readonly selecting = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedPhoto = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
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
    this.destroyRef.onDestroy(() => {
      clearInterval(pollHandle);
      this.clearPhoto();
    });
  }

  selectPhoto(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const photo = input.files?.[0];
    input.value = '';
    if (!photo || this.generating()) return;
    this.clearPhoto();
    this.error.set(null);
    if (!photo.type.startsWith('image/') && !/\.(heic|heif)$/i.test(photo.name)) {
      this.error.set('Válassz egy fényképet az ételről.');
      return;
    }
    if (photo.size > 15 * 1024 * 1024) {
      this.error.set('A fénykép legfeljebb 15 MB lehet.');
      return;
    }
    this.selectedPhoto.set(photo);
    this.previewUrl.set(URL.createObjectURL(photo));
  }

  clearPhoto(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
    this.selectedPhoto.set(null);
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

  async uploadPhoto(): Promise<void> {
    const photo = this.selectedPhoto();
    if (!photo || this.generating()) return;
    this.generating.set(true);
    this.dialogRef.disableClose = true;
    this.error.set(null);
    try {
      await this.recipeService.uploadRecipePhoto(this.data.recipeId, photo);
      this.clearPhoto();
      this.candidates.reload();
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message : 'A fénykép feltöltése nem sikerült. Próbáld újra.');
    } finally {
      this.generating.set(false);
      this.dialogRef.disableClose = false;
    }
  }
}
