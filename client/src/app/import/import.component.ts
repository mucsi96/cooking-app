import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { RecipeService } from '../recipe.service';

@Component({
  selector: 'app-import',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private readonly recipeService = inject(RecipeService);
  private readonly router = inject(Router);

  readonly text = signal('');
  readonly importing = signal(false);

  async importRecipe(): Promise<void> {
    if (!this.text().trim() || this.importing()) {
      return;
    }
    this.importing.set(true);
    try {
      const recipe = await this.recipeService.importRecipe(this.text());
      this.recipeService.recipes.reload();
      await this.router.navigate(['/recept', recipe.id]);
    } finally {
      this.importing.set(false);
    }
  }
}
