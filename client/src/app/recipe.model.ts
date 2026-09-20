export interface Ingredient {
  readonly name: string;
  readonly amount: number | null;
  readonly unit: string | null;
}

export interface RecipeListItem {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly imageId: string | null;
}

export interface Recipe extends RecipeListItem {
  readonly description: string;
  readonly servings: number;
  readonly ingredients: readonly Ingredient[];
  readonly steps: readonly string[];
}

export interface CandidateImage {
  readonly id: string;
  readonly status: 'PENDING' | 'COMPLETED' | 'FAILED';
  readonly error: string | null;
}

export const CATEGORY_ORDER: readonly string[] = [
  'Reggeli', 'Leves', 'Főétel', 'Köret', 'Saláta',
  'Desszert', 'Sütemény', 'Ital', 'Egyéb',
];

export function groupRecipes(recipes: readonly RecipeListItem[]) {
  const categories = [...new Set(recipes.map(({ category }) => category))];
  const ordered = [
    ...CATEGORY_ORDER.filter((category) => categories.includes(category)),
    ...categories.filter((category) => !CATEGORY_ORDER.includes(category))
      .sort((a, b) => a.localeCompare(b, 'hu')),
  ];
  return ordered.map((category) => ({
    category,
    recipes: recipes.filter((recipe) => recipe.category === category)
      .sort((a, b) => a.title.localeCompare(b.title, 'hu')),
  }));
}
