import { test, expect } from '../fixtures';
import { GULYAS, insertRecipe } from '../utils';

test('keeps primary actions reachable on an iPhone XS viewport', async ({ page }) => {
  const recipeId = await insertRecipe(GULYAS);
  await page.goto(`/recept/${recipeId}`);

  const navigation = page.getByRole('navigation', { name: 'Fő navigáció' });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole('link', { name: 'Receptek', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Importálás', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nyomtatás' })).toBeVisible();

  const brandIsUnobscured = await page.getByText('Szakácskönyv', { exact: true }).evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    ));
  });
  expect(brandIsUnobscured).toBe(true);

  const importLink = page.getByRole('link', { name: 'Importálás', exact: true });
  const expectBottomNavigation = async () => {
    const bounds = await importLink.boundingBox();
    expect(bounds).not.toBeNull();
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(bounds!.y).toBeGreaterThan(viewportHeight - 120);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewportHeight);
  };
  await expectBottomNavigation();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expectBottomNavigation();

  const viewportHasNoOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth === document.documentElement.clientWidth
  );
  expect(viewportHasNoOverflow).toBe(true);

  await page.getByRole('link', { name: 'Importálás', exact: true }).click();
  const cameraButton = page.getByRole('button', { name: 'Fotó készítése' });
  const buttonBounds = await cameraButton.boundingBox();
  expect(buttonBounds?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('button', { name: 'Kiválasztás a Fotókból' })).toBeVisible();
});
