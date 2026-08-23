import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5461,
  database: 'test',
  user: 'postgres',
  password: 'postgres',
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export interface SeedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
}

export interface SeedRecipe {
  title: string;
  description: string;
  category: string;
  servings: number;
  ingredients: SeedIngredient[];
  steps: string[];
}

export async function cleanupDb() {
  // recipe_ingredients, recipe_steps and image_generation_jobs cascade
  await query('DELETE FROM cooking.recipes');
}

export async function insertRecipe(recipe: SeedRecipe): Promise<string> {
  const result = await query(
    `INSERT INTO cooking.recipes (id, title, description, category, servings, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
     RETURNING id`,
    [recipe.title, recipe.description, recipe.category, recipe.servings]
  );
  const recipeId = result.rows[0].id as string;

  await Promise.all([
    ...recipe.ingredients.map((ingredient, position) =>
      query(
        `INSERT INTO cooking.recipe_ingredients (recipe_id, position, name, amount, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, position, ingredient.name, ingredient.amount, ingredient.unit]
      )
    ),
    ...recipe.steps.map((step, position) =>
      query(
        `INSERT INTO cooking.recipe_steps (recipe_id, position, step)
         VALUES ($1, $2, $3)`,
        [recipeId, position, step]
      )
    ),
  ]);

  return recipeId;
}

export async function getRecipes() {
  const result = await query('SELECT * FROM cooking.recipes ORDER BY created_at');
  return result.rows;
}

export const GULYAS: SeedRecipe = {
  title: 'Gulyásleves',
  description:
    'Klasszikus magyar gulyásleves marhahússal, burgonyával és bőséges pirospaprikával.',
  category: 'Leves',
  servings: 4,
  ingredients: [
    { name: 'marhalábszár', amount: 500, unit: 'g' },
    { name: 'pirospaprika', amount: 2, unit: 'evőkanál' },
    { name: 'só', amount: null, unit: null },
  ],
  steps: [
    'Pirítsd meg a hagymát, majd add hozzá a húst.',
    'Öntsd fel vízzel, és főzd puhára.',
  ],
};

export const PALACSINTA: SeedRecipe = {
  title: 'Palacsinta',
  description: 'Vékony, klasszikus palacsinta, édes vagy sós töltelékhez.',
  category: 'Desszert',
  servings: 4,
  ingredients: [
    { name: 'liszt', amount: 300, unit: 'g' },
    { name: 'tej', amount: 5, unit: 'dl' },
    { name: 'tojás', amount: 2, unit: 'db' },
  ],
  steps: ['Keverd össze a hozzávalókat.', 'Süsd ki a palacsintákat.'],
};
