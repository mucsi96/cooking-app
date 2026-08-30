import { test, expect } from '../fixtures';

const GERMAN_STRUDEL_TEXT = `Omas Apfelstrudel

Für 8 Portionen

Zutaten: 6 Strudelblätter, 1 kg Äpfel, 100 g Zucker, 1 TL Zimt, 80 g zerlassene Butter.

Die Äpfel reiben und mit Zucker und Zimt vermischen. Die Strudelblätter mit
Butter bestreichen, die Füllung verteilen und den Strudel einrollen.
Bei 180 Grad 35 Minuten goldbraun backen.`;

// The same text-in endpoint drives the email based import pipeline: a plain
// POST with the raw recipe text is enough to persist a Hungarian recipe.
test('imports a recipe from plain text over the API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();

  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('oidc.user'));
    return key ? JSON.parse(localStorage.getItem(key)!).access_token : null;
  });
  expect(token).toBeTruthy();

  const response = await page.request.post('/api/recipes/import', {
    headers: { Authorization: `Bearer ${token}` },
    data: { text: GERMAN_STRUDEL_TEXT },
  });

  expect(response.ok()).toBeTruthy();
  const recipe = await response.json();
  expect(recipe.title).toBe('Almás rétes');
  expect(recipe.category).toBe('Sütemény');
  expect(recipe.servings).toBe(8);
  expect(recipe.ingredients).toContainEqual({
    name: 'réteslap',
    amount: 6,
    unit: 'db',
  });

  // The imported recipe shows up in the Hungarian category listing
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sütemény' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Almás rétes' })).toBeVisible();
});
