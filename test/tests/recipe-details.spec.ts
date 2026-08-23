import { test, expect } from '../fixtures';
import { GULYAS, insertRecipe } from '../utils';

test.beforeEach(async ({ page }) => {
  const recipeId = await insertRecipe(GULYAS);
  await page.goto(`/recept/${recipeId}`);
});

test('displays the recipe with ingredients and steps', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await expect(page.getByText('Leves', { exact: true })).toBeVisible();
  await expect(page.getByText('4 adag')).toBeVisible();
  await expect(page.getByText('500 g')).toBeVisible();
  await expect(page.getByText('marhalábszár')).toBeVisible();
  await expect(page.getByText('só', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Pirítsd meg a hagymát, majd add hozzá a húst.')
  ).toBeVisible();
});

test('scales ingredient amounts when increasing servings', async ({ page }) => {
  await page.getByRole('button', { name: 'Adagok növelése' }).click();

  await expect(page.getByText('5 adag')).toBeVisible();
  await expect(page.getByText('625 g')).toBeVisible();
  await expect(page.getByText('2,5 evőkanál')).toBeVisible();
});

test('scales ingredient amounts when decreasing servings', async ({ page }) => {
  await page.getByRole('button', { name: 'Adagok csökkentése' }).click();
  await page.getByRole('button', { name: 'Adagok csökkentése' }).click();

  await expect(page.getByText('2 adag')).toBeVisible();
  await expect(page.getByText('250 g')).toBeVisible();
  await expect(page.getByText('1 evőkanál')).toBeVisible();
});

test('does not decrease servings below one', async ({ page }) => {
  const decrease = page.getByRole('button', { name: 'Adagok csökkentése' });
  await decrease.click();
  await decrease.click();
  await decrease.click();

  await expect(page.getByText('1 adag')).toBeVisible();
  await expect(decrease).toBeDisabled();
  await expect(page.getByText('125 g')).toBeVisible();
});
