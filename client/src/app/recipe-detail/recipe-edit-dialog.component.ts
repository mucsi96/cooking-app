import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CATEGORY_ORDER, Ingredient, Recipe, RecipeContent } from '../recipe.model';
import { RecipeService } from '../recipe.service';

@Component({
  selector: 'app-recipe-edit-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './recipe-edit-dialog.component.html',
  styles: `
    mat-form-field { width: 100%; }
    fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    .ingredient { border-bottom: 1px solid var(--mat-sys-outline-variant); margin-bottom: 1rem; padding-bottom: 1rem; }
    .quantity { display: flex; gap: 1rem; }
    mat-dialog-actions { gap: .5rem; }
  `,
})
export class RecipeEditDialogComponent {
  private readonly original = inject<Recipe>(MAT_DIALOG_DATA);
  private readonly service = inject(RecipeService);
  private readonly dialogRef = inject(MatDialogRef<RecipeEditDialogComponent>);
  readonly categories = CATEGORY_ORDER;
  readonly content = signal<RecipeContent>({
    title: this.original.title, description: this.original.description,
    category: this.original.category, servings: this.original.servings,
    ingredients: this.original.ingredients.map(ingredient => ({ ...ingredient })),
    steps: [...this.original.steps],
  });
  readonly saving = signal(false);
  readonly error = signal('');

  update(patch: Partial<RecipeContent>): void {
    this.content.update(content => ({ ...content, ...patch }));
  }

  ingredient(index: number, patch: Partial<Ingredient>): void {
    this.update({ ingredients: this.content().ingredients.map((item, i) => i === index ? { ...item, ...patch } : item) });
  }

  addIngredient(): void {
    this.update({ ingredients: [...this.content().ingredients, { name: '', amount: null, unit: null }] });
  }

  removeIngredient(index: number): void {
    this.update({ ingredients: this.content().ingredients.filter((_, i) => i !== index) });
  }

  step(index: number, value: string): void {
    this.update({ steps: this.content().steps.map((item, i) => i === index ? value : item) });
  }

  addStep(): void {
    this.update({ steps: [...this.content().steps, ''] });
  }

  removeStep(index: number): void {
    this.update({ steps: this.content().steps.filter((_, i) => i !== index) });
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.dialogRef.disableClose = true;
    this.error.set('');
    try {
      await this.service.updateRecipe(this.original.id, this.content());
      this.dialogRef.close(true);
    } catch {
      this.error.set('A mentés nem sikerült. Ellenőrizd az adatokat, és próbáld újra.');
    } finally {
      this.saving.set(false);
      this.dialogRef.disableClose = false;
    }
  }
}
