import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CandidateImage, Recipe, RecipeContent, RecipeListItem } from './recipe.model';
import { fetchJson } from './utils/fetchJson';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly http = inject(HttpClient);

  readonly recipes = httpResource<readonly RecipeListItem[]>(() => '/api/recipes');

  updateRecipe(id: string, content: RecipeContent): Promise<void> {
    return fetchJson(this.http, `/api/recipes/${id}`, { method: 'PUT', body: content });
  }

  importRecipe(text: string): Promise<Recipe> {
    return fetchJson(this.http, '/api/recipes/import', {
      method: 'POST', body: { text },
    });
  }

  importRecipeImage(image: File): Promise<Recipe> {
    const body = new FormData();
    body.append('image', image);
    return fetchJson(this.http, '/api/recipes/import/image', { method: 'POST', body });
  }

  uploadRecipePhoto(recipeId: string, photo: File): Promise<readonly CandidateImage[]> {
    const body = new FormData();
    body.append('image', photo);
    return fetchJson(this.http, `/api/recipes/${recipeId}/images`, { method: 'POST', body });
  }

  selectImage(recipeId: string, imageId: string): Promise<void> {
    return fetchJson(this.http, `/api/recipes/${recipeId}/image`, {
      method: 'PUT', body: { imageId },
    });
  }
}
