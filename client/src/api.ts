import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

export const categories = ['Reggeli', 'Leves', 'Főétel', 'Köret', 'Saláta', 'Desszert', 'Sütemény', 'Ital', 'Egyéb'] as const;
const ingredientSchema = z.object({ name: z.string(), amount: z.number().nullable(), unit: z.string().nullable() });
const recipeListItemSchema = z.object({ id: z.string(), title: z.string(), category: z.string(), imageId: z.string().nullable() });
export const recipeSchema = recipeListItemSchema.extend({
  description: z.string(), servings: z.number().int().positive(),
  ingredients: z.array(ingredientSchema), steps: z.array(z.string()),
});
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeContent = Omit<Recipe, 'id' | 'imageId'>;
export type Ingredient = z.infer<typeof ingredientSchema>;
export const candidatesSchema = z.array(z.object({
  id: z.string(), status: z.enum(['PENDING', 'COMPLETED', 'FAILED']), error: z.string().nullable(),
}));
export const settingsSchema = z.object({
  extraction: z.string(), scene: z.string(),
  images: z.array(z.object({ id: z.string(), count: z.number().int().min(0).max(10) })),
}).refine(value => value.images.reduce((total, image) => total + image.count, 0) <= 30);
export type Settings = z.infer<typeof settingsSchema>;
export const catalogSchema = z.object({
  data: z.array(z.object({ id: z.string(), provider: z.string() })),
  images: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type Catalog = z.infer<typeof catalogSchema>;
const profileSchema = z.object({
  email: z.string(), preferredUsername: z.string().optional(),
  additionalClaims: z.object({ name: z.string().optional() }).optional(),
});

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(path, {
    ...init, credentials: 'same-origin',
    headers: { 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone, ...init.headers },
  });
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(await response.json().catch(() => null));
    throw new ApiError(response.status, error.success ? error.data.message : 'A kérés nem sikerült. Próbáld újra.');
  }
  return response;
}

export async function readJson<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  return schema.parse(await (await request(path, { signal })).json());
}

export async function mutate(path: string, method: 'POST' | 'PUT', body: unknown): Promise<Response> {
  return request(path, body instanceof FormData
    ? { method, body }
    : { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
}

export function photoBody(file: File): FormData {
  const body = new FormData();
  body.append('image', file);
  return body;
}

export const recipesQuery = queryOptions({ queryKey: ['recipes'], queryFn: ({ signal }) => readJson('/api/recipes', z.array(recipeListItemSchema), signal) });
export const recipeQuery = (id: string) => queryOptions({ queryKey: ['recipe', id], queryFn: ({ signal }) => readJson(`/api/recipes/${encodeURIComponent(id)}`, recipeSchema, signal) });
export const imagesQuery = (id: string) => queryOptions({ queryKey: ['images', id], queryFn: ({ signal }) => readJson(`/api/recipes/${encodeURIComponent(id)}/images`, candidatesSchema, signal) });
export const settingsQuery = queryOptions({ queryKey: ['settings'], queryFn: ({ signal }) => readJson('/api/settings/models', settingsSchema, signal) });
export const catalogQuery = queryOptions({ queryKey: ['catalog'], queryFn: ({ signal }) => readJson('/api/models', catalogSchema, signal) });
export const profileQuery = queryOptions({ queryKey: ['profile'], queryFn: ({ signal }) => readJson('/oauth2/userinfo', profileSchema, signal), staleTime: Infinity });
