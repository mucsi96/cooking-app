import { test, expect } from '../fixtures';
import { GULYAS, PALACSINTA, insertRecipe } from '../utils';

test('displays app title in browser tab', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Receptek');
});

test('displays app name in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Receptek' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Receptek' })).toHaveAttribute('href', '/');
});

test('shows user initials in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
});

test('shows empty state with a link to import', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Még nincs egyetlen recept sem' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Recept importálása' })).toBeVisible();
});

test('groups recipes by category', async ({ page }) => {
  await insertRecipe(GULYAS);
  await insertRecipe(PALACSINTA);

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Leves', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Desszert', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gulyásleves' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Palacsinta' })).toBeVisible();
});

test('navigates to recipe details from the list', async ({ page }) => {
  await insertRecipe(GULYAS);

  await page.goto('/');
  await page.getByRole('link', { name: 'Gulyásleves' }).click();

  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await expect(
    page.getByText('Klasszikus magyar gulyásleves', { exact: false })
  ).toBeVisible();
});
