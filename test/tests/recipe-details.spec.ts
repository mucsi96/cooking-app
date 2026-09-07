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

test('opens phone printing and provides a toner-friendly print layout', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: () => document.body.setAttribute('data-print-opened', 'true'),
    });
  });
  await page.getByRole('button', { name: 'Nyomtatás' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-opened', 'true');

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await expect(page.getByText('marhalábszár')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Fő navigáció' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Nyomtatás' })).toBeHidden();
  await expect(page.getByRole('img', { name: 'Gulyásleves' })).toBeHidden();
  await expect(page.getByRole('region', { name: 'Borítókép' })).toBeHidden();
  const printColors = await page.getByRole('heading', { name: 'Gulyásleves' }).evaluate((heading) => ({
    background: getComputedStyle(document.body).backgroundColor,
    text: getComputedStyle(heading).color,
  }));
  expect(printColors).toEqual({ background: 'rgb(255, 255, 255)', text: 'rgb(0, 0, 0)' });
});
