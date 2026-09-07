import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Recipe, RecipeService } from '../recipe.service';

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

@Component({
  selector: 'app-import',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private readonly recipeService = inject(RecipeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly text = signal('');
  readonly selectedPhoto = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly importing = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  selectPhoto(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const photo = input.files?.[0];
    input.value = '';
    if (!photo) {
      return;
    }

    this.clearPhoto();
    if (!photo.type.startsWith('image/') && !/\.(heic|heif)$/i.test(photo.name)) {
      this.error.set('Válassz egy fényképet a receptről.');
      return;
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      this.error.set('A fénykép legfeljebb 15 MB lehet.');
      return;
    }

    this.error.set(null);
    this.selectedPhoto.set(photo);
    this.previewUrl.set(URL.createObjectURL(photo));
  }

  clearPhoto(): void {
    this.revokePreview();
    this.selectedPhoto.set(null);
    this.error.set(null);
  }

  async importRecipe(): Promise<void> {
    if (!this.text().trim() || this.importing()) {
      return;
    }
    this.importing.set(true);
    this.error.set(null);
    try {
      const recipe = await this.recipeService.importRecipe(this.text());
      await this.finishImport(recipe);
    } catch {
      this.error.set('A recept feldolgozása nem sikerült. Próbáld újra.');
    } finally {
      this.importing.set(false);
    }
  }

  async importPhoto(): Promise<void> {
    const photo = this.selectedPhoto();
    if (!photo || this.importing()) {
      return;
    }
    this.importing.set(true);
    this.error.set(null);
    try {
      const recipe = await this.recipeService.importRecipeImage(photo);
      await this.finishImport(recipe);
    } catch {
      this.error.set('A recept felismerése nem sikerült. Készíts élesebb fotót, és próbáld újra.');
    } finally {
      this.importing.set(false);
    }
  }

  private async finishImport(recipe: Recipe): Promise<void> {
    this.recipeService.recipes.reload();
    await this.router.navigate(['/recept', recipe.id]);
  }

  private revokePreview(): void {
    const previewUrl = this.previewUrl();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      this.previewUrl.set(null);
    }
  }
}
