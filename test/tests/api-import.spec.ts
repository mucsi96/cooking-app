import { test, expect } from '../fixtures';

const GERMAN_STRUDEL_TEXT = `Omas Apfelstrudel

Für 8 Portionen

Zutaten: 6 Strudelblätter, 1 kg Äpfel, 100 g Zucker, 1 TL Zimt, 80 g zerlassene Butter.

Die Äpfel reiben und mit Zucker und Zimt vermischen. Die Strudelblätter mit
Butter bestreichen, die Füllung verteilen und den Strudel einrollen.
Bei 180 Grad 35 Minuten goldbraun backen.`;

test('imports a recipe from plain text over the authenticated API', async ({ page, apiHeaders }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Felhasználói menü' })).toHaveText('O');

  const response = await page.request.post('/api/recipes/import', {
    headers: { ...apiHeaders, Origin: new URL(page.url()).origin },
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

test('rejects the retired integration import route and requires Origin for UI imports', async ({ page, request, apiHeaders }) => {
  await page.goto('/');
  const response = await request.post('/api/integrations/recipes/import', {
    headers: { ...apiHeaders, Origin: new URL(page.url()).origin }, data: { text: GERMAN_STRUDEL_TEXT },
  });
  expect(response.status()).toBe(404);
  const missingOrigin = await request.post('/api/recipes/import', {
    headers: apiHeaders, data: { text: GERMAN_STRUDEL_TEXT },
  });
  expect(missingOrigin.status()).toBe(403);
});
