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

test('opens image generation from the empty thumbnail and restores keyboard focus', async ({ page }) => {
  const thumbnail = page.getByRole('button', { name: 'Borítókép módosítása' });
  await expect(page.getByRole('button', { name: 'Új képek generálása' })).toBeHidden();
  await thumbnail.click();
  const dialog = page.getByRole('dialog', { name: 'Borítókép', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Még nincs választható kép.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Új képek generálása' }).click();
  const candidates = dialog.getByRole('button', { name: /Kép kiválasztása/ });
  await expect(candidates).toHaveCount(3, { timeout: 30000 });
  await candidates.first().click();
  await expect(candidates.first()).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Bezárás' }).click();
  await expect(thumbnail).toBeFocused();
  await thumbnail.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(candidates.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('heading', { name: 'Borítókép', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Bezárás', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(thumbnail).toBeFocused();
  await thumbnail.press('Enter');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(thumbnail).toBeFocused();
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
  await expect(page.getByRole('button', { name: 'Borítókép módosítása' })).toBeHidden();
  const printColors = await page.getByRole('heading', { name: 'Gulyásleves' }).evaluate((heading) => ({
    background: getComputedStyle(document.body).backgroundColor,
    text: getComputedStyle(heading).color,
  }));
  expect(printColors).toEqual({ background: 'rgb(255, 255, 255)', text: 'rgb(0, 0, 0)' });
});
