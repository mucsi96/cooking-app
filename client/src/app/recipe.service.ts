import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { fetchJson } from './utils/fetchJson';

export interface RecipeListItem {
  id: string;
  title: string;
  category: string;
  imageId: string | null;
}

export interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  category: string;
  servings: number;
  imageId: string | null;
  ingredients: Ingredient[];
  steps: string[];
}

export type CandidateImageStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface CandidateImage {
  id: string;
  status: CandidateImageStatus;
  error: string | null;
}

export const CATEGORY_ORDER = [
  'Reggeli',
  'Leves',
  'Főétel',
  'Köret',
  'Saláta',
  'Desszert',
  'Sütemény',
  'Ital',
  'Egyéb',
];

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private readonly http = inject(HttpClient);

  readonly recipes = resource<RecipeListItem[], {}>({
    loader: () => fetchJson<RecipeListItem[]>(this.http, '/api/recipes'),
  });

  getRecipe(id: string): Promise<Recipe> {
    return fetchJson<Recipe>(this.http, `/api/recipes/${id}`);
  }

  importRecipe(text: string): Promise<Recipe> {
    return fetchJson<Recipe>(this.http, '/api/recipes/import', {
      method: 'post',
      body: { text },
    });
  }

  getCandidateImages(recipeId: string): Promise<CandidateImage[]> {
    return fetchJson<CandidateImage[]>(this.http, `/api/recipes/${recipeId}/images`);
  }

  generateCandidateImages(recipeId: string): Promise<CandidateImage[]> {
    return fetchJson<CandidateImage[]>(this.http, `/api/recipes/${recipeId}/images`, {
      method: 'post',
    });
  }

  selectImage(recipeId: string, imageId: string): Promise<void> {
    return fetchJson<void>(this.http, `/api/recipes/${recipeId}/image`, {
      method: 'put',
      body: { imageId },
    });
  }
}
