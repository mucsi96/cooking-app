import { test, expect } from '../fixtures';
import { GULYAS, PALACSINTA, insertRecipe } from '../utils';

test('rejects malformed recipe responses and recovers through retry', async ({ page }) => {
  await insertRecipe(GULYAS);
  await page.route('**/api/recipes', route => route.fulfill({ json: [{ id: 'invalid', title: 42 }] }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('A receptek betöltése nem sikerült.');
  await page.unroute('**/api/recipes');
  await page.getByRole('button', { name: 'Újrapróbálás' }).click();
  await expect(page.getByRole('link', { name: 'Gulyásleves' })).toBeVisible();
});

test('shows loading and retry states for recipe details', async ({ page }) => {
  const id = await insertRecipe(GULYAS);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/recipes/${id}`, async route => {
    await pending;
    await route.fulfill({ status: 503, json: { message: 'Hiba' } });
  });
  try {
    await page.goto(`/recept/${id}`);
    await expect(page.getByRole('progressbar', { name: 'Recept betöltése' })).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('alert')).toContainText('A recept betöltése nem sikerült.');
  await page.unroute(`**/api/recipes/${id}`);
  await page.getByRole('button', { name: 'Újrapróbálás' }).click();
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
});

test('navigation and browser history keep each recipe and serving scale isolated', async ({ page }) => {
  await insertRecipe(GULYAS);
  await insertRecipe(PALACSINTA);
  await page.goto('/');
  await page.getByRole('link', { name: 'Gulyásleves' }).click();
  await page.getByRole('button', { name: 'Adagok növelése' }).click();
  await expect(page.getByText('5 adag')).toBeVisible();
  await page.getByRole('link', { name: 'Receptek', exact: true }).click();
  await page.getByRole('link', { name: 'Palacsinta' }).click();
  await expect(page.getByRole('heading', { name: 'Palacsinta' })).toBeVisible();
  await expect(page.getByText(`${PALACSINTA.servings} adag`)).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await expect(page.getByText('4 adag')).toBeVisible();
});

test('model-setting save failures retain the draft for retry', async ({ page }) => {
  await page.goto('/beallitasok');
  const count = page.getByRole('spinbutton', { name: 'gpt-image-2.5-sunburst (medium) képek száma', exact: true });
  await count.fill('2');
  await page.route('**/api/settings/models', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 503, json: { message: 'Hiba' } }) : route.fallback());
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('A mentés nem sikerült.');
  await expect(count).toHaveValue('2');
  await page.unroute('**/api/settings/models');
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('A beállításokat mentettük.');
  await page.reload();
  await expect(count).toHaveValue('2');
});
